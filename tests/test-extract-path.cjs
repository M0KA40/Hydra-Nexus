'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {createExtractPaths}=require('../src/extract-path.cjs');
const python=process.env.HYDRA_PYTHON||'python';
const run=(code,args=[])=>cp.execFileSync(python,['-c',code,...args],{windowsHide:true});
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'extract-path-')),downloadPath=path.join(root,'downloads'),destination=path.join(root,'games');await fs.mkdir(downloadPath);await fs.mkdir(destination);
 const archive=path.join(downloadPath,'Test Game.zip');run('import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w");z.writestr("game.exe",b"FIXTURE-GAME");z.close()',[archive]);
 const records=new Map(),events=[],progress=[],failures=[],discovery=[],deletions=[];let plugin=true,fail=false,hold=null;
 const native={downloads:{get:async k=>records.get(k)},db:{get:async()=>({deleteArchiveFilesAfterExtractionByDefault:false})},windows:{sendToAppWindows:(...x)=>events.push(x)},deleteArchive:async p=>{deletions.push(p);await fs.unlink(p);return true;},
 zip:{listEntries:async()=>[{name:'game.exe',size:12}],extractFile:async(options,onProgress)=>{if(hold)await hold;if(fail)throw Error('Injected decode failure');run('import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',[options.filePath,options.outputPath]);onProgress({percent:50});return {success:true};}},
 manager:class{constructor(shop,id){this.key=shop+':'+id;}updateExtractionProgress(p){progress.push(p);}async setExtractionComplete(){discovery.push(service.resolved(this.key,records.get(this.key)));}async setExtractionFailedState(e){failures.push(e.message);}}
 };
 let service=createExtractPaths({directory:path.join(root,'settings'),getNative:()=>native,enabled:()=>plugin});await service.init();
 const payload={shop:'steam',objectId:'42',uri:'https://fixture.invalid/game.zip',downloadPath,folderName:'Test Game.zip',automaticallyExtract:true,nexusExtractPath:destination,timestamp:1};
 async function start(_e,p){assert.equal(Object.hasOwn(p,'nexusExtractPath'),false);records.set('steam:42',{...p});return {ok:true};}
 await service.downloadEvent(start,{},payload);assert.equal(service.status().lastPath,destination);
 // Restart, then change last folder with another game: queued jobs keep theirs.
 service=createExtractPaths({directory:path.join(root,'settings'),getNative:()=>native,enabled:()=>plugin});await service.init();
 const other=path.join(root,'other');await fs.mkdir(other);await service.downloadEvent(async(_e,p)=>{records.set('steam:43',p);return {ok:true};},{},{...payload,objectId:'43',nexusExtractPath:other});
 const before=await fs.readFile(archive);assert.equal(await service.extract(records.get('steam:42'),{}),true);assert.deepEqual(failures,[]);
 const target=path.join(destination,'Test Game');assert.equal(await fs.readFile(path.join(target,'game.exe'),'utf8'),'FIXTURE-GAME');assert.deepEqual(await fs.readFile(archive),before);assert.equal(records.get('steam:42').downloadPath,downloadPath);assert.equal(records.get('steam:42').folderName,'Test Game.zip');assert.equal(discovery[0],target);assert.equal(events[0][0],'on-archive-deletion-prompt');assert.deepEqual(events[0][1],[archive]);assert.equal(service.busy(),false);assert.ok(progress.includes(1));
 // Plugin off: no custom extraction; already extracted games still resolve.
 plugin=false;assert.equal(await service.extract(records.get('steam:43'),{}),false);assert.equal(service.resolved('steam:42',records.get('steam:42')),target);plugin=true;
 // Replacement download, failure/cancel, stale identity and archive retention.
 const prior=JSON.parse(await fs.readFile(path.join(root,'settings/extract-paths.json'),'utf8'));
 assert.equal((await service.downloadEvent(async()=>({ok:false}),{},{...payload,uri:'failed',nexusExtractPath:other})).ok,false);assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'settings/extract-paths.json'),'utf8')).jobs['steam:42'],prior.jobs['steam:42']);
 assert.equal(await service.extract({...records.get('steam:42'),timestamp:99},{}),false);
 const retryDestination=path.join(root,'retry');await fs.mkdir(retryDestination);
 await service.downloadEvent(start,{},{...payload,nexusExtractPath:retryDestination,timestamp:2,automaticallyDeleteArchiveFiles:true});fail=true;await service.extract(records.get('steam:42'),{});assert.equal(failures.at(-1),'Injected decode failure');assert.equal(deletions.length,0);assert.deepEqual(await fs.readFile(archive),before);fail=false;
 let release;hold=new Promise(r=>release=r);const working=service.extract(records.get('steam:42'),{});await new Promise(r=>setTimeout(r,20));assert.equal(service.busy(),true);assert.equal(await service.extract(records.get('steam:42'),{}),true);await assert.rejects(service.downloadEvent(start,{},payload),/Wait for extraction/);release();await working;hold=null;assert.deepEqual(deletions,[archive]);
 // Folder extraction and the second, nested pass write to the chosen target.
 const folder=path.join(downloadPath,'Folder Game');await fs.mkdir(folder);run('import zipfile,sys,io;n=io.BytesIO();z=zipfile.ZipFile(n,"w");z.writestr("nested.exe",b"NESTED");z.close();o=zipfile.ZipFile(sys.argv[1],"w");o.writestr("inner.zip",n.getvalue());o.close()',[path.join(folder,'outer.zip')]);
 const folderPayload={...payload,objectId:'44',folderName:'Folder Game',uri:'folder',timestamp:4};await service.downloadEvent(async(_e,p)=>{records.set('steam:44',p);return {ok:true};},{},folderPayload);await service.extract(records.get('steam:44'),{});assert.equal(await fs.readFile(path.join(destination,'Folder Game/nested.exe'),'utf8'),'NESTED');assert.ok(await fs.stat(path.join(folder,'outer.zip')));
 // Missing destination, invalid selection and overlap fail without deleting sources.
 await assert.rejects(service.downloadEvent(start,{},{...payload,nexusExtractPath:'relative'}),/valid extraction/);
 await assert.rejects(service.choose(null,{showOpenDialog:async()=>({canceled:false,filePaths:[path.join(root,'missing')]})}),/unavailable/);
 assert.deepEqual(await service.choose(null,{showOpenDialog:async()=>({canceled:true})}),{cancelled:true});
 await service.downloadEvent(async(_e,p)=>{records.set('steam:45',p);return {ok:true};},{},{...folderPayload,objectId:'45',nexusExtractPath:folder});await service.extract(records.get('steam:45'),{});assert.match(failures.at(-1),/separate/);assert.ok(await fs.stat(path.join(folder,'outer.zip')));
 await service.downloadEvent(async(_e,p)=>{records.set('steam:46',p);return {ok:true};},{},{...folderPayload,objectId:'46'});await service.extract(records.get('steam:46'),{});assert.match(failures.at(-1),/another download/);assert.equal(await fs.readFile(path.join(destination,'Folder Game/nested.exe'),'utf8'),'NESTED');
 await service.downloadEvent(async(_e,p)=>{records.set('steam:47',p);return {ok:true};},{},{...folderPayload,objectId:'47',nexusExtractPath:downloadPath});assert.equal(service.status().lastPath,downloadPath);assert.equal(await service.extract(records.get('steam:47'),{}),false,'selecting the native location keeps the native pipeline');
 const noSpaceTarget=path.join(root,'no-space');await fs.mkdir(noSpaceTarget);const previousList=native.zip.listEntries;native.zip.listEntries=async()=>[{name:'game.exe',size:Number.MAX_SAFE_INTEGER}];await service.downloadEvent(async(_e,p)=>{records.set('steam:48',p);return {ok:true};},{},{...folderPayload,objectId:'48',nexusExtractPath:noSpaceTarget});await service.extract(records.get('steam:48'),{});assert.match(failures.at(-1),/not enough free space/);assert.ok(await fs.stat(path.join(folder,'outer.zip')));native.zip.listEntries=previousList;
 const loose=path.join(downloadPath,'Loose Game');await fs.mkdir(loose);await fs.writeFile(path.join(loose,'setup.exe'),'LOOSE');await service.downloadEvent(async(_e,p)=>{records.set('steam:49',p);return {ok:true};},{},{...folderPayload,objectId:'49',folderName:'Loose Game'});assert.equal(await service.extract(records.get('steam:49'),{}),false,'non-archive downloads retain native behavior');assert.equal(await fs.readFile(path.join(loose,'setup.exe'),'utf8'),'LOOSE');
 // Corrupt settings must not be overwritten even by a default native submission.
 const damagedDir=path.join(root,'damaged');await fs.mkdir(damagedDir);const damagedFile=path.join(damagedDir,'extract-paths.json');await fs.writeFile(damagedFile,'{broken');const damaged=createExtractPaths({directory:damagedDir,getNative:()=>native});await damaged.init();await assert.rejects(damaged.downloadEvent(start,{},payload),/damaged/);await damaged.downloadEvent(start,{},{...payload,nexusExtractPath:null});assert.equal(await fs.readFile(damagedFile,'utf8'),'{broken');
 console.log('PASS: generated ZIP bytes extracted to selected folder; persistent last folder and queued identity; nested directory archives; plugin disabled/default path; discovery; exact source retention; deletion only after success; duplicate extraction and active-download guards; cancel/invalid/corrupt settings. Python zipfile is the isolated decoder fixture, not a real Hydra extraction.');
})().catch(e=>{console.error(e);process.exitCode=1;});
