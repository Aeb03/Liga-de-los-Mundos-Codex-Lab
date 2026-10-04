import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArena, turnSequence, unitIndicators } from './presentation.mjs';
import { createUnit, initializeCombat } from '../combat-core.mjs';
function fixture() {
 const slots={A1:{id:'A1',team:'A',controllerId:'shared',championId:'piplus',position:{x:2,y:5},skills:['precise','vector','impulse','interference']},B1:{id:'B1',team:'B',controllerId:'rival',championId:'coloso',position:{x:9,y:5},skills:['rock','stonearmor','absorb','quake']}};
 const combat=initializeCombat({units:Object.values(slots).map(s=>createUnit({...s,slot:1})),random:.25}).state;
 return {phase:'combat',slots,combat};
}
test('HUD uses authoritative resources without mutating state or charging preview damage',()=>{
 const state=fixture(),u=state.combat.units[0];u.hp=78;u.pa=4;u.pm=2;u.shield=[{amount:7,sourceId:'A1'},{amount:5,sourceId:'B1'}];
 const before=structuredClone(state);
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:24,canMove:true,blocked:false,preview:{path:[{x:2,y:5},{x:3,y:5}],cost:1,tackleDamage:2}});
 assert.match(html,/78\/90 PV/);assert.match(html,/4 PA/);assert.match(html,/2 PM/);assert.match(html,/Escudo 12/);
 assert.equal((html.match(/<button class="combat-skill[^"]*"[^>]* disabled/g)??[]).length,0);
 assert.match(html,/Flecha de Precisión/);assert.deepEqual(state,before);
});
test('turn queue rotates from active slot, excludes dead units and preserves independent identities',()=>{
 const state=fixture();const extra=createUnit({championId:'onod',id:'A2',team:'A',slot:2,controllerId:'shared',position:{x:3,y:5}});
 state.combat.units.push(extra);state.combat.order=['A1','B1','A2'];state.combat.turnIndex=1;state.combat.units[0].alive=false;
 assert.deepEqual(turnSequence(state.combat).map(u=>u.id),['B1','A2']);
 assert.equal(extra.controllerId,state.slots.A1.controllerId);assert.equal(extra.team,'A');
});
test('status display sums shields and reads positive confirmed values without inventing effects',()=>{
 const u=fixture().combat.units[0];assert.deepEqual(unitIndicators(u),[]);
 u.status={wound:3,poison:2,burn:1};u.shield=[{amount:4},{amount:6}];
 assert.deepEqual(unitIndicators(u),[['Escudo',10],['Herida',3],['Veneno',2],['Quemadura',1]]);
});

test('sword targets are marked and action is enabled only for own valid active slot',()=>{
 const state=fixture();state.slots.A1.championId='arfeli';state.slots.A1.skills=['sword','daggers','bow','shield'];state.combat=initializeCombat({units:[createUnit({...state.slots.A1,slot:1,position:{x:2,y:5}}),createUnit({...state.slots.B1,slot:1,position:{x:3,y:5}})]}).state;
 const args={state,actor:'shared',slotId:'A1',remaining:24,blocked:false,canMove:true,abilitySelection:{targetId:'B1'}};
 const before=structuredClone(state);let html=renderArena(args);assert.match(html,/data-action="sword"  title/);assert.match(html,/ability-target ability-selected ability-effect/);assert.match(html,/Corte con Espada: 10 daño · 2 PA/);assert.match(html,/0\/2/);assert.deepEqual(state,before);
 html=renderArena({...args,canMove:false});assert.match(html,/data-action="sword" disabled/);
 state.combat.units[0].skillUsesThisTurn.sword=2;html=renderArena(args);assert.match(html,/data-action="sword" disabled/);assert.match(html,/2\/2/);
});

test('Dagas preview names wound and movement preview distinguishes normal wound damage without mutating',()=>{
 const state=fixture();state.slots.A1.championId='arfeli';state.slots.A1.skills=['sword','daggers','bow','shield'];state.combat=initializeCombat({units:[createUnit({...state.slots.A1,slot:1,position:{x:2,y:5}}),createUnit({...state.slots.B1,slot:1,position:{x:3,y:5}})]}).state;
 const args={state,actor:'shared',slotId:'A1',remaining:24,blocked:false,canMove:true,abilitySelection:{abilityId:'daggers',targetId:'B1'}};
 const before=structuredClone(state);let html=renderArena(args);assert.match(html,/Dagas Danzantes: 10 daño \+ Herida 2 · 3 PA/);assert.match(html,/data-action="daggers"  title/);assert.deepEqual(state,before);
 html=renderArena({...args,abilitySelection:null,preview:{path:[{x:2,y:5},{x:2,y:6}],cost:1,tackleDamage:2,woundDamage:2,remainingHp:0,diesDuringPath:true}});assert.match(html,/Herida: 2 daño · PV final: 0 · MUERTE DURANTE EL RECORRIDO/);
});
