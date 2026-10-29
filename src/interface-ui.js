// Native renderer components. No parallel router, catalogue fetch or game command.
function useHydraNexusInterface(){
  const R=reactExports$1;
  return R.useSyncExternalStore(R.useCallback(listener=>{document.addEventListener('nexus-interface',listener);document.addEventListener('nexus-language',listener);return()=>{document.removeEventListener('nexus-interface',listener);document.removeEventListener('nexus-language',listener);};},[]),R.useCallback(()=>(window.__nexusInterface?.design||'native')+'|'+(window.__nexusI18n?.language||'en'),[])).split('|')[0];
}
function HydraNexusInterfaceCards({tag='section',children,...props}){
  const R=reactExports$1,design=useHydraNexusInterface();
  if(design!=='quiet')return R.createElement(tag,props,children);
  const items=R.Children.toArray(children),groups=Array.from({length:Math.min(3,items.length)},()=>[]);
  items.forEach((item,index)=>groups[index%groups.length].push(item));
  return R.createElement(tag,{...props,'data-nexus-interface-cards':''},groups.map((cards,index)=>R.createElement('div',{className:'nexus-interface-game-group',key:index},cards)));
}
function HydraNexusInterfaceHero({children,...props}){
  const R=reactExports$1,design=useHydraNexusInterface(),tr=key=>window.__nexusI18n?.t(key)||key;
  return R.createElement('button',props,children,design==='quiet'?R.createElement('span',{className:'nexus-interface-hero-action','aria-hidden':true},tr('View game'),R.createElement(ArrowLeftIcon,{className:'nexus-interface-forward'})):null);
}
function HydraNexusInterfaceRailControls(){
  const R=reactExports$1,design=useHydraNexusInterface();
  const [expanded,setExpanded]=R.useState(false),filterFocus=R.useRef(false),tr=key=>window.__nexusI18n?.t(key)||key;
  R.useLayoutEffect(()=>{if(design==='quiet')document.documentElement.setAttribute('data-nexus-rail',expanded?'expanded':'collapsed');else document.documentElement.removeAttribute('data-nexus-rail');if(expanded&&filterFocus.current){filterFocus.current=false;document.querySelector('.sidebar__search-row input')?.focus();}},[design,expanded]);
  R.useEffect(()=>()=>document.documentElement.removeAttribute('data-nexus-rail'),[]);
  if(design!=='quiet')return null;
  const change=()=>setExpanded(value=>!value),brand=window.__hydraNexusUI?.getConfig().brandIcon;
  return R.createElement(R.Fragment,null,R.createElement('li',{className:'nexus-interface-rail-brand'},brand?R.createElement('img',{src:brand,alt:'Hydra Nexus'}):R.createElement(HomeIcon),R.createElement('button',{type:'button',className:'nexus-interface-rail-toggle','aria-label':tr(expanded?'Collapse navigation':'Expand navigation'),'aria-expanded':expanded,title:tr(expanded?'Collapse navigation':'Expand navigation'),onClick:change},R.createElement(expanded?ChevronLeftIcon:ChevronRightIcon))),R.createElement('li',{className:'sidebar__menu-item nexus-interface-library-filter'},R.createElement('button',{type:'button',className:'sidebar__menu-item-button',title:tr('Library filters'),'aria-label':tr('Library filters'),onClick:()=>{filterFocus.current=true;setExpanded(true);}},R.createElement(SlidersIcon),R.createElement('span',null,tr('Library filters')))));
}
function installNexusInterface(){
  if(window.__nexusInterface)return;
  let design='native',color='slate';const originals=new Map();
  const style=document.createElement('style');style.id='nexus-interface-style';style.textContent='__NEXUS_INTERFACE_CSS__';document.head.append(style);
  function syncCommunityCSS(target=document.head){
    // Hydra owns this exact node. Preserve its source, href, position and prior media.
    if(target!==document.head)return;
    const node=target.querySelector('#custom-css');
    if(design==='quiet'&&node){if(!originals.has(node))originals.set(node,node.getAttribute('media'));node.setAttribute('media','not all');}
    if(design!=='quiet')for(const [node,media]of originals){if(media===null)node.removeAttribute('media');else node.setAttribute('media',media);originals.delete(node);}
    for(const node of originals.keys())if(!node.isConnected)originals.delete(node);
  }
  function configure(value){
    const next=value?.schema===1&&value.design==='quiet'?'quiet':'native';
    const nextColor=value?.color==='mint'?'mint':'slate';
    if(next===design&&nextColor===color){syncCommunityCSS();return;}
    design=next;color=nextColor;
    if(design==='quiet'&&color==='mint')document.documentElement.setAttribute('data-nexus-color','mint');else document.documentElement.removeAttribute('data-nexus-color');
    if(design==='quiet')document.documentElement.setAttribute('data-nexus-interface','quiet');else document.documentElement.removeAttribute('data-nexus-interface');
    syncCommunityCSS();document.dispatchEvent(new Event('nexus-interface'));
  }
  window.__nexusInterface={nativeThemeChosen:async()=>{if(design==='quiet'){if(window.__hydraNexusUI?.selectNativeInterface)await window.__hydraNexusUI.selectNativeInterface();else configure({schema:1,design:'native'});}},supported:true,get design(){return design;},configure,syncCommunityCSS};
  window.addEventListener('pagehide',()=>{design='native';document.documentElement.removeAttribute('data-nexus-color');syncCommunityCSS();},{once:true});
}
if(typeof module!=='undefined')module.exports={installNexusInterface,HydraNexusInterfaceCards,HydraNexusInterfaceHero,HydraNexusInterfaceRailControls,useHydraNexusInterface};
