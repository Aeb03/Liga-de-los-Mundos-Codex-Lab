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
    markedTargetId: null, piplusMarkUsedThisTurn: false, piplusMarkBlockedThisTurn: false, piplusFixationTargetId: null, piplusInterferenceTargets: [],
    onodTurnSerial: 0, onodGerminateUses: 0, onodWitherUsedThisTurn: false, onodGerminateBlockedThisTurn: false, onodReabsorptionUsedThisTurn: false,
    korganTurnSerial: 0, korganDisarmUsedThisTurn: false,
    linkedTargetId: null, houganPainTransfer: null, houganDance: null
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
  if (state.summons.length) {
    fail('UNSUPPORTED_MECHANIC', 'Invocaciones están fuera de alcance en esta etapa');
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
    if (unit.maxHp < 1 || unit.hp > unit.maxHp || unit.pa > unit.maxPa + (unit.championId==='onod'?3:unit.championId==='korgan'?1:0) || unit.pm > unit.maxPm || typeof unit.alive !== 'boolean' || unit.alive !== (unit.hp > 0)) fail('INVALID_RESOURCE', 'Vida, recursos o marca alive inconsistentes');
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
  for(const unit of state.units){
    if(unit.markedTargetId!=null&&!state.units.some(t=>t.id===unit.markedTargetId&&t.team!==unit.team&&unit.championId==='piplus'))fail('INVALID_CHAMPION_STATE','Marca inválida');
    if(unit.linkedTargetId!=null&&(!state.units.some(t=>t.id===unit.linkedTargetId&&t.id!==unit.id)||unit.championId!=='houngan'))fail('INVALID_CHAMPION_STATE','Vínculo Vudú inválido');
    for(const field of ['houganPainTransfer','houganDance']){
      const value=unit[field];
      if(value!=null&&(unit.championId!=='houngan'||typeof value!=='object'||typeof value.dollId!=='string'||typeof value.targetId!=='string'))fail('INVALID_CHAMPION_STATE','Estado avanzado de Hougan inválido');
    }
  }
  for (const object of state.objects) {
    if (!object || object.kind!=='object' || !['pillar','sprout','doll'].includes(object.type)) fail('UNSUPPORTED_MECHANIC','Objeto táctico no soportado');
    const owner=state.units.find(u=>u.id===object.ownerId),sprout=object.type==='sprout',doll=object.type==='doll';
    const expectedChampion=doll?'houngan':sprout?'onod':'coloso';
    const expectedMax=doll?(object.linkMode==='ally'?20:object.linkMode==='enemy'?16:-1):sprout?12:15;
    if (!owner || owner.championId!==expectedChampion || object.team!==owner.team || object.id!==`${object.type}${object.number}` || ids.has(object.id)) fail('INVALID_OBJECT','Identidad o propietario del objeto inválido');
    if (!inside(object) || !nonNegativeInteger(object.hp) || object.maxHp!==expectedMax || object.hp>expectedMax || object.alive!==(object.hp>0) || !Number.isInteger(object.number) || object.number<1 || object.blocksLOS!==(doll||sprout?false:true)) fail('INVALID_OBJECT','Objeto inválido');
    if(doll){
      const linked=state.units.find(u=>u.id===object.linkedTargetId&&u.id!==owner.id);
      if(!linked||!['ally','enemy'].includes(object.linkMode)||(object.linkMode==='ally')!==(linked.team===owner.team)||object.movePm!==3)fail('INVALID_OBJECT','Muñeco Vudú inválido');
    }else if(!nonNegativeInteger(object[sprout?'createdByOnodTurn':'createdByColosoTurn']))fail('INVALID_OBJECT','Secuencia temporal del objeto inválida');
    if (!Array.isArray(object.shield) || object.shield.some(t=>!t||!Number.isInteger(t.amount)||t.amount<=0||!state.units.some(u=>u.id===t.sourceId))) fail('INVALID_OBJECT','Escudo de objeto inválido');
    if (object.alive && (positions.has(key(object)) || obstacleSet.has(key(object)))) fail('INVALID_POSITION','Objeto en casilla ocupada');
    if(object.alive)positions.add(key(object));ids.add(object.id);
  }
  for(const owner of state.units){
    if(state.objects.filter(o=>o.alive&&o.ownerId===owner.id&&o.type!=='doll').length>3)fail('INVALID_OBJECT','Máximo tres objetos propios activos');
    if(state.objects.filter(o=>o.alive&&o.ownerId===owner.id&&o.type==='doll').length>1)fail('INVALID_OBJECT','Hougan sólo puede mantener un Muñeco Vudú');
  }
  for(const [field,type] of [['nextPillarId','pillar'],['nextSproutId','sprout'],['nextDollId','doll']])if(state[field]!==undefined&&(!Number.isInteger(state[field])||state[field]<1||state.objects.some(o=>o.type===type&&o.number>=state[field])))fail('INVALID_OBJECT','Secuencia de objeto inválida');
  const activeTrapCells=new Set();
  for(const trap of state.traps){
    const owner=state.units.find(u=>u.id===trap?.ownerId);
    if(!trap||trap.kind!=='trap'||!['spikes','mine'].includes(trap.trapType)||!owner||owner.championId!=='korgan'||trap.team!==owner.team||trap.id!==`trap${trap.number}`||ids.has(trap.id))fail('INVALID_TRAP','Identidad o propietario de trampa inválido');
    if(!inside(trap)||!Number.isInteger(trap.number)||trap.number<1||typeof trap.active!=='boolean'||trap.hidden!==true||!nonNegativeInteger(trap.createdByKorganTurn))fail('INVALID_TRAP','Estado de trampa inválido');
    if(trap.active){const ownCell=`${trap.ownerId}:\0${key(trap)}`;if(activeTrapCells.has(ownCell))fail('INVALID_TRAP','Una red de Korgan no puede apilar trampas');activeTrapCells.add(ownCell);}
    ids.add(trap.id);
  }
  for(const owner of state.units)if(state.traps.filter(t=>t.active&&t.ownerId===owner.id).length>3)fail('INVALID_TRAP','Máximo tres trampas activas por Korgan');
  if(state.nextTrapId!==undefined&&(!Number.isInteger(state.nextTrapId)||state.nextTrapId<1||state.traps.some(t=>t.number>=state.nextTrapId)))fail('INVALID_TRAP','Secuencia de trampa inválida');
  if(state.dollPhase!=null){
    const p=state.dollPhase,owner=state.units.find(u=>u.id===p?.ownerId),doll=state.objects.find(o=>o.id===p?.dollId);
    if(!p||owner?.championId!=='houngan'||!owner.alive||!doll?.alive||doll.type!=='doll'||doll.ownerId!==owner.id||!Number.isInteger(p.pm)||p.pm<0||p.pm>3||p.maxPm!==3)fail('INVALID_DOLL_PHASE','Fase de movimiento del Muñeco inválida');
  }
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
    units: copy, objects: [], nextPillarId: 1, nextSproutId: 1, nextDollId: 1, traps: [], nextTrapId: 1, summons: [], dollPhase: null, order: sorted.map(u => u.id), turnIndex: 0,
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
  if(state.dollPhase)return [];
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
    triggerKorganTraps(next,unit,events,'movement');
    if (unit.alive && unit.status.wound) damage(unit.status.wound, 'wound.movement', index, false);
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
  const events = [];
  const result = damageWithDollEffect(next,target,amount,ignoreShield,events,source);
  finishIfNeeded(next, events);
  return { state: next, events };
}

