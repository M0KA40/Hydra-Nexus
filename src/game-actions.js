function orderNexusGameActions(host){
 if(!host)return;const ids=['hsb-floating-widget','nexus-notes-action','nexus-mods-action'];
 if(!document.getElementById('nexus-game-actions-order')){const style=document.createElement('style');style.id='nexus-game-actions-order';style.textContent=ids.map((id,index)=>'.hero-panel__actions>#'+id+'{order:'+(100+index)+'}').join('');document.head.append(style);}
 const owned=ids.map(id=>[...host.children].find(node=>node.id===id)).filter(Boolean),children=[...host.children],tail=children.slice(-owned.length);if(!owned.length||owned.every((node,index)=>tail[index]===node))return;
 const focus=document.activeElement;for(const node of owned)host.append(node);if(owned.some(node=>node===focus||node.contains(focus)))focus.focus({preventScroll:true});
}
if(typeof window!=='undefined')window.__nexusOrderGameActions=orderNexusGameActions;
if(typeof module!=='undefined')module.exports=orderNexusGameActions;
