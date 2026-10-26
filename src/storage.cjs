'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {atomicText}=require('./themes.cjs'),{validKey}=require('./activity.cjs');
const {resolveInstallation,within,broad}=require('./storage-roots.cjs');
const absolute=value=>typeof value==='string'&&value.length<32000&&!/[\x00-\x1f]/.test(value)&&path.isAbsolute(value);
const keyOf=g=>g.shop+':'+g.objectId;
const same=(a,b)=>a&&b&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
function detectedFolder(game){
  for(const name of ['installationPath','installDirectory','installPath','gameDirectory'])if(absolute(game[name]))return path.resolve(game[name]);
  if(!absolute(game.executablePath))return null;
  let folder=path.dirname(game.executablePath);
  for(let i=0;i<4&&/^(binaries|bin|win32|win64|x64|x86)$/i.test(path.basename(folder));i++)folder=path.dirname(folder);
  return folder===path.parse(folder).root?null:folder;
}
async function folderSize(folder,{signal,io=fs,maxEntries=1000000}={}){
  const root=await io.lstat(folder);if(!root.isDirectory()||root.isSymbolicLink()||!same(await io.realpath(folder),folder))throw Error('Choose a regular game folder.');
  const pending=[folder];let bytes=0,files=0,skipped=0,entries=0;
  while(pending.length){
    signal?.throwIfAborted();const current=pending.pop();let items,currentStat;try{currentStat=await io.lstat(current);}catch{skipped++;continue;}if(currentStat.isSymbolicLink()){skipped++;continue;}
    try{items=await io.readdir(current,{withFileTypes:true});}catch{skipped++;continue;}
    for(const item of items){
      signal?.throwIfAborted();if(++entries>maxEntries)throw Error('This folder is too large to scan in one pass.');
      if(item.isSymbolicLink()){skipped++;continue;}
      const file=path.join(current,item.name);let stat;try{stat=await io.lstat(file);}catch{skipped++;continue;}
      // Recheck after enumeration; junctions and links may change while scanning.
      if(stat.isSymbolicLink()){skipped++;continue;}
      if(stat.isDirectory())pending.push(file);
      else if(stat.isFile()){bytes+=stat.size;files++;}
    }
    // Yield between directories so cancellation and native events stay responsive.
    if(entries%256===0)await new Promise(resolve=>setImmediate(resolve));
  }
  return {bytes,files,skipped,partial:skipped>0};
}
function createStorage({directory,library,enabled=()=>true,changed=()=>{},resolveFolder=async()=>null,protectedPaths=[],io=fs,now=Date.now}){
  const file=path.join(directory,'storage-settings.json');let settings={schema:1,folders:{},previous:{},seen:{}},initializing=null,rows=[],volumes=[],controller=null,revision=0,progress={busy:false,done:0,total:0},queue=Promise.resolve();
  const sizes=new Map();let progressTimer=null;
  function emit(final=true){if(!final){if(progressTimer===null){progressTimer=setTimeout(()=>{progressTimer=null;changed(snapshot());},100);progressTimer.unref?.();}return;}clearTimeout(progressTimer);progressTimer=null;changed(snapshot());}
  async function init(){if(initializing)return initializing;initializing=(async()=>{try{const value=JSON.parse(await io.readFile(file,'utf8'));value.seen??={};if(value.schema!==1||!value.folders||!value.previous||[value.folders,value.previous,value.seen].some(map=>Array.isArray(map)||typeof map!=='object'||Object.entries(map).some(([key,folder])=>!validKey(key)||!absolute(folder))))throw Error();settings=value;}catch(error){if(error.code!=='ENOENT')throw Error('Storage preferences could not be read. The original file was preserved.');}})();return initializing;}
  function snapshot(){return {games:rows,volumes,progress:{...progress}};}
  function save(update){const task=queue.catch(()=>{}).then(async()=>{const next=update(settings);await atomicText(file,JSON.stringify(next,null,2));settings=next;});queue=task;return task;}
  const location=game=>resolveInstallation(game,{io,hint:resolveFolder,override:settings.folders[keyOf(game)]});
  async function report(){
    await init();if(!enabled())throw Error('Enable Game Storage Manager in Plugins first.');
    const token=revision,games=await library(),next=[],disks=new Map(),seen={...settings.seen},previousFolders={...settings.previous};let locationsChanged=false;
    for(const game of games){
      if(token!==revision)return snapshot();const key=keyOf(game);if(!validKey(key)||game.isDeleted||game.isInstalled===false||!detectedFolder(game))continue;const resolved=await location(game);if(token!==revision)return snapshot();const folder=resolved.folder,detected=folder,previous=settings.seen[key]&&!same(settings.seen[key],folder)?settings.seen[key]:settings.previous[key];if(folder&&!same(seen[key],folder)){if(seen[key])previousFolders[key]=seen[key];seen[key]=folder;locationsChanged=true;}
      const lastPlayed=new Date(game.lastTimePlayed||0).getTime();const row={key,title:String(game.title||game.objectId),shop:game.shop,objectId:String(game.objectId),catalogueGame:game.catalogueGame||null,customImage:!!game.customCoverImageUrl,image:game.customCoverImageUrl||game.coverImageUrl||game.libraryImageUrl||null,lastPlayed:Number.isFinite(lastPlayed)&&lastPlayed>0?lastPlayed:null,folder,drive:folder?path.parse(folder).root:'',detected,previous:previous&&!same(previous,folder)?previous:null,executable:game.executablePath||null,status:folder?'missing':'unknown',bytes:null,files:null,measuredAt:null,partial:false,rootVerified:resolved.rootVerified,rootSource:resolved.rootSource};
      if(folder&&path.parse(folder).root!==path.resolve(folder))try{
        const stat=await io.lstat(folder);
        const inside=(a,b)=>{const rel=path.relative(a,b);return !rel||!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);};
        if(!stat.isDirectory()||stat.isSymbolicLink()||protectedPaths.some(p=>p&&(inside(p,folder)||inside(folder,p)))||/^(users|program files(?: \(x86\))?|windows|desktop|documents|downloads|games|steamlibrary|steamapps|common)$/i.test(path.basename(folder)))row.status='unavailable';
        else{
          row.status=previous&&!same(previous,folder)||settings.folders[key]?'moved':'ready';
          if(absolute(game.executablePath)&&!settings.folders[key])try{await io.access(game.executablePath);}catch{row.status='executableMissing';}
          row.drive=path.parse(folder).root;const volumeKey=String(stat.dev);row.volume=volumeKey;
          if(!disks.has(volumeKey))try{const space=await io.statfs(folder,{bigint:true});disks.set(volumeKey,{id:volumeKey,drive:row.drive,freeBytes:Number(space.bavail*space.bsize),totalBytes:Number(space.blocks*space.bsize)});}catch{disks.set(volumeKey,{id:volumeKey,drive:row.drive,freeBytes:null,totalBytes:null});}
          const cached=sizes.get(path.resolve(folder));if(cached)Object.assign(row,cached);
        }
      }catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))row.status='unavailable';}
      next.push(row);
    }
    if(token!==revision)return snapshot();rows=next;volumes=[...disks.values()];if(locationsChanged)await save(current=>({...current,seen,previous:previousFolders}));return snapshot();
  }
  function cancel(){revision++;controller?.abort();controller=null;progress={...progress,busy:false};emit();}
  async function scan(){
    if(progress.busy)return snapshot();const before=revision;await report();if(before!==revision||!enabled())return snapshot();controller=new AbortController();const signal=controller.signal,token=++revision;
    const folders=[...new Set(rows.filter(row=>['ready','moved','executableMissing'].includes(row.status)).map(row=>row.folder))];for(const row of rows)if(folders.includes(row.folder)){row.bytes=null;row.files=null;row.measuredAt=null;row.partial=false;}progress={busy:true,done:0,total:folders.length};emit();
    void (async()=>{let cursor=0;await Promise.allSettled(Array.from({length:Math.min(2,folders.length)},async()=>{while(cursor<folders.length){const folder=folders[cursor++];if(signal.aborted)return;let value;try{value={...await folderSize(folder,{signal,io}),measuredAt:now(),recorded:false};}catch(error){if(signal.aborted)return;value={bytes:null,partial:true,error:error.message,measuredAt:now()};}if(token!==revision)return;sizes.set(path.resolve(folder),value);while(sizes.size>2048)sizes.delete(sizes.keys().next().value);for(const row of rows)if(same(row.folder,folder))Object.assign(row,value);progress.done++;emit(false);}}));if(token===revision){progress.busy=false;controller=null;emit();}})();return snapshot();
  }
  async function locate(key,folder){await init();const game=(await library()).find(game=>keyOf(game)===key);if(!enabled()||!validKey(key)||!game)throw Error('Unknown game');if(!absolute(folder)||broad(folder))throw Error('Choose a regular game folder.');const stat=await io.lstat(folder);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Choose a regular game folder.');if(absolute(game.executablePath)&&!within(folder,game.executablePath)){let exists=false;try{exists=(await io.lstat(game.executablePath)).isFile();}catch{}if(exists)throw Error('Choose a folder containing the game executable.');}const automatic=await resolveInstallation(game,{io,hint:resolveFolder});if(automatic.rootVerified&&within(automatic.folder,folder)&&!same(automatic.folder,folder))throw Error('Choose the full installation folder, not a subfolder.');cancel();const old=rows.find(row=>row.key===key)?.folder;await save(current=>({...current,folders:{...current.folders,[key]:path.resolve(folder)},previous:{...current.previous,...old?{[key]:old}:{}}}));return report();}
  async function openFolder(key,forTransfer=false){await init();if(!enabled())throw Error('Enable Game Storage Manager in Plugins first.');const game=(await library()).find(g=>keyOf(g)===key),resolved=game&&await location(game),folder=resolved?.folder;if(!folder)throw Error('The game folder is unavailable.');if(forTransfer&&(!resolved.rootVerified||!absolute(game.executablePath)||!within(folder,game.executablePath)))throw Error('Confirm the full game folder before moving it.');const stat=await io.lstat(folder);if(!stat.isDirectory()||stat.isSymbolicLink()||broad(folder))throw Error('The game folder is unavailable.');return folder;}
  async function moved(key,folder,measurement){cancel();await init();await save(current=>({...current,folders:{...current.folders,[key]:path.resolve(folder)}}));if(folder&&measurement)sizes.set(path.resolve(folder),measurement);return report();}
  return {init,report,snapshot,scan,cancel,locate,openFolder,transferFolder:key=>openFolder(key,true),moved};
}
module.exports={createStorage,folderSize,detectedFolder};
