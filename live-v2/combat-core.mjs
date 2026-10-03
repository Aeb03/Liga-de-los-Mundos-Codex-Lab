/** Liga de los Mundos LIVE v2 — isolated, deterministic combat vertical. */

export const BOARD_SIZE = 12;
export const CORE_VERSION = 1;
const DIRECTIONS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

export class CombatRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CombatRuleError';
    this.code = code;
  }
}

const DEFINITIONS = Object.freeze({
  arfeli: { name: 'Arfeli', hp: 100, pa: 6, pm: 3, initiative: 5 },
  coloso: { name: 'Coloso', hp: 115, pa: 6, pm: 3, initiative: 3 },
  piplus: { name: 'Piplus', hp: 90, pa: 6, pm: 3, initiative: 6 },
  onod: { name: 'Onod', hp: 95, pa: 6, pm: 3, initiative: 4 },
  korgan: { name: 'Korgan', hp: 100, pa: 6, pm: 4, initiative: 4 },
  houngan: { name: 'Hougan', hp: 90, pa: 6, pm: 3, initiative: 5 }
});

export function championDefinitions() {
  return structuredClone(DEFINITIONS);
}

function fail(code, message) {
  throw new CombatRuleError(code, message);
}
function key({ x, y }) { return `${x},${y}`; }
function inside(p) {
  return Number.isInteger(p?.x) && Number.isInteger(p?.y) && p.x >= 0 && p.y >= 0 && p.x < BOARD_SIZE && p.y < BOARD_SIZE;
}
function adjacent(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1; }
function clone(value) { return structuredClone(value); }

export function createUnit({ championId, id, team, slot, controllerId, position }) {
  const definition = DEFINITIONS[championId];
  if (!definition) fail('UNSUPPORTED_CHAMPION', `Campeón no soportado: ${championId}`);
  if (!id || !team || slot === undefined || !controllerId) fail('INVALID_UNIT_IDENTITY', 'id, team, slot y controllerId son obligatorios');
  if (!inside(position)) fail('INVALID_POSITION', 'La posición debe estar dentro del tablero 12×12');
  return {
    id, kind: 'champion', championId, name: definition.name, team, slot, controllerId,
    x: position.x, y: position.y, hp: definition.hp, maxHp: definition.hp,
    pa: definition.pa, maxPa: definition.pa, pm: definition.pm, maxPm: definition.pm,
    initiative: definition.initiative, alive: true, shield: [],
    status: { wound: 0, poison: 0, burn: 0, paPenaltyNext: 0, pmPenaltyNext: 0 },
    skillUsesThisTurn: {}, stoneArmorTargetsUsed: [], symbiosisUsed: false,
    sproutRemovedThisTurn: false, trapRemovedThisTurn: false,
    monolith: false, monolithStoredPm: 0, exitedMonolithThisTurn: false, monolithPillarGainUsed: false,
    masteryChain: [], masteryBonus: 0,
    colosoTurnSerial: 0, colosoCreateWindow: false, colosoPillarCreatedThisTurn: false, colosoRecycleUsed: false,
    piplusMarkUsedThisTurn: false, piplusMarkBlockedThisTurn: false, piplusFixationTargetId: null, piplusInterferenceTargets: [],
    onodTurnSerial: 0, onodGerminateUses: 0, onodWitherUsedThisTurn: false, onodReabsorptionUsedThisTurn: false,
    korganTurnSerial: 0, korganDisarmUsedThisTurn: false,
    houganPainTransfer: null, houganDance: null
  };
}

function validateSupportedState(state) {
  if (!state || state.schemaVersion !== CORE_VERSION) fail('UNSUPPORTED_STATE_VERSION', 'Versión de estado no soportada');
  if (state.traps?.length || state.summons?.length || state.objects?.length) {
    fail('UNSUPPORTED_MECHANIC', 'Trampas, invocaciones y objetos de combate están fuera de alcance en esta etapa');
  }
  if (!Array.isArray(state.units) || state.units.some(u => u.kind !== 'champion')) {
    fail('UNSUPPORTED_ENTITY', 'Sólo se admiten campeones en esta etapa');
  }
}

function chooseTie(units, random) {
  let value;
  if (typeof random === 'function') value = random();
  else value = random;
  if (typeof value !== 'number' || value < 0 || value >= 1) fail('RANDOM_REQUIRED', 'Un empate requiere azar explícito en [0, 1)');
  return { winner: value < 0.5 ? units[0] : units[1], value };
}

