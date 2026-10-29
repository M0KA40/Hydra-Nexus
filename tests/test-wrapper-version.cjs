'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-wrapper-version-'));
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
try{
 const fixtures=[
  ['official',':: HYDRA_NEXUS_RELEASE 2.0.1\r\n:: HYDRA_NEXUS_REVISION 13\r\nset "VERSION=9.9.9"','2.0.1',13,'script'],
  ['batch','@echo off\nset "APP_VERSION=v1.2.03-beta.2"','1.2.03-beta.2',null,'script'],
  ['batch-unquoted','set VERSION=3.4.5','3.4.5',null,'script'],
  ['powershell',"$script:NexusVersion = '2.0.8'",'2.0.8',null,'script'],
  ['comment','REM Version: 1.7.9','1.7.9',null,'script'],
  ['title','title Hydra Nexus v1.2.02','1.2.02',null,'script'],
  ['missing','echo Windows 10\necho https://host/1.2.3\nexit /b 0',null,null,'missing'],
  ['ambiguous','set VERSION=1.2.3\nset VERSION=4.5.6',null,null,'ambiguous'],
  ['override',':: HYDRA_NEXUS_RELEASE 2.0.1\n:: HYDRA_NEXUS_REVISION 13','7.8.9',null,'explicit','v7.8.9'],
  ['literal-only','set VERSION=%OTHER%\necho do not execute me',null,null,'missing']
 ];
 const expected=[];
 for(const [name,body,version,revision,versionSource,override]of fixtures){const file=path.join(dir,name+'.bat');fs.writeFileSync(file,body);expected.push({file,version,revision,versionSource,override:override||''});}
 const input=path.join(dir,'cases.json');fs.writeFileSync(input,JSON.stringify(expected));
 const script=path.join(dir,'test.ps1');fs.writeFileSync(script,`$ErrorActionPreference='Stop'\n. ${quote(path.join(root,'installer/wrapper-metadata.ps1'))}\n$cases=Get-Content -LiteralPath ${quote(input)} -Raw|ConvertFrom-Json\n$result=@(foreach($case in $cases){$meta=Get-NexusBatMetadata $case.file $case.override;if($meta.version -cne $case.version -or $meta.revision -ne $case.revision -or $meta.versionSource -cne $case.versionSource){throw ('Wrong metadata: '+$case.file+' '+($meta|ConvertTo-Json -Compress))};$meta})\n$rejected=$false;try{Get-NexusBatMetadata $cases[0].file '2.0; Write-Output BAD'|Out-Null}catch{$rejected=$true};if(!$rejected){throw 'Invalid override accepted'}\n$result|ConvertTo-Json -Compress\n`);
 const result=cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(JSON.parse(result.stdout).length,fixtures.length);
 console.log('PASS: official release/revision precedence, BAT and PowerShell variables, version comments, title versions, explicit override, ambiguous/missing metadata and unsafe override rejection. Scripts were read, never executed.');
 if(fs.existsSync(path.join(root,'dist/BAT-Wrapper/wrapper-metadata.ps1'))){
  const exe=path.join(dir,'Versioned.exe'),build=cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'dist/BAT-Wrapper/Wrap-BAT.ps1'),'-BatPath',expected[0].file,'-Output',exe,'-Quiet'],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(build.status,0,build.stdout+build.stderr);
  const verify=path.join(dir,'verify.ps1');fs.writeFileSync(verify,`$ErrorActionPreference='Stop'\n$assembly=[Reflection.Assembly]::LoadFile(${quote(exe)})\n$stream=$assembly.GetManifestResourceStream('wrapper.json');$reader=New-Object IO.StreamReader($stream);$config=$reader.ReadToEnd()|ConvertFrom-Json;$reader.Dispose()\nif($config.version -cne '2.0.1' -or $config.revision -ne 13){throw 'Version not embedded in EXE'}\n# Render initialization only: stop before handlers or the script launch code.\n$ui=[IO.File]::ReadAllText(${quote(path.join(root,'dist/BAT-Wrapper/generic-gui.ps1'))})\n$ui=$ui.Substring(0,$ui.IndexOf('$form.Title='))\n$init=Join-Path ${quote(dir)} 'initialize.ps1';[IO.File]::WriteAllText($init,$ui,[Text.UTF8Encoding]::new($true))\n[IO.File]::WriteAllText((Join-Path ${quote(dir)} 'wrapper.json'),($config|ConvertTo-Json))\n[IO.File]::Copy(${quote(path.join(root,'dist/BAT-Wrapper/setup-copy.json'))},(Join-Path ${quote(dir)} 'setup-copy.json'))\n. $init\nif($form.FindName('Version').Text -cne 'v2.0.1 / r13'){throw 'Rendered badge does not match embedded metadata'}\n$form.Close()\n`);
  const verified=cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',verify],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(verified.status,0,verified.stdout+verified.stderr);console.log('PASS: Windows builder embeds detected version/revision and actual WPF initialization displays v2.0.1 / r13. BAT never executed.');
 }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
