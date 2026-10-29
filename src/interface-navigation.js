// Quiet navigation reuses Hydra's sidebar tree, commands and account component.
// Only owned attributes and the active indicator are changed; no DOM is moved.
function HydraNexusInterfaceNavigationControls(){
  const R=reactExports$1,design=useHydraNexusInterface(),location2=useLocation(),host=R.useRef(null),indicator=R.useRef(null);
  R.useLayoutEffect(()=>{
    if(design!=='quiet')return;
    const root=document.documentElement,previous=root.getAttribute('data-nexus-header-search');
    // Keep the native field and its query; only its route-specific presentation changes.
    root.setAttribute('data-nexus-header-search',/^\/(?:settings|downloads)(?:\/|$)/.test(location2.pathname)?'hidden':'visible');
    return()=>{if(previous===null)root.removeAttribute('data-nexus-header-search');else root.setAttribute('data-nexus-header-search',previous);};
  },[design,location2.pathname]);
  R.useLayoutEffect(()=>{
    if(design!=='quiet'||!host.current)return;
    const menu=host.current.closest('.sidebar__menu'),sidebar=menu?.closest('.sidebar'),frame=sidebar?.parentElement;
    if(!menu||!sidebar||!frame)return;
    const previousRail=document.documentElement.getAttribute('data-nexus-rail'),previousFrame=frame.getAttribute('data-nexus-top-frame'),previousRole=sidebar.getAttribute('role'),previousBrandSpace=menu.style.getPropertyValue('--nexus-top-brand-space');
    document.documentElement.setAttribute('data-nexus-rail','top');frame.setAttribute('data-nexus-top-frame','');sidebar.setAttribute('role','navigation');
    let animationFrame=0;
    function measure(){
      cancelAnimationFrame(animationFrame);animationFrame=requestAnimationFrame(()=>{
        const active=menu.querySelector('.sidebar__menu-item--active > .sidebar__menu-item-button, #hbk-nav-item.active button, #hbk-nav-item[aria-current="page"] button');
        const marker=indicator.current;
        if(!marker)return;
        const brand=host.current.getBoundingClientRect();menu.style.setProperty('--nexus-top-brand-space',String(brand.width+10)+'px');
        if(!active){marker.style.opacity='0';return;}
        const rect=active.getBoundingClientRect(),base=menu.getBoundingClientRect();
        marker.style.width=rect.width+'px';marker.style.height=rect.height+'px';marker.style.transform='translate('+String(rect.left-base.left)+'px,'+String(rect.top-base.top)+'px)';marker.style.opacity='1';
      });
    }
    const observer=new MutationObserver(measure);observer.observe(menu,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-current']});
    const resize=new ResizeObserver(measure);resize.observe(menu);resize.observe(sidebar);
    const keys=event=>{
      if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!event.target.matches('.sidebar__menu-item-button'))return;
      const buttons=[...menu.querySelectorAll(':scope > .sidebar__menu-item > .sidebar__menu-item-button')].filter(button=>!button.disabled&&button.getClientRects().length);
      const index=buttons.indexOf(event.target);if(index<0)return;
      const rtl=getComputedStyle(menu).direction==='rtl',step=(event.key==='ArrowRight'?1:-1)*(rtl?-1:1);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+step+buttons.length)%buttons.length;
      event.preventDefault();buttons[next]?.focus();
    };
    const profileEscape=event=>{if(event.key==='Escape'&&event.target.closest('.sidebar-profile')&&sidebar.querySelector('.sidebar-profile__dropdown:not(.sidebar-profile__dropdown--closing)')){event.preventDefault();const button=sidebar.querySelector('.sidebar-profile__button');button?.click();button?.focus();}};
    menu.addEventListener('keydown',keys);sidebar.addEventListener('keydown',profileEscape);document.addEventListener('nexus-language',measure);window.addEventListener('resize',measure);measure();
    return()=>{
      cancelAnimationFrame(animationFrame);observer.disconnect();resize.disconnect();menu.removeEventListener('keydown',keys);sidebar.removeEventListener('keydown',profileEscape);document.removeEventListener('nexus-language',measure);window.removeEventListener('resize',measure);
      if(previousRail===null)document.documentElement.removeAttribute('data-nexus-rail');else document.documentElement.setAttribute('data-nexus-rail',previousRail);
      if(previousFrame===null)frame.removeAttribute('data-nexus-top-frame');else frame.setAttribute('data-nexus-top-frame',previousFrame);
      if(previousRole===null)sidebar.removeAttribute('role');else sidebar.setAttribute('role',previousRole);
      if(previousBrandSpace)menu.style.setProperty('--nexus-top-brand-space',previousBrandSpace);else menu.style.removeProperty('--nexus-top-brand-space');
    };
  },[design]);
  if(design!=='quiet')return null;
  const brand=typeof HydraIconUrl==='string'?HydraIconUrl:typeof hydraIconUrl$2!=='undefined'?String(hydraIconUrl$2):null;
  return R.createElement(R.Fragment,null,
    R.createElement('li',{className:'nexus-top-brand',ref:host},brand?R.createElement('img',{src:brand,alt:'Hydra',width:36,height:36}):null,R.createElement('span',null,R.createElement('strong',null,'Hydra'))),
    R.createElement('li',{ref:indicator,className:'nexus-top-indicator','aria-hidden':true}));
}
if(typeof module!=='undefined')module.exports={HydraNexusInterfaceNavigationControls};
