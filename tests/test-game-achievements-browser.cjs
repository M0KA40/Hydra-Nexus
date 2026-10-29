'use strict';
// Actual retained AchievementsContent/List/summary/comparison/points components.
// Synthetic library/profile/subscription/media adapters; no installed Hydra operation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),native=process.env.HYDRA_NATIVE_FIXTURES||path.resolve(root,'../Development/Fixtures/Native');
const source=fs.readFileSync(path.join(native,'hydra-renderer.js'),'utf8'),{rendererScript}=require('../src/i18n.cjs');
function component(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\n__name('+name+',',start);assert.ok(start>=0&&end>start,name);return source.slice(start,end);}
const surface='jsxRuntimeExports.jsx("div", { className: "achievements-content__achievements-list",';
const nativeContent=component('AchievementsContent');assert.equal(nativeContent.split(surface).length,2,'same single installer host boundary');
const patchedContent=nativeContent.replace(surface,'jsxRuntimeExports.jsx(HydraNexusAchievementsSurface, { className: "achievements-content__achievements-list",');
const css=fs.readFileSync(path.join(native,'hydra-native.css'),'utf8')+'\n'+['interface-quiet.css','interface-polish.css','interface-game-achievements.css'].map(name=>fs.readFileSync(path.join(root,'src',name),'utf8')).join('\n');
const sizes=[{width:1200,height:860},{width:1024,height:600},{width:1280,height:720},{width:1920,height:1080}];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE}),page=await browser.newPage({viewport:sizes[0],reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.stack||error.message));let checks=0;
 try{
  await page.route('https://achievements.fixture/**',route=>{
   if(route.request().url().endsWith('hero.jpg'))return route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.resolve(root,'../Development/Studies/NexusQuietPrototype/assets/cyberpunk-hero.jpg'))});
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="8" fill="#38545f"/><path d="M20 16h24v16L32 44 20 32zM32 44v10M24 54h16" stroke="#def3fa" fill="none" stroke-width="3"/></svg>'});
  });
  await page.setContent('<html lang="en" data-nexus-interface="quiet"><head><style>'+css+'*{box-sizing:border-box}body{margin:0;font:14px Arial;background:#151a22;color:#f5f6f8}#root,#shell{height:100vh}#shell{display:flex}.sidebar{width:190px;flex-shrink:0}.container{flex:1;min-width:0;display:flex;flex-direction:column}.header{margin:10px 14px 0;min-height:64px;flex-shrink:0}.container__content{margin:12px 14px;min-height:0;flex:1;overflow:hidden}.settings__container{height:100%;padding:24px}.fixture-tools{display:flex;gap:12px;padding:8px;flex-wrap:wrap}.fixture-tools button{font:inherit;padding:8px}.fixture-media{position:fixed;inset:50px;z-index:500;background:#20262d;padding:24px}.fixture-media img{max-width:100%;max-height:70vh}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:path.join(native,'react-runtime.js')});await page.addScriptTag({content:rendererScript()});
  await page.evaluate(()=>{
   const R=reactExports$1,h=R.createElement;window.fixture={route:'settings',design:'quiet',library:[{shop:'steam',objectId:'570'}],compare:false,subscription:true};window.commands=[];
   window.gameDetailsContext=R.createContext(null);
   window.useHydraNexusInterface=()=>R.useSyncExternalStore(R.useCallback(listener=>{document.addEventListener('fixture-design',listener);return()=>document.removeEventListener('fixture-design',listener);},[]),()=>fixture.design);
   window.useLibrary$1=()=>({library:fixture.library});const dispatch=action=>commands.push(action);window.useAppDispatch$1=()=>dispatch;window.setHeaderTitle=title=>({type:'header',title});
   window.owner={id:'owner',displayName:'Alexandra Wiśniewska-Kowalczyk',totalAchievementCount:3,unlockedAchievementCount:2,profileImageUrl:''};window.other={id:'other',displayName:'نور الهدى عبد الرحمن',totalAchievementCount:3,unlockedAchievementCount:1,profileImageUrl:''};
   window.useUserDetails$1=()=>({userDetails:owner,hasActiveSubscription:fixture.subscription});window.useSubscription=()=>({showHydraCloudModal:kind=>commands.push({cloud:kind})});
   window.useDate$1=()=>({formatDateTime:date=>new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(date))});
   window.nativeLabels=(()=>{
    const table={en:{earned_points:'Earned points',available_points:'Available points',hardcore:'Hardcore',view_souvenir:'View souvenir',hidden_achievement_tooltip:'Hidden achievement',achievement_progress:'Unlocked {unlockedCount} of {totalCount}',achievement_earn_points:'Earn {points} points',unlocked_at:'Unlocked {date}',hardcore_unlocked_at:'Hardcore unlocked {date}',souvenir_alt:'Souvenir: {achievement}'},de:{earned_points:'Verdiente Erfolgspunkte',available_points:'Verfügbare Erfolgspunkte',hardcore:'Hardcore',view_souvenir:'Erinnerung ansehen',hidden_achievement_tooltip:'Versteckter Erfolg',achievement_progress:'{unlockedCount} von {totalCount} freigeschaltet',achievement_earn_points:'{points} Erfolgspunkte verdienen',unlocked_at:'Freigeschaltet am {date}',hardcore_unlocked_at:'Hardcore freigeschaltet am {date}',souvenir_alt:'Erinnerung: {achievement}'},ar:{earned_points:'النقاط المكتسبة',available_points:'النقاط المتاحة',hardcore:'الوضع الصعب',view_souvenir:'عرض التذكار',hidden_achievement_tooltip:'إنجاز مخفي',achievement_progress:'تم فتح {unlockedCount} من {totalCount}',achievement_earn_points:'اكسب {points} نقطة',unlocked_at:'تم الفتح في {date}',hardcore_unlocked_at:'تم الفتح في الوضع الصعب في {date}',souvenir_alt:'تذكار: {achievement}'}};
    return table;
   })();
   const Icon=props=>h('svg',{...props,width:props.size||18,height:props.size||18,'aria-hidden':true,viewBox:'0 0 24 24'},h('path',{d:'M5 12h14M12 5v14',stroke:'currentColor',fill:'none'}));
   window.EyeClosedIcon=window.SearchIcon=window.SvgHydra=window.PersonIcon=window.LockIcon=window.TrophyIcon=window.CheckCircleIcon=Icon;
   window.Link$1=({to,children})=>h('a',{href:'#'+to,onClick:event=>{event.preventDefault();commands.push({route:to});}},children);window.buildGameDetailsPath=({shop,objectId})=>'/game/'+shop+'/'+objectId;
   window.isGameCompleted=(total,unlocked)=>total>0&&total===unlocked;window.formatDownloadProgress$2=value=>new Intl.NumberFormat(document.documentElement.lang,{style:'percent',maximumFractionDigits:0}).format(value);
   window.FullscreenMediaModal=({visible,src,alt,onClose})=>visible?h('section',{className:'fixture-media',role:'dialog'},h('button',{onClick:onClose},'Close media fixture'),h('img',{src,alt})):null;
   window.RetroAchievementsConnectBanner=()=>h('button',{id:'retro-connect',onClick:()=>commands.push({retro:true})},'RetroAchievements fixture connection');
   window.rows=[{name:'first',displayName:'A remarkable journey across the world and beyond',description:'Complete every chapter, preserve the hidden records, and return to the international community headquarters.',icon:'https://achievements.fixture/first.svg',unlocked:true,points:150,unlockTime:'2026-10-27T18:20:00Z',hardcoreUnlockTime:'2026-10-27T18:20:00Z',imageUrl:'https://achievements.fixture/souvenir.svg'},{name:'second',displayName:'Benachrichtigungseinstellungen und internationale Gemeinschaft',description:'Ein langer, realistischer Erfolgstext mit hilfreichen Informationen über die Anforderungen.',icon:'https://achievements.fixture/second.svg',unlocked:false,hidden:true,points:50},{name:'third',displayName:'الرحلة الأخيرة إلى العالم المفتوح',description:'أكمل الرحلة واكتشف جميع الأسرار في المنطقة الأخيرة.',icon:'https://achievements.fixture/third.svg',unlocked:true,unlockTime:'2026-10-28T18:20:00Z'}];
   window.comparison={achievementsPointsTotal:200,owner:{...owner,achievementsPointsEarnedSum:150},target:{...other,achievementsPointsEarnedSum:50},achievements:rows.map((row,index)=>({...row,ownerStat:{unlocked:row.unlocked,unlockTime:row.unlockTime},targetStat:{unlocked:index===1,unlockTime:'2026-10-26T18:20:00Z'}}))};
   window.context={shop:'steam',objectId:'570',gameTitle:'A game with complete native achievement details',game:{shop:'steam',objectId:'570'},shopDetails:{assets:{libraryHeroImageUrl:'https://achievements.fixture/hero.jpg'}},achievements:rows};
  });
  await page.evaluate(async()=>{const resources=Object.fromEntries(Object.entries(nativeLabels).map(([language,labels])=>[language,{achievement:Object.fromEntries(Object.entries(labels).map(([key,value])=>[key,value.replace(/\{(\w+)\}/g,'{{$1}}')]))}]));await instance.init({lng:'en',fallbackLng:'en',resources});setI18n(instance);});
  await page.addScriptTag({path:path.join(root,'src/interface-game-achievements.js')});
  await page.addScriptTag({content:['ProgressBar','AchievementList','AchievementPanel','ComparedAchievementList','ComparedAchievementPanel','AchievementSummary'].map(component).join('\n')+'\n'+patchedContent});
  await page.evaluate(()=>{
   const R=reactExports$1,h=R.createElement;window.appRoot=reactDomExports.createRoot(document.getElementById('root'));
   window.render=()=>appRoot.render(h('div',{id:'shell'},h('aside',{className:'sidebar'},'Native sidebar fixture'),h('article',{className:'container'},h('header',{className:'header',id:'native-header'},fixture.route==='settings'?'Settings':'Achievements'),h('section',{className:'container__content',id:'native-content'},fixture.route==='settings'?h('section',{className:'settings__container'},h('input',{defaultValue:'Native Settings fixture'})):h(gameDetailsContext.Provider,{value:context},h(AchievementsContent,{otherUser:fixture.compare?other:null,comparedAchievements:fixture.compare?comparison:null}))))));render();
   window.frame=()=>{const header=document.getElementById('native-header').getBoundingClientRect(),content=document.getElementById('native-content').getBoundingClientRect();return {headerLeft:header.left,headerRight:header.right,contentLeft:content.left,contentRight:content.right,gap:content.top-header.bottom};};
  });
  const references=[];for(const size of sizes){await page.setViewportSize(size);references.push(await page.evaluate(()=>frame()));}
  await page.evaluate(()=>{fixture.route='achievements';render();});await page.locator('[data-nexus-library-achievements] .achievements__item').first().waitFor();
  assert.equal(await page.locator('.achievements__item').count(),3,'native rows retained');
  assert.ok((await page.locator('.achievement-panel__content').first().innerText()).includes('Earned points'),'actual native translator supplies points label');
  assert.equal(await page.locator('.achievements__item-image--locked').count(),1,'locked status retained');
  assert.equal(await page.locator('.achievements__item-hardcore-badge').count(),1,'hardcore marker retained');
  assert.equal(await page.locator('.achievements__item-hidden-icon').count(),1,'hidden marker retained');
  assert.equal(await page.locator('.achievements__item-points-value').first().innerText(),'150','original numeric points retained');
  assert.equal(await page.locator('.achievements__item-points--locked').count(),1,'subscription unknown-points action retained');
  await page.locator('.achievements__item-points--locked').click();assert.deepEqual(await page.evaluate(()=>commands.at(-1)),{cloud:'achievements'});
  await page.locator('.achievements__item-souvenir').click();assert.equal(await page.locator('.fixture-media img').getAttribute('src'),'https://achievements.fixture/souvenir.svg');await page.getByRole('button',{name:'Close media fixture',exact:true}).click();
  await page.locator('#retro-connect').click();assert.deepEqual(await page.evaluate(()=>commands.at(-1)),{retro:true});
  for(const language of ['en','de','ar']){
   await page.evaluate(async language=>{await instance.changeLanguage(language);document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';__nexusI18n.setLanguage(language);fixture.route='settings';render();},language);
   references.length=0;for(const size of sizes){await page.setViewportSize(size);references.push(await page.evaluate(()=>frame()));}
   await page.evaluate(()=>{fixture.route='achievements';render();});await page.locator('[data-nexus-library-achievements]').waitFor();
   for(let i=0;i<sizes.length;i++){
    await page.setViewportSize(sizes[i]);await page.evaluate(()=>new Promise(requestAnimationFrame));
    assert.deepEqual(await page.evaluate(()=>frame()),references[i],language+'/'+sizes[i].width+' native Settings/header/content geometry unchanged');
    const fit=await page.locator('[data-nexus-library-achievements]').evaluate(el=>({page:document.documentElement.scrollWidth<=innerWidth+2,surface:el.scrollWidth<=el.clientWidth+2,section:el.firstElementChild.scrollWidth<=el.firstElementChild.clientWidth+2,images:[...el.querySelectorAll('.achievements__item-image')].every(image=>image.getBoundingClientRect().width>=46)}));
    assert.deepEqual(fit,{page:true,surface:true,section:true,images:true},language+'/'+sizes[i].width+' native rows fit without squashing icons');checks++;
    const titleFit=await page.locator('.achievements-content__achievements-list__section__container__hero__content__game-title').evaluate(el=>{const title=el.getBoundingClientRect(),hero=el.closest('.achievements-content__achievements-list__section__container__hero').getBoundingClientRect();return title.left>=hero.left-1&&title.right<=hero.right+1&&title.bottom<=hero.bottom+1;});
    assert.equal(titleFit,true,language+'/'+sizes[i].width+' long game title stays inside native hero without overlapping summary');
   }
  }
  await page.evaluate(()=>{window.originalSurface=document.querySelector('[data-nexus-library-achievements]');window.originalRow=document.querySelector('.achievements__item');fixture.design='native';document.documentElement.removeAttribute('data-nexus-interface');document.dispatchEvent(new Event('fixture-design'));});
  await page.waitForFunction(()=>!document.querySelector('[data-nexus-library-achievements]'));
  assert.equal(await page.evaluate(()=>document.querySelector('.achievements-content__achievements-list')===originalSurface&&document.querySelector('.achievements__item')===originalRow),true,'theme exit preserves native surface and row DOM');
  await page.evaluate(()=>{fixture.design='quiet';document.documentElement.setAttribute('data-nexus-interface','quiet');document.dispatchEvent(new Event('fixture-design'));});await page.locator('[data-nexus-library-achievements]').waitFor();
  assert.equal(await page.evaluate(()=>document.querySelector('[data-nexus-library-achievements]')===originalSurface&&document.querySelector('.achievements__item')===originalRow),true,'theme return preserves native DOM');
  await page.evaluate(()=>{fixture.library=[];render();});await page.waitForFunction(()=>!document.querySelector('[data-nexus-library-achievements]'));assert.equal(await page.locator('.achievements__item').count(),3,'catalogue native achievements remain unchanged');
  await page.evaluate(()=>{fixture.library=[{shop:'other-store',objectId:'570'}];render();});assert.equal(await page.locator('[data-nexus-library-achievements]').count(),0,'same numeric ID in another shop does not opt into Quiet');
  await page.evaluate(()=>{fixture.library=[{shop:'steam',objectId:570}];fixture.compare=true;render();});await page.locator('[data-nexus-library-achievements] .achievements__item-compared').first().waitFor();
  assert.equal(await page.locator('.achievements__item-compared').count(),3,'actual native comparison rows retained');assert.equal(await page.locator('.achievements__item-status').count(),6,'both owner/target status columns retained');assert.equal(await page.locator('.achievement-panel__grid').count(),1,'native comparison points panel retained');
  await page.evaluate(()=>{fixture.subscription=false;render();});assert.equal(await page.locator('.achievement-panel__grid--without-subscription').count(),1,'native subscription guard preserved');assert.equal(await page.locator('.achievements-content__comparison__container__subscription-required-button').count(),1,'comparison subscription action preserved');
  if(process.env.HYDRA_ACHIEVEMENTS_PREVIEW){fs.mkdirSync(process.env.HYDRA_ACHIEVEMENTS_PREVIEW,{recursive:true});await page.evaluate(async()=>{await instance.changeLanguage('en');document.documentElement.lang='en';document.documentElement.dir='ltr';__nexusI18n.setLanguage('en');fixture.subscription=true;fixture.compare=false;render();});await page.setViewportSize(sizes[0]);await page.screenshot({path:path.join(process.env.HYDRA_ACHIEVEMENTS_PREVIEW,'native-achievements-quiet-en.png')});}
  assert.deepEqual(errors,[],'native components have no renderer exceptions');console.log('PASS: '+checks+' native achievements/Settings frame cases (four sizes × en/de/ar), retained actual native content/list/summary/points/comparison, locked/hidden/hardcore/souvenir actions, subscription guards, shop+library gating and exact DOM preservation across theme changes. Media display and service adapters are synthetic; installed Hydra was not run.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
