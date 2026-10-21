'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os');
const {DriveFolderSync}=require('../src/drive-folder.cjs');
const {hashFile}=require('../src/core.cjs');
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'drive-folder-fixture-')),stateDir=path.join(root,'state'),parent=path.join(root,'My Drive'),local=path.join(root,'local'),events=[];
 await fsp.mkdir(stateDir);await fsp.mkdir(parent);await fsp.mkdir(local);await fsp.writeFile(path.join(stateDir,'google-token.bin'),'obsolete');
 const create=()=>new DriveFolderSync({stateDir,getProtectedPaths:()=>[local],notify:x=>events.push(x)});let drive=create();assert.equal((await drive.status()).connected,false);assert.equal(fs.existsSync(path.join(stateDir,'google-token.bin')),false);
 await assert.rejects(drive.configure(local),/separate/);await assert.rejects(drive.configure(path.parse(root).root),/drive root/);
 await drive.configure(parent);assert.equal((await drive.status()).available,true);assert.equal(drive.folder,path.join(parent,'Hydra Nexus Backups'));
 const folder=path.join(local,'snapshot');await fsp.mkdir(folder);await fsp.writeFile(path.join(folder,'manifest.json'),'fixture');await fsp.writeFile(path.join(folder,'save.dat'),'actual save data');
 const snapshots=[{id:'snapshot-1',key:'steam:123',game:{title:'Game One'},folder}];let verified=0;
 const result=await drive.uploadSnapshots(snapshots,async p=>{assert.equal(p,folder);verified++;});assert.equal(result.uploaded.length,1);assert.equal(result.cloudConfirmed,false);assert.equal(verified,1);assert.equal(drive.uploading,false);
 const files=await fsp.readdir(drive.folder);assert.equal(files.length,1);assert.match(files[0],/\.zip$/);const zip=await fsp.readFile(path.join(drive.folder,files[0]));assert.equal(zip.readUInt16LE(0),0x4b50);
 assert.equal((await drive.uploadSnapshots(snapshots,()=>{})).skipped,1);assert.equal((await fsp.readdir(drive.folder)).length,1);
 const receipt=JSON.parse(await fsp.readFile(path.join(stateDir,'drive-folder-receipts.json'),'utf8'));assert.equal(receipt['steam:123:snapshot-1'].sha256,await hashFile(path.join(drive.folder,files[0])));
 // Cancellation during archive preparation leaves neither a partial cloud file nor temp archive.
 const originalZip=drive.zip.bind(drive);drive.zip=async snapshot=>{const p=await originalZip(snapshot);drive.cancel();return p;};await assert.rejects(drive.uploadSnapshots([{...snapshots[0],id:'cancel'}],()=>{}),/cancelled/);assert.equal((await fsp.readdir(drive.folder)).some(x=>x.endsWith('.partial')),false);assert.equal((await fsp.readdir(path.join(stateDir,'uploads'))).length,0);drive.zip=originalZip;
 await drive.resetRetries();const originalFolder=drive.folder;await fsp.rename(originalFolder,originalFolder+'-offline');assert.equal((await drive.status()).available,false);
 for(let i=1;i<=3;i++){drive.nextRetry=0;await assert.rejects(drive.uploadSnapshots(snapshots,()=>{},{automatic:true}));assert.equal(drive.retryAttempts,i);if(i<3)assert.equal(await drive.canAutomatic(),false);}
 drive=create();assert.equal((await drive.status()).retryPaused,true);assert.equal(await drive.canAutomatic(),false);const paused=await drive.uploadSnapshots(snapshots,()=>{throw Error('must not run')},{automatic:true});assert.equal(paused.paused,true);
 assert.equal(fs.existsSync(originalFolder),false);await fsp.rename(originalFolder+'-offline',originalFolder);assert.equal((await drive.uploadSnapshots(snapshots,()=>{})).skipped,1);assert.equal(drive.retryAttempts,0);
 await assert.rejects(drive.uploadSnapshots([{...snapshots[0],id:'../escape'}],()=>{}),/identity/);assert.equal(drive.uploading,false);
 await assert.rejects(drive.uploadSnapshots([{...snapshots[0],id:'integrity'}],()=>{throw Error('Corrupt snapshot')}),/Corrupt/);
 await drive.disconnect();assert.equal((await create().status()).connected,false);assert.equal((await fsp.readdir(originalFolder)).length,1);assert.equal(events.at(-1).phase,'idle');
 console.log('PASS: desktop Drive actual ZIP/copy/hash, duplicate skip, protected paths, cancellation cleanup, missing drive, persistent 3-attempt limit, manual recovery, snapshot integrity and disconnect without archive deletion.');
 await fsp.rm(root,{recursive:true,force:true});
})().catch(e=>{console.error(e);process.exitCode=1});

