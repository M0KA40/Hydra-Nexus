using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

[assembly:AssemblyTitle("Hydra Nexus")]
[assembly:AssemblyProduct("Hydra Nexus")]
[assembly:AssemblyVersion("3.0.0.0")]
[assembly:AssemblyFileVersion("3.0.0.0")]
internal static class Setup {
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern int SetCurrentProcessExplicitAppUserModelID(string id);
    static Window window;static Dictionary<string,object> catalogs,copy;static ComboBox languages;static CheckBox reopen;static bool busy,preview;static string directory;static Dictionary<string,object> request;static string job;static int exitCode;static volatile bool cancelRequested,committing;
#if NEXUS_RENDER_TEST
    static string[] render;
#endif
    static readonly string[] codes={"en","pt-BR","es","ru","ar","fr","de","tr","pl"};
    static readonly string[] names={"English","Português (Brasil)","Español","Русский","العربية","Français","Deutsch","Türkçe","Polski"};
    static T Find<T>(string name)where T:class{return (T)window.FindName(name);}
    static string Text(string key){return copy.ContainsKey(key)?Convert.ToString(copy[key]):key;}
    static Stream Resource(string name){var s=Assembly.GetExecutingAssembly().GetManifestResourceStream(name);if(s==null)throw new IOException("Missing setup resource: "+name);return s;}
    static void Label(string name,string text){var t=window.FindName(name)as TextBlock;if(t!=null)t.Text=text;else{var b=window.FindName(name)as Button;if(b!=null)b.Content=text;}}
    static void Language(){var lang=codes[Math.Max(0,languages.SelectedIndex)];copy=NativeEngine.Obj(catalogs[lang]);window.FlowDirection=lang=="ar"?FlowDirection.RightToLeft:FlowDirection.LeftToRight;Label("Version","v3.0");Label("Eyebrow","HYDRA NEXUS");Label("Title",Text("setupTitle"));Label("Hint",Text("setupHint"));Label("FolderLabel",Text("folder"));Label("Browse",Text("browse"));Label("OperationLabel",Text("operation"));Label("Action",Text("install"));Label("Safety",Text("safety"));Label("Status",Text("closeFirst"));Label("SmallStatus","");Label("Dismiss","×");Find<Button>("Dismiss").ToolTip=Text("close");Label("Minimize","−");Find<Button>("Minimize").ToolTip=Text("minimize");Label("Footer","");reopen.Content=Text("reopen");Find<ComboBox>("Operation").Items.Clear();Find<ComboBox>("Operation").Items.Add(Text("install"));Find<ComboBox>("Operation").SelectedIndex=0;Find<ComboBox>("Operation").Visibility=Visibility.Collapsed;Find<TextBlock>("OperationLabel").Visibility=Visibility.Collapsed;}
    static string Detect(){
        var paths=new List<string>();foreach(var p in Process.GetProcessesByName("Hydra")){using(p){try{paths.Add(Path.GetDirectoryName(p.MainModule.FileName));}catch{}}}
        foreach(var hive in new[]{Registry.CurrentUser,Registry.LocalMachine})foreach(var sub in new[]{@"Software\Microsoft\Windows\CurrentVersion\Uninstall",@"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"})using(var key=hive.OpenSubKey(sub)){if(key==null)continue;foreach(var name in key.GetSubKeyNames())using(var entry=key.OpenSubKey(name)){if(entry==null||Convert.ToString(entry.GetValue("DisplayName")).IndexOf("Hydra",StringComparison.OrdinalIgnoreCase)<0)continue;paths.Add(Convert.ToString(entry.GetValue("InstallLocation")));}}
        foreach(var basis in new[]{Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)})foreach(var name in new[]{"Programs/Hydra","Hydra","hydralauncher"})if(!String.IsNullOrEmpty(basis))paths.Add(Path.Combine(basis,name));
        return paths.FirstOrDefault(p=>!String.IsNullOrWhiteSpace(p)&&File.Exists(Path.Combine(p,"Hydra.exe"))&&File.Exists(Path.Combine(p,"resources","app.asar")))??"";
    }
    static void SetBusy(bool value){busy=value;languages.IsEnabled=!value;if(value){Label("Footer","");cancelRequested=false;committing=false;Label("Action",Text("cancel"));}Find<StackPanel>("SetupOptions").IsEnabled=!value;Find<Button>("Action").IsEnabled=!value||!committing;Find<Button>("Dismiss").IsEnabled=!value;Find<FrameworkElement>("Steps").Visibility=Visibility.Collapsed;Find<Border>("ProgressPanel").Visibility=Visibility.Visible;var bar=Find<FrameworkElement>("Bar");if(value){bar.Visibility=Visibility.Visible;var motion=Find<TranslateTransform>("Motion");motion.BeginAnimation(TranslateTransform.XProperty,new DoubleAnimation(-210,650,new Duration(TimeSpan.FromSeconds(1.4))){RepeatBehavior=RepeatBehavior.Forever});}else{Find<TranslateTransform>("Motion").BeginAnimation(TranslateTransform.XProperty,null);bar.Visibility=Visibility.Collapsed;}}
    static void Stage(string phase){window.Dispatcher.Invoke(new Action(()=>{if(phase=="committing"){committing=true;Find<Button>("Action").IsEnabled=false;}var index=phase=="backup"?2:phase=="writing"?3:phase=="verifying"||phase=="committing"?4:phase=="complete"?5:0;var steps=NativeEngine.Arr(copy["steps"]);Label("Status",Convert.ToString(steps[index]));Label("Step",(index+1).ToString("00")+" / 06");}));if(request!=null)State(phase=="complete"?"installed":phase,"");}
    static void State(string phase,string message){NativeEngine.Atomic(Path.Combine(job,"state.json"),new {schema=2,id=(string)request["id"],token=(string)request["token"],phase=phase,message=message,workerPid=Process.GetCurrentProcess().Id});}
    static void OpenHydra(string folder){if(NativeEngine.Running(folder))return;var info=new ProcessStartInfo(Path.Combine(folder,"Hydra.exe")){WorkingDirectory=folder,UseShellExecute=true};var p=Process.Start(info);if(p==null)throw new IOException("Hydra did not start.");if(p.WaitForExit(1500))throw new IOException("Hydra exited during startup.");p.Dispose();}
    static async void Install(){if(busy)return;if(preview){Label("Footer",Text("preview"));return;}directory=Find<TextBox>("Folder").Text.Trim().Trim('"');if(!File.Exists(Path.Combine(directory,"Hydra.exe"))||!File.Exists(Path.Combine(directory,"resources","app.asar"))){Label("Footer",Text("invalidFolder"));return;}SetBusy(true);try{await Task.Run(()=>{using(var mutex=new Mutex(false,@"Local\HydraNexusInstallV1")){bool held=false;try{try{held=mutex.WaitOne(0);}catch(AbandonedMutexException){held=true;}if(!held)throw new IOException("Another installer or updater is active.");new NativeEngine().Install(directory,Stage,()=>cancelRequested);}finally{if(held)mutex.ReleaseMutex();}}});Label("Title",Text("setupComplete"));Label("Status",Text("setupDone"));if(reopen.IsChecked==true){try{await Task.Run(()=>OpenHydra(directory));}catch(Exception e){Label("Footer",Text("unconfirmed")+"\n"+e.Message);}}}catch(Exception e){exitCode=1;Label("Footer",e.Message);Label("Status",Text("attention"));}finally{SetBusy(false);Label("Action",Text("install"));}}
    static bool FileToken(string name){if(name=="cancel"&&cancelRequested)return true;var p=Path.Combine(job,name);return File.Exists(p)&&File.ReadAllText(p,Encoding.UTF8)==(string)request["token"];}
    static void UpdateWorker(){
        bool approved=false;using(var mutex=new Mutex(false,@"Local\HydraNexusInstallV1")){bool held=false;try{
            try{held=mutex.WaitOne(0);}catch(AbandonedMutexException){held=true;}if(!held)throw new IOException("Another installer or updater is active.");
            var exe=Path.GetFullPath((string)request["exe"]);directory=Path.GetDirectoryName(exe);NativeEngine.Plain(exe);if(!String.Equals(exe,Path.Combine(directory,"Hydra.exe"),StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid Hydra executable.");
            var self=Assembly.GetExecutingAssembly().Location;if(Path.GetFullPath((string)request["installer"])!=self||NativeEngine.HashFile(self)!=(string)request["sha256"])throw new IOException("The staged installer changed.");
            if((string)request["version"]!=NativeEngine.Version||Convert.ToInt32(request["revision"])!=NativeEngine.Revision)throw new IOException("Installer metadata does not match the update.");
            using(var parent=Process.GetProcessById(Convert.ToInt32(request["parentPid"]))){if(!String.Equals(parent.MainModule.FileName,(string)request["parentExe"],StringComparison.OrdinalIgnoreCase)||!String.Equals(parent.MainModule.FileName,exe,StringComparison.OrdinalIgnoreCase))throw new IOException("Update parent identity mismatch.");
                State("ready","");var deadline=DateTime.UtcNow.AddSeconds(90);while(!FileToken("approved")){if(FileToken("cancel")||parent.HasExited)throw new IOException("Update cancelled before approval.");if(DateTime.UtcNow>deadline)throw new IOException("Update approval timed out. Hydra was kept open.");Thread.Sleep(100);}approved=true;State("waiting","");
                while(!parent.WaitForExit(100)){if(FileToken("cancel"))throw new IOException("Update cancelled before installation.");if(DateTime.UtcNow>deadline)throw new IOException("Hydra did not close. No update was installed.");}
            }
            if(FileToken("cancel"))throw new IOException("Update cancelled before installation.");
            var lockDeadline=DateTime.UtcNow.AddSeconds(20);while(NativeEngine.Running(directory)){if(DateTime.UtcNow>lockDeadline)throw new IOException("Hydra is still running. No update was installed.");Thread.Sleep(200);}
            if(NativeEngine.HashFile(self)!=(string)request["sha256"])throw new IOException("Installer integrity changed before installation.");
            new NativeEngine().Install(directory,Stage);State("installed","");OpenHydra(directory);window.Dispatcher.Invoke(new Action(()=>{SetBusy(false);Label("Title",Text("setupComplete"));Label("Status",Text("setupDone"));Label("Action",Text("close"));}));
            var startupDeadline=DateTime.UtcNow.AddSeconds(45);bool confirmed=false;while(DateTime.UtcNow<startupDeadline){try{var c=NativeEngine.Obj(NativeEngine.Json.DeserializeObject(File.ReadAllText(Path.Combine(job,"startup-confirmed.json"))));if(Convert.ToInt32(c["schema"])==1&&(string)c["id"]==(string)request["id"]&&(string)c["version"]==NativeEngine.Version&&Convert.ToInt32(c["revision"])==NativeEngine.Revision){confirmed=true;break;}}catch{}Thread.Sleep(100);}
            window.Dispatcher.Invoke(new Action(()=>{if(confirmed)window.Close();else Label("Footer",Text("unconfirmed"));}));
        }catch(Exception e){exitCode=1;try{State("failed",e.Message);}catch{};window.Dispatcher.Invoke(new Action(()=>{SetBusy(false);Label("Status",Text("attention"));Label("Footer",e.Message);}));if(approved&&!NativeEngine.Running(directory)){try{OpenHydra(directory);}catch{}}}finally{if(held)mutex.ReleaseMutex();}}
    }
    [STAThread]internal static int Main(string[] args){try{
        SetCurrentProcessExplicitAppUserModelID("Hydra.Nexus.Setup");
#if NEXUS_RENDER_TEST
        if(args.Length==5&&args[0]=="--render"){render=args;args=new[]{"--preview"};}
#endif
        preview=args.Length==1&&args[0]=="--preview";
        if(args.Length==2&&args[0]=="--update"){var file=Path.GetFullPath(args[1]);NativeEngine.Plain(file);if(new FileInfo(file).Length>65536)throw new IOException("Invalid update request.");request=NativeEngine.Obj(NativeEngine.Json.DeserializeObject(File.ReadAllText(file)));if(Convert.ToInt32(request["schema"])!=2||!System.Text.RegularExpressions.Regex.IsMatch((string)request["id"],"^[a-f0-9]{32}$")||!System.Text.RegularExpressions.Regex.IsMatch((string)request["token"],"^[a-f0-9]{64}$"))throw new IOException("Invalid update identity.");job=Path.GetDirectoryName(file);if(Path.GetFileName(job)!="job-"+(string)request["id"])throw new IOException("Invalid update folder.");}
        else if(args.Length!=0&&!preview)throw new ArgumentException("Supported options: --preview or --update <request.json>.");
        using(var s=Resource("setup-window.xaml"))window=(Window)XamlReader.Load(s);using(var s=Resource("setup-copy.json"))using(var r=new StreamReader(s))catalogs=NativeEngine.Obj(NativeEngine.Json.DeserializeObject(r.ReadToEnd()));
        using(var s=Resource("setup.ico")){var decoder=new IconBitmapDecoder(s,BitmapCreateOptions.PreservePixelFormat,BitmapCacheOption.OnLoad);window.Icon=decoder.Frames.OrderByDescending(x=>x.PixelWidth).First();}
        using(var s=Resource("setup-logo.png")){var image=new BitmapImage();image.BeginInit();image.CacheOption=BitmapCacheOption.OnLoad;image.StreamSource=s;image.EndInit();Find<Image>("Logo").Source=image;Find<Image>("Logo").FlowDirection=FlowDirection.LeftToRight;}
        var bodyArea=Find<Grid>("BodyArea");var body=Find<StackPanel>("Body");bodyArea.Children.Remove(body);bodyArea.Children.Add(new ScrollViewer {Content=body,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled});
        languages=new ComboBox {Width=148,MinHeight=30,FontSize=12,Margin=new Thickness(0,0,12,0),VerticalAlignment=VerticalAlignment.Center,FlowDirection=FlowDirection.LeftToRight};foreach(var n in names)languages.Items.Add(n);var options=Find<StackPanel>("SetupOptions");var chrome=(Grid)Find<FrameworkElement>("DragArea").Parent;var version=(FrameworkElement)Find<TextBlock>("Version").Parent;chrome.Children.Remove(version);var corner=new StackPanel {Orientation=Orientation.Horizontal,FlowDirection=FlowDirection.LeftToRight};corner.Children.Add(languages);corner.Children.Add(version);Grid.SetColumn(corner,1);chrome.Children.Add(corner);System.Windows.Automation.AutomationProperties.SetName(languages,"Language");reopen=new CheckBox {IsChecked=true,Margin=new Thickness(0,12,0,0),Foreground=Brushes.White};options.Children.Add(reopen);Find<Button>("Browse").Click+=(s,e)=>{using(var dialog=new System.Windows.Forms.FolderBrowserDialog()){dialog.ShowNewFolderButton=false;if(dialog.ShowDialog()==System.Windows.Forms.DialogResult.OK)Find<TextBox>("Folder").Text=dialog.SelectedPath;}};
        Find<Button>("Minimize").Click+=(s,e)=>window.WindowState=WindowState.Minimized;Find<Button>("Dismiss").Click+=(s,e)=>{if(!busy)window.Close();};Find<Button>("Action").Click+=(s,e)=>{if(busy){cancelRequested=true;Find<Button>("Action").IsEnabled=false;}else if(request!=null)window.Close();else Install();};Find<FrameworkElement>("DragArea").MouseLeftButtonDown+=(s,e)=>{if(e.ButtonState==MouseButtonState.Pressed)window.DragMove();};window.Closing+=(s,e)=>{if(busy)e.Cancel=true;};window.KeyDown+=(s,e)=>{if(e.Key==Key.Escape&&!busy)window.Close();};languages.SelectionChanged+=(s,e)=>Language();
        int selected=0;if(request!=null&&request.ContainsKey("presentation")){var presentation=NativeEngine.Obj(request["presentation"]);if(presentation.ContainsKey("language"))selected=Array.IndexOf(codes,(string)presentation["language"]);}languages.SelectedIndex=Math.Max(0,selected);
        Find<FrameworkElement>("Steps").Visibility=Visibility.Collapsed;Find<FrameworkElement>("Details").Visibility=Visibility.Collapsed;Find<FrameworkElement>("ProgressPanel").Visibility=Visibility.Visible;Find<FrameworkElement>("Bar").Visibility=Visibility.Collapsed;options.Visibility=request==null?Visibility.Visible:Visibility.Collapsed;
        window.MaxHeight=SystemParameters.WorkArea.Height-24;window.MaxWidth=SystemParameters.WorkArea.Width-24;window.Height=Math.Min(window.Height,window.MaxHeight);window.Width=Math.Min(window.Width,window.MaxWidth);window.MinHeight=Math.Min(window.MinHeight,window.Height);window.MinWidth=Math.Min(window.MinWidth,window.Width);
#if NEXUS_RENDER_TEST
        if(request!=null){window.WindowStartupLocation=WindowStartupLocation.Manual;window.Left=-20000;window.Top=-20000;window.ShowInTaskbar=false;}
        if(render!=null){languages.SelectedIndex=Array.IndexOf(codes,render[2]);Find<TextBox>("Folder").Text=@"C:\Preview\Hydra";Label("Footer",Text("preview"));var content=(FrameworkElement)window.Content;var size=new Size(Double.Parse(render[3]),Double.Parse(render[4]));content.Width=Double.NaN;content.Height=Double.NaN;content.Measure(size);content.Arrange(new Rect(size));content.UpdateLayout();var bmp=new RenderTargetBitmap((int)size.Width,(int)size.Height,96,96,PixelFormats.Pbgra32);bmp.Render(content);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bmp));using(var f=File.Create(render[1]))encoder.Save(f);return 0;}
#endif
        window.Loaded+=async(s,e)=>{if(request!=null){SetBusy(true);await Task.Run((Action)UpdateWorker);}else if(preview){Find<TextBox>("Folder").Text=@"C:\Preview\Hydra";Label("Footer",Text("preview"));}else{var detected=await Task.Run((Func<string>)Detect);if(String.IsNullOrWhiteSpace(Find<TextBox>("Folder").Text))Find<TextBox>("Folder").Text=detected;}};
        new Application().Run(window);return exitCode;
    }catch(Exception e){MessageBox.Show(e.Message,"Hydra Nexus",MessageBoxButton.OK,MessageBoxImage.Error);return 1;}}
}
