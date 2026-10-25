# Included by build.py. Renderer edits share the installer's existing ASAR transaction.
function Remove-NexusExtractionHooks([string]$Text){
    $Text=$Text.Replace('/* HYDRA_NEXUS_DOWNLOAD_EVENT_V1 */ listener=globalThis.__NEXUS_DOWNLOAD_EVENT__?.(name,listener)||listener;','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_EXTRACT_DOWNLOAD_V1 */ if(await globalThis.__NEXUS_EXTRACT_DOWNLOAD__?.(download,game))return;','')
    return [regex]::Replace($Text,'/\* HYDRA_NEXUS_EXTRACTED_PATH_V1 \*/ globalThis\.__NEXUS_EXTRACTED_PATH__\?\.\(this\.gameKey,download\)\|\|','')
}
function Add-NexusExtractionHooks([string]$Text){
    $Text=Remove-NexusExtractionHooks $Text
    if($Text -notmatch '\bclass\s+GameFilesManager\b'){return $Text}
    foreach($required in @('class SevenZip','downloadsSublevel','deleteArchiveFile','static async handleExtraction(download, game)')){if(!$Text.Contains($required)){throw 'Unsupported Hydra extraction service. The archive was not replaced.'}}
    $event='const registerEvent = (name, listener)=>{'
    $entry='static async handleExtraction(download, game) {'
    if([regex]::Matches($Text,[regex]::Escape($event)).Count -ne 1 -or [regex]::Matches($Text,[regex]::Escape($entry)).Count -ne 1){throw 'Unsupported Hydra download events. The archive was not replaced.'}
    $Text=$Text.Replace($event,$event+'/* HYDRA_NEXUS_DOWNLOAD_EVENT_V1 */ listener=globalThis.__NEXUS_DOWNLOAD_EVENT__?.(name,listener)||listener;')
    $Text=$Text.Replace($entry,$entry+'/* HYDRA_NEXUS_EXTRACT_DOWNLOAD_V1 */ if(await globalThis.__NEXUS_EXTRACT_DOWNLOAD__?.(download,game))return;')
    $start=$Text.IndexOf('class GameFilesManager {');$end=$Text.IndexOf('class PremiumizeClient',$start)
    if($end -lt 0){throw 'Unsupported Hydra game file service. The archive was not replaced.'}
    $block=$Text.Substring($start,$end-$start)
    $paths='(const game(?:Folder)?Path = )(path\.join\(download\.downloadPath, download\.folderName\))'
    if([regex]::Matches($block,$paths).Count -ne 3){throw 'Unsupported Hydra extraction discovery. The archive was not replaced.'}
    $block=[regex]::Replace($block,$paths,'$1/* HYDRA_NEXUS_EXTRACTED_PATH_V1 */ globalThis.__NEXUS_EXTRACTED_PATH__?.(this.gameKey,download)||$2')
    return $Text.Substring(0,$start)+$block+$Text.Substring($end)
}
function Remove-NexusWindowHook([string]$Text){
    return $Text.Replace('/* HYDRA_NEXUS_LOCAL_RENDERER_V1 */ if(globalThis.__HYDRA_NEXUS__ && !(is.dev && process.env["ELECTRON_RENDERER_URL"])){await window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash});return;}','').Replace('/* HYDRA_NEXUS_LOCAL_RENDERER_V2 */ if(globalThis.__HYDRA_NEXUS__ && !(is.dev && process.env["ELECTRON_RENDERER_URL"])){const nexusBackground=await globalThis.__NEXUS_BACKGROUND_STARTUP__?.();await window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash,query:nexusBackground?{nexusBackground:"1"}:undefined});return;}','')
}
function Add-NexusWindowHook([string]$Text){
    $Text=Remove-NexusWindowHook $Text
    if($Text -notmatch '\bclass\s+WindowManager\b'){return $Text}
    $pattern='\bstatic\s+async\s+loadWindowURL\s*\(window,\s*hash\s*=\s*""\)\s*\{'
    $matches=[regex]::Matches($Text,$pattern)
    if($matches.Count -ne 1){throw 'Unsupported Hydra window loader. The archive was not replaced.'}
    $m=$matches[0];$at=$m.Index+$m.Length
    return $Text.Substring(0,$at)+'/* HYDRA_NEXUS_LOCAL_RENDERER_V2 */ if(globalThis.__HYDRA_NEXUS__ && !(is.dev && process.env["ELECTRON_RENDERER_URL"])){const nexusBackground=await globalThis.__NEXUS_BACKGROUND_STARTUP__?.();await window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash,query:nexusBackground?{nexusBackground:"1"}:undefined});return;}'+$Text.Substring($at)
}
function Remove-NexusRendererHooks([string]$Text){
    $Text=[regex]::Replace($Text,'(?s)// === HYDRA_NEXUS_NATIVE_UI_START ===\r?\n.*?// === HYDRA_NEXUS_NATIVE_UI_END ===\r?\n','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_PRIVACY_MENU_V1 */ jsxRuntimeExports.jsx(HydraNexusInvisibleMenu, {}),','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_RELEASE_NOTES_V1 */ jsxRuntimeExports.jsx(HydraNexusReleaseNotes, {}),','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_UPDATE_DIALOG_V1 */ jsxRuntimeExports.jsx(HydraNexusUpdateDialog, {}),','')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_HOST_V1:("(?:aside|div|ul|section)") \*/ HydraNexusHost','$1')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_HOST_TAG \*/ __nexusTag:"(?:aside|div|ul|section)",','')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_EXTRACT_FIELD_V1 \*/ jsxRuntimeExports\.jsx\(HydraNexusExtractPath,\{downloadPath:(?:selectedPath|selectedDownloadPath),enabled:automaticExtractionEnabled,disabled:(?:downloadStarting|isSubmitting)\}\),','')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_EXTRACT_PAYLOAD_V1 \*/ nexusExtractPath:window\.__nexusExtractPathForDownload\?\.\((?:automaticallyExtract|automaticExtractionEnabled)\),','')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_DOWNLOAD_BUTTON_V1:(Button\$1|Button) \*/ HydraNexusDownloadButton','$1')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_DOWNLOAD_BUTTON_TAG \*/ __nexusButton:(?:Button\$1|Button),','')
    return $Text
}
function Add-NexusRendererHooks([string]$Text){
    $clean=Remove-NexusRendererHooks $Text
    if($clean -notmatch '\bhandleFriendsClick\b' -or $clean -notmatch 'sidebar-profile__dropdown-item'){throw 'Unsupported Hydra native interface. The archive was not replaced.'}
    $separator='jsxRuntimeExports\.jsx\("div", \{ className: "sidebar-profile__dropdown-separator" \}\)'
    if([regex]::Matches($clean,$separator).Count -ne 1){throw 'Unsupported Hydra account menu. The archive was not replaced.'}
    $result=[regex]::Replace($clean,$separator,'/* HYDRA_NEXUS_PRIVACY_MENU_V1 */ jsxRuntimeExports.jsx(HydraNexusInvisibleMenu, {}),$0')
    $root='jsxRuntimeExports.jsx(BottomPanel, {})'
    if([regex]::Matches($result,[regex]::Escape($root)).Count -ne 1){throw 'Unsupported Hydra main interface. The archive was not replaced.'}
    $result=$result.Replace($root,'/* HYDRA_NEXUS_RELEASE_NOTES_V1 */ jsxRuntimeExports.jsx(HydraNexusReleaseNotes, {}),/* HYDRA_NEXUS_UPDATE_DIALOG_V1 */ jsxRuntimeExports.jsx(HydraNexusUpdateDialog, {}),'+$root)
    $hosts='(jsxRuntimeExports\.(?:jsx|jsxs)\()("(?:aside|div|ul|section)")(,\s*\{\s*)(className:\s*"(?:settings__sidebar|settings__panel|sidebar__menu|hero-panel__actions|hero-panel__content|game-details__hero|game-options-modal__container|game-options-modal__panel|game-options-modal__content|context-menu__list|catalogue-results-page|catalogue-grid|library__content)")'
    $matches=[regex]::Matches($result,$hosts)
    if($matches.Count -lt 5 -or $result -notmatch 'className: "settings__sidebar"'){throw 'Unsupported Hydra native interface hosts. The archive was not replaced.'}
    $result=[regex]::Replace($result,$hosts,[Text.RegularExpressions.MatchEvaluator]{param($m)
        $tag=$m.Groups[2].Value
        return $m.Groups[1].Value+'/* HYDRA_NEXUS_HOST_V1:'+$tag+' */ HydraNexusHost'+$m.Groups[3].Value+'/* HYDRA_NEXUS_HOST_TAG */ __nexusTag:'+$tag+','+$m.Groups[4].Value
    })
    if($result -match '\bfunction DownloadSettingsModal\b'){
        $button='(/\* @__PURE__ \*/ jsxRuntimeExports\.jsx\(\s*)(Button\$1)(,\s*\{\s*)(onClick: handlePrimaryButtonClick,)'
        if([regex]::Matches($result,$button).Count -ne 1){throw 'Unsupported Hydra download dialog. The archive was not replaced.'}
        $result=[regex]::Replace($result,$button,[Text.RegularExpressions.MatchEvaluator]{param($m)
            return '/* HYDRA_NEXUS_EXTRACT_FIELD_V1 */ jsxRuntimeExports.jsx(HydraNexusExtractPath,{downloadPath:selectedPath,enabled:automaticExtractionEnabled,disabled:downloadStarting}),'+$m.Groups[1].Value+'/* HYDRA_NEXUS_DOWNLOAD_BUTTON_V1:Button$1 */ HydraNexusDownloadButton'+$m.Groups[3].Value+'/* HYDRA_NEXUS_DOWNLOAD_BUTTON_TAG */ __nexusButton:Button$1,'+$m.Groups[4].Value
        })
        $payload='(automaticallyExtract,\s*)(automaticallyDeleteArchiveFiles,\s*fileSize: repack\.fileSize)'
        if([regex]::Matches($result,$payload).Count -ne 1){throw 'Unsupported Hydra download submission. The archive was not replaced.'}
        $result=[regex]::Replace($result,$payload,'$1/* HYDRA_NEXUS_EXTRACT_PAYLOAD_V1 */ nexusExtractPath:window.__nexusExtractPathForDownload?.(automaticallyExtract),$2')
    }
    if($result -match '\bfunction DownloadGameOptions\b'){
        $actions='(?=/\* @__PURE__ \*/ jsxRuntimeExports\.jsx\("div", \{ className: "download-game-modal__actions")'
        if([regex]::Matches($result,$actions).Count -ne 1){throw 'Unsupported Hydra download options. The archive was not replaced.'}
        $result=[regex]::Replace($result,$actions,'/* HYDRA_NEXUS_EXTRACT_FIELD_V1 */ jsxRuntimeExports.jsx(HydraNexusExtractPath,{downloadPath:selectedDownloadPath,enabled:automaticExtractionEnabled,disabled:isSubmitting}),')
        $payload='automaticallyDeleteArchiveFiles: deleteArchiveFilesAfterExtraction,'
        if([regex]::Matches($result,[regex]::Escape($payload)).Count -ne 1){throw 'Unsupported Hydra download options payload. The archive was not replaced.'}
        $result=$result.Replace($payload,'/* HYDRA_NEXUS_EXTRACT_PAYLOAD_V1 */ nexusExtractPath:window.__nexusExtractPathForDownload?.(automaticExtractionEnabled),'+$payload)
        $button='(jsxRuntimeExports\.jsx\(\s*)(Button)(,\s*\{\s*)(icon:[\s\S]{0,250}?onClick: handleStartDownload,)'
        if([regex]::Matches($result,$button).Count -ne 1){throw 'Unsupported Hydra download action. The archive was not replaced.'}
        $result=[regex]::Replace($result,$button,[Text.RegularExpressions.MatchEvaluator]{param($m)
            return $m.Groups[1].Value+'/* HYDRA_NEXUS_DOWNLOAD_BUTTON_V1:Button */ HydraNexusDownloadButton'+$m.Groups[3].Value+'/* HYDRA_NEXUS_DOWNLOAD_BUTTON_TAG */ __nexusButton:Button,'+$m.Groups[4].Value
        })
    }
    $source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__NEXUS_NATIVE_UI_BASE64__'))
    return "// === HYDRA_NEXUS_NATIVE_UI_START ===`n"+$source+"`ninstallNativeNexusCommit();`n// === HYDRA_NEXUS_NATIVE_UI_END ===`n"+$result
}
function Get-NexusRendererEdits($State,[string]$Archive,[string]$Operation){
    $found=0
    foreach($folder in @('out','dist')){
        $assets=$State.Header.files.$folder.files.renderer.files.assets
        if(!$assets){continue}
        foreach($property in $assets.files.PSObject.Properties){
            $node=$property.Value
            if($property.Name -notmatch '\.js$' -or $node.unpacked -or $node.link -or $node.size -lt 1000){continue}
            $text=[Text.Encoding]::UTF8.GetString([HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$node.offset,[int]$node.size))
            if($text -notmatch 'sidebar-profile__dropdown-item' -and $text -notmatch 'HYDRA_NEXUS_NATIVE_UI_START'){continue}
            $found++
            if($found -gt 1){throw 'Ambiguous Hydra native interface. The archive was not replaced.'}
            $clean=Remove-NexusRendererHooks $text
            $next=if($Operation -eq 'Install'){Add-NexusRendererHooks $clean}else{$clean}
            if($next -cne $text){[pscustomobject]@{Folder=$folder;Name=$property.Name;Node=$node;Bytes=$utf8.GetBytes($next)}}
        }
        foreach($asset in @(@{Name='nexus-invisible-mode.png';Data='__NEXUS_ANNOUNCEMENT_BASE64__'},@{Name='nexus-extract-path.png';Data='__NEXUS_EXTRACT_ANNOUNCEMENT_BASE64__'})){
        $assetName=$asset.Name
        if($Operation -eq 'Install'){
            $node=$assets.files.$assetName
            if($node -and ($node.unpacked -or $node.link)){throw 'Unsupported Nexus announcement asset. The archive was not replaced.'}
            if(!$node){$node=[pscustomobject]@{};$assets.files|Add-Member -NotePropertyName $assetName -NotePropertyValue $node -Force}
            $expected=[Convert]::FromBase64String($asset.Data);$same=$false
            if($null -ne $node.size){$actual=[HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$node.offset,[int]$node.size);$same=(Get-Integrity $actual).hash -ceq (Get-Integrity $expected).hash}
            if(!$same){[pscustomobject]@{Folder=$folder;Name=$assetName;Node=$node;Bytes=$expected}}
        }else{$assets.files.PSObject.Properties.Remove($assetName)}
        }
    }
    # Source-only installer fixtures have no renderer. A real renderer must expose the known menu.
    if(!$found -and $Operation -eq 'Install' -and ($State.Header.files.out.files.renderer -or $State.Header.files.dist.files.renderer)){throw 'Hydra native interface entry was not found. The archive was not replaced.'}
}
function Assert-NexusRendererEdits($State,[string]$Archive,$Edits){
    foreach($edit in $Edits){
        $node=$State.Header.files.($edit.Folder).files.renderer.files.assets.files.($edit.Name)
        $bytes=[HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$node.offset,[int]$node.size)
        if((Get-Integrity $bytes).hash -ne (Get-Integrity $edit.Bytes).hash){throw 'Native interface verification failed. The original archive was not replaced.'}
    }
}
