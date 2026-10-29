param([Parameter(Mandatory=$true)][string]$RequestFile)
$ErrorActionPreference='Stop'
$held=$false;$mutex=$null
$jobDirectory=Split-Path -Parent ([IO.Path]::GetFullPath($RequestFile))
function Write-SetupState([string]$Phase,[string]$Message){
    $state=@{schema=1;token=$request.token;phase=$Phase;message=$Message;workerPid=$PID}
    $file=Join-Path $jobDirectory 'state.json';$temp=$file+'.tmp'
    [IO.File]::WriteAllText($temp,($state|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
    if(Test-Path -LiteralPath $file){[IO.File]::Replace($temp,$file,[System.Management.Automation.Language.NullString]::Value)}else{[IO.File]::Move($temp,$file)}
}
try{
    $request=Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8|ConvertFrom-Json
    if($request.schema -ne 1 -or $request.token -notmatch '^[a-f0-9]{32}$' -or $request.action -notin @('Install','Remove','Status')){throw 'Invalid setup request'}
    $installer=Join-Path $PSScriptRoot 'Hydra_Nexus.bat'
    $hashAlgorithm=[Security.Cryptography.SHA256]::Create();$hashStream=[IO.File]::OpenRead($installer)
    try{$installerHash=[BitConverter]::ToString($hashAlgorithm.ComputeHash($hashStream)).Replace('-','').ToLowerInvariant()}finally{$hashStream.Dispose();$hashAlgorithm.Dispose()}
    if($installerHash -cne $request.sha256){throw 'Installer checksum changed. Reopen the EXE.'}
    $directory=[IO.Path]::GetFullPath($request.directory)
    if(!(Test-Path -LiteralPath (Join-Path $directory 'Hydra.exe') -PathType Leaf) -or !(Test-Path -LiteralPath (Join-Path $directory 'resources/app.asar') -PathType Leaf)){throw 'Select the Hydra folder containing Hydra.exe and resources/app.asar.'}
    $mutex=New-Object Threading.Mutex($false,'Local\HydraNexusInstallV1')
    try{$held=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$held=$true}
    if(!$held){throw 'Another installer or updater is active. Wait for it to finish.'}
    # Never force-close a live app from standalone setup. The in-app updater
    # owns the safe-save handshake; standalone users close Hydra themselves.
    if($request.action -ne 'Status' -and @(Get-Process -Name Hydra,hydralauncher -ErrorAction SilentlyContinue).Count){throw 'Close Hydra completely, including its tray icon, then retry.'}
    Write-SetupState 'preparing' ''
    $env:HYDRA_SUITE_SELF=$installer;$env:HYDRA_NEXUS_PROGRESS_SILENT='1'
    $lines=[IO.File]::ReadAllLines($installer,[Text.Encoding]::UTF8);$marker=[Array]::IndexOf($lines,':: === HYDRA_SUITE_PS_START ===')
    if($marker -lt 0){throw 'Installer engine marker is missing'}
    . ([scriptblock]::Create([string]::Join([char]10,$lines[($marker+1)..($lines.Length-1)]))) -LibraryOnly -HydraDir $directory
    # Headless execution must fail safely instead of waiting for console input.
    function Read-Host {throw 'The engine needs additional information. Run the BAT for this operation.'}
    $patch=$script:BuiltInPatches|Where-Object Id -eq 'nexus'
    $script:NexusInstallProgressSink={param($stage) Write-SetupState $stage ''}
    if($request.action -eq 'Status'){$result=Get-PatchStatus $patch $directory;Write-SetupState 'status' $result}
    else{
        Invoke-BuiltInPatch $patch $request.action *> (Join-Path $jobDirectory 'installer.log')
        if($request.action -eq 'Install' -and (Get-PatchStatus $patch $directory) -cne 'Installed'){throw 'Installation needs verification. Run Check installation or the BAT before opening Hydra.'}
        Write-SetupState 'complete' ''
    }
    exit 0
}catch{try{Write-SetupState 'failed' $_.Exception.Message}catch{};exit 1}
finally{if($held){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}}
