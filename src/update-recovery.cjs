'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {plain,hashFile,atomicJson}=require('./core.cjs');
const valid=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
async function readJSON(file){await plain(file);if((await fs.stat(file)).size>65536)throw Error('Invalid recovery metadata');return JSON.parse(await fs.readFile(file,'utf8'));}
async function confirmAndPrune({folder,app,version,revision,keep=2}){
  await plain(folder);let pointer;try{pointer=await readJSON(path.join(folder,'active-job.json'));}catch{return {confirmed:false,removed:0};}
  if(pointer.schema!==2||!valid(pointer.id)||!/^([a-f0-9]{64})$/.test(pointer.token||''))return {confirmed:false,removed:0};
  const current=path.join(folder,'job-'+pointer.id);await plain(current);
  const [request,state]=await Promise.all([readJSON(path.join(current,'request.json')),readJSON(path.join(current,'state.json'))]);
  if(request.id!==pointer.id||state.id!==pointer.id||request.token!==pointer.token||state.token!==pointer.token||request.schema!==2||state.schema!==2||state.phase!=='installed'||request.version!==version||request.revision!==revision||path.resolve(request.exe)!==path.resolve(app.getPath('exe')))return {confirmed:false,removed:0};
  await atomicJson(path.join(current,'startup-confirmed.json'),{schema:1,id:request.id,version,revision,at:new Date().toISOString()});
  const candidates=[];
  for(const item of await fs.readdir(folder,{withFileTypes:true})){
    if(!item.isDirectory()||item.isSymbolicLink()||!/^job-[a-f0-9]{32}$/.test(item.name))continue;
    const dir=path.join(folder,item.name);try{
      await plain(dir);const [r,s,c]=await Promise.all(['request.json','state.json','startup-confirmed.json'].map(n=>readJSON(path.join(dir,n))));
      if(r.schema!==2||s.schema!==2||c.schema!==1||!Number.isSafeInteger(s.workerPid)||s.workerPid<=0||path.resolve(r.exe)!==path.resolve(app.getPath('exe'))||s.phase!=='installed'||r.id!==item.name.slice(4)||s.id!==r.id||c.id!==r.id||r.token!==s.token||c.version!==r.version||c.revision!==r.revision||!Number.isFinite(Date.parse(c.at)))continue;
      // Unknown files, failed jobs and running helpers are never cleanup targets.
      if((await fs.readdir(dir,{withFileTypes:true})).some(item=>item.isSymbolicLink()||!['request.json','state.json','startup-confirmed.json','worker.ps1','progress.ps1','progress-ready.json','progress.log','progress-errors.log','approved','cancel','launch-once','startup.log','startup-errors.log','installer.log','recovery'].includes(item.name)||(item.name==='recovery'?!item.isDirectory():!item.isFile())))continue;
      try{const ui=await readJSON(path.join(dir,'progress-ready.json'));if(ui.schema!==1||ui.id!==r.id||ui.token!==r.token||!Number.isInteger(ui.pid)||ui.pid<=0)continue;let visible=false;try{process.kill(ui.pid,0);visible=true;}catch{}if(visible&&r.id!==pointer.id)continue;}catch(error){if(error.code!=='ENOENT')continue;}
      let alive=false;try{process.kill(s.workerPid,0);alive=true;}catch{}if(alive&&r.id!==pointer.id)continue;
      candidates.push({dir,at:Date.parse(c.at),id:r.id});
    }catch{}
  }
  candidates.sort((a,b)=>b.at-a.at);const retained=candidates.slice(0,Math.max(2,keep));let verified=false;
  // Verify one retained rollback before deleting older successful jobs.
  for(const candidate of retained)try{const recovery=path.join(candidate.dir,'recovery');await plain(recovery);const hashes=await readJSON(path.join(recovery,'hashes.json'));if(['app.asar','Hydra.exe'].every(n=>/^[a-f0-9]{64}$/.test(hashes[n]||''))){let ok=true;for(const n of ['app.asar','Hydra.exe']){await plain(path.join(recovery,n));if(await hashFile(path.join(recovery,n))!==hashes[n])ok=false;}if(ok){verified=true;break;}}}catch{}
  let removed=0;if(verified)for(const candidate of candidates.slice(Math.max(2,keep))){if(candidate.id===pointer.id)continue;const recovery=path.join(candidate.dir,'recovery');try{await plain(recovery);if((await fs.readdir(recovery,{withFileTypes:true})).some(item=>!item.isFile()||item.isSymbolicLink()||!['app.asar','Hydra.exe','hashes.json'].includes(item.name)))continue;await plain(candidate.dir);await fs.rm(candidate.dir,{recursive:true});removed++;}catch{}}
  return {confirmed:true,removed};
}
module.exports={confirmAndPrune};
