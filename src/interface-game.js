// Quiet library details. Native components stay mounted in their original hierarchy.
// Sections are a presentation of Hydra's data and commands, not a second game router.
var HydraNexusGameLayoutContext;
function nexusGameLayoutContext(){
  return HydraNexusGameLayoutContext||(HydraNexusGameLayoutContext=reactExports$1.createContext(null));
}
function nexusGameSectionIcon(name){
  const R=reactExports$1,paths={overview:'M4 4h7v7H4zM15 4h5v5h-5zM4 15h5v5H4zM13 13h7v7h-7z',updates:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',about:'M12 8h.01M11 11h1v5h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',community:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 20v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',details:'M4 7h16M4 17h16M8 4v6M16 14v6'};
  return R.createElement('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:false},R.createElement('path',{d:paths[name]||paths.overview}));
}
function HydraNexusGameSurface({nexusInLibrary,nexusShop,nexusObjectId,children,...nativeProps}){
  const R=reactExports$1,design=useHydraNexusInterface(),active=design==='quiet';
  const context=R.useContext(gameDetailsContext),root=R.useRef(null),panel=R.useRef(null),lastSection=R.useRef(''),positions=R.useRef({}),keyboard=R.useRef(false),id=R.useId();
  const transition=R.useRef(null);
  const gameKey=String(nexusShop)+':'+String(nexusObjectId),defaultTab=/(?:[?&])reviews=true(?:&|$)/.test(location.hash+location.search)?'community':nexusInLibrary?'overview':'about';
  const [selection,setSelection]=R.useState(()=>({key:gameKey,tab:defaultTab}));
  const tab=selection.key===gameKey?selection.tab:defaultTab,tr=(key,values)=>window.__nexusI18n?.t(key,values)||key;
  const language=window.__nexusI18n?.language||'en',direction=window.__nexusI18n?.direction||'ltr';
  const tabs=[['overview','Overview'],['updates','Updates'],['about','About'],['community','Community'],['details','Details']];
  function change(next,fromKeyboard=false){
    if(!tabs.some(([name])=>name===next)||next===tab)return;
    const scroll=root.current?.closest('.container__content');if(scroll)positions.current[tab]=scroll.scrollTop;
    keyboard.current=fromKeyboard;setSelection({key:gameKey,tab:next});
  }
  R.useEffect(()=>{positions.current={};lastSection.current='';},[gameKey]);
  R.useEffect(()=>{
    const select=event=>{const detail=event.detail;if(active&&detail&&String(detail.shop)===String(nexusShop)&&String(detail.objectId)===String(nexusObjectId)){
      if(typeof reactDomExports?.flushSync==='function')reactDomExports.flushSync(()=>change(detail.section,true));else change(detail.section,true);
      requestAnimationFrame(()=>root.current?.querySelector('[data-nexus-layout-section=reviews],.game-details__reviews-section')?.scrollIntoView({block:'start'}));
    }};
    document.addEventListener('nexus-game-section',select);return()=>document.removeEventListener('nexus-game-section',select);
  },[active,nexusShop,nexusObjectId,tab]);
  R.useLayoutEffect(()=>{
    if(!active||!root.current)return;
    const scroll=root.current.closest('.container__content'),isChanged=lastSection.current&&lastSection.current!==tab;
    if(isChanged){
      // One compositor-only transition on the owned content. No per-frame React work.
      transition.current?.cancel();
      if(!keyboard.current)transition.current=panel.current?.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
      if(scroll){const top=root.current.offsetTop-scroll.offsetTop;scroll.scrollTop=positions.current[tab]??Math.max(0,top);}
    }
    keyboard.current=false;lastSection.current=tab;
    // Hidden media must not keep playing under another section. The native player
    // and its currentTime remain intact, and playback is never started for the user.
    for(const media of root.current.querySelectorAll('video,audio'))if(!media.getClientRects().length)media.pause();
  },[active,tab]);
  const achievements=Array.isArray(context?.achievements)?context.achievements:[];
  const title=context?.gameTitle||context?.game?.title||'';
  const value={active,tab,shop:nexusShop,objectId:nexusObjectId,achievements,title};
  const nav=R.createElement('div',{key:'navigation',className:'nexus-game-navigation',hidden:!active,lang:language,dir:direction},
    R.createElement('div',{role:'tablist','aria-label':tr('Game sections'),className:'nexus-game-tabs'},tabs.map(([name,label],index)=>R.createElement('button',{key:name,id:id+'-'+name,role:'tab',type:'button','aria-selected':tab===name,'aria-controls':id+'-panel',tabIndex:tab===name?0:-1,className:'nexus-game-tab',onClick:()=>change(name),onKeyDown:event=>{
      let target=index;if(event.key==='Home')target=0;else if(event.key==='End')target=tabs.length-1;else if(event.key==='ArrowRight')target=(index+(direction==='rtl'?-1:1)+tabs.length)%tabs.length;else if(event.key==='ArrowLeft')target=(index+(direction==='rtl'?1:-1)+tabs.length)%tabs.length;else return;
      event.preventDefault();change(tabs[target][0],true);document.getElementById(id+'-'+tabs[target][0])?.focus();
    }},nexusGameSectionIcon(name),R.createElement('span',null,tr(label))))));
  // The same native children occupy this fixed React position for both designs.
  // Turning Quiet off removes owned controls and CSS only, preserving editors,
  // native requirements selection, gallery state and every original handler.
  return R.createElement(nexusGameLayoutContext().Provider,{value},R.createElement('div',{...nativeProps,ref:root,'data-nexus-game-layout':active?'quiet':undefined,'data-nexus-game-tab':active?tab:undefined},nav,
    R.createElement('div',{key:'native-panel',ref:panel,className:'nexus-game-content',id:id+'-panel',role:active?'tabpanel':undefined,'aria-labelledby':active?id+'-'+tab:undefined},
      R.createElement('div',{className:'nexus-game-news-slot',hidden:!active,lang:language,dir:direction},active&&typeof HydraNexusGameUpdates==='function'?R.createElement(HydraNexusGameUpdates,{shop:nexusShop,objectId:nexusObjectId,compact:tab!=='updates',active:tab==='overview'||tab==='updates',onViewAll:()=>change('updates')}):null),
      R.createElement('div',{className:'nexus-game-achievements-empty',hidden:!active||achievements.length>0,lang:language,dir:direction},nexusGameSectionIcon('overview'),R.createElement('h2',null,tr('Achievements')),R.createElement('p',null,tr('No achievements available'))),
      R.createElement('div',{className:'nexus-game-community-empty',hidden:!active||nexusShop!=='custom',lang:language,dir:direction},nexusGameSectionIcon('community'),R.createElement('p',null,tr('No community reviews are available for this game.'))),
      R.createElement('div',{className:'nexus-game-developer',hidden:!active||!context?.shopDetails?.developers?.length,lang:language,dir:direction},R.createElement('span',null,tr('Developer')),R.createElement('strong',null,(context?.shopDetails?.developers||[]).join(' · '))),
      R.createElement('div',{className:'nexus-game-native-content'},children))));
}
function HydraNexusGameSidebarSection({nexusSection,nexusOnMeasure,nexusIsOpen,children,...nativeProps}){
  const R=reactExports$1,layout=R.useContext(nexusGameLayoutContext()),tr=(key,values)=>window.__nexusI18n?.t(key,values)||key;
  const root=R.useRef(null),measured=R.useRef(null),engaged=R.useRef(false);if(layout?.active)engaged.current=true;
  measured.current={open:nexusIsOpen,change:nexusOnMeasure};
  const measure=R.useCallback(()=>{const node=root.current,content=node?.querySelector(':scope > .sidebar-section__content'),state=measured.current;if(engaged.current&&node?.getClientRects().length&&content&&state?.open&&typeof state.change==='function')state.change(content.scrollHeight);},[]);
  R.useLayoutEffect(measure,[measure,layout?.active,layout?.tab,nexusIsOpen]);
  R.useEffect(()=>{if(typeof ResizeObserver!=='function'||!root.current)return;const observer=new ResizeObserver(measure);observer.observe(root.current);for(const child of root.current.querySelector(':scope > .sidebar-section__content')?.children||[])observer.observe(child);return()=>observer.disconnect();},[measure,children]);
  const achievements=layout?.achievements||[],total=achievements.length,unlocked=achievements.filter(item=>item.unlocked===true).length;
  const percent=total?Math.min(100,Math.max(0,Math.round(unlocked/total*100))):0;
  const summary=layout?.active&&nexusSection==='achievements'&&total?R.createElement('div',{className:'nexus-game-achievement-summary',lang:window.__nexusI18n?.language||'en',dir:window.__nexusI18n?.direction||'ltr'},
    R.createElement('div',{className:'nexus-game-achievement-heading'},R.createElement('h2',null,tr('Achievements')),R.createElement('strong',{className:'nexus-game-achievement-percent','aria-label':tr('{percent}% unlocked',{percent})},new Intl.NumberFormat(window.__nexusI18n?.language||'en',{style:'percent',maximumFractionDigits:0}).format(percent/100))),
    R.createElement('div',{className:'nexus-game-achievement-track',role:'progressbar','aria-label':tr('Achievement progress'),'aria-valuemin':0,'aria-valuemax':total,'aria-valuenow':unlocked,'aria-valuetext':tr('{unlocked} of {total} unlocked',{unlocked,total})},R.createElement('span',{style:{transform:'scaleX('+percent/100+')'}}))):null;
  // Keep native content instances and refs, but remove the collapse command from
  // Quiet's technical cards. Native mode gets its original controls/state back.
  const fixed=layout?.active&&nexusSection!=='achievements';
  const mapChildren=(items,fn)=>Array.isArray(items)?items.map(fn):fn(items);
  const presentation=fixed?mapChildren(children,child=>{
    if(!R.isValidElement(child))return child;
    if(child.props.className==='sidebar-section__header')return R.cloneElement(child,{},mapChildren(child.props.children,item=>{
      if(!R.isValidElement(item))return item;
      if(item.props.className==='sidebar-section__toggle')return null;
      if(item.props.className==='sidebar-section__button')return R.cloneElement(item,{className:'nexus-game-card-title'},R.Children.toArray(item.props.children).filter(label=>!R.isValidElement(label)||!String(label.props.className||'').includes('sidebar-section__chevron')));
      return item;
    }));
    if(child.props.className==='sidebar-section__content')return R.cloneElement(child,{style:{...child.props.style,maxHeight:'none'}});
    return child;
  }):children;
  return R.createElement('div',{...nativeProps,ref:root,'data-nexus-static-card':fixed?'':undefined},R.createElement(R.Fragment,{key:'nexus-summary'},summary),R.createElement(R.Fragment,{key:'native-section'},presentation));
}
if(typeof module!=='undefined')module.exports={HydraNexusGameSurface,HydraNexusGameSidebarSection,nexusGameSectionIcon};
