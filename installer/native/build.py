"""Compile the native Windows installer; no runtime PowerShell dependency."""
from pathlib import Path
import hashlib,json,os,struct,subprocess,sys,re
root=Path(__file__).resolve().parents[2]
out=root/'dist';stage=out/'native-build';stage.mkdir(parents=True,exist_ok=True)
brand=(root/'src/brand.cjs').read_text(encoding='utf8')
version=re.search(r"version:'([^']+)'",brand).group(1);revision=int(re.search(r'revision:(\d+)',brand).group(1))
quad='.'.join((version.split('.')+['0','0'])[:4])
if not (out/'native-payload.zip').exists():raise SystemExit('Run native/prepare.py after building the bridge first.')
catalog=json.loads(subprocess.check_output(['node','-e',"const {updatePresentation}=require('./src/update-presentation.cjs'),i=require('./src/i18n.cjs');const c={};for(const l of Object.keys(i.catalogs)){i.main.setLanguage(l);c[l]=updatePresentation();}process.stdout.write(JSON.stringify(c));"],cwd=root))
reopen={'en':'Reopen Hydra when finished','ar':'إعادة فتح Hydra بعد الانتهاء','pt-BR':'Reabrir o Hydra ao terminar','es':'Volver a abrir Hydra al terminar','fr':'Rouvrir Hydra à la fin','de':'Hydra anschließend wieder öffnen','ru':'Открыть Hydra после завершения','tr':'Bittiğinde Hydra’yı yeniden aç','pl':'Otwórz Hydra po zakończeniu'}
for lang,c in catalog.items():c['reopen']=reopen[lang]
(stage/'setup-copy.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf8')
manifest='''<?xml version="1.0" encoding="utf-8"?><assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1"><assemblyIdentity version="3.0.0.0" name="Hydra.Nexus.Setup"/><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo><application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings><dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware></windowsSettings></application></assembly>'''
(stage/'native.manifest').write_text(manifest,encoding='utf8')
(stage/'native.manifest').write_text(manifest.replace('3.0.0.0',quad),encoding='utf8')
framework=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319'
target=out/('Hydra_Nexus_Render.exe' if '--test-render' in sys.argv else 'Hydra_Nexus.exe')
args=[str(framework/'csc.exe'),'/nologo','/target:winexe','/platform:anycpu','/optimize+','/out:'+str(target),'/win32manifest:'+str(stage/'native.manifest'),'/win32icon:'+str(root/'assets/brand/Hydra-Nexus-icon.ico')]
for name in ['System.Core','System.Web.Extensions','System.Windows.Forms','System.IO.Compression','System.IO.Compression.FileSystem','System.Xaml']:args.append('/reference:'+name+'.dll')
for name in ['PresentationCore','PresentationFramework','WindowsBase']:args.append('/reference:'+str(framework/'WPF'/(name+'.dll')))
for file,name in [(out/'native-payload.zip','native-payload.zip'),(root/'installer/setup-window.xaml','setup-window.xaml'),(stage/'setup-copy.json','setup-copy.json'),(root/'assets/brand/Hydra-Nexus-icon.ico','setup.ico'),(root/'assets/brand/Hydra-Nexus-transparent.png','setup-logo.png')]:args.append('/resource:'+str(file)+','+name)
if '--test-render' in sys.argv:args.append('/define:NEXUS_RENDER_TEST')
engine=(root/'installer/native/Engine.cs').read_text(encoding='utf8')
engine=re.sub(r'const string Version="[^"]+"','const string Version="'+version+'"',engine)
engine=re.sub(r'const int Revision=\d+','const int Revision='+str(revision),engine)
(stage/'Engine.cs').write_text(engine,encoding='utf8')
setup=(root/'installer/native/Setup.cs').read_text(encoding='utf8').replace('AssemblyVersion("3.0.0.0")','AssemblyVersion("'+quad+'")').replace('AssemblyFileVersion("3.0.0.0")','AssemblyFileVersion("'+quad+'")').replace('Label("Version","v3.0")','Label("Version","v"+NativeEngine.Version)')
(stage/'Setup.cs').write_text(setup,encoding='utf8')
args += [str(stage/'Engine.cs'),str(stage/'Setup.cs')]
subprocess.run(args,check=True)
# Strict bounded metadata footer, covered by the release's complete-file checksum.
meta=json.dumps({'schema':1,'product':'Hydra Nexus','version':version,'revision':revision,'engine':'native'},separators=(',',':')).encode()
with target.open('ab') as f:f.write(meta+struct.pack('<I',len(meta))+b'HNEXE3\x00\x01')
print('Built native EXE:',target,'SHA256:',hashlib.sha256(target.read_bytes()).hexdigest())
