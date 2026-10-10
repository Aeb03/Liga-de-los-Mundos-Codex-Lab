import { ProtocolError } from './protocol.mjs';
export const BOT_SKILLS = {
  arfeli:['sword','daggers','bow','shield'], coloso:['rock','stonearmor','absorb','quake'],
  piplus:['precise','vector','interference','rupture'], onod:['thorn','vines','sap','reabsorption'],
  korgan:['shot','grenade','hook','trap_mine'], houngan:['needle','ritual','curse','dance'],
};
export function normalizeLayout(layout) {
  const ids=Object.keys(layout??{}).length===2?['A1','B1']:['A1','A2','B1','B2'];
  if (!layout || Object.keys(layout).length!==ids.length || ids.some(id=>!layout[id])) throw new ProtocolError('INVALID_LAYOUT','Configuración incompleta');
  const out={};
  for(const id of ids){
    const value=layout[id],group=value.controller;
    if(!['ai',id,id[0]+'1'].includes(group)||id==='A1'&&group!=='A1') throw new ProtocolError('INVALID_LAYOUT','Un jugador sólo controla su equipo');
    if(group!==id&&group!=='ai'&&layout[group]?.controller!==group) throw new ProtocolError('INVALID_LAYOUT','El controlador debe ser un jugador');
    const champion=value.championId??(id.endsWith('1')?'arfeli':'coloso');
    if(group==='ai'&&!BOT_SKILLS[champion]) throw new ProtocolError('INVALID_SELECTION','Campeón IA inválido');
    out[id]={controller:group,...(group==='ai'?{championId:champion,skills:BOT_SKILLS[champion]}:{})};
  }
  for(const team of ['A','B'])if(out[team+'1'].controller==='ai'&&out[team+'2']?.controller==='ai'&&out[team+'1'].championId===out[team+'2'].championId)throw new ProtocolError('DUPLICATE_CHAMPION','Dos IA del mismo equipo no pueden repetir campeón');
  return out;
}
