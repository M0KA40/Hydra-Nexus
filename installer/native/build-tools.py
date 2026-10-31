from pathlib import Path
import os,subprocess
root=Path(__file__).resolve().parents[2];out=root/'dist';out.mkdir(exist_ok=True)
compiler=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
subprocess.run([str(compiler),'/nologo','/target:exe','/optimize+','/out:'+str(out/'NexusNative.exe'),'/reference:System.Core.dll','/reference:System.Management.dll','/reference:System.Web.Extensions.dll','/reference:System.Windows.Forms.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll',str(root/'installer/native/Utilities.cs')],check=True)
