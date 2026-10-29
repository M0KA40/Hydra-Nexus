# Presentation only. Patch operations, guards and rollback remain in the installer core.
$script:NexusInstallerLocales = @'
__NEXUS_INSTALLER_LOCALES__
'@ | ConvertFrom-Json
function Get-NexusInstallerText([string]$Key){
    $catalog=$script:NexusInstallerLocales.en
    $value=$catalog.$Key
    if(!$value){$value=$script:NexusInstallerLocales.en.$Key}
    if(!$value){return $Key};return [string]$value
}
function Show-NexusInstallerBanner {
    Clear-Host
    Write-Host ''
    Write-Host '  ┌──────────────────────────────────────────────────────────┐' -ForegroundColor DarkGray
    Write-Host '  │  HYDRA NEXUS                       SETUP · __NEXUS_RELEASE_VERSION__  │' -ForegroundColor Cyan
    Write-Host '  └──────────────────────────────────────────────────────────┘' -ForegroundColor DarkGray
    Write-Host ('  '+(Get-NexusInstallerText 'subtitle')) -ForegroundColor Gray
    Write-Host ''
}
function Start-NexusInstaller {
    try{[Console]::InputEncoding=New-Object Text.UTF8Encoding($false);[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)}catch{}
}
function Show-NexusMenu($Patch){
    while($true){
        Show-NexusInstallerBanner
        Write-Host ('  [1]  '+(Get-NexusInstallerText 'install')) -ForegroundColor White
        Write-Host ('  [2]  '+(Get-NexusInstallerText 'remove')) -ForegroundColor White
        Write-Host ('  [3]  '+(Get-NexusInstallerText 'check')) -ForegroundColor White
        Write-Host ('  [4]  '+(Get-NexusInstallerText 'folder')) -ForegroundColor White
        Write-Host ''
        Write-Host ('  [0]  '+(Get-NexusInstallerText 'exit')) -ForegroundColor DarkGray
        Write-Host ''
        $choice=(Read-Host ('  '+(Get-NexusInstallerText 'select'))).Trim()
        if($choice -eq '0'){return}
        try{switch($choice){
            '1'{Invoke-BuiltInPatch $Patch Install;Wait-ForMenu}
            '2'{Invoke-BuiltInPatch $Patch Remove;Wait-ForMenu}
            '3'{$dir=Resolve-HydraDirectory;Write-Host (Get-PatchStatus $Patch $dir);Wait-ForMenu}
            '4'{$script:HydraDir='';[void](Resolve-HydraDirectory);Wait-ForMenu}
            default{Write-Host ('  '+(Get-NexusInstallerText 'invalid')) -ForegroundColor Yellow;Wait-ForMenu}
        }}catch{Show-Error $_;Wait-ForMenu}
    }
}
function Reset-NexusInterfacePreference {
    # The native renderer hooks/CSS are already removed by the verified core.
    # Reset only our opt-in preferences, retaining media and every other setting.
    $file=Join-Path $env:APPDATA 'Hydra\Nexus\themes.json'
    if(!(Test-Path -LiteralPath $file)){return}
    try{
        foreach($directory in @((Join-Path $env:APPDATA 'Hydra'),(Join-Path $env:APPDATA 'Hydra\Nexus'))){if((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked theme directory was preserved.'}}
        $item=Get-Item -LiteralPath $file
        if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked theme preference was preserved.'}
        if($item.Length -gt 4194304){throw 'Oversized theme preference was preserved.'}
        $prefs=Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
        if($prefs -isnot [pscustomobject] -or $prefs.customCSS -isnot [string] -or $prefs.achievementCSS -isnot [string]){throw 'Unrecognized theme preference was preserved.'}
        $prefs | Add-Member -NotePropertyName interface -NotePropertyValue ([pscustomobject]@{schema=1;design='native'}) -Force
        $prefs | Add-Member -NotePropertyName quietBackground -NotePropertyValue $false -Force
        $temporary=$file+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
        $backup=$file+'.before-nexus-removal-'+[guid]::NewGuid().ToString('N')
        [IO.File]::WriteAllText($temporary,($prefs|ConvertTo-Json -Depth 32),(New-Object Text.UTF8Encoding($false)))
        [IO.File]::Replace($temporary,$file,$backup)
    }catch{Write-Warning ('Nexus interface preferences were preserved: '+$_.Exception.Message)}
}
