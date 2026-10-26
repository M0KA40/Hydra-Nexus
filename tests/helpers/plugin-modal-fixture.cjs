'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function mountPluginModal(page){
  await page.addScriptTag({path:process.env.HYDRA_NATIVE_REACT});
  const native=fs.readFileSync(path.join(path.dirname(process.env.HYDRA_NATIVE_REACT),'hydra-renderer.js'),'utf8'),start=native.indexOf('function Backdrop$1('),end=native.indexOf('__name(Modal$1, "Modal$1");',start)+'__name(Modal$1, "Modal$1");'.length;assert.ok(start>=0);
  await page.addScriptTag({content:'window.__name=(fn)=>fn;window.cn=(...args)=>args.flatMap(v=>typeof v==="string"?[v]:v?Object.keys(v).filter(k=>v[k]):[]).join(" ");window.useTranslation=()=>({t:key=>key});window.XIcon=()=>reactExports$1.createElement("svg",{width:16,height:16,viewBox:"0 0 16 16",fill:"currentColor"},reactExports$1.createElement("path",{d:"M3 2 8 7 13 2 14 3 9 8 14 13 13 14 8 9 3 14 2 13 7 8 2 3Z"}));'+native.slice(start,end)});
  await page.addScriptTag({path:path.join(__dirname,'../../src/native-ui.js')});
  await page.evaluate(()=>{window.electron||={platform:'win32'};const host=document.createElement('div');host.id='plugin-modal-fixture';document.body.append(host);reactDomExports.createRoot(host).render(reactExports$1.createElement(HydraNexusPluginDialog));});
};