export function initializeCombat({ units, obstacles = [], random, clock }) {
  if (!Array.isArray(units) || units.length !== 2 || units[0].team === units[1].team) {
    fail('UNSUPPORTED_FORMAT', 'Esta vertical admite exactamente 1v1 entre equipos distintos');
  }
  const copy = clone(units);
  const occupied = new Set();
  for (const unit of copy) {
    if (unit.kind !== 'champion' || !DEFINITIONS[unit.championId]) fail('UNSUPPORTED_ENTITY', 'Sólo se admiten los seis campeones efectivos');
    if (!inside(unit) || occupied.has(key(unit))) fail('INVALID_POSITION', 'Posiciones de campeón inválidas o repetidas');
    occupied.add(key(unit));
  }
  const obstacleKeys = obstacles.map(p => {
    if (!inside(p) || occupied.has(key(p))) fail('INVALID_OBSTACLE', 'Obstáculo inválido u ocupado');
    return key(p);
  });
  if (new Set(obstacleKeys).size !== obstacleKeys.length) fail('INVALID_OBSTACLE', 'Hay obstáculos repetidos');
  const sorted = [...copy].sort((a, b) => b.initiative - a.initiative);
  let tieBreak = null;
  if (sorted[0].initiative === sorted[1].initiative) {
    const tie = chooseTie(copy, random);
    sorted.splice(0, 2, tie.winner, copy.find(u => u.id !== tie.winner.id));
    tieBreak = { candidates: copy.map(u => u.id), randomValue: tie.value, winnerId: tie.winner.id };
  }
  let state = {
    schemaVersion: CORE_VERSION, board: { width: BOARD_SIZE, height: BOARD_SIZE, obstacles: obstacleKeys.sort() },
    units: copy, objects: [], traps: [], summons: [], order: sorted.map(u => u.id), turnIndex: 0,
    round: 1, phase: 'active', winnerTeam: null, tieBreak,
    audit: { initializedAt: clock ?? null }
  };
  const begun = beginTurn(state);
  return { state: begun.state, events: [{ type: 'combat.initialized', order: state.order, tieBreak }, ...begun.events] };
}

function unitById(state, id) {
  const unit = state.units.find(candidate => candidate.id === id);
  if (!unit) fail('UNKNOWN_UNIT', `Unidad inexistente: ${id}`);
  return unit;
}
function activeUnit(state) { return unitById(state, state.order[state.turnIndex]); }
function occupiedKeys(state, movingId) {
  return new Set(state.units.filter(u => u.alive && u.id !== movingId).map(key));
}

export function movementAvailable(state, unitId = state.order[state.turnIndex]) {
  validateSupportedState(state);
  if (state.phase !== 'active') fail('COMBAT_ENDED', 'El combate ya terminó');
  const unit = unitById(state, unitId);
  if (!unit.alive) fail('UNIT_DEAD', 'Una unidad muerta no puede moverse');
  if (unit.id !== activeUnit(state).id) fail('NOT_ACTIVE_UNIT', 'Sólo puede moverse la unidad activa');
  if (unit.monolith) return [];
  const blocked = new Set([...state.board.obstacles, ...occupiedKeys(state, unit.id)]);
  const seen = new Map([[key(unit), 0]]), queue = [{ x: unit.x, y: unit.y }];
  while (queue.length) {
    const current = queue.shift(), distance = seen.get(key(current));
    if (distance >= unit.pm) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: current.x + dx, y: current.y + dy }, nextKey = key(next);
      if (!inside(next) || blocked.has(nextKey) || seen.has(nextKey)) continue;
      seen.set(nextKey, distance + 1);
      queue.push(next);
    }
  }
  seen.delete(key(unit));
  return [...seen].map(([tile, cost]) => { const [x, y] = tile.split(',').map(Number); return { x, y, cost }; });
}

export function calculatePath(state, unitId, destination) {
  const available = movementAvailable(state, unitId);
  if (!available.some(p => p.x === destination?.x && p.y === destination?.y)) fail('UNREACHABLE_DESTINATION', 'Destino no disponible con los PM actuales');
  const unit = unitById(state, unitId), blocked = new Set([...state.board.obstacles, ...occupiedKeys(state, unit.id)]);
  const start = { x: unit.x, y: unit.y }, queue = [start], previous = new Map([[key(start), null]]);
  while (queue.length) {
    const current = queue.shift();
    if (key(current) === key(destination)) break;
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: current.x + dx, y: current.y + dy }, nextKey = key(next);
      if (!inside(next) || blocked.has(nextKey) || previous.has(nextKey)) continue;
      previous.set(nextKey, current); queue.push(next);
    }
  }
  const path = [];
  for (let cursor = destination; cursor; cursor = previous.get(key(cursor))) path.push({ x: cursor.x, y: cursor.y });
  return path.reverse();
}

