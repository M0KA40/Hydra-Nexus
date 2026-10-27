param([Parameter(Mandatory=$true)][string]$JobFile,[switch]$RenderOnly,[string]$RenderFile,[string]$RenderPhase='installing',[string]$AnimationProbeFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
$job=Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8|ConvertFrom-Json
$dir=Split-Path -Parent ([IO.Path]::GetFullPath($JobFile))
if($job.schema -ne 2 -or $job.id -notmatch '^[a-f0-9]{32}$' -or $job.token -notmatch '^[a-f0-9]{64}$' -or (Split-Path -Leaf $dir) -cne ('job-'+$job.id)){throw 'Invalid update presentation job'}
$copy=$job.presentation
if(!$copy -or @($copy.steps).Count -ne 6){throw 'Missing update presentation'}
$script:phase='preparing';$script:step=0;$script:finished=$false;$script:successAt=$null;$script:installedAt=$null;$script:tick=0;$presentationStarted=[DateTime]::UtcNow
[xml]$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Width="720" MinHeight="410" MaxHeight="640" SizeToContent="Height" WindowStyle="None" AllowsTransparency="True" Background="Transparent" ResizeMode="NoResize" WindowStartupLocation="CenterScreen" Title="Hydra Nexus" FontFamily="Segoe UI" UseLayoutRounding="True" TextOptions.TextFormattingMode="Display" TextOptions.TextRenderingMode="ClearType">
 <Window.Resources>
  <Style x:Key="Chrome" TargetType="Button"><Setter Property="Foreground" Value="#9AAFB5"/><Setter Property="Background" Value="Transparent"/><Setter Property="Width" Value="30"/><Setter Property="Height" Value="30"/><Setter Property="Cursor" Value="Hand"/>
   <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="Shell" Background="{TemplateBinding Background}" CornerRadius="8"><ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Shell" Property="Background" Value="#24343B"/><Setter Property="Foreground" Value="#ECFFF7"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value=".22"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter>
  </Style>
  <Style x:Key="ActionButton" TargetType="Button"><Setter Property="Background" Value="#17392F"/><Setter Property="Foreground" Value="#A5F9D9"/><Setter Property="Padding" Value="24,10"/><Setter Property="FontWeight" Value="SemiBold"/><Setter Property="FontSize" Value="12"/><Setter Property="Cursor" Value="Hand"/><Setter Property="MinWidth" Value="108"/>
   <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="Shell" Background="{TemplateBinding Background}" CornerRadius="9" BorderBrush="#30594C" BorderThickness="1" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Shell" Property="Background" Value="#235140"/></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Shell" Property="BorderBrush" Value="#A5F9D9"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value=".35"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter>
  </Style>
 </Window.Resources>
 <Border Margin="12" CornerRadius="18" BorderThickness="1" BorderBrush="#2B3E43">
  <Border.Effect><DropShadowEffect BlurRadius="22" ShadowDepth="3" Opacity=".48" Color="#000000"/></Border.Effect>
  <Border.Background><LinearGradientBrush StartPoint="0,0" EndPoint="1,1"><GradientStop Color="#152329" Offset="0"/><GradientStop Color="#0D151B" Offset=".6"/><GradientStop Color="#101D20" Offset="1"/></LinearGradientBrush></Border.Background>
  <Grid Margin="28,24,28,24">
   <Grid.RowDefinitions><RowDefinition Height="36"/><RowDefinition Height="24"/><RowDefinition Height="Auto"/><RowDefinition Height="24"/><RowDefinition Height="138"/><RowDefinition Height="22"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
   <Grid Grid.Row="0" FlowDirection="LeftToRight"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="18"/><ColumnDefinition Width="Auto"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
    <StackPanel x:Name="DragArea" Orientation="Horizontal" Background="Transparent" VerticalAlignment="Center"><Image x:Name="Logo" Width="30" Height="30" Margin="0,0,12,0"/><TextBlock Text="HYDRA NEXUS" Foreground="#E8F6F2" FontSize="14" FontWeight="SemiBold" VerticalAlignment="Center"/></StackPanel>
    <Border Grid.Column="1" Padding="10,5" CornerRadius="7" Background="#1B2C31" BorderBrush="#2B4145" BorderThickness="1" VerticalAlignment="Center"><TextBlock x:Name="Version" Foreground="#92A9AE" FontSize="10"/></Border>
    <Button Grid.Column="3" x:Name="Minimize" Style="{StaticResource Chrome}"><Path Stroke="{Binding Foreground,RelativeSource={RelativeSource AncestorType=Button}}" StrokeThickness="1.3" Data="M0,5 L10,5"/></Button>
    <Button Grid.Column="4" x:Name="Dismiss" Style="{StaticResource Chrome}"><Path Stroke="{Binding Foreground,RelativeSource={RelativeSource AncestorType=Button}}" StrokeThickness="1.3" Data="M0,0 L8,8 M8,0 L0,8"/></Button>
   </Grid>
   <StackPanel Grid.Row="2"><TextBlock x:Name="Title" FontSize="27" FontWeight="SemiBold" Foreground="#F1F9F7" TextWrapping="Wrap"/><TextBlock x:Name="Hint" Margin="0,10,0,0" FontSize="13" Foreground="#9AAFB6" TextWrapping="Wrap" LineHeight="21"/></StackPanel>
   <Border Grid.Row="4" CornerRadius="12" Background="#111F25" BorderBrush="#253B40" BorderThickness="1" Padding="20,18">
    <Grid><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="20"/><RowDefinition Height="8"/><RowDefinition Height="18"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
     <Grid Grid.Row="0"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions><TextBlock x:Name="Status" Foreground="#E2F2EC" FontSize="15" FontWeight="SemiBold" VerticalAlignment="Center" TextWrapping="Wrap" Margin="0,0,12,0"/><Border Grid.Column="1" CornerRadius="6" Background="#203A37" Padding="9,5"><TextBlock x:Name="Step" Foreground="#A4F0D3" FontSize="10" FontFamily="Consolas" FlowDirection="LeftToRight"/></Border></Grid>
     <Border Grid.Row="2" Background="#25363B" CornerRadius="4"><Canvas x:Name="Track" ClipToBounds="True" Height="8"><Rectangle x:Name="Bar" Width="210" Height="8" RadiusX="4" RadiusY="4"><Rectangle.Fill><LinearGradientBrush StartPoint="0,0" EndPoint="1,0"><GradientStop Color="#004FB9A0" Offset="0"/><GradientStop Color="#4BC7AD" Offset=".25"/><GradientStop Color="#BEFFE4" Offset=".7"/><GradientStop Color="#0065DBBB" Offset="1"/></LinearGradientBrush></Rectangle.Fill><Rectangle.RenderTransform><TranslateTransform x:Name="Motion" X="-210"/></Rectangle.RenderTransform></Rectangle></Canvas></Border>
     <Grid Grid.Row="4"><Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions><Ellipse Visibility="Collapsed" Width="5" Height="5" Fill="#8FE6C7" Margin="0,0,8,0" VerticalAlignment="Center"/><TextBlock Visibility="Collapsed" x:Name="SmallStatus" Grid.Column="1" Foreground="#839AA1" FontSize="11" TextWrapping="Wrap"/><TextBlock x:Name="Elapsed" Grid.Column="2" Foreground="#759097" FontSize="11" FontFamily="Consolas" FlowDirection="LeftToRight" Margin="12,0,0,0" VerticalAlignment="Center"/></Grid>
    </Grid>
   </Border>
   <Grid Grid.Row="6"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="16"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions><TextBlock x:Name="Footer" Foreground="#7F969F" FontSize="11" TextWrapping="Wrap" VerticalAlignment="Center" MaxHeight="42" TextTrimming="CharacterEllipsis"/><Button Grid.Column="2" x:Name="Action" Style="{StaticResource ActionButton}" VerticalAlignment="Center"/></Grid>
  </Grid>
 </Border>
</Window>
'@
$reader=New-Object Xml.XmlNodeReader($xaml);$form=[Windows.Markup.XamlReader]::Load($reader)
$title=$form.FindName('Title');$hint=$form.FindName('Hint');$status=$form.FindName('Status');$stepLabel=$form.FindName('Step');$footer=$form.FindName('Footer');$button=$form.FindName('Action');$dismiss=$form.FindName('Dismiss');$small=$form.FindName('SmallStatus');$bar=$form.FindName('Bar');$motion=$form.FindName('Motion');$elapsed=$form.FindName('Elapsed');$track=$form.FindName('Track')
$form.FindName('Version').Text='v'+$job.version+'  /  r'+$job.revision
$title.Text=$copy.title;$hint.Text=$copy.wait;$footer.Text='';$small.Text='';$button.Content=$copy.cancel
[Windows.Automation.AutomationProperties]::SetName($form,$copy.title);[Windows.Automation.AutomationProperties]::SetName($button,$copy.cancel);[Windows.Automation.AutomationProperties]::SetName($dismiss,$copy.close)
if($copy.direction -eq 'rtl'){$form.FlowDirection='RightToLeft';$form.FindName('DragArea').FlowDirection='LeftToRight';$form.FindName('Version').FlowDirection='LeftToRight'}
$form.FindName('DragArea').Add_MouseLeftButtonDown({param($sender,$event) if($event.ChangedButton -eq 'Left'){$form.DragMove()}})
[Windows.Automation.AutomationProperties]::SetName($form.FindName('Minimize'),$copy.minimize)
$form.FindName('Minimize').Add_Click({$form.WindowState='Minimized'})
$logoData='__NEXUS_PROGRESS_LOGO__'
if($logoData -notlike '__NEXUS_*'){$stream=New-Object IO.MemoryStream(,[Convert]::FromBase64String($logoData));$image=New-Object Windows.Media.Imaging.BitmapImage;$image.BeginInit();$image.CacheOption='OnLoad';$image.StreamSource=$stream;$image.EndInit();$image.Freeze();$form.FindName('Logo').Source=$image;$stream.Dispose()}
$animation=New-Object Windows.Media.Animation.DoubleAnimation;$animation.From=-210;$animation.To=620;$animation.Duration=New-Object Windows.Duration([TimeSpan]::FromSeconds(1.9));$animation.RepeatBehavior=[Windows.Media.Animation.RepeatBehavior]::Forever
$easing=New-Object Windows.Media.Animation.SineEase;$easing.EasingMode='EaseInOut';$animation.EasingFunction=$easing
function Finish-Presentation([string]$Heading,[string]$Detail,[bool]$Success=$false){
  $script:finished=$true;$title.Text=$Heading;$hint.Text=$Detail;$footer.Text='';$button.Content=$copy.close;$button.IsEnabled=$true;$button.Visibility='Visible';$dismiss.IsEnabled=$true;$small.Text=$Heading
  [Windows.Automation.AutomationProperties]::SetName($button,$copy.close)
  $motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$motion.X=0;$bar.Width=$track.ActualWidth
  $bar.Fill=New-Object Windows.Media.SolidColorBrush([Windows.Media.ColorConverter]::ConvertFromString($(if($Success){'#91EBCB'}else{'#EDB887'})))
}
function Show-Phase([string]$Phase){
  $script:phase=$Phase;$next=switch($Phase){'ready'{1};'waiting'{1};'backing-up'{2};'installing'{3};'verifying'{4};'restarting'{5};'installed'{5};default{0}};$script:step=[Math]::Max($script:step,$next)
  $status.Text=$copy.steps[$script:step];$stepLabel.Text=('{0:00} / 06' -f ($script:step+1));$small.Text=''
  $canCancel=$Phase -in @('preparing','ready') -and !(Test-Path -LiteralPath (Join-Path $dir 'approved'))
  $button.IsEnabled=$canCancel;$button.Visibility=if($canCancel){'Visible'}else{'Collapsed'};$dismiss.IsEnabled=$canCancel
}
function Request-Close {
  if($script:finished){$form.Close();return}
  if($script:phase -in @('preparing','ready') -and !(Test-Path -LiteralPath (Join-Path $dir 'approved'))){[IO.File]::WriteAllText((Join-Path $dir 'cancel'),$job.token);$button.IsEnabled=$false;$dismiss.IsEnabled=$false}
}
$button.Add_Click({Request-Close});$dismiss.Add_Click({Request-Close})
$form.Add_KeyDown({param($sender,$event) if($event.Key -eq 'Escape'){Request-Close;$event.Handled=$true}})
$form.Add_Closing({param($sender,$event) if(!$script:finished -and !$RenderOnly){$event.Cancel=$true}})
$timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(200)
$timer.Add_Tick({
  try{
    $duration=[DateTime]::UtcNow-$presentationStarted;$elapsed.Text=('{0:00}:{1:00}' -f [Math]::Floor($duration.TotalMinutes),$duration.Seconds)
    if($script:successAt -and [DateTime]::UtcNow -ge $script:successAt){$form.Close();return}
    if($script:finished){return}
    if(Test-Path -LiteralPath (Join-Path $dir 'approved')){$button.IsEnabled=$false;$dismiss.IsEnabled=$false}
    $stateFile=Join-Path $dir 'state.json'
    if(!(Test-Path -LiteralPath $stateFile)){if([DateTime]::UtcNow -gt $presentationStarted.AddSeconds(25)){Finish-Presentation $copy.attention $copy.attention};return}
    try{$state=Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8|ConvertFrom-Json}catch{return}
    if($state.schema -ne 2 -or $state.id -cne $job.id -or $state.token -cne $job.token){return}
    Show-Phase $state.phase
    if($state.phase -eq 'failed'){
      $detail=$copy.attention;if($state.message -like '*Previous installation restored.*'){$detail=$copy.restored}
      if((Test-Path -LiteralPath (Join-Path $dir 'cancel')) -and !(Test-Path -LiteralPath (Join-Path $dir 'approved'))){$detail=$copy.cancelled}
      Finish-Presentation $copy.attention $detail;$footer.Text=$state.message;$footer.ToolTip=$state.message;return
    }
    if($state.phase -eq 'installed'){
      if(!$script:installedAt){$script:installedAt=[DateTime]::UtcNow}
      $confirmation=Join-Path $dir 'startup-confirmed.json'
      if(Test-Path -LiteralPath $confirmation){
        try{$ready=Get-Content -LiteralPath $confirmation -Raw -Encoding UTF8|ConvertFrom-Json}catch{return}
        if($ready.schema -eq 1 -and $ready.id -ceq $job.id -and $ready.version -ceq $job.version -and $ready.revision -eq $job.revision){Finish-Presentation $copy.success $copy.ready $true;$script:successAt=[DateTime]::UtcNow.AddMilliseconds(1200);return}
      }
      if([DateTime]::UtcNow -gt $script:installedAt.AddSeconds(90)){Finish-Presentation $copy.attention $copy.unconfirmed};return
    }
    if($state.workerPid){try{$worker=[Diagnostics.Process]::GetProcessById([int]$state.workerPid);if($worker.HasExited){Finish-Presentation $copy.attention $copy.attention}}catch{Finish-Presentation $copy.attention $copy.attention}}
  }catch{Finish-Presentation $copy.attention $copy.attention}
})
$form.Add_ContentRendered({
  if(!$RenderOnly){
    $ready=@{schema=1;id=$job.id;token=$job.token;pid=$PID}|ConvertTo-Json -Compress
    [IO.File]::WriteAllText((Join-Path $dir 'progress-ready.json'),$ready,[Text.UTF8Encoding]::new($false));$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation);$timer.Start()
  }
})
Show-Phase 'preparing'
try{
  if($RenderOnly){
    $form.WindowStartupLocation='Manual';$form.Left=-10000;$form.Top=-10000;$form.ShowInTaskbar=$false;$form.Show();Show-Phase $RenderPhase;$motion.X=170;$elapsed.Text='00:08'
    if($AnimationProbeFile){
      $motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation)
      $positions=@($motion.X)
      for($sample=0;$sample -lt 2;$sample++){
        $frame=New-Object Windows.Threading.DispatcherFrame;$probeTimer=New-Object Windows.Threading.DispatcherTimer;$probeTimer.Interval=[TimeSpan]::FromMilliseconds(250)
        $probeTimer.Add_Tick({$probeTimer.Stop();$frame.Continue=$false});$probeTimer.Start();[Windows.Threading.Dispatcher]::PushFrame($frame);$positions+= $motion.X
      }
      [IO.File]::WriteAllText([IO.Path]::GetFullPath($AnimationProbeFile),(@{positions=$positions;systemAnimations=[Windows.SystemParameters]::ClientAreaAnimation}|ConvertTo-Json -Compress))
      $motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$motion.X=170
    }
    if($RenderPhase -eq 'failed'){Finish-Presentation $copy.attention $copy.restored}
    if($RenderPhase -eq 'complete'){Finish-Presentation $copy.success $copy.ready $true}
    $form.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$form.ActualWidth,[int]$form.ActualHeight,96,96,[Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($form)
    $encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder;$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$output=[IO.File]::Create([IO.Path]::GetFullPath($RenderFile));try{$encoder.Save($output)}finally{$output.Dispose()};$script:finished=$true;$form.Close()
  }else{$null=$form.ShowDialog()}
}finally{$timer.Stop();if($form.IsVisible){$script:finished=$true;$form.Close()}}
