'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'extract-hooks-')),quote=s=>"'"+s.replace(/'/g,"''")+"'";let native=process.env.HYDRA_NATIVE_FIXTURES;
 if(!native){
  native=path.join(root,'synthetic-native');await fs.mkdir(native);
  await fs.writeFile(path.join(native,'hydra-main.mjs'),`const registerEvent = (name, listener)=>{};class SevenZip{};const downloadsSublevel={},deleteArchiveFile=()=>{};
class GameFilesManager {
 constructor(shop,objectId){this.shop=shop;this.objectId=objectId;}get gameKey(){return levelKeys.game(this.shop,this.objectId);}
 async setExtractionComplete(){const download=await downloadsSublevel.get(this.gameKey);const gamePath = path.join(download.downloadPath, download.folderName);await getDirectorySize(gamePath);WindowManager.sendToAppWindows('on-extraction-complete');}
 async searchAndBindExecutable(){const download={};const gameFolderPath = path.join(download.downloadPath, download.folderName);}
 async autoLinkClassicsDiscs(){const download={};const gameFolderPath = path.join(download.downloadPath, download.folderName);}
}
class PremiumizeClient{};class DownloadManager{static async handleExtraction(download, game) {}}`);
  await fs.writeFile(path.join(native,'hydra-renderer.js'),`const handleFriendsClick=()=>{};const label='sidebar-profile__dropdown-item';jsxRuntimeExports.jsx("div", { className: "sidebar-profile__dropdown-separator" });jsxRuntimeExports.jsx(BottomPanel, {});`+['settings__sidebar','settings__panel','sidebar__menu','hero-panel__actions','game-options-modal__container'].map(name=>'jsxRuntimeExports.jsx("div", { className: "'+name+'" });').join('')+`
function DownloadSettingsModal(){const payload={automaticallyExtract,automaticallyDeleteArchiveFiles,fileSize: repack.fileSize};return [/* @__PURE__ */ jsxRuntimeExports.jsx(Button$1,{onClick: handlePrimaryButtonClick,children:'download'})];}
function DownloadGameOptions(){const payload={automaticallyDeleteArchiveFiles: deleteArchiveFilesAfterExtraction,};return [/* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "download-game-modal__actions",children:jsxRuntimeExports.jsx(Button,{icon:null,onClick: handleStartDownload,})})];}`);
 }
 const bat=await fs.readFile(path.join(__dirname,'../dist/Hydra_Nexus.bat'),'utf8'),lines=bat.split(/\r?\n/),marker=lines.indexOf(':: === HYDRA_SUITE_PS_START ==='),manager=path.join(root,'manager.ps1');await fs.writeFile(manager,'\ufeff'+lines.slice(marker+1).join('\n'));
 const main=path.join(root,'main.mjs'),renderer=path.join(root,'renderer.js');
 const script=`$ErrorActionPreference='Stop';. ${quote(manager)} -LibraryOnly;
 $main=[IO.File]::ReadAllText(${quote(path.join(native,'hydra-main.mjs'))});$next=Add-NexusExtractionHooks $main;if((Remove-NexusExtractionHooks $next) -cne $main){throw 'Main cleanup not exact'};if((Add-NexusExtractionHooks $next) -cne $next){throw 'Main repair not stable'};
 $adapter=Get-NexusAdapter $next;if(!$adapter.Contains('extraction:{manager:GameFilesManager')){throw 'Extraction capabilities missing'};if($main.Contains('const findGameRootFromExe') -and !$adapter.Contains('storage:{resolve:findGameRootFromExe,update:updateGameExecutablePath,queue:libraryWriteQueue}')){throw 'Storage root/commit capabilities missing'};[IO.File]::WriteAllText(${quote(main)},$next);
 $renderer=[IO.File]::ReadAllText(${quote(path.join(native,'hydra-renderer.js'))});$patched=Add-NexusRendererHooks $renderer;if((Remove-NexusRendererHooks $patched) -cne $renderer){throw 'Renderer cleanup not exact'};if((Add-NexusRendererHooks $patched) -cne $patched){throw 'Renderer repair not stable'};[IO.File]::WriteAllText(${quote(renderer)},$patched);
 $failed=$false;try{Add-NexusExtractionHooks ($main.Replace('static async handleExtraction(download, game)','static async renamedExtraction(download, game)'))|Out-Null}catch{$failed=$true};if(!$failed){throw 'Unknown native shape accepted'};`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:60000,maxBuffer:1024*1024},(e,out,err)=>e?reject(Error(err+'\n'+out)):resolve()));
 for(const file of [main,renderer])cp.execFileSync(process.execPath,['--check',file],{windowsHide:true});
 const text=await fs.readFile(renderer,'utf8');assert.equal((text.match(/HYDRA_NEXUS_EXTRACT_FIELD_V1/g)||[]).length,2);assert.equal((text.match(/HYDRA_NEXUS_EXTRACT_PAYLOAD_V1/g)||[]).length,2);
 const source=await fs.readFile(main,'utf8'),klass=source.slice(source.indexOf('class GameFilesManager {'),source.indexOf('class PremiumizeClient'));
 let measured;const events=[],download={shop:'steam',objectId:'42',downloadPath:'C:/download',folderName:'game.zip'},context={levelKeys:{game:(s,id)=>s+':'+id},downloadsSublevel:{get:async()=>download,put:async()=>{}},gamesSublevel:{get:async()=>({}),put:async()=>{}},path,getDirectorySize:async p=>{measured=p;return 123;},WindowManager:{sendDownloadsUpdated(){},sendToAppWindows:(...a)=>events.push(a)},__NEXUS_EXTRACTED_PATH__:()=> 'D:/extracted/game'};
 vm.createContext(context);vm.runInContext(klass+';globalThis.manager=new GameFilesManager("steam","42");',context);context.manager.searchAndBindExecutable=async()=>{};context.manager.autoLinkClassicsDiscs=async()=>{};
 await context.manager.setExtractionComplete(false);assert.equal(measured,'D:/extracted/game');assert.equal(download.downloadPath,'C:/download');assert.equal(download.folderName,'game.zip');assert.equal(events[0][0],'on-extraction-complete');
 console.log('PASS: actual native main/renderer hooks parse; exact install/repair/removal; both download dialogs; native extraction discovery uses destination without rewriting torrent paths; unknown native shape refused.');
})().catch(e=>{console.error(e);process.exitCode=1;});
