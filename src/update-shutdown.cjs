'use strict';
function createUpdateShutdown({app,getNative,flush,guard,timeoutMs=30000}){
  let active=null,generation=0;
  const failure=()=>Error('Saving before the update did not finish. Hydra was kept open.');
  function valid(op){if(active!==op||op.cancelled||op.generation!==generation)throw failure();}
  function release(op){if(active===op)active=null;}
  async function recover(op){
    if(op.recovered)return;
    if(op.closed){await op.native.reopen?.();op.closed=false;}
    if(op.nativeStarted)await op.native.recover?.();
    op.recovered=true;
  }
  function recoverLater(op,pending){op.recovering=true;return pending.catch(()=>{}).then(()=>recover(op)).then(()=>{if(!op.recoveryError){op.recovering=false;release(op);}},error=>{op.recoveryError=error;});}
  async function phase(op,work,{closing=false}={}){
    valid(op);let timer;
    const task=Promise.resolve().then(()=>{valid(op);return work(op.controller.signal);});
    // A timed-out native close cannot be abandoned while a newer attempt opens DB.
    op.pending=task;
    try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{op.cancelled=true;op.controller.abort();reject(failure());},timeoutMs);})]);}
    catch(error){if(!closing&&op.nativePending){void recoverLater(op,op.nativePending);}if(closing){void recoverLater(op,task);}throw error;}
    finally{clearTimeout(timer);if(op.pending===task)op.pending=null;}
  }
  async function prepare(){
    if(active)throw Error('An update operation is already running');
    guard();const native=getNative();
    if(typeof native?.prepare!=='function'||typeof native?.close!=='function')throw Error('This Hydra version does not support a safe update restart. Close Hydra and run the installer.');
    const op={generation:++generation,native,cancelled:false,controller:new AbortController(),recovering:false,committing:false};active=op;
    try{
      await phase(op,async signal=>{await flush(signal);valid(op);guard();op.nativeStarted=true;op.nativePending=Promise.resolve().then(()=>native.prepare(signal));try{await op.nativePending;}finally{op.nativePending=null;}valid(op);guard();});
      return {async commit(approve,revokeApproval,beforeExit){
        valid(op);if(op.committing)throw Error('An update operation is already running');op.committing=true;
        try{
          guard();await phase(op,signal=>flush(signal));valid(op);guard();
          await phase(op,async()=>{op.closed=true;await native.close();},{closing:true});valid(op);guard();
          // The approval callback must use the signal to retract a late durable write.
          await phase(op,signal=>approve(signal));valid(op);guard();await phase(op,async()=>beforeExit?.());valid(op);guard();app.exit(0);
        }catch(error){
          op.cancelled=true;op.controller.abort();
          // Revoke durable approval before awaiting any potentially slow DB recovery.
          let recoveryTimer;
          const recovery=Promise.resolve().then(async()=>{
            await revokeApproval?.();
            if(!op.recovering)await recover(op);
          });
          try{await Promise.race([recovery,new Promise((_,reject)=>{recoveryTimer=setTimeout(()=>reject(failure()),timeoutMs);})]);}
          catch(recoveryError){op.recoveryError=recoveryError;}
          finally{clearTimeout(recoveryTimer);}
          // A failed or stalled recovery stays reserved, even if its I/O returns late.
          if(op.recoveryError)op.recovering=true;else if(!op.recovering)release(op);
          throw error;
        }
      }};
    }catch(error){if(!op.recovering){try{await recover(op);release(op);}catch(recoveryError){op.recoveryError=recoveryError;op.recovering=true;}}throw error;}
  }
  return {prepare,busy:()=>!!active,cancel(){const op=active;if(!op)return;op.cancelled=true;op.controller.abort();generation++;if(!op.recovering){if(op.nativeStarted)return recoverLater(op,op.nativePending||Promise.resolve());release(op);}}};
}
module.exports={createUpdateShutdown};
