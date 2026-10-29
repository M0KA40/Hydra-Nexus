// Safe, offline Markdown preview. Raw HTML and remote image loading stay disabled.
function renderNotesMarkdown(source){
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=value=>{try{if(value.length>8192||/[\x00-\x20]/.test(value))return null;const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}};
 function inline(text,depth=0){if(depth>5)return esc(text);let out='',i=0;while(i<text.length){
  if(text[i]==='\\'&&/[\\`*_[\]{}()#+.!>~-]/.test(text[i+1]||'')){out+=esc(text[i+1]);i+=2;continue;}
  if(text[i]==='`'){const run=/^`+/.exec(text.slice(i))[0],end=text.indexOf(run,i+run.length);if(end>=0){out+='<code>'+esc(text.slice(i+run.length,end))+'</code>';i=end+run.length;continue;}}
  const image=text.startsWith('![',i),link=text[i]==='['||image;if(link){const start=i+(image?2:1),labelEnd=text.indexOf('](',start);if(labelEnd>=0){let end=labelEnd+2,balance=1;for(;end<text.length;end++){if(text[end]==='(')balance++;if(text[end]===')'&&!--balance)break;}if(end<text.length){const raw=text.slice(labelEnd+2,end).replace(/^<|>$/g,''),url=href(raw);if(url&&!image){out+='<a href="'+esc(url)+'" rel="noreferrer">'+inline(text.slice(start,labelEnd),depth+1)+'</a>';i=end+1;continue;}if(image){out+=esc(text.slice(i,end+1));i=end+1;continue;}}}}
  let paired=false;for(const [mark,tag]of [['**','strong'],['__','strong'],['~~','del'],['*','em'],['_','em']])if(text.startsWith(mark,i)&&!(mark.includes('_')&&/\w/.test(text[i-1]||''))){const end=text.indexOf(mark,i+mark.length),inside=text.slice(i+mark.length,end);if(end>i+mark.length&&inside.trim()){out+='<'+tag+'>'+inline(inside,depth+1)+'</'+tag+'>';i=end+mark.length;paired=true;break;}}if(paired)continue;
  const bare=/^(?:https?:\/\/|<https?:\/\/)/i.test(text.slice(i,i+10));if(bare){const match=/^<?https?:\/\/[^\s<>]+>?/i.exec(text.slice(i));if(match){const raw=match[0].replace(/^<|>$/g,'').replace(/[.,;!?]+$/,''),url=href(raw);if(url){out+='<a href="'+esc(url)+'" rel="noreferrer">'+esc(raw)+'</a>';i+=match[0].startsWith('<')?match[0].length:raw.length;continue;}}}
  out+=esc(text[i++]);
 }return out;}
 const list=line=>/^( *)([-+*]|\d+[.)])\s+(.+)$/.exec(line),start=line=>/^\s*$|^ {0,3}(?:#{1,6}\s|>|`{3,}|~{3,})/.test(line)||!!list(line)||/^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(line);
 function blocks(lines,depth=0){if(depth>8)return '<p>'+esc(lines.join('\n'))+'</p>';let out='',i=0;while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}
  const fence=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);if(fence){const body=[];i++;while(i<lines.length&&!new RegExp('^ {0,3}'+fence[1][0]+'{'+fence[1].length+',}\\s*$').test(lines[i]))body.push(lines[i++]);if(i<lines.length)i++;out+='<pre><code>'+esc(body.join('\n'))+'</code></pre>';continue;}
  const heading=/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);if(heading){out+='<h'+heading[1].length+'>'+inline(heading[2])+'</h'+heading[1].length+'>';i++;continue;}
  if(/^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(line)){out+='<hr>';i++;continue;}
  if(/^ {0,3}>/.test(line)){const inner=[];while(i<lines.length&&/^ {0,3}>/.test(lines[i]))inner.push(lines[i++].replace(/^ {0,3}> ?/,''));out+='<blockquote>'+blocks(inner,depth+1)+'</blockquote>';continue;}
  const first=list(line);if(first){const indent=first[1].length,ordered=/\d/.test(first[2]),tag=ordered?'ol':'ul';out+='<'+tag+(ordered?' start="'+Math.min(1000000,parseInt(first[2],10))+'"':'')+'>';while(i<lines.length){const item=list(lines[i]);if(!item||item[1].length!==indent||/\d/.test(item[2])!==ordered)break;const content=[item[3]];i++;while(i<lines.length&&lines[i].trim()&&/^ +/.test(lines[i])&&lines[i].match(/^ */)[0].length>indent)content.push(lines[i++].slice(indent+2));const task=/^\[([ xX])\]\s+/.exec(content[0]);if(task)content[0]=content[0].slice(task[0].length);out+='<li>'+(task?'<input type="checkbox" disabled aria-hidden="true" '+(task[1].toLowerCase()==='x'?'checked':'')+'>':'')+blocks(content,depth+1)+'</li>';}out+='</'+tag+'>';continue;}
  const paragraph=[line];i++;while(i<lines.length&&!start(lines[i]))paragraph.push(lines[i++]);out+='<p>'+paragraph.map(text=>inline(text)).join('<br>')+'</p>';
 }return out;}
 return blocks(String(source||'').replace(/\r\n?/g,'\n').split('\n'));
}
if(typeof module!=='undefined')module.exports=renderNotesMarkdown;
