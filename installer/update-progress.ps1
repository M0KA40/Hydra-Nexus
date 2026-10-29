param([Parameter(Mandatory=$true)][string]$JobFile,[switch]$RenderOnly,[string]$RenderFile,[string]$RenderPhase='installing',[string]$AnimationProbeFile,[switch]$PreviewOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
$job=Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8|ConvertFrom-Json
$dir=Split-Path -Parent ([IO.Path]::GetFullPath($JobFile))
if($job.schema -ne 2 -or $job.id -notmatch '^[a-f0-9]{32}$' -or $job.token -notmatch '^[a-f0-9]{64}$' -or (Split-Path -Leaf $dir) -cne ('job-'+$job.id)){throw 'Invalid update presentation job'}
$copy=$job.presentation
if(!$copy -or @($copy.steps).Count -ne 6){throw 'Missing update presentation'}
$script:phase='preparing';$script:step=0;$script:finished=$false;$script:successAt=$null;$script:installedAt=$null;$script:tick=0;$presentationStarted=[DateTime]::UtcNow
# __NEXUS_SHARED_SURFACE__
if(!(Get-Command New-NexusSurface -ErrorAction SilentlyContinue)){. (Join-Path $PSScriptRoot 'setup-surface.ps1')}
$form=New-NexusSurface $copy ('v'+$job.version+' / r'+$job.revision)
$title=$form.FindName('Title');$hint=$form.FindName('Hint');$status=$form.FindName('Status');$stepLabel=$form.FindName('Step');$footer=$form.FindName('Footer');$button=$form.FindName('Action');$dismiss=$form.FindName('Dismiss');$small=$form.FindName('SmallStatus');$bar=$form.FindName('Bar');$motion=$form.FindName('Motion');$elapsed=$form.FindName('Elapsed');$track=$form.FindName('Track')
$form.FindName('Version').Text='v'+$job.version+'  /  r'+$job.revision
$title.Text=$copy.title;$hint.Text=$copy.wait;$footer.Text='';$small.Text=$copy.activity;$button.Content=$copy.cancel
[Windows.Automation.AutomationProperties]::SetName($form,$copy.title);[Windows.Automation.AutomationProperties]::SetName($button,$copy.cancel);[Windows.Automation.AutomationProperties]::SetName($dismiss,$copy.close)
if($copy.direction -eq 'rtl'){$form.FlowDirection='RightToLeft';$form.FindName('DragArea').FlowDirection='LeftToRight';$form.FindName('Version').FlowDirection='LeftToRight'}
$animation=New-Object Windows.Media.Animation.DoubleAnimation;$animation.From=-210;$animation.To=620;$animation.Duration=New-Object Windows.Duration([TimeSpan]::FromSeconds(1.9));$animation.RepeatBehavior=[Windows.Media.Animation.RepeatBehavior]::Forever
# Linear activity motion; this is not a percentage or time estimate.
function Finish-Presentation([string]$Heading,[string]$Detail,[bool]$Success=$false){
  $script:finished=$true;$title.Text=$Heading;$hint.Text=$Detail;$footer.Text='';$button.Content=$copy.close;$button.IsEnabled=$true;$button.Visibility='Visible';$dismiss.IsEnabled=$true;$small.Text=$Heading
  [Windows.Automation.AutomationProperties]::SetName($button,$copy.close)
  $motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$motion.X=0;$bar.Width=$track.ActualWidth;$bar.Visibility=if($Success){'Visible'}else{'Collapsed'}
  $status.Text=$Heading;$small.Text=$Detail
  if($Success){Set-NexusSurfaceStage $form 5}
  $bar.Fill=New-Object Windows.Media.SolidColorBrush([Windows.Media.ColorConverter]::ConvertFromString($(if($Success){'#91EBCB'}else{'#EDB887'})))
}
function Show-Phase([string]$Phase){
  $script:phase=$Phase;$next=switch($Phase){'ready'{1};'waiting'{1};'backing-up'{2};'installing'{3};'verifying'{4};'restarting'{5};'installed'{5};default{0}};$script:step=[Math]::Max($script:step,$next)
  Set-NexusSurfaceStage $form $script:step
  $status.Text=$copy.steps[$script:step];$stepLabel.Text=('{0:00} / 06' -f ($script:step+1));$small.Text=$copy.activity
  $canCancel=$Phase -in @('preparing','ready') -and !(Test-Path -LiteralPath (Join-Path $dir 'approved'))
  $button.IsEnabled=$canCancel;$button.Visibility=if($canCancel){'Visible'}else{'Collapsed'};$dismiss.IsEnabled=$canCancel
}
function Request-Close {
  if($PreviewOnly){$script:finished=$true;$form.Close();return}
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
    if($PreviewOnly){return}
    if($script:successAt -and [DateTime]::UtcNow -ge $script:successAt){$form.Close();return}
    if($script:finished){return}
    if(Test-Path -LiteralPath (Join-Path $dir 'approved')){$button.IsEnabled=$false;$dismiss.IsEnabled=$false}
    $stateFile=Join-Path $dir 'state.json'
    if(!(Test-Path -LiteralPath $stateFile)){if([DateTime]::UtcNow -gt $presentationStarted.AddSeconds(25)){Finish-Presentation $copy.attention $copy.attention};return}
    try{$state=Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8|ConvertFrom-Json}catch{return}
    if($state.schema -ne 2 -or $state.id -cne $job.id -or $state.token -cne $job.token){return}
    Show-Phase $state.phase
    if($state.total -gt 0 -and $state.completed -ge 0 -and $state.completed -le $state.total){
      $motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$motion.X=0
      $bar.Width=$track.ActualWidth*([double]$state.completed/[double]$state.total)
      $small.Text=$copy.bytes.Replace('{done}',('{0:N1}' -f ($state.completed/1MB))).Replace('{total}',('{0:N1}' -f ($state.total/1MB)))
    }else{
      if($script:measured){$bar.Width=210;$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation)}
    }
    $script:measured=($state.total -gt 0)
    $form.FindName('DetailText').Text=$copy.log+': '+$dir+"`r`n"+$state.message
    if($state.phase -eq 'failed'){
      $detail=$copy.attention;if($state.message -like '*Previous installation restored.*'){$detail=$copy.restored}
      if((Test-Path -LiteralPath (Join-Path $dir 'cancel')) -and !(Test-Path -LiteralPath (Join-Path $dir 'approved'))){$detail=$copy.cancelled}
      Finish-Presentation $copy.attention $detail;$footer.Text=$copy.attention;$footer.ToolTip=$state.message;$form.FindName('Details').Visibility='Visible';return
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
  if($PreviewOnly){$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation);$timer.Start()}
  elseif(!$RenderOnly){
    $ready=@{schema=1;id=$job.id;token=$job.token;pid=$PID}|ConvertTo-Json -Compress
    [IO.File]::WriteAllText((Join-Path $dir 'progress-ready.json'),$ready,[Text.UTF8Encoding]::new($false));$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation);$timer.Start()
  }
})
Show-Phase 'preparing'
if($PreviewOnly){Show-Phase 'installing';$hint.Text=$copy.preview;$button.Content=$copy.close;$button.IsEnabled=$true;$button.Visibility='Visible';$dismiss.IsEnabled=$true}
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
    $form.UpdateLayout();$renderFrame=New-Object Windows.Threading.DispatcherFrame;$renderTimer=New-Object Windows.Threading.DispatcherTimer;$renderTimer.Interval=[TimeSpan]::FromMilliseconds(80);$renderTimer.Add_Tick({$renderTimer.Stop();$renderFrame.Continue=$false});$renderTimer.Start();[Windows.Threading.Dispatcher]::PushFrame($renderFrame);$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$form.ActualWidth,[int]$form.ActualHeight,96,96,[Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($form)
    $encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder;$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$output=[IO.File]::Create([IO.Path]::GetFullPath($RenderFile));try{$encoder.Save($output)}finally{$output.Dispose()};$script:finished=$true;$form.Close()
  }else{$null=$form.ShowDialog()}
}finally{$timer.Stop();if($form.IsVisible){$script:finished=$true;$form.Close()}}
