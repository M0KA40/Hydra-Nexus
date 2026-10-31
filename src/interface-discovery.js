// Quiet discovery uses the native router and a bounded, cached main-process feed.
// No storefront purchase/download actions or synthetic popularity statistics.
const nexusDiscoveryTitles={new:'New on Steam',popular:'Popular on Steam',upcoming:'Coming soon',hot:'Trending in Hydra',weekly:'This week in Hydra',achievements:'Games to discover'};
function nexusDiscoveryGame(raw){
  if(!raw||!/^\d{1,12}$/.test(String(raw.objectId??raw.id??''))||typeof(raw.title??raw.name)!=='string')return null;
  const image=value=>{if(typeof value!=='string'||value.length>4096)return null;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
  return {...raw,objectId:String(raw.objectId??raw.id),shop:'steam',title:String(raw.title??raw.name).slice(0,240),libraryImageUrl:image(raw.libraryImageUrl??raw.header_image),libraryHeroImageUrl:image(raw.libraryHeroImageUrl??raw.large_capsule_image??raw.libraryImageUrl??raw.header_image),logoUrl:image(raw.logoUrl),portraitImageUrl:image(raw.portraitImageUrl??raw.libraryCapsuleImageUrl),description:typeof(raw.shortDescription??raw.description)==='string'?String(raw.shortDescription??raw.description).replace(/<[^>]*>/g,'').slice(0,420):'',genres:Array.isArray(raw.genres)?raw.genres.filter(v=>typeof v==='string').slice(0,6):[],downloadSources:Array.isArray(raw.downloadSources)?raw.downloadSources.filter(v=>typeof v==='string').slice(0,8):[]};
}
function nexusDiscoveryNormalize(value){
  const sections=(Array.isArray(value?.sections)?value.sections:[]).slice(0,8).map(section=>{
    const seen=new Set(),games=(Array.isArray(section.games)?section.games:[]).map(nexusDiscoveryGame).filter(game=>game&&!seen.has(game.objectId)&&seen.add(game.objectId));
    return {id:String(section.id||'').replace(/[^a-z_-]/g,'').slice(0,32),titleKey:nexusDiscoveryTitles[section.id]||'Games to discover',games:games.slice(0,20)};
  }).filter(section=>section.games.length);
  const pool=sections.flatMap(section=>section.games),seen=new Set();
  const featured=(Array.isArray(value?.featured)&&value.featured.length?value.featured:pool).map(nexusDiscoveryGame).filter(game=>game&&!seen.has(game.objectId)&&seen.add(game.objectId)).slice(0,6);
  return {sections,featured,updatedAt:Number.isFinite(value?.updatedAt)?value.updatedAt:0,stale:!!value?.stale,source:value?.source==='Steam'?'Steam':'Hydra',fallback:!!value?.fallback,enriching:!!value?.enriching,revision:Number.isFinite(value?.revision)?value.revision:0};
}
const nexusDiscoveryMemory=new Map();
function nexusDiscoveryLoad(language,refresh=false){
  let entry=nexusDiscoveryMemory.get(language);
  if(entry?.pending)return entry.pending;
  if(!refresh&&entry?.value&&(!entry.value.enriching||Date.now()-entry.time<1000)&&Date.now()-entry.time<15*60*1000)return Promise.resolve(entry.value);
  entry=entry||{};nexusDiscoveryMemory.set(language,entry);
  entry.pending=Promise.resolve().then(async()=>{
    try{
      if(!window.__nexusDiscovery?.load)throw Error('Steam discovery unavailable');
      const value=nexusDiscoveryNormalize(await window.__nexusDiscovery.load({language,refresh}));
      if(!value.sections.length)throw Error('Steam discovery unavailable');
      entry.value=value;entry.time=Date.now();return value;
    }catch(error){
      // Keep last usable discovery visible through a temporary network failure.
      if(entry.value)return {...entry.value,stale:true};
      const get=window.electron?.hydraApi?.get;
      if(typeof get!=='function')throw error;
      let ids=[];
      try{const sources=await levelDBService.values('downloadSources');ids=sources.map(source=>source.id);}catch{}
      const categories=['hot','weekly','achievements'];
      const results=await Promise.allSettled(categories.map(id=>get.call(window.electron.hydraApi,'/catalogue/'+id,{params:{take:12,skip:0,downloadSourceIds:ids},needsAuth:false})));
      const value=nexusDiscoveryNormalize({source:'Hydra',fallback:true,sections:categories.map((id,index)=>({id,games:results[index].status==='fulfilled'?results[index].value:[]}))});
      if(!value.sections.length)throw error;
      entry.value=value;entry.time=Date.now();return value;
    }
  }).finally(()=>{entry.pending=null;});
  return entry.pending;
}
function HydraNexusDiscoveryIcon({kind='next',...props}){
  const R=reactExports$1,path=kind==='pause'?'M8 5v14M16 5v14':kind==='play'?'M9 5l10 7-10 7V5':kind==='refresh'?'M20 7v5h-5M19 12a7 7 0 1 0-2 5':kind==='previous'?'M15 5l-7 7 7 7':'M9 5l7 7-7 7';
  return R.createElement('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,...props},R.createElement('path',{d:path}));
}
// Wide game-page artwork is shared across every Home image; capsules are fallback only.
const nexusDiscoveryArtworkCache=new Map(),nexusDiscoveryArtworkQueue=[];let nexusDiscoveryArtworkActive=0;
function nexusDiscoveryArtwork(game){
  const key=game.shop+':'+game.objectId,saved=nexusDiscoveryArtworkCache.get(key);
  if(saved&&Date.now()-saved.time<(saved.value?6*60*60*1000:60000))return saved.promise;
  const entry={time:Date.now(),value:null,promise:null};
  entry.promise=new Promise(resolve=>nexusDiscoveryArtworkQueue.push({game,entry,resolve}));
  nexusDiscoveryArtworkCache.set(key,entry);if(nexusDiscoveryArtworkCache.size>600)nexusDiscoveryArtworkCache.delete(nexusDiscoveryArtworkCache.keys().next().value);
  const drain=()=>{while(nexusDiscoveryArtworkActive<3&&nexusDiscoveryArtworkQueue.length){const job=nexusDiscoveryArtworkQueue.shift();nexusDiscoveryArtworkActive++;
    let deadline;const timeout=new Promise(resolve=>deadline=setTimeout(()=>resolve(null),4000));
    const request=Promise.resolve().then(()=>window.__nexusWindowState?.visible===false?null:window.electron?.getGameAssets?.(job.game.objectId,job.game.shop));
    Promise.race([request,timeout]).then(assets=>{
      const url=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!/\.(?:mp4|webm|m3u8)(?:$|\?)/i.test(u.href)?u.href:null;}catch{return null;}};
      if(assets&&(!assets.objectId||String(assets.objectId)===job.game.objectId)&&(!assets.shop||assets.shop===job.game.shop))job.entry.value={libraryImageUrl:url(assets.libraryHeroImageUrl)||url(job.game.libraryHeroImageUrl)||url(job.game.libraryImageUrl)||url(assets.libraryImageUrl),libraryHeroImageUrl:url(assets.libraryHeroImageUrl)||url(job.game.libraryHeroImageUrl)||url(job.game.libraryImageUrl),portraitImageUrl:url(job.game.portraitImageUrl)||url(assets.coverImageUrl),logoUrl:url(assets.logoImageUrl)};
    }).catch(()=>{}).finally(()=>{if(!job.entry.value)job.entry.value={libraryImageUrl:job.game.libraryHeroImageUrl||job.game.libraryImageUrl||null,libraryHeroImageUrl:job.game.libraryHeroImageUrl||job.game.libraryImageUrl||null,portraitImageUrl:job.game.portraitImageUrl||null,logoUrl:job.game.logoUrl||null};clearTimeout(deadline);job.entry.time=Date.now();job.resolve(job.entry.value);nexusDiscoveryArtworkActive--;drain();});
  }};drain();return entry.promise;
}
function HydraNexusDiscoveryImage({game,hero=false,portrait=false,...props}){
  const R=reactExports$1,[assets,setAssets]=R.useState(null),[attempt,setAttempt]=R.useState(0),host=R.useRef(null);
  R.useLayoutEffect(()=>{let alive=true,observer;setAssets(null);setAttempt(0);const load=()=>{observer?.disconnect();nexusDiscoveryArtwork(game).then(value=>{if(alive)setAssets(value);});};
    if(hero||typeof IntersectionObserver==='undefined')load();else{observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();},{rootMargin:'300px'});if(host.current)observer.observe(host.current);}
    return()=>{alive=false;observer?.disconnect();};
  },[game.shop,game.objectId,hero]);
  const preferred=assets?.libraryHeroImageUrl||assets?.libraryImageUrl,choices=[...new Set([preferred,assets?.libraryImageUrl].filter(Boolean))],src=choices[attempt];
  if(!src)return R.createElement('span',{...props,ref:host,className:(props.className||'')+' nexus-discovery-image-fallback','aria-hidden':true},R.createElement('span',null,game.title));
  return R.createElement('img',{...props,ref:host,src,alt:'',loading:hero?'eager':'lazy',fetchPriority:hero?'high':'auto',decoding:'async','data-nexus-image-kind':'landscape',onError:()=>setAttempt(value=>value+1)});
}
function HydraNexusDiscoveryLogo({game}){
  const R=reactExports$1,[src,setSrc]=R.useState(null);
  R.useLayoutEffect(()=>{let alive=true;setSrc(null);nexusDiscoveryArtwork(game).then(value=>{if(alive)setSrc(value?.logoUrl||null);});return()=>{alive=false;};},[game.shop,game.objectId]);
  return src?R.createElement('img',{className:'nexus-discovery-feature-logo',src,alt:'',decoding:'async',onError:()=>setSrc(null)}):null;
}
function HydraNexusDiscoveryCarousel({games,open,tr,onActiveChange}){
  const R=reactExports$1,h=R.createElement,[active,setActive]=R.useState(0),[previous,setPrevious]=R.useState(null),[pending,setPending]=R.useState(null),[direction,setDirection]=R.useState(1),[paused,setPaused]=R.useState(false),[hovered,setHovered]=R.useState(false),[focused,setFocused]=R.useState(false),[visible,setVisible]=R.useState(!document.hidden&&window.__nexusWindowState?.visible!==false),[onscreen,setOnscreen]=R.useState(true),timer=R.useRef(null),previousTimer=R.useRef(null),region=R.useRef(null),activeRef=R.useRef(0),restoreCardFocus=R.useRef(false),pendingRef=R.useRef(null),generation=R.useRef(0),mounted=R.useRef(true),artwork=R.useRef(new Map());
  const current=games[active%games.length];
  R.useEffect(()=>onActiveChange?.(current),[current.objectId,current.libraryHeroImageUrl,onActiveChange]);
  // The next card is committed only after its actual image is decoded (or all
  // supplied sources fail). These bounded jobs are cancelled when Home closes.
  const prepare=R.useCallback(index=>{
    const game=games[index],key=[game.objectId,game.libraryHeroImageUrl,game.libraryImageUrl].join('|');
    if(artwork.current.has(key))return artwork.current.get(key);
    const job={src:null,settled:false,cancel:null,promise:null};
    job.promise=new Promise(resolve=>{
      let image=null,timeout=null,cancelled=false,attempt=0;
      let choices=[];
      const finish=src=>{if(job.settled)return;job.src=src;job.settled=true;clearTimeout(timeout);if(image){image.onload=null;image.onerror=null;}resolve(job);};
      const next=()=>{
        if(job.settled)return;
        if(cancelled||!choices[attempt]){finish(null);return;}
        const src=choices[attempt++];image=new Image();image.decoding='async';
        image.onload=()=>{const loaded=image;Promise.resolve().then(()=>loaded.decode?.()).then(()=>{if(!cancelled&&loaded.naturalWidth)finish(src);else next();},next);};
        image.onerror=next;image.src=src;
      };
      job.cancel=()=>{cancelled=true;if(image){image.onload=null;image.onerror=null;image.src='';}finish(null);};
      timeout=setTimeout(()=>{if(image){image.onload=null;image.onerror=null;image.src='';}finish(null);},12000);nexusDiscoveryArtwork(game).then(assets=>{if(cancelled||job.settled)return;choices=[...new Set([assets?.libraryHeroImageUrl,assets?.libraryImageUrl].filter(Boolean))];next();});
    });
    artwork.current.set(key,job);return job;
  },[games]);
  const select=R.useCallback(index=>{
    const next=((index%games.length)+games.length)%games.length,request=++generation.current;
    if(next===activeRef.current){pendingRef.current=null;setPending(null);return;}
    pendingRef.current=next;setPending(next);
    prepare(next).promise.then(()=>{
      if(!mounted.current||request!==generation.current)return;
      setDirection((next-activeRef.current+games.length)%games.length<=games.length/2?1:-1);
      restoreCardFocus.current=region.current?.querySelector('.nexus-discovery-feature:not(.nexus-discovery-feature--leaving)')===document.activeElement;
      setPrevious(activeRef.current);activeRef.current=next;pendingRef.current=null;setPending(null);setActive(next);
      clearTimeout(previousTimer.current);previousTimer.current=setTimeout(()=>setPrevious(null),640);
    });
  },[games.length,prepare]);
  R.useLayoutEffect(()=>{if(restoreCardFocus.current){restoreCardFocus.current=false;region.current?.querySelector('.nexus-discovery-feature:not(.nexus-discovery-feature--leaving)')?.focus({preventScroll:true});}},[active]);
  R.useEffect(()=>{if(!visible)return;prepare(active);if(games.length>1)prepare((active+1)%games.length);},[active,prepare,games.length,visible]);
  R.useEffect(()=>{const changed=()=>setVisible(!document.hidden&&window.__nexusWindowState?.visible!==false);document.addEventListener('visibilitychange',changed);document.addEventListener('nexus-window-state',changed);return()=>{document.removeEventListener('visibilitychange',changed);document.removeEventListener('nexus-window-state',changed);};},[]);
  R.useEffect(()=>{const observer=new IntersectionObserver(entries=>setOnscreen(!!entries[0]?.isIntersecting));if(region.current)observer.observe(region.current);return()=>observer.disconnect();},[]);
  R.useEffect(()=>{if(visible)return;setHovered(false);generation.current++;pendingRef.current=null;setPending(null);setPrevious(null);clearTimeout(previousTimer.current);for(const [key,job]of artwork.current){if(!job.settled){job.cancel?.();artwork.current.delete(key);}}},[visible]);
  const running=!paused&&!hovered&&!focused&&visible&&onscreen&&pending===null&&games.length>1;
  R.useEffect(()=>{clearTimeout(timer.current);if(running)timer.current=setTimeout(()=>{if(region.current?.isConnected&&region.current.getClientRects().length)select((active+1)%games.length);},6500);return()=>clearTimeout(timer.current);},[active,running,select]);
  R.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;clearTimeout(timer.current);clearTimeout(previousTimer.current);for(const job of artwork.current.values())job.cancel?.();artwork.current.clear();};},[]);
  const slide=(game,leaving)=>{
    const cached=artwork.current.get([game.objectId,game.libraryHeroImageUrl,game.libraryImageUrl].join('|'));
    const art=cached?.settled?(cached.src?h('img',{src:cached.src,alt:'',decoding:'async',className:'nexus-discovery-feature-art'}):h('span',{className:'nexus-discovery-feature-art nexus-discovery-image-fallback','aria-hidden':true},game.title)):h(HydraNexusDiscoveryImage,{game,hero:true,className:'nexus-discovery-feature-art'});
    return h('button',{key:game.objectId+(leaving?'-previous':''),type:'button',className:'nexus-discovery-feature'+(leaving?' nexus-discovery-feature--leaving':'')+(game.logoUrl?' nexus-discovery-feature--with-logo':''),onClick:()=>open(game),tabIndex:leaving?-1:0,'aria-hidden':leaving||undefined,'aria-label':tr('View game')+': '+game.title},
      h('span',{className:'nexus-discovery-feature-media'},h('span',{className:'nexus-discovery-feature-backwash','aria-hidden':true,style:{backgroundImage:'url('+JSON.stringify(cached?.src||'')+')'}}),art),
      h('span',{className:'nexus-discovery-feature-copy'},h('span',{className:'nexus-discovery-eyebrow'},tr('Featured discovery')),h(HydraNexusDiscoveryLogo,{game}),h('strong',{className:'nexus-discovery-feature-title'},game.title),game.description?h('span',{className:'nexus-discovery-feature-description'},game.description):null,game.genres?.length?h('span',{className:'nexus-discovery-feature-genres'},game.genres.slice(0,3).map(genre=>h('span',{key:genre},genre))):null,h('span',{className:'nexus-discovery-feature-action'},tr('View game'),h(HydraNexusDiscoveryIcon,{}))));
  };
  const peek=step=>{const index=(active+step+games.length)%games.length,game=games[index];return h('button',{type:'button',className:'nexus-discovery-peek nexus-discovery-peek--'+(step<0?'previous':'next'),'aria-label':tr(step<0?'Previous slide':'Next slide')+': '+game.title,onClick:()=>select(index)},h(HydraNexusDiscoveryImage,{game,className:'nexus-discovery-peek-art'}),h('span',null,game.title));};
  return h('section',{className:'nexus-discovery-carousel',ref:region,'aria-label':tr('Featured games'),'aria-busy':pending!==null,'data-running':running,'data-pending':pending!==null,style:{'--nexus-slide-direction':direction*(window.__nexusI18n?.direction==='rtl'?-1:1)},onMouseEnter:()=>setHovered(true),onMouseLeave:()=>setHovered(false),onPointerDownCapture:()=>setFocused(false),onFocusCapture:event=>setFocused(event.target.matches(':focus-visible')),onBlurCapture:event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);},onKeyDown:event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const rtl=window.__nexusI18n?.direction==='rtl',next=event.key==='ArrowRight'?!rtl:rtl;select((pendingRef.current??activeRef.current)+(next?1:-1));}}},
    h('div',{className:'nexus-discovery-carousel-heading'},h('span',{className:'nexus-discovery-eyebrow'},tr('Featured games')),h('span',{className:'nexus-discovery-prepare',role:'status'},pending!==null?h('span',{className:'nexus-discovery-loader','aria-hidden':true}):null,pending!==null?tr('Loading discoveries…'):null)),
    h('div',{className:'nexus-discovery-deck'},games.length>1?peek(-1):null,h('div',{className:'nexus-discovery-feature-stage'},previous!==null&&games[previous]?slide(games[previous],true):null,slide(current,false)),games.length>1?peek(1):null),
    h('div',{className:'nexus-discovery-carousel-toolbar'},h('div',{className:'nexus-discovery-filmstrip','aria-label':tr('Choose featured game')},games.map((game,index)=>h('button',{key:game.objectId,type:'button',className:'nexus-discovery-thumbnail','aria-pressed':active===index,'aria-busy':pending===index,'aria-label':game.title,onClick:()=>select(index)},h(HydraNexusDiscoveryImage,{game,className:'nexus-discovery-thumbnail-art'}),h('span',null,game.title),active===index?h('i',{key:game.objectId+'-'+running,className:'nexus-discovery-dwell','aria-hidden':true,style:{animationPlayState:running?'running':'paused'}}):null))),h('div',{className:'nexus-discovery-carousel-controls'},h('button',{type:'button',className:'nexus-discovery-icon-button','aria-label':tr('Previous slide'),disabled:games.length<2,onClick:()=>select((pendingRef.current??activeRef.current)-1)},h(HydraNexusDiscoveryIcon,{kind:'previous'})),h('span',{className:'nexus-discovery-slide-count','aria-live':paused||focused?'polite':'off'},String(active+1).padStart(2,'0'),' / ',String(games.length).padStart(2,'0')),h('button',{type:'button',className:'nexus-discovery-icon-button','aria-label':tr('Next slide'),disabled:games.length<2,onClick:()=>select((pendingRef.current??activeRef.current)+1)},h(HydraNexusDiscoveryIcon,{})),h('button',{type:'button',className:'nexus-discovery-icon-button','aria-label':tr(paused?'Resume slideshow':'Pause slideshow'),'aria-pressed':paused,onClick:()=>setPaused(value=>!value)},h(HydraNexusDiscoveryIcon,{kind:paused?'play':'pause'})))));
}
function HydraNexusDiscoveryGameCard({game,open,tr,portrait=false,variant=''}){
  const R=reactExports$1,h=R.createElement;
  return h('button',{type:'button',className:'nexus-discovery-game'+(portrait?' nexus-discovery-game--portrait':'')+(variant?' nexus-discovery-game--'+variant:''),'aria-label':tr('View game')+': '+game.title,onClick:()=>open(game)},h('span',{className:'nexus-discovery-game-art-wrap'},h(HydraNexusDiscoveryImage,{game,portrait,className:'nexus-discovery-game-art'}),h('span',{className:'nexus-discovery-game-open','aria-hidden':true},h(HydraNexusDiscoveryIcon,{}))),h('span',{className:'nexus-discovery-game-copy'},h('strong',null,game.title),h('span',{className:'nexus-discovery-game-meta'},game.genres?.length?game.genres.slice(0,2).join(' · '):'Steam'),variant==='spotlight'&&game.description?h('span',{className:'nexus-discovery-game-description'},game.description):null,variant==='spotlight'?h('span',{className:'nexus-discovery-game-details'},tr('View game'),h(HydraNexusDiscoveryIcon,{})):null));
}
function HydraNexusDiscoveryShelf({section,open,tr,index,portrait=false}){
  const R=reactExports$1,h=R.createElement,row=R.useRef(null),[position,setPosition]=R.useState({start:true,end:false}),heading=R.useId();portrait=portrait&&section.games.filter(game=>game.portraitImageUrl).length>=3;
  const measure=R.useCallback(()=>{const el=row.current;if(!el)return;const offset=Math.abs(el.scrollLeft),max=el.scrollWidth-el.clientWidth;setPosition(before=>{const next={start:offset<2,end:offset>=max-2};return before.start===next.start&&before.end===next.end?before:next;});},[]);
  R.useLayoutEffect(()=>{measure();const observer=new ResizeObserver(measure);if(row.current)observer.observe(row.current);return()=>observer.disconnect();},[measure,section.games.length]);
  const move=direction=>{const el=row.current;if(!el)return;el.scrollBy({left:direction*el.clientWidth*.82*(window.__nexusI18n?.direction==='rtl'?-1:1),behavior:'smooth'});};
  return h('section',{className:'nexus-discovery-shelf'+(portrait?' nexus-discovery-shelf--portrait':''),'aria-labelledby':heading,style:{'--nexus-shelf-index':index}},h('div',{className:'nexus-discovery-shelf-heading'},h('h2',{id:heading},tr(section.titleKey)),h('div',{className:'nexus-discovery-shelf-controls'},h('button',{type:'button',className:'nexus-discovery-icon-button',disabled:position.start,'aria-label':tr('Previous games'),onClick:()=>move(-1)},h(HydraNexusDiscoveryIcon,{kind:'previous'})),h('button',{type:'button',className:'nexus-discovery-icon-button',disabled:position.end,'aria-label':tr('More games'),onClick:()=>move(1)},h(HydraNexusDiscoveryIcon,{})))),h('div',{className:'nexus-discovery-shelf-track',ref:row,onScroll:measure},section.games.map(game=>h(HydraNexusDiscoveryGameCard,{key:game.objectId,game,open,tr,portrait}))));
}
function HydraNexusDiscoveryEditorial({games,open,tr}){
  const R=reactExports$1,h=R.createElement,items=games.slice(0,4),heading=R.useId();if(items.length<3)return null;
  return h('section',{className:'nexus-discovery-editorial','aria-labelledby':heading},h('div',{className:'nexus-discovery-shelf-heading'},h('h2',{id:heading},tr('Featured games'))),h('div',{className:'nexus-discovery-editorial-board'},items.slice(0,2).map(game=>h(HydraNexusDiscoveryGameCard,{key:game.objectId,game,open,tr,variant:'spotlight'})),h('div',{className:'nexus-discovery-editorial-stack'},items.slice(2,4).map(game=>h(HydraNexusDiscoveryGameCard,{key:game.objectId,game,open,tr,variant:'compact'})))));
}
function HydraNexusDiscoveryGenres({sections,open,tr}){
  const R=reactExports$1,h=R.createElement,all=[...new Map(sections.flatMap(s=>s.games).map(g=>[g.objectId,g])).values()],groups=new Map();
  for(const game of all)for(const genre of game.genres||[]){if(!groups.has(genre))groups.set(genre,[]);groups.get(genre).push(game);}
  const chosen=[...groups.entries()].filter(([,games])=>games.length>=3).sort((a,b)=>b[1].length-a[1].length).slice(0,2);if(!chosen.length)return null;
  return h('section',{className:'nexus-discovery-genre-groups','aria-label':tr('Games to discover')},chosen.map(([genre,games])=>h('section',{key:genre,className:'nexus-discovery-genre-group'},h('h2',null,genre),h('div',{className:'nexus-discovery-genre-grid'},games.slice(0,4).map(game=>h(HydraNexusDiscoveryGameCard,{key:game.objectId,game,open,tr,variant:'genre'}))))));
}
function HydraNexusDiscoveryCollection({sections,open,openCatalogue,tr}){
  const R=reactExports$1,h=R.createElement,[selected,setSelected]=R.useState(sections.find(section=>section.id==='popular')?.id||sections[0]?.id),[inspect,setInspect]=R.useState(null),identity=R.useId(),tabs=R.useRef(null);
  const active=sections.find(section=>section.id===selected)||sections[0],preview=active?.games.find(game=>game.objectId===inspect)||active?.games[0];
  const choose=(id,focus=false)=>{setSelected(id);setInspect(null);if(focus)requestAnimationFrame(()=>tabs.current?.querySelector('[data-discovery-category="'+id+'"]')?.focus());};
  if(!active)return null;
  return h('section',{className:'nexus-discovery-collection','aria-labelledby':identity+'-heading'},h('div',{className:'nexus-discovery-collection-heading'},h('h2',{id:identity+'-heading'},tr('Games to discover')),h('div',{className:'nexus-discovery-category-pills',role:'tablist',ref:tabs,'aria-label':tr('Games to discover'),onKeyDown:event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const index=sections.findIndex(section=>section.id===active.id),rtl=window.__nexusI18n?.direction==='rtl',step=(event.key==='ArrowRight'?1:-1)*(rtl?-1:1),next=event.key==='Home'?0:event.key==='End'?sections.length-1:(index+step+sections.length)%sections.length;event.preventDefault();choose(sections[next].id,true);}},sections.map(section=>h('button',{key:section.id,type:'button',role:'tab',id:identity+'-'+section.id,'data-discovery-category':section.id,'aria-controls':identity+'-panel','aria-selected':section.id===active.id,tabIndex:section.id===active.id?0:-1,onClick:()=>choose(section.id)},tr(section.titleKey)))),h('button',{type:'button',className:'nexus-discovery-catalogue-link',onClick:openCatalogue},tr('Open catalogue'),h(HydraNexusDiscoveryIcon,{}))),h('div',{className:'nexus-discovery-browser'},h('div',{id:identity+'-panel',role:'tabpanel','aria-labelledby':identity+'-'+active.id,tabIndex:0,className:'nexus-discovery-grid','data-discovery-grid':active.id,key:active.id},active.games.slice(0,8).map(game=>h('button',{key:game.objectId,type:'button',className:'nexus-discovery-game nexus-discovery-game--row','data-selected':preview?.objectId===game.objectId,'aria-label':tr('View game')+': '+game.title,onMouseEnter:()=>setInspect(game.objectId),onFocus:()=>setInspect(game.objectId),onClick:()=>open(game)},h('span',{className:'nexus-discovery-game-art-wrap'},h(HydraNexusDiscoveryImage,{game,className:'nexus-discovery-game-art'})),h('span',{className:'nexus-discovery-game-copy'},h('strong',null,game.title),h('span',{className:'nexus-discovery-game-meta'},game.genres?.slice(0,3).join(' · ')||'Steam')),h(HydraNexusDiscoveryIcon,{})))),preview?h('aside',{className:'nexus-discovery-browser-preview'},h('h3',null,preview.title),h(HydraNexusDiscoveryImage,{game:preview,hero:true,className:'nexus-discovery-browser-art'}),preview.genres?.length?h('div',{className:'nexus-discovery-browser-tags'},preview.genres.slice(0,4).map(genre=>h('span',{key:genre},genre))):null,preview.description?h('p',null,preview.description):null,h('button',{type:'button',className:'nexus-discovery-feature-action',onClick:()=>open(preview)},tr('View game'),h(HydraNexusDiscoveryIcon,{}))):null));
}
function HydraNexusDiscoveryHome(){
  const R=reactExports$1,h=R.createElement,navigate=useNavigate();useHydraNexusInterface();
  const language=window.__nexusI18n?.language||'en',tr=(key,values)=>window.__nexusI18n?.t(key,values)||key;
  const [feed,setFeed]=R.useState(()=>nexusDiscoveryMemory.get(language)?.value||null),[loading,setLoading]=R.useState(!feed),[failed,setFailed]=R.useState(false),[refreshing,setRefreshing]=R.useState(false),hydrationReads=R.useRef(0),generation=R.useRef(0),mounted=R.useRef(true),lastLoad=R.useRef(Date.now()),surface=R.useRef(null);
  const load=R.useCallback(async(refresh=false)=>{const request=++generation.current;if(refresh){setRefreshing(true);hydrationReads.current=0;}else if(!feed)setLoading(true);try{const result=await nexusDiscoveryLoad(language,refresh);if(mounted.current&&generation.current===request){setFeed(result);setFailed(false);lastLoad.current=Date.now();}}catch{if(mounted.current&&generation.current===request)setFailed(true);}finally{if(mounted.current&&generation.current===request){setLoading(false);setRefreshing(false);}}},[language,!!feed]);
  R.useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;generation.current++;};},[language]);
  R.useEffect(()=>{let clock=null;function schedule(){clearTimeout(clock);if(document.hidden||window.__nexusWindowState?.visible===false)return;const remaining=Math.max(1000,15*60*1000-(Date.now()-lastLoad.current));clock=setTimeout(()=>{if(surface.current?.isConnected&&surface.current.getClientRects().length)load(true);clock=setTimeout(schedule,15*60*1000);},remaining);}document.addEventListener('visibilitychange',schedule);document.addEventListener('nexus-window-state',schedule);schedule();return()=>{clearTimeout(clock);document.removeEventListener('visibilitychange',schedule);document.removeEventListener('nexus-window-state',schedule);};},[load]);
  R.useEffect(()=>{if(!feed?.enriching)return;let timeout=null;const schedule=()=>{clearTimeout(timeout);if(!document.hidden&&window.__nexusWindowState?.visible!==false&&hydrationReads.current<40)timeout=setTimeout(()=>{hydrationReads.current++;load(false);},Math.min(5000,1250*Math.pow(1.5,hydrationReads.current)));};document.addEventListener('visibilitychange',schedule);document.addEventListener('nexus-window-state',schedule);schedule();return()=>{clearTimeout(timeout);document.removeEventListener('visibilitychange',schedule);document.removeEventListener('nexus-window-state',schedule);};},[feed,language,load]);
  const open=game=>navigate(buildGameDetailsPath(game));
  const title=h('h1',{className:'nexus-discovery-sr-only'},tr('Discover your next game'));
  const rootProps={className:'home__content nexus-discovery nexus-discovery-cinematic',ref:surface,lang:language,dir:window.__nexusI18n?.direction||'ltr','aria-busy':loading||refreshing};
  if(loading&&!feed)return h('section',rootProps,title,h('div',{className:'nexus-discovery-loading',role:'status'},h('span',{className:'nexus-discovery-loader','aria-hidden':true}),tr('Loading discoveries…')),h('div',{className:'nexus-discovery-skeletons','aria-hidden':true},Array.from({length:4},(_,index)=>h('span',{key:index}))));
  const sections=feed?.sections||[],popular=sections.find(section=>section.id==='popular')||sections[0],fresh=sections.find(section=>section.id==='new'),upcoming=sections.find(section=>section.id==='upcoming'),editorial=[...new Map((popular?.games||[]).map(game=>[game.objectId,game])).values()];
  return h('section',rootProps,feed?.featured?.length?h(HydraNexusDiscoveryCarousel,{key:feed.featured.map(game=>game.objectId).join(','),games:feed.featured,open,tr}):null,title,(failed||feed?.stale||feed?.fallback)?h('p',{className:'nexus-discovery-notice',role:'status'},tr(failed&&!feed?'Discoveries could not be loaded. Try refreshing.':feed?.fallback?'Steam is unavailable. Explore games from Hydra instead.':'Showing saved discoveries while Steam reconnects.')):null,h(HydraNexusDiscoveryEditorial,{games:editorial,open,tr}),fresh?h(HydraNexusDiscoveryShelf,{section:fresh,open,tr,index:0}):null,sections.length?h(HydraNexusDiscoveryGenres,{sections,open,tr}):null,popular?h(HydraNexusDiscoveryShelf,{section:popular,open,tr,index:1}):null,sections.length?h(HydraNexusDiscoveryCollection,{sections,open,openCatalogue:()=>navigate('/catalogue'),tr}):null,upcoming?h(HydraNexusDiscoveryShelf,{section:upcoming,open,tr,index:2,portrait:true}):null,h('section',{className:'nexus-discovery-explore'},h('div',null,h('h2',null,tr('Keep exploring')),h('p',null,tr('Find more games with the full catalogue and its filters.'))),h('button',{type:'button',className:'nexus-discovery-feature-action',onClick:()=>navigate('/catalogue')},tr('Open catalogue'),h(HydraNexusDiscoveryIcon,{}))));
}
function HydraNexusInterfaceHome({NativeHome,...props}){
  const R=reactExports$1,design=useHydraNexusInterface(),nativeUsed=R.useRef(design!=='quiet');
  if(design!=='quiet')nativeUsed.current=true;
  // A previously visited native Home stays mounted so switching the preview off
  // restores its selected category/DOM instead of silently resetting it.
  return R.createElement(R.Fragment,null,nativeUsed.current?R.createElement('div',{className:'nexus-discovery-native-home',hidden:design==='quiet'},R.createElement(NativeHome,props)):null,design==='quiet'?R.createElement(HydraNexusDiscoveryHome):null);
}
if(typeof module!=='undefined')module.exports={nexusDiscoveryNormalize,nexusDiscoveryLoad,nexusDiscoveryGame,HydraNexusInterfaceHome,HydraNexusDiscoveryHome,nexusDiscoveryMemory};