function validatePath(state, unit, path) {
  if (!Array.isArray(path) || path.length < 2 || key(path[0] ?? {}) !== key(unit)) fail('INVALID_PATH', 'El recorrido debe comenzar en la posición actual');
  if (path.length - 1 > unit.pm) fail('INSUFFICIENT_PM', 'PM insuficientes para el recorrido presentado');
  const blocked = new Set([...state.board.obstacles, ...occupiedKeys(state, unit.id)]), visited = new Set();
  for (let index = 0; index < path.length; index++) {
    const tile = path[index];
    if (!inside(tile) || visited.has(key(tile))) fail('INVALID_PATH', 'El recorrido sale del tablero o repite casillas');
    if (index > 0 && (!adjacent(path[index - 1], tile) || blocked.has(key(tile)))) fail('INVALID_PATH', 'El recorrido contiene un paso bloqueado o no ortogonal');
    visited.add(key(tile));
  }
}

export function previewPath(state, unitId, path) {
  validateSupportedState(state);
  const unit = unitById(state, unitId);
  if (state.phase !== 'active' || activeUnit(state).id !== unit.id || !unit.alive) fail('NOT_ACTIVE_UNIT', 'Sólo la unidad activa y viva puede moverse');
  if (unit.monolith) fail('IMMOBILIZED', 'Coloso en Monolito no puede moverse');
  validatePath(state, unit, path);
  const enemies = state.units.filter(other => other.alive && other.team !== unit.team && other.kind === 'champion');
  const tackle = [];
  for (let index = 1; index < path.length; index++) {
    const broken = enemies.filter(enemy => adjacent(path[index - 1], enemy) && !adjacent(path[index], enemy));
    if (broken.length) tackle.push({ step: index, enemyIds: broken.map(e => e.id), damage: broken.length * 2 });
  }
  const tackleDamage = tackle.reduce((sum, item) => sum + item.damage, 0);
  return { path: clone(path), destination: clone(path.at(-1)), cost: path.length - 1, tackle, tackleDamage, lethal: tackleDamage >= unit.hp };
}

export function resolvePath(state, unitId, path) {
  const preview = previewPath(state, unitId, path);
  if (preview.lethal) fail('LETHAL_TACKLE', 'El placaje acumulado sería mortal; se rechaza el recorrido completo');
  const next = clone(state), unit = unitById(next, unitId), events = [];
  for (const item of preview.tackle) {
    unit.hp -= item.damage;
    events.push({ type: 'damage.applied', targetId: unit.id, amount: item.damage, source: 'tackle', ignoreShield: true, enemyIds: item.enemyIds });
  }
  unit.x = preview.destination.x; unit.y = preview.destination.y; unit.pm -= preview.cost;
  if (unit.championId === 'coloso') unit.colosoCreateWindow = false;
  events.push({ type: 'unit.moved', unitId, path: preview.path, cost: preview.cost, remainingPm: unit.pm });
  return { state: next, events };
}

export function applyDamage(state, { targetId, amount, ignoreShield = false, source = 'external' }) {
  validateSupportedState(state);
  if (!Number.isFinite(amount) || amount < 0) fail('INVALID_DAMAGE', 'El daño debe ser un número no negativo');
  const next = clone(state), target = unitById(next, targetId);
  if (!target.alive) fail('UNIT_DEAD', 'No se puede dañar una unidad muerta');
  let remaining = amount, absorbed = 0;
  if (!ignoreShield) for (const stack of target.shield) {
    const used = Math.min(stack.amount, remaining); stack.amount -= used; remaining -= used; absorbed += used;
  }
  target.shield = target.shield.filter(stack => stack.amount > 0);
  const hpLost = Math.min(target.hp, remaining); target.hp -= hpLost;
  if (target.hp === 0) target.alive = false;
  const events = [{ type: 'damage.applied', targetId, amount, absorbed, hpLost, ignoreShield, source }];
  if (!target.alive) events.push({ type: 'unit.died', unitId: targetId });
  finishIfNeeded(next, events);
  return { state: next, events };
}

function expireSourceShields(state, sourceId, events) {
  for (const target of state.units) {
    const expired = target.shield.filter(s => s.sourceId === sourceId).reduce((sum, s) => sum + s.amount, 0);
    target.shield = target.shield.filter(s => s.sourceId !== sourceId && state.units.some(u => u.id === s.sourceId && u.alive));
    if (expired) events.push({ type: 'shield.expired', sourceId, targetId: target.id, amount: expired });
  }
}

