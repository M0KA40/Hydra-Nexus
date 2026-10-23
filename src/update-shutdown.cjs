'use strict';
// This path belongs only to a confirmed Nexus update. Normal Hydra quit is untouched.
// app.exit is used only after all mandatory writes complete: app.quit can remain
// pending forever inside Hydra's native torrent shutdown promise.
function createUpdateShutdown({app,getNative,flush,guard,timeoutMs=30000}){
  let preparing=false;
  async function prepare(){
    if(preparing)throw Error('An update operation is already running');
    guard();const native=getNative();
    if(typeof native?.prepare!=='function'||typeof native?.close!=='function')throw Error('This Hydra version does not support a safe update restart. Close Hydra and run the installer.');
    preparing=true;let timer;
    try{
      await Promise.race([(async()=>{await flush();guard();await native.prepare();guard();})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Saving before the update did not finish. Hydra was kept open.')),timeoutMs);})]);
      return {async commit(approve){
        // No timer or deferred quit after closing LevelDB; exit immediately after
        // approval is durable. If approval fails, reopen the native database.
        guard();await flush();
        try{await native.close();}catch(error){await native.reopen?.();preparing=false;throw error;}
        try{await approve();}catch(error){await native.reopen?.();preparing=false;throw error;}
        app.exit(0);
      }};
    }catch(error){preparing=false;throw error;}finally{clearTimeout(timer);}
  }
  return {prepare,busy:()=>preparing,cancel:()=>{preparing=false;}};
}
module.exports={createUpdateShutdown};
