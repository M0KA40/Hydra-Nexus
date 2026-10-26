'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HYDRA_PLAYWRIGHT_PATH||'playwright'),{catalogs,rendererScript}=require('../src/i18n.cjs');
const root=path.join(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HYDRA_BROWSER_EXE});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const nativeCSS=process.env.HYDRA_NATIVE_CSS?fs.readFileSync(process.env.HYDRA_NATIVE_CSS,'utf8'):'';
  await page.setContent('<html lang="en"><head><style>'+nativeCSS+'\nbody{margin:0;background:#151515;color:#ccc;font:14px Arial}.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}.modal{background:#151515;border:1px solid #333;border-radius:8px;width:640px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box}.modal__header{display:flex;justify-content:space-between;padding:20px;border-bottom:1px solid #333}.modal__header h3{margin:0;font-size:16px}.modal__header p{margin:8px 0 0;line-height:1.5;opacity:.7}.modal__content{padding:24px}.button{padding:10px 16px;border-radius:8px;font:inherit;cursor:pointer}.button--primary{background:#242424;border:1px solid #555;color:inherit}.button--outline{background:transparent;border:1px solid #555;color:inherit}.modal__close-button{background:transparent;border:0;color:inherit;font-size:22px;cursor:pointer}button:focus-visible,summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}</style></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({path:process.env.HYDRA_NATIVE_REACT});await page.addScriptTag({path:path.join(root,'src/native-ui.js')});await page.addScriptTag({content:rendererScript()});
  await page.evaluate(()=>{
    const R=reactExports$1,h=R.createElement;window.Modal$1=({children,title,description,onClose,className})=>h('div',{className:'backdrop'},h('div',{role:'dialog',className:'modal '+className},h('div',{className:'modal__header'},h('div',{className:'modal__header-title'},h('h3',null,title),h('p',null,description)),h('button',{className:'modal__close-button',onClick:onClose,'aria-label':'Close'},'×')),h('div',{className:'modal__content'},children)));
    installNativeNexusCommit();window.calls=[];window.delayReply=false;
    console.info=text=>{if(text.startsWith('__HYDRA_NEXUS__')){const r=JSON.parse(text.slice(15));calls.push(r);if(!delayReply)setTimeout(()=>window.__nexusReceive({id:r.id,result:{accepted:true}}),0);}};
    reactDomExports.createRoot(document.getElementById('root')).render(h(HydraNexusUpdateDialog));
  });
  await page.addScriptTag({content:require('../src/background-manager.js').toString()+';window.__nexusCreateBackgroundManager=createBackgroundManager;'});await page.addScriptTag({content:'window.__nexusCreateBackgroundManager=('+require('../src/background-manager.js').toString()+');('+require('../src/nexus-ui.js').toString()+')('+JSON.stringify({token:'fixture',config:{version:'1.2.0',plugins:{},theme:{},privacy:{},autoCheckUpdates:false}})+')'});
  const show=async()=>{await page.evaluate(()=>window.__nexusReceive({event:'updateConfirmation',value:{id:'confirmation-42',version:'1.2.0',source:'GitHub: M0KA40/Hydra-Nexus',sha256:'a'.repeat(64)}}));await page.locator('[role=dialog]').waitFor();};
  await show();
  assert.equal(await page.locator('details').getAttribute('open'),null);assert.equal(await page.locator('ol li').count(),3);assert.equal(await page.locator('.button--outline').evaluate(el=>el===document.activeElement),true,'Cancel receives initial focus');
  for(const language of Object.keys(catalogs)){
    await page.evaluate(l=>document.documentElement.lang=l,language);await page.waitForFunction(l=>window.__nexusUpdateControl.snapshot?.language===l,language);
    assert.equal(await page.locator('.modal__header h3').innerText(),catalogs[language]['Update Hydra Nexus']);
    assert.equal(await page.locator('.button--primary').innerText(),catalogs[language]['Install & restart']);
    assert.equal(await page.locator('.modal__content>div').getAttribute('dir'),language==='ar'?'rtl':'ltr');
    assert.equal(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,language+' width');
    if(process.env.HYDRA_DIALOG_PREVIEW_DIR&&['en','ar'].includes(language))await page.screenshot({path:path.join(process.env.HYDRA_DIALOG_PREVIEW_DIR,'update-dialog-'+language+'.png')});
  }
  await page.locator('summary').click();assert.match(await page.locator('details').innerText(),/SHA-256: a{64}/);assert.equal(await page.locator('code').getAttribute('dir'),'ltr');
  await page.locator('.button--outline').click();await page.locator('[role=dialog]').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>calls.at(-1).data.accepted),false);
  await show();await page.locator('.modal__close-button').click();await page.locator('[role=dialog]').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>calls.at(-1).data.accepted),false);
  await show();await page.evaluate(()=>delayReply=true);await page.locator('.button--primary').click();assert.equal(await page.locator('.button--primary').isDisabled(),true);assert.equal(await page.locator('.button--outline').isDisabled(),true);assert.equal(await page.evaluate(()=>calls.at(-1).data.accepted),true);assert.equal(await page.evaluate(()=>calls.at(-1).data.id),'confirmation-42');
  await page.evaluate(()=>window.__nexusReceive({event:'updateConfirmation',value:null}));await page.locator('[role=dialog]').waitFor({state:'detached'});assert.deepEqual(errors,[]);
  console.log('PASS: native React update dialog in all supported languages, live RTL, initial Cancel focus, collapsed hash details, safe cancel/close and single disabled approval.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
