'use strict';
// Optional Playwright check: repeated injection and repeated page navigation must not
// pile up document listeners or retain the previous document's heap.
const path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright'),root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});try{
 const page=await browser.newPage(),errors=[],script=path.join(root,'src/native-ui.js');
 page.on('pageerror',e=>errors.push(e.message));
 // Installed before every document, so counts and commit dispatches are per-document.
 await page.addInitScript(()=>{
  window.__listenerCounts={};
  const add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,fn,options){
   if(this===document||this===window){const key=(this===document?'document:':'window:')+type;window.__listenerCounts[key]=(window.__listenerCounts[key]||0)+1;}
   return add.call(this,type,fn,options);
  };
  window.__commitEvents=0;
  const dispatch=EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent=function(event){if(event&&event.type==='nexus-native-commit')window.__commitEvents++;return dispatch.call(this,event);};
 });
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('HeapProfiler.enable');
 const heap=async()=>{await cdp.send('HeapProfiler.collectGarbage');return (await cdp.send('Runtime.getHeapUsage')).usedSize;};
 const load=async()=>{await page.goto('data:text/html,<html><body><main id="content"></main></body></html>');await page.addScriptTag({path:script});};
 const install=times=>page.evaluate(n=>{for(let i=0;i<n;i++)installNativeNexusCommit();return {installed:window.__nexusCommitInstalled,listeners:window.__listenerCounts};},times);

 await load();
 const repeated=await install(6);
 assert.equal(repeated.installed,true,'the commit scheduler installs once per document');
 assert.equal(repeated.listeners['document:visibilitychange'],1,'six installs register one visibilitychange listener');
 assert.ok((repeated.listeners['window:pagehide']||0)<=1,'six installs register at most one pagehide listener');

 // A burst of host commits passes through the scheduler once, not forty times.
 await page.evaluate(()=>{window.__commitEvents=0;for(let i=0;i<40;i++)window.__nexusNativeCommit();});
 await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>window.__commitEvents),1,'forty React commits produce one native commit pass');

 // Hidden windows do no work at all; showing them catches up once.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});window.__commitEvents=0;window.__nexusNativeCommit();});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__commitEvents),0,'a hidden window commits nothing');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__commitEvents),1,'becoming visible triggers exactly one catch-up commit');

 // Repeated navigation: each document starts clean, the previous one is collectable.
 let before=0;
 for(let i=1;i<=12;i++){
  await load();
  const state=await install(i%2?2:1);
  assert.equal(state.listeners['document:visibilitychange'],1,'navigation '+i+' registers one visibilitychange listener');
  assert.equal(state.listeners['document:hashchange']||0,0,'navigation '+i+' registers no navigation listener');
  if(i===4){await page.waitForTimeout(250);before=await heap();}
 }
 await page.waitForTimeout(400);
 const after=await heap(),growth=after-before;
 assert.ok(growth<10*1024*1024,'twelve navigations must not retain heap (grew '+(growth/1048576).toFixed(2)+' MB)');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,listeners:repeated.listeners,navigations:12,heapGrowthMB:Number((growth/1048576).toFixed(2))}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
