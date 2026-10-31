'use strict';
const magic=Buffer.from([72,78,69,88,69,51,0,1]);
function exeMetadata(bytes){
  const fail=()=>{throw Error('Choose an official Hydra Nexus EXE release');};
  if(!Buffer.isBuffer(bytes)||bytes.length<256||bytes[0]!==77||bytes[1]!==90||!bytes.subarray(-8).equals(magic))return fail();
  const pe=bytes.readUInt32LE(60);if(pe<64||pe>bytes.length-4||!bytes.subarray(pe,pe+4).equals(Buffer.from([80,69,0,0])))return fail();
  const length=bytes.readUInt32LE(bytes.length-12);if(length<2||length>1024||length>bytes.length-12-pe-4)return fail();
  let metadata;try{metadata=JSON.parse(bytes.subarray(bytes.length-12-length,bytes.length-12).toString('utf8'));}catch{return fail();}
  if(metadata.schema!==1||metadata.product!=='Hydra Nexus'||metadata.engine!=='native'||!/^\d+\.\d+(?:\.\d+)?$/.test(metadata.version)||!Number.isSafeInteger(metadata.revision)||metadata.revision<1)return fail();
  return {version:metadata.version,revision:metadata.revision};
}
module.exports={exeMetadata};
