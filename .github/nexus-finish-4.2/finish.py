from pathlib import Path
import base64,hashlib,json,os,re,subprocess,urllib.request

TASK=Path(__file__).resolve().parent;ROOT=TASK.parents[1]
PLAN=json.loads((TASK/'plan.json').read_text(encoding='utf8'))
REPO='M0KA40/Hydra-Nexus';TOKEN=os.environ['GH_TOKEN']
OWNER='Moka';EMAIL='102829514+M0KA40@users.noreply.github.com'
BOT='41898282+github-actions[bot]@users.noreply.github.com'
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch'
assert os.environ.get('GITHUB_REPOSITORY')==REPO and os.environ.get('GITHUB_REF')=='refs/heads/main'
sha=lambda data:hashlib.sha256(data).hexdigest()

def api(method,path,body=None):
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,method=method,
        data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers={'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'Hydra-Nexus-owner-attribution'})
    req.add_unredirected_header('Authorization','Bearer '+TOKEN)
    with urllib.request.urlopen(req,timeout=60) as response:
        data=response.read();return json.loads(data) if data else None

def git(*args,**kwargs):return subprocess.check_output(['git',*args],cwd=ROOT,**kwargs)

def fingerprint(release):
    return sorted((a['id'],a['name'],a['size'],a.get('digest')) for a in release['assets'])

release=api('GET','/releases/'+str(PLAN['releaseId']))
assert release['tag_name']=='v4.2' and not release['draft'] and release['author']['login']=='M0KA40'
assets=fingerprint(release)
assert sha(release['body'].encode()) in [PLAN['previousBodySha256'],sha(PLAN['body'].encode())]
if release['body']!=PLAN['body']:
    release=api('PATCH','/releases/'+str(PLAN['releaseId']),{'body':PLAN['body']})
assert release['body']==PLAN['body'] and fingerprint(release)==assets and release['author']['login']=='M0KA40'
assert release['body'].index('<details>')<release['body'].index('![Hydra Nexus 4.2]')

old=git('rev-parse','HEAD').decode().strip();assert old==os.environ['GITHUB_SHA']
base=PLAN['baseCommit'];commits=git('rev-list','--reverse',base+'..'+old).decode().splitlines()
assert 2<=len(commits)<=12
replacements={};observed=[];proof=[]
for original in commits:
    raw=git('cat-file','commit',original);header,message=raw.split(b'\n\n',1)
    fields={};parents=[]
    for line in header.splitlines():
        if line.startswith(b'parent '):parents.append(line[7:].decode())
        elif line.startswith((b'tree ',b'author ',b'committer ')):
            key,value=line.split(b' ',1);fields[key.decode()]=value.decode('utf8')
    assert len(parents)==1,'Only the reviewed linear task history may be corrected'
    parent=replacements.get(parents[0],parents[0]);environment=os.environ.copy();corrected=False
    for field,prefix in [('author','GIT_AUTHOR_'),('committer','GIT_COMMITTER_')]:
        match=re.fullmatch(r'(.*) <([^>]+)> (\d+) ([+-]\d{4})',fields[field]);assert match
        name,email,stamp,zone=match.groups()
        if email==BOT:
            assert original in PLAN['botCommits'];name,email=OWNER,EMAIL;corrected=True
        environment[prefix+'NAME']=name;environment[prefix+'EMAIL']=email;environment[prefix+'DATE']='@'+stamp+' '+zone
    if corrected:observed.append(original)
    if corrected or parent!=parents[0]:
        replacement=git('-c','commit.gpgSign=false','commit-tree',fields['tree'],'-p',parent,input=message,env=environment).decode().strip()
    else:replacement=original
    assert git('rev-parse',original+'^{tree}')==git('rev-parse',replacement+'^{tree}')
    replacements[original]=replacement;proof.append({'before':original,'after':replacement,'sameTree':True,'identityCorrected':corrected})
assert set(observed)==set(PLAN['botCommits'])
new=replacements[old];assert git('rev-parse',old+'^{tree}')==git('rev-parse',new+'^{tree}')
assert not git('diff','--name-only',old,new).strip()
environment=os.environ.copy();environment.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0='AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+TOKEN).encode()).decode())
remote=git('ls-remote','origin','refs/heads/main',env=environment).decode().split()[0];assert remote==old
git('push','--force-with-lease=refs/heads/main:'+old,'origin',new+':refs/heads/main',env=environment)
assert git('rev-list','--author=github-actions\[bot\]',new).strip()==b''
assert api('GET','/git/ref/heads/main')['object']['sha']==new
result={'success':True,'oldHead':old,'newHead':new,'correctedBotCommits':observed,'sameFinalTree':True,'history':proof,'languageChoicesAtTop':True,'publisher':'M0KA40','releaseAssetsUnchanged':True,'releaseTagsMoved':False}
print(json.dumps(result))
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a',encoding='utf8') as summary:
        summary.write('## Owner attribution corrected\n\nOnly the two reviewed automation identities were corrected to M0KA40; every file tree was preserved. Published release assets and tags are unchanged. Language choices now appear before the image and English notes. GitHub contributor statistics may refresh asynchronously.\n')
