from pathlib import Path
import base64,json,re,argparse
parser=argparse.ArgumentParser()
args=parser.parse_args()
root=Path(__file__).resolve().parent
source=root/'src';backup=source;output=root/'dist';output.mkdir(exist_ok=True)
modules={}
for name in ['core.cjs','drive-folder.cjs','achievements.cjs','ui.js','bridge.cjs']:
    text=(backup/name).read_text(encoding='utf-8')
    if name=='bridge.cjs':
        text=text.replace("  async function performBackup(key,reason='Manual'){await ready();", "  global.__NEXUS_BACKUP_BUSY__=()=>!!(backupTask||engine?.busy||drive?.uploading);\n  async function performBackup(key,reason='Manual'){if(global.__HYDRA_NEXUS_ENABLED__?.('backup')===false)throw Error('Enable Backup in Hydra Nexus > Plugins first');await ready();")
        text=text.replace("if(!engine.settings.autoBackup)", "if(!engine.settings.autoBackup||global.__HYDRA_NEXUS_ENABLED__?.('backup')===false)")
    modules['./'+name]=text
steam=(source/'steam.cjs').read_text(encoding='utf8')
modules['./steam.cjs']=steam
for name in ['activity.cjs','themes.cjs','nexus-ui.js','updater.cjs','controller.cjs','notes.cjs','notes-ui.js','hardware.cjs','services.cjs','workspace-ui.js','steam-ui.js','mod-catalog.cjs','game-links.cjs','ratings.cjs','requirements.cjs','resources.cjs','brand.cjs']:
    modules['./'+name]=(source/name).read_text(encoding='utf-8').replace('__NEXUS_REPOSITORY__',json.dumps('M0KA40/Hydra-Nexus')).replace('__NEXUS_BRAND_ICON__','data:image/svg+xml;base64,'+base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.svg').read_bytes()).decode()).replace('__NEXUS_BRAND_WINDOW_ICON__','data:image/png;base64,'+base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.png').read_bytes()).decode()).replace('__NEXUS_MODS_ICON__','data:image/png;base64,'+base64.b64encode((root/'assets/nexus-mods.png').read_bytes()).decode())
