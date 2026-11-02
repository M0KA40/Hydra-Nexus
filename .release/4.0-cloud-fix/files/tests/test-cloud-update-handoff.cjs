'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCloudService}=require('../src/cloud-service.cjs');
const {createUpdateShutdown}=require('../src/update-shutdown.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-handoff-'));
 const engine={initialize:async()=>{},snapshot:()=>({games:[],points:[]})};
 let providerBusy=false,healthCalls=0,cancels=0,finishHealth,status='connected';
 const provider={initialize:async()=>{},snapshot:()=>({status,provider:'onedrive',busy:providerBusy,transfers:[]}),health:()=>{healthCalls++;providerBusy=true;return new Promise((resolve,reject)=>{finishHealth=()=>{providerBusy=false;reject(Error('Cloud operation cancelled'));};});},cancelReadOnly:async()=>{cancels++;finishHealth?.();}};
 const service=createCloudService({directory,library:async()=>[],createBackupEngine:()=>engine,createCloudProvider:()=>provider});
 try{
  const resumeIdle=await service.pauseForUpdate();
  await assert.rejects(service.snapshot(),/update operation/);
  await assert.rejects(service.action(null,'cloudSettings',{enabled:true}),/update operation/);
  await assert.rejects(fs.access(path.join(directory,'cloud')));
  resumeIdle();await service.action(null,'cloudSettings',{enabled:true});
  status='reconnect';await service.snapshot();assert.equal(healthCalls,1);
  const resume=await service.pauseForUpdate(undefined,{timeoutMs:300});
  assert.ok(cancels);assert.equal(service.busy(),false);
  for(let i=0;i<5;i++)await service.snapshot();
  assert.equal(healthCalls,1,'polls must not restart health during handoff');
  await assert.rejects(service.action(null,'cloudRefreshRemote'),/update operation/);
  resume();
  // A real transfer must finish, rather than be cancelled to force installation.
  providerBusy=true;provider.cancelReadOnly=async()=>false;
  let settled=false;const pending=service.pauseForUpdate(undefined,{timeoutMs:300}).then(release=>{settled=true;return release;});
  await wait(35);assert.equal(settled,false);providerBusy=false;(await pending)();
  providerBusy=true;await assert.rejects(service.pauseForUpdate(undefined,{timeoutMs:35}),/Wait for Nexus Cloud/);
  providerBusy=false;await service.action(null,'cloudSettings',{enabled:true});
  const abort=new AbortController();providerBusy=true;const aborted=service.pauseForUpdate(abort.signal);abort.abort();
  await assert.rejects(aborted,/Hydra was kept open/);providerBusy=false;
  const afterAbort=await service.pauseForUpdate();afterAbort();
  // A late reservation cannot leak its hold after shutdown timeout.
  let releaseReservation,released=0;
  const shutdown=createUpdateShutdown({app:{exit(){throw Error('must not exit');}},getNative:()=>({prepare:async()=>{},close:async()=>{}}),flush:async()=>{},guard(){},reserve:()=>new Promise(resolve=>releaseReservation=()=>resolve(()=>released++)),timeoutMs:20});
  await assert.rejects(shutdown.prepare(),/did not finish/);assert.equal(shutdown.busy(),true);
  releaseReservation();await wait(20);assert.equal(released,1);assert.equal(shutdown.busy(),false);
  const failure=createUpdateShutdown({app:{exit(){throw Error('must not exit');}},getNative:()=>({prepare:async()=>{},close:async()=>{},reopen:async()=>{}}),flush:async()=>{},guard(){},reserve:async()=>()=>released++});
  const prepared=await failure.prepare();await assert.rejects(prepared.commit(async()=>{throw Error('approval failed');}),/approval failed/);
  assert.equal(released,2);assert.equal(failure.busy(),false);
  console.log('PASS cloud update handoff: lazy idle, read cancellation, polling isolation, live transfer drain, timeout/abort resume, late reservation release and approval rollback.');
 }finally{providerBusy=false;finishHealth?.();await service.stop();await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
