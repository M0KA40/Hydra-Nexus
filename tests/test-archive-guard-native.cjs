'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {archiveEntries,validateEntries}=require('../src/extract-guard.cjs');
(async()=>{
 const binaryPath=process.env.HYDRA_7ZIP_FIXTURE;
 if(!binaryPath){console.log('SKIP: supply HYDRA_7ZIP_FIXTURE to test native archive metadata/password listing.');return;}
 const folder=await fs.mkdtemp(path.join(__dirname,'archive-guard-'));
 try{
  const run=(exe,args,options={})=>cp.execFileSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:30000,...options});
  await fs.writeFile(path.join(folder,'game.txt'),'Synthetic archive fixture');
  run(binaryPath,['a','-t7z','-mhe=on','-ponline-fix.me','encrypted.7z','game.txt'],{cwd:folder});
  const encrypted=await archiveEntries({binaryPath},path.join(folder,'encrypted.7z'));validateEntries(encrypted);assert.equal(encrypted[0].name,'game.txt');
  run(process.env.HYDRA_PYTHON||'python',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('../outside.txt','Synthetic'); z.close()",path.join(folder,'traversal.zip')]);
  const traversal=await archiveEntries({binaryPath},path.join(folder,'traversal.zip'));assert.throws(()=>validateEntries(traversal),/unsafe/);
  run(process.env.HYDRA_PYTHON||'python',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); i=zipfile.ZipInfo('unsafe-link'); i.create_system=3; i.external_attr=(0o120777<<16); z.writestr(i,'../outside.txt'); z.close()",path.join(folder,'link.zip')]);
  const links=await archiveEntries({binaryPath},path.join(folder,'link.zip'));assert.throws(()=>validateEntries(links),/unsafe/);
  console.log('PASS: actual native 7-Zip metadata listing supports encrypted headers and rejects traversal/symlink archives before extraction. Synthetic files only.');
 }finally{await fs.rm(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
