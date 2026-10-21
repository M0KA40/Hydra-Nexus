'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {atomicText}=require('./themes.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function newer(a,b){const parse=v=>/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null,x=parse(a),y=parse(b);if(!x||!y)return false;for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function releaseVersion(bytes){const text=bytes.toString('utf8');const version=text.match(/^:: HYDRA_NEXUS_RELEASE (\d+\.\d+\.\d+)\r?$/m)?.[1];if(!version||!text.includes(':: === HYDRA_SUITE_PS_START ===')||!text.includes('hydra-nexus-bridge.cjs'))throw Error('Choose an official Hydra Nexus BAT release');return version;}
function createUpdater({directory,version,getRepository,fetcher,app,dialog}){
  let release=null,staged=null,busy=false;const folder=path.join(directory,'updates'),job=path.join(folder,'installation-status.txt');
  const quote=s=>"'"+s.replace(/'/g,"''")+"'";
  async function download(url,max){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);try{const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/vnd.github+json','User-Agent':'Hydra-Nexus'}});if(!response.ok)throw Error(response.status===404?'No published Nexus release is available yet':'Update download failed ('+response.status+')');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Update download exceeded its size limit');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);}finally{clearTimeout(timer);}}
  async function status(){if(!staged)try{const candidate=JSON.parse(await fsp.readFile(path.join(folder,'staged.json'),'utf8'));if(typeof candidate.file==='string'&&typeof candidate.source==='string'&&/^[a-f0-9]{64}$/.test(candidate.sha256)&&path.dirname(path.resolve(candidate.file))===path.resolve(folder)){const st=await fsp.lstat(candidate.file);if(st.isFile()&&!st.isSymbolicLink()&&st.size<=8*1024*1024){const bytes=await fsp.readFile(candidate.file);if(releaseVersion(bytes)===candidate.version&&sha(bytes)===candidate.sha256)staged=candidate;}}}catch{}let installation=null;try{installation=(await fsp.readFile(job,'utf8')).slice(0,2000);}catch{}return {current:version,repository:getRepository()||null,release,staged:staged?{version:staged.version,sha256:staged.sha256,source:staged.source}:null,busy,installation};}
  async function check(){const repo=getRepository();if(!repo||!/^[-\w.]+\/[-\w.]+$/.test(repo))throw Error('The release channel is not configured yet. You can update from a local Nexus BAT file.');const data=JSON.parse((await download('https://api.github.com/repos/'+repo+'/releases/latest',1024*1024)).toString('utf8'));const asset=data.assets?.find(x=>x.name==='Hydra_Nexus.bat'),sum=data.assets?.find(x=>x.name==='SHA256SUMS.txt');const target=String(data.tag_name||'').replace(/^v/,'');if(!/^\d+\.\d+\.\d+$/.test(target)||!asset||!sum)throw Error('This release is missing its installer or checksum file');for(const item of [asset,sum])if(!String(item.browser_download_url).startsWith('https://github.com/'+repo+'/releases/download/'))throw Error('Unexpected release download location');release={version:target,newer:newer(target,version),notes:String(data.body||'').slice(0,16000),url:data.html_url,installer:asset.browser_download_url,checksums:sum.browser_download_url};return status();}
  async function stage(bytes,source,expected,expectedVersion){const target=releaseVersion(bytes),hash=sha(bytes);if(expectedVersion&&target!==expectedVersion)throw Error('The downloaded installer version does not match the release. Nothing was installed.');if(expected&&hash!==expected.toLowerCase())throw Error('The update checksum did not match. Nothing was installed.');await fsp.mkdir(folder,{recursive:true});const file=path.join(folder,'Hydra_Nexus-'+target+'-'+hash.slice(0,12)+'.bat');await atomicText(file,bytes.toString('utf8'));staged={file,version:target,sha256:hash,source};await atomicText(path.join(folder,'staged.json'),JSON.stringify(staged));return status();}
  async function install(win){if(!staged){if(!release?.newer)throw Error('Check for a newer release or choose a local Nexus BAT first');const checksums=(await download(release.checksums,64*1024)).toString('utf8'),expected=checksums.match(/^([a-f0-9]{64})\s+\*?Hydra_Nexus\.bat\r?$/im)?.[1];if(!expected)throw Error('The release checksum is missing');await stage(await download(release.installer,8*1024*1024),'GitHub: '+getRepository(),expected,release.version);}
    if(staged.source.startsWith('GitHub:')&&(staged.source!=='GitHub: '+getRepository()||(release&&staged.version!==release.version)))throw Error('The downloaded installer version does not match the release. Nothing was installed.');
    if(newer(version,staged.version))throw Error('This installer is older than your installed Nexus version. Choose a newer release.');
    const response=await dialog.showMessageBox(win,{type:'question',title:'Update Hydra Nexus',message:'Install Hydra Nexus '+staged.version+' and restart Hydra?',detail:'Source: '+staged.source+'\nSHA-256: '+staged.sha256+'\n\nSave any open work first. Hydra will exit normally, the update will install, and Hydra will reopen once. Your preferences, notes, history and game backups are preserved.',buttons:['Cancel','Install & restart'],defaultId:0,cancelId:0,noLink:true});if(response.response!==1)return {cancelled:true};
    if(sha(await fsp.readFile(staged.file))!==staged.sha256)throw Error('The staged updater changed. Choose it again.');
    const hydraExe=app.getPath('exe'),hydraDir=path.dirname(hydraExe),script=path.join(folder,'install-restart-'+staged.sha256.slice(0,12)+'.ps1');
    const ps=`$ErrorActionPreference='Stop'
$nexusManager=${quote(staged.file)}
$nexusHydraDir=${quote(hydraDir)}
$nexusHydraExe=${quote(hydraExe)}
$nexusJobStatus=${quote(job)}
$nexusExpected=${quote(staged.sha256)}
$nexusUpdatesDir=${quote(folder)}
$nexusMutex=New-Object Threading.Mutex($false,'Local\\HydraNexusInstallV1')
if(!$nexusMutex.WaitOne(0)){[IO.File]::WriteAllText($nexusJobStatus,'Another installer is active. Retry after it finishes.');exit 1}
try{
  # Retire stale Nexus workers from older releases, confined to this data directory.
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($nexusUpdatesDir) -and ($_.CommandLine.Contains('install-after-close.ps1') -or $_.CommandLine.Contains('install-restart-'))} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
  [IO.File]::WriteAllText($nexusJobStatus,'Waiting for Hydra to exit normally. Do not reopen it manually.')
  $nexusDeadline=[DateTime]::UtcNow.AddMinutes(5)
  while([DateTime]::UtcNow -lt $nexusDeadline){
    $nexusProcesses=@(Get-Process Hydra,hydralauncher -ErrorAction SilentlyContinue | Where-Object {try{$_.Path -ieq $nexusHydraExe}catch{$false}})
    if($nexusProcesses.Count){Start-Sleep -Milliseconds 500;continue}
    Start-Sleep -Seconds 1
    if(@(Get-Process Hydra,hydralauncher -ErrorAction SilentlyContinue | Where-Object {try{$_.Path -ieq $nexusHydraExe}catch{$false}}).Count){continue}
    $nexusHasher=[Security.Cryptography.SHA256]::Create();$nexusStream=[IO.File]::OpenRead($nexusManager);try{$nexusActual=[BitConverter]::ToString($nexusHasher.ComputeHash($nexusStream)).Replace('-','').ToLowerInvariant()}finally{$nexusStream.Dispose();$nexusHasher.Dispose()};if($nexusActual -cne $nexusExpected){throw 'Installer checksum changed'}
    [IO.File]::WriteAllText($nexusJobStatus,'Installing the verified update…')
    $env:HYDRA_SUITE_SELF=$nexusManager
    $nexusLines=[IO.File]::ReadAllLines($nexusManager,[Text.Encoding]::UTF8)
    $nexusMarker=[Array]::IndexOf($nexusLines,':: === HYDRA_SUITE_PS_START ===')
    if($nexusMarker -lt 0){throw 'Invalid Nexus installer'}
    . ([scriptblock]::Create([string]::Join([char]10,$nexusLines[($nexusMarker+1)..($nexusLines.Length-1)]))) -LibraryOnly -HydraDir $nexusHydraDir
    Invoke-BuiltInPatch ($script:BuiltInPatches | Where-Object Id -eq 'nexus') Install *> ${quote(path.join(folder,'installation-output.txt'))}
    $nexusPatch=$script:BuiltInPatches | Where-Object Id -eq 'nexus'
    if((Get-PatchStatus $nexusPatch $nexusHydraDir) -cne 'Installed'){throw 'Post-installation verification failed. Read installation-output.txt'}
    [IO.File]::WriteAllText($nexusJobStatus,'Hydra Nexus ${staged.version} installed successfully.')
    Remove-Item -LiteralPath ${quote(path.join(folder,'staged.json'))} -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $nexusHydraExe
    exit 0
  }
  throw 'Hydra did not exit. Finish any restore, close Hydra completely and run the local installer.'
}catch{[IO.File]::WriteAllText($nexusJobStatus,'Update needs attention: '+$_.Exception.Message);exit 1}
finally{try{$nexusMutex.ReleaseMutex()}catch{};$nexusMutex.Dispose()}
`;
    await atomicText(script,'\ufeff'+ps);await atomicText(job,'Update confirmed. Preparing a normal Hydra restart.');
    await new Promise((resolve,reject)=>{const child=cp.spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script],{windowsHide:true,detached:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
    const result=await status();setTimeout(()=>app.quit(),500).unref?.();return result;
  }

  return {action:async(win,name)=>{if(name==='updateStatus')return status();if(busy)throw Error('An update operation is already running');busy=true;try{if(name==='checkUpdates')return await check();if(name==='chooseUpdate'){const result=await dialog.showOpenDialog(win,{title:'Choose Hydra Nexus BAT',properties:['openFile'],filters:[{name:'Hydra Nexus installer',extensions:['bat']}]});if(result.canceled)return {cancelled:true};const stat=await fsp.stat(result.filePaths[0]);if(stat.size>8*1024*1024)throw Error('Installer is too large');return await stage(await fsp.readFile(result.filePaths[0]),'Local file: '+path.basename(result.filePaths[0]));}if(name==='installUpdate')return await install(win);throw Error('Unknown update action');}finally{busy=false;}}};
}
module.exports={createUpdater,newer,releaseVersion,sha};
