// Pure presentation queries: never authorize or resolve an action.
import { BOARD_SIZE, abilityDefinitions, abilityTargets, clearAbilityLOS, abilityRangeContains, previewAbility } from '../combat-core.mjs?v=20261004-hammer1';

export function abilityOverlay(combat, unitId, abilityId, targetId = null) {
  const unit = combat?.units.find(candidate => candidate.id === unitId);
  const ability = abilityDefinitions()[abilityId];
  const empty = { range: [], targets: [], effect: [] };
  if (!unit?.alive || combat.phase !== 'active' || combat.order[combat.turnIndex] !== unitId || ability?.championId !== unit.championId) return empty;
  const targets = abilityTargets(combat, unitId, abilityId);
  const range = [];
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
    if (!abilityRangeContains(unit, abilityId, {x,y})) continue;
    range.push({ x, y, blocked: ability.los === true && !clearAbilityLOS(combat, unit, { x, y }) });
  }
  const target = targets.includes(targetId) ? [...combat.units,...combat.objects].find(candidate => candidate.id === targetId) : null;
  // Every currently enabled ability affects exactly one unit/cell. Future AoE
  // abilities must supply their own verified geometry when they are enabled.
  const result = { range, targets, effect: target ? [{ x: target.x, y: target.y }] : [] };
  if (target && (ability.forced||ability.jump)) result.forced = previewAbility(combat, {unitId,abilityId,targetId});
  return result;
}
