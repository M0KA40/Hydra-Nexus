// Steam article data enters as text. Only a small inert markup vocabulary reaches React.
function nexusNewsURL(value,image=false){
  try{const u=new URL(String(value));if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))return '';
    if(image&&!/^(?:[a-z0-9-]+\.)*(?:steamstatic\.com|steamusercontent\.com|steamcdn-a\.akamaihd\.net)$/.test(u.hostname))return '';
    return u.href;
  }catch{return '';}
}
function nexusNewsArticle(content){
  const R=reactExports$1,esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let raw=String(content||'').slice(0,160000).replace(/\{STEAM_CLAN_(?:LOC_)?IMAGE\}\/gr?\//g,'https://clan.akamai.steamstatic.com/images/').replace(/\{STEAM_CLAN_(?:LOC_)?IMAGE\}/g,'https://clan.akamai.steamstatic.com/images');
  // BBCode attributes are escaped before parsing, then independently URL validated.
  raw=raw.replace(/\[(h[1-3]|b|i|u|strike|code|quote|list|olist)\]/gi,(_,tag)=>'<'+({b:'strong',i:'em',strike:'s',quote:'blockquote',list:'ul',olist:'ol'}[tag.toLowerCase()]||tag.toLowerCase())+'>')
    .replace(/\[\/(h[1-3]|b|i|u|strike|code|quote|list|olist)\]/gi,(_,tag)=>'</'+({b:'strong',i:'em',strike:'s',quote:'blockquote',list:'ul',olist:'ol'}[tag.toLowerCase()]||tag.toLowerCase())+'>')
    .replace(/\[\*\]/g,'<li>').replace(/\[img\s+src=["']?([^\]"']+)["']?\s*\]/gi,(_,url)=>'<img src="'+esc(url.trim())+'">').replace(/\[img\]([\s\S]*?)\[\/img\]/gi,(_,url)=>'<img src="'+esc(url.trim())+'">')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,(_,url,label)=>'<a href="'+esc(url.trim())+'">'+label+'</a>')
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi,(_,url)=>'<a href="'+esc(url.trim())+'">'+esc(url)+'</a>');
  const template=document.createElement('template');template.innerHTML=raw;
  const allowed=new Set(['p','br','strong','b','em','i','u','s','del','ul','ol','li','h1','h2','h3','h4','blockquote','pre','code','hr','a','img','div','span','table','thead','tbody','tr','th','td']);
  const blocked=new Set(['script','style','iframe','object','embed','svg','math','form','input','button','video','audio','source','link','meta','base','template']);let count=0,images=0;
  function walk(node,depth,index){
    if(++count>4000||depth>24)return null;if(node.nodeType===3)return node.textContent;if(node.nodeType!==1)return null;
    const tag=node.tagName.toLowerCase();if(blocked.has(tag))return null;
    const children=Array.from(node.childNodes).map((child,i)=>walk(child,depth+1,i));if(!allowed.has(tag))return children;
    const props={key:index};if(tag==='img'){const src=nexusNewsURL(node.getAttribute('src'),true);if(!src||++images>16)return null;return R.createElement('img',{...props,src,alt:node.getAttribute('alt')?.slice(0,300)||'',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer',onError:e=>{e.currentTarget.hidden=true;}});}
    if(tag==='a'){const href=nexusNewsURL(node.getAttribute('href'));if(!href)return children;props.href=href;props.rel='noopener noreferrer';}
    return R.createElement(tag==='h1'?'h2':tag,props,...children);
  }
  return Array.from(template.content.childNodes).map((node,index)=>walk(node,0,index));
}
const nexusNewsEntries=new Map();
function nexusNewsEntry(shop,objectId){
  const key=shop+':'+objectId;if(!nexusNewsEntries.has(key))nexusNewsEntries.set(key,{listeners:new Set(),pending:null,value:{items:[],loading:false,loaded:false,error:null,supported:shop==='steam'}});
  // Active entries must stay stable while a React surface subscribes.
  if(nexusNewsEntries.size>40)for(const [id,entry]of nexusNewsEntries)if(id!==key&&!entry.listeners.size&&!entry.pending){nexusNewsEntries.delete(id);break;}
  return nexusNewsEntries.get(key);
}
function nexusNewsPublish(entry,patch){entry.value={...entry.value,...patch};for(const listener of entry.listeners)listener();}
async function nexusNewsLoad(entry,shop,objectId,options={}){
  if(entry.pending)return entry.pending;
  if(!window.__nexusNews?.load)return;
  nexusNewsPublish(entry,{loading:true,error:null});
  entry.pending=Promise.resolve().then(()=>window.__nexusNews.load({shop,objectId,...options})).then(result=>{
    const items=options.enddate?[...new Map([...entry.value.items,...result.items].map(item=>[item.id,item])).values()]:result.items;
    nexusNewsPublish(entry,{...result,items,loaded:true,loading:false});
  }).catch(()=>nexusNewsPublish(entry,{loading:false,loaded:true,error:'unavailable'})).finally(()=>{entry.pending=null;});return entry.pending;
}
function HydraNexusNewsReader({item,shop,objectId,onClose}){
  const R=reactExports$1,tr=(key,values)=>window.__nexusI18n?.t(key,values)||key,content=R.useMemo(()=>nexusNewsArticle(item.contents),[item.contents]);
  const [opening,setOpening]=R.useState(false),[error,setError]=R.useState(false),opener=R.useRef(document.activeElement);
  const date=new Intl.DateTimeFormat(window.__nexusI18n?.language||'en',{dateStyle:'long'}).format(new Date(item.date*1000));
  R.useEffect(()=>{
    const modal=document.querySelector('.nexus-news-modal');if(!modal)return;modal.setAttribute('aria-label',item.title);const close=modal.querySelector('.modal__close-button');close?.focus({preventScroll:true});
    const trap=e=>{if(e.key!=='Tab')return;const nodes=[...modal.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){e.preventDefault();first.focus();}};
    modal.addEventListener('keydown',trap);return()=>{modal.removeEventListener('keydown',trap);if(opener.current?.isConnected)opener.current.focus({preventScroll:true});};
  },[item.id]);
  const open=async(browser=false)=>{if(opening)return;setOpening(true);setError(false);try{await window.__nexusNews.open({shop,objectId,id:item.id,browser});}catch{setError(true);}finally{setOpening(false);}};
  const links=async event=>{const anchor=event.target.closest('a');if(!anchor)return;event.preventDefault();event.stopPropagation();const url=nexusNewsURL(anchor.getAttribute('href'));if(url)try{await window.electron.openExternal(url);}catch{setError(true);}};
  return R.createElement(Modal$1,{visible:true,title:item.title,description:date,onClose,large:true,className:'nexus-news-modal'},
    R.createElement('div',{className:'nexus-news-reader',onClick:links,dir:'auto'},
      !item.contentComplete?R.createElement('p',{className:'nexus-news-excerpt-notice'},tr('Steam provides the content shown here. Open the original post for the full context.')):null,
      R.createElement('article',{className:'nexus-news-article'},content.length?content:R.createElement('p',null,item.excerpt)),
      R.createElement('footer',{className:'nexus-news-reader-footer',dir:window.__nexusI18n?.direction||'ltr'},R.createElement('button',{type:'button',className:'button button--outline',disabled:opening,onClick:()=>open()},tr('View on Steam')),R.createElement('button',{type:'button',className:'button button--outline',disabled:opening,onClick:()=>open(true)},tr('Open in browser')),error?R.createElement('p',{role:'alert'},tr('Could not load Steam updates. Please try again.')):null)));
}
function HydraNexusGameUpdates({shop,objectId,compact=false,onViewAll,active=true}){
  const R=reactExports$1,tr=(key,values)=>window.__nexusI18n?.t(key,values)||key,entry=nexusNewsEntry(shop,objectId),titleId=R.useId();
  const subscribe=R.useCallback(listener=>{entry.listeners.add(listener);return()=>entry.listeners.delete(listener);},[entry]);
  const snapshot=R.useCallback(()=>entry.value,[entry]),state=R.useSyncExternalStore(subscribe,snapshot,snapshot);
  const [selected,setSelected]=R.useState(null);
  R.useEffect(()=>{if(active&&!entry.value.loaded)nexusNewsLoad(entry,shop,objectId);},[entry,shop,objectId,active]);
  R.useEffect(()=>{if(!active)setSelected(null);},[active]);
  const category=item=>tr(({patch:'Patch notes',update:'Game update',announcement:'Announcement',news:'Steam news'})[item.category]||'Steam news');
  const date=item=>new Intl.DateTimeFormat(window.__nexusI18n?.language||'en',{dateStyle:'medium'}).format(new Date(item.date*1000));
  const refresh=()=>nexusNewsLoad(entry,shop,objectId,{refresh:true});
  const empty=state.supported===false?'Updates are available for Steam library games only.':state.loading?'Loading updates…':state.error?'Could not load Steam updates. Please try again.':'There are no developer announcements for this game yet.';
  return R.createElement('section',{className:'nexus-game-news'+(compact?' nexus-game-news--compact':''),'aria-labelledby':titleId,'aria-busy':state.loading},
    R.createElement('header',{className:'nexus-news-heading'},R.createElement('div',null,R.createElement('span',{className:'nexus-news-eyebrow'},'Steam'),R.createElement('h2',{id:titleId},tr(compact?'Latest developer update':'Updates'))),
      compact?R.createElement('button',{className:'button button--outline',type:'button',onClick:onViewAll},tr('View all updates')):R.createElement('button',{className:'button button--outline',type:'button',onClick:refresh,disabled:state.loading||state.supported===false},tr('Refresh updates'))),
    state.items.length&&state.stale?R.createElement('p',{className:'nexus-news-cache',role:'status'},tr('Showing saved updates. Connect to refresh.')):null,
    state.items.length&&state.error&&!state.stale?R.createElement('p',{className:'nexus-news-cache',role:'status'},tr('Could not load Steam updates. Please try again.')):null,
    !state.items.length?R.createElement('div',{className:'nexus-news-empty',role:'status'},R.createElement('svg',{width:32,height:32,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.3,'aria-hidden':true},R.createElement('path',{d:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5'})),R.createElement('h3',null,tr(state.loading?'Loading updates…':state.error?'Steam news':'No recent updates')),R.createElement('p',null,tr(empty)),state.error?R.createElement('button',{className:'button button--outline',type:'button',onClick:refresh,disabled:state.loading},tr('Refresh updates')):null):
      R.createElement('div',{className:'nexus-news-list'},...(compact?state.items.slice(0,1):state.items).map((item,index)=>R.createElement('button',{key:item.id,type:'button',className:'nexus-news-card'+(index===0?' nexus-news-card--lead':''),onClick:()=>setSelected(item),'aria-haspopup':'dialog'},
        item.image&&nexusNewsURL(item.image,true)?R.createElement('div',{className:'nexus-news-art'},R.createElement('img',{src:nexusNewsURL(item.image,true),alt:'',loading:'lazy',decoding:'async',referrerPolicy:'no-referrer',onError:e=>{e.currentTarget.parentElement.hidden=true;}})):null,
        R.createElement('div',{className:'nexus-news-copy',dir:'auto'},R.createElement('div',{className:'nexus-news-meta'},R.createElement('span',null,category(item)),R.createElement('time',{dateTime:new Date(item.date*1000).toISOString()},date(item))),R.createElement('h3',null,item.title),item.excerpt?R.createElement('p',null,item.excerpt):null,R.createElement('span',{className:'nexus-news-read'},tr('Read update'),R.createElement('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true},R.createElement('path',{d:'M5 12h14m-5-5 5 5-5 5'}))))))),
    !compact&&state.hasMore?R.createElement('button',{className:'button button--outline nexus-news-more',type:'button',disabled:state.loading,onClick:()=>nexusNewsLoad(entry,shop,objectId,{enddate:state.nextEnddate})},tr(state.loading?'Loading updates…':'Load older updates')):null,
    selected&&active?R.createElement(HydraNexusNewsReader,{key:selected.id,item:selected,shop,objectId,onClose:()=>setSelected(null)}):null);
}
if(typeof module!=='undefined')module.exports={nexusNewsURL,nexusNewsArticle,nexusNewsEntry,nexusNewsLoad,HydraNexusGameUpdates};
