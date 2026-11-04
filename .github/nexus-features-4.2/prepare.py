"""Manual Actions task: preview or update the localized feature presentation."""
from pathlib import Path, PurePosixPath
import argparse, base64, difflib, hashlib, json, os, re, shutil, subprocess

REPOSITORY = 'M0KA40/Hydra-Nexus'
ALLOWED = {'README.md', 'assets/features/hydra-nexus-game-pause.gif',
           'assets/features/hydra-nexus-steamgriddb-artwork.png',
           *('docs/readme/' + language + '.md' for language in
             ['en','pt-BR','es','ru','ar','fr','de','tr','pl'])}
TASK = Path(__file__).resolve().parent
ROOT = TASK.parents[1]
PAYLOAD = TASK / 'payload'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def regular(root, relative, required=True):
    parts = PurePosixPath(relative)
    if parts.is_absolute() or '..' in parts.parts or '\\' in relative or ':' in relative:
        raise ValueError('Unsafe path')
    path = root / relative
    for current in [path, *path.parents]:
        if current == root:
            break
        if current.is_symlink():
            raise ValueError('Linked files are not accepted: ' + relative)
    if required and not path.is_file():
        raise ValueError('Required file is missing: ' + relative)
    return path

def payload_bytes(name, manifest):
    if name.endswith('.md'):
        text = manifest['documents'][name]
        if not isinstance(text, str):
            raise ValueError('Invalid localized document: ' + name)
        return text.encode('utf-8')
    return regular(PAYLOAD, name).read_bytes()

def checked():
    manifest = json.loads((TASK / 'update.json').read_text(encoding='utf-8'))
    if manifest['repository'] != REPOSITORY or set(manifest['files']) != ALLOWED:
        raise ValueError('Unexpected presentation allowlist')
    actual = {p.relative_to(PAYLOAD).as_posix() for p in PAYLOAD.rglob('*') if p.is_file()}
    if actual != {name for name in ALLOWED if not name.endswith('.md')} or set(manifest['documents']) != {name for name in ALLOWED if name.endswith('.md')}:
        raise ValueError('Payload has unlisted or missing files')
    replacements = {}
    for name, entry in manifest['files'].items():
        data = payload_bytes(name, manifest)
        if sha(data) != entry['sha256'] or len(data) != entry['bytes']:
            raise ValueError('Payload digest mismatch: ' + name)
        current = regular(ROOT, name, required=name.endswith('.md'))
        previous = current.read_bytes() if current.exists() else None
        old = sha(previous) if previous is not None else None
        if old != entry['beforeSha256'] and old != entry['sha256']:
            raise ValueError('Repository content changed; rebase and review: ' + name)
        if previous != data:
            replacements[name] = (previous, data)
    readmes = {name for name in ALLOWED if name.endswith('.md')}
    if set(manifest['readmes']) != readmes or set(manifest['languages']) != {'en','pt-BR','es','ru','ar','fr','de','tr','pl'}:
        raise ValueError('Missing localized feature pages')
    for name, details in manifest['readmes'].items():
        text = payload_bytes(name, manifest).decode('utf-8')
        headers = re.findall(r'^## (.+)$', text, re.M)
        cloud = headers.index('Nexus Cloud · BETA')
        if headers[cloud + 1:cloud + 4] != ['Game Pause', 'SteamGridDB Artwork', details['nextHeader']]:
            raise ValueError('The new sections are not directly below Nexus Cloud: ' + name)
        if headers.count('Game Pause') != 1 or headers.count('SteamGridDB Artwork') != 1:
            raise ValueError('Duplicate feature sections: ' + name)
        prefix = '../../' if name.startswith('docs/') else ''
        for asset in ['hydra-nexus-game-pause.gif','hydra-nexus-steamgriddb-artwork.png']:
            if '](' + prefix + 'assets/features/' + asset + ')' not in text:
                raise ValueError('Localized image path is missing: ' + name)
        for required in ['**F5**','Windows 11','SteamGridDB','Icon','Logo','Library Hero','Cover']:
            if required not in text:
                raise ValueError('Required feature information is missing: ' + name)
    gif = regular(PAYLOAD, 'assets/features/hydra-nexus-game-pause.gif').read_bytes()
    png = regular(PAYLOAD, 'assets/features/hydra-nexus-steamgriddb-artwork.png').read_bytes()
    if gif[:6] not in (b'GIF87a', b'GIF89a') or png[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Unexpected feature media formats')
    return manifest, replacements

def preview(output):
    manifest, changes = checked()
    output = Path(output).resolve()
    if output == ROOT or ROOT in output.parents and not output.relative_to(ROOT).as_posix().startswith('feature-preview'):
        raise ValueError('Use feature-preview as the output directory inside the repository')
    output.mkdir(parents=True, exist_ok=True)
    for name in ALLOWED:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload_bytes(name, manifest))
    patch = ''
    for name in sorted(manifest['readmes']):
        previous = changes.get(name, (regular(ROOT, name).read_bytes(), b''))[0]
        after = payload_bytes(name, manifest)
        patch += ''.join(difflib.unified_diff((previous or b'').decode('utf-8').splitlines(True),
                        after.decode('utf-8').splitlines(True), fromfile='a/'+name, tofile='b/'+name))
    (output / 'README.diff').write_text(patch, encoding='utf-8')
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (output / 'SUMMARY.md').write_text('# Hydra Nexus 4.2 presentation\n\n'
        'Game Pause, then SteamGridDB Artwork, directly below Nexus Cloud · BETA.\n\n'
        'Preview contains the main README, all nine language pages and two local feature images. No release assets, tags or installer are changed.\n\n'
        'Changed files:\n\n' + ''.join('- `' + name + '`\n' for name in sorted(changes)) +
        '\nApplication requires the manual `apply_changes` input.\n', encoding='utf-8')
    print(json.dumps({'verified': True, 'changes': sorted(changes), 'mode': 'preview'}))

