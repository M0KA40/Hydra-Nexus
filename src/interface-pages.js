// Preserve the native Library collection and virtual rows; no extra recent-games section.
function HydraNexusLibrarySurface({nexusGames,children,...nativeProps}){
  return reactExports$1.createElement('section',nativeProps,children);
}
function HydraNexusLibraryCard({nexusTitle,children,...nativeProps}){
  const R=reactExports$1,design=useHydraNexusInterface();
  return R.createElement('button',nativeProps,...R.Children.toArray(children),design==='quiet'?R.createElement('span',{className:'nexus-library-cover-caption',key:'nexus-cover-caption'},nexusTitle):null);
}
if(typeof module!=='undefined')module.exports={HydraNexusLibrarySurface,HydraNexusLibraryCard};
