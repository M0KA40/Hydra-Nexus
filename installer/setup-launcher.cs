using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Windows.Forms;
// Tiny Windows/.NET Framework bootstrap. The embedded BAT remains the engine.
internal static class NexusSetup {
    static void Extract(string name, string dir) {
        using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        using(var output=new FileStream(Path.Combine(dir,name),FileMode.CreateNew,FileAccess.Write,FileShare.None)) {
            if(input==null)throw new IOException("Missing setup resource: "+name);
            input.CopyTo(output);
        }
    }
    [STAThread] static int Main(string[] args) {
        try {
            if(args.Length>1 || (args.Length>0 && args[0]!="--preview" && args[0]!="--preview-updater"))throw new ArgumentException("Supported options: --preview or --preview-updater (interface only).");
            string dir=Path.Combine(Path.GetTempPath(),"Hydra-Nexus-Setup-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            foreach(string name in new[]{"Hydra_Nexus.bat","setup-gui.ps1","setup-worker.ps1","setup-detect.ps1","setup-copy.json","update-progress.ps1","preview-updater.ps1"})Extract(name,dir);
            string hash;
            using(var sha=SHA256.Create())using(var input=File.OpenRead(Path.Combine(dir,"Hydra_Nexus.bat")))hash=BitConverter.ToString(sha.ComputeHash(input)).Replace("-","").ToLowerInvariant();
            if(hash!="__NEXUS_ENGINE_SHA256__")throw new IOException("The embedded installer failed its SHA-256 check.");
            var start=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"));
            start.UseShellExecute=false;start.CreateNoWindow=true;start.RedirectStandardError=true;
            bool updater=args.Length>0 && args[0]=="--preview-updater";
            start.Arguments="-NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File \""+Path.Combine(dir,updater?"preview-updater.ps1":"setup-gui.ps1")+"\""+(args.Length>0&&!updater?" -PreviewOnly":"");
            using(var child=Process.Start(start)){string error=child.StandardError.ReadToEnd();child.WaitForExit();if(child.ExitCode!=0 && error.Length>0)MessageBox.Show(error,"Hydra Nexus Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);return child.ExitCode;}
        }catch(Exception error){MessageBox.Show(error.Message,"Hydra Nexus Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
    }
}
