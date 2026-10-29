# Shared presentation only; no file installation, process shutdown or recovery decisions.
function New-NexusSurface($Copy,[string]$Version){
    Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
    $markup='__NEXUS_SURFACE_XAML_BASE64__'
    if($markup -like '__NEXUS_*'){$xml=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'setup-window.xaml') -Raw -Encoding UTF8}else{$xml=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($markup))}
    $window=[Windows.Markup.XamlReader]::Parse($xml)
    $window.MaxHeight=[Windows.SystemParameters]::WorkArea.Height
    $window.MaxWidth=[Windows.SystemParameters]::WorkArea.Width
    $window.MinHeight=[Math]::Min($window.MinHeight,$window.MaxHeight)
    $window.MinWidth=[Math]::Min($window.MinWidth,$window.MaxWidth)
    $window.Height=[Math]::Min($window.Height,$window.MaxHeight)
    if($window.MaxHeight -lt 680){
        $window.FindName('Title').FontSize=25
        $window.FindName('Hint').Margin='0,6,0,10'
        $window.FindName('BodyArea').Margin='0,10,0,10'
        $window.FindName('ProgressPanel').Padding='12'
        $window.FindName('Steps').Visibility='Collapsed'
        $window.FindName('SetupOptions').Margin='0,0,0,10'
    }
    $window.FindName('Version').Text=$Version
    # Handlers use the sender's owner so no closed-over mutable global is required.
    $window.FindName('Minimize').Add_Click({param($sender,$event) [Windows.Window]::GetWindow($sender).WindowState='Minimized'})
    $window.FindName('DragArea').Add_MouseLeftButtonDown({param($sender,$event) if($event.ChangedButton -eq 'Left'){[Windows.Window]::GetWindow($sender).DragMove()}})
    $logo='__NEXUS_PROGRESS_LOGO__'
    if($logo -like '__NEXUS_*'){$logo=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '../assets/brand/Hydra-Nexus-transparent.png')))}
    $stream=New-Object IO.MemoryStream(,[Convert]::FromBase64String($logo))
    try{$image=New-Object Windows.Media.Imaging.BitmapImage;$image.BeginInit();$image.CacheOption='OnLoad';$image.StreamSource=$stream;$image.EndInit();$image.Freeze();$window.FindName('Logo').Source=$image;$window.Icon=$image}finally{$stream.Dispose()}
    if($Copy.direction -eq 'rtl'){$window.FlowDirection='RightToLeft'}
    foreach($name in @('Minimize','Dismiss','Action')){[Windows.Automation.AutomationProperties]::SetName($window.FindName($name),$(switch($name){'Minimize'{$Copy.minimize};'Dismiss'{$Copy.close};'Action'{$Copy.cancel}}))}
    $window.FindName('Eyebrow').Text=$Copy.title
    $window.FindName('Safety').Text=$Copy.safety
    $window.FindName('Details').Content=$Copy.details
    $window.Add_SizeChanged({param($sender,$event)
        $compact=$sender.ActualHeight -lt 680
        $sender.FindName('Title').FontSize=if($compact){25}else{30}
        $sender.FindName('Hint').Visibility=if($compact){'Collapsed'}else{'Visible'}
        $sender.FindName('Eyebrow').Visibility=if($compact){'Collapsed'}else{'Visible'}
        $sender.FindName('BodyArea').Margin=if($compact){'0,8,0,8'}else{'0,18,0,18'}
        $sender.FindName('ProgressPanel').Padding=if($compact){'12'}else{'18'}
        if($compact){$sender.FindName('Steps').Visibility='Collapsed';$sender.FindName('SetupOptions').Margin='0,0,0,10'}
    })
    for($i=0;$i -lt 6;$i++){$window.FindName('StepText'+$i).Text=('{0:00}  ' -f ($i+1))+$Copy.steps[$i]}
    $window.FindName('Details').Add_Click({param($sender,$event)
        $owner=[Windows.Window]::GetWindow($sender)
        $dialog=New-Object Windows.Window;$dialog.Owner=$owner;$dialog.Title=[string]$sender.Content;$dialog.Width=720;$dialog.Height=360;$dialog.WindowStartupLocation='CenterOwner';$dialog.Background='#14231F'
        $text=New-Object Windows.Controls.TextBox;$text.Text=$owner.FindName('DetailText').Text;$text.IsReadOnly=$true;$text.TextWrapping='Wrap';$text.VerticalScrollBarVisibility='Auto';$text.Foreground='#E4F4EB';$text.Background='#14231F';$text.BorderThickness=0;$text.Padding=20;$text.FontSize=14
        $dialog.Content=$text;$dialog.Add_KeyDown({param($s,$e) if($e.Key -eq 'Escape'){$s.Close()}});$null=$dialog.ShowDialog()
    })
    # Explicit clocks continue when Windows animations are disabled.
    $entrance=New-Object Windows.Media.Animation.DoubleAnimation(0,1,[Windows.Duration]::new([TimeSpan]::FromMilliseconds(200)))
    $window.BeginAnimation([Windows.UIElement]::OpacityProperty,$entrance)
    return $window
}
function Set-NexusSurfaceStage($Window,[int]$Index){
    for($i=0;$i -lt 6;$i++){
        $window.FindName('StepText'+$i).Foreground=[Windows.Media.BrushConverter]::new().ConvertFromString($(if($i -le $Index){'#DFF7EB'}else{'#AABDB9'}))
        $window.FindName('StepShell'+$i).Background=[Windows.Media.BrushConverter]::new().ConvertFromString($(if($i -eq $Index){'#345447'}else{'#1C302B'}))
    }
}
