'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {app,BrowserWindow,dialog:nativeDialog,shell,net,protocol}=require('electron');
const i18n=require('./i18n.cjs'),dialog=i18n.localizedDialog(nativeDialog);
const {ActivityStore,validKey}=require('./activity.cjs');
const {ThemeStore,atomicText,fetchCSS}=require('./themes.cjs');
const installUI=require('./nexus-ui.js'),installWorkspace=require('./workspace-ui.js');
const {pathToFileURL}=require('node:url');
const brand=require('./brand.cjs'),VERSION=brand.version;
function guardNativeWindowCreation(manager){
  if(!manager||manager.__nexusCreationGuard||typeof manager.createMainWindow!=='function'||typeof manager.redirect!=='function')return;
  manager.__nexusCreationGuard=true;
  const nativeCreate=manager.createMainWindow,nativeRedirect=manager.redirect;let creating=null;
  manager.createMainWindow=function(...args){
    if(creating)return creating;
    if(this.mainWindow&&!this.mainWindow.isDestroyed())return Promise.resolve(this.mainWindow);
    const task=Promise.resolve().then(async()=>{
      await nativeCreate.apply(this,args);const win=this.mainWindow;
      // Native creation starts loading without awaiting it. Redirecting during that load
      // aborts it and can trigger Hydra's fallback loader over the requested theme route.
      if(win&&!win.isDestroyed()&&win.webContents.isLoading())await new Promise(resolve=>{
        const finish=()=>{clearTimeout(timer);win.webContents.removeListener('did-finish-load',finish);win.removeListener('closed',finish);resolve();};
        const timer=setTimeout(finish,20000);timer.unref?.();win.webContents.once('did-finish-load',finish);win.once('closed',finish);
        if(!win.webContents.isLoading())finish();
      });
      return win;
    });
    creating=task.finally(()=>{creating=null;});return creating;
  };
  manager.redirect=async function(...args){if(creating||!this.mainWindow||this.mainWindow.isDestroyed())await this.createMainWindow();return nativeRedirect.apply(this,args);};
}
if(!global.__HYDRA_NEXUS__){
  global.__HYDRA_NEXUS__=true;
  protocol.registerSchemesAsPrivileged([{scheme:'nexus-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
  const directory=path.join(app.getPath('appData'),'Hydra','Nexus'),configFile=path.join(directory,'settings.json');
  let config={schema:1,plugins:{steam:true,backup:true,activity:true,tabs:true,mods:true,notes:false,hardware:false,lowResource:false,invisible:false},invisibleMode:false,steamPrivacy:false,notesShortcut:'CommandOrControl+Alt+Shift+N',autoCheckUpdates:true,repository:brand.repository},configError=null,binding={},running=[],cleanPluginSettings=false;
  try{const saved=JSON.parse(fs.readFileSync(configFile,'utf8'));if(saved.schema!==1||!saved.plugins||['steam','backup','activity'].some(k=>typeof saved.plugins[k]!=='boolean'))throw Error('Invalid Nexus settings');cleanPluginSettings=Object.keys(saved.plugins).some(k=>!Object.hasOwn(config.plugins,k));const plugins=Object.fromEntries(Object.entries(config.plugins).map(([k,v])=>[k,saved.plugins[k]??v]));if(Object.values(plugins).some(v=>typeof v!=='boolean'))throw Error('Invalid plugin preference');if(saved.invisibleMode!==undefined&&typeof saved.invisibleMode!=='boolean')throw Error('Invalid privacy preference');if(saved.invisibleMode===undefined){saved.invisibleMode=plugins.invisible;cleanPluginSettings=true;}config={...config,...saved,plugins,invisibleMode:plugins.invisible&&saved.invisibleMode};}catch(e){if(e.code!=='ENOENT'){configError='Nexus settings are damaged. The original file was preserved.';config.plugins=Object.fromEntries(Object.keys(config.plugins).map(k=>[k,false]));}}
  global.__HYDRA_NEXUS_ENABLED__=name=>config.plugins[name]===true;
  global.__NEXUS_STEAM_PRIVACY__=()=>config.steamPrivacy===true;
  // The renderer may mount before history/Notes initialization completes.
  // Local announcement and theme media must already be available at that point.
  app.whenReady().then(()=>protocol.handle('nexus-media',request=>{const url=new URL(request.url),file=decodeURIComponent(url.pathname.slice(1));if(url.hostname==='brand'&&file==='invisible-mode.png'){for(const folder of ['out','dist']){const asset=path.join(app.getAppPath(),folder,'renderer','assets','nexus-invisible-mode.png');if(fs.existsSync(asset))return net.fetch(pathToFileURL(asset).toString());}return new Response('Not found',{status:404});}if(url.hostname!=='assets'||!/^[-a-f0-9]{36}\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i.test(file))return new Response('Not found',{status:404});return net.fetch(pathToFileURL(path.join(directory,'media',file)).toString(),{headers:request.headers});})).catch(e=>log(e));
  const trusted=win=>{try{if(binding.windowManager?.mainWindow&&binding.windowManager.mainWindow!==win)return false;const u=new URL(win.webContents.getURL());return u.protocol==='file:'&&/[\\/]renderer[\\/]/i.test(decodeURIComponent(u.pathname))||u.protocol==='https:'&&/^release-v[0-9-]+\.hydra-eqi\.pages\.dev$/.test(u.hostname);}catch{return false;}};
  global.__HYDRA_NEXUS_TRUSTED__=trusted;
  const windows=new Map(),activity=new ActivityStore({directory}),themes=new ThemeStore({directory,fetcher:(url,options)=>net.fetch(url,options)});let mutation=Promise.resolve();
  const services=require('./services.cjs').createServices({directory,getConfig:()=>config,saveConfig:async patch=>{const next={...config,...patch};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();},library,log:e=>log(e)});
  const log=e=>{try{fs.mkdirSync(directory,{recursive:true});fs.appendFileSync(path.join(directory,'nexus.log'),new Date().toISOString()+' '+String(e?.message||e).slice(0,800)+'\n');}catch{}};
  const ready=app.whenReady().then(async()=>{if(cleanPluginSettings)await atomicText(configFile,JSON.stringify(config,null,2));await activity.init();await themes.init();await services.init();services.shortcut();broadcast();}).catch(e=>{configError=e.message;log(e);});
  function send(win,data){if(!win.isDestroyed()&&trusted(win))win.webContents.executeJavaScript('window.__nexusReceive&&window.__nexusReceive('+JSON.stringify(data)+')').catch(log);}
  const publicConfig=()=>({version:VERSION,brandIcon:brand.icon,plugins:config.plugins,autoCheckUpdates:config.autoCheckUpdates!==false,repository:config.repository,theme:themes.public(),steamPrivacy:config.steamPrivacy===true,privacy:privacy.status(),announcementUrl:'./assets/nexus-invisible-mode.png',notesFile:config.notesFile||null,notesShortcut:config.notesShortcut,hardwareProfile:config.hardwareProfile||null,trackingSince:activity.data.trackingSince,error:configError});
  function broadcast(){for(const win of windows.keys())send(win,{event:'config',value:publicConfig()});}
  let lastPrivacy='';
  const privacy=require('./privacy.cjs').createPrivacy({directory,getConfig:()=>config,log,changed:()=>{const value=privacy.status(),key=JSON.stringify(value);if(key===lastPrivacy)return;lastPrivacy=key;for(const win of windows.keys())send(win,{event:'privacy',value});}});
  global.__NEXUS_PRIVACY_BLOCK_GAME__=game=>privacy.blockGame(game);
  global.__HYDRA_NEXUS_BIND__=capabilities=>{binding=capabilities||{};privacy.bind({...binding.privacy,games:binding.games,running:binding.running});i18n.readHydraLanguage(binding).then(broadcast);const manager=binding.windowManager;guardNativeWindowCreation(manager);if(manager){
    if(!manager.__nexusGameEvents&&typeof manager.sendToAppWindows==='function'){const nativeSend=manager.sendToAppWindows;manager.sendToAppWindows=function(channel,...args){
      // When the main renderer is absent, no webContents.send hook receives the native tick.
      // Keep Nexus activity and automatic backups connected to Hydra's main-process broadcaster.
      if(channel==='on-user-preferences-updated'&&typeof args[0]?.language==='string')i18n.setHydraLanguage(args[0].language);
      if(channel==='on-games-running'&&(!this.mainWindow||this.mainWindow.isDestroyed())){observe(args[0]);global.__NEXUS_BACKUP_OBSERVE__?.(args[0]);}
      return nativeSend.call(this,channel,...args);
    };manager.__nexusGameEvents=true;}
  }global.__HYDRA_BACKUP_BIND__?.(capabilities);};
  async function library(){if(binding.games?.iterator)return (await binding.games.iterator().all()).map(([,game])=>game).filter(g=>!g.isDeleted);return [];}
  function publicGame(g){return {key:g.shop+':'+g.objectId,title:g.title,shop:g.shop,objectId:String(g.objectId),lastTimePlayed:g.lastTimePlayed,lifetimeMs:Math.max(g.playTimeInMilliseconds||0,g.steamPlayTimeInMilliseconds||0,g.epicPlayTimeInMilliseconds||0)};}
  function observe(items){if(!Array.isArray(items))return;running=items;if(config.plugins.activity)ready.then(()=>activity.observe(items)).catch(log);}
  function watch(contents){if(contents.__nexusObserved)return;contents.__nexusObserved=true;const sendOriginal=contents.send.bind(contents);contents.send=function(channel,...args){if(channel==='on-games-running')observe(args[0]);if(channel==='on-user-preferences-updated'&&typeof args[0]?.language==='string')i18n.setHydraLanguage(args[0].language);return sendOriginal(channel,...args);};}
  async function feature(name,enabled){if(!Object.hasOwn(config.plugins,name)||typeof enabled!=='boolean')throw Error('Unknown Nexus plugin');if(configError)throw Error(configError);if(name==='invisible'){const save=async()=>{const next={...config,plugins:{...config.plugins,invisible:enabled},invisibleMode:enabled?config.invisibleMode:false};await atomicText(configFile,JSON.stringify(next,null,2));config=next;};if(!enabled&&config.invisibleMode)await privacy.change(false,save);else await save();broadcast();return publicConfig();}if(['steam','backup','activity'].includes(name)&&(binding.running?binding.running():running).length)throw Error('Close all games before changing plugins');if(name==='backup'&&global.__NEXUS_BACKUP_BUSY__?.())throw Error('Finish the backup, upload or restore first');if(name==='notes'&&enabled&&!config.notesFile){const win=[...windows.keys()].find(trusted);const r=await services.action(win,'notesChoose');if(r.cancelled)return publicConfig();}if(name==='hardware'&&enabled&&!config.hardwareProfile)throw Error('Set up and confirm your PC specifications first');if(name==='notes'&&!enabled)await services.closeNotes();if(name==='activity'&&!enabled)await activity.stop();const next={...config,plugins:{...config.plugins,[name]:enabled}};await atomicText(configFile,JSON.stringify(next,null,2));config=next;if(name==='notes')services.shortcut();broadcast();return publicConfig();}
  async function themeAction(win,name,data){
    if(configError)throw Error(configError);
    if(name==='themeChooseBackground'){const r=await dialog.showOpenDialog(win,{title:'Choose Nexus background',properties:['openFile'],filters:[{name:'Images and videos',extensions:['png','jpg','jpeg','webp','gif','avif','mp4','webm','mov']}]});if(r.canceled)return {cancelled:true};await themes.setBackground(r.filePaths[0]);}
    else if(name==='themeBackgroundOptions')await themes.backgroundOptions(data);
    else if(name==='themeClearBackground')await themes.clearBackground();
    else throw Error('This theme editing feature has been removed. Only custom backgrounds are supported.');
    broadcast();return publicConfig();
  }
  async function action(win,name,data={}){await ready;
    if(name==='status')return {...publicConfig(),games:(await library()).map(publicGame)};
    if(name==='game'){if(!validKey(data.key))throw Error('Invalid game');let game;if(binding.games?.get){try{game=await binding.games.get(data.key);}catch(e){if(e.code!=='LEVEL_NOT_FOUND'&&!e.notFound)throw e;}}else game=(await library()).find(g=>g.shop+':'+g.objectId===data.key);return {game:game&&!game.isDeleted?publicGame(game):null,...activity.summary(data.key,{history:data.history!==false}),enabled:config.plugins.activity};}
    if(name==='feature'){const task=mutation.then(()=>feature(data.name,data.enabled));mutation=task.catch(()=>{});return task;}
    if(name==='updatePreferences'){
      const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean')throw Error('Invalid automatic update preference');const next={...config,autoCheckUpdates:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;
    }
    if(name==='navigateRoute'){const value=data.route;if(typeof value!=='string'||value.length>12000||/[\x00-\x20\\#]/.test(value)||!/^\/(?:game\/[\w-]+\/[\w.-]+|catalogue|library)(?:\?[^#]*)?$/.test(value))throw Error('Invalid tab route');win.webContents.send('on-navigate',value);return {opened:true};}
    if(name==='navigateGame'){if(!validKey(data.key))throw Error('Invalid game tab');const [shop,id]=data.key.split(':');win.webContents.send('on-navigate','/game/'+shop+'/'+id);return {opened:true};}
    if(name==='showUpdater'){win.webContents.send('on-navigate','/settings');return {opened:true};}
    if(name.startsWith('theme')){const task=mutation.then(()=>themeAction(win,name,data));mutation=task.catch(()=>{});return task;}
    if(name==='steamPrivacy'){const task=mutation.then(async()=>{if(typeof data.enabled!=='boolean')throw Error('Invalid privacy preference');const next={...config,steamPrivacy:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='invisibleMode'){const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean'||!config.plugins.invisible)throw Error(i18n.main.t('Enable Invisible Mode in Plugins first.'));await privacy.change(data.enabled,async()=>{const next={...config,invisibleMode:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;});return {privacy:privacy.status()};});mutation=task.catch(()=>{});return task;}
    if(name==='resumePrivateSharing'){if(configError)throw Error(configError);const task=mutation.then(async()=>{const result=await privacy.resume(win,dialog);return result.cancelled?result:publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='dismissReleaseNotes')return releaseNotes.dismiss(data.id);
    if(name==='openReleasePage')return shell.openExternal('https://github.com/M0KA40/Hydra-Nexus/releases/tag/v'+VERSION);
    if(name==='openRepository')return shell.openExternal('https://github.com/M0KA40/Hydra-Nexus');
    if(name==='gameBackup'||name==='gameImport'){if(!config.plugins.backup)throw Error('Enable Backup first');if(!validKey(data.key)||(await library()).every(g=>g.shop+':'+g.objectId!==data.key))throw Error('Unknown library game');return global.__NEXUS_BACKUP_ACTION__(win,name==='gameBackup'?'backup':'gameImport',data);}
    if(/^(notes|hardware|verifyHardware|nexusOpen|nexusKey|nexusHelp)/.test(name)){if(configError)throw Error(configError);const perform=async()=>{const result=await services.action(win,name,data);if(['notesChoose','notesShortcut'].includes(name))services.shortcut();return result;};if(!['notesChoose','notesRestore','notesShortcut','hardwareSave','nexusKey'].includes(name))return perform();const task=mutation.then(perform);mutation=task.catch(()=>{});return task;}
    if(name==='openData')return shell.openPath(directory);
    if(name==='installUpdate'&&((binding.running?binding.running():running).length||global.__NEXUS_BACKUP_BUSY__?.()))throw Error('Close games and finish backup operations before restarting to update');
    if(name==='installUpdate')await services.flushNotes();
    if(name==='updateStatus'||name==='checkUpdates'||name==='installUpdate'||name==='chooseUpdate')return updater.action(win,name,data);
    throw Error('Unknown Nexus action');
  }
  const updater=require('./updater.cjs').createUpdater({directory,version:VERSION,revision:brand.revision||1,getRepository:()=>config.repository,fetcher:(url,options)=>net.fetch(url,options),app,dialog});
  const releaseNotes=require('./release-notes.cjs').createReleaseNotes({directory,version:VERSION,revision:brand.revision||1,load:()=>updater.installedNotes(),log,changed:value=>{for(const win of windows.keys())send(win,{event:'releaseNotes',value});}});
  let automaticChecking=false,lastUpdateNotice=null,nextUpdateNotice=0,pendingUpdateNotice=null;
  async function automaticUpdateCheck(){
    if(configError||config.autoCheckUpdates===false||automaticChecking)return;
    automaticChecking=true;
    try{await ready;const result=await updater.action(null,'checkUpdates');if(config.autoCheckUpdates!==false&&result.release?.newer&&(lastUpdateNotice!==result.release.version+':'+result.release.revision||Date.now()>=nextUpdateNotice)){
      lastUpdateNotice=result.release.version+':'+result.release.revision;nextUpdateNotice=Date.now()+6*60*60*1000;
      let delivered=false;for(const win of windows.keys())if(trusted(win)){send(win,{event:'updateAvailable',value:result});delivered=true;}pendingUpdateNotice=delivered?null:result;
    }}catch(e){log(e);}finally{automaticChecking=false;}
  }
  app.whenReady().then(()=>{setTimeout(automaticUpdateCheck,15000).unref?.();setInterval(automaticUpdateCheck,6*60*60*1000).unref?.();});
  function attach(win){if(windows.has(win))return;let inFlight=0;const token=crypto.randomBytes(32).toString('hex');windows.set(win,token);watch(win.webContents);const inject=()=>{if(!win.isDestroyed()&&trusted(win))Promise.resolve().then(()=>win.webContents.executeJavaScript(i18n.rendererScript()+'('+installUI.toString()+')('+JSON.stringify({token,config:publicConfig()})+')').then(()=>win.webContents.executeJavaScript('('+installWorkspace.toString()+')()')).then(()=>{if(trusted(win))void releaseNotes.prepare();if(releaseNotes.current()&&trusted(win))send(win,{event:'releaseNotes',value:releaseNotes.current()});if(pendingUpdateNotice&&config.autoCheckUpdates!==false&&trusted(win)){send(win,{event:'updateAvailable',value:pendingUpdateNotice});pendingUpdateNotice=null;}})).catch(log);};win.webContents.on('dom-ready',inject);win.webContents.on('did-finish-load',inject);win.webContents.on('console-message',(...args)=>{if(!trusted(win))return;const details=args.find(x=>x&&typeof x==='object'&&typeof x.message==='string'),message=details?details.message:args[2];if(typeof message!=='string'||!message.startsWith('__HYDRA_NEXUS__')||message.length>2*1024*1024)return;let req;try{req=JSON.parse(message.slice('__HYDRA_NEXUS__'.length));if(req.token!==token||!Number.isSafeInteger(req.id)||typeof req.action!=='string')return;}catch{return;}if(inFlight>=16){send(win,{id:req.id,error:'Too many pending requests. Try again shortly.'});return;}inFlight++;Promise.resolve().then(()=>action(win,req.action,req.data||{})).then(result=>send(win,{id:req.id,result}),e=>{log(e);send(win,{id:req.id,error:e.message});}).finally(()=>inFlight--);});win.on('closed',()=>windows.delete(win));if(!win.webContents.isLoading())inject();}
  app.on('web-contents-created',(_event,contents)=>watch(contents));app.on('browser-window-created',(_event,win)=>attach(win));app.whenReady().then(()=>BrowserWindow.getAllWindows().forEach(attach));
  // Let Hydra own shutdown, especially its single-instance rejection before app readiness.
  // Never intercept Hydra's quit. A user-confirmed updater may request a normal quit.
  app.on('will-quit',()=>{if(app.isReady()&&app.hasSingleInstanceLock?.()!==false){try{privacy.flushOnExit();}catch(e){log(e);}try{activity.flushOnExit();}catch(e){log(e);}try{services.notes.flushOnExit();}catch(e){log(e);}}});
  require('./steam.cjs');require('./bridge.cjs');
}
