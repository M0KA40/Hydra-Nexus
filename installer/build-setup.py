"""Package a Windows frontend around the exact built BAT. No external packages."""
from pathlib import Path
import subprocess,os,json,hashlib,re
root=Path(__file__).resolve().parent.parent
out=root/'dist';stage=out/'setup-ui';stage.mkdir(exist_ok=True)
engine=(out/'Hydra_Nexus.bat').read_bytes();digest=hashlib.sha256(engine).hexdigest()
version=re.search(rb':: HYDRA_NEXUS_RELEASE ([\d.]+)',engine).group(1).decode()
revision=re.search(rb':: HYDRA_NEXUS_REVISION (\d+)',engine).group(1).decode()
surface=(root/'installer/setup-surface.ps1').read_text(encoding='utf8')
import base64
surface=surface.replace('__NEXUS_SURFACE_XAML_BASE64__',base64.b64encode((root/'installer/setup-window.xaml').read_bytes()).decode()).replace('__NEXUS_PROGRESS_LOGO__',base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.png').read_bytes()).decode())
for name in ['setup-gui.ps1','setup-worker.ps1','setup-detect.ps1','update-progress.ps1','preview-updater.ps1']:
    script=(root/'installer'/name).read_text(encoding='utf8').replace('# __NEXUS_SHARED_SURFACE__',surface).replace('__NEXUS_SETUP_VERSION__','v'+version).replace('__NEXUS_ENGINE_SHA256__',digest).replace('__NEXUS_RELEASE_VERSION__',version).replace('__NEXUS_RELEASE_REVISION__',revision)
    (stage/name).write_text(script,encoding='utf-8-sig')
(stage/'Hydra_Nexus.bat').write_bytes(engine)
js="const i=require('./src/i18n.cjs');const {updatePresentation}=require('./src/update-presentation.cjs');const out={};for(const lang of Object.keys(i.catalogs)){i.main.setLanguage(lang);out[lang]=updatePresentation();}process.stdout.write(JSON.stringify(out));"
catalog=subprocess.check_output(['node','-e',js],cwd=root)
(stage/'setup-copy.json').write_bytes(catalog)
source=(root/'installer/setup-launcher.cs').read_text(encoding='utf8').replace('__NEXUS_ENGINE_SHA256__',digest)
(stage/'setup-launcher.cs').write_text(source,encoding='utf8')
manifest='''<?xml version="1.0" encoding="utf-8"?><assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1"><assemblyIdentity version="1.0.0.0" name="Hydra.Nexus.Setup"/><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo><application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings><dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware></windowsSettings></application></assembly>'''
(stage/'setup.manifest').write_text(manifest,encoding='utf8')
csc=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if not csc.exists():raise SystemExit('Windows .NET Framework C# compiler is required to build the optional EXE.')
command=[str(csc),'/nologo','/target:winexe','/platform:anycpu','/optimize+','/reference:System.Windows.Forms.dll','/out:'+str(out/'Hydra_Nexus_Setup.exe'),'/win32icon:'+str(root/'assets/brand/Hydra-Nexus-icon.ico'),'/win32manifest:'+str(stage/'setup.manifest')]
for name in ['Hydra_Nexus.bat','setup-gui.ps1','setup-worker.ps1','setup-detect.ps1','setup-copy.json','update-progress.ps1','preview-updater.ps1']:command.append('/resource:'+str(stage/name)+','+name)
command.append(str(stage/'setup-launcher.cs'))
subprocess.run(command,check=True)
print('Built graphical setup: '+str(out/'Hydra_Nexus_Setup.exe'))
# Standalone reusable builder kit: Windows/.NET only, no Python or Node needed
# by the person wrapping another BAT. The normal Nexus build prepares the UI.
kit=out/'BAT-Wrapper';kit.mkdir(exist_ok=True)
for name in ['Wrap-BAT.ps1','Wrap_BAT.cmd','generic-launcher.cs','wrapper-metadata.ps1']:(kit/name).write_bytes((root/'installer'/name).read_bytes())
(kit/'generic-gui.ps1').write_text((root/'installer/generic-gui.ps1').read_text(encoding='utf8').replace('# __NEXUS_SHARED_SURFACE__',surface),encoding='utf-8-sig')
(kit/'setup-copy.json').write_bytes(catalog)
(kit/'setup.ico').write_bytes((root/'assets/brand/Hydra-Nexus-icon.ico').read_bytes())
print('Prepared reusable BAT-Wrapper kit (drag a BAT onto Wrap_BAT.cmd).')
