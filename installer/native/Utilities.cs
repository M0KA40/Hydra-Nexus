using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
class NexusUtilities {
 [DllImport("user32.dll")]static extern bool ShowWindowAsync(IntPtr h,int command);
 static object[] Query(string scope,string query,string key){using(var search=new ManagementObjectSearcher(scope,query))using(var rows=search.Get())return rows.Cast<ManagementObject>().Select(x=>x[key]).ToArray();}
 static int Main(string[] args){try{if(args.Length==1&&args[0]=="hardware"){var cpu=String.Join(" / ",Query(@"root\cimv2","SELECT Name FROM Win32_Processor","Name"));var gpu=String.Join(" / ",Query(@"root\cimv2","SELECT Name FROM Win32_VideoController","Name"));var ram=Math.Round(Query(@"root\cimv2","SELECT Capacity FROM Win32_PhysicalMemory","Capacity").Sum(x=>Convert.ToDouble(x))/1073741824,1);var storage="Unknown";try{var types=Query(@"root\Microsoft\Windows\Storage","SELECT MediaType FROM MSFT_PhysicalDisk","MediaType").Select(Convert.ToInt32).ToArray();storage=types.Contains(3)&&types.Contains(4)?"Mixed":types.Contains(4)?"SSD":types.Contains(3)?"HDD":"Unknown";}catch{}Console.OutputEncoding=new System.Text.UTF8Encoding(false);Console.Write(new JavaScriptSerializer().Serialize(new {cpu=cpu,gpu=gpu,ramGB=ram,storage=storage}));return 0;}
 if(args.Length==1&&args[0]=="hide-steam"){foreach(var p in Process.GetProcessesByName("steam").Concat(Process.GetProcessesByName("steamwebhelper"))){using(p){try{if(p.MainWindowHandle!=IntPtr.Zero&&(p.MainWindowTitle.IndexOf("Steam",StringComparison.OrdinalIgnoreCase)>=0||p.MainWindowTitle.IndexOf("Friends",StringComparison.OrdinalIgnoreCase)>=0))ShowWindowAsync(p.MainWindowHandle,0);}catch{}}}return 0;}
 if(args.Length==1&&args[0]=="sleep")return System.Windows.Forms.Application.SetSuspendState(System.Windows.Forms.PowerState.Suspend,false,false)?0:1;
 if(args.Length==3&&args[0]=="ludusavi"){var input=Path.GetFullPath(args[1]);var output=Path.GetFullPath(args[2]);if(Path.GetFileName(output)!="ludusavi.exe")throw new IOException("Invalid tool output.");for(var p=Path.GetDirectoryName(output);!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p))if((File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw new IOException("Linked tool path.");using(var zip=ZipFile.OpenRead(input)){if(zip.Entries.Count!=1||zip.Entries[0].FullName!="ludusavi.exe"||zip.Entries[0].Length!=34893312)throw new IOException("Unexpected Ludusavi archive.");var temp=output+"."+Guid.NewGuid().ToString("N")+".tmp";try{zip.Entries[0].ExtractToFile(temp);if(File.Exists(output))File.Replace(temp,output,null);else File.Move(temp,output);}finally{if(File.Exists(temp))File.Delete(temp);}}return 0;}
 throw new ArgumentException("Unsupported native operation.");}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}}
}
