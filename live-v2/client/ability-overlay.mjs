// Pure presentation queries: never authorize or resolve an action.
import { BOARD_SIZE, abilityDefinitions, abilityTargets, clearAbilityLOS, abilityRangeContains, previewAbility, collapseCells, magnetismTargets } from '../combat-core.mjs?v=20261004-champions1';

export function abilityOverlay(combat, unitId, abilityId, targetId = null, context = {}) {
  const unit = combat?.units.find(candidate => candidate.id === unitId);
  const ability = abilityDefinitions()[abilityId];
  const empty = { range: [], targets: [], effect: [] };
  if (!unit?.alive || combat.phase !== 'active' || combat.order[combat.turnIndex] !== unitId || ability?.championId !== unit.championId) return empty;
  const targets = abilityTargets(combat, unitId, abilityId);
  const range = [];
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
    if (!(abilityId==='quake'&&unit.monolith ? [unit,...combat.objects.filter(p=>p.alive&&p.ownerId===unit.id)].some(p=>Math.max(Math.abs(p.x-x),Math.abs(p.y-y))===1) : abilityRangeContains(unit, abilityId, {x,y}))) continue;
    range.push({ x, y, blocked: ability.los === true && !clearAbilityLOS(combat, unit, { x, y }) });
  }
  const target = targets.includes(targetId) ? [...combat.units,...combat.objects].find(candidate => candidate.id === targetId) : null;
  // Every currently enabled ability affects exactly one unit/cell. Future AoE
  // abilities must supply their own verified geometry when they are enabled.
  const result = { range, targets, effect: target ? [{ x: target.x, y: target.y }] : [] };
  if(target&&abilityId==='collapse'){result.range=[{x:target.x+1,y:target.y},{x:target.x-1,y:target.y},{x:target.x,y:target.y+1},{x:target.x,y:target.y-1}].filter(p=>p.x>=0&&p.y>=0&&p.x<12&&p.y<12);result.targets=[];result.effect=context.direction?collapseCells(target,context.direction):[];}
  if(target&&abilityId==='magnetism'){result.targets=magnetismTargets(combat,unitId,targetId);result.range=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(Math.abs(x-target.x)+Math.abs(y-target.y)>0&&Math.abs(x-target.x)+Math.abs(y-target.y)<=5)result.range.push({x,y});result.effect=[];if(result.targets.includes(context.secondaryTargetId)){const t=combat.units.find(u=>u.id===context.secondaryTargetId);result.effect=[{x:t.x,y:t.y}];result.forced=previewAbility(combat,{unitId,abilityId,targetId,secondaryTargetId:context.secondaryTargetId});}}
  if (target && (ability.forced||ability.jump)) result.forced = previewAbility(combat, {unitId,abilityId,targetId});
  return result;
}
