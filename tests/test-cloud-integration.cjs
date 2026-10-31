'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createCloudService}=require('../src/cloud-service.cjs');
(async()=>{
 const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-integration-')),saves=path.join(fixture,'saves'),target=path.join(fixture,'second-device'),cloud=new Map();
 await fs.mkdir(saves);await fs.mkdir(target);await fs.writeFile(path.join(saves,'save.dat'),'original synthetic save');
 const game={shop:'steam',objectId:'42',key:'steam:42',title:'Synthetic game'};
 const provider=()=>({initialize:async()=>{},snapshot:()=>({provider:'onedrive',status:'connected',transfers:[]}),uploadPoint:async({id,directory,manifest})=>{const payload=new Map();for(const name of ['manifest.json','COMPLETE',...manifest.files.map(f=>f.payload)])payload.set(name,await fs.readFile(path.join(directory,name)));cloud.set(id,{payload,manifest});},list:async()=>[...cloud].map(([id,{manifest}])=>({...manifest,id,manifestHash:'a'.repeat(64)})),downloadPoint:async({id,directory})=>{await fs.mkdir(directory);for(const [name,bytes]of cloud.get(id).payload){await fs.mkdir(path.dirname(path.join(directory,name)),{recursive:true});await fs.writeFile(path.join(directory,name),bytes);}return {directory,state:'downloaded'};}});
 const options=directory=>({directory,library:async()=>[game],isRunning:async()=>false,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[target]})},createCloudProvider:provider,engineOptions:{scan:async()=>({[game.key]:{files:{[path.join(saves,'save.dat')]:{}}}})}});
 const first=createCloudService(options(path.join(fixture,'first'))),second=createCloudService({...options(path.join(fixture,'second')),library:async()=>[]});
 const settle=async service=>{for(let n=0;n<200;n++){if(!service.busy())return;await new Promise(r=>setTimeout(r,5));}throw Error('Cloud fixture did not settle');};
 try{
  await first.action(null,'cloudSettings',{enabled:true,autoUpload:true});await first.action(null,'cloudBackup',{key:game.key});await settle(first);
  let state=await first.snapshot();assert.equal(state.points.length,1);assert.equal(cloud.size,1);assert.equal(state.transfers.at(-1).status,'completed');const id=state.points[0].id;
  await second.action(null,'cloudSettings',{enabled:true});await second.action(null,'cloudRefreshRemote');await settle(second);state=await second.snapshot();assert.equal(state.availableGames.length,0,'fresh device has no local library entries');assert.equal(state.games.length,1);assert.equal(state.games[0].hasSaves,false);assert.equal(state.points[0].local,false);assert.equal(state.points[0].cloud,true);
  await second.action(null,'cloudDownload',{id});await settle(second);state=await second.snapshot();assert.equal(state.points[0].local,false);assert.equal(state.points[0].verified,true);assert.equal(await fs.readFile(path.join(target,'Nexus-Backup-'+id,'data/00000000'),'utf8'),'original synthetic save');
  await second.action(null,'cloudRecoveryScan');await settle(second);await second.action(null,'cloudRecoveryPrepare',{ids:[id]});await settle(second);let plan=(await second.snapshot()).recovery;assert.equal(plan.phase,'review','saved location supports automatic preview');await second.action(null,'cloudRecoveryLocation',{id,root:plan.items[0].locations[0].id});plan=(await second.snapshot()).recovery;await second.action(null,'cloudRecoveryRestore',{token:plan.confirmation,confirmed:true});await settle(second);assert.equal(await fs.readFile(path.join(target,'save.dat'),'utf8'),'original synthetic save');
  assert.equal(await fs.readFile(path.join(saves,'save.dat'),'utf8'),'original synthetic save');
  console.log('PASS: real backup engine + service orchestration; verified point upload, new-PC cloud-only catalog, verified download/import and explicit local remap/restore. Synthetic files and cloud adapter only.');
 }finally{await first.stop();await second.stop();await fs.rm(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
