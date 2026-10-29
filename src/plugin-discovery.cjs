'use strict';
const fs=require('node:fs'),path=require('node:path');
const {atomicText}=require('./themes.cjs');
// Public feature identities, deliberately independent of installer version/revision.
const introductions=Object.freeze({storage:'1.3/storage',downloadFinish:'1.3/download-finish',pageCleaner:'2.0.1/page-cleaner'});
function createPluginDiscovery({directory,log=()=>{},theme=false}){
  const identities=theme?{quietMint:'2.1.1/quiet-mint'}:introductions;
  const file=path.join(directory,theme?'theme-discovery.json':'plugin-discovery.json');let seen=[],failed=false,queue=Promise.resolve();
  try{const stat=fs.statSync(file);if(stat.size>16384)throw Error('Invalid plugin discovery data');const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.schema!==1||!Array.isArray(saved.seen)||saved.seen.some(v=>typeof v!=='string'))throw Error('Invalid plugin discovery data');seen=[...new Set(saved.seen)];}
  catch(error){if(error.code!=='ENOENT'){failed=true;log(error);}}
  // Damaged data is preserved and fails closed: never unexpectedly repeat a tour.
  const snapshot=()=>({pending:failed?[]:Object.keys(identities).filter(key=>!seen.includes(identities[key]))});
  function acknowledge(key){const task=queue.then(async()=>{if(!Object.hasOwn(identities,key))throw Error('Unknown Nexus plugin');if(failed||seen.includes(identities[key]))return snapshot();const next=[...seen,identities[key]];await atomicText(file,JSON.stringify({schema:1,seen:next}));seen=next;return snapshot();});queue=task.catch(()=>{});return task;}
  return {snapshot,acknowledge};
}
module.exports={createPluginDiscovery,introductions};
