// Pure presentation queries: never authorize or resolve an action.
import { BOARD_SIZE, abilityDefinitions, abilityTargets, clearAbilityLOS, abilityRangeContains, previewAbility, collapseCells, magnetismTargets, impulseDestinations, piplusMarkTargets, abilityLOSBlocked, germinateDestinations, onodActionTargets, vinesDestinations, onodEffectCells, korganTrapDestinations, korganGrenadeDestinations, korganGrenadeCells, hunterStepDestinations, korganDisarmTargets } from '../combat-core.mjs?v=20261004-korgan1';

export function abilityOverlay(combat, unitId, abilityId, targetId = null, context = {}) {
  const unit = combat?.units.find(candidate => candidate.id === unitId);
  const ability = abilityDefinitions()[abilityId];
  const empty = { range: [], targets: [], effect: [] };
  if(unit?.alive&&unit.championId==='korgan'&&combat.phase==='active'&&combat.order[combat.turnIndex]===unitId){
    if(abilityId==='korganDisarm'){const targets=korganDisarmTargets(combat,unitId),trap=combat.traps.find(t=>t.id===targetId&&targets.includes(t.id));return {range:[],targets,effect:trap?[{x:trap.x,y:trap.y}]:[]};}
    if(['trap_spikes','trap_mine'].includes(abilityId)){const range=korganTrapDestinations(combat,unitId,abilityId),p=context.position,valid=p&&range.some(c=>c.x===p.x&&c.y===p.y);return {range,targets:[],effect:valid?[p]:[]};}
    if(abilityId==='grenade'){const range=korganGrenadeDestinations(combat,unitId),p=context.position,valid=p&&range.some(c=>c.x===p.x&&c.y===p.y);return {range,targets:[],effect:valid?korganGrenadeCells(p):[],...(valid?{forced:previewAbility(combat,{unitId,abilityId,position:p})}:{})};}
    if(abilityId==='hunterstep'){const range=hunterStepDestinations(combat,unitId),p=context.position,valid=p&&range.some(c=>c.x===p.x&&c.y===p.y);return {range,targets:[],effect:valid?[p]:[],...(valid?{forced:previewAbility(combat,{unitId,abilityId,position:p})}:{})};}
    if(abilityId==='hook'){const targets=abilityTargets(combat,unitId,abilityId),target=combat.units.find(t=>t.id===targetId&&targets.includes(t.id)),range=[];for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){const d=Math.abs(x-unit.x)+Math.abs(y-unit.y);if(d>=1&&d<=3)range.push({x,y,blocked:!clearAbilityLOS(combat,unit,{x,y})});}const result={range,targets,effect:target?[{x:target.x,y:target.y}]:[]};if(target&&[1,2].includes(context.distance))result.forced=previewAbility(combat,{unitId,abilityId,targetId:target.id,distance:context.distance});return result;}
  }
  if(unit?.alive&&unit.championId==='onod'&&combat.phase==='active'&&combat.order[combat.turnIndex]===unitId){
    if(abilityId==='germinate'){const range=germinateDestinations(combat,unitId),p=context.position;return {range,targets:[],effect:p&&range.some(c=>c.x===p.x&&c.y===p.y)?[p]:[]};}
    if(abilityId==='wither'){const targets=onodActionTargets(combat,unitId,'wither'),t=combat.objects.find(s=>s.id===targetId&&targets.includes(s.id));return {range:[],targets,effect:t?[{x:t.x,y:t.y}]:[]};}
  }
  if(unit?.alive&&combat.phase==='active'&&combat.order[combat.turnIndex]===unitId&&abilityId==='piplusMark'&&unit.championId==='piplus'){const targets=piplusMarkTargets(combat,unitId),range=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++){const d=Math.abs(x-unit.x)+Math.abs(y-unit.y);if(d>=1&&d<=4)range.push({x,y,blocked:!clearAbilityLOS(combat,unit,{x,y})});}const t=targets.includes(targetId)?combat.units.find(t=>t.id===targetId):null;return {range,targets,effect:t?[{x:t.x,y:t.y}]:[]};}
  if (!unit?.alive || combat.phase !== 'active' || combat.order[combat.turnIndex] !== unitId || ability?.championId !== unit.championId) return empty;
  if(unit.championId==='onod'){
    const targets=abilityTargets(combat,unitId,abilityId),valid=targets.includes(targetId),command={unitId,abilityId,targetId,position:context.position};
    if(abilityId==='vines'){const range=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(abilityRangeContains(unit,abilityId,{x,y}))range.push({x,y,blocked:!clearAbilityLOS(combat,unit,{x,y})});const ok=vinesDestinations(combat,unitId).some(p=>p.x===context.position?.x&&p.y===context.position?.y);return {range,targets:[],effect:ok?onodEffectCells(combat,command):[],...(ok?{forced:previewAbility(combat,command)}:{})};}
    if(['spores','awakening','reabsorption'].includes(abilityId)){const selected=abilityId==='awakening'&&targets.length?{...command,targetId:unit.id}:command;const show=abilityId==='awakening'?targets.length:valid;return {range:[],targets,effect:show?onodEffectCells(combat,selected):[],...(valid?{forced:previewAbility(combat,command)}:{})};}
  }
  if(abilityId==='impulse'){const range=impulseDestinations(combat,unitId),valid=context.position&&range.some(p=>p.x===context.position.x&&p.y===context.position.y);return {range,targets:[],effect:valid?[context.position]:[],...(valid?{forced:previewAbility(combat,{unitId,abilityId,position:context.position})}:{})};}
  const targets = abilityTargets(combat, unitId, abilityId);
  const range = [];
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
    if (!(abilityId==='quake'&&unit.monolith ? [unit,...combat.objects.filter(p=>p.alive&&p.ownerId===unit.id)].some(p=>Math.max(Math.abs(p.x-x),Math.abs(p.y-y))===1) : abilityRangeContains(unit, abilityId, {x,y}))) continue;
    const entity=[...combat.units,...combat.objects].find(t=>t.alive&&t.x===x&&t.y===y);
    if(['interference','rupture','fixation'].includes(abilityId)&&entity?.id!==unit.markedTargetId)continue;
    range.push({ x, y, blocked: abilityLOSBlocked(combat, unit, abilityId, entity??{ x, y }) });
  }
  const target = targets.includes(targetId) ? [...combat.units,...combat.objects].find(candidate => candidate.id === targetId) : null;
  // Effect geometry and forced routes come from the same pure authority simulation.
  const result = { range, targets, effect: target ? [{ x: target.x, y: target.y }] : [] };
  if(target&&abilityId==='collapse'){result.range=[{x:target.x+1,y:target.y},{x:target.x-1,y:target.y},{x:target.x,y:target.y+1},{x:target.x,y:target.y-1}].filter(p=>p.x>=0&&p.y>=0&&p.x<12&&p.y<12);result.targets=[];result.effect=context.direction?collapseCells(target,context.direction):[];}
  if(target&&abilityId==='magnetism'){result.targets=magnetismTargets(combat,unitId,targetId);result.range=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(Math.abs(x-target.x)+Math.abs(y-target.y)>0&&Math.abs(x-target.x)+Math.abs(y-target.y)<=5)result.range.push({x,y});result.effect=[];if(result.targets.includes(context.secondaryTargetId)){const t=combat.units.find(u=>u.id===context.secondaryTargetId);result.effect=[{x:t.x,y:t.y}];result.forced=previewAbility(combat,{unitId,abilityId,targetId,secondaryTargetId:context.secondaryTargetId});}}
  if (target && (ability.forced||ability.jump||['precise','interference','rupture','fixation','thorn','sap'].includes(abilityId))) result.forced = previewAbility(combat, {unitId,abilityId,targetId});
  return result;
}
