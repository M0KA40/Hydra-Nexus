'use strict';
// Regression tests for loginusers.vdf surgery, Steam privacy redaction with a cold account
// cache, and failed binding-save feedback. No real Steam files are touched: every fixture
// lives under a throwaway directory inside tests/.
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const vdf=require('../src/steam-vdf.cjs');
const targetId='76561198000000001',otherId='76561198000000002';
const sampleVdf=String.raw`"users"
{
	"`+targetId+String.raw`"
	{
		"AccountName"		"tester"
		"PersonaName"		"tester"
		"RememberPassword"		"1"
		"MostRecent"		"0"
	}
	"`+otherId+String.raw`"
	{
		"AccountName"		"second_login"
		"PersonaName"		"Weird } { \"Name\" \\"
		"MostRecent"		"1"
		"Timestamp"		"1700000000"
	}
}`;
(async()=>{
  const parsed=vdf.accountList(sampleVdf);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].accountName,'tester');
  assert.equal(parsed[1].personaName,'Weird } { "Name" \\');
  assert.equal(parsed[1].mostRecent,true);
  assert.equal(vdf.accountList('"users"\n{').length,0);
  assert.deepEqual(vdf.accountList(sampleVdf.slice(0,sampleVdf.length-40)).map(a=>a.accountName),['tester']); // truncated file keeps only complete blocks
  const nested='"users"\n{\n\t"'+targetId+'"\n\t{\n\t\t"AccountName" "a"\n\t\t"extra"\n\t\t{\n\t\t\t"key" "value"\n\t\t}\n\t}\n}';
  const nestedBlocks=vdf.scanUserBlocks(nested);
  assert.equal(nestedBlocks.length,1);
  assert.match(nestedBlocks[0].body,/"key" "value"/); // a nested object must not truncate the user block
  const rewritten=vdf.transformUserBlocks(sampleVdf,(sid,body)=>{
    if(sid!==targetId)return null;
    let next=vdf.setOrAddKey(body,'AllowAutoLogin','1');
    next=vdf.setOrAddKey(next,'WantsOfflineMode','0');
    return `"${sid}"\n\t{${next}}`;
  });
  const after=vdf.accountList(rewritten);
  assert.equal(after.length,2);
  assert.equal(after[0].accountName,'tester');
  assert.equal(after[1].personaName,'Weird } { "Name" \\'); // untouched account survives byte-for-byte
  assert.equal(vdf.field(vdf.scanUserBlocks(rewritten).find(b=>b.steamId64===targetId).body,'AllowAutoLogin'),'1');
  const added=vdf.setOrAddKey('\n\t\t"AccountName" "x"\n\t','MostRecent','1');
  assert.match(added,/"MostRecent"\t\t"1"/);
  assert.equal(vdf.transformUserBlocks('"users"\n{',()=>'"x"{}'),null); // no blocks: refuse rather than corrupt
  console.log('PASS: brace-aware VDF parsing keeps }, {, escaped quotes, nested objects and truncated tails safe; targeted rewrite preserves other accounts.');

  const root=await fsp.mkdtemp(path.join(__dirname,'steam-vdf-')),steamRoot=path.join(root,'Steam'),appData=path.join(root,'Roaming');
  await fsp.mkdir(path.join(steamRoot,'config'),{recursive:true});
  await fsp.writeFile(path.join(steamRoot,'config','loginusers.vdf'),sampleVdf);
  await fsp.mkdir(path.join(appData,'Hydra'),{recursive:true});
  await fsp.writeFile(path.join(appData,'Hydra','steam-account-bindings.json'),JSON.stringify({777:{mode:'online',steamId64:targetId,accountName:'tester',personaName:'tester',updatedAt:1}}));
  const app=new EventEmitter();app.whenReady=()=>Promise.resolve();
  const wc=new EventEmitter(),win={webContents:wc,isDestroyed:()=>false,__hsbAttached:undefined};
  const sent=[];wc.executeJavaScript=async code=>{sent.push(code);return true;};
  const handlers=new Map(),commands=[];let steamRunning=false,refusesClose=false,activeId=targetId;
  const fakeCP={execSync(){throw Error('Blocking command');},execFile(file,args,options,callback){if(typeof options==='function'){callback=options;options={};}commands.push({file,args,options});let result='';if(file==='powershell.exe')result=JSON.stringify({clients:steamRunning?[{pid:123,path:path.join(steamRoot,'steam.exe'),started:'1'}]:[],activeUser:String(BigInt(activeId)-76561197960265728n),activePid:123,preferences:{AutoLoginUser:'tester',RememberPassword:1}});else if(args[0]==='-shutdown'){if(!refusesClose)steamRunning=false;}else if(args[0]==='query')result='SteamPath REG_SZ '+steamRoot;setImmediate(()=>callback(null,result));},spawn(file,args){if(args.includes('-silent')){steamRunning=true;activeId=vdf.accountList(fs.readFileSync(path.join(steamRoot,'config','loginusers.vdf'),'utf8')).find(a=>a.mostRecent).steamId64;}const child=new EventEmitter();child.unref=()=>{};setImmediate(()=>child.emit('spawn'));return child;}};
  const failingThemes={atomicText:async()=>{throw Error('disk is full');}};
  let themes=failingThemes;
  const electron={app,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},BrowserWindow:{getAllWindows:()=>[win]}};
  const ctx={require:id=>id==='./i18n.cjs'?require('../src/i18n.cjs'):id==='electron'?electron:id==='child_process'?fakeCP:id==='./themes.cjs'?themes:id==='./steam-vdf.cjs'?vdf:id==='./steam-ui.js'?require('../src/steam-ui.js'):require(id),process:{platform:'win32',env:{APPDATA:appData}},console:{log(){}},setTimeout:(fn,ms,...args)=>setTimeout(fn,[1800,4500].includes(ms)?0:ms,...args),clearTimeout,setImmediate,Buffer,global:null};
  ctx.global=ctx;ctx.__NEXUS_STEAM_PRIVACY__=()=>true;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/steam.cjs'),'utf8'),ctx);
  await new Promise(r=>setImmediate(r));
  const toasts=()=>sent.filter(s=>s.includes('__hydraSteamShowToast')).map(s=>/window.__hydraSteamShowToast\((.*), (?:true|false)\);/.exec(s)?.[1]??'');
  const message=promise=>JSON.stringify({action:'saveBinding',payload:promise});
  wc.emit('console-message',{},0,'__HYDRA_STEAM_IPC__'+message({objectId:'777',mode:'online',steamId64:targetId,personaName:'tester'}));
  await new Promise(r=>setTimeout(r,50));
  assert.ok(toasts().some(t=>t.includes('Steam settings were not saved')&&t.includes('disk is full'))); // failure surfaces immediately, not after the 15 s UI fallback
  assert.equal(toasts().some(t=>t.includes('Settings saved')),false);
  themes=require('../src/themes.cjs');
  let launches=0;electron.ipcMain.handle('openGame',async()=>++launches);
  ctx.__NEXUS_STEAM_PRIVACY__=()=>true;
  await handlers.get('openGame')({sender:wc},'steam','777','');
  assert.equal(launches,1);
  assert.ok(toasts().some(t=>{const value=JSON.parse(t);return value.kind==='steam-switch'&&value.account===null&&value.mode==='online';}));
  assert.ok(toasts().every(t=>!String(t).includes('tester'))); // cold cache must not leak the login name
  const savedVdf=await fsp.readFile(path.join(steamRoot,'config','loginusers.vdf'),'utf8');
  const saved=vdf.accountList(savedVdf);
  assert.equal(saved.length,2);
  assert.equal(saved.find(a=>a.steamId64===targetId).mostRecent,true);
  assert.equal(saved.find(a=>a.steamId64===targetId).wantsOffline,false);
  assert.equal(saved.find(a=>a.steamId64===otherId).personaName,'Weird } { "Name" \\');
  assert.ok(await fsp.access(path.join(steamRoot,'config','loginusers.vdf.hydra.bak')).then(()=>true,()=>false)); // rollback backup kept
  ctx.__NEXUS_STEAM_PRIVACY__=()=>false;
  await handlers.get('openGame')({sender:wc},'steam','777','');
  assert.ok(toasts().some(t=>{const value=JSON.parse(t);return value.kind==='steam-switch'&&value.account==='tester'&&value.mode==='online';})); // privacy off keeps the informative label
  assert.ok(commands.every(c=>!c.options||c.options.timeout===undefined||c.options.timeout<=10000));
  const lastVdf=await fsp.readFile(path.join(steamRoot,'config','loginusers.vdf'),'utf8'),launchCount=launches;
  assert.ok(commands.some(c=>c.file==='taskkill.exe'&&JSON.stringify(c.args)===JSON.stringify(['/F','/IM','steam.exe','/T'])),'restored legacy forced switch');
  steamRunning=false;const vdfFile=path.join(steamRoot,'config','loginusers.vdf');await fsp.writeFile(vdfFile,lastVdf+'\n\"unterminated');await assert.rejects(handlers.get('openGame')({sender:wc},'steam','777',''),/Malformed|truncated/);assert.equal(launches,launchCount);assert.equal(await fsp.readFile(vdfFile,'utf8'),lastVdf+'\n\"unterminated');await fsp.writeFile(vdfFile,lastVdf);const copy=fsp.copyFile;fsp.copyFile=async(...args)=>{if(args[1]===vdfFile+'.hydra.bak')throw Error('backup disk is full');return copy(...args);};try{await assert.rejects(handlers.get('openGame')({sender:wc},'steam','777',''),/backup disk is full/);assert.equal(await fsp.readFile(vdfFile,'utf8'),lastVdf);assert.equal(launches,launchCount);}finally{fsp.copyFile=copy;}
  app.emit('before-quit');
  console.log('PASS: failed binding saves raise an immediate error toast; privacy-mode launch toast never exposes the login name even with a cold account cache; full switch preserves the exotic second account and keeps the .hydra.bak rollback.');
  await fsp.rm(root,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1});