function beginTurn(state) {
  const next = clone(state), events = [], unit = activeUnit(next);
  expireSourceShields(next, unit.id, events);
  const paPenalty = Math.max(0, unit.status.paPenaltyNext || 0), pmPenalty = Math.max(0, unit.status.pmPenaltyNext || 0);
  unit.pa = Math.max(0, unit.maxPa - paPenalty); unit.status.paPenaltyNext = 0;
  unit.pm = unit.monolith ? 0 : Math.max(0, unit.maxPm - pmPenalty); unit.status.pmPenaltyNext = 0;
  if (unit.monolith) unit.monolithStoredPm = unit.maxPm;
  Object.assign(unit, { exitedMonolithThisTurn: false, monolithPillarGainUsed: false, stoneArmorTargetsUsed: [], skillUsesThisTurn: {}, symbiosisUsed: false, sproutRemovedThisTurn: false, trapRemovedThisTurn: false });
  if (unit.championId === 'arfeli') Object.assign(unit, { masteryChain: [], masteryBonus: 0 });
  if (unit.championId === 'coloso') Object.assign(unit, { colosoTurnSerial: unit.colosoTurnSerial + 1, colosoCreateWindow: true, colosoPillarCreatedThisTurn: false, colosoRecycleUsed: false });
  if (unit.championId === 'piplus') Object.assign(unit, { piplusMarkUsedThisTurn: false, piplusMarkBlockedThisTurn: false, piplusFixationTargetId: null, piplusInterferenceTargets: [] });
  if (unit.championId === 'onod') Object.assign(unit, { onodTurnSerial: unit.onodTurnSerial + 1, onodGerminateUses: 0, onodWitherUsedThisTurn: false, onodReabsorptionUsedThisTurn: false });
  if (unit.championId === 'korgan') Object.assign(unit, { korganTurnSerial: unit.korganTurnSerial + 1, korganDisarmUsedThisTurn: false });
  if (unit.status.burn > 0) {
    const damage = unit.status.burn; unit.hp = Math.max(0, unit.hp - damage); unit.alive = unit.hp > 0;
    events.push({ type: 'damage.applied', targetId: unit.id, amount: damage, hpLost: damage, source: 'burn.start' });
  }
  events.push({ type: 'turn.started', unitId: unit.id, round: next.round, pa: unit.pa, pm: unit.pm });
  finishIfNeeded(next, events);
  return { state: next, events };
}

function finishIfNeeded(state, events) {
  const teams = [...new Set(state.units.filter(u => u.alive).map(u => u.team))];
  if (teams.length <= 1) {
    state.phase = 'ended'; state.winnerTeam = teams[0] ?? null;
    events.push({ type: 'combat.ended', winnerTeam: state.winnerTeam });
    return true;
  }
  return false;
}

export function endTurn(state, { unitId } = {}) {
  validateSupportedState(state);
  if (state.phase !== 'active') fail('COMBAT_ENDED', 'El combate ya terminó');
  const next = clone(state), events = [], unit = activeUnit(next);
  if (unitId && unitId !== unit.id) fail('NOT_ACTIVE_UNIT', 'La orden de cierre no corresponde a la unidad activa');
  if (unit.status.burn > 0) {
    const damage = Math.min(unit.hp, unit.status.burn); unit.hp -= damage; unit.alive = unit.hp > 0;
    events.push({ type: 'damage.applied', targetId: unit.id, amount: unit.status.burn, hpLost: damage, source: 'burn.end' });
  }
  for (const status of ['wound', 'poison', 'burn']) unit.status[status] = Math.floor(Math.max(0, unit.status[status] || 0) / 2);
  if (unit.championId === 'arfeli') Object.assign(unit, { masteryChain: [], masteryBonus: 0 });
  if (unit.championId === 'piplus') Object.assign(unit, { piplusFixationTargetId: null, piplusInterferenceTargets: [] });
  events.push({ type: 'turn.ended', unitId: unit.id, round: next.round });
  if (finishIfNeeded(next, events)) return { state: next, events };
  let attempts = 0;
  do {
    next.turnIndex++;
    if (next.turnIndex >= next.order.length) { next.turnIndex = 0; next.round++; }
    attempts++;
  } while (attempts <= next.order.length && !activeUnit(next).alive);
  const begun = beginTurn(next);
  return { state: begun.state, events: [...events, ...begun.events] };
}

export function serializeState(state) {
  validateSupportedState(state);
  return JSON.stringify(state);
}

export function restoreState(serialized) {
  let state;
  try { state = JSON.parse(serialized); } catch { fail('INVALID_SERIALIZATION', 'JSON de estado inválido'); }
  validateSupportedState(state);
  return clone(state);
}

export function executeCommand(state, command) {
  if (!command || typeof command.type !== 'string') fail('INVALID_COMMAND', 'Comando inválido');
  if (command.type === 'move') return resolvePath(state, command.unitId, command.path);
  if (command.type === 'endTurn') return endTurn(state, { unitId: command.unitId });
  fail('UNSUPPORTED_COMMAND', `Comando fuera de alcance: ${command.type}`);
}
