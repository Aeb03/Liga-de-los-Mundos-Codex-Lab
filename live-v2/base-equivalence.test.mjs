import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import {
  calculatePath, championDefinitions, createUnit, endTurn, initializeCombat, movementAvailable
} from './combat-core.mjs';

const BASE = '0b4983953a37fca0a60867f1007f78c67b263683';
const baseFile = path => execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8' });

function balancedFrom(source, start, open = '{', close = '}') {
  let depth = 0, quote = null, escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === open) depth++;
    if (char === close && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error('Bloque sin cierre en fuente base');
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`No se encontró ${name} en la base`);
  const brace = source.indexOf('{', start);
  return source.slice(start, brace) + balancedFrom(source, brace);
}

function constObject(source, name) {
  const marker = `const ${name}=`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`No se encontró ${name} en la base`);
  const brace = source.indexOf('{', start + marker.length);
  return vm.runInNewContext(`(${balancedFrom(source, brace)})`);
}

function assignedFunction(source, assignment) {
  const start = source.indexOf(`${assignment}=function`);
  if (start < 0) throw new Error(`No se encontró wrapper ${assignment} en la base`);
  const functionStart = source.indexOf('function', start);
  const brace = source.indexOf('{', functionStart);
  return source.slice(functionStart, brace) + balancedFrom(source, brace);
}

const make = (championId, id, team, position) => createUnit({ championId, id, team, slot: 0, controllerId: team, position });

test('las fichas coinciden con las definiciones efectivas de los seis reworks de la base', () => {
  const files = {
    arfeli: ['arfeli-rework-0626.js', 'ARFELI_DEF'], coloso: ['coloso-rework-0627.js', 'COLOSO_DEF'],
    piplus: ['piplus-rework-0628.js', 'PIPLUS_DEF'], onod: ['onod-rework-0629.js', 'ONOD_DEF'],
    korgan: ['korgan-rework-0630.js', 'KORGAN_DEF'], houngan: ['hougan-rework-0631.js', 'HOUGAN_DEF']
  };
  const effective = Object.fromEntries(Object.entries(files).map(([id, [file, constant]]) => {
    const value = constObject(baseFile(file), constant);
    return [id, { name: id === 'houngan' ? 'Hougan' : id[0].toUpperCase() + id.slice(1), hp: value.hp, pa: value.pa, pm: value.pm, initiative: value.ini }];
  }));
  assert.deepEqual(championDefinitions(), effective);
});

