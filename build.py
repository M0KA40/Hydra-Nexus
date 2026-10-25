from pathlib import Path
import base64,json,re,argparse
parser=argparse.ArgumentParser()
args=parser.parse_args()
root=Path(__file__).resolve().parent
source=root/'src';backup=source;output=root/'dist';output.mkdir(exist_ok=True)
version=re.search(r"version:'([^']+)'",(source/'brand.cjs').read_text(encoding='utf8')).group(1)
modules={}
for name in ['core.cjs','drive-folder.cjs','achievements.cjs','ui.js','bridge.cjs']:
    text=(backup/name).read_text(encoding='utf-8')
    if name=='bridge.cjs':
        text=text.replace("  async function performBackup(key,reason='Manual'){await ready();", "  global.__NEXUS_BACKUP_BUSY__=()=>!!(backupTask||engine?.busy||drive?.uploading);\n  async function performBackup(key,reason='Manual'){if(global.__HYDRA_NEXUS_ENABLED__?.('backup')===false)throw Error('Enable Backup in Hydra Nexus > Plugins first');await ready();")
        text=text.replace("if(!engine.settings.autoBackup)", "if(!engine.settings.autoBackup||global.__HYDRA_NEXUS_ENABLED__?.('backup')===false)")
    modules['./'+name]=text
