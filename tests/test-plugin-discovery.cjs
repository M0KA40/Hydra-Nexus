'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createPluginDiscovery}=require('../src/plugin-discovery.cjs'),{createPluginRestart}=require('../src/plugin-restart.cjs'),{createUpdateShutdown}=require('../src/update-shutdown.cjs');
(async()=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-discovery-'));try{
  let ledger=createPluginDiscovery({directory});assert.deepEqual(ledger.snapshot().pending,['storage','downloadFinish','pageCleaner']);
  let theme=createPluginDiscovery({directory,theme:true});assert.deepEqual(theme.snapshot().pending,['quietMint']);await theme.acknowledge('quietMint');theme=createPluginDiscovery({directory,theme:true});assert.deepEqual(theme.snapshot().pending,[],'theme discovery is durable and separate from plugin discovery');
  await Promise.all([ledger.acknowledge('storage'),ledger.acknowledge('downloadFinish'),ledger.acknowledge('pageCleaner')]);assert.deepEqual(ledger.snapshot().pending,[]);
  // A new controller after installer reapply/preview-to-final uses the same data and IDs.
  ledger=createPluginDiscovery({directory});assert.deepEqual(ledger.snapshot().pending,[]);await ledger.acknowledge('storage');assert.deepEqual(ledger.snapshot().pending,[]);
  await assert.rejects(()=>ledger.acknowledge('tabs'),/Unknown/);
  await fs.writeFile(path.join(directory,'plugin-discovery.json'),'damaged');ledger=createPluginDiscovery({directory});assert.deepEqual(ledger.snapshot().pending,[]);await ledger.acknowledge('storage');assert.equal(await fs.readFile(path.join(directory,'plugin-discovery.json'),'utf8'),'damaged');
  const guides=require('../src/plugin-guides.cjs'),{catalogs}=require('../src/i18n.cjs');assert.equal(Object.keys(guides).length,11);for(const guide of Object.values(guides))for(const key of [guide.location,...guide.steps,...(guide.images||[]).map(img=>img.caption)])for(const [language,catalog]of Object.entries(catalogs))assert.ok(catalog[key],language+': '+key);
  for(const mode of ['cancel','guard','flush','save','relaunch','success']){
    const calls=[],config={plugins:{downloadFinish:false}},app={relaunch(){calls.push('relaunch');if(mode==='relaunch')throw Error('relaunch failed');},exit(){calls.push('exit');}},native={async prepare(){calls.push('prepare');},async close(){calls.push('close');},async reopen(){calls.push('reopen');}};
    const shutdown=createUpdateShutdown({app,getNative:()=>native,guard(){if(mode==='guard')throw Error('game running');},flush:async()=>{calls.push('flush');if(mode==='flush')throw Error('flush failed');}});
    const restart=createPluginRestart({app,dialog:{async showMessageBox(){calls.push('confirm');return {response:mode==='cancel'?0:1};}},shutdown,getConfig:()=>config,async saveConfig(enabled){calls.push('save:'+enabled);if(mode==='save'&&enabled)throw Error('disk full');config.plugins.downloadFinish=enabled;}});
    if(mode==='success'){await restart.enable({});assert.equal(config.plugins.downloadFinish,true);assert.deepEqual(calls.slice(-3),['save:true','relaunch','exit']);}
    else if(mode==='cancel'){await restart.enable({});assert.deepEqual(calls,['confirm']);assert.equal(config.plugins.downloadFinish,false);}
    else{await assert.rejects(()=>restart.enable({}));assert.equal(config.plugins.downloadFinish,false);assert.ok(!calls.includes('exit'));if(mode==='relaunch')assert.ok(calls.includes('reopen'));}
    assert.equal(restart.busy(),false);
  }
  let release;const restart=createPluginRestart({app:{},dialog:{showMessageBox:()=>new Promise(resolve=>release=resolve)},shutdown:{},getConfig:()=>({plugins:{downloadFinish:false}}),saveConfig:async()=>{}});const first=restart.enable({});await assert.rejects(()=>restart.enable({}),/already running/);release({response:0});await first;
  console.log('PASS: durable feature discovery, concurrent acknowledgement, corrupt ledger preservation, nine-locale guides and guarded restart/cancel/rollback/relaunch ordering.');
}finally{await fs.rm(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