factories=','.join(json.dumps(name)+':function(module,exports,require){\n'+text+'\n}' for name,text in modules.items())
bundle='// Hydra Nexus 1.0.0\n(function(nativeRequire){\nconst factories={'+factories+'};const cache={};function localRequire(id){if(!factories[id])return nativeRequire(id);if(!cache[id]){const module={exports:{}};cache[id]=module;factories[id](module,module.exports,localRequire);}return cache[id].exports;}localRequire("./controller.cjs");\n})(require);\n'
(output/'hydra-nexus-bridge.cjs').write_bytes(bundle.encode())
base=(root/'installer/installer-base.bat').read_text(encoding='utf-8-sig')
base=re.sub(r"BridgeBase64 = '[A-Za-z0-9+/=]+'", "BridgeBase64 = ''",base)
registry='''
$script:BuiltInPatches += [pscustomobject]@{
    Number=1;Id='nexus';Name='Hydra Nexus';Kind='BuiltIn'
    Description='Native plugins, game notes, backups, backgrounds, tabs and play history'
    BridgeName='hydra-nexus-bridge.cjs'
    CjsHook='require("./hydra-nexus-bridge.cjs"); // HYDRA_NEXUS_HOOK_V1'
    EsmHook='import { createRequire as __hnxRequire } from "module"; __hnxRequire(import.meta.url)("./hydra-nexus-bridge.cjs"); // HYDRA_NEXUS_HOOK_V1'
    BridgeBase64='BUNDLE'
}
function Remove-NexusHooks([string]$Text,$Patch){
    if($Patch.Id -ne 'nexus'){return Remove-PatchHooks $Text $Patch}
    foreach($item in $script:BuiltInPatches){$Text=Remove-PatchHooks $Text $item}
    $Text=[regex]::Replace($Text,'(?s)\\r?\\n// === HYDRA_NEXUS_ADAPTER_START ===.*?// === HYDRA_NEXUS_ADAPTER_END ===\\r?\\n','')
    return $Text
}
function Get-NexusAdapter([string]$Text){
    $adapter=Get-BackupAdapter $Text
    $adapter=$adapter.Replace('HYDRA_BACKUP_ADAPTER','HYDRA_NEXUS_ADAPTER').Replace('__HYDRA_BACKUP_BIND__','__HYDRA_NEXUS_BIND__')
    if($Text -match '\\b(?:const|let|var)\\s+themesSublevel\\b'){$adapter=$adapter.Replace('running:getGamesRunning','running:getGamesRunning,themes:themesSublevel')}
    if($Text -match '\\bclass\\s+WindowManager\\b'){$adapter=$adapter.Replace('__HYDRA_NEXUS_BIND__({','__HYDRA_NEXUS_BIND__({windowManager:WindowManager,')}
    return $adapter
}
function Show-NexusDevelopmentNotice {
    Show-Header 'Hydra Nexus 1.0.0'
    Write-Host '  Official release. Updates are available in Hydra Nexus > Updater.' -ForegroundColor Yellow
    Write-Host '  If something fails, keep your backup and report it on GitHub.'
    Write-Host '  Open Hydra > Settings > Hydra Nexus to manage your plugins.'
    Write-Host ''
    Write-Host '  Project: github.com/M0KA40/Hydra-Nexus' -ForegroundColor Cyan
    Write-Host ''
    Wait-ForMenu
}
function Show-NexusMenu($Patch){
    while($true){
        Show-Header 'Hydra Nexus'
        Write-Host '  One installer. Open Hydra > Settings > Hydra Nexus.'
        Write-Host '  [1] Install / Update / Repair'
        Write-Host '  [2] Remove Nexus (keep settings, notes, backgrounds, history and backups)'
        Write-Host '  [3] Check installation'
        Write-Host '  [4] Choose Hydra folder'
        Write-Host '  [0] Exit'
        $choice=(Read-Host '  Select an option').Trim()
        if($choice -eq '0'){return}
        try{switch($choice){
            '1'{Invoke-BuiltInPatch $Patch Install;Wait-ForMenu}
            '2'{Invoke-BuiltInPatch $Patch Remove;Wait-ForMenu}
            '3'{$dir=Resolve-HydraDirectory;Write-Host (Get-PatchStatus $Patch $dir);Wait-ForMenu}
            '4'{$script:HydraDir='';[void](Resolve-HydraDirectory);Wait-ForMenu}
        }}catch{Show-Error $_;Wait-ForMenu}
    }
}
'''.replace('BUNDLE',base64.b64encode(bundle.encode()).decode())
base=base.replace("Add-Type -TypeDefinition @'",registry+"\nAdd-Type -TypeDefinition @'",1)
base=base.replace("[ValidateSet('steam','gameshift','backup')]", "[ValidateSet('nexus')]")
base=base.replace("[string]$PatchId = 'steam'", "[string]$PatchId = 'nexus'")
base=base.replace('Remove-PatchHooks $state.Text $Patch','Remove-NexusHooks $state.Text $Patch')
base=base.replace("if ($Patch.Id -eq 'backup') { Assert-HydraBackupIdle }", "if ($Patch.Id -in @('backup','nexus')) { Assert-HydraBackupIdle }")
base=base.replace("if ($Operation -eq 'Install' -and $Patch.Id -eq 'backup') { $newMain += Get-BackupAdapter $clean }", "if ($Operation -eq 'Install' -and $Patch.Id -eq 'backup') { $newMain += Get-BackupAdapter $clean }; if ($Operation -eq 'Install' -and $Patch.Id -eq 'nexus') { $newMain += Get-NexusAdapter $clean }")
base=base.replace("if (!$Testing -and $Operation -eq 'Install' -and $Patch.Id -eq 'backup') { Write-BackupInstallation $directory }", "if (!$Testing -and $Operation -eq 'Install' -and $Patch.Id -in @('backup','nexus')) { Write-BackupInstallation $directory }")
base=base.replace("if (!$Testing -and $Patch.Id -eq 'backup') { Assert-HydraBackupIdle }", "if (!$Testing -and $Patch.Id -in @('backup','nexus')) { Assert-HydraBackupIdle }")
base=base.replace("elseif ($Patch.Id -eq 'backup')", "elseif ($Patch.Id -eq 'nexus') { Write-Host '  Open Hydra > Settings > Hydra Nexus.' }\n        elseif ($Patch.Id -eq 'backup')")
base=base.replace("function Show-BuiltInMenu($Patch) {", "function Show-BuiltInMenu($Patch) {\n    if($Patch.Id -eq 'nexus'){Show-NexusMenu $Patch;return}")
base=base.replace('$catalog = @($script:BuiltInPatches)',"$catalog = @($script:BuiltInPatches | Where-Object Id -eq 'nexus')")
base=base.replace("'    HYDRA PATCH MANAGER                                 v2.1.0'", "'    HYDRA NEXUS                                         v1.0.0'")
base=base.replace('title Hydra Patch Manager','title Hydra Nexus')
base=base.replace("if ($Action -eq 'Menu') { Show-MainMenu }", "if ($Action -eq 'Menu') { Show-NexusDevelopmentNotice; Show-NexusMenu ($script:BuiltInPatches | Where-Object Id -eq 'nexus') }")
base=':: HYDRA_NEXUS_RELEASE 1.0.0\n:: HYDRA_NEXUS_REVISION 2\n'+base
(output/'Hydra_Nexus.bat').write_bytes(base.replace('\r\n','\n').replace('\n','\r\n').encode())
print('Built Hydra Nexus 1.0.0: 8 plugins, backgrounds, safe updater and per-game tools. GameShift is not bundled.')
