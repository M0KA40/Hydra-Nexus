'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const VERSION = require('./brand.cjs').version;
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
const clone = x => JSON.parse(JSON.stringify(x));
const exists = async p => {try {await fsp.access(p); return true;} catch(e) {if(e.code==='ENOENT')return false;throw e;}};
function inside(root,p) {const r=path.relative(path.resolve(root),path.resolve(p));return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
function child(root,relative) {
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'||p.includes(':')))throw Error('Invalid backup path');
  const p=path.resolve(root,relative);if(!inside(root,p))throw Error('Path escapes backup');return p;
}
async function plain(p) {
  p=path.resolve(p);let cursor=p;
  while(true){try{if((await fsp.lstat(cursor)).isSymbolicLink())throw Error('Linked folders are not supported: '+cursor);}catch(e){if(e.code!=='ENOENT')throw e;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}return p;
}
async function filesIn(p) {
  await plain(p);const st=await fsp.lstat(p);if(st.isFile())return [p];if(!st.isDirectory())throw Error('Unsupported save path: '+p);
  const files=[],queue=[p];while(queue.length){const dir=queue.pop();for(const entry of await fsp.readdir(dir,{withFileTypes:true})){const item=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('Linked save item: '+item);if(entry.name.startsWith('.hydra-backup-'))continue;if(entry.isDirectory())queue.push(item);else if(entry.isFile())files.push(item);}}return files.sort();
}
async function hashFile(p){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(p))h.update(chunk);return h.digest('hex');}
async function atomicJson(p,data){await fsp.mkdir(path.dirname(p),{recursive:true});const t=p+'.'+crypto.randomUUID()+'.tmp';try{await fsp.writeFile(t,JSON.stringify(data,null,2));await fsp.rename(t,p);}catch(e){await fsp.rm(t,{force:true}).catch(()=>{});throw e;}}
async function readText(p,max=32*1024*1024){const stat=await fsp.stat(p);if(stat.size>max)throw Error('Backup metadata exceeds its size limit');const data=await fsp.readFile(p);if(data.length>max)throw Error('Backup metadata exceeds its size limit');return data.toString('utf8');}
function slug(s){s=String(s||'Game').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,90);if(!s||/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s))s='Game '+s;return s;}
function keyOf(g){return String(g.shop||'steam')+':'+String(g.objectId);}
function gameFolder(g){return slug(g.title)+' ['+slug(g.shop||'steam')+'-'+slug(g.objectId)+']';}
function normalizeGame(g){if(!g||g.objectId==null)throw Error('Invalid game');return {...g,shop:String(g.shop||'steam'),objectId:String(g.objectId),title:String(g.title||g.objectId)};}
const stable = x => JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function unlockedCount(metadata){return (metadata?.achievementData?.unlockedAchievements||[]).filter(a=>a&&typeof a.name==='string'&&Number(a.unlockTime)>0).length;}
function validateGameMetadata(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid game');
  for(const name of ['playTimeInMilliseconds','achievementCount','unlockedAchievementCount']){
    const v=value[name];if(v===undefined)continue;
    if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>Number.MAX_SAFE_INTEGER||name!=='playTimeInMilliseconds'&&!Number.isInteger(v))throw Error('Invalid game');
  }
  const date=value.lastTimePlayed;
  if(date!==undefined&&date!==null&&(typeof date!=='string'&&typeof date!=='number'||date===''||!Number.isFinite(new Date(date).getTime())||new Date(date).getTime()<0))throw Error('Invalid game');
}
class BackupEngine {
  constructor(options){this.options=options;this.stateDir=path.resolve(options.stateDir);this.adapter=options.adapter;this.notify=options.notify||(()=>{});this.roots=options.roots||{};this.busy=false;this.operation=null;this.cancelRequested=false;this.controller=null;this.last={};this.snapshotCache=new Map();this.settings={destination:options.destination,autoBackup:false,autoUpload:false,discoverSaves:true,keepVersions:10,delaySeconds:10,extraPaths:{},excludedGames:{}};}
  async init(){
    await fsp.mkdir(this.stateDir,{recursive:true});
    try{
      const loaded=JSON.parse(await fsp.readFile(path.join(this.stateDir,'settings.json'),'utf8'));
      if(!loaded||Array.isArray(loaded)||typeof loaded!=='object')throw Error('Invalid settings');
      const next={...this.settings,...loaded};
      if(typeof next.destination!=='string'||!path.isAbsolute(next.destination)||path.parse(path.resolve(next.destination)).root===path.resolve(next.destination)||inside(this.stateDir,next.destination)||inside(next.destination,this.stateDir))throw Error('Invalid destination');
      if(!next.extraPaths||typeof next.extraPaths!=='object'||Array.isArray(next.extraPaths)||Object.values(next.extraPaths).some(paths=>!Array.isArray(paths)||paths.some(p=>typeof p!=='string'||!path.isAbsolute(p))))throw Error('Invalid extra paths');
      if(!next.excludedGames||Array.isArray(next.excludedGames)||typeof next.excludedGames!=='object'||Object.entries(next.excludedGames).some(([key,value])=>!/^[-\w]+:[-\w.]+$/.test(key)||typeof value!=='boolean'))throw Error('Invalid game backup preferences');
      for(const key of ['autoBackup','autoUpload','discoverSaves'])if(typeof next[key]!=='boolean')throw Error('Invalid option');
      if(!Number.isInteger(next.keepVersions)||next.keepVersions<1||next.keepVersions>100||!Number.isFinite(next.delaySeconds)||next.delaySeconds<5||next.delaySeconds>120)throw Error('Invalid history options');
      this.settings=next;
    }catch(e){if(e.code!=='ENOENT')throw Error('Backup settings are damaged; originals were left untouched.');}
    try{this.last=JSON.parse(await fsp.readFile(path.join(this.stateDir,'status.json'),'utf8'));}catch{}
    await this.maintainRecoveryFiles();return this;
  }
  async maintainRecoveryFiles(){this.maintenance={emptyPartialsRemoved:0,retainedPartials:[],archivedJournals:0};for(const name of await fsp.readdir(this.stateDir)){if(!/^recovery-[a-f0-9-]+\.json$/i.test(name))continue;const file=path.join(this.stateDir,name);try{await plain(file);const journal=JSON.parse(await readText(file));if(['complete','rolled-back'].includes(journal.status)){const history=path.join(this.stateDir,'recovery-history');await plain(history);await fsp.mkdir(history,{recursive:true});const dest=path.join(history,name);if(!await exists(dest)){await fsp.rename(file,dest);this.maintenance.archivedJournals++;}}}catch{}}const root=path.join(this.settings.destination,'Games');if(!await exists(root))return;await plain(root);for(const game of await fsp.readdir(root,{withFileTypes:true})){if(!game.isDirectory()||game.isSymbolicLink())continue;const folder=path.join(root,game.name,'Snapshots');if(!await exists(folder))continue;await plain(folder);for(const item of await fsp.readdir(folder,{withFileTypes:true})){if(!item.isDirectory()||item.isSymbolicLink()||!/^\.partial-[0-9TZ-]+-[a-f0-9]{8}$/i.test(item.name))continue;const p=path.join(folder,item.name),st=await fsp.stat(p);if(Date.now()-st.mtimeMs<86400000)continue;try{await fsp.rmdir(p);this.maintenance.emptyPartialsRemoved++;}catch(e){if(this.maintenance.retainedPartials.length<100)this.maintenance.retainedPartials.push(p);}}}}
  settingsChange(work){const task=(this.settingsQueue||Promise.resolve()).catch(()=>{}).then(work);this.settingsQueue=task;return task;}
  saveSettings(input){return this.settingsChange(()=>this.writeSettings(input));}
  setGameEnabled(key,enabled){return this.settingsChange(()=>this.writeGameEnabled(key,enabled));}
  addExtra(key,p){return this.settingsChange(()=>this.writeExtra(key,p));}
  removeExtra(key,p){return this.settingsChange(()=>this.deleteExtra(key,p));}
  async writeSettings(input){const next={...this.settings};for(const k of ['autoBackup','autoUpload','discoverSaves'])if(k in input)next[k]=!!input[k];if('destination' in input){if(this.busy)throw Error('Wait for the current operation before changing the destination');const p=await plain(input.destination);if(!path.isAbsolute(input.destination)||path.parse(p).root===p||inside(this.stateDir,p)||inside(p,this.stateDir))throw Error('Choose a separate backup folder');next.destination=p;}if('keepVersions' in input)next.keepVersions=Math.max(1,Math.min(100,Math.floor(Number(input.keepVersions))||10));if('delaySeconds'in input)next.delaySeconds=Math.max(5,Math.min(120,Number(input.delaySeconds)||10));await atomicJson(path.join(this.stateDir,'settings.json'),next);this.settings=next;if('destination' in input)this.invalidateSnapshots();return next;}
  async writeGameEnabled(key,enabled){
    if(this.busy)throw Error('Backup is busy');this.busy=true;
    try{if(typeof enabled!=='boolean'||!(await this.games()).some(g=>keyOf(g)===key))throw Error('Unknown game');const next={...this.settings,excludedGames:{...this.settings.excludedGames}};if(enabled)delete next.excludedGames[key];else next.excludedGames[key]=true;await atomicJson(path.join(this.stateDir,'settings.json'),next);this.settings=next;return next;}
    finally{this.busy=false;}
  }
  async extractCopy(folder,destination){
    if(this.busy)throw Error('Backup is busy');
    this.busy=true;this.operation={kind:'export',phase:'extractingCopy'};this.emit('extractingCopy');
    let owned=false,stage=null,target=null,id=null;
    try{
      const manifest=await this.readManifest(folder,true);target=await plain(destination);
      if(!path.isAbsolute(target)||target===path.parse(target).root||inside(folder,target)||inside(target,folder))throw Error('Choose a separate folder for the extracted backup.');
      id=crypto.randomUUID();stage=path.join(target,'.hydra-backup-'+id);const final=path.join(target,slug(manifest.game.title)+' - '+manifest.id+' - '+id.slice(0,8));
      await fsp.mkdir(stage);owned=true;
      for(const relative of ['manifest.json','COMPLETE',...manifest.files.map(f=>f.payload)]){const source=child(folder,relative),out=child(stage,relative);await plain(source);await fsp.mkdir(path.dirname(out),{recursive:true});await fsp.copyFile(source,out,fs.constants.COPYFILE_EXCL);}
      await this.readManifest(stage,true);await fsp.rename(stage,final);return {folder:final};
    }catch(error){if(owned&&inside(target,stage)&&path.basename(stage)==='.hydra-backup-'+id)try{await plain(stage);await fsp.rm(stage,{recursive:true,force:true});}catch{}throw error;}
    finally{this.busy=false;this.operation=null;this.emit('idle');}
  }
  async writeExtra(key,p){if(this.busy)throw Error('Backup is busy');await plain(p);this.assertTarget(p);if(!await exists(p))throw Error('Save path does not exist');this.settings.extraPaths[key]=Array.from(new Set([...(this.settings.extraPaths[key]||[]),path.resolve(p)]));await atomicJson(path.join(this.stateDir,'settings.json'),this.settings);}
  async deleteExtra(key,p){if(this.busy)throw Error('Backup is busy');this.settings.extraPaths[key]=(this.settings.extraPaths[key]||[]).filter(x=>x!==p);await atomicJson(path.join(this.stateDir,'settings.json'),this.settings);}
  assertTarget(p){p=path.resolve(p);if(p.slice(path.parse(p).root.length).includes(':'))throw Error('Alternate file streams are not supported');if(p===path.parse(p).root)throw Error('A whole drive is not a save path');for(const r of Object.values(this.roots))if(r&&path.resolve(r).toLowerCase()===p.toLowerCase())throw Error('Select a game folder, not an entire profile');for(const r of [this.stateDir,this.settings.destination,this.options.installDir,this.options.windowsDir,this.roots.Roaming&&path.join(this.roots.Roaming,'Hydra'),this.options.userDataDir].filter(Boolean))if(inside(r,p)||inside(p,r))throw Error('Protected location: '+p);if(/\.(exe|dll|bat|cmd|ps1|vbs|lnk|msi|scr|com|cjs|mjs|js|jse|vbe|wsf|wsh|hta|asar|node|pif|url|reg)$/i.test(p))throw Error('Executable files are not game saves');if(/[\\/](Start Menu|Startup)[\\/]/i.test(p))throw Error('Startup locations are not supported');}
  portable(p){p=path.resolve(p);for(const [root,base]of Object.entries(this.roots)){if(base&&inside(base,p)&&path.resolve(base)!==p)return {root,relative:path.relative(base,p),original:p};}return {root:'Absolute',relative:'',original:p};}
  target(location){if(!location||typeof location.original!=='string')throw Error('Missing restore path');const p=location.root==='Absolute'?path.resolve(location.original):child(this.roots[location.root]||(()=>{throw Error('Unknown path root')})(),location.relative);if(location.root==='Absolute'&&!path.isAbsolute(location.original))throw Error('Invalid absolute path');this.assertTarget(p);return p;}
  async games(){return (await this.adapter.listGames()).map(normalizeGame).filter(g=>!g.isDeleted);}
  emit(phase,extra={}){if(this.operation)this.operation={...this.operation,phase,...extra};this.notify({phase,...extra});}
  cancelBackup(){if(!this.busy||this.operation?.kind!=='backup')return false;this.cancelRequested=true;this.controller?.abort();this.emit('cancelling');return true;}
  checkCancelled(){if(this.cancelRequested)throw Error('Backup cancelled. Completed recovery points are safe.');}

