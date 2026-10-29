'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-setup-fixture-'));
const q=s=>"'"+s.replace(/'/g,"''")+"'",sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function ps(file,args=[]){return cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',file,...args],{encoding:'utf8',timeout:60000,windowsHide:true});}
try{
 const locales=require('../src/setup-copy.cjs');assert.equal(Object.keys(locales).length,9);for(const values of Object.values(locales)){assert.deepEqual(Object.keys(values),Object.keys(locales.en));assert.ok(Object.values(values).every(s=>typeof s==='string'&&s.trim()));}
 const install=path.join(dir,'Hydra & fixture');fs.mkdirSync(path.join(install,'resources'),{recursive:true});fs.writeFileSync(path.join(install,'Hydra.exe'),'SYNTHETIC');fs.writeFileSync(path.join(install,'resources/app.asar'),'OLD');
 // Fake BAT exposes the same library entrypoints; all writes stay in this fixture.
 const bat=Buffer.from(`:: === HYDRA_SUITE_PS_START ===\nparam([switch]$LibraryOnly,[string]$HydraDir)\n$script:BuiltInPatches=@([pscustomobject]@{Id='nexus'})\nfunction Invoke-BuiltInPatch($p,$action){[IO.File]::WriteAllText((Join-Path $HydraDir 'resources/app.asar'),$action)}\nfunction Get-PatchStatus($p,$directory){return 'Installed'}\n`);
 fs.writeFileSync(path.join(dir,'Hydra_Nexus.bat'),bat);fs.copyFileSync(path.join(root,'installer/setup-worker.ps1'),path.join(dir,'setup-worker.ps1'));
 fs.writeFileSync(path.join(dir,'run-worker.ps1'),`param([string]$RequestFile)\nfunction Get-Process {}\n& ${q(path.join(dir,'setup-worker.ps1'))} -RequestFile $RequestFile\nexit $LASTEXITCODE\n`);
 for(const [action,hash,phase]of [['Install',sha(bat),'complete'],['Remove',sha(bat),'complete'],['Status',sha(bat),'status'],['Install','0'.repeat(64),'failed']]){
  const job=fs.mkdtempSync(path.join(dir,'op-')),request=path.join(job,'request.json');fs.writeFileSync(request,JSON.stringify({schema:1,token:'a'.repeat(32),directory:install,action,sha256:hash}));const result=ps(path.join(dir,'run-worker.ps1'),['-RequestFile',request]);const state=JSON.parse(fs.readFileSync(path.join(job,'state.json'),'utf8'));assert.equal(state.phase,phase,JSON.stringify(state)+result.stderr);assert.equal(result.status,phase==='failed'?1:0);if(action!=='Status'&&phase!=='failed')assert.equal(fs.readFileSync(path.join(install,'resources/app.asar'),'utf8'),action);
 }
 const detect=path.join(dir,'detect.ps1');fs.writeFileSync(detect,`$ErrorActionPreference='Stop'\n. ${q(path.join(root,'installer/setup-detect.ps1'))}\n$found=Find-NexusHydra -Candidates @(${q(path.join(dir,'absent'))},${q(install)}) -RegistryRoots @() -SkipDefaults -SkipProcesses -SkipShortcuts\nif($found -cne ${q(install)}){throw 'Discovery failed'}\n`);const detected=ps(detect);assert.equal(detected.status,0,detected.stderr);
 const layout=ps(path.join(root,'tests/test-setup-layout.ps1'),['-Root',root,...(process.env.HYDRA_SETUP_LAYOUT_REPORT?['-ReportFile',process.env.HYDRA_SETUP_LAYOUT_REPORT]:[])]);assert.equal(layout.status,0,layout.stdout+layout.stderr);console.log(layout.stdout.trim());
 assert.ok(!fs.readFileSync(path.join(root,'installer/setup-window.xaml'),'utf8').includes('ScrollViewer Grid.Row="1"'));
 const kit=path.join(root,'dist/BAT-Wrapper');
 if(fs.existsSync(kit)){
  const generic=path.join(dir,'Generic Tool.bat'),asset=path.join(dir,'dependency.txt'),exe=path.join(dir,'Generic Tool.exe');fs.writeFileSync(generic,'@echo off\r\nexit /b 7\r\n');fs.writeFileSync(asset,'fixture dependency');
  const wrapped=ps(path.join(kit,'Wrap-BAT.ps1'),['-BatPath',generic,'-Output',exe,'-AssetsFolder',dir,'-Quiet']);assert.equal(wrapped.status,0,wrapped.stdout+wrapped.stderr);assert.ok(fs.statSync(exe).size>100000);
  const verify=path.join(dir,'verify-wrapper.ps1');fs.writeFileSync(verify,`$ErrorActionPreference='Stop'\nAdd-Type -AssemblyName System.IO.Compression\n$assembly=[Reflection.Assembly]::LoadFile(${q(exe)})\n$stream=$assembly.GetManifestResourceStream('payload.zip');$zip=New-Object IO.Compression.ZipArchive($stream)\nif(!$zip.GetEntry('Generic Tool.bat') -or !$zip.GetEntry('dependency.txt')){throw 'Payload paths lost'}\n$zip.Dispose();$stream.Dispose()\n`);const verified=ps(verify);assert.equal(verified.status,0,verified.stderr);
  const again=ps(path.join(kit,'Wrap-BAT.ps1'),['-BatPath',generic,'-Output',exe,'-Quiet']);assert.notEqual(again.status,0,'delivered wrappers must not be overwritten');
  console.log('PASS: standalone Windows-only builder compiled a generic BAT EXE with sibling assets and refused overwrite; no generic BAT was executed.');
 }
 console.log('PASS: standalone Install/Remove/Status dispatch; checksum rejection; isolated automatic folder detection; nine complete frontend catalogs. No real Hydra touched.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
