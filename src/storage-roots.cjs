'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {assertWellFormed,field}=require('./steam-vdf.cjs');
const absolute=p=>typeof p==='string'&&p.length<32000&&!/[\x00-\x1f]/.test(p)&&path.isAbsolute(p);
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const within=(root,p)=>{const r=path.relative(path.resolve(root),path.resolve(p));return !r||!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};
const broad=p=>same(p,path.parse(p).root)||/^(users|program files(?: \(x86\))?|windows|system32|appdata|programdata|desktop|documents|downloads|games|steamlibrary|steamapps|common)$/i.test(path.basename(p));
const nested=p=>/^(bin|binaries|win32|win64|x64|x86|amd64|linux64|linux|osx|macos|release|debug|shipping)$/i.test(path.basename(p));
async function resolveInstallation(game,{io=fs,hint=async()=>null,override=null}={}){
 const exe=absolute(game.executablePath)?path.resolve(game.executablePath):null;
 const result=(folder,verified,source)=>({folder:folder&&path.resolve(folder),rootVerified:verified,rootSource:source});
 const directory=async p=>{try{const s=await io.lstat(p);return s.isDirectory()&&!s.isSymbolicLink();}catch{return false;}};
 let automatic=null;
 // The common/<installation> boundary owns the whole Steam installation, unlike an executable heuristic.
 if(exe){let child=path.dirname(exe);for(let depth=0;depth<12;depth++){
  const parent=path.dirname(child);if(parent===child)break;
  if(path.basename(parent).toLowerCase()==='common'&&path.basename(path.dirname(parent)).toLowerCase()==='steamapps'){
   automatic=result(child,true,'steam-layout');
   const id=game.shop==='steam'&&/^\d+$/.test(String(game.objectId))?String(game.objectId):null;
   if(id){const manifest=path.join(path.dirname(parent),'appmanifest_'+id+'.acf');try{
    const stat=await io.lstat(manifest);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('Invalid Steam manifest');
    const text=await io.readFile(manifest,'utf8');assertWellFormed(text);const body=text.match(/^\uFEFF?\s*"AppState"\s*\{([\s\S]*)\}\s*$/)?.[1];
    if(!body||field(body,'appid')!==id||!field(body,'installdir')||!same(path.join(parent,field(body,'installdir')),child)||/[\\/]/.test(field(body,'installdir')))throw Error('Mismatched Steam installation');
    automatic=result(child,true,'steam-manifest');
   }catch(error){if(error.code!=='ENOENT')automatic=result(child,false,'steam-unconfirmed');}}
   break;
  }child=parent;
 }}
 // Recorded installation metadata is useful only if it owns the executable and is not a library/system root.
 if(!automatic)for(const name of ['installationPath','installDirectory','installPath','gameDirectory']){
  const folder=game[name];if(absolute(folder)&&!broad(folder)&&(!exe||within(folder,exe))){automatic=result(folder,true,'installation-metadata');break;}
 }
 if(!automatic&&exe){
  let candidate=path.dirname(exe);for(let i=0;i<8&&nested(candidate);i++)candidate=path.dirname(candidate);
  if(!broad(candidate)){
   // Unreal project binaries and shared Engine must move/measure together.
   let current=path.dirname(exe);for(let depth=0;depth<8&&!broad(current);depth++){
    const rel=path.relative(current,exe).split(path.sep),project=rel[0];
    if(rel.length>2&&project.toLowerCase()!=='engine'&&await directory(path.join(current,'Engine'))&&await directory(path.join(current,project,'Content'))){automatic=result(current,true,'engine-layout');break;}
    const parent=path.dirname(current);if(parent===current)break;current=parent;
   }
   if(!automatic){const unity=path.join(path.dirname(exe),path.basename(exe,path.extname(exe))+'_Data');if(await directory(unity))automatic=result(path.dirname(exe),true,'engine-layout');}
   if(!automatic){
    let suggestion=null;try{suggestion=await hint(game);}catch{}
    if(absolute(suggestion)&&within(suggestion,exe)&&!broad(suggestion)&&!nested(suggestion)&&within(suggestion,candidate))candidate=path.resolve(suggestion);
    automatic=result(candidate,false,'inferred');
   }
  }
 }
 if(absolute(override)){
  // An old/manual bin subfolder cannot override a verified complete installation boundary.
  if(automatic?.rootVerified&&within(automatic.folder,override)&&!same(automatic.folder,override))return {...automatic,rejectedSubfolder:true};
  if(exe&&!within(override,exe)){try{if((await io.lstat(exe)).isFile())return automatic||result(path.dirname(exe),false,'inferred');}catch{}}
  return result(override,true,'user-confirmed');
 }
 return automatic||result(exe?path.dirname(exe):null,false,'unconfirmed');
}
module.exports={resolveInstallation,within,broad,absolute};
