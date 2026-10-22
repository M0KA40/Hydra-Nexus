'use strict';
// Brace- and escape-aware loginusers.vdf surgery. Regex block matching cannot be used for
// this file: quoted Steam values may legally contain {, } and \" and must never corrupt it.
function skipGap(text,pos){
  while(pos<text.length){const c=text[pos];
    if(c===' '||c==='\t'||c==='\r'||c==='\n'){pos++;continue;}
    if(c==='/'&&text[pos+1]==='/'){pos+=2;while(pos<text.length&&text[pos]!=='\n')pos++;continue;}
    break;
  }return pos;
}
function readString(text,pos){
  // text[pos] must be the opening quote; returns {value,end} where end is after the closing quote.
  if(text[pos]!=='"')return null;
  pos++;let value='',escaped=false;
  while(pos<text.length){const c=text[pos];
    if(escaped){value+=c;escaped=false;}
    else if(c==='\\'){value+=c;escaped=true;}
    else if(c==='"')return {value,end:pos+1};
    else value+=c;
    pos++;
  }return null;
}
function scanUserBlocks(content){
  const blocks=[];const len=content.length;let pos=0,depth=0;
  while(pos<len){pos=skipGap(content,pos);const c=content[pos];
    if(c==='"'){
      const key=readString(content,pos);
      if(!key)break; // Unterminated string: the file is truncated; keep what already parsed.
      const after=skipGap(content,key.end);
      if(content[after]==='{'){
        if(/^\d{17}$/.test(key.value))blocks.push({steamId64:key.value,openDepth:depth,start:pos,openEnd:after+1,closeStart:-1,closeEnd:-1,body:null});
        pos=after+1;depth++;
      }else if(content[after]==='"'){
        const value=readString(content,after);
        if(!value)break;
        pos=value.end;
      }else pos=key.end;
      continue;
    }
    if(c==='{')depth++;
    else if(c==='}'){
      depth--;
      // A block closes on the brace that returns to its own opening depth, so nested
      // objects inside a user block can never truncate it.
      for(let i=blocks.length-1;i>=0;i--)if(blocks[i].closeStart<0){
        if(blocks[i].openDepth===depth){blocks[i].closeStart=pos;blocks[i].closeEnd=pos+1;blocks[i].body=content.slice(blocks[i].openEnd,pos);}
        break;
      }
    }
    pos++;
  }
  return blocks.filter(b=>b.closeStart>=0);
}
function assertWellFormed(text){let pos=text.charCodeAt(0)===0xfeff?1:0;function entries(nested,depth){if(depth>32)throw Error('Steam VDF nesting is too deep');while(true){pos=skipGap(text,pos);if(pos===text.length){if(nested)throw Error('Steam VDF is truncated');return;}if(text[pos]==='}'){if(!nested)throw Error('Unexpected Steam VDF brace');pos++;return;}const key=readString(text,pos);if(!key)throw Error('Malformed Steam VDF key');pos=skipGap(text,key.end);if(text[pos]==='{'){pos++;entries(true,depth+1);}else{const value=readString(text,pos);if(!value)throw Error('Malformed Steam VDF value');pos=value.end;}}}entries(false,0);const ids=scanUserBlocks(text).map(b=>b.steamId64);if(new Set(ids).size!==ids.length)throw Error('Duplicate Steam account blocks');return true;}
function directFields(body){const result=[];let pos=0,depth=0;while(pos<body.length){pos=skipGap(body,pos);const c=body[pos];if(c==='{'){depth++;pos++;continue;}if(c==='}'){depth--;pos++;continue;}const key=readString(body,pos);if(!key){pos++;continue;}const after=skipGap(body,key.end),value=readString(body,after);if(value){if(depth===0)result.push({key:key.value,start:after,end:value.end,value:value.value.replace(/\\(.)/g,'$1')});pos=value.end;}else pos=key.end;}return result;}
function field(body,key){return directFields(body).find(f=>f.key.toLowerCase()===key.toLowerCase())?.value||'';}
function setOrAddKey(text,key,val){
  const existing=directFields(text).find(f=>f.key.toLowerCase()===key.toLowerCase());
  const quoted='"'+String(val).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
  if(existing)return text.slice(0,existing.start)+quoted+text.slice(existing.end);
  return text.trimEnd()+'\n\t\t"'+key+'"\t\t'+quoted+'\n\t';
}
function transformUserBlocks(content,transform){
  // transform(steamId64, body) returns a full replacement block ("id" { ... }) or null to keep the original.
  const blocks=scanUserBlocks(content);
  if(!blocks.length)return null;
  let out=content;
  for(let i=blocks.length-1;i>=0;i--){
    const b=blocks[i],replacement=transform(b.steamId64,b.body);
    if(typeof replacement!=='string')continue;
    out=out.slice(0,b.start)+replacement+out.slice(b.closeEnd);
  }
  return out;
}
function accountList(content){
  return scanUserBlocks(content).map(b=>({steamId64:b.steamId64,accountName:field(b.body,'AccountName'),personaName:field(b.body,'PersonaName')||field(b.body,'AccountName'),mostRecent:field(b.body,'MostRecent')==='1',wantsOffline:field(b.body,'WantsOfflineMode')==='1',allowAutoLogin:field(b.body,'AllowAutoLogin')==='1'})).filter(a=>a.accountName);
}
module.exports={scanUserBlocks,transformUserBlocks,accountList,field,setOrAddKey,assertWellFormed};
