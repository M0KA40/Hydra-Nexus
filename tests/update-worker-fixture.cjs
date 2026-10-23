'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const assert=require('node:assert/strict');
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const exec=(exe,args,options={})=>new Promise((resolve,reject)=>cp.execFile(exe,args,{windowsHide:true,timeout:30000,...options},(e,out,err)=>e?reject(Error((err||e.message)+'\n'+out)):resolve(out)));
async function fixture({broken=false}={}){
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'nexus-job-')),install=path.join(root,'Hydra'),exe=path.join(install,'NexusFixture'+(broken?'Rollback':'Restart')+'.exe'),asar=path.join(install,'resources','app.asar'),directory=path.join(root,'state');
 await fsp.mkdir(path.dirname(asar),{recursive:true});await fsp.writeFile(asar,'OLD');
 const cs=path.join(root,'fixture.cs');await fsp.writeFile(cs,'using System;using System.IO;using System.Threading;class Fixture{static void Main(string[] args){string d=AppDomain.CurrentDomain.BaseDirectory;if(args.Length>0){while(!File.Exists(Path.Combine(d,"exit.txt")))Thread.Sleep(50);}else File.AppendAllText(Path.Combine(d,"restarted.txt"),"once\\n");}}');
 await exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';Add-Type -Path ${quote(cs)} -OutputAssembly ${quote(exe)} -OutputType WindowsApplication`]);
 const exeBefore=await fsp.readFile(exe),bat=path.join(root,'fixture.bat');
 await fsp.writeFile(bat,`:: HYDRA_NEXUS_RELEASE 1.2.0\n:: HYDRA_NEXUS_REVISION 8\n:: hydra-nexus-bridge.cjs\n:: === HYDRA_SUITE_PS_START ===\nparam([switch]$LibraryOnly,[string]$HydraDir)\n$script:BuiltInPatches=@([pscustomobject]@{Id='nexus'})\nfunction Invoke-BuiltInPatch($Patch,$Operation){[IO.File]::WriteAllText((Join-Path (Join-Path $HydraDir 'resources') 'app.asar'),'${broken?'BROKEN':'NEW'}');${broken?`[IO.File]::WriteAllText((Join-Path $HydraDir '${path.basename(exe)}'),'BROKEN EXE')`:''}}\nfunction Get-PatchStatus($Patch,$Directory){return '${broken?'Broken':'Installed'}'}\n`);
 const held=cp.spawn(exe,['hold'],{windowsHide:true,stdio:'ignore'});await new Promise((resolve,reject)=>{held.once('spawn',resolve);held.once('error',reject);});
 const parent=path.join(root,'parent.cjs');
 await fsp.writeFile(parent,`const fs=require('node:fs'),{createUpdater}=require(${JSON.stringify(require.resolve('../src/updater.cjs'))}),{createUpdateShutdown}=require(${JSON.stringify(require.resolve('../src/update-shutdown.cjs'))});let approves=0;const app={getPath:()=>${JSON.stringify(exe)},quit(){throw Error('Native before-quit would hang');},exit(){fs.writeFileSync(${JSON.stringify(path.join(install,'exit.txt'))},'yes');process.exit(0);}};const shutdown=createUpdateShutdown({app,guard(){},getNative:()=>({prepare:async()=>{},close:async()=>{},reopen:async()=>{}}),flush:async()=>fs.writeFileSync(${JSON.stringify(path.join(root,'saved.txt'))},'saved')});const updater=createUpdater({directory:${JSON.stringify(directory)},version:'1.0.2',getRepository:()=>'',app,shutdown,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[${JSON.stringify(bat)}]}),showMessageBox:async()=>{approves++;if(approves>1)throw Error('Duplicate confirmation');return {response:1};}}});(async()=>{await updater.action(null,'chooseUpdate');await Promise.all([updater.action(null,'installUpdate'),updater.action(null,'installUpdate')]);})().catch(e=>{console.error(e);process.exit(1);});`);
 try{
  await exec(process.execPath,[parent]);const deadline=Date.now()+25000;
  while(Date.now()<deadline&&!fs.existsSync(path.join(install,'restarted.txt')))await delay(100);
  const active=JSON.parse(await fsp.readFile(path.join(directory,'updates','active-job.json'),'utf8')),jobdir=path.join(directory,'updates','job-'+active.id),state=JSON.parse(await fsp.readFile(path.join(jobdir,'state.json'),'utf8'));
  assert.equal(state.phase,broken?'failed':'installed',state.message);assert.equal(await fsp.readFile(asar,'utf8'),broken?'OLD':'NEW');assert.equal(await fsp.readFile(path.join(root,'saved.txt'),'utf8'),'saved');assert.equal(await fsp.readFile(path.join(install,'restarted.txt'),'utf8'),'once\n');assert.deepEqual(await fsp.readFile(exe),exeBefore);
  if(broken){assert.match(state.message,/Previous installation restored/);assert.equal(await fsp.readFile(path.join(jobdir,'recovery','app.asar'),'utf8'),'OLD');}
  assert.equal((await fsp.readdir(path.join(directory,'updates'))).filter(n=>n.startsWith('job-')).length,1,'duplicate clicks must share one persisted job');
  return {root,jobdir,asar,exe,state};
 }finally{await fsp.writeFile(path.join(install,'exit.txt'),'yes');}
}
module.exports={fixture,exec,delay};
