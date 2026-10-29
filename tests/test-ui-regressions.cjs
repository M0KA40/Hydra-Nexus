'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','src');
const nexus=fs.readFileSync(path.join(root,'nexus-ui.js'),'utf8');
const workspace=fs.readFileSync(path.join(root,'workspace-ui.js'),'utf8');
const checks=[
  ['settings form drafts are captured',/function captureForm\(\)\{\s*capturePlugin\(\);\s*if\(!section\)return;[\s\S]*?formDrafts\[el\.id\]=el\.value/],
  ['expanded settings sections survive rerenders',/formDrafts\.details\[section\.dataset\.nexusSection\]=\[\.\.\.section\.querySelectorAll\('details'\)\]\.map\(el=>el\.open\)/],
  ['settings drafts are restored after rerender',/Object\.hasOwn\(formDrafts,el\.id\)\)el\.value=formDrafts\[el\.id\]/],
  ['the updater retries an update request after an unrelated action',/function continueInstall\(\)\{if\(pendingInstall&&!busy&&section&&selected==='updater'\)\{pendingInstall=false;act\('installUpdate'\);}}/],
  ['the update notice records the install intent before opening settings',/pendingInstall=true;if\(document\.getElementById\('nexus-settings-group'\)\)openSection\('updater'\)/],
  ['only the update check button shows its own busy label',/activeAction==='checkUpdates'\?tr\("Checking…"\):tr\("Check for updates"\)/],
  ['stale hardware comparison responses cannot replace a newer dialog',/if\(modal!==loading\|\|key\(\)!==k\)return;/],
  ['dialogs restore focus to the opener',/const previous=modalReturn;modal\?\.remove\(\);modal=null;modalReturn=null;if\(previous\?\.isConnected\)previous\.focus\(\{preventScroll:true\}\);/],
  ['keyboard focus remains inside open dialogs',/e\.key==='Tab'[\s\S]*?getClientRects\(\)\.length[\s\S]*?list\.at\(-1\)\?\.focus\(\)[\s\S]*?list\[0\]\?\.focus\(\)/],
  // 2.2 fix: Home discovery must reach the bounded Steam feed. The renderer used to
  // read window.__nexusDiscovery while nothing defined it, so every launch fell back
  // to Hydra categories behind a "Steam is unavailable" banner.
  ['home discovery is wired to the Steam feed action',/window\.__nexusDiscovery=\{load:options=>request\('discoveryFeed',options\|\|\{\}\)\}/],
  ['a hidden tray window reports itself to the stylesheet',/document\.documentElement\.dataset\.nexusWindow=state\?\.visible===false\?'hidden':'active'/]
];
for(const [name,pattern] of checks)assert.match(nexus+'\n'+workspace,pattern,name);
const quiet=fs.readFileSync(path.join(root,'interface-quiet.css'),'utf8');
assert.match(quiet,/html\[data-nexus-window=hidden\][^{]*\{animation-play-state:paused!important/,'hidden windows suspend compositor animation work');
console.log('PASS: UI regression contract retains settings drafts, update retry, per-action busy labels, stale-dialog rejection, discovery wiring, hidden-window suspension and dialog focus containment.');
