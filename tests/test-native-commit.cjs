'use strict';
// Guards the native-commit scheduler: one listener per document, one coalesced pass
// per burst, and no work at all while the window is hidden (with a single catch-up).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/native-ui.js'),'utf8');
const events=[],timers=[],listeners=[];
const document={
  hidden:false,
  addEventListener(type,fn){listeners.push({type,fn});},
  removeEventListener(){},
  getElementById(){return null;},
  createElement(){return {style:{},setAttribute(){},append(){},id:''};},
  head:{append(){}},
  documentElement:{setAttribute(){}},
  dispatchEvent(event){events.push(event.type);}
};
const sandbox={
  console,URL,URLSearchParams,Event,queueMicrotask,document,
  location:{hash:'',search:''},
  setTimeout(fn){timers.push(fn);return timers.length;},
  clearTimeout(){},
  addEventListener(){}
};
sandbox.window=sandbox;
const context=vm.createContext(sandbox);
vm.runInContext(source,context);

const tick=()=>{const fn=timers.shift();assert.equal(typeof fn,'function','a commit was scheduled');fn();};
const visibility=()=>listeners.filter(entry=>entry.type==='visibilitychange');

context.installNativeNexusCommit();
context.installNativeNexusCommit();
context.installNativeNexusCommit();
assert.equal(sandbox.__nexusCommitInstalled,true,'the scheduler records that it is installed');
assert.equal(visibility().length,1,'repeated installs register exactly one visibilitychange listener');

// A burst of React commits (one per host component) becomes a single pass.
for(let i=0;i<50;i++)context.__nexusNativeCommit();
assert.equal(events.length,0,'commits are deferred instead of dispatching synchronously');
assert.equal(timers.length,1,'a burst of 50 commits schedules a single timer');
tick();
assert.deepEqual(events,['nexus-native-commit'],'the burst produced one commit pass');

// Nothing runs while hidden: the timer fires, the pass is skipped.
document.hidden=true;
context.__nexusNativeCommit();
tick();
assert.equal(events.length,1,'a hidden window performs no commit work');

// Hiding fires visibilitychange too; while hidden it must not schedule a pass.
const beforeHide=timers.length;
visibility()[0].fn();
assert.equal(timers.length,beforeHide,'hiding the window schedules nothing');

// Showing the window performs one catch-up pass, and only one.
document.hidden=false;
visibility()[0].fn();
assert.equal(timers.length,1,'showing the window schedules a single catch-up');
tick();
assert.equal(events.length,2,'showing the window commits once');
assert.equal(sandbox.__nexusNativeCommit.length>=0,true);

// After the catch-up the scheduler still coalesces new commits.
context.__nexusNativeCommit();
context.__nexusNativeCommit();
assert.equal(timers.length,1,'the scheduler is reusable after a catch-up');
tick();
assert.equal(events.length,3,'the next burst commits once');

console.log('PASS: native commit coalesces bursts, registers one listener across repeat installs, skips hidden windows and catches up exactly once when shown.');