function expireSourceShields(state, sourceId, events) {
  for (const target of entities(state)) {
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

function advanceChampionTurn(next,events){
  next.dollPhase=null;
  let attempts=0;
  do{
    next.turnIndex++;
    if(next.turnIndex>=next.order.length){next.turnIndex=0;next.round++;}
    attempts++;
  }while(attempts<=next.order.length&&!activeUnit(next).alive);
  const begun=beginTurn(next);
  return {state:begun.state,events:[...events,...begun.events]};
}
export function endTurn(state, { unitId } = {}) {
  validateSupportedState(state);
  if (state.phase !== 'active') fail('COMBAT_ENDED', 'El combate ya terminó');
  if(state.dollPhase)fail('DOLL_PHASE_ACTIVE','Primero resolvé el movimiento del Muñeco Vudú');
  const next = clone(state), events = [], unit = activeUnit(next);
  if (unitId && unitId !== unit.id) fail('NOT_ACTIVE_UNIT', 'La orden de cierre no corresponde a la unidad activa');
  if (unit.status.burn > 0) {
    damageWithDollEffect(next,unit,unit.status.burn,false,events,'burn.end');
  }
  for (const status of ['wound', 'poison', 'burn']) unit.status[status] = Math.floor(Math.max(0, unit.status[status] || 0) / 2);
  if (unit.championId === 'arfeli') Object.assign(unit, { arfeliMasteryChain: [], arfeliMasteryLastBonus: 0 });
  if (unit.championId === 'piplus') Object.assign(unit, { piplusFixationTargetId: null, piplusInterferenceTargets: [] });
  events.push({ type: 'turn.ended', unitId: unit.id, round: next.round });
  if (finishIfNeeded(next, events)) return { state: next, events };
  if(unit.championId==='houngan'){
    const doll=ownedDoll(next,unit);
    if(doll?.alive){
      next.dollPhase={ownerId:unit.id,dollId:doll.id,pm:3,maxPm:3};
      events.push({type:'doll.phase.started',unitId:unit.id,dollId:doll.id,pm:3});
      return {state:next,events};
    }
  }
  return advanceChampionTurn(next,events);
}
export function houganDollMovementAvailable(state,unitId){
  validateSupportedState(state);
  const phase=state.dollPhase,u=unitById(state,unitId);
  if(state.phase!=='active'||!phase||phase.ownerId!==u.id||u.championId!=='houngan'||activeUnit(state).id!==u.id)return [];
  const doll=state.objects.find(o=>o.id===phase.dollId&&o.alive&&o.type==='doll');if(!doll)return [];
  const blocked=new Set([...state.board.obstacles,...occupiedKeys(state,doll.id)]),seen=new Map([[key(doll),0]]),queue=[{x:doll.x,y:doll.y}];
  while(queue.length){
    const cur=queue.shift(),cost=seen.get(key(cur));if(cost>=phase.pm)continue;
    for(const [dx,dy] of DIRECTIONS){const p={x:cur.x+dx,y:cur.y+dy},k=key(p);if(!inside(p)||blocked.has(k)||seen.has(k))continue;seen.set(k,cost+1);queue.push(p);}
  }
  seen.delete(key(doll));return [...seen].map(([tile,cost])=>{const [x,y]=tile.split(',').map(Number);return {x,y,cost};});
}
export function calculateHouganDollPath(state,unitId,destination){
  const available=houganDollMovementAvailable(state,unitId);
  if(!available.some(p=>p.x===destination?.x&&p.y===destination?.y))fail('UNREACHABLE_DESTINATION','Destino no disponible para el Muñeco');
  const phase=state.dollPhase,doll=state.objects.find(o=>o.id===phase.dollId),blocked=new Set([...state.board.obstacles,...occupiedKeys(state,doll.id)]);
  const start={x:doll.x,y:doll.y},queue=[start],previous=new Map([[key(start),null]]);
  while(queue.length){const cur=queue.shift();if(key(cur)===key(destination))break;for(const [dx,dy] of DIRECTIONS){const p={x:cur.x+dx,y:cur.y+dy},k=key(p);if(!inside(p)||blocked.has(k)||previous.has(k))continue;previous.set(k,cur);queue.push(p);}}
  const path=[];for(let cursor=destination;cursor;cursor=previous.get(key(cursor)))path.push({x:cursor.x,y:cursor.y});return path.reverse();
}
export function moveHouganDoll(state,{unitId,path}){
  validateSupportedState(state);const phase=state.dollPhase,u=unitById(state,unitId);
  if(!phase||phase.ownerId!==u.id||activeUnit(state).id!==u.id)fail('DOLL_PHASE_INACTIVE','No hay movimiento de Muñeco pendiente');
  const doll=state.objects.find(o=>o.id===phase.dollId&&o.alive&&o.type==='doll');if(!doll)fail('DOLL_PHASE_INACTIVE','El Muñeco ya no está disponible');
  if(!Array.isArray(path)||path.length<2||key(path[0])!==key(doll)||path.length-1>phase.pm)fail('INVALID_PATH','Recorrido inválido para el Muñeco');
  const blocked=new Set([...state.board.obstacles,...occupiedKeys(state,doll.id)]),seen=new Set([key(doll)]);
  for(let i=1;i<path.length;i++){if(!inside(path[i])||!adjacent(path[i-1],path[i])||blocked.has(key(path[i]))||seen.has(key(path[i])))fail('INVALID_PATH','Recorrido bloqueado o no ortogonal del Muñeco');seen.add(key(path[i]));}
  const next=clone(state),p=next.dollPhase,d=next.objects.find(o=>o.id===p.dollId),events=[],travelled=[{x:d.x,y:d.y}];
  for(let i=1;i<path.length&&d.alive;i++){
    d.x=path[i].x;d.y=path[i].y;p.pm--;travelled.push({x:d.x,y:d.y});
    triggerKorganTraps(next,d,events,'doll.movement');
    if(finishIfNeeded(next,events)){next.dollPhase=null;break;}
  }
  if(travelled.length>1)events.push({type:'object.moved',objectId:d.id,unitId:u.id,path:travelled,cost:travelled.length-1,remainingPm:p?.pm??0,source:'hougan.doll'});
  if(next.phase==='ended')return {state:next,events};
  if(!d.alive||p.pm<=0){events.push({type:'doll.phase.ended',unitId:u.id,dollId:d.id,reason:!d.alive?'destroyed':'spent'});return advanceChampionTurn(next,events);}
  return {state:next,events};
}
export function endHouganDollPhase(state,{unitId}={}){
  validateSupportedState(state);const phase=state.dollPhase,u=unitById(state,unitId);
  if(!phase||phase.ownerId!==u.id||activeUnit(state).id!==u.id)fail('DOLL_PHASE_INACTIVE','No hay movimiento de Muñeco pendiente');
  const next=clone(state),events=[{type:'doll.phase.ended',unitId:u.id,dollId:phase.dollId,reason:'manual'}];
  return advanceChampionTurn(next,events);
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
  needle:{championId:'houngan',cost:2,range:4,los:true},
  transfer:{championId:'houngan',cost:2,range:3,los:true},
  ritual:{championId:'houngan',cost:4,range:4,damage:14,los:true},
  curse:{championId:'houngan',cost:3,range:3,damage:8,maxUses:1},
  paintransfer:{championId:'houngan',cost:3,range:0},
  dance:{championId:'houngan',cost:3,range:0},
  trap_spikes:{championId:'korgan',cost:2,range:3,los:true,maxUses:2,ground:true},
  trap_mine:{championId:'korgan',cost:3,range:3,los:true,maxUses:1,ground:true},
  grenade:{championId:'korgan',cost:3,range:3,los:true,ground:true},
  shot:{championId:'korgan',cost:3,range:5,damage:10,los:true},
  hook:{championId:'korgan',cost:3,range:3,damage:6,los:true},
  hunterstep:{championId:'korgan',cost:1,range:2,maxUses:1,dash:true,ground:true},
  thorn:{championId:'onod',cost:2,range:4,damage:6,los:true,maxUses:2},
  vines:{championId:'onod',cost:3,range:3,los:true,ground:true},
  sap:{championId:'onod',cost:3,range:3,los:true,maxUses:2},
  spores:{championId:'onod',cost:4,range:99},
  awakening:{championId:'onod',cost:4,range:0},
  reabsorption:{championId:'onod',cost:0,range:0,maxUses:1},
  precise: {championId:'piplus',cost:3,range:4,damage:8,los:true},
  vector: {championId:'piplus',cost:3,range:3,damage:6,los:true,forced:'push'},
  impulse: {championId:'piplus',cost:2,range:2,maxUses:1,dash:true},
  interference: {championId:'piplus',cost:2,range:4,los:true},
  rupture: {championId:'piplus',cost:4,range:4,damage:14,los:true},
  fixation: {championId:'piplus',cost:2,range:4,los:true},
  bow: {championId:'arfeli',cost:3,range:4,damage:8,los:true},
  stonearmor: {championId:'coloso',cost:2,range:3,shield:10,los:true,maxUses:2},
  absorb: {championId:'coloso',cost:2,range:3,los:true},
  collapse: {championId:'coloso',cost:3,range:3,los:true},
  magnetism: {championId:'coloso',cost:3,range:3,los:true},
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
  if (abilityId==='impulse'||abilityId==='hunterstep')return (dx===0||dy===0)&&dx+dy>=1&&dx+dy<=2;
  if (abilityId==='shot')return (dx===0||dy===0)&&dx+dy>=1&&dx+dy<=5;
  if (['stonearmor','sap','vines'].includes(abilityId)&&dx+dy===0)return true;
  if (a.geometry === 'adjacent8') return Math.max(dx,dy) === 1;
  const radius = ['rock','collapse','magnetism'].includes(abilityId) && unit.monolith ? 5 : a.range;
  return radius === 0 ? dx+dy === 0 : dx+dy > 0 && dx+dy <= radius;
}
export function forcedDirection(source, target, away = true) {
  const dx=target.x-source.x,dy=target.y-source.y,sign=away?1:-1;
  if(Math.abs(dx)>=Math.abs(dy)&&dx!==0)return [sign*Math.sign(dx),0];
  return dy!==0?[0,sign*Math.sign(dy)]:[0,0];
}
function ownPillars(state,u){return state.objects.filter(p=>p.alive&&p.ownerId===u.id).sort((a,b)=>a.number-b.number);}
function distance(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function adjacent8(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;}
function quakeOrigin(state,u,target){return adjacent8(u,target)?u:u.monolith?ownPillars(state,u).find(p=>adjacent8(p,target)):null;}
export function abilityTargets(state,unitId,abilityId){
  validateSupportedState(state);
  const u=unitById(state,unitId),a=ABILITIES[abilityId];
  if(!a||a.championId!==u.championId||state.phase!=='active'||state.dollPhase||activeUnit(state).id!==unitId||u.pa<a.cost||(a.maxUses&&(u.skillUsesThisTurn[abilityId]??0)>=a.maxUses))return [];
  if(u.championId==='korgan'){
    if(['trap_spikes','trap_mine','grenade','hunterstep'].includes(abilityId))return [];
    if(abilityId==='shot')return entities(state).filter(t=>t.alive&&t.team!==u.team&&(t.x===u.x||t.y===u.y)&&distance(u,t)>=1&&distance(u,t)<=5&&clearAbilityLOS(state,u,t)).map(t=>t.id);
    if(abilityId==='hook')return state.units.filter(t=>t.alive&&t.team!==u.team&&distance(u,t)>=1&&distance(u,t)<=3&&clearAbilityLOS(state,u,t)).map(t=>t.id);
  }
  if(u.championId==='houngan'){
    if(abilityId==='needle')return state.units.filter(t=>t.alive&&t.id!==u.id&&distance(u,t)<=4&&clearAbilityLOS(state,u,t)).map(t=>t.id);
    if(abilityId==='transfer')return u.hp>=u.maxHp?[]:state.objects.filter(t=>t.alive&&t.type==='doll'&&t.ownerId===u.id&&distance(u,t)<=3&&clearAbilityLOS(state,u,t)).map(t=>t.id);
    if(abilityId==='ritual'){const t=linkedTarget(state,u);return t?.alive&&t.team!==u.team&&distance(u,t)<=4&&clearAbilityLOS(state,u,t)?[t.id]:[];}
    if(abilityId==='curse')return state.units.filter(t=>t.alive&&t.team!==u.team&&distance(u,t)<=3).map(t=>t.id);
    if(abilityId==='paintransfer')return matchingDoll(state,u)&&!painTransferStateValid(state,u)?[u.id]:[];
    if(abilityId==='dance')return matchingDoll(state,u)&&!danceStateValid(state,u)?[u.id]:[];
  }
  if(abilityId==='shield')return [u.id];
  if(['impulse','vines'].includes(abilityId))return [];
  if(abilityId==='sap')return state.units.filter(t=>t.alive&&t.team===u.team&&(t.id===u.id||abilityRangeContains(u,abilityId,t)&&clearAbilityLOS(state,u,t))).map(t=>t.id);
  if(abilityId==='spores')return ownSprouts(state,u).map(s=>s.id);
  if(abilityId==='awakening')return ownSprouts(state,u).length?[u.id]:[];
  if(abilityId==='reabsorption')return absorbableSprouts(state,u).length?[u.id]:[];
  return entities(state).filter(t=>{
    if(!t.alive)return false;
    if(['precise','vector','interference','rupture','fixation'].includes(abilityId))return t.team!==u.team&&abilityRangeContains(u,abilityId,t)&&(!['interference','rupture','fixation'].includes(abilityId)||markedTarget(state,u)?.id===t.id)&& (abilityId!=='interference'||!u.piplusInterferenceTargets.includes(t.id))&&!abilityLOSBlocked(state,u,abilityId,t);
    if(abilityId==='quake')return t.team!==u.team&&quakeOrigin(state,u,t);
    if(abilityId==='stonearmor')return !u.stoneArmorTargetsUsed.includes(t.id)&&(t.kind==='champion'?t.team===u.team:t.ownerId===u.id)&&(t.id===u.id||distance(u,t)<=3&&clearAbilityLOS(state,u,t));
    if(['absorb','collapse','magnetism'].includes(abilityId))return t.type==='pillar'&&t.ownerId===u.id&&abilityRangeContains(u,abilityId,t)&&clearAbilityLOS(state,u,t)&&(abilityId!=='absorb'||t.createdByColosoTurn!==u.colosoTurnSerial&&u.hp<u.maxHp);
    return t.team!==u.team&&abilityRangeContains(u,abilityId,t)&&(!a.los||clearAbilityLOS(state,u,t))&&(!a.jump||hammerLanding(state,u,t));
  }).map(t=>t.id);
}
export function collapseCells(pillar,direction){
  if(!direction||!Number.isInteger(direction.x)||!Number.isInteger(direction.y)||Math.abs(direction.x)+Math.abs(direction.y)!==1)fail('INVALID_DIRECTION','Elegí una dirección cardinal');
  const {x:dx,y:dy}=direction, cells=[];
  for(const [band,step,offsets] of [['near',1,[-1,0,1]],['middle',2,[-1,1]],['far',3,[0]]])for(const off of offsets){const p={x:pillar.x+dx*step-dy*off,y:pillar.y+dy*step+dx*off,band};if(inside(p))cells.push(p);}
  return cells;
}
export function magnetismTargets(state,unitId,pillarId){
  if(!abilityTargets(state,unitId,'magnetism').includes(pillarId))return [];
  const u=unitById(state,unitId),p=entityById(state,pillarId);
  return state.units.filter(t=>t.alive&&distance(p,t)>=1&&distance(p,t)<=5&&!(u.monolith&&t.id===u.id)).map(t=>t.id);
}
export function swordTargets(state,unitId){return abilityTargets(state,unitId,'sword');}

export function useAbility(state, { unitId, abilityId, targetId, direction, secondaryTargetId, position, distance: pullDistance }) {
  validateSupportedState(state);
  if (state.phase !== 'active') fail('COMBAT_ENDED', 'El combate ya terminó');
  if(state.dollPhase)fail('DOLL_PHASE_ACTIVE','Primero resolvé el movimiento del Muñeco Vudú');
  const unit = unitById(state, unitId);
  if (activeUnit(state).id !== unitId) fail('NOT_ACTIVE_UNIT', 'No es la unidad activa');
  if (unit.status.curseDamage > 0) fail('UNSUPPORTED_MECHANIC', 'Maldición está fuera del alcance de esta etapa');
  const ability=ABILITIES[abilityId];
  if (!ability || unit.championId!==ability.championId) fail('UNSUPPORTED_ABILITY','Habilidad no habilitada para este campeón');
  if (unit.pa < ability.cost) fail('INSUFFICIENT_PA', `Se requieren ${ability.cost} PA`);
  if (ability.maxUses && (unit.skillUsesThisTurn[abilityId] ?? 0) >= ability.maxUses) fail('ABILITY_LIMIT','Límite de usos por turno');
  if(abilityId==='impulse')return usePiplusImpulse(state,unit,position);
  if(unit.championId==='onod')return useOnodAbility(state,unit,abilityId,targetId,position);
  if(unit.championId==='korgan')return useKorganAbility(state,unit,abilityId,targetId,position,pullDistance);
  if(unit.championId==='houngan')return useHouganAbility(state,unit,abilityId,targetId);
  const target = entityById(state, targetId);
  if(!abilityTargets(state,unitId,abilityId).includes(target.id)){
    if(['stonearmor','absorb','collapse','magnetism','shield','interference','rupture','fixation'].includes(abilityId))fail('INVALID_TARGET','Objetivo inválido para esta habilidad');
    if(!target.alive||target.team===unit.team)fail('INVALID_TARGET','Elegí una entidad enemiga viva');
    if(abilityId==='quake'?!quakeOrigin(state,unit,target):!abilityRangeContains(unit,abilityId,target))fail('OUT_OF_RANGE','Objetivo fuera del alcance');
    if(abilityLOSBlocked(state,unit,abilityId,target))fail('BLOCKED_LOS','Línea de visión bloqueada');
    if(ability.jump)fail('NO_LANDING','No hay una casilla cardinal libre para aterrizar');
    fail('INVALID_TARGET','Objetivo inválido');
  }
  if(abilityId==='collapse')collapseCells(target,direction);
  if(abilityId==='magnetism'&&!magnetismTargets(state,unitId,targetId).includes(secondaryTargetId))fail('INVALID_TARGET','Combatiente inválido para Magnetismo');
  const next = clone(state), actor = unitById(next, unitId), victim = entityById(next, targetId), events = [];
  const bonus = actor.championId==='arfeli'&&!actor.arfeliMasteryChain.includes(abilityId) ? actor.arfeliMasteryChain.length : 0;
  if(actor.championId==='arfeli'){actor.arfeliMasteryChain = bonus === 0 ? [abilityId] : [...actor.arfeliMasteryChain, abilityId];actor.arfeliMasteryLastBonus = bonus;}
  if(actor.championId==='coloso')actor.colosoCreateWindow=false;
  actor.pa -= ability.cost; actor.skillUsesThisTurn[abilityId] = (actor.skillUsesThisTurn[abilityId] ?? 0) + 1;
  events.push({ type: 'ability.used', unitId, abilityId, targetId, cost: ability.cost, masteryBonus: bonus });
  function damage(targetUnit, amount, source) {
    const result = damageWithDollEffect(next,targetUnit,amount,false,events,source);
    if(source==='poison.ability')poisonSymbiosis(next,targetUnit,result.hpLost,events);
  }
  if (actor.status.poison > 0) damage(actor, actor.status.poison, 'poison.ability');
  if (actor.alive){
    if(actor.championId==='piplus'){resolvePiplusSkill(next,actor,victim,abilityId,events,damage);}
    else if(['stonearmor','absorb','collapse','magnetism','quake'].includes(abilityId)){
      resolveColosoSkill(next,actor,victim,abilityId,{direction,secondaryTargetId},events,damage);
    }else     if(abilityId==='shield'){
      const amount=ability.shield+bonus;actor.shield.push({amount,sourceId:actor.id});
      events.push({type:'shield.added',unitId:actor.id,sourceId:actor.id,amount});
    }else {
      if(ability.jump){
        const from={x:actor.x,y:actor.y},landing=hammerLanding(next,actor,victim),distance=Math.abs(actor.x-landing.x)+Math.abs(actor.y-landing.y);
        actor.x=landing.x;actor.y=landing.y;
        if(distance){events.push({type:'unit.moved',unitId:actor.id,path:[from,{x:actor.x,y:actor.y}],kind:'jump',cost:0,remainingPm:actor.pm,source:'ability.hammer'});
          triggerKorganTraps(next,actor,events,'jump');
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
  if(state.phase!=='active'||activeUnit(state).id!==unitId||u.championId!=='coloso'||!u.colosoCreateWindow||u.colosoPillarCreatedThisTurn||state.objects.filter(o=>o.alive&&o.ownerId===u.id).length>=(u.monolith?3:2))return [];
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
  const korganGround=['trap_spikes','trap_mine','hunterstep'].includes(command.abilityId)?[clone(command.position)]:command.abilityId==='grenade'?korganGrenadeCells(command.position):null;
  return {
    effect: korganGround??(ABILITIES[command.abilityId]?.championId==='onod'?onodEffectCells(state,command):command.abilityId==='impulse'?[clone(command.position)]:command.abilityId==='collapse'?collapseCells(entityById(state,command.targetId),command.direction):[{x:entityById(state,command.targetId).x,y:entityById(state,command.targetId).y}]),
    moves: resolved.events.filter(e=>e.type==='unit.moved'),
    blocked: resolved.events.filter(e=>e.type==='movement.blocked'),
    damage: resolved.events.filter(e=>e.type==='damage.applied'),
    healing:resolved.events.filter(e=>['unit.healed','object.healed'].includes(e.type)),
    deaths: resolved.events.filter(e=>e.type==='unit.died').map(e=>e.unitId)
  };
}

export function executeCommand(state, command) {
  if (!command || typeof command.type !== 'string') fail('INVALID_COMMAND', 'Comando inválido');
  if (command.type === 'houganDollMove') return moveHouganDoll(state,command);
  if (command.type === 'houganDollEnd') return endHouganDollPhase(state,command);
  if (command.type === 'houganAction') return houganAction(state,command);
  if (command.type === 'korganAction') return korganAction(state,command);
  if (command.type === 'onodAction') return onodAction(state,command);
  if (command.type === 'piplusMark') return markPiplus(state,command);
  if (command.type === 'colosoAction') return colosoAction(state,command);
  if (command.type === 'createPillar') return createPillar(state,command);
  if (command.type === 'ability') return useAbility(state, command);
  if (command.type === 'move') return resolvePath(state, command.unitId, command.path);
  if (command.type === 'endTurn') return endTurn(state, { unitId: command.unitId });
  fail('UNSUPPORTED_COMMAND', `Comando fuera de alcance: ${command.type}`);
}

function consumePillar(p,events,source){p.hp=0;p.alive=false;p.shield=[];events.push({type:'object.destroyed',objectId:p.id,source});}
function pushOrPull(state,target,source,steps,away,collisionExtra,events,damage,label){
  if(target.kind!=='champion'||!target.alive)return;
  const [dx,dy]=forcedDirection(source,target,away);
  for(let i=0;i<steps&&target.alive;i++){
    const from={x:target.x,y:target.y},dest={x:target.x+dx,y:target.y+dy};
    const blocker=entities(state).find(e=>e.alive&&e.id!==target.id&&key(e)===key(dest));
    if(!inside(dest)||state.board.obstacles.includes(key(dest))||blocker){
      const amount=2*(steps-i)+collisionExtra;
      events.push({type:'movement.blocked',unitId:target.id,from,destination:dest,blockerId:blocker?.id??null,source:label});
      damage(target,amount,`collision.${label}`);if(blocker)damage(blocker,Math.floor(amount/2),`collision.${label}`);break;
    }
    target.x=dest.x;target.y=dest.y;
    events.push({type:'unit.moved',unitId:target.id,path:[from,dest],cost:0,remainingPm:target.pm,forced:true,source:label});
    triggerKorganTraps(state,target,events,label);
    if(target.alive&&target.status.wound)damage(target,target.status.wound,'wound.forced');
  }
}
function resolveColosoSkill(state,u,target,id,context,events,damage){
  if(id==='stonearmor'){
    u.stoneArmorTargetsUsed.push(target.id);target.shield.push({amount:10,sourceId:u.id});events.push({type:'shield.added',unitId:target.id,sourceId:u.id,amount:10});
  }else if(id==='absorb'){
    consumePillar(target,events,id);const amount=Math.min(15,u.maxHp-u.hp);u.hp+=amount;events.push({type:'unit.healed',unitId:u.id,amount});
  }else if(id==='collapse'){
    const hp=target.hp,cells=collapseCells(target,context.direction);consumePillar(target,events,id);
    for(const cell of cells){const t=entities(state).find(e=>e.alive&&e.team!==u.team&&key(e)===key(cell));if(t)damage(t,Math.max(3,hp-(cell.band==='near'?6:cell.band==='middle'?3:0)),'ability.collapse');}
  }else if(id==='magnetism'){
    pushOrPull(state,entityById(state,context.secondaryTargetId),target,2,false,0,events,damage,'magnetism');
  }else if(id==='quake'){
    const origin=quakeOrigin(state,u,target),used=new Set(origin.type==='pillar'?[origin.id]:[]);
    damage(target,origin.type==='pillar'?8:10,'ability.quake');
    pushOrPull(state,target,origin,1,true,2,events,damage,'quake');
    if(u.monolith&&target.kind==='champion')while(target.alive&&u.alive){
      const pillar=ownPillars(state,u).find(p=>!used.has(p.id)&&adjacent(p,target));if(!pillar)break;used.add(pillar.id);
      events.push({type:'pillar.replica',objectId:pillar.id,targetId:target.id});damage(target,6,'ability.replica');
      pushOrPull(state,target,pillar,1,true,2,events,damage,'replica');
    }
  }
}
export function colosoActionTargets(state,unitId,action){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==u.id||u.championId!=='coloso')return [];
  if(action==='exit')return u.monolith?[u.id]:[];
  if(action==='fusion')return !u.monolith&&!u.exitedMonolithThisTurn&&u.pa>=3?ownPillars(state,u).filter(p=>adjacent8(u,p)).map(p=>p.id):[];
  if(action==='recycle')return u.monolith&&!u.colosoRecycleUsed?ownPillars(state,u).map(p=>p.id):[];
  return [];
}
export function colosoAction(state,{unitId,action,targetId}){
  if(!colosoActionTargets(state,unitId,action).includes(targetId))fail('INVALID_TARGET','Acción propia de Coloso no disponible');
  const next=clone(state),u=unitById(next,unitId),target=entityById(next,targetId),events=[];u.colosoCreateWindow=false;
  if(action==='fusion'){
    u.pa-=3;consumePillar(target,events,action);u.monolithStoredPm=u.pm;u.pm=0;u.monolith=true;
  }else if(action==='exit'){
    u.monolith=false;u.exitedMonolithThisTurn=true;u.pm=u.monolithStoredPm;
  }else{
    consumePillar(target,events,action);u.colosoRecycleUsed=true;
    const damaged=ownPillars(next,u).filter(p=>p.hp<15).sort((a,b)=>a.hp-b.hp||a.number-b.number)[0];
    if(damaged){const amount=15-damaged.hp;damaged.hp=15;events.push({type:'object.healed',objectId:damaged.id,amount});}
    else{u.shield.push({amount:6,sourceId:u.id});events.push({type:'shield.added',unitId:u.id,sourceId:u.id,amount:6});}
  }
  events.push({type:'coloso.action',unitId,action,targetId,monolith:u.monolith});return {state:next,events};
}

function markedTarget(state,u){return state.units.find(t=>t.id===u.markedTargetId&&t.alive&&t.team!==u.team);}
const PIPLUS_OFFENSIVE=new Set(['precise','vector','interference','rupture']);
export function abilityLOSBlocked(state,u,id,target){
  if(!ABILITIES[id]?.los)return false;
  const fixed=u.championId==='piplus'&&PIPLUS_OFFENSIVE.has(id)&&markedTarget(state,u)?.id===target.id&&u.piplusFixationTargetId===target.id;
  return !fixed&&!clearAbilityLOS(state,u,target);
}
export function piplusMarkTargets(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==u.id||u.championId!=='piplus'||u.piplusMarkUsedThisTurn||u.piplusMarkBlockedThisTurn)return [];
  return state.units.filter(t=>t.alive&&t.team!==u.team&&distance(u,t)<=4&&clearAbilityLOS(state,u,t)).map(t=>t.id);
}
export function markPiplus(state,{unitId,targetId}){
  if(!piplusMarkTargets(state,unitId).includes(targetId))fail('MARK_UNAVAILABLE','No se puede marcar este objetivo ahora');
  const next=clone(state),u=unitById(next,unitId),target=unitById(next,targetId),old=markedTarget(next,u);
  if(old?.status.markedBy===u.id)old.status.markedBy=null;
  u.markedTargetId=target.id;target.status.markedBy=u.id;u.piplusMarkUsedThisTurn=true;
  return {state:next,events:[{type:'piplus.marked',unitId,targetId,cost:0}]};
}
function resolvePiplusSkill(state,u,target,id,events,damage){
  const marked=markedTarget(state,u)?.id===target.id;
  const fixed=marked&&u.piplusFixationTargetId===target.id&&PIPLUS_OFFENSIVE.has(id);
  if(id==='precise')damage(target,marked?10:8,'ability.precise');
  if(id==='vector'){damage(target,6,'ability.vector');pushOrPull(state,target,u,marked?2:1,true,0,events,damage,'vector');}
  if(id==='interference'){u.piplusInterferenceTargets.push(target.id);target.status.pmPenaltyNext=Math.max(target.status.pmPenaltyNext,1);events.push({type:'status.applied',targetId:target.id,status:'pmPenaltyNext',value:target.status.pmPenaltyNext});}
  if(id==='rupture'){damage(target,14,'ability.rupture');if(target.status.markedBy===u.id)target.status.markedBy=null;u.markedTargetId=null;u.piplusMarkBlockedThisTurn=true;u.piplusFixationTargetId=null;events.push({type:'piplus.mark.cleared',unitId:u.id,targetId:target.id});}
  if(id==='fixation'){u.piplusFixationTargetId=target.id;events.push({type:'piplus.fixed',unitId:u.id,targetId:target.id});}
  if(fixed&&id!=='rupture'){u.piplusFixationTargetId=null;events.push({type:'piplus.fixation.consumed',unitId:u.id,targetId:target.id});}
}
export function impulseDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==u.id||u.championId!=='piplus'||u.monolith||u.pa<2||(u.skillUsesThisTurn.impulse??0)>=1)return [];
  const occupied=occupiedKeys(state,u.id),out=[];
  for(const [dx,dy]of DIRECTIONS)for(const d of [1,2]){const p={x:u.x+dx*d,y:u.y+dy*d};if(inside(p)&&!occupied.has(key(p))&&!state.board.obstacles.includes(key(p)))out.push(p);}
  return out;
}
function usePiplusImpulse(state,unit,position){
  if(!impulseDestinations(state,unit.id).some(p=>p.x===position?.x&&p.y===position?.y))fail('INVALID_POSITION','Impulso requiere una casilla cardinal libre a distancia 1 o 2');
  const next=clone(state),u=unitById(next,unit.id),events=[];u.pa-=2;u.skillUsesThisTurn.impulse=(u.skillUsesThisTurn.impulse??0)+1;
  events.push({type:'ability.used',unitId:u.id,abilityId:'impulse',position:clone(position),cost:2});
  const damage=(target,amount,source)=>{const result=applyDamageToUnit(target,amount,false);events.push({type:'damage.applied',targetId:target.id,amount,...result,ignoreShield:false,source});if(source==='poison.ability')poisonSymbiosis(next,target,result.hpLost,events);if(result.killed)events.push(target.kind==='object'?{type:'object.destroyed',objectId:target.id}:{type:'unit.died',unitId:target.id});};
  if(u.status.poison)damage(u,u.status.poison,'poison.ability');
  if(!u.alive){finishIfNeeded(next,events);return {state:next,events};}
  const dx=Math.sign(position.x-u.x),dy=Math.sign(position.y-u.y);
  const enemy=next.units.find(t=>t.alive&&t.team!==u.team&&t.x===u.x-dx&&t.y===u.y-dy);
  if(enemy){pushOrPull(next,enemy,u,1,true,0,events,damage,'impulse');if(finishIfNeeded(next,events))return {state:next,events};}
  const from={x:u.x,y:u.y},d=distance(u,position);u.x=position.x;u.y=position.y;
  events.push({type:'unit.moved',unitId:u.id,path:[from,clone(position)],kind:'dash',cost:0,remainingPm:u.pm,source:'ability.impulse'});
  triggerKorganTraps(next,u,events,'impulse');
  for(let i=0;i<d&&u.alive;i++)if(u.status.wound)damage(u,u.status.wound,'wound.impulse');
  finishIfNeeded(next,events);return {state:next,events};
}


function activeOwnTraps(state,u){return state.traps.filter(t=>t.active&&t.ownerId===u.id).sort((a,b)=>a.number-b.number);}
function triggerKorganTraps(state,target,events,source='movement'){
  if(!target?.alive||!(target.kind==='champion'||target.type==='doll'))return 0;
  let count=0;
  for(const trap of state.traps.filter(t=>t.active&&t.team!==target.team&&t.x===target.x&&t.y===target.y)){
    trap.active=false;count++;
    events.push({type:'trap.triggered',trapId:trap.id,trapType:trap.trapType,x:trap.x,y:trap.y,targetId:target.id,source});
    const amount=trap.trapType==='spikes'?10:8,result=damageWithDollEffect(state,target,amount,false,events,`trap.${trap.trapType}`);
    if(result.killed)break;
    if(target.kind==='champion'&&trap.trapType==='spikes'){const before=target.status.wound;target.status.wound=Math.min(3,before+1);events.push({type:'status.applied',targetId:target.id,status:'wound',amount:target.status.wound-before,value:target.status.wound});}
    else if(target.kind==='champion'&&trap.trapType==='mine'){const before=target.pa;target.pa=Math.max(0,target.pa-1);events.push({type:'resource.lost',targetId:target.id,resource:'pa',amount:before-target.pa,value:target.pa,source:'trap.mine'});}
  }
  return count;
}
export function korganTrapDestinations(state,unitId,abilityId){
  validateSupportedState(state);const u=unitById(state,unitId),a=ABILITIES[abilityId];
  if(!['trap_spikes','trap_mine'].includes(abilityId)||u.championId!=='korgan'||state.phase!=='active'||activeUnit(state).id!==u.id||u.pa<a.cost||(a.maxUses&&(u.skillUsesThisTurn[abilityId]??0)>=a.maxUses)||activeOwnTraps(state,u).length>=3)return [];
  const occupied=occupiedKeys(state,null),ownCells=new Set(activeOwnTraps(state,u).map(key)),out=[];
  for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){const p={x,y},d=distance(u,p);if(d>=1&&d<=3&&!occupied.has(key(p))&&!state.board.obstacles.includes(key(p))&&!ownCells.has(key(p))&&clearAbilityLOS(state,u,p))out.push(p);}
  return out;
}
export function hunterStepDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId),a=ABILITIES.hunterstep;
  if(u.championId!=='korgan'||state.phase!=='active'||activeUnit(state).id!==u.id||u.pa<a.cost||(u.skillUsesThisTurn.hunterstep??0)>=1)return [];
  const occupied=occupiedKeys(state,u.id),out=[];
  for(const [dx,dy] of DIRECTIONS)for(const d of [1,2]){
    let ok=true;for(let step=1;step<=d;step++){const p={x:u.x+dx*step,y:u.y+dy*step};if(!inside(p)||occupied.has(key(p))||state.board.obstacles.includes(key(p))){ok=false;break;}}
    if(ok)out.push({x:u.x+dx*d,y:u.y+dy*d});
  }
  return out;
}
export function korganGrenadeCells(position){
  if(!inside(position))return [];
  return [{...position,zone:'center'},...DIRECTIONS.map(([dx,dy])=>({x:position.x+dx,y:position.y+dy,zone:'arm'}))].filter(inside);
}
export function korganGrenadeDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId),a=ABILITIES.grenade,out=[];
  if(u.championId!=='korgan'||state.phase!=='active'||activeUnit(state).id!==u.id||u.pa<a.cost)return [];
  for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){const p={x,y},d=distance(u,p);if(d>=1&&d<=3&&clearAbilityLOS(state,u,p))out.push(p);}
  return out;
}
export function korganDisarmTargets(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(u.championId!=='korgan'||state.phase!=='active'||activeUnit(state).id!==u.id||u.korganDisarmUsedThisTurn)return [];
  return activeOwnTraps(state,u).map(t=>t.id);
}
export function korganAction(state,{unitId,action,targetId}){
  if(action!=='disarm'||!korganDisarmTargets(state,unitId).includes(targetId))fail('KORGAN_ACTION_UNAVAILABLE','Desarmar no disponible');
  const next=clone(state),u=unitById(next,unitId),trap=next.traps.find(t=>t.id===targetId),events=[];
  trap.active=false;u.korganDisarmUsedThisTurn=true;u.pa+=1;
  events.push({type:'trap.disarmed',trapId:trap.id,unitId:u.id},{type:'resource.gained',unitId:u.id,resource:'pa',amount:1});
  return {state:next,events};
}
function useKorganAbility(state,unit,id,targetId,position,pullDistance){
  const a=ABILITIES[id];
  if(['trap_spikes','trap_mine'].includes(id)&&!korganTrapDestinations(state,unit.id,id).some(p=>p.x===position?.x&&p.y===position?.y))fail('INVALID_POSITION','Casilla inválida para la trampa');
  if(id==='grenade'&&!korganGrenadeDestinations(state,unit.id).some(p=>p.x===position?.x&&p.y===position?.y))fail('INVALID_POSITION','Centro de Granada inválido');
  if(id==='hunterstep'&&!hunterStepDestinations(state,unit.id).some(p=>p.x===position?.x&&p.y===position?.y))fail('INVALID_POSITION','Paso del Cazador requiere 1 o 2 casillas cardinales libres');
  if(['shot','hook'].includes(id)&&!abilityTargets(state,unit.id,id).includes(targetId))fail('INVALID_TARGET','Objetivo inválido para Korgan');
  if(id==='hook'&&![1,2].includes(pullDistance))fail('INVALID_DISTANCE','Gancho requiere elegir atracción 1 o 2');
  const next=clone(state),u=unitById(next,unit.id),events=[];
  const damage=(t,amount,source)=>{const result=damageWithDollEffect(next,t,amount,false,events,source);if(source==='poison.ability')poisonSymbiosis(next,t,result.hpLost,events);};
  u.pa-=a.cost;u.skillUsesThisTurn[id]=(u.skillUsesThisTurn[id]??0)+1;events.push({type:'ability.used',unitId:u.id,abilityId:id,cost:a.cost,...(targetId?{targetId}:{}),...(position?{position:clone(position)}:{}),...(pullDistance?{distance:pullDistance}:{})});
  if(u.status.poison)damage(u,u.status.poison,'poison.ability');
  if(!u.alive){finishIfNeeded(next,events);return {state:next,events};}
  if(['trap_spikes','trap_mine'].includes(id)){
    let number=next.nextTrapId??Math.max(0,...next.traps.map(t=>t.number))+1;while(next.traps.some(t=>t.id===`trap${number}`))number++;next.nextTrapId=number+1;
    const trap={id:`trap${number}`,number,kind:'trap',trapType:id==='trap_spikes'?'spikes':'mine',ownerId:u.id,team:u.team,x:position.x,y:position.y,active:true,hidden:true,createdByKorganTurn:u.korganTurnSerial};
    next.traps.push(trap);events.push({type:'trap.created',trap:clone(trap),unitId:u.id});
  }else if(id==='grenade'){
    const center={x:position.x,y:position.y},cells=korganGrenadeCells(center),victims=entities(next).filter(t=>t.alive&&t.team!==u.team&&cells.some(c=>c.x===t.x&&c.y===t.y));
    for(const t of victims){const cell=cells.find(c=>c.x===t.x&&c.y===t.y);damage(t,cell.zone==='center'?10:6,`ability.grenade.${cell.zone}`);}
    for(const t of victims){const cell=cells.find(c=>c.x===t.x&&c.y===t.y);if(t.alive&&t.kind==='champion'&&cell?.zone==='arm')pushOrPull(next,t,center,1,true,0,events,damage,'grenade');}
  }else if(id==='shot'){damage(entityById(next,targetId),10,'ability.shot');}
  else if(id==='hook'){const target=unitById(next,targetId);damage(target,6,'ability.hook');if(target.alive)pushOrPull(next,target,u,pullDistance,false,0,events,damage,'hook');}
  else if(id==='hunterstep'){
    const dx=Math.sign(position.x-u.x),dy=Math.sign(position.y-u.y),steps=distance(u,position),path=[{x:u.x,y:u.y}];
    for(let i=0;i<steps&&u.alive;i++){u.x+=dx;u.y+=dy;path.push({x:u.x,y:u.y});triggerKorganTraps(next,u,events,'hunterstep');if(u.alive&&u.status.wound)damage(u,u.status.wound,'wound.hunterstep');}
    events.push({type:'unit.moved',unitId:u.id,path,kind:'dash',cost:0,remainingPm:u.pm,source:'ability.hunterstep'});
  }
  finishIfNeeded(next,events);return {state:next,events};
}


