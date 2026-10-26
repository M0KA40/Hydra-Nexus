// Installed into Hydra's renderer. Components use Hydra's own React runtime.
function HydraNexusInvisibleMenu(){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-privacy',listener);return()=>document.removeEventListener('nexus-privacy',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusPrivacyControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  if(!state?.available)return null;
  const on=state.active;
  return React.createElement('button',{
    type:'button',className:'sidebar-profile__dropdown-item','data-nexus-invisible':'',
    'aria-pressed':on,'aria-label':state.label+' — '+state.status,title:state.title,
    disabled:state.disabled,onClick:()=>window.__nexusPrivacyControl.toggle(),dir:state.dir,lang:state.language,
    style:{gap:8}
  },React.createElement('svg',{
    width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,
    strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,'data-invisible-icon':on?'on':'off',
    style:{flexShrink:0,color:on?'var(--success-color, #58c58a)':'inherit',opacity:on?1:0.45,filter:on?'drop-shadow(0 0 3px currentColor)':'none'}
  },React.createElement('circle',{cx:12,cy:12,r:9}),
    on?React.createElement('path',{d:'m8 12 3 3 5-6'}):React.createElement('path',{d:'M8 12h8'})),
  React.createElement('span',null,state.label),React.createElement('small',{
    'data-invisible-status':'',style:{marginInlineStart:'auto',opacity:on?1:0.55,color:on?'var(--success-color, #58c58a)':'inherit'}
  },state.status));
}
function HydraNexusSettingsGroup(){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-settings',listener);return()=>document.removeEventListener('nexus-settings',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusSettingsControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  const labels=state?.labels||['Nexus','Plugins','Themes','Updater'];
  return React.createElement('div',{id:'nexus-settings-group',className:'nexus-settings-group',dir:state?.dir,lang:state?.language,'data-nexus-native':'settings'},
    React.createElement('div',{className:'nexus-settings-group-label'},'Hydra Nexus'),
    ...['general','plugins','themes','updater'].map((name,index)=>React.createElement('button',{
      key:name,type:'button',className:'settings__sidebar-button'+(state?.selected===name?' settings__sidebar-button--active':''),
      'data-nexus-tab':name,onClick:()=>window.__hydraNexusUI?.openSection(name)
    },React.createElement('span',{className:'settings__sidebar-button-icon','aria-hidden':true,dangerouslySetInnerHTML:{__html:state?.icons?.[name]||''}}),
    React.createElement('span',{className:'settings__sidebar-button-label'},labels[index]),name==='plugins'&&state?.hasNewPlugins?React.createElement('span',{className:'nexus-discovery-dot',role:'img','aria-label':state.newLabel}):null)));
}
function HydraNexusActivityLink(){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-config',listener);document.addEventListener('nexus-language',listener);return()=>{document.removeEventListener('nexus-config',listener);document.removeEventListener('nexus-language',listener);};},[]);
  const snapshot=React.useCallback(()=>window.__nexusReplay&&window.__hydraNexusUI?.getConfig().plugins.activity&&window.__hydraNexusUI?.getConfig().activityRecaps!==false?(window.__nexusI18n?.language||'en'):'',[]);
  const language=React.useSyncExternalStore(subscribe,snapshot,snapshot);if(!language)return null;
  const label=window.__nexusI18n?.t('Play activity')||'Play activity';
  return React.createElement('li',{id:'nexus-replay-link',className:'sidebar__menu-item'},React.createElement('button',{className:'sidebar__menu-item-button',type:'button',onClick:()=>window.__nexusReplay.open(),style:{display:'flex',alignItems:'center',gap:12,width:'100%'}},React.createElement('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},React.createElement('path',{d:'M4 20V4m0 16h16M8 16v-4m5 4V7m5 9v-6'})),React.createElement('span',null,label)));
}
function useHydraNexusTools(){const React=reactExports$1;return React.useSyncExternalStore(React.useCallback(listener=>{document.addEventListener('nexus-tools',listener);return()=>document.removeEventListener('nexus-tools',listener);},[]),React.useCallback(()=>window.__nexusToolsControl?.snapshot||null,[]));}
function HydraNexusStorageLink(){const state=useHydraNexusTools(),React=reactExports$1;if(!state?.storageEnabled)return null;return React.createElement('button',{type:'button',className:'settings__sidebar-button','data-nexus-storage-entry':'',onClick:()=>window.__nexusTools.open('storage'),lang:state.language,dir:state.dir},React.createElement('span',{className:'settings__sidebar-button-icon','aria-hidden':true},React.createElement('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6},React.createElement('path',{d:'M4 4h16v16H4zM4 14h16M8 17h.01M12 17h.01'}))),React.createElement('span',{className:'settings__sidebar-button-label'},window.__nexusI18n?.t('Game Storage Manager')||'Game Storage Manager'));}
function HydraNexusDownloadActions(){const state=useHydraNexusTools(),React=reactExports$1;if(!state?.finishEnabled)return null;const tr=key=>window.__nexusI18n?.t(key)||key;return React.createElement('div',{className:'nexus-download-tools',lang:state.language,dir:state.dir},state.armed&&React.createElement('small',null,tr('Action armed')),React.createElement(Button$1,{theme:'outline',className:'download-group__glass-btn',type:'button','data-nexus-finish-entry':'',onClick:()=>window.__nexusTools.open('finish')},tr('Download Finish Actions')));}
function HydraNexusToolsDialog(){const state=useHydraNexusTools(),React=reactExports$1,body=React.useRef(null);React.useLayoutEffect(()=>{if(body.current)window.__nexusTools?.afterRender(body.current);},[state]);React.useEffect(()=>{if(state?.countdown)body.current?.querySelector('[data-tool=cancelFinish]')?.focus();},[state?.countdown]);const tools=state?.page?React.createElement(Modal$1,{visible:true,title:state.title,large:state.page==='storage',onCloseStart:()=>window.__nexusTools.prepareClose(),onClose:()=>window.__nexusTools.close(),className:'nexus-tools-dialog nexus-tools-'+state.page},React.createElement('div',{ref:body,className:'nexus-tools-body',lang:state.language,dir:state.dir,onClick:event=>window.__nexusTools.click(event),dangerouslySetInnerHTML:{__html:state.html}})):null;return React.createElement(React.Fragment,null,tools,React.createElement(HydraNexusPluginDialog),React.createElement(HydraNexusBackupProfileDialog));}
function HydraNexusPluginDialog(){const React=reactExports$1,body=React.useRef(null);const state=React.useSyncExternalStore(React.useCallback(listener=>{document.addEventListener('nexus-plugin-dialog',listener);return()=>document.removeEventListener('nexus-plugin-dialog',listener);},[]),React.useCallback(()=>window.__nexusPluginControl?.snapshot||null,[]));React.useLayoutEffect(()=>{if(body.current)window.__nexusPluginDialog?.afterRender(body.current);},[state]);if(!state)return null;return React.createElement(Modal$1,{visible:true,title:state.title,large:true,onClose:()=>window.__nexusPluginDialog?.close(),className:'nexus-plugin-dialog'},React.createElement('div',{ref:body,className:'nexus-plugin-body nexus-section',lang:state.language,dir:state.dir,dangerouslySetInnerHTML:{__html:state.html}}));}
function HydraNexusBackupProfileDialog(){const React=reactExports$1,body=React.useRef(null);const state=React.useSyncExternalStore(React.useCallback(listener=>{document.addEventListener('nexus-backup-profile',listener);return()=>document.removeEventListener('nexus-backup-profile',listener);},[]),React.useCallback(()=>window.__hbkProfileControl?.snapshot||null,[]));React.useLayoutEffect(()=>{if(body.current)window.__hbkProfile?.afterRender(body.current);},[state]);if(!state)return null;return React.createElement(Modal$1,{visible:true,title:state.title,large:true,onClose:()=>window.__hbkProfile?.close(),className:'nexus-backup-profile'},React.createElement('div',{id:'hbk-profile-body',ref:body,lang:state.language,dir:state.dir,dangerouslySetInnerHTML:{__html:state.html}}));}
function HydraNexusHost(props){
  const React=reactExports$1,{__nexusTag,children,...nativeProps}=props;
  React.useLayoutEffect(()=>{window.__nexusNativeCommit();});
  if(nativeProps.className==='settings__sidebar'){const items=[];let inserted=false;React.Children.forEach(children,child=>{items.push(child);if(child?.key==='big_picture'){items.push(React.createElement(HydraNexusStorageLink,{key:'nexus-storage'}));inserted=true;}});if(!inserted)items.push(React.createElement(HydraNexusStorageLink,{key:'nexus-storage'}));return React.createElement(__nexusTag,nativeProps,...items,React.createElement(HydraNexusSettingsGroup,{key:'hydra-nexus'}));}
  if(nativeProps.className==='sidebar__menu')return React.createElement(__nexusTag,nativeProps,children,React.createElement(HydraNexusActivityLink));
  if(nativeProps.className==='download-group__hero-buttons')return React.createElement(__nexusTag,nativeProps,children,React.createElement(HydraNexusDownloadActions));
  return React.createElement(__nexusTag,nativeProps,children);
}
function HydraNexusReleaseNotes(){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-release-notes',listener);return()=>document.removeEventListener('nexus-release-notes',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusReleaseControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  if(!state)return null;
  return React.createElement(Modal$1,{visible:true,title:state.title,description:state.description,large:true,onClose:()=>window.__nexusReleaseControl.dismiss(),className:'nexus-installed-notes'},
    React.createElement('div',{lang:state.language,dir:state.dir,style:{display:'flex',flexDirection:'column',gap:20,minWidth:0}},
      React.createElement('div',{'data-nexus-notes-content':'',style:{maxHeight:'60vh',overflowY:'auto',overflowWrap:'anywhere',minWidth:0}},
        state.announcement&&React.createElement('section',{'data-nexus-announcement':'',style:{display:'flex',flexDirection:'column',gap:12,marginBottom:24}},
          React.createElement('img',{src:state.announcement.url,alt:state.announcement.alt,decoding:'async',style:{display:'block',width:'100%',height:'auto',borderRadius:12},onError:event=>{event.currentTarget.hidden=true;event.currentTarget.style.display='none';}}),
          state.announcement.title&&React.createElement('h3',{style:{margin:0}},state.announcement.title),
          state.announcement.description&&React.createElement('p',{style:{margin:0,lineHeight:1.7,opacity:0.85}},state.announcement.description)),
        React.createElement('article',{className:'nexus-release-notes',style:{overflowWrap:'anywhere',lineHeight:1.7},dangerouslySetInnerHTML:{__html:state.html}})),
      React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:12,flexWrap:'wrap'}},
        React.createElement('button',{className:'button button--outline',onClick:()=>window.__nexusReleaseControl.open()},state.sourceLabel),
        React.createElement('button',{className:'button button--primary',onClick:()=>window.__nexusReleaseControl.dismiss()},state.closeLabel))));
}
function HydraNexusUpdateDialog(){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-update-confirmation',listener);return()=>document.removeEventListener('nexus-update-confirmation',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusUpdateControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  React.useLayoutEffect(()=>{window.__nexusI18n?.controls?.(document.querySelector('.nexus-update-confirmation'));});
  const cancelRef=React.useRef(null);
  React.useEffect(()=>{if(state?.id)cancelRef.current?.focus();},[state?.id]);
  if(!state)return null;
  const reply=accepted=>window.__nexusUpdateControl.respond(accepted);
  return React.createElement(Modal$1,{visible:true,title:state.title,description:state.question,onClose:()=>reply(false),className:'nexus-update-confirmation'},
    React.createElement('div',{lang:state.language,dir:state.dir,style:{display:'flex',flexDirection:'column',gap:24,minWidth:0}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:16}},
        React.createElement('span',{'aria-hidden':true,style:{display:'grid',placeItems:'center',width:48,height:48,border:'1px solid currentColor',borderRadius:12,flexShrink:0,opacity:0.65}},
          React.createElement('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'},React.createElement('path',{d:'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4'}))),
        React.createElement('div',{style:{minWidth:0}},React.createElement('strong',{style:{fontSize:20}},'Hydra Nexus ',React.createElement('bdi',null,state.version)),React.createElement('p',{style:{margin:'6px 0 0',opacity:0.7,fontSize:13}},state.verifiedLabel))),
      React.createElement('ol',{className:'nexus-update-steps',style:{display:'flex',flexWrap:'wrap',gap:12,listStyle:'none',padding:0,margin:0}},
        ...state.steps.map((label,index)=>React.createElement('li',{key:index,style:{display:'flex',alignItems:'center',gap:10,flex:'1 1 140px',minWidth:0,padding:'14px 0',borderBlockStart:'1px solid rgba(128,128,128,.2)',fontSize:13}},
          React.createElement('span',{'aria-hidden':true,style:{display:'grid',placeItems:'center',width:24,height:24,border:'1px solid currentColor',borderRadius:'50%',opacity:0.6,flexShrink:0}},index+1),label))),
      React.createElement('p',{style:{margin:0,lineHeight:1.7,opacity:0.8}},state.description),
      React.createElement('details',{style:{fontSize:12,opacity:0.7,minWidth:0}},React.createElement('summary',{style:{cursor:'pointer',width:'fit-content'}},state.detailsLabel),
        React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:10,paddingTop:12,minWidth:0}},
          React.createElement('div',null,state.sourceLabel,' ',React.createElement('bdi',null,state.source)),
          React.createElement('code',{dir:'ltr',style:{display:'block',overflowWrap:'anywhere',userSelect:'text'}},'SHA-256: ',state.sha256))),
      React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:12,flexWrap:'wrap'}},
        React.createElement('button',{ref:cancelRef,type:'button',className:'button button--outline',disabled:state.pending,onClick:()=>reply(false)},state.cancelLabel),
        React.createElement('button',{type:'button',className:'button button--primary',disabled:state.pending,'aria-busy':state.pending||undefined,'data-nexus-pending':state.pending?'':undefined,onClick:()=>reply(true)},state.installLabel))));
}
// Uses exactly the native TextField and Button components, including theme CSS.
function HydraNexusExtractPath({downloadPath,enabled,disabled}){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-extract-path',listener);return()=>document.removeEventListener('nexus-extract-path',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusExtractControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  if(!state?.available)return null;
  return React.createElement(TextField,{
    value:state.path||downloadPath||'',readOnly:true,disabled:true,dir:'ltr',title:state.path||downloadPath||'',
    label:state.label,hint:state.hint,error:state.error||undefined,
    containerProps:{'data-nexus-extract-path':'',lang:state.language,dir:state.dir,style:{minWidth:0}},
    rightContent:React.createElement(Button$1,{type:'button',className:'download-settings-modal__change-path-button',theme:'outline',disabled:disabled||!enabled||state.pending||!!state.error&&!!window.__hydraNexusUI?.getConfig().extractPath?.error,'aria-busy':state.pending||undefined,onClick:()=>window.__nexusExtractControl.choose(downloadPath)},state.changeLabel)
  });
}
function HydraNexusDownloadButton({__nexusButton,...props}){
  const React=reactExports$1;
  const subscribe=React.useCallback(listener=>{document.addEventListener('nexus-extract-path',listener);return()=>document.removeEventListener('nexus-extract-path',listener);},[]);
  const snapshot=React.useCallback(()=>window.__nexusExtractControl?.snapshot||null,[]);
  const state=React.useSyncExternalStore(subscribe,snapshot,snapshot);
  return React.createElement(__nexusButton,{...props,disabled:props.disabled||!!state?.pending});
}
function installNativeNexusCommit(){
  window.__nexusNativeHost=true;
  // Runs at the start of the patched entry, before native theme preferences mount.
  // Only a boolean travels in the URL; paths and settings stay in the trusted bridge.
  if(new URLSearchParams(window.location.search).get('nexusBackground')==='1'&&!document.getElementById('nexus-background-startup')){
    document.documentElement.setAttribute('data-nexus-bg-pending','');
    const style=document.createElement('style');style.id='nexus-background-startup';style.textContent=`
      html[data-nexus-bg-pending] body{background:#101014!important}
      html[data-nexus-bg-pending] body:before,html[data-nexus-bg-pending] body:after{background-image:none!important;visibility:hidden!important}
      html[data-nexus-bg-pending] #root,html[data-nexus-bg-pending] #root>main,html[data-nexus-bg-pending] .container,html[data-nexus-bg-pending] .container__content,html[data-nexus-bg-pending] .settings__content{background-image:none!important;background-color:transparent!important}
      html[data-nexus-bg-pending] #root:before,html[data-nexus-bg-pending] #root:after,html[data-nexus-bg-pending] .container:before,html[data-nexus-bg-pending] .container:after{background-image:none!important;background-color:transparent!important}
    `;document.head.append(style);
  }
  let scheduled=false;
  window.__nexusNativeCommit=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;document.dispatchEvent(new Event('nexus-native-commit'));});};
}
if(typeof module!=='undefined')module.exports={HydraNexusToolsDialog,HydraNexusStorageLink,HydraNexusDownloadActions,HydraNexusInvisibleMenu,HydraNexusSettingsGroup,HydraNexusHost,HydraNexusReleaseNotes,HydraNexusUpdateDialog,HydraNexusExtractPath,HydraNexusDownloadButton,installNativeNexusCommit};
