'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {atomicText}=require('./themes.cjs');
function createReleaseNotes({directory,version,revision,load,changed=()=>{},log=()=>{}}){
  const file=path.join(directory,'release-notes.json'),id=version+':'+revision;
  let pending=null,current=null,dismissed=false;
  async function prepare(){
    if(pending)return pending;
    pending=(async()=>{
      try{const stat=await fs.stat(file);if(stat.size<=4096&&JSON.parse(await fs.readFile(file,'utf8')).seen===id){dismissed=true;return null;}}catch{}
      try{
        const release=await load();
        if(!release||release.version!==version||release.revision!==revision)return null;
        const notes=String(release.notes||'').slice(0,16000).replace(/<!--[\s\S]*?-->/g,'').trim();
        if(!notes)return null;
        current={id,version,revision,notes};changed(current);return current;
      }catch(e){log(e);return null;}
    })();
    return pending;
  }
  async function dismiss(value){if(!current||value!==id)throw Error('Invalid release notes');await atomicText(file,JSON.stringify({seen:id}));dismissed=true;current=null;changed(null);return {dismissed:true};}
  return {prepare,dismiss,current:()=>dismissed?null:current};
}
module.exports={createReleaseNotes};
