const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createUpdater,sha,releaseVersion}=require('../src/updater.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(__dirname,'updater-faults-'));
 const current=await fs.readFile(path.join(__dirname,'..','dist/Hydra_Nexus.bat'));
 const builtVersion=releaseVersion(current);
 const make=(kind)=>{
  const version=kind==='version'?'3.0.0':builtVersion;let confirms=0;
  const release={tag_name:'v'+version,assets:[{name:'Hydra_Nexus.bat',browser_download_url:'https://github.com/Test/Nexus/releases/download/v'+version+'/Hydra_Nexus.bat'},{name:'SHA256SUMS.txt',browser_download_url:'https://github.com/Test/Nexus/releases/download/v'+version+'/SHA256SUMS.txt'}]};
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
 const cancelled=make('cancel');await cancelled.updater.action(null,'checkUpdates');assert.deepEqual(await cancelled.updater.action(null,'installUpdate'),{cancelled:true});assert.equal(cancelled.confirmations(),1);assert.equal((await cancelled.updater.action(null,'updateStatus')).installation,null);
 const resumed=createUpdater({directory:path.join(root,'cancel'),version:'0.9.0',getRepository:()=> 'Test/Nexus',fetcher(){throw Error('No network needed for a persisted verified update')},dialog:{showMessageBox:async()=>({response:0})},app:{}});assert.equal((await resumed.action(null,'updateStatus')).staged.version,builtVersion);assert.deepEqual(await resumed.action(null,'installUpdate'),{cancelled:true});
 console.log('PASS: mismatched checksum, mismatched installer version and unexpected download origins rejected before installation; cancelled confirmation never launches an installer.');
})().catch(e=>{console.error(e);process.exitCode=1});
