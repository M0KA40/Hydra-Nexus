'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createUpdater}=require('../src/updater.cjs'),brand=require('../src/brand.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-update-package-')),installer=path.resolve(__dirname,'../dist/Hydra_Nexus.exe');let selected=installer;
 const options={directory:root,version:'2.3.1',revision:2,getRepository:()=>null,app:{},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[selected]})}};
 try{
  assert.ok((await fs.stat(installer)).size>16*1024*1024,'exercise the actual offline-engine package, larger than the prior limit');
  const staged=await createUpdater(options).action(null,'chooseUpdate');assert.equal(staged.staged.version,brand.version);
  const reloaded=await createUpdater(options).action(null,'updateStatus');assert.equal(reloaded.staged.sha256,staged.staged.sha256,'a restart accepts the same verified large stage');
  selected=path.join(root,'oversized.exe');const handle=await fs.open(selected,'w');try{await handle.truncate(128*1024*1024+1);}finally{await handle.close();}
  await assert.rejects(createUpdater({...options,directory:path.join(root,'separate')}).action(null,'chooseUpdate'),/too large/);
  console.log('PASS: actual large 2.3.2 installer stages and survives updater restart; files over the bounded 128 MiB limit are rejected before reading. No installer executed.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
