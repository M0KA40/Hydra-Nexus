'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const VERSION = '2.1.0';
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
async function atomicJson(p,data){await fsp.mkdir(path.dirname(p),{recursive:true});const t=p+'.'+crypto.randomUUID()+'.tmp';await fsp.writeFile(t,JSON.stringify(data,null,2));await fsp.rename(t,p);}
function slug(s){s=String(s||'Game').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,90);if(!s||/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s))s='Game '+s;return s;}
function keyOf(g){return String(g.shop||'steam')+':'+String(g.objectId);}
function gameFolder(g){return slug(g.title)+' ['+slug(g.shop||'steam')+'-'+slug(g.objectId)+']';}
function normalizeGame(g){if(!g||g.objectId==null)throw Error('Invalid game');return {...g,shop:String(g.shop||'steam'),objectId:String(g.objectId),title:String(g.title||g.objectId)};}
const stable = x => JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function unlockedCount(metadata){return (metadata?.achievementData?.unlockedAchievements||[]).filter(a=>a&&typeof a.name==='string'&&Number(a.unlockTime)>0).length;}
class BackupEngine {
  constructor(options){this.options=options;this.stateDir=path.resolve(options.stateDir);this.adapter=options.adapter;this.notify=options.notify||(()=>{});this.roots=options.roots||{};this.busy=false;this.operation=null;this.cancelRequested=false;this.controller=null;this.last={};this.settings={destination:options.destination,autoBackup:false,autoUpload:false,discoverSaves:true,keepVersions:10,delaySeconds:10,extraPaths:{}};}
  async init(){
    await fsp.mkdir(this.stateDir,{recursive:true});
    try{
      const loaded=JSON.parse(await fsp.readFile(path.join(this.stateDir,'settings.json'),'utf8'));
      if(!loaded||Array.isArray(loaded)||typeof loaded!=='object')throw Error('Invalid settings');
      const next={...this.settings,...loaded};
      if(typeof next.destination!=='string'||!path.isAbsolute(next.destination)||path.parse(path.resolve(next.destination)).root===path.resolve(next.destination)||inside(this.stateDir,next.destination)||inside(next.destination,this.stateDir))throw Error('Invalid destination');
      if(!next.extraPaths||typeof next.extraPaths!=='object'||Array.isArray(next.extraPaths)||Object.values(next.extraPaths).some(paths=>!Array.isArray(paths)||paths.some(p=>typeof p!=='string'||!path.isAbsolute(p))))throw Error('Invalid extra paths');
      for(const key of ['autoBackup','autoUpload','discoverSaves'])if(typeof next[key]!=='boolean')throw Error('Invalid option');
      if(!Number.isInteger(next.keepVersions)||next.keepVersions<1||next.keepVersions>100||!Number.isFinite(next.delaySeconds)||next.delaySeconds<5||next.delaySeconds>120)throw Error('Invalid history options');
      this.settings=next;
    }catch(e){if(e.code!=='ENOENT')throw Error('Backup settings are damaged; originals were left untouched.');}
    try{this.last=JSON.parse(await fsp.readFile(path.join(this.stateDir,'status.json'),'utf8'));}catch{}
    return this;
  }
  async saveSettings(input){const next={...this.settings};for(const k of ['autoBackup','autoUpload','discoverSaves'])if(k in input)next[k]=!!input[k];if('destination' in input){if(this.busy)throw Error('Wait for the current operation before changing the destination');const p=await plain(input.destination);if(!path.isAbsolute(input.destination)||path.parse(p).root===p||inside(this.stateDir,p)||inside(p,this.stateDir))throw Error('Choose a separate backup folder');next.destination=p;}if('keepVersions' in input)next.keepVersions=Math.max(1,Math.min(100,Math.floor(Number(input.keepVersions))||10));if('delaySeconds'in input)next.delaySeconds=Math.max(5,Math.min(120,Number(input.delaySeconds)||10));await atomicJson(path.join(this.stateDir,'settings.json'),next);this.settings=next;return next;}
  async addExtra(key,p){if(this.busy)throw Error('Backup is busy');await plain(p);this.assertTarget(p);if(!await exists(p))throw Error('Save path does not exist');this.settings.extraPaths[key]=Array.from(new Set([...(this.settings.extraPaths[key]||[]),path.resolve(p)]));await atomicJson(path.join(this.stateDir,'settings.json'),this.settings);}
  async removeExtra(key,p){if(this.busy)throw Error('Backup is busy');this.settings.extraPaths[key]=(this.settings.extraPaths[key]||[]).filter(x=>x!==p);await atomicJson(path.join(this.stateDir,'settings.json'),this.settings);}
  assertTarget(p){p=path.resolve(p);if(p.slice(path.parse(p).root.length).includes(':'))throw Error('Alternate file streams are not supported');if(p===path.parse(p).root)throw Error('A whole drive is not a save path');for(const r of Object.values(this.roots))if(r&&path.resolve(r).toLowerCase()===p.toLowerCase())throw Error('Select a game folder, not an entire profile');for(const r of [this.stateDir,this.settings.destination,this.options.installDir,this.options.windowsDir].filter(Boolean))if(inside(r,p)||inside(p,r))throw Error('Protected location: '+p);if(/\.(exe|dll|bat|cmd|ps1|vbs|lnk|msi|scr)$/i.test(p))throw Error('Executable files are not game saves');if(/[\\/](Start Menu|Startup)[\\/]/i.test(p))throw Error('Startup locations are not supported');}
  portable(p){p=path.resolve(p);for(const [root,base]of Object.entries(this.roots)){if(base&&inside(base,p)&&path.resolve(base)!==p)return {root,relative:path.relative(base,p),original:p};}return {root:'Absolute',relative:'',original:p};}
  target(location){if(!location||typeof location.original!=='string')throw Error('Missing restore path');const p=location.root==='Absolute'?path.resolve(location.original):child(this.roots[location.root]||(()=>{throw Error('Unknown path root')})(),location.relative);if(location.root==='Absolute'&&!path.isAbsolute(location.original))throw Error('Invalid absolute path');this.assertTarget(p);return p;}
  async games(){return (await this.adapter.listGames()).map(normalizeGame).filter(g=>!g.isDeleted);}
  emit(phase,extra={}){if(this.operation)this.operation={...this.operation,phase,...extra};this.notify({phase,...extra});}
  cancelBackup(){if(!this.busy||this.operation?.kind!=='backup')return false;this.cancelRequested=true;this.controller?.abort();this.emit('cancelling');return true;}
  checkCancelled(){if(this.cancelRequested)throw Error('Backup cancelled. Completed recovery points are safe.');}

