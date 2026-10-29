param([switch]$PreviewOnly,[switch]$RenderOnly,[string]$RenderFile,[string]$Language,[string]$RenderPhase='ready')
$ErrorActionPreference='Stop'
# __NEXUS_SHARED_SURFACE__
if(!(Get-Command New-NexusSurface -ErrorAction SilentlyContinue)){. (Join-Path $PSScriptRoot 'setup-surface.ps1')}
$catalog=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'setup-copy.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(!$Language){$Language=[Globalization.CultureInfo]::CurrentUICulture.Name}
if(!$catalog.$Language){$Language=$Language.Split('-')[0]};if(!$catalog.$Language){$Language='en'}
$copy=$catalog.$Language
$form=New-NexusSurface $copy '__NEXUS_SETUP_VERSION__'
$script:running=$false;$script:child=$null;$script:job=$null;$script:started=$null;$script:exitCode=0
$title=$form.FindName('Title');$hint=$form.FindName('Hint');$status=$form.FindName('Status');$step=$form.FindName('Step');$footer=$form.FindName('Footer');$button=$form.FindName('Action');$folder=$form.FindName('Folder');$operation=$form.FindName('Operation');$dismiss=$form.FindName('Dismiss');$bar=$form.FindName('Bar');$track=$form.FindName('Track');$motion=$form.FindName('Motion')
$title.Text=$copy.setupTitle;$hint.Text=$copy.setupHint;$status.Text=$copy.select;$step.Text='01 / 06';$footer.Text='';$button.Content=$copy.install
$form.FindName('Eyebrow').Text=$copy.operation
$form.FindName('Steps').Visibility='Collapsed'
$form.FindName('SetupOptions').Visibility='Visible';$form.FindName('Details').Visibility='Collapsed'
$form.FindName('FolderLabel').Text=$copy.folder;$form.FindName('OperationLabel').Text=$copy.operation;$form.FindName('Browse').Content=$copy.browse
[Windows.Automation.AutomationProperties]::SetName($folder,$copy.folder)
[Windows.Automation.AutomationProperties]::SetName($operation,$copy.operation)
[void]$operation.Items.Add($copy.install);[void]$operation.Items.Add($copy.check);[void]$operation.Items.Add($copy.remove);$operation.SelectedIndex=0
$script:discovery=$null;$script:discoveryResult=$null
if(!$PreviewOnly -and !$RenderOnly){
    $script:discovery=[PowerShell]::Create()
    [void]$script:discovery.AddScript(([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'setup-detect.ps1'))+"`nFind-NexusHydra"))
    $script:discoveryResult=$script:discovery.BeginInvoke()
}
$bar.Visibility='Collapsed';$form.FindName('SmallStatus').Text=$copy.closeFirst
if($PreviewOnly){$hint.Text=$copy.preview;$folder.Text='C:\Preview\Hydra';$form.FindName('Browse').IsEnabled=$false}
$form.FindName('Browse').Add_Click({
    Add-Type -AssemblyName System.Windows.Forms
    $picker=New-Object Windows.Forms.FolderBrowserDialog;$picker.Description=$copy.folder;$picker.ShowNewFolderButton=$false
    try{if($picker.ShowDialog() -eq 'OK'){$folder.Text=$picker.SelectedPath}}finally{$picker.Dispose()}
})
$operation.Add_SelectionChanged({if(!$script:running){$button.Content=$operation.SelectedItem}})
$animation=New-Object Windows.Media.Animation.DoubleAnimation;$animation.From=-210;$animation.To=650;$animation.Duration=[Windows.Duration]::new([TimeSpan]::FromSeconds(1.4));$animation.RepeatBehavior=[Windows.Media.Animation.RepeatBehavior]::Forever
function Set-SetupBusy([bool]$Busy){
    $script:running=$Busy;$folder.IsEnabled=!$Busy;$operation.IsEnabled=!$Busy;$form.FindName('Browse').IsEnabled=(!$Busy -and !$PreviewOnly);$button.IsEnabled=!$Busy;$dismiss.IsEnabled=!$Busy
    if($Busy){$bar.Visibility='Visible';$bar.Width=210;$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation)}else{$motion.BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$bar.Visibility='Collapsed'}
}
function Start-SetupOperation {
    if($script:running){return}
    if($PreviewOnly){$status.Text=$copy.preview;$footer.Text='';return}
    $directory=$folder.Text.Trim().Trim('"')
    if(!$directory -or !(Test-Path -LiteralPath (Join-Path $directory 'Hydra.exe')) -or !(Test-Path -LiteralPath (Join-Path $directory 'resources/app.asar'))){$footer.Text=$copy.invalidFolder;$folder.Focus()|Out-Null;return}
    $action=@('Install','Status','Remove')[$operation.SelectedIndex]
    if($action -eq 'Remove'){
        $answer=[Windows.MessageBox]::Show($form,$copy.removeConfirm,$copy.remove,[Windows.MessageBoxButton]::YesNo,[Windows.MessageBoxImage]::Warning,[Windows.MessageBoxResult]::No)
        if($answer -ne 'Yes'){return}
    }
    try{
        $script:job=Join-Path $PSScriptRoot ('operation-'+[guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($script:job)|Out-Null
        $script:token=[guid]::NewGuid().ToString('N')
        $request=@{schema=1;token=$script:token;directory=$directory;action=$action;sha256='__NEXUS_ENGINE_SHA256__'}
        $file=Join-Path $script:job 'request.json';[IO.File]::WriteAllText($file,($request|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
        $powershell=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
        $script:child=Start-Process -WindowStyle Hidden -FilePath $powershell -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'setup-worker.ps1')+'"'),'-RequestFile',('"'+$file+'"')) -PassThru -RedirectStandardOutput (Join-Path $script:job 'startup.log') -RedirectStandardError (Join-Path $script:job 'errors.log')
        $script:started=[DateTime]::UtcNow;$footer.Text='';$status.Text=$copy.steps[0];$form.FindName('SmallStatus').Text=$copy.activity
        $form.FindName('Details').Visibility='Visible';$form.FindName('DetailText').Text=$copy.log+': '+$script:job
        $form.FindName('SetupOptions').Visibility='Collapsed';$form.FindName('Steps').Visibility=if($form.MaxHeight -lt 680){'Collapsed'}else{'Visible'}
        Set-SetupBusy $true
    }catch{Set-SetupBusy $false;$footer.Text=$_.Exception.Message;$script:exitCode=1}
}
$button.Add_Click({Start-SetupOperation})
$dismiss.Add_Click({if(!$script:running){$form.Close()}})
$form.Add_KeyDown({param($sender,$event) if($event.Key -eq 'Escape' -and !$script:running){$form.Close();$event.Handled=$true}})
$form.Add_Closing({param($sender,$event) if($script:running){$event.Cancel=$true}})
$timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(200)
$timer.Add_Tick({
    if($script:discoveryResult -and $script:discoveryResult.IsCompleted){
        try{$detected=@($script:discovery.EndInvoke($script:discoveryResult));if(!$folder.Text.Trim() -and $detected.Count -gt 0 -and $detected[0]){$folder.Text=[string]$detected[0];$status.Text=$copy.folder}}catch{}
        $script:discovery.Dispose();$script:discovery=$null;$script:discoveryResult=$null
    }
    if(!$script:running){return}
    $duration=[DateTime]::UtcNow-$script:started;$form.FindName('Elapsed').Text=('{0:00}:{1:00}' -f [Math]::Floor($duration.TotalMinutes),$duration.Seconds)
    try{
        $file=Join-Path $script:job 'state.json'
        $state=$null
        if(Test-Path -LiteralPath $file){try{$state=Get-Content -LiteralPath $file -Raw -Encoding UTF8|ConvertFrom-Json}catch{return}}
        if($state -and $state.token -ceq $script:token -and $state.schema -eq 1){
            $index=switch($state.phase){'preparing'{0};'backup'{2};'writing'{3};'verifying'{4};'committing'{4};'complete'{5};default{0}}
            $step.Text=('{0:00} / 06' -f ($index+1));$status.Text=$copy.steps[$index];Set-NexusSurfaceStage $form $index
            if($state.phase -in @('complete','status','failed')){
                Set-SetupBusy $false
                $form.FindName('SetupOptions').Visibility='Visible';$form.FindName('Steps').Visibility='Collapsed'
                if($state.phase -eq 'failed'){$title.Text=$copy.attention;$status.Text=$copy.attention;$footer.Text=$copy.attention;$script:exitCode=1;$form.FindName('Details').Visibility='Visible'}
                elseif($state.phase -eq 'status'){$status.Text=$copy.check;$footer.Text=$copy.attention}
                else{$title.Text=$copy.setupComplete;$status.Text=$copy.ready;$form.FindName('SmallStatus').Text=$copy.setupDone;$step.Text='06 / 06'}
                $form.FindName('Details').Visibility='Visible';$form.FindName('DetailText').Text=$copy.log+': '+$script:job+"`r`n"+$state.message
                $button.Content=$copy.retry
                return
            }
        }
        if($script:child.HasExited){Set-SetupBusy $false;$status.Text=$copy.attention;$footer.Text=$copy.workerStopped;$script:exitCode=1}
    }catch{Set-SetupBusy $false;$status.Text=$copy.attention;$footer.Text=$_.Exception.Message;$script:exitCode=1}
})
try{
    if($RenderOnly){
        $form.WindowStartupLocation='Manual';$form.Left=-10000;$form.Top=-10000;$form.ShowInTaskbar=$false;$form.Show()
        if($RenderPhase -eq 'installing'){$form.FindName('SetupOptions').Visibility='Collapsed';$form.FindName('Steps').Visibility=if($form.MaxHeight -lt 680){'Collapsed'}else{'Visible'};$status.Text=$copy.steps[3];$step.Text='04 / 06';Set-NexusSurfaceStage $form 3;$bar.Visibility='Visible';$motion.X=170;$button.IsEnabled=$false}
        $form.UpdateLayout();$renderFrame=New-Object Windows.Threading.DispatcherFrame;$renderTimer=New-Object Windows.Threading.DispatcherTimer;$renderTimer.Interval=[TimeSpan]::FromMilliseconds(80);$renderTimer.Add_Tick({$renderTimer.Stop();$renderFrame.Continue=$false});$renderTimer.Start();[Windows.Threading.Dispatcher]::PushFrame($renderFrame);$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$form.ActualWidth,[int]$form.ActualHeight,96,96,[Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($form);$encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder;$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$output=[IO.File]::Create([IO.Path]::GetFullPath($RenderFile));try{$encoder.Save($output)}finally{$output.Dispose()};$form.Close()
    }else{$timer.Start();$null=$form.ShowDialog()}
}finally{$timer.Stop();if($script:discovery){$script:discovery.Stop();$script:discovery.Dispose()}}
exit $script:exitCode
