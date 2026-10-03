import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,useAbility,endTurn,swordTargets,serializeState} from './combat-core.mjs';
const make=()=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:{x:2,y:2}}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:{x:3,y:2}})]}).state;
const cut=s=>useAbility(s,{unitId:'a',abilityId:'sword',targetId:'b'});
const rejects=(s,command,code)=>{const before=serializeState(s);assert.throws(()=>useAbility(s,command),e=>e.code===code);assert.equal(serializeState(s),before);};
test('sword costs 2 PA, deals effective 10 damage, respects shield and two-use limit',()=>{
 let s=make();s.units[1].shield=[{amount:6,sourceId:'b'}];
 let result=cut(s);assert.equal(result.state.units[0].pa,4);assert.equal(result.state.units[1].hp,111);assert.equal(result.state.units[1].shield.length,0);assert.equal(s.units[0].pa,6);
 s=cut(result.state).state;assert.equal(s.units[0].pa,2);assert.equal(s.units[1].hp,101);assert.deepEqual(s.units[0].arfeliMasteryChain,['sword']);
 rejects(s,{unitId:'a',abilityId:'sword',targetId:'b'},'ABILITY_LIMIT');
 s=endTurn(s,{unitId:'a'}).state;s=endTurn(s,{unitId:'b'}).state;assert.equal(s.units[0].skillUsesThisTurn.sword,undefined);assert.equal(cut(s).state.units[0].pa,4);
});
test('illegal targets, diagonals, resources, champion and inactive unit fail atomically',()=>{
 let s=make();assert.deepEqual(swordTargets(s,'a'),['b']);
 rejects(s,{unitId:'a',abilityId:'sword',targetId:'a'},'INVALID_TARGET');
 rejects(s,{unitId:'b',abilityId:'sword',targetId:'a'},'NOT_ACTIVE_UNIT');
 rejects(s,{unitId:'a',abilityId:'bow',targetId:'b'},'UNSUPPORTED_ABILITY');
 s.units[1].y=3;assert.deepEqual(swordTargets(s,'a'),[]);rejects(s,{unitId:'a',abilityId:'sword',targetId:'b'},'OUT_OF_RANGE');
 s=make();s.units[0].pa=1;rejects(s,{unitId:'a',abilityId:'sword',targetId:'b'},'INSUFFICIENT_PA');
});
test('mastery, poison death cancellation, shielded poison and enemy death are deterministic',()=>{
 let s=make();s.units[0].arfeliMasteryChain=['bow'];assert.equal(cut(s).state.units[1].hp,104);
 s=make();s.units[0].hp=2;s.units[0].status.poison=2;let out=cut(s);assert.equal(out.state.phase,'ended');assert.equal(out.state.winnerTeam,'B');assert.equal(out.state.units[1].hp,115);assert.equal(out.state.units[0].pa,4);
 s=make();s.units[0].status.poison=3;s.units[0].shield=[{amount:3,sourceId:'a'}];out=cut(s);assert.equal(out.state.units[0].hp,100);assert.equal(out.state.units[1].hp,105);
 s=make();s.units[1].hp=10;out=cut(s);assert.equal(out.state.winnerTeam,'A');assert(out.events.some(e=>e.type==='unit.died'));
});
