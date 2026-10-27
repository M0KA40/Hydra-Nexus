'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const brand=require('../src/brand.cjs'),pack=require('../src/release-content.cjs');
const announcement=require('../src/installed-release-content.cjs');
assert.equal(brand.version,'2.1.0');assert.equal(brand.revision,1);
assert.equal(pack.version,brand.version);assert.equal(pack.revision,brand.revision);
assert.equal(announcement.version,brand.version);assert.equal(announcement.revision,brand.revision);assert.equal(announcement.displayVersion,'2.0.0');
const files=JSON.parse(read('release-files.json'));
assert.equal(files.length,new Set(files).size);
for(const language of ['en','pt-BR','es','ru','ar','fr','de','tr','pl']){
 const name='docs/releases/'+brand.version+'/'+language+'.md';
 assert.ok(files.includes(name));assert.equal(read(name).replace(/\r\n/g,'\n'),pack.notes[language]);
 assert.ok(!/Nexus Quiet|local preview|unpublished draft/i.test(pack.notes[language]));
 assert.equal(announcement.notes[language],read('docs/releases/2.0.0/'+language+'.md').replace(/\r\n/g,'\n'),'in-app announcement remains exact 2.0');
 assert.equal(pack.notes[language],announcement.notes[language],'public patch notes remain exact 2.0 too');
}
for(const name of ['src/themes.cjs','src/nexus-ui.js','src/controller.cjs','src/native-ui.js','installer/native-ui.ps1','build.py']){
 assert.ok(!/Nexus Quiet|__nexusInterface|HydraNexusInterface|interface-quiet\.css|interface-ui\.js/.test(read(name)),name+': experimental theme must not ship');
}
assert.ok(!files.some(name=>/interface-quiet|interface-ui|test-interface|docs\/releases\/2\.0\.1/.test(name)));
const release=read('.github/workflows/release.yml');
assert.ok(release.includes("branches: ['release/2.1.0']"),'publishing pushes are restricted to the release branch');
assert.ok(release.includes("github.ref == 'refs/heads/release/2.1.0'"));
assert.ok(release.includes("github.event.head_commit.message == 'Release Hydra Nexus 2.1'"),'only the explicit publication commit may publish');
assert.ok(release.includes("github.event.inputs.confirm == 'publish-2.1'"));
assert.equal((release.match(/--latest=false/g)||[]).length,2,'both draft creation and publication preserve Latest');
assert.equal((release.match(/\$latest -ne 'v2\.0\.0'/g)||[]).length,2,'check Latest before and after publication');
assert.ok(!/--clobber|--latest(?:\s|$)/m.test(release),'never overwrite assets or promote maintenance to Latest');
assert.ok(!read('CHANGELOG.md').includes('## 2.1'),'owner requested no separate 2.1 patch notes');
console.log('PASS: 2.1 release identity, nine-language notes, pre-theme scope, allowlist and explicit publication preserving 2.0 Latest.');