steam=(source/'steam.cjs').read_text(encoding='utf8')
modules['./steam.cjs']=steam
for name in ['activity.cjs','themes.cjs','extract-path.cjs','nexus-ui.js','updater.cjs','controller.cjs','notes.cjs','notes-ui.js','hardware.cjs','services.cjs','workspace-ui.js','steam-vdf.cjs','steam-ui.js','mod-catalog.cjs','game-links.cjs','ratings.cjs','requirements.cjs','brand.cjs','privacy.cjs','release-notes.cjs','update-job.cjs','update-shutdown.cjs','update-assets.cjs','update-confirmation.cjs','update-recovery.cjs']:
    modules['./'+name]=(source/name).read_text(encoding='utf-8').replace('__NEXUS_REPOSITORY__',json.dumps('M0KA40/Hydra-Nexus')).replace('__NEXUS_BRAND_ICON__','data:image/svg+xml;base64,'+base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.svg').read_bytes()).decode()).replace('__NEXUS_BRAND_WINDOW_ICON__','data:image/png;base64,'+base64.b64encode((root/'assets/brand/Hydra-Nexus-transparent.png').read_bytes()).decode()).replace('__NEXUS_MODS_ICON__','data:image/png;base64,'+base64.b64encode((root/'assets/nexus-mods.png').read_bytes()).decode())
modules['./update-assets.cjs']="'use strict';module.exports={worker:"+json.dumps((root/'installer/update-worker.ps1').read_text(encoding='utf8'))+"};"
for file in [source/'i18n.cjs',*sorted((source/'locales').glob('*.cjs'))]:
    modules['./'+file.relative_to(source).as_posix()]=file.read_text(encoding='utf-8')
missing=set()
for name,text in modules.items():
    for match in re.finditer(r"require\(['\"](\./[^'\"]+)['\"]\)",text):
        if match.group(1) not in modules:missing.add(name+' -> '+match.group(1))
if missing:raise SystemExit('Bundled modules require files that are not bundled: '+', '.join(sorted(missing)))
factories=','.join(json.dumps(name)+':function(module,exports,require){\n'+text+'\n}' for name,text in modules.items())
bundle='// Hydra Nexus 1.0.0\n(function(nativeRequire){\nconst factories={'+factories+'};const cache={};function localRequire(id){if(!factories[id])return nativeRequire(id);if(!cache[id]){const module={exports:{}};cache[id]=module;factories[id](module,module.exports,localRequire);}return cache[id].exports;}localRequire("./controller.cjs");\n})(require);\n'
bundle=bundle.replace('// Hydra Nexus 1.0.0','// Hydra Nexus '+version,1)
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
    $Text=$Text.Replace('await /* HYDRA_NEXUS_NATIVE_LAUNCH_V1 */ (globalThis.__NEXUS_STEAM_NATIVE_LAUNCH__ || ((nativeLaunch, options) => nativeLaunch(options)))(launchGame, {','await launchGame({')
    $Text=$Text.Replace('await /* HYDRA_NEXUS_CLASSICS_LAUNCH_V1 */ (globalThis.__NEXUS_STEAM_NATIVE_LAUNCH__ || ((nativeLaunch, options) => nativeLaunch(options)))(() => openClassicsGame(shop, objectId), {shop, objectId})','await openClassicsGame(shop, objectId)')
    $Text=$Text.Replace('/* HYDRA_NEXUS_PRIVACY_GAME_V1 */ if(globalThis.__NEXUS_PRIVACY_BLOCK_GAME__?.(game))return;','')
    $Text=$Text.Replace('PendingGroupedSouvenirStore.list(/* HYDRA_NEXUS_SOUVENIR_UPLOAD_V1 */ {nexusUpload:true})','PendingGroupedSouvenirStore.list()')
    $Text=Remove-NexusExtractionHooks (Remove-NexusWindowHook $Text)
    return $Text
}
function Add-NexusNativeLaunchHooks([string]$Text){
    # The existing run protocol is shared by old/new Desktop links and cold/warm starts.
    # Patch only its native call; wrapping launchGame itself would repeat IPC switching.
    if($Text -notmatch '\\bhandleRunGame\\b'){return $Text}
    $pattern='(?s)\\bconst\\s+handleRunGame\\s*=\\s*async\\b.*?(?=\\bconst\\s+handleDeepLinkPath\\b)'
    $blocks=[regex]::Matches($Text,$pattern)
    if($blocks.Count -ne 1){throw 'Unsupported Hydra shortcut handler. The archive was not replaced.'}
    $block=$blocks[0]
    $call='\\bawait\\s+launchGame\\s*\\(\\s*\\{'
    if([regex]::Matches($block.Value,$call).Count -ne 1){throw 'Unsupported Hydra shortcut launch. The archive was not replaced.'}
    $patched=[regex]::Replace($block.Value,$call,'await /* HYDRA_NEXUS_NATIVE_LAUNCH_V1 */ (globalThis.__NEXUS_STEAM_NATIVE_LAUNCH__ || ((nativeLaunch, options) => nativeLaunch(options)))(launchGame, {')
    # Classics returns before launchGame, so its native shortcut needs the same guard.
    if($block.Value -match '\\bopenClassicsGame\\b'){
        $classicCall='\\bawait\\s+openClassicsGame\\s*\\(\\s*shop\\s*,\\s*objectId\\s*\\)'
        if([regex]::Matches($block.Value,$classicCall).Count -ne 1){throw 'Unsupported Hydra Classics shortcut. The archive was not replaced.'}
        $patched=[regex]::Replace($patched,$classicCall,'await /* HYDRA_NEXUS_CLASSICS_LAUNCH_V1 */ (globalThis.__NEXUS_STEAM_NATIVE_LAUNCH__ || ((nativeLaunch, options) => nativeLaunch(options)))(() => openClassicsGame(shop, objectId), {shop, objectId})')
    }
    return $Text.Substring(0,$block.Index)+$patched+$Text.Substring($block.Index+$block.Length)
}
function Add-NexusPrivacyHooks([string]$Text){
    if($Text -notmatch '\\bclass\\s+HydraApi\\b' -or $Text -notmatch '\\bclass\\s+SSEClient\\b'){return $Text}
    # Filter only the worker's upload/expiry/retry view. Native status/details keep all rows.
    $worker=[regex]::Matches($Text,'(?s)\\bclass\\s+GroupedSouvenirWorker\\b.*?(?=\\nconst groupedSouvenirWorker = )')
    if($worker.Count -ne 1 -or [regex]::Matches($worker[0].Value,'PendingGroupedSouvenirStore\\.list\\(\\)').Count -ne 3){throw 'Unsupported Hydra souvenir worker. The archive was not replaced.'}
    $block=$worker[0];$next=$block.Value.Replace('PendingGroupedSouvenirStore.list()','PendingGroupedSouvenirStore.list(/* HYDRA_NEXUS_SOUVENIR_UPLOAD_V1 */ {nexusUpload:true})')
    $Text=$Text.Substring(0,$block.Index)+$next+$Text.Substring($block.Index+$block.Length)
    foreach($name in @('createGame','trackGamePlaytime')){
        $pattern='\\bconst\\s+'+$name+'\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{'
        $matches=[regex]::Matches($Text,$pattern)
        if($matches.Count -ne 1){throw 'Unsupported Hydra activity function. The archive was not replaced.'}
        $m=$matches[0];$at=$m.Index+$m.Length;$Text=$Text.Substring(0,$at)+'/* HYDRA_NEXUS_PRIVACY_GAME_V1 */ if(globalThis.__NEXUS_PRIVACY_BLOCK_GAME__?.(game))return;'+$Text.Substring($at)
    }
    return $Text
}
function Get-NexusAdapter([string]$Text){
    $adapter=Get-BackupAdapter $Text
    $adapter=$adapter.Replace('HYDRA_BACKUP_ADAPTER','HYDRA_NEXUS_ADAPTER').Replace('__HYDRA_BACKUP_BIND__','__HYDRA_NEXUS_BIND__')
    if($Text -match '\\b(?:const|let|var)\\s+themesSublevel\\b'){$adapter=$adapter.Replace('running:getGamesRunning','running:getGamesRunning,themes:themesSublevel')}
    if($Text -match '\\bclass\\s+WindowManager\\b'){$adapter=$adapter.Replace('__HYDRA_NEXUS_BIND__({','__HYDRA_NEXUS_BIND__({windowManager:WindowManager,')}
    if($Text -match '\\bclass\\s+HydraApi\\b' -and $Text -match '\\bclass\\s+SSEClient\\b' -and $Text -match '\\bconst\\s+achievementSyncWorker\\b' -and $Text -match '\\bconst\\s+groupedSouvenirWorker\\b' -and $Text -match '\\bconst\\s+PendingGroupedSouvenirStore\\b'){
        $adapter=$adapter.Replace('__HYDRA_NEXUS_BIND__({','__HYDRA_NEXUS_BIND__({privacy:{api:HydraApi,realtime:SSEClient,achievementWorker:achievementSyncWorker,souvenirWorker:groupedSouvenirWorker,souvenirStore:PendingGroupedSouvenirStore},')
    }
    # A confirmed update saves native work explicitly before app.exit; the
    # normal Hydra quit/torrent path is not changed or globally intercepted.
    $required=@('DownloadManager','DownloadOrchestrator','PowerSaveBlockerManager','libraryWriteQueue','WindowManager','db','shutdownEpicIntegration','clearGamesPlaytime','stopAllEmulatorSouvenirCaptureSessions','isRemoteLibrarySyncing')
    $supported=$true
    foreach($name in $required){if($Text -notmatch ('\\b'+[regex]::Escape($name)+'\\b')){$supported=$false}}
    if($supported){
        $exit='updateExit:{assertIdle:()=>{if(DownloadManager.hasActiveDownload())throw Error("Pause downloads before restarting to update.");if(isRemoteLibrarySyncing())throw Error("Wait for library synchronization to finish before updating.");},prepare:async(signal)=>{const check=()=>{if(signal?.aborted)throw Error("Saving before the update did not finish. Hydra was kept open.");};check();await shutdownEpicIntegration();check();DownloadOrchestrator.cancelPendingDebridPreparations();PowerSaveBlockerManager.reset();await clearGamesPlaytime();check();await stopAllEmulatorSouvenirCaptureSessions();check();await libraryWriteQueue.drain();check();const w=WindowManager.mainWindow;if(w&&!w.isDestroyed()){const b=w.getBounds();const m=w.isMaximized();const initial=WindowManager.initialConfigInitializationMainWindow;await WindowManager.saveScreenConfig(m?{width:initial?.width||b.width,height:initial?.height||b.height,isMaximized:true}:{...b,isMaximized:false});}},close:async()=>{await libraryWriteQueue.drain();await db.close();},reopen:async()=>{await db.open();}},'
        $adapter=$adapter.Replace('__HYDRA_NEXUS_BIND__({','__HYDRA_NEXUS_BIND__({'+$exit)
    }
    if($Text -match '\\bclass\\s+GameFilesManager\\b'){
        $adapter=$adapter.Replace('__HYDRA_NEXUS_BIND__({','__HYDRA_NEXUS_BIND__({extraction:{manager:GameFilesManager,downloads:downloadsSublevel,zip:SevenZip,deleteArchive:deleteArchiveFile,windows:WindowManager,db},')
    }
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
native_ui=(source/'native-ui.js').read_text(encoding='utf8')
native_ui=native_ui[:native_ui.index("if(typeof module")]
native_installer=(root/'installer/native-ui.ps1').read_text(encoding='utf8').replace('__NEXUS_NATIVE_UI_BASE64__',base64.b64encode(native_ui.encode()).decode()).replace('__NEXUS_ANNOUNCEMENT_BASE64__',base64.b64encode((root/'assets/announcements/invisible-mode-1.2.0.png').read_bytes()).decode()).replace('__NEXUS_EXTRACT_ANNOUNCEMENT_BASE64__',base64.b64encode((root/'assets/announcements/extract-path-1.2.2.png').read_bytes()).decode())
registry+='\n'+native_installer
base=base.replace("Add-Type -TypeDefinition @'",registry+"\nAdd-Type -TypeDefinition @'",1)
base=base.replace("[ValidateSet('steam','gameshift','backup')]", "[ValidateSet('nexus')]")
base=base.replace("[string]$PatchId = 'steam'", "[string]$PatchId = 'nexus'")
base=base.replace('Remove-PatchHooks $state.Text $Patch','Remove-NexusHooks $state.Text $Patch')
base=base.replace('$clean=Add-NexusWindowHook (Add-NexusPrivacyHooks (Add-NexusNativeLaunchHooks $clean))','$clean=Add-NexusExtractionHooks (Add-NexusWindowHook (Add-NexusPrivacyHooks (Add-NexusNativeLaunchHooks $clean)))')
base=base.replace('    $bridgeBytes = [byte[]]@()', "    if ($Operation -eq 'Install' -and $Patch.Id -eq 'nexus') { $clean=Add-NexusExtractionHooks (Add-NexusWindowHook (Add-NexusPrivacyHooks (Add-NexusNativeLaunchHooks $clean))) }\n    $bridgeBytes = [byte[]]@()")
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
# Integrate renderer changes into the same verified/rollback-safe archive replacement.
base=base.replace('    $mainBytes = $utf8.GetBytes($newMain)', "    $rendererEdits=@(Get-NexusRendererEdits $state $archive $Operation)\n    $mainBytes = $utf8.GetBytes($newMain)")
base=base.replace('    $backup = $archive+', "    $nativeLength=$appended.Length;foreach($edit in $rendererEdits){Set-NodeFile $edit.Node $edit.Bytes ($end+$nativeLength);$nativeLength+=$edit.Bytes.Length}\n    if($nativeLength -gt $appended.Length){$combined=New-Object byte[] $nativeLength;[Array]::Copy($appended,0,$combined,0,$appended.Length);$cursor=$appended.Length;foreach($edit in $rendererEdits){[Array]::Copy($edit.Bytes,0,$combined,$cursor,$edit.Bytes.Length);$cursor+=$edit.Bytes.Length};$appended=$combined}\n    $backup = $archive+")
base=base.replace('        $verifiedMain = $utf8.GetBytes($check.Text)', '        Assert-NexusRendererEdits $check $temporary $rendererEdits\n        $verifiedMain = $utf8.GetBytes($check.Text)')
revision=int(re.search(r'revision:(\d+)',(source/'brand.cjs').read_text(encoding='utf8')).group(1))
base=base.replace('__NEXUS_RELEASE_VERSION__',version).replace('__NEXUS_RELEASE_REVISION__',str(revision))
base=base.replace('Hydra Nexus 1.0.0','Hydra Nexus '+version).replace('v1.0.0','v'+version)
base=f':: HYDRA_NEXUS_RELEASE {version}\n:: HYDRA_NEXUS_REVISION {revision}\n'+base
(output/'Hydra_Nexus.bat').write_bytes(base.replace('\r\n','\n').replace('\n','\r\n').encode())
print('Built Hydra Nexus '+version+': 10 plugins, backgrounds, safe updater and per-game tools. GameShift is not bundled.')
