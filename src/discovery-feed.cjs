'use strict';
// Steam's public storefront supplies candidate IDs; only appdetails-confirmed
// Windows games are published. No prices, account data or API key are retained.
const fs=require('node:fs/promises'),path=require('node:path');
const {atomicText}=require('./themes.cjs');
const TTL=30*60*1000,RETRY=60*1000,MAX_BYTES=2*1024*1024,DETAIL_TTL=24*60*60*1000;
const LANGUAGES={en:'english','pt-BR':'brazilian',es:'spanish',ru:'russian',ar:'arabic',fr:'french',de:'german',tr:'turkish',pl:'polish'};
const LISTS=[['new','New on Steam','new_releases','popularnew'],['popular','Popular on Steam','top_sellers','topsellers'],['upcoming','Coming soon','coming_soon','popularcomingsoon']];
const validId=id=>/^\d{1,12}$/.test(String(id))&&Number(id)>0;
function artwork(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/^(?:[a-z0-9-]+\.)*(?:steamstatic\.com|steamcdn-a\.akamaihd\.net)$/.test(u.hostname)?u.href:'';}catch{return '';}}
const plain=value=>typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim():'';
function verifiedGame(id,info,verifiedAt){
  if(!validId(id)||info?.type!=='game'||String(info.steam_appid)!==String(id)||!plain(info.name)||info.platforms?.windows!==true)return null;
  const image=artwork(info.header_image)||artwork(info.capsule_imagev5)||artwork(info.capsule_image);if(!image)return null;
  return {shop:'steam',objectId:String(id),title:plain(info.name).slice(0,250),kind:'game',verifiedAt,
    libraryImageUrl:image,libraryHeroImageUrl:artwork(info.background_raw)||image,
    // Library artwork may be absent. Renderer uses contain + landscape fallback.
    portraitImageUrl:artwork(info.portrait_image),logoUrl:artwork(info.logo_url),
    description:plain(info.short_description).slice(0,420),genres:(Array.isArray(info.genres)?info.genres:[]).map(g=>plain(typeof g==='string'?g:g?.description)).filter(Boolean).slice(0,6).map(g=>g.slice(0,60)),
    releaseDate:plain(info.release_date?.date).slice(0,80),comingSoon:info.release_date?.coming_soon===true,downloadSources:[]};
}
function savedGame(raw,now){
  if(raw?.kind!=='game'||!Number.isFinite(raw.verifiedAt)||raw.verifiedAt<=0||raw.verifiedAt>now+60000)return null;
  return verifiedGame(raw.objectId,{type:raw.kind,steam_appid:raw.objectId,name:raw.title,header_image:raw.libraryImageUrl,background_raw:raw.libraryHeroImageUrl,portrait_image:raw.portraitImageUrl,logo_url:raw.logoUrl,short_description:raw.description,genres:raw.genres,release_date:{date:raw.releaseDate,coming_soon:raw.comingSoon},platforms:{windows:true}},raw.verifiedAt);
}
function sections(data,now=Date.now()){
  return LISTS.map(([id,titleKey])=>{const seen=new Set(),games=(Array.isArray(data?.[id])?data[id]:[]).map(g=>savedGame(g,now)).filter(g=>g&&!seen.has(g.objectId)&&seen.add(g.objectId)).slice(0,18);return {id,titleKey,games};}).filter(s=>s.games.length);
}
function candidateIds(value){
  if(typeof value?.results_html!=='string')return [];
  return [...new Set([...value.results_html.matchAll(/data-ds-appid=["'](\d{1,12})["']/g)].map(m=>m[1]).filter(validId))].slice(0,26);
}
function createDiscoveryFeed({directory,fetcher,now=Date.now,log=()=>{}}){
  const cache=new Map(),reads=new Map(),jobs=new Map(),attempts=new Map(),details=new Map(),detailJobs=new Map();let revision=0,activeRequests=0;
  const waiting=[];
  async function limited(task){if(activeRequests<6)activeRequests++;else await new Promise(resolve=>waiting.push(resolve));try{return await task();}finally{if(waiting.length)waiting.shift()();else activeRequests--;}}
  async function json(url,deadline){return limited(async()=>{
    const remaining=deadline-now();if(remaining<=0)throw Error('Steam discovery deadline exceeded');
    const response=await fetcher(url,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(Math.max(1,Math.min(6500,remaining)))});
    if(!response.ok||response.redirected)throw Error('Steam request failed');let size=0;const chunks=[];
    for await(const chunk of response.body){size+=chunk.length;if(size>MAX_BYTES)throw Error('Steam response exceeded size limit');chunks.push(Buffer.from(chunk));}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  });}
  function result(entry,enriching=false){
    const pool=[],lists=['popular','new'].map(id=>entry.sections.find(s=>s.id===id)?.games).filter(Boolean);
    for(let i=0;i<3;i++)for(const list of lists)if(list[i])pool.push(list[i]);
    if(!pool.length)pool.push(...entry.sections.flatMap(s=>s.games).slice(0,6));
    return {sections:entry.sections,updatedAt:entry.updatedAt,source:'Steam',stale:entry.failed===true||now()-entry.updatedAt>=TTL,enriching,revision:entry.revision,featured:[...new Map(pool.map(g=>[g.objectId,g])).values()].slice(0,6)};
  }
  async function read(language){
    if(cache.has(language))return cache.get(language);if(reads.has(language))return reads.get(language);
    const task=(async()=>{try{
      const filename=path.join(directory,'discovery-'+language+'.json'),stat=await fs.stat(filename);if(stat.size>MAX_BYTES)throw Error('Oversized cache');
      const saved=JSON.parse(await fs.readFile(filename,'utf8'));
      // v1 contained unverified hardware/software. It is deliberately never shown.
      if(saved.schema!==2||saved.language!==language||!Number.isFinite(saved.updatedAt)||saved.updatedAt<=0||saved.updatedAt>now()+60000)return null;
      const cleaned=sections(saved.games,now());if(!cleaned.length)return null;
      const entry={sections:cleaned,updatedAt:saved.updatedAt,revision:++revision,failed:false};cache.set(language,entry);
      for(const section of cleaned)for(const g of section.games)details.set(language+':'+g.objectId,{at:g.verifiedAt,value:g});return entry;
    }catch(error){if(error.code!=='ENOENT')log(Error('Steam discovery cache was ignored.'));return null;}})().finally(()=>reads.delete(language));reads.set(language,task);return task;
  }
  async function detail(language,id,deadline){
    const key=language+':'+id,saved=details.get(key);if(saved&&now()-saved.at<(saved.ttl||DETAIL_TTL))return saved.value;
    if(detailJobs.has(key))return detailJobs.get(key);
    const task=(async()=>{const data=await json('https://store.steampowered.com/api/appdetails?appids='+id+'&cc=US&l='+LANGUAGES[language],deadline);const info=data?.[id];
      if(info?.success!==true){details.set(key,{at:now(),ttl:RETRY,value:null});if(details.size>1200)details.delete(details.keys().next().value);return null;}const value=verifiedGame(id,info.data,now());details.set(key,{at:now(),value});if(details.size>1200)details.delete(details.keys().next().value);return value;
    })().finally(()=>detailJobs.delete(key));detailJobs.set(key,task);return task;
  }
  function start(language,saved){
    if(jobs.has(language))return jobs.get(language);
    let resolveFirst,rejectFirst,firstFinished=false;const first=new Promise((resolve,reject)=>{resolveFirst=resolve;rejectFirst=reject;});
    // Cached callers never await first. Attach a handler to avoid unhandled errors.
    first.catch(()=>{});const job={first,done:null};jobs.set(language,job);attempts.set(language,now());
    job.done=(async()=>{const deadline=now()+45000,ids=new Map(),found=new Map(),warmups=[];let lastEntry=saved;
      try{
        const fetched=await Promise.allSettled(LISTS.map(async([id,,,_filter])=>{
          const sort=id==='new'?'&sort_by=Released_DESC':'';
          const url='https://store.steampowered.com/search/results/?query&start=0&count=26&filter='+_filter+sort+'&category1=998&infinite=1&cc=US&l='+LANGUAGES[language];
          const list=candidateIds(await json(url,deadline));if(!list.length)throw Error('Empty Steam list');ids.set(id,list);
          if(id==='popular'&&!saved)for(const appid of list.slice(0,10))warmups.push(detail(language,appid,deadline).then(g=>{if(g){found.set(appid,g);publish();}}).catch(()=>{}));return [id,list];
        }));
        fetched.forEach((item,index)=>{if(item.status==='fulfilled')ids.set(item.value[0],item.value[1]);else ids.set(LISTS[index][0],[]);});
        if(fetched.some(item=>item.status==='rejected')){
          try{const fallback=await json('https://store.steampowered.com/api/featuredcategories?cc=US&l='+LANGUAGES[language],deadline);for(const [id,,key]of LISTS)if(!ids.get(id)?.length)ids.set(id,[...new Set((Array.isArray(fallback?.[key]?.items)?fallback[key].items:[]).map(item=>String(item.id)).filter(validId))].slice(0,26));}catch{}
        }
        const ordered=[],seen=new Set();for(let i=0;i<26;i++)for(const id of ['popular','new','upcoming']){const appid=ids.get(id)?.[i];if(appid&&!seen.has(appid)){seen.add(appid);ordered.push(appid);}}
        if(!ordered.length)throw Error('No Steam candidates');
        function publish(){
          const next=LISTS.map(([id,titleKey])=>({id,titleKey,games:(ids.get(id)||[]).map(appid=>found.get(appid)).filter(g=>g&&(id!=='upcoming'||g.comingSoon)&&(id!=='new'||!g.comingSoon)).slice(0,18)})).filter(s=>s.games.length);
          if(!next.length)return;
          lastEntry={sections:next,updatedAt:now(),revision:++revision,failed:false};cache.set(language,lastEntry);
          if(!firstFinished&&found.size>=4){firstFinished=true;resolveFirst(result(lastEntry,true));}
        };
        let at=0;await Promise.all(Array.from({length:Math.min(6,ordered.length)},async()=>{while(at<ordered.length&&now()<deadline){const id=ordered[at++];try{const g=await detail(language,id,deadline);if(g){found.set(id,g);publish();}}catch{}}}));
        if(!found.size)throw Error('Steam returned no confirmed games');publish();
        const stored=Object.fromEntries(lastEntry.sections.map(s=>[s.id,s.games]));
        await Promise.all(warmups);await atomicText(path.join(directory,'discovery-'+language+'.json'),JSON.stringify({schema:2,language,updatedAt:lastEntry.updatedAt,games:stored})).catch(()=>log(Error('Steam discovery cache could not be saved.')));
        if(!firstFinished){firstFinished=true;resolveFirst(result(lastEntry,false));}
      }catch(error){log(Error('Steam discovery refresh failed.'));if(saved){cache.set(language,{...saved,failed:true});if(!firstFinished){firstFinished=true;resolveFirst(result(cache.get(language),false));}}else if(!firstFinished){firstFinished=true;rejectFirst(Error('Steam discovery is unavailable. Try again shortly.'));}}
    })().finally(()=>jobs.delete(language));return job;
  }
  async function load({language='en',refresh=false}={}){
    language=Object.hasOwn(LANGUAGES,language)?language:'en';const saved=await read(language),ongoing=jobs.get(language);
    if(ongoing)return saved?result(saved,true):ongoing.first;
    const recent=attempts.has(language)&&now()-attempts.get(language)<RETRY;
    if(saved){if((refresh||saved.failed||now()-saved.updatedAt>=TTL)&&!recent)start(language,saved);return result(saved,jobs.has(language));}
    if(recent)throw Error('Steam discovery is unavailable. Try again shortly.');return start(language,null).first;
  }
  // Bounded completion hook is useful for isolated tests and clean diagnostics.
  return {load,whenIdle:()=>Promise.all([...jobs.values()].map(job=>job.done))};
}
module.exports={createDiscoveryFeed,sections,artwork,verifiedGame,candidateIds,TTL};
