from pathlib import Path
import base64,hashlib,json,os,subprocess,urllib.request
ROOT=Path(__file__).resolve().parents[2];PLAN=json.loads((Path(__file__).parent/'plan.json').read_text(encoding='utf8'))
REPO='M0KA40/Hydra-Nexus';TOKEN=os.environ['GH_TOKEN']
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch'
assert os.environ.get('GITHUB_REPOSITORY')==REPO and os.environ.get('GITHUB_REF')=='refs/heads/main'
blob=lambda data:hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
sha=lambda data:hashlib.sha256(data).hexdigest()
def api(method,path,body=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,method=method,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers={'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Hydra-Nexus-release-links'})
    req.add_unredirected_header('Authorization','Bearer '+TOKEN)
    with urllib.request.urlopen(req,timeout=60) as response:
        raw=response.read();return json.loads(raw) if raw else None
def git(*args,**kwargs):return subprocess.check_output(['git',*args],cwd=ROOT,**kwargs).decode().strip()
def fingerprint(release):return sorted((a['id'],a['name'],a['size'],a.get('digest')) for a in release['assets'])
release=api('GET','/releases/'+str(PLAN['releaseId']));assets=fingerprint(release)
assert release['tag_name']=='v4.2' and not release['draft'] and release['author']['login']=='M0KA40'
assert sha(release['body'].encode()) in [PLAN['previousBodySha256'],sha(PLAN['body'].encode())]
assert len(PLAN['documents'])==9 and '<details>' not in PLAN['body']
expected=os.environ['GITHUB_SHA'];assert git('rev-parse','HEAD')==expected
for name,entry in PLAN['documents'].items():
    assert name.startswith('docs/releases/4.2/') and name.endswith('.md') and '..' not in name
    path=ROOT/name;assert not path.is_symlink()
    before=blob(path.read_bytes()) if path.is_file() else None
    data=entry['content'].encode('utf8');assert before in [entry['beforeGitBlob'],blob(data)]
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
git('config','user.name','Moka');git('config','user.email','102829514+M0KA40@users.noreply.github.com')
git('add','--',*sorted(PLAN['documents']))
changed=git('diff','--cached','--name-only').splitlines();assert set(changed)<=set(PLAN['documents'])
environment=os.environ.copy();environment.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0='AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+TOKEN).encode()).decode())
assert git('ls-remote','origin','refs/heads/main',env=environment).split()[0]==expected
if changed:
    git('commit','-m','docs: add linked 4.2 release notes in all supported languages')
    git('push','origin','HEAD:refs/heads/main',env=environment)
for name,entry in PLAN['documents'].items():assert (ROOT/name).read_text(encoding='utf8')==entry['content']
release=api('PATCH','/releases/'+str(PLAN['releaseId']),{'body':PLAN['body']})
assert release['body']==PLAN['body'] and fingerprint(release)==assets and release['author']['login']=='M0KA40'
assert release['body'].splitlines()[2].count('](')==9
print(json.dumps({'success':True,'languageLinks':9,'separatePages':9,'dropdowns':False,'publisher':'M0KA40','releaseAssetsUnchanged':True,'commit':git('rev-parse','HEAD')}))
