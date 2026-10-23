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
  `;document.head.append(style);
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
