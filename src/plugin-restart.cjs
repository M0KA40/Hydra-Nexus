'use strict';
function createPluginRestart({app,dialog,shutdown,getConfig,saveConfig,guard=()=>{}}){
  let pending=false;
  return {busy:()=>pending,async enable(win){
    if(pending)throw Error('An update operation is already running');
    if(getConfig().plugins.downloadFinish)return {cancelled:true};
    pending=true;
    try{
      guard();
      const answer=await dialog.showMessageBox(win,{type:'question',title:'Download Finish Actions',message:'Enable Download Finish Actions and restart Hydra?',detail:'Save your work before restarting. This plugin becomes available after Hydra restarts. No power action is armed automatically.',buttons:['Cancel','Enable & restart Hydra'],defaultId:0,cancelId:0,noLink:true});
      if(answer.response!==1)return {cancelled:true};
      guard();const previous=getConfig().plugins.downloadFinish;
      const transaction=await shutdown.prepare();
      await transaction.commit(async signal=>{if(signal.aborted)throw Error('Nexus did not respond. Try again.');await saveConfig(true);if(signal.aborted){await saveConfig(previous);throw Error('Nexus did not respond. Try again.');}},()=>saveConfig(previous),()=>app.relaunch());
      return {restarting:true};
    }finally{pending=false;}
  }};
}
module.exports={createPluginRestart};
