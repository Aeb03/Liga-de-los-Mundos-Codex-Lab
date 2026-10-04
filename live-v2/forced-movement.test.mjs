import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,endTurn,useAbility,previewAbility,abilityTargets,forcedDirection,serializeState} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';
const make=(a={x:4,y:5},b={x:6,y:5},obstacles=[])=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:a}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:b})],obstacles}).state;
const cast=(s,id,actor='a',target='b')=>useAbility(s,{unitId:actor,abilityId:id,targetId:target});
test('Lanza pulls one actual cell, uses mastery and wound; preview is exact and pure, no PM or tackle',()=>{
 const s=make();s.units[1].status.wound=2;s.units[0].arfeliMasteryChain=['daggers'];const before=serializeState(s);
 const p=previewAbility(s,{unitId:'a',abilityId:'spear',targetId:'b'}),out=cast(s,'spear');assert.equal(serializeState(s),before);
 assert.equal(out.state.units[0].pa,3);assert.equal(out.state.units[1].hp,102);assert.equal(out.state.units[1].x,5);assert.equal(out.state.units[1].pm,3);
 assert.deepEqual(p.moves,out.events.filter(e=>e.type==='unit.moved'));assert.equal(p.moves[0].cost,0);assert.equal(p.moves[0].forced,true);assert.deepEqual(p.moves[0].path,[{x:6,y:5},{x:5,y:5}]);assert(!out.events.some(e=>e.source==='tackle'));
 assert.deepEqual(abilityOverlay(s,'a','spear','b').forced,p);
});
test('quake has eight neighboring targets and pushes orthogonally with X winning a diagonal tie',()=>{
 let s=endTurn(make({x:5,y:5},{x:6,y:6}),{unitId:'a'}).state;s.units[0].status.wound=3;
 assert.deepEqual(abilityTargets(s,'b','quake'),['a']);assert.equal(abilityOverlay(s,'b','quake','a').range.length,8);
 const o=cast(s,'quake','b','a');assert.deepEqual([o.state.units[0].x,o.state.units[0].y,o.state.units[0].hp,o.state.units[0].pm],[4,5,87,3]);assert.equal(o.state.units[1].pa,3);
 assert.deepEqual(o.events.find(e=>e.type==='unit.moved').path,[{x:5,y:5},{x:4,y:5}]);
});
test('blocked pull causes 2 + 1 collision, blocked quake 4; no wound without an actual step',()=>{
 let s=make({x:5,y:5},{x:6,y:5});s.units[1].status.wound=3;let o=cast(s,'spear');assert.equal(o.state.units[1].hp,103);assert.equal(o.state.units[0].hp,99);assert(!o.events.some(e=>e.type==='unit.moved'||e.source==='wound.forced'));
 s=endTurn(make({x:0,y:5},{x:1,y:5}),{unitId:'a'}).state;s.units[0].status.wound=3;o=cast(s,'quake','b','a');assert.equal(o.state.units[0].hp,86);assert.equal(o.state.units[0].x,0);assert(!o.events.some(e=>e.source==='wound.forced'));
 s=endTurn(make({x:5,y:5},{x:6,y:5},[{x:4,y:5}]),{unitId:'a'}).state;o=cast(s,'quake','b','a');assert.equal(o.state.units[0].hp,86);assert.equal(o.events.find(e=>e.type==='movement.blocked').blockerId,null);
});
test('shield absorbs ability and forced wound; lethal initial damage never moves; lethal wound ends at destination',()=>{
 let s=make();s.units[1].status.wound=2;s.units[1].shield=[{amount:11,sourceId:'b'}];let o=cast(s,'spear');assert.equal(o.state.units[1].hp,114);assert.deepEqual(o.state.units[1].shield,[]);
 s=make();s.units[1].hp=10;o=cast(s,'spear');assert.equal(o.state.phase,'ended');assert.equal(o.state.units[1].x,6);assert(!o.events.some(e=>e.type==='unit.moved'));
 s=make();s.units[1].hp=12;s.units[1].status.wound=2;o=cast(s,'spear');assert.equal(o.state.phase,'ended');assert.equal(o.state.units[1].x,5);assert.equal(o.state.units[1].pm,3);assert.equal(o.state.winnerTeam,'A');assert(serializeState(o.state));
 s=make({x:5,y:5},{x:6,y:5});s.units[0].hp=1;s.units[1].hp=12;o=cast(s,'spear');assert.equal(o.state.phase,'ended');assert.equal(o.state.winnerTeam,null);assert(o.events.filter(e=>e.type==='unit.died').length===2);
});
test('invalid range, LOS, PA and Monolith reject atomically; poison death cancels pull',()=>{
 for(const [s,id,actor,target,code] of [[make({x:3,y:5}),'spear','a','b','OUT_OF_RANGE'],[make({x:4,y:5},{x:6,y:5},[{x:5,y:5}]),'spear','a','b','BLOCKED_LOS']]){const b=serializeState(s);assert.throws(()=>cast(s,id,actor,target),e=>e.code===code);assert.equal(serializeState(s),b);}
 let s=make();s.units[0].pa=2;assert.throws(()=>cast(s,'spear'),e=>e.code==='INSUFFICIENT_PA');
 s=endTurn(make({x:5,y:5}),{unitId:'a'}).state;s.units[1].monolith=true;assert.deepEqual(abilityTargets(s,'b','quake'),['a']);assert.equal(cast(s,'quake','b','a').state.units[0].hp,90);
 s=make();s.units[0].hp=1;s.units[0].status.poison=1;const o=cast(s,'spear');assert.equal(o.state.units[0].pa,3);assert.equal(o.state.units[1].hp,115);assert(!o.events.some(e=>e.type==='unit.moved'));
});
test('forced direction and collision constants match pinned effective offline sources',()=>{
 const base='0b4983953a37fca0a60867f1007f78c67b263683';
 const src=execFileSync('git',['show',`${base}:app.js`],{encoding:'utf8'});const start=src.indexOf('function forcedDirection('),end=src.indexOf('\n}',start)+2;
 const c=vm.createContext({});vm.runInContext(src.slice(start,end),c);
 for(let x=0;x<12;x++)for(let y=0;y<12;y++)for(const away of [true,false])assert.deepEqual(forcedDirection({x:5,y:5},{x,y},away),Array.from(c.forcedDirection({x:5,y:5},{x,y},away)));
 const coloso=execFileSync('git',['show',`${base}:coloso-rework-0627.js`],{encoding:'utf8'}),balance=execFileSync('git',['show',`${base}:balance-playtest.js`],{encoding:'utf8'});
 assert.match(coloso,/id:'quake'.*cost:3,range:1,damage:10/);assert.match(coloso,/const collision=4/);assert.match(coloso,/Math\.ceil\(collision\/2\)/);assert.match(balance,/collision\s*=\s*2\s*\*\s*remaining/);
});

