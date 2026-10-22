const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createUpdater,sha,releaseVersion,releaseRevision}=require('../src/updater.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'updater-faults-'));
 const cleanupDir=path.join(root,'cleanup','updates');await fs.mkdir(cleanupDir,{recursive:true});for(const name of ['Hydra_Nexus-old.bat','install-restart-deadbeef.ps1','install-after-close.ps1','keep.txt'])await fs.writeFile(path.join(cleanupDir,name),'old');
 for(const name of ['Hydra_Nexus-old.bat','install-restart-deadbeef.ps1','install-after-close.ps1'])await fs.utimes(path.join(cleanupDir,name),new Date(0),new Date(0));await fs.writeFile(path.join(cleanupDir,'install-restart-cafebabe.ps1'),'recent worker');
 const cleanupUpdater=createUpdater({directory:path.join(root,'cleanup'),version:'0.9.0',getRepository:()=> 'Test/Nexus',fetcher:async()=>{throw Error('No network needed for cleanup')},dialog:{},app:{}});await cleanupUpdater.action(null,'updateStatus');const cleanupNames=await fs.readdir(cleanupDir);assert.equal(cleanupNames.includes('Hydra_Nexus-old.bat'),false);assert.equal(cleanupNames.includes('install-restart-deadbeef.ps1'),false);assert.equal(cleanupNames.includes('install-after-close.ps1'),false);assert.ok(cleanupNames.includes('keep.txt'));assert.ok(cleanupNames.includes('install-restart-cafebabe.ps1'));assert.throws(()=>createUpdater({revision:0}),/revision/);
 const current=await fs.readFile(path.join(__dirname,'..','dist/Hydra_Nexus.bat'));
 const builtVersion=releaseVersion(current);
 const make=(kind)=>{
  const version=kind==='version'?'3.0.0':builtVersion;let confirms=0;
  const release={tag_name:'v'+version,body:'<!-- HYDRA_NEXUS_REVISION '+releaseRevision(current)+' -->',assets:[{name:'Hydra_Nexus.bat',browser_download_url:'https://github.com/Test/Nexus/releases/download/v'+version+'/Hydra_Nexus.bat'},{name:'SHA256SUMS.txt',browser_download_url:'https://github.com/Test/Nexus/releases/download/v'+version+'/SHA256SUMS.txt'}]};
  if(kind==='origin')release.assets[0].browser_download_url='https://unexpected.example/file.bat';
  const updater=createUpdater({directory:path.join(root,kind),version:'0.9.0',getRepository:()=> 'Test/Nexus',fetcher:async url=>({ok:true,body:[url.endsWith('/latest')?Buffer.from(JSON.stringify(release)):url.endsWith('.txt')?Buffer.from((kind==='hash'?'0'.repeat(64):sha(current))+'  Hydra_Nexus.bat\n'):current]}),dialog:{showMessageBox:async()=>{confirms++;return {response:0}}},app:{}});
  return {updater,confirmations:()=>confirms};
 };
 for(const [kind,pattern]of [['hash',/checksum did not match/],['version',/does not match the release/],['origin',/Unexpected release download location/]]){
  const test=make(kind);
  if(kind==='origin')await assert.rejects(test.updater.action(null,'checkUpdates'),pattern);
  else{await test.updater.action(null,'checkUpdates');await assert.rejects(test.updater.action(null,'installUpdate'),pattern);}
  assert.equal(test.confirmations(),0);
 }
 const same=createUpdater({directory:path.join(root,'same-version'),version:builtVersion,revision:1,getRepository:()=> 'Test/Nexus',fetcher:async()=>({ok:true,body:[Buffer.from(JSON.stringify({tag_name:'v'+builtVersion,body:'<!-- HYDRA_NEXUS_REVISION 2 -->',assets:[{name:'Hydra_Nexus.bat',browser_download_url:'https://github.com/Test/Nexus/releases/download/v1.0.0/Hydra_Nexus.bat'},{name:'SHA256SUMS.txt',browser_download_url:'https://github.com/Test/Nexus/releases/download/v1.0.0/SHA256SUMS.txt'}]}))]}),dialog:{},app:{}});assert.equal((await same.action(null,'checkUpdates')).release.newer,true);
 const cancelled=make('cancel');await cancelled.updater.action(null,'checkUpdates');assert.deepEqual(await cancelled.updater.action(null,'installUpdate'),{cancelled:true});assert.equal(cancelled.confirmations(),1);assert.equal((await cancelled.updater.action(null,'updateStatus')).installation,null);
 const persistedFile=JSON.parse(await fs.readFile(path.join(root,'cancel','updates','staged.json'),'utf8')).file;const resumed=createUpdater({directory:path.join(root,'cancel'),version:'0.9.0',getRepository:()=> 'Test/Nexus',fetcher(){throw Error('No network needed for a persisted verified update')},dialog:{showMessageBox:async()=>({response:0})},app:{}});assert.equal((await resumed.action(null,'updateStatus')).staged.version,builtVersion);assert.ok(await fs.access(persistedFile).then(()=>true,()=>false));assert.deepEqual(await resumed.action(null,'installUpdate'),{cancelled:true});
 console.log('PASS: mismatched checksum, mismatched installer version and unexpected download origins rejected before installation; cancelled confirmation never launches an installer.');
})().catch(e=>{console.error(e);process.exitCode=1});
