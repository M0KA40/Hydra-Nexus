'use strict';
const assert=require('node:assert/strict'),{createUpdateShutdown}=require('../src/update-shutdown.cjs');
(async()=>{
 const order=[];let quitCalls=0,exits=0;
 const app={quit(){quitCalls++;return new Promise(()=>{});},exit(){order.push('exit');exits++;}};
 const native={prepare:async()=>order.push('native-save'),close:async()=>order.push('db-close'),reopen:async()=>order.push('db-open')};
 const make=(overrides={})=>createUpdateShutdown({app,getNative:()=>native,guard(){},flush:async()=>order.push('notes-privacy-history'),...overrides});
 const shutdown=make();const prepared=await shutdown.prepare();await prepared.commit(async()=>order.push('approve'));
 assert.equal(quitCalls,0);assert.equal(exits,1);assert.deepEqual(order,['notes-privacy-history','native-save','notes-privacy-history','db-close','approve','exit']);
 for(const fail of ['flush','guard','native']){let approvals=0;const bad=make({flush:async()=>{if(fail==='flush')throw Error('write failed');},guard:()=>{if(fail==='guard')throw Error('game running');},getNative:()=>({...native,prepare:async()=>{if(fail==='native')throw Error('native write failed');}})});await assert.rejects(async()=>{const p=await bad.prepare();await p.commit(async()=>approvals++);});assert.equal(approvals,0);assert.equal(bad.busy(),false);}
 const stalled=make({timeoutMs:20,flush:()=>new Promise(()=>{})});await assert.rejects(stalled.prepare(),/did not finish/);assert.equal(stalled.busy(),false);assert.equal(exits,1);
 const cancelled=make();const p=await cancelled.prepare();await assert.rejects(p.commit(async()=>{throw Error('disk full');}),/disk full/);assert.equal(order.at(-1),'db-open');assert.equal(exits,1);assert.equal(cancelled.busy(),false);
 await assert.rejects(make({getNative:()=>({})}).prepare(),/safe update restart/);
 console.log('PASS: update exit explicitly persists Notes/privacy/history/native work before closing DB and approving; native quit hang bypassed; failed/slow saves never exit; failed approval reopens DB.');
})().catch(e=>{console.error(e);process.exitCode=1;});