function linkedTarget(state,u){return u.linkedTargetId?state.units.find(t=>t.id===u.linkedTargetId&&t.alive)??null:null;}
function ownedDoll(state,u){return state.objects.find(o=>o.alive&&o.type==='doll'&&o.ownerId===u.id)??null;}
function dollAssociationActive(state,doll){
  if(!doll?.alive||doll.type!=='doll')return false;
  const owner=state.units.find(u=>u.id===doll.ownerId),target=state.units.find(u=>u.id===doll.linkedTargetId);
  return !!(owner?.alive&&owner.championId==='houngan'&&target?.alive&&owner.linkedTargetId===doll.linkedTargetId);
}
function matchingDoll(state,u){
  const doll=ownedDoll(state,u),target=linkedTarget(state,u);
  if(!doll?.alive||!target?.alive||doll.linkedTargetId!==target.id||!dollAssociationActive(state,doll))return null;
  return doll;
}
function painTransferStateValid(state,u){
  const active=u?.houganPainTransfer,doll=active?state.objects.find(o=>o.id===active.dollId):null,target=active?state.units.find(t=>t.id===active.targetId):null;
  return !!(u?.alive&&u.championId==='houngan'&&active&&doll?.alive&&target?.alive&&u.linkedTargetId===active.targetId&&ownedDoll(state,u)?.id===active.dollId&&doll.linkedTargetId===active.targetId&&dollAssociationActive(state,doll));
}
function danceStateValid(state,u){
  const active=u?.houganDance,doll=active?state.objects.find(o=>o.id===active.dollId):null,target=active?state.units.find(t=>t.id===active.targetId):null;
  return !!(u?.alive&&u.championId==='houngan'&&active&&doll?.alive&&target?.alive&&u.linkedTargetId===active.targetId&&ownedDoll(state,u)?.id===active.dollId&&doll.linkedTargetId===active.targetId&&dollAssociationActive(state,doll));
}
function clearHouganAdvancedState(u,field,events,reason=''){
  if(!u?.[field])return false;
  u[field]=null;
  events?.push({type:'hougan.state.cleared',unitId:u.id,state:field==='houganPainTransfer'?'paintransfer':'dance',reason});
  return true;
}
function pruneHouganStates(state,u,events,reason=''){
  if(!u||u.championId!=='houngan')return;
  if(u.houganPainTransfer&&!painTransferStateValid(state,u))clearHouganAdvancedState(u,'houganPainTransfer',events,reason||'link_or_doll_mismatch');
  if(u.houganDance&&!danceStateValid(state,u))clearHouganAdvancedState(u,'houganDance',events,reason||'link_or_doll_mismatch');
}
function pruneAllHouganStates(state,events,reason=''){for(const u of state.units)pruneHouganStates(state,u,events,reason);}
function setHouganLink(state,u,target,events,extra={}){
  const before=u.linkedTargetId??null,nextId=target?.id??null;
  u.linkedTargetId=nextId;
  events.push({type:'link.changed',unitId:u.id,targetId:nextId,mode:target?(target.team===u.team?'ally':'enemy'):null,...extra});
  if(before!==nextId)pruneHouganStates(state,u,events,'link_changed');
}

