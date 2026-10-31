'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {atomicText}=require('./themes.cjs');
const i18n=require('./i18n.cjs');
const {matchingPack}=require('./release-localization.cjs');
// The installer carries two pinned offline engines; retain a bounded 128 MiB limit.
const MAX_INSTALLER_BYTES=128*1024*1024;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function newer(a,b){const parse=v=>/^\d+\.\d+(?:\.\d+)?$/.test(v)?v.split('.').map(Number).concat(0).slice(0,3):null,x=parse(a),y=parse(b);if(!x||!y)return false;for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}const stable=v=>v.split('.').every(part=>part==='0'||!part.startsWith('0'));return stable(a)&&!stable(b);}
function releaseVersion(bytes){return require('./exe-metadata.cjs').exeMetadata(bytes).version;}
function releaseRevision(bytes){return require('./exe-metadata.cjs').exeMetadata(bytes).revision;}
function createUpdater({directory,version,revision=1,getRepository,fetcher,app,dialog,shutdown,confirm,startupTimeoutMs=45000}){
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid installed release revision');
  dialog=i18n.localizedDialog(dialog);
  let release=null,staged=null,busy=false,pruned=false,installing=null;const folder=path.join(directory,'updates'),job=path.join(folder,'installation-status.txt');
  const jobs=require('./update-job.cjs').createUpdateJobs({folder,app,shutdown,startupTimeoutMs});
  async function pruneStaging(){try{await fsp.mkdir(folder,{recursive:true});let current=null;try{const candidate=JSON.parse(await fsp.readFile(path.join(folder,'staged.json'),'utf8'));if(typeof candidate.file==='string'){const file=path.resolve(candidate.file);if(path.dirname(file)===path.resolve(folder))current=file;}}catch{}for(const name of await fsp.readdir(folder)){const full=path.join(folder,name);if(name==='staged.json'||path.resolve(full)===current)continue;const st=await fsp.lstat(full);if(!st.isFile()||st.isSymbolicLink()||Date.now()-st.mtimeMs<7*86400000)continue;if(/^install-(?:after-close|restart-[a-f0-9]+)\.ps1$/i.test(name)||/^Hydra_Nexus-.*\.(?:bat|exe)$/i.test(name))await fsp.rm(full,{force:true}).catch(()=>{});}pruned=true;}catch{}}
  async function download(url,max,timeout=60000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json','User-Agent':'Hydra-Nexus'}});if(!response.ok)throw Error(response.status===404?'No published Nexus release is available yet':'Update download failed ('+response.status+')');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Update download exceeded its size limit');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}finally{clearTimeout(timer);}}
  async function status(){if(!pruned)await pruneStaging();if(!staged)try{const candidate=JSON.parse(await fsp.readFile(path.join(folder,'staged.json'),'utf8'));if(typeof candidate.file==='string'&&typeof candidate.source==='string'&&/^[a-f0-9]{64}$/.test(candidate.sha256)&&path.dirname(path.resolve(candidate.file))===path.resolve(folder)){const st=await fsp.lstat(candidate.file);if(st.isFile()&&!st.isSymbolicLink()&&st.size<=MAX_INSTALLER_BYTES){const bytes=await fsp.readFile(candidate.file);if(releaseVersion(bytes)===candidate.version&&sha(bytes)===candidate.sha256)staged={...candidate,revision:releaseRevision(bytes)};}}}catch{}let installation=null;try{installation=(await fsp.readFile(job,'utf8')).slice(0,2000);}catch{}return {current:version,revision,repository:getRepository()||null,release,staged:staged?{version:staged.version,revision:staged.revision||1,sha256:staged.sha256,source:staged.source}:null,busy:busy||jobs.busy(),installation:(await jobs.status())?.message||installation};}
  async function check(){const repo=getRepository();if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))throw Error('The release channel is not configured yet. You can update from a local Nexus EXE file.');const data=JSON.parse((await download('https://api.github.com/repos/'+repo+'/releases/latest',1024*1024)).toString('utf8'));if(data.draft||data.prerelease)throw Error('No published Nexus release is available yet');let exeChannel=null;const channelAsset=data.assets?.find(x=>x.name==='Hydra-Nexus-exe-release.json');if(channelAsset){const expected='https://github.com/'+repo+'/releases/download/'+data.tag_name+'/Hydra-Nexus-exe-release.json';if(channelAsset.browser_download_url!==expected)throw Error('Unexpected EXE update metadata location');exeChannel=JSON.parse((await download(expected,16384,5000)).toString('utf8'));if(exeChannel.schema!==1||!/^\d+\.\d+(?:\.\d+)?$/.test(exeChannel.version)||!Number.isSafeInteger(exeChannel.revision)||exeChannel.revision<1)throw Error('Invalid EXE update metadata');}const asset=data.assets?.find(x=>x.name==='Hydra_Nexus.exe'),sum=data.assets?.find(x=>x.name==='SHA256SUMS.txt');const target=exeChannel?.version||String(data.tag_name||'').replace(/^v/,'');if(!/^\d+\.\d+(?:\.\d+)?$/.test(target)||!asset||!sum)throw Error('This release is missing its installer or checksum file');for(const item of [asset,sum])if(!String(item.browser_download_url).startsWith('https://github.com/'+repo+'/releases/download/'))throw Error('Unexpected release download location');const remoteRevision=exeChannel?.revision||Number(String(data.body||'').match(/<!-- HYDRA_NEXUS_REVISION (\d+) -->/)?.[1]||1);if(!Number.isSafeInteger(remoteRevision)||remoteRevision<1)throw Error('Invalid internal release revision');release={version:target,revision:remoteRevision,newer:newer(target,version)||(target===version&&remoteRevision>revision),notes:String(data.body||'').slice(0,16000),url:data.html_url,installer:asset.browser_download_url,checksums:sum.browser_download_url};const notesAsset=data.assets?.find(x=>x.name==='Hydra-Nexus-'+target+'-release-notes.json');if(notesAsset&&String(notesAsset.browser_download_url).startsWith('https://github.com/'+repo+'/releases/download/'+data.tag_name+'/'))try{const pack=JSON.parse((await download(notesAsset.browser_download_url,512*1024,5000)).toString('utf8'));const localized=matchingPack(pack,target,remoteRevision);if(localized)release.translations=localized;}catch{}return status();}
  async function installedNotes(){
    const localized=matchingPack(require('./release-content.cjs'),version,revision);if(localized)return {version,revision,notes:localized.en,translations:localized};
    const repo=getRepository();if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))return null;
    const data=JSON.parse((await download('https://api.github.com/repos/'+repo+'/releases/tags/v'+version,1024*1024)).toString('utf8'));
    const remoteRevision=Number(String(data.body||'').match(/<!-- HYDRA_NEXUS_REVISION (\d+) -->/)?.[1]||1);
    if(data.draft||data.prerelease||String(data.tag_name||'').replace(/^v/,'')!==version||remoteRevision!==revision)return null;
    return {version,revision,notes:String(data.body||'').slice(0,16000)};
  }
  async function stage(bytes,source,expected,expectedVersion,expectedRevision){const target=releaseVersion(bytes),build=releaseRevision(bytes),hash=sha(bytes);if(expectedRevision&&build!==expectedRevision)throw Error('The downloaded internal revision does not match the release. Nothing was installed.');if(expectedVersion&&target!==expectedVersion)throw Error('The downloaded installer version does not match the release. Nothing was installed.');if(expected&&hash!==expected.toLowerCase())throw Error('The update checksum did not match. Nothing was installed.');await fsp.mkdir(folder,{recursive:true});const file=path.join(folder,'Hydra_Nexus-'+target+'-'+hash.slice(0,12)+'.exe');const temporary=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{await fsp.writeFile(temporary,bytes,{flag:'wx'});await fsp.rename(temporary,file);}finally{await fsp.rm(temporary,{force:true});}staged={file,version:target,revision:build,sha256:hash,source};await atomicText(path.join(folder,'staged.json'),JSON.stringify(staged));pruned=false;return status();}
  async function install(win){
    // A cached GitHub payload is never authority. Refresh the official channel
    // before installing so a withdrawn release cannot survive in staged.json.
    if(staged?.source.startsWith('GitHub:')){
      await check();
      if(staged.source!=='GitHub: '+getRepository()||staged.version!==release.version||(staged.revision||1)!==release.revision){staged=null;await fsp.rm(path.join(folder,'staged.json'),{force:true});}
    }
    if(!staged){
      if(!release)await check();
      if(!release?.newer)throw Error('Check for a newer release or choose a local Nexus EXE first');
      const checksums=(await download(release.checksums,64*1024)).toString('utf8'),expected=checksums.match(/^([a-f0-9]{64})\s+\*?Hydra_Nexus\.exe\r?$/im)?.[1];
      if(!expected)throw Error('The release checksum is missing');
      await stage(await download(release.installer,MAX_INSTALLER_BYTES,600000),'GitHub: '+getRepository(),expected,release.version,release.revision);
    }
    if(newer(version,staged.version)||(staged.version===version&&(staged.revision||1)<revision))throw Error('This installer is older than your installed Nexus version. Choose a newer release.');
    let accepted=confirm?await confirm(win,{version:staged.version,source:staged.source,sha256:staged.sha256}):null;
    if(accepted===null)accepted=(await dialog.showMessageBox(win,{type:'question',title:'Update Hydra Nexus',message:i18n.main.t('Install Hydra Nexus {version} and restart Hydra?',{version:staged.version}),detail:i18n.main.t('Source:')+' '+i18n.main.message(staged.source)+'\nSHA-256: '+staged.sha256+'\n\n'+i18n.main.t('Save any open work first. Hydra will save your data, install the verified update and reopen once.'),buttons:['Cancel','Install & restart'],defaultId:0,cancelId:0,noLink:true})).response===1;
    if(!accepted)return {cancelled:true};
    if(sha(await fsp.readFile(staged.file))!==staged.sha256)throw Error('The staged updater changed. Choose it again.');
    return jobs.install({...staged});
  }

  async function action(win,name){
    if(name==='updateStatus')return status();
    if(name==='installUpdate'&&installing)return installing;
    if(busy||jobs.busy())throw Error('An update operation is already running');
    busy=true;
    const perform=async()=>{
      await status();
      if(name==='checkUpdates')return check();
      if(name==='chooseUpdate'){
        const result=await dialog.showOpenDialog(win,{title:'Choose Hydra Nexus EXE',properties:['openFile'],filters:[{name:'Hydra Nexus installer',extensions:['exe']}]});
        if(result.canceled)return {cancelled:true};
        const stat=await fsp.lstat(result.filePaths[0]);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_INSTALLER_BYTES)throw Error('Installer is too large or is not a regular file');
        return stage(await fsp.readFile(result.filePaths[0]),'Local file: '+path.basename(result.filePaths[0]));
      }
      if(name==='installUpdate')return install(win);
      throw Error('Unknown update action');
    };
    const task=perform().finally(()=>{busy=false;if(name==='installUpdate')installing=null;});
    if(name==='installUpdate')installing=task;return task;
  }
  return {installedNotes,action,started:()=>require('./update-recovery.cjs').confirmAndPrune({folder,app,version,revision})};
}
module.exports={createUpdater,newer,releaseVersion,releaseRevision,sha};
