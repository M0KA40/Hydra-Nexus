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
    React.createElement('span',{className:'settings__sidebar-button-label'},labels[index]))));
}
function HydraNexusHost(props){
  const React=reactExports$1,{__nexusTag,children,...nativeProps}=props;
  React.useLayoutEffect(()=>{window.__nexusNativeCommit();});
  return nativeProps.className==='settings__sidebar'
    ?React.createElement(__nexusTag,nativeProps,children,React.createElement(HydraNexusSettingsGroup,{key:'hydra-nexus'}))
    :React.createElement(__nexusTag,nativeProps,children);
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
          React.createElement('h3',{style:{margin:0}},state.announcement.title),
          React.createElement('p',{style:{margin:0,lineHeight:1.7,opacity:0.85}},state.announcement.description)),
        React.createElement('article',{className:'nexus-release-notes',style:{overflowWrap:'anywhere',lineHeight:1.7},dangerouslySetInnerHTML:{__html:state.html}})),
      React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',gap:12,flexWrap:'wrap'}},
        React.createElement('button',{className:'button button--outline',onClick:()=>window.__nexusReleaseControl.open()},state.sourceLabel),
        React.createElement('button',{className:'button button--primary',onClick:()=>window.__nexusReleaseControl.dismiss()},state.closeLabel))));
}
function installNativeNexusCommit(){
  window.__nexusNativeHost=true;
  let scheduled=false;
  window.__nexusNativeCommit=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;document.dispatchEvent(new Event('nexus-native-commit'));});};
}
if(typeof module!=='undefined')module.exports={HydraNexusInvisibleMenu,HydraNexusSettingsGroup,HydraNexusHost,HydraNexusReleaseNotes,installNativeNexusCommit};
