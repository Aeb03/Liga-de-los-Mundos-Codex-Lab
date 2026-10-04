// Pure presentation queries: never authorize or resolve an action.
import { BOARD_SIZE, abilityDefinitions, abilityTargets, clearAbilityLOS } from '../combat-core.mjs?v=20261003-daggers1';

export function abilityOverlay(combat, unitId, abilityId, targetId = null) {
  const unit = combat?.units.find(candidate => candidate.id === unitId);
  const ability = abilityDefinitions()[abilityId];
  const empty = { range: [], targets: [], effect: [] };
  if (!unit?.alive || combat.phase !== 'active' || combat.order[combat.turnIndex] !== unitId || ability?.championId !== unit.championId) return empty;
  const targets = abilityTargets(combat, unitId, abilityId);
  const radius = abilityId === 'rock' && unit.monolith ? ability.range + 1 : ability.range;
  const range = [];
  for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
    const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y);
    if (radius === 0 ? distance !== 0 : distance === 0 || distance > radius) continue;
    range.push({ x, y, blocked: radius > 1 && !clearAbilityLOS(combat, unit, { x, y }) });
  }
  const target = targets.includes(targetId) ? combat.units.find(candidate => candidate.id === targetId) : null;
  // Every currently enabled ability affects exactly one unit/cell. Future AoE
  // abilities must supply their own verified geometry when they are enabled.
  return { range, targets, effect: target ? [{ x: target.x, y: target.y }] : [] };
}
