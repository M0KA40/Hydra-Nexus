'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
(async()=>{
 const directory=fs.mkdtempSync(path.join(__dirname,'media-fixture-')),source=path.join(__dirname,'../src');
 let finishTheme;const themeGate=new Promise(resolve=>finishTheme=resolve);let finishInit;const gate=new Promise(resolve=>finishInit=resolve);let registered=false,handler;
 const app=new EventEmitter();app.whenReady=()=>Promise.resolve();app.getPath=()=>directory;app.getAppPath=()=>directory;
 const wc=new EventEmitter(),win=new EventEmitter(),messages=[];let bootstrap;wc.getURL=()=> require('node:url').pathToFileURL(path.join(directory,'out/renderer/index.html')).href;wc.isLoading=()=>false;wc.send=()=>{};wc.executeJavaScript=async code=>{if(code.startsWith('window.__nexusReceive'))messages.push(JSON.parse(code.slice(code.indexOf('(')+1,-1)));else if(code.includes('function installNexusUI('))bootstrap=JSON.parse(code.slice(code.lastIndexOf(')(')+2,-1));};win.webContents=wc;win.isDestroyed=()=>false;const nativeState={focused:false,visible:false,minimized:true};win.isFocused=()=>nativeState.focused;win.isVisible=()=>nativeState.visible;win.isMinimized=()=>nativeState.minimized;
 const electron={app,BrowserWindow:{getAllWindows:()=>[win]},dialog:{},shell:{},net:{fetch:async url=>({url})},protocol:{registerSchemesAsPrivileged(){},handle(name,value){assert.equal(name,'nexus-media');registered=true;handler=value;}}};
 const themes=require('../src/themes.cjs'),brand=require('../src/brand.cjs');
 function load(id){
  if(id==='electron')return electron;
  if(id==='./activity.cjs')return {ActivityStore:class{constructor(){this.data={};}async init(){await gate;}},validKey:()=>true};
  if(id==='./themes.cjs')return {...themes,ThemeStore:class{async init(){await themeGate;}public(){return {background:{file:'fixture.webm',type:'video'}};}}};
  if(id==='./services.cjs')return {createServices:()=>({async init(){},shortcut(){}})};
  if(id==='./updater.cjs')return {createUpdater:()=>({installedNotes:async()=>({version:brand.version,revision:brand.revision,notes:'English release notes'})})};
  if(id==='./steam.cjs'||id==='./bridge.cjs')return {};
  return id.startsWith('./')?require(path.join(source,id)):require(id);
 }
 const context={require:load,process,console,Buffer,URL,Response,AbortController,setTimeout:(fn,ms,...args)=>fn.name==='automaticUpdateCheck'?{unref(){}}:setTimeout(fn,ms,...args),clearTimeout,setInterval:()=>({unref(){}}),clearInterval};context.global=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(source,'controller.cjs'),'utf8'),context);
 try{
  await new Promise(r=>setTimeout(r,20));assert.equal(registered,true,'media protocol is not blocked by theme initialization');assert.equal(bootstrap,undefined,'no empty-theme bootstrap while its settings are loading');
  let selected;const startup=context.global.__NEXUS_BACKGROUND_STARTUP__().then(value=>selected=value);await Promise.resolve();assert.equal(selected,undefined);finishTheme();await startup;assert.equal(selected,true);
  for(let i=0;i<100&&!messages.some(x=>x.event==='releaseNotes');i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(messages.some(x=>x.event==='releaseNotes'));assert.equal(registered,true,'media is ready while history/Notes initialization is still blocked');
  assert.equal(bootstrap.config.announcementUrl,'./assets/nexus-guide-invisible.webp','announcement uses the native self origin allowed by Hydra CSP');
  assert.equal(bootstrap.config.theme.background.file,'fixture.webm','saved background arrives before history initializes');
  assert.deepEqual(bootstrap.windowState,{focused:false,visible:false});
  nativeState.visible=true;nativeState.minimized=false;nativeState.focused=true;win.emit('focus');assert.deepEqual(messages.at(-1),{event:'windowState',value:{focused:true,visible:true}});
  nativeState.minimized=true;win.emit('minimize');assert.deepEqual(messages.at(-1).value,{focused:true,visible:false},'native minimize works even without renderer visibility changes');
  nativeState.minimized=false;nativeState.focused=false;win.emit('restore');assert.deepEqual(messages.at(-1).value,{focused:false,visible:true});
  nativeState.visible=false;win.emit('hide');assert.equal(messages.at(-1).value.visible,false);
  win.emit('closed');for(const event of ['focus','blur','minimize','restore','show','hide'])assert.equal(win.listenerCount(event),0,'window lifecycle listeners are removed on close');
  const asset=path.join(directory,'out/renderer/assets/nexus-guide-invisible.webp');fs.mkdirSync(path.dirname(asset),{recursive:true});fs.writeFileSync(asset,'fixture');
  assert.match((await handler({url:'nexus-media://brand/invisible-mode.png'})).url,/nexus-guide-invisible\.webp$/);
  assert.equal((await handler({url:'nexus-media://brand/unknown.png'})).status,404);
 }finally{finishTheme();finishInit();}
 console.log('PASS: announcement media is registered before notes arrive during delayed startup; fixed asset and unknown-path rejection; native window playback state at startup and focus/minimize/restore/hide events with close cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
