'use strict';
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path');
const {Readable}=require('node:stream');
const MEDIA_ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)$/i;
const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'};
function byteRange(value,size){
  if(!value)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if(!match||(!match[1]&&!match[2])||!size)throw Error('range');
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw Error('range');start=Math.max(0,size-suffix);end=size-1;}
  else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)throw Error('range');end=Math.min(end,size-1);}
  return {start,end};
}
function createBackgroundMedia({directory,approved,log=()=>{}}){
  const media=path.resolve(directory,'media');
  return async request=>{
    let handle;
    try{
      const url=new URL(request.url),id=decodeURIComponent(url.pathname.slice(1)),method=request.method||'GET';
      if(url.protocol!=='nexus-media:'||url.hostname!=='assets'||url.username||url.password||url.port||url.search||url.hash||!MEDIA_ID.test(id)||!approved(id))return new Response(null,{status:404});
      if(!['GET','HEAD'].includes(method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
      // Neither the media directory nor a managed file may redirect to another location.
      const canonical=await fsp.realpath(directory),expected=path.join(canonical,'media'),realMedia=await fsp.realpath(media),target=path.join(realMedia,id);
      if(realMedia.toLowerCase()!==expected.toLowerCase())return new Response(null,{status:404});
      const entry=await fsp.lstat(target);if(!entry.isFile()||entry.isSymbolicLink()||entry.nlink!==1)return new Response(null,{status:404});
      if((await fsp.realpath(target)).toLowerCase()!==target.toLowerCase())return new Response(null,{status:404});
      handle=await fsp.open(target,fs.constants.O_RDONLY| (fs.constants.O_NOFOLLOW||0));const stat=await handle.stat();
      if(!stat.isFile()||stat.ino!==entry.ino||stat.dev!==entry.dev||stat.nlink!==1){await handle.close();handle=null;return new Response(null,{status:404});}
      const headers={'Content-Type':MIME[id.split('.').pop().toLowerCase()],'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      let range;
      try{range=method==='HEAD'?null:byteRange(request.headers?.get('range'),stat.size);}catch{await handle.close();handle=null;return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+stat.size,'Content-Length':'0'}});}
      const length=range?range.end-range.start+1:stat.size;headers['Content-Length']=String(length);if(range)headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+stat.size;
      if(method==='HEAD'||!length){await handle.close();handle=null;return new Response(null,{status:200,headers});}
      const stream=handle.createReadStream({...(range||{}),autoClose:true,highWaterMark:64*1024});handle=null;
      const abort=()=>stream.destroy();
      if(request.signal?.aborted)abort();else request.signal?.addEventListener('abort',abort,{once:true});
      stream.once('close',()=>request.signal?.removeEventListener('abort',abort));
      return new Response(Readable.toWeb(stream),{status:range?206:200,headers});
    }catch(error){if(handle)await handle.close().catch(()=>{});if(!['ENOENT','ENOTDIR'].includes(error.code))log(error);return new Response(null,{status:404});}
  };
}
module.exports={createBackgroundMedia,byteRange,MEDIA_ID};
