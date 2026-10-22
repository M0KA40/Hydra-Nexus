'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),cp=require('node:child_process');
(async()=>{
 const root=await fsp.mkdtemp(path.join(__dirname,'installer-fuses-')),base=await fsp.readFile(path.join(__dirname,'../installer/installer-base.bat'),'utf8'),csharp=base.match(/Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/)[1],source=path.join(root,'helper.cs');await fsp.writeFile(source,csharp);
 const marker=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),start=marker.length+2;
 function wire(version=1,count=9,states='101110011'){return Buffer.concat([marker,Buffer.from([version,count]),Buffer.from(states)]);}
 const fixtures={enabled:wire(),alreadyDisabled:wire(1,9,'101100011'),versionZero:wire(0),versionTwo:wire(2),asciiVersion:wire(49),truncated:wire(1,9,'10111'),shortCount:wire(1,4,'1011'),unknownState:wire(1,9,'1011r0011'),missing:Buffer.from('no marker')};
 for(const [name,bytes]of Object.entries(fixtures))await fsp.writeFile(path.join(root,name+'.exe'),bytes);
 const q=s=>"'"+s.replace(/'/g,"''")+"'",ps=`$ErrorActionPreference='Stop';Add-Type -Path ${q(source)};$root=${q(root)}
 foreach($name in @('enabled','alreadyDisabled')){
   $p=Join-Path $root ($name+'.exe');$before=[IO.File]::ReadAllBytes($p)
   $changed=[HydraSuiteAsar]::EnableModifiedAsar($p)
   if($changed -ne ($name -eq 'enabled')){throw 'Wrong modification result'}
   $after=[IO.File]::ReadAllBytes($p);for($i=0;$i -lt $before.Length;$i++){if($i -eq ${start+4}){if($after[$i] -ne 48){throw 'Integrity fuse not disabled'}}elseif($after[$i] -ne $before[$i]){throw 'Unrelated byte changed'}}
   if([HydraSuiteAsar]::EnableModifiedAsar($p)){throw 'Repair must be idempotent'}
 }
 foreach($name in @('versionZero','versionTwo','asciiVersion','truncated','shortCount','unknownState','missing')){
   $p=Join-Path $root ($name+'.exe');$rejected=$false;try{[HydraSuiteAsar]::EnableModifiedAsar($p)|Out-Null}catch{$rejected=$true};if(!$rejected){throw ('Invalid fixture accepted: '+$name)}
 }
 $p=Join-Path $root 'enabled.exe';if(![HydraSuiteAsar]::RestoreOriginalFuses($p)){throw 'Restore failed'}
 if([Convert]::ToBase64String([IO.File]::ReadAllBytes($p)) -cne [Convert]::ToBase64String([IO.File]::ReadAllBytes($p+'.before-hydra-suite.bak'))){throw 'Original bytes not restored'}
 [IO.File]::WriteAllBytes($p,([byte[]](1,2,3)));if([HydraSuiteAsar]::RestoreOriginalFuses($p)){throw 'Mismatched build accepted'}`;
 await new Promise((resolve,reject)=>cp.execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:30000},(e,out,err)=>e?reject(Error(e.message+'\n'+err)):resolve()));
 assert.deepEqual(await fsp.readFile(path.join(root,'enabled.exe.before-hydra-suite.bak')),fixtures.enabled);
 assert.deepEqual(await fsp.readFile(path.join(root,'alreadyDisabled.exe')),fixtures.alreadyDisabled);
 for(const name of ['versionZero','versionTwo','asciiVersion','truncated','shortCount','unknownState','missing']){assert.deepEqual(await fsp.readFile(path.join(root,name+'.exe')),fixtures[name]);assert.equal(fs.existsSync(path.join(root,name+'.exe.before-hydra-suite.bak')),false);}
 console.log('PASS: real Electron numeric fuse V1/count 9 accepted, already-disabled repair idempotent; unsupported versions, truncated layouts, removed integrity fuse and missing marker rejected without writes; matching restoration only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
