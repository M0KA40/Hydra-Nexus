'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),locales=JSON.parse(fs.readFileSync(path.join(root,'installer/installer-locales.json'),'utf8'));
assert.equal(Object.keys(locales).length,1);const keys=Object.keys(locales.en).sort();for(const [lang,values]of Object.entries(locales)){assert.deepEqual(Object.keys(values).sort(),keys,lang);assert.ok(Object.values(values).every(v=>typeof v==='string'&&v.trim()));}
assert.ok(!keys.includes('preview'),'no preview notice in installer catalogs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-installer-ui-'));
try{
 const ui=fs.readFileSync(path.join(root,'installer/installer-ui.ps1'),'utf8').replace('__NEXUS_INSTALLER_LOCALES__',JSON.stringify(locales));
 assert.ok(!ui.includes('Show-NexusDevelopmentNotice'));assert.ok(!ui.includes('Set-NexusInstallerLanguage'));assert.ok(!ui.includes("'5'{"));
 const test=ui+String.raw`
$ErrorActionPreference='Stop'
function Clear-Host {}
function Wait-ForMenu {}
function Invoke-BuiltInPatch($patch,$operation){$script:operations.Add($operation)}
function Resolve-HydraDirectory {return 'fixture-hydra'}
function Get-PatchStatus($patch,$dir){return 'fixture-status'}
function Show-Error($error){throw $error}
function Read-Host([string]$prompt){if(!$script:answers.Count){throw 'Unexpected prompt'};return $script:answers.Dequeue()}
$script:operations=New-Object 'System.Collections.Generic.List[string]'
$script:answers=New-Object 'System.Collections.Generic.Queue[string]'
Start-NexusInstaller
Show-NexusInstallerBanner
foreach($answer in @('1','2','3','4','0')){$script:answers.Enqueue($answer)}
Show-NexusMenu ([pscustomobject]@{Id='nexus'})
if(($script:operations -join ',') -ne 'Install,Remove'){throw 'Native operation dispatch changed'}

$folder=Join-Path $env:APPDATA 'Hydra\Nexus';New-Item -ItemType Directory -Path $folder -Force|Out-Null
$file=Join-Path $folder 'themes.json'
$original=[pscustomobject]@{interface=[pscustomobject]@{schema=1;design='quiet'};quietBackground=$true;background=[pscustomobject]@{file='preserved.png'};customCSS='';achievementCSS='';other='preserved'}
[IO.File]::WriteAllText($file,($original|ConvertTo-Json -Depth 8))
Reset-NexusInterfacePreference
$saved=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
if($saved.interface.design -ne 'native' -or $saved.quietBackground -ne $false -or $saved.background.file -ne 'preserved.png' -or $saved.other -ne 'preserved'){throw 'Uninstall preference cleanup lost data'}
[IO.File]::WriteAllText($file,'broken-json');Reset-NexusInterfacePreference
if([IO.File]::ReadAllText($file) -ne 'broken-json'){throw 'Damaged preference changed'}
Write-Output 'PASS: installer presentation, English-only menu, numeric choices, invalid input, cancellation and uninstall preference isolation.'
`;
 const file=path.join(dir,'test.ps1');fs.writeFileSync(file,Buffer.concat([Buffer.from([239,187,191]),Buffer.from(test)]));const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',env:{...process.env,APPDATA:path.join(dir,'appdata')},timeout:30000});if(result.status!==0)throw Error(result.stdout+'\n'+result.stderr);assert.match(result.stdout,/PASS: installer presentation/);console.log('PASS: English installer catalog; original numeric operation dispatch, no language prompt; isolated uninstall resets only Nexus interface preferences, retaining background and damaged data. No real installer operations executed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
