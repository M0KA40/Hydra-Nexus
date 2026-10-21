'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const validKey=key=>typeof key==='string'&&/^[a-z0-9_-]{1,32}:[a-z0-9_.-]{1,160}$/i.test(key);
function dayKey(time){const d=new Date(time);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function splitDays(start,duration){const days=[];let cursor=start,end=start+duration;while(cursor<end){const date=new Date(cursor),next=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime(),until=Math.min(end,next);days.push({day:dayKey(cursor),durationMs:until-cursor});cursor=until;}return days;}
class ActivityStore{
  constructor({directory,now=Date.now}){this.directory=directory;this.file=path.join(directory,'activity.json');this.now=now;this.active=new Map();this.queue=Promise.resolve();this.lastWrite=0;this.error=null;this.data={schema:1,trackingSince:now(),sessions:[]};}
  async init(){await fsp.mkdir(this.directory,{recursive:true});try{const data=JSON.parse(await fsp.readFile(this.file,'utf8'));if(data.schema!==1||!Number.isFinite(data.trackingSince)||!Array.isArray(data.sessions)||data.sessions.some(s=>!validKey(s.key)||!Number.isFinite(s.startedAt)||!Number.isFinite(s.durationMs)||s.durationMs<0))throw Error('Invalid activity history');this.data=data;for(const session of this.data.sessions)if(session.active){session.active=false;session.interrupted=true;session.endedAt=session.startedAt+session.durationMs;}}catch(e){if(e.code!=='ENOENT')throw Error('Play history could not be read. Its original file was preserved.');}return this;}
  async save(){const snapshot=JSON.stringify(this.data,null,2);this.lastWrite=this.now();const task=this.queue.catch(()=>{}).then(async()=>{const temp=this.file+'.'+crypto.randomUUID()+'.tmp';try{await fsp.writeFile(temp,snapshot);await fsp.rename(temp,this.file);this.error=null;}catch(e){await fsp.rm(temp,{force:true}).catch(()=>{});this.error=e.message;throw e;}});this.queue=task;return task;}
  async observe(items){if(!Array.isArray(items))return;const now=this.now(),seen=new Set();let changed=false;
    for(const item of items){const key=typeof item==='string'?item:item?.id;if(!validKey(key))continue;seen.add(key);let elapsed=Number(item?.sessionDurationInMillis);if(!Number.isFinite(elapsed)||elapsed<0)elapsed=this.active.has(key)?Math.max(0,now-this.active.get(key).startedAt):0;elapsed=Math.min(elapsed,366*86400000);let current=this.active.get(key);
      if(current&&elapsed+1500<current.durationMs){current.active=false;current.endedAt=current.startedAt+current.durationMs;this.active.delete(key);current=null;changed=true;}
      if(!current){current={id:crypto.randomUUID(),key,startedAt:now-elapsed,durationMs:elapsed,active:true};this.data.sessions.push(current);this.active.set(key,current);changed=true;}
      else current.durationMs=Math.max(current.durationMs,elapsed);
    }
    for(const [key,session]of this.active)if(!seen.has(key)){session.active=false;session.endedAt=session.startedAt+session.durationMs;this.active.delete(key);changed=true;}
    if(changed||now-this.lastWrite>=15000)await this.save();
  }
  async stop(){for(const session of this.active.values()){session.active=false;session.endedAt=session.startedAt+session.durationMs;}this.active.clear();await this.save();}
  flushOnExit(){
    for(const session of this.active.values()){session.active=false;session.endedAt=session.startedAt+session.durationMs;}
    this.active.clear();
    const temporary=this.file+'.'+crypto.randomUUID()+'.exit.tmp';
    try{fs.writeFileSync(temporary,JSON.stringify(this.data,null,2));fs.renameSync(temporary,this.file);}catch(e){try{fs.rmSync(temporary,{force:true});}catch{}throw e;}
  }
  summary(key){if(!validKey(key))throw Error('Invalid game identity');const sessions=this.data.sessions.filter(s=>s.key===key),days=new Map();for(const s of sessions)for(const part of splitDays(s.startedAt,s.durationMs))days.set(part.day,(days.get(part.day)||0)+part.durationMs);return {trackingSince:this.data.trackingSince,recordedMs:sessions.reduce((n,s)=>n+s.durationMs,0),lastPlayed:sessions.length?sessions.reduce((latest,s)=>Math.max(latest,s.startedAt+s.durationMs),0):null,days:[...days].map(([day,durationMs])=>({day,durationMs})).sort((a,b)=>b.day.localeCompare(a.day)),sessions:[...sessions].sort((a,b)=>b.startedAt-a.startedAt).slice(0,500),error:this.error};}
}
module.exports={ActivityStore,splitDays,dayKey,validKey};
