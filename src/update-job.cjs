'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {atomicText}=require('./themes.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const terminal=new Set(['installed','failed','cancelled']);
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
function createUpdateJobs({folder,app,shutdown,startupTimeoutMs=45000}){
  const pointer=path.join(folder,'active-job.json');let active=null,operation=null,committed=false;
  async function readState(job){try{const state=JSON.parse(await fsp.readFile(path.join(folder,'job-'+job.id,'state.json'),'utf8'));return state.schema===2&&state.id===job.id&&state.token===job.token?state:null;}catch{return null;}}
  async function status(){
    if(!active)try{const p=JSON.parse(await fsp.readFile(pointer,'utf8'));if(p.schema===2&&/^[a-f0-9]{32}$/.test(p.id)&&/^[a-f0-9]{64}$/.test(p.token))active=p;}catch{}
    if(!active)return null;const state=await readState(active);
    if(state&&!terminal.has(state.phase)){
      let alive=false;try{process.kill(state.workerPid,0);alive=true;}catch{}
      if(!alive)return {...state,phase:'failed',message:'Update needs attention: The update helper stopped. Nothing else will be installed automatically.'};
    }
    return state;
  }
  async function run(staged){
    const prior=await status();if(prior&&!terminal.has(prior.phase))throw Error('An update operation is already running');
    const id=crypto.randomBytes(16).toString('hex'),token=crypto.randomBytes(32).toString('hex'),dir=path.join(folder,'job-'+id);
    await fsp.mkdir(dir,{recursive:true});
    const exe=app.getPath('exe'),request={schema:2,id,token,parentPid:process.pid,parentExe:process.execPath,exe,processNames:[...new Set([path.basename(exe,path.extname(exe)),'hydralauncher'])],installer:staged.file,sha256:staged.sha256,version:staged.version,revision:staged.revision};
    const jobFile=path.join(dir,'request.json'),workerFile=path.join(dir,'worker.ps1');
    let worker=require('./update-assets.cjs').worker;
    if(worker==='__NEXUS_UPDATE_WORKER__')worker=await fsp.readFile(path.join(__dirname,'../installer/update-worker.ps1'),'utf8');
    await atomicText(workerFile,'\ufeff'+worker);await atomicText(jobFile,JSON.stringify(request));
    active={schema:2,id,token};await atomicText(pointer,JSON.stringify(active));
    const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const stdout=path.join(dir,'startup.log'),stderr=path.join(dir,'startup-errors.log');
    // Start-Process creates an independent Windows lifetime. The fixed worker
    // acknowledges its own mutex and parent handle before data is saved or closed.
    const bootstrap="$ErrorActionPreference='Stop';Start-Process -WindowStyle Hidden -FilePath "+quote(powershell)+" -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"+quote('"'+workerFile+'"')+",'-JobFile',"+quote('"'+jobFile+'"')+") -RedirectStandardOutput "+quote(stdout)+" -RedirectStandardError "+quote(stderr);
    let launchError=null,child;
    try{
      child=cp.spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(bootstrap,'utf16le').toString('base64')],{windowsHide:true,detached:false,stdio:'ignore'});
      child.once('error',error=>{launchError=error;});child.once('exit',code=>{if(code!==0)launchError=Error('The update helper exited before it was ready (code '+code+'). See '+stderr);});child.unref();
      const deadline=Date.now()+startupTimeoutMs;
      while(true){
        if(launchError)throw launchError;
        const state=await readState(active);
        if(state?.phase==='ready')break;
        if(state?.phase==='failed')throw Error(state.message);
        if(Date.now()>=deadline)throw Error('The update helper did not become ready. Hydra was kept open. See '+stderr);
        await pause(100);
      }
      if(typeof shutdown?.prepare!=='function')throw Error('This Hydra version does not support a safe update restart. Close Hydra and run the installer.');
      const prepared=await shutdown.prepare();
      // Recheck the actual payload after potentially slow Notes/native saves.
      if(crypto.createHash('sha256').update(await fsp.readFile(staged.file)).digest('hex')!==staged.sha256)throw Error('The staged updater changed. Choose it again.');
      if((await readState(active))?.phase!=='ready')throw Error('The update helper stopped before restart. Hydra was kept open.');
      await prepared.commit(()=>atomicText(path.join(dir,'approved'),token));committed=true;
      return {current:null,busy:true,installation:'Waiting for Hydra to exit normally. Do not reopen it manually.'};
    }catch(error){
      shutdown?.cancel?.();
      await atomicText(path.join(dir,'cancel'),token);
      await atomicText(path.join(folder,'installation-status.txt'),'Update needs attention: '+error.message);
      throw error;
    }
  }
  return {status,busy:()=>!!operation||committed,install(staged){if(operation)return operation;if(committed)return Promise.resolve({busy:true});operation=run(staged).finally(()=>{operation=null;});return operation;}};
}
module.exports={createUpdateJobs};
