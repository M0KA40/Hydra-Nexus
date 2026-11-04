from pathlib import Path, PurePosixPath
import base64,hashlib,json,os,re,struct,subprocess,sys,urllib.request,zipfile

TASK=Path(__file__).resolve().parent;ROOT=TASK.parents[1]
PLAN=json.loads((TASK/'plan.json').read_text(encoding='utf8'))
REPO='M0KA40/Hydra-Nexus';TOKEN=os.environ['GH_TOKEN'];OUT=ROOT/'release-work/approved'
sha=lambda data:hashlib.sha256(data).hexdigest()
assert PLAN['repository']==REPO and PLAN['version']=='4.2' and PLAN['revision']==23

def api(method,path,body=None,authenticated=True):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,method=method,
        data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),
        headers={'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Hydra-Nexus-verified-release','X-GitHub-Api-Version':'2022-11-28'})
    if authenticated:req.add_unredirected_header('Authorization','Bearer '+TOKEN)
    with urllib.request.urlopen(req,timeout=90) as response:
        data=response.read();return json.loads(data) if data else None

def fingerprint(release):
    return {'id':release['id'],'tag':release['tag_name'],'bodySha256':sha((release.get('body') or '').encode()),
        'assets':sorted([{'id':a['id'],'name':a['name'],'size':a['size'],'digest':a.get('digest')} for a in release['assets']],key=lambda x:x['name'])}

def target():
    release=api('GET','/releases/'+str(PLAN['releaseId']))
    assert release['tag_name']=='v4.2' and release['author']['login']=='M0KA40'
    assert not release['prerelease'] and not release.get('immutable',False)
    assert {a['name'] for a in release['assets']}==set(PLAN['files'])
    for asset in release['assets']:
        expected=PLAN['files'][asset['name']]
        assert asset['state']=='uploaded' and asset['size']==expected['bytes']
        assert asset.get('digest')=='sha256:'+expected['sha256']
    return release

def verify():
    OUT.mkdir(parents=True,exist_ok=True);release=target()
    for asset in release['assets']:
        req=urllib.request.Request(asset['url'],headers={'Accept':'application/octet-stream','User-Agent':'Hydra-Nexus-verified-release'})
        req.add_unredirected_header('Authorization','Bearer '+TOKEN)
        path=OUT/asset['name']
        with urllib.request.urlopen(req,timeout=180) as response,path.open('wb') as stream:
            while True:
                chunk=response.read(1024*1024)
                if not chunk:break
                stream.write(chunk)
                assert stream.tell()<=PLAN['files'][asset['name']]['bytes']
        assert sha(path.read_bytes())==PLAN['files'][asset['name']]['sha256']
    sums=dict((name,digest) for digest,name in (line.split('  ',1) for line in (OUT/'SHA256SUMS.txt').read_text().splitlines()))
    assert set(sums)==set(PLAN['files'])-{'SHA256SUMS.txt'}
    for name,digest in sums.items():assert digest==PLAN['files'][name]['sha256']
    binary=(OUT/'Hydra_Nexus.exe').read_bytes();assert binary[:2]==b'MZ' and binary[-8:]==b'HNEXE3\0\1'
    size=struct.unpack_from('<I',binary,len(binary)-12)[0];assert 0<size<=1024
    assert json.loads(binary[-12-size:-12])=={'schema':1,'product':'Hydra Nexus','version':'4.2','revision':23,'engine':'native'}
    notes=json.loads((OUT/'Hydra-Nexus-4.2-release-notes.json').read_text(encoding='utf8'))
    assert notes['schema']==1 and notes['version']=='4.2' and notes['revision']==23
    assert set(notes['notes'])=={'en','pt-BR','es','ru','ar','fr','de','tr','pl'}
    with zipfile.ZipFile(OUT/'Hydra-Nexus-4.2-source.zip') as archive:
        assert archive.testzip() is None and len(archive.namelist())==len(set(archive.namelist()))
        allow=json.loads(archive.read('Hydra-Nexus/release-files.json'))
        assert len(allow)==244 and set(archive.namelist())=={'Hydra-Nexus/'+name for name in allow}
        for name in allow:
            assert '..' not in PurePosixPath(name).parts
            assert not re.search(r'(?i)(^|/)(AGENTS.md|SKILL.md|tests|test-evidence|\.agents|\.codex|dist|node_modules)(/|$)|\.(log|tmp|bak|pdb)$',name)
        assert b'feedbackReviewReset' not in archive.read('Hydra-Nexus/src/brand.cjs')
        assert b'revision:23' in archive.read('Hydra-Nexus/src/brand.cjs')
        for language,text in notes['notes'].items():
            assert archive.read('Hydra-Nexus/docs/releases/4.2/'+language+'.md').decode('utf8')==text
            assert len(re.findall(r'^## ',text,re.M))==8
        cover=archive.read('Hydra-Nexus/assets/promo/release-4.2.png');assert sha(cover)==PLAN['coverSha256']
        (OUT/'release-cover.png').write_bytes(cover)
    for previous in PLAN['previous']:
        current=api('GET','/releases/'+str(previous['id']));assert fingerprint(current)==previous['fingerprint']
    (OUT/'verified.json').write_text(json.dumps({'passed':True,'files':PLAN['files'],'releaseId':PLAN['releaseId'],'version':'4.2','revision':23},indent=2))
    print('PASS: exact reviewed EXE, clean source allowlist, nine-language notes, image, metadata and SHA-256 checksums.')

