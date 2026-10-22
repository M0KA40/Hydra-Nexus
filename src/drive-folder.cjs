'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {atomicJson,exists,exec,plain,inside,hashFile,slug}=require('./core.cjs');
const DOWNLOAD_URL='https://www.google.com/drive/download/';
class DriveFolderSync {
  constructor({stateDir,notify=()=>{},getProtectedPaths=()=>[]}){Object.assign(this,{stateDir,notify,getProtectedPaths});this.folder=null;this.uploading=false;this.operation=null;this.controller=null;this.lastError=null;this.lastCopy=null;this.lastResult=null;this.loaded=false;this.retryAttempts=0;this.nextRetry=0;}
  async load(){
    if(this.loaded)return;
    try{const data=JSON.parse(await fsp.readFile(path.join(this.stateDir,'drive-folder.json'),'utf8'));if(data.folder!==null&&(typeof data.folder!=='string'||!path.isAbsolute(data.folder)))throw Error('Invalid Drive folder settings');this.folder=data.folder;this.lastCopy=data.lastCopy||null;this.lastResult=data.lastResult||null;this.retryAttempts=Number.isInteger(data.retryAttempts)?Math.max(0,Math.min(3,data.retryAttempts)):0;this.nextRetry=Number.isFinite(data.nextRetry)?data.nextRetry:0;this.lastError=typeof data.lastError==='string'?data.lastError:null;}catch(e){if(e.code!=='ENOENT')throw Error('Drive folder settings need attention. Choose the folder again.');}
    // The desktop client owns authentication. Nexus no longer stores or reads OAuth credentials.
    await fsp.rm(path.join(this.stateDir,'google-token.bin'),{force:true});this.loaded=true;
  }
  async save(){await atomicJson(path.join(this.stateDir,'drive-folder.json'),{folder:this.folder,lastCopy:this.lastCopy,lastResult:this.lastResult,retryAttempts:this.retryAttempts,nextRetry:this.nextRetry,lastError:this.lastError});}
  async canAutomatic(){await this.load();return !!this.folder&&this.retryAttempts<3&&Date.now()>=this.nextRetry;}
  async resetRetries(){await this.load();this.retryAttempts=0;this.nextRetry=0;this.lastError=null;await this.save();return this.status();}
  async validate(folder){
    if(typeof folder!=='string'||!path.isAbsolute(folder))throw Error('Choose a Google Drive folder first');
    const target=path.resolve(folder);if(target===path.parse(target).root||target.slice(path.parse(target).root.length).includes(':'))throw Error('Choose a folder inside My Drive, not a drive root');
    await plain(target);const stat=await fsp.stat(target);if(!stat.isDirectory())throw Error('Choose an existing folder');
    for(const protectedPath of [this.stateDir,...this.getProtectedPaths()].filter(Boolean))if(inside(target,protectedPath)||inside(protectedPath,target))throw Error('Choose a Drive folder separate from local backups, game saves and application files');
    return target;
  }
  async configure(folder){if(this.uploading)throw Error('Wait for the copy to finish');const parent=await this.validate(folder);const destination=path.join(parent,'Hydra Nexus Backups');await plain(destination);await fsp.mkdir(destination,{recursive:false}).catch(e=>{if(e.code!=='EEXIST')throw e;});await this.validate(destination);this.folder=destination;this.loaded=true;this.retryAttempts=0;this.nextRetry=0;this.lastCopy=null;this.lastResult=null;this.lastError=null;await this.save();await fsp.rm(path.join(this.stateDir,'google-token.bin'),{force:true});return this.status();}
  async disconnect(){if(this.uploading)throw Error('Wait for the copy to finish');this.folder=null;this.loaded=true;this.retryAttempts=0;this.nextRetry=0;this.lastCopy=null;this.lastResult=null;this.lastError=null;await this.save();return this.status();}
  async status(){try{await this.load();let available=false;if(this.folder)try{await this.validate(this.folder);available=true;}catch{}return {connected:!!this.folder,available,folder:this.folder,uploading:this.uploading,lastCopy:this.lastCopy,lastResult:this.lastResult,retryAttempts:this.retryAttempts,retryLimit:3,retryPaused:this.retryAttempts>=3,nextRetry:this.nextRetry,error:this.lastError||((this.folder&&!available)?'The selected Drive folder is unavailable. Start Google Drive or reconnect its drive, then retry.':null),downloadURL:DOWNLOAD_URL};}catch(e){return {connected:false,available:false,error:e.message,downloadURL:DOWNLOAD_URL};}}
  cancel(){if(!this.uploading)return false;this.controller?.abort();return true;}
  checkCancelled(){if(this.controller?.signal.aborted)throw Error('Copy cancelled. Local backups are safe.');}
  async zip(snapshot){
    const directory=path.join(this.stateDir,'uploads');await fsp.mkdir(directory,{recursive:true});const output=path.join(directory,crypto.randomUUID()+'.zip');
    const quote=s=>"'"+s.replace(/'/g,"''")+"'";
    const ps="$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;[IO.Compression.ZipFile]::CreateFromDirectory("+quote(snapshot.folder)+","+quote(output)+",[IO.Compression.CompressionLevel]::Optimal,$false)";
    try{await exec(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{signal:this.controller?.signal});return output;}catch(e){await fsp.rm(output,{force:true}).catch(()=>{});throw e;}
  }
  async uploadSnapshots(snapshots,verify,{automatic=false}={}){
    if(automatic&&!await this.canAutomatic())return {uploaded:[],paused:true};
    if(this.uploading)throw Error('A Drive copy is already running');
    this.uploading=true;this.controller=new AbortController();this.lastError=null;this.operation={kind:'upload',phase:'preparingUpload'};this.notify(this.operation);const uploaded=[];let skipped=0;
    try{
      snapshots=typeof snapshots==='function'?await snapshots():snapshots;if(!Array.isArray(snapshots)||!snapshots.length)throw Error('No game saves or unlocked achievements have been backed up yet');await this.load();await this.validate(this.folder);const folder=this.folder,receiptPath=path.join(this.stateDir,'drive-folder-receipts.json');let receipts={};try{const value=JSON.parse(await fsp.readFile(receiptPath,'utf8'));if(value&&typeof value==='object'&&!Array.isArray(value))receipts=value;}catch{}
      for(const snapshot of snapshots){
        this.checkCancelled();await this.validate(folder);await verify(snapshot.folder);if(!/^[\w-]+$/.test(snapshot.id))throw Error('Invalid recovery point identity');
        const key=snapshot.key+':'+snapshot.id,receipt=receipts[key];
        if(receipt?.folder===folder&&typeof receipt.file==='string'&&path.basename(receipt.file)===receipt.file&&/^[a-f0-9]{64}$/.test(receipt.sha256)){
          const existing=path.join(folder,receipt.file);await plain(existing);if(await exists(existing)&&await hashFile(existing)===receipt.sha256){skipped++;continue;}
        }
        this.operation={kind:'upload',phase:'uploading',game:snapshot.game.title,progress:Math.round((uploaded.length+skipped)/snapshots.length*100)};this.notify(this.operation);
        let archive,temp;
        try{
          archive=await this.zip(snapshot);this.checkCancelled();const hash=await hashFile(archive),name=slug(snapshot.game.title)+' - '+snapshot.id+' - '+hash.slice(0,12)+'.zip',target=path.join(folder,name);
          await plain(target);if(await exists(target)){if(await hashFile(target)!==hash)throw Error('A different file already uses this archive name. Rename it in Drive and retry.');}
          else{temp=path.join(folder,'.nexus-'+crypto.randomUUID()+'.partial');await pipeline(fs.createReadStream(archive),fs.createWriteStream(temp,{flags:'wx'}),{signal:this.controller.signal});if(await hashFile(temp)!==hash)throw Error('The Drive copy failed its integrity check');this.checkCancelled();await fsp.rename(temp,target);temp=null;}
          receipts[key]={folder,file:name,sha256:hash,when:new Date().toISOString()};await atomicJson(receiptPath,receipts);uploaded.push(snapshot.game.title);
        }finally{if(archive)await fsp.rm(archive,{force:true}).catch(()=>{});if(temp)await fsp.rm(temp,{force:true}).catch(()=>{});}
      }
      this.lastCopy=new Date().toISOString();this.lastResult={copied:uploaded.length,alreadyPresent:skipped,total:snapshots.length};this.retryAttempts=0;this.nextRetry=0;await this.save();this.notify({phase:'uploaded',games:uploaded.length,skipped});return {uploaded,skipped,cloudConfirmed:false};
    }catch(e){this.lastError=this.controller.signal.aborted?'Copy cancelled. Local backups are safe.':e.message;if(automatic){this.retryAttempts=Math.min(3,this.retryAttempts+1);this.nextRetry=Date.now()+300000;if(this.retryAttempts===3)this.lastError+=' Automatic copies are paused after 3 failed attempts. Retry manually or reset automatic attempts.';}else if(this.controller.signal.aborted){this.retryAttempts=3;this.nextRetry=0;}if(this.loaded)await this.save().catch(()=>{});throw Error(this.lastError);}finally{this.uploading=false;this.operation=null;this.controller=null;this.notify({phase:'idle'});}
  }
}
module.exports={DriveFolderSync,DOWNLOAD_URL};
