'use strict';
// Exact retained Modal/Backdrop components; synthetic content and local styles only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),native=path.resolve(root,'../Development/Fixtures/Native');
const source=fs.readFileSync(path.join(native,'hydra-renderer.js'),'utf8');
const part=name=>{const a=source.indexOf('function '+name+'('),b=source.indexOf('\n__name('+name+',',a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
const css=['../Development/Fixtures/Native/hydra-native.css','src/interface-quiet.css','src/interface-polish.css'].map(file=>fs.readFileSync(path.resolve(root,file),'utf8')).join('\n');
const sizes=[{width:1200,height:860},{width:1024,height:600},{width:1280,height:720},{width:1920,height:1080}];
const colors=[['charcoal','#13171d','#f5f6f8'],['light','#e8edf0','#182129'],['plum','#302237','#fff4ff']];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});let cases=0;
try{for(const [theme,canvas,text]of colors){const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<html data-nexus-interface="quiet"><head><style>${css}</style><style>html{--nexus-quiet-canvas:${canvas}!important;--nexus-quiet-text:${text}!important}body{margin:0;background:repeating-linear-gradient(120deg,#547f92 0 40px,#3c4869 40px 80px);height:100vh}.modal__content{min-height:100px}input{max-width:100%}</style></head><body><main>Local synthetic background</main><div id="root"></div></body></html>`);
 await page.addScriptTag({path:path.join(native,'react-runtime.js')});
 await page.evaluate(()=>{const R=reactExports$1;window.useTranslation=()=>({t:key=>key});window.cn=(...v)=>v.flatMap(x=>typeof x==='string'?[x]:Object.keys(x||{}).filter(k=>x[k])).join(' ');window.electron={platform:'win32'};window.XIcon=()=>R.createElement('span',null,'×');window.modalRoot=reactDomExports.createRoot(document.getElementById('root'));window.closeCalls=0;});
 await page.addScriptTag({content:part('Backdrop$1')+'\n'+part('Modal$1')});
 for(const lang of ['en','ar','de'])for(const size of sizes){await page.setViewportSize(size);
  await page.evaluate(lang=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';const label=lang==='ar'?'نافذة إعدادات اللعبة واختبار العرض':lang==='de'?'Einstellungen und Installationsverzeichnis verwalten':'Game settings';modalRoot.render(reactExports$1.createElement(Modal$1,{visible:true,title:label,onClose:()=>{closeCalls++;modalRoot.render(null);}},reactExports$1.createElement('input',{id:'dialog-draft',defaultValue:'Retained local draft'})));},lang);
  await page.locator('[role=dialog]').waitFor();
  const opening=await page.evaluate(()=>{const backdrop=document.querySelector('.backdrop'),modal=document.querySelector('.modal'),ba=backdrop.getAnimations()[0],ma=modal.getAnimations()[0];ba.pause();ma.pause();const frames=[0,40,100,200,320,400].map(t=>{ba.currentTime=t;ma.currentTime=t;return {time:t,blur:Number(getComputedStyle(backdrop).backdropFilter.match(/blur\(([\d.]+)px\)/)[1]),opacity:Number(getComputedStyle(modal).opacity)};});const r=modal.getBoundingClientRect();window.originalDialogDraft=document.getElementById('dialog-draft');return {frames,width:r.width,x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:modal.scrollWidth,client:modal.clientWidth,transition:getComputedStyle(backdrop).transitionProperty,fill:ba.effect.getTiming().fill,duration:ba.effect.getTiming().duration,modalDuration:ma.effect.getTiming().duration};});
  assert.equal(opening.duration,400);assert.equal(opening.modalDuration,400);assert.equal(opening.fill,'both');assert.equal(opening.transition,'none');
  assert.equal(opening.frames[0].blur,0);assert.equal(opening.frames[0].opacity,0);
  for(const f of opening.frames)assert.ok(Math.abs(f.blur/10-f.opacity)<.005,theme+'/'+lang+' blur and dialog share opening progress at '+f.time);
  assert.ok(opening.x>=0&&opening.right<=size.width+1&&opening.y>=0&&opening.bottom<=size.height+1,'dialog fits native viewport');assert.ok(opening.scroll<=opening.client+1,'long dialog title fits');
  if(process.env.HYDRA_INTERFACE_PREVIEW&&lang==='en'&&size.width===1200){fs.mkdirSync(process.env.HYDRA_INTERFACE_PREVIEW,{recursive:true});await page.screenshot({path:path.join(process.env.HYDRA_INTERFACE_PREVIEW,'glass-'+theme+'-1200.png')});}
  await page.locator('#dialog-draft').fill('Preserved edit');await page.locator('.modal__close-button').click();
  const closing=await page.evaluate(()=>{const backdrop=document.querySelector('.backdrop'),modal=document.querySelector('.modal'),ba=backdrop.getAnimations()[0],ma=modal.getAnimations()[0];ba.pause();ma.pause();return [0,40,100,200,320,400].map(t=>{ba.currentTime=t;ma.currentTime=t;return {time:t,blur:Number(getComputedStyle(backdrop).backdropFilter.match(/blur\(([\d.]+)px\)/)[1]),opacity:Number(getComputedStyle(modal).opacity),sameDraft:document.getElementById('dialog-draft')===originalDialogDraft&&originalDialogDraft.value==='Preserved edit'};});});
  for(const f of closing){assert.ok(Math.abs(f.blur/10-f.opacity)<.005,theme+'/'+lang+' closing progress at '+f.time);assert.equal(f.sameDraft,true);}
  assert.equal(closing.at(-1).blur,0);assert.equal(closing.at(-1).opacity,0);await page.locator('[role=dialog]').waitFor({state:'detached'});cases++;
 }
 assert.equal(await page.evaluate(()=>closeCalls),12,'native close command fires once per dialog');assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: '+cases+' exact-native dialog cases, 432 sampled entrance/exit frames: synchronised blur/dimming/dialog easing and 400ms close lifetime, theme-tinted glass, RTL/long titles, retained draft and one native close callback. Isolated fixtures only.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
