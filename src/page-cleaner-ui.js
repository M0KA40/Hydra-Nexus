function installPageCleaner(){
  if(window.__nexusPageCleaner||!window.__hydraNexusUI)return;
  const api=window.__hydraNexusUI,records=new Map();let members=new Set(),libraryReady=false,requestId=0,scheduled=false,observing=false,disposed=false;
  const middle={gallery:'.gallery-slider__container',about:'.game-details__description-title,.game-details__description,.game-details__description-toggle',similar:'.similar-games',reviews:'.game-details__reviews-section,.review-prompt-banner'};
  const style=document.createElement('style');style.id='nexus-page-cleaner-style';style.textContent='[data-nexus-clean-hidden="collapse"]{display:none!important}[data-nexus-clean-hidden="space"],[data-nexus-clean-hidden="space"] *{visibility:hidden!important;pointer-events:none!important}';document.head.append(style);
  const routeKey=()=>{const route=location.hash.slice(1)||location.pathname;const match=/^\/game\/([\w-]+)\/([\w.-]+)(?:[/?]|$)/.exec(route);return match?match[1]+':'+match[2]:null;};
  function restore(el){const saved=records.get(el);if(!saved)return;el.removeAttribute('data-nexus-clean-hidden');for(const key of ['inert','aria-hidden'])saved[key]===null?el.removeAttribute(key):el.setAttribute(key,saved[key]);records.delete(el);}
  function hide(el,mode){if(!records.has(el))records.set(el,{'inert':el.getAttribute('inert'),'aria-hidden':el.getAttribute('aria-hidden')});if(el.getAttribute('data-nexus-clean-hidden')!==mode){el.setAttribute('data-nexus-clean-hidden',mode);el.setAttribute('inert','');el.setAttribute('aria-hidden','true');for(const video of el.querySelectorAll('video,audio'))video.pause();}}
  function reconcile(){
    scheduled=false;if(disposed)return;const cfg=api.getConfig(),active=cfg.plugins.pageCleaner===true,wanted=new Map();
    if(active)for(const root of document.querySelectorAll('.game-details__wrapper:not(.game-details__skeleton)')){
      const key=root.closest('[data-nexus-page]')?.dataset.nexusPage||routeKey();if(!key)continue;
      for(const [section,scope]of Object.entries(cfg.pageCleaner||{})){
        if(scope!=='all'&&!(scope==='library'&&libraryReady&&members.has(key)))continue;
        if(middle[section])for(const el of root.querySelectorAll(middle[section]))wanted.set(el,'space');
        else if(section==='otherSidebar'){for(const el of root.querySelectorAll('.content-sidebar > :not([data-nexus-clean-section])'))wanted.set(el,'collapse');}
        else for(const el of root.querySelectorAll('[data-nexus-clean-section="'+section+'"]'))wanted.set(el,'collapse');
      }
    }
    for(const el of records.keys())if(!wanted.has(el)||!el.isConnected)restore(el);
    for(const [el,mode]of wanted)hide(el,mode);
    if(active&&!observing){observer.observe(document.body,{subtree:true,childList:true});observing=true;}
    if(!active&&observing){observer.disconnect();observing=false;}
  }
  function schedule(){if(disposed||scheduled)return;scheduled=true;queueMicrotask(reconcile);}
  const observer=new MutationObserver(changes=>{if(changes.some(change=>change.target.closest?.('.game-details__wrapper')||[...change.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('.game-details__wrapper')||node.querySelector?.('.game-details__wrapper')))))schedule();});
  async function refreshLibrary(){const generation=++requestId;if(!api.getConfig().plugins.pageCleaner){schedule();return;}try{const result=await api.request('pageCleanerLibrary');if(generation!==requestId||disposed)return;members=new Set(result.keys);libraryReady=true;}catch{if(generation!==requestId)return;members.clear();libraryReady=false;}schedule();}
  const configChanged=()=>{schedule();refreshLibrary();};
  document.addEventListener('nexus-library-change',refreshLibrary);document.addEventListener('nexus-config',configChanged);document.addEventListener('nexus-native-commit',schedule);window.addEventListener('hashchange',configChanged);window.addEventListener('popstate',configChanged);
  const unsubscribe=window.electron?.onLibraryBatchComplete?.(refreshLibrary);
  window.__nexusPageCleaner={reconcile,refreshLibrary,dispose(){disposed=true;requestId++;observer.disconnect();for(const el of [...records.keys()])restore(el);style.remove();document.removeEventListener('nexus-library-change',refreshLibrary);document.removeEventListener('nexus-config',configChanged);document.removeEventListener('nexus-native-commit',schedule);window.removeEventListener('hashchange',configChanged);window.removeEventListener('popstate',configChanged);unsubscribe?.();delete window.__nexusPageCleaner;}};
  window.addEventListener('pagehide',()=>window.__nexusPageCleaner?.dispose(),{once:true});configChanged();
}
if(typeof module!=='undefined')module.exports=installPageCleaner;
