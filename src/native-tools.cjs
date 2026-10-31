'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const embedded='__NEXUS_NATIVE_TOOLS__',expected='__NEXUS_NATIVE_TOOLS_SHA256__';
let pending;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function executable(){if(pending)return pending;pending=(async()=>{
 const {app}=require('electron'),directory=path.join(app.getPath('userData'),'nexus-native');
 for(let p=directory;p&&p!==path.dirname(p);p=path.dirname(p)){try{if((await fs.lstat(p)).isSymbolicLink())throw Error('Linked native tools path');}catch(e){if(e.code!=='ENOENT')throw e;}}
 await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'NexusNative.exe');try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid native tools path');if(hash(await fs.readFile(file))===expected)return file;}catch(e){if(e.code!=='ENOENT')throw e;}
 const bytes=embedded.startsWith('__')?await fs.readFile(path.join(__dirname,'../dist/NexusNative.exe')):Buffer.from(embedded,'base64');if(!expected.startsWith('__')&&hash(bytes)!==expected)throw Error('Native tools verification failed');
 const temporary=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return file;
 })().catch(e=>{pending=null;throw e;});return pending;}
async function run(action,args=[],options={}){const file=await executable();return new Promise((resolve,reject)=>cp.execFile(file,[action,...args],{windowsHide:true,timeout:45000,maxBuffer:1024*1024,...options},(e,out)=>e?reject(e):resolve(out)));}
module.exports={run,executable};
