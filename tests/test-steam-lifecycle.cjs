'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/steam.cjs'),'utf8');
const state=source.slice(source.indexOf('  let activeFsWatcher'),source.indexOf('  async function syncSteamStatsBinToGoldberg'));
const start=source.slice(source.indexOf('  function startAchievementBridge('),source.indexOf('  // One preparation owns Steam'));
let callback,closes=0,syncs=0;const timers=new Map();let next=0;
const ctx={path,BigInt,Promise,log(){},fs:{existsSync:()=>true,watch:(_dir,fn)=>{callback=fn;return {close:()=>closes++};}},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),syncSteamStatsBinToGoldberg:async()=>{syncs++;}};ctx.global=ctx;vm.createContext(ctx);vm.runInContext(state+start,ctx);
const drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 ctx.startAchievementBridge('C:/Fixture/Steam','76561198000000001','620');await drain();assert.equal(syncs,1);
 ctx.__NEXUS_STEAM_RUNNING__([]);assert.equal(closes,0,'initial empty event does not stop a launch');
 ctx.__NEXUS_STEAM_RUNNING__([{id:'steam:620'}]);assert.equal(timers.size,0,'startup deadline is cancelled once running');
 callback('change','UserGameStats_39734273_620.bin');assert.equal(timers.size,1,'stats changes coalesce');
 ctx.__NEXUS_STEAM_RUNNING__([]);await drain();assert.equal(closes,1);assert.equal(timers.size,0);assert.equal(syncs,2,'game exit flushes the last stats read before releasing the watcher');
 ctx.startAchievementBridge('C:/Fixture/Steam','76561198000000001','620');await drain();const expiry=[...timers.values()].find(t=>t.ms===120000);assert.ok(expiry);expiry.fn();assert.equal(closes,2,'abandoned launch closes its watcher');
 ctx.startAchievementBridge('C:/Fixture/Steam','76561198000000001','620');ctx.__NEXUS_STEAM_STOP__();ctx.__NEXUS_STEAM_STOP__();assert.equal(closes,3,'disable/quit cleanup is idempotent');
 console.log('PASS: Steam watcher follows native game lifecycle, flushes final stats, expires abandoned launches, and releases timers/watchers on disable/quit. No Steam or user files accessed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
