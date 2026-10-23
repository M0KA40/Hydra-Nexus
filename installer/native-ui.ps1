# Included by build.py. Renderer edits share the installer's existing ASAR transaction.
function Remove-NexusWindowHook([string]$Text){
    return $Text.Replace('/* HYDRA_NEXUS_LOCAL_RENDERER_V1 */ if(globalThis.__HYDRA_NEXUS__ && !(is.dev && process.env["ELECTRON_RENDERER_URL"])){await window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash});return;}','')
}
function Add-NexusWindowHook([string]$Text){
    $Text=Remove-NexusWindowHook $Text
    if($Text -notmatch '\bclass\s+WindowManager\b'){return $Text}
    $pattern='\bstatic\s+async\s+loadWindowURL\s*\(window,\s*hash\s*=\s*""\)\s*\{'
    $matches=[regex]::Matches($Text,$pattern)
    if($matches.Count -ne 1){throw 'Unsupported Hydra window loader. The archive was not replaced.'}
    $m=$matches[0];$at=$m.Index+$m.Length
    return $Text.Substring(0,$at)+'/* HYDRA_NEXUS_LOCAL_RENDERER_V1 */ if(globalThis.__HYDRA_NEXUS__ && !(is.dev && process.env["ELECTRON_RENDERER_URL"])){await window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash});return;}'+$Text.Substring($at)
}
function Remove-NexusRendererHooks([string]$Text){
    $Text=[regex]::Replace($Text,'(?s)// === HYDRA_NEXUS_NATIVE_UI_START ===\r?\n.*?// === HYDRA_NEXUS_NATIVE_UI_END ===\r?\n','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_PRIVACY_MENU_V1 */ jsxRuntimeExports.jsx(HydraNexusInvisibleMenu, {}),','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_RELEASE_NOTES_V1 */ jsxRuntimeExports.jsx(HydraNexusReleaseNotes, {}),','')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_HOST_V1:("(?:aside|div|ul|section)") \*/ HydraNexusHost','$1')
    $Text=[regex]::Replace($Text,'/\* HYDRA_NEXUS_HOST_TAG \*/ __nexusTag:"(?:aside|div|ul|section)",','')
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
    $result=$result.Replace($root,'/* HYDRA_NEXUS_RELEASE_NOTES_V1 */ jsxRuntimeExports.jsx(HydraNexusReleaseNotes, {}),'+$root)
    $hosts='(jsxRuntimeExports\.(?:jsx|jsxs)\()("(?:aside|div|ul|section)")(,\s*\{\s*)(className:\s*"(?:settings__sidebar|settings__panel|sidebar__menu|hero-panel__actions|hero-panel__content|game-details__hero|game-options-modal__container|game-options-modal__panel|game-options-modal__content|context-menu__list|catalogue-results-page|catalogue-grid|library__content)")'
    $matches=[regex]::Matches($result,$hosts)
    if($matches.Count -lt 5 -or $result -notmatch 'className: "settings__sidebar"'){throw 'Unsupported Hydra native interface hosts. The archive was not replaced.'}
    $result=[regex]::Replace($result,$hosts,[Text.RegularExpressions.MatchEvaluator]{param($m)
        $tag=$m.Groups[2].Value
        return $m.Groups[1].Value+'/* HYDRA_NEXUS_HOST_V1:'+$tag+' */ HydraNexusHost'+$m.Groups[3].Value+'/* HYDRA_NEXUS_HOST_TAG */ __nexusTag:'+$tag+','+$m.Groups[4].Value
    })
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
        $assetName='nexus-invisible-mode.png'
        if($Operation -eq 'Install'){
            $node=$assets.files.$assetName
            if($node -and ($node.unpacked -or $node.link)){throw 'Unsupported Nexus announcement asset. The archive was not replaced.'}
            if(!$node){$node=[pscustomobject]@{};$assets.files|Add-Member -NotePropertyName $assetName -NotePropertyValue $node -Force}
            [pscustomobject]@{Folder=$folder;Name=$assetName;Node=$node;Bytes=[Convert]::FromBase64String('__NEXUS_ANNOUNCEMENT_BASE64__')}
        }else{$assets.files.PSObject.Properties.Remove($assetName)}
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
