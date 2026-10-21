'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path');
const {BackupEngine,keyOf,atomicJson,filesIn}=require('../src/core.cjs');
const {DriveUploader}=require('../src/drive.cjs');
let checks=0;
async function root(name){return fsp.mkdtemp(path.join(__dirname,'fault-'+name+'-'));}
async function localFailures(){
  const dir=await root('restore'),user=path.join(dir,'User'),source=path.join(user,'Game','save.dat');await fsp.mkdir(path.dirname(source),{recursive:true});await fsp.writeFile(source,'level-one');
  const game={shop:'steam',objectId:'123',title:'Fault game'},empty={shop:'steam',objectId:'456',title:'Empty game'};let metadata={game,achievementData:{achievements:[{name:'FIRST'}],unlockedAchievements:[{name:'FIRST',unlockTime:100}]}},running=[],mutateDuringImport=false;
  const adapter={listGames:async()=>[game,empty],running:async()=>running,achievementFiles:async()=>[],exportGame:async g=>g.objectId==='123'?structuredClone(metadata):{},importGame:async(g,data)=>{metadata=structuredClone(data);if(mutateDuringImport){mutateDuringImport=false;throw Error('Injected database write failure after mutation');}}};
  const engine=await new BackupEngine({adapter,stateDir:path.join(dir,'state'),destination:path.join(dir,'backup'),roots:{User:user},scan:async()=>({'123':{files:{[source]:{}}}})}).init();const first=(await engine.runBackup('steam:123')).results[0].folder;
  metadata={game:{...game,playTimeInMilliseconds:999},achievementData:{achievements:[],unlockedAchievements:[]}};const undo=structuredClone(metadata);await fsp.writeFile(source,'current-progress');mutateDuringImport=true;
  await assert.rejects(engine.restoreMany([first]),/Injected database/);assert.equal(await fsp.readFile(source,'utf8'),'current-progress');assert.deepEqual(metadata,undo);assert.equal(engine.busy,false);checks+=4;
  const journal=(await fsp.readdir(engine.stateDir)).find(x=>x.startsWith('recovery-'));assert.equal(JSON.parse(await fsp.readFile(path.join(engine.stateDir,journal),'utf8')).status,'rolled-back');checks++;
  const originalCopy=fsp.copyFile;fsp.copyFile=async(from,to,...args)=>{if(to.includes('.partial-')&&to.includes('saves'))throw Object.assign(Error('Disk full'),{code:'ENOSPC'});return originalCopy(from,to,...args);};
  try{await fsp.writeFile(source,'new-save');const failed=await engine.runBackup('steam:123');assert.equal(failed.errors.length,1);assert.match(failed.errors[0].message,/Disk full/);assert.equal(engine.busy,false);}finally{fsp.copyFile=originalCopy;}checks+=3;
  const directory=path.dirname(first);assert.equal((await fsp.readdir(directory)).some(x=>x.startsWith('.partial-')),false);await engine.readManifest(first,true);checks+=2;
  running=[{id:keyOf(game)}];const all=await engine.runBackup();assert.ok(all.skipped.some(s=>s.reason==='Game is running'));assert.equal(engine.busy,false);running=[];checks+=2;
  await assert.rejects(engine.restoreMany([]),/No recovery/);checks++;
  await assert.rejects(engine.addExtra(keyOf(game),user),/entire profile/);await assert.rejects(engine.addExtra(keyOf(game),engine.stateDir),/Protected/);assert.throws(()=>engine.target({root:'User',relative:'Game/save.dat:stream',original:source}),/Invalid backup path/);checks+=3;
  const damagedDir=await root('settings');await atomicJson(path.join(damagedDir,'settings.json'),{destination:'C:\\',extraPaths:[]});const before=await fsp.readFile(path.join(damagedDir,'settings.json'),'utf8');await assert.rejects(new BackupEngine({stateDir:damagedDir,adapter,destination:path.join(dir,'other')}).init(),/settings are damaged/);assert.equal(await fsp.readFile(path.join(damagedDir,'settings.json'),'utf8'),before);checks+=2;
}
async function chunkedUpload(){
  const dir=await root('chunks'),archive=path.join(dir,'payload.zip');let chunks=0;const ranges=[],events=[];
  const uploader=new DriveUploader({stateDir:dir,client:{},safeStorage:{},notify:e=>events.push(e.phase),transport:async(url,options,body)=>{
    const u=new URL(url);if(u.pathname==='/session'){chunks++;ranges.push(options.headers['Content-Range']);assert.equal(body.length,Number(options.headers['Content-Length']));if(chunks===1)return {status:308,headers:{range:'bytes=0-4194303'}};return {status:200,data:{id:'confirmed'}};}
    if(u.pathname.includes('/upload/'))return {status:200,headers:{location:'https://www.googleapis.com/session'}};
    return {status:200,data:{files:[]}};
  }});uploader.bearer=async()=> 'mock';uploader.folder=async()=> 'folder';uploader.zip=async()=>{await fsp.writeFile(archive,Buffer.alloc(10*1024*1024,1));return archive;};
  const result=await uploader.uploadSnapshots([{folder:dir,id:'chunks',key:'steam:1',game:{title:'Game'}}],()=>{});assert.equal(result.uploaded.length,1);assert.deepEqual(ranges,['bytes 0-8388607/10485760','bytes 4194304-10485759/10485760']);assert.equal(uploader.uploading,false);assert.equal(events.at(-1),'idle');checks+=4;
}
(async()=>{await localFailures();await chunkedUpload();console.log('PASS: '+checks+' failure assertions: restore rollback after database mutation, full disk/partial cleanup, live-game exclusion, unsafe paths, damaged settings preservation, and resumable multi-chunk upload acknowledgements.');})().catch(e=>{console.error(e);process.exitCode=1});
