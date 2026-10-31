'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {createPrivacy}=require('../src/privacy.cjs');
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'privacy-fixture-'));
 let cfg={plugins:{invisible:true},invisibleMode:true},ctx={environment:'fixture',userId:'a'},requests=[],connects=0,closes=0,stops=0,triggers=0,records=[],souvenirs=[],interceptors=[],authChanged;
 const api={getAuthContext:()=>ctx,isLoggedIn:()=>true,onAuthContextChanged:fn=>authChanged=fn,get:async url=>'image',instance:{interceptors:{request:{use:fn=>interceptors.push(fn)}}}};
 for(const method of ['post','postResponse','put','patch','delete'])api[method]=async(url,data,...options)=>{requests.push([method,url,data,...options]);return data;};
 const realtime={connect(){connects++;},close(){closes++;},reconnectNow(){connects++;}},worker={enqueue:async row=>records.push(row),records:async()=>records,stop(){stops++;},trigger:async()=>{triggers++;}},store={put:async row=>souvenirs.push(row),list:async()=>souvenirs};
 const caps={api,realtime,achievementWorker:worker,souvenirStore:store,souvenirWorker:{stop(){stops++;},trigger:async()=>{triggers++;}}},privacy=createPrivacy({directory:root,getConfig:()=>cfg});privacy.bind(caps);
 assert.equal(privacy.status().supported,true);assert.equal(privacy.status().profileSync,false);assert.equal(privacy.status().integrationHeld,true);assert.equal(privacy.status().strict,true);assert.ok(closes);assert.equal(stops,0);
 realtime.connect();realtime.reconnectNow();authChanged();assert.equal(connects,0);assert.equal(privacy.status().visibilityVerified,false);assert.equal(privacy.status().serverNotificationsVerified,false);
 const game={shop:'steam',objectId:'777',remoteId:'r777'},activity={playTimeDeltaInSeconds:5,lastTimePlayed:'2026-10-28T18:00:00Z'},achievement={id:'r777',achievements:[{name:'FIRST',unlockTime:100}]};
 assert.equal(privacy.blockGame(game),false,'native hooks must reach transport rejection instead of pretending to sync');
 const denied=['/auth/realtime','/profile/games','/profile/games/batch','/profile/games/steam/777','/profile/games/steam/777/playtime','/profile/games/achievements','/profile/games/steam/777/retroachievements/sync','/profile/integrations/steam/sync','/profile/integrations/epic/sync/chunks','/profile/integrations/steam/achievement-targets','/profile/game-links','/profile/screenshots','/profile/screenshots/77/complete','/profile/souvenirs/77/visibility','/profile/souvenirs-visibility','/presigned-urls/achievement-image','/presigned-urls/screenshot','https://api.fixture/profile/games/steam/777?x=1','/%70rofile/games/steam/777'];
 for(const route of denied)for(const method of ['post','postResponse','put','patch','delete']){const before=requests.length;await assert.rejects(api[method](route,activity),e=>e.code==='NEXUS_INVISIBLE');assert.equal(requests.length,before,method+' '+route+' cannot reach transport');assert.throws(()=>interceptors[0]({url:route,method:method==='postResponse'?'POST':method,data:JSON.stringify(activity)}),e=>e.code==='NEXUS_INVISIBLE');}
 for(const route of ['/profile/games/artifacts','/profile/games/artifacts/backup/download','/profile/chats/other/messages','/auth/refresh','/downloads/example']){await api.post(route,activity);assert.equal(requests.at(-1)[2],activity);}
 for(const route of denied){assert.equal(privacy.policy('GET',route,activity).data,activity);assert.equal(privacy.policy('HEAD',route,activity).deny,undefined);}
 await worker.enqueue({gameKey:'steam:777',context:ctx,achievements:['FIRST']});assert.equal((await worker.records()).length,1,'durable native achievement row retained');
 const screenshot={clientId:'new',gameKey:'steam:777',ownerId:'a',capturedAt:Date.now()};await store.put(screenshot);assert.equal((await store.list()).length,1);assert.deepEqual(await store.list({nexusUpload:true}),[],'strict mode does not reserve or publish captures');
 const save=value=>async()=>{cfg={plugins:{invisible:true},invisibleMode:value};};
 await privacy.change(false,save(false));assert.equal(connects,1);assert.equal(privacy.status().profileSync,true);await api.put('/profile/games/steam/777',activity);assert.equal(requests.at(-1)[2],activity);assert.equal((await store.list({nexusUpload:true}))[0],screenshot,'off resumes native queues, never a second custom replay');
 await assert.rejects(privacy.change(true,save(true)),/Confirm the privacy impact/);assert.equal(cfg.invisibleMode,false);await privacy.change(true,save(true),{accepted:true});
 const nextInterceptors=[];api.instance={interceptors:{request:{use:fn=>nextInterceptors.push(fn)}}};assert.equal(nextInterceptors.length,1);assert.throws(()=>nextInterceptors[0]({url:'/profile/games/batch',method:'post'}),e=>e.code==='NEXUS_INVISIBLE');ctx={environment:'fixture',userId:'b'};authChanged();await assert.rejects(api.put('/profile/games/steam/777',activity),e=>e.code==='NEXUS_INVISIBLE');ctx={environment:'fixture',userId:'a'};
 const saveFailure=Error('disk full');await assert.rejects(privacy.change(false,async()=>{throw saveFailure;}),e=>e===saveFailure);assert.equal(privacy.status().active,true);await privacy.change(false,async()=>{cfg={plugins:{invisible:false},invisibleMode:false};});assert.equal(privacy.status().active,false);await api.post('/auth/realtime');assert.equal(triggers>=6,true);await privacy.flush();assert.equal(fs.existsSync(path.join(root,'invisible-state.json')),false,'no second replay ledger or fabricated acknowledgements');
 // Upgrade a real schema-1 ledger without deleting old identifiers or publishing
 // screenshots captured under its former promise. Profile activity is independent.
 const owner=crypto.createHash('sha256').update(JSON.stringify(['fixture','a'])).digest('hex').slice(0,24);
 const legacyDir=path.join(root,'legacy');await fsp.mkdir(legacyDir);
 const legacy={schema:1,records:{[owner+'|steam:777']:{key:'steam:777',remoteId:'r777'}},integrationHolds:{}};
 await fsp.writeFile(path.join(legacyDir,'invisible-state.json'),JSON.stringify(legacy));
 let legacyRows=[];const legacyStore={put:async row=>legacyRows.push(row),list:async()=>legacyRows};
 const legacyCfg={plugins:{invisible:true},invisibleMode:true};
 const legacyPrivacy=createPrivacy({directory:legacyDir,getConfig:()=>legacyCfg});
 let legacyAuthChanged,legacyQueueRuns=0,legacyPresence=0;const legacyQueued=[{gameKey:'steam:777',context:ctx}],legacyWorker={records:async()=>legacyQueued,trigger:async()=>{legacyQueueRuns++;}};
 legacyPrivacy.bind({api:{getAuthContext:()=>ctx,onAuthContextChanged:fn=>legacyAuthChanged=fn,post:async()=>{},put:async()=>{}},realtime:{close(){},connect(){legacyPresence++;}},achievementWorker:legacyWorker,souvenirStore:legacyStore});
 assert.equal(legacyQueueRuns,1,'old installations automatically resume native profile queues at upgrade startup without Resume activity sharing');assert.deepEqual(await legacyWorker.records(),legacyQueued,'previously held achievements reach the native queue unchanged');legacyAuthChanged();assert.equal(legacyQueueRuns,2,'session restoration retries sharing without requiring an Invisible toggle');assert.equal(legacyPresence,0,'automatic profile recovery preserves Invisible presence');assert.equal(legacyCfg.invisibleMode,true);
 await legacyPrivacy.flush();const saved=JSON.parse(await fsp.readFile(path.join(legacyDir,'invisible-state.json'),'utf8'));
 assert.equal(saved.profileSyncVersion,2);assert.ok(saved.legacyScreenshotCutoff);assert.deepEqual(saved.records,legacy.records,'the legacy privacy ledger is preserved, not deleted');
 await legacyPrivacy.change(false,async()=>{legacyCfg.invisibleMode=false;});
 legacyRows=[{clientId:'old',ownerId:'a',gameKey:'steam:777',remoteGameId:'r777',capturedAt:saved.legacyScreenshotCutoff-1000},{clientId:'new',ownerId:'a',gameKey:'steam:777',remoteGameId:'r777',capturedAt:saved.legacyScreenshotCutoff+1000},{clientId:'other',ownerId:'a',gameKey:'steam:888',capturedAt:saved.legacyScreenshotCutoff-1000},{clientId:'account-b',ownerId:'b',gameKey:'steam:777',capturedAt:saved.legacyScreenshotCutoff-1000}];
 assert.equal((await legacyStore.list()).length,4,'native status/details retain all screenshots');
 assert.deepEqual((await legacyStore.list({nexusUpload:true})).map(x=>x.clientId),['new','other','account-b'],'only earlier held screenshots stay private; future captures and other accounts remain native');
 const timestampRows=[{clientId:'iso-new',ownerId:'a',gameKey:'steam:777',capturedAt:new Date(saved.legacyScreenshotCutoff+1000).toISOString()},{clientId:'iso-old',ownerId:'a',gameKey:'steam:777',capturedAt:new Date(saved.legacyScreenshotCutoff-1000).toISOString()},{clientId:'invalid-old',ownerId:'a',gameKey:'steam:777',capturedAt:'invalid'},{clientId:'unknown-other-account',ownerId:'b',gameKey:'steam:777',capturedAt:'invalid'}];legacyRows.push(...timestampRows);
 assert.deepEqual((await legacyStore.list({nexusUpload:true})).map(x=>x.clientId),['new','other','account-b','iso-new','unknown-other-account'],'ISO and invalid timestamps cannot silently release historical images or block a different account');legacyRows.splice(4);
 assert.equal(legacyPrivacy.blockGame(game),false);assert.equal(legacyPrivacy.policy('PUT','/profile/games/achievements',achievement).data,achievement);
 await legacyPrivacy.change(false,async()=>{legacyCfg.plugins.invisible=false;legacyCfg.invisibleMode=false;});
 assert.deepEqual((await legacyStore.list({nexusUpload:true})).map(x=>x.clientId),['new','other','account-b'],'disabling never bulk-publishes historical private images');
 const reloaded=createPrivacy({directory:legacyDir,getConfig:()=>legacyCfg});const reloadStore={list:async()=>legacyRows};
 reloaded.bind({api:{getAuthContext:()=>ctx},souvenirStore:reloadStore});await reloaded.flush();
 assert.equal(JSON.parse(await fsp.readFile(path.join(legacyDir,'invisible-state.json'),'utf8')).legacyScreenshotCutoff,saved.legacyScreenshotCutoff,'restart cannot move the cutoff and accidentally capture later screenshots');
 assert.equal(reloaded.blockGame(game),false);assert.deepEqual((await reloadStore.list({nexusUpload:true})).map(x=>x.clientId),['new','other','account-b']);

 const integrationDir=path.join(root,'legacy-integration');await fsp.mkdir(integrationDir);
 await fsp.writeFile(path.join(integrationDir,'invisible-state.json'),JSON.stringify({...legacy,records:{},integrationHolds:{[owner]:['steam']}}));
 const integrationPrivacy=createPrivacy({directory:integrationDir,getConfig:()=>legacyCfg});const integrationStore={list:async()=>legacyRows};integrationPrivacy.bind({api:{getAuthContext:()=>ctx},souvenirStore:integrationStore});
 const integrationPayload={games:[game]};assert.equal(integrationPrivacy.policy('POST','/profile/integrations/steam/sync',integrationPayload).data,integrationPayload,'legacy store holds never suppress new sync transactions');
 assert.equal(integrationPrivacy.status().integrationHeld,false);
 await integrationPrivacy.flush();

 const bad=path.join(root,'bad');await fsp.mkdir(bad);const badFile=path.join(bad,'invisible-state.json');await fsp.writeFile(badFile,'broken');
 let damagedCfg={plugins:{invisible:true},invisibleMode:true},damagedConnects=0;const damaged=createPrivacy({directory:bad,getConfig:()=>damagedCfg});
 const damagedStore={list:async()=>legacyRows};damaged.bind({api:{getAuthContext:()=>ctx,isLoggedIn:()=>true,post:async()=>{},put:async()=>{}},realtime:{close(){},connect(){damagedConnects++;}},souvenirStore:damagedStore});
 assert.ok(damaged.status().error);assert.equal(damaged.blockGame(game),false);assert.equal(damaged.policy('PUT','/profile/games/achievements',achievement).deny,true,'strict policy remains effective independently of a damaged historical ledger');
 assert.equal((await damagedStore.list()).length,4);assert.deepEqual(await damagedStore.list({nexusUpload:true}),[]);
 await damaged.change(false,async()=>{damagedCfg={plugins:{invisible:false},invisibleMode:false};});assert.equal(damagedConnects,1,'even a damaged legacy ledger cannot trap the user in offline mode');
 await assert.rejects(damaged.flush());assert.equal(await fsp.readFile(badFile,'utf8'),'broken','damaged originals are never overwritten');

 const checkpointDir=path.join(root,'checkpoint');await fsp.mkdir(checkpointDir);await fsp.writeFile(path.join(checkpointDir,'invisible-checkpoint.json'),JSON.stringify(legacy));
 const recovered=createPrivacy({directory:checkpointDir,getConfig:()=>legacyCfg});recovered.bind({});const inFlight=recovered.flush();recovered.flushOnExit();await inFlight;
 const restart=createPrivacy({directory:checkpointDir,getConfig:()=>legacyCfg});restart.bind({});await restart.flush();
 assert.equal(restart.blockGame(game),false);assert.deepEqual(JSON.parse(await fsp.readFile(path.join(checkpointDir,'invisible-state.json'),'utf8')).records,legacy.records);
 assert.equal(fs.existsSync(path.join(checkpointDir,'invisible-checkpoint.json')),false,'checkpoint migration recovers without losing the old screenshot privacy ledger');
 const unsupported=createPrivacy({directory:path.join(root,'unsupported'),getConfig:()=>legacyCfg});await assert.rejects(unsupported.change(true,async()=>{}),/unavailable/);
 console.log('PASS: strict activity transport gate, no fake acknowledgement, unchanged local/native queues, privacy consent and preference failures, auth replacement, private cloud/read paths, durable legacy migration/account isolation/checkpoint recovery. Real friend-server visibility remains unverified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
