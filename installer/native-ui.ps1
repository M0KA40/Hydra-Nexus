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
    $Text=$Text.Replace('/* HYDRA_NEXUS_GAME_SURFACE_V1 */ HydraNexusGameSurface','"div"').Replace('/* HYDRA_NEXUS_GAME_PROPS_V1 */ nexusInLibrary:isGameInLibrary,nexusShop:shop,nexusObjectId:objectId,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_GAME_SECTION_V1 */ HydraNexusGameSidebarSection','"div"').Replace('/* HYDRA_NEXUS_GAME_SECTION_PROP_V1 */ nexusSection,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_GAME_MEASURE_V1 */ nexusOnMeasure:setHeight,nexusIsOpen:isOpen,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_ACHIEVEMENTS_SURFACE_V1 */ HydraNexusAchievementsSurface','"div"')
    $Text=$Text.Replace('/* HYDRA_NEXUS_REVIEW_SECTION_V1 */ document.dispatchEvent(new CustomEvent("nexus-game-section",{detail:{shop,objectId,section:"community"}}));','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_LIBRARY_SURFACE_V1 */ HydraNexusLibrarySurface','"section"').Replace('/* HYDRA_NEXUS_LIBRARY_GAMES_V1 */ nexusGames:filteredLibrary,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_LIBRARY_CARD_V1 */ HydraNexusLibraryCard','"button"').Replace('/* HYDRA_NEXUS_LIBRARY_TITLE_V1 */ nexusTitle:game.title,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_DISCOVERY_HOME_V1 */ jsxRuntimeExports.jsx(HydraNexusInterfaceHome, {NativeHome:Home$1})','jsxRuntimeExports.jsx(Home$1, {})')
    $Text=$Text.Replace('      /* HYDRA_NEXUS_THEME_CHOICE_V1 */ await window.__nexusInterface?.nativeThemeChosen?.();','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_INTERFACE_THEME_V1 */ window.__nexusInterface?.syncCommunityCSS(target);','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_SETTINGS_DISCOVERY_V1 */ "data-nexus-settings-entry":path2==="/settings"?"":undefined,','')
    $Text=$Text.Replace('/* HYDRA_NEXUS_TOOLS_DIALOG_V1 */ jsxRuntimeExports.jsx(HydraNexusToolsDialog, {}),','')
    $Text=[regex]::Replace($Text,'(?s)// === HYDRA_NEXUS_NATIVE_UI_START ===\r?\n.*?// === HYDRA_NEXUS_NATIVE_UI_END ===\r?\n','')
    $Text=[regex]::Replace($Text,'(?s)/\* HYDRA_NEXUS_TAB_SCOPE_V1:([A-Za-z0-9+/=]+) \*/.*?/\* HYDRA_NEXUS_TAB_SCOPE_END \*/',[Text.RegularExpressions.MatchEvaluator]{param($m) return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($m.Groups[1].Value))})
    $Text=[regex]::Replace($Text,'(?s)/\* HYDRA_NEXUS_CLEANER_V1:([A-Za-z0-9+/=]+) \*/.*?/\* HYDRA_NEXUS_CLEANER_END \*/',[Text.RegularExpressions.MatchEvaluator]{param($m) return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($m.Groups[1].Value))})
    $Text=$Text.Replace('/* HYDRA_NEXUS_TABS_OUTLET_V1 */ HydraNexusTabsOutlet','Outlet')
    $Text=$Text.Replace('/* HYDRA_NEXUS_INTERFACE_HERO_V1 */ HydraNexusInterfaceHero','"button"')
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
function Add-NexusTabPageScope([string]$Text,[string]$Name){
    $start=$Text.IndexOf('function '+$Name+'(')
    if($start -lt 0){throw ('Unsupported Hydra tab page: '+$Name+'. The archive was not replaced.')}
    $end=[regex]::Match($Text.Substring($start),'\r?\n__name\('+[regex]::Escape($Name)+',')
    if(!$end.Success){throw ('Unsupported Hydra tab page boundary: '+$Name+'. The archive was not replaced.')}
    $original=$Text.Substring($start,$end.Index)
    $next=$original.Replace('reactExports$1.useEffect(', 'HydraNexusPageEffect(').Replace('reactExports$1.useLayoutEffect(', 'HydraNexusPageLayoutEffect(')
    $next=[regex]::Replace($next,'(?<![\w$])(?:globalThis\.)?window\.', 'HydraNexusPageWindow.')
    $next=$next.Replace('globalThis.electron.', 'HydraNexusPageElectron.')
    $next=[regex]::Replace($next,'(?<![\w$.])document\.', 'HydraNexusPageDocument.')
    $next=[regex]::Replace($next,'(?<![\w$.])(?:globalThis\.)?(setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|cancelAnimationFrame)\(', 'HydraNexusPageWindow.$1(')
    $next=[regex]::Replace($next,'\bnew (IntersectionObserver|ResizeObserver|MutationObserver)\(', 'new HydraNexusPageObservers.$1(')
    if($Name -ceq 'Catalogue$1'){$next=$next.Replace('debounce$5(', 'HydraNexusPageDebounce(')}
    if($Name -ceq 'Modal$1'){$next=$next.Replace('reactDomExports.createPortal(', 'HydraNexusPagePortal(')}
    if($next -ceq $original){return $Text}
    $marker='/* HYDRA_NEXUS_TAB_SCOPE_V1:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($original))+' */'
    return $Text.Substring(0,$start)+$marker+$next+'/* HYDRA_NEXUS_TAB_SCOPE_END */'+$Text.Substring($start+$original.Length)
}
function Add-NexusCleanerScope([string]$Text,[string]$Name){
    $start=$Text.IndexOf('function '+$Name+'(')
    if($start -lt 0){throw ('Unsupported Hydra cleanup section: '+$Name+'. The archive was not replaced.')}
    $end=[regex]::Match($Text.Substring($start),'\r?\n__name\('+[regex]::Escape($Name)+',')
    if(!$end.Success){throw 'Unsupported Hydra cleanup boundary. The archive was not replaced.'}
    $original=$Text.Substring($start,$end.Index);$next=$original
    if($Name -ceq 'SidebarSection'){
        if(!$next.Contains('  title,') -or !$next.Contains('className: "sidebar-section",')){throw 'Unsupported Hydra sidebar section. The archive was not replaced.'}
        $next=$next.Replace('  title,','  nexusSection, title,').Replace('className: "sidebar-section",','className: "sidebar-section", "data-nexus-clean-section":nexusSection,')
    }else{
        $pairs=[ordered]@{}
        if($Name -ceq 'Sidebar$1'){$pairs=[ordered]@{'title: t2("achievements"),'='nexusSection:"achievements", title: t2("achievements"),';'title: achievementsCount > 0'='nexusSection:"achievements", title: achievementsCount > 0';'title: t2("stats"),'='nexusSection:"stats", title: t2("stats"),';'title: t2("requirements"),'='nexusSection:"requirements", title: t2("requirements"),'}}
        if($Name -ceq 'HowLongToBeatSection'){$pairs['title: "HowLongToBeat",']='nexusSection:"howLongToBeat", title: "HowLongToBeat",'}
        if($Name -ceq 'ControllerSupportSection'){$pairs['title: t2("controller_support"),']='nexusSection:"controller", title: t2("controller_support"),'}
        if($Name -ceq 'GameLanguageSection'){$pairs['title: t2("language"),']='nexusSection:"languages", title: t2("language"),'}
        if($Name -ceq 'Sidebar$1'){
          $pairs['howLongToBeatData: howLongToBeat.data,']='"data-nexus-layout-section":"howLongToBeat", howLongToBeatData: howLongToBeat.data,'
          $pairs['jsxRuntimeExports.jsx(ControllerSupportSection, {})']='jsxRuntimeExports.jsx(ControllerSupportSection, {"data-nexus-layout-section":"controller"})'
          $pairs['jsxRuntimeExports.jsx(GameLanguageSection, {})']='jsxRuntimeExports.jsx(GameLanguageSection, {"data-nexus-layout-section":"languages"})'
        }
        if($Name -ceq 'GameDetailsContent'){$pairs=[ordered]@{
          'jsxRuntimeExports.jsx(GallerySlider, {})'='jsxRuntimeExports.jsx(GallerySlider, {"data-nexus-layout-section":"gallery"})';
          'className: "game-details__description-title",'='"data-nexus-layout-section":"about", className: "game-details__description-title",';
          'ref: descriptionRef,'='"data-nexus-layout-section":"about", ref: descriptionRef,';
          'className: "game-details__description-toggle",'='"data-nexus-layout-section":"about", className: "game-details__description-toggle",';
          'objectId: catalogueGame.objectId,'='"data-nexus-layout-section":"similar", objectId: catalogueGame.objectId,';
          'ref: reviewsRef,'='"data-nexus-layout-section":"reviews", ref: reviewsRef,';
          'onYesClick: handleReviewPromptYes,'='"data-nexus-layout-section":"reviews", onYesClick: handleReviewPromptYes,'
        }}
        foreach($key in $pairs.Keys){if([regex]::Matches($next,[regex]::Escape($key)).Count -ne 1){throw ('Unsupported Hydra cleanup marker: '+$Name+' '+$key+'. The archive was not replaced.')};$next=$next.Replace($key,$pairs[$key])}
    }
    $marker='/* HYDRA_NEXUS_CLEANER_V1:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($original))+' */'
    return $Text.Substring(0,$start)+$marker+$next+'/* HYDRA_NEXUS_CLEANER_END */'+$Text.Substring($start+$original.Length)
}
function Add-NexusRendererHooks([string]$Text){
    $clean=Remove-NexusRendererHooks $Text
    if($clean.Contains('const injectCustomCss =')){
      foreach($entry in @('target.appendChild(link);','target.appendChild(style2);')){if([regex]::Matches($clean,[regex]::Escape($entry)).Count -ne 1){throw 'Unsupported Hydra community theme host. The archive was not replaced.'};$clean=$clean.Replace($entry,$entry+'/* HYDRA_NEXUS_INTERFACE_THEME_V1 */ window.__nexusInterface?.syncCommunityCSS(target);')}
    }
    $themeChoice='      if (currentTheme.code) {'
    if($clean.Contains($themeChoice)){$clean=$clean.Replace($themeChoice,'      /* HYDRA_NEXUS_THEME_CHOICE_V1 */ await window.__nexusInterface?.nativeThemeChosen?.();'+$themeChoice)}
    $entry='onClick: /* @__PURE__ */ __name(() => handleSidebarItemClick(path2), "onClick"),';if($clean.Contains($entry)){$clean=$clean.Replace($entry,'/* HYDRA_NEXUS_SETTINGS_DISCOVERY_V1 */ "data-nexus-settings-entry":path2==="/settings"?"":undefined,'+$entry)}
    if($clean -notmatch '\bhandleFriendsClick\b' -or $clean -notmatch 'sidebar-profile__dropdown-item'){throw 'Unsupported Hydra native interface. The archive was not replaced.'}
    $separator='jsxRuntimeExports\.jsx\("div", \{ className: "sidebar-profile__dropdown-separator" \}\)'
    if([regex]::Matches($clean,$separator).Count -ne 1){throw 'Unsupported Hydra account menu. The archive was not replaced.'}
    $result=[regex]::Replace($clean,$separator,'/* HYDRA_NEXUS_PRIVACY_MENU_V1 */ jsxRuntimeExports.jsx(HydraNexusInvisibleMenu, {}),$0')
    if($clean.Contains('function App$1(')){
        foreach($name in @('SidebarSection','Sidebar$1','HowLongToBeatSection','ControllerSupportSection','GameLanguageSection','GameDetailsContent')){$result=Add-NexusCleanerScope $result $name}
        foreach($required in @('function useOutlet(', 'const LocationContext =', 'var ReactReduxContext =', 'const store =')){if(!$clean.Contains($required)){throw 'Unsupported Hydra tab routing. The archive was not replaced.'}}
        $outlet='(className: "container__content",\s*children: /\* @__PURE__ \*/ jsxRuntimeExports\.jsx\()Outlet(, \{\})'
        if([regex]::Matches($result,$outlet).Count -ne 1){throw 'Unsupported Hydra page outlet. The archive was not replaced.'}
        $result=[regex]::Replace($result,$outlet,'$1/* HYDRA_NEXUS_TABS_OUTLET_V1 */ HydraNexusTabsOutlet$2')
        foreach($name in @('Catalogue$1','GameDetails','GameDetailsContent','GameDetailsContextProvider','useCatalogue','useLaunchboxFilters','useReviewPrompt','useUserReviewStatus','Hero$1','HeroPanelActions','HeroPanelPlaytime','Modal$1')){$result=Add-NexusTabPageScope $result $name}
    }
    $root='jsxRuntimeExports.jsx(BottomPanel, {})'
    if([regex]::Matches($result,[regex]::Escape($root)).Count -ne 1){throw 'Unsupported Hydra main interface. The archive was not replaced.'}
    $result=$result.Replace($root,'/* HYDRA_NEXUS_RELEASE_NOTES_V1 */ jsxRuntimeExports.jsx(HydraNexusReleaseNotes, {}),/* HYDRA_NEXUS_UPDATE_DIALOG_V1 */ jsxRuntimeExports.jsx(HydraNexusUpdateDialog, {}),/* HYDRA_NEXUS_TOOLS_DIALOG_V1 */ jsxRuntimeExports.jsx(HydraNexusToolsDialog, {}),'+$root)
    $hosts='(jsxRuntimeExports\.(?:jsx|jsxs)\()("(?:aside|div|ul|section)")(,\s*\{\s*)(className:\s*"(?:home__cards|game-details__description-content|content-sidebar|settings__sidebar|settings__panel|sidebar__menu|hero-panel__actions|hero-panel__content|game-details__hero|game-options-modal__container|game-options-modal__panel|game-options-modal__content|context-menu__list|catalogue-results-page|catalogue-grid|library__content|downloads__container|download-group__hero-buttons|download-group__hero-buttons)")'
    $matches=[regex]::Matches($result,$hosts)
    if($matches.Count -lt 5 -or $result -notmatch 'className: "settings__sidebar"'){throw 'Unsupported Hydra native interface hosts. The archive was not replaced.'}
    $result=[regex]::Replace($result,$hosts,[Text.RegularExpressions.MatchEvaluator]{param($m)
        $tag=$m.Groups[2].Value
        return $m.Groups[1].Value+'/* HYDRA_NEXUS_HOST_V1:'+$tag+' */ HydraNexusHost'+$m.Groups[3].Value+'/* HYDRA_NEXUS_HOST_TAG */ __nexusTag:'+$tag+','+$m.Groups[4].Value
    })
    if($clean.Contains('function GameDetailsContent(')){
      $gameSurface='jsxRuntimeExports.jsxs("div", { className: "game-details__description-container",'
      $gameSection='jsxRuntimeExports.jsxs("div", { className: "sidebar-section", "data-nexus-clean-section":nexusSection,'
      $gameStart=$result.IndexOf('function GameDetailsContent(');$gameEnd=$result.IndexOf('__name(GameDetailsContent,',$gameStart)
      if($gameStart -lt 0 -or $gameEnd -le $gameStart){throw 'Unsupported Hydra game boundary. The archive was not replaced.'}
      $gameBlock=$result.Substring($gameStart,$gameEnd-$gameStart)
      if([regex]::Matches($gameBlock,[regex]::Escape($gameSurface)).Count -ne 1 -or [regex]::Matches($result,[regex]::Escape($gameSection)).Count -ne 1){throw 'Unsupported Hydra game layout. The archive was not replaced.'}
      $gameBlock=$gameBlock.Replace($gameSurface,'jsxRuntimeExports.jsxs(/* HYDRA_NEXUS_GAME_SURFACE_V1 */ HydraNexusGameSurface, {/* HYDRA_NEXUS_GAME_PROPS_V1 */ nexusInLibrary:isGameInLibrary,nexusShop:shop,nexusObjectId:objectId, className: "game-details__description-container",')
      $result=$result.Substring(0,$gameStart)+$gameBlock+$result.Substring($gameEnd)
      $result=$result.Replace($gameSection,'jsxRuntimeExports.jsxs(/* HYDRA_NEXUS_GAME_SECTION_V1 */ HydraNexusGameSidebarSection, {/* HYDRA_NEXUS_GAME_SECTION_PROP_V1 */ nexusSection,/* HYDRA_NEXUS_GAME_MEASURE_V1 */ nexusOnMeasure:setHeight,nexusIsOpen:isOpen, className: "sidebar-section", "data-nexus-clean-section":nexusSection,')
      $review='    dismissPrompt({ persist: false });'
      if([regex]::Matches($result,[regex]::Escape($review)).Count -ne 1){throw 'Unsupported Hydra review action. The archive was not replaced.'}
      $result=$result.Replace($review,'/* HYDRA_NEXUS_REVIEW_SECTION_V1 */ document.dispatchEvent(new CustomEvent("nexus-game-section",{detail:{shop,objectId,section:"community"}}));'+$review)
      $achievementSurface='jsxRuntimeExports.jsx("div", { className: "achievements-content__achievements-list",'
      if([regex]::Matches($result,[regex]::Escape($achievementSurface)).Count -ne 1){throw 'Unsupported Hydra achievement layout. The archive was not replaced.'}
      $result=$result.Replace($achievementSurface,'jsxRuntimeExports.jsx(/* HYDRA_NEXUS_ACHIEVEMENTS_SURFACE_V1 */ HydraNexusAchievementsSurface, { className: "achievements-content__achievements-list",')
    }
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
    if($result.Contains('function Library()')){
      $libraryPattern='(jsxRuntimeExports\.jsxs\(\s*)"section"(,\s*\{\s*className: `library__content\$\{[^`]+`,)'
      if([regex]::Matches($result,$libraryPattern).Count -ne 1){throw 'Unsupported Hydra Library surface. The archive was not replaced.'}
      $result=[regex]::Replace($result,$libraryPattern,'$1/* HYDRA_NEXUS_LIBRARY_SURFACE_V1 */ HydraNexusLibrarySurface$2/* HYDRA_NEXUS_LIBRARY_GAMES_V1 */ nexusGames:filteredLibrary,')
      $cardStart=$result.IndexOf('function LibraryGameCard2(');$cardEnd=$result.IndexOf('const normalizePathForCss',$cardStart)
      if($cardStart -lt 0 -or $cardEnd -le $cardStart){throw 'Unsupported Hydra Library card boundary. The archive was not replaced.'}
      $card=$result.Substring($cardStart,$cardEnd-$cardStart)
      $cardPattern='(jsxRuntimeExports\.jsxs\(\s*)"button"(,\s*\{\s*type: "button",[\s\S]{0,450}?className: "library-game-card__wrapper",)'
      if([regex]::Matches($card,$cardPattern).Count -ne 1){throw 'Unsupported Hydra Library card. The archive was not replaced.'}
      $card=[regex]::Replace($card,$cardPattern,'$1/* HYDRA_NEXUS_LIBRARY_CARD_V1 */ HydraNexusLibraryCard$2/* HYDRA_NEXUS_LIBRARY_TITLE_V1 */ nexusTitle:game.title,')
      $result=$result.Substring(0,$cardStart)+$card+$result.Substring($cardEnd)
    }
    if($result.Contains('function Home$1(')){
      $nexusHomeRoute='jsxRuntimeExports.jsx(Home$1, {})'
      if([regex]::Matches($result,[regex]::Escape($nexusHomeRoute)).Count -ne 1){throw 'Unsupported Hydra Home route. The archive was not replaced.'}
      $result=$result.Replace($nexusHomeRoute,'/* HYDRA_NEXUS_DISCOVERY_HOME_V1 */ jsxRuntimeExports.jsx(HydraNexusInterfaceHome, {NativeHome:Home$1})')
    }
    if($result.Contains('function Hero$1(')){
      $heroStart=$result.IndexOf('function Hero$1(');$heroEnd=$result.IndexOf('__name(Hero$1,',$heroStart)
      if($heroEnd -lt 0){throw 'Unsupported Hydra featured game boundary. The archive was not replaced.'}
      $hero=$result.Substring($heroStart,$heroEnd-$heroStart)
      $heroPattern='"button"(,\s*\{\s*type: "button",\s*onClick:[\s\S]{0,160}?className: "hero",)'
      if([regex]::Matches($hero,$heroPattern).Count -ne 1){throw 'Unsupported Hydra featured game host. The archive was not replaced.'}
      $hero=[regex]::Replace($hero,$heroPattern,'/* HYDRA_NEXUS_INTERFACE_HERO_V1 */ HydraNexusInterfaceHero$1')
      $result=$result.Substring(0,$heroStart)+$hero+$result.Substring($heroEnd)
    }
    return "// === HYDRA_NEXUS_NATIVE_UI_START ===`n"+$source+"`ninstallNativeNexusCommit();`n// === HYDRA_NEXUS_NATIVE_UI_END ===`n"+$result
}
function Remove-NexusMediaCSP([string]$Text){
    return [regex]::Replace($Text,'<!-- HYDRA_NEXUS_MEDIA_CSP_V1:([A-Za-z0-9+/=]+) --><meta\b[^>]*>',[Text.RegularExpressions.MatchEvaluator]{param($m)
        return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($m.Groups[1].Value))
    },[Text.RegularExpressions.RegexOptions]::IgnoreCase)
}
function Add-NexusMediaCSP([string]$Text){
    $clean=Remove-NexusMediaCSP $Text
    $pattern='<meta\b(?=[^>]*\bhttp-equiv=["'']Content-Security-Policy["''])[^>]*>'
    $matches=[regex]::Matches($clean,$pattern,[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if($matches.Count -ne 1){throw 'Unsupported Hydra media policy. The archive was not replaced.'}
    $meta=$matches[0]
    $attribute=[regex]::Match($meta.Value,'\bcontent=(["''])(.*?)\1',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if(!$attribute.Success){throw 'Unsupported Hydra media policy. The archive was not replaced.'}
    $policy=$attribute.Groups[2].Value
    $media=[regex]::Match($policy,'(?:^|;)\s*media-src\s+([^;]*)',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if($media.Success){
        $values=$media.Groups[1].Value
        if(($values -split '\s+') -contains 'nexus-media:'){return $clean}
        $next=$values.Replace("'none'",'').Trim()+' nexus-media:'
        $policy=$policy.Substring(0,$media.Groups[1].Index)+$next+$policy.Substring($media.Groups[1].Index+$media.Groups[1].Length)
    }else{
        $default=[regex]::Match($policy,'(?:^|;)\s*default-src\s+([^;]*)',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if(!$default.Success){throw 'Unsupported Hydra media policy. The archive was not replaced.'}
        $policy=$policy.TrimEnd().TrimEnd(';')+'; media-src '+$default.Groups[1].Value.Replace("'none'",'').Trim()+' nexus-media:;'
    }
    $at=$attribute.Groups[2].Index
    $patched=$meta.Value.Substring(0,$at)+$policy+$meta.Value.Substring($at+$attribute.Groups[2].Length)
    $marker='<!-- HYDRA_NEXUS_MEDIA_CSP_V1:'+ [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($meta.Value))+' -->'
    return $clean.Substring(0,$meta.Index)+$marker+$patched+$clean.Substring($meta.Index+$meta.Length)
}
function Get-NexusRendererEdits($State,[string]$Archive,[string]$Operation){
    $found=0
    foreach($folder in @('out','dist')){
        $html=$State.Header.files.$folder.files.renderer.files.'index.html'
        if($html){
            if($html.unpacked -or $html.link){throw 'Unsupported Hydra renderer HTML. The archive was not replaced.'}
            $text=[Text.Encoding]::UTF8.GetString([HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$html.offset,[int]$html.size))
            $next=if($Operation -eq 'Install'){Add-NexusMediaCSP $text}else{Remove-NexusMediaCSP $text}
            if($next -cne $text){[pscustomobject]@{Folder=$folder;Name='index.html';Root=$true;Node=$html;Bytes=$utf8.GetBytes($next)}}
        }
        $assets=$State.Header.files.$folder.files.renderer.files.assets
        if(!$assets){continue}
        foreach($property in $assets.files.PSObject.Properties){
            $node=$property.Value
            if($property.Name -notmatch '\.js$' -or $node.unpacked -or $node.link -or $node.size -lt 1000){continue}
            $text=[Text.Encoding]::UTF8.GetString([HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$node.offset,[int]$node.size))
            if($text -notmatch 'sidebar-profile__dropdown-item' -and $text -notmatch 'HYDRA_NEXUS_NATIVE_UI_START'){continue}
            $found++
            if($found -gt 1){throw 'Ambiguous Hydra native interface. The archive was not replaced.'}
            # Add-NexusRendererHooks already removes the exact reversible hooks.
            # Avoid a duplicate full pass over the native renderer on every install.
            $next=if($Operation -eq 'Install'){Add-NexusRendererHooks $text}else{Remove-NexusRendererHooks $text}
            if($next -cne $text){[pscustomobject]@{Folder=$folder;Name=$property.Name;Node=$node;Bytes=$utf8.GetBytes($next)}}
        }
        foreach($obsoleteGuide in @('nexus-guide-steam-location.webp','nexus-guide-steam-modes.webp','nexus-invisible-mode.png','nexus-extract-path.png')){$assets.files.PSObject.Properties.Remove($obsoleteGuide)}
        $guideAssets=@(
            # __NEXUS_PLUGIN_GUIDE_ASSETS__
        )
        foreach($asset in $guideAssets){
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
        $node=if($edit.Legacy){$State.Files.($edit.Name)}elseif($edit.Root){$State.Header.files.($edit.Folder).files.renderer.files.($edit.Name)}else{$State.Header.files.($edit.Folder).files.renderer.files.assets.files.($edit.Name)}
        $bytes=[HydraSuiteAsar]::ReadFile($Archive,$State.Offset,[long]$node.offset,[int]$node.size)
        if((Get-Integrity $bytes).hash -ne (Get-Integrity $edit.Bytes).hash){throw 'Native interface verification failed. The original archive was not replaced.'}
    }
}
