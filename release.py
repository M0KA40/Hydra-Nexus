"""Package the tested installer and intentionally selected repository sources."""
from pathlib import Path
import hashlib,re,zipfile,json
root=Path(__file__).resolve().parent
version=re.search(r"version:'([^']+)'",(root/'src/brand.cjs').read_text(encoding='utf8')).group(1)
revision=int(re.search(r'revision:(\d+)',(root/'src/brand.cjs').read_text(encoding='utf8')).group(1))
notes=(root/f'docs/releases/{version}.md').read_text(encoding='utf8')
assert f'<!-- HYDRA_NEXUS_REVISION {revision} -->' in notes, 'Release notes must match the exact installer revision'
assert not re.search(r'[\u0600-\u06ff]',re.sub(r'^\[English\].*, 'Public release notes must be English only'
out=root/'dist'
manifest=json.loads((root/'release-files.json').read_text(encoding='utf8'))
if not isinstance(manifest,list) or len(manifest)!=len(set(manifest)):raise SystemExit('Invalid release file manifest')
files=[]
for relative in manifest:
    if not isinstance(relative,str) or not relative or '\\' in relative or ':' in relative or any(part in ('','.','..') for part in relative.split('/')):raise SystemExit('Unsafe release source path')
    file=root/relative
    if not file.is_file() or any(p.is_symlink() for p in [file,*file.parents] if p!=root and root in p.parents) or root.resolve() not in file.resolve().parents:raise SystemExit('Missing or linked release source: '+relative)
    if any(part.startswith('audit-') for part in file.relative_to(root).parts):raise SystemExit('Private audit files cannot be packaged')
    files.append(file)
required={p.relative_to(root).as_posix() for p in (root/'src').rglob('*') if p.is_file() and p.suffix in ('.js','.cjs')}
if not required.issubset(manifest):raise SystemExit('Runtime source is missing from release manifest')
with zipfile.ZipFile(out/f'Hydra-Nexus-{version}-source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(set(files)):
        entry=zipfile.ZipInfo('Hydra-Nexus/'+file.relative_to(root).as_posix(),date_time=(2020,1,1,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.create_system=3
        entry.external_attr=0o100644<<16
        archive.writestr(entry,file.read_bytes(),compresslevel=9)
content=(root/'src/release-content.cjs').read_text(encoding='utf8')
pack=json.loads(content.split('module.exports=',1)[1].strip().removesuffix(';'))
assert pack['schema']==1 and pack['version']==version and pack['revision']==revision
assert set(pack['notes'])=={'en','pt-BR','es','ru','ar','fr','de','tr','pl'}
for language,text in pack['notes'].items():
    assert text.strip() and text==(root/f'docs/releases/{version}/{language}.md').read_text(encoding='utf8'), 'Release translations differ'
import shutil
shutil.copy2(out/'Hydra_Nexus_Setup.exe',out/f'Hydra_Nexus_{version}.exe')
notes_name=f'Hydra-Nexus-{version}-release-notes.json'
(out/notes_name).write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
names=['Hydra_Nexus_2.2.exe','Hydra_Nexus.bat',f'Hydra-Nexus-{version}-source.zip',notes_name]
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((out/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in names),encoding='utf8')
assert f':: HYDRA_NEXUS_RELEASE {version}\r\n'.encode() in (out/'Hydra_Nexus.bat').read_bytes()[:160]
print('Packaged Hydra Nexus '+version)
, '', notes, flags=re.M)), 'Public release notes must be English only'
out=root/'dist'
manifest=json.loads((root/'release-files.json').read_text(encoding='utf8'))
if not isinstance(manifest,list) or len(manifest)!=len(set(manifest)):raise SystemExit('Invalid release file manifest')
files=[]
for relative in manifest:
    if not isinstance(relative,str) or not relative or '\\' in relative or ':' in relative or any(part in ('','.','..') for part in relative.split('/')):raise SystemExit('Unsafe release source path')
    file=root/relative
    if not file.is_file() or any(p.is_symlink() for p in [file,*file.parents] if p!=root and root in p.parents) or root.resolve() not in file.resolve().parents:raise SystemExit('Missing or linked release source: '+relative)
    if any(part.startswith('audit-') for part in file.relative_to(root).parts):raise SystemExit('Private audit files cannot be packaged')
    files.append(file)
required={p.relative_to(root).as_posix() for p in (root/'src').rglob('*') if p.is_file() and p.suffix in ('.js','.cjs')}
if not required.issubset(manifest):raise SystemExit('Runtime source is missing from release manifest')
with zipfile.ZipFile(out/f'Hydra-Nexus-{version}-source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for file in sorted(set(files)):
        entry=zipfile.ZipInfo('Hydra-Nexus/'+file.relative_to(root).as_posix(),date_time=(2020,1,1,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.create_system=3
        entry.external_attr=0o100644<<16
        archive.writestr(entry,file.read_bytes(),compresslevel=9)
content=(root/'src/release-content.cjs').read_text(encoding='utf8')
pack=json.loads(content.split('module.exports=',1)[1].strip().removesuffix(';'))
assert pack['schema']==1 and pack['version']==version and pack['revision']==revision
assert set(pack['notes'])=={'en','pt-BR','es','ru','ar','fr','de','tr','pl'}
for language,text in pack['notes'].items():
    assert text.strip() and text==(root/f'docs/releases/{version}/{language}.md').read_text(encoding='utf8'), 'Release translations differ'
import shutil
shutil.copy2(out/'Hydra_Nexus_Setup.exe',out/f'Hydra_Nexus_{version}.exe')
notes_name=f'Hydra-Nexus-{version}-release-notes.json'
(out/notes_name).write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
names=['Hydra_Nexus_2.2.exe','Hydra_Nexus.bat',f'Hydra-Nexus-{version}-source.zip',notes_name]
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((out/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in names),encoding='utf8')
assert f':: HYDRA_NEXUS_RELEASE {version}\r\n'.encode() in (out/'Hydra_Nexus.bat').read_bytes()[:160]
print('Packaged Hydra Nexus '+version)
