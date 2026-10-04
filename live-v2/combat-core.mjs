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
    arfeliMasteryChain: [], arfeliMasteryLastBonus: 0,
    colosoTurnSerial: 0, colosoCreateWindow: false, colosoPillarCreatedThisTurn: false, colosoRecycleUsed: false,
    piplusMarkUsedThisTurn: false, piplusMarkBlockedThisTurn: false, piplusFixationTargetId: null, piplusInterferenceTargets: [],
    onodTurnSerial: 0, onodGerminateUses: 0, onodWitherUsedThisTurn: false, onodGerminateBlockedThisTurn: false, onodReabsorptionUsedThisTurn: false,
    korganTurnSerial: 0, korganDisarmUsedThisTurn: false,
    houganPainTransfer: null, houganDance: null
  };
}

function nonNegativeInteger(value) { return Number.isInteger(value) && value >= 0; }
function validateSupportedState(state) {
  if (!state || typeof state !== 'object' || state.schemaVersion !== CORE_VERSION) fail('UNSUPPORTED_STATE_VERSION', 'Versión de estado no soportada');
  if (!state.board || state.board.width !== BOARD_SIZE || state.board.height !== BOARD_SIZE || !Array.isArray(state.board.obstacles)) {
    fail('INVALID_BOARD', 'El tablero debe ser 12×12 y contener una lista de obstáculos');
  }
  const obstacleSet = new Set();
  for (const obstacle of state.board.obstacles) {
    if (typeof obstacle !== 'string' || !/^\d+,\d+$/.test(obstacle)) fail('INVALID_BOARD', 'Formato de obstáculo inválido');
    const [x, y] = obstacle.split(',').map(Number);
    if (!inside({ x, y }) || obstacleSet.has(obstacle)) fail('INVALID_BOARD', 'Obstáculo fuera del tablero o repetido');
    obstacleSet.add(obstacle);
  }
  if (!Array.isArray(state.objects) || !Array.isArray(state.traps) || !Array.isArray(state.summons)) fail('INVALID_STATE', 'Faltan colecciones de entidades');
  if (state.traps.length || state.summons.length) {
    fail('UNSUPPORTED_MECHANIC', 'Trampas e invocaciones están fuera de alcance en esta etapa');
  }
  if (!Array.isArray(state.units) || state.units.length !== 2) fail('UNSUPPORTED_FORMAT', 'El estado soportado es exactamente 1v1');
  const ids = new Set(), positions = new Set(), teams = new Set(), teamSlots = new Set();
  for (const unit of state.units) {
    if (!unit || unit.kind !== 'champion' || !DEFINITIONS[unit.championId]) fail('UNSUPPORTED_ENTITY', 'Sólo se admiten los seis campeones efectivos');
    if (typeof unit.id !== 'string' || !unit.id || ids.has(unit.id)) fail('INVALID_UNIT_IDENTITY', 'Los IDs de unidad deben ser únicos y no vacíos');
    if (typeof unit.team !== 'string' || !unit.team || !nonNegativeInteger(unit.slot) || typeof unit.controllerId !== 'string' || !unit.controllerId) fail('INVALID_UNIT_IDENTITY', 'Equipo, slot y controlador inválidos');
    const teamSlot = `${unit.team}\0${unit.slot}`;
    if (teamSlots.has(teamSlot)) fail('INVALID_UNIT_IDENTITY', 'El slot debe ser único dentro del equipo');
    if (!inside(unit) || positions.has(key(unit)) || obstacleSet.has(key(unit))) fail('INVALID_POSITION', 'Posición de unidad inválida, repetida u obstruida');
    for (const field of ['hp', 'maxHp', 'pa', 'maxPa', 'pm', 'maxPm', 'initiative']) if (!nonNegativeInteger(unit[field])) fail('INVALID_RESOURCE', `Recurso inválido: ${field}`);
    if (unit.maxHp < 1 || unit.hp > unit.maxHp || unit.pa > unit.maxPa || unit.pm > unit.maxPm || typeof unit.alive !== 'boolean' || unit.alive !== (unit.hp > 0)) fail('INVALID_RESOURCE', 'Vida, recursos o marca alive inconsistentes');
    const statusFields = ['wound', 'poison', 'burn', 'paPenaltyNext', 'pmPenaltyNext'];
    if (!unit.status || statusFields.some(field => !nonNegativeInteger(unit.status[field]))) fail('INVALID_STATUS', 'Estado alterado inválido');
    if (unit.status.wound > 3) fail('INVALID_STATUS', 'Herida no puede superar 3');
    if (!Array.isArray(unit.shield)) fail('INVALID_SHIELD', 'Las pilas de escudo deben ser una lista');
    for (const stack of unit.shield) if (!stack || !Number.isInteger(stack.amount) || stack.amount <= 0 || typeof stack.sourceId !== 'string' || !stack.sourceId) fail('INVALID_SHIELD', 'Pila de escudo inválida');
    const requiredBooleans = [
      'monolith', 'exitedMonolithThisTurn', 'monolithPillarGainUsed', 'symbiosisUsed',
      'sproutRemovedThisTurn', 'trapRemovedThisTurn', 'colosoCreateWindow',
      'colosoPillarCreatedThisTurn', 'colosoRecycleUsed', 'piplusMarkUsedThisTurn',
      'piplusMarkBlockedThisTurn', 'onodWitherUsedThisTurn',
      'onodGerminateBlockedThisTurn', 'onodReabsorptionUsedThisTurn', 'korganDisarmUsedThisTurn'
    ];
    if (requiredBooleans.some(field => typeof unit[field] !== 'boolean')) fail('INVALID_CHAMPION_STATE', 'Falta un indicador requerido del campeón');
    const requiredCounters = ['monolithStoredPm', 'arfeliMasteryLastBonus', 'colosoTurnSerial', 'onodTurnSerial', 'onodGerminateUses', 'korganTurnSerial'];
    if (requiredCounters.some(field => !nonNegativeInteger(unit[field]))) fail('INVALID_CHAMPION_STATE', 'Falta un contador requerido del campeón');
    if (!Array.isArray(unit.arfeliMasteryChain) || !Array.isArray(unit.stoneArmorTargetsUsed) || !Array.isArray(unit.piplusInterferenceTargets) || !unit.skillUsesThisTurn || typeof unit.skillUsesThisTurn !== 'object' || Array.isArray(unit.skillUsesThisTurn)) fail('INVALID_CHAMPION_STATE', 'Colecciones de turno del campeón inválidas');
    if (Object.values(unit.skillUsesThisTurn).some(value => !nonNegativeInteger(value))) fail('INVALID_CHAMPION_STATE', 'Contador de habilidad inválido');
    if (unit.piplusFixationTargetId !== null && typeof unit.piplusFixationTargetId !== 'string') fail('INVALID_CHAMPION_STATE', 'Objetivo de fijación inválido');
    ids.add(unit.id); positions.add(key(unit)); teams.add(unit.team); teamSlots.add(teamSlot);
  }
  for (const object of state.objects) {
    if (!object || object.kind!=='object' || object.type!=='pillar') fail('UNSUPPORTED_MECHANIC','Sólo se admiten Pilares de Coloso');
    const owner=state.units.find(u=>u.id===object.ownerId);
    if (!owner || owner.championId!=='coloso' || object.team!==owner.team || object.id!==`pillar${object.number}` || ids.has(object.id)) fail('INVALID_OBJECT','Identidad o propietario del Pilar inválido');
    if (!inside(object) || !nonNegativeInteger(object.hp) || object.maxHp!==15 || object.hp>15 || object.alive!==(object.hp>0) || !Number.isInteger(object.number) || object.number<1 || object.blocksLOS!==true || !nonNegativeInteger(object.createdByColosoTurn)) fail('INVALID_OBJECT','Pilar inválido');
    if (!Array.isArray(object.shield) || object.shield.length) fail('INVALID_OBJECT','El escudo de Pilares aún no está habilitado');
    if (object.alive && (positions.has(key(object)) || obstacleSet.has(key(object)))) fail('INVALID_POSITION','Pilar en casilla ocupada');
    if(object.alive)positions.add(key(object));ids.add(object.id);
  }
  for(const owner of state.units)if(state.objects.filter(o=>o.alive&&o.ownerId===owner.id).length>2)fail('INVALID_OBJECT','Máximo dos Pilares activos');
  if (state.nextPillarId!==undefined && (!Number.isInteger(state.nextPillarId) || state.nextPillarId<1 || state.objects.some(o=>o.number>=state.nextPillarId))) fail('INVALID_OBJECT','Secuencia de Pilar inválida');
  if (teams.size !== 2) fail('UNSUPPORTED_FORMAT', 'El estado 1v1 requiere dos equipos distintos');
  for (const unit of state.units) for (const stack of unit.shield) if (!ids.has(stack.sourceId)) fail('INVALID_SHIELD', 'El generador del escudo no existe');
  if (!Array.isArray(state.order) || state.order.length !== 2 || new Set(state.order).size !== 2 || state.order.some(id => !state.units.some(u=>u.id===id))) fail('INVALID_ORDER', 'El orden debe ser una permutación de las dos unidades');
  if (!Number.isInteger(state.turnIndex) || state.turnIndex < 0 || state.turnIndex >= state.order.length || !Number.isInteger(state.round) || state.round < 1) fail('INVALID_TURN', 'Índice de turno o ronda inválidos');
  if (!['active', 'ended'].includes(state.phase)) fail('INVALID_PHASE', 'Fase de combate inválida');
  const aliveTeams = new Set(state.units.filter(unit => unit.alive).map(unit => unit.team));
  if (state.phase === 'active' && (aliveTeams.size !== 2 || state.winnerTeam !== null)) fail('INVALID_PHASE', 'Un combate activo necesita ambos equipos vivos y ningún ganador');
  const expectedWinner = aliveTeams.size === 1 ? [...aliveTeams][0] : null;
  if (state.phase === 'ended' && (aliveTeams.size > 1 || state.winnerTeam !== expectedWinner)) fail('INVALID_PHASE', 'Ganador o fase final inconsistentes');
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
    units: copy, objects: [], nextPillarId: 1, traps: [], summons: [], order: sorted.map(u => u.id), turnIndex: 0,
    round: 1, phase: 'active', winnerTeam: null, tieBreak,
    audit: { initializedAt: clock ?? null }
  };
  validateSupportedState(state);
  const begun = beginTurn(state);
  return { state: begun.state, events: [{ type: 'combat.initialized', order: state.order, tieBreak }, ...begun.events] };
}

