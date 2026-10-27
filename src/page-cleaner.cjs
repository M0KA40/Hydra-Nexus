'use strict';
const sections=Object.freeze(['gallery','about','similar','reviews','achievements','stats','howLongToBeat','controller','requirements','languages','otherSidebar']);
const defaults=()=>Object.fromEntries(sections.map(key=>[key,'show']));
function normalize(value){
  if(value===undefined)return defaults();
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!sections.includes(key))||Object.values(value).some(scope=>!['show','library','all'].includes(scope)))throw Error('Invalid page cleanup preference');
  return {...defaults(),...value};
}
function change(current,key,scope){if(!sections.includes(key)||!['show','library','all'].includes(scope))throw Error('Invalid page cleanup preference');return {...normalize(current),[key]:scope};}
const groups=Object.freeze({middle:['gallery','about','similar','reviews'],sidebar:['otherSidebar','achievements','stats','howLongToBeat','controller','requirements','languages']});
function normalizeOrder(value){
 const result={middle:null,sidebar:null};if(value===undefined)return result;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(groups,key)))throw Error('Invalid section order');
 for(const key of Object.keys(groups)){const order=value[key];if(order===null||order===undefined)continue;if(!Array.isArray(order)||order.length!==groups[key].length||new Set(order).size!==order.length||order.some(section=>!groups[key].includes(section)))throw Error('Invalid section order');result[key]=[...order];}return result;
}
function changeOrder(value,group,order){if(!Object.hasOwn(groups,group))throw Error('Invalid section order');return normalizeOrder({...normalizeOrder(value),[group]:order});}
module.exports={sections,defaults,normalize,change,groups,normalizeOrder,changeOrder};
