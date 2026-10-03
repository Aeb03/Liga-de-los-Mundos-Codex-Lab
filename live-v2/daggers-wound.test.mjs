import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,useAbility,endTurn,previewPath,resolvePath,serializeState,restoreState,abilityTargets} from './combat-core.mjs';
const make=()=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:{x:2,y:5}}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:{x:3,y:5}})]}).state;
const hit=s=>useAbility(s,{unitId:'a',abilityId:'daggers',targetId:'b'});
const path=[{x:3,y:5},{x:4,y:5},{x:5,y:5},{x:6,y:5}];
test('Dagas costs 3, deals 10, applies wound 2 after shield damage and limits one use atomically',()=>{
 let s=make();s.units[1].shield=[{amount:15,sourceId:'a'}];const before=serializeState(s),out=hit(s);assert.equal(serializeState(s),before);s=out.state;
 assert.equal(s.units[0].pa,3);assert.equal(s.units[1].hp,115);assert.equal(s.units[1].shield[0].amount,5);assert.equal(s.units[1].status.wound,2);assert.deepEqual(abilityTargets(s,'a','daggers'),[]);
 const snapshot=serializeState(s);assert.throws(()=>hit(s),e=>e.code==='ABILITY_LIMIT');assert.equal(serializeState(s),snapshot);
 assert.equal(out.events.find(e=>e.type==='status.applied').value,2);
});
test('Dagas uses mastery, caps wound 3, and never applies it after poison death or target death',()=>{
 let s=make();s.units[1].status.wound=2;s=useAbility(s,{unitId:'a',abilityId:'sword',targetId:'b'}).state;s=hit(s).state;assert.equal(s.units[1].hp,94);assert.equal(s.units[1].status.wound,3);
 s=make();s.units[1].hp=10;let out=hit(s);assert.equal(out.state.winnerTeam,'A');assert.equal(out.state.units[1].status.wound,0);assert(!out.events.some(e=>e.type==='status.applied'));
 s=make();s.units[0].hp=1;s.units[0].status.poison=1;out=hit(s);assert.equal(out.state.winnerTeam,'B');assert.equal(out.state.units[1].hp,115);assert.equal(out.state.units[1].status.wound,0);
});
test('Herida is charged per actual step, shield absorbs it, tackle bypasses shield, preview is pure',()=>{
 let s=endTurn(hit(make()).state,{unitId:'a'}).state;s.units[1].shield=[{amount:3,sourceId:'a'}];const before=serializeState(s),p=previewPath(s,'b',path);
 assert.equal(serializeState(s),before);assert.equal(p.tackleDamage,2);assert.equal(p.woundDamage,6);assert.equal(p.remainingHp,100);assert.equal(p.diesDuringPath,false);
 const out=resolvePath(s,'b',path),u=out.state.units[1];assert.equal(u.hp,100);assert.equal(u.pm,0);assert.deepEqual(u.shield,[]);assert.equal(u.x,6);
 assert.deepEqual(out.events.filter(e=>e.source==='wound.movement').map(e=>[e.step,e.absorbed,e.hpLost]),[[1,2,0],[2,1,1],[3,0,2]]);
 assert.equal(serializeState(s),before);assert.equal(restoreState(serializeState(out.state)).units[1].status.wound,2);
});
test('mortality stops at actual death tile and spends only travelled PM; tackle-only rejection stays atomic',()=>{
 let s=endTurn(hit(make()).state,{unitId:'a'}).state;s.units[1].hp=5;const p=previewPath(s,'b',path);assert.equal(p.lethal,false);assert.equal(p.diesDuringPath,true);assert.deepEqual(p.resolvedDestination,{x:5,y:5});
 const out=resolvePath(s,'b',path);assert.equal(out.state.units[1].hp,0);assert.equal(out.state.units[1].pm,1);assert.equal(out.state.units[1].x,5);assert.equal(out.state.winnerTeam,'A');assert.deepEqual(out.events.find(e=>e.type==='unit.moved').path,path.slice(0,3));assert.equal(out.events.filter(e=>e.type==='unit.died').length,1);
 s.units[1].hp=2;const before=serializeState(s);assert.throws(()=>resolvePath(s,'b',path),e=>e.code==='LETHAL_TACKLE');assert.equal(serializeState(s),before);
});
test('successive movement does not charge starting tile, and wound halves only at owner end',()=>{
 let s=endTurn(hit(make()).state,{unitId:'a'}).state;assert.equal(s.units[1].status.wound,2);
 s=resolvePath(s,'b',path.slice(0,2)).state;s=resolvePath(s,'b',path.slice(1,3)).state;assert.equal(s.units[1].hp,99);assert.equal(s.units[1].pm,1);
 s=endTurn(s,{unitId:'b'}).state;assert.equal(s.units[1].status.wound,1);s=endTurn(s,{unitId:'a'}).state;assert.equal(s.units[1].status.wound,1);s=endTurn(s,{unitId:'b'}).state;assert.equal(s.units[1].status.wound,0);
});
test('Dagas rejects diagonal, wrong controller-independent actor, bad target and insufficient PA',()=>{
 const s=make();s.units[1].y=6;let before=serializeState(s);assert.throws(()=>hit(s),e=>e.code==='OUT_OF_RANGE');assert.equal(serializeState(s),before);
 s.units[1].y=5;s.units[0].pa=2;assert.throws(()=>hit(s),e=>e.code==='INSUFFICIENT_PA');s.units[0].pa=6;assert.throws(()=>useAbility(s,{unitId:'a',abilityId:'daggers',targetId:'a'}),e=>e.code==='INVALID_TARGET');
});
test('wound cap, per-cell normal damage and halving match the pinned offline functions',()=>{
 const source=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:app.js'],{encoding:'utf8'});
 const extract=n=>source.slice(source.indexOf(`function ${n}(`),source.indexOf('\n}',source.indexOf(`function ${n}(`))+2);
 const ctx=vm.createContext({STATUS_MAX:{wound:3},feedback:()=>{},log:()=>{},applyDamage:(u,n,ignore)=>{assert.equal(ignore,false);const absorbed=Math.min(u.shield,n);u.shield-=absorbed;u.hp=Math.max(0,u.hp-n+absorbed);u.alive=u.hp>0;}});
 vm.runInContext(extract('addStatus')+'\n'+extract('applyWoundStep'),ctx);
 for(const initial of [0,1,2,3]){const offline={kind:'unit',alive:true,hp:10,shield:3,status:{wound:initial}};ctx.addStatus(offline,'wound',2);let s=make();s.units[1].x=9;s.units[0].status.wound=Math.min(3,initial+2);s.units[0].hp=10;s.units[0].shield=[{amount:3,sourceId:'b'}];
  const route=[{x:2,y:5},{x:2,y:6},{x:2,y:7}];for(let i=1;i<route.length;i++)ctx.applyWoundStep(offline);s=resolvePath(s,'a',route).state;assert.equal(s.units[0].hp,offline.hp);assert.equal(s.units[0].shield.reduce((n,v)=>n+v.amount,0),offline.shield);assert.equal(s.units[0].status.wound,offline.status.wound);
 }
});
