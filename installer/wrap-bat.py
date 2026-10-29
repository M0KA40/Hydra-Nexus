"""One-command reusable BAT -> branded EXE shell. No changes to the BAT."""
from pathlib import Path
import argparse,subprocess,json,hashlib,base64,zipfile,os,tempfile
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('bat',type=Path)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--name',help='Window title; defaults to the BAT filename')
parser.add_argument('--version',help='Explicit version when the BAT has no recognizable version declaration')
parser.add_argument('--assets',type=Path,help='Optional folder of sibling dependencies to include')
args=parser.parse_args();root=Path(__file__).resolve().parent.parent
bat=args.bat.resolve();output=args.output.resolve()
if not bat.is_file() or bat.suffix.lower() not in ('.bat','.cmd'):parser.error('Choose an existing BAT or CMD file')
if output.suffix.lower()!='.exe':parser.error('--output must be an EXE path')
if output.exists():parser.error('Output exists; choose a new path to preserve delivered installers')
assets=args.assets.resolve() if args.assets else None
if assets and (not assets.is_dir() or bat.parent!=assets):parser.error('--assets must be the folder containing the BAT')
output.parent.mkdir(parents=True,exist_ok=True)
surface=(root/'installer/setup-surface.ps1').read_text(encoding='utf8').replace('__NEXUS_SURFACE_XAML_BASE64__',base64.b64encode((root/'installer/setup-window.xaml').read_bytes()).decode()).replace('__NEXUS_PROGRESS_LOGO__',base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.png').read_bytes()).decode())
metadata_args=['powershell.exe','-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(root/'installer/wrapper-metadata.ps1'),'-AsCommand','-File',str(bat)]
if args.version:metadata_args+=['-ExplicitVersion',args.version]
metadata=json.loads(subprocess.check_output(metadata_args).decode('utf-8-sig'))
with tempfile.TemporaryDirectory(prefix='nexus-wrap-') as temporary:
 stage=Path(temporary)
 with zipfile.ZipFile(stage/'payload.zip','w',zipfile.ZIP_DEFLATED) as archive:
  files=sorted(p for p in assets.rglob('*') if p.is_file()) if assets else [bat]
  for file in files:
   if file.is_symlink() or (assets and assets not in file.resolve().parents):parser.error('Linked payload files are not supported')
   if file.resolve()==output:continue
   archive.write(file,file.relative_to(assets).as_posix() if assets else bat.name)
 digest=hashlib.sha256((stage/'payload.zip').read_bytes()).hexdigest()
 config={'schema':1,'engine':bat.name,'name':args.name or bat.stem,**metadata,'sha256':hashlib.sha256(bat.read_bytes()).hexdigest()}
 (stage/'wrapper.json').write_text(json.dumps(config,ensure_ascii=False),encoding='utf8')
 script=(root/'installer/generic-gui.ps1').read_text(encoding='utf8').replace('# __NEXUS_SHARED_SURFACE__',surface)
 (stage/'generic-gui.ps1').write_text(script,encoding='utf-8-sig')
 js="const i=require('./src/i18n.cjs'),f=require('./src/update-presentation.cjs').updatePresentation,o={};for(const l of Object.keys(i.catalogs)){i.main.setLanguage(l);o[l]=f();}process.stdout.write(JSON.stringify(o));"
 (stage/'setup-copy.json').write_bytes(subprocess.check_output(['node','-e',js],cwd=root))
 (stage/'generic-launcher.cs').write_text((root/'installer/generic-launcher.cs').read_text(encoding='utf8').replace('__NEXUS_PAYLOAD_SHA256__',digest),encoding='utf8')
 csc=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
 command=[str(csc),'/nologo','/target:winexe','/platform:anycpu','/optimize+','/reference:System.Windows.Forms.dll','/reference:System.IO.Compression.FileSystem.dll','/out:'+str(output),'/win32icon:'+str(root/'assets/brand/Hydra-Nexus-icon.ico')]
 for name in ['payload.zip','generic-gui.ps1','setup-copy.json','wrapper.json']:command.append('/resource:'+str(stage/name)+','+name)
 command.append(str(stage/'generic-launcher.cs'));subprocess.run(command,check=True)
print(str(output))