  invalidateSnapshots(folder=null){if(folder)this.snapshotCache.delete(path.resolve(folder));else this.snapshotCache.clear();}
  async snapshots(gameKey=null){
    const root=path.join(this.settings.destination,'Games');const result=[],visited=new Set();if(!await exists(root)){this.invalidateSnapshots();return result;}await plain(root);
    for(const game of await fsp.readdir(root,{withFileTypes:true})){
      if(!game.isDirectory()||game.isSymbolicLink())continue;
      if(gameKey){const cut=gameKey.indexOf(':');if(!game.name.endsWith(' ['+slug(gameKey.slice(0,cut))+'-'+slug(gameKey.slice(cut+1))+']'))continue;}
      const snapshots=path.join(root,game.name,'Snapshots');if(!await exists(snapshots))continue;
      for(const item of await fsp.readdir(snapshots,{withFileTypes:true})){
        if(!item.isDirectory()||item.name.startsWith('.'))continue;
        const folder=path.join(snapshots,item.name);
        try{
          visited.add(folder);await plain(folder);const [manifestStat,metadataStat,completeStat]=await Promise.all([fsp.stat(child(folder,'manifest.json')),fsp.stat(child(folder,'achievements/hydra.json')),fsp.stat(child(folder,'COMPLETE'))]);
          const stamp=manifestStat.mtimeMs+':'+manifestStat.size+':'+metadataStat.mtimeMs+':'+metadataStat.size+':'+completeStat.mtimeMs+':'+completeStat.size+':'+manifestStat.ctimeMs+':'+metadataStat.ctimeMs+':'+completeStat.ctimeMs;
          const cached=this.snapshotCache.get(folder);
          if(cached&&cached.stamp===stamp){if(!gameKey||cached.snapshot.key===gameKey)result.push(cached.snapshot);continue;}
          const m=await this.readManifest(folder,false);if(gameKey&&m.key!==gameKey)continue;
          const sources=m.files.filter(f=>f.location);const metadata=JSON.parse(await readText(child(folder,'achievements/hydra.json')));const unlocked=unlockedCount(metadata);
          if(!sources.length&&!unlocked&&m.reason!=='BeforeRestore'){this.snapshotCache.delete(folder);continue;}
          const snapshot={folder,id:m.id,game:m.game,key:m.key,created:m.created,reason:m.reason,complete:m.complete!==false,bytes:m.totalBytes,files:m.files.length,saveFiles:sources.filter(f=>f.kind==='save').length,achievementFiles:sources.filter(f=>f.kind==='achievement-source').length,unlockedAchievements:unlocked};
          this.snapshotCache.set(folder,{stamp,snapshot});result.push(snapshot);
        }catch{this.snapshotCache.delete(folder);}
      }
    }
    for(const [folder,cached]of this.snapshotCache)if((!gameKey||cached.snapshot.key===gameKey)&&!visited.has(folder))this.snapshotCache.delete(folder);while(this.snapshotCache.size>2000)this.snapshotCache.delete(this.snapshotCache.keys().next().value);return result.sort((a,b)=>b.created.localeCompare(a.created));
  }
  async readManifest(folder,verify=true){await plain(folder);const text=await readText(child(folder,'manifest.json'));const complete=(await readText(child(folder,'COMPLETE'),128)).trim();if(digest(text)!==complete)throw Error('Incomplete or damaged backup manifest');const m=JSON.parse(text);if(m.format!=='HydraBackupGame'||m.version!==2||!Array.isArray(m.files)||m.files.length>250000||typeof m.id!=='string'||!/^[\w-]+$/.test(m.id))throw Error('Unsupported backup format');normalizeGame(m.game);if(m.key!==keyOf(m.game))throw Error('Backup game identity mismatch');const seen=new Set();for(const file of m.files){const p=child(folder,file.payload);if(seen.has(p.toLowerCase()))throw Error('Duplicate payload');seen.add(p.toLowerCase());if(!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.size)||file.size<0)throw Error('Invalid backup file metadata');if(file.location)this.target(file.location);if(verify){await plain(p);const st=await fsp.stat(p);if(!st.isFile()||st.size!==file.size||await hashFile(p)!==file.sha256)throw Error('Backup integrity check failed: '+file.payload);}}if(!m.files.some(f=>f.payload==='achievements/hydra.json')||!m.files.some(f=>f.payload==='game.json'))throw Error('Backup is missing game metadata');return m;}
  staticRoots(g){const id=String(g.objectId);if(g.shop!=='steam'||!/^\d+$/.test(id))return [];const r=this.roots,defs=[['Roaming','Goldberg SteamEmu Saves'],['Roaming','GSE Saves'],['Roaming','Steam/CODEX'],['PublicDocuments','Steam/CODEX'],['PublicDocuments','Steam/RUNE'],['PublicDocuments','OnlineFix'],['Roaming','EMPRESS/remote'],['PublicDocuments','EMPRESS'],['Roaming','CreamAPI'],['Roaming','SmartSteamEmu'],['Roaming','RLE'],['Roaming','.1911'],['ProgramData','RLD!'],['ProgramData','Steam/Player'],['ProgramData','Steam/RLD!'],['ProgramData','Steam/dodi'],['Documents','SKIDROW'],['Documents','Player'],['Local','SKIDROW']];return defs.filter(([root])=>r[root]).map(([root,p])=>path.join(r[root],p,id));}
  async collect(g,scan){const selected=new Map();const add=async(p,kind)=>{if(!await exists(p))return;this.assertTarget(p);for(const file of await filesIn(p)){this.assertTarget(file);selected.set(path.resolve(file).toLowerCase(),{source:file,kind:/achiev|userstats/i.test(path.basename(file))?'achievement-source':kind});}};
    for(const p of this.staticRoots(g))await add(p,'save');for(const p of this.settings.extraPaths[keyOf(g)]||[]){if(!await exists(p))throw Error('Configured save folder is missing: '+p);await add(p,'save');}
    for(const item of await this.adapter.achievementFiles(g)){const p=typeof item==='string'?item:item.filePath;if(p)await add(p,'achievement-source');}
    const matched=scan?.[g.objectId]||scan?.[g.title]||scan?.[keyOf(g)];if(matched){for(const [p,info]of Object.entries(matched.files||{})){if(info.failed)throw Error('Save discovery failed: '+p);if(!info.ignored&&info.change!=='Removed')await add(p,'save');}}
    return Array.from(selected.values());}
  async createSnapshot(g,sourceFiles,metadata,reason,previous,force=false,complete=true){const game=normalizeGame(g);const folderBase=path.join(this.settings.destination,'Games',gameFolder(game),'Snapshots');await plain(folderBase);await fsp.mkdir(folderBase,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const id=stamp+'-'+crypto.randomUUID().slice(0,8);const stage=path.join(folderBase,'.partial-'+id),destination=path.join(folderBase,id);const files=[];let totalBytes=0;let copied=0,reused=0;
    // An unchanged check hashes inputs without copying any file or creating a version.
    if(previous&&!force&&(previous.manifest.complete!==false)===complete){
      const record={title:game.title,shop:game.shop,objectId:game.objectId,platform:game.platform,playTimeInMilliseconds:game.playTimeInMilliseconds,lastTimePlayed:game.lastTimePlayed,achievementCount:game.achievementCount,unlockedAchievementCount:game.unlockedAchievementCount};
      const candidates=[{payload:'game.json',sha256:digest(Buffer.from(JSON.stringify(record,null,2)))},{payload:'achievements/hydra.json',sha256:digest(Buffer.from(stable(metadata||{})))}];
      for(const file of sourceFiles){this.checkCancelled();const location=this.portable(file.source);const relative=location.root==='Absolute'?path.join('Absolute',slug(path.parse(file.source).root),file.source.slice(path.parse(file.source).root.length)):path.join(location.root,location.relative);candidates.push({payload:path.join(file.kind==='achievement-source'?'achievements/sources':'saves',relative).split(path.sep).join('/'),sha256:await hashFile(file.source),location});}
      candidates.sort((a,b)=>a.payload.localeCompare(b.payload));
      if(digest(stable(candidates))===previous.manifest.stateHash)return {changed:false,folder:previous.folder,game,files:previous.manifest.files.length,bytes:previous.manifest.totalBytes};
    }
    await fsp.mkdir(stage);
    const put=async(payload,buffer,source,location,kind)=>{const output=child(stage,payload);await fsp.mkdir(path.dirname(output),{recursive:true});const before=source?await hashFile(source):digest(buffer);const size=source?(await fsp.stat(source)).size:buffer.length;const prior=previous?.manifest.files.find(f=>f.payload===payload&&f.sha256===before&&f.size===size);let linked=false;
      if(prior){const old=child(previous.folder,payload);if(await hashFile(old)===before){try{await fsp.link(old,output);linked=true;reused++;}catch(e){if(!['EXDEV','EPERM','EACCES','ENOTSUP','ENOSYS','EMLINK'].includes(e.code))throw e;}}}
      if(!linked){if(source)await fsp.copyFile(source,output,fs.constants.COPYFILE_EXCL);else await fsp.writeFile(output,buffer,{flag:'wx'});copied++;}
      if(await hashFile(output)!==before||(source&&await hashFile(source)!==before))throw Error('A save changed while it was being copied. Close the game and retry.');files.push({payload,kind,size,sha256:before,...(location?{location}:{} )});totalBytes+=size;};
    try{const safeRecord={title:game.title,shop:game.shop,objectId:game.objectId,platform:game.platform,playTimeInMilliseconds:game.playTimeInMilliseconds,lastTimePlayed:game.lastTimePlayed,achievementCount:game.achievementCount,unlockedAchievementCount:game.unlockedAchievementCount};await put('game.json',Buffer.from(JSON.stringify(safeRecord,null,2)),null,null,'metadata');await put('achievements/hydra.json',Buffer.from(stable(metadata||{})),null,null,'hydra-achievements');
      for(const file of sourceFiles){this.checkCancelled();const loc=this.portable(file.source);const relative=loc.root==='Absolute'?path.join('Absolute',slug(path.parse(file.source).root),file.source.slice(path.parse(file.source).root.length)):path.join(loc.root,loc.relative);const payload=path.join(file.kind==='achievement-source'?'achievements/sources':'saves',relative).split(path.sep).join('/');await put(payload,null,file.source,loc,file.kind);}
      files.sort((a,b)=>a.payload.localeCompare(b.payload));const stateHash=digest(stable(files.map(f=>({payload:f.payload,sha256:f.sha256,location:f.location}))));if(!force&&previous?.manifest.stateHash===stateHash&&(previous.manifest.complete!==false)===complete){await fsp.rm(stage,{recursive:true,force:true});return {changed:false,folder:previous.folder,game,files:files.length,bytes:totalBytes};}
      if(reason!=='BeforeRestore'&&(await this.adapter.running()).some(item=>(typeof item==='string'?item:item.id||keyOf(item))===keyOf(game)))throw Error('The game started during backup. Retry after closing it.');
      this.checkCancelled();const manifest={format:'HydraBackupGame',version:2,engineVersion:VERSION,id,key:keyOf(game),game:{title:game.title,shop:game.shop,objectId:game.objectId},created:new Date().toISOString(),reason,complete,stateHash,totalBytes,files};const text=JSON.stringify(manifest,null,2);await fsp.writeFile(child(stage,'manifest.json'),text);await fsp.writeFile(child(stage,'COMPLETE'),digest(text));await fsp.rename(stage,destination);this.invalidateSnapshots();return {changed:true,folder:destination,game,files:files.length,bytes:totalBytes,copied,reused};
    }catch(e){await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});throw e;}}
  async runBackup(key=null,reason='Manual'){
    if(this.busy)throw Error('A backup or restore is already running');
    this.busy=true;this.cancelRequested=false;this.controller=new AbortController();
    this.operation={kind:'backup',started:Date.now(),phase:'scanning'};this.emit('scanning');
    const results=[],errors=[],skipped=[],gameStatus={};
    try{
      const all=await this.games();if(key&&this.settings.excludedGames[key])throw Error('Backup is disabled for this game. Enable it in the game backup profile.');const games=(key?all.filter(g=>keyOf(g)===key):all).filter(g=>!this.settings.excludedGames[keyOf(g)]);
      if(!games.length)throw Error('No matching games were found in the Hydra library');
      const runningKeys=new Set((await this.adapter.running()).map(x=>typeof x==='string'?x:x.id||keyOf(x)));
      const active=games.filter(g=>runningKeys.has(keyOf(g)));
      if(active.length&&key)throw Error('Close '+active[0].title+' before backing it up');
      const eligible=games.filter(g=>!runningKeys.has(keyOf(g)));
      if(!eligible.length)throw Error('All selected games are currently running');
      await plain(this.settings.destination);await fsp.mkdir(this.settings.destination,{recursive:true});
      let scanned={},scanComplete=true;
      try{scanned=await this.options.scan(eligible,{signal:this.controller.signal});}
      catch(e){this.checkCancelled();scanComplete=false;errors.push({game:'Save detection',message:e.message+' Known save locations and achievements were still checked.'});}
      this.checkCancelled();const previous=await this.snapshots();
      for(let i=0;i<eligible.length;i++){
        this.checkCancelled();const g=eligible[i],gameKey=keyOf(g);this.emit('copying',{game:g.title,index:i+1,total:eligible.length});
        try{
          const prev=previous.find(x=>x.key===gameKey&&x.reason!=='BeforeRestore'&&x.complete!==false);
          let prior=null;if(prev)try{prior={folder:prev.folder,manifest:await this.readManifest(prev.folder,true)};}catch(e){errors.push({game:g.title,message:'Previous recovery point is damaged. A new backup will be created.'});}
          const sources=await this.collect(g,scanned);let metadata=await this.adapter.exportGame(g);
          // A catalogue, playtime, and a library entry are not backup content.
          const hasCurrentContent=sources.length>0||unlockedCount(metadata)>0;
          if(!hasCurrentContent){skipped.push({key:gameKey,game:g.title,reason:'No save files or unlocked achievements found'});gameStatus[gameKey]={status:'empty',saveFiles:0,unlockedAchievements:0};continue;}
          if(!metadata?.achievementData?.unlockedAchievements?.length&&prior){
            const file=prior.manifest.files.find(f=>f.payload==='achievements/hydra.json');
            const source=child(prior.folder,'achievements/hydra.json');
            if(await hashFile(source)!==file.sha256)throw Error('Previous achievement backup is damaged');
            const saved=JSON.parse(await fsp.readFile(source,'utf8')).achievementData;
            if(saved)metadata={...metadata,achievementData:saved};
          }
          const result=await this.createSnapshot(g,sources,metadata,reason,prior,false,scanComplete);result.complete=scanComplete;results.push(result);
          gameStatus[gameKey]={status:result.changed?'saved':'unchanged',saveFiles:sources.filter(f=>f.kind==='save').length,achievementFiles:sources.filter(f=>f.kind==='achievement-source').length,unlockedAchievements:unlockedCount(metadata)};
          if(result.changed)await this.prune(g,{partial:!scanComplete});
        }catch(e){this.checkCancelled();errors.push({game:g.title,message:e.message});gameStatus[gameKey]={status:'error',message:e.message};}
      }
      for(const g of active){skipped.push({key:keyOf(g),game:g.title,reason:'Game is running'});gameStatus[keyOf(g)]={status:'running'};}
      this.last={when:new Date().toISOString(),changed:results.filter(x=>x.changed).length,checked:eligible.length,skipped:skipped.length,games:gameStatus,errors};
      await atomicJson(path.join(this.stateDir,'status.json'),this.last);this.emit(errors.length?'partial':'complete',{...this.last});return {results,errors,skipped};
    }catch(e){const message=this.cancelRequested?'Backup cancelled. Completed recovery points are safe.':e.message;this.last={...this.last,error:message};this.emit(this.cancelRequested?'cancelled':'error',{message});throw Error(message);}
    finally{this.busy=false;this.operation=null;this.controller=null;this.emit('idle');}
  }
  async prune(g,{partial=false}={}){const list=(await this.snapshots(keyOf(g))).filter(s=>s.key===keyOf(g)&&s.reason!=='BeforeRestore'&&(partial?s.complete===false:s.complete!==false));for(const snapshot of list.slice(this.settings.keepVersions)){const root=path.join(this.settings.destination,'Games');if(!inside(root,snapshot.folder)||path.basename(path.dirname(snapshot.folder))!=='Snapshots')throw Error('Unsafe retention path');const m=await this.readManifest(snapshot.folder,false);if(m.key!==keyOf(g))throw Error('Retention identity mismatch');await plain(snapshot.folder);await fsp.rm(snapshot.folder,{recursive:true,force:true});this.invalidateSnapshots(snapshot.folder);}}
  async validateExternalTargets(manifest){const g=(await this.games()).find(g=>keyOf(g)===manifest.key);if(!g)throw Error('Add this game to your library before importing its backup');let scanned={};try{scanned=await this.options.scan([g],{});}catch{}const matched=scanned?.[g.objectId]||scanned?.[g.title]||scanned?.[keyOf(g)];const exact=new Set(Object.entries(matched?.files||{}).filter(([,v])=>!v.ignored&&!v.failed).map(([p])=>path.resolve(p).toLowerCase()));for(const f of await this.adapter.achievementFiles(g)){const p=typeof f==='string'?f:f.filePath;if(p)exact.add(path.resolve(p).toLowerCase());}const roots=[...this.staticRoots(g),...(this.settings.extraPaths[keyOf(g)]||[])];for(const f of manifest.files.filter(f=>f.location)){const p=this.target(f.location);if(!exact.has(p.toLowerCase())&&!roots.some(r=>inside(r,p)))throw Error('Unrecognized restore location: '+p+'. Add this gameâ€™s save folder in Backup > Games before importing. No files were restored.');}}
  async previewRestore(folder,{external=false}={}){const manifest=await this.readManifest(folder,true);if(external)await this.validateExternalTargets(manifest);const recordText=await readText(child(folder,'game.json'),1024*1024),metadataText=await readText(child(folder,'achievements/hydra.json'));if(digest(recordText)!==manifest.files.find(f=>f.payload==='game.json').sha256||digest(metadataText)!==manifest.files.find(f=>f.payload==='achievements/hydra.json').sha256)throw Error('Backup metadata changed during preview');const record=JSON.parse(recordText),metadata=JSON.parse(metadataText);validateGameMetadata(record);if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))throw Error('Invalid game');if(metadata.game)validateGameMetadata(metadata.game);if(keyOf(record)!==manifest.key||(metadata.game&&keyOf(metadata.game)!==manifest.key))throw Error('Backup metadata game identity mismatch');if(metadata.achievementData){const d=metadata.achievementData;if(!Array.isArray(d.achievements)||!Array.isArray(d.unlockedAchievements)||d.achievements.some(a=>!a||typeof a.name!=='string')||d.unlockedAchievements.some(a=>!a||typeof a.name!=='string'||!Number.isFinite(Number(a.unlockTime))))throw Error('Invalid achievement metadata');}return {manifest,record,metadata,paths:manifest.files.filter(f=>f.location).map(f=>({payload:f.payload,target:this.target(f.location),file:f}))};}
  async restoreMany(folders,{external=false}={}){if(!Array.isArray(folders)||!folders.length)throw Error('No recovery points selected');if(this.busy)throw Error('A backup or restore is already running');this.busy=true;this.cancelRequested=false;this.operation={kind:'restore',started:Date.now(),phase:'restoring'};const operations=[],metadataUndo=[],safetySnapshots=[];const transaction=crypto.randomUUID();const recovery=path.join(this.stateDir,'recovery-'+transaction+'.json');try{if((await this.adapter.running()).length)throw Error('Close all games before restoring');const previews=[];for(const folder of folders)previews.push({folder,...await this.previewRestore(folder,{external:external||!inside(this.settings.destination,folder)})});const seen=new Map();for(const p of previews)for(const item of p.paths){const key=item.target.toLowerCase();if(seen.has(key)&&seen.get(key)!==item.file.sha256)throw Error('Selected games contain conflicting shared save files. Restore them separately.');seen.set(key,item.file.sha256);}this.emit('restoring');
      const library=await this.games();for(const p of previews){const record=p.record;const current=library.find(g=>keyOf(g)===p.manifest.key)||record;const currentMetadata=await this.adapter.exportGame(current);metadataUndo.push({game:current,metadata:currentMetadata});const existing=[];for(const item of p.paths){if(await exists(item.target))existing.push({source:item.target,kind:item.file.kind});}const safety=await this.createSnapshot(current,existing,currentMetadata,'BeforeRestore',null,true);safetySnapshots.push(safety.folder);}
      const staged=new Set();for(const p of previews)for(const item of p.paths){const target=item.target,file=item.file,stagedKey=target.toLowerCase();if(staged.has(stagedKey))continue;staged.add(stagedKey);await plain(target);const source=child(p.folder,file.payload);await fsp.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(path.dirname(target),'.hydra-backup-'+transaction+'-'+operations.length);const previous=temporary+'.previous';const had=await exists(target);const originalHash=had?await hashFile(target):null;const op={target,temporary,previous,had,originalHash,replacementHash:file.sha256,moved:false,installed:false};operations.push(op);await fsp.copyFile(source,temporary,fs.constants.COPYFILE_EXCL);if(await hashFile(temporary)!==file.sha256)throw Error('Restore staging integrity check failed');}
      await atomicJson(recovery,{transaction,status:'prepared',operations,metadataUndo,safetySnapshots});if((await this.adapter.running()).length)throw Error('A game started during restore; nothing was replaced');
      for(const op of operations){await plain(op.target);if(op.had&&(await hashFile(op.target)!==op.originalHash))throw Error('A save changed during restore; retry with the game closed');if(!op.had&&await exists(op.target))throw Error('A save appeared during restore; retry');if(op.had){await fsp.rename(op.target,op.previous);op.moved=true;}await fsp.rename(op.temporary,op.target);op.installed=true;await atomicJson(recovery,{transaction,status:'replacing',operations,metadataUndo,safetySnapshots});}
      for(const [index,p]of previews.entries()){metadataUndo[index].started=true;await atomicJson(recovery,{transaction,status:'restoring-metadata',operations,metadataUndo,safetySnapshots});await this.adapter.importGame(p.manifest.game,p.metadata);}
      await atomicJson(recovery,{transaction,status:'complete',operations,metadataUndo,safetySnapshots});const cleanupWarnings=[];for(const op of operations)for(const p of [op.previous,op.temporary])await fsp.rm(p,{force:true}).catch(e=>cleanupWarnings.push(e.message));this.emit('restored',{games:previews.length,cleanupWarnings});return {games:previews.length,recovery,restartRecommended:true,cleanupWarnings};
    }catch(e){const failures=[];for(const op of [...operations].reverse()){try{if(op.installed)await fsp.rename(op.target,op.temporary);if(op.moved)await fsp.rename(op.previous,op.target);}catch(err){failures.push(err.message);}}for(const undo of [...metadataUndo].reverse().filter(item=>item.started)){try{await this.adapter.importGame(undo.game,undo.metadata,{restoreExact:true});}catch(err){failures.push(err.message);}}await atomicJson(recovery,{transaction,status:failures.length?'needs-recovery':'rolled-back',operations,metadataUndo,safetySnapshots,failures}).catch(()=>{});if(!failures.length)for(const op of operations)for(const p of [op.temporary,op.previous])await fsp.rm(p,{force:true}).catch(()=>{});throw Error(e.message+(failures.length?' Manual recovery is required: '+recovery:''));}finally{this.busy=false;this.operation=null;this.emit('idle');}}
}
function exec(exe,args,options={}){
  return new Promise((resolve,reject)=>execFile(exe,args,{windowsHide:true,maxBuffer:64*1024*1024,timeout:300000,...options},(error,stdout,stderr)=>{
    if(error){if(error.name==='AbortError')reject(Error('Backup cancelled'));else if(error.killed)reject(Error('Save detection timed out. You can retry or disable automatic save detection and add save folders manually.'));else reject(Error('Save discovery failed: '+String(stderr||error.message).slice(0,700)));}
    else resolve(stdout);
  }));
}
function manifestGameNames(text){
  const names=new Set();for(const match of text.matchAll(/^([^\s#][^\r\n]*?):[ \t]*(?:\r?\n|$)/gm)){
    let name=match[1].trim();if((name[0]==='"'&&name.endsWith('"'))||(name[0]==="'"&&name.endsWith("'")))name=name.slice(1,-1);names.add(name);
  }return names;
}
async function scanLudusavi({toolFolder,stateDir,gameIds=[],gameTitles=[],signal,timeoutMs=120000,parseConfig}){
  if(!gameIds.length&&!gameTitles.length)return {};
  const exe=path.join(toolFolder,'ludusavi.exe');
  if(!await exists(exe))throw Error('Ludusavi was not found. Disable automatic save detection and add save folders manually.');
  const config=path.join(stateDir,'ludusavi-scan');await fsp.mkdir(config,{recursive:true});const available=new Set();
  for(const item of await fsp.readdir(toolFolder)){
    if(!item.endsWith('.yaml'))continue;
    const source=path.join(toolFolder,item);await fsp.copyFile(source,path.join(config,item));
    if(item.startsWith('manifest'))for(const name of manifestGameNames(await fsp.readFile(source,'utf8')))available.add(name);
  }
  const configPath=path.join(config,'config.yaml');if(!await exists(configPath))throw Error('Ludusavi configuration is missing');
  if(parseConfig){const settings=parseConfig(await fsp.readFile(configPath,'utf8'));settings.runtime={...settings.runtime,threads:2};settings.release={check:false};settings.cloud={...settings.cloud,synchronize:false};settings.customGames=(settings.customGames||[]).filter(g=>gameIds.includes(String(g.name))||gameTitles.includes(g.name));for(const g of settings.customGames)available.add(String(g.name));await fsp.writeFile(configPath,JSON.stringify(settings,null,2));}
  const names=Array.from(new Set([...gameIds,...gameTitles].filter(name=>available.has(name))));
  // Never scan the entire manifest: it can contain broad paths unrelated to the library.
  if(!names.length)return {};
  const raw=await exec(exe,['--config',config,'--no-manifest-update','backup','--force','--preview','--api','--no-cloud-sync','--path',path.join(config,'unused'),...names],{signal,timeout:timeoutMs});
  const data=JSON.parse(raw);if(data.errors&&Object.values(data.errors).some(Boolean))throw Error('Ludusavi could not scan all selected saves');return data.games||{};
}
module.exports={BackupEngine,scanLudusavi,exec,filesIn,hashFile,atomicJson,plain,exists,child,inside,slug,keyOf,digest,VERSION,manifestGameNames,unlockedCount,validateGameMetadata};
