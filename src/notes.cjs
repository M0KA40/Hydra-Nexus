'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {atomicText}=require('./themes.cjs');
const validKey=k=>typeof k==='string'&&/^[\w-]+:[\w.-]+$/.test(k)&&k.length<180;
function validateNotes(value){
  if(value?.format!=='HydraNexusNotes'||value.version!==1||!value.games||Array.isArray(value.games)||typeof value.games!=='object')throw Error('Choose a Hydra Nexus Notes export');
  const games=Object.create(null);let size=0;
  for(const [key,n]of Object.entries(value.games)){
    if(!validKey(key)||typeof n?.text!=='string'||n.text.length>262144||!Array.isArray(n.images)||n.images.length>20)throw Error('Invalid game note');
    const images=n.images.map(x=>{if(typeof x!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x)||x.length>8*1024*1024)throw Error('Invalid note image');return x;});
    games[key]={title:String(n.title||key).slice(0,300),text:n.text,images,updatedAt:Number(n.updatedAt)||Date.now()};size+=Buffer.byteLength(JSON.stringify(games[key]),'utf8');
  }
  if(Object.keys(games).length>10000||size>64*1024*1024)throw Error('Notes export exceeds the 64 MB limit');
  return {format:'HydraNexusNotes',version:1,games};
}
class NotesStore{
  constructor(){this.file=null;this.data={format:'HydraNexusNotes',version:1,games:Object.create(null)};this.queue=Promise.resolve();this.projected=this.data;}
  async load(file){let data;try{const st=await fs.promises.stat(file);if(st.size>64*1024*1024)throw Error('Notes file is too large');data=validateNotes(JSON.parse(await fs.promises.readFile(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;data={format:'HydraNexusNotes',version:1,games:Object.create(null)};}this.file=file;this.data=data;this.projected=data;return this;}
  get(key){if(!validKey(key))throw Error('Invalid game');return this.projected.games[key]||{title:key,text:'',images:[],updatedAt:0};}
  save(key,note){let next;try{if(!this.file)throw Error('Choose a Notes folder in Plugins first');next=validateNotes({...this.projected,games:{...this.projected.games,[key]:{...note,updatedAt:Date.now()}}});}catch(e){return Promise.reject(e);}this.projected=next;const task=this.queue.then(async()=>{const committed=validateNotes({...this.data,games:{...this.data.games,[key]:next.games[key]}});await atomicText(this.file,JSON.stringify(committed));this.data=committed;return this.get(key);});this.queue=task.catch(()=>{});return task;}
  flushOnExit(){if(!this.file||this.projected===this.data)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});const temp=this.file+'.exit-'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(this.projected),'utf8');fs.renameSync(temp,this.file);this.data=this.projected;}catch(e){try{fs.unlinkSync(temp);}catch{}throw e;}}
  async relocate(folder){await this.queue;const file=path.join(folder,'Hydra-Nexus-Notes.json');if(path.resolve(file)===path.resolve(this.file||'.'))return;let existing=null;try{const st=await fs.promises.stat(file);if(st.size>64*1024*1024)throw Error('Notes file is too large');existing=validateNotes(JSON.parse(await fs.promises.readFile(file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}const merged={...this.projected,games:{...existing?.games,...this.projected.games}};await atomicText(file,JSON.stringify(validateNotes(merged)));this.file=file;this.data=merged;this.projected={...this.projected,games:{...merged.games,...this.projected.games}};}
  async restore(file){await this.queue;const st=await fs.promises.stat(file);if(st.size>64*1024*1024)throw Error('Notes export is too large');const incoming=validateNotes(JSON.parse(await fs.promises.readFile(file,'utf8')));if(!this.file)throw Error('Choose a Notes folder first');await atomicText(this.file+'.before-restore-'+crypto.randomUUID()+'.json',JSON.stringify(this.data));const next=validateNotes({...this.data,games:{...this.data.games,...incoming.games}});await atomicText(this.file,JSON.stringify(next));this.data=next;this.projected=next;return {restored:Object.keys(incoming.games).length};}
}
module.exports={NotesStore,validateNotes,validKey};