function applyDollEffect(state,doll,realLost,events,associationActive=dollAssociationActive(state,doll)){
  if(realLost<=0||!associationActive)return;
  const target=state.units.find(u=>u.id===doll.linkedTargetId);if(!target?.alive)return;
  const effect=Math.ceil(realLost/2);
  if(doll.linkMode==='enemy'){
    const result=applyDamageToUnit(target,effect,false);
    events.push({type:'damage.applied',targetId:target.id,amount:effect,...result,ignoreShield:false,source:'doll.enemy'});
    if(result.killed)events.push({type:'unit.died',unitId:target.id});
  }else healEntity(target,effect,events,'doll.ally');
}
function damageWithDollEffect(state,target,amount,ignoreShield,events,source){
  const associationActive=target.type==='doll'&&dollAssociationActive(state,target);
  const result=applyDamageToUnit(target,amount,ignoreShield);
  events.push({type:'damage.applied',targetId:target.id,amount,...result,ignoreShield,source});
  if(target.type==='doll'&&result.hpLost>0)applyDollEffect(state,target,result.hpLost,events,associationActive);
  if(result.killed)events.push(target.kind==='object'?{type:'object.destroyed',objectId:target.id}:{type:'unit.died',unitId:target.id});
  return result;
}
export function houganDollDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId),target=linkedTarget(state,u);
  if(state.phase!=='active'||state.dollPhase||activeUnit(state).id!==u.id||u.championId!=='houngan'||u.pa<2||!target)return [];
  const occupied=occupiedKeys(state,u.id);occupied.add(key(u));const out=[];
  for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++){const p={x,y},d=distance(u,p);if(d>=1&&d<=3&&!occupied.has(key(p))&&!state.board.obstacles.includes(key(p))&&clearAbilityLOS(state,u,p))out.push(p);}
  return out;
}
export function houganAction(state,{unitId,action,position}){
  if(action!=='doll'||!houganDollDestinations(state,unitId).some(p=>p.x===position?.x&&p.y===position?.y))fail('HOUGAN_ACTION_UNAVAILABLE','Muñeco Vudú no disponible');
  const next=clone(state),u=unitById(next,unitId),target=linkedTarget(next,u),events=[];
  const old=ownedDoll(next,u);if(old){old.hp=0;old.alive=false;old.shield=[];events.push({type:'object.destroyed',objectId:old.id,source:'hougan.doll.replace'});}
  let number=next.nextDollId??Math.max(0,...next.objects.filter(o=>o.type==='doll').map(o=>o.number))+1;
  while(entities(next).some(e=>e.id===`doll${number}`))number++;next.nextDollId=number+1;u.pa-=2;
  const mode=target.team===u.team?'ally':'enemy',maxHp=mode==='ally'?20:16;
  const object={id:`doll${number}`,number,type:'doll',kind:'object',ownerId:u.id,team:u.team,x:position.x,y:position.y,hp:maxHp,maxHp,alive:true,shield:[],blocksLOS:false,linkedTargetId:target.id,linkMode:mode,movePm:3};
  next.objects.push(object);events.push({type:'object.created',object:clone(object),unitId,cost:2});
  pruneHouganStates(next,u,events,'doll_replaced');
  return {state:next,events};
}
function useHouganAbility(state,unit,id,targetId){
  if(!['needle','transfer','ritual','curse','paintransfer','dance'].includes(id)||!abilityTargets(state,unit.id,id).includes(targetId))fail('INVALID_TARGET','Objetivo inválido para la habilidad de Hougan');
  const next=clone(state),u=unitById(next,unit.id),target=entityById(next,targetId),events=[],a=ABILITIES[id];
  u.pa-=a.cost;u.skillUsesThisTurn[id]=(u.skillUsesThisTurn[id]??0)+1;events.push({type:'ability.used',unitId:u.id,abilityId:id,cost:a.cost,targetId});
  if(u.status.poison){const result=damageWithDollEffect(next,u,u.status.poison,false,events,'poison.ability');poisonSymbiosis(next,u,result.hpLost,events);}
  if(!u.alive){finishIfNeeded(next,events);return {state:next,events};}
  if(id==='needle'){
    if(target.team===u.team){healEntity(target,6,events,'ability.needle');setHouganLink(next,u,target,events);}
    else{const result=damageWithDollEffect(next,target,6,false,events,'ability.needle');if(!result.killed)setHouganLink(next,u,target,events);}
  }else if(id==='transfer'){
    const missing=Math.max(0,u.maxHp-u.hp),requested=Math.min(8,missing),got=healEntity(u,requested,events,'ability.transfer');
    if(got>0)damageWithDollEffect(next,target,got,false,events,'ability.transfer');
  }else if(id==='ritual'){
    const doll=ownedDoll(next,u),bonus=!!(doll&&dollAssociationActive(next,doll)&&doll.linkedTargetId===target.id&&adjacent(doll,target));
    damageWithDollEffect(next,target,bonus?20:14,false,events,'ability.ritual');
    setHouganLink(next,u,null,events,{consumedBy:'ritual'});
  }else if(id==='curse'){
    const result=damageWithDollEffect(next,target,8,false,events,'ability.curse');
    if(!result.killed&&target.kind==='champion'){target.status.poison=Math.min(6,target.status.poison+1);events.push({type:'status.applied',targetId:target.id,status:'poison',value:target.status.poison});}
  }else if(id==='paintransfer'){
    const doll=matchingDoll(next,u);u.houganPainTransfer={dollId:doll.id,targetId:u.linkedTargetId};
    events.push({type:'status.applied',targetId:u.id,status:'houganPainTransfer',value:true,dollId:doll.id,linkedTargetId:u.linkedTargetId});
  }else if(id==='dance'){
    const doll=matchingDoll(next,u);u.houganDance={dollId:doll.id,targetId:u.linkedTargetId};
    events.push({type:'status.applied',targetId:u.id,status:'houganDance',value:true,dollId:doll.id,linkedTargetId:u.linkedTargetId});
  }
  finishIfNeeded(next,events);return {state:next,events};
}

