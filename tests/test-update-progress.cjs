'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {main,catalogs}=require('../src/i18n.cjs'),{updatePresentation}=require('../src/update-presentation.cjs');
const exec=(file,args)=>new Promise((resolve,reject)=>cp.execFile(file,args,{windowsHide:true,timeout:30000},(error,out,err)=>error?reject(Error(err||out||error.message)):resolve(out)));
const q=s=>"'"+s.replace(/'/g,"''")+"'";
(async()=>{
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'nexus-progress-')),id='a'.repeat(32),token='b'.repeat(64),dir=path.join(root,'job-'+id);await fsp.mkdir(dir);
 const request={schema:2,id,token,version:'2.0.1',revision:2},job=path.join(dir,'request.json'),progress=path.join(dir,'progress.ps1'),source=path.join(__dirname,'..');
 const script=(await fsp.readFile(path.join(source,'installer/update-progress.ps1'),'utf8')).replace('__NEXUS_PROGRESS_LOGO__',(await fsp.readFile(path.join(source,'assets/brand/Hydra-Nexus-transparent.png'))).toString('base64'));
 assert.ok(!script.includes('if([Windows.SystemParameters]::ClientAreaAnimation)'));if(process.env.HYDRA_PROGRESS_RESULTS)await fsp.mkdir(process.env.HYDRA_PROGRESS_RESULTS,{recursive:true});
 await fsp.writeFile(progress,'\ufeff'+script);const results=[];
 for(const language of Object.keys(catalogs)){
  main.setLanguage(language);const presentation=updatePresentation();assert.equal(presentation.language,language);assert.equal(presentation.direction,language==='ar'?'rtl':'ltr');assert.equal(presentation.steps.length,6);assert.equal(presentation.title,catalogs[language]['Updating Hydra Nexus']);assert.equal(presentation.wait,catalogs[language]['Hydra will reopen automatically after the update.']);assert.equal(presentation.warning,undefined);assert.ok(presentation.steps.every(s=>s.trim()));results.push(language);
 }
 // Render the actual WPF implementation without showing a desktop window.
 for(const [language,phase]of [['en','installing'],['ar','installing'],['de','complete'],['en','failed']]){
  main.setLanguage(language);await fsp.writeFile(job,JSON.stringify({...request,presentation:updatePresentation()}));
  const probe=path.join(root,language+'-'+phase+'-motion.json');
  const image=path.join(root,language+'-'+phase+'.png');await exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',progress,'-JobFile',job,'-RenderOnly','-RenderFile',image,'-RenderPhase',phase,'-AnimationProbeFile',probe]);const motion=JSON.parse(await fsp.readFile(probe,'utf8'));assert.ok(Math.abs(motion.positions[2]-motion.positions[1])>20,'WPF bar moves independently of Windows animation setting');if(process.env.HYDRA_PROGRESS_RESULTS)await fsp.copyFile(probe,path.join(process.env.HYDRA_PROGRESS_RESULTS,language+'-'+phase+'-motion.json'));assert.ok((await fsp.stat(image)).size>3000);
  if(process.env.HYDRA_PROGRESS_RESULTS){await fsp.mkdir(process.env.HYDRA_PROGRESS_RESULTS,{recursive:true});await fsp.copyFile(image,path.join(process.env.HYDRA_PROGRESS_RESULTS,language+'-'+phase+'.png'));}
 }
 // A presentation startup failure must precede the ready acknowledgement and
 // approval. The real parent remains alive and no installer entry is executed.
 const install=path.join(root,'Hydra');await fsp.mkdir(path.join(install,'resources'),{recursive:true});const exe=path.join(install,'Fixture.exe'),archive=path.join(install,'resources/app.asar'),bat=path.join(root,'fixture.bat');await fsp.writeFile(exe,'NOT_EXECUTABLE');await fsp.writeFile(archive,'UNTOUCHED');await fsp.writeFile(bat,'NOT_EXECUTED');
 await fsp.writeFile(progress,"throw 'synthetic presentation failure'\n");await fsp.writeFile(job,JSON.stringify({...request,parentPid:process.pid,parentExe:process.execPath,exe,processNames:['NonexistentNexusFixture'],installer:bat,sha256:crypto.createHash('sha256').update('NOT_EXECUTED').digest('hex'),showProgress:true,presentation:updatePresentation()}));
 const worker=path.join(dir,'worker.ps1');await fsp.copyFile(path.join(source,'installer/update-worker.ps1'),worker);let failed=false;
 try{await exec('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',worker,'-JobFile',job]);}catch{failed=true;}
 assert.equal(failed,true);const state=JSON.parse((await fsp.readFile(path.join(dir,'state.json'),'utf8')).replace(/^\ufeff/,''));assert.equal(state.phase,'failed');assert.match(state.message,/window could not open/);assert.equal(fs.existsSync(path.join(dir,'approved')),false);assert.equal(fs.existsSync(path.join(dir,'recovery')),false);assert.equal(await fsp.readFile(archive,'utf8'),'UNTOUCHED');
 await require('./update-worker-fixture.cjs').fixture({presentation:true});
 main.setLanguage('en');console.log('PASS: nine localized presentation snapshots; actual WPF English/Arabic/German success/failure renders; failed UI startup keeps parent alive; independent Arabic WPF presentation survives parent exit and closes after startup confirmation; no live application touched. '+JSON.stringify({languages:results,fixture:root}));
})().catch(error=>{console.error(error);process.exitCode=1;});
