'use strict';
// Same-document navigation measures retained Nexus Home state, not a fresh-page
// reload. These are isolated renderer measurements, never installed-Hydra RAM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),native=process.env.HYDRA_NATIVE_FIXTURES;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:860},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<html data-nexus-interface="quiet"><head><style>'+fs.readFileSync(path.join(native,'hydra-native.css'),'utf8')+fs.readFileSync(path.join(root,'dist/interface-colors.css'),'utf8')+'body{margin:0}#root{height:100%}.container{height:100%}.header{height:64px}.container__content{height:calc(100% - 64px);overflow:auto}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:path.join(native,'react-runtime.js')});
  await page.evaluate(()=>{
   const listeners=new Map(),add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
   EventTarget.prototype.addEventListener=function(type,fn,options){if(this===document||this===window){const key=(this===document?'d:':'w:')+type;let set=listeners.get(key);if(!set)listeners.set(key,set=new Set());set.add(fn);}return add.call(this,type,fn,options);};
   EventTarget.prototype.removeEventListener=function(type,fn,options){if(this===document||this===window)listeners.get((this===document?'d:':'w:')+type)?.delete(fn);return remove.call(this,type,fn,options);};
   window.listenerSnapshot=()=>Object.fromEntries([...listeners].map(([key,value])=>[key,value.size]).filter(([,count])=>count));
   window.__nexusI18n={language:'en',direction:'ltr',t:key=>key};window.useHydraNexusInterface=()=>{};window.useNavigate=()=>()=>{};window.buildGameDetailsPath=game=>'/game/steam/'+game.objectId;
   const game=i=>({objectId:String(i+1),shop:'steam',title:'Synthetic game '+i,libraryImageUrl:'https://image.fixture/game.svg',libraryHeroImageUrl:'https://image.fixture/game.svg',description:'Isolated resource check',genres:['Adventure']});
   window.feed={source:'Steam',featured:Array.from({length:6},(_,i)=>game(i)),sections:['new','popular','upcoming'].map((id,k)=>({id,games:Array.from({length:12},(_,i)=>game(i+k*12))}))};
   window.feedCalls=0;window.__nexusDiscovery={load:async()=>{feedCalls++;return {...feed,updatedAt:Date.now(),enriching:false};}};window.electron={getGameAssets:async()=>({libraryHeroImageUrl:'https://image.fixture/game.svg'})};
   window.app=reactDomExports.createRoot(document.getElementById('root'));
   window.render=home=>{const h=reactExports$1.createElement;app.render(h('article',{className:'container'},h('header',{className:'header'},'Hydra Nexus test fixture'),h('main',{className:'container__content'},home?h(HydraNexusDiscoveryHome):h('section',{className:'settings__container'},'Native Settings fixture'))));};
  });
  await page.route('https://image.fixture/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#30424a"/></svg>'}));
  await page.addScriptTag({path:path.join(root,'src/interface-discovery.js')});
  await page.addScriptTag({path:path.join(root,'src/native-ui.js')});
  await page.evaluate(()=>installNativeNexusCommit());
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('HeapProfiler.enable');
  const snapshot=async()=>{await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');return {heapBytes:heap.usedSize,...dom,listeners:await page.evaluate(()=>listenerSnapshot())};};
  const visit=async()=>{await page.evaluate(()=>render(true));await page.locator('.nexus-discovery-carousel').waitFor();await page.waitForTimeout(80);await page.evaluate(()=>render(false));await page.locator('.settings__container').waitFor();await page.waitForTimeout(20);};
  for(let i=0;i<5;i++)await visit();const before=await snapshot();
  for(let i=0;i<30;i++)await visit();const after=await snapshot();
  assert.deepEqual(after.listeners,before.listeners,'same-document Home navigation releases all listeners');
  assert.ok(after.heapBytes-before.heapBytes<3*1024*1024,'no large retained heap growth after 30 Home visits');
  assert.ok(after.nodes-before.nodes<1000,'no retained page trees');
  await page.evaluate(()=>{window.commitCount=0;document.addEventListener('nexus-native-commit',()=>commitCount++);for(let i=0;i<50;i++)__nexusNativeCommit();});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>commitCount),1);
  // Enrichment stops on native tray visibility even if document.hidden stays false,
  // then resumes when the native window returns.
  await page.evaluate(()=>{nexusDiscoveryMemory.clear();__nexusDiscovery.load=async()=>{feedCalls++;return {...feed,updatedAt:Date.now(),enriching:true};};__nexusWindowState={visible:false};render(true);});
  await page.locator('.nexus-discovery-carousel').waitFor();await page.waitForTimeout(150);const hiddenBefore=await page.evaluate(()=>feedCalls);await page.waitForTimeout(1700);assert.equal(await page.evaluate(()=>feedCalls),hiddenBefore);
  await page.evaluate(()=>{__nexusWindowState.visible=true;document.dispatchEvent(new Event('nexus-window-state'));});await page.waitForTimeout(1600);assert.ok(await page.evaluate(()=>feedCalls)>hiddenBefore,'native restore resumes progressive feed');
  await page.evaluate(()=>{__nexusWindowState.visible=false;document.dispatchEvent(new Event('nexus-window-state'));});
  const task=async()=>{const metrics=(await cdp.send('Performance.getMetrics')).metrics;return metrics.find(m=>m.name==='TaskDuration').value;};
  const taskBefore=await task();await page.waitForTimeout(2000);const hiddenTaskMs=(await task()-taskBefore)*1000;
  assert.deepEqual(errors,[]);
  const result={scope:'isolated native React/CSS with actual Nexus Home, same-document navigation; not installed Hydra RAM/CPU',visits:30,before,after,heapGrowthBytes:after.heapBytes-before.heapBytes,hiddenTaskMsOver2Seconds:hiddenTaskMs};
  if(process.env.HYDRA_RESOURCE_RESULTS)fs.writeFileSync(process.env.HYDRA_RESOURCE_RESULTS,JSON.stringify(result,null,2));
  console.log('PASS: '+JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
