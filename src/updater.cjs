'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {atomicText}=require('./themes.cjs');
const i18n=require('./i18n.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function newer(a,b){const parse=v=>/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null,x=parse(a),y=parse(b);if(!x||!y)return false;for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function releaseVersion(bytes){const text=bytes.toString('utf8');const version=text.match(/^:: HYDRA_NEXUS_RELEASE (\d+\.\d+\.\d+)\r?$/m)?.[1];if(!version||!text.includes(':: === HYDRA_SUITE_PS_START ===')||!text.includes('hydra-nexus-bridge.cjs'))throw Error('Choose an official Hydra Nexus BAT release');return version;}
function releaseRevision(bytes){return Number(bytes.toString('utf8').match(/^:: HYDRA_NEXUS_REVISION (\d+)\r?$/m)?.[1]||1);}
function createUpdater({directory,version,revision=1,getRepository,fetcher,app,dialog,startupTimeoutMs=45000}){
  if(!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid installed release revision');
  dialog=i18n.localizedDialog(dialog);
  let release=null,staged=null,busy=false,pruned=false;const folder=path.join(directory,'updates'),job=path.join(folder,'installation-status.txt');
  const quote=s=>"'"+s.replace(/'/g,"''")+"'";
  async function pruneStaging(){try{await fsp.mkdir(folder,{recursive:true});let current=null;try{const candidate=JSON.parse(await fsp.readFile(path.join(folder,'staged.json'),'utf8'));if(typeof candidate.file==='string'){const file=path.resolve(candidate.file);if(path.dirname(file)===path.resolve(folder))current=file;}}catch{}for(const name of await fsp.readdir(folder)){const full=path.join(folder,name);if(name==='staged.json'||path.resolve(full)===current)continue;const st=await fsp.lstat(full);if(!st.isFile()||st.isSymbolicLink()||Date.now()-st.mtimeMs<7*86400000)continue;if(/^install-(?:after-close|restart-[a-f0-9]+)\.ps1$/i.test(name)||/^Hydra_Nexus-.*\.bat$/i.test(name))await fsp.rm(full,{force:true}).catch(()=>{});}pruned=true;}catch{}}
  async function download(url,max){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);try{const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json','User-Agent':'Hydra-Nexus'}});if(!response.ok)throw Error(response.status===404?'No published Nexus release is available yet':'Update download failed ('+response.status+')');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Update download exceeded its size limit');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}finally{clearTimeout(timer);}}
  async function status(){if(!pruned)await pruneStaging();if(!staged)try{const candidate=JSON.parse(await fsp.readFile(path.join(folder,'staged.json'),'utf8'));if(typeof candidate.file==='string'&&typeof candidate.source==='string'&&/^[a-f0-9]{64}$/.test(candidate.sha256)&&path.dirname(path.resolve(candidate.file))===path.resolve(folder)){const st=await fsp.lstat(candidate.file);if(st.isFile()&&!st.isSymbolicLink()&&st.size<=8*1024*1024){const bytes=await fsp.readFile(candidate.file);if(releaseVersion(bytes)===candidate.version&&sha(bytes)===candidate.sha256)staged={...candidate,revision:releaseRevision(bytes)};}}}catch{}let installation=null;try{installation=(await fsp.readFile(job,'utf8')).slice(0,2000);}catch{}return {current:version,revision,repository:getRepository()||null,release,staged:staged?{version:staged.version,revision:staged.revision||1,sha256:staged.sha256,source:staged.source}:null,busy,installation};}
  async function check(){const repo=getRepository();if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))throw Error('The release channel is not configured yet. You can update from a local Nexus BAT file.');const data=JSON.parse((await download('https://api.github.com/repos/'+repo+'/releases/latest',1024*1024)).toString('utf8'));const asset=data.assets?.find(x=>x.name==='Hydra_Nexus.bat'),sum=data.assets?.find(x=>x.name==='SHA256SUMS.txt');const target=String(data.tag_name||'').replace(/^v/,'');if(!/^\d+\.\d+\.\d+$/.test(target)||!asset||!sum)throw Error('This release is missing its installer or checksum file');for(const item of [asset,sum])if(!String(item.browser_download_url).startsWith('https://github.com/'+repo+'/releases/download/'))throw Error('Unexpected release download location');const remoteRevision=Number(String(data.body||'').match(/<!-- HYDRA_NEXUS_REVISION (\d+) -->/)?.[1]||1);if(!Number.isSafeInteger(remoteRevision)||remoteRevision<1)throw Error('Invalid internal release revision');release={version:target,revision:remoteRevision,newer:newer(target,version)||(target===version&&remoteRevision>revision),notes:String(data.body||'').slice(0,16000),url:data.html_url,installer:asset.browser_download_url,checksums:sum.browser_download_url};return status();}
  async function installedNotes(){
    const repo=getRepository();if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))return null;
    const data=JSON.parse((await download('https://api.github.com/repos/'+repo+'/releases/tags/v'+version,1024*1024)).toString('utf8'));
    const remoteRevision=Number(String(data.body||'').match(/<!-- HYDRA_NEXUS_REVISION (\d+) -->/)?.[1]||1);
    if(data.draft||data.prerelease||String(data.tag_name||'').replace(/^v/,'')!==version||remoteRevision!==revision)return null;
    return {version,revision,notes:String(data.body||'').slice(0,16000)};
  }
  async function stage(bytes,source,expected,expectedVersion,expectedRevision){const target=releaseVersion(bytes),build=releaseRevision(bytes),hash=sha(bytes);if(expectedRevision&&build!==expectedRevision)throw Error('The downloaded internal revision does not match the release. Nothing was installed.');if(expectedVersion&&target!==expectedVersion)throw Error('The downloaded installer version does not match the release. Nothing was installed.');if(expected&&hash!==expected.toLowerCase())throw Error('The update checksum did not match. Nothing was installed.');await fsp.mkdir(folder,{recursive:true});const file=path.join(folder,'Hydra_Nexus-'+target+'-'+hash.slice(0,12)+'.bat');await atomicText(file,bytes.toString('utf8'));staged={file,version:target,revision:build,sha256:hash,source};await atomicText(path.join(folder,'staged.json'),JSON.stringify(staged));pruned=false;return status();}
  async function install(win){if(!staged){if(!release?.newer)throw Error('Check for a newer release or choose a local Nexus BAT first');const checksums=(await download(release.checksums,64*1024)).toString('utf8'),expected=checksums.match(/^([a-f0-9]{64})\s+\*?Hydra_Nexus\.bat\r?$/im)?.[1];if(!expected)throw Error('The release checksum is missing');await stage(await download(release.installer,8*1024*1024),'GitHub: '+getRepository(),expected,release.version,release.revision);}
    if(staged.source.startsWith('GitHub:')&&(staged.source!=='GitHub: '+getRepository()||(release&&(staged.version!==release.version||(staged.revision||1)!==release.revision))))throw Error('The downloaded installer version does not match the release. Nothing was installed.');
    if(newer(version,staged.version)||(staged.version===version&&(staged.revision||1)<revision))throw Error('This installer is older than your installed Nexus version. Choose a newer release.');
    const response=await dialog.showMessageBox(win,{type:'question',title:'Update Hydra Nexus',message:i18n.main.t('Install Hydra Nexus {version} and restart Hydra?',{version:staged.version}),detail:i18n.main.t('Source:')+' '+i18n.main.message(staged.source)+'\nSHA-256: '+staged.sha256+'\n\n'+i18n.main.t('Save any open work first. Hydra will exit normally, the update will install, and Hydra will reopen once. Your preferences, notes, history and game backups are preserved.'),buttons:['Cancel','Install & restart'],defaultId:0,cancelId:0,noLink:true});if(response.response!==1)return {cancelled:true};
    if(sha(await fsp.readFile(staged.file))!==staged.sha256)throw Error('The staged updater changed. Choose it again.');
    const hydraExe=app.getPath('exe'),hydraDir=path.dirname(hydraExe),readyToken=crypto.randomUUID(),script=path.join(folder,'install-restart-'+staged.sha256.slice(0,12)+'-'+readyToken.replace(/-/g,'')+'.ps1'),ready=script+'.ready',proceed=script+'.proceed',cancel=script+'.cancel',startupLog=path.join(folder,'installation-startup.log'),startupError=path.join(folder,'installation-startup-errors.log');
    const ps=`$ErrorActionPreference='Stop'
$nexusManager=${quote(staged.file)}
$nexusHydraDir=${quote(hydraDir)}
$nexusHydraExe=${quote(hydraExe)}
$nexusProcessNames=@(${[...new Set([path.basename(hydraExe,path.extname(hydraExe)),'hydralauncher'])].map(quote).join(',')})
$nexusJobStatus=${quote(job)}
$nexusExpected=${quote(staged.sha256)}
$nexusUpdatesDir=${quote(folder)}
$nexusReady=${quote(ready)}
$nexusReadyToken=${quote(readyToken)}
$nexusProceed=${quote(proceed)}
$nexusCancel=${quote(cancel)}
$nexusMutex=$null
$nexusMutexHeld=$false
$nexusRollback=$null
$nexusTouched=$false
function Get-NexusFileHash([string]$file){$h=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($file);try{return [BitConverter]::ToString($h.ComputeHash($stream))}finally{$stream.Dispose();$h.Dispose()}}
function Restore-NexusInstallation {
  foreach($item in @(@('app.asar',(Join-Path (Join-Path $nexusHydraDir 'resources') 'app.asar')),@('Hydra.exe',$nexusHydraExe))){
    $saved=Join-Path $nexusRollback $item[0]
    if(!(Test-Path -LiteralPath $saved)){throw 'Recovery copy is missing: '+$saved}
    # A preflight failure may not have changed either file. Never replace an
    # identical archive/executable while Hydra is using it.
    if((Test-Path -LiteralPath $item[1]) -and (Get-NexusFileHash $saved) -ceq (Get-NexusFileHash $item[1])){continue}
    $temp=$item[1]+'.nexus-recovery-'+[guid]::NewGuid().ToString('N')
    [IO.File]::Copy($saved,$temp,$false)
    if(Test-Path -LiteralPath $item[1]){[IO.File]::Replace($temp,$item[1],[System.Management.Automation.Language.NullString]::Value)}else{[IO.File]::Move($temp,$item[1])}
    if((Get-NexusFileHash $saved) -cne (Get-NexusFileHash $item[1])){throw 'Recovery verification failed: '+$item[1]}
  }
}
try{
  $nexusMutex=New-Object Threading.Mutex($false,'Local\\HydraNexusInstallV1')
  $nexusMutexHeld=$nexusMutex.WaitOne(0)
  if(!$nexusMutexHeld){throw 'Another installer is active. Retry after it finishes.'}
  # Do not put optional WMI discovery on the readiness path. The mutex owns
  # installation exclusion; each attempt has its own approval/cancellation token.
  if(Test-Path -LiteralPath $nexusCancel){throw 'Update cancelled before installation.'}
  [IO.File]::WriteAllText($nexusJobStatus,'Waiting for Hydra to exit normally. Do not reopen it manually.')
  [IO.File]::WriteAllText($nexusReady,$nexusReadyToken)
  $nexusApprovalDeadline=[DateTime]::UtcNow.AddSeconds(60)
  while($true){
    if(Test-Path -LiteralPath $nexusCancel){throw 'Update cancelled before installation.'}
    if((Test-Path -LiteralPath $nexusProceed) -and [IO.File]::ReadAllText($nexusProceed).Trim() -ceq $nexusReadyToken){break}
    if([DateTime]::UtcNow -ge $nexusApprovalDeadline){throw 'Update cancelled before installation.'}
    Start-Sleep -Milliseconds 100
  }
  $nexusDeadline=[DateTime]::UtcNow.AddMinutes(5)
  while([DateTime]::UtcNow -lt $nexusDeadline){
    if(Test-Path -LiteralPath $nexusCancel){throw 'Update cancelled before installation.'}
    # Match the installer's own exclusion rule, including other Hydra instances.
    $nexusProcesses=@(Get-Process -Name $nexusProcessNames -ErrorAction SilentlyContinue)
    if($nexusProcesses.Count){Start-Sleep -Milliseconds 500;continue}
    Start-Sleep -Seconds 1
    if(@(Get-Process -Name $nexusProcessNames -ErrorAction SilentlyContinue).Count){continue}
    $nexusHasher=[Security.Cryptography.SHA256]::Create();$nexusStream=[IO.File]::OpenRead($nexusManager);try{$nexusActual=[BitConverter]::ToString($nexusHasher.ComputeHash($nexusStream)).Replace('-','').ToLowerInvariant()}finally{$nexusStream.Dispose();$nexusHasher.Dispose()};if($nexusActual -cne $nexusExpected){throw 'Installer checksum changed'}
    [IO.File]::WriteAllText($nexusJobStatus,'Installing the verified update…')
    $env:HYDRA_SUITE_SELF=$nexusManager
    $nexusLines=[IO.File]::ReadAllLines($nexusManager,[Text.Encoding]::UTF8)
    $nexusMarker=[Array]::IndexOf($nexusLines,':: === HYDRA_SUITE_PS_START ===')
    if($nexusMarker -lt 0){throw 'Invalid Nexus installer'}
    . ([scriptblock]::Create([string]::Join([char]10,$nexusLines[($nexusMarker+1)..($nexusLines.Length-1)]))) -LibraryOnly -HydraDir $nexusHydraDir
    $nexusRollback=Join-Path $nexusUpdatesDir ('rollback-'+[guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($nexusRollback)|Out-Null
    [IO.File]::Copy((Join-Path (Join-Path $nexusHydraDir 'resources') 'app.asar'),(Join-Path $nexusRollback 'app.asar'),$false)
    [IO.File]::Copy($nexusHydraExe,(Join-Path $nexusRollback 'Hydra.exe'),$false)
    if(Test-Path -LiteralPath $nexusCancel){throw 'Update cancelled before installation.'}
    if(@(Get-Process -Name $nexusProcessNames -ErrorAction SilentlyContinue).Count){continue}
    $nexusTouched=$true
    Invoke-BuiltInPatch ($script:BuiltInPatches | Where-Object Id -eq 'nexus') Install *> ${quote(path.join(folder,'installation-output.txt'))}
    $nexusPatch=$script:BuiltInPatches | Where-Object Id -eq 'nexus'
    if((Get-PatchStatus $nexusPatch $nexusHydraDir) -cne 'Installed'){throw 'Post-installation verification failed. Read installation-output.txt'}
    [IO.File]::WriteAllText($nexusJobStatus,'Hydra Nexus ${staged.version} installed successfully.')
    Start-Process -FilePath $nexusHydraExe -WorkingDirectory $nexusHydraDir -WindowStyle Hidden
    $nexusTouched=$false
    Remove-Item -LiteralPath ${quote(path.join(folder,'staged.json'))} -Force -ErrorAction SilentlyContinue
    exit 0
  }
  throw 'Hydra did not exit. Finish any restore, close Hydra completely and run the local installer.'
}catch{
  $failure=$_.Exception.Message
  if($nexusTouched){try{Restore-NexusInstallation;$failure+=' Previous installation restored; recovery copies: '+$nexusRollback}catch{$failure+=' ROLLBACK NEEDS ATTENTION: '+$_.Exception.Message+' Recovery copies: '+$nexusRollback}}
  [IO.File]::WriteAllText($nexusJobStatus,'Update needs attention: '+$failure);exit 1
}
finally{if($nexusMutexHeld){try{$nexusMutex.ReleaseMutex()}catch{}};if($nexusMutex){$nexusMutex.Dispose()}}
`;
    await atomicText(script,'\ufeff'+ps);await fsp.rm(ready,{force:true});await atomicText(job,'Update confirmed. Preparing a normal Hydra restart.');
    // Windows PowerShell can exit without executing -File when started detached.
    // Start-Process gives the worker its own Windows lifetime. The short bootstrap
    // runs without Node's detached flag; readiness comes from the worker itself.
    const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    const bootstrap="$ErrorActionPreference='Stop';Start-Process -WindowStyle Hidden -FilePath "+quote(powershell)+" -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"+quote('"'+script+'"')+") -RedirectStandardOutput "+quote(startupLog)+" -RedirectStandardError "+quote(startupError);
    const output=await fsp.open(path.join(folder,'installation-bootstrap.log'),'w');let child;
    try{
      await new Promise((resolve,reject)=>{let settled=false,timer;const deadline=Date.now()+startupTimeoutMs,finish=error=>{if(settled)return;settled=true;clearTimeout(timer);child?.removeListener('exit',exited);if(error){try{child?.kill();}catch{}reject(error);}else{child.unref();resolve();}};
        const failed=error=>finish(error),exited=code=>{if(code!==0)finish(Error('The update helper exited before it was ready (code '+code+'). See '+startupError));};
        const poll=async()=>{if(settled)return;if(Date.now()>=deadline)return finish(Error('The update helper did not become ready. Hydra was kept open. See '+startupError));try{if((await fsp.readFile(ready,'utf8')).trim()===readyToken)return finish();}catch{}if(!settled)timer=setTimeout(poll,100);};
        child=cp.spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(bootstrap,'utf16le').toString('base64')],{windowsHide:true,detached:false,stdio:['ignore',output.fd,output.fd]});
        child.once('error',failed);child.once('exit',exited);child.once('spawn',poll);
      });
      const result=await status();await atomicText(proceed,readyToken);setTimeout(()=>app.quit(),500).unref?.();return result;
    }catch(error){await atomicText(cancel,readyToken);await atomicText(job,'Update needs attention: '+error.message);throw error;}finally{await output.close();}
  }

  return {installedNotes,action:async(win,name)=>{if(name==='updateStatus')return status();if(busy)throw Error('An update operation is already running');busy=true;try{if(name==='checkUpdates')return await check();if(name==='chooseUpdate'){const result=await dialog.showOpenDialog(win,{title:'Choose Hydra Nexus BAT',properties:['openFile'],filters:[{name:'Hydra Nexus installer',extensions:['bat']}]});if(result.canceled)return {cancelled:true};const stat=await fsp.stat(result.filePaths[0]);if(stat.size>8*1024*1024)throw Error('Installer is too large');return await stage(await fsp.readFile(result.filePaths[0]),'Local file: '+path.basename(result.filePaths[0]));}if(name==='installUpdate')return await install(win);throw Error('Unknown update action');}finally{busy=false;}}};
}
module.exports={createUpdater,newer,releaseVersion,releaseRevision,sha};
