'use strict';
const cp=require('node:child_process');
const PASSWORDS=['-','online-fix.me','steamrip.com'];
function safeEntryName(name){
  if(typeof name!=='string'||!name||name.length>4096||/[\x00-\x1f:]/.test(name)||/^[\\/]/.test(name))return false;
  return !name.replace(/\\/g,'/').split('/').some(part=>part==='..'||/[. ]$/.test(part)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
function parseListing(text){
  return text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean).map(block=>{const fields=Object.fromEntries(block.split(/\r?\n/).filter(line=>line.includes(' = ')).map(line=>{const at=line.indexOf(' = ');return [line.slice(0,at),line.slice(at+3)];}));return {name:fields.Path,size:Number(fields.Size||0),unsafeLink:!!(fields['Symbolic Link']||fields['Hard Link']||/\bl[rwx-]{9}\b/.test(fields.Mode||fields.Attributes||''))};});
}
async function archiveEntries(zip,archive){
  // Hydra's regular listEntries omits directory metadata. The native binary's
  // technical listing also exposes links and supports encrypted header passwords.
  if(zip.binaryPath){let last;for(const password of PASSWORDS){try{return parseListing(await new Promise((resolve,reject)=>cp.execFile(zip.binaryPath,['l','-slt','-ba','-p'+password,'--',archive],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:32*1024*1024},(error,out)=>error?reject(error):resolve(out))));}catch(error){last=error;}}throw Error('The archive contents could not be verified. The downloaded archives were kept.');}
  if(typeof zip.listEntries!=='function')throw Error('The archive contents could not be verified. The downloaded archives were kept.');
  let entries;try{entries=await zip.listEntries(archive);}catch{throw Error('The archive contents could not be verified. The downloaded archives were kept.');}
  if(!Array.isArray(entries))throw Error('The archive contents could not be verified. The downloaded archives were kept.');return entries;
}
function validateEntries(entries){for(const entry of entries)if(!entry||!safeEntryName(entry.name)||entry.unsafeLink||entry.isSymbolicLink||entry.isHardLink)throw Error('The archive contains an unsafe path or link. The downloaded archives were kept.');}
module.exports={archiveEntries,validateEntries,safeEntryName,parseListing};
