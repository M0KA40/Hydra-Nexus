'use strict';
// The download location stays native: torrents, deletion and resume still own
// their original files. Only extraction and discovery use the saved destination.
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {atomicText}=require('./themes.cjs');
const {validKey}=require('./activity.cjs');
const within=(root,file)=>{const r=path.relative(root,file);return !r||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
const validPath=p=>typeof p==='string'&&p.length>0&&p.length<32000&&!/[\x00-\x1f]/.test(p)&&path.isAbsolute(p);
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const identity=d=>({uri:d.uri,downloadPath:path.resolve(d.downloadPath)});
const matches=(j,d)=>j&&typeof d?.downloadPath==='string'&&j.uri===d.uri&&same(j.downloadPath,d.downloadPath)&&(j.timestamp===undefined||j.timestamp===d.timestamp);
function createExtractPaths({directory,getNative,enabled=()=>true,changed=()=>{},log=()=>{}}){
  const file=path.join(directory,'extract-paths.json'),active=new Set(),locks=new Map();
  let state={schema:1,lastPath:null,jobs:{}},error=null,queue=Promise.resolve();
  const serialize=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  async function save(next){await atomicText(file,JSON.stringify(next,null,2));state=next;}
  async function init(){
    try{const saved=JSON.parse(await fsp.readFile(file,'utf8'));
      if(!saved||saved.schema!==1||!(saved.lastPath===null||validPath(saved.lastPath))||!saved.jobs||Array.isArray(saved.jobs)||typeof saved.jobs!=='object')throw Error();
      for(const [key,j]of Object.entries(saved.jobs)){
        if(!validKey(key)||!j||typeof j.uri!=='string'||!validPath(j.downloadPath)||!validPath(j.destination)||(j.resultPath!==undefined&&!validPath(j.resultPath))||(j.outputPath!==undefined&&!validPath(j.outputPath))||(j.timestamp!==undefined&&!Number.isFinite(j.timestamp)))throw Error();
        if(j.phase!==undefined&&!['extracting','extracted','complete'].includes(j.phase))throw Error();
        if(j.companionsDone!==undefined&&typeof j.companionsDone!=='boolean')throw Error();
        if(j.cleanup!==undefined&&(!Array.isArray(j.cleanup)||j.cleanup.some(p=>!p||!validPath(p.file)||!Number.isSafeInteger(p.size)||p.size<0||!Number.isFinite(p.mtimeMs)||!(/\.(?:zip|rar|7z|r\d{2,3}|z\d{2,3})$/i.test(p.file))||!(within(path.resolve(j.downloadPath),p.file)||j.outputPath&&within(path.resolve(j.outputPath),p.file)))))throw Error();
      }
      state=saved;
    }catch(e){if(e.code!=='ENOENT')error='Extraction path settings are damaged. The original file was preserved.';}
    return status();
  }
  function status(){return {lastPath:state.lastPath,error,supported:!!getNative()?.manager};}
  async function validate(folder){
    if(!validPath(folder))throw Error('Choose a valid extraction folder.');
    try{const stat=await fsp.stat(folder);if(!stat.isDirectory())throw Error();await fsp.access(folder,fs.constants.W_OK);return path.resolve(folder);}catch{throw Error('The extraction folder is unavailable or cannot be written to.');}
  }
  async function choose(win,dialog,defaultPath){
    if(error)throw Error(error);
    const r=await dialog.showOpenDialog(win,{title:'Choose extraction folder',defaultPath:validPath(defaultPath)?defaultPath:state.lastPath||undefined,properties:['openDirectory','createDirectory']});
    if(r.canceled||!r.filePaths?.length)return {cancelled:true};
    return {path:await validate(r.filePaths[0])};
  }
  async function downloadEvent(listener,event,payload,...args){
    if(!payload||!validKey(payload.shop+':'+payload.objectId)||typeof payload.downloadPath!=='string'||typeof payload.uri!=='string')return listener(event,payload,...args);
    const key=payload.shop+':'+payload.objectId;
    if(locks.has(key))throw Error('A download request is already running.');
    const task=(async()=>{
      const selected=enabled()&&payload.automaticallyExtract===true?payload.nexusExtractPath:null;
      if(selected!==undefined&&selected!==null&&typeof selected!=='string')throw Error('Choose a valid extraction folder.');
      if(error&&selected)throw Error(error);
      const chosenPath=selected?await validate(selected):null;let destination=chosenPath;
      if(destination&&same(destination,payload.downloadPath))destination=null;
      const previous=state.jobs[key];
      if(active.has(key))throw Error('Wait for extraction to finish before starting another download.');
      if(destination||previous){await serialize(async()=>{const jobs={...state.jobs};if(destination)jobs[key]={...identity(payload),destination};else delete jobs[key];await save({...state,jobs});});}
      const clean={...payload};delete clean.nexusExtractPath;
      let result;
      try{result=await listener(event,clean,...args);}catch(e){await rollback();throw e;}
      if(result?.ok===false){await rollback();return result;}
      if(chosenPath){
        // The download is already accepted. An optional last-folder update
        // must not turn it into a false failure and invite a duplicate retry.
        try{const current=await getNative().downloads.get(key);
          await serialize(async()=>{const job=state.jobs[key],jobs={...state.jobs};if(destination&&matches(job,payload))jobs[key]={...job,...Number.isFinite(current?.timestamp)?{timestamp:current.timestamp}:{}};await save({...state,lastPath:chosenPath,jobs});});
        }catch(e){log(e);}
        changed();
      }
      return result;
      async function rollback(){if(error||active.has(key))return;await serialize(async()=>{const jobs={...state.jobs};if(previous)jobs[key]=previous;else delete jobs[key];await save({...state,jobs});});}
    })();
    locks.set(key,task);try{return await task;}finally{locks.delete(key);}
  }
  function resolved(key,download){const job=state.jobs[key];return matches(job,download)&&job.resultPath?job.resultPath:null;}
  async function archiveGroups(folder,only){
    const entries=await fsp.readdir(folder,{withFileTypes:true}),names=entries.filter(e=>e.isFile()&&/\.(zip|rar|7z)$/i.test(e.name)).map(e=>e.name),groups=[],seen=new Set();
    const all=entries.filter(e=>e.isFile()).map(e=>e.name),part=n=>n.match(/^(.*)\.part(\d+)\.rar$/i);
    for(const name of names){
      const m=part(name);let archive=name,parts=[name];
      if(only){const requested=part(only);if(m?(!requested||requested[1].toLowerCase()!==m[1].toLowerCase()):name.toLowerCase()!==only.toLowerCase())continue;}
      if(m){
        const family=names.filter(n=>{const p=part(n);return p&&p[1].toLowerCase()===m[1].toLowerCase();});
        const first=family.filter(n=>Number(part(n)[2])===1),numbers=family.map(n=>Number(part(n)[2]));
        if(first.length!==1||new Set(numbers).size!==numbers.length||numbers.reduce((a,b)=>Math.max(a,b),0)!==numbers.length)throw Error('The downloaded archive could not be found.');
        archive=first[0];parts=family;
      }else if(/\.(rar|zip)$/i.test(name)){
        const stem=name.slice(0,-4).toLowerCase(),volume=/\.rar$/i.test(name)?/^r\d{2,3}$/i:/^z\d{2,3}$/i;
        parts.push(...all.filter(n=>path.parse(n).name.toLowerCase()===stem&&volume.test(path.extname(n).slice(1))));
      }
      if(only&&!parts.some(n=>n.toLowerCase()===only.toLowerCase()))continue;
      const primary=path.join(folder,archive);if(seen.has(primary))continue;seen.add(primary);
      groups.push({archive:primary,parts:parts.map(n=>path.join(folder,n))});
    }
    return groups;
  }
  async function checkSpace(destination,bytes=0n){
    const disk=await fsp.statfs(destination,{bigint:true});
    if(disk.bavail*disk.bsize<bytes+512n*1024n*1024n)throw Error('There is not enough free space in the extraction folder.');
  }
  async function room(native,archive,destination){
    let required=0n;
    // Encrypted headers cannot be listed without a password; native extraction
    // still owns its password attempts and reports any write/decode failure.
    if(native.zip.listEntries)try{const entries=await native.zip.listEntries(archive);for(const e of entries)if(Number.isSafeInteger(e.size)&&e.size>0)required+=BigInt(e.size);}catch{}
    await checkSpace(destination,required);
  }
  async function verifyOutput(base,output){
    const realBase=await fsp.realpath(base),stat=await fsp.lstat(output),realOutput=await fsp.realpath(output);
    if(!stat.isDirectory()||stat.isSymbolicLink()||!within(realBase,realOutput)||same(realBase,realOutput))throw Error('Choose a valid extraction folder.');
    return realOutput;
  }
  async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
  async function secureDirectory(root,dir){
    if(!within(root,dir))throw Error('Choose a valid extraction folder.');
    let current=root;const base=await fsp.realpath(root);
    for(const segment of path.relative(root,dir).split(path.sep).filter(Boolean)){
      current=path.join(current,segment);let s=await fsp.lstat(current).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
      if(!s){await fsp.mkdir(current);s=await fsp.lstat(current);}
      if(!s.isDirectory()||s.isSymbolicLink()||!within(base,await fsp.realpath(current)))throw Error('Choose a valid extraction folder.');
    }
  }
  async function copyCompanions(source,destination,excluded){
    const files=[],dirs=[];
    async function walk(folder){for(const e of await fsp.readdir(folder,{withFileTypes:true})){
      const from=path.join(folder,e.name);if(excluded.has(from))continue;
      if(e.isSymbolicLink())throw Error('Choose a valid extraction folder.');
      const relative=path.relative(source,from),to=path.join(destination,relative);
      if(!within(destination,to))throw Error('Choose a valid extraction folder.');
      if(e.isDirectory()){dirs.push(to);await walk(from);}else if(e.isFile())files.push({from,to,size:(await fsp.stat(from)).size});
      else throw Error('Choose a valid extraction folder.');
    }}
    await walk(source);const pending=[];
    for(const dir of dirs)await secureDirectory(destination,dir);
    for(const f of files){
      const existing=await fsp.lstat(f.to).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
      if(existing){if(!existing.isFile()||existing.isSymbolicLink()||existing.size!==f.size||await hash(f.from)!==await hash(f.to))throw Error('The extraction folder already contains another download. Choose another location.');}
      else pending.push(f);
    }
    await checkSpace(destination,pending.reduce((n,f)=>n+BigInt(f.size),0n));
    for(const f of pending){await secureDirectory(destination,path.dirname(f.to));await fsp.copyFile(f.from,f.to,fs.constants.COPYFILE_EXCL);}
  }
  async function complete(key,download,manager,native){
    const job=state.jobs[key],current=await native.downloads.get(key);
    if(!matches(job,current))throw Error('The downloaded archive could not be found.');
    await verifyOutput(await validate(job.destination),job.resultPath);
    // Commit native completion first. A DB failure must never remove sources;
    // the durable extracted checkpoint permits recovery without decoding again.
    await manager.setExtractionComplete();
    try{await serialize(()=>save({...state,jobs:{...state.jobs,[key]:{...state.jobs[key],phase:'complete'}}}));}catch(e){log(e);}
    try{
      const preferences=await native.db.get('userPreferences',{valueEncoding:'json'}),remove=current.automaticallyDeleteArchiveFiles??preferences?.deleteArchiveFilesAfterExtractionByDefault??false,eligible=[];
      for(const entry of job.cleanup||[]){
        const s=await fsp.lstat(entry.file).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
        if(s&&s.isFile()&&!s.isSymbolicLink()&&s.size===entry.size&&s.mtimeMs===entry.mtimeMs)eligible.push(entry.file);
      }
      if(remove){for(const file of eligible)await native.deleteArchive(file);}
      else if(eligible.length)native.windows.sendToAppWindows('on-archive-deletion-prompt',eligible);
    }catch(e){log(e);}
  }
  async function extract(download,game){
    const key=download.shop+':'+download.objectId,job=state.jobs[key],native=getNative();
    if(error||!matches(job,download)||!native?.manager)return false;
    if(!enabled()&&!job.resultPath)return false;
    if(active.has(key))return true;
    const manager=new native.manager(download.shop,download.objectId);active.add(key);
    try{
      if(job.resultPath){if(job.phase==='complete'&&download.extracting===false)return true;await complete(key,download,manager,native);return true;}
      if(!download.folderName||!validPath(download.downloadPath))throw Error('The downloaded archive could not be found.');
      const base=path.resolve(download.downloadPath),source=path.resolve(base,download.folderName);
      if(!within(base,source)||same(base,source))throw Error('The downloaded archive could not be found.');
      const info=await fsp.stat(source),single=info.isFile();
      if(!single&&!info.isDirectory())throw Error('The downloaded archive could not be found.');
      if(single&&!/\.(zip|rar|7z)$/i.test(source))return false;
      const initial=await archiveGroups(single?path.dirname(source):source,single?path.basename(source):null);
      if(!initial.length)return false;
      const targetBase=await validate(job.destination),name=single?path.parse(source).name:path.basename(source),destination=path.join(targetBase,name);
      if(!name||!within(targetBase,destination)||same(targetBase,destination))throw Error('Choose a valid extraction folder.');
      const realSource=await fsp.realpath(source),baseTarget=await fsp.realpath(targetBase),plannedTarget=path.join(baseTarget,name);
      if(within(realSource,plannedTarget)||within(plannedTarget,realSource))throw Error('Keep the extraction folder separate from the downloaded files.');
      await fsp.mkdir(destination,{recursive:true});
      const realTarget=await verifyOutput(targetBase,destination);
      if(within(realSource,realTarget)||within(realTarget,realSource))throw Error('Keep the extraction folder separate from the downloaded files.');
      await serialize(async()=>{
        const current=state.jobs[key],claimed=current.outputPath&&same(current.outputPath,destination);
        if(!claimed&&((await fsp.readdir(destination)).length||Object.entries(state.jobs).some(([k,j])=>k!==key&&j.outputPath&&same(j.outputPath,destination))))throw Error('The extraction folder already contains another download. Choose another location.');
        await save({...state,jobs:{...state.jobs,[key]:{...current,outputPath:destination}}});
      });
      if(!single&&!state.jobs[key].companionsDone){
        await copyCompanions(source,destination,new Set(initial.flatMap(g=>g.parts)));
        await serialize(()=>save({...state,jobs:{...state.jobs,[key]:{...state.jobs[key],companionsDone:true}}}));
      }
      const done=new Set(),consumed=new Map(),passes=single?3:2;
      manager.updateExtractionProgress(0,true);
      for(let pass=0;pass<passes;pass++){
        const files=pass===0?initial:await archiveGroups(destination),selected=files.filter(g=>!done.has(g.archive));
        for(let i=0;i<selected.length;i++){
          const {archive,parts}=selected[i];await verifyOutput(targetBase,destination);await room(native,archive,destination);
          const fingerprints=await Promise.all(parts.map(async file=>{const s=await fsp.lstat(file);if(!s.isFile()||s.isSymbolicLink())throw Error('The downloaded archive could not be found.');return {file,size:s.size,mtimeMs:s.mtimeMs};}));
          const result=await native.zip.extractFile({filePath:archive,outputPath:destination,passwords:['online-fix.me','steamrip.com']},p=>manager.updateExtractionProgress((pass+(i+(p.percent||0)/100)/selected.length)/passes));
          if(!result?.success)throw Error('Extraction did not finish. The downloaded archives were kept.');
          done.add(archive);
          if(!single||pass===0)for(const f of fingerprints)consumed.set(f.file,f);
        }
      }
      if(!done.size)return false;
      // Discovery must see the destination before the native completion runs.
      // Never rewrite downloadPath/folderName: the torrent still needs them.
      await serialize(()=>save({...state,jobs:{...state.jobs,[key]:{...state.jobs[key],phase:'extracted',resultPath:destination,cleanup:[...consumed.values()]}}}));
      manager.updateExtractionProgress(1,true);await complete(key,download,manager,native);
      return true;
    }catch(e){log(e);await manager.setExtractionFailedState(e);return true;}
    finally{active.delete(key);}
  }
  return {init,status,choose,downloadEvent,extract,resolved,busy:()=>active.size>0,flush:()=>queue};
}
module.exports={createExtractPaths,validPath};
