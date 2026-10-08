import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,endTurn} from '../combat-core.mjs';
import {abilityOverlay} from './ability-overlay.mjs';
import {renderArena} from './presentation.mjs';
const make=(a={x:5,y:5},b={x:8,y:5},obstacles=[])=>initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:a}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:b})],obstacles}).state;
test('melee shows four orthogonal cells even without an enemy, shield only own tile; queries are pure',()=>{
 const s=make(),before=structuredClone(s);
 for(const id of ['sword','daggers']){const o=abilityOverlay(s,'a',id);assert.equal(o.range.length,4);assert(o.range.every(p=>Math.abs(p.x-5)+Math.abs(p.y-5)===1&&!p.blocked));assert.deepEqual(o.targets,[]);assert.deepEqual(o.effect,[]);}
 assert.deepEqual(abilityOverlay(s,'a','shield','a'),{range:[{x:5,y:5,blocked:false}],targets:['a'],effect:[{x:5,y:5}]});assert.deepEqual(s,before);
 assert.equal(abilityOverlay(make({x:0,y:0}),'a','sword').range.length,2);
});
test('rock shows whole Manhattan diamond, marks blocked LOS, excludes blocked enemy from targets and effect',()=>{
 let s=endTurn(make({x:5,y:5},{x:8,y:5},[{x:7,y:5}]),{unitId:'a'}).state;let o=abilityOverlay(s,'b','rock','a');assert.equal(o.range.length,39);assert(o.range.find(p=>p.x===5&&p.y===5).blocked);assert.deepEqual(o.targets,[]);assert.deepEqual(o.effect,[]);
 s=endTurn(make(),{unitId:'a'}).state;o=abilityOverlay(s,'b','rock','a');assert.deepEqual(o.targets,['a']);assert.deepEqual(o.effect,[{x:5,y:5}]);assert(o.range.every(p=>Math.abs(p.x-8)+Math.abs(p.y-5)<=4));
 s.units[1].monolith=true;assert(abilityOverlay(s,'b','rock').range.some(p=>p.x===3&&p.y===5));
});
test('disabled or stale selection cannot invent an effect; HUD hides overlays for rival/pending and cancels on movement',()=>{
 const combat=make({x:5,y:5},{x:6,y:5});const slots={a:{id:'a',team:'A',controllerId:'one',championId:'arfeli',skills:['sword','daggers','shield','bow']},b:{id:'b',team:'B',controllerId:'two',championId:'coloso',skills:['rock','stonearmor','absorb','quake']}};
 const args={state:{phase:'combat',combat,slots},actor:'one',slotId:'a',canMove:true,blocked:false,remaining:20,abilitySelection:{abilityId:'daggers',targetId:'b'}};
 let html=renderArena(args);assert.equal((html.match(/class="tile ability-range/g)||[]).length,4);assert.match(html,/ability-selected ability-effect/);assert.doesNotMatch(html,/class="command-feedback"/);
 for(const extra of [{canMove:false},{blocked:true},{abilitySelection:null}]){html=renderArena({...args,...extra});assert(!html.includes('class="tile ability-range'));assert(!html.includes('ability-selected ability-effect'));}
 assert.deepEqual(abilityOverlay(combat,'a','impulse'),{range:[],targets:[],effect:[]});assert.deepEqual(abilityOverlay(combat,'b','rock'),{range:[],targets:[],effect:[]});
 combat.units[0].skillUsesThisTurn.daggers=1;assert.deepEqual(abilityOverlay(combat,'a','daggers','b').effect,[]);
});
test('rock range and blocked-cell map match pinned offline range-state and LOS sampling',()=>{
 const src=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:app.js'],{encoding:'utf8'});
 const extract=n=>src.slice(src.indexOf(`function ${n}(`),src.indexOf('\n}',src.indexOf(`function ${n}(`))+2);
 let s=endTurn(make({x:5,y:5},{x:8,y:5},[{x:7,y:5}]),{unitId:'a'}).state;
 const ctx=vm.createContext({md:(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),adj8:(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1,key:(x,y)=>`${x},${y}`,ability:()=>({id:'rock',range:4}),entityAt:(x,y)=>s.units.find(u=>u.alive&&u.x===x&&u.y===y),isFixedObstacle:(x,y)=>s.board.obstacles.includes(`${x},${y}`)});
 vm.runInContext(['lineCells','clearLOS','effectiveRange','inRange','requiresLOS','abilityRangeState'].map(extract).join('\n'),ctx);
 for(const mono of [false,true]){s.units[1].monolith=mono;const cells=new Map(abilityOverlay(s,'b','rock').range.map(p=>[`${p.x},${p.y}`,p]));for(let y=0;y<12;y++)for(let x=0;x<12;x++){const rs=ctx.abilityRangeState(s.units[1],'rock',x,y),got=cells.get(`${x},${y}`);assert.equal(Boolean(got),Boolean(rs?.inside));if(got)assert.equal(got.blocked,rs.blocked);}}
});

