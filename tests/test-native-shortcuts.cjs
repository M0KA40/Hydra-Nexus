'use strict';
// Exercise the generated installer's real native-handler transform, without live Hydra.
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'native-shortcuts-')),quote=s=>"'"+s.replace(/'/g,"''")+"'";
 const source=`const getGamesRunning=()=>[];
const launchGame=async options=>nativeLaunch(options);
const unrelated=async()=>{await launchGame({shop:'gog',objectId:'other'});};
const handleRunGame = async (shop, objectId)=>{
 const game=await readGame(shop,objectId);
 if(shop==='launchbox'){await openClassicsGame(shop, objectId);return;}
 if(!game?.executablePath)return;
 await launchGame({shop,objectId,executablePath:game.executablePath,launchOptions:game.launchOptions});
};
const handleDeepLinkPath = uri=>{
 const url=new URL(uri);
 if(url.host==='run')return handleRunGame(url.searchParams.get('shop'),url.searchParams.get('objectId'));
};
globalThis.coldStart=argv=>handleDeepLinkPath(argv.find(x=>x.startsWith('hydralauncher://')));
globalThis.secondInstance=argv=>handleDeepLinkPath(argv.find(x=>x.startsWith('hydralauncher://')));
globalThis.normalPlay=unrelated;
`;
 const input=path.join(root,'native.cjs'),output=path.join(root,'patched.cjs');await fsp.writeFile(input,source);
 const bat=await fsp.readFile(path.join(__dirname,'../dist/Hydra_Nexus.bat'),'utf8'),marker=':: === HYDRA_SUITE_PS_START ===',lines=bat.split(/\r?\n/),installer=path.join(root,'manager.ps1');await fsp.writeFile(installer,'\ufeff'+lines.slice(lines.indexOf(marker)+1).join('\n'));
 const ps=`$ErrorActionPreference='Stop';. ${quote(installer)} -LibraryOnly;$p=$script:BuiltInPatches|Where-Object Id -eq 'nexus';$original=[IO.File]::ReadAllText(${quote(input)});$patched=Add-NexusNativeLaunchHooks $original;[IO.File]::WriteAllText(${quote(output)},$patched);$clean=Remove-NexusHooks $patched $p;if($clean -cne $original){throw 'Native removal changed source'};$again=Add-NexusNativeLaunchHooks $clean;if($again -cne $patched){throw 'Repair changed hook'};$bad=$original.Replace('await launchGame({shop,objectId','await differentLauncher({shop,objectId');$rejected=$false;try{Add-NexusNativeLaunchHooks $bad|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'Unsupported shortcut handler must fail safely'};$bad=$original.Replace('await openClassicsGame(shop, objectId)','await openClassicsGame(shop, objectId, changedArg)');$rejected=$false;try{Add-NexusNativeLaunchHooks $bad|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'Unsupported Classics handler must fail safely'}`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',ps],{windowsHide:true,timeout:30000,maxBuffer:1024*1024},(e,out,err)=>e?reject(Error(e.message+'\n'+err)):resolve()));
 const patched=await fsp.readFile(output,'utf8');assert.equal((patched.match(/HYDRA_NEXUS_NATIVE_LAUNCH_V1/g)||[]).length,1);assert.ok(patched.includes("await launchGame({shop:'gog',objectId:'other'})"));assert.equal((patched.match(/HYDRA_NEXUS_CLASSICS_LAUNCH_V1/g)||[]).length,1);new vm.Script(patched);
 // An already-created native URL, unchanged, works at cold start and second-instance.
 for(const entry of ['coldStart','secondInstance']){
  let release;const pending=new Promise(r=>release=r),calls=[],game={executablePath:'C:\\Games\\Current.exe',launchOptions:'--current'};
  const context={URL,readGame:async(shop,id)=>{assert.ok(['steam','launchbox'].includes(shop));assert.equal(id,'777');return game;},openClassicsGame:async(shop,objectId)=>{calls.push({classic:true,shop,objectId});},nativeLaunch:async options=>{calls.push(options);return 'native-result';},__NEXUS_STEAM_NATIVE_LAUNCH__:async(native,options)=>{await pending;return native(options);}};
  vm.createContext(context);vm.runInContext(patched,context);
  const request=context[entry](['Hydra.exe','hydralauncher://run?shop=steam&objectId=777']);await new Promise(r=>setImmediate(r));assert.equal(calls.length,0,'native game waits until Steam preparation completes');release();assert.equal(await request,undefined);assert.equal(calls.length,1);assert.equal(calls[0].executablePath,game.executablePath);assert.equal(calls[0].launchOptions,'--current');
  await context.normalPlay();assert.equal(calls.length,2,'unrelated native call remains usable');
  context.__NEXUS_STEAM_NATIVE_LAUNCH__=async()=>{throw Error('switch failed');};await assert.rejects(context[entry](['hydralauncher://run?shop=steam&objectId=777']),/switch failed/);assert.equal(calls.length,2);
  await assert.rejects(context[entry](['hydralauncher://run?shop=launchbox&objectId=777']),/switch failed/);assert.equal(calls.length,2,'Classics shortcuts must pass through the same guard');
  context.__NEXUS_STEAM_NATIVE_LAUNCH__=async(native,options)=>{assert.equal(options.shop,'launchbox');return native(options);};await context[entry](['hydralauncher://run?shop=launchbox&objectId=777']);assert.equal(calls.length,3);assert.equal(calls.at(-1).classic,true);
  delete context.__NEXUS_STEAM_NATIVE_LAUNCH__;await context[entry](['hydralauncher://run?shop=steam&objectId=777']);assert.equal(calls.length,4,'native fallback remains valid when Nexus is absent');
 }
 console.log('PASS: generated native shortcut hook, unchanged old URL, cold/warm dispatch, awaited switch, latest game data, one native launch, Classics guard and native fallback, failure blocking, unrelated calls, native fallback, exact hook removal, idempotent repair and unsupported-handler rejection. Isolated fixtures only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
