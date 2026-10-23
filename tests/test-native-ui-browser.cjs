'use strict';
// Optional acceptance using the inspected Hydra React runtime, without executing Hydra.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const {catalogs,rendererScript}=require('../src/i18n.cjs'),root=path.join(__dirname,'..');
(async()=>{
 if(!process.env.HYDRA_NATIVE_REACT)throw Error('HYDRA_NATIVE_REACT must name a private React-only fixture; never distribute the native application.');
 const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html lang="en"><head><style>body{background:#181818;color:#ddd;font:14px Arial}button{color:inherit;background:#222;padding:10px;border:0}.settings__content{display:flex}.settings__sidebar{width:200px}.settings__panel{width:750px}.sidebar-profile__dropdown-item{display:flex;align-items:center;width:280px}.hero-panel__actions{display:flex}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:process.env.HYDRA_NATIVE_REACT});await page.addScriptTag({path:path.join(root,'src/native-ui.js')});
  await page.evaluate(()=>{
   installNativeNexusCommit();
   const nativeObserve=MutationObserver.prototype.observe;window.bodyObservers=0;MutationObserver.prototype.observe=function(target,options){if(target===document.body)bodyObservers++;return nativeObserve.call(this,target,options);};
   window.config={version:'1.2.0',announcementUrl:'https://nexus.test/announcement.png',plugins:{steam:true,backup:true,activity:true,tabs:true,mods:true,notes:true,hardware:false,lowResource:false,invisible:false},theme:{},privacy:{supported:true,requested:false,active:false,held:1},autoCheckUpdates:false};
   window.games=[{key:'steam:42',shop:'steam',objectId:'42',title:'Fixture',lifetimeMs:1}];window.calls=[];window.friendClicks=0;
   console.info=message=>{
    if(message.startsWith('__HYDRA_NEXUS__')){
     const r=JSON.parse(message.slice(15));calls.push(r);let result={};
     if(r.action==='feature'){config.plugins[r.data.name]=r.data.enabled;if(r.data.name==='invisible'&&!r.data.enabled){config.privacy.active=false;config.privacy.requested=false;}result=structuredClone(config);}
     else if(r.action==='invisibleMode'){config.privacy.requested=r.data.enabled;config.privacy.active=r.data.enabled;result={privacy:structuredClone(config.privacy)};}
     else if(r.action==='status')result={...structuredClone(config),games};
     else if(r.action==='nexusKeyStatus')result={hasKey:false};
     else if(r.action==='game')result={game:games[0],days:[],sessions:[],recordedMs:0};
     else if(r.action==='resumePrivateSharing')result={cancelled:true};
     setTimeout(()=>window.__nexusReceive({id:r.id,result}),0);
    }else if(message.startsWith('__HYDRA_STEAM_IPC__')){const r=JSON.parse(message.slice('__HYDRA_STEAM_IPC__'.length));if(r.action==='requestData')setTimeout(()=>window.__hydraSteamReceive({accounts:[],bindings:{}}),0);}
    else if(message.startsWith('__HYDRA_BACKUP_V2__')){const r=JSON.parse(message.slice('__HYDRA_BACKUP_V2__'.length));setTimeout(()=>window.__hbkReceive({id:r.id,result:{games:[],snapshots:[],settings:{},drive:{},last:{}}}),0);}
   };
   const React=reactExports$1,h=React.createElement;window.Modal$1=({children,title,description,onClose})=>h('div',{role:'dialog',className:'modal'},h('h3',null,title),h('p',null,description),h('button',{'data-native-close':'',onClick:onClose},'×'),children);const app=reactDomExports.createRoot(document.getElementById('root'));
   window.renderNative=(route='/settings',menu=true)=>{
    location.hash=route;
    app.render(h(React.Fragment,null,h(HydraNexusReleaseNotes),h('aside',{className:'sidebar'},h(HydraNexusHost,{__nexusTag:'ul',className:'sidebar__menu'},h('li',{className:'sidebar__menu-item'},h('button',null,'Settings')))),
     h('div',{className:'container'},h('header',{className:'header'},'Hydra'),h('main',{className:'container__content'},
      route==='/settings'?h('div',{className:'settings__container'},h('div',{className:'settings__content'},h(HydraNexusHost,{__nexusTag:'aside',className:'settings__sidebar'},h('button',{className:'settings__sidebar-button',id:'native-settings'},'General')),h(HydraNexusHost,{__nexusTag:'div',className:'settings__panel'},'Native settings'))):h(React.Fragment,null,h(HydraNexusHost,{__nexusTag:'div',className:'game-details__hero'}),h(HydraNexusHost,{__nexusTag:'div',className:'hero-panel__actions'},h('button',null,'Play'))))),
     menu&&h('div',{className:'sidebar-profile__dropdown'},h('button',{className:'sidebar-profile__dropdown-item'},'Profile'),h('button',{className:'sidebar-profile__dropdown-item'},'Notifications'),h('button',{className:'sidebar-profile__dropdown-item',id:'native-friends',onClick:()=>friendClicks++},'Friends'),h(HydraNexusInvisibleMenu),h('div',{className:'sidebar-profile__dropdown-separator'}),h('button',{id:'native-signout',className:'sidebar-profile__dropdown-item'},'Sign out'))));
   };
   renderNative();
  });
  await page.addScriptTag({content:rendererScript()});
  for(const [file,call]of [['nexus-ui.js','installNexusUI({token:"fixture",config})'],['workspace-ui.js','installWorkspaceUI()'],['steam-ui.js','installSteamUI()'],['ui.js','installBackupUI({token:"fixture"})']]){await page.addScriptTag({path:path.join(root,'src',file)});await page.evaluate(call);}
  await page.locator('#nexus-settings-group').waitFor();assert.equal(await page.locator('[data-nexus-native=settings]').count(),1);assert.equal(await page.evaluate(()=>bodyObservers),0,'native integration uses no body-wide observers in any of the four adapters');
  await page.locator('[data-nexus-tab=plugins]').click();const plugin=page.locator('[data-plugin=invisible]'),quick=page.locator('[data-nexus-invisible]');
  assert.equal(await quick.count(),0);await plugin.check();await quick.waitFor();assert.equal(await quick.getAttribute('aria-pressed'),'false');assert.equal(await plugin.isChecked(),true);
  const colors=[];
  for(const language of Object.keys(catalogs)){
   await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>window.__nexusPrivacyControl.snapshot.language===l,language);
   assert.equal(await quick.locator('[data-invisible-status]').innerText(),catalogs[language].Off);
   await quick.click();await page.waitForFunction(()=>document.querySelector('[data-nexus-invisible]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-nexus-invisible]').disabled);
   assert.equal(await quick.locator('[data-invisible-status]').innerText(),catalogs[language].On);assert.equal(await plugin.isChecked(),true);assert.equal(await quick.locator('svg').getAttribute('data-invisible-icon'),'on');
   assert.equal(await quick.getAttribute('aria-label'),catalogs[language]['Invisible Mode']+' — '+catalogs[language].On);
   assert.equal(await page.locator('[data-nexus-action=resumePrivateSharing]').isDisabled(),true);
   const on=await quick.locator('svg').evaluate(el=>({color:getComputedStyle(el).color,opacity:getComputedStyle(el).opacity}));
   await quick.click();await page.waitForFunction(()=>document.querySelector('[data-nexus-invisible]').getAttribute('aria-pressed')==='false'&&!document.querySelector('[data-nexus-invisible]').disabled);
   const off=await quick.locator('svg').evaluate(el=>({color:getComputedStyle(el).color,opacity:getComputedStyle(el).opacity}));assert.notEqual(on.color,off.color);assert.equal(on.opacity,'1');assert.equal(off.opacity,'0.45');colors.push(language);
  }
  await quick.click();await page.waitForFunction(()=>document.querySelector('[data-nexus-invisible]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-nexus-invisible]').disabled);await plugin.uncheck();await quick.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.__hydraNexusUI.getConfig().privacy.active),false);
  await plugin.check();await quick.waitFor();assert.equal(await quick.getAttribute('aria-pressed'),'false','reenabling availability does not silently reactivate privacy');
  await page.locator('#native-friends').click();assert.equal(await page.evaluate(()=>friendClicks),1);assert.equal(await page.locator('#native-signout').innerText(),'Sign out');
  for(let i=0;i<5;i++){await page.evaluate(()=>renderNative('/settings',false));await quick.waitFor({state:'detached'});await page.evaluate(()=>renderNative());await quick.waitFor();}assert.equal(await quick.count(),1);
  await page.evaluate(()=>renderNative('/game/steam/42'));await page.locator('#nexus-notes-action').waitFor();await page.locator('#nexus-mods-action').waitFor();await page.locator('#hsb-floating-widget').waitFor();assert.equal(await page.locator('#hbk-nav-item').count(),1);
  await page.evaluate(()=>renderNative());await page.locator('[data-nexus-tab=plugins]').click();await plugin.waitFor();assert.equal(await page.locator('#nexus-settings-group').count(),1);
  await page.waitForTimeout(400);await page.evaluate(()=>{calls=[];window.privacyEvents=0;document.addEventListener('nexus-privacy',()=>privacyEvents++);});await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>privacyEvents),0);assert.deepEqual(await page.evaluate(()=>calls),[],'idle native UI does not repeatedly request backend data');assert.deepEqual(errors,[]);
  await page.route('https://nexus.test/announcement.png',route=>route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(root,'assets/announcements/invisible-mode-1.2.0.png'))}));
  await page.evaluate(()=>window.__nexusReceive({event:'releaseNotes',value:{id:'1.2.0:5',version:'1.2.0',notes:'## Changes\n- **Fixed privacy**\n<img src=x onerror=window.injected=true>'}}));
  await page.locator('.nexus-installed-notes, [role=dialog]').waitFor();
  assert.equal(await page.locator('[role=dialog] article strong').innerText(),'Fixed privacy');assert.equal(await page.locator('[role=dialog] article img').count(),0);
  const announcement=page.locator('[data-nexus-announcement] img');await announcement.waitFor();await page.waitForFunction(()=>document.querySelector('[data-nexus-announcement] img')?.naturalWidth>0);assert.equal(await announcement.isVisible(),true);
  for(const language of Object.keys(catalogs)){await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>window.__nexusReleaseControl.snapshot?.language===l,language);assert.equal(await page.locator('[role=dialog]>h3').innerText(),catalogs[language]['What’s new in Hydra Nexus']);}
  await page.locator('[role=dialog] .button--primary').click();await page.locator('[role=dialog]').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>calls.some(r=>r.action==='dismissReleaseNotes'&&r.data.id==='1.2.0:5')),true);
  await page.evaluate(()=>window.__nexusReceive({event:'releaseNotes',value:{id:'1.2.0:5',version:'1.2.0',notes:'duplicate'}}));assert.equal(await page.locator('[role=dialog]').count(),0,'duplicate notifications cannot reopen an acknowledged popup');
  if(process.env.HYDRA_NATIVE_UI_PREVIEW)await page.screenshot({path:process.env.HYDRA_NATIVE_UI_PREVIEW});
  console.log('PASS: real Hydra React runtime; native settings and account controls; all eight languages; independent plugin/mode; complete hide/disable; distinct colored on/off icons; native commands; repeated mount/unmount; Steam/Notes/Mods/Backup native commits; zero body observers and no idle requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