function unitById(state, id) {
  const unit = state.units.find(candidate => candidate.id === id);
  if (!unit) fail('UNKNOWN_UNIT', `Unidad inexistente: ${id}`);
  return unit;
}
function entities(state) { return [...state.units,...(state.objects??[])]; }
function entityById(state,id) { const e=entities(state).find(e=>e.id===id);if(!e)fail('UNKNOWN_UNIT',`Entidad inexistente: ${id}`);return e; }
function activeUnit(state) { return unitById(state, state.order[state.turnIndex]); }
function occupiedKeys(state, movingId) {
  return new Set(entities(state).filter(u => u.alive && u.id !== movingId).map(key));
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
  const simulated = clone(unit), steps = [];
  for (let index = 1; index < path.length && simulated.alive; index++) {
    const tackleAmount = tackle.find(item => item.step === index)?.damage ?? 0;
    if (tackleAmount) applyDamageToUnit(simulated, tackleAmount, true);
    if (!simulated.alive) break;
    simulated.x = path[index].x; simulated.y = path[index].y;
    const wound = applyDamageToUnit(simulated, simulated.status.wound, false);
    steps.push({ step: index, position: clone(path[index]), woundDamage: simulated.status.wound, ...wound, hp: simulated.hp });
  }
  return { path: clone(path), destination: clone(path.at(-1)), cost: path.length - 1, tackle, tackleDamage,
    lethal: tackleDamage >= unit.hp, steps, woundDamage: steps.reduce((n, step) => n + step.woundDamage, 0),
    hpLost: unit.hp - simulated.hp, remainingHp: simulated.hp, diesDuringPath: !simulated.alive,
    resolvedDestination: { x: simulated.x, y: simulated.y } };
}