test('actual forced displacement matches executed pinned offline wrappers for shield, wound, border and obstacle',async()=>{
 const base='0b4983953a37fca0a60867f1007f78c67b263683';
 const read=file=>execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
 const app=read('app.js'),balance=read('balance-playtest.js'),coloso=read('coloso-rework-0627.js');
 const direction=app.slice(app.indexOf('function forcedDirection('),app.indexOf('\n}',app.indexOf('function forcedDirection('))+2);
 const pull=balance.slice(balance.indexOf('forcedMove=async function('),balance.indexOf('\n};',balance.indexOf('forcedMove=async function('))+3);
 const push=coloso.slice(coloso.indexOf('async function quakePush('),coloso.indexOf('\nasync function triggerColosoReplicas('));
 for(const quake of [false,true])for(const mode of ['free','shield','death','border','obstacle']){
  let s=quake?endTurn(make(mode==='border'?{x:0,y:5}:{x:5,y:5},mode==='border'?{x:1,y:5}:{x:6,y:5},mode==='obstacle'?[{x:4,y:5}]:[]),{unitId:'a'}).state:make();
  const actor=s.units[quake?1:0],victim=s.units[quake?0:1];victim.status.wound=2;if(mode==='shield')victim.shield=[{amount:13,sourceId:actor.id}];if(mode==='death')victim.hp=11;
  const out=cast(s,quake?'quake':'spear',actor.id,victim.id),units=structuredClone(s.units),source=units.find(u=>u.id===actor.id),target=units.find(u=>u.id===victim.id);target.kind='unit';
  function damage(t,n){for(const stack of t.shield){const used=Math.min(n,stack.amount);stack.amount-=used;n-=used;}t.shield=t.shield.filter(v=>v.amount>0);t.hp=Math.max(0,t.hp-n);t.alive=t.hp>0;}
  damage(target,10);
  const ctx=vm.createContext({inside:(x,y)=>x>=0&&x<12&&y>=0&&y<12,entityAt:(x,y)=>units.find(u=>u.alive&&u.x===x&&u.y===y),isFixedObstacle:(x,y)=>s.board.obstacles.includes(`${x},${y}`),applyDamage:damage,applyWoundStep:t=>damage(t,t.status.wound),woundTravelStep:async t=>damage(t,t.status.wound),faceStep:()=>{},log:()=>{},renderBattle:()=>{},sleep:async()=>{},checkBattleEnd:()=>units.some(u=>!u.alive),triggerTrapAt:async()=>{}});
  vm.runInContext(direction+'\n'+pull+'\n'+push,ctx);
  if(target.alive)await (quake?ctx.quakePush(target,source,'quake'):ctx.forcedMove(target,source,1,false,'pull'));
  const got=out.state.units.find(u=>u.id===target.id);assert.deepEqual([got.x,got.y,got.hp,got.shield,got.pm],[target.x,target.y,target.hp,target.shield,target.pm],`${quake?'quake':'spear'} ${mode}`);
 }
});
