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
    static Window window;static Dictionary<string,object> catalogs,copy;static ComboBox languages;static bool busy,preview;static string directory;static Dictionary<string,object> request;static string job;static int exitCode;static volatile bool cancelRequested,committing;
#if NEXUS_RENDER_TEST
    static string[] render;
#endif
    static readonly string[] codes={"en","pt-BR","es","ru","ar","fr","de","tr","pl"};
    static readonly string[] names={"English","Português (Brasil)","Español","Русский","العربية","Français","Deutsch","Türkçe","Polski"};
    static T Find<T>(string name)where T:class{return (T)window.FindName(name);}
    static string Text(string key){if(copy.ContainsKey(key))return Convert.ToString(copy[key]);var english=NativeEngine.Obj(catalogs["en"]);return english.ContainsKey(key)?Convert.ToString(english[key]):key;}
    static Stream Resource(string name){var s=Assembly.GetExecutingAssembly().GetManifestResourceStream(name);if(s==null)throw new IOException("Missing setup resource: "+name);return s;}
    static void Label(string name,string text){var t=window.FindName(name)as TextBlock;if(t!=null)t.Text=text;else{var b=window.FindName(name)as Button;if(b!=null)b.Content=text;}}
    static void Language(){var lang=codes[Math.Max(0,languages.SelectedIndex)];copy=NativeEngine.Obj(catalogs[lang]);window.FlowDirection=lang=="ar"?FlowDirection.RightToLeft:FlowDirection.LeftToRight;Label("Version","4.0");Label("Tagline",Text("tagline"));Label("Eyebrow",Text("setupEdition"));Label("Title",Text("setupTitle"));Label("Hint",Text("setupHint"));Label("FolderLabel",Text("folder"));Label("Browse",Text("browse"));Label("OperationLabel",Text("operation"));Label("Action",Text("install"));Label("Remove",Text("remove"));Label("Safety",Text("safety"));Label("Status",Text("setupReady"));Label("SmallStatus","");Label("Dismiss","×");Find<Button>("Dismiss").ToolTip=Text("close");Label("Minimize","−");Find<Button>("Minimize").ToolTip=Text("minimize");Label("Footer","");Find<ComboBox>("Operation").Items.Clear();Find<ComboBox>("Operation").Items.Add(Text("install"));Find<ComboBox>("Operation").SelectedIndex=0;Find<ComboBox>("Operation").Visibility=Visibility.Collapsed;Find<TextBlock>("OperationLabel").Visibility=Visibility.Collapsed;}
    static string Detect(){
        var paths=new List<string>();foreach(var p in Process.GetProcessesByName("Hydra")){using(p){try{paths.Add(Path.GetDirectoryName(p.MainModule.FileName));}catch{}}}
        foreach(var hive in new[]{Registry.CurrentUser,Registry.LocalMachine})foreach(var sub in new[]{@"Software\Microsoft\Windows\CurrentVersion\Uninstall",@"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"})using(var key=hive.OpenSubKey(sub)){if(key==null)continue;foreach(var name in key.GetSubKeyNames())using(var entry=key.OpenSubKey(name)){if(entry==null||Convert.ToString(entry.GetValue("DisplayName")).IndexOf("Hydra",StringComparison.OrdinalIgnoreCase)<0)continue;paths.Add(Convert.ToString(entry.GetValue("InstallLocation")));}}
        foreach(var basis in new[]{Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86)})foreach(var name in new[]{"Programs/Hydra","Hydra","hydralauncher"})if(!String.IsNullOrEmpty(basis))paths.Add(Path.Combine(basis,name));
        return paths.FirstOrDefault(p=>!String.IsNullOrWhiteSpace(p)&&File.Exists(Path.Combine(p,"Hydra.exe"))&&File.Exists(Path.Combine(p,"resources","app.asar")))??"";
    }
    static void SetBusy(bool value){busy=value;languages.IsEnabled=!value;if(value){Label("Footer","");cancelRequested=false;committing=false;Label("Action",Text("cancel"));}Find<StackPanel>("SetupOptions").IsEnabled=!value;Find<Button>("Remove").IsEnabled=!value;Find<Button>("Action").IsEnabled=!value||!committing;Find<Button>("Dismiss").IsEnabled=!value;Find<FrameworkElement>("Steps").Visibility=Visibility.Collapsed;Find<Border>("ProgressPanel").Visibility=Visibility.Visible;var bar=Find<FrameworkElement>("Bar");if(value){bar.Visibility=Visibility.Visible;var motion=Find<TranslateTransform>("Motion");motion.BeginAnimation(TranslateTransform.XProperty,new DoubleAnimation(-210,650,new Duration(TimeSpan.FromSeconds(1.4))){RepeatBehavior=RepeatBehavior.Forever});}else{Find<TranslateTransform>("Motion").BeginAnimation(TranslateTransform.XProperty,null);bar.Visibility=Visibility.Collapsed;}}
    static void Stage(string phase){window.Dispatcher.Invoke(new Action(()=>{if(phase=="committing"){committing=true;Find<Button>("Action").IsEnabled=false;}var index=phase=="backup"?2:phase=="writing"?3:phase=="verifying"||phase=="committing"?4:phase=="complete"?5:0;var steps=NativeEngine.Arr(copy["steps"]);Label("Status",Convert.ToString(steps[index]));Label("Step",(index+1).ToString("00")+" / 06");}));if(request!=null)State(phase=="complete"?"installed":phase,"");}
    static void State(string phase,string message){NativeEngine.Atomic(Path.Combine(job,"state.json"),new {schema=2,id=(string)request["id"],token=(string)request["token"],phase=phase,message=message,workerPid=Process.GetCurrentProcess().Id});}
    static void OpenHydra(string folder){if(NativeEngine.Running(folder))return;var info=new ProcessStartInfo(Path.Combine(folder,"Hydra.exe")){WorkingDirectory=folder,UseShellExecute=true};var p=Process.Start(info);if(p==null)throw new IOException("Hydra did not start.");if(p.WaitForExit(1500))throw new IOException("Hydra exited during startup.");p.Dispose();}
    static bool ValidFolder(string folder){return !String.IsNullOrWhiteSpace(folder)&&File.Exists(Path.Combine(folder,"Hydra.exe"))&&File.Exists(Path.Combine(folder,"resources","app.asar"));}
    static void Detection(){var found=preview||ValidFolder(Find<TextBox>("Folder").Text);Find<FrameworkElement>("ManualFolder").Visibility=found?Visibility.Collapsed:Visibility.Visible;Label("DetectionTitle",Text(found?"detected":"notDetected"));Label("DetectionHint",Text(found?"detectedHint":"notDetectedHint"));}
    static bool ConfirmClose(){
        var dialog=new Window {Title=Text("forceCloseTitle"),WindowStyle=WindowStyle.None,ResizeMode=ResizeMode.NoResize,SizeToContent=SizeToContent.Height,Width=Math.Min(540,(window.ActualWidth>0?window.ActualWidth:window.Width)-48),WindowStartupLocation=WindowStartupLocation.CenterOwner,Background=new SolidColorBrush(Color.FromRgb(17,16,24)),Foreground=Brushes.White,FontFamily=new FontFamily("Segoe UI"),FontSize=14,FlowDirection=window.FlowDirection,ShowInTaskbar=false};
        if(window.IsVisible)dialog.Owner=window;
        var panel=new StackPanel {Margin=new Thickness(26)};
        panel.Children.Add(new TextBlock {Text=Text("forceCloseTitle"),FontSize=23,FontWeight=FontWeights.SemiBold,TextWrapping=TextWrapping.Wrap,Margin=new Thickness(0,0,0,14)});
        panel.Children.Add(new TextBlock {Text=Text("forceCloseWarning"),FontSize=14,LineHeight=23,TextWrapping=TextWrapping.Wrap,Foreground=new SolidColorBrush(Color.FromRgb(190,183,202))});
        var actions=new StackPanel {Orientation=Orientation.Horizontal,HorizontalAlignment=HorizontalAlignment.Right,Margin=new Thickness(0,24,0,0)};
        var cancel=new Button {Content=Text("cancel"),IsCancel=true,IsDefault=true,Style=(Style)window.FindResource("ActionButton"),Background=new SolidColorBrush(Color.FromRgb(33,27,41)),Foreground=Brushes.White,Margin=new Thickness(0,0,12,0)};
        var proceed=new Button {Content=Text("closeContinue"),Style=(Style)window.FindResource("ActionButton")};
        cancel.Click+=(s,e)=>dialog.DialogResult=false;proceed.Click+=(s,e)=>dialog.DialogResult=true;actions.Children.Add(cancel);actions.Children.Add(proceed);panel.Children.Add(actions);
        dialog.Content=new Border {Background=dialog.Background,BorderBrush=new SolidColorBrush(Color.FromRgb(107,83,124)),BorderThickness=new Thickness(1),Child=panel};
        #if NEXUS_RENDER_TEST
        if(render!=null&&render[0]=="--render-confirm"){var view=(FrameworkElement)dialog.Content;view.Measure(new Size(dialog.Width,Double.PositiveInfinity));var size=new Size(dialog.Width,view.DesiredSize.Height);view.Arrange(new Rect(size));view.UpdateLayout();var bitmap=new RenderTargetBitmap((int)size.Width,(int)Math.Ceiling(size.Height),96,96,PixelFormats.Pbgra32);bitmap.Render(view);var png=new PngBitmapEncoder();png.Frames.Add(BitmapFrame.Create(bitmap));using(var file=File.Create(render[1]))png.Save(file);return false;}
#endif
        dialog.Loaded+=(s,e)=>cancel.Focus();return dialog.ShowDialog()==true;
    }
    static async void Install(bool removing=false){
        if(busy)return;if(preview){Label("Footer",Text("preview"));return;}
        directory=Find<TextBox>("Folder").Text.Trim().Trim('"');if(!ValidFolder(directory)){Detection();Label("Footer",Text("invalidFolder"));return;}
        if(removing&&MessageBox.Show(window,Text("removeConfirm"),Text("remove"),MessageBoxButton.YesNo,MessageBoxImage.Warning,MessageBoxResult.No)!=MessageBoxResult.Yes)return;
        SetBusy(true);bool changed=false;try{
            Label("Status",Text("closingHydra"));
            await Task.Run(()=>{using(var mutex=new Mutex(false,@"Local\HydraNexusInstallV1")){bool held=false;try{try{held=mutex.WaitOne(0);}catch(AbandonedMutexException){held=true;}if(!held)throw new IOException("Another installer or updater is active.");
                NativeEngine.CloseHydra(directory,()=>window.Dispatcher.Invoke(new Func<bool>(()=>ConfirmClose())));if(cancelRequested)throw new OperationCanceledException("Cancelled before installation.");
                var engine=new NativeEngine();if(removing)engine.Remove(directory,Stage,()=>cancelRequested);else engine.Install(directory,Stage,()=>cancelRequested);
            }finally{if(held)mutex.ReleaseMutex();}}});changed=true;
            Label("Title",Text(removing?"removedTitle":"setupComplete"));Label("Status",Text("openingHydra"));
            await Task.Run(()=>OpenHydra(directory));Label("Status",Text(removing?"removedDone":"setupDone"));SetBusy(false);window.Close();
        }catch(Exception e){exitCode=1;Label("Footer",e.Message);Label("Status",Text(changed?"unconfirmed":"attention"));if(!NativeEngine.Running(directory)){try{OpenHydra(directory);}catch{}}}
        finally{SetBusy(false);Label("Action",Text("install"));}
    }
    static bool FileToken(string name){if(name=="cancel"&&cancelRequested)return true;var p=Path.Combine(job,name);return File.Exists(p)&&File.ReadAllText(p,Encoding.UTF8)==(string)request["token"];}
    static string CancellationReason(string fallback){try{var file=Path.Combine(job,"cancel-reason.txt");if(FileToken("cancel")&&File.Exists(file)&&new FileInfo(file).Length<=4096){var reason=File.ReadAllText(file,Encoding.UTF8).Trim();if(reason.Length>0)return reason;}}catch{}return fallback;}
    static void UpdateWorker(){
        bool approved=false;using(var mutex=new Mutex(false,@"Local\HydraNexusInstallV1")){bool held=false;try{
            try{held=mutex.WaitOne(0);}catch(AbandonedMutexException){held=true;}if(!held)throw new IOException("Another installer or updater is active.");
            var exe=Path.GetFullPath((string)request["exe"]);directory=Path.GetDirectoryName(exe);NativeEngine.Plain(exe);if(!String.Equals(exe,Path.Combine(directory,"Hydra.exe"),StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid Hydra executable.");
            var self=Assembly.GetExecutingAssembly().Location;if(Path.GetFullPath((string)request["installer"])!=self||NativeEngine.HashFile(self)!=(string)request["sha256"])throw new IOException("The staged installer changed.");
            if((string)request["version"]!=NativeEngine.Version||Convert.ToInt32(request["revision"])!=NativeEngine.Revision)throw new IOException("Installer metadata does not match the update.");
            using(var parent=Process.GetProcessById(Convert.ToInt32(request["parentPid"]))){if(!String.Equals(parent.MainModule.FileName,(string)request["parentExe"],StringComparison.OrdinalIgnoreCase)||!String.Equals(parent.MainModule.FileName,exe,StringComparison.OrdinalIgnoreCase))throw new IOException("Update parent identity mismatch.");
                State("ready","");var deadline=DateTime.UtcNow.AddSeconds(90);while(!FileToken("approved")){if(FileToken("cancel")||parent.HasExited)throw new IOException(CancellationReason("Update cancelled before approval."));if(DateTime.UtcNow>deadline)throw new IOException("Update approval timed out. Hydra was kept open.");Thread.Sleep(100);}approved=true;State("waiting","");
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
        SetCurrentProcessExplicitAppUserModelID("Hydra.Nexus.Setup.4");
#if NEXUS_RENDER_TEST
        if(args.Length==5&&(args[0]=="--render"||args[0]=="--render-update"||args[0]=="--render-confirm")){render=args;args=new[]{"--preview"};}
#endif
        preview=false;
#if NEXUS_RENDER_TEST
        preview=args.Length==1&&args[0]=="--preview";
#endif
        if(args.Length==2&&args[0]=="--update"){var file=Path.GetFullPath(args[1]);NativeEngine.Plain(file);if(new FileInfo(file).Length>65536)throw new IOException("Invalid update request.");request=NativeEngine.Obj(NativeEngine.Json.DeserializeObject(File.ReadAllText(file)));if(Convert.ToInt32(request["schema"])!=2||!System.Text.RegularExpressions.Regex.IsMatch((string)request["id"],"^[a-f0-9]{32}$")||!System.Text.RegularExpressions.Regex.IsMatch((string)request["token"],"^[a-f0-9]{64}$"))throw new IOException("Invalid update identity.");job=Path.GetDirectoryName(file);if(Path.GetFileName(job)!="job-"+(string)request["id"])throw new IOException("Invalid update folder.");}
        else if(args.Length!=0&&!preview)throw new ArgumentException("Supported option: --update <request.json>.");
        using(var s=Resource("setup-window.xaml"))window=(Window)XamlReader.Load(s);using(var s=Resource("setup-copy.json"))using(var r=new StreamReader(s))catalogs=NativeEngine.Obj(NativeEngine.Json.DeserializeObject(r.ReadToEnd()));
        using(var s=Resource("setup.ico")){var decoder=new IconBitmapDecoder(s,BitmapCreateOptions.PreservePixelFormat,BitmapCacheOption.OnLoad);window.Icon=decoder.Frames.OrderByDescending(x=>x.PixelWidth).First();}
        using(var s=Resource("setup-logo.png")){var image=new BitmapImage();image.BeginInit();image.CacheOption=BitmapCacheOption.OnLoad;image.StreamSource=s;image.EndInit();Find<Image>("Logo").Source=image;Find<Image>("Logo").FlowDirection=FlowDirection.LeftToRight;}
        var bodyArea=Find<Grid>("BodyArea");var body=Find<StackPanel>("Body");bodyArea.Children.Remove(body);bodyArea.Children.Add(new ScrollViewer {Content=body,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,HorizontalScrollBarVisibility=ScrollBarVisibility.Disabled});
        languages=new ComboBox {Width=148,MinHeight=30,FontSize=12,Margin=new Thickness(0,0,12,0),VerticalAlignment=VerticalAlignment.Center,FlowDirection=FlowDirection.LeftToRight};foreach(var n in names)languages.Items.Add(n);var options=Find<StackPanel>("SetupOptions");var chrome=(Grid)Find<FrameworkElement>("DragArea").Parent;var version=(FrameworkElement)Find<TextBlock>("Version").Parent;chrome.Children.Remove(version);var corner=new StackPanel {Orientation=Orientation.Horizontal,FlowDirection=FlowDirection.LeftToRight};corner.Children.Add(languages);corner.Children.Add(version);Grid.SetColumn(corner,1);chrome.Children.Add(corner);System.Windows.Automation.AutomationProperties.SetName(languages,"Language");Find<Button>("Browse").Click+=(s,e)=>{using(var dialog=new System.Windows.Forms.FolderBrowserDialog()){dialog.ShowNewFolderButton=false;if(dialog.ShowDialog()==System.Windows.Forms.DialogResult.OK)Find<TextBox>("Folder").Text=dialog.SelectedPath;}};
        Find<Button>("Remove").Click+=(s,e)=>Install(true);Find<Button>("Minimize").Click+=(s,e)=>window.WindowState=WindowState.Minimized;Find<Button>("Dismiss").Click+=(s,e)=>{if(!busy)window.Close();};Find<Button>("Action").Click+=(s,e)=>{if(busy){cancelRequested=true;Find<Button>("Action").IsEnabled=false;}else if(request!=null)window.Close();else Install();};Find<FrameworkElement>("DragArea").MouseLeftButtonDown+=(s,e)=>{if(e.ButtonState==MouseButtonState.Pressed)window.DragMove();};window.Closing+=(s,e)=>{if(busy)e.Cancel=true;};window.KeyDown+=(s,e)=>{if(e.Key==Key.Escape&&!busy)window.Close();};languages.SelectionChanged+=(s,e)=>Language();
        int selected=Array.IndexOf(codes,InstallerLanguage.WindowsLanguage());languages.SelectedIndex=Math.Max(0,selected);
        Find<FrameworkElement>("Steps").Visibility=Visibility.Collapsed;Find<FrameworkElement>("Details").Visibility=Visibility.Collapsed;Find<FrameworkElement>("ProgressPanel").Visibility=Visibility.Visible;Find<FrameworkElement>("Bar").Visibility=Visibility.Collapsed;options.Visibility=request==null?Visibility.Visible:Visibility.Collapsed;Find<Button>("Remove").Visibility=request==null?Visibility.Visible:Visibility.Collapsed;
        window.MaxHeight=SystemParameters.WorkArea.Height-24;window.MaxWidth=SystemParameters.WorkArea.Width-24;window.Height=Math.Min(window.Height,window.MaxHeight);window.Width=Math.Min(window.Width,window.MaxWidth);window.MinHeight=Math.Min(window.MinHeight,window.Height);window.MinWidth=Math.Min(window.MinWidth,window.Width);
#if NEXUS_RENDER_TEST
        if(request!=null){window.WindowStartupLocation=WindowStartupLocation.Manual;window.Left=-20000;window.Top=-20000;window.ShowInTaskbar=false;}
        if(render!=null){languages.SelectedIndex=Array.IndexOf(codes,render[2]);if(render[0]=="--render-confirm"){window.Width=900;ConfirmClose();return 0;}Find<TextBox>("Folder").Text=@"C:\Preview\Hydra";Label("Footer",Text("preview"));Detection();if(render[0]=="--render-update"){options.Visibility=Visibility.Collapsed;Find<Button>("Remove").Visibility=Visibility.Collapsed;Label("Title",Text("title"));Label("Hint",Text("wait"));Label("Status",Text("closingHydra"));Label("Action",Text("cancel"));}var content=(FrameworkElement)window.Content;var size=new Size(Double.Parse(render[3]),Double.Parse(render[4]));content.Width=Double.NaN;content.Height=Double.NaN;content.Measure(size);content.Arrange(new Rect(size));content.UpdateLayout();var bmp=new RenderTargetBitmap((int)size.Width,(int)size.Height,96,96,PixelFormats.Pbgra32);bmp.Render(content);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bmp));using(var f=File.Create(render[1]))encoder.Save(f);return 0;}
#endif
        window.Loaded+=async(s,e)=>{if(request!=null){Label("Title",Text("title"));Label("Hint",Text("wait"));SetBusy(true);await Task.Run((Action)UpdateWorker);}
#if NEXUS_RENDER_TEST
else if(preview){Find<TextBox>("Folder").Text=@"C:\Preview\Hydra";Label("Footer",Text("preview"));Detection();}
#endif
else{var detected=await Task.Run((Func<string>)Detect);if(String.IsNullOrWhiteSpace(Find<TextBox>("Folder").Text))Find<TextBox>("Folder").Text=detected;Detection();}};
        new Application().Run(window);return exitCode;
    }catch(Exception e){
#if NEXUS_RENDER_TEST
if(render!=null){File.WriteAllText(render[1]+".error.txt",e.ToString());return 1;}
#endif
MessageBox.Show(e.Message,"Hydra Nexus",MessageBoxButton.OK,MessageBoxImage.Error);return 1;}}
}
