'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createCloudService}=require('../src/cloud-service.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-real-sources-')),directory=path.join(root,'state'),cache=path.join(root,'Steam/userdata/123/config/librarycache/2.json'),save=path.join(root,'save.dat'),ach=path.join(root,'stats.bin');
 await fs.mkdir(path.dirname(cache),{recursive:true});await fs.writeFile(cache,'{"achievementSchema":true}');await fs.writeFile(save,'progress');await fs.writeFile(ach,'achievements');
 const games=[1,2,3].map(id=>({key:'steam:'+id,shop:'steam',objectId:String(id),title:'Fixture '+id}));
 const {cloudFixture}=require('./cloud-fixture.cjs'),transport=cloudFixture();let members=games;
 const service=createCloudService({directory,pluginEnabled:()=>true,isRunning:async()=>false,library:async()=>members,saveScanner:async()=>({'steam:1':{files:{[save]:{}}},'steam:2':{files:{[cache]:{}}}}),achievementFiles:async g=>g.key==='steam:2'?[{filePath:cache}]:g.key==='steam:3'?[{filePath:ach}]:[],createCloudProvider:transport.provider});
 const settle=async()=>{for(let n=0;n<200;n++){if(!service.busy())return;await new Promise(r=>setTimeout(r,5));}throw Error('fixture timeout');};
 try{
  // Seed the exact old false-positive index. No user files are used.
  const location=path.join(directory,'cloud/backups');await fs.mkdir(location,{recursive:true});await fs.writeFile(path.join(location,'library.json'),JSON.stringify({schema:1,games:{'steam:2':{...games[1],saveRoots:[{id:'detected-old-cache',path:cache,file:true,kind:'achievement'}],detected:true,scanState:'detected',achievementFiles:1,fileCount:1}},points:[],activity:[]}));
  assert.equal((await service.snapshot()).games.length,0,'old cache-only detection is removed on upgrade without waiting for manual scan');
  await service.action(null,'cloudScan');await settle();let state=await service.snapshot();assert.deepEqual(state.games.map(g=>g.key).sort(),['steam:1','steam:3'],'only actual local saves or achievement files qualify');assert.equal(await fs.readFile(cache,'utf8'),'{"achievementSchema":true}','metadata is never deleted or modified');
  await service.action(null,'cloudBackup',{key:'steam:1'});await settle();members=[games[1],games[2]];await service.action(null,'cloudScan');await settle();state=await service.snapshot();assert.equal(state.games.find(g=>g.key==='steam:1').inLibrary,false,'history remains recoverable when a game leaves the library');assert.equal(state.games.some(g=>g.key==='steam:2'),false);
  console.log('PASS: library membership plus actual progress source; Steam metadata-only games excluded, old false-positive index corrected without modifying files, save-only and achievement-only supported, prior history retained.');
 }finally{await service.stop();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
