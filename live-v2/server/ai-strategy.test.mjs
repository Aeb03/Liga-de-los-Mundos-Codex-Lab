import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,endTurn} from '../combat-core.mjs';
import {planAI} from './ai.mjs';
import {BOT_SKILLS} from './room-layout.mjs';
function setup(champion,enemy={x:5,y:8},skills=BOT_SKILLS[champion]){
 let state=initializeCombat({units:[createUnit({id:'A1',team:'A',slot:1,controllerId:'ai',championId:champion,position:{x:5,y:5},skills}),createUnit({id:'B1',team:'B',slot:1,controllerId:'human',championId:'arfeli',position:enemy})],random:()=>.5,clock:1000}).state;
 while(state.order[state.turnIndex]!=='A1')state=endTurn(state,{unitId:state.order[state.turnIndex]}).state;
 return {state,slot:{id:'A1',team:'A',skills}};
}
for(const [champion,type] of [['coloso','createPillar'],['onod','onodAction'],['piplus','piplusMark'],['houngan','houganAction']])test(champion+' uses native setup during a real turn',()=>{
 let {state,slot}=setup(champion);const actions=[];
 for(let i=0;i<20&&state.phase==='active'&&state.order[state.turnIndex]==='A1';i++){const planned=planAI(state,slot);actions.push(planned.action.type);state=planned.out.state;}
 assert(actions.includes(type),actions.join(','));assert(state.phase==='ended'||state.order[state.turnIndex]!=='A1');
});
test('Korgan places a selected trap near an opponent',()=>{
 const {state,slot}=setup('korgan',{x:5,y:8},['trap_spikes','trap_mine']);const planned=planAI(state,slot);
 assert.equal(planned.action.type,'ability');assert(['trap_spikes','trap_mine'].includes(planned.action.abilityId));assert.equal(planned.out.state.traps.filter(t=>t.active).length,1);
});
test('AI takes a detour when the direct approach is blocked, even with no PA',()=>{
 const {state,slot}=setup('arfeli',{x:5,y:9});state.units.find(u=>u.id==='A1').pa=0;
 state.board.obstacles=['4,5','6,5','5,6','4,6','6,6','4,7','6,7'];
 const planned=planAI(state,slot);assert.equal(planned.action.type,'move');assert(planned.out.state.units.find(u=>u.id==='A1').pm<3);
});
test('planning never learns hidden enemy trap positions',()=>{
 const {state,slot}=setup('coloso');state.units.find(u=>u.id==='B1').championId='korgan';const first=planAI(state,slot).action;
 state.traps.push({id:'trap1',number:1,kind:'trap',trapType:'mine',ownerId:'B1',team:'B',x:5,y:6,active:true,hidden:true,createdByKorganTurn:0});
 state.nextTrapId=2;assert.deepEqual(planAI(state,slot).action,first);
});
