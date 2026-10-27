'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{atomicText}=require('./themes.cjs');
const validKey=key=>typeof key==='string'&&/^[\w-]+:[\w.-]+$/.test(key)&&key.length<180;
const validId=id=>typeof id==='string'&&/^[\w-]{1,64}$/.test(id);
const empty=()=>({format:'HydraNexusNotes',version:2,games:Object.create(null)});
const main=()=>({id:'main',title:'',text:'',images:[],updatedAt:0});
function entry(note){
 if(!note||!validId(note.id)||typeof note.title!=='string'||note.title.length>160||typeof note.text!=='string'||note.text.length>262144||!Array.isArray(note.images)||note.images.length>20)throw Error('Invalid game note');
 const images=note.images.map(image=>{if(typeof image!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>8*1024*1024)throw Error('Invalid note image');return image;});
 return {id:note.id,title:note.title,text:note.text,images,updatedAt:Number(note.updatedAt)||0};
}
function game(value,key,legacy=false){
 if(!validKey(key)||!value||typeof value!=='object')throw Error('Invalid game note');
 const notes=legacy?[entry({...value,id:'main',title:''})]:Array.isArray(value.notes)?value.notes.map(entry):null;
 if(!Array.isArray(notes)||!notes.length||notes.length>100||new Set(notes.map(n=>n.id)).size!==notes.length)throw Error('Invalid game note');
 const activeNoteId=legacy?'main':value.activeNoteId;if(!notes.some(note=>note.id===activeNoteId))throw Error('Invalid game note');
 return {title:String(value.title||key).slice(0,300),notes,activeNoteId,updatedAt:Number(value.updatedAt)||0};
}
function validateNotes(value){
 if(value?.format!=='HydraNexusNotes'||![1,2].includes(value.version)||!value.games||Array.isArray(value.games)||typeof value.games!=='object')throw Error('Choose a Hydra Nexus Notes export');
 const result=empty();for(const [key,value2]of Object.entries(value.games))result.games[key]=game(value2,key,value.version===1);
 if(Object.keys(result.games).length>10000||Buffer.byteLength(JSON.stringify(result),'utf8')>64*1024*1024)throw Error('Notes export exceeds the 64 MB limit');return result;
}
class NotesStore{
 constructor(){this.file=null;this.data=empty();this.projected=this.data;this.queue=Promise.resolve();this.pendingWrites=0;this.sizes=new Map();this.totalBytes=0;this.legacySource=null;}
 entrySize(key,value){return Buffer.byteLength(JSON.stringify(key)+':'+JSON.stringify(value),'utf8')+1;}
 index(){this.sizes=new Map(Object.entries(this.projected.games).map(([key,value])=>[key,this.entrySize(key,value)]));this.totalBytes=Buffer.byteLength(JSON.stringify({...this.projected,games:{}}),'utf8')+[...this.sizes.values()].reduce((a,b)=>a+b,0)-(this.sizes.size?1:0);}
 async load(file){let data;this.legacySource=null;try{const stat=await fs.promises.stat(file);if(stat.size>64*1024*1024)throw Error('Notes file is too large');const text=await fs.promises.readFile(file,'utf8'),parsed=JSON.parse(text);data=validateNotes(parsed);if(parsed.version===1)this.legacySource=text;}catch(error){if(error.code!=='ENOENT')throw error;data=empty();}this.file=file;this.data=data;this.projected=data;this.index();return this;}
 collection(key,title=key){if(!validKey(key))throw Error('Invalid game');return this.projected.games[key]||{title,notes:[main()],activeNoteId:'main',updatedAt:0};}
 // Compatibility for internal callers that still save the original single note.
 get(key){const group=this.collection(key);return {...group.notes[0],title:group.title};}
 commit(key,value){let normalized;try{if(!this.file)throw Error('Choose a Notes folder in Plugins first');normalized=game(value,key);const size=this.entrySize(key,normalized),total=this.totalBytes-(this.sizes.get(key)||0)+size-(this.sizes.size?0:1);if(total>64*1024*1024||(!this.sizes.has(key)&&this.sizes.size>=10000))throw Error('Notes export exceeds the 64 MB limit');this.sizes.set(key,size);this.totalBytes=total;this.projected={...this.projected,games:{...this.projected.games,[key]:normalized}};}catch(error){return Promise.reject(error);}
  this.pendingWrites++;const task=this.queue.then(async()=>{try{if(this.legacySource!==null){await atomicText(this.file+'.before-multiple-notes-'+crypto.randomUUID()+'.json',this.legacySource);this.legacySource=null;}const committed={...this.data,games:{...this.data.games,[key]:normalized}};await atomicText(this.file,JSON.stringify(committed));this.data=committed;return normalized;}catch(error){if(this.projected.games[key]===normalized){const games={...this.projected.games};if(this.data.games[key])games[key]=this.data.games[key];else delete games[key];this.projected={...this.projected,games};this.index();}throw error;}finally{if(!--this.pendingWrites)this.projected=this.data;}});this.queue=task.catch(()=>{});return task;
 }
 async save(key,note){const group=this.collection(key,note.title||key),id=group.notes[0].id;return this.update(key,id,{text:note.text,images:note.images,gameTitle:note.title}).then(()=>this.get(key));}
 async update(key,id,patch){const group=this.collection(key,patch.gameTitle||key),current=group.notes.find(note=>note.id===id);if(!current)return Promise.reject(Error('Note no longer exists'));const next=entry({...current,...patch,id,updatedAt:Date.now()});return this.commit(key,{...group,title:patch.gameTitle||group.title,notes:group.notes.map(note=>note.id===id?next:note),updatedAt:Date.now()}).then(()=>next);}
 async create(key,title,gameTitle=key){const name=String(title||'').trim();if(!name||name.length>160)return Promise.reject(Error('Enter a note title'));const group=this.collection(key,gameTitle);if(group.notes.length>=100)return Promise.reject(Error('A game can have up to 100 notes'));const note={...main(),id:crypto.randomUUID(),title:name,updatedAt:Date.now()};return this.commit(key,{...group,notes:[...group.notes,note],activeNoteId:note.id,updatedAt:Date.now()});}
 async select(key,id){const group=this.collection(key);if(!group.notes.some(note=>note.id===id))return Promise.reject(Error('Note no longer exists'));return this.commit(key,{...group,activeNoteId:id});}
 async remove(key,id){await this.queue;const group=this.collection(key);if(group.notes.length===1)throw Error('Keep at least one note');if(!group.notes.some(note=>note.id===id))throw Error('Note no longer exists');await atomicText(this.file+'.before-note-delete-'+crypto.randomUUID()+'.json',JSON.stringify(this.data));const notes=group.notes.filter(note=>note.id!==id);return this.commit(key,{...group,notes,activeNoteId:group.activeNoteId===id?notes[0].id:group.activeNoteId,updatedAt:Date.now()});}
 flushOnExit(){if(!this.file||this.projected===this.data)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});if(this.legacySource!==null){fs.writeFileSync(this.file+'.before-multiple-notes-'+crypto.randomUUID()+'.json',this.legacySource,{flag:'wx'});this.legacySource=null;}const temp=this.file+'.exit-'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(this.projected),'utf8');fs.renameSync(temp,this.file);this.data=this.projected;}catch(error){try{fs.unlinkSync(temp);}catch{}throw error;}}
 async relocate(folder){await this.queue;const file=path.join(folder,'Hydra-Nexus-Notes.json');if(path.resolve(file)===path.resolve(this.file||'.'))return;let existing=null,original=null;try{const stat=await fs.promises.stat(file);if(stat.size>64*1024*1024)throw Error('Notes file is too large');original=await fs.promises.readFile(file,'utf8');existing=validateNotes(JSON.parse(original));}catch(error){if(error.code!=='ENOENT')throw error;}const merged=validateNotes({...this.projected,games:{...existing?.games,...this.projected.games}});if(original!==null)await atomicText(file+'.before-relocate-'+crypto.randomUUID()+'.json',original);await atomicText(file,JSON.stringify(merged));this.file=file;this.data=merged;this.projected=merged;this.legacySource=null;this.index();}
 async restore(file){await this.queue;const stat=await fs.promises.stat(file);if(stat.size>64*1024*1024)throw Error('Notes export is too large');const incoming=validateNotes(JSON.parse(await fs.promises.readFile(file,'utf8')));if(!this.file)throw Error('Choose a Notes folder first');await atomicText(this.file+'.before-restore-'+crypto.randomUUID()+'.json',JSON.stringify(this.data));const next=validateNotes({...this.data,games:{...this.data.games,...incoming.games}});await atomicText(this.file,JSON.stringify(next));this.data=next;this.projected=next;this.legacySource=null;this.index();return {restored:Object.keys(incoming.games).length};}
}
module.exports={NotesStore,validateNotes,validKey};
