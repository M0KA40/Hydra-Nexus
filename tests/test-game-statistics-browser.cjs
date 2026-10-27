'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const root=path.join(__dirname,'..'),{rendererScript,catalogs}=require('../src/i18n.cjs'),themes=require('./theme-profiles.cjs'),pack={schema:1,version:'2.0.0',revision:3,notes:Object.fromEntries(Object.keys(catalogs).map(language=>[language,fs.readFileSync(path.join(root,'docs/releases/2.0.0',language+'.md'),'utf8')]))};
const nativeCSS=fs.readFileSync(process.env.HYDRA_NATIVE_CSS,'utf8'),base=`*{box-sizing:border-box}body{margin:0;display:flex;font:14px 'Segoe UI',Arial;height:100vh}.sidebar{width:190px;flex-shrink:0;padding:20px}.container{flex:1;min-width:0;display:flex;flex-direction:column}.container__content{flex:1;min-height:0;overflow:auto}.settings__container,.settings__content{display:flex;width:100%;height:100%}.settings__panel{flex:1;min-width:0;overflow:auto;padding:24px}.settings__sidebar{width:180px;display:flex;flex-direction:column}.header{display:flex;align-items:center;justify-content:space-between;min-height:64px;padding:12px 24px}.hero-panel__content{padding:30px}.hero-panel-playtime__play-time{display:flex;align-items:center}.button{color:inherit}button,select{font:inherit}.fixture-backdrop{position:fixed;inset:0;background:#0007;display:flex;align-items:center;justify-content:center;z-index:100000}.fixture-backdrop .modal{width:850px;max-width:94vw;max-height:94vh;overflow:auto;padding:24px;background:var(--fixture-surface);color:var(--fixture-text);display:flex;flex-direction:column;gap:16px;border-radius:12px}`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});let cases=0;const output=process.env.HYDRA_STATS_PREVIEW;
 if(output)fs.mkdirSync(output,{recursive:true});
 try{for(const theme of themes){
  const page=await browser.newPage({viewport:{width:1360,height:950},timezoneId:'UTC'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://nexus.test/renderer/assets/nexus-release-2.0.jpg',r=>r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'assets/promo/update-2.0.jpg'))}));
  await page.setContent('<html lang="en"><head><base href="http://nexus.test/renderer/"><style>'+nativeCSS+base+'body{background:'+theme.body+';color:'+theme.text+';--fixture-surface:'+(['light','dark-sidebar-light-content'].includes(theme.name)?'#fff':'#202124')+';--fixture-text:'+theme.text+'}.sidebar{background:'+theme.sidebar+';color:'+(theme.sideText||theme.text)+'}'+(theme.extra||'')+'</style></head><body><aside class="sidebar"><ul class="sidebar__menu"></ul></aside><div class="container"><header class="header" id="original-header">CONTROL</header><main id="original-content" class="container__content"><div class="hero-panel__content"><p class="hero-panel-playtime__play-time">Played for 9 hours</p><p>Native last played</p></div></main></div><div id="native-root"></div></body></html>');
  await page.evaluate(()=>{
   const now=new Date(),date=(offset,hour=12,minute=0)=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,hour,minute).getTime(),key=ms=>{const d=new Date(ms);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
   const sessions=Array.from({length:45},(_,i)=>({startedAt:date(0,8)+i*8*60000,durationMs:5*60000,active:false}));sessions.push({startedAt:date(-1,23,50),durationMs:20*60000,active:false},{startedAt:date(-2),durationMs:30*60000,active:false},{startedAt:date(-3),durationMs:0,active:false},{startedAt:date(-10),durationMs:30*60000,active:false,interrupted:true});
   sessions.sort((a,b)=>b.startedAt-a.startedAt);for(const s of sessions)s.endedAt=s.startedAt+s.durationMs;
   const days=new Map();for(const s of sessions){if(!s.durationMs)days.set(key(s.startedAt),days.get(key(s.startedAt))||0);let cursor=s.startedAt,end=s.endedAt;while(cursor<end){const d=new Date(cursor),next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime(),until=Math.min(end,next),day=key(cursor);days.set(day,(days.get(day)||0)+until-cursor);cursor=until;}}
   window.fixture={game:{key:'steam:42',shop:'steam',objectId:'42',title:'CONTROL',lifetimeMs:9*3600000,lastTimePlayed:date(0,15)},trackingSince:date(-60),recordedMs:sessions.reduce((n,s)=>n+s.durationMs,0),lastPlayed:date(0,15),days:[...days].map(([day,durationMs])=>({day,durationMs})).sort((a,b)=>b.day.localeCompare(a.day)),sessions};window.yesterday=key(date(-1));window.calls=[];window.recapCalls=0;
   window.cfg={version:'2.0.0',plugins:{activity:true},activityRecaps:true,autoCheckUpdates:true,theme:{},releaseCoverUrl:'./assets/nexus-release-2.0.jpg',releaseCoverVersion:'2.0.0'};
   window.__nexusReplay={open(){recapCalls++;},isOpen:()=>false};
   console.info=message=>{if(!message.startsWith('__HYDRA_NEXUS__'))return;const r=JSON.parse(message.slice(15));calls.push(r);const result=r.action==='game'?r.data.key==='steam:43'?{...fixture,game:{...fixture.game,title:'Empty fixture'},days:[],sessions:[],recordedMs:0,lastPlayed:null}:structuredClone(fixture):r.action==='status'?{...cfg,games:[]}:r.action==='updateStatus'?{current:cfg.version,release:{version:'2.0.0',revision:2,newer:true,notes:'English fallback',translations:window.noteTranslations}}:{};queueMicrotask(()=>__nexusReceive({id:r.id,result}));};
   location.hash='/game/steam/42';
  });
  await page.addScriptTag({content:rendererScript()});await page.addScriptTag({path:path.join(root,'src/background-manager.js')});await page.addScriptTag({path:path.join(root,'src/nexus-ui.js')});await page.evaluate(()=>installNexusUI({token:'fixture',config:cfg}));
  await page.addStyleTag({content:'.header{margin:10px 10px 0;width:auto;border-radius:12px}.container__content{margin:10px;width:auto;border-radius:12px}'});
  const frameSizes=[{width:1200,height:860},{width:1024,height:600},{width:1280,height:720},{width:1920,height:1080}],nativeFrames=[];
  for(const size of frameSizes){await page.setViewportSize(size);nativeFrames.push(await page.evaluate(()=>{const h=document.querySelector('#original-header').getBoundingClientRect(),p=document.querySelector('#original-content').getBoundingClientRect();return {left:h.left,width:h.width,panelLeft:p.left,panelWidth:p.width,gap:p.top-h.bottom};}));}
  await page.setViewportSize({width:1360,height:950});
  await page.locator('#nexus-activity-button').waitFor();await page.locator('#nexus-activity-button').click();await page.locator('.nexus-game-stats').waitFor();assert.equal(await page.evaluate(()=>recapCalls),0,'graph opens per-game history even with recaps enabled');
  for(const language of Object.keys(catalogs)){
   await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>__nexusI18n.language===l,language);
   assert.equal(await page.locator('#nexus-activity-header h3').innerText(),catalogs[language]['Game statistics']);
   for(let i=0;i<frameSizes.length;i++){
    await page.setViewportSize(frameSizes[i]);const actual=await page.evaluate(()=>{const h=document.querySelector('#nexus-activity-header').getBoundingClientRect(),p=document.querySelector('#nexus-activity-panel').getBoundingClientRect(),stats=document.querySelector('.nexus-game-stats'),panel=stats.closest('.settings__panel');return {left:h.left,width:h.width,panelLeft:p.left,panelWidth:p.width,gap:p.top-h.bottom,statsWidth:stats.getBoundingClientRect().width,available:panel.clientWidth-parseFloat(getComputedStyle(panel).paddingLeft)-parseFloat(getComputedStyle(panel).paddingRight),overflow:stats.scrollWidth>stats.clientWidth+2};});
    for(const key of Object.keys(nativeFrames[i]))assert.ok(Math.abs(actual[key]-nativeFrames[i][key])<=1,theme.name+'/'+language+' '+JSON.stringify(frameSizes[i])+' native '+key);
    assert.ok(Math.abs(actual.statsWidth-actual.available)<=2,'statistics use the native panel width without a fixed cap');assert.equal(actual.overflow,false);
   }
   await page.setViewportSize({width:1360,height:950});
   await page.locator('#nexus-stats-range').selectOption('all');
   assert.equal(await page.locator('.stats-metric').nth(2).locator('strong').innerText(),await page.evaluate(l=>new Intl.NumberFormat(l).format(4),language),'zero-duration day is excluded');
   await page.locator('[data-stats-view=days]').click();assert.equal(await page.locator('.stats-day-row').count(),4);
   assert.deepEqual(await page.locator('.nexus-game-stats').evaluate(el=>[el,...el.querySelectorAll('.stats-summary,.stats-chart-card,.stats-history-card')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)),[],theme.name+'/'+language+' layout');
   const contrasts=await page.locator('.nexus-game-stats').evaluate(el=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);return [el.querySelector('[role=tab][aria-selected=true]'),el.querySelector('select')].map(e=>ratio(rgb(getComputedStyle(e).color),rgb(getComputedStyle(e).backgroundColor)));});assert.ok(contrasts.every(c=>c>=4.5),theme.name+'/'+language+' tab/select contrast '+contrasts);
   if(output&&['dark','light','glass'].includes(theme.name)&&['en','ar','de'].includes(language)){await page.locator('#nexus-activity-panel .settings__panel').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(output,theme.name+'-'+language+'.png')});}
   await page.locator('[data-stats-view=sessions]').click();assert.equal(await page.locator('.stats-session-row').count(),40,'session DOM is paged');await page.locator('[data-stats-more]').click();assert.equal(await page.locator('.stats-session-row').count(),49);
   await page.locator('#nexus-stats-day-'+await page.evaluate(()=>yesterday)).click();assert.equal(await page.locator('.stats-session-row').count(),1,'cross-midnight session belongs to both overlapping days');assert.equal(await page.locator('.stats-session-times time').count(),2);
   await page.locator('[data-stats-clear]').click();await page.locator('#nexus-stats-range').selectOption('7');await page.locator('[data-stats-view=days]').click();assert.equal(await page.locator('.stats-chart-day').count(),7);assert.equal(await page.locator('.stats-day-row').count(),3);
   assert.equal(await page.evaluate(()=>recapCalls),0);cases++;
  }
  await page.setViewportSize({width:760,height:800});await page.evaluate(()=>document.documentElement.lang='ar');await page.waitForFunction(()=>__nexusI18n.language==='ar');assert.equal(await page.locator('.nexus-game-stats').evaluate(e=>e.scrollWidth<=e.clientWidth+2),true,'narrow Arabic layout');
  await page.locator('#nexus-activity-header button').click();assert.equal(await page.locator('#nexus-activity-panel').count(),0);assert.equal(await page.locator('#original-content').isVisible(),true);
  if(theme.name==='dark'){
   await page.setViewportSize({width:1360,height:950});
   await page.evaluate(()=>location.hash='/game/steam/43');await page.waitForTimeout(30);await page.evaluate(()=>__hydraNexusUI.openStats());await page.locator('.nexus-game-stats').waitFor();assert.equal(await page.locator('.stats-day-row').count(),0);assert.equal(await page.locator('.stats-metric').nth(2).locator('strong').innerText(),await page.evaluate(()=>new Intl.NumberFormat('ar').format(0)));await page.locator('#nexus-activity-header button').click();
   for(const language of Object.keys(catalogs)){
    await page.evaluate(l=>{document.documentElement.lang=l;__nexusReceive({event:'updateAvailable',value:{release:{version:'2.0.0',newer:true}}});},language);
    await page.waitForFunction(()=>document.querySelector('#nexus-update-toast img')?.naturalWidth===1920);assert.equal(await page.locator('#nexus-update-toast img').getAttribute('alt'),'Hydra Nexus 2.0');await page.locator('[data-update-later]').click();
   }
   await page.evaluate(notes=>{window.noteTranslations=notes;location.hash='/settings';document.getElementById('original-content').innerHTML='<div class="settings__container"><div class="settings__sidebar"><button class="settings__sidebar-button">General</button></div><div class="settings__panel">Native settings</div></div>';},pack.notes);
   await page.locator('#nexus-settings-group').waitFor();await page.evaluate(()=>__hydraNexusUI.openSection('updater'));await page.locator('.nexus-release-notes').waitFor();
   for(const language of Object.keys(catalogs)){
    await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>__nexusI18n.language===l,language);await page.locator('details.nexus-release-notes').evaluate(el=>el.open=true);await page.waitForFunction(()=>document.querySelector('details.nexus-release-notes img')?.naturalWidth===1920);
   }
   await page.addScriptTag({path:process.env.HYDRA_NATIVE_REACT});await page.addScriptTag({path:path.join(root,'src/native-ui.js')});
   await page.evaluate(()=>{const R=reactExports$1,h=R.createElement;window.Modal$1=({children,title,description,onClose,className})=>h('div',{className:'fixture-backdrop'},h('section',{role:'dialog',className:'modal '+className},h('h3',null,title),h('p',null,description),h('button',{onClick:onClose},'×'),children));reactDomExports.createRoot(document.getElementById('native-root')).render(h(HydraNexusReleaseNotes));});
   await page.evaluate(value=>__nexusReceive({event:'releaseNotes',value}),{id:pack.version+':'+pack.revision,version:pack.version,notes:pack.notes.en,translations:pack.notes});
   for(const language of Object.keys(catalogs)){
    await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>__nexusReleaseControl.snapshot?.language===l,language);await page.waitForFunction(()=>document.querySelector('[data-nexus-announcement] img')?.naturalWidth===1920);
    assert.equal(await page.locator('[data-nexus-announcement]').getAttribute('lang'),null);assert.equal(await page.locator('[data-nexus-announcement] img').getAttribute('alt'),'Hydra Nexus 2.0');assert.equal(await page.locator('[data-nexus-announcement] h3,[data-nexus-announcement] p').count(),0,'cover needs no duplicate caption');
    if(output&&language==='ar')await page.screenshot({path:path.join(output,'installed-notes-cover-ar.png')});
   }
   await page.locator('[role=dialog] .button--primary').click();await page.locator('[role=dialog]').waitFor({state:'detached'});
  }
  assert.deepEqual(errors,[],theme.name);await page.close();
 }
 console.log(JSON.stringify({passed:true,statisticsThemeLanguageCases:cases,coverLanguages:9,coverSurfaces:['availability','updater','installed-native-notes'],recapRedirects:0,sessionPaging:true,crossMidnight:true,zeroDayExcluded:true,emptyHistory:true,narrowArabic:true,liveApplicationOperations:0}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
