// Preserve the native full achievement page, comparison filters and all data sources.
function HydraNexusAchievementsSurface({children,...props}){
  const R=reactExports$1,design=useHydraNexusInterface(),context=R.useContext(gameDetailsContext),{library}=useLibrary$1();
  const active=design==='quiet'&&Array.isArray(library)&&library.some(game=>game.shop===context.shop&&String(game.objectId)===String(context.objectId));
  return R.createElement('div',{...props,'data-nexus-library-achievements':active?'':undefined},children);
}
if(typeof module!=='undefined')module.exports={HydraNexusAchievementsSurface};
