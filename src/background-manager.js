function createBackgroundManager({shouldPlay,changed,finishStartup}){
  let active=null,candidate=null,layer=null,generation=0,configured=null,state='ready';
  const requests=new WeakMap();
  const errors={read:'The background file could not be read. Choose the file again.',decode:'The video could not be decoded. Try another H.264 MP4 or WebM file.',format:'This video format is unsupported. Try an H.264 MP4 or WebM file.',image:'The background image could not be loaded. Choose the file again.',cancel:'Background selection was cancelled.',timeout:'The background did not finish loading. Try another file.'};
  function report(next,message=''){state=next;changed(message,next);}
  function pause(item){const media=item?.media;if(media?.tagName!=='VIDEO')return;const pending=requests.has(media);requests.delete(media);if(pending||!media.paused)media.pause();}
  function dispose(item){if(!item||item.disposed)return;item.disposed=true;clearTimeout(item.timer);item.cleanup?.();pause(item);item.media.removeAttribute('src');if(item.media.tagName==='VIDEO')item.media.load();item.media.remove();}
  function ensureLayer(){if(layer?.isConnected)return;layer=document.createElement('div');layer.id='nexus-wallpaper-layer';layer.setAttribute('aria-hidden','true');document.body.prepend(layer);}
  function paint(){if(!active||active.failed)return;ensureLayer();layer.style.display='block';document.body.dataset.nexusBg='on';finishStartup();layer.style.setProperty('--nexus-darkness',String(active.background.opacity));active.media.style.filter=active.background.blur>0?'blur('+active.background.blur+'px)':'none';}
  function sync(){
    if(!active||active.failed)return;const item=active,media=item.media;if(media.tagName!=='VIDEO')return;
    if(!shouldPlay(item.background)){pause(item);if(item.ready)state='paused';return;}
    if(!media.paused||requests.has(media))return;
    const request={};requests.set(media,request);
    Promise.resolve().then(()=>{if(active!==item||item.disposed||requests.get(media)!==request||!shouldPlay(item.background))return;return media.play();}).then(()=>{if(active===item&&!shouldPlay(item.background))pause(item);}).catch(error=>{if(active!==item||item.disposed||requests.get(media)!==request||!shouldPlay(item.background)||error?.name==='AbortError')return;report('failed','Video playback was blocked or the format is unsupported. Try an H.264 MP4 or WebM file.');}).finally(()=>{if(requests.get(media)===request)requests.delete(media);});
  }
  function promote(item){if(item.disposed)return;const previous=active;active=item;if(candidate===item)candidate=null;for(const name of ['position','width','height','opacity'])item.media.style.removeProperty(name);item.media.id='nexus-wallpaper';ensureLayer();layer.prepend(item.media);item.media.style.visibility=item.ready?'visible':'hidden';if(previous!==item)dispose(previous);paint();report(item.ready?'ready':'loading',item.ready?'':'Loading background…');sync();}
  function cancel(){if(!candidate)return;const item=candidate;candidate=null;item.reject?.(Object.assign(Error(errors.cancel),{name:'AbortError'}));dispose(item);if(!active){layer?.remove();layer=null;}}
  function fail(item,message){
    if(item.disposed)return;
    if(candidate===item){candidate=null;item.reject?.(Error(message));dispose(item);if(active)paint();else{layer?.remove();layer=null;}report(active?.ready?'ready':'failed',message);return;}
    if(active!==item)return;pause(item);item.failed=true;layer.style.display='none';document.body.removeAttribute('data-nexus-bg');finishStartup();report('failed',message);
  }
  function create(background,staged){
    const item={background:{...background},media:document.createElement(background.type==='video'?'video':'img'),generation:++generation,ready:false,retries:0,staged,disposed:false};
    const media=item.media,video=background.type==='video';media.style.visibility='hidden';
    if(video){media.muted=true;media.loop=true;media.autoplay=false;media.playsInline=true;media.preload='auto';}
    const loaded=()=>{
      if(item.disposed||(active!==item&&candidate!==item))return;
      if(video&&media.readyState<2)return;if(!video&&!media.naturalWidth)return;
      // loadeddata means the current frame is decoded, including while paused/inactive.
      clearTimeout(item.timer);item.ready=true;item.failed=false;media.style.visibility='visible';
      if(item.resumeTime!==undefined){try{media.currentTime=item.resumeTime;}catch{}delete item.resumeTime;}
      if(candidate===item){if(item.staged){pause(item);item.resolve?.();}else promote(item);}
      else{paint();report('ready');sync();}
    };
    const error=()=>{
      if(item.disposed||(active!==item&&candidate!==item))return;
      const code=media.error?.code;
      if(code===1)return;
      if(active===item&&video&&code===2&&item.retries++===0){pause(item);item.resumeTime=media.currentTime;item.ready=false;report('recovering','Loading background…');media.load();item.timer=setTimeout(()=>fail(item,errors.read),20000);sync();return;}
      fail(item,video?(code===2?errors.read:code===3?errors.decode:errors.format):errors.image);
    };
    const play=()=>{if(active!==item||!shouldPlay(item.background))pause(item);else state='playing';};
    media.addEventListener(video?'loadeddata':'load',loaded);media.addEventListener('error',error);if(video)media.addEventListener('play',play);
    item.cleanup=()=>{media.removeEventListener(video?'loadeddata':'load',loaded);media.removeEventListener('error',error);media.removeEventListener('play',play);};
    item.timer=setTimeout(()=>fail(item,errors.timeout),30000);
    return item;
  }
  function apply(background){
    const identity=background?.url||null;configured=identity;
    if(!background){cancel();dispose(active);active=null;layer?.remove();layer=null;document.body.removeAttribute('data-nexus-bg');finishStartup();report('ready');return;}
    if(!document.querySelector('.sidebar'))return;
    if(active?.background.url===identity){active.background={...background};paint();sync();return;}
    if(candidate?.background.url===identity&&candidate.ready){candidate.background={...background};candidate.staged=false;promote(candidate);return;}
    if(candidate?.background.url===identity)return;
    cancel();const item=create(background,false);
    if(!active){active=item;item.media.id='nexus-wallpaper';ensureLayer();layer.prepend(item.media);paint();report('loading','Loading background…');}
    else{candidate=item;ensureLayer();layer.append(item.media);}
    item.media.src=background.url;if(active===item)sync();
  }
  async function validate(background){
    cancel();const item=create(background,true);candidate=item;ensureLayer();layer.append(item.media);
    // The prior background remains visible and playing until persistence succeeds.
    item.media.style.position='absolute';item.media.style.width='1px';item.media.style.height='1px';item.media.style.opacity='0';
    try{await new Promise((resolve,reject)=>{item.resolve=resolve;item.reject=reject;item.media.src=background.url;});if(candidate!==item||item.disposed)throw Object.assign(Error(errors.cancel),{name:'AbortError'});}
    catch(error){if(candidate===item)candidate=null;dispose(item);throw error;}
  }
  return {apply,validate,cancel,sync,dispose(){cancel();dispose(active);active=null;layer?.remove();layer=null;},get state(){return state;},get media(){return active?.media;}};
}
if(typeof module!=='undefined')module.exports=createBackgroundManager;
else window.__nexusCreateBackgroundManager=createBackgroundManager;
