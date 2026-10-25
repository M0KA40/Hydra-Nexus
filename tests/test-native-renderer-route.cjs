'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'renderer-route-')),quote=s=>"'"+s.replace(/'/g,"''")+"'";
 const source=`class WindowManager {
 static async loadWindowURL(window, hash = "") {
  if(is.dev && process.env["ELECTRON_RENDERER_URL"]){window.loadURL(process.env["ELECTRON_RENDERER_URL"]+"#/"+hash);}
  else {try{await window.loadURL("https://release-v4-2-0.hydra-eqi.pages.dev#/"+hash);}catch{window.loadFile(path.join(__dirname,"../renderer/index.html"),{hash});}}
 }
}
globalThis.loadHydra=(window,hash)=>WindowManager.loadWindowURL(window,hash);`;
 const input=path.join(root,'native.cjs'),output=path.join(root,'patched.cjs');await fs.writeFile(input,source);
 const bat=await fs.readFile(path.join(__dirname,'../dist/Hydra_Nexus.bat'),'utf8'),lines=bat.split(/\r?\n/),marker=lines.indexOf(':: === HYDRA_SUITE_PS_START ==='),manager=path.join(root,'manager.ps1');await fs.writeFile(manager,'\ufeff'+lines.slice(marker+1).join('\n'));
 const ps=`$ErrorActionPreference='Stop';. ${quote(manager)} -LibraryOnly;$source=[IO.File]::ReadAllText(${quote(input)});$patched=Add-NexusWindowHook $source;if((Remove-NexusWindowHook $patched) -cne $source){throw 'Window loader cleanup changed native source'};if((Add-NexusWindowHook $patched) -cne $patched){throw 'Window loader repair duplicated hook'};[IO.File]::WriteAllText(${quote(output)},$patched);$failed=$false;try{Add-NexusWindowHook ($source.Replace('loadWindowURL(window, hash = "")','changedLoader(window, hash = "")'))|Out-Null}catch{$failed=$true};if(!$failed){throw 'Unknown loader must fail safely'}`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',ps],{windowsHide:true,timeout:30000,maxBuffer:1024*1024},(e,out,err)=>e?reject(Error(e.message+'\n'+err)):resolve()));
 const patched=await fs.readFile(output,'utf8');new vm.Script(patched);
 for(const dev of [false,true])for(const nexus of [false,true]){
  const calls=[],context={is:{dev},process:{env:{ELECTRON_RENDERER_URL:dev?'http://localhost:5173':undefined}},path,__dirname:path.join(root,'out/main'),__HYDRA_NEXUS__:nexus};vm.createContext(context);vm.runInContext(patched,context);
  const window={loadURL:async url=>calls.push(['remote',url]),loadFile:async(file,options)=>calls.push(['local',file,options.hash,options.query])};
  let release,reads=0;context.__NEXUS_BACKGROUND_STARTUP__=()=>{reads++;return new Promise(resolve=>release=resolve);};
  const loading=context.loadHydra(window,'settings');
  if(nexus&&!dev){assert.equal(calls.length,0,'renderer waits only for background settings');release(true);}
  await loading;assert.equal(calls.length,1);assert.equal(reads,nexus&&!dev?1:0);
  assert.equal(calls[0][0],nexus&&!dev?'local':'remote','Nexus must load the patched renderer, even when the CDN is reachable');
  if(nexus&&!dev){assert.equal(calls[0][1],path.join(root,'out/renderer/index.html'));assert.equal(calls[0][2],'settings');assert.equal(calls[0][3].nexusBackground,'1');
   context.__NEXUS_BACKGROUND_STARTUP__=async()=>false;await context.loadHydra(window,'library');assert.equal(calls[1][3],undefined,'no wallpaper mask when none selected');}
 }
 console.log('PASS: production Nexus selects the patched local renderer before a reachable CDN; development and absent-Nexus paths stay native; route/hash preserved; exact cleanup, stable repair and unknown-loader rejection. No Hydra session launched.');
})().catch(e=>{console.error(e);process.exitCode=1;});