export function resolvePath(state, unitId, path) {
  const preview = previewPath(state, unitId, path);
  if (preview.lethal) fail('LETHAL_TACKLE', 'El placaje acumulado sería mortal; se rechaza el recorrido completo');
  const next = clone(state), unit = unitById(next, unitId), events = [], travelled = [clone(path[0])];
  function damage(amount, source, step, ignoreShield, enemyIds) {
    const result = applyDamageToUnit(unit, amount, ignoreShield);
    events.push({ type: 'damage.applied', targetId: unit.id, amount, ...result, source, step, ignoreShield,
      ...(enemyIds ? { enemyIds } : {}) });
    if (result.killed) events.push({ type: 'unit.died', unitId });
  }
  for (let index = 1; index < path.length && unit.alive; index++) {
    const tackle = preview.tackle.find(item => item.step === index);
    if (tackle) damage(tackle.damage, 'tackle', index, true, tackle.enemyIds);
    if (!unit.alive) break;
    unit.x = path[index].x; unit.y = path[index].y; unit.pm--;
    travelled.push(clone(path[index]));
    if (unit.status.wound) damage(unit.status.wound, 'wound.movement', index, false);
  }
  if (unit.championId === 'coloso') unit.colosoCreateWindow = false;
  if (travelled.length > 1) events.push({ type: 'unit.moved', unitId, path: travelled, cost: travelled.length - 1, remainingPm: unit.pm });
  finishIfNeeded(next, events);
  return { state: next, events };
}

