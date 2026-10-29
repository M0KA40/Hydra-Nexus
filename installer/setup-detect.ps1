# Read-only discovery, separate from the engine and UI thread. Never launch Hydra.
function Find-NexusHydra([string[]]$Candidates=@(),[string[]]$RegistryRoots=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'),[switch]$SkipDefaults,[switch]$SkipProcesses,[switch]$SkipShortcuts){
    function Test-HydraFolder([string]$Path){
        if(!$Path){return $null}
        try{$full=[IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"')));if((Test-Path -LiteralPath (Join-Path $full 'Hydra.exe') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $full 'resources/app.asar') -PathType Leaf)){return $full}}catch{}
        return $null
    }
    $paths=New-Object 'System.Collections.Generic.List[string]'
    foreach($candidate in $Candidates){$paths.Add($candidate)}
    if(!$SkipProcesses){foreach($process in @(Get-Process -Name Hydra,hydralauncher -ErrorAction SilentlyContinue)){try{if($process.Path){$paths.Add((Split-Path -Parent $process.Path))}}catch{}}}
    foreach($registryRoot in $RegistryRoots){
        foreach($key in @(Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue)){
            $entry=Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            if($entry.DisplayName -match '^Hydra( Launcher)?$'){
                if($entry.InstallLocation){$paths.Add([string]$entry.InstallLocation)}
                if($entry.DisplayIcon -match '^"?(.+?\.exe)"?(?:,\s*\d+)?$'){$paths.Add((Split-Path -Parent $Matches[1]))}
            }
        }
    }
    if(!$SkipDefaults){foreach($base in @($env:LOCALAPPDATA,$env:ProgramFiles,${env:ProgramFiles(x86)})){if($base){foreach($name in @('Hydra','hydra','hydralauncher','Programs/Hydra','Programs/hydralauncher')){$paths.Add((Join-Path $base $name))}}}}
    foreach($path in $paths){$found=Test-HydraFolder $path;if($found){return $found}}
    if(!$SkipShortcuts){
        try{
            $shell=New-Object -ComObject WScript.Shell
            foreach($startFolder in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))){
                foreach($link in @(Get-ChildItem -LiteralPath $startFolder -Filter '*Hydra*.lnk' -Recurse -ErrorAction SilentlyContinue)){
                    $found=Test-HydraFolder (Split-Path -Parent ($shell.CreateShortcut($link.FullName).TargetPath));if($found){return $found}
                }
            }
        }catch{}
    }
    return $null
}
