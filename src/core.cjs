'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
async function plain(p) {
  p=path.resolve(p);let cursor=p;
  while(true){try{if((await fsp.lstat(cursor)).isSymbolicLink())throw Error('Linked folders are not supported: '+cursor);}catch(e){if(e.code!=='ENOENT')throw e;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}return p;
}
async function hashFile(p){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(p))h.update(chunk);return h.digest('hex');}
async function atomicJson(p,data){await fsp.mkdir(path.dirname(p),{recursive:true});const t=p+'.'+crypto.randomUUID()+'.tmp';try{await fsp.writeFile(t,JSON.stringify(data,null,2));await fsp.rename(t,p);}catch(e){await fsp.rm(t,{force:true}).catch(()=>{});throw e;}}

module.exports={plain,hashFile,atomicJson};