  async snapshots(){const root=path.join(this.settings.destination,'Games');const result=[];if(!await exists(root))return result;await plain(root);for(const game of await fsp.readdir(root,{withFileTypes:true})){if(!game.isDirectory()||game.isSymbolicLink())continue;const snapshots=path.join(root,game.name,'Snapshots');if(!await exists(snapshots))continue;for(const item of await fsp.readdir(snapshots,{withFileTypes:true})){if(!item.isDirectory()||item.name.startsWith('.'))continue;const folder=path.join(snapshots,item.name);try{const m=await this.readManifest(folder,false);const sources=m.files.filter(f=>f.location);const metadata=JSON.parse(await fsp.readFile(child(folder,'achievements/hydra.json'),'utf8'));const unlocked=unlockedCount(metadata);if(!sources.length&&!unlocked&&m.reason!=='BeforeRestore')continue;result.push({folder,id:m.id,game:m.game,key:m.key,created:m.created,reason:m.reason,bytes:m.totalBytes,files:m.files.length,saveFiles:sources.filter(f=>f.kind==='save').length,achievementFiles:sources.filter(f=>f.kind==='achievement-source').length,unlockedAchievements:unlocked});}catch{}}}return result.sort((a,b)=>b.created.localeCompare(a.created));}
  async readManifest(folder,verify=true){await plain(folder);const text=await fsp.readFile(child(folder,'manifest.json'),'utf8');const complete=(await fsp.readFile(child(folder,'COMPLETE'),'utf8')).trim();if(digest(text)!==complete)throw Error('Incomplete or damaged backup manifest');const m=JSON.parse(text);if(m.format!=='HydraBackupGame'||m.version!==2||!Array.isArray(m.files)||m.files.length>250000||typeof m.id!=='string'||!/^[\w-]+$/.test(m.id))throw Error('Unsupported backup format');normalizeGame(m.game);if(m.key!==keyOf(m.game))throw Error('Backup game identity mismatch');const seen=new Set();for(const file of m.files){const p=child(folder,file.payload);if(seen.has(p.toLowerCase()))throw Error('Duplicate payload');seen.add(p.toLowerCase());if(!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isSafeInteger(file.size)||file.size<0)throw Error('Invalid backup file metadata');if(file.location)this.target(file.location);if(verify){await plain(p);const st=await fsp.stat(p);if(!st.isFile()||st.size!==file.size||await hashFile(p)!==file.sha256)throw Error('Backup integrity check failed: '+file.payload);}}if(!m.files.some(f=>f.payload==='achievements/hydra.json')||!m.files.some(f=>f.payload==='game.json'))throw Error('Backup is missing game metadata');return m;}
  staticRoots(g){const id=String(g.objectId);if(g.shop!=='steam'||!/^\d+$/.test(id))return [];const r=this.roots,defs=[['Roaming','Goldberg SteamEmu Saves'],['Roaming','GSE Saves'],['Roaming','Steam/CODEX'],['PublicDocuments','Steam/CODEX'],['PublicDocuments','Steam/RUNE'],['PublicDocuments','OnlineFix'],['Roaming','EMPRESS/remote'],['PublicDocuments','EMPRESS'],['Roaming','CreamAPI'],['Roaming','SmartSteamEmu'],['Roaming','RLE'],['Roaming','.1911'],['ProgramData','RLD!'],['ProgramData','Steam/Player'],['ProgramData','Steam/RLD!'],['ProgramData','Steam/dodi'],['Documents','SKIDROW'],['Documents','Player'],['Local','SKIDROW']];return defs.filter(([root])=>r[root]).map(([root,p])=>path.join(r[root],p,id));}
  async collect(g,scan){const selected=new Map();const add=async(p,kind)=>{if(!await exists(p))return;this.assertTarget(p);for(const file of await filesIn(p)){this.assertTarget(file);selected.set(path.resolve(file).toLowerCase(),{source:file,kind:/achiev|userstats/i.test(path.basename(file))?'achievement-source':kind});}};
    for(const p of this.staticRoots(g))await add(p,'save');for(const p of this.settings.extraPaths[keyOf(g)]||[]){if(!await exists(p))throw Error('Configured save folder is missing: '+p);await add(p,'save');}
    for(const item of await this.adapter.achievementFiles(g)){const p=typeof item==='string'?item:item.filePath;if(p)await add(p,'achievement-source');}
    const matched=scan?.[g.objectId]||scan?.[g.title]||scan?.[keyOf(g)];if(matched){for(const [p,info]of Object.entries(matched.files||{})){if(info.failed)throw Error('Save discovery failed: '+p);if(!info.ignored&&info.change!=='Removed')await add(p,'save');}}
    return Array.from(selected.values());}
  async createSnapshot(g,sourceFiles,metadata,reason,previous,force=false){const game=normalizeGame(g);const folderBase=path.join(this.settings.destination,'Games',gameFolder(game),'Snapshots');await plain(folderBase);await fsp.mkdir(folderBase,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const id=stamp+'-'+crypto.randomUUID().slice(0,8);const stage=path.join(folderBase,'.partial-'+id),destination=path.join(folderBase,id);const files=[];let totalBytes=0;let copied=0,reused=0;
    // An unchanged check hashes inputs without copying any file or creating a version.
    if(previous&&!force){
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
      files.sort((a,b)=>a.payload.localeCompare(b.payload));const stateHash=digest(stable(files.map(f=>({payload:f.payload,sha256:f.sha256,location:f.location}))));if(!force&&previous?.manifest.stateHash===stateHash){await fsp.rm(stage,{recursive:true,force:true});return {changed:false,folder:previous.folder,game,files:files.length,bytes:totalBytes};}
      if(reason!=='BeforeRestore'&&(await this.adapter.running()).some(item=>(typeof item==='string'?item:item.id||keyOf(item))===keyOf(game)))throw Error('The game started during backup. Retry after closing it.');
      this.checkCancelled();const manifest={format:'HydraBackupGame',version:2,engineVersion:VERSION,id,key:keyOf(game),game:{title:game.title,shop:game.shop,objectId:game.objectId},created:new Date().toISOString(),reason,stateHash,totalBytes,files};const text=JSON.stringify(manifest,null,2);await fsp.writeFile(child(stage,'manifest.json'),text);await fsp.writeFile(child(stage,'COMPLETE'),digest(text));await fsp.rename(stage,destination);return {changed:true,folder:destination,game,files:files.length,bytes:totalBytes,copied,reused};
    }catch(e){await fsp.rm(stage,{recursive:true,force:true}).catch(()=>{});throw e;}}
  async runBackup(key=null,reason='Manual'){
    if(this.busy)throw Error('A backup or restore is already running');
    this.busy=true;this.cancelRequested=false;this.controller=new AbortController();
    this.operation={kind:'backup',started:Date.now(),phase:'scanning'};this.emit('scanning');
    const results=[],errors=[],skipped=[],gameStatus={};
    try{
      const all=await this.games(),games=key?all.filter(g=>keyOf(g)===key):all;
      if(!games.length)throw Error('No matching games were found in the Hydra library');
      const runningKeys=new Set((await this.adapter.running()).map(x=>typeof x==='string'?x:x.id||keyOf(x)));
      const active=games.filter(g=>runningKeys.has(keyOf(g)));
      if(active.length&&key)throw Error('Close '+active[0].title+' before backing it up');
      const eligible=games.filter(g=>!runningKeys.has(keyOf(g)));
      if(!eligible.length)throw Error('All selected games are currently running');
      await plain(this.settings.destination);await fsp.mkdir(this.settings.destination,{recursive:true});
      let scanned={};
      try{scanned=await this.options.scan(eligible,{signal:this.controller.signal});}
      catch(e){this.checkCancelled();errors.push({game:'Save detection',message:e.message+' Known save locations and achievements were still checked.'});}
      this.checkCancelled();const previous=await this.snapshots();
      for(let i=0;i<eligible.length;i++){
        this.checkCancelled();const g=eligible[i],gameKey=keyOf(g);this.emit('copying',{game:g.title,index:i+1,total:eligible.length});
        try{
          const prev=previous.find(x=>x.key===gameKey&&x.reason!=='BeforeRestore');
          const prior=prev?{folder:prev.folder,manifest:await this.readManifest(prev.folder,false)}:null;
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
          const result=await this.createSnapshot(g,sources,metadata,reason,prior);results.push(result);
          gameStatus[gameKey]={status:result.changed?'saved':'unchanged',saveFiles:sources.filter(f=>f.kind==='save').length,achievementFiles:sources.filter(f=>f.kind==='achievement-source').length,unlockedAchievements:unlockedCount(metadata)};
          if(result.changed)await this.prune(g);
        }catch(e){this.checkCancelled();errors.push({game:g.title,message:e.message});gameStatus[gameKey]={status:'error',message:e.message};}
      }
      for(const g of active){skipped.push({key:keyOf(g),game:g.title,reason:'Game is running'});gameStatus[keyOf(g)]={status:'running'};}
      this.last={when:new Date().toISOString(),changed:results.filter(x=>x.changed).length,checked:eligible.length,skipped:skipped.length,games:gameStatus,errors};
      await atomicJson(path.join(this.stateDir,'status.json'),this.last);this.emit(errors.length?'partial':'complete',{...this.last});return {results,errors,skipped};
    }catch(e){const message=this.cancelRequested?'Backup cancelled. Completed recovery points are safe.':e.message;this.last={...this.last,error:message};this.emit(this.cancelRequested?'cancelled':'error',{message});throw Error(message);}
    finally{this.busy=false;this.operation=null;this.controller=null;this.emit('idle');}
  }
  async prune(g){const list=(await this.snapshots()).filter(s=>s.key===keyOf(g)&&s.reason!=='BeforeRestore');for(const snapshot of list.slice(this.settings.keepVersions)){const root=path.join(this.settings.destination,'Games');if(!inside(root,snapshot.folder)||path.basename(path.dirname(snapshot.folder))!=='Snapshots')throw Error('Unsafe retention path');const m=await this.readManifest(snapshot.folder,false);if(m.key!==keyOf(g))throw Error('Retention identity mismatch');await plain(snapshot.folder);await fsp.rm(snapshot.folder,{recursive:true,force:true});}}
  async previewRestore(folder){const manifest=await this.readManifest(folder,true);const record=JSON.parse(await fsp.readFile(child(folder,'game.json'),'utf8'));const metadata=JSON.parse(await fsp.readFile(child(folder,'achievements/hydra.json'),'utf8'));if(keyOf(record)!==manifest.key||(metadata.game&&keyOf(metadata.game)!==manifest.key))throw Error('Backup metadata game identity mismatch');if(metadata.achievementData){const d=metadata.achievementData;if(!Array.isArray(d.achievements)||!Array.isArray(d.unlockedAchievements)||d.achievements.some(a=>!a||typeof a.name!=='string')||d.unlockedAchievements.some(a=>!a||typeof a.name!=='string'||!Number.isFinite(Number(a.unlockTime))))throw Error('Invalid achievement metadata');}return {manifest,paths:manifest.files.filter(f=>f.location).map(f=>({payload:f.payload,target:this.target(f.location)}))};}
  async restoreMany(folders){if(!Array.isArray(folders)||!folders.length)throw Error('No recovery points selected');if(this.busy)throw Error('A backup or restore is already running');this.busy=true;this.cancelRequested=false;this.operation={kind:'restore',started:Date.now(),phase:'restoring'};const operations=[],metadataUndo=[];const transaction=crypto.randomUUID();const recovery=path.join(this.stateDir,'recovery-'+transaction+'.json');try{if((await this.adapter.running()).length)throw Error('Close all games before restoring');const previews=[];for(const folder of folders)previews.push({folder,...await this.previewRestore(folder)});const seen=new Map();for(const p of previews)for(const file of p.manifest.files.filter(f=>f.location)){const target=this.target(file.location);if(seen.has(target.toLowerCase())&&seen.get(target.toLowerCase())!==file.sha256)throw Error('Selected games contain conflicting shared save files. Restore them separately.');seen.set(target.toLowerCase(),file.sha256);}this.emit('restoring');
      for(const p of previews){const record=JSON.parse(await fsp.readFile(child(p.folder,'game.json'),'utf8'));const current=(await this.games()).find(g=>keyOf(g)===p.manifest.key)||record;const currentMetadata=await this.adapter.exportGame(current);metadataUndo.push({game:current,metadata:currentMetadata});const existing=[];for(const file of p.manifest.files.filter(f=>f.location)){const target=this.target(file.location);if(await exists(target))existing.push({source:target,kind:file.kind});}await this.createSnapshot(current,existing,currentMetadata,'BeforeRestore',null,true);}
      for(const p of previews)for(const file of p.manifest.files.filter(f=>f.location)){const target=this.target(file.location);if(operations.some(o=>o.target.toLowerCase()===target.toLowerCase()))continue;await plain(target);const source=child(p.folder,file.payload);await fsp.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(path.dirname(target),'.hydra-backup-'+transaction+'-'+operations.length);const previous=temporary+'.previous';const had=await exists(target);const originalHash=had?await hashFile(target):null;const op={target,temporary,previous,had,originalHash,moved:false,installed:false};operations.push(op);await fsp.copyFile(source,temporary,fs.constants.COPYFILE_EXCL);if(await hashFile(temporary)!==file.sha256)throw Error('Restore staging integrity check failed');}
      await atomicJson(recovery,{transaction,status:'prepared',operations,metadataUndo});if((await this.adapter.running()).length)throw Error('A game started during restore; nothing was replaced');
      for(const op of operations){await plain(op.target);if(op.had&&(await hashFile(op.target)!==op.originalHash))throw Error('A save changed during restore; retry with the game closed');if(!op.had&&await exists(op.target))throw Error('A save appeared during restore; retry');if(op.had){await fsp.rename(op.target,op.previous);op.moved=true;}await fsp.rename(op.temporary,op.target);op.installed=true;await atomicJson(recovery,{transaction,status:'replacing',operations,metadataUndo});}
      for(const p of previews){const data=JSON.parse(await fsp.readFile(child(p.folder,'achievements/hydra.json'),'utf8'));await this.adapter.importGame(p.manifest.game,data);}
      await atomicJson(recovery,{transaction,status:'complete',operations,metadataUndo});this.emit('restored',{games:previews.length});return {games:previews.length,recovery,restartRecommended:true};
    }catch(e){const failures=[];for(const op of [...operations].reverse()){try{if(op.installed)await fsp.rename(op.target,op.temporary);if(op.moved)await fsp.rename(op.previous,op.target);}catch(err){failures.push(err.message);}}for(const undo of metadataUndo){try{await this.adapter.importGame(undo.game,undo.metadata);}catch(err){failures.push(err.message);}}await atomicJson(recovery,{transaction,status:failures.length?'needs-recovery':'rolled-back',operations,metadataUndo,failures}).catch(()=>{});throw Error(e.message+(failures.length?' Manual recovery is required: '+recovery:''));}finally{this.busy=false;this.operation=null;this.emit('idle');}}
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
module.exports={BackupEngine,scanLudusavi,exec,filesIn,hashFile,atomicJson,plain,exists,child,inside,slug,keyOf,digest,VERSION,manifestGameNames,unlockedCount};
