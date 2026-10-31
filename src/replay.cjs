'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {splitDays,dayKey,validKey}=require('./activity.cjs'),{atomicText}=require('./themes.cjs');
function localDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Invalid activity day');
  const [year,month,day]=value.split('-').map(Number),date=new Date(year,month-1,day);
  if(year<1000||dayKey(date)!==value)throw Error('Invalid activity day');
  return date;
}
function customPeriod(startDay,endDay,now=Date.now()){
  const start=localDay(startDay),last=localDay(endDay),count=(Date.UTC(last.getFullYear(),last.getMonth(),last.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000+1;
  if(count<1||count>366||endDay>dayKey(now))throw Error('Invalid custom activity range');
  const end=new Date(last);end.setDate(end.getDate()+1);
  return {type:'custom',offset:0,start:+start,end:+end,id:'custom:'+startDay+':'+endDay,complete:+end<=now};
}
function requestPeriod(options,now,language){return options.type==='custom'?customPeriod(options.startDay,options.endDay,now):period(options.type??'week',options.offset??0,now,language);}
function period(type='week',offset=0,now=Date.now(),language='en'){
  if(!['week','month'].includes(type)||!Number.isInteger(offset)||offset>0||offset< -120)throw Error('Invalid activity period');
  const date=new Date(now);let firstDay=1;try{const locale=new Intl.Locale(language);firstDay=(locale.weekInfo||locale.getWeekInfo?.())?.firstDay||1;}catch{}
  const start=new Date(date.getFullYear(),date.getMonth(),type==='month'?1:date.getDate());
  if(type==='month')start.setMonth(start.getMonth()+offset);else start.setDate(start.getDate()-(start.getDay()-(firstDay%7)+7)%7+offset*7);
  const end=new Date(start);if(type==='month')end.setMonth(end.getMonth()+1);else end.setDate(end.getDate()+7);
  return {type,offset,start:+start,end:+end,id:type+':'+dayKey(start),complete:+end<=now};
}
function aggregate(data,range,games=[],now=Date.now()){
  const byGame=new Map(),days=new Map(),breakdown=new Map(),recent=[];const from=dayKey(range.start),to=dayKey(range.end),library=new Map(games.map(g=>[g.shop+':'+g.objectId,g]));
  for(let date=new Date(range.start);+date<Math.min(range.end,now+1);date.setDate(date.getDate()+1))days.set(dayKey(date),0);
  const add=(key,day,ms)=>{if(!validKey(key)||day<from||day>=to||day>dayKey(now)||!Number.isFinite(ms)||ms<=0)return;const g=byGame.get(key)||{key,durationMs:0};g.durationMs+=ms;byGame.set(key,g);days.set(day,(days.get(day)||0)+ms);const entries=breakdown.get(day)||new Map();entries.set(key,(entries.get(key)||0)+ms);breakdown.set(day,entries);};
  for(const [key,total]of Object.entries(data.totals||{}))for(const [day,ms]of Object.entries(total.days||{}))add(key,day,ms);
  for(const session of data.sessions||[]){const start=Math.max(range.start,session.startedAt),end=Math.min(range.end,now,session.startedAt+session.durationMs);if(end<=start)continue;for(const part of splitDays(start,end-start))add(session.key,part.day,part.durationMs);recent.push({key:session.key,startedAt:session.startedAt,durationMs:end-start,active:!!session.active&&now>=range.start&&now<range.end});}
  const ranked=[...byGame.values()].sort((a,b)=>b.durationMs-a.durationMs||a.key.localeCompare(b.key));
  const items=ranked.slice(0,200).map(item=>{const g=library.get(item.key);return {...item,title:g?.title||null,shop:g?.shop||item.key.split(':')[0],objectId:String(g?.objectId||item.key.slice(item.key.indexOf(':')+1)),catalogueGame:g?.catalogueGame||null,art:{hero:g?.customHeroImageUrl||g?.libraryHeroImageUrl||null,cover:g?.customCoverImageUrl||g?.coverImageUrl||(g?.libraryImageUrl!==g?.iconUrl?g?.libraryImageUrl:null)||null,logo:g?.customLogoImageUrl||g?.logoImageUrl||null,customHero:!!g?.customHeroImageUrl,customCover:!!g?.customCoverImageUrl}};});
  return {period:range,trackingSince:data.trackingSince,totalMs:ranked.reduce((n,g)=>n+g.durationMs,0),gameCount:ranked.length,activeDays:[...days.values()].filter(Boolean).length,days:[...days].map(([day,durationMs])=>({day,durationMs})),dayBreakdown:[...days].map(([day,totalMs])=>({day,totalMs,games:[...(breakdown.get(day)||[])].map(([key,durationMs])=>({key,durationMs})).sort((a,b)=>b.durationMs-a.durationMs||a.key.localeCompare(b.key))})),games:items,gamesLimited:ranked.length>items.length,recent:recent.sort((a,b)=>b.startedAt-a.startedAt).slice(0,10).map(s=>({...s,title:library.get(s.key)?.title||null})),partial:data.trackingSince>range.start};
}
// Day details use the already loaded store, never reconstructed totals or archive I/O.
function dayDetails(data,range,games,options,now=Date.now()){
  const {day,gameKey=null,cursor=null}=options,start=+localDay(day),next=new Date(start);next.setDate(next.getDate()+1);const end=Math.min(+next,range.end,now);
  if(start<range.start||start>=range.end||day>dayKey(now))throw Error('Activity day is outside the selected period');
  if(gameKey!==null&&(!validKey(gameKey)||!Object.hasOwn(data.totals||{},gameKey)&&!(data.sessions||[]).some(s=>s.key===gameKey)))throw Error('Invalid activity game');
  if(cursor!==null&&(typeof cursor!=='string'||!/^\d{1,7}$/.test(cursor)))throw Error('Invalid activity cursor');
  const index=cursor===null?0:Number(cursor),library=new Map(games.map(g=>[g.shop+':'+g.objectId,g])),sessions=[];
  let compactedMs=0;
  for(const [key,total]of Object.entries(data.totals||{}))if(validKey(key)&&(gameKey===null||key===gameKey))compactedMs+=total.days?.[day]||0;
  for(const session of data.sessions||[]){
    if(!validKey(session.key)||gameKey!==null&&session.key!==gameKey)continue;
    const overlapStartedAt=Math.max(start,session.startedAt),overlapEndedAt=Math.min(end,session.startedAt+session.durationMs);
    if(overlapEndedAt<=overlapStartedAt)continue;
    sessions.push({id:session.id||null,key:session.key,title:library.get(session.key)?.title||null,startedAt:session.startedAt,fullDurationMs:session.durationMs,overlapStartedAt,overlapEndedAt,durationMs:overlapEndedAt-overlapStartedAt,active:!!session.active&&day===dayKey(now),interrupted:!!session.interrupted});
  }
  sessions.sort((a,b)=>b.overlapStartedAt-a.overlapStartedAt||a.key.localeCompare(b.key)||String(a.id).localeCompare(String(b.id)));
  if(index>sessions.length)throw Error('Invalid activity cursor');
  return {day,gameKey,totalMs:compactedMs+sessions.reduce((sum,s)=>sum+s.durationMs,0),detailsComplete:compactedMs===0,sessionCount:sessions.length,sessions:sessions.slice(index,index+100),nextCursor:index+100<sessions.length?String(index+100):null};
}
function unlockDate(value){if(value===null||value===undefined||value==='')return null;const numeric=Number(value),time=Number.isFinite(numeric)?(numeric<1e11?numeric*1000:numeric):Date.parse(value);return Number.isFinite(time)&&time>0?time:null;}
function achievementsForPeriod(records,range){let count=0,dated=0,undated=0,covered=0;const highlights=[];
  for(const record of records){if(!record?.data)continue;covered++;const definitions=new Map((record.data.achievements||[]).map(a=>[a.name,a]));const seen=new Set();for(const unlock of record.data.unlockedAchievements||[]){if(!unlock?.name||seen.has(unlock.name))continue;seen.add(unlock.name);const date=unlockDate(unlock.unlockTime??unlock.unlockedAt);if(!date){undated++;continue;}dated++;if(date<range.start||date>=range.end)continue;count++;const def=definitions.get(unlock.name);highlights.push({key:record.key,name:def?.displayName||unlock.name,icon:def?.icon||null,unlockedAt:date});}}
  return {count,covered,dated,undated,highlights:highlights.sort((a,b)=>b.unlockedAt-a.unlockedAt).slice(0,6)};
}
function createReplay({directory,activity,library,readAchievements=async()=>null,enabled=()=>true,running=()=>false,now=Date.now,language=()=> 'en'}){
  const file=path.join(directory,'replay-settings.json');let settings={schema:1,weekly:true,monthly:true,seen:{},lastNoticeDay:null},loaded=false,loading=null,queue=Promise.resolve();
  const persist=update=>{const task=queue.catch(()=>{}).then(async()=>{const next=update(settings);await atomicText(file,JSON.stringify(next,null,2));settings=next;});queue=task;return task;};
  async function init(){if(loaded)return;if(loading)return loading;loading=(async()=>{try{const d=JSON.parse(await fs.readFile(file,'utf8'));if(d.schema!==1||typeof d.weekly!=='boolean'||typeof d.monthly!=='boolean'||!d.seen||typeof d.seen!=='object'||Array.isArray(d.seen)||Object.values(d.seen).some(v=>typeof v!=='string')||d.lastNoticeDay!==null&&typeof d.lastNoticeDay!=='string')throw Error('invalid');settings=d;}catch(error){if(error.code!=='ENOENT')throw Error('Activity preferences could not be read. The original file was preserved.');}loaded=true;})();return loading;}
  async function report(options={}){await init();if(!enabled())throw Error('Enable Play Activity in Plugins first.');if(!activity.loaded||activity.error)throw Error(activity.error||'Play history could not be read. Its original file was preserved.');const stamp=now(),range=requestPeriod(options,stamp,language()),games=await library(),value=aggregate(activity.data,range,games,stamp);value.preferences={weekly:settings.weekly,monthly:settings.monthly};
    if(options.details!==false){const keys=new Set([...Object.keys(activity.data.totals||{}),...(activity.data.sessions||[]).map(s=>s.key)]),records=[];let cursor=0;const list=[...keys].filter(validKey).slice(0,200);await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{while(cursor<list.length){if(!enabled())return;const key=list[cursor++];let data=null;try{data=await readAchievements(key);}catch{}records.push({key,data});}}));value.achievements={...achievementsForPeriod(records,range),limited:keys.size>200||records.some(record=>!record.data)};}
    return value;
  }
  return {init,report,async day(options={}){await init();if(!enabled())throw Error('Enable Play Activity in Plugins first.');if(!activity.loaded||activity.error)throw Error(activity.error||'Play history could not be read. Its original file was preserved.');const stamp=now(),range=requestPeriod(options,stamp,language());return dayDetails(activity.data,range,await library(),options,stamp);},async preferences(data){await init();if(typeof data.weekly!=='boolean'||typeof data.monthly!=='boolean')throw Error('Invalid activity notification preference');await persist(current=>({...current,weekly:data.weekly,monthly:data.monthly}));return {weekly:settings.weekly,monthly:settings.monthly};},async due(){await init();if(!enabled()||running()||settings.lastNoticeDay===dayKey(now()))return null;for(const type of ['month','week']){if(!enabled())return null;if(!settings[type==='week'?'weekly':'monthly'])continue;const range=period(type,-1,now(),language());if(settings.seen[type]===range.id)continue;const value=await report({type,offset:-1,details:false});if(value.totalMs>0&&enabled()&&!running())return value;}return null;},async acknowledge(id){await init();const ranges=['month','week'].map(type=>period(type,-1,now(),language())),range=ranges.find(p=>p.id===id);if(!range)throw Error('Invalid activity notification');await persist(current=>({...current,seen:{...current.seen,[range.type]:id},lastNoticeDay:dayKey(now())}));return {acknowledged:true};}};
}
module.exports={period,customPeriod,aggregate,dayDetails,unlockDate,achievementsForPeriod,createReplay};
