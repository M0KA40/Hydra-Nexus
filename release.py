"""Package the tested installer and intentionally selected repository sources."""
from pathlib import Path
import hashlib,re,zipfile
root=Path(__file__).resolve().parent
version=re.search(r"version:'([^']+)'",(root/'src/brand.cjs').read_text(encoding='utf8')).group(1)
revision=int(re.search(r'revision:(\d+)',(root/'src/brand.cjs').read_text(encoding='utf8')).group(1))
notes=(root/f'docs/releases/{version}.md').read_text(encoding='utf8')
assert f'<!-- HYDRA_NEXUS_REVISION {revision} -->' in notes, 'Release notes must match the exact installer revision'
assert not re.search(r'[\u0600-\u06ff]',notes), 'Public release notes must be English only'
out=root/'dist'
files=[p for p in root.iterdir() if p.is_file()]
for folder in ['src','docs','assets','installer','.github']:
    files.extend(p for p in (root/folder).rglob('*') if p.is_file() and not any(part.startswith('audit-') for part in p.relative_to(root).parts))
files.extend((root/'tests').glob('*.cjs'))
files.append(root/'tests/check.py')
files.extend((root/'tests/fixtures').glob('*.json'))
with zipfile.ZipFile(out/f'Hydra-Nexus-{version}-source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(set(files)):
        archive.write(file,'Hydra-Nexus/'+file.relative_to(root).as_posix())
names=['Hydra_Nexus.bat',f'Hydra-Nexus-{version}-source.zip']
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((out/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in names),encoding='utf8')
assert f':: HYDRA_NEXUS_RELEASE {version}\r\n'.encode() in (out/'Hydra_Nexus.bat').read_bytes()[:160]
print('Packaged Hydra Nexus '+version)