function applyDamageToUnit(target, amount, ignoreShield) {
  let remaining = amount, absorbed = 0;
  if (!ignoreShield) for (const stack of target.shield) {
    const used = Math.min(stack.amount, remaining); stack.amount -= used; remaining -= used; absorbed += used;
    if (remaining === 0) break;
  }
  target.shield = target.shield.filter(stack => stack.amount > 0);
  const hpLost = Math.min(target.hp, remaining);
  target.hp -= hpLost;
  if (target.hp === 0) target.alive = false;
  return { absorbed, hpLost, killed: !target.alive };
}

export function applyDamage(state, { targetId, amount, ignoreShield = false, source = 'external' }) {
  validateSupportedState(state);
  if (!Number.isInteger(amount) || amount < 0) fail('INVALID_DAMAGE', 'El daño debe ser un entero no negativo');
  const next = clone(state), target = entityById(next, targetId);
  if (!target.alive) fail('UNIT_DEAD', 'No se puede dañar una unidad muerta');
  const result = applyDamageToUnit(target, amount, ignoreShield);
  const events = [{ type: 'damage.applied', targetId, amount, absorbed: result.absorbed, hpLost: result.hpLost, ignoreShield, source }];
  if (result.killed) events.push(target.kind==='object'?{type:'object.destroyed',objectId:targetId}:{ type: 'unit.died', unitId: targetId });
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
  if (unit.championId === 'arfeli') Object.assign(unit, { arfeliMasteryChain: [], arfeliMasteryLastBonus: 0 });
  if (unit.championId === 'coloso') Object.assign(unit, { colosoTurnSerial: unit.colosoTurnSerial + 1, colosoCreateWindow: true, colosoPillarCreatedThisTurn: false, colosoRecycleUsed: false });
  if (unit.championId === 'piplus') Object.assign(unit, { piplusMarkUsedThisTurn: false, piplusMarkBlockedThisTurn: false, piplusFixationTargetId: null, piplusInterferenceTargets: [] });
  if (unit.championId === 'onod') Object.assign(unit, { onodTurnSerial: unit.onodTurnSerial + 1, onodGerminateUses: 0, onodWitherUsedThisTurn: false, onodGerminateBlockedThisTurn: false, onodReabsorptionUsedThisTurn: false });
  if (unit.championId === 'korgan') Object.assign(unit, { korganTurnSerial: unit.korganTurnSerial + 1, korganDisarmUsedThisTurn: false });
  if (unit.status.burn > 0) {
    const damage = unit.status.burn, result = applyDamageToUnit(unit, damage, false);
    events.push({ type: 'damage.applied', targetId: unit.id, amount: damage, absorbed: result.absorbed, hpLost: result.hpLost, ignoreShield: false, source: 'burn.start' });
    if (result.killed) events.push({ type: 'unit.died', unitId: unit.id });
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
    const damage = unit.status.burn, result = applyDamageToUnit(unit, damage, false);
    events.push({ type: 'damage.applied', targetId: unit.id, amount: damage, absorbed: result.absorbed, hpLost: result.hpLost, ignoreShield: false, source: 'burn.end' });
    if (result.killed) events.push({ type: 'unit.died', unitId: unit.id });
  }
  for (const status of ['wound', 'poison', 'burn']) unit.status[status] = Math.floor(Math.max(0, unit.status[status] || 0) / 2);
  if (unit.championId === 'arfeli') Object.assign(unit, { arfeliMasteryChain: [], arfeliMasteryLastBonus: 0 });
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

const ABILITIES = Object.freeze({
  sword: {championId:'arfeli',cost:2,range:1,damage:10,maxUses:2},
  daggers: {championId:'arfeli',cost:3,range:1,damage:10,wound:2,maxUses:1},
  shield: {championId:'arfeli',cost:3,range:0,shield:15,maxUses:1},
  rock: {championId:'coloso',cost:3,range:4,damage:8,los:true},
  hammer: {championId:'arfeli',cost:4,range:3,damage:13,jump:true},
  spear: {championId:'arfeli',cost:3,range:2,damage:10,los:true,forced:'pull',collision:2},
  quake: {championId:'coloso',cost:3,range:1,damage:10,geometry:'adjacent8',forced:'push',collision:4}
});
export function abilityDefinitions(){return clone(ABILITIES);}
export function clearAbilityLOS(state,a,b){
  const samples=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*16;
  const cells=new Set();
  for(let i=1;i<samples;i++){
    const t=i/samples,x=Math.floor(a.x+.5+(b.x-a.x)*t),y=Math.floor(a.y+.5+(b.y-a.y)*t);
    if((x!==a.x||y!==a.y)&&(x!==b.x||y!==b.y))cells.add(`${x},${y}`);
  }
  const blockers=new Set([...state.board.obstacles,...entities(state).filter(u=>u.alive&&u.id!==a.id&&u.id!==b.id&&u.blocksLOS!==false).map(key)]);
  return [...cells].every(cell=>!blockers.has(cell));
}
export function abilityRangeContains(unit, abilityId, target) {
  const a = ABILITIES[abilityId];
  if (!a) return false;
  const dx = Math.abs(unit.x-target.x), dy = Math.abs(unit.y-target.y);
  if (a.geometry === 'adjacent8') return Math.max(dx,dy) === 1;
  const radius = abilityId === 'rock' && unit.monolith ? 5 : a.range;
  return radius === 0 ? dx+dy === 0 : dx+dy > 0 && dx+dy <= radius;
}
export function forcedDirection(source, target, away = true) {
  const dx=target.x-source.x,dy=target.y-source.y,sign=away?1:-1;
  if(Math.abs(dx)>=Math.abs(dy)&&dx!==0)return [sign*Math.sign(dx),0];
  return dy!==0?[0,sign*Math.sign(dy)]:[0,0];
}
export function abilityTargets(state,unitId,abilityId){
  validateSupportedState(state);
  const u=unitById(state,unitId),a=ABILITIES[abilityId];
  if(!a||a.championId!==u.championId||state.phase!=='active'||activeUnit(state).id!==unitId||u.pa<a.cost||(abilityId==='quake'&&u.monolith)||(a.maxUses&&(u.skillUsesThisTurn[abilityId]??0)>=a.maxUses))return [];
  if(abilityId==='shield')return [u.id];
  return entities(state).filter(t=>t.alive&&t.team!==u.team&&abilityRangeContains(u,abilityId,t)&&(!a.los||clearAbilityLOS(state,u,t))&&(!a.jump||hammerLanding(state,u,t))).map(t=>t.id);
}
export function swordTargets(state,unitId){return abilityTargets(state,unitId,'sword');}

export function useAbility(state, { unitId, abilityId, targetId }) {
  validateSupportedState(state);
  if (state.phase !== 'active') fail('COMBAT_ENDED', 'El combate ya terminó');
  const unit = unitById(state, unitId);
  if (activeUnit(state).id !== unitId) fail('NOT_ACTIVE_UNIT', 'No es la unidad activa');
  if (unit.status.curseDamage > 0) fail('UNSUPPORTED_MECHANIC', 'Maldición está fuera del alcance de esta etapa');
  const ability=ABILITIES[abilityId];
  if (!ability || unit.championId!==ability.championId) fail('UNSUPPORTED_ABILITY','Habilidad no habilitada para este campeón');
  if (abilityId === 'quake' && unit.monolith) fail('UNSUPPORTED_MECHANIC', 'Sísmico en Monolito y sus réplicas requieren la etapa de Pilares');
  if (unit.pa < ability.cost) fail('INSUFFICIENT_PA', `Se requieren ${ability.cost} PA`);
  if (ability.maxUses && (unit.skillUsesThisTurn[abilityId] ?? 0) >= ability.maxUses) fail('ABILITY_LIMIT','Límite de usos por turno');
  const target = entityById(state, targetId);
  if(abilityId==='shield'){
    if(target.id!==unit.id)fail('INVALID_TARGET','Portación de Escudo sólo protege a Arfeli');
  }else{
    if(!target.alive||target.team===unit.team)fail('INVALID_TARGET','Elegí un campeón enemigo vivo');
    if(!abilityRangeContains(unit,abilityId,target))fail('OUT_OF_RANGE','Objetivo fuera del alcance');
    if(ability.los&&!clearAbilityLOS(state,unit,target))fail('BLOCKED_LOS','Línea de visión bloqueada');
    if(ability.jump&&!hammerLanding(state,unit,target))fail('NO_LANDING','No hay una casilla cardinal libre para aterrizar');
  }
  const next = clone(state), actor = unitById(next, unitId), victim = entityById(next, targetId), events = [];
  const bonus = actor.championId==='arfeli'&&!actor.arfeliMasteryChain.includes(abilityId) ? actor.arfeliMasteryChain.length : 0;
  if(actor.championId==='arfeli'){actor.arfeliMasteryChain = bonus === 0 ? [abilityId] : [...actor.arfeliMasteryChain, abilityId];actor.arfeliMasteryLastBonus = bonus;}
  if(actor.championId==='coloso')actor.colosoCreateWindow=false;
  actor.pa -= ability.cost; actor.skillUsesThisTurn[abilityId] = (actor.skillUsesThisTurn[abilityId] ?? 0) + 1;
  events.push({ type: 'ability.used', unitId, abilityId, targetId, cost: ability.cost, masteryBonus: bonus });
  function damage(targetUnit, amount, source) {
    const result = applyDamageToUnit(targetUnit, amount, false);
    events.push({ type: 'damage.applied', targetId: targetUnit.id, amount, ...result, ignoreShield: false, source });
    if (result.killed) events.push(targetUnit.kind==='object'?{type:'object.destroyed',objectId:targetUnit.id}:{ type: 'unit.died', unitId: targetUnit.id });
  }
  if (actor.status.poison > 0) damage(actor, actor.status.poison, 'poison.ability');
  if (actor.alive){
    if(abilityId==='shield'){
      const amount=ability.shield+bonus;actor.shield.push({amount,sourceId:actor.id});
      events.push({type:'shield.added',unitId:actor.id,sourceId:actor.id,amount});
    }else {
      if(ability.jump){
        const from={x:actor.x,y:actor.y},landing=hammerLanding(next,actor,victim),distance=Math.abs(actor.x-landing.x)+Math.abs(actor.y-landing.y);
        actor.x=landing.x;actor.y=landing.y;
        if(distance){events.push({type:'unit.moved',unitId:actor.id,path:[from,{x:actor.x,y:actor.y}],kind:'jump',cost:0,remainingPm:actor.pm,source:'ability.hammer'});
          for(let step=1;step<=distance&&actor.alive;step++)if(actor.status.wound)damage(actor,actor.status.wound,'wound.jump');}
        if(!actor.alive){finishIfNeeded(next,events);return {state:next,events};}
      }
      damage(victim,ability.damage+bonus,`ability.${abilityId}`);
      if(ability.jump&&victim.alive&&victim.kind==='champion'&&!victim.monolith){victim.status.pmPenaltyNext=Math.max(victim.status.pmPenaltyNext,1);events.push({type:'status.applied',targetId:victim.id,status:'pmPenaltyNext',value:victim.status.pmPenaltyNext});}
      if (ability.forced && victim.alive && victim.kind==='champion') {
        const from = {x:victim.x,y:victim.y};
        const [dx,dy] = forcedDirection(actor,victim,ability.forced==='push');
        const destination = {x:victim.x+dx,y:victim.y+dy};
        const blocker = entities(next).find(u=>u.alive&&u.id!==victim.id&&key(u)===key(destination));
        if (!inside(destination) || next.board.obstacles.includes(key(destination)) || blocker) {
          events.push({type:'movement.blocked',unitId:victim.id,from,destination,source:`ability.${abilityId}`,blockerId:blocker?.id??null});
          damage(victim,ability.collision,`collision.${abilityId}`);
          if(blocker)damage(blocker,ability.collision/2,`collision.${abilityId}`);
        } else {
          victim.x=destination.x;victim.y=destination.y;
          events.push({type:'unit.moved',unitId:victim.id,path:[from,destination],cost:0,remainingPm:victim.pm,forced:true,source:`ability.${abilityId}`});
          if(victim.status.wound)damage(victim,victim.status.wound,'wound.forced');
        }
      }
      if (ability.wound && victim.alive && victim.kind==='champion') {
        const before = victim.status.wound;
        victim.status.wound = Math.min(3, before + ability.wound);
        events.push({ type: 'status.applied', targetId: victim.id, status: 'wound', amount: victim.status.wound - before, value: victim.status.wound });
      }
    }
  }
  finishIfNeeded(next, events);
  return { state: next, events };
}

// Exact pure simulation: the preview and authority share damage, death and blockers.
export function hammerLanding(state, actor, target) {
  const occupied=occupiedKeys(state,actor.id),blocked=new Set(state.board.obstacles);
  return DIRECTIONS.map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))
    .filter(p=>inside(p)&&!occupied.has(key(p))&&!blocked.has(key(p)))
    .sort((a,b)=>(Math.abs(actor.x-a.x)+Math.abs(actor.y-a.y))-(Math.abs(actor.x-b.x)+Math.abs(actor.y-b.y))||a.y-b.y||a.x-b.x)[0]??null;
}
export function pillarAvailable(state,unitId) {
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==unitId||u.championId!=='coloso'||u.monolith||!u.colosoCreateWindow||u.colosoPillarCreatedThisTurn||state.objects.filter(o=>o.alive&&o.ownerId===u.id).length>=2)return [];
  const occupied=occupiedKeys(state,unitId),cells=[];
  for(let y=0;y<12;y++)for(let x=0;x<12;x++){const p={x,y},d=Math.abs(u.x-x)+Math.abs(u.y-y);if(d>0&&d<=5&&!occupied.has(key(p))&&!state.board.obstacles.includes(key(p))&&clearAbilityLOS(state,u,p))cells.push(p);}
  return cells;
}
export function createPillar(state,{unitId,position}) {
  if(!pillarAvailable(state,unitId).some(p=>p.x===position?.x&&p.y===position?.y))fail('PILLAR_UNAVAILABLE','No se puede crear un Pilar en esa casilla o en este momento');
  const next=clone(state),u=unitById(next,unitId);let number=next.nextPillarId??Math.max(0,...next.objects.map(o=>o.number))+1;
  while(entities(next).some(e=>e.id===`pillar${number}`))number++;
  next.nextPillarId=number+1;
  const object={id:`pillar${number}`,number,kind:'object',type:'pillar',ownerId:u.id,team:u.team,x:position.x,y:position.y,hp:15,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:u.colosoTurnSerial};
  next.objects.push(object);u.colosoPillarCreatedThisTurn=true;u.colosoCreateWindow=false;
  return {state:next,events:[{type:'object.created',object:clone(object),cost:0,unitId}]};
}

export function previewAbility(state, command) {
  const resolved = useAbility(state, command);
  return {
    effect: [{x:entityById(state,command.targetId).x,y:entityById(state,command.targetId).y}],
    moves: resolved.events.filter(e=>e.type==='unit.moved'),
    blocked: resolved.events.filter(e=>e.type==='movement.blocked'),
    damage: resolved.events.filter(e=>e.type==='damage.applied'),
    deaths: resolved.events.filter(e=>e.type==='unit.died').map(e=>e.unitId)
  };
}

export function executeCommand(state, command) {
  if (!command || typeof command.type !== 'string') fail('INVALID_COMMAND', 'Comando inválido');
  if (command.type === 'createPillar') return createPillar(state,command);
  if (command.type === 'ability') return useAbility(state, command);
  if (command.type === 'move') return resolvePath(state, command.unitId, command.path);
  if (command.type === 'endTurn') return endTurn(state, { unitId: command.unitId });
  fail('UNSUPPORTED_COMMAND', `Comando fuera de alcance: ${command.type}`);
}
