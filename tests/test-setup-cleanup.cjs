'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'setup-cleanup-'));
 const names=['Hydra_Nexus.bat','setup-gui.ps1','setup-worker.ps1','setup-detect.ps1','setup-copy.json','update-progress.ps1','preview-updater.ps1'];
 const run=(exe,args,options={})=>new Promise(resolve=>cp.execFile(exe,args,{windowsHide:true,timeout:30000,...options},(error,stdout,stderr)=>resolve({code:error?error.code:0,stdout,stderr})));
 try{
  const bat=Buffer.from('SYNTHETIC BAT: NEVER EXECUTED'),hash=crypto.createHash('sha256').update(bat).digest('hex');
  const source=(await fs.readFile(path.join(__dirname,'../installer/setup-launcher.cs'),'utf8')).replace('__NEXUS_ENGINE_SHA256__',hash);
  for(const scenario of ['success','failure','unexpected']){
   const folder=path.join(root,scenario),temp=path.join(folder,'Temp');await fs.mkdir(temp,{recursive:true});
   await fs.writeFile(path.join(folder,'launcher.cs'),source);
   for(const name of names)await fs.writeFile(path.join(folder,name),name==='Hydra_Nexus.bat'?bat:name==='setup-gui.ps1'?(scenario==='failure'?'exit 1':scenario==='unexpected'?'Set-Content -LiteralPath (Join-Path $PSScriptRoot "unexpected.txt") -Value "Keep me";exit 0':'exit 0'):'Synthetic resource');
   const exe=path.join(folder,'Setup.exe'),compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
   const compiled=await run(compiler,['/nologo','/target:winexe','/reference:System.Windows.Forms.dll','/out:'+exe,...names.map(name=>'/resource:'+path.join(folder,name)+','+name),path.join(folder,'launcher.cs')]);assert.equal(compiled.code,0,compiled.stdout+compiled.stderr);
   const result=await run(exe,['--preview'],{env:{...process.env,TEMP:temp,TMP:temp}});assert.equal(result.code,scenario==='failure'?1:0,result.stderr);
   const dirs=await fs.readdir(temp);if(scenario==='success')assert.equal(dirs.length,0,'successful launches leave no extracted resource directory');
   else {assert.equal(dirs.length,1);const retained=await fs.readdir(path.join(temp,dirs[0]));if(scenario==='failure')assert.ok(retained.includes('Hydra_Nexus.bat'),'failed diagnostics are preserved');else assert.deepEqual(retained,['unexpected.txt'],'only known resources are removed; unexpected content is preserved');}
  }
  console.log('PASS: actual compiled EXE removes its extracted resources only after child success; failed diagnostics and unexpected files remain; synthetic BAT never executed.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
