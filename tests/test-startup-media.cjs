'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
(async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'media-fixture-')),source=path.join(__dirname,'../src');
 let finishInit;const gate=new Promise(resolve=>finishInit=resolve);let registered=false,handler;
 const app=new EventEmitter();app.whenReady=()=>Promise.resolve();app.getPath=()=>directory;app.getAppPath=()=>directory;
 const wc=new EventEmitter(),win=new EventEmitter(),messages=[];let bootstrap;wc.getURL=()=> 'file:///C:/Hydra/out/renderer/index.html';wc.isLoading=()=>false;wc.send=()=>{};wc.executeJavaScript=async code=>{if(code.startsWith('window.__nexusReceive'))messages.push(JSON.parse(code.slice(code.indexOf('(')+1,-1)));else if(code.includes('function installNexusUI('))bootstrap=JSON.parse(code.slice(code.lastIndexOf(')(')+2,-1));};win.webContents=wc;win.isDestroyed=()=>false;
 const electron={app,BrowserWindow:{getAllWindows:()=>[win]},dialog:{},shell:{},net:{fetch:async url=>({url})},protocol:{registerSchemesAsPrivileged(){},handle(name,value){assert.equal(name,'nexus-media');registered=true;handler=value;}}};
 const themes=require('../src/themes.cjs'),brand=require('../src/brand.cjs');
 function load(id){
  if(id==='electron')return electron;
  if(id==='./activity.cjs')return {ActivityStore:class{constructor(){this.data={};}async init(){await gate;}},validKey:()=>true};
  if(id==='./themes.cjs')return {...themes,ThemeStore:class{async init(){}public(){return {};}}};
  if(id==='./services.cjs')return {createServices:()=>({async init(){},shortcut(){}})};
  if(id==='./updater.cjs')return {createUpdater:()=>({installedNotes:async()=>({version:brand.version,revision:brand.revision,notes:'English release notes'})})};
  if(id==='./steam.cjs'||id==='./bridge.cjs')return {};
  return id.startsWith('./')?require(path.join(source,id)):require(id);
 }
 const context={require:load,process,console,Buffer,URL,Response,AbortController,setTimeout:(fn,ms,...args)=>fn.name==='automaticUpdateCheck'?{unref(){}}:setTimeout(fn,ms,...args),clearTimeout,setInterval:()=>({unref(){}}),clearInterval};context.global=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(source,'controller.cjs'),'utf8'),context);
 try{
  for(let i=0;i<100&&!messages.some(x=>x.event==='releaseNotes');i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(messages.some(x=>x.event==='releaseNotes'));assert.equal(registered,true,'media is ready while history/Notes initialization is still blocked');
  assert.equal(bootstrap.config.announcementUrl,'./assets/nexus-invisible-mode.png','announcement uses the native self origin allowed by Hydra CSP');
  const asset=path.join(directory,'out/renderer/assets/nexus-invisible-mode.png');fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,'fixture');
  assert.match((await handler({url:'nexus-media://brand/invisible-mode.png'})).url,/nexus-invisible-mode\.png$/);
  assert.equal((await handler({url:'nexus-media://brand/unknown.png'})).status,404);
 }finally{finishInit();}
 console.log('PASS: announcement media is registered before notes arrive during delayed startup; fixed asset and unknown-path rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
