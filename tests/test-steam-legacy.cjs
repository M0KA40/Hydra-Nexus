'use strict';
// Actual legacy IPC launch path, with isolated files and fake child processes only.
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const vdf=require('../src/steam-vdf.cjs'),a='76561198000000001',b='76561198000000002';
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'steam-legacy-')),steam=path.join(root,'Steam'),appData=path.join(root,'Roaming'),file=path.join(steam,'config','loginusers.vdf'),bindingsFile=path.join(appData,'Hydra','steam-account-bindings.json');
 await fsp.mkdir(path.dirname(file),{recursive:true});await fsp.mkdir(path.dirname(bindingsFile),{recursive:true});
 const initial='"users" { "'+a+'" { "AccountName" "alpha" "MostRecent" "0" } "'+b+'" { "AccountName" "beta" "MostRecent" "1" } }';await fsp.writeFile(file,initial);
 let running=false,failWrite=false,failStart=false,failHide=false;const commands=[],spawns=[],waits=[],events=[],handlers=new Map();
 const app=new EventEmitter();app.whenReady=()=>Promise.resolve();
 const fakeCP={execFile(exe,args,options,cb){commands.push({exe,args,options});if(exe==='taskkill.exe'){events.push('kill');const wasRunning=running;running=false;return setImmediate(()=>cb(wasRunning?null:Object.assign(Error('not running'),{code:128}),''));}if(exe==='reg.exe'){if(args[0]==='add')events.push('registry');return setImmediate(()=>cb(null,args[0]==='query'?'SteamPath REG_SZ '+steam:''));}throw Error('Unexpected command '+exe);},spawn(exe,args){spawns.push({exe,args});const steamStart=exe===path.join(steam,'steam.exe');if(steamStart){running=true;events.push('steam-start');}const child=new EventEmitter();child.unref=()=>{};setImmediate(()=>child.emit((steamStart&&failStart)||(!steamStart&&failHide)?'error':'spawn',Error('simulated spawn failure')));return child;}};
 const electron={app,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},BrowserWindow:{getAllWindows:()=>[]}};
 const ctx={require:id=>id==='./native-tools.cjs'?{run:async action=>{spawns.push({exe:'NexusNative.exe',args:[action]});if(failHide)throw Error('simulated native hide failure');return '';}}:id==='./game-actions.js'?require('../src/game-actions.js'):id==='./i18n.cjs'?require('../src/i18n.cjs'):id==='electron'?electron:id==='child_process'?fakeCP:id==='./steam-vdf.cjs'?vdf:id==='./steam-ui.js'?require('../src/steam-ui.js'):id==='./themes.cjs'?{atomicText:async(...args)=>{events.push('write');if(failWrite)throw Error('disk full');return require('../src/themes.cjs').atomicText(...args);}}:require(id),process:{platform:'win32',env:{APPDATA:appData}},console:{log(){}},Buffer,setTimeout:(fn,ms,...args)=>{waits.push(ms);return setTimeout(fn,0,...args);},clearTimeout,global:null};ctx.global=ctx;vm.createContext(ctx);vm.runInContext(await fsp.readFile(path.join(__dirname,'../src/steam.cjs'),'utf8'),ctx);await new Promise(r=>setImmediate(r));
 let nativeLaunches=0;electron.ipcMain.handle('openGame',async()=>{events.push('native-launch');return ++nativeLaunches;});
 async function launch(id=a,mode='online',exe=''){await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode,steamId64:id,accountName:id===a?'alpha':'beta'}}));return handlers.get('openGame')({},'steam','777',exe);}
 await launch();assert.equal(nativeLaunches,1);assert.equal(vdf.accountList(await fsp.readFile(file,'utf8')).find(x=>x.steamId64===a).mostRecent,true);assert.equal(await fsp.readFile(file+'.hydra.bak','utf8'),initial);assert.ok(events.indexOf('kill')<events.indexOf('write'));assert.ok(events.indexOf('write')<events.indexOf('steam-start'));assert.ok(events.indexOf('steam-start')<events.indexOf('native-launch'));assert.ok(waits.includes(4500));
 await launch(a);assert.equal(nativeLaunches,2);assert.ok(waits.includes(1800),'legacy forced exit delay when client was running');
 await launch(b,'offline');let accounts=vdf.accountList(await fsp.readFile(file,'utf8'));assert.equal(accounts.find(x=>x.steamId64===b).mostRecent,true);assert.equal(accounts.find(x=>x.steamId64===b).wantsOffline,true);assert.equal(accounts.find(x=>x.steamId64===a).mostRecent,false);
 const count=spawns.length;await launch(a,'online','C:\\Games\\game.exe');const custom=spawns.slice(count).find(c=>c.exe===path.join(steam,'steam.exe'));assert.deepEqual(Array.from(custom.args),['-silent','-nochatui','-nofriendsui']);
 const before=commands.length;await launch(a,'crack');assert.equal(commands.length,before,'standalone leaves Steam alone');
 const killCommands=commands.filter(c=>c.exe==='taskkill.exe');assert.equal(killCommands.length,4);for(const c of killCommands)assert.equal(JSON.stringify(c.args),JSON.stringify(['/F','/IM','steam.exe','/T']));
 assert.equal(commands.some(c=>c.exe==='powershell.exe'),false,'no new process-status or account-verification polling');
 assert.ok(spawns.some(p=>p.exe==='NexusNative.exe'&&p.args[0]==='hide-steam'),'native one-shot Steam window hide restored');
 assert.ok(commands.some(c=>c.args.includes('AutoLoginUser')&&c.args.includes('beta')));assert.ok(spawns.some(c=>c.args.includes('-applaunch')&&c.args.includes('777')));
 const nativeBefore=nativeLaunches;failWrite=true;await assert.rejects(launch(),/disk full/);assert.equal(nativeLaunches,nativeBefore);failWrite=false;await assert.rejects(launch('76561198000000003'),/not found/);assert.equal(nativeLaunches,nativeBefore);
 failStart=true;await assert.rejects(launch(),/simulated spawn failure/);assert.equal(nativeLaunches,nativeBefore,'failed Steam startup must not launch the game');failStart=false;failHide=true;await launch();await new Promise(r=>setImmediate(r));assert.equal(nativeLaunches,nativeBefore+1,'optional window-hide failure must not crash or repeat the launch');failHide=false;
 // Existing desktop links call the native run handler, without going through IPC.
 ctx.__HYDRA_NEXUS_ENABLED__=()=>true;
 let directLaunches=0;const options={shop:'steam',objectId:'777',executablePath:'C:\\Games\\game.exe',launchOptions:'--saved'};
 const direct=()=>ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async received=>{assert.equal(received,options);events.push('direct-native');directLaunches++;return 'launched';},options);
 await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode:'offline',steamId64:b,accountName:'beta'}}));events.length=0;waits.length=0;
 assert.equal(await direct(),'launched');assert.equal(directLaunches,1);
 assert.ok(events.indexOf('steam-start')<events.indexOf('direct-native'));assert.ok(waits.includes(1800)&&waits.includes(4500),'shortcut awaits the complete existing switch, including both delays');
 accounts=vdf.accountList(await fsp.readFile(file,'utf8'));assert.equal(accounts.find(x=>x.steamId64===b).wantsOffline,true);
 await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode:'online',steamId64:a,accountName:'alpha'}}));await direct();
 accounts=vdf.accountList(await fsp.readFile(file,'utf8'));assert.equal(accounts.find(x=>x.steamId64===a).mostRecent,true);assert.equal(accounts.find(x=>x.steamId64===a).wantsOffline,false,'old shortcut reads latest binding on each launch');
 const beforeDirect=commands.length;ctx.__HYDRA_NEXUS_ENABLED__=()=>false;await direct();assert.equal(commands.length,beforeDirect,'disabled plugin passes through');ctx.__HYDRA_NEXUS_ENABLED__=()=>true;
 await fsp.writeFile(bindingsFile,'{}');await direct();assert.equal(commands.length,beforeDirect,'unbound native shortcut passes through');
 await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode:'online',steamId64:a}}));options.shop='gog';await direct();assert.equal(commands.length,beforeDirect,'other store ID does not select Steam binding');options.shop='steam';
 const beforeFail=directLaunches;failStart=true;await assert.rejects(direct(),/simulated spawn failure/);failStart=false;assert.equal(directLaunches,beforeFail,'failed shortcut preparation cannot launch game');
 ctx.__NEXUS_STORAGE_BUSY__=()=>true;const beforeMoveGuard=commands.length;await assert.rejects(direct(),/game transfer/);assert.equal(commands.length,beforeMoveGuard);ctx.__NEXUS_STORAGE_BUSY__=()=>false;
 // Different Play/shortcut requests must not touch shared Steam state concurrently.
 await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode:'online',steamId64:a},888:{mode:'offline',steamId64:b}}));
 const fixtureTimer=ctx.setTimeout;let resumeStartup,markStartup,finishNative,markNative;
 const startupEntered=new Promise(r=>markStartup=r),nativeEntered=new Promise(r=>markNative=r),nativeGate=new Promise(r=>finishNative=r);
 ctx.setTimeout=(fn,ms,...args)=>{if(ms===4500){resumeStartup=()=>fn(...args);markStartup();return {unref(){}};}return fixtureTimer(fn,ms,...args);};
 let preparedNative=0,duplicateNative=0;
 electron.ipcMain.handle('launchGame',async()=>{markNative();await nativeGate;preparedNative++;return 'one-native-result';});
 const sameOptions={shop:'steam',objectId:'777',executablePath:'C:\Games\game.exe',launchOptions:'--same'};
 const commandStart=commands.length,spawnStart=spawns.length,oldNative=nativeLaunches;
 const firstRequest=handlers.get('launchGame')({},sameOptions);await startupEntered;
 const duplicateShortcut=ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>{duplicateNative++;},sameOptions);
 const duplicatePlay=handlers.get('openGame')({},sameOptions);
 const other=()=>ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>{duplicateNative++;},{...sameOptions,objectId:'888'});
 const beforeRejected=commands.length;
 await assert.rejects(other(),/Another Steam launch/);
 await assert.rejects(ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>{duplicateNative++;},{...sameOptions,launchOptions:'--different'}),/Another Steam launch/);
 await assert.rejects(ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>{duplicateNative++;},{...sameOptions,objectId:'999'}),/Another Steam launch/);
 ctx.__HYDRA_NEXUS_ENABLED__=()=>false;await assert.rejects(other(),/Another Steam launch/);ctx.__HYDRA_NEXUS_ENABLED__=()=>true;
 assert.equal(commands.length,beforeRejected,'rejected concurrent requests must not issue Steam commands');assert.equal(duplicateNative,0);assert.equal(nativeLaunches,oldNative);
 resumeStartup();await nativeEntered;await assert.rejects(other(),/Another Steam launch/,'lock remains held through the native callback');finishNative();
 assert.deepEqual(await Promise.all([firstRequest,duplicateShortcut,duplicatePlay]),['one-native-result','one-native-result','one-native-result']);
 ctx.setTimeout=fixtureTimer;assert.equal(preparedNative,1);assert.equal(duplicateNative,0);assert.equal(nativeLaunches,oldNative);
 assert.equal(commands.slice(commandStart).filter(c=>c.exe==='taskkill.exe').length,1);assert.equal(spawns.slice(spawnStart).filter(c=>c.exe===path.join(steam,'steam.exe')).length,1);
 // Both failure stages must release the exclusion so the user can retry.
 failStart=true;await assert.rejects(direct(),/simulated spawn failure/);failStart=false;await direct();
 await assert.rejects(ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>{throw Error('native failed');},sameOptions),/native failed/);await direct();
 // The shared native route guards Classics even when the Steam plugin is disabled.
 let classics=0;const classicOptions={shop:'launchbox',objectId:'classic-fixture'};
 const noSteamCommands=commands.length;await ctx.__NEXUS_STEAM_NATIVE_LAUNCH__(async()=>classics++,classicOptions);assert.equal(classics,1);assert.equal(commands.length,noSteamCommands);ctx.__HYDRA_NEXUS_ENABLED__=()=>true;

 // Progress stays structured and a hidden login name is never sent to the renderer.
 const progress=[];electron.BrowserWindow.getAllWindows=()=>[{isDestroyed:()=>false,webContents:{executeJavaScript:async code=>vm.runInNewContext(code,{window:{__hydraSteamShowToast:value=>progress.push(value)}})}}];
 ctx.__NEXUS_STEAM_PRIVACY__=()=>true;await fsp.writeFile(bindingsFile,JSON.stringify({777:{mode:'online',steamId64:a,accountName:'alpha',personaName:'alpha'}}));await direct();
 assert.equal(progress[0].kind,'steam-switch');assert.equal(progress[0].account,null);assert.equal(progress[0].mode,'online');assert.equal(JSON.stringify(progress).includes('alpha'),false);electron.BrowserWindow.getAllWindows=()=>[];
 const ui=await fsp.readFile(path.join(__dirname,'../src/steam-ui.js'),'utf8');assert.ok(!/hsb-force|hsb-picker-hint/.test(ui));assert.ok(ui.includes('Required for account switching')&&ui.includes('Ask which account to use each time Steam starts'));app.emit('before-quit');
 console.log('PASS: shared exclusion across IPC/shortcuts, duplicate coalescing, no queued account switches, failure cleanup, Classics restore guards. Native desktop shortcut bridge shares awaited saved-binding switching, latest settings, online/offline, disabled/unbound/store passthrough, restore/error blocking. Original forced-switch sequence and delays restored; saved accounts, online/offline, custom executable, standalone passthrough, legacy window hiding and native IPC launches; VDF safety copies and errors retained; new switching options absent; required setup reminder present. No real process commands executed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
