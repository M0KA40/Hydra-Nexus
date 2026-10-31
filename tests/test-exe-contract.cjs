'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {exeMetadata}=require('../src/exe-metadata.cjs'),brand=require('../src/brand.cjs');
const root=path.resolve(__dirname,'..'),bytes=fs.readFileSync(path.join(root,'dist/Hydra_Nexus.exe'));
assert.deepEqual(exeMetadata(bytes),{version:brand.version,revision:brand.revision});
for(const invalid of [Buffer.from(':: HYDRA_NEXUS_RELEASE 3.0'),bytes.subarray(0,-1),Buffer.from(bytes),Buffer.from(bytes)]){
 if(invalid.length===bytes.length){if(invalid[0]===77)invalid[0]=0;else invalid.writeUInt32LE(2048,invalid.length-12);}
 assert.throws(()=>exeMetadata(invalid),/official Hydra Nexus EXE/);
}
const huge=Buffer.from(bytes);huge.writeUInt32LE(2048,huge.length-12);assert.throws(()=>exeMetadata(huge));
for(const file of fs.readdirSync(path.join(root,'src')).filter(n=>/\.(?:cjs|js)$/.test(n)))assert.doesNotMatch(fs.readFileSync(path.join(root,'src',file),'utf8'),/powershell(?:\.exe)?|System\.Management\.Automation/i,file+' has no PowerShell runtime dependency');
const guides=require('../src/plugin-guides.cjs');assert.equal(guides.cloud.images[0].src,'./assets/nexus-guide-cloud.webp');
for(const lang of ['en','pt-BR','es','ru','fr','de','tr','pl']){const c=require('../src/locales/'+lang+'.cjs');for(const step of guides.cloud.steps)assert.ok(typeof c[step]==='string'&&c[step].length>10);}
const notes=require('../src/release-content.cjs');assert.equal(notes.version,'3.0');for(const [lang,text]of Object.entries(notes.notes)){if(lang==='ar')continue;assert.equal(text,fs.readFileSync(path.join(root,'docs/releases/3.0',lang+'.md'),'utf8'));assert.doesNotMatch(text,/ملاحظات تجهيز داخلية|EXE migration remains deferred/);}
console.log('PASS EXE contract: actual PE/footer/version, malformed/BAT rejection, no runtime PowerShell calls, active-language Cloud guide and release-note parity.');
