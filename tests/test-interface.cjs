'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {ThemeStore}=require('../src/themes.cjs');
(async()=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-interface-'));try{
 let store=await new ThemeStore({directory}).init();assert.deepEqual(store.public().interface,{schema:1,design:'native'});
 assert.equal(store.public().quietColor,'slate');await store.selectQuietColor('mint');assert.equal(store.public().quietColor,'mint');await assert.rejects(store.selectQuietColor('unknown'),/Unknown/);
 const image=path.join(directory,'fixture.png');await fs.writeFile(image,'synthetic image bytes');await store.commitBackground((await store.prepareBackground(image)).file);
 const background=structuredClone(store.data.background);await store.selectQuietColor('slate');await store.selectQuietColor('mint');assert.deepEqual(store.data.background,background,'palette preserves managed media');await store.selectInterface('quiet');assert.deepEqual(store.data.background,background);assert.equal(store.public().interface.design,'quiet');
 assert.equal(store.public().quietBackground,false,'Quiet custom media is opt-in');await store.setQuietBackground(true);assert.equal(store.public().quietBackground,true);assert.deepEqual(store.data.background,background);await assert.rejects(store.setQuietBackground('true'),/Invalid background preference/);
 store=await new ThemeStore({directory}).init();assert.equal(store.public().interface.design,'quiet','choice survives restart');assert.equal(store.public().quietColor,'mint','color survives restart');assert.deepEqual(store.data.background,background);
 assert.equal(store.public().quietBackground,true,'media opt-in persists');await store.setQuietBackground(false);assert.deepEqual(store.data.background,background,'disabling keeps media for reuse');
 await store.backgroundOptions({blur:4});assert.equal(store.public().interface.design,'quiet','unrelated preferences retain interface');const before=await fs.readFile(store.file);
 for(const invalid of [null,'unknown','constructor',{},false])await assert.rejects(store.selectInterface(invalid),/Unknown interface design/);
 assert.deepEqual(await fs.readFile(store.file),before,'invalid values do not write preferences');
 const save=store.save;store.save=async()=>{throw Error('fixture write failure');};await assert.rejects(store.selectQuietColor('slate'),/fixture write failure/);assert.equal(store.public().quietColor,'mint','failed palette save preserves selected color');await assert.rejects(store.selectInterface('native'),/fixture write failure/);assert.equal(store.public().interface.design,'quiet','failed save retains active design');store.save=save;
 await store.selectInterface('native');assert.equal(store.public().interface.design,'native');assert.equal(store.public().quietColor,'mint','native selection retains saved Quiet color');assert.equal(store.data.background.file,background.file,'disable retains original media');
 const legacy=JSON.parse(await fs.readFile(store.file));delete legacy.interface;await fs.writeFile(store.file,JSON.stringify(legacy));const legacyBytes=await fs.readFile(store.file);store=await new ThemeStore({directory}).init();assert.equal(store.public().interface.design,'native');assert.deepEqual(await fs.readFile(store.file),legacyBytes,'legacy read is not a migration write');
 console.log('PASS: versioned opt-in interface; restart; independent background state; invalid/failed writes; legacy default without rewrite. No Hydra data accessed.');
 }finally{await fs.rm(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
