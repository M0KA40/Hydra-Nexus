"""Build the reviewed 4.0 source, then replace and verify its public release assets."""
import hashlib,json,os,pathlib,re,shutil,subprocess,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parent
REPO=pathlib.Path.cwd()
WORK=REPO/'release-work'
SOURCE=WORK/'Hydra-Nexus'
PREVIOUS=WORK/'previous'
REQUEST=json.loads((ROOT/'request.json').read_text(encoding='utf-8'))
NAMES=['Hydra_Nexus.exe','Hydra-Nexus-4.0-source.zip','Hydra-Nexus-4.0-release-notes.json','SHA256SUMS.txt','Hydra-Nexus-exe-release.json']
def run(*args,**kwargs):
 return subprocess.run(args,check=True,**kwargs)
def sha(file):
 return hashlib.sha256(file.read_bytes()).hexdigest()
def verify_assets(folder):
 entries={}
 for line in (folder/'SHA256SUMS.txt').read_text().splitlines():
  digest,name=line.split('  ',1)
  if name not in NAMES or not re.fullmatch('[0-9a-f]{64}',digest):raise ValueError('Unexpected checksum entry')
  if sha(folder/name)!=digest:raise ValueError('Asset checksum mismatch: '+name)
  entries[name]=digest
 if set(entries)!=set(NAMES)-{'SHA256SUMS.txt'}:raise ValueError('Incomplete checksums')
 return entries
def apply_source(archive):
 if sha(archive)!=REQUEST['baseline_sha256']:raise ValueError('Public 4.0 baseline hash changed; refusing guessed source')
 SOURCE.mkdir(parents=True,exist_ok=False)
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():
   rel=pathlib.PurePosixPath(entry.filename)
   if rel.is_absolute() or '..' in rel.parts or not rel.parts or rel.parts[0]!='Hydra-Nexus':raise ValueError('Unsafe source archive')
  z.extractall(WORK)
 for entry in REQUEST['files']:
  rel=pathlib.PurePosixPath(entry['path'])
  if rel.is_absolute() or '..' in rel.parts:raise ValueError('Unsafe overlay')
  src=ROOT/'files'/str(rel)
  if sha(src)!=entry['sha256']:raise ValueError('Patch hash mismatch: '+str(rel))
  dst=SOURCE/str(rel);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
def prepare():
 if WORK.exists():raise ValueError('Clean runner required')
 PREVIOUS.mkdir(parents=True)
 run('gh','api','repos/M0KA40/Hydra-Nexus/releases/tags/v4.0',stdout=(WORK/'release.json').open('w',encoding='utf-8'))
 metadata=json.loads((WORK/'release.json').read_text(encoding='utf-8'))
 if metadata['draft'] or metadata['prerelease'] or metadata['tag_name']!='v4.0':raise ValueError('Unexpected public release')
 for name in NAMES:run('gh','release','download','v4.0','--pattern',name,'--dir',str(PREVIOUS))
 verify_assets(PREVIOUS)
 channel=json.loads((PREVIOUS/'Hydra-Nexus-exe-release.json').read_text(encoding='utf-8-sig'))
 if channel!={'schema':1,'version':'4.0','revision':1}:raise ValueError('Public channel moved; refusing replacement')
 apply_source(PREVIOUS/'Hydra-Nexus-4.0-source.zip')
 print('Verified exact public 4.0 source and applied 14 pinned files.')
def check():
 # Keep fixtures off the runner profile 8.3 TEMP alias. Production restore guards stay unchanged.
 fixture_temp=WORK/"test-temp"
 fixture_temp.mkdir(exist_ok=True)
 os.environ["TEMP"]=os.environ["TMP"]=str(fixture_temp.resolve())
 for file in (SOURCE/'src').rglob('*'):
  if file.suffix in ('.js','.cjs'):run('node','--check',str(file))
 run('node','--check',str(SOURCE/'dist/hydra-nexus-bridge.cjs'))
 for test in REQUEST['tests']:
  if not re.fullmatch('test-[a-z0-9-]+[.]cjs',test):raise ValueError('Invalid suite name')
  run('node','tests/'+test,cwd=SOURCE)
 run(sys.executable,'release.py',cwd=SOURCE)
 verify_assets(SOURCE/'dist')
 if sha(SOURCE/'dist/Hydra-Nexus-4.0-source.zip')!=REQUEST['source_sha256']:raise ValueError('Source package differs from locally reviewed candidate')
 channel=json.loads((SOURCE/'dist/Hydra-Nexus-exe-release.json').read_text(encoding='utf-8'))
 if channel!={'schema':1,'version':'4.0','revision':2}:raise ValueError('Wrong update channel')
 print('29 affected suites passed; packaged source exactly matches local candidate.')
def upload(folder):
 for name in NAMES:run('gh','release','upload','v4.0',str(folder/name),'--clobber')
def publish():
 verify_assets(SOURCE/'dist')
 previous=json.loads((WORK/'release.json').read_text(encoding='utf-8'))
 current=json.loads(subprocess.check_output(['gh','api','repos/M0KA40/Hydra-Nexus/releases/tags/v4.0'],text=True))
 if {a['name']:a['id'] for a in current['assets']}!={a['name']:a['id'] for a in previous['assets']}:raise ValueError('Public assets changed during build')
 body=current['body']
 if '<!-- HYDRA_NEXUS_REVISION 1 -->' not in body:raise ValueError('Public revision moved')
 fixed_body=body.replace('<!-- HYDRA_NEXUS_REVISION 1 -->','<!-- HYDRA_NEXUS_REVISION 2 -->',1)
 notes=WORK/'public-notes.md';notes.write_text(fixed_body,encoding='utf-8')
 try:
  upload(SOURCE/'dist')
  run('gh','release','edit','v4.0','--notes-file',str(notes))
  verified=WORK/'downloaded';verified.mkdir()
  for name in NAMES:run('gh','release','download','v4.0','--pattern',name,'--dir',str(verified))
  verify_assets(verified)
  for name in NAMES:
   if sha(verified/name)!=sha(SOURCE/'dist'/name):raise ValueError('Public download differs: '+name)
  public=json.loads(subprocess.check_output(['gh','api','repos/M0KA40/Hydra-Nexus/releases/tags/v4.0'],text=True))
  if '<!-- HYDRA_NEXUS_REVISION 2 -->' not in public['body']:raise ValueError('Public revision missing')
  print('PUBLICATION VERIFIED: version 4.0, internal revision 2, all five downloads match.')
 except BaseException:
  print('Publication failed; restoring all original assets.',file=sys.stderr)
  upload(PREVIOUS)
  notes.write_text(body,encoding='utf-8')
  run('gh','release','edit','v4.0','--notes-file',str(notes))
  raise
if __name__=='__main__':
 {'prepare':prepare,'check':check,'publish':publish}[sys.argv[1]]()
