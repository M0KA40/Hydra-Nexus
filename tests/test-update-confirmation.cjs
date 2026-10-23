'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{createUpdateConfirmation}=require('../src/update-confirmation.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const win=()=>{const w=new EventEmitter();w.isDestroyed=()=>false;w.webContents=new EventEmitter();w.webContents.executeJavaScript=async()=>true;return w;};
(async()=>{
 const messages=[],first=win(),other=win(),service=createUpdateConfirmation({send:(w,m)=>messages.push({w,...m}),trusted:w=>w===first,timeoutMs:50});
 const data={version:'1.2.0',source:'Local file: fixture.bat',sha256:'a'.repeat(64)};
 const p=service.confirm(first,data);await tick();const id=messages.at(-1).value.id;
 assert.equal(messages.at(-1).value.version,data.version);assert.equal(service.respond(other,{id,accepted:true}).accepted,false);assert.equal(service.respond(first,{id:'wrong',accepted:true}).accepted,false);
 assert.equal(service.respond(first,{id,accepted:true}).accepted,true);assert.equal(await p,true);assert.equal(service.respond(first,{id,accepted:true}).accepted,false);assert.equal(messages.at(-1).value,null);
 const cancel=service.confirm(first,data);await tick();first.emit('closed');assert.equal(await cancel,false);
 const navigation=service.confirm(first,data);await tick();first.webContents.emit('did-start-navigation',{},'file:///other',false,true);assert.equal(await navigation,false);
 const previous=service.confirm(first,data);await tick();const next=service.confirm(first,data);await tick();assert.equal(await previous,false);service.respond(first,{id:messages.at(-1).value.id,accepted:false});assert.equal(await next,false);
 const timed=service.confirm(first,data);await tick();await new Promise(r=>setTimeout(r,60));assert.equal(await timed,false);
 const unsupported=win();unsupported.webContents.executeJavaScript=async()=>false;const fallback=createUpdateConfirmation({send:()=>assert.fail('no event for unsupported renderer'),trusted:()=>true});assert.equal(await fallback.confirm(unsupported,data),null);
 assert.equal(first.listenerCount('closed'),0);assert.equal(first.webContents.listenerCount('did-start-navigation'),0);
 console.log('PASS: native update confirmation is bound to its trusted window and one-use ID; cancel, close, navigation, replacement and expiry never approve; unsupported renderer retains OS fallback; listeners cleaned.');
})().catch(e=>{console.error(e);process.exitCode=1;});