function ownSprouts(state,u){return state.objects.filter(s=>s.alive&&s.type==='sprout'&&s.ownerId===u.id).sort((a,b)=>a.number-b.number);}
function absorbableSprouts(state,u){return ownSprouts(state,u).filter(s=>s.createdByOnodTurn!==u.onodTurnSerial);}
function healEntity(target,amount,events,source){const got=Math.min(amount,target.maxHp-target.hp);if(got>0){target.hp+=got;events.push({type:target.kind==='object'?'object.healed':'unit.healed',unitId:target.kind==='champion'?target.id:undefined,objectId:target.kind==='object'?target.id:undefined,amount:got,source});}return got;}
function poisonSymbiosis(state,victim,realDamage,events){
  if(realDamage<=0)return;
  for(const u of state.units.filter(u=>u.alive&&u.championId==='onod'&&u.team!==victim.team))for(const s of ownSprouts(state,u).filter(s=>adjacent(s,victim)))healEntity(s,realDamage,events,'symbiosis.poison');
}
export function onodActionTargets(state,unitId,action){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==u.id||u.championId!=='onod')return [];
  if(action==='wither')return u.onodWitherUsedThisTurn?[]:ownSprouts(state,u).map(s=>s.id);
  return [];
}
export function germinateDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId);
  if(state.phase!=='active'||activeUnit(state).id!==u.id||u.championId!=='onod'||u.pa<1||u.onodGerminateBlockedThisTurn||u.onodGerminateUses>=2||ownSprouts(state,u).length>=3)return [];
  const occupied=occupiedKeys(state,u.id);occupied.add(key(u));const out=[];
  for(let y=0;y<12;y++)for(let x=0;x<12;x++){const p={x,y};if(distance(u,p)<=3&&!occupied.has(key(p))&&!state.board.obstacles.includes(key(p))&&clearAbilityLOS(state,u,p))out.push(p);}
  return out;
}
export function onodAction(state,{unitId,action,targetId,position}){
  if(action==='germinate'?!germinateDestinations(state,unitId).some(p=>p.x===position?.x&&p.y===position?.y):!onodActionTargets(state,unitId,action).includes(targetId))fail('ONOD_ACTION_UNAVAILABLE','Acción propia de Onod no disponible');
  const next=clone(state),u=unitById(next,unitId),events=[];
  if(action==='germinate'){
    let number=next.nextSproutId??Math.max(0,...next.objects.filter(s=>s.type==='sprout').map(s=>s.number))+1;
    while(entities(next).some(e=>e.id===`sprout${number}`))number++;
    next.nextSproutId=number+1;u.pa--;u.onodGerminateUses++;
    const object={id:`sprout${number}`,number,type:'sprout',kind:'object',ownerId:u.id,team:u.team,x:position.x,y:position.y,hp:12,maxHp:12,alive:true,shield:[],blocksLOS:false,createdByOnodTurn:u.onodTurnSerial};
    next.objects.push(object);events.push({type:'object.created',object:clone(object),unitId,cost:1});
  }else{consumePillar(entityById(next,targetId),events,'wither');u.onodWitherUsedThisTurn=true;}
  return {state:next,events};
}
export function vinesDestinations(state,unitId){
  validateSupportedState(state);const u=unitById(state,unitId),a=ABILITIES.vines;
  if(u.championId!=='onod'||state.phase!=='active'||activeUnit(state).id!==u.id||u.pa<a.cost)return [];
  const cells=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++){const p={x,y};if(distance(u,p)<=3&&clearAbilityLOS(state,u,p))cells.push(p);}return cells;
}
export function onodEffectCells(state,{unitId,abilityId,targetId,position}){
  const u=unitById(state,unitId),target=targetId?entityById(state,targetId):null;
  if(abilityId==='vines')return [{...position,zone:'center'},...DIRECTIONS.map(([dx,dy])=>({x:position.x+dx,y:position.y+dy,zone:'arm'}))].filter(inside);
  if(abilityId==='spores'){const cells=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){const p={x:target.x+dx,y:target.y+dy};if(inside(p))cells.push(p);}return cells;}
  if(abilityId==='awakening'){const cells=new Map();for(const s of ownSprouts(state,u))for(const [dx,dy]of DIRECTIONS){const p={x:s.x+dx,y:s.y+dy};if(inside(p)){const prev=cells.get(key(p));cells.set(key(p),{...p,hits:(prev?.hits??0)+1});}}return [...cells.values()];}
  if(abilityId==='reabsorption')return absorbableSprouts(state,u).map(s=>({x:s.x,y:s.y}));
  return target?[{x:target.x,y:target.y}]:[];
}
function useOnodAbility(state,unit,id,targetId,position){
  if(id==='vines'?!vinesDestinations(state,unit.id).some(p=>p.x===position?.x&&p.y===position?.y):!abilityTargets(state,unit.id,id).includes(targetId))fail('INVALID_TARGET','Objetivo o centro inválido para Onod');
  const next=clone(state),u=unitById(next,unit.id),target=targetId?entityById(next,targetId):null,events=[];
  u.pa-=ABILITIES[id].cost;u.skillUsesThisTurn[id]=(u.skillUsesThisTurn[id]??0)+1;
  events.push({type:'ability.used',unitId:u.id,abilityId:id,cost:ABILITIES[id].cost,...(targetId?{targetId}:{}),...(position?{position:clone(position)}:{})});
  const damage=(t,amount,source)=>{const result=damageWithDollEffect(next,t,amount,false,events,source);if(source==='poison.ability')poisonSymbiosis(next,t,result.hpLost,events);};
  if(u.status.poison)damage(u,u.status.poison,'poison.ability');
  if(!u.alive){finishIfNeeded(next,events);return {state:next,events};}
  const poison=t=>{if(t.alive&&t.kind==='champion'){t.status.poison=Math.min(6,t.status.poison+1);events.push({type:'status.applied',targetId:t.id,status:'poison',value:t.status.poison});}};
  if(id==='thorn'){damage(target,6,'ability.thorn');poison(target);}
  if(id==='sap'){
    const adjacentSprouts=ownSprouts(next,u).filter(s=>adjacent(s,target));
    if(healEntity(target,adjacentSprouts.length?12:8,events,'ability.sap')>0)for(const s of adjacentSprouts)healEntity(s,4,events,'symbiosis.heal');
  }
  if(['vines','spores','awakening'].includes(id))for(const cell of onodEffectCells(next,{unitId:u.id,abilityId:id,targetId,position})){
    const t=entities(next).find(t=>t.alive&&t.team!==u.team&&key(t)===key(cell));if(!t)continue;
    damage(t,id==='vines'?(cell.zone==='center'?6:4):id==='awakening'?8*cell.hits:8,`ability.${id}`);
    if(id==='spores')poison(t);
    if(id==='vines'&&t.alive&&t.kind==='champion'){t.status.pmPenaltyNext=Math.max(t.status.pmPenaltyNext,1);events.push({type:'status.applied',targetId:t.id,status:'pmPenaltyNext',value:t.status.pmPenaltyNext});}
  }
  if(id==='reabsorption'){const eligible=absorbableSprouts(next,u);for(const s of eligible)consumePillar(s,events,id);u.pa+=eligible.length;u.onodGerminateBlockedThisTurn=true;u.onodReabsorptionUsedThisTurn=true;events.push({type:'resource.gained',unitId:u.id,resource:'pa',amount:eligible.length});}
  finishIfNeeded(next,events);return {state:next,events};
}
