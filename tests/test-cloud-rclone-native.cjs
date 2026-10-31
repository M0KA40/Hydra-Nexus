'use strict';
// Real pinned Rclone executable, local fixtures only. No browser, account or network access.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {extractEngine,PIN}=require('../src/cloud-rclone.cjs');
(async()=>{if(process.platform!=='win32'||process.arch!=='x64'){console.log('SKIP native Rclone fixture: Windows x64 required');return;}
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-rclone-native-'));
 try{
  const binary=path.join(root,'rclone.exe'),config=path.join(root,'rclone.conf'),password=crypto.randomBytes(40).toString('hex');
  await fs.writeFile(binary,extractEngine(await fs.readFile(path.join(__dirname,'..','tools','rclone','package.zip'))));
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^RCLONE_/i.test(key)));env.RCLONE_CONFIG_PASS=password;
  function run(args,input=''){return new Promise((resolve,reject)=>{const child=spawn(binary,[...args,'--config',config,'--ask-password=false'],{windowsHide:true,shell:false,env,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b.toString());child.stderr.on('data',b=>err+=b.toString());child.on('error',reject);child.on('close',code=>resolve({code,out,err}));child.stdin.on('error',()=>{});child.stdin.end(input);});}
  assert.equal((await run(['version'])).out.includes('rclone v'+PIN.version),true);
  assert.equal((await run(['config','encryption','set'],password+'\n'+password+'\n')).code,0);
  assert.match(await fs.readFile(config,'utf8'),/RCLONE_ENCRYPT_V0:/);
  const made=await run(['config','create','nexus','local','--non-interactive']);assert.equal(made.code,0);assert.equal(JSON.parse(made.out).State,'');
  const source=path.join(root,'Source'),target=path.join(root,'Target');await fs.mkdir(source);await fs.mkdir(target);await fs.writeFile(path.join(source,'save.dat'),'synthetic save fixture');
  assert.equal((await run(['copyto',path.join(source,'save.dat'),'nexus:'+path.join(target,'save.dat'),'--immutable','--use-json-log','--stats','1s','--stats-log-level','NOTICE'])).code,0);
  assert.equal((await run(['check',source,'nexus:'+target,'--download','--one-way'])).code,0);
  await fs.writeFile(path.join(source,'.temporary'),'private transfer cache');assert.equal((await run(['check',source,'nexus:'+target,'--download','--one-way','--exclude','/.temporary'])).code,0,'private marker excluded from real payload check');await fs.rm(path.join(source,'.temporary'));
  await fs.writeFile(path.join(target,'save.dat'),'different content fixture');assert.notEqual((await run(['check',source,'nexus:'+target,'--download','--one-way'])).code,0);
  const immutable=await run(['copy',source,'nexus:'+target,'--include','/save.dat','--immutable','--checksum','--retries','1']);assert.notEqual(immutable.code,0);assert.equal(await fs.readFile(path.join(target,'save.dat'),'utf8'),'different content fixture');
  // Remote nonlocal mode asks for a token without opening a browser or contacting an account.
  const oauth=await run(['config','create','auth_probe','onedrive','config_is_local','false','--non-interactive']);assert.equal(oauth.code,0);const state=JSON.parse(oauth.out);assert.ok(state.State);assert.ok(state.Option);assert.equal((await fs.readFile(config,'utf8')).includes(password),false);
  console.log('PASS actual pinned Rclone '+PIN.version+': encrypted config from private stdin, noninteractive state JSON, immutable local copy, downloaded readback verification and corruption refusal. OAuth probe stops before authorization; no real provider connection or upload was tested.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
