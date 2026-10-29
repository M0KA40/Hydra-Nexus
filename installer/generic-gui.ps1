# Generic adapter: the BAT owns all prompts and operations. No Nexus engine calls.
$ErrorActionPreference='Stop'
# __NEXUS_SHARED_SURFACE__
$config=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'wrapper.json') -Raw -Encoding UTF8|ConvertFrom-Json
$catalog=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'setup-copy.json') -Raw -Encoding UTF8|ConvertFrom-Json
$language=[Globalization.CultureInfo]::CurrentUICulture.Name
if(!$catalog.$language){$language=$language.Split('-')[0]};if(!$catalog.$language){$language='en'}
$copy=$catalog.$language
$badge=if($config.version){'v'+$config.version}else{''}
if($config.version -and $config.revision){$badge+=' / r'+$config.revision}
$form=New-NexusSurface $copy $badge
if(!$badge){$form.FindName('Version').Parent.Visibility='Collapsed'}
$form.Title=$config.name;$form.FindName('Title').Text=$config.name
$form.FindName('Eyebrow').Text=$copy.operation
$form.FindName('Hint').Text=$copy.genericHint
$form.FindName('Status').Text=$config.engine
$form.FindName('Step').Visibility='Collapsed';$form.FindName('Steps').Visibility='Collapsed'
$form.FindName('SmallStatus').Text=$copy.genericReady
$form.FindName('Safety').Text='SHA-256';$form.FindName('DetailText').Text=$config.sha256
$form.FindName('Bar').Visibility='Collapsed';$form.FindName('Action').Content=$copy.run
$script:running=$false;$script:child=$null;$script:exitCode=0
$script:started=$null
$animation=New-Object Windows.Media.Animation.DoubleAnimation;$animation.From=-210;$animation.To=800;$animation.Duration=[Windows.Duration]::new([TimeSpan]::FromSeconds(1.6));$animation.RepeatBehavior=[Windows.Media.Animation.RepeatBehavior]::Forever
$form.FindName('Action').Add_Click({
 if($script:running){return}
 try{
  $file=Join-Path (Join-Path $PSScriptRoot 'payload') $config.engine
  $algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($file)
  try{$hash=[BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$algorithm.Dispose()}
  if($hash -cne $config.sha256){throw 'BAT checksum changed. Reopen the EXE.'}
  # Interactive BATs need their original console for choice, pause, set /p etc.
  # ShellExecute preserves that behavior; no invented progress or parsed commands.
  $launch=New-Object Diagnostics.ProcessStartInfo;$launch.FileName=$file;$launch.WorkingDirectory=Split-Path -Parent $file;$launch.UseShellExecute=$true;$launch.WindowStyle='Normal'
  $script:child=[Diagnostics.Process]::Start($launch);$script:running=$true;$script:started=[DateTime]::UtcNow
  $form.FindName('Action').IsEnabled=$false;$form.FindName('Dismiss').IsEnabled=$false;$form.FindName('SmallStatus').Text=$copy.genericRunning
  $form.FindName('Bar').Visibility='Visible';$form.FindName('Motion').BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$animation)
 }catch{$form.FindName('Footer').Text=$_.Exception.Message;$script:exitCode=1}
})
$form.FindName('Dismiss').Add_Click({if(!$script:running){$form.Close()}})
$form.Add_Closing({param($s,$e) if($script:running){$e.Cancel=$true}})
$form.Add_KeyDown({param($s,$e) if($e.Key -eq 'Escape' -and !$script:running){$s.Close()}})
$timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(200)
$timer.Add_Tick({
 if(!$script:running){return}
 $duration=[DateTime]::UtcNow-$script:started;$form.FindName('Elapsed').Text=('{0:00}:{1:00}' -f [Math]::Floor($duration.TotalMinutes),$duration.Seconds)
 if($script:child.HasExited){
  $script:exitCode=$script:child.ExitCode;$script:running=$false;$form.FindName('Action').IsEnabled=$true;$form.FindName('Dismiss').IsEnabled=$true
  $form.FindName('Motion').BeginAnimation([Windows.Media.TranslateTransform]::XProperty,$null);$form.FindName('Bar').Visibility='Collapsed'
  $form.FindName('Status').Text=if($script:exitCode -eq 0){$copy.genericComplete}else{$copy.attention}
  $form.FindName('SmallStatus').Text=$copy.exitCode+': '+$script:exitCode
 }
})
try{$timer.Start();$null=$form.ShowDialog()}finally{$timer.Stop()}
exit $script:exitCode
