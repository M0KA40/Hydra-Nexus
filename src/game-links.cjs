'use strict';
function baseTitle(value){return String(value||'').normalize('NFKC').replace(/[™®©]/g,'').replace(/\s*[-–:]?\s*(?:ultimate|digital deluxe|deluxe|gold|complete|definitive|standard|special|collector'?s|game of the year|goty)(?:\s+edition)?\s*$/i,'').replace(/\s+/g,' ').trim();}
const normalized=value=>baseTitle(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function findGame(game,catalog){
  const valid=catalog.filter(g=>typeof g?.domain_name==='string'&&/^[a-z\d-]+$/i.test(g.domain_name));
  let candidates=game.shop==='steam'?valid.filter(g=>g.steam_app_id!=null&&String(g.steam_app_id)===String(game.objectId)):[];
  if(!candidates.length){const raw=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[™®©]/g,'').replace(/[^\p{L}\p{N}]/gu,'');candidates=valid.filter(g=>raw(g.name)===raw(game.title));}
  if(!candidates.length)candidates=valid.filter(g=>normalized(g.name)===normalized(game.title));
  const domains=[...new Set(candidates.map(g=>g.domain_name))];return domains.length===1?domains[0]:null;
}
const supplemental=[
  {name:'Control',domain_name:'control',steam_app_id:'870780',source:'https://www.nexusmods.com/games/control'},
  {name:'Control Resonant',domain_name:'controlresonant',steam_app_id:'3669870',source:'https://www.nexusmods.com/games/controlresonant/mods'},
  {name:"Castlevania: Belmont's Curse",domain_name:'castlevaniabelmontscurse',source:'https://www.nexusmods.com/castlevaniabelmontscurse/mods/75'}
];
module.exports={baseTitle,normalized,findGame,supplemental};
