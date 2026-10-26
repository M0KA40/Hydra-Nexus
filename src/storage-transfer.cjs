'use strict';
const fs=require('node:fs'),io=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {Transform}=require('node:stream'),{pipeline}=require('node:stream/promises'),{atomicText}=require('./themes.cjs');
const {validKey}=require('./activity.cjs');
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const within=(root,p)=>{const r=path.relative(path.resolve(root),path.resolve(p));return !r||!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
async function commitGameLocation({binding,storage,log=()=>{}},game){
 await binding.storage.queue.run(async()=>{const current=await binding.games.get(game.key);if(!current||current.isDeleted||current.executablePath!==game.executable)throw Error('The game location changed during transfer. Both folders were kept.');
  const next={...binding.storage.update(current,game.newExecutable),installedSizeInBytes:game.tree.bytes};
  for(const field of ['installationPath','installDirectory','installPath','gameDirectory'])if(typeof next[field]==='string'&&within(game.source,next[field]))next[field]=path.join(game.target,path.relative(game.source,next[field]));
  if(Array.isArray(next.trackingExecutablePaths))next.trackingExecutablePaths=next.trackingExecutablePaths.map(p=>typeof p==='string'&&within(game.source,p)?path.join(game.target,path.relative(game.source,p)):p);
  await binding.games.put(game.key,next);
 });
 await storage.moved(game.key,game.target,{bytes:game.tree.bytes,files:game.tree.files.length,partial:false,recorded:false,measuredAt:Date.now()}).catch(log);binding.windowManager?.sendToAppWindows?.('on-library-batch-complete');
}
async function regular(folder){const st=await io.lstat(folder);if(!st.isDirectory()||st.isSymbolicLink()||!same(await io.realpath(folder),folder))throw Error('Linked or unavailable game folders cannot be moved.');return st;}
async function tree(folder,signal){
 await regular(folder);const pending=[''],files=[],dirs=[];let bytes=0;
 while(pending.length){signal?.throwIfAborted();const relative=pending.pop(),current=path.join(folder,relative);await regular(current);
  for(const item of await io.readdir(current,{withFileTypes:true})){signal?.throwIfAborted();const rel=path.join(relative,item.name),st=await io.lstat(path.join(folder,rel));if(st.isSymbolicLink())throw Error('Linked or unavailable game folders cannot be moved.');if(st.isDirectory()){dirs.push(rel);pending.push(rel);}else if(st.isFile()){files.push({rel,size:st.size,mtime:st.mtimeMs});bytes+=st.size;}else throw Error('This folder contains unsupported file types.');if(files.length+dirs.length>500000)throw Error('This folder is too large to scan in one pass.');}
 }
 return {files,dirs,bytes};
}
const signature=list=>JSON.stringify(list.files.map(f=>[f.rel,f.size,f.mtime]).sort((a,b)=>a[0].localeCompare(b[0])));
async function digest(file,signal){const hash=crypto.createHash('sha256');await pipeline(fs.createReadStream(file),new Transform({transform(chunk,_encoding,done){hash.update(chunk);done();}}),{signal});return hash.digest('hex');}
function createStorageTransfers({directory,library,folderFor,commit,guard=async()=>{},enabled=()=>true,changed=()=>{},protectedPaths=[]}){
 let state={busy:false,phase:'idle',done:0,total:0,current:null,copied:0,bytes:0,results:[],recoveries:[]},plan=null,abort=null,task=null,lastEmit=0,initializing=null,expiry=null;
 const snapshots=()=>({...state,plan:plan?{id:plan.id,destination:plan.destination,bytes:plan.bytes,freeBytes:plan.freeBytes,games:plan.games.map(g=>({key:g.key,title:g.title,source:g.source,target:g.target,bytes:g.tree.bytes,files:g.tree.files.length}))}:null});
 const emit=(force=true)=>{if(force||Date.now()-lastEmit>150){lastEmit=Date.now();changed(snapshots());}};
 async function init(){return initializing||=(async()=>{let names=[];try{names=await io.readdir(directory);}catch(e){if(e.code!=='ENOENT')throw e;}for(const name of names.filter(n=>/^[a-f0-9-]{36}\.json$/i.test(n)).slice(-100)){try{const value=JSON.parse(await io.readFile(path.join(directory,name),'utf8'));if(value.schema===1&&value.phase!=='complete'&&value.phase!=='cancelled')state.recoveries.push({source:value.source,target:value.target,retained:value.retained});}catch{}}})();}
 function cancel(){clearTimeout(expiry);expiry=null;plan=null;abort?.abort();if(!state.busy){state.phase='cancelled';emit();}return snapshots();}
 function safeRoot(folder){if(!path.isAbsolute(folder)||same(folder,path.parse(folder).root)||protectedPaths.some(p=>p&&(within(folder,p)||within(p,folder)))||/^(users|program files(?: \(x86\))?|windows|desktop|documents|downloads|games|steamlibrary|steamapps|common)$/i.test(path.basename(folder)))throw Error('Choose a separate game folder.');}
 async function prepare(keys,destination){
  await init();if(state.busy)throw Error('A game transfer is already running.');if(!enabled()||!Array.isArray(keys)||!keys.length||keys.length>50||keys.some(k=>!validKey(k)))throw Error('Select installed games to move.');
  clearTimeout(expiry);plan=null;abort=new AbortController();const signal=abort.signal;state={...state,busy:true,phase:'planning',done:0,total:keys.length,current:null,results:[]};emit();
  try{await regular(destination);const all=await library(),games=[],unique=[...new Set(keys)];
   for(const key of unique){signal.throwIfAborted();await guard(key);const game=all.find(g=>g.shop+':'+g.objectId===key);if(!game?.executablePath)throw Error('The game folder is unavailable.');const executable=await io.lstat(game.executablePath);if(!executable.isFile()||executable.isSymbolicLink())throw Error('The game folder is unavailable.');const source=path.resolve(await folderFor(key));safeRoot(source);await regular(source);if(!within(source,game.executablePath))throw Error('The executable is outside the selected game folder.');
    for(const other of all)if(other.shop+':'+other.objectId!==key&&other.executablePath&&within(source,other.executablePath))throw Error('Games sharing a folder must be managed separately.');
    const target=path.join(path.resolve(destination),path.basename(source));if(within(source,target)||within(target,source)||games.some(g=>within(g.source,source)||within(source,g.source)||same(g.target,target)))throw Error('Choose a destination outside the game folder.');
    try{await io.lstat(target);throw Error('The destination folder already exists.');}catch(e){if(e.code!=='ENOENT')throw e;}
    state.current=game.title;emit();const listing=await tree(source,signal);games.push({key,title:game.title,source,target,executable:game.executablePath,newExecutable:path.join(target,path.relative(source,game.executablePath)),tree:listing});state.done++;emit();
   }
   const bytes=games.reduce((n,g)=>n+g.tree.bytes,0),space=await io.statfs(destination,{bigint:true}),freeBytes=Number(space.bavail*space.bsize);if(freeBytes<bytes+1048576)throw Error('There is not enough free space on the destination.');signal.throwIfAborted();if(!enabled())throw Error('Enable Game Storage Manager in Plugins first.');
   plan={id:crypto.randomUUID(),destination:path.resolve(destination),games,bytes,freeBytes};state={...state,busy:false,phase:'ready',current:null,bytes};expiry=setTimeout(()=>{if(!state.busy){plan=null;state.phase='idle';emit();}},600000);expiry.unref?.();emit();return snapshots();
  }catch(e){state.busy=false;state.phase=signal.aborted?'cancelled':'error';state.error=e.message;emit();throw e;}
 }
 async function removeOwned(folder,parent,id){if(path.dirname(folder)!==parent||!path.basename(folder).includes(id))throw Error('Transfer cleanup needs attention.');await regular(folder);await io.rm(folder,{recursive:true,force:true});}
 async function moveOne(g,signal){
  const id=crypto.randomUUID(),parent=path.dirname(g.target),stage=path.join(parent,'.nexus-transfer-'+id),retained=path.join(path.dirname(g.source),'.nexus-moved-'+id),journal=path.join(directory,id+'.json');let owned=false,final=false,attemptedCommit=false;
  const record={schema:1,key:g.key,source:g.source,target:g.target,stage,retained,phase:'copying'},save=async phase=>{record.phase=phase;await atomicText(journal,JSON.stringify(record,null,2));};
  try{await guard(g.key);safeRoot(g.source);await regular(g.source);await regular(parent);if(signature(await tree(g.source,signal))!==signature(g.tree))throw Error('Game files changed. Refresh and try again.');
   const space=await io.statfs(parent,{bigint:true});if(Number(space.bavail*space.bsize)<g.tree.bytes+1048576)throw Error('There is not enough free space on the destination.');
   await io.mkdir(stage);owned=true;await save('copying');for(const dir of g.tree.dirs)await io.mkdir(path.join(stage,dir),{recursive:true});
   for(const f of g.tree.files){signal.throwIfAborted();const source=path.join(g.source,f.rel),target=path.join(stage,f.rel),st=await io.lstat(source);if(st.isSymbolicLink()||st.size!==f.size||st.mtimeMs!==f.mtime)throw Error('Game files changed. Refresh and try again.');const hash=crypto.createHash('sha256');
    await pipeline(fs.createReadStream(source),new Transform({transform(chunk,_encoding,done){hash.update(chunk);state.copied+=chunk.length;emit(false);done(null,chunk);}}),fs.createWriteStream(target,{flags:'wx',mode:st.mode}),{signal});
    state.phase='verifying';emit(false);if(await digest(target,signal)!==hash.digest('hex'))throw Error('The copied game failed verification.');await io.utimes(target,st.atime,st.mtime);state.phase='copying';
   }
   if(signature(await tree(g.source,signal))!==signature(g.tree))throw Error('Game files changed. Refresh and try again.');signal.throwIfAborted();if(!enabled())throw Error('Enable Game Storage Manager in Plugins first.');await guard(g.key);
   try{await io.lstat(g.target);throw Error('The destination folder already exists.');}catch(e){if(e.code!=='ENOENT')throw e;}
   await io.rename(stage,g.target);owned=false;final=true;await save('updating');state.phase='updating';emit();attemptedCommit=true;await commit(g);
   await save('cleanup');state.phase='cleanup';emit();if(signature(await tree(g.source))!==signature(g.tree))throw Error('Game files changed. Both folders were kept.');
   await io.rename(g.source,retained);await save('cleanup');if(signature(await tree(retained))!==signature(g.tree)){await io.rename(retained,g.source);throw Error('Game files changed. Both folders were kept.');}
   await removeOwned(retained,path.dirname(g.source),id);await save('complete');return {key:g.key,title:g.title,status:'complete',target:g.target};
  }catch(e){let cleanupFailed=false;if(owned)try{await removeOwned(stage,parent,id);}catch{cleanupFailed=true;}const attention=attemptedCommit||final||cleanupFailed;if(!attention)await save('cancelled').catch(()=>{});else{state.recoveries.push({source:g.source,target:g.target,retained:cleanupFailed?stage:retained});await save('attention').catch(()=>{});}return {key:g.key,title:g.title,status:attention?'attention':signal.aborted?'cancelled':'error',error:e.message,source:g.source,target:g.target};}
 }
 function start(id){if(state.busy||!plan||plan.id!==id)throw Error('Prepare the game transfer again.');const current=plan;plan=null;clearTimeout(expiry);abort=new AbortController();const signal=abort.signal;state={...state,busy:true,phase:'copying',done:0,total:current.games.length,copied:0,bytes:current.bytes,results:[],error:null};emit();
  task=(async()=>{for(const g of current.games){if(signal.aborted)break;state.current=g.title;state.phase='copying';emit();const result=await moveOne(g,signal);state.results.push(result);state.done++;emit();if(result.status!=='complete')break;}})().catch(e=>{state.error=e.message;}).finally(()=>{state.busy=false;state.current=null;state.phase=state.results.some(r=>r.status==='attention'||r.status==='error')?'attention':signal.aborted?'cancelled':state.error?'error':'complete';emit();});return snapshots();
 }
 return {init,prepare,start,cancel,snapshot:snapshots,busy:()=>state.busy,wait:()=>task||Promise.resolve(),locks:key=>state.busy&&(!key||plan?.games.some(g=>g.key===key)||state.current!==null)};
}
module.exports={createStorageTransfers,commitGameLocation,tree,within};
