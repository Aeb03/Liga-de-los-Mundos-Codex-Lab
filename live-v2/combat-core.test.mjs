import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CombatRuleError, applyDamage, calculatePath, championDefinitions, createUnit, endTurn,
  executeCommand, initializeCombat, movementAvailable, previewPath, resolvePath, restoreState, serializeState
} from './combat-core.mjs';

const unit = (championId, id, team, position, controllerId = `${team}-controller`) =>
  createUnit({ championId, id, team, slot: 0, controllerId, position });
const combat = (a, b, options = {}) => initializeCombat({ units: [a, b], random: 0.25, clock: 123, ...options }).state;
const errorCode = (fn, code) => assert.throws(fn, error => error instanceof CombatRuleError && error.code === code);

test('construye los seis campeones con ficha efectiva e identidad separada', () => {
  const expected = { arfeli: [100, 6, 3, 5], coloso: [115, 6, 3, 3], piplus: [90, 6, 3, 6], onod: [95, 6, 3, 4], korgan: [100, 6, 4, 4], houngan: [90, 6, 3, 5] };
  assert.deepEqual(Object.fromEntries(Object.keys(championDefinitions()).map((id, slot) => {
    const u = createUnit({ championId: id, id: `u${slot}`, team: slot % 2 ? 'b' : 'a', slot, controllerId: 'shared', position: { x: slot, y: 0 } });
    assert.equal(u.controllerId, 'shared'); assert.equal(u.slot, slot);
    return [id, [u.hp, u.pa, u.pm, u.initiative]];
  })), expected);
});

test('iniciativa mayor empieza; empate consume azar explícito una sola vez', () => {
  assert.equal(combat(unit('coloso', 'a', 'red', { x: 0, y: 0 }), unit('piplus', 'b', 'blue', { x: 11, y: 11 })).order[0], 'b');
  let calls = 0;
  const initialized = initializeCombat({ units: [unit('arfeli', 'a', 'red', { x: 0, y: 0 }), unit('houngan', 'b', 'blue', { x: 11, y: 11 })], random: () => { calls++; return 0.75; } });
  assert.equal(initialized.state.order[0], 'b'); assert.equal(calls, 1); assert.equal(initialized.state.tieBreak.randomValue, 0.75);
  const restored = restoreState(serializeState(initialized.state));
  assert.equal(restored.order[0], 'b'); assert.equal(calls, 1);
  errorCode(() => initializeCombat({ units: [unit('arfeli', 'a', 'red', { x: 0, y: 0 }), unit('houngan', 'b', 'blue', { x: 11, y: 11 })] }), 'RANDOM_REQUIRED');
});

