'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCloudService}=require('../src/cloud-service.cjs');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-service-'));
 let backups=[],initialized=0,providerStatus='connected',resolveBackup;
 const engine={initialize:async()=>{initialized++;},snapshot:()=>({games:[],points:[]}),scan:async()=>{},backup:async(key,opts)=>{backups.push({key,opts});await new Promise(resolve=>{resolveBackup=resolve;});return {id:'point'};},discardTemporary:async()=>{},getPoint:()=>({folder:'synthetic',key:'steam:1'}),verify:async()=>({manifest:{game:{},files:[]}})};
 const provider={initialize:async()=>{},snapshot:()=>({status:providerStatus,transfers:[]}),connect:async p=>{providerStatus='connected';},disconnect:async()=>{providerStatus='connected';},uploadPoint:async()=>{}};
 const service=createCloudService({directory,library:async()=>[{shop:'steam',objectId:'1',title:'Synthetic game'},{shop:'steam',objectId:'2',title:'Second synthetic game'}],isRunning:async()=>false,dialog:{},createBackupEngine:()=>engine,createCloudProvider:()=>provider});
 try{
  await service.observe([{id:'steam:1'}]);await service.observe([]);assert.equal(initialized,0,'disabled startup does not initialize cloud');
  await assert.rejects(fs.access(path.join(directory,'cloud')));
  assert.equal((await service.snapshot()).settings.enabled,false);
  await assert.rejects(service.action(null,'cloudBackup',{key:'steam:1'}),/Enable/);
  await assert.rejects(service.action(null,'cloudSettings',{enabled:'yes'}),/Invalid/);
  await assert.rejects(service.action(null,'cloudSettings',{backupLocation:'C:/outside'}),/Invalid/);
  await service.action(null,'cloudSettings',{enabled:true,autoBackup:true});
  await service.observe([{id:'steam:1'}]);await service.observe([]);
  for(let n=0;n<50&&!resolveBackup;n++)await new Promise(r=>setTimeout(r,5));
  assert.equal(backups.length,1);assert.equal(backups[0].opts.reason,'GameExit');assert.equal(service.busy(),true);
  await assert.rejects(service.action(null,'cloudSettings',{enabled:false}),/Wait/);
  await service.observe([{id:'steam:2'}]);await service.observe([]);assert.equal(backups.length,1,'second exit waits for active backup');resolveBackup();for(let n=0;n<100&&backups.length<2;n++)await new Promise(r=>setTimeout(r,5));assert.equal(backups.length,2,'queued exit is backed up after the first operation');assert.equal(backups[1].key,'steam:2');resolveBackup();await service.stop();assert.equal(service.busy(),false);
  const saved=JSON.parse(await fs.readFile(path.join(directory,'cloud/settings.json'),'utf8'));assert.equal(saved.autoUpload,false);assert.equal(saved.autoBackup,true);
  assert.equal((await service.snapshot()).activity.length,2);
  const receipts=Array.from({length:100},(_,i)=>({id:'receipt-'+i,state:i===0?'uploading':'uploaded',time:i,direction:'upload'})),limited=createCloudService({directory:path.join(directory,'limit-fixture'),library:async()=>[],createCloudProvider:()=>({initialize:async()=>{},snapshot:()=>({status:'connected',transfers:receipts})})});const limitedState=await limited.snapshot();assert.equal(limitedState.transfers.length,20);assert.equal(limitedState.transfers[0].id,'receipt-0','active operation stays visible even with old timestamp');assert.ok(limitedState.transfers.some(t=>t.id==='receipt-99'));assert.equal(limitedState.transfers.some(t=>t.id==='receipt-1'),false);await limited.stop();
  console.log('PASS: cloud disabled startup has no filesystem side effects; opt-in persistence, validated preferences, queued game-exit backups, busy guards and shutdown wait; synthetic adapters only.');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
