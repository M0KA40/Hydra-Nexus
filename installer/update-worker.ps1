param([Parameter(Mandatory=$true)][string]$JobFile)
$ErrorActionPreference='Stop'
$nexusHeld=$false;$nexusMutex=$null;$nexusChanged=$false;$nexusApproved=$false;$nexusStarted=$false;$nexusBackup=$null
$nexusJobDir=Split-Path -Parent ([IO.Path]::GetFullPath($JobFile))
$nexusState=Join-Path $nexusJobDir 'state.json'
function Set-NexusState([string]$Phase,[string]$Message){
  $state=@{schema=2;id=$nexusJob.id;token=$nexusJob.token;workerPid=$PID;phase=$Phase;message=$Message;at=[DateTime]::UtcNow.ToString('o')}
  $temp=$nexusState+'.tmp';[IO.File]::WriteAllText($temp,($state|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  if(Test-Path -LiteralPath $nexusState){[IO.File]::Replace($temp,$nexusState,[System.Management.Automation.Language.NullString]::Value)}else{[IO.File]::Move($temp,$nexusState)}
  [IO.File]::WriteAllText((Join-Path (Split-Path -Parent $nexusJobDir) 'installation-status.txt'),$Message)
}
function Get-NexusHash([string]$File){$hash=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($File);try{return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$hash.Dispose()}}
function Test-NexusCancelled {return Test-Path -LiteralPath (Join-Path $nexusJobDir 'cancel')}
function Start-NexusPresentation {
  if($nexusJob.showProgress -ne $true){return}
  $scriptFile=Join-Path $nexusJobDir 'progress.ps1'
  if(!(Test-Path -LiteralPath $scriptFile)){throw 'Update presentation is missing. Hydra was kept open.'}
  $powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $ui=Start-Process -WindowStyle Hidden -FilePath $powershell -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',('"'+$scriptFile+'"'),'-JobFile',('"'+$JobFile+'"')) -RedirectStandardOutput (Join-Path $nexusJobDir 'progress.log') -RedirectStandardError (Join-Path $nexusJobDir 'progress-errors.log') -PassThru
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  while([DateTime]::UtcNow -lt $deadline){
    if(Test-NexusCancelled){throw 'Update cancelled before installation.'}
    $readyFile=Join-Path $nexusJobDir 'progress-ready.json'
    if(Test-Path -LiteralPath $readyFile){try{$ready=Get-Content -LiteralPath $readyFile -Raw|ConvertFrom-Json;if($ready.schema -eq 1 -and $ready.id -ceq $nexusJob.id -and $ready.token -ceq $nexusJob.token -and $ready.pid -eq $ui.Id){return}}catch{}}
    if($ui.HasExited){throw 'The update window could not open. Hydra was kept open.'}
    Start-Sleep -Milliseconds 100
  }
  throw 'The update window did not become ready. Hydra was kept open.'
}
function Assert-NexusUnlocked {
  # Match the installer's own process exclusion, including manually reopened apps.
  if(@(Get-Process -Name $nexusJob.processNames -ErrorAction SilentlyContinue).Count){throw 'Hydra is still running. Nothing was installed.'}
  foreach($file in @($nexusJob.exe,$nexusArchive)){
    $stream=$null
    try{$stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}finally{if($stream){$stream.Dispose()}}
  }
}
function Wait-NexusUnlocked([int]$TimeoutMilliseconds=20000,[bool]$AllowCancel=$true,[bool]$WaitForProcesses=$false){
  $deadline=[DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  while($true){
    if($AllowCancel -and (Test-NexusCancelled)){throw 'Update cancelled before installation.'}
    try{Assert-NexusUnlocked;return}catch{
      $cause=$_.Exception;while($cause.InnerException){$cause=$cause.InnerException}
      # Backup/hash reads can trigger a short-lived scanner or indexer handle.
      # Retry sharing/lock violations only; permission, missing-file and live-app
      # errors remain immediate failures. Never bypass exclusive-access checks.
      $code=$cause.HResult -band 65535
      $sharing=($cause -is [IO.IOException]) -and $code -in @(32,33)
      $closing=$WaitForProcesses -and $cause.Message -eq 'Hydra is still running. Nothing was installed.'
      if((!$sharing -and !$closing) -or [DateTime]::UtcNow -ge $deadline){throw}
      Start-Sleep -Milliseconds 200
    }
  }
}
function Restore-NexusFiles {
  foreach($item in @(@('app.asar',$nexusArchive),@('Hydra.exe',$nexusJob.exe))){
    $saved=Join-Path $nexusBackup $item[0]
    if((Get-NexusHash $saved) -ceq (Get-NexusHash $item[1])){continue}
    $temp=$item[1]+'.nexus-restore-'+[guid]::NewGuid().ToString('N');[IO.File]::Copy($saved,$temp,$false)
    [IO.File]::Replace($temp,$item[1],[System.Management.Automation.Language.NullString]::Value)
    if((Get-NexusHash $saved) -cne (Get-NexusHash $item[1])){throw 'Recovery verification failed'}
  }
}
function Start-NexusOnce {
  if($nexusStarted){return}
  # Persist the launch intent before starting the executable; no retry loop can
  # open several windows. A manual reopen wins over the helper's relaunch.
  if(@(Get-Process -Name $nexusJob.processNames -ErrorAction SilentlyContinue).Count){return}
  [IO.File]::WriteAllText((Join-Path $nexusJobDir 'launch-once'),'1')
  Start-Process -FilePath $nexusJob.exe -WorkingDirectory (Split-Path -Parent $nexusJob.exe) -WindowStyle Hidden -ErrorAction Stop
  $nexusStarted=$true
}
try{
  $nexusJob=Get-Content -LiteralPath $JobFile -Raw|ConvertFrom-Json
  if($nexusJob.schema -ne 2 -or $nexusJob.id -notmatch '^[a-f0-9]{32}$' -or $nexusJob.token -notmatch '^[a-f0-9]{64}$' -or $nexusJob.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid update job'}
  if((Split-Path -Leaf $nexusJobDir) -cne ('job-'+$nexusJob.id)){throw 'Invalid update job directory'}
  if([IO.Path]::GetFullPath($nexusJob.installer) -cne (Join-Path (Split-Path -Parent $nexusJobDir) ([IO.Path]::GetFileName($nexusJob.installer)))){throw 'Invalid staged installer location'}
  if((Get-NexusHash $nexusJob.installer) -cne $nexusJob.sha256){throw 'Installer checksum changed'}
  $nexusArchive=Join-Path (Join-Path (Split-Path -Parent $nexusJob.exe) 'resources') 'app.asar'
  if(!(Test-Path -LiteralPath $nexusArchive)){throw 'Hydra archive is missing'}
  $nexusMutex=New-Object Threading.Mutex($false,'Local\HydraNexusInstallV1')
  try{$nexusHeld=$nexusMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$nexusHeld=$true}
  if(!$nexusHeld){throw 'Another installer is active. Retry after it finishes.'}
  $nexusParent=[Diagnostics.Process]::GetProcessById([int]$nexusJob.parentPid)
  # Holding this Process object prevents PID reuse from approving another app.
  $null=$nexusParent.Handle
  if($nexusParent.MainModule.FileName -ine $nexusJob.parentExe){throw 'Update parent identity changed'}
  if(Test-NexusCancelled){throw 'Update cancelled before installation.'}
  Start-NexusPresentation
  Set-NexusState 'ready' 'Update helper is ready. Saving your work before restarting.'
  $deadline=[DateTime]::UtcNow.AddSeconds(90)
  while($true){
    if(Test-NexusCancelled){throw 'Update cancelled before installation.'}
    $approval=Join-Path $nexusJobDir 'approved'
    if((Test-Path -LiteralPath $approval) -and [IO.File]::ReadAllText($approval) -ceq $nexusJob.token){$nexusApproved=$true;break}
    if($nexusParent.HasExited){throw 'Hydra closed before approving this update. Nothing was installed.'}
    if([DateTime]::UtcNow -ge $deadline){throw 'Update approval expired. Nothing was installed.'}
    Start-Sleep -Milliseconds 100
  }
  Set-NexusState 'waiting' 'Waiting for Hydra to close before installing.'
  if(!$nexusParent.WaitForExit(30000)){throw 'Hydra did not close. Nothing was installed.'}
  Wait-NexusUnlocked -WaitForProcesses $true
  if((Get-NexusHash $nexusJob.installer) -cne $nexusJob.sha256){throw 'Installer checksum changed'}
  Set-NexusState 'backing-up' 'Preparing the verified installer and recovery copy…'
  $env:HYDRA_SUITE_SELF=$nexusJob.installer
  $lines=[IO.File]::ReadAllLines($nexusJob.installer,[Text.Encoding]::UTF8);$marker=[Array]::IndexOf($lines,':: === HYDRA_SUITE_PS_START ===')
  if($marker -lt 0){throw 'Invalid Nexus installer'}
  . ([scriptblock]::Create([string]::Join([char]10,$lines[($marker+1)..($lines.Length-1)]))) -LibraryOnly -HydraDir (Split-Path -Parent $nexusJob.exe)
  Set-NexusState 'backing-up' 'Creating and verifying the recovery copy…'
  $nexusBackup=Join-Path $nexusJobDir 'recovery';[IO.Directory]::CreateDirectory($nexusBackup)|Out-Null
  [IO.File]::Copy($nexusArchive,(Join-Path $nexusBackup 'app.asar'),$false)
  [IO.File]::Copy($nexusJob.exe,(Join-Path $nexusBackup 'Hydra.exe'),$false)
  if((Get-NexusHash $nexusArchive) -cne (Get-NexusHash (Join-Path $nexusBackup 'app.asar')) -or (Get-NexusHash $nexusJob.exe) -cne (Get-NexusHash (Join-Path $nexusBackup 'Hydra.exe'))){throw 'Recovery copy verification failed'}
  [IO.File]::WriteAllText((Join-Path $nexusBackup 'hashes.json'),(@{'app.asar'=(Get-NexusHash (Join-Path $nexusBackup 'app.asar'));'Hydra.exe'=(Get-NexusHash (Join-Path $nexusBackup 'Hydra.exe'))}|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  Wait-NexusUnlocked
  if(Test-NexusCancelled){throw 'Update cancelled before installation.'}
  $nexusChanged=$true
  $patch=$script:BuiltInPatches|Where-Object Id -eq 'nexus'
  $script:NexusInstallProgressSink={param($stage) $phase=if($stage -eq 'verifying' -or $stage -eq 'committing'){'verifying'}else{'installing'};Set-NexusState $phase ('Installing the verified update: '+$stage)}
  Invoke-BuiltInPatch $patch Install *> (Join-Path $nexusJobDir 'installer.log')
  Set-NexusState 'verifying' 'Verifying the installed update…'
  if((Get-PatchStatus $patch (Split-Path -Parent $nexusJob.exe)) -cne 'Installed'){throw 'Post-installation verification failed'}
  # Confirm the installed bridge belongs to this exact verified BAT, not merely
  # that some Nexus hook was already present before the update.
  if($patch.BridgeBase64){
    $archiveState=Get-ArchiveState $nexusArchive;$node=$archiveState.Files.'hydra-nexus-bridge.cjs'
    if(!$node){throw 'Installed bridge is missing'}
    $actual=[HydraSuiteAsar]::ReadFile($nexusArchive,$archiveState.Offset,[long]$node.offset,[int]$node.size)
    if((Get-Integrity $actual).hash -cne (Get-Integrity ([Convert]::FromBase64String($patch.BridgeBase64))).hash){throw 'Installed bridge verification failed'}
  }
  Remove-Item -LiteralPath (Join-Path (Split-Path -Parent $nexusJobDir) 'staged.json') -Force -ErrorAction SilentlyContinue
  Set-NexusState 'restarting' 'Reopening Hydra…'
  Set-NexusState 'installed' ('Hydra Nexus '+$nexusJob.version+' installed successfully.')
  Start-NexusOnce
  $nexusChanged=$false
  exit 0
}catch{
  $failure=$_.Exception.Message
  if($nexusChanged){
    try{Wait-NexusUnlocked -AllowCancel $false;Restore-NexusFiles;$failure+=' Previous installation restored.'}catch{$failure+=' ROLLBACK NEEDS ATTENTION: '+$_.Exception.Message}
  }
  if($nexusJob){try{Set-NexusState 'failed' ('Update needs attention: '+$failure)}catch{}}
  # Only a parent that approved and actually exited can be reopened. A startup
  # failure or an unresponsive live app must never spawn an extra Hydra.
  if($nexusApproved -and $nexusParent -and $nexusParent.HasExited -and !$failure.Contains('ROLLBACK NEEDS ATTENTION')){try{Start-NexusOnce}catch{}}
  exit 1
}finally{if($nexusHeld){try{$nexusMutex.ReleaseMutex()}catch{}};if($nexusMutex){$nexusMutex.Dispose()}}
