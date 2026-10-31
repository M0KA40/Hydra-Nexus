'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicText}=require('./themes.cjs');
const i18n=require('./i18n.cjs');
const KEY=/^[\w-]+:[\w.-]+$/;
function createPrivacy({directory,getConfig,log=()=>{},changed=()=>{}}){
  // Retain historical screenshot protections. Strict mode rejects publication at
  // the API boundary; it never acknowledges or rewrites a native playtime write.
  const file=path.join(directory,'invisible-state.json'),checkpoint=path.join(directory,'invisible-checkpoint.json');
  let records=Object.create(null),integrationHolds=Object.create(null),legacyScreenshotCutoff=0,error=null,binding={},transition=false,writing=null,dirty=false,saveTimer=null,noticeTimer=null,exiting=false;
  const indexes=new Map(),scopeCache=new Map();
  function notify(){if(noticeTimer)return;noticeTimer=setTimeout(()=>{noticeTimer=null;changed();},25);noticeTimer.unref?.();}
  try{
    const source=fs.existsSync(checkpoint)?checkpoint:file;
    if(fs.statSync(source).size>4*1024*1024)throw Error('large');
    const data=JSON.parse(fs.readFileSync(source,'utf8'));
    if(data.schema!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records)||Object.keys(data.records).length>10000)throw Error('schema');
    for(const [slot,row]of Object.entries(data.records)){
      if(!/^[a-f0-9]{24}\|.{1,300}$/.test(slot)||!row||typeof row.key!=='string'||!(KEY.test(row.key)||/^remote:[\w.-]{1,250}$/.test(row.key))||slot.slice(25)!==row.key||row.remoteId!=null&&(typeof row.remoteId!=='string'||!row.remoteId.length||row.remoteId.length>250))throw Error('record');
    }
    if(data.integrationHolds!==undefined&&(!data.integrationHolds||Array.isArray(data.integrationHolds)||typeof data.integrationHolds!=='object'||Object.entries(data.integrationHolds).some(([owner,stores])=>! /^[a-f0-9]{24}$/.test(owner)||!Array.isArray(stores)||stores.some(store=>!['steam','epic'].includes(store)))))throw Error('integration holds');
    if(data.profileSyncVersion!==undefined&&data.profileSyncVersion!==2)throw Error('sync version');
    if(data.legacyScreenshotCutoff!==undefined&&(!Number.isSafeInteger(data.legacyScreenshotCutoff)||data.legacyScreenshotCutoff<0))throw Error('screenshot cutoff');
    if(data.profileSyncVersion===2&&(Object.keys(data.records).length||Object.keys(data.integrationHolds||{}).length)&&!data.legacyScreenshotCutoff)throw Error('missing screenshot cutoff');
    records=Object.assign(Object.create(null),data.records);integrationHolds=Object.assign(Object.create(null),data.integrationHolds||{});
    legacyScreenshotCutoff=data.profileSyncVersion===2?(data.legacyScreenshotCutoff||0):(Object.keys(records).length||Object.keys(integrationHolds).length?Date.now():0);
    for(const [slot,row]of Object.entries(records)){
      const owner=slot.slice(0,24);let entry=indexes.get(owner);if(!entry){entry={keys:new Set(),ids:new Set()};indexes.set(owner,entry);}
      entry.keys.add(row.key);if(row.remoteId!=null)entry.ids.add(row.remoteId);
    }
    dirty=source===checkpoint||data.profileSyncVersion!==2;
  }catch(e){if(e.code!=='ENOENT')error='Invisible Mode privacy data is damaged. The original file was preserved.';}
  const context=()=>binding.api?.getAuthContext?.()||null;
  const scope=ctx=>{const identity=JSON.stringify([ctx?.environment||'',ctx?.userId||'local']);if(!scopeCache.has(identity)){if(scopeCache.size>=32)scopeCache.clear();scopeCache.set(identity,crypto.createHash('sha256').update(identity).digest('hex').slice(0,24));}return scopeCache.get(identity);};
  const localScope=scope(null),requested=()=>getConfig().plugins.invisible===true&&getConfig().invisibleMode===true,enabled=()=>transition||requested();
  const scopes=ctx=>scope(ctx)===localScope?[localScope]:[scope(ctx),localScope];
  function closeRealtime(){try{binding.realtime?.close();}catch(e){log(e);}}
  function legacyScreenshotAllowed(row){
    // A damaged old ledger cannot silently publish formerly private screenshots.
    // Native achievement, playtime and integration requests remain independent.
    if(error)return false;
    if(!legacyScreenshotCutoff)return true;
    // Hydra's three capture paths currently store Date.now() milliseconds. Also
    // accept an ISO timestamp on migrated rows without treating malformed dates
    // as newer captures that could release an earlier private image.
    const rawCapturedAt=row?.capturedAt;
    const capturedAt=typeof rawCapturedAt==='number'?rawCapturedAt:typeof rawCapturedAt==='string'&&/^\d+(?:\.\d+)?$/.test(rawCapturedAt)?Number(rawCapturedAt):typeof rawCapturedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(rawCapturedAt)?Date.parse(rawCapturedAt):NaN;
    if(Number.isFinite(capturedAt)&&capturedAt>legacyScreenshotCutoff)return true;
    const ctx=row?.context||(row?.ownerId?{...context(),userId:row.ownerId}:context());
    const key=row?.gameKey||row?.key,id=row?.remoteGameId??row?.remoteId;
    return !scopes(ctx).some(owner=>{
      const entry=indexes.get(owner);
      return !!(entry&&(entry.keys.has(key)||id!=null&&entry.ids.has(String(id))))||!!integrationHolds[owner]?.length;
    });
  }
  const snapshot=()=>JSON.stringify({schema:1,profileSyncVersion:2,legacyScreenshotCutoff,records,integrationHolds},null,2);
  function persist(){if(saveTimer||writing||error)return;saveTimer=setTimeout(()=>{saveTimer=null;void flush().catch(log);},50);saveTimer.unref?.();}
  async function flush(){
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}if(error)throw Error(i18n.main.t(error));
    if(!writing&&dirty&&!exiting)writing=(async()=>{while(dirty&&!exiting){dirty=false;const text=snapshot();if(Buffer.byteLength(text)>4*1024*1024)throw Error('privacy ledger limit');await atomicText(file,text);if(!exiting)fs.rmSync(checkpoint,{force:true});}})().catch(e=>{error='Invisible Mode privacy data could not be saved. The original file was preserved.';log(e);notify();throw Error(i18n.main.t(error));}).finally(()=>{writing=null;});
    if(writing)await writing;if(error)throw Error(i18n.main.t(error));
  }
  function flushOnExit(){
    exiting=true;if(saveTimer)clearTimeout(saveTimer);if(noticeTimer)clearTimeout(noticeTimer);
    if(error||!dirty&&!writing)return;
    const temporary=checkpoint+'.'+crypto.randomUUID()+'.tmp';
    try{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(temporary,snapshot());fs.renameSync(temporary,checkpoint);}catch(e){try{fs.rmSync(temporary,{force:true});}catch{}throw e;}
  }
  function status(){
    const supported=!!(typeof binding.api?.put==='function'&&typeof binding.api?.post==='function'&&typeof binding.realtime?.close==='function'&&typeof binding.realtime?.connect==='function');
    return {supported,requested:requested(),active:supported&&enabled(),strict:true,held:0,integrationHeld:enabled(),profileSync:!enabled(),legacyScreenshotsProtected:!!(error||legacyScreenshotCutoff),error,visibilityVerified:false,serverNotificationsVerified:false};
  }
  // Kept for reversible native createGame/trackGamePlaytime hooks. A presence
  // preference never acknowledges or discards a native profile activity write.
  const blockGame=()=>false;
  const presenceError=()=>Object.assign(Error(i18n.main.t('Invisible Mode paused this activity upload.')),{code:'NEXUS_INVISIBLE'});
  function policy(method,url,data){
    if(['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase()))return {data};
    if(!enabled())return {data};
    let route;try{route=decodeURIComponent(new URL(String(url),'https://hydra.invalid').pathname).replace(/\/+$/,'');}catch{return {deny:true};}
    // Block every native activity write, including manual totals, batch imports,
    // linked-store sessions and screenshot reservation/commit. Private cloud-save
    // artifacts, downloads, authentication, chat and read-only metadata stay native.
    const artifacts=/^\/profile\/games\/artifacts(?:\/|$)/.test(route);
    const activity=/^\/profile\/(?:games|integrations|game-links|screenshots|souvenirs(?:-visibility)?|achievements)(?:\/|$)/.test(route);
    const capture=/^\/presigned-urls\/(?:achievement-image|screenshot(?:s|-image)?)(?:\/|$)/.test(route);
    return route==='/auth/realtime'||activity&&!artifacts||capture?{deny:true}:{data};
  }
  const instances=new WeakSet();
  function attachTransport(instance){
    if(!instance?.interceptors?.request?.use||instances.has(instance))return;instances.add(instance);
    instance.interceptors.request.use(config=>{const result=policy(config.method||'GET',config.url,config.data);if(result.deny)throw presenceError();return config;});
  }
  function triggerWorkers(){for(const worker of [binding.achievementWorker,binding.souvenirWorker])try{void Promise.resolve(worker?.trigger?.()).catch(log);}catch(e){log(e);}}
  function bind(capabilities){
    binding=capabilities||{};const {api,realtime,souvenirStore}=binding;
    if(api&&!api.__nexusPrivacy){
      Object.defineProperty(api,'__nexusPrivacy',{value:true});
      for(const method of ['post','postResponse','put','patch','delete'])if(typeof api[method]==='function'){
        const native=api[method];api[method]=async function(url,data,...rest){if(policy(method==='postResponse'?'POST':method,url,data).deny)throw presenceError();return native.call(this,url,data,...rest);};
      }
      // An upgrade can start before Hydra has restored the account session.
      // Re-check transport policy after auth awaits too; never release queued
      // activity merely because an account session was replaced.
      api.onAuthContextChanged?.(()=>{if(enabled())closeRealtime();triggerWorkers();notify();});
      const descriptor=Object.getOwnPropertyDescriptor(api,'instance');
      if(!descriptor||descriptor.configurable){let instance=api.instance;attachTransport(instance);Object.defineProperty(api,'instance',{configurable:true,get:()=>instance,set:value=>{instance=value;attachTransport(value);}});}else attachTransport(api.instance);
    }
    if(realtime&&!realtime.__nexusPrivacy){
      Object.defineProperty(realtime,'__nexusPrivacy',{value:true});
      for(const name of ['connect','reconnectNow'])if(typeof realtime[name]==='function'){const native=realtime[name];realtime[name]=function(...args){if(enabled())return;return native.apply(this,args);};}
    }
    if(souvenirStore&&!souvenirStore.__nexusPrivacy){
      Object.defineProperty(souvenirStore,'__nexusPrivacy',{value:true});const list=souvenirStore.list;
      if(typeof list==='function')souvenirStore.list=async function(...args){const rows=await list.apply(this,args);return args[0]?.nexusUpload===true?(enabled()?[]:rows.filter(legacyScreenshotAllowed)):rows;};
    }
    if(enabled())closeRealtime();
    if(dirty)persist();notify();triggerWorkers();
  }
  async function change(value,persistConfig,{accepted=false}={}){
    if(typeof value!=='boolean')throw Error('Invalid privacy preference');
    if(value&&!status().supported)throw Error(i18n.main.t('Invisible Mode is unavailable for this Hydra build. Reinstall the latest Nexus installer.'));
    if(value&&!requested()&&!accepted)throw Error(i18n.main.t('Confirm the privacy impact before enabling Invisible Mode.'));
    if(value&&!requested()&&binding.running?.().length)throw Error(i18n.main.t('Close all games before changing plugins'));
    transition=true;closeRealtime();
    try{await persistConfig();}
    finally{
      transition=false;
      if(enabled())closeRealtime();else try{if(binding.api?.isLoggedIn?.())binding.realtime?.connect();}catch(e){log(e);}
      triggerWorkers();notify();
    }
  }
  return {bind,status,blockGame,change,flush,flushOnExit,policy};
}
module.exports={createPrivacy};
