'use strict';
// Theme CSS imports are spliced in as literal text: a downloaded stylesheet must never
// be reinterpreted as a String.replace replacement pattern ($&, $1, $'), and the import
// allowlist must keep rejecting redirects, foreign hosts and failing downloads.
const assert=require('node:assert/strict'),{fetchCSS}=require('../src/themes.cjs');
const host='https://hydrathemes.shop/';
const responder=routes=>async url=>{const body=routes[url];if(body===undefined)return {ok:false,status:404,url};return {ok:true,status:200,url,redirected:false,body:(async function*(){yield Buffer.from(body);})()};};
(async()=>{
 const root=host+'theme.css',part=host+'part.css';
 const literal=':root{--marker:"$&$1$`$\'$$";}';
 const css='@import url("'+part+'");\nbody{color:red}';
 const out=await fetchCSS(root,responder({[root]:css,[part]:literal}));
 assert.ok(out.includes(literal),'imported CSS is inserted verbatim, without replacement patterns');
 assert.ok(!out.includes('@import'),'the import statement is removed once inlined');
 assert.ok(out.includes('body{color:red}'),'the importing stylesheet keeps its own rules');

 await assert.rejects(fetchCSS(root,responder({[root]:css.replace(part,'http://127.0.0.1/part.css')})),/hydrathemes\.shop/,'a foreign host inside an import is rejected');
 await assert.rejects(fetchCSS(root,responder({[root]:'@import url("'+host+'bad.css");'})),/Theme download failed/,'a failing nested import is reported');
 await assert.rejects(fetchCSS(root,responder({[root]:'@import url('+host+'bad.css);'})),/Unsupported theme import syntax/,'an unquoted import is refused rather than half-parsed');
 console.log('PASS: imported theme CSS is spliced verbatim (no $ replacement patterns), imports are inlined and removed, and foreign or failing imports still raise.');
})().catch(error=>{console.error(error);process.exitCode=1;});
