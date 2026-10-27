'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),cp=require('node:child_process'),{EventEmitter}=require('node:events');
const {createUpdater}=require('../src/updater.cjs');
(async()=>{
 const quote=s=>"'"+s.replace(/'/g,"''")+"'";
 const root=await fsp.mkdtemp(path.join(__dirname,'update-rollback-')),install=path.join(root,'Hydra'),exe=path.join(install,'NexusRollbackFixture.exe'),asar=path.join(install,'resources','app.asar');await fsp.mkdir(path.dirname(asar),{recursive:true});await fsp.writeFile(exe,'PREVIOUS EXE');await fsp.writeFile(asar,'PREVIOUS ARCHIVE');
 const installer=path.join(root,'fixture.bat');await fsp.writeFile(installer,`:: HYDRA_NEXUS_RELEASE 1.0.1
:: HYDRA_NEXUS_REVISION 1
:: hydra-nexus-bridge.cjs
:: === HYDRA_SUITE_PS_START ===
param([switch]$LibraryOnly,[string]$HydraDir)
$script:BuiltInPatches=@([pscustomobject]@{Id='nexus'})
function Invoke-BuiltInPatch($Patch,$Operation){[IO.File]::WriteAllText((Join-Path (Join-Path $HydraDir 'resources') 'app.asar'),'BROKEN ARCHIVE');[IO.File]::WriteAllText((Join-Path $HydraDir 'NexusRollbackFixture.exe'),'BROKEN EXE')}
function Get-PatchStatus($Patch,$Directory){return 'Broken'}
`);
 await require('./update-worker-fixture.cjs').fixture({broken:true});
 const base=await fsp.readFile(path.join(__dirname,'../installer/installer-base.bat'),'utf8'),csharp=base.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/)[1],source=path.join(root,'asar-helper.cs');await fsp.writeFile(source,csharp);
 const binary=Buffer.alloc(160),marker=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');marker.copy(binary,16);binary[16+marker.length]=1;binary[17+marker.length]=9;for(let i=0;i<9;i++)binary[18+marker.length+i]=49;const fixtureExe=path.join(root,'fuse-fixture.exe');await fsp.writeFile(fixtureExe,binary);
 const ps=`$ErrorActionPreference='Stop';Add-Type -ReferencedAssemblies ([System.Management.Automation.PSObject].Assembly.Location) -Path ${quote(source)};[HydraSuiteAsar]::EnableModifiedAsar(${quote(fixtureExe)})|Out-Null`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:20000},(e)=>e?reject(e):resolve()));const modified=await fsp.readFile(fixtureExe);assert.equal(modified[18+marker.length+4],48);assert.equal(modified[18+marker.length+5],49);assert.ok(fs.existsSync(fixtureExe+'.before-hydra-suite.bak'));
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop';Add-Type -ReferencedAssemblies ([System.Management.Automation.PSObject].Assembly.Location) -Path ${quote(source)};if(![HydraSuiteAsar]::RestoreOriginalFuses(${quote(fixtureExe)})){throw 'Fuses not restored'}`],{windowsHide:true,timeout:20000},(e)=>e?reject(e):resolve()));assert.deepEqual(await fsp.readFile(fixtureExe),binary);
 console.log('PASS: fixed update worker rolls back a failed installation, retains verified recovery, reopens once; fuse restoration preserves original bytes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
