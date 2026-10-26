'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {atomicText}=require('./themes.cjs'),{validKey}=require('./activity.cjs');
const actions=new Set(['notify','sleep','shutdown']);
const keyOf=row=>row.shop+':'+row.objectId;
const identity=row=>keyOf(row)+'|'+String(row.timestamp??'')+'|'+String(row.uri??'');
const complete=row=>row.progress===1||['complete','seeding'].includes(row.status);
const work=row=>row.queued===true||row.extracting===true||['active','queued','waiting','preparing','verifying'].includes(row.status);
function createDownloadFinish({directory,enabled=()=>true,readDownloads,execute,notify=()=>{},changed=()=>{},canAct=()=>true,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
  const file=path.join(directory,'download-finish.json');let prefs={schema:1,action:'notify'},initializing=null,queue=Promise.resolve(),timer=null,checking=null,again=false,serial=0,workVersion=0,lastEmitted='';
  let state={armed:false,phase:'idle',action:'notify',deadline:null,remaining:0},tracked=new Map(),extracted=new Set();
  function snapshot(){return {...state,remaining:state.deadline?Math.max(0,Math.ceil((state.deadline-now())/1000)):0,jobs:tracked.size};}
  function emit(){const value=snapshot(),key=JSON.stringify(value);if(key===lastEmitted)return;lastEmitted=key;changed(value);}
  async function init(){if(initializing)return initializing;initializing=(async()=>{try{const d=JSON.parse(await fs.readFile(file,'utf8'));if(d.schema!==1||!actions.has(d.action))throw Error();prefs=d;state.action=d.action;}catch(error){if(error.code!=='ENOENT')throw Error('Download action preferences could not be read. The original file was preserved.');}return snapshot();})();return initializing;}
  async function preferences(action){await init();if(!actions.has(action))throw Error('Choose a download finish action.');const task=queue.catch(()=>{}).then(async()=>{await atomicText(file,JSON.stringify({schema:1,action},null,2));prefs={schema:1,action};if(!state.armed)state.action=action;});queue=task;await task;emit();return snapshot();}
  function cancel(reason='cancelled'){serial++;if(timer!==null)clearTimer(timer);timer=null;state={...state,armed:false,phase:reason,deadline:null};tracked.clear();extracted.clear();emit();return snapshot();}
  function stopCountdown(){if(timer!==null)clearTimer(timer);timer=null;state.deadline=null;}
  async function arm(action){cancel('idle');const token=serial;await preferences(action);if(token!==serial)return snapshot();if(!enabled())throw Error('Enable Download Finish Actions in Plugins first.');const rows=await readDownloads();if(token!==serial||!enabled())return snapshot();const jobs=rows.filter(row=>validKey(keyOf(row))&&work(row));if(!jobs.length)throw Error('Start or queue a download first.');for(const row of jobs)tracked.set(keyOf(row),identity(row));state={armed:true,phase:'waiting',action,deadline:null};emit();await refresh();return snapshot();}
  async function evaluate(final=false){
    if(!state.armed)return false;if(!enabled()){cancel('disabled');return false;}
    const token=serial,rows=await readDownloads();if(!state.armed||token!==serial)return false;const byKey=new Map(rows.filter(row=>validKey(keyOf(row))).map(row=>[keyOf(row),row]));
    // Include work added after arming. Historical completed rows never join a session.
    for(const row of rows)if(validKey(keyOf(row))&&work(row)){const key=keyOf(row),id=identity(row);if(tracked.get(key)!==id){tracked.set(key,id);extracted.delete(id);}}
    let waiting=false;
    for(const [key,id]of tracked){const row=byKey.get(key);if(!row||identity(row)!==id||['error','failed','paused','removed','cancelled'].includes(row.status)){cancel('interrupted');return false;}
      if(!complete(row)||row.queued)waiting=true;
      if(row.extracting||row.automaticallyExtract&&!extracted.has(id))waiting=true;
    }
    if(waiting){stopCountdown();state.phase='waiting';emit();return false;}
    if(final&&!await canAct()){cancel('busy');notify('Download action cancelled because another operation is running.');return false;}
    if(token!==serial||!state.armed||!enabled())return false;
    return tracked.size>0;
  }
  async function finish(token){
    timer=null;if(token!==serial||!state.armed)return;
    try{const version=workVersion;if(!await evaluate(true)||token!==serial)return;if(version!==workVersion){stopCountdown();state.phase='waiting';await refresh();return;}const action=state.action;state={...state,armed:false,phase:'executing',deadline:null};tracked.clear();extracted.clear();emit();await execute(action);if(token!==serial)return;state.phase='complete';emit();}
    catch(error){if(token!==serial)return;cancel('error');notify('The download finish action could not be completed.');}
  }
  async function check(){
    if(!await evaluate())return;
    if(state.action==='notify'){state={...state,armed:false,phase:'complete',deadline:null};tracked.clear();extracted.clear();notify('All queued downloads and enabled extractions are complete.');emit();return;}
    if(state.deadline!==null)return;
    const token=serial;state.phase='countdown';state.deadline=now()+60000;timer=setTimer(()=>void finish(token),60000);timer?.unref?.();emit();notify(state.action==='sleep'?'Sleep in 60 seconds. Click to cancel.':'Shutdown in 60 seconds. Click to cancel.',()=>{if(token===serial)cancel();});
  }
  function refresh(){workVersion++;if(checking){again=true;return checking;}checking=(async()=>{do{again=false;await check();}while(again&&state.armed);})().catch(()=>cancel('error')).finally(()=>{checking=null;});return checking;}
  function event(channel,...args){
    if(!state.armed)return;
    if(channel==='on-extraction-complete'){const key=args[0]+':'+args[1],id=tracked.get(key);if(id)extracted.add(id);}
    else if(channel==='on-extraction-failed'&&tracked.has(args[0]+':'+args[1])){cancel('extractionFailed');return;}
    if(['on-download-progress','on-downloads-updated','on-extraction-complete','on-extraction-failed'].includes(channel))void refresh();
  }
  return {init,preferences,arm,cancel,refresh,event,snapshot,close:()=>cancel('closed')};
}
module.exports={createDownloadFinish,complete,work,identity};
