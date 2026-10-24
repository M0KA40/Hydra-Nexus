'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicText}=require('./themes.cjs');
const i18n=require('./i18n.cjs');
const KEY=/^[\w-]+:[\w.-]+$/;
function createPrivacy({directory,getConfig,log=()=>{},changed=()=>{}}){
  const file=path.join(directory,'invisible-state.json'),checkpoint=path.join(directory,'invisible-checkpoint.json');let records=Object.create(null),integrationHolds=Object.create(null),error=null,binding={},transition=false,writing=null,dirty=false,saveTimer=null,noticeTimer=null,exiting=false;
  const indexes=new Map(),scopeCache=new Map();
  function index(slot,row){const owner=slot.slice(0,24);let entry=indexes.get(owner);if(!entry){entry={keys:new Set(),ids:new Set(),slots:new Set(),localIds:new Set(),aliases:new Set()};indexes.set(owner,entry);}entry.keys.add(row.key);if(row.remoteId!=null){entry.ids.add(row.remoteId);if(!row.key.startsWith('remote:'))entry.localIds.add(row.remoteId);if(entry.localIds.has(row.remoteId)&&entry.keys.has('remote:'+row.remoteId))entry.aliases.add(row.remoteId);}entry.slots.add(slot);}
  function rebuild(){indexes.clear();for(const [slot,row]of Object.entries(records))index(slot,row);}
  function notify(){if(noticeTimer)return;noticeTimer=setTimeout(()=>{noticeTimer=null;changed();},25);noticeTimer.unref?.();}
  try{const source=fs.existsSync(checkpoint)?checkpoint:file;if(fs.statSync(source).size>4*1024*1024)throw Error('large');const raw=fs.readFileSync(source,'utf8');const data=JSON.parse(raw);if(data.schema!==1||!data.records||typeof data.records!=='object'||Array.isArray(data.records)||Object.keys(data.records).length>10000)throw Error('schema');
    for(const [slot,row]of Object.entries(data.records)){if(!/^[a-f0-9]{24}\|.{1,300}$/.test(slot)||!row||typeof row.key!=='string'||!(KEY.test(row.key)||/^remote:[\w.-]{1,250}$/.test(row.key))||slot.slice(25)!==row.key||row.remoteId!=null&&(typeof row.remoteId!=='string'||!row.remoteId.length||row.remoteId.length>250))throw Error('record');}if(data.integrationHolds!==undefined&&(!data.integrationHolds||Array.isArray(data.integrationHolds)||typeof data.integrationHolds!=='object'||Object.entries(data.integrationHolds).some(([owner,stores])=>! /^[a-f0-9]{24}$/.test(owner)||!Array.isArray(stores)||stores.some(store=>!['steam','epic'].includes(store)))))throw Error('integration holds');integrationHolds=Object.assign(Object.create(null),data.integrationHolds||{});records=Object.assign(Object.create(null),data.records);rebuild();dirty=source===checkpoint;
  }catch(e){if(e.code!=='ENOENT')error='Invisible Mode privacy data is damaged. The original file was preserved.';}
  const context=()=>binding.api?.getAuthContext?.()||null;
  const scope=ctx=>{const identity=JSON.stringify([ctx?.environment||'',ctx?.userId||'local']);if(!scopeCache.has(identity)){if(scopeCache.size>=32)scopeCache.clear();scopeCache.set(identity,crypto.createHash('sha256').update(identity).digest('hex').slice(0,24));}return scopeCache.get(identity);};
  const localScope=scope(null),requested=()=>getConfig().plugins.invisible===true&&getConfig().invisibleMode===true,enabled=()=>!!(transition||error||requested());
  const keyOf=game=>typeof game?.gameKey==='string'&&KEY.test(game.gameKey)?game.gameKey:typeof game?.key==='string'&&KEY.test(game.key)?game.key:game?.shop&&game?.objectId!=null&&KEY.test(game.shop+':'+game.objectId)?game.shop+':'+game.objectId:null;
  const scopes=ctx=>scope(ctx)===localScope?[localScope]:[scope(ctx),localScope];
  function protectedRecord(key,id,ctx=context()){
    return scopes(ctx).some(owner=>{const entry=indexes.get(owner);return !!entry&&(key&&entry.keys.has(key)||id!=null&&entry.ids.has(String(id)));});
  }
  function closeRealtime(){try{binding.realtime?.close();}catch(e){log(e);}}
  function fail(message){error=message;closeRealtime();notify();}
  function persist(){dirty=true;if(saveTimer||writing)return;saveTimer=setTimeout(()=>{saveTimer=null;void flush().catch(log);},50);saveTimer.unref?.();}
  function remember(game,ctx=context()){
    if(error)return;
    const remoteId=game?.remoteId??game?.remoteGameId??game?.id;
    const key=keyOf(game)||(remoteId!=null?'remote:'+String(remoteId):null);
    if(!key||!(KEY.test(key)||/^remote:[\w.-]{1,250}$/.test(key))||key.length>300||remoteId!=null&&String(remoteId).length>250)return;
    const slot=scope(ctx)+'|'+key;
    if(records[slot]&&(remoteId==null||records[slot].remoteId===String(remoteId)))return;
    if(!records[slot]&&[...indexes.values()].reduce((n,entry)=>n+entry.slots.size,0)>=10000){fail('Invisible Mode privacy data could not be saved. Sharing remains blocked.');return;}
    const oldId=records[slot]?.remoteId;records[slot]={key,remoteId:remoteId==null?oldId??null:String(remoteId)};
    if(oldId&&oldId!==records[slot].remoteId)rebuild();else index(slot,records[slot]);persist();notify();
  }
  function blockGame(game,ctx=context()){
    const key=keyOf(game),id=game?.remoteId??game?.remoteGameId??game?.id;
    if(enabled()){remember(game,ctx);return true;}
    return protectedRecord(key,id,ctx);
  }
  function recordAllowed(row){const ctx=row?.context||(row?.ownerId?{...context(),userId:row.ownerId}:context());return !blockGame(row,ctx);}
  async function flush(){
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}if(error)throw Error(i18n.main.t(error));
    if(!writing&&dirty&&!exiting)writing=(async()=>{while(dirty&&!exiting){dirty=false;const text=JSON.stringify({schema:1,records,integrationHolds},null,2);if(Buffer.byteLength(text)>4*1024*1024)throw Error('privacy ledger limit');await atomicText(file,text);if(!exiting)fs.rmSync(checkpoint,{force:true});}})().catch(e=>{log(e);fail('Invisible Mode privacy data could not be saved. Sharing remains blocked.');throw Error(i18n.main.t(error));}).finally(()=>{writing=null;});
    if(writing)await writing;if(error)throw Error(i18n.main.t(error));
  }
  function flushOnExit(){
    exiting=true;if(saveTimer)clearTimeout(saveTimer);if(noticeTimer)clearTimeout(noticeTimer);
    if(error||!dirty&&!writing)return;
    const temporary=checkpoint+'.'+crypto.randomUUID()+'.tmp';
    try{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(temporary,JSON.stringify({schema:1,records,integrationHolds},null,2));fs.renameSync(temporary,checkpoint);}catch(e){try{fs.rmSync(temporary,{force:true});}catch{}throw e;}
  }
  function status(){const selected=scopes(context());const supported=!!(typeof binding.api?.put==='function'&&typeof binding.api?.post==='function'&&typeof binding.realtime?.close==='function'&&typeof binding.realtime?.connect==='function'&&typeof binding.achievementWorker?.records==='function'&&typeof binding.achievementWorker?.enqueue==='function'&&typeof binding.souvenirStore?.list==='function'&&typeof binding.souvenirStore?.put==='function');return {supported,requested:requested(),active:supported&&enabled(),held:selected.reduce((n,owner)=>{const entry=indexes.get(owner);return n+(entry?entry.keys.size-entry.aliases.size:0);},0),integrationHeld:selected.some(owner=>integrationHolds[owner]?.length),error,visibilityVerified:false};}
  const privacyError=()=>Object.assign(Error(i18n.main.t('Activity sharing is paused by Invisible Mode.')),{code:'NEXUS_INVISIBLE'});
  function holdIntegration(store,ctx){const owner=scope(ctx),previous=integrationHolds[owner]||[];if(previous.includes(store))return;integrationHolds[owner]=[...previous,store];persist();notify();}
  function policy(method,url,data,ctx=context()){
    const verb=String(method).toUpperCase();if(['GET','HEAD','OPTIONS'].includes(verb))return {data};
    let route;try{route=new URL(String(url),'https://hydra.invalid').pathname;}catch{return {data};}
    if(enabled()&&(route==='/auth/realtime'||/^\/profile\/(?:chats?|messages)(?:\/|$)/.test(route)))return {deny:true};
    if(route==='/presigned-urls/achievement-image'){
      const id=data?.remoteGameId;if(enabled()||id!=null&&protectedRecord(null,id,ctx)||id==null&&status().held)return {deny:true};return {data};
    }
    // Store integrations upload the same activity through separate native routes.
    // Reject whole synchronization transactions rather than silently acknowledging
    // partial chunks/commits. DELETE cancellation and unrelated connection/cloud APIs stay native.
    const held=scopes(ctx).some(owner=>indexes.get(owner)?.keys.size);
    const integration=route.match(/^\/profile\/integrations\/(steam|epic)\/(.+)$/);
    if(integration&&verb!=='DELETE'){
      const [,,tail]=integration,game=tail.match(/^games\/([^/]+)$/);
      if(game){let objectId;try{objectId=decodeURIComponent(game[1]);}catch{return {deny:true};}
        if(blockGame({shop:integration[1],objectId},ctx)||scopes(ctx).some(owner=>integrationHolds[owner]?.includes(integration[1])))return {deny:true};
      }else if(/^(?:sync(?:\/|$)|achievement-targets$)/.test(tail)){
        if(enabled())holdIntegration(integration[1],ctx);
        if(enabled())for(const row of (Array.isArray(data)?data:Array.isArray(data?.games)?data.games:[])){
          const objectId=row?.objectId??row?.steamAppId??row?.id;if(objectId!=null)remember({shop:integration[1],objectId:String(objectId)},ctx);
        }
        if(enabled()||held||scopes(ctx).some(owner=>integrationHolds[owner]?.includes(integration[1])))return {deny:true};
      }
    }
    const retro=route.match(/^\/profile\/games\/([\w-]+)\/([^/]+)\/retroachievements\/sync$/);
    if(retro&&verb!=='DELETE'){let objectId;try{objectId=decodeURIComponent(retro[2]);}catch{return {deny:true};}
      if(blockGame({shop:retro[1],objectId},ctx))return {deny:true};
    }
    // Never acknowledge an upload that did not happen: native pending rows must survive.
    if(route==='/profile/games/achievements')return blockGame({remoteId:data?.id},ctx)?{deny:true}:{data};
    if(route==='/profile/games/batch'&&verb==='POST'){
      if(!Array.isArray(data)){if(enabled()||status().held)return {deny:true};return {data};}
      const rows=data.filter(game=>!blockGame(game,ctx));return rows.length?{data:rows}:{skip:true};
    }
    if(route==='/profile/games'&&verb==='POST')return blockGame(data,ctx)?{deny:true}:{data};
    const m=route.match(/^\/profile\/games\/([\w-]+)\/([^/]+)$/);
    if(m&&verb!=='DELETE'&&data&&['playTimeInMilliseconds','playTimeDeltaInSeconds','lastTimePlayed'].some(k=>Object.hasOwn(data,k))){
      let id;try{id=decodeURIComponent(m[2]);}catch{return {deny:true};}
      if(blockGame({shop:m[1],objectId:id},ctx)){
        const safe={...data};for(const k of ['playTimeInMilliseconds','playTimeDeltaInSeconds','lastTimePlayed'])delete safe[k];
        return Object.keys(safe).length?{data:safe}:{skip:true};
      }
    }
    return {data};
  }
  const instances=new WeakSet();
  function attachTransport(instance){
    if(!instance?.interceptors?.request?.use||instances.has(instance))return;instances.add(instance);
    // Recheck after native auth awaits, immediately before Axios dispatch. Reads stay intact.
    instance.interceptors.request.use(config=>{let data=config.data;if(typeof data==='string')try{data=JSON.parse(data);}catch{}
      const result=policy(config.method||'GET',config.url,data);if(result.deny||result.skip)throw privacyError();
      return result.data===data?config:{...config,data:result.data};
    });
  }
  function bind(capabilities){
    binding=capabilities||{};const {api,realtime,achievementWorker,souvenirStore}=binding;
    if(api&&!api.__nexusPrivacy){
      Object.defineProperty(api,'__nexusPrivacy',{value:true});
      for(const method of ['post','postResponse','put','patch'])if(typeof api[method]==='function'){
        const native=api[method];api[method]=async function(url,data,...rest){const result=policy(method==='postResponse'?'POST':method,url,data,rest[0]?.authContext||context());if(result.deny)throw privacyError();if(result.skip)return undefined;return native.call(this,url,result.data,...rest);};
      }
      if(typeof api.delete==='function'){const native=api.delete;api.delete=async function(url,...rest){const result=policy('DELETE',url);if(result.deny)throw privacyError();return native.call(this,url,...rest);};}
      api.onAuthContextChanged?.(()=>{if(enabled())closeRealtime();notify();});
      const descriptor=Object.getOwnPropertyDescriptor(api,'instance');
      if(!descriptor||descriptor.configurable){let instance=api.instance;attachTransport(instance);Object.defineProperty(api,'instance',{configurable:true,get:()=>instance,set:value=>{instance=value;attachTransport(value);}});}else attachTransport(api.instance);
    }
    if(realtime&&!realtime.__nexusPrivacy){Object.defineProperty(realtime,'__nexusPrivacy',{value:true});for(const name of ['connect','reconnectNow'])if(typeof realtime[name]==='function'){const native=realtime[name];realtime[name]=function(...args){if(enabled())return;return native.apply(this,args);};}}
    if(achievementWorker&&!achievementWorker.__nexusPrivacy){Object.defineProperty(achievementWorker,'__nexusPrivacy',{value:true});
      const enqueue=achievementWorker.enqueue,rows=achievementWorker.records;
      achievementWorker.enqueue=async function(item){if(enabled())remember(item,item?.context||context());return enqueue.call(this,item);};
      achievementWorker.records=async function(...args){return (await rows.apply(this,args)).filter(recordAllowed);};
    }
    if(souvenirStore&&!souvenirStore.__nexusPrivacy){Object.defineProperty(souvenirStore,'__nexusPrivacy',{value:true});const list=souvenirStore.list,put=souvenirStore.put;
      souvenirStore.list=async function(...args){const rows=await list.apply(this,args);return args[0]?.nexusUpload===true?rows.filter(recordAllowed):rows;};
      souvenirStore.put=async function(row,...args){if(enabled())remember(row,row?.ownerId?{...context(),userId:row.ownerId}:context());return put.call(this,row,...args);};
    }
    if(enabled()){try{realtime?.close();achievementWorker?.stop?.();binding.souvenirWorker?.stop?.();}catch(e){log(e);}}
    if(dirty)persist();notify();
  }
  async function change(value,persistConfig){
    if(value&&!status().supported)throw Error(i18n.main.t('Invisible Mode is unavailable for this Hydra build. Reinstall the latest Nexus installer.'));
    if(typeof value!=='boolean')throw Error('Invalid privacy preference');if(error)throw Error(i18n.main.t(error));transition=true;
    try{
      binding.realtime?.close();
      if(value){binding.achievementWorker?.stop?.();binding.souvenirWorker?.stop?.();
        const keys=(binding.running?.()||[]).map(row=>typeof row==='string'?row:row.id);
        if(keys.length&&binding.games?.get){for(const key of keys){const game=await binding.games.get(key);if(game)remember(game);}}
        else if(keys.length&&binding.games?.iterator)for(const [key,game]of await binding.games.iterator().all())if(keys.includes(key))remember(game);
      }
      await flush();await persistConfig();await flush();
    }finally{transition=false;if(enabled())closeRealtime();else{try{if(binding.api?.isLoggedIn?.())binding.realtime?.connect();}catch(e){log(e);}triggerWorkers();}notify();}
  }
  function triggerWorkers(){for(const worker of [binding.achievementWorker,binding.souvenirWorker])try{void Promise.resolve(worker?.trigger?.()).catch(log);}catch(e){log(e);}}
  async function resume(win,dialog){
    if(enabled()||(binding.running?.()||[]).length)throw Error(i18n.main.t('Close games and turn off Invisible Mode before resuming sharing.'));
    await flush();if(!status().held&&!status().integrationHeld)return {cancelled:true};
    const confirmedScope=scope(context());
    const answer=await dialog.showMessageBox(win,{type:'warning',title:'Resume activity sharing',message:'Allow Hydra to share stored activity for private games?',detail:'This may upload playtime, achievements and screenshots that were kept local. Other users may see them. This cannot retract information already shared.',buttons:['Cancel','Resume sharing'],defaultId:0,cancelId:0,noLink:true});
    if(answer.response!==1)return {cancelled:true};
    if(scope(context())!==confirmedScope)throw Error(i18n.main.t('Your Hydra account changed. Reopen the confirmation before resuming sharing.'));
    if(enabled()||(binding.running?.()||[]).length)throw Error(i18n.main.t('Close games and turn off Invisible Mode before resuming sharing.'));
    const selected=scopes(context()),before=records,beforeIntegrations=integrationHolds;integrationHolds=Object.assign(Object.create(null),Object.fromEntries(Object.entries(integrationHolds).filter(([owner])=>!selected.includes(owner))));records=Object.assign(Object.create(null),Object.fromEntries(Object.entries(records).filter(([slot])=>!selected.includes(slot.slice(0,24)))));rebuild();persist();
    try{await flush();}catch(e){records=before;integrationHolds=beforeIntegrations;rebuild();throw e;}
    notify();triggerWorkers();return {resumed:true};
  }
  return {bind,status,blockGame,change,resume,flush,flushOnExit,policy};
}
module.exports={createPrivacy};
