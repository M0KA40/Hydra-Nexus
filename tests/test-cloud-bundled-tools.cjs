'use strict';
// Exercise the installed bundle's embedded archives, not source-tree tool fallbacks.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto'),{execFile}=require('node:child_process');
(async()=>{
 if(process.platform!=='win32'||process.arch!=='x64')return console.log('SKIP: embedded tools require Windows x64');
 const root=path.resolve(__dirname,'..'),directory=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-cloud-bundle-'));
 try{
  let source=await fs.readFile(path.join(root,'dist/hydra-nexus-bridge.cjs'),'utf8');
  const boot='localRequire("./controller.cjs");';assert.equal(source.split(boot).length,2);
  source=source.replace(boot,'module.exports=localRequire;');
  const context={__dirname:path.join(root,'dist/native-resources/main'),require:id=>id==='electron'?{app:{getPath:()=>directory}}:require(id),module:{exports:{}},Buffer,process,console,setTimeout,clearTimeout,setInterval,clearInterval,URL,AbortController};
  vm.runInNewContext(source,context,{timeout:30000});const get=context.module.exports;
  const {createCloudProvider,PIN}=get('./cloud-rclone.cjs');
  const provider=createCloudProvider({directory:path.join(directory,'provider')});await provider.provision();
  assert.equal(provider.snapshot().engineReady,true);
  const toolPath=path.join(directory,'provider/tools/rclone-'+PIN.version+'.exe');
  const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest(await fs.readFile(toolPath)),PIN.executable);
  assert.equal(await fs.readFile(path.join(path.dirname(toolPath),'RCLONE_LICENSE.txt'),'utf8'),await fs.readFile(path.join(root,'tools/rclone/LICENSE.txt'),'utf8'));
  const ludusaviDirectory=path.join(directory,'discovery');let invocations=0,lastArgs=null;
  const scanner=get('./cloud-tools.cjs').createBundledLudusaviScanner({directory:ludusaviDirectory,run:(exe,args,options,callback)=>{
   if(path.basename(exe).toLowerCase()==='ludusavi.exe'){
    invocations++;lastArgs=args;assert.ok(args.includes('--preview'));assert.ok(args.includes('--no-cloud-sync'));
    // No real scan is executed. Return the schema from a synthetic command adapter.
    queueMicrotask(()=>callback(null,JSON.stringify({games:{[args.at(-1)]:{files:{}}}}),'') );return {};
   }
   return execFile(exe,args,options,callback);
  }});
  await scanner([{shop:'steam',objectId:'1',title:'Elden Ring'}]);assert.equal(invocations,1);
  const mapped=await scanner([{key:'steam:870780',shop:'steam',objectId:'870780',title:'CONTROL Ultimate Edition™'}]);assert.ok(lastArgs.includes('Control'));assert.ok(!lastArgs.includes('CONTROL Ultimate Edition™'));assert.ok(mapped['steam:870780'],'canonical result maps back to the actual library identity');
  const {EXE_SHA256,MANIFEST_SHA256}=get('./cloud-tools.cjs');
  assert.equal(digest(await fs.readFile(path.join(ludusaviDirectory,'ludusavi.exe'))),EXE_SHA256);
  assert.equal(digest(await fs.readFile(path.join(ludusaviDirectory,'scan/manifest.yaml'))),MANIFEST_SHA256);
  for(const name of ['LICENSE','MANIFEST_LICENSE','legal.zip'])assert.ok((await fs.stat(path.join(ludusaviDirectory,name))).size>100);
  console.log('PASS: built bundle independently provisions hash-pinned Rclone/Ludusavi and manifest plus licenses with no source-tree fallback, account, cloud I/O or real-save scan.');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
