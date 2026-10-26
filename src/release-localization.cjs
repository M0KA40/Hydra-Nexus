'use strict';
const languages=['en','pt-BR','es','ru','ar','fr','de','tr','pl'];
function cleanNotes(value){return typeof value==='string'?value.slice(0,16000).replace(/<!--[\s\S]*?-->/g,'').trim():'';}
function translations(value){const result={};if(value&&typeof value==='object'&&!Array.isArray(value))for(const language of languages){const text=cleanNotes(value[language]);if(text)result[language]=text;}return result;}
function matchingPack(pack,version,revision){if(!pack||pack.schema!==1||pack.version!==version||pack.revision!==revision)return null;const result=translations(pack.notes);return result.en?result:null;}
module.exports={languages,cleanNotes,translations,matchingPack};
