'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const pack=require('../src/release-content.cjs'),{languages,matchingPack,translations}=require('../src/release-localization.cjs');
const {revision}=pack;
const {createUpdater}=require('../src/updater.cjs'),{createReleaseNotes}=require('../src/release-notes.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-localized-release-'));
 try{
  assert.deepEqual(Object.keys(pack.notes).sort(),[...languages].sort());
  for(const language of languages){assert.equal((await fs.readFile(path.join(__dirname,'../docs/releases/2.0.0',language+'.md'),'utf8')).replace(/\r\n/g,'\n'),pack.notes[language]);assert.ok(pack.notes[language].length>500&&pack.notes[language].length<16000);assert.ok(!pack.notes[language].includes('\ufffd'));}
  assert.equal(matchingPack({...pack,revision:revision+1},'2.0.0',revision),null);assert.equal(matchingPack(pack,'1.9.0',revision),null);assert.equal(matchingPack({...pack,schema:2},'2.0.0',revision),null);
  assert.deepEqual(translations({en:'<!-- private -->\nEnglish',ar:3,other:'ignore'}),{en:'English'});
  const options={directory:root,version:'2.0.0',revision,getRepository:()=> 'M0KA40/Hydra-Nexus',app:{},dialog:{}};
  let calls=0;const offline=createUpdater({...options,fetcher:async()=>{calls++;throw Error('offline');}});
  const expected=translations(pack.notes),installed=await offline.installedNotes();assert.equal(calls,0,'installed notes must work offline');assert.deepEqual(installed.translations,expected);
  const popup=createReleaseNotes({directory:root,version:'2.0.0',revision,load:()=>offline.installedNotes()});const value=await popup.prepare();assert.equal(value.id,'2.0.0:'+revision);assert.deepEqual(value.translations,expected);await popup.dismiss(value.id);
  assert.equal(await createReleaseNotes({directory:root,version:'2.0.0',revision,load:()=>{throw Error('acknowledged release must not load');}}).prepare(),null);
  const prefix='https://github.com/M0KA40/Hydra-Nexus/releases/download/v2.0.0/';
  const release={tag_name:'v2.0.0',body:'<!-- HYDRA_NEXUS_REVISION '+revision+' -->\nEnglish release fallback',assets:['Hydra_Nexus.bat','SHA256SUMS.txt','Hydra-Nexus-2.0.0-release-notes.json'].map(name=>({name,browser_download_url:prefix+name}))};
  for(const scenario of ['valid','missing','offline','wrong-version','wrong-revision','foreign-url','malformed']){
   const metadata=structuredClone(release);if(scenario==='missing')metadata.assets.pop();if(scenario==='foreign-url')metadata.assets.at(-1).browser_download_url='https://example.com/notes.json';let requests=[];
   const updater=createUpdater({...options,version:'1.9.0',fetcher:async url=>{requests.push(url);let data;if(url.includes('api.github.com'))data=metadata;else{if(scenario==='offline')throw Error('offline');if(scenario==='malformed')return {ok:true,body:[Buffer.from('{')]};data=scenario==='wrong-version'?{...pack,version:'2.1.0'}:scenario==='wrong-revision'?{...pack,revision:revision+1}:pack;}return {ok:true,body:[Buffer.from(JSON.stringify(data))]};}});
   const result=await updater.action(null,'checkUpdates');assert.equal(result.release.newer,true);assert.equal(result.release.notes,release.body);
   if(scenario==='valid')assert.deepEqual(result.release.translations,expected);else assert.equal(result.release.translations,undefined,scenario+' must retain English fallback');
   assert.equal(requests.length,['missing','foreign-url'].includes(scenario)?1:2);
  }
  console.log('PASS: nine exact release translations, offline installed notes, durable acknowledgement, revision/version matching, 1.9→2.0 discovery and missing/invalid/offline/foreign asset English fallback; mocked network only.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
