'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),cp=require('node:child_process'),{EventEmitter}=require('node:events');
const {createUpdater}=require('../src/updater.cjs');
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'update-rollback-')),install=path.join(root,'Hydra'),exe=path.join(install,'Hydra.exe'),asar=path.join(install,'resources','app.asar');await fsp.mkdir(path.dirname(asar),{recursive:true});await fsp.writeFile(exe,'PREVIOUS EXE');await fsp.writeFile(asar,'PREVIOUS ARCHIVE');
 const installer=path.join(root,'fixture.bat');await fsp.writeFile(installer,`:: HYDRA_NEXUS_RELEASE 1.0.1
:: HYDRA_NEXUS_REVISION 1
:: hydra-nexus-bridge.cjs
:: === HYDRA_SUITE_PS_START ===
param([switch]$LibraryOnly,[string]$HydraDir)
$script:BuiltInPatches=@([pscustomobject]@{Id='nexus'})
function Invoke-BuiltInPatch($Patch,$Operation){[IO.File]::WriteAllText((Join-Path (Join-Path $HydraDir 'resources') 'app.asar'),'BROKEN ARCHIVE');[IO.File]::WriteAllText((Join-Path $HydraDir 'Hydra.exe'),'BROKEN EXE')}
function Get-PatchStatus($Patch,$Directory){return 'Broken'}
`);
 let script;const updater=createUpdater({directory:path.join(root,'state'),version:'1.0.0',revision:1,getRepository:()=>'',fetcher(){throw Error('No network');},app:{getPath:()=>exe,quit(){}},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[installer]}),showMessageBox:async()=>({response:1})}});
 await updater.action(null,'chooseUpdate');const spawn=cp.spawn;cp.spawn=(_exe,args,options)=>{const updates=path.join(root,'state','updates');script=path.join(updates,fs.readdirSync(updates).find(name=>name.endsWith('.ps1')));assert.equal(args.at(-2),'-EncodedCommand');assert.match(Buffer.from(args.at(-1),'base64').toString('utf16le'),/Start-Process/);assert.equal(options.detached,false);assert.equal(typeof options.stdio[1],'number');const child=new EventEmitter();child.pid=123456;child.unref=()=>{};setImmediate(()=>{fs.writeFileSync(script+'.ready',fs.readFileSync(script,'utf8').match(/\$nexusReadyToken='([^']+)'/)[1]);child.emit('spawn');});return child;};try{await updater.action(null,'installUpdate');}finally{cp.spawn=spawn;}
 assert.ok(script&&fs.existsSync(script),'a live installer helper must survive updateStatus pruning');
 const run=await new Promise(resolve=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script],{windowsHide:true,timeout:20000},(error,stdout,stderr)=>resolve({error,stdout,stderr})));
 assert.equal(run.error?.code,1,JSON.stringify(run));const status=await fsp.readFile(path.join(root,'state','updates','installation-status.txt'),'utf8');assert.match(status,/Previous installation restored/);assert.equal(await fsp.readFile(exe,'utf8'),'PREVIOUS EXE');assert.equal(await fsp.readFile(asar,'utf8'),'PREVIOUS ARCHIVE');
 const rollback=(await fsp.readdir(path.join(root,'state','updates'))).find(n=>n.startsWith('rollback-'));assert.ok(rollback);assert.equal(await fsp.readFile(path.join(root,'state','updates',rollback,'Hydra.exe'),'utf8'),'PREVIOUS EXE');
 const base=await fsp.readFile(path.join(__dirname,'../installer/installer-base.bat'),'utf8'),csharp=base.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/)[1],source=path.join(root,'asar-helper.cs');await fsp.writeFile(source,csharp);
 const binary=Buffer.alloc(160),marker=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');marker.copy(binary,16);binary[16+marker.length]=1;binary[17+marker.length]=9;for(let i=0;i<9;i++)binary[18+marker.length+i]=49;const fixtureExe=path.join(root,'fuse-fixture.exe');await fsp.writeFile(fixtureExe,binary);
 const quote=s=>"'"+s.replace(/'/g,"''")+"'",ps=`$ErrorActionPreference='Stop';Add-Type -Path ${quote(source)};[HydraSuiteAsar]::EnableModifiedAsar(${quote(fixtureExe)})|Out-Null`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:20000},(e)=>e?reject(e):resolve()));const modified=await fsp.readFile(fixtureExe);assert.equal(modified[18+marker.length+4],48);assert.equal(modified[18+marker.length+5],49);assert.ok(fs.existsSync(fixtureExe+'.before-hydra-suite.bak'));
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';Add-Type -Path ${quote(source)};if(![HydraSuiteAsar]::RestoreOriginalFuses(${quote(fixtureExe)})){throw 'Fuses not restored'}`],{windowsHide:true,timeout:20000},(e)=>e?reject(e):resolve()));assert.deepEqual(await fsp.readFile(fixtureExe),binary);
 console.log('PASS: real generated PowerShell worker rolls back archive and executable after failed post-install verification; recovery copies retained; live helper preserved; synthetic Electron fuse change touches only integrity and removal restores original fuse bytes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
