// Patch owned settings only. Preserve native nodes, focus, scroll and media state.
function patchNexusDOM(host,html,{pending=false}={}){
  const template=document.createElement('template');template.innerHTML=html;
  for(const field of template.content.querySelectorAll('.checkbox-field')){const input=field.querySelector('input'),box=field.querySelector('.checkbox-field__checkbox');if(input&&box)box.prepend(input);}
  const key=node=>{if(node.nodeType!==1)return null;if(node.id)return 'id:'+node.id;for(const attr of ['data-nexus-plugin-card','data-plugin','data-plugin-open','data-toggle','data-tab','data-cleaner-section','data-action','data-nexus-action','data-game'])if(node.hasAttribute(attr))return attr+':'+node.getAttribute(attr)+':'+(node.getAttribute('data-key')||'')+':'+(node.getAttribute('data-id')||'');return null;};
  const compatible=(a,b)=>a.nodeType===b.nodeType&&(a.nodeType!==1||a.tagName===b.tagName)&&key(a)===key(b);
  function patch(node,next){
    if(node.nodeType!==1){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
    const previousValue=node.getAttribute('value'),open=node.tagName==='DETAILS'?node.open:null;
    for(const attr of [...node.attributes])if(!next.hasAttribute(attr.name)&&!(attr.name==='open'&&open!==null))node.removeAttribute(attr.name);
    for(const attr of next.attributes)if(node.getAttribute(attr.name)!==attr.value&&!(attr.name==='open'&&open!==null))node.setAttribute(attr.name,attr.value);
    children(node,next);
    if(node.tagName==='INPUT'){
      if(['checkbox','radio'].includes(node.type)){if(!pending&&node.checked!==next.checked)node.checked=next.checked;}
      else if(previousValue!==next.getAttribute('value')&&node.value!==next.value)node.value=next.value;
    }
    if(node.tagName==='SELECT'&&!pending&&node.value!==next.value)node.value=next.value;
    if(open!==null)node.open=open;
  }
  function children(parent,next){
    const keyed=new Map([...parent.childNodes].map(node=>[key(node),node]).filter(([id])=>id));let cursor=parent.firstChild;
    for(const desired of [...next.childNodes]){
      let node=key(desired)?keyed.get(key(desired)):cursor;
      if(!node||!compatible(node,desired)){node=desired.cloneNode(true);parent.insertBefore(node,cursor);}
      else{if(node!==cursor)parent.insertBefore(node,cursor);patch(node,desired);}
      cursor=node.nextSibling;
    }
    while(cursor){const nextNode=cursor.nextSibling;parent.removeChild(cursor);cursor=nextNode;}
  }
  children(host,template.content);
}
if(typeof window!=='undefined')window.__nexusPatchDOM=patchNexusDOM;
if(typeof module!=='undefined')module.exports=patchNexusDOM;
