import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,endTurn,createPillar,pillarAvailable,hammerLanding,useAbility,abilityTargets,calculatePath,clearAbilityLOS,serializeState,restoreState} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';import {renderArena} from './client/presentation.mjs';import {confirmedRoutes,MotionTimeline} from './client/motion.mjs';
const make=()=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:{x:3,y:5}}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:{x:6,y:5}})]}).state;
const pillar=(s,position={x:4,y:5})=>createPillar(endTurn(s,{unitId:'a'}).state,{unitId:'b',position}).state;
const arfeli=s=>endTurn(s,{unitId:'b'}).state;
const hammer=(s,targetId='b')=>useAbility(s,{unitId:'a',abilityId:'hammer',targetId});
test('Pilar creation is a 0 PA opening action, LOS 5, one per turn, max two, unique identity and serialization',()=>{
 let s=endTurn(make(),{unitId:'a'}).state,before=serializeState(s);assert(pillarAvailable(s,'b').some(p=>p.x===4&&p.y===5));let o=createPillar(s,{unitId:'b',position:{x:4,y:5}});assert.equal(serializeState(s),before);s=o.state;assert.equal(s.units[1].pa,6);assert.equal(s.objects[0].hp,15);assert.equal(s.objects[0].ownerId,'b');assert.deepEqual(pillarAvailable(s,'b'),[]);assert.throws(()=>createPillar(s,{unitId:'b',position:{x:5,y:5}}));assert.deepEqual(restoreState(serializeState(s)),s);
 s=endTurn(endTurn(s,{unitId:'b'}).state,{unitId:'a'}).state;s=createPillar(s,{unitId:'b',position:{x:5,y:6}}).state;assert.equal(s.objects[1].id,'pillar2');s=endTurn(endTurn(s,{unitId:'b'}).state,{unitId:'a'}).state;assert.deepEqual(pillarAvailable(s,'b'),[]);
 s=endTurn(make(),{unitId:'a'}).state;s.units[1].colosoCreateWindow=false;assert.deepEqual(pillarAvailable(s,'b'),[]);assert.throws(()=>createPillar(s,{unitId:'a',position:{x:4,y:5}}));
});
test('Pilar blocks movement, LOS and landing; hammer jumps over it without PM or tackle, then penalizes next turn',()=>{
 const s=arfeli(pillar(make()));assert(!clearAbilityLOS(s,s.units[0],s.units[1]));assert.throws(()=>calculatePath(s,'a',{x:4,y:5}));assert.deepEqual(abilityTargets(s,'a','hammer'),['b','pillar1']);assert.deepEqual(hammerLanding(s,s.units[0],s.units[1]),{x:5,y:5});
 const before=serializeState(s),preview=abilityOverlay(s,'a','hammer','b');assert.equal(serializeState(s),before);assert.deepEqual(preview.forced.moves[0].path,[{x:3,y:5},{x:5,y:5}]);assert.equal(preview.forced.moves[0].kind,'jump');
 const out=hammer(s);assert.equal(out.state.units[0].x,5);assert.equal(out.state.units[0].pa,2);assert.equal(out.state.units[0].pm,3);assert.equal(out.state.units[1].hp,102);assert.equal(out.state.objects[0].hp,15);assert.equal(out.state.units[1].status.pmPenaltyNext,1);assert(!out.events.some(e=>e.source==='tackle'));
 const begun=endTurn(out.state,{unitId:'a'}).state;assert.equal(begun.units[1].pm,2);assert.equal(begun.units[1].status.pmPenaltyNext,0);
});
test('hammer can damage and destroy enemy Pilar; destruction unblocks the tile and never awards a win',()=>{
 let s=arfeli(pillar(make()));let o=hammer(s,'pillar1');assert.equal(o.state.objects[0].hp,2);assert.equal(o.state.units[0].x,3);assert.equal(o.state.phase,'active');assert.equal(o.state.units[1].status.pmPenaltyNext,0);
 s=endTurn(endTurn(o.state,{unitId:'a'}).state,{unitId:'b'}).state;o=hammer(s,'pillar1');assert.equal(o.state.objects[0].alive,false);assert(o.events.some(e=>e.type==='object.destroyed'));assert(!o.events.some(e=>e.type==='unit.died'));assert.equal(o.state.phase,'active');assert.deepEqual(calculatePath(o.state,'a',{x:4,y:5}),[{x:3,y:5},{x:4,y:5}]);assert(serializeState(o.state));
});
test('jump wound charges logical distance at landing, normal shield; actor death cancels hit and penalty',()=>{
 let s=arfeli(pillar(make()));s.units[0].status.wound=3;s.units[0].shield=[{amount:4,sourceId:'a'}];let o=hammer(s);assert.equal(o.state.units[0].hp,98);assert.equal(o.events.filter(e=>e.source==='wound.jump').length,2);assert.deepEqual(o.state.units[0].shield,[]);
 s=arfeli(pillar(make()));s.units[0].hp=5;s.units[0].status.wound=3;o=hammer(s);assert.equal(o.state.units[0].x,5);assert.equal(o.state.units[0].hp,0);assert.equal(o.state.units[1].hp,115);assert.equal(o.state.units[1].status.pmPenaltyNext,0);assert.equal(o.state.winnerTeam,'B');assert.equal(o.state.units[0].pa,2);assert(serializeState(o.state));
 s=arfeli(pillar(make()));s.units[0].hp=1;s.units[0].status.poison=1;o=hammer(s);assert.equal(o.state.units[0].x,3);assert.equal(o.state.units[1].hp,115);
});
test('no landing, range, PA and malformed Pilares reject without mutation; melee objects never receive wound',()=>{
 let s=make();s.board.obstacles=['5,5','7,5','6,4','6,6'];const before=serializeState(s);assert.deepEqual(abilityTargets(s,'a','hammer'),[]);assert.throws(()=>hammer(s),e=>e.code==='NO_LANDING');assert.equal(serializeState(s),before);
 s=arfeli(pillar(make()));s.units[0].pa=3;assert.throws(()=>hammer(s),e=>e.code==='INSUFFICIENT_PA');s=arfeli(pillar(make()));s.units[0].x=1;assert.throws(()=>hammer(s),e=>e.code==='OUT_OF_RANGE');
 s=arfeli(pillar(make()));const malformed=structuredClone(s);malformed.objects[0].ownerId='a';assert.throws(()=>serializeState(malformed),e=>e.code==='INVALID_OBJECT');malformed.objects[0].ownerId='b';malformed.objects[0].x=3;assert.throws(()=>serializeState(malformed),e=>e.code==='INVALID_POSITION');
 const o=useAbility(s,{unitId:'a',abilityId:'daggers',targetId:'pillar1'});assert.equal(o.state.objects[0].hp,5);assert(!o.events.some(e=>e.type==='status.applied'));
});
test('landing candidates match executed pinned offline, including blockers, ties and staying adjacent',()=>{
 const src=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:arfeli-rework-0626.js'],{encoding:'utf8'});const fragment=src.slice(src.indexOf('const HAMMER_DIRS='),src.indexOf('function hammerTargetValid('));
 let s=arfeli(pillar(make()));const ctx=vm.createContext({adjCardinal:(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1,md:(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),inside:(x,y)=>x>=0&&x<12&&y>=0&&y<12,free:(x,y)=>!s.board.obstacles.includes(`${x},${y}`)&&![...s.units,...s.objects].some(u=>u.alive&&u.x===x&&u.y===y)});vm.runInContext(fragment,ctx);
 for(const pos of [{x:3,y:5},{x:5,y:4},{x:5,y:5},{x:6,y:3},{x:8,y:5}]){Object.assign(s.units[0],pos);const expected=ctx.hammerLanding(s.units[0],s.units[1]),got=hammerLanding(s,s.units[0],s.units[1]);assert.deepEqual(got,expected?{x:expected.x,y:expected.y}:null);}
});
test('accepted jump animates direct endpoints without inventing walked cells; both views preserve confirmed state',()=>{
 const combat=arfeli(pillar(make())),after=hammer(combat).state;const before={id:'m',version:1,combat},next={id:'m',version:2,combat:after,presentation:{moves:[{version:2,unitId:'a',kind:'jump',path:[{x:3,y:5},{x:5,y:5}]}]}};
 assert.deepEqual(confirmedRoutes(before,next),[{unitId:'a',path:[{x:3,y:5},{x:5,y:5}],jump:true}]);const t=new MotionTimeline();t.receive(before,0);t.receive(next,100);assert.equal(t.sample('a',260).x,4);assert.equal(t.sample('a',260).lift,18);assert.equal(t.sample('a',420),null);assert.equal(after.units[0].x,5);
 const slots={a:{id:'a',team:'A',controllerId:'one',championId:'arfeli',skills:['hammer']},b:{id:'b',team:'B',controllerId:'two',championId:'coloso',skills:['rock']}};const html=renderArena({state:{phase:'combat',combat,slots},actor:'one',slotId:'a',canMove:true,blocked:false,remaining:24,abilitySelection:{abilityId:'hammer',targetId:'b'}});assert.match(html,/pilar-coloso.png/);assert.match(html,/Salto a casilla libre/);assert.match(html,/forced-destination/);
});
