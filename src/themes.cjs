'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {MEDIA_ID}=require('./background-media.cjs');
const MAX_CSS=1024*1024;
function trustedCSSURL(value,base){const u=new URL(value,base);if(u.protocol!=='https:'||!['hydrathemes.shop','www.hydrathemes.shop'].includes(u.hostname)||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Theme CSS resources must stay on hydrathemes.shop using HTTPS');return u;}
function sourceURL(input){const url=new URL(String(input).trim());if(url.protocol!=='https:'||!['hydrathemes.shop','www.hydrathemes.shop'].includes(url.hostname)||url.username||url.password)throw Error('Paste a theme link from hydrathemes.shop');if(!url.pathname.endsWith('.css')){const parts=url.pathname.split('/').filter(Boolean);if(!['theme','themes'].includes(parts[0])||!parts[1])throw Error('Paste the link to a specific Hydra theme');url.pathname='/themes/'+parts[1]+'/theme.css';}url.search='';url.hash='';return url.toString();}
async function atomicText(file,text){await fsp.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{await fsp.writeFile(tmp,text,'utf8');for(let attempt=0;;attempt++){try{await fsp.rename(tmp,file);break;}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=4)throw e;await new Promise(resolve=>setTimeout(resolve,40*2**attempt));}}}catch(e){await fsp.rm(tmp,{force:true}).catch(()=>{});throw e;}}
async function fetchCSS(url,fetcher,seen=new Set(),deadline=Date.now()+60000){
  const u=trustedCSSURL(url);url=u.href;if(seen.has(url))return '';if(seen.size>=8)throw Error('Too many theme imports');seen.add(url);
  if(Date.now()>=deadline)throw Error('Theme download timed out. Try again.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),Math.min(30000,deadline-Date.now()));let text='';
  try{const response=await fetcher(url,{signal:controller.signal,credentials:'omit',redirect:'error'});if(response.redirected||response.url&&trustedCSSURL(response.url).href!==u.href)throw Error('Theme redirects are not supported');if(!response.ok)throw Error('Theme download failed ('+response.status+'). Check that the link contains theme CSS.');let length=0;const chunks=[];for await(const chunk of response.body){length+=chunk.length;if(length>MAX_CSS)throw Error('Theme CSS is too large');chunks.push(Buffer.from(chunk));}text=Buffer.concat(chunks).toString('utf8');}finally{clearTimeout(timeout);}
  const imports=[...text.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/gi)];
  for(const match of imports){const imported=new URL(match[1],url).toString();const replacement=await fetchCSS(imported,fetcher,seen,deadline);text=text.replace(match[0],()=>replacement);}
  if(/@import/i.test(text))throw Error('Unsupported theme import syntax');
  text=text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(full,_quote,value)=>{if(/^(data:|#)/i.test(value))return full;const absolute=trustedCSSURL(value.trim(),url);return 'url('+JSON.stringify(absolute.toString())+')';});
  if(Buffer.byteLength(text)>MAX_CSS)throw Error('Combined theme CSS is too large');return text;
}
class ThemeStore{
  constructor({directory,fetcher}){this.directory=directory;this.fetcher=fetcher;this.file=path.join(directory,'themes.json');this.pending=null;this.generation=0;this.data={quietColor:'slate',quietBackground:false,background:null,achievementCSS:'',achievementSource:'',customCSS:''};}
  async init(){await fsp.mkdir(this.directory,{recursive:true});try{const d=JSON.parse(await fsp.readFile(this.file,'utf8'));if(!d||typeof d.achievementCSS!=='string'||typeof d.customCSS!=='string'||d.achievementCSS.length>MAX_CSS||d.customCSS.length>MAX_CSS)throw Error('Invalid theme settings');if(d.background&&(!/^[-a-f0-9]{36}\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i.test(String(d.background.file))||!['image','video'].includes(d.background.type)||!Number.isFinite(d.background.opacity)||d.background.opacity<0||d.background.opacity>.9||!Number.isFinite(d.background.blur)||d.background.blur<0||d.background.blur>30||(d.background.pauseWhenInactive!==undefined&&typeof d.background.pauseWhenInactive!=='boolean')))throw Error('Invalid managed background');this.data={quietColor:d.quietColor==='mint'?'mint':'slate',quietBackground:d.quietBackground===true,background:d.background?{...d.background,pauseWhenInactive:d.background.pauseWhenInactive??true}:null,interface:{schema:1,design:d.interface?.schema===1&&d.interface.design==='quiet'?'quiet':'native'},achievementCSS:'',achievementSource:'',customCSS:''};}catch(e){if(e.code!=='ENOENT')throw Error('Nexus theme settings could not be read; originals were preserved.');}return this;}
  async save(next){await atomicText(this.file,JSON.stringify(next,null,2));this.data=next;return this.public();}
  mediaPublic(b){return b?{...b,url:b.type==='video'?'nexus-media://assets/'+b.file:'local:'+encodeURI(path.join(this.directory,'media',b.file).replace(/\\/g,'/'))}:null;}
  public(){return {quietColor:this.data.quietColor==='mint'?'mint':'slate',quietBackground:this.data.quietBackground===true,background:this.mediaPublic(this.data.background),interface:this.data.interface?.schema===1&&this.data.interface.design==='quiet'?{schema:1,design:'quiet'}:{schema:1,design:'native'}};}
  async selectQuietColor(color){if(!['slate','mint'].includes(color))throw Error('Unknown interface design');return this.save({...this.data,quietColor:color});}
  async setQuietBackground(enabled){if(typeof enabled!=='boolean')throw Error('Invalid background preference');return this.save({...this.data,quietBackground:enabled});}
  async selectInterface(design){if(!['native','quiet'].includes(design))throw Error('Unknown interface design');return this.save({...this.data,interface:{schema:1,design}});}
  approved(file){return MEDIA_ID.test(file)&&(this.data.background?.file===file||this.pending?.file===file);}
  async prepareBackground(source){
    const generation=++this.generation;await this.cancelBackground();
    const ext=path.extname(source).toLowerCase(),type=['.mp4','.webm','.mov'].includes(ext)?'video':['.png','.jpg','.jpeg','.webp','.gif','.avif'].includes(ext)?'image':null;
    if(!type)throw Error('Choose an image or an MP4/WebM video');
    const stat=await fsp.stat(source);if(!stat.isFile()||stat.size>2*1024**3)throw Error('Choose a media file smaller than 2 GB');
    const directory=path.join(this.directory,'media');await fsp.mkdir(directory,{recursive:true});
    if((await fsp.realpath(directory)).toLowerCase()!==path.join(await fsp.realpath(this.directory),'media').toLowerCase())throw Error('The background file could not be read. Choose the file again.');
    const file=crypto.randomUUID()+ext,target=path.join(directory,file);
    try{
      await fsp.copyFile(source,target,fs.constants.COPYFILE_EXCL);
      if((await fsp.stat(target)).size>2*1024**3)throw Error('Choose a media file smaller than 2 GB');
      if(generation!==this.generation)throw Error('Background selection was cancelled.');
      this.pending={file,type,name:path.basename(source),opacity:this.data.background?.opacity??.28,blur:this.data.background?.blur??0,pauseWhenInactive:this.data.background?.pauseWhenInactive??true};
      return this.mediaPublic(this.pending);
    }catch(error){await fsp.rm(target,{force:true}).catch(()=>{});throw error;}
  }
  async commitBackground(file){
    if(!this.pending||this.pending.file!==file)throw Error('Background selection was cancelled.');
    const candidate=this.pending,previous=this.data.background?.file;
    // Selection is published atomically only after the renderer validates a decoded frame.
    const result=await this.save({...this.data,background:{...candidate,opacity:this.data.background?.opacity??candidate.opacity,blur:this.data.background?.blur??candidate.blur,pauseWhenInactive:this.data.background?.pauseWhenInactive??candidate.pauseWhenInactive}});
    this.pending=null;await this.discardMedia(previous);return result;
  }
  async cancelBackground(file){if(this.pending&&(!file||this.pending.file===file)){const candidate=this.pending;this.pending=null;await this.discardMedia(candidate.file);}}
  async recoverMedia(){const directory=path.join(this.directory,'media');let entries;try{entries=await fsp.readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}if((await fsp.realpath(directory)).toLowerCase()!==path.join(await fsp.realpath(this.directory),'media').toLowerCase())return;for(const entry of entries)if(entry.isFile()&&MEDIA_ID.test(entry.name)&&entry.name!==this.data.background?.file)await this.discardMedia(entry.name);}
  async backgroundOptions(data){const b=this.data.background;if(!b)throw Error('Choose a background first');if(data.pauseWhenInactive!==undefined&&typeof data.pauseWhenInactive!=='boolean')throw Error('Invalid background playback preference');return this.save({...this.data,background:{...b,opacity:data.opacity===undefined?b.opacity:Math.max(0,Math.min(0.9,Number(data.opacity)||0)),blur:data.blur===undefined?b.blur:Math.max(0,Math.min(30,Number(data.blur)||0)),pauseWhenInactive:data.pauseWhenInactive??b.pauseWhenInactive??true}});}
  async discardMedia(file){if(typeof file==='string'&&/^[-a-f0-9]{36}\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i.test(file))await fsp.rm(path.join(this.directory,'media',file),{force:true}).catch(()=>{});}
  async clearBackground(){++this.generation;await this.cancelBackground();const previous=this.data.background?.file;const result=await this.save({...this.data,background:null});await this.discardMedia(previous);return result;}
  async importAchievement(link){const url=sourceURL(link);return {source:url,css:await fetchCSS(url,this.fetcher)};}
  async applyAchievement(css,source){if(typeof css!=='string'||!css.trim()||Buffer.byteLength(css)>MAX_CSS)throw Error('No achievement notification design was found');if(!css.includes('.achievement-notification'))throw Error('The selected theme does not contain achievement notification styles');return this.save({...this.data,achievementCSS:css,achievementSource:String(source||'Imported CSS').slice(0,2048)});}
  async resetAchievement(){return this.save({...this.data,achievementCSS:'',achievementSource:''});}
  async customCSS(css){if(typeof css!=='string'||Buffer.byteLength(css)>MAX_CSS)throw Error('CSS must be smaller than 1 MB');return this.save({...this.data,customCSS:css});}
}
module.exports={ThemeStore,sourceURL,fetchCSS,atomicText,MAX_CSS};
