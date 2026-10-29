'use strict';
// Retained native Modal/Backdrop and real news renderer; isolated Steam adapters only.
// Does not operate installed Hydra, Steam, accounts or game data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),native=process.env.HYDRA_NATIVE_FIXTURES||path.resolve(root,'../Development/Fixtures/Native');
const source=fs.readFileSync(path.join(native,'hydra-renderer.js'),'utf8'),{rendererScript}=require('../src/i18n.cjs');
function component(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n__name('+name+',',start);assert.ok(start>=0&&end>start,name);return source.slice(start,end);}
const css=fs.readFileSync(path.join(native,'hydra-native.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'dist/interface-colors.css'),'utf8');
const browserOptions={headless:true};if(process.env.HYDRA_BROWSER_EXE)browserOptions.executablePath=process.env.HYDRA_BROWSER_EXE;
(async()=>{
 const browser=await chromium.launch(browserOptions),page=await browser.newPage({viewport:{width:1200,height:860},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XsAAAAASUVORK5CYII=','base64')}));
 try{
  await page.setContent('<html lang="en" data-nexus-interface="quiet" data-nexus-color="mint"><head><style>'+css+'*{box-sizing:border-box}body{margin:0;font:14px Arial;background:#151a22;color:#f5f6f8}#root{height:100vh;display:flex;flex-direction:column}.fixture-tools{display:flex;gap:12px;padding:16px;flex-shrink:0}.fixture-panel{height:calc(100vh - 76px);overflow:auto;padding:24px 32px;min-width:0}.fixture-tab[hidden]{display:none!important}.fixture-tools button{font:inherit;padding:10px 14px}.fixture-filler{height:220px}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:path.join(native,'react-runtime.js')});
  await page.addScriptTag({content:rendererScript()});
  await page.evaluate(()=>{
   const R=reactExports$1,h=R.createElement;window.cn=(...values)=>values.map(value=>typeof value==='string'?value:Object.keys(value||{}).filter(key=>value[key]).join(' ')).join(' ');
   window.useTranslation=()=>({t:key=>key==='close'?'Close':key});window.XIcon=()=>h('svg',{width:24,height:24,viewBox:'0 0 24 24','aria-hidden':true},h('path',{d:'M6 6l12 12M18 6 6 18',stroke:'currentColor'}));
   window.commands=[];window.electron={platform:'win32',openExternal:async url=>commands.push(['external',url])};
   window.calls=[];window.mode='normal';window.deferred=null;
   window.longTitle='A substantial developer announcement: improvements to multiplayer, accessibility, and the international community experience';
   window.longURL='https://example.test/community/announcements/'+('international-community-development-notes-'.repeat(7));
   const paragraph='<p>Developer notes with realistic reading content, an accessible difficulty setting, and complete changelog context.</p>';
   window.article='[h2]Official changes[/h2][b]Readable emphasis[/b][list][*]Improved keyboard navigation[*]Updated multiplayer[/list]'+
    '<p style="position:fixed" onclick="window.pwned=1">Safe text</p><script>window.pwned=1</script><iframe src="https://evil.test"></iframe><svg onload="window.pwned=1"></svg><form><input autofocus></form>'+
    '[url=javascript:window.pwned=1]Unsafe link[/url]<a href="https://example.test/read-more" onclick="window.pwned=1">Read original discussion</a>'+
    '<img src="https://evil.test/tracker.png" onerror="window.pwned=1"><img src="https://clan.steamstatic.com/images/1/safe.png" onerror="window.pwned=1">'+
    '[img src="{STEAM_CLAN_LOC_IMAGE}/12345/update.png"][/img]'+
    '<p><a href="'+longURL+'">'+longURL+'</a></p>'+paragraph.repeat(24);
   window.newsItem=(id,extra={})=>({id:String(id),title:id===1?longTitle:'Earlier developer announcement '+id,url:'https://store.steampowered.com/news/app/570/view/'+id,contents:id===1?article:'[h3]Earlier notes[/h3]A concise older announcement.',excerpt:'A useful preview of the developer announcement and its changes.',image:id===1?'https://clan.steamstatic.com/images/1/cover.png':'',date:1793220000-id*86400,category:'announcement',official:true,contentComplete:id!==1,...extra});
   window.feed=(items,extra={})=>({supported:true,items,updatedAt:1793220000000,stale:false,error:null,nextEnddate:1793000000,hasMore:false,...extra});
   window.__nexusNews={load:async options=>{calls.push({...options});if(mode==='fail')throw Error('Offline fixture');if(mode==='empty')return feed([]);if(mode==='unsupported')return feed([],{supported:false});if(mode==='stale')return feed([newsItem(1)],{stale:true,error:'unavailable'});if(mode==='delay')return new Promise(resolve=>{deferred=()=>resolve(feed([newsItem(1)]));});if(mode==='minimal')return feed([newsItem(5,{contents:'',excerpt:'Only a public excerpt is available.',image:undefined,contentComplete:false})]);if(options.enddate)return feed([newsItem(2),newsItem(3)],{nextEnddate:null});return feed([newsItem(1),newsItem(2)],{hasMore:true});},open:async data=>{commands.push(['steam',data]);}};
  });
  await page.addScriptTag({content:component('Backdrop$1')+'\n'+component('Modal$1')});
  await page.addScriptTag({path:path.join(root,'src/interface-game-news.js')});
  await page.evaluate(()=>{
   const R=reactExports$1,h=R.createElement;window.appRoot=reactDomExports.createRoot(document.getElementById('root'));
   function Fixture({game='570',shop='steam'}){const [tab,setTab]=R.useState('overview');return h(R.Fragment,null,h('nav',{className:'fixture-tools'},h('button',{onClick:()=>setTab('overview'),id:'overview-tab'},'Overview fixture'),h('button',{onClick:()=>setTab('updates'),id:'updates-tab'},'Updates fixture')),h('main',{className:'fixture-panel',id:'fixture-panel'},h('div',{className:'fixture-filler'}),h('div',{className:'fixture-tab',hidden:tab!=='overview'},h(HydraNexusGameUpdates,{shop,objectId:game,compact:true,active:tab==='overview',onViewAll:()=>setTab('updates')})),h('div',{className:'fixture-tab',hidden:tab!=='updates'},h(HydraNexusGameUpdates,{shop,objectId:game,active:tab==='updates'})),h('div',{className:'fixture-filler'})));}
   window.render=options=>appRoot.render(h(Fixture,{key:options?.game||'570',...options}));render();
  });
  await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').waitFor();
  assert.equal(await page.evaluate(()=>calls.length),1,'compact and inactive full views share one entry');
  await page.locator('#updates-tab').click();
  assert.equal(await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').count(),2);
  assert.equal(await page.evaluate(()=>calls.length),1,'opening Updates uses loaded Overview data');
  await page.getByRole('button',{name:'Load older updates',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.fixture-tab:not([hidden]) .nexus-news-list')?.children.length===3);
  assert.equal(await page.evaluate(()=>calls.length),2,'one pagination request');
  assert.equal(await page.evaluate(()=>calls.at(-1).enddate),1793000000);
  await page.locator('#overview-tab').click();await page.locator('#updates-tab').click();
  assert.equal(await page.evaluate(()=>calls.length),2,'tab toggles do not refetch');
  const first=page.locator('.fixture-tab:not([hidden]) .nexus-news-card').first();await first.scrollIntoViewIfNeeded();
  const scrollBefore=await page.locator('#fixture-panel').evaluate(el=>el.scrollTop);await first.click();await page.locator('.nexus-news-modal').waitFor();
  assert.equal(await page.locator('.nexus-news-modal').getAttribute('aria-label'),await page.evaluate(()=>longTitle));
  assert.equal(await page.locator('.nexus-news-modal .modal__close-button').evaluate(el=>el===document.activeElement),true,'reader focuses native Close');
  assert.equal(await page.locator('.nexus-news-excerpt-notice').innerText(),'Steam provides the content shown here. Open the original post for the full context.','Steam content limitation disclosed without assuming truncation');
  assert.equal(await page.locator('.nexus-news-article h2').first().innerText(),'Official changes');
  assert.equal(await page.locator('.nexus-news-article strong').first().innerText(),'Readable emphasis');
  assert.equal(await page.locator('.nexus-news-article').evaluate(el=>el.querySelectorAll('script,style,iframe,svg,form,input,[onclick],[onerror],[style]').length),0,'active markup and attributes discarded');
  assert.equal(await page.locator('.nexus-news-article a[href^="javascript:"]').count(),0);
  assert.equal(await page.locator('.nexus-news-article img[src*="evil.test"]').count(),0,'off-origin image trackers discarded');
  assert.equal(await page.evaluate(()=>window.pwned),undefined);
  assert.equal(await page.locator('.nexus-news-article img[src*="update.png"]').count(),1,'Steam attribute image syntax resolves safely');
  assert.equal(await page.locator('.nexus-news-article img[src*="update.png"]').getAttribute('src'),'https://clan.akamai.steamstatic.com/images/12345/update.png');
  await page.getByRole('link',{name:'Read original discussion',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>commands.at(-1)),['external','https://example.test/read-more']);
  await page.getByRole('button',{name:'View on Steam',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>commands.at(-1)),['steam',{shop:'steam',objectId:'570',id:'1',browser:false}]);
  await page.getByRole('button',{name:'Open in browser',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>commands.at(-1)),['steam',{shop:'steam',objectId:'570',id:'1',browser:true}]);
  await page.keyboard.press('Tab');assert.equal(await page.locator('.modal__close-button').evaluate(el=>el===document.activeElement),true,'Tab wraps to Close');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Open in browser',exact:true}).evaluate(el=>el===document.activeElement),true,'Shift+Tab wraps to last control');
  await page.keyboard.press('Escape');await page.locator('.nexus-news-modal').waitFor({state:'detached'});
  assert.equal(await first.evaluate(el=>el===document.activeElement),true,'native opener focus restored');
  assert.equal(await page.locator('#fixture-panel').evaluate(el=>el.scrollTop),scrollBefore,'list scroll restored exactly');
  // Check realistic translated titles and URL lengths at minimum supported desktop size.
  await page.setViewportSize({width:1024,height:600});
  await page.evaluate(()=>{document.documentElement.lang='ar';document.documentElement.dir='rtl';__nexusI18n.setLanguage('ar');render({game:'571'});});
  await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').waitFor();await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').first().click();await page.locator('.nexus-news-modal').waitFor();
  assert.equal(await page.evaluate(()=>__nexusI18n.language),'ar','real translator switched to Arabic');
  assert.equal(await page.locator('.nexus-news-reader-footer').getAttribute('dir'),'rtl','reader footer follows actual Arabic locale');
  assert.equal(await page.locator('.nexus-news-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true,'RTL article fits minimum desktop modal');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'long title/URL does not overflow viewport');
  await page.keyboard.press('Escape');await page.locator('.nexus-news-modal').waitFor({state:'detached'});
  await page.evaluate(()=>{document.documentElement.lang='en';document.documentElement.dir='ltr';__nexusI18n.setLanguage('en');mode='empty';render({game:'572'});});
  await page.getByText('There are no developer announcements for this game yet.',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').count(),0);
  await page.evaluate(()=>{mode='fail';render({game:'573'});});
  await page.getByText('Could not load Steam updates. Please try again.',{exact:true}).first().waitFor();
  assert.equal(await page.getByText('There are no developer announcements for this game yet.',{exact:true}).count(),0,'offline error differs from empty');
  await page.evaluate(()=>{mode='empty';});await page.locator('.fixture-tab:not([hidden]) .nexus-news-empty button').click();
  await page.getByText('There are no developer announcements for this game yet.',{exact:true}).first().waitFor();
  await page.evaluate(()=>{mode='stale';render({game:'574'});});
  await page.getByText('Showing saved updates. Connect to refresh.',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').count(),1,'last-good card remains readable offline');
  await page.evaluate(()=>{mode='delay';render({game:'575'});});
  await page.getByText('Loading updates…',{exact:true}).first().waitFor();await page.evaluate(()=>deferred());
  await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').waitFor();
  await page.evaluate(()=>{mode='minimal';render({game:'576'});});
  await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').waitFor();assert.equal(await page.locator('.fixture-tab:not([hidden]) .nexus-news-art').count(),0,'missing optional image is omitted');
  await page.locator('.fixture-tab:not([hidden]) .nexus-news-card').click();await page.getByText('Only a public excerpt is available.',{exact:true}).last().waitFor();
  await page.keyboard.press('Escape');await page.locator('.nexus-news-modal').waitFor({state:'detached'});
  await page.evaluate(()=>{mode='unsupported';render({game:'1',shop:'custom'});});
  await page.getByText('Updates are available for Steam library games only.',{exact:true}).first().waitFor();
  assert.deepEqual(errors,[],'no renderer exceptions');
  console.log('PASS: retained native article modal; inert BBCode/HTML; Steam image syntax; compact/full cache dedup; pagination; loading/empty/error/offline/optional-media states; long title/URL and Arabic RTL; Escape/focus/scroll preservation; safe external and Steam adapter commands. Installed Hydra was not run.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