test('movimiento respeta límites, obstáculos, ocupación, PM y desempate histórico', () => {
  const state = combat(unit('korgan', 'a', 'red', { x: 1, y: 1 }), unit('onod', 'b', 'blue', { x: 3, y: 1 }), { obstacles: [{ x: 2, y: 1 }] });
  const cells = movementAvailable(state, 'a');
  assert(!cells.some(p => p.x === 2 && p.y === 1)); assert(!cells.some(p => p.x === 3 && p.y === 1)); assert(!cells.some(p => p.x < 0));
  assert.deepEqual(calculatePath(state, 'a', { x: 2, y: 2 }), [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
  errorCode(() => calculatePath(state, 'a', { x: 6, y: 1 }), 'UNREACHABLE_DESTINATION');
});

test('valida exactamente el recorrido presentado y permite movimientos sucesivos', () => {
  let state = combat(unit('korgan', 'a', 'red', { x: 0, y: 0 }), unit('onod', 'b', 'blue', { x: 11, y: 11 }));
  ({ state } = resolvePath(state, 'a', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]));
  assert.deepEqual([state.units[0].x, state.units[0].pm], [2, 2]);
  ({ state } = resolvePath(state, 'a', [{ x: 2, y: 0 }, { x: 2, y: 1 }]));
  assert.deepEqual([state.units[0].y, state.units[0].pm], [1, 1]);
  errorCode(() => resolvePath(state, 'a', [{ x: 2, y: 1 }, { x: 4, y: 1 }]), 'INVALID_PATH');
});

test('placaje sólo ocurre al romper adyacencia y suma campeones vivos', () => {
  const mover = unit('korgan', 'm', 'red', { x: 1, y: 1 }); mover.initiative = 99;
  const enemy = unit('onod', 'e', 'blue', { x: 2, y: 1 });
  let state = combat(mover, enemy);
  assert.equal(previewPath(state, 'm', [{ x: 1, y: 1 }, { x: 1, y: 2 }]).tackleDamage, 2);
  errorCode(() => previewPath(state, 'm', [{ x: 1, y: 1 }, { x: 2, y: 1 }]), 'INVALID_PATH');
});

test('placaje múltiple ignora escudo; diagonales e invocaciones no cuentan', () => {
  const mover = unit('korgan', 'm', 'red', { x: 1, y: 1 }); mover.initiative = 99; mover.shield = [{ amount: 20, sourceId: 'e' }];
  const enemy = unit('onod', 'e', 'blue', { x: 2, y: 1 });
  let state = combat(mover, enemy);
  const second = unit('arfeli', 'e2', 'blue', { x: 1, y: 0 });
  state.units.push(second); state.order.push('e2');
  const result = resolvePath(state, 'm', [{ x: 1, y: 1 }, { x: 1, y: 2 }]);
  assert.equal(result.state.units[0].hp, 96); assert.equal(result.state.units[0].shield[0].amount, 20);
  state = combat(mover, unit('onod', 'd', 'blue', { x: 2, y: 2 }));
  assert.equal(previewPath(state, 'm', [{ x: 1, y: 1 }, { x: 1, y: 2 }]).tackleDamage, 0);
  state.summons = [{ id: 'doll', x: 2, y: 1 }];
  errorCode(() => previewPath(state, 'm', [{ x: 1, y: 1 }, { x: 1, y: 2 }]), 'UNSUPPORTED_MECHANIC');
});

test('recorrido con placaje mortal se rechaza sin ninguna mutación', () => {
  const mover = unit('korgan', 'm', 'red', { x: 1, y: 1 }); mover.initiative = 99; mover.hp = 2;
  const state = combat(mover, unit('onod', 'e', 'blue', { x: 2, y: 1 }));
  const before = serializeState(state);
  errorCode(() => resolvePath(state, 'm', [{ x: 1, y: 1 }, { x: 1, y: 2 }]), 'LETHAL_TACKLE');
  assert.equal(serializeState(state), before);
});

test('cierre e inicio aplican resets, estados, ronda y omiten muertos', () => {
  const a = unit('arfeli', 'a', 'red', { x: 0, y: 0 }); a.initiative = 10; a.status.burn = 2; a.status.wound = 3; a.masteryChain = ['sword'];
  const b = unit('houngan', 'b', 'blue', { x: 11, y: 11 });
  let state = combat(a, b); state.units[1].status.pmPenaltyNext = 1;
  ({ state } = endTurn(state, { unitId: 'a' }));
  assert.equal(state.units[0].status.burn, 1); assert.equal(state.units[0].status.wound, 1); assert.deepEqual(state.units[0].masteryChain, []);
  assert.equal(state.order[state.turnIndex], 'b'); assert.equal(state.units[1].pm, 2);
  ({ state } = endTurn(state, { unitId: 'b' }));
  assert.equal(state.round, 2); assert.equal(state.order[state.turnIndex], 'a');
});

test('daño resuelve escudo, muerte y final de combate', () => {
  let state = combat(unit('piplus', 'a', 'red', { x: 0, y: 0 }), unit('coloso', 'b', 'blue', { x: 11, y: 11 }));
  state.units[1].shield = [{ amount: 5, sourceId: 'b' }];
  let result = applyDamage(state, { targetId: 'b', amount: 7 }); state = result.state;
  assert.equal(state.units[1].hp, 113); assert.equal(state.units[1].shield.length, 0);
  result = applyDamage(state, { targetId: 'b', amount: 999, ignoreShield: true });
  assert.equal(result.state.phase, 'ended'); assert.equal(result.state.winnerTeam, 'red');
  assert(result.events.some(event => event.type === 'unit.died'));
});

test('serialización y entradas iguales producen resultados idénticos', () => {
  const make = () => combat(unit('arfeli', 'a', 'red', { x: 0, y: 0 }), unit('houngan', 'b', 'blue', { x: 11, y: 11 }));
  assert.equal(serializeState(make()), serializeState(make()));
  const state = make(), command = { type: 'move', unitId: 'a', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };
  assert.deepEqual(executeCommand(state, command), executeCommand(restoreState(serializeState(state)), command));
});

test('estados, formatos y comandos fuera de alcance se rechazan explícitamente', () => {
  const a = unit('arfeli', 'a', 'red', { x: 0, y: 0 }), b = unit('houngan', 'b', 'blue', { x: 11, y: 11 });
  errorCode(() => initializeCombat({ units: [a, b, unit('onod', 'c', 'green', { x: 5, y: 5 })], random: 0 }), 'UNSUPPORTED_FORMAT');
  const state = combat(a, b); state.traps.push({ id: 'trap' });
  errorCode(() => serializeState(state), 'UNSUPPORTED_MECHANIC');
  state.traps = [];
  errorCode(() => executeCommand(state, { type: 'attack' }), 'UNSUPPORTED_COMMAND');
});
