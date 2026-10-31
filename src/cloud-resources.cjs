'use strict';
// Binary offline tools belong in ASAR files, not permanent JavaScript strings.
const fs=require('node:fs/promises'),path=require('node:path');
const {plain}=require('./core.cjs');
async function readResource(name,sourceFallback){
  if(!/^nexus-[a-z0-9._-]+$/i.test(name))throw Error('Invalid Nexus resource');
  const installed=path.join(__dirname,name);
  try{await plain(installed);return await fs.readFile(installed);}catch(error){if(error.code!=='ENOENT'||!sourceFallback)throw error;}
  await plain(sourceFallback);return fs.readFile(sourceFallback);
}
module.exports={readResource};