def apply(output):
    preview(output)
    _, changes = checked()
    written = []
    try:
        for name, (old, data) in changes.items():
            target = regular(ROOT, name, required=False)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.nexus-presentation-new')
            with temporary.open('xb') as stream:
                stream.write(data)
            temporary.replace(target)
            written.append((target, old))
        checked()
    except BaseException:
        for target, old in reversed(written):
            if old is None:
                target.unlink()
            else:
                target.write_bytes(old)
        raise
    print(json.dumps({'verified': True, 'changes': sorted(changes), 'mode': 'apply'}))

def git(*args, **kwargs):
    return subprocess.check_output(['git', *args], cwd=ROOT, **kwargs)

def commit():
    if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch' or os.environ.get('GITHUB_REPOSITORY') != REPOSITORY or os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Remote updates are only permitted from the manual main-branch Actions job')
    expected = os.environ.get('EXPECTED_HEAD', '')
    if not re.fullmatch('[a-f0-9]{40}', expected) or git('rev-parse', 'HEAD').decode().strip() != expected:
        raise ValueError('Unexpected checkout revision')
    manifest, changes = checked()
    if changes:
        raise ValueError('Run apply before committing')
    tracked = set(filter(None, git('diff', '--name-only', 'HEAD', '-z').decode().split('\0')))
    untracked = set(filter(None, git('ls-files', '--others', '--exclude-standard', '-z').decode().split('\0')))
    unexpected = (tracked | {name for name in untracked if not name.startswith('feature-preview/')}) - ALLOWED
    if unexpected:
        raise ValueError('Unexpected repository changes: ' + ', '.join(sorted(unexpected)))
    for name, entry in manifest['files'].items():
        if sha(regular(ROOT, name).read_bytes()) != entry['sha256']:
            raise ValueError('Staged presentation no longer matches the reviewed payload')
    git('config', 'user.name', 'github-actions[bot]')
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    git('add', '--', *sorted(ALLOWED))
    staged = set(filter(None, git('diff', '--cached', '--name-only', '-z').decode().split('\0')))
    if not staged:
        print('Presentation already matches; no commit or push required.')
        return
    if not staged <= ALLOWED:
        raise ValueError('Staged change exceeds the presentation allowlist')
    token = os.environ.get('GH_TOKEN')
    if not token:
        raise ValueError('The Actions token is unavailable')
    credential = base64.b64encode(('x-access-token:' + token).encode()).decode()
    environment = os.environ.copy()
    environment.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',
                       GIT_CONFIG_VALUE_0='AUTHORIZATION: basic ' + credential)
    remote = git('ls-remote', 'origin', 'refs/heads/main', env=environment).decode().split()[0]
    if remote != expected:
        raise ValueError('Main changed since preview; run the task again after review')
    git('commit', '-m', 'docs: present Game Pause and SteamGridDB Artwork')
    # A normal fast-forward push also rejects a race after ls-remote.
    git('push', 'origin', 'HEAD:refs/heads/main', env=environment)
    print('Applied the reviewed presentation through GitHub Actions. No release was published.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['preview', 'apply', 'commit'])
    parser.add_argument('--output', default='feature-preview')
    args = parser.parse_args()
    if args.mode == 'preview':
        preview(args.output)
    elif args.mode == 'apply':
        apply(args.output)
    else:
        commit()
