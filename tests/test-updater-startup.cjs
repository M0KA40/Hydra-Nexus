'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),{EventEmitter}=require('node:events');
const {createUpdater}=require('../src/updater.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'nexus-update-startup-')),install=path.join(root,'Hydra'),exe=path.join(install,'NexusUpdaterFixture.exe'),asar=path.join(install,'resources','app.asar');await fsp.mkdir(path.dirname(asar),{recursive:true});await fsp.writeFile(asar,'OLD');
 const cs=path.join(root,'fixture.cs');await fsp.writeFile(cs,`using System;using System.IO;using System.Threading;class Fixture{static void Main(string[] args){string dir=AppDomain.CurrentDomain.BaseDirectory;if(args.Length>0){while(!File.Exists(Path.Combine(dir,"exit.txt")))Thread.Sleep(50);}else File.WriteAllText(Path.Combine(dir,"restarted.txt"),"yes");}}`);
 const quote=s=>"'"+s.replace(/'/g,"''")+"'";
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';Add-Type -Path ${quote(cs)} -OutputAssembly ${quote(exe)} -OutputType WindowsApplication`],{windowsHide:true,timeout:20000},e=>e?reject(e):resolve()));
 const bat=path.join(root,'fixture.bat');await fsp.writeFile(bat,`:: HYDRA_NEXUS_RELEASE 1.0.2
:: hydra-nexus-bridge.cjs
:: === HYDRA_SUITE_PS_START ===
param([switch]$LibraryOnly,[string]$HydraDir)
$script:BuiltInPatches=@([pscustomobject]@{Id='nexus'})
function Invoke-BuiltInPatch($Patch,$Operation){[IO.File]::WriteAllText((Join-Path (Join-Path $HydraDir 'resources') 'app.asar'),'NEW')}
function Get-PatchStatus($Patch,$Directory){return 'Installed'}
`);
 let quits=0;const make=(directory,quit)=>createUpdater({directory,version:'1.0.1',getRepository:()=>'',fetcher(){throw Error('No network');},app:{getPath:()=>exe,quit},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[bat]}),showMessageBox:async()=>({response:1})}});
 const fail=make(path.join(root,'failed'),()=>quits++);await fail.action(null,'chooseUpdate');const spawn=cp.spawn;
 cp.spawn=()=>{const child=new EventEmitter();child.pid=98765;child.kill=()=>{};child.unref=()=>{};setImmediate(()=>{child.emit('spawn');child.emit('exit',1);});return child;};
 try{await assert.rejects(fail.action(null,'installUpdate'),/exited before it was ready/);}finally{cp.spawn=spawn;}
 await delay(600);assert.equal(quits,0,'failed startup must keep Hydra open');assert.equal(await fsp.readFile(asar,'utf8'),'OLD');assert.match((await fail.action(null,'updateStatus')).installation,/Update needs attention/);
 const lateDir=path.join(root,'late'),late=createUpdater({directory:lateDir,version:'1.0.1',startupTimeoutMs:100,getRepository:()=>'',app:{getPath:()=>exe,quit(){quits++;}},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[bat]}),showMessageBox:async()=>({response:1})}});await late.action(null,'chooseUpdate');
 cp.spawn=()=>{const child=new EventEmitter();child.kill=()=>{};child.unref=()=>{};setImmediate(()=>child.emit('spawn'));return child;};
 try{await assert.rejects(late.action(null,'installUpdate'),/did not become ready/);}finally{cp.spawn=spawn;}
 const lateFolder=path.join(lateDir,'updates'),active=JSON.parse(await fsp.readFile(path.join(lateFolder,'active-job.json'),'utf8')),jobdir=path.join(lateFolder,'job-'+active.id),lateScript=path.join(jobdir,'worker.ps1');
 assert.ok(fs.existsSync(path.join(jobdir,'cancel')));assert.equal(fs.existsSync(path.join(jobdir,'approved')),false);assert.doesNotMatch(await fsp.readFile(lateScript,'utf8'),/Get-CimInstance/);
 const lateExit=await new Promise(resolve=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',lateScript,'-JobFile',path.join(jobdir,'request.json')],{windowsHide:true,timeout:10000},e=>resolve(e?.code||0)));
 assert.equal(lateExit,1);assert.equal(await fsp.readFile(asar,'utf8'),'OLD');assert.equal(quits,0);assert.equal(fs.existsSync(path.join(jobdir,'recovery')),false);
 await require('./update-worker-fixture.cjs').fixture();
 console.log('PASS: real Windows helper acknowledges startup, survives its parent exiting, waits for normal app exit, installs and relaunches a fixture; early startup failure keeps the app open and records an error.');
})().catch(e=>{console.error(e);process.exitCode=1;});
