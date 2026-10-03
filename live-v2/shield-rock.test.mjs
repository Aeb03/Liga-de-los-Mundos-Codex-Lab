import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,useAbility,endTurn,abilityTargets,clearAbilityLOS,serializeState} from './combat-core.mjs';
const make=(a={x:2,y:2},b={x:5,y:2},obstacles=[])=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:a}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:b})],obstacles}).state;
const use=(state,unitId,abilityId,targetId)=>useAbility(state,{unitId,abilityId,targetId});
const reject=(s,c,code)=>{const before=serializeState(s);assert.throws(()=>useAbility(s,c),e=>e.code===code);assert.equal(serializeState(s),before);};
test('shield 15 costs 3 PA once, absorbs two rocks of 8 with one HP overflow',()=>{
 let s=make();s=use(s,'a','shield','a').state;assert.equal(s.units[0].pa,3);assert.deepEqual(s.units[0].shield,[{amount:15,sourceId:'a'}]);
 reject(s,{unitId:'a',abilityId:'shield',targetId:'a'},'ABILITY_LIMIT');
 s=endTurn(s,{unitId:'a'}).state;let out=use(s,'b','rock','a');s=out.state;assert.equal(s.units[0].hp,100);assert.equal(s.units[0].shield[0].amount,7);assert.equal(s.units[1].pa,3);
 out=use(s,'b','rock','a');s=out.state;assert.equal(s.units[0].hp,99);assert.deepEqual(s.units[0].shield,[]);assert.equal(s.units[1].pa,0);assert.equal(out.events.find(e=>e.type==='damage.applied').absorbed,7);
 reject(s,{unitId:'b',abilityId:'rock',targetId:'a'},'INSUFFICIENT_PA');
});
test('shield expiry is generator-based at next start, not end; reset and mastery carry real values',()=>{
 let s=make({x:2,y:2},{x:3,y:2});s=use(s,'a','sword','b').state;s=use(s,'a','shield','a').state;assert.equal(s.units[0].shield[0].amount,16);assert.equal(s.units[0].pa,1);
 s=endTurn(s,{unitId:'a'}).state;assert.equal(s.units[0].shield[0].amount,16);
 const out=endTurn(s,{unitId:'b'});s=out.state;assert.deepEqual(s.units[0].shield,[]);assert(out.events.some(e=>e.type==='shield.expired'&&e.sourceId==='a'&&e.amount===16));assert.equal(s.units[0].skillUsesThisTurn.shield,undefined);assert.equal(use(s,'a','shield','a').state.units[0].shield[0].amount,15);
});
test('rock obeys Manhattan range 4, monolith 5, blockers; wrong targets fail atomically',()=>{
 let s=make();reject(s,{unitId:'a',abilityId:'shield',targetId:'b'},'INVALID_TARGET');s=endTurn(s,{unitId:'a'}).state;
 reject(s,{unitId:'b',abilityId:'rock',targetId:'b'},'INVALID_TARGET');assert.deepEqual(abilityTargets(s,'b','rock'),['a']);
 s=make({x:0,y:0},{x:4,y:0},[{x:2,y:0}]);s=endTurn(s,{unitId:'a'}).state;assert.deepEqual(abilityTargets(s,'b','rock'),[]);reject(s,{unitId:'b',abilityId:'rock',targetId:'a'},'BLOCKED_LOS');
 s=make({x:0,y:0},{x:5,y:0});s=endTurn(s,{unitId:'a'}).state;reject(s,{unitId:'b',abilityId:'rock',targetId:'a'},'OUT_OF_RANGE');s.units[1].monolith=true;assert.equal(use(s,'b','rock','a').state.units[0].hp,92);
});
test('shield resolves poison before adding new protection, and rock resolves death',()=>{
 let s=make();s.units[0].hp=1;s.units[0].status.poison=1;let out=use(s,'a','shield','a');assert.equal(out.state.winnerTeam,'B');assert.deepEqual(out.state.units[0].shield,[]);assert.equal(out.state.units[0].pa,3);
 s=make();s.units[0].hp=8;s=endTurn(s,{unitId:'a'}).state;out=use(s,'b','rock','a');assert.equal(out.state.winnerTeam,'B');assert(out.events.some(e=>e.type==='unit.died'));
});
test('LOS sampling matches exact base offline algorithm including diagonal corners',()=>{
 const source=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:app.js'],{encoding:'utf8'});
 const extract=n=>source.slice(source.indexOf(`function ${n}(`),source.indexOf('\n}',source.indexOf(`function ${n}(`))+2);
 const context=vm.createContext({key:(x,y)=>`${x},${y}`});vm.runInContext(extract('lineCells'),context);
 for(let x=0;x<12;x++)for(let y=0;y<12;y++){
  const a={id:'a',x:1,y:2},b={id:'b',x,y};const cells=context.lineCells(a,b);
  for(const obstacle of ['5,5','2,3','3,2']){
   const state={board:{obstacles:[obstacle]},units:[]};assert.equal(clearAbilityLOS(state,a,b),!cells.some(([cx,cy])=>`${cx},${cy}`===obstacle));
  }
 }
});
