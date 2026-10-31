'use strict';
const orderGameActions=require('./game-actions.js');
const {trustedRendererURL,redactLog}=require('./runtime-policy.cjs');
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {app,BrowserWindow,ipcMain,dialog:nativeDialog,shell,net,protocol,Notification,safeStorage}=require('electron');
const i18n=require('./i18n.cjs'),dialog=i18n.localizedDialog(nativeDialog);
const {ActivityStore,validKey}=require('./activity.cjs');
const {ThemeStore,atomicText,fetchCSS}=require('./themes.cjs');
const createBackgroundManager=require('./background-manager.js'),{createBackgroundMedia}=require('./background-media.cjs');
const installTools=require('./tools-ui.js'),{createStorage}=require('./storage.cjs'),{createDownloadFinish}=require('./download-finish.cjs');
const installReplay=require('./replay-ui.js'),{createReplay}=require('./replay.cjs');
const notesEditor=require('./notes-ui.js'),notesMarkdown=require('./notes-markdown.js'),notesStyle=require('./notes-style.cjs'),installEmbeddedNotes=require('./embedded-notes-ui.js');
const patchDOM=require('./dom-patch.js');
const pageCleaner=require('./page-cleaner.cjs'),installPageCleaner=require('./page-cleaner-ui.js');
const installUI=require('./nexus-ui.js'),installWorkspace=require('./workspace-ui.js');
const {createStorageTransfers,commitGameLocation}=require('./storage-transfer.cjs');
const {pathToFileURL}=require('node:url');
const brand=require('./brand.cjs'),VERSION=brand.version;
const {createDiscoveryFeed}=require('./discovery-feed.cjs');
const {createCloudService}=require('./cloud-service.cjs');
const installCloudUI=require('./cloud-ui.js');
const {createSteamNews}=require('./steam-news.cjs');
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
  const nativeHandlers=new Map(),nativeHandle=ipcMain?.handle?.bind(ipcMain);
  if(nativeHandle)ipcMain.handle=function(channel,listener){const guarded=function(event,...args){if(global.__NEXUS_CLOUD_RESTORING__?.()&&/^(?:openGame|launchGame|openClassicsGame|deleteGame|removeGame|changeGame)/i.test(channel))throw Error('Wait for the save restore to finish.');if(global.__NEXUS_STORAGE_BUSY__?.(channel,...args))throw Error('Wait for the game transfer to finish.');if(global.__NEXUS_UPDATE_BUSY__?.()&&!/^(?:get|is|check|find|read)/i.test(channel))throw Error('An update operation is already running');return listener(event,...args);};nativeHandlers.set(channel,guarded);return nativeHandle(channel,guarded);};
  protocol.registerSchemesAsPrivileged([{scheme:'nexus-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
  const directory=path.join(app.getPath('appData'),'Hydra','Nexus'),configFile=path.join(directory,'settings.json');
  let config={schema:1,startupDefaultsVersion:1,plugins:{steam:true,activity:true,tabs:false,mods:false,notes:false,hardware:false,invisible:false,extractPath:true,storage:false,downloadFinish:false,pageCleaner:false,cloud:false},pageCleaner:pageCleaner.defaults(),pageLayoutOrder:pageCleaner.normalizeOrder(),invisibleMode:false,activityRecaps:true,steamPrivacy:false,notesShortcut:'CommandOrControl+Alt+Shift+N',autoCheckUpdates:true,repository:brand.repository},configError=null,binding={},running=[],cleanPluginSettings=false;
  try{const saved=JSON.parse(fs.readFileSync(configFile,'utf8'));if(saved.schema!==1||!saved.plugins||['steam','activity'].some(k=>typeof saved.plugins[k]!=='boolean'))throw Error('Invalid Nexus settings');cleanPluginSettings=Object.keys(saved.plugins).some(k=>!Object.hasOwn(config.plugins,k));const plugins=Object.fromEntries(Object.entries(config.plugins).map(([k,v])=>[k,saved.plugins[k]??v]));if(Object.values(plugins).some(v=>typeof v!=='boolean'))throw Error('Invalid plugin preference');if(saved.activityRecaps!==undefined&&typeof saved.activityRecaps!=='boolean')throw Error('Invalid activity notification preference');if(saved.invisibleMode!==undefined&&typeof saved.invisibleMode!=='boolean')throw Error('Invalid privacy preference');if(saved.startupDefaultsVersion!==undefined&&(!Number.isSafeInteger(saved.startupDefaultsVersion)||saved.startupDefaultsVersion<1))throw Error('Invalid startup defaults version');if(saved.startupDefaultsVersion===undefined){plugins.cloud=false;saved.invisibleMode=false;saved.startupDefaultsVersion=1;cleanPluginSettings=true;}if(saved.invisibleMode===undefined){saved.invisibleMode=false;cleanPluginSettings=true;}config={...config,...saved,pageCleaner:pageCleaner.normalize(saved.pageCleaner),pageLayoutOrder:pageCleaner.normalizeOrder(saved.pageLayoutOrder),plugins,invisibleMode:plugins.invisible&&saved.invisibleMode};delete config.privateCompanionEnabled;}catch(e){if(e.code!=='ENOENT'){configError='Nexus settings are damaged. The original file was preserved.';config.plugins=Object.fromEntries(Object.keys(config.plugins).map(k=>[k,false]));}}
  global.__HYDRA_NEXUS_ENABLED__=name=>config.plugins[name]===true;
  global.__NEXUS_STEAM_PRIVACY__=()=>config.steamPrivacy===true;
  // The renderer may mount before history/Notes initialization completes.
  // Local announcement and theme media must already be available at that point.
  const mediaHandler=createBackgroundMedia({directory,approved:file=>themes.approved(file),log:error=>log(error)});
  app.whenReady().then(()=>protocol.handle('nexus-media',request=>{let url;try{url=new URL(request.url);}catch{return new Response(null,{status:404});}if(url.hostname==='brand'&&url.pathname==='/invisible-mode.png'){if(!['GET','HEAD'].includes(request.method||'GET'))return new Response(null,{status:405});for(const folder of ['out','dist']){const asset=path.join(app.getAppPath(),folder,'renderer','assets','nexus-guide-invisible.webp');if(fs.existsSync(asset))return net.fetch(pathToFileURL(asset).toString());}return new Response(null,{status:404});}return mediaHandler(request);})).catch(e=>log(e));
  // Exactly one window owns the IPC token: Hydra's main window, and only while it is
  // showing the installed local renderer. The previous check also trusted a remote
  // *.pages.dev origin and fell open while mainWindow was still unset; both would hand
  // the full action surface (including updateInstall) to a window that is not the app.
  let primaryWindow=null;
  const trusted=win=>{try{
    if(!win||win.isDestroyed())return false;
    const main=binding.windowManager?.mainWindow||primaryWindow;
    if(!main||main!==win)return false;
    return trustedRendererURL(win.webContents.getURL(),app.getAppPath());
  }catch{return false;}};
  global.__HYDRA_NEXUS_TRUSTED__=trusted;
  const discovery=require('./plugin-discovery.cjs').createPluginDiscovery({directory,log:error=>log(error)});
  const themeDiscovery=require('./plugin-discovery.cjs').createPluginDiscovery({directory,theme:true,log:error=>log(error)});
  const pluginGuides=require('./plugin-guides.cjs');
  const windows=new Map(),activity=new ActivityStore({directory}),themes=new ThemeStore({directory,fetcher:(url,options)=>net.fetch(url,options)});let mutation=Promise.resolve(),backgroundOwner=null;
  const replay=createReplay({directory,activity,library,enabled:()=>config.plugins.activity===true&&config.activityRecaps!==false,running:()=>!!(binding.running?binding.running():running).length,language:()=>i18n.main.language,readAchievements:async key=>{const at=key.indexOf(':');let value=await binding.memory?.get(key.slice(0,at),key.slice(at+1));if(!value&&binding.db?.sublevel){try{value=await binding.db.sublevel('gameAchievements',{valueEncoding:'json'}).get(key);}catch(error){if(!error.notFound&&error.code!=='LEVEL_NOT_FOUND')throw error;}}return value;}});
  const services=require('./services.cjs').createServices({directory,getConfig:()=>config,saveConfig:async patch=>{if(configError)throw Error(configError);const next={...config,...patch};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();},library,log:e=>log(e)});
  const log=e=>{try{
    fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'nexus.log');
    // Keep the diagnostic log bounded so a flaky network cannot grow it forever, and
    // strip absolute paths: they carry library folders and account names.
    try{if(fs.statSync(file).size>1024*1024)fs.renameSync(file,path.join(directory,'nexus.log.1'));}catch{}
    const message=redactLog(e);
    fs.appendFileSync(file,new Date().toISOString()+' '+message+'\n');
  }catch{}};
  const discoveryFeed=createDiscoveryFeed({directory:path.join(directory,'discovery'),fetcher:(url,options)=>net.fetch(url,options),log,enrich:true});
  const steamNews=createSteamNews({allowCatalogue:true,directory:path.join(directory,'steam-news'),fetcher:(url,options)=>net.fetch(url,options),library,openExternal:url=>shell.openExternal(url),log});
  let storageOwner=null;
  const toolsEvent=(kind,state)=>{for(const win of windows.keys())send(win,{event:'libraryTools',value:{kind,state}});};
  const storage=createStorage({directory,library,protectedPaths:[directory,app.getPath('userData'),path.dirname(app.getPath('exe')),process.env.SystemRoot||'C:\\Windows'],enabled:()=>config.plugins.storage===true,resolveFolder:async game=>binding.storage?.resolve&&game.executablePath?await binding.storage.resolve(game.executablePath)||require('./storage.cjs').detectedFolder(game):require('./storage.cjs').detectedFolder(game),changed:state=>toolsEvent('storage',state)});
  const transfers=createStorageTransfers({directory:path.join(directory,'storage-transfers'),library,folderFor:key=>storage.transferFolder(key),enabled:()=>config.plugins.storage===true,protectedPaths:[directory,app.getPath('userData'),path.dirname(app.getPath('exe')),process.env.SystemRoot||'C:\\Windows'],changed:state=>toolsEvent('transfer',state),guard:async key=>{
    if(!binding.storage?.update||!binding.storage?.queue?.run||!binding.games?.put)throw Error('Game transfer is unavailable for this Hydra build.');
    if(updateShutdown.busy())throw Error('An update operation is already running');
    const active=binding.running?binding.running():running;if(active.some(g=>(typeof g==='string'?g:g.id||g.shop+':'+g.objectId)===key))throw Error('Close the selected game before moving it.');
    const download=await binding.extraction?.downloads.get(key).catch(()=>null);if(download&&(download.extracting||download.queued||['active','queued','waiting','preparing','verifying'].includes(download.status)))throw Error('Pause the download and finish extraction before moving this game.');
  },commit:game=>commitGameLocation({binding,storage,log},game)});
  global.__NEXUS_STORAGE_BUSY__=(channel,...args)=>{if(!transfers.busy())return false;if(!channel)return true;return ['openGame','openClassicsGame','removeGame','removeGameFromLibrary','deleteGameFolder','updateExecutablePath','transferGameFiles','startGameDownload','addGameToQueue'].includes(channel);};
  app.on('before-quit',event=>{if(transfers.busy()){event.preventDefault();transfers.cancel();downloadNotice('Wait for the game transfer to finish.');}});
  async function downloadRows(){const table=binding.extraction?.downloads;if(!table)throw Error('Download actions are unavailable for this Hydra build.');if(table.values)return table.values().all();if(table.iterator)return (await table.iterator().all()).map(([,row])=>row);throw Error('Download actions are unavailable for this Hydra build.');}
  function downloadNotice(message,cancel){if(typeof Notification!=='function'||Notification.isSupported?.()===false)return;const notice=new Notification({title:'Hydra Nexus',body:i18n.main.t(message)});if(cancel)notice.once('click',cancel);notice.show();}
  async function executeFinish(action){
    const cp=require('node:child_process'),system=process.env.SystemRoot||'C:\\Windows';let exe,args;
    if(action==='shutdown'){exe=path.join(system,'System32','shutdown.exe');args=['/s','/t','0'];}
    else if(action==='sleep'){await require('./native-tools.cjs').run('sleep');return;}
    else return;
    await new Promise((resolve,reject)=>cp.execFile(exe,args,{windowsHide:true,timeout:20000},error=>error?reject(error):resolve()));
  }
  const downloadFinish=createDownloadFinish({directory,enabled:()=>config.plugins.downloadFinish===true,readDownloads:downloadRows,execute:executeFinish,notify:downloadNotice,changed:state=>toolsEvent('finish',state),canAct:()=>!transfers.busy()&&!updateShutdown.busy()});
  app.on('before-quit',()=>{storage.cancel();downloadFinish.close();});
  const extraction=require('./extract-path.cjs').createExtractPaths({directory,getNative:()=>binding.extraction,enabled:()=>config.plugins.extractPath===true,changed:()=>broadcast(),log});
  const extractReady=app.whenReady().then(()=>extraction.init());
  global.__NEXUS_EXTRACTED_PATH__=(key,download)=>extraction.resolved(key,download);
  global.__NEXUS_EXTRACT_DOWNLOAD__=async(download,game)=>{await extractReady;return extraction.extract(download,game);};
  global.__NEXUS_DOWNLOAD_EVENT__=(name,listener)=>{
    if(['startGameDownload','addGameToQueue'].includes(name))return async(event,payload,...args)=>{
      const win=BrowserWindow.fromWebContents?.(event.sender);if(!win||!trusted(win))return listener(event,payload,...args);
      await extractReady;return extraction.downloadEvent(listener,event,payload,...args);
    };
    if(['openGameInstallerPath','openGameInstaller','getGameInstallerActionType'].includes(name))return async(event,shop,objectId,...args)=>{
      const win=BrowserWindow.fromWebContents?.(event.sender);if(!win||!trusted(win))return listener(event,shop,objectId,...args);
      await extractReady;const key=shop+':'+objectId,download=await binding.extraction?.downloads.get(key),target=download&&extraction.resolved(key,download);
      if(!target)return listener(event,shop,objectId,...args);
      if(name==='getGameInstallerActionType')return 'open-folder';
      const failure=await shell.openPath(target);if(failure)throw Error(failure);return name==='openGameInstaller'?true:undefined;
    };
    return listener;
  };
  // Background state must not wait for play history or Notes before the first renderer load.
  const themeReady=app.whenReady().then(async()=>{await themes.init();await themes.recoverMedia?.();}).catch(e=>{configError=e.message;log(e);});
  global.__NEXUS_BACKGROUND_STARTUP__=async()=>{await themeReady;return !!themes.public().background;};
  const cloud=createCloudService({directory,changed:value=>{for(const win of windows.keys())send(win,{event:'cloudStatus',value});},locationRoots:{home:app.getPath('home'),appData:app.getPath('appData'),localAppData:process.env.LOCALAPPDATA,documents:app.getPath('documents'),savedGames:path.join(app.getPath('home'),'Saved Games'),publicDocuments:path.join(process.env.PUBLIC||path.join(path.dirname(app.getPath('home')),'Public'),'Documents'),programData:process.env.ProgramData||path.join(path.parse(app.getPath('home')).root,'ProgramData')},library:cloudLibrary,achievementFiles:async game=>binding.collect?binding.collect(game,{includeSteamCache:false,awaitGameDirectoryLocations:true}):[],pluginEnabled:()=>config.plugins.cloud===true,isRunning:async key=>(binding.running?binding.running():running).some(g=>(typeof g==='string'?g:g.id||g.shop+':'+g.objectId)===key),dialog,safeStorage,openExternal:url=>shell.openExternal(url),protectedPaths:[app.getAppPath()]});
  global.__NEXUS_CLOUD_RESTORING__=()=>cloud.restoring();
  const ready=app.whenReady().then(async()=>{if(cleanPluginSettings&&!configError)await atomicText(configFile,JSON.stringify(config,null,2));await themeReady;await extractReady;await activity.init();await services.init();services.shortcut();broadcast();}).catch(e=>{configError=e.message;log(e);});
  function send(win,data){if(!win.isDestroyed()&&trusted(win))win.webContents.executeJavaScript('window.__nexusReceive&&window.__nexusReceive('+JSON.stringify(data)+')').catch(log);}
  const publicConfig=()=>({version:VERSION,discovery:discovery.snapshot(),themeDiscovery:themeDiscovery.snapshot(),activityRecaps:config.activityRecaps!==false,longGameOperations:true,extractPath:extraction.status(),brandIcon:brand.icon,plugins:config.plugins,pageCleaner:config.pageCleaner,pageLayoutOrder:config.pageLayoutOrder,autoCheckUpdates:config.autoCheckUpdates!==false,repository:config.repository,theme:themes.public(),steamPrivacy:config.steamPrivacy===true,privacy:privacy.status(),releaseCoverUrl:'./assets/nexus-release-3.0.webp',releaseCoverVersion:'3.0',announcementUrl:'./assets/nexus-guide-invisible.webp',extractPathAnnouncementUrl:'./assets/nexus-guide-extract.webp',notesFile:config.notesFile||null,notesShortcut:config.notesShortcut,hardwareProfile:config.hardwareProfile||null,trackingSince:activity.data.trackingSince,error:configError});
  function broadcast(){for(const win of windows.keys())send(win,{event:'config',value:publicConfig()});}
  let lastPrivacy='';
  const privacy=require('./privacy.cjs').createPrivacy({directory,getConfig:()=>config,log,changed:()=>{const value=privacy.status(),key=JSON.stringify(value);if(key===lastPrivacy)return;lastPrivacy=key;for(const win of windows.keys())send(win,{event:'privacy',value});}});
  global.__NEXUS_PRIVACY_BLOCK_GAME__=game=>privacy.blockGame(game);
  global.__HYDRA_NEXUS_BIND__=capabilities=>{binding=capabilities||{};privacy.bind({...binding.privacy,games:binding.games,running:binding.running});i18n.readHydraLanguage(binding).then(broadcast);const manager=binding.windowManager;guardNativeWindowCreation(manager);if(manager){
    if(!manager.__nexusGameEvents&&typeof manager.sendToAppWindows==='function'){const nativeSend=manager.sendToAppWindows;manager.sendToAppWindows=function(channel,...args){
      // When the main renderer is absent, no webContents.send hook receives the native tick.
      // Keep Nexus activity connected to Hydra's main-process broadcaster.
      downloadFinish.event(channel,...args);if(channel==='on-user-preferences-updated'&&typeof args[0]?.language==='string')i18n.setHydraLanguage(args[0].language);
      if(channel==='on-games-running'&&(!this.mainWindow||this.mainWindow.isDestroyed())){observe(args[0]);}
      return nativeSend.call(this,channel,...args);
    };manager.__nexusGameEvents=true;}
  }};
  async function library(){if(binding.games?.iterator)return (await binding.games.iterator().all()).map(([,game])=>game).filter(g=>!g.isDeleted);return [];}
  async function cloudLibrary(){if(binding.games?.iterator)return (await binding.games.iterator().all()).map(([,game])=>game);return [];}
  function publicGame(g){return {key:g.shop+':'+g.objectId,title:g.title,shop:g.shop,objectId:String(g.objectId),art:{hero:g.customHeroImageUrl||g.libraryHeroImageUrl||null},lastTimePlayed:g.lastTimePlayed,lifetimeMs:Math.max(g.playTimeInMilliseconds||0,g.steamPlayTimeInMilliseconds||0,g.epicPlayTimeInMilliseconds||0)};}
  function observe(items){if(!Array.isArray(items))return;running=items;ready.then(()=>cloud.observe(items)).catch(log);global.__NEXUS_STEAM_RUNNING__?.(items);if(config.plugins.activity)ready.then(()=>{if(config.plugins.activity)return activity.observe(items);}).catch(log);}
  function watch(contents){if(contents.__nexusObserved)return;contents.__nexusObserved=true;const sendOriginal=contents.send.bind(contents);contents.send=function(channel,...args){if(!binding.windowManager?.__nexusGameEvents)downloadFinish.event(channel,...args);if(channel==='on-games-running')observe(args[0]);if(channel==='on-user-preferences-updated'&&typeof args[0]?.language==='string')i18n.setHydraLanguage(args[0].language);return sendOriginal(channel,...args);};}
  async function feature(name,enabled,options={}){if(configError)throw Error(configError);if(name==='cloud'){if(typeof enabled!=='boolean')throw Error('Invalid plugin preference');if(!enabled)await cloud.cancelConnection();if(cloud.busy())throw Error('Wait for cloud operations to finish');}if(name==='downloadFinish'&&enabled)throw Error('Enable this plugin with Enable & restart Hydra.');if(name==='storage'&&!enabled){storage.cancel();transfers.cancel();}if(name==='downloadFinish'&&!enabled)downloadFinish.cancel('disabled');if(name==='extractPath'&&extraction.busy())throw Error('Wait for extraction to finish before changing this plugin.');if(!Object.hasOwn(config.plugins,name)||typeof enabled!=='boolean')throw Error('Unknown Nexus plugin');if(configError)throw Error(configError);if(name==='invisible'){const save=async()=>{const next={...config,plugins:{...config.plugins,invisible:enabled},invisibleMode:enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;};await privacy.change(enabled,save,{accepted:options.privacyImpactAccepted===true});broadcast();return publicConfig();}if(['steam','activity'].includes(name)&&(binding.running?binding.running():running).length)throw Error('Close all games before changing plugins');if(name==='notes'&&enabled&&!config.notesFile){const win=[...windows.keys()].find(trusted);const r=await services.action(win,'notesChoose');if(r.cancelled)return publicConfig();}if(name==='hardware'&&enabled&&!config.hardwareProfile)throw Error('Set up and confirm your PC specifications first');if(name==='notes'&&!enabled)await services.closeNotes();if(name==='activity'&&!enabled)await activity.stop();const next={...config,plugins:{...config.plugins,[name]:enabled}};await atomicText(configFile,JSON.stringify(next,null,2));config=next;if(name==='notes')services.shortcut();if(name==='steam'&&!enabled)global.__NEXUS_STEAM_STOP__?.();broadcast();return publicConfig();}
  async function themeAction(win,name,data){
    if(configError)throw Error(configError);
    if(name==='themeQuietColor'){await themes.selectQuietColor(data.color);broadcast();await services.syncTheme?.(themes.public());return publicConfig();}
    if(name==='themeInterface'){await themes.selectInterface(data.design);broadcast();await services.syncTheme?.(themes.public());return publicConfig();}
    if(name==='themeQuietBackground'){await themes.setQuietBackground(data.enabled);broadcast();return publicConfig();}
    if(name==='themeChooseBackground'){const r=await dialog.showOpenDialog(win,{title:'Choose Nexus background',properties:['openFile'],filters:[{name:'Images and videos',extensions:['png','jpg','jpeg','webp','gif','avif','mp4','webm','mov']}]});if(r.canceled)return {cancelled:true};const backgroundCandidate=await themes.prepareBackground(r.filePaths[0]);backgroundOwner=win;return {backgroundCandidate};}
    else if(name==='themeCommitBackground'){if(backgroundOwner!==win)throw Error('Background selection was cancelled.');await themes.commitBackground(data.file);backgroundOwner=null;}
    else if(name==='themeCancelBackground'){if(backgroundOwner===win){await themes.cancelBackground(data.file);backgroundOwner=null;}return {cancelled:true};}
    else if(name==='themeBackgroundOptions')await themes.backgroundOptions(data);
    else if(name==='themeClearBackground'){backgroundOwner=null;await themes.clearBackground();}
    else throw Error('This theme editing feature has been removed. Only custom backgrounds are supported.');
    broadcast();return publicConfig();
  }
  const gameOperations=new Map();
  function gameOperation(win,id){const operation=gameOperations.get(id);if(!operation||operation.win!==win)throw Error('Unknown Nexus action');return operation;}
  async function action(win,name,data={}){if(name==='finishCancel')return downloadFinish.cancel();if(name==='storageTransferCancel')return transfers.cancel();await ready;if(pluginRestart.busy()&&!['status','gameOperation'].includes(name))throw Error('An update operation is already running');if(updateShutdown.busy()&&!['updateStatus','status','gameOperation'].includes(name))throw Error('An update operation is already running');
    if(name==='cloudSettings'&&typeof data.enabled==='boolean'){const task=mutation.then(()=>feature('cloud',data.enabled)).then(()=>cloud.snapshot());mutation=task.catch(()=>{});return task;}if(name.startsWith('cloud'))return cloud.action(win,name,data);
    if(name==='discoveryFeed')return discoveryFeed.load({language:i18n.main.language,refresh:data.refresh===true});
    if(name==='steamNews')return steamNews.load({shop:data.shop,objectId:data.objectId,enddate:data.enddate,refresh:data.refresh===true});
    if(name==='steamNewsOpen')return steamNews.open({shop:data.shop,objectId:data.objectId,id:data.id,browser:data.browser===true});
    if(name==='startGameOperation')throw Error('Unknown Nexus action');
    if(name==='gameOperation'){const operation=gameOperation(win,data.id);return {state:operation.state,result:operation.result,error:operation.error};}
    if(name==='finishCancel')return downloadFinish.cancel();
    if(name.startsWith('finish')){if(!config.plugins.downloadFinish)throw Error('Enable Download Finish Actions in Plugins first.');await downloadFinish.init();if(name==='finishStatus')return downloadFinish.snapshot();if(name==='finishArm')return downloadFinish.arm(data.action);if(name==='finishPreferences')return downloadFinish.preferences(data.action);}
    if(name.startsWith('storage')){
      if(name==='storageClose'){if(storageOwner===win){storage.cancel();transfers.cancel();storageOwner=null;}return {closed:true};}
      if(!config.plugins.storage)throw Error('Enable Game Storage Manager in Plugins first.');
      if(name==='storageTransferCancel')return transfers.cancel();
      if(name==='storageTransferPrepare'){storageOwner=win;storage.cancel();const choice=await dialog.showOpenDialog(win,{title:'Choose where to move the selected games',properties:['openDirectory','createDirectory']});if(choice.canceled||storageOwner!==win)return {cancelled:true};return transfers.prepare(data.keys,choice.filePaths[0]);}
      if(name==='storageTransferStart'){if(storageOwner!==win)throw Error('Prepare the game transfer again.');return transfers.start(data.id);}
      if(name==='storageTransferStatus'){await transfers.init();return transfers.snapshot();}
      if(name==='storageRefresh'){if(transfers.busy())throw Error('A game transfer is already running.');storageOwner=win;storage.cancel();return storage.scan();}
      if(name==='storageReport'){storageOwner=win;return {...await storage.report(),transferSupported:!!(binding.storage?.update&&binding.storage?.queue?.run&&binding.games?.put)};}if(name==='storageScan'){if(transfers.busy())throw Error('A game transfer is already running.');storageOwner=win;return storage.scan();}
      if(name==='storageOpen'){const folder=await storage.openFolder(data.key),error=await shell.openPath(folder);if(error)throw Error('The game folder could not be opened.');return {opened:true};}
      if(name==='storageLocate'){const choice=await dialog.showOpenDialog(win,{title:i18n.main.t('Locate game folder'),properties:['openDirectory']});if(choice.canceled)return {cancelled:true};return storage.locate(data.key,choice.filePaths[0]);}
    }
    if(name==='extractPathChoose'){if(config.plugins.extractPath!==true)throw Error('Enable Extract path in Plugins first.');return extraction.choose(win,dialog,data.defaultPath);}
    if(['replayReport','replayDay','replayDue','replayPreferences','replayAcknowledge'].includes(name)){if(!config.plugins.activity)throw Error('Enable Play Activity in Plugins first.');if(name==='replayReport')return replay.report(data);if(name==='replayDay')return replay.day(data);if(name==='replayDue')return replay.due();const task=mutation.then(()=>name==='replayPreferences'?replay.preferences(data):replay.acknowledge(data.id));mutation=task.catch(()=>{});return task;}
    if(name==='pageLayoutOrder'){const task=mutation.then(async()=>{if(configError)throw Error(configError);const next={...config,pageLayoutOrder:pageCleaner.changeOrder(config.pageLayoutOrder,data.group,data.order)};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='pageCleanerLibrary')return {keys:(await library()).map(game=>game.shop+':'+game.objectId)};
    if(name==='pageCleanerSetting'){const task=mutation.then(async()=>{if(configError)throw Error(configError);const next={...config,pageCleaner:pageCleaner.change(config.pageCleaner,data.section,data.scope)};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='status')return {...publicConfig(),games:(await library()).map(publicGame)};
    if(name==='game'){if(!validKey(data.key))throw Error('Invalid game');let game;if(binding.games?.get){try{game=await binding.games.get(data.key);}catch(e){if(e.code!=='LEVEL_NOT_FOUND'&&!e.notFound)throw e;}}else game=(await library()).find(g=>g.shop+':'+g.objectId===data.key);return {game:game&&!game.isDeleted?publicGame(game):null,...activity.summary(data.key,{history:data.history!==false}),enabled:config.plugins.activity};}
    if(name==='acknowledgeTheme'){await themeDiscovery.acknowledge('quietMint');broadcast();return publicConfig();}
    if(name==='acknowledgePlugin'){await discovery.acknowledge(data.name);broadcast();return publicConfig();}
    if(name==='enableFinishRestart'){if(configError)throw Error(configError);return pluginRestart.enable(win);}
    if(name==='feature'){if(data.name==='downloadFinish'&&data.enabled===false)downloadFinish.cancel('disabled');if(data.name==='storage'&&data.enabled===false){storage.cancel();transfers.cancel();}const task=mutation.then(()=>feature(data.name,data.enabled,data));mutation=task.catch(()=>{});return task;}
    if(name==='activityRecaps'){const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean')throw Error('Invalid activity notification preference');const next={...config,activityRecaps:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='updatePreferences'){
      const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean')throw Error('Invalid automatic update preference');const next={...config,autoCheckUpdates:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;
    }
    if(name==='navigateRoute'){const value=data.route;if(typeof value!=='string'||value.length>12000||/[\x00-\x20\\#]/.test(value)||!/^\/(?:game\/[\w-]+\/[\w.-]+|catalogue|library)(?:\?[^#]*)?$/.test(value))throw Error('Invalid tab route');win.webContents.send('on-navigate',value);return {opened:true};}
    if(name==='navigateGame'){if(!validKey(data.key))throw Error('Invalid game tab');const [shop,id]=data.key.split(':');win.webContents.send('on-navigate','/game/'+shop+'/'+id);return {opened:true};}
    if(name==='showUpdater'){win.webContents.send('on-navigate','/settings');return {opened:true};}
    if(name.startsWith('theme')){const task=mutation.then(()=>themeAction(win,name,data));mutation=task.catch(()=>{});return task;}
    if(name==='steamPrivacy'){const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean')throw Error('Invalid privacy preference');const next={...config,steamPrivacy:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;broadcast();return publicConfig();});mutation=task.catch(()=>{});return task;}
    if(name==='invisibleMode'){const task=mutation.then(async()=>{if(configError)throw Error(configError);if(typeof data.enabled!=='boolean'||!config.plugins.invisible)throw Error(i18n.main.t('Enable Invisible Mode in Plugins first.'));await privacy.change(data.enabled,async()=>{const next={...config,invisibleMode:data.enabled};await atomicText(configFile,JSON.stringify(next,null,2));config=next;},{accepted:data.privacyImpactAccepted===true});return {privacy:privacy.status()};});mutation=task.catch(()=>{});return task;}
    if(name==='dismissReleaseNotes')return releaseNotes.dismiss(data.id);
    if(name==='confirmUpdate')return updateConfirmation.respond(win,data);
    if(name==='openReleasePage')return shell.openExternal('https://github.com/M0KA40/Hydra-Nexus/releases/tag/v'+VERSION);
    if(name==='openRepository')return shell.openExternal('https://github.com/M0KA40/Hydra-Nexus');
    if(/^(notes|hardware|verifyHardware|nexusOpen|nexusKey|nexusHelp)/.test(name)){if(configError)throw Error(configError);const perform=async()=>{const result=await services.action(win,name,data);if(['notesChoose','notesShortcut'].includes(name))services.shortcut();return result;};if(!['notesChoose','notesRestore','notesShortcut','hardwareSave','nexusKey'].includes(name))return perform();const task=mutation.then(perform);mutation=task.catch(()=>{});return task;}
    if(name==='openData')return shell.openPath(directory);
    if(name==='installUpdate'&&([...gameOperations.values()].some(operation=>operation.state==='running')||(binding.running?binding.running():running).length))throw Error('Close games before restarting to update');
    if(name==='updateStatus'||name==='checkUpdates'||name==='installUpdate'||name==='chooseUpdate')return updater.action(win,name,data);
    throw Error('Unknown Nexus action');
  }
  const updateShutdown=require('./update-shutdown.cjs').createUpdateShutdown({app,getNative:()=>binding.updateExit,guard:()=>{if(cloud.busy())throw Error('Wait for Nexus Cloud operations to finish.');if(transfers.busy())throw Error('Wait for the game transfer to finish.');if(extraction.busy())throw Error('Wait for extraction to finish before updating.');if([...gameOperations.values()].some(operation=>operation.state==='running')||(binding.running?binding.running():running).length)throw Error('Close games before restarting to update');binding.updateExit?.assertIdle();},flush:async signal=>{const check=()=>{if(signal?.aborted)throw Error('Saving before the update did not finish. Hydra was kept open.');};check();await mutation;check();await extraction.flush();check();await services.flushNotes();check();await privacy.flush();check();await activity.queue;check();await activity.stop();check();}});
  const pluginRestart=require('./plugin-restart.cjs').createPluginRestart({app,dialog,shutdown:updateShutdown,getConfig:()=>config,guard:()=>{if(updateShutdown.busy())throw Error('An update operation is already running');if(typeof app.relaunch!=='function')throw Error('This Hydra version does not support a safe update restart. Close Hydra and run the installer.');if(cloud.busy()||transfers.busy()||extraction.busy()||[...gameOperations.values()].some(op=>op.state==='running')||(binding.running?binding.running():running).length)throw Error('Close games before restarting to update');binding.updateExit?.assertIdle();},saveConfig:async enabled=>{const next={...config,plugins:{...config.plugins,downloadFinish:enabled}};await atomicText(configFile,JSON.stringify(next,null,2));config=next;}});
  global.__NEXUS_UPDATE_BUSY__=()=>updateShutdown.busy()||pluginRestart.busy();
  const updateConfirmation=require('./update-confirmation.cjs').createUpdateConfirmation({send,trusted,dialog});
  const updater=require('./updater.cjs').createUpdater({directory,version:VERSION,revision:brand.revision||1,getRepository:()=>config.repository,fetcher:(url,options)=>net.fetch(url,options),app,dialog,shutdown:updateShutdown,confirm:updateConfirmation.confirm});
  app.whenReady().then(async()=>{await ready;if(!configError)await updater.started();}).catch(log);
  const releaseNotes=require('./release-notes.cjs').createReleaseNotes({directory,version:VERSION,revision:brand.revision||1,load:()=>updater.installedNotes(),log,changed:value=>{for(const win of windows.keys())send(win,{event:'releaseNotes',value});}});
  let automaticChecking=false,lastUpdateNotice=null,nextUpdateNotice=0,pendingUpdateNotice=null;
  async function automaticUpdateCheck(){
    if(configError||config.autoCheckUpdates===false||automaticChecking)return;
    automaticChecking=true;
    try{await ready;const result=await updater.action(null,'checkUpdates');if(config.autoCheckUpdates!==false&&result.release?.newer&&(lastUpdateNotice!==result.release.version+':'+result.release.revision||Date.now()>=nextUpdateNotice)){
      lastUpdateNotice=result.release.version+':'+result.release.revision;nextUpdateNotice=Date.now()+6*60*60*1000;
      let delivered=false;for(const win of windows.keys())if(trusted(win)&&win.webContents.__nexusInjectedReady===true){send(win,{event:'updateAvailable',value:result});delivered=true;}pendingUpdateNotice=delivered?null:result;
    }}catch(e){log(e);}finally{automaticChecking=false;}
  }
  app.whenReady().then(()=>{setTimeout(automaticUpdateCheck,15000).unref?.();setInterval(automaticUpdateCheck,6*60*60*1000).unref?.();});
  const windowPlaybackState=win=>({focused:win.isFocused?.()??true,visible:(win.isVisible?.()??true)&&!(win.isMinimized?.()??false)});
  function attach(win){if(windows.has(win))return;let inFlight=0;const token=crypto.randomBytes(32).toString('hex');windows.set(win,token);if(!primaryWindow)primaryWindow=win;
    // Keep Hydra's window throttled while it sits in the tray so background renderer
    // timers, media and compositor work cannot hold the process at full cost.
    try{win.webContents.setBackgroundThrottling?.(true);}catch(error){log(error);}
    watch(win.webContents);const stateEvents=['focus','blur','minimize','restore','show','hide'],sendWindowState=()=>send(win,{event:'windowState',value:windowPlaybackState(win)});for(const event of stateEvents)win.on(event,sendWindowState);const inject=()=>{const contents=win.webContents;if(win.isDestroyed()||!trusted(win)||contents.__nexusInjected)return;contents.__nexusInjected=true;Promise.all([themeReady,extractReady]).then(()=>win.webContents.executeJavaScript(i18n.rendererScript()+'window.__nexusNotesEditor=('+notesEditor.toString()+');window.__nexusRenderNotesMarkdown=('+notesMarkdown.toString()+');window.__nexusNotesStyle='+JSON.stringify(notesStyle)+';window.__nexusOrderGameActions=('+orderGameActions.toString()+');window.__nexusPatchDOM=('+patchDOM.toString()+');window.__nexusCreateBackgroundManager=('+createBackgroundManager.toString()+');('+installUI.toString()+')('+JSON.stringify({token,guides:pluginGuides,config:publicConfig(),windowState:windowPlaybackState(win)})+')').then(()=>win.webContents.executeJavaScript('('+installReplay.toString()+')()')).then(()=>win.webContents.executeJavaScript('('+installTools.toString()+')()')).then(()=>win.webContents.executeJavaScript('('+installPageCleaner.toString()+')()')).then(()=>win.webContents.executeJavaScript('('+installEmbeddedNotes.toString()+')()')).then(()=>win.webContents.executeJavaScript('('+installWorkspace.toString()+')()')).then(()=>win.webContents.executeJavaScript('('+installCloudUI.toString()+')()')).then(()=>{sendWindowState();if(trusted(win))void releaseNotes.prepare();if(releaseNotes.current()&&trusted(win))send(win,{event:'releaseNotes',value:releaseNotes.current()});if(pendingUpdateNotice&&config.autoCheckUpdates!==false&&trusted(win)){send(win,{event:'updateAvailable',value:pendingUpdateNotice});pendingUpdateNotice=null;}contents.__nexusInjectedReady=true;})).catch(error=>{contents.__nexusInjected=false;log(error);});};
    // A notice queued while the window was not trusted must still reach the user once the
    // document is injected and listening. It never runs while injection is still in
    // flight: that pass delivers the notice itself, and an early send would be dropped.
    const flushPending=()=>{const contents=win.webContents;if(!pendingUpdateNotice||win.isDestroyed()||contents.__nexusInjectedReady!==true||!trusted(win)||config.autoCheckUpdates===false)return;send(win,{event:'updateAvailable',value:pendingUpdateNotice});pendingUpdateNotice=null;};
    win.webContents.on('dom-ready',inject);win.webContents.on('did-finish-load',inject);win.webContents.on('did-finish-load',flushPending);win.webContents.on('did-navigate',()=>{win.webContents.__nexusInjected=false;win.webContents.__nexusInjectedReady=false;});win.webContents.on('console-message',(...args)=>{if(!trusted(win))return;const details=args.find(x=>x&&typeof x==='object'&&typeof x.message==='string'),message=details?details.message:args[2];if(typeof message!=='string'||!message.startsWith('__HYDRA_NEXUS__')||message.length>2*1024*1024)return;let req;try{req=JSON.parse(message.slice('__HYDRA_NEXUS__'.length));if(req.token!==token||!Number.isSafeInteger(req.id)||typeof req.action!=='string')return;}catch{return;}if(inFlight>=16&&!['finishCancel','storageTransferCancel','storageClose'].includes(req.action)){send(win,{id:req.id,error:'Too many pending requests. Try again shortly.'});return;}inFlight++;Promise.resolve().then(()=>action(win,req.action,req.data||{})).then(result=>send(win,{id:req.id,result}),e=>{log(e);send(win,{id:req.id,error:e.message});}).finally(()=>inFlight--);});win.on('closed',()=>{if(storageOwner===win){storage.cancel();transfers.cancel();storageOwner=null;}if(backgroundOwner===win){const task=mutation.then(async()=>{if(backgroundOwner===win){await themes.cancelBackground();backgroundOwner=null;}});mutation=task.catch(log);}for(const event of stateEvents)win.removeListener(event,sendWindowState);windows.delete(win);if(primaryWindow===win)primaryWindow=null;});if(!win.webContents.isLoading())inject();}
  app.on('web-contents-created',(_event,contents)=>watch(contents));app.on('browser-window-created',(_event,win)=>attach(win));app.whenReady().then(()=>BrowserWindow.getAllWindows().forEach(attach));
  // Let Hydra own shutdown, especially its single-instance rejection before app readiness.
  // Never intercept Hydra's quit. A user-confirmed updater may request a normal quit.
  app.on('will-quit',()=>{cloud.cancelOnExit();if(app.isReady()&&app.hasSingleInstanceLock?.()!==false){try{privacy.flushOnExit();}catch(e){log(e);}try{activity.flushOnExit();}catch(e){log(e);}try{services.notes.flushOnExit();}catch(e){log(e);}}});
  global.__NEXUS_NATIVE_GAME_DETAILS__=async(id,shop)=>{const listener=nativeHandlers.get('getGameShopDetails'),win=[...windows.keys()].find(trusted);if(!listener||!win)throw Error('Native game details are unavailable');return listener({sender:win.webContents},id,shop,'en',{});};
  require('./steam.cjs');
}
