import {abilityDefinitions,abilityRangeContains,abilityLOSBlocked,clearAbilityLOS,abilityTargets} from '../combat-core.mjs?v=20261009-deploy1';
export const briefErrors={INSUFFICIENT_PA:'PA insuficientes',BLOCKED_LOS:'Sin línea de visión',OUT_OF_RANGE:'Fuera de alcance',ABILITY_LIMIT:'Límite de usos alcanzado',INVALID_TARGET:'Objetivo no válido',INVALID_POSITION:'Casilla no válida',DEPLOYMENT_EXPIRED:'Terminó el despliegue',PILLAR_UNAVAILABLE:'No podés crear otro Pilar',SELECTION_EXPIRED:'Terminó la selección'};
export function actionBlockReason(combat,unit,id,cell=null){
 if(!combat||!unit)return 'Acción no disponible';
 const def=abilityDefinitions()[id],cost=id==='createPillar'?1:id==='fusion'?3:id==='germinate'?1:def?.cost??0;
 if(unit.pa<cost)return 'PA insuficientes';
 if(def?.maxUses&&(unit.skillUsesThisTurn?.[id]??0)>=def.maxUses)return 'Límite de usos alcanzado';
 if(id==='createPillar'){
  if(unit.colosoPillarCreatedThisTurn)return 'Ya invocaste un Pilar este turno';
  if(combat.objects.filter(o=>o.alive&&o.ownerId===unit.id&&o.type==='pillar').length>=(unit.monolith?3:2))return 'Máximo de Pilares alcanzado';
 }
 if(!cell)return null;
 const target=[...combat.units,...combat.objects].find(t=>t.alive&&t.x===cell.x&&t.y===cell.y);
 if(['collapse','absorb'].includes(id)&&target?.type==='pillar'&&target.ownerId===unit.id&&target.createdByColosoTurn===unit.colosoTurnSerial)return 'Pilar invocado este turno';
 if(id==='absorb'&&unit.hp===unit.maxHp)return 'Vida completa';
 const radius=id==='createPillar'?(unit.monolith?5:3):id==='germinate'?3:null;
 if(radius!=null&&Math.abs(unit.x-cell.x)+Math.abs(unit.y-cell.y)>radius)return 'Fuera de alcance';
 if(radius!=null&&!clearAbilityLOS(combat,unit,cell))return 'Sin línea de visión';
 if(def){
  if(abilityTargets(combat,unit.id,id).includes(target?.id))return null;
  if(!abilityRangeContains(unit,id,cell)&&!['quake','awakening','spores','reabsorption'].includes(id))return 'Fuera de alcance';
  if(def.los&&abilityLOSBlocked(combat,unit,id,target??cell))return 'Sin línea de visión';
 }
 return 'Objetivo no válido';
}
