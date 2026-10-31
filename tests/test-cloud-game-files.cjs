'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCloudService}=require('../src/cloud-service.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-game-files-'));
 const save=path.join(root,'save.dat'),ach=path.join(root,'stats.bin'),old=path.join(root,'old-save.dat'),oldAch=path.join(root,'old-stats.bin'),exe=path.join(root,'fixture.exe');
 for(const file of [save,ach,old,oldAch,exe])await fs.writeFile(file,'original '+path.basename(file));
 const games=[{key:'steam:1',shop:'steam',objectId:'1',title:'Installed fixture',executablePath:exe,isDeleted:false},{key:'steam:2',shop:'steam',objectId:'2',title:'Removed save fixture',isDeleted:true},{key:'steam:3',shop:'steam',objectId:'3',title:'Removed achievement fixture',isDeleted:true}];
 const {cloudFixture}=require('./cloud-fixture.cjs'),transport=cloudFixture();let enabled=true,reads=0;
 const service=createCloudService({directory:path.join(root,'Nexus'),pluginEnabled:()=>enabled,isRunning:async()=>false,library:async()=>{reads++;return games;},saveScanner:async list=>Object.fromEntries(list.map(g=>[g.key,{files:g.key==='steam:1'?{[save]:{}}:g.key==='steam:2'?{[old]:{}}:{}}])),achievementFiles:async g=>g.key==='steam:1'?[{filePath:ach}]:g.key==='steam:3'?[{filePath:oldAch}]:[],createCloudProvider:transport.provider});
 const settle=async()=>{for(let i=0;i<300;i++){if(!service.busy())return;await new Promise(r=>setTimeout(r,5));}throw Error('fixture timeout');};
 try{
  await service.action(null,'cloudScan');await settle();let state=await service.snapshot();assert.deepEqual(state.games.map(g=>g.key),['steam:1']);assert.equal(state.games[0].saveFiles,1);assert.equal(state.games[0].achievementFiles,1);
  await service.action(null,'cloudBackup',{key:'steam:1'});await settle();state=await service.snapshot();const point=state.points[0],manifest=transport.cloud.get(point.id).manifest;assert.deepEqual(manifest.files.map(f=>f.kind).sort(),['achievement','save']);
  await fs.writeFile(save,'changed save');await fs.writeFile(ach,'changed achievements');await service.action(null,'cloudRecoveryScan');await settle();await service.action(null,'cloudRecoveryPrepare',{ids:[point.id]});await settle();const recovery=(await service.snapshot()).recovery;assert.equal(recovery.phase,'review');assert.equal(recovery.items[0].locations.length,2);await service.action(null,'cloudRecoveryRestore',{token:recovery.confirmation,confirmed:true});await settle();assert.equal(await fs.readFile(save,'utf8'),'original save.dat');assert.equal(await fs.readFile(ach,'utf8'),'original stats.bin');
  await service.action(null,'cloudSettings',{includeUninstalled:true});await settle();state=await service.snapshot();assert.equal(state.games.length,3);assert.equal(state.games.find(g=>g.key==='steam:3').achievementFiles,1);
  await service.action(null,'cloudBackup',{key:'steam:3'});await settle();assert.ok((await service.snapshot()).points.some(p=>p.key==='steam:3'),'achievement-only game creates a nonempty recovery point');
  await service.action(null,'cloudSettings',{includeUninstalled:false});await settle();state=await service.snapshot();assert.equal(state.games.some(g=>g.key==='steam:2'),false);assert.equal(state.games.some(g=>g.key==='steam:3'),true,'history remains visible when uninstalled discovery is disabled');
  const before=reads;await service.snapshot();await service.snapshot();assert.equal(reads,before,'unchanged snapshots reuse library metadata');enabled=false;await assert.rejects(service.action(null,'cloudBackup',{key:'steam:1'}),/Enable/);
  console.log('PASS: one game recovery point restores both save and native achievement files; opt-in removed games, achievement-only backups, retained history, library caching and disabled-plugin guards. Synthetic files only.');
 }finally{await service.stop();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
