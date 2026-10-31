'use strict';
// The Quiet interface keeps every translucent surface but bounds the blur radius: a
// large backdrop-filter is re-composited for each overlapping panel, and the visual
// difference between 24px and 10px is negligible next to the frame cost.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const budgets={'interface-navigation.css':10,'interface-polish.css':8,'interface-discovery.css':8,'interface-game.css':8};
let declarations=0,total=0;
for(const [name,budget] of Object.entries(budgets)){
  const css=fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
  const radii=[...css.matchAll(/backdrop-filter:\s*blur\((\d+)px\)/g)].map(match=>Number(match[1]));
  assert.ok(radii.length>0,name+' must keep its translucent surfaces');
  for(const radius of radii){
    assert.ok(radius<=budget,name+' declares blur('+radius+'px), above the '+budget+'px budget');
    declarations++;total+=radius;
  }
}
assert.equal(declarations,26,'all 26 Quiet-interface blur declarations are preserved');
assert.ok(total<=180,'combined blur radius stays within the reduced budget (currently '+total+'px)');
console.log('PASS: Quiet interface keeps all 26 translucent surfaces with per-surface blur within 10px and '+total+'px combined, down from 398px.');
