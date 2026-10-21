'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),vm=require('node:vm');
const {BackupEngine,keyOf,child,digest}=require('../src/core.cjs');
const {createAchievementAdapter,mergeAchievements}=require('../src/achievements.cjs');
const {DriveUploader,driveError}=require('../src/drive.cjs');
let checks=0;function ok(test,message){assert.ok(test,message);checks++;}
async function fixture(name){return fsp.mkdtemp(path.join(__dirname,'audit-'+name+'-'));}
async function eligibility(){
  const root=await fixture('content'),user=path.join(root,'user'),save=path.join(user,'Remaining saves','slot.dat');await fsp.mkdir(path.dirname(save),{recursive:true});await fsp.writeFile(save,'saved-level');
  const games=[{title:'Library entry only',objectId:'1'},{title:'Catalogue only',objectId:'2'},{title:'Unlocked achievements only',objectId:'3'},{title:'Uninstalled with remaining saves',objectId:'4'}].map(g=>({...g,shop:'steam'}));
  const adapter={listGames:async()=>games,running:async()=>[],achievementFiles:async()=>[],exportGame:async g=>({game:g,achievementData:g.objectId==='2'?{achievements:[{name:'LOCKED'}],unlockedAchievements:[]}:g.objectId==='3'?{achievements:[{name:'WIN'}],unlockedAchievements:[{name:'WIN',unlockTime:123}]}:null}),importGame:async()=>{}};
  const engine=await new BackupEngine({adapter,stateDir:path.join(root,'state'),destination:path.join(root,'backups'),roots:{User:user},scan:async()=>({'4':{files:{[save]:{}}}})}).init();
  const first=await engine.runBackup();ok(first.results.length===2&&first.skipped.length===2,'Only actual saves/unlocks qualify');ok((await engine.snapshots()).length===2,'Only meaningful recovery points appear');ok(!fs.existsSync(path.join(engine.settings.destination,'Games','Library entry only [steam-1]')),'No empty game folder created');
  const again=await engine.runBackup();ok(again.results.every(g=>!g.changed),'Unchanged check creates no versions');
  await engine.createSnapshot(games[0],[],{game:games[0],achievementData:{achievements:[{name:'LOCKED'}],unlockedAchievements:[]}},'Manual',null,true);
  ok((await engine.snapshots()).length===2,'Legacy empty snapshots are hidden without deleting files');
  engine.options.scan=async()=>{throw Error('Scanner unavailable')};const fallback=await engine.runBackup();ok(fallback.errors.length===1&&fallback.results.some(r=>r.game.objectId==='3'),'Scanner failure still backs up achievements');ok(!engine.busy&&engine.operation===null,'Partial success resets busy state');
  ok(engine.staticRoots({shop:'epic',objectId:'123'}).length===0,'Steam numeric paths are not attributed to Epic');
  engine.options.scan=async()=>({'4':{files:{[save]:{}}}});await engine.saveSettings({keepVersions:2});for(let i=0;i<3;i++){await fsp.writeFile(save,'level-'+i);await engine.runBackup('steam:4');}ok((await engine.snapshots()).filter(s=>s.key==='steam:4').length===2,'Retention removes only older completed versions');
  const newest=(await engine.snapshots()).find(s=>s.key==='steam:4');const manifest=await engine.readManifest(newest.folder,true);const file=manifest.files.find(f=>f.location);file.location.relative='../escape';const text=JSON.stringify(manifest,null,2);await fsp.writeFile(child(newest.folder,'manifest.json'),text);await fsp.writeFile(child(newest.folder,'COMPLETE'),digest(text));await assert.rejects(engine.previewRestore(newest.folder),/Invalid backup path/);checks++;
}
function nativeHydra(){
  const main=fs.readFileSync(process.env.HYDRA_MAIN_SOURCE||path.join(__dirname,'..','installed-out-main-index.js'),'utf8');
  const memory=main.slice(main.indexOf('const entries$2 = new Map();'),main.indexOf('const withSteamAchievementCatalogue'));
  const parsers=main.slice(main.indexOf('const BYTE_ORDER_MARK ='),main.indexOf('const registerEvent ='));
  const cracker=main.slice(main.indexOf('var Cracker ='),main.indexOf('var Cracker =')+3000).split('}(Cracker || {});')[0];
  const types=['codex','rune','onlineFix','goldberg','userstats','rld','skidrow','_3dm','ali213','flt','creamAPI','empress','razor1911','Steam'];
  const context={readFileSync:fs.readFileSync,existsSync:fs.existsSync,readdirSync:fs.readdirSync,Cracker:Object.fromEntries(types.map(x=>[x,x])),achievementsLogger:{log(){},error(){},info(){}},console};
  vm.createContext(context);vm.runInContext(memory+parsers+';globalThis.native={memory:AchievementMemoryStore,parse:parseAchievementFile};',context);return {main,...context.native};
}
async function achievements(){
  const root=await fixture('achievements'),{memory,parse,main}=nativeHydra(),source=path.join(root,'achievements.json');
  await fsp.writeFile(source,JSON.stringify({FIRST:{earned:true,earned_time:1700000000},LOCKED:{earned:false,earned_time:0}}));
  const parsed=parse(source,'goldberg');ok(parsed.length===1&&parsed[0].name==='FIRST','Actual Hydra Goldberg parser reads earned progress');
  const codex=path.join(root,'achievements.ini');await fsp.writeFile(codex,'[SECOND]\nAchieved=1\nUnlockTime=1700000001\n[LOCKED]\nAchieved=0\nUnlockTime=0');ok(parse(codex,'codex').length===1,'Actual Hydra CODEX parser excludes locked achievements');
  const game={shop:'steam',objectId:'123',title:'Achievement test'},records=new Map([['steam:123',{...game,executablePath:'D:\\game.exe',remoteId:'preserve',playTimeInMilliseconds:900}]]);
  const games={iterator:()=>({all:async()=>[...records]}),get:async key=>{if(!records.has(key))throw Object.assign(Error('not found'),{code:'LEVEL_NOT_FOUND'});return records.get(key)},put:async(key,value)=>records.set(key,structuredClone(value))};
  const binding={games,memory,parse,collect:async()=>[{filePath:source,type:'goldberg'}],running:()=>[]};const dir=path.join(root,'state');await fsp.mkdir(dir);let instance=createAchievementAdapter({stateDir:dir,getBinding:()=>binding,invoke:()=>{},running:()=>[]});instance.bind(binding);
  const exported=await instance.adapter.exportGame(game);ok(exported.achievementData.unlockedAchievements.length===1,'Cold memory backup reads actual local achievement files');
  await instance.adapter.importGame(game,exported);memory.clear();ok(memory.get('steam','123').unlockedAchievements[0].name==='FIRST','Restored achievements survive Hydra cache clear');
  memory.set('steam','123',{achievements:[],unlockedAchievements:[]});ok(memory.get('steam','123').unlockedAchievements.length===1,'Empty remote synchronization cannot erase restored unlocks');ok(records.get('steam:123').executablePath==='D:\\game.exe'&&records.get('steam:123').remoteId==='preserve','Restore preserves installation/account-related game fields');
  const fresh=nativeHydra().memory;binding.memory=fresh;instance=createAchievementAdapter({stateDir:dir,getBinding:()=>binding,invoke:()=>{},running:()=>[]});instance.bind(binding);ok(fresh.get('steam','123').unlockedAchievements.length===1,'Restored progress reloads from disk after process restart');
  await instance.adapter.importGame(game,{game,achievementData:null});ok(!fresh.get('steam','123'),'Rollback removes imported unlocks rather than merging them back');
  const merged=mergeAchievements({achievements:[],unlockedAchievements:[{name:'first',unlockTime:10}]},{achievements:[],unlockedAchievements:[{name:'FIRST',unlockTime:20},{name:'LOCKED',unlockTime:0}]});ok(merged.unlockedAchievements.length===1&&merged.unlockedAchievements[0].unlockTime===10,'Merge deduplicates names and keeps original unlock time');
  const engine=await new BackupEngine({stateDir:path.join(root,'engine'),destination:path.join(root,'backup'),roots:{User:root},adapter:instance.adapter,scan:async()=>({})}).init();const result=await engine.runBackup();const snapshot=result.results[0].folder;await fsp.writeFile(source,'{}');await engine.restoreMany([snapshot]);ok(parse(source,'goldberg').some(a=>a.name==='FIRST'),'End-to-end snapshot/restore recovers actual achievement file Hydra can parse');
}
async function drive(){
  const root=await fixture('drive'),events=[],requests=[];let mode='success',remote=false;
  const transport=async(url,options={},body)=>{const u=new URL(url);requests.push({url:String(url),method:options.method,body});if(mode==='disabled')return {status:403,data:{error:{errors:[{reason:'accessNotConfigured'}],message:'API disabled'}}};if(mode==='abort')return new Promise((_r,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));if(u.pathname.includes('/upload/'))return {status:200,headers:{location:'https://www.googleapis.com/upload-session'},data:{}};if(u.pathname==='/upload-session'){if(mode==='network')throw Error('Connection dropped');remote=true;return {status:200,data:{id:'remote-backup'}};}if(u.searchParams.get('q')?.includes('mimeType'))return {status:200,data:{files:[{id:'folder'}]}};return {status:200,data:{files:remote?[{id:'remote-backup'}]:[]}};};
  const uploader=new DriveUploader({stateDir:root,client:{client_id:'1073769373145-public-client'},safeStorage:{isEncryptionAvailable:()=>true},openExternal:()=>{throw Error('Unexpected window')},notify:e=>events.push(e.phase),transport});uploader.bearer=async()=> 'mock-token';uploader.load=async()=>({refresh_token:'mock'});
  let zipped=0;uploader.zip=async s=>{zipped++;const output=path.join(root,s.id+'.zip');await fsp.writeFile(output,'zip payload');return output;};const snapshot={key:'steam:1',id:'snapshot-123',folder:root,game:{title:'Game'}};
  await assert.rejects(uploader.uploadSnapshots([],()=>{}),/No game saves/);checks++;
  mode='disabled';await assert.rejects(uploader.uploadSnapshots([snapshot],()=>{}),/API is disabled/);ok(!uploader.uploading&&events.at(-1)==='idle','Drive 403 resets busy indicator');ok((await uploader.status()).errorCode==='API_DISABLED','Drive error has a readable, actionable status');ok(uploader.helpURL().endsWith('project=1073769373145'),'Help points at the OAuth project');
  mode='success';const result=await uploader.uploadSnapshots([snapshot],()=>{});ok(result.uploaded.length===1&&remote,'Upload completes only after Google confirms a file ID');ok(!fs.existsSync(path.join(root,snapshot.id+'.zip')),'Temporary ZIP is removed after success');
  const again=await uploader.uploadSnapshots([snapshot],()=>{});ok(again.uploaded.length===0&&zipped===1,'Remote snapshot is deduplicated without recompressing');remote=false;const replaced=await uploader.uploadSnapshots([snapshot],()=>{});ok(replaced.uploaded.length===1,'Deleted remote file is uploaded again, even when a receipt exists');
  remote=false;mode='network';await assert.rejects(uploader.uploadSnapshots([snapshot],()=>{}),/Connection dropped/);ok(!uploader.uploading&&!fs.existsSync(path.join(root,snapshot.id+'.zip')),'Network failure cleans temporary files and releases operation lock');
  mode='abort';const pending=uploader.uploadSnapshots([snapshot],()=>{});await new Promise(r=>setTimeout(r,10));ok(uploader.cancel(),'Upload cancellation is accepted');await assert.rejects(pending,/cancelled/);ok(!uploader.uploading&&events.at(-1)==='idle','Cancelled upload returns to idle');
  ok(driveError({status:403,data:{error:{errors:[{reason:'storageQuotaExceeded'}]}}}).code==='STORAGE_FULL','Storage quota error is distinct from API configuration');
  ok(driveError({status:429,data:{}}).code==='RATE_LIMIT','Rate limiting produces a retryable message');
}
(async()=>{await eligibility();await achievements();await drive();console.log('PASS: '+checks+' audit assertions: real Hydra achievement parsers/cache/restart, content eligibility, retention, integrity, upload success/errors/cancel/dedup.');})().catch(e=>{console.error(e);process.exitCode=1});
