'use strict';
const fs=require('node:fs'),path=require('node:path');
const {atomicJson,keyOf,validateGameMetadata}=require('./core.cjs');
const copy=x=>JSON.parse(JSON.stringify(x));
function mergeAchievements(base,extra){
  if(!extra)return base;if(!base)return extra;
  const unlocks=new Map(),definitions=new Map();
  for(const a of [...(extra.unlockedAchievements||[]),...(base.unlockedAchievements||[])]){
    if(!a||typeof a.name!=='string'||!a.name.trim()||!Number.isFinite(Number(a.unlockTime))||Number(a.unlockTime)<=0)continue;
    const key=a.name.toUpperCase(),prior=unlocks.get(key);
    if(!prior||Number(a.unlockTime)<Number(prior.unlockTime))unlocks.set(key,a);
  }
  for(const a of [...(extra.achievements||[]),...(base.achievements||[])])if(a&&typeof a.name==='string')definitions.set(a.name.toUpperCase(),a);
  return {...extra,...base,achievements:[...definitions.values()],unlockedAchievements:[...unlocks.values()]};
}
function createAchievementAdapter({stateDir,getBinding,invoke,running}){
  const restoredFile=path.join(stateDir,'restored-achievements.json');let restored={},error=null;
  try{if(fs.statSync(restoredFile).size>32*1024*1024)throw Error();restored=JSON.parse(fs.readFileSync(restoredFile,'utf8'));if(!restored||Array.isArray(restored)||typeof restored!=='object'||Object.entries(restored).some(([key,value])=>!/^[-\w]+:[-\w.]+$/.test(key)||!value||!Array.isArray(value.achievements)||!Array.isArray(value.unlockedAchievements)))throw Error();}catch(e){if(e.code!=='ENOENT'){restored={};error=Error('Restored achievement data is damaged; the file was preserved.');}}
  let replaceMemory;
  function bind(binding){
    if(error)return;
    const memory=binding.memory;if(!memory||memory.__hbkWrapped)return;
    replaceMemory=memory.set.bind(memory);
    memory.set=(shop,id,value)=>replaceMemory(shop,id,mergeAchievements(value,restored[shop+':'+id]));
    Object.defineProperty(memory,'__hbkWrapped',{value:true});
    // Hydra clears its memory cache during login/sync. Keep restored unlocks available.
    const get=memory.get.bind(memory);memory.get=(shop,id)=>mergeAchievements(get(shop,id),restored[shop+':'+id]);
    for(const [key,value]of Object.entries(restored)){const i=key.indexOf(':');if(i>0)replaceMemory(key.slice(0,i),key.slice(i+1),value);}
  }
  const adapter={
    async listGames(){const b=getBinding();if(b.games?.iterator)return (await b.games.iterator().all()).map(([,g])=>g);return invoke('getLibrary',true);},
    async running(){return getBinding().running?getBinding().running():running();},
    async achievementFiles(g){return getBinding().collect?getBinding().collect(g,{includeSteamCache:true,awaitGameDirectoryLocations:true}):[];},
    async exportGame(g){
      if(error)throw error;
      const b=getBinding(),key=keyOf(g);let achievementData=mergeAchievements(b.memory?.get(g.shop,g.objectId),restored[key])||null;
      if(!achievementData&&b.db){try{achievementData=await b.db.sublevel('gameAchievements',{valueEncoding:'json'}).get(key);}catch(e){if(!['LEVEL_NOT_FOUND','LEVEL_DATABASE_NOT_OPEN'].includes(e.code))throw e;}}
      if(b.parse){
        const unlocks=[];
        for(const source of await adapter.achievementFiles(g))if(source.filePath&&source.type)unlocks.push(...b.parse(source.filePath,source.type));
        if(unlocks.length){const definitions=unlocks.map(a=>({name:a.name,displayName:a.name,hidden:false,icon:'',icongray:''}));achievementData=mergeAchievements(achievementData,{achievements:definitions,unlockedAchievements:unlocks});}
      }
      return copy({game:{title:g.title,shop:g.shop,objectId:g.objectId,playTimeInMilliseconds:g.playTimeInMilliseconds,lastTimePlayed:g.lastTimePlayed,achievementCount:g.achievementCount,unlockedAchievementCount:g.unlockedAchievementCount},achievementData});
    },
    async importGame(g,data,{restoreExact=false}={}){
      if(error)throw error;validateGameMetadata(data?.game||{});
      const b=getBinding(),key=keyOf(g);if(!b.games?.put)throw Error('This Hydra build needs an updated database adapter for metadata restore. Your backups remain readable.');
      const existing=await b.games.get(key).catch(e=>{if(e.code==='LEVEL_NOT_FOUND')return null;throw e;});
      const source=data?.game||{},allowed={};for(const name of ['playTimeInMilliseconds','lastTimePlayed','achievementCount','unlockedAchievementCount'])if(source[name]!==undefined)allowed[name]=source[name];
      const nextGame={...(existing||{title:g.title,shop:g.shop,objectId:g.objectId,isDeleted:false})};if(restoreExact)for(const name of ['playTimeInMilliseconds','lastTimePlayed','achievementCount','unlockedAchievementCount'])delete nextGame[name];await b.games.put(key,{...nextGame,...allowed});
      if(data?.achievementData){
        const next={...restored,[key]:copy(data.achievementData)};await atomicJson(restoredFile,next);restored=next;
        if(b.memory)(replaceMemory||b.memory.set.bind(b.memory))(g.shop,g.objectId,copy(data.achievementData));
        else if(b.db)await b.db.sublevel('gameAchievements',{valueEncoding:'json'}).put(key,data.achievementData);
      }else{
        const next={...restored};delete next[key];await atomicJson(restoredFile,next);restored=next;b.memory?.delete?.(g.shop,g.objectId);
        if(!b.memory&&b.db)await b.db.sublevel('gameAchievements',{valueEncoding:'json'}).del(key);
      }
    }
  };return {adapter,bind,get error(){return error;}};
}
module.exports={mergeAchievements,createAchievementAdapter};
