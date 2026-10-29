'use strict';
// Public Steam news, requested on demand for a confirmed Steam library record.
// API: https://partner.steamgames.com/doc/webapi/ISteamNews (GetNewsForApp v2).
// Contents remain untrusted text: the renderer must use its allowlist parser.
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const {atomicText}=require('./themes.cjs');
const TTL=15*60*1000,RETRY=60*1000,PAGE_SIZE=12,MAX_BYTES=2*1024*1024,MAX_CONTENT=100000,MAX_PAGES=40;
const validId=value=>typeof value==='string'&&/^[1-9]\d{0,9}$/.test(value)&&Number(value)<=4294967295;
const validNewsId=value=>typeof value==='string'&&/^\d{1,22}$/.test(value);
const plain=value=>String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'').replace(/<[^>]*>/g,' ').replace(/\[img(?:\s[^\]]*)?\][\s\S]*?\[\/img\]/gi,' ').replace(/\[(?:\/?[a-z][^\]]*|\*)\]/gi,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g,entity=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[entity]).replace(/\s+/g,' ').trim();
function steamURL(value){
  try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return '';if(!['store.steampowered.com','steamcommunity.com','steamstore-a.akamaihd.net'].includes(u.hostname))return '';if(!/^\/(?:news\/(?:app\/\d+\/view\/\d+|externalpost\/steam_community_announcements\/\d+)|games\/[^/]+\/announcements\/detail\/\d+|gid\/\d+\/announcements\/detail\/\d+)(?:\/|$)/.test(u.pathname))return '';u.protocol='https:';u.hash='';return u.href.length<=2048?u.href:'';}catch{return '';}
}
function imageURL(value){
  try{const u=new URL(String(value).replace(/\{STEAM_CLAN_(?:LOC_)?IMAGE\}/g,'https://clan.akamai.steamstatic.com/images'));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^(?:[a-z0-9-]+\.)*(?:steamstatic\.com|steamusercontent\.com|steamcdn-a\.akamaihd\.net)$/.test(u.hostname)&&u.href.length<=2048?u.href:'';}catch{return '';}
}
function newsItem(raw,appId){
  if(!raw||!validNewsId(String(raw.gid||''))||raw.appid!=null&&String(raw.appid)!==appId)return null;
  // Only the developer's Steam announcement feed is exposed, never press items
  // classified as developer updates by keyword matching.
  if(raw.feedname!=='steam_community_announcements')return null;
  const url=steamURL(raw.url),title=plain(raw.title).slice(0,500),date=Number(raw.date);
  if(!url||!title||!Number.isSafeInteger(date)||date<=0||date>4294967295)return null;
  const appMatch=new URL(url).pathname.match(/^\/news\/app\/(\d+)\//);if(appMatch&&appMatch[1]!==appId)return null;
  const original=typeof raw.contents==='string'?raw.contents:'',contents=original.slice(0,MAX_CONTENT),tags=Array.isArray(raw.tags)?raw.tags.filter(tag=>typeof tag==='string').slice(0,30):[];
  const imageMatch=contents.match(/\[img\]([^[]+)\[\/img\]/i),imageAttribute=contents.match(/\[img\s+src=["']?([^\]"']+)["']?\]/i),htmlImage=contents.match(/<img\b[^>]*\bsrc=["']([^"']+)/i);
  let image=imageURL(imageMatch?.[1])||imageURL(imageAttribute?.[1]);if(!image&&htmlImage)image=imageURL(htmlImage[1]);
  const category=tags.some(tag=>/^(?:patchnotes|patch_notes)$/i.test(tag))?'patch':tags.some(tag=>/^(?:game_update|major_update)$/i.test(tag))?'update':'announcement';
  return {id:String(raw.gid),title,url,contents,excerpt:plain(contents).slice(0,420),image,date,feedLabel:plain(raw.feedlabel||'Community Announcements').slice(0,100),feedName:'steam_community_announcements',official:true,category,contentComplete:raw.is_external_url!==true&&original.length>0&&original.length<=MAX_CONTENT,tags};
}
function savedItem(item,appId){return newsItem({gid:item?.id,title:item?.title,url:item?.url,contents:item?.contents,date:item?.date,feedname:item?.feedName,feedlabel:item?.feedLabel,is_external_url:item?.contentComplete!==true,tags:item?.tags,appid:appId},appId);}
function uniqueItems(items){return [...new Map(items.filter(Boolean).map(item=>[item.id,item])).values()].sort((a,b)=>b.date-a.date||b.id.localeCompare(a.id));}
async function steamRunning(){
  if(process.platform!=='win32')return false;
  return new Promise(resolve=>cp.execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','tasklist.exe'),['/FI','IMAGENAME eq steam.exe','/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true,timeout:2500,maxBuffer:128*1024},(error,out)=>resolve(!error&&/^"steam\.exe",/im.test(out))));
}
function createSteamNews({directory,fetcher,library=async()=>[],allowCatalogue=false,isSteamRunning=steamRunning,openExternal,now=Date.now,log=()=>{}}){
  const cache=new Map(),jobs=new Map(),reads=new Map(),attempts=new Map();let cleanup=Promise.resolve();
  const empty={supported:false,items:[],updatedAt:0,stale:false,error:null,nextEnddate:null,hasMore:false};
  async function authorize(options){
    const id=String(options?.objectId||'');if(options?.shop!=='steam'||!validId(id))return null;
    if(allowCatalogue===true)return id;
    const games=await library();if(!Array.isArray(games)||!games.some(g=>g?.shop==='steam'&&String(g.objectId)===id&&g.isDeleted!==true))throw Error('Add this game to your library first');return id;
  }
  const filename=(id,enddate)=>path.join(directory,id+'-'+(enddate||'latest')+'.json');
  function remember(key,entry){cache.delete(key);cache.set(key,entry);while(cache.size>MAX_PAGES)cache.delete(cache.keys().next().value);return entry;}
  async function read(id,enddate){
    const key=id+':'+enddate;if(cache.has(key))return cache.get(key);if(reads.has(key))return reads.get(key);
    const task=(async()=>{try{const file=filename(id,enddate),stat=await fs.stat(file);if(stat.size>MAX_BYTES)throw Error('Oversized news cache');const saved=JSON.parse(await fs.readFile(file,'utf8'));
      if(saved.schema!==1||saved.appId!==id||saved.enddate!==enddate||!Number.isFinite(saved.updatedAt)||saved.updatedAt<=0||saved.updatedAt>now()+60000||!Array.isArray(saved.items)||saved.items.length>PAGE_SIZE||typeof saved.hasMore!=='boolean')throw Error('Invalid news cache');
      const items=uniqueItems(saved.items.map(item=>savedItem(item,id)));if(items.length!==saved.items.length)throw Error('Invalid cached news item');
      return remember(key,{items,updatedAt:saved.updatedAt,hasMore:saved.hasMore,failed:false});
    }catch(error){if(error.code!=='ENOENT')log(Error('Steam news cache was ignored.'));return null;}})().finally(()=>reads.delete(key));reads.set(key,task);return task;
  }
  function result(entry,error=null){const oldest=entry.items.at(-1)?.date||0;return {supported:true,items:entry.items.map(item=>({...item,tags:[...item.tags]})),updatedAt:entry.updatedAt,stale:entry.failed||now()-entry.updatedAt>=TTL,error,nextEnddate:entry.hasMore&&oldest>1?oldest:null,hasMore:entry.hasMore&&oldest>1};}
  async function prune(){
    // Only own numeric page cache files are eligible; no recursive deletion.
    const entries=await fs.readdir(directory,{withFileTypes:true}),files=await Promise.all(entries.filter(e=>e.isFile()&&/^\d{1,10}-(?:latest|\d{1,10})\.json$/.test(e.name)).map(async e=>({file:path.join(directory,e.name),at:(await fs.stat(path.join(directory,e.name))).mtimeMs})));
    files.sort((a,b)=>b.at-a.at);await Promise.all(files.slice(MAX_PAGES).map(e=>fs.unlink(e.file).catch(()=>{})));
  }
  async function request(id,enddate,saved){
    const key=id+':'+enddate;if(jobs.has(key))return jobs.get(key);
    // Retained tabs cannot create an unbounded fetch/body queue. Busy callers
    // can retry without consuming the per-page network-failure backoff.
    if(jobs.size>=4)return saved?{...result(saved,'unavailable'),stale:true}:{...empty,supported:true,error:'unavailable'};
    attempts.set(key,now());while(attempts.size>MAX_PAGES*2)attempts.delete(attempts.keys().next().value);
    const task=(async()=>{try{
      const url=new URL('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/');url.search=new URLSearchParams({appid:id,count:String(PAGE_SIZE),maxlength:'0',feeds:'steam_community_announcements',...(enddate?{enddate:String(enddate)}:{})}).toString();
      const response=await fetcher(url.href,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok||response.redirected||response.url&&response.url!==url.href)throw Error('Steam news request failed');
      let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>MAX_BYTES)throw Error('Oversized news response');chunks.push(Buffer.from(chunk));}
      const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(String(value?.appnews?.appid)!==id||!Array.isArray(value?.appnews?.newsitems))throw Error('Invalid Steam news response');
      const raw=value.appnews.newsitems;if(raw.length>100)throw Error('Invalid Steam news response');const items=uniqueItems(raw.map(item=>newsItem(item,id))).filter(item=>!enddate||item.date<enddate).slice(0,PAGE_SIZE);
      if(raw.length&&!items.length)throw Error('Steam returned no usable news items');
      const entry=remember(key,{items,updatedAt:now(),hasMore:raw.length>=PAGE_SIZE,failed:false});
      try{await atomicText(filename(id,enddate),JSON.stringify({schema:1,appId:id,enddate,updatedAt:entry.updatedAt,items,hasMore:entry.hasMore}));cleanup=cleanup.catch(()=>{}).then(prune).catch(()=>log(Error('Steam news cache cleanup was skipped.')));}catch{log(Error('Steam news cache could not be saved.'));}
      return result(entry);
    }catch(error){log(Error('Steam news is unavailable.'));if(saved){saved.failed=true;remember(key,saved);return result(saved,'unavailable');}return {...empty,supported:true,error:'unavailable'};}})().finally(()=>jobs.delete(key));jobs.set(key,task);return task;
  }
  async function load(options={}){
    const id=await authorize(options);if(!id)return {...empty};const enddate=options.enddate==null?0:Number(options.enddate);
    if(!Number.isSafeInteger(enddate)||enddate<0||enddate>4294967295)throw Error('Invalid news page');
    const saved=await read(id,enddate),key=id+':'+enddate,last=attempts.get(key);if(jobs.has(key))return jobs.get(key);
    if(saved&&options.refresh!==true&&now()-saved.updatedAt<TTL&&!saved.failed)return result(saved);
    if(last!=null&&now()-last<RETRY)return saved?result(saved,saved.failed?'unavailable':null):{...empty,supported:true,error:'unavailable'};
    return request(id,enddate,saved);
  }
  async function open(options={}){
    const id=await authorize(options);if(!id||!validNewsId(String(options.id||'')))throw Error('Invalid news item');
    // Caller supplies an item ID, never a URL or arbitrary Steam command.
    let item;for(const [key,entry]of cache)if(key.startsWith(id+':')){item=entry.items.find(row=>row.id===String(options.id));if(item)break;}
    if(!item)throw Error('Refresh updates before opening this item');if(typeof openExternal!=='function')throw Error('News links are unavailable');const url=steamURL(item.url);if(!url)throw Error('Invalid news link');
    let running=false;try{running=await isSteamRunning()===true;}catch{}
    if(running&&options.browser!==true){try{await openExternal('steam://openurl/'+url);return {opened:'steam'};}catch{}}
    await openExternal(url);return {opened:'browser'};
  }
  return {load,open,whenIdle:async()=>{await Promise.all([...jobs.values()]);await cleanup;}};
}
module.exports={createSteamNews,steamRunning,steamURL,imageURL,newsItem,TTL,RETRY,PAGE_SIZE,MAX_BYTES,MAX_CONTENT};
