'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createReleaseNotes}=require('../src/release-notes.cjs'),{createUpdater}=require('../src/updater.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'release-notes-'));let calls=0,events=[];
 const release={version:'1.2.0',revision:5,notes:'<!-- HYDRA_NEXUS_REVISION 5 -->\n## Changes\n- Private mode repaired'};
 const options={directory:root,version:'1.2.0',revision:5,load:async()=>{calls++;return release;},changed:value=>events.push(value)};
 const notes=createReleaseNotes(options);const [first,second]=await Promise.all([notes.prepare(),notes.prepare()]);assert.equal(first.id,'1.2.0:5');assert.equal(first,second);assert.equal(calls,1);assert.ok(!first.notes.includes('HYDRA_NEXUS_REVISION'));assert.equal(notes.current().version,'1.2.0');
 await assert.rejects(notes.dismiss('wrong'));await notes.dismiss(first.id);assert.equal(notes.current(),null);assert.equal(events.at(-1),null);
 const restart=createReleaseNotes(options);assert.equal(await restart.prepare(),null);assert.equal(calls,1,'dismissed version never fetches or shows again');
 const empty=createReleaseNotes({...options,revision:6,load:async()=>({...release,revision:6,notes:'<!-- internal -->'})});assert.equal(await empty.prepare(),null);
 for(const result of [null,{...release,version:'9.0.0'},{...release,revision:4}])assert.equal(await createReleaseNotes({...options,directory:path.join(root,'unseen'),load:async()=>result}).prepare(),null);
 assert.equal(await createReleaseNotes({...options,directory:path.join(root,'offline'),load:async()=>{throw Error('offline');}}).prepare(),null);
 let urls=[];const updater=createUpdater({directory:path.join(root,'updater'),version:'1.2.0',revision:5,getRepository:()=> 'M0KA40/Hydra-Nexus',fetcher:async url=>{urls.push(url);return {ok:true,body:[Buffer.from(JSON.stringify({tag_name:'v1.2.0',body:release.notes}))]};},app:{},dialog:{}});
 assert.equal((await updater.installedNotes()).revision,5);assert.deepEqual(urls,['https://api.github.com/repos/M0KA40/Hydra-Nexus/releases/tags/v1.2.0'],'fetch installed tag, not a newer release');
 const wrong=createUpdater({directory:root,version:'1.2.0',revision:5,getRepository:()=> 'M0KA40/Hydra-Nexus',fetcher:async()=>({ok:true,body:[Buffer.from(JSON.stringify({tag_name:'v1.2.0',body:'<!-- HYDRA_NEXUS_REVISION 6 -->\nNewer internal notes'}))]}),app:{},dialog:{}});assert.equal(await wrong.installedNotes(),null);
 console.log('PASS: installed GitHub tag and exact revision; one fetch; one-time acknowledgement across restarts; no empty/wrong/newer/offline popup; internal markers removed; no live network.');
})().catch(e=>{console.error(e);process.exitCode=1;});
