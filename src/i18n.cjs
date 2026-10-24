'use strict';
// English messages are catalog keys. Keep every message in all eight catalogs.
const catalogs={en:require('./locales/en.cjs'),'pt-BR':require('./locales/pt-BR.cjs'),es:require('./locales/es.cjs'),ru:require('./locales/ru.cjs'),ar:require('./locales/ar.cjs'),fr:require('./locales/fr.cjs'),de:require('./locales/de.cjs'),tr:require('./locales/tr.cjs')};

// Self-contained: this factory also runs inside sandboxed Electron renderers.
function createTranslator(catalogs,initialLanguage='en'){
  const supported=['en','pt-BR','es','ru','ar','fr','de','tr'];
  function normalize(value){const code=typeof value==='string'?value.trim().replace(/_/g,'-').toLowerCase().split('-')[0]:'';return code==='pt'?'pt-BR':supported.includes(code)?code:'en';}
  let language=normalize(initialLanguage);const listeners=new Set();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function t(key,values={}){const table=catalogs[language]||{},english=catalogs.en||{},template=Object.hasOwn(table,key)&&table[key]||Object.hasOwn(english,key)&&english[key]||key;return String(template).replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?typeof values[name]==='number'?new Intl.NumberFormat(language).format(values[name]):String(values[name]??''):match);}
  const patterns=Object.keys(catalogs.en||{}).filter(key=>/\{\w+\}/.test(key)).map(key=>{const names=[];const expression=key.split(/(\{\w+\})/g).map(part=>{if(/^\{\w+\}$/.test(part)){names.push(part.slice(1,-1));return '([\\s\\S]+?)';}return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');return {key,names,re:new RegExp('^'+expression+'$')};});
  // Only use on application messages, never on user notes, game titles or paths.
  function message(value,depth=0){if(typeof value!=='string')return value;if(Object.hasOwn(catalogs.en||{},value))return t(value);for(const {key,names,re}of patterns){const match=re.exec(value);if(match)return t(key,Object.fromEntries(names.map((name,i)=>[name,name==='error'&&depth<3?message(match[i+1],depth+1):match[i+1]])));}return value;}
  return {t,html:(key,values)=>escape(t(key,values)),message,normalize,
    get language(){return language;},get direction(){return language==='ar'?'rtl':'ltr';},
    setLanguage(value){const next=normalize(value);if(next===language)return false;language=next;for(const fn of listeners)fn(language);return true;},
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    number:(value,options)=>new Intl.NumberFormat(language,options).format(value),
    date:(value,options={dateStyle:'medium',timeStyle:'short'})=>new Intl.DateTimeFormat(language,options).format(new Date(value))};
}

const main=createTranslator(catalogs),listeners=new Set();let languageRevision=0;
main.subscribe(language=>{languageRevision++;for(const fn of listeners)fn(language);});
function setHydraLanguage(language){languageRevision++;return main.setLanguage(language);}
async function readHydraLanguage(binding){const revision=languageRevision;let language='en';if(binding?.db?.get){try{const preferences=await binding.db.get('userPreferences',{valueEncoding:'json'}).catch(()=>null);language=preferences?.language||await binding.db.get('language',{valueEncoding:'utf8'}).catch(()=>'en');}catch{}}if(revision===languageRevision)main.setLanguage(language);return main.language;}

function installRendererI18n(create,catalogs,language,followHydra=true){
  if(window.__nexusI18n){if(!followHydra)window.__nexusI18n.setLanguage(language);return;}
  const initial=followHydra?(document.documentElement.lang||language):language;
  const api=create(catalogs,initial);window.__nexusI18n=api;
  const style=document.createElement('style');style.id='nexus-locale-style';style.textContent=`
    :is(#nexus-settings-group,.nexus-section,#nexus-activity-panel,#nexus-activity-header,#nexus-tabs,#nexus-context,#nexus-workspace-dialog,#nexus-game-backup,#nexus-update-toast,#hsb-dialog,#hsb-notice,#hbk-panel,#hbk-native-header,#hbk-toast,#hbk-nav-item)[dir=rtl]{text-align:start}
    [dir=rtl] .nexus-release-notes :is(ul,ol),[dir=rtl] .hb-drive-steps{padding-left:0;padding-inline-start:24px}
    [dir=rtl] #hsb-setup-note{border-left-width:1px;border-inline-start-width:4px}
    .nexus-section :is(input[type=password],input[id=nexus-notes-shortcut]),.hb-path,.notes-titlebar strong{unicode-bidi:plaintext}
    #nexus-workspace-dialog :is(input[id=nexus-pc-cpu],input[id=nexus-pc-gpu]),#hsb-dialog [id=hsb-account]{unicode-bidi:plaintext}

    :is(#hsb-dialog,#nexus-workspace-dialog,#hbk-native-header,#hbk-panel,.nexus-section,#nexus-update-toast,.nexus-update-confirmation) button{transition-property:background-color,border-color,box-shadow,opacity,transform!important}
    :is(#nexus-settings-panel,.nexus-update-confirmation,#nexus-update-toast) button:disabled{opacity:1!important;filter:none!important;border-style:dashed;cursor:not-allowed}
    :is(#nexus-settings-panel,.nexus-update-confirmation) button[data-nexus-pending]{cursor:progress}
    :is(#nexus-settings-panel,.nexus-update-confirmation) button[data-nexus-pending]::before{content:'';display:inline-block;width:12px;height:12px;flex:0 0 12px;box-sizing:border-box;border:2px solid currentColor;border-inline-end-color:transparent;border-radius:50%;animation:nexus-control-pending .8s linear infinite}
    @keyframes nexus-control-pending{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){:is(#nexus-settings-panel,.nexus-update-confirmation) button[data-nexus-pending]::before{animation:none}}
    #nexus-settings-panel{color:var(--nexus-text,inherit)!important}
    [data-nexus-surface]{background:var(--nexus-surface)!important;color:var(--nexus-text)!important;color-scheme:var(--nexus-scheme)}
    :is(#hsb-dialog,#nexus-workspace-dialog,#hbk-panel,.nexus-section) :is(select,input:not([type=checkbox]):not([type=range]),textarea){color:var(--nexus-text,CanvasText)!important;background-color:var(--nexus-field,Canvas)!important;color-scheme:var(--nexus-scheme,normal);border-color:var(--nexus-border,ButtonBorder)}
    :is(#hsb-dialog,#nexus-workspace-dialog,#hbk-panel,.nexus-section) :is(option,optgroup){color:var(--nexus-text,CanvasText)!important;background:var(--nexus-field,Canvas)!important}
    :is(#hsb-dialog,#nexus-workspace-dialog) :is(input,select,button):focus-visible{outline:2px solid currentColor;outline-offset:3px}
    :is(#hsb-dialog,#nexus-workspace-dialog)>section{min-width:0;overflow-wrap:anywhere}
    :is(#hsb-dialog,#nexus-workspace-dialog) select{min-width:0;max-width:100%;text-overflow:ellipsis}
    @media(max-width:600px){:is(#hsb-dialog,#nexus-workspace-dialog){padding:12px!important}:is(#hsb-dialog,#nexus-workspace-dialog)>section{padding:18px!important;max-height:calc(100dvh - 24px)!important}:is(#hsb-dialog,#nexus-workspace-dialog) header{flex-wrap:wrap;gap:10px!important}}
  `;document.head.append(style);
  // Resolve translucent native theme layers to an opaque, readable Nexus surface.
  // Only Nexus-owned elements receive these variables; native theme rules stay scoped.
  const rgb=value=>{const m=String(value).match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return v.length>=3&&v.every(Number.isFinite)?[...v.slice(0,3),v.length>3?v[3]:1]:null;};
  const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const paint=c=>'rgb('+c.slice(0,3).map(v=>Math.round(v)).join(', ')+')';
  api.palette=anchor=>{
    anchor=anchor||document.querySelector('.sidebar')||document.body;
    let fg=rgb(getComputedStyle(anchor).color)||[240,241,247,1];
    let bg=luminance(fg)>.45?[28,31,37]:[248,249,251],layers=[];
    for(let node=anchor;node;node=node.parentElement){const c=rgb(getComputedStyle(node).backgroundColor);if(c)layers.push(c);}
    for(const c of layers.reverse())bg=bg.map((v,i)=>v*(1-c[3])+c[i]*c[3]);
    fg=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));
    if(ratio(bg,fg)<4.5)fg=ratio(bg,[255,255,255])>ratio(bg,[0,0,0])?[255,255,255]:[0,0,0];
    const field=bg.map((v,i)=>v*.96+fg[i]*.04);
    return {background:paint(bg),color:paint(fg),field:paint(field),border:paint(bg.map((v,i)=>v*.6+fg[i]*.4)),scheme:luminance(bg)<.4?'dark':'light'};
  };
  api.buttons=element=>{for(const button of element?.querySelectorAll('button')||[]){const p=api.palette(button);if(getComputedStyle(button).color!==p.color)button.style.setProperty('color',p.color,'important');}};
  api.controls=(element,anchor)=>{if(!element)return;const p=api.palette(anchor||element);for(const [name,value]of Object.entries({surface:p.background,text:p.color,field:p.field,border:p.border,scheme:p.scheme})){const key='--nexus-'+name;if(element.style.getPropertyValue(key)!==value)element.style.setProperty(key,value);}api.buttons(element);return p;};
  api.surface=(element,anchor)=>{const p=api.controls(element,anchor||document.querySelector('.sidebar')||document.body);if(element&&!element.hasAttribute('data-nexus-surface'))element.setAttribute('data-nexus-surface','');api.buttons(element);return p;};
  api.decorate=element=>{if(!element)return;element.setAttribute('lang',api.language);element.setAttribute('dir',api.direction);};
  api.subscribe(()=>document.dispatchEvent(new Event('nexus-language')));
  if(followHydra){
    // Hydra synchronizes this attribute with its i18next instance. No browser/OS locale.
    let revision=0;const update=language=>{revision++;api.setLanguage(language);};
    const observer=new MutationObserver(()=>update(document.documentElement.lang||'en'));
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    window.electron?.onUserPreferencesUpdated?.(preferences=>{if(typeof preferences?.language==='string')update(preferences.language);});
    // The native renderer sets lang before mounting. IPC supports older renderers.
    if(!document.documentElement.lang){const started=revision;Promise.resolve(window.electron?.getUserPreferences?.()).then(preferences=>{if(started===revision&&!document.documentElement.lang&&preferences?.language)api.setLanguage(preferences.language);}).catch(()=>{});}
  }else{api.decorate(document.documentElement);api.subscribe(()=>api.decorate(document.documentElement));}
}
const sharedRenderer='('+installRendererI18n.toString()+')('+createTranslator.toString()+','+JSON.stringify(catalogs)+',';
function rendererScript(language=main.language,followHydra=true){return sharedRenderer+JSON.stringify(language)+','+JSON.stringify(followHydra)+');';}
function localizedDialog(native,getLanguage=()=>main.language){
  const translate=options=>{const tr=createTranslator(catalogs,getLanguage()),out={...options};for(const key of ['title','message','detail','buttonLabel'])if(typeof out[key]==='string')out[key]=tr.message(out[key]);if(out.buttons)out.buttons=out.buttons.map(text=>tr.message(text));if(out.filters)out.filters=out.filters.map(filter=>({...filter,name:tr.message(filter.name)}));return out;};
  return new Proxy(native||{},{get(target,key){const fn=target[key];if(typeof fn!=='function')return fn;if(!['showMessageBox','showOpenDialog','showSaveDialog'].includes(key))return fn.bind(target);return (...args)=>fn.apply(target,args.map((arg,index)=>index===args.length-1?translate(arg):arg));}});
}
module.exports={catalogs,createTranslator,rendererScript,localizedDialog,readHydraLanguage,setHydraLanguage,main,onLanguageChanged:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);}};