function baseMovement(units, obstacles) {
  const source = baseFile('app.js');
  const context = {
    B: { units, pillars: [] }, SIZE: 12, FIXED_OBS: new Set(obstacles),
    key: (x, y) => `${x},${y}`, inside: (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12
  };
  context.isFixedObstacle = (x, y) => context.FIXED_OBS.has(context.key(x, y));
  context.allEntities = () => context.B.units.filter(unit => unit.alive);
  context.entityAt = (x, y) => context.allEntities().find(entity => entity.x === x && entity.y === y) || null;
  vm.createContext(context);
  vm.runInContext(`${functionSource(source, 'movementMap')}\n${functionSource(source, 'gridPath')}\nthis.runMap=movementMap;this.runPath=gridPath;`, context);
  return context;
}

test('alcance y recorrido BFS coinciden ejecutando movementMap/gridPath de la base', () => {
  const a = make('korgan', 'a', 'red', { x: 1, y: 1 }), b = make('onod', 'b', 'blue', { x: 3, y: 1 });
  a.initiative = 10;
  const state = initializeCombat({ units: [a, b], obstacles: [{ x: 2, y: 1 }], random: 0 }).state;
  const base = baseMovement(state.units.map(unit => ({ ...unit, side: unit.team, kind: 'unit' })), ['2,1']);
  const baseReach = [...base.runMap(base.B.units[0])].map(([tile, cost]) => ({ tile, cost }));
  const coreReach = movementAvailable(state, 'a').map(({ x, y, cost }) => ({ tile: `${x},${y}`, cost }));
  assert.deepEqual(coreReach, baseReach);
  assert.equal(JSON.stringify(calculatePath(state, 'a', { x: 2, y: 2 })), JSON.stringify(base.runPath(base.B.units[0], { x: 2, y: 2 }).map(([x, y]) => ({ x, y }))));
});

function baseTurnHarness(unit, opponent) {
  const source = baseFile('app.js'), logs = [];
  const context = {
    B: { units: [unit, opponent], pillars: [], order: [unit.id, opponent.id], turn: 0, ended: false, noticeSeq: 0 },
    timerId: null, clearInterval() {}, setInterval() { return 1; }, setTimeout() {},
    log(message) { logs.push(message); }, feedback() {}, renderBattle() {}, checkBattleEnd() { return false; },
    aiTurn() {}, ownedPillars() { return []; }, isCombatObject() { return false; }, getEntity() { return null; }
  };
  vm.createContext(context);
  const names = ['cur', 'expireShieldsFromSource', 'expireOrphanedShields', 'applyDamage', 'halveStatusEndTurn', 'ageShieldStacks', 'beginTurn', 'endTurnEffects'];
  vm.runInContext(`${names.map(name => functionSource(source, name)).join('\n')}\nthis.start=beginTurn;this.end=endTurnEffects;`, context);
  return { context, logs };
}

test('Quemadura y escudo al inicio y cierre coinciden con la cadena efectiva base', () => {
  const baseActive = { id: 'a', name: 'Arfeli', championId: 'arfeli', side: 'red', controller: 'human', kind: 'unit', alive: true, hp: 100, maxHp: 100, pa: 6, maxPa: 6, pm: 3, maxPm: 3, shieldStacks: [{ amount: 10, turns: 1, sourceOwnerId: 'b' }], status: { wound: 0, poison: 0, burn: 3, paPenaltyNext: 0, pmPenaltyNext: 0 } };
  const baseEnemy = { id: 'b', side: 'blue', kind: 'unit', alive: true, hp: 90, shieldStacks: [], status: { wound: 0, poison: 0, burn: 0, paPenaltyNext: 0, pmPenaltyNext: 0 } };
  const baseStart = baseTurnHarness(structuredClone(baseActive), structuredClone(baseEnemy));
  baseStart.context.start();
  const coreActive = make('arfeli', 'a', 'red', { x: 0, y: 0 }); coreActive.initiative = 10; coreActive.status.burn = 3; coreActive.shield = [{ amount: 10, sourceId: 'b' }];
  const initialized = initializeCombat({ units: [coreActive, make('houngan', 'b', 'blue', { x: 11, y: 11 })], random: 0 });
  assert.deepEqual([initialized.state.units[0].hp, initialized.state.units[0].shield[0].amount], [baseStart.context.B.units[0].hp, baseStart.context.B.units[0].shieldStacks[0].amount]);

  const baseEnd = baseTurnHarness(structuredClone(baseActive), structuredClone(baseEnemy)); baseEnd.context.end(baseEnd.context.B.units[0]);
  let coreState = initializeCombat({ units: [make('arfeli', 'a', 'red', { x: 0, y: 0 }), make('houngan', 'b', 'blue', { x: 11, y: 11 })], random: 0 }).state;
  coreState.units[0].status.burn = 3; coreState.units[0].shield = [{ amount: 10, sourceId: 'b' }];
  const coreEnd = endTurn(coreState, { unitId: coreState.order[0] }); coreState = coreEnd.state;
  const burnEvent = coreEnd.events.find(event => event.source === 'burn.end');
  assert.deepEqual([coreState.units[0].hp, burnEvent.absorbed, coreState.units[0].status.burn], [baseEnd.context.B.units[0].hp, 10 - baseEnd.context.B.units[0].shieldStacks[0].amount, baseEnd.context.B.units[0].status.burn]);
});

test('los resets pertinentes de los seis campeones coinciden con los wrappers efectivos', () => {
  const balanceSource = baseFile('balance-playtest.js');
  const configs = {
    arfeli: { file: 'arfeli-rework-0626.js', idName: 'ARFELI_ID', helper: 'resetMastery', baseName: '_arfeliBaseBeginTurn', fields: ['arfeliMasteryChain', 'arfeliMasteryLastBonus'] },
    coloso: { file: 'coloso-rework-0627.js', idName: 'COLOSO_ID', predicate: 'isColoso', baseName: '_colosoBaseBeginTurn', fields: ['colosoTurnSerial', 'colosoCreateWindow', 'colosoPillarCreatedThisTurn', 'colosoRecycleUsed', 'stoneArmorTargetsUsed'] },
    piplus: { file: 'piplus-rework-0628.js', idName: 'PIPLUS_ID', predicate: 'isPiplus', baseName: '_piplusBaseBeginTurn', fields: ['piplusMarkUsedThisTurn', 'piplusMarkBlockedThisTurn', 'piplusFixationTargetId', 'piplusInterferenceTargets'] },
    onod: { file: 'onod-rework-0629.js', idName: 'ONOD_ID', predicate: 'isOnod', baseName: '_onodBaseBeginTurn', fields: ['onodTurnSerial', 'onodGerminateUses', 'onodWitherUsedThisTurn', 'onodGerminateBlockedThisTurn'] },
    korgan: { file: 'korgan-rework-0630.js', idName: 'KORGAN_ID', predicate: 'isKorgan', baseName: '_korganBaseBeginTurn', fields: ['korganTurnSerial', 'korganDisarmUsedThisTurn'] },
    houngan: { fields: [] }
  };
  for (const [championId, config] of Object.entries(configs)) {
    const active = make(championId, 'a', 'red', { x: 0, y: 0 }); active.initiative = 99;
    Object.assign(active, {
      sproutRemovedThisTurn: true, trapRemovedThisTurn: true,
      arfeliMasteryChain: ['sword'], arfeliMasteryLastBonus: 4,
      colosoTurnSerial: 7, colosoCreateWindow: false, colosoPillarCreatedThisTurn: true, colosoRecycleUsed: true, stoneArmorTargetsUsed: ['x'],
      piplusMarkUsedThisTurn: true, piplusMarkBlockedThisTurn: true, piplusFixationTargetId: 'x', piplusInterferenceTargets: ['x'],
      onodTurnSerial: 7, onodGerminateUses: 2, onodWitherUsedThisTurn: true, onodGerminateBlockedThisTurn: true,
      korganTurnSerial: 7, korganDisarmUsedThisTurn: true
    });
    const expected = structuredClone(active), context = {
      B: {}, cur: () => expected, _beginTurn() {},
      [config.baseName || '_unused']() {}
    };
    vm.createContext(context);
    vm.runInContext(`(${assignedFunction(balanceSource, 'beginTurn')})()`, context);
    if (config.file) {
      const source = baseFile(config.file);
      context[config.idName] = championId;
      if (config.predicate) context[config.predicate] = unit => unit?.championId === championId;
      if (config.helper) vm.runInContext(functionSource(source, config.helper), context);
      vm.runInContext(`(${assignedFunction(source, 'beginTurn')})()`, context);
    }
    const actual = initializeCombat({ units: [active, make(championId === 'piplus' ? 'coloso' : 'piplus', 'b', 'blue', { x: 11, y: 11 })], random: 0 }).state.units[0];
    const fields = ['sproutRemovedThisTurn', 'trapRemovedThisTurn', ...config.fields];
    assert.equal(JSON.stringify(Object.fromEntries(fields.map(field => [field, actual[field]]))), JSON.stringify(Object.fromEntries(fields.map(field => [field, expected[field]]))), championId);
  }
});
