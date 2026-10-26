// Runs in Hydra's renderer with its existing React, router and Redux instances.
function createNexusTabRuntime({React,useOutlet,LocationContext,Provider,store,createPortal,debounce:nativeDebounce,window:win}){
  const Context=React.createContext(null),pages=new Map(),listeners=new Set(),ownedTimers=new Map();
  let scope=null,pinned=new Set(),enabled=true,revision=0,current=null,held=false;
  const native={setTimeout:win.setTimeout.bind(win),clearTimeout:win.clearTimeout.bind(win),setInterval:win.setInterval.bind(win),clearInterval:win.clearInterval.bind(win),requestAnimationFrame:win.requestAnimationFrame.bind(win),cancelAnimationFrame:win.cancelAnimationFrame.bind(win)};
  const notify=()=>{revision++;for(const listener of listeners)listener();};
  const scrollInstant=(element,top,left=0)=>{if(element)element.scrollTo({top,left,behavior:'instant'});};
  function run(owner,callback){const previous=scope;scope=owner;try{return callback();}finally{scope=previous;}}
  function deliver(owner,callback){if(owner.closed)return;if(owner.active)return run(owner,callback);owner.pending.add(callback);}
  function scopedPromise(promise,owner){
    if(!promise||typeof promise.then!=='function')return promise;
    return {then(fulfilled,rejected){return scopedPromise(new Promise((resolve,reject)=>{promise.then(value=>deliver(owner,()=>{try{resolve(fulfilled?fulfilled(value):value);}catch(error){reject(error);}}),error=>deliver(owner,()=>{try{if(rejected)resolve(rejected(error));else reject(error);}catch(next){reject(next);}}));}),owner);},catch(rejected){return this.then(undefined,rejected);},finally(callback){return this.then(value=>Promise.resolve(callback()).then(()=>value),error=>Promise.resolve(callback()).then(()=>{throw error;}));}};
  }
  function resource(owner,start,stop){
    const item={start,stop,live:false,closed:false};owner.resources.add(item);
    item.resume=()=>{if(item.closed||item.live||!owner.active)return;item.live=true;start();};
    item.pause=()=>{if(!item.live)return;item.live=false;stop();};
    item.dispose=()=>{if(item.closed)return;item.pause();item.closed=true;owner.resources.delete(item);};
    item.resume();return item;
  }
  // Capture only timers created by a managed page effect or its callbacks.
  function timer(kind,callback,delay,args){
    const owner=scope;if(!owner||typeof callback!=='function')return native[kind](callback,delay,...args);if(owner.closed)return 0;
    let handle,id,item,remaining=Number(delay)||0,began=0;
    const fire=(...values)=>{if(!owner.active||owner.closed)return;if(kind!=='setInterval'){item.live=false;item.closed=true;owner.resources.delete(item);ownedTimers.delete(id);}return run(owner,()=>callback(...values));};
    item=resource(owner,()=>{began=Date.now();handle=kind==='requestAnimationFrame'?native.requestAnimationFrame(fire):native[kind](fire,remaining,...args);if(id===undefined){id=handle;ownedTimers.set(id,item);}},()=>{if(kind==='setTimeout')remaining=Math.max(0,remaining-(Date.now()-began));if(kind==='requestAnimationFrame')native.cancelAnimationFrame(handle);else native.clearTimeout(handle);});
    // An effect may enqueue a timer before the page's layout activation.
    if(id===undefined){id=native.setTimeout(()=>{},2147483647);native.clearTimeout(id);ownedTimers.set(id,item);}
    const dispose=item.dispose;item.dispose=()=>{dispose();ownedTimers.delete(id);};return id;
  }
  const domEvents=[];
  function domMethod(target,key){
    if(key==='addEventListener')return (name,callback,options)=>{
      const owner=scope;if(!owner||!callback)return target.addEventListener(name,callback,options);
      const capture=typeof options==='boolean'?options:!!options?.capture;
      if(domEvents.some(e=>e.target===target&&e.name===name&&e.callback===callback&&e.capture===capture))return;
      let item;const wrapped=event=>{if(!owner.active||owner.closed)return;if(options?.once)item.dispose();return run(owner,()=>typeof callback==='function'?callback.call(target,event):callback.handleEvent(event));};
      item=resource(owner,()=>target.addEventListener(name,wrapped,options),()=>target.removeEventListener(name,wrapped,options));
      const entry={target,name,callback,capture,item};domEvents.push(entry);const dispose=item.dispose;item.dispose=()=>{dispose();const index=domEvents.indexOf(entry);if(index>=0)domEvents.splice(index,1);};
    };
    if(key==='removeEventListener')return (name,callback,options)=>{const capture=typeof options==='boolean'?options:!!options?.capture,entry=domEvents.find(e=>e.target===target&&e.name===name&&e.callback===callback&&e.capture===capture);if(entry)entry.item.dispose();else target.removeEventListener(name,callback,options);};
    const value=target[key];return typeof value==='function'?value.bind(target):value;
  }
  const observers={};
  for(const name of ['IntersectionObserver','ResizeObserver','MutationObserver']){
    const NativeObserver=win[name];if(!NativeObserver)continue;
    observers[name]=class extends NativeObserver{
      constructor(callback,options){const owner=scope;super((...args)=>{if(!owner)return callback(...args);if(owner.active&&!owner.closed)return run(owner,()=>callback(...args));},options);if(!owner)return;this.__owner=owner;this.__targets=new Map();this.__attach();}
      __attach(){this.__resource=resource(this.__owner,()=>{for(const [target,settings]of this.__targets)super.observe(target,settings);},()=>super.disconnect());}
      observe(target,options){if(!this.__resource)return super.observe(target,options);if(this.__owner.closed)return;if(this.__resource.closed)this.__attach();this.__targets.set(target,options);if(this.__resource.live)super.observe(target,options);}
      unobserve(target){this.__targets?.delete(target);super.unobserve?.(target);}
      disconnect(){if(!this.__resource)return super.disconnect();this.__targets.clear();this.__resource.dispose();}
    };
  }
  const documentProxy=new Proxy({}, {get:(_target,key)=>domMethod(win.document,key)});
  const pageWindow=new Proxy({}, {get(_target,key){
    if(key==='document')return documentProxy;if(key==='electron')return electron;
    if(['setTimeout','setInterval'].includes(key))return (callback,delay,...args)=>timer(key,callback,delay,args);
    if(key==='requestAnimationFrame')return callback=>timer(key,callback,0,[]);
    if(['clearTimeout','clearInterval','cancelAnimationFrame'].includes(key))return id=>{const item=ownedTimers.get(id);if(item)item.dispose();else native[key](id);};
    return domMethod(win,key);
  }});
  function electronProxy(target){return new Proxy({}, {get(_unused,key){const value=target?.[key];if(typeof value==='object'&&value)return electronProxy(value);if(typeof value!=='function')return value;return (...args)=>{
    const owner=scope;if(!owner)return value.apply(target,args);if(owner.closed){if(key==='off')return;return scopedPromise(Promise.resolve(undefined),owner);}
    const callbackIndex=args.findLastIndex(arg=>typeof arg==='function');
    if(typeof key==='string'&&/^on[A-Z]/.test(key)&&callbackIndex>=0){
      const callback=args[callbackIndex],wrapped=(...values)=>{if(owner.active&&!owner.closed)return run(owner,()=>callback(...values));};let unsubscribe;
      const parameters=[...args];parameters[callbackIndex]=wrapped;
      const item=resource(owner,()=>{unsubscribe=value.apply(target,parameters);},()=>{if(typeof unsubscribe==='function')unsubscribe();unsubscribe=null;});
      item.refresh=()=>run(owner,()=>callback());item.event=key;return ()=>item.dispose();
    }
    if(key==='on'&&callbackIndex>=0&&typeof target.off==='function'){
      const callback=args[callbackIndex],parameters=[...args];parameters[callbackIndex]=(...values)=>{if(owner.active&&!owner.closed)return run(owner,()=>callback(...values));};
      const item=resource(owner,()=>value.apply(target,parameters),()=>target.off(...parameters));owner.nativeEvents.push({args,item});return;
    }
    if(key==='off'&&callbackIndex>=0){const entry=owner.nativeEvents.find(e=>e.args[0]===args[0]&&e.args[callbackIndex]===args[callbackIndex]);if(entry){entry.item.dispose();owner.nativeEvents.splice(owner.nativeEvents.indexOf(entry),1);return;}}
    return scopedPromise(value.apply(target,args),owner);
  };}});}
  const electron=electronProxy(win.electron);
  function effect(kind,setup,deps){const page=React.useContext(Context);React[kind](()=>{
    if(!page)return setup();let cleanup,started=false,disposed=false;
    const start=()=>{page.pending.delete(start);if(disposed||page.closed)return;started=true;cleanup=run(page,setup);};
    if(page.active)start();else page.pending.add(start);
    return ()=>{disposed=true;page.pending.delete(start);if(started&&typeof cleanup==='function')run(page,cleanup);};
  },deps);}
  function makePage(id){
    const page={id,active:false,closed:false,resources:new Set(),pending:new Set(),nativeEvents:[],element:win.document.createElement('div'),scroll:0,dirty:false};
    // Native modal backdrops belong at body level. Inside the page flex layout,
    // their absolute positioning uses the page's static position and gets clipped.
    page.overlays=win.document.createElement('div');page.overlays.dataset.nexusTabOverlays=id;page.overlays.style.display='contents';page.element.className='nexus-tab-page';page.element.style.display='contents';page.element.dataset.nexusPage=id;
    let state=store.getState(),unsubscribe=null;const subscribers=new Set();
    page.facade={...store,getState:()=>state,dispatch:action=>{if(page.closed)return action;if(!page.active){page.pending.add(()=>page.facade.dispatch(action));return action;}if(action?.type==='window/setHeaderTitle')page.title=action;return store.dispatch(action);},subscribe:listener=>{subscribers.add(listener);return()=>subscribers.delete(listener);}};
    const update=()=>{state=store.getState();for(const listener of subscribers)listener();};
    page.show=()=>{if(page.closed||page.active)return;page.active=true;unsubscribe=store.subscribe(update);update();if(page.title)store.dispatch(page.title);for(const [element,top,left]of page.scrollers||[])scrollInstant(element,top,left);for(const item of [...page.resources])item.resume();for(const callback of [...page.pending]){page.pending.delete(callback);run(page,callback);}if(page.dirty){page.dirty=false;for(const item of [...page.resources])if(item.event==='onLibraryBatchComplete')item.refresh();}for(const media of page.element.querySelectorAll('video,audio'))if(media.__nexusTabWasPlaying){delete media.__nexusTabWasPlaying;media.play().catch(()=>{});}};
    page.hide=()=>{if(!page.active)return;page.scroll=win.document.getElementById('scrollableDiv')?.scrollTop||0;page.scrollers=[...page.element.querySelectorAll('*')].filter(element=>element.scrollTop||element.scrollLeft).map(element=>[element,element.scrollTop,element.scrollLeft]);page.active=false;unsubscribe?.();unsubscribe=null;for(const item of [...page.resources])item.pause();for(const media of page.element.querySelectorAll('video,audio')){media.__nexusTabWasPlaying=!media.paused;media.pause();}page.element.remove();page.overlays.remove();};
    page.close=()=>{page.hide();page.closed=true;for(const item of [...page.resources])item.dispose();page.pending.clear();page.nativeEvents.length=0;subscribers.clear();page.scrollers=null;page.outlet=null;page.location=null;for(const media of page.element.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}page.element.remove();};
    return page;
  }
  const identity=pathname=>{const m=/^\/game\/([\w-]+)\/([\w.-]+)$/.exec(pathname);return m?m[1]+':'+m[2]:pathname==='/catalogue'?'route:catalogue':null;};
  function Outlet(){
    const outlet=useOutlet(),location=React.useContext(LocationContext),host=React.useRef(null),restore=React.useRef(null);React.useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>revision,()=>revision);
    const id=enabled?identity(location.location.pathname):null;
    if(id){let page=pages.get(id);if(!page){page=makePage(id);pages.set(id,page);}page.outlet=outlet;page.location=location;}
    for(const [key,page]of pages)if(!enabled||key!==id&&!pinned.has(key)){page.close();pages.delete(key);}
    React.useLayoutEffect(()=>{
      restore.current=null;
      for(const page of pages.values())if(held||page.id!==id)page.hide();current=id;
      const page=pages.get(id);if(page&&host.current&&!held){const activating=!page.active;if(page.element.parentNode!==host.current)host.current.append(page.element);if(page.overlays.parentNode!==win.document.body)win.document.body.append(page.overlays);page.show();if(activating){scrollInstant(win.document.getElementById('scrollableDiv'),page.scroll);restore.current=page;}}
      win.__nexusNativeCommit?.();
    },[id,location,revision]);
    // Hydra resets its shared scroll host in a parent passive effect on navigation.
    // Restore once after that effect; no polling or repeated load-more restoration.
    React.useEffect(()=>{const page=restore.current;if(!page)return;const handle=native.requestAnimationFrame(()=>{if(page.closed||!page.active)return;scrollInstant(win.document.getElementById('scrollableDiv'),page.scroll);for(const [element,top,left]of page.scrollers||[])scrollInstant(element,top,left);});return()=>native.cancelAnimationFrame(handle);},[id,location,revision]);
    React.useEffect(()=>()=>{for(const page of pages.values())page.close();pages.clear();current=null;},[]);
    return React.createElement('div',{ref:host,style:{display:'contents'},'data-nexus-tab-outlet':''},!id&&outlet,...[...pages.values()].map(page=>createPortal(React.createElement(Context.Provider,{value:page},React.createElement(LocationContext.Provider,{value:page.location},React.createElement(Provider,{store:page.facade},page.outlet))),page.element,page.id)));
  }
  let stopLibrary=null;
  const watchLibrary=()=>{if(!stopLibrary)stopLibrary=win.electron?.onLibraryBatchComplete?.(()=>{for(const page of pages.values())if(!page.active)page.dirty=true;});};watchLibrary();
  const api={hold(value){if(held===!!value)return;held=!!value;notify();},sync(keys,on=true){const next=new Set(on?keys.slice(0,16):[]);if(enabled===on&&next.size===pinned.size&&[...next].every(key=>pinned.has(key)))return;enabled=on;pinned=next;if(on)watchLibrary();else{stopLibrary?.();stopLibrary=null;}notify();},has:key=>pages.has(key),snapshot:()=>({pages:[...pages.values()].map(page=>({id:page.id,active:page.active,resources:page.resources.size,pending:page.pending.size,connected:page.element.isConnected})),ownedTimers:ownedTimers.size}),dispose(){for(const page of pages.values())page.close();pages.clear();stopLibrary?.();stopLibrary=null;listeners.clear();}};
  win.__nexusTabCache=api;return {Outlet,electron,pageWindow,observers,effect,api,debounce(callback,delay){const owner=React.useContext(Context);if(!owner&&nativeDebounce)return nativeDebounce(callback,delay);let id;const fn=(...args)=>{if(id!==undefined)pageWindow.clearTimeout(id);const schedule=()=>{id=pageWindow.setTimeout(()=>{id=undefined;callback(...args);},delay);};if(owner)run(owner,schedule);else schedule();};fn.cancel=()=>{if(id!==undefined)pageWindow.clearTimeout(id);id=undefined;};return fn;},Portal({children,target,keyValue}){const page=React.useContext(Context);return createPortal(children,page?page.overlays:target,keyValue);}};
}
let hydraNexusTabRuntime=null;
function getHydraNexusTabs(){return hydraNexusTabRuntime||(hydraNexusTabRuntime=createNexusTabRuntime({React:reactExports$1,useOutlet,LocationContext,Provider:Provider_default,store,createPortal:reactDomExports.createPortal,debounce:debounce$5,window}));}
function HydraNexusTabsOutlet(){return reactExports$1.createElement(getHydraNexusTabs().Outlet);}
function HydraNexusPageEffect(setup,deps){return getHydraNexusTabs().effect('useEffect',setup,deps);}
function HydraNexusPageLayoutEffect(setup,deps){return getHydraNexusTabs().effect('useLayoutEffect',setup,deps);}
const HydraNexusPageElectron=new Proxy({}, {get(_target,key){return hydraNexusTabRuntime?hydraNexusTabRuntime.electron[key]:window.electron[key];}});
function HydraNexusPageDebounce(callback,delay){return getHydraNexusTabs().debounce(callback,delay);}
function HydraNexusPagePortal(children,target,keyValue){return reactExports$1.createElement(getHydraNexusTabs().Portal,{target,keyValue},children);}
const HydraNexusPageWindow=new Proxy({}, {get(_target,key){return hydraNexusTabRuntime?hydraNexusTabRuntime.pageWindow[key]:window[key];}});
const HydraNexusPageDocument=new Proxy({}, {get(_target,key){return getHydraNexusTabs().pageWindow.document[key];}});
const HydraNexusPageObservers=new Proxy({}, {get(_target,key){return getHydraNexusTabs().observers[key];}});
if(typeof module!=='undefined')module.exports={createNexusTabRuntime};
