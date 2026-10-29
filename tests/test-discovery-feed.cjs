'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createDiscoveryFeed,verifiedGame,artwork,TTL}=require('../src/discovery-feed.cjs');
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const cdn=id=>'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/'+id+'/header.jpg';
const detail=id=>({success:true,data:{type:id===1?'hardware':id===2?'application':id===3?'dlc':'game',steam_appid:id,name:'<b>Game '+id+'</b>',header_image:cdn(id),background_raw:cdn(id).replace('header.jpg','page_bg_raw.jpg'),short_description:'<p>Synthetic fixture '+id+'</p>',genres:[{description:'Action'},{description:'Adventure'}],platforms:{windows:id!==6},release_date:{date:'Oct 28, 2026',coming_soon:id>=200},price_overview:{final:9999}}});
const watchdog=setTimeout(()=>{console.error('Discovery test did not settle');process.exitCode=1;},15000);
(async()=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-discovery-v2-'));try{
 let clock=1800000000000,active=0,maxActive=0,calls=[],offline=false;const blocked=defer();let block=true;
 const ids={popularnew:Array.from({length:22},(_,i)=>101+i),topsellers:Array.from({length:22},(_,i)=>1+i),popularcomingsoon:Array.from({length:22},(_,i)=>201+i)};
 const fetcher=async(url,options)=>{
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.ok(options.signal);assert.match(url,/^https:\/\/store\.steampowered\.com\/(?:search\/results\/|api\/appdetails|api\/featuredcategories)/);calls.push(url);active++;maxActive=Math.max(maxActive,active);
  try{if(offline)throw Error('Offline');const u=new URL(url);if(u.pathname==='/search/results/'){
    assert.equal(u.searchParams.get('category1'),'998');const filter=u.searchParams.get('filter');if(filter==='popularnew')assert.equal(u.searchParams.get('sort_by'),'Released_DESC');
    return new Response(JSON.stringify({success:1,results_html:ids[filter].map(id=>'<a data-ds-appid="'+id+'">ignored untrusted title/price</a>').join('')}));
   }
   const id=Number(u.searchParams.get('appids'));if(block&&id%100>=10)await blocked.promise;
   if(id===4)return new Response(JSON.stringify({[id]:{success:false}}));
   const info=detail(id);if(id===108)info.data.header_image='https://evil.test/private.jpg';if(id===109)info.data.steam_appid=999;
   return new Response(JSON.stringify({[id]:info}));
  }finally{active--;}
 };
 let service=createDiscoveryFeed({directory,fetcher,now:()=>clock});const first=await service.load();assert.equal(first.source,'Steam');assert.equal(first.enriching,true,'first confirmed batch is visible before the remaining metadata');assert.ok(first.sections.flatMap(s=>s.games).length>=4);assert.ok(first.sections.flatMap(s=>s.games).length<40);
 const progressive=await service.load();assert.equal(progressive.enriching,true);assert.ok(progressive.revision>=first.revision);assert.ok(progressive.sections.flatMap(s=>s.games).every(g=>g.kind==='game'));block=false;blocked.resolve();await service.whenIdle();
 const full=await service.load();assert.equal(full.enriching,false);assert.equal(full.stale,false);assert.equal(full.sections.length,3);assert.ok(full.sections.flatMap(s=>s.games).length>=45,'enough real game candidates for the long discovery page');assert.ok(full.sections.find(s=>s.id==='upcoming').games.every(g=>g.comingSoon));
 const games=full.sections.flatMap(s=>s.games);for(const id of ['1','2','3','4','6','108','109'])assert.equal(games.some(g=>g.objectId===id),false,'non-game, wrong-id, platform or unsafe-art candidate excluded: '+id);
 assert.ok(games.every(g=>!g.title.includes('<')&&!g.description.includes('<')));assert.equal(games[0].portraitImageUrl,'','no guessed portrait URL request storm');assert.equal(games[0].logoUrl,'');assert.ok(full.featured[0].objectId<100,'featured starts with true top-sellers list');assert.ok(maxActive<=6,'global network concurrency bounded');
 const detailUrls=calls.filter(url=>url.includes('/appdetails?'));assert.equal(new Set(detailUrls).size,detailUrls.length,'warmup, progressive reads and shared sections coalesce metadata requests');const before=calls.length;await service.load();await service.load({refresh:true});assert.equal(calls.length,before,'fresh reads and immediate refresh button are rate limited');
 const stored=await fs.readFile(path.join(directory,'discovery-en.json'),'utf8'),cache=JSON.parse(stored);assert.equal(cache.schema,2);assert.equal(stored.includes('price_overview'),false);assert.equal(stored.includes('evil.test'),false);assert.equal(stored.includes('ignored untrusted'),false);
 service=createDiscoveryFeed({directory,fetcher,now:()=>clock});const restart=await service.load();assert.equal(restart.enriching,false);assert.equal(calls.length,before,'valid game cache paints after restart without network');
 clock+=TTL+1;offline=true;const stale=await service.load();assert.equal(stale.stale,true);assert.equal(stale.enriching,true,'stale cache paints while refresh runs');await service.whenIdle();const afterFailure=calls.length;assert.equal((await service.load({refresh:true})).stale,true);assert.equal(calls.length,afterFailure,'background failure uses retry backoff');
 const oldDir=path.join(directory,'unsafe-v1');await fs.mkdir(oldDir);await fs.writeFile(path.join(oldDir,'discovery-en.json'),JSON.stringify({schema:1,language:'en',updatedAt:clock,data:{top_sellers:{items:[{id:1,type:0,name:'Steam Controller',header_image:cdn(1)}]}}}));
 await assert.rejects(createDiscoveryFeed({directory:oldDir,fetcher:async()=>{throw Error('offline')},now:()=>clock}).load(),/Steam discovery is unavailable/,'old unverified hardware cache is never republished');
 const huge=createDiscoveryFeed({directory:path.join(directory,'huge'),fetcher:async()=>new Response('x'.repeat(2*1024*1024+1)),now:()=>clock});await assert.rejects(huge.load(),/Steam discovery is unavailable/);
 assert.equal(artwork('https://evilsteamstatic.com/a.jpg'),'');assert.equal(verifiedGame('2',detail(2).data,clock),null);assert.equal(verifiedGame('3',detail(3).data,clock),null);
 // A slow new/upcoming source must not hold the first popular-game paint hostage.
 const sourceGate=defer();let sourceBlocked=true;
 const fastService=createDiscoveryFeed({directory:path.join(directory,'fast-first'),now:()=>clock,fetcher:async url=>{const u=new URL(url);if(u.pathname==='/search/results/'){const f=u.searchParams.get('filter');if(sourceBlocked&&f!=='topsellers')await sourceGate.promise;return new Response(JSON.stringify({results_html:ids[f].map(id=>'<a data-ds-appid="'+id+'"></a>').join('')}));}const id=Number(u.searchParams.get('appids'));return new Response(JSON.stringify({[id]:detail(id)}));}});
 const early=await fastService.load();assert.equal(sourceBlocked,true);assert.equal(early.enriching,true);assert.ok(early.sections.find(s=>s.id==='popular')?.games.length>=4,'popular data appears while other source is blocked');sourceBlocked=false;sourceGate.resolve();await fastService.whenIdle();
 console.log('PASS: appdetails-confirmed Windows games only; hardware/software/DLC/wrong IDs removed; schema1 quarantine; early progressive paint before slow sources; bounded concurrency/coalescing; no prices or guessed image storms; fresh/restart/offline/backoff cache; rich multi-section feed. Synthetic data only.');
 }finally{clearTimeout(watchdog);await fs.rm(directory,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
