function installLegacyUpgradeUI(){
  if(window.__nexusLegacyUpgrade||!window.__hydraNexusUI)return;
  const api=window.__hydraNexusUI,tr=key=>window.__nexusI18n?.t(key)||key;
  const style=document.createElement('style');style.id='nexus-legacy-upgrade-style';style.textContent=`
  .nexus-legacy-upgrade{list-style:none;min-width:0;margin-block:8px;padding:12px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:12px;background:color-mix(in srgb,currentColor 5%,transparent);display:flex;flex-direction:column;gap:10px;color:inherit}
  .nexus-legacy-upgrade strong{font-size:13px;line-height:1.4;overflow-wrap:anywhere}
  .nexus-legacy-upgrade p{font-size:12px;line-height:1.6;opacity:.8;margin:0;overflow-wrap:anywhere}
  .nexus-legacy-upgrade .button{min-width:0;white-space:normal;overflow-wrap:anywhere;font:inherit;font-size:12px;line-height:1.5;padding:9px 12px;cursor:pointer}
  .nexus-legacy-upgrade small{font-size:10px;letter-spacing:.04em;opacity:.65}
  `;document.head.append(style);
  function text(node,value){if(node.textContent!==value)node.textContent=value;}
  function render(){const menu=document.querySelector('.sidebar__menu');if(!menu)return;let notice=document.getElementById('nexus-legacy-upgrade');if(!notice){notice=document.createElement('li');notice.id='nexus-legacy-upgrade';notice.className='nexus-legacy-upgrade';const label=document.createElement('small'),title=document.createElement('strong'),description=document.createElement('p'),button=document.createElement('button');label.dataset.legacyLabel='';title.dataset.legacyTitle='';description.dataset.legacyText='';button.type='button';button.className='button button--primary';button.dataset.legacyDownload='';button.addEventListener('click',()=>api.request('downloadNewNexus').catch(error=>window.__hydraSteamShowToast?.(error.message,true)));notice.append(label,title,description,button);menu.prepend(notice);}notice.lang=window.__nexusI18n?.language||'en';notice.dir=window.__nexusI18n?.direction||'ltr';text(notice.querySelector('[data-legacy-label]'),tr('Legacy compatibility'));text(notice.querySelector('[data-legacy-title]'),tr('A new Nexus is ready'));text(notice.querySelector('[data-legacy-text]'),tr('Keep Nexus 2.3 on this Hydra version. Update Hydra, then install Nexus 3.0 for Cloud and the new Activity and game statistics.'));text(notice.querySelector('[data-legacy-download]'),tr('Download Nexus 3.0 (EXE)'));}
  window.__nexusLegacyUpgrade={render};for(const event of ['nexus-native-commit','nexus-language','nexus-config'])document.addEventListener(event,render);render();
}
if(typeof module!=='undefined')module.exports=installLegacyUpgradeUI;
