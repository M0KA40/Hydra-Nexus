using System;using System.IO;using System.IO.Compression;using System.Reflection;using System.Diagnostics;using System.Security.Cryptography;using System.Windows.Forms;
internal static class NexusBatWrapper {
 static void Extract(string name,string dir){using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream(name))using(var output=File.Create(Path.Combine(dir,name))){input.CopyTo(output);}}
 [STAThread] static int Main(){try{
  string dir=Path.Combine(Path.GetTempPath(),"Nexus-BAT-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);
  foreach(string file in new[]{"payload.zip","generic-gui.ps1","setup-copy.json","wrapper.json"})Extract(file,dir);
  string hash;using(var sha=SHA256.Create())using(var input=File.OpenRead(Path.Combine(dir,"payload.zip")))hash=BitConverter.ToString(sha.ComputeHash(input)).Replace("-","").ToLowerInvariant();
  if(hash!="__NEXUS_PAYLOAD_SHA256__")throw new IOException("Embedded BAT payload checksum failed.");
  ZipFile.ExtractToDirectory(Path.Combine(dir,"payload.zip"),Path.Combine(dir,"payload"));
  var info=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"));info.UseShellExecute=false;info.CreateNoWindow=true;info.RedirectStandardError=true;
  info.Arguments="-NoLogo -NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File \""+Path.Combine(dir,"generic-gui.ps1")+"\"";
  using(var child=Process.Start(info)){string error=child.StandardError.ReadToEnd();child.WaitForExit();if(child.ExitCode!=0&&error.Length>0)MessageBox.Show(error,"BAT Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);return child.ExitCode;}
 }catch(Exception error){MessageBox.Show(error.Message,"BAT Setup",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}}
}
