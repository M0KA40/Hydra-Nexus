'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCloudService}=require('../src/cloud-service.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-preferences-')),save=path.join(root,'save.dat');await fs.writeFile(save,'synthetic progress');
 const game={key:'steam:7',shop:'steam',objectId:'7',title:'Synthetic game',coverImageUrl:'https://example.test/portrait.webp',iconUrl:'https://example.test/icon.webp'};
 const {cloudFixture}=require('./cloud-fixture.cjs'),transport=cloudFixture();let checks=0,releaseCheck,connected=false,checking=false;
 const provider=()=>({...transport.provider(),initialize:async()=>{},snapshot:()=>({provider:'dropbox',status:checking?'checking':connected?'connected':'reconnect',busy:checking,transfers:[]}),health:async()=>{checks++;checking=true;await new Promise(r=>releaseCheck=r);checking=false;connected=true;return {storage:{used:10,total:100}};},cancel:()=>{}});
 const options={directory:path.join(root,'state'),library:async()=>[game],isRunning:async()=>false,saveScanner:async()=>({[game.key]:{files:{[save]:{}}}}),createCloudProvider:provider};
 let service=createCloudService(options);
 const settle=async()=>{for(let n=0;n<200;n++){if(!service.busy())return;await new Promise(r=>setTimeout(r,5));}throw Error('Fixture did not settle');};
 try{
  await service.snapshot();assert.equal(checks,0,'disabled cloud does not perform remote I/O');
  let state=await service.action(null,'cloudSettings',{enabled:true,autoBackup:true});assert.equal(checks,1);assert.equal(state.provider.status,'checking','opening saved connection reports checking without OAuth');releaseCheck();await settle();state=await service.snapshot();assert.equal(state.provider.connected,true);assert.equal(state.provider.used,10);await service.snapshot();assert.equal(checks,1,'snapshots do not repeat remote checks');
  await service.action(null,'cloudScan');await settle();await service.action(null,'cloudBackup',{key:game.key});await settle();state=await service.snapshot();const id=state.points[0].id;assert.equal(state.games[0].image,game.coverImageUrl,'portrait artwork preferred over small app icon');
  await service.action(null,'cloudGameSettings',{key:game.key,enabled:false});await assert.rejects(service.action(null,'cloudBackup',{key:game.key}),/disabled/);await service.observe([game]);await service.observe([]);await settle();assert.equal((await service.snapshot()).points.length,1,'disabled game exit never schedules another backup');assert.equal((await service.snapshot()).games[0].backupEnabled,false);
  await fs.writeFile(save,'changed');await service.action(null,'cloudRecoveryScan');await settle();await service.action(null,'cloudRecoveryPrepare',{ids:[id]});await settle();const plan=(await service.snapshot()).recovery;await service.action(null,'cloudRecoveryRestore',{token:plan.confirmation,confirmed:true});await settle();assert.equal(await fs.readFile(save,'utf8'),'synthetic progress','disabling backup preserves restoration');
  await service.stop();connected=false;service=createCloudService(options);state=await service.snapshot();assert.equal(state.games[0].backupEnabled,false,'game preference survives process restart');assert.equal(checks,2,'saved cloud session checked automatically after restart');releaseCheck();await settle();assert.equal((await service.snapshot()).provider.connected,true);
  await service.action(null,'cloudGameSettings',{key:game.key,enabled:true});assert.equal((await service.snapshot()).games[0].backupEnabled,true);await assert.rejects(service.action(null,'cloudGameSettings',{key:'other:99',enabled:false}),/Invalid/);
  console.log('PASS: saved session auto-check, no remote I/O while disabled, no repeated snapshot checks; persistent per-game backup switch gates manual and game-exit jobs while retaining restore; portrait selection. Synthetic adapters/files only.');
 }finally{releaseCheck?.();await service.stop();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
