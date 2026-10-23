'use strict';
const crypto=require('node:crypto');
function createUpdateConfirmation({send,trusted,dialog,timeoutMs=120000}){
  const pending=new Map();
  async function confirm(win,update){
    let nativeUI=false;
    if(win&&!win.isDestroyed()&&trusted(win))try{nativeUI=await win.webContents.executeJavaScript('Boolean(window.__nexusNativeHost && window.__nexusUpdateControl)');}catch{}
    if(!nativeUI)return null; // caller retains the OS dialog for unsupported renderers
    pending.get(win)?.finish(false);
    const id=crypto.randomBytes(24).toString('hex');
    return new Promise(resolve=>{
      let done=false,timer;
      const closed=()=>finish(false);
      const navigated=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame!==false)finish(false);};
      const finish=accepted=>{
        if(done)return;done=true;clearTimeout(timer);pending.delete(win);
        win.removeListener('closed',closed);win.webContents.removeListener('did-start-navigation',navigated);
        if(!win.isDestroyed())send(win,{event:'updateConfirmation',value:null});
        resolve(accepted);
      };
      pending.set(win,{id,finish});win.once('closed',closed);win.webContents.on('did-start-navigation',navigated);
      timer=setTimeout(()=>finish(false),timeoutMs);timer.unref?.();
      send(win,{event:'updateConfirmation',value:{id,version:update.version,source:update.source,sha256:update.sha256}});
    });
  }
  function respond(win,data){
    const entry=pending.get(win);
    if(!entry||!trusted(win)||data?.id!==entry.id||typeof data.accepted!=='boolean')return {accepted:false};
    entry.finish(data.accepted);return {accepted:true};
  }
  return {confirm,respond};
}
module.exports={createUpdateConfirmation};
