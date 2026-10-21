function notesUI(boot){
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let seq=0,images=boot.note.images||[],saved=boot.note.text||'',saveTask=null,revision=0;
  const pending=new Map();function rpc(action,data={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Notes did not respond'));},30000);pending.set(id,{resolve,reject,timer});console.info('__NEXUS_NOTE__'+JSON.stringify({token:boot.token,id,action,data}));});}
  window.__noteReply=m=>{const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);};
  document.body.innerHTML='<header><strong></strong><button id="top" aria-pressed="false">Always on top</button></header><nav><button id="edit">Edit</button><button id="read">Read</button></nav><textarea dir="auto" maxlength="262144" aria-label="Game notes" placeholder="Write notes in any language. Paste links here…"></textarea><article hidden></article><section id="images"></section><footer role="status">Saved locally</footer>';
  $('header strong').textContent=boot.title;$('textarea').value=saved;
  const status=text=>$('footer').textContent=text;
  function renderImages(){const box=$('#images');box.replaceChildren();images.forEach((src,i)=>{const wrap=document.createElement('figure'),img=new Image(),b=document.createElement('button');img.src=src;img.alt='Note attachment '+(i+1);b.textContent='Remove image';b.onclick=()=>{images.splice(i,1);renderImages();save().catch(()=>{});};wrap.append(img,b);box.append(wrap);});}
  function save(){revision++;if(saveTask)return saveTask;saveTask=(async()=>{let committed;do{committed=revision;status('Saving…');const text=$('textarea').value;await rpc('save',{text,images:[...images]});saved=text;}while(committed!==revision);status('Saved locally');})().catch(e=>{status(e.message);throw e;}).finally(()=>{saveTask=null;});return saveTask;}
  $('textarea').oninput=()=>save().catch(()=>{});
  $('#read').onclick=()=>{const text=$('textarea').value,article=$('article');article.innerHTML=esc(text).replace(/https?:\/\/[^\s<]+/g,url=>'<a href="'+url+'">'+url+'</a>');article.hidden=false;$('textarea').hidden=true;};
  $('#edit').onclick=()=>{$('article').hidden=true;$('textarea').hidden=false;$('textarea').focus();};
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();rpc('link',{url:a.href}).catch(e=>status(e.message));}});
  $('#top').onclick=async()=>{try{const r=await rpc('top');$('#top').setAttribute('aria-pressed',r.on);$('#top').textContent=r.on?'Always on top: On':'Always on top';}catch(e){status(e.message);}};
  window.__flushNote=async()=>{await save();};renderImages();
}
if(typeof module!=='undefined')module.exports=notesUI;
