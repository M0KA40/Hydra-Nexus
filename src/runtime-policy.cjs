'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url'),net=require('node:net');
function trustedRendererURL(value,root){
  try{const u=new URL(value);if(u.protocol!=='file:'||u.hostname||u.username||u.password||u.port||!root)return false;
    return ['out','dist'].some(folder=>decodeURIComponent(u.pathname).toLowerCase()===decodeURIComponent(new URL(pathToFileURL(path.join(root,folder,'renderer','index.html')).href).pathname).toLowerCase());
  }catch{return false;}
}
function privateHost(value){
  const host=value.toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');
  if(host==='localhost'||host.endsWith('.localhost')||!host.includes('.')&&!host.includes(':'))return true;
  if(net.isIP(host)===6){
    if(/^::ffff:/i.test(host)){const tail=host.slice(7);if(net.isIP(tail)===4)return privateHost(tail);const parts=tail.split(':');if(parts.length===2)return privateHost([parseInt(parts[0],16)>>8,parseInt(parts[0],16)&255,parseInt(parts[1],16)>>8,parseInt(parts[1],16)&255].join('.'));}
    return /^(?:::|f[cd]|fe[89ab])/i.test(host);
  }
  if(net.isIP(host)===4){const [a,b]=host.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224;}
  return false;
}
function webLink(value){const u=new URL(String(value||''));if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>2048||privateHost(u.hostname))throw Error('Only web links can be opened');return u.href;}
function redactLog(value){return String(value?.message||value).slice(0,800).replace(/file:\/\/\/[^\r\n]+|[A-Za-z]:[\\/][^\r\n]+|\\\\[^\r\n]+/g,'<path>');}
module.exports={trustedRendererURL,privateHost,webLink,redactLog};