def git(*args,**kwargs):return subprocess.check_output(['git',*args],cwd=ROOT,**kwargs).decode().strip()

def publish():
    assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch'
    assert os.environ.get('GITHUB_REPOSITORY')==REPO and os.environ.get('GITHUB_REF')=='refs/heads/main'
    assert json.loads((OUT/'verified.json').read_text())['passed']
    release=target();assert release['draft'],'The reviewed draft was already published or changed'
    expected=os.environ['GITHUB_SHA'];assert git('rev-parse','HEAD')==expected
    cover=OUT/'release-cover.png';assert sha(cover.read_bytes())==PLAN['coverSha256']
    destination=ROOT/'assets/promo/release-4.2.png';destination.parent.mkdir(parents=True,exist_ok=True)
    assert not destination.is_symlink()
    if destination.exists():assert sha(destination.read_bytes())==PLAN['coverSha256']
    destination.write_bytes(cover.read_bytes())
    git('config','user.name','Moka');git('config','user.email','102829514+M0KA40@users.noreply.github.com')
    git('add','--','assets/promo/release-4.2.png')
    changed=git('diff','--cached','--name-only').splitlines();assert not changed or changed==['assets/promo/release-4.2.png']
    environment=os.environ.copy();environment.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0='AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+TOKEN).encode()).decode())
    assert git('ls-remote','origin','refs/heads/main',env=environment).split()[0]==expected
    if changed:
        git('commit','-m','release: add official Hydra Nexus 4.2 artwork')
        git('push','origin','HEAD:refs/heads/main',env=environment)
    revision=git('rev-parse','HEAD')
    released=api('PATCH','/releases/'+str(PLAN['releaseId']),{'name':'Hydra Nexus 4.2','body':PLAN['body'],'draft':False,'prerelease':False,'make_latest':'true','target_commitish':revision})
    assert released['author']['login']=='M0KA40'
    latest=api('GET','/releases/latest',authenticated=False);assert latest['id']==PLAN['releaseId'] and latest['tag_name']=='v4.2'
    target()
    hidden=[]
    for previous in PLAN['previous']:
        current=api('GET','/releases/'+str(previous['id']));assert fingerprint(current)==previous['fingerprint']
        if not current['draft']:current=api('PATCH','/releases/'+str(previous['id']),{'draft':True})
        assert current['draft'] and fingerprint(current)==previous['fingerprint'];hidden.append(previous['tag'])
    public=api('GET','/releases?per_page=100',authenticated=False)
    assert len(public)==1 and public[0]['id']==PLAN['releaseId']
    latest=api('GET','/releases/latest',authenticated=False);assert latest['author']['login']=='M0KA40'
    result={'success':True,'version':'4.2','revision':23,'url':latest['html_url'],'publisher':latest['author']['login'],'oldReleasesPreservedAsDrafts':hidden,'files':PLAN['files'],'officialArtworkCommit':revision}
    (ROOT/'release-work/result.json').write_text(json.dumps(result,indent=2)+'\n')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf8') as summary:summary.write('## Hydra Nexus 4.2 published\n\nPublisher: M0KA40. Five exact reviewed assets verified.\n\nOlder releases preserved as drafts: '+', '.join(hidden)+'\n')
    print(json.dumps(result))

if __name__=='__main__':
    if sys.argv[1]=='verify':verify()
    elif sys.argv[1]=='publish':publish()
    else:raise ValueError('Unsupported command')
