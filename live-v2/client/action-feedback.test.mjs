import test from 'node:test';import assert from 'node:assert/strict';
import {actionBlockReason} from './action-feedback.mjs';
import {createUnit,initializeCombat,endTurn,createPillar,pillarAvailable,serializeState} from '../combat-core.mjs';
const make=()=>endTurn(initializeCombat({units:[createUnit({id:'a',team:'A',slot:1,controllerId:'a',championId:'arfeli',position:{x:8,y:5}}),createUnit({id:'c',team:'B',slot:1,controllerId:'c',championId:'coloso',position:{x:5,y:5}})]}).state,{unitId:'a'}).state;
test('Pilar costs 1 PA, rejects insufficient PA atomically and reports its turn limit',()=>{
 let s=make();s.units[1].pa=0;const before=serializeState(s);assert.equal(actionBlockReason(s,s.units[1],'createPillar'),'PA insuficientes');assert.deepEqual(pillarAvailable(s,'c'),[]);assert.throws(()=>createPillar(s,{unitId:'c',position:{x:6,y:5}}),e=>e.code==='INSUFFICIENT_PA');assert.equal(serializeState(s),before);
 s.units[1].pa=1;const out=createPillar(s,{unitId:'c',position:{x:6,y:5}});assert.equal(out.state.units[1].pa,0);assert.equal(out.events[0].cost,1);out.state.units[1].pa=4;assert.equal(actionBlockReason(out.state,out.state.units[1],'createPillar'),'Ya invocaste un Pilar este turno');
});
test('brief reasons distinguish new pillar, blocked LOS, range and skill usage without changing state',()=>{
 let s=make();s=createPillar(s,{unitId:'c',position:{x:6,y:5}}).state;const u=s.units[1],before=serializeState(s);assert.equal(actionBlockReason(s,u,'collapse',{x:6,y:5}),'Pilar invocado este turno');assert.equal(actionBlockReason(s,u,'rock',{x:11,y:11}),'Fuera de alcance');assert.equal(actionBlockReason(s,u,'rock',{x:8,y:5}),'Sin línea de visión');u.skillUsesThisTurn.stonearmor=2;assert.equal(actionBlockReason(s,u,'stonearmor'),'Límite de usos alcanzado');delete u.skillUsesThisTurn.stonearmor;assert.equal(serializeState(s),before);
});
