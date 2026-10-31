"""Build-time only: compile reviewed native transforms into hash-bound edit recipes.

PowerShell is used ONLY by the legacy development compiler to establish equivalent
patch output. Neither PowerShell nor native Hydra fixture sources are packaged.
Only insertions, input hashes and copy ranges are shipped. Unknown host builds fail
closed. Refresh this compatibility data after reviewing a new Hydra build.
"""
from pathlib import Path
import base64, difflib, hashlib, json, os, subprocess, zipfile, re

root=Path(__file__).resolve().parents[2]
workspace=root.parent
stage=root/'dist/native-build'
stage.mkdir(parents=True,exist_ok=True)
fixture=Path(os.environ.get('HYDRA_NATIVE_FIXTURES',workspace/'Play-Activity-Lab-r7/design/compatibility-4.3.0'))
inputs={'main':fixture/'hydra-main.mjs','renderer':fixture/'hydra-renderer.js'}
def digest(data):return hashlib.sha256(data).hexdigest()
def quote(p):return "'"+str(p).replace("'","''")+"'"
def compile_output(bat,label):
    text=bat.read_text(encoding='utf-8-sig')
    lines=text.splitlines()
    engine='\n'.join(lines[lines.index(':: === HYDRA_SUITE_PS_START ===')+1:])
    manager=stage/(label+'.ps1');manager.write_text(engine,encoding='utf-8-sig')
    main=stage/(label+'-main.txt');renderer=stage/(label+'-renderer.txt')
    command=f"""$ErrorActionPreference='Stop'
. {quote(manager)} -LibraryOnly
$p=$script:BuiltInPatches|Where-Object Id -eq 'nexus'
$clean=[IO.File]::ReadAllText({quote(inputs['main'])})
$clean=Add-NexusExtractionHooks (Add-NexusWindowHook (Add-NexusPrivacyHooks (Add-NexusNativeLaunchHooks $clean)))
$next=$p.EsmHook+"`n"+$clean+(Get-NexusAdapter $clean)
[IO.File]::WriteAllText({quote(main)},$next,[Text.UTF8Encoding]::new($false))
$next=Add-NexusRendererHooks ([IO.File]::ReadAllText({quote(inputs['renderer'])}))
[IO.File]::WriteAllText({quote(renderer)},$next,[Text.UTF8Encoding]::new($false))
"""
    script=stage/(label+'-compile.ps1');script.write_text(command,encoding='utf-8-sig')
    subprocess.run(['powershell.exe','-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(script)],check=True)
    return {'main':main.read_bytes(),'renderer':renderer.read_bytes()}

def recipe(before,after):
    a=before.splitlines(keepends=True);b=after.splitlines(keepends=True)
    positions=[0]
    for line in a:positions.append(positions[-1]+len(line))
    ops=[]
    for tag,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
        if tag=='equal':ops.append({'offset':positions[i],'length':positions[j]-positions[i]})
        elif tag in ('replace','insert'):ops.append({'data':base64.b64encode(b''.join(b[k:l])).decode()})
    return {'input':digest(before),'output':digest(after),'size':len(after),'ops':ops}
compatibility=root/'installer/native/compatibility.json'
if os.environ.get('HYDRA_REFRESH_COMPATIBILITY')=='1':
    target=compile_output(root/'dist/Hydra_Nexus.bat','target')
    variants=[{k:v.read_bytes() for k,v in inputs.items()}]
    legacy=workspace/'Play-Activity-Lab-r7/Hydra-Nexus/dist/Hydra_Nexus.bat'
    if legacy.exists():variants.append(compile_output(legacy,'activity04'))
    recipes={kind:[recipe(v[kind],target[kind]) for v in variants]+[recipe(target[kind],target[kind])] for kind in target}
    compatibility.write_text(json.dumps({'schema':1,'host':'Hydra 4.3.0 (verified exact native chunks)','recipes':recipes},separators=(',',':')),encoding='utf8')
data=json.loads(compatibility.read_text(encoding='utf8'))
brand=(root/'src/brand.cjs').read_text(encoding='utf8')
version=re.search(r"version:'([^']+)'",brand).group(1);revision=int(re.search(r'revision:(\d+)',brand).group(1))
manifest={'schema':1,'version':version,'revision':revision,'host':data['host'],'recipes':data['recipes'],'files':{}}
assets={}
assets['main/hydra-nexus-bridge.cjs']=root/'dist/hydra-nexus-bridge.cjs'
for file in (root/'assets/plugin-guides').glob('*.webp'):
    if file.stem!='backup':assets['assets/nexus-guide-'+file.stem+'.webp']=file
for source,dest in [('theme/quiet-charcoal.png','nexus-quiet-background.png'),('theme/mint-clouds.webp','nexus-mint-background.webp'),('promo/release-3.0.webp','nexus-release-3.0.webp')]:assets['assets/'+dest]=root/'assets'/source
assets['main/nexus-rclone.zip']=root/'tools/rclone/package.zip'
assets['main/nexus-rclone-LICENSE.txt']=root/'tools/rclone/LICENSE.txt'
assets['main/nexus-ludusavi.zip']=root/'tools/ludusavi/ludusavi-v0.31.0-win64.zip'
assets['main/nexus-ludusavi-manifest.yaml.gz']=root/'tools/ludusavi/manifest.yaml.gz'
for filename in ['LICENSE','MANIFEST_LICENSE']:
    assets['main/nexus-ludusavi-'+filename+'.txt']=root/'tools/ludusavi'/filename
assets['main/nexus-ludusavi-legal.zip']=root/'tools/ludusavi/ludusavi-v0.31.0-legal.zip'
bundle=root/'dist/native-payload.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for name,p in assets.items():
        data=p.read_bytes();mirror=root/'dist/native-resources'/name;mirror.parent.mkdir(parents=True,exist_ok=True);mirror.write_bytes(data);manifest['files'][name]={'sha256':digest(data),'size':len(data)};z.writestr('files/'+name,data)
    z.writestr('manifest.json',json.dumps(manifest,separators=(',',':')))
print('Native payload prepared; no original Hydra chunks or PowerShell scripts included:',bundle)
