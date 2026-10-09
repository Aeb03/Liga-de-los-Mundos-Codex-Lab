import * as c from './combat-core.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const run=(types,blocked=false,wound=0)=>{
let s=c.initializeCombat({units:[c.createUnit({championId:'houngan',id:'h',team:'A',slot:1,controllerId:'A',position:{x:5,y:5}}),c.createUnit({championId:'korgan',id:'k',team:'A',slot:2,controllerId:'A',position:{x:9,y:7}}),c.createUnit({championId:'coloso',id:'e',team:'B',slot:1,controllerId:'B',position:{x:8,y:5}}),c.createUnit({championId:'onod',id:'b',team:'B',slot:2,controllerId:'B',position:{x:0,y:0}})],obstacles:blocked?[{x:9,y:5}]:[]}).state;
const cast=(u,id,targetId,position)=>s=c.useAbility(s,{unitId:u,abilityId:id,targetId,position}).state;
const advance=()=>{const id=s.order[s.turnIndex];s=s.dollPhase?c.endHouganDollPhase(s,{unitId:id}).state:c.endTurn(s,{unitId:id}).state;};
const until=id=>{for(let n=0;s.order[s.turnIndex]!==id||s.dollPhase;n++){assert(n<20);advance();}};
cast('h','needle','e');s=c.houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:4}}).state;advance();until('k');
if(!blocked)cast('k',types[0],null,{x:9,y:5});advance();until('k');if(!blocked)cast('k',types[1],null,{x:10,y:5});advance();until('h');
s.units.find(u=>u.id==='e').status.wound=wound;
const before=structuredClone(s.units.find(u=>u.id==='e'));cast('h','dance','h');advance();
const out=c.moveHouganDoll(s,{unitId:'h',path:[{x:6,y:4},{x:7,y:4},{x:8,y:4},{x:9,y:4}]});s=out.state;c.restoreState(c.serializeState(s));const after=structuredClone(s.units.find(u=>u.id==='e'));until('e');
return {types,blocked,wound,before:{hp:before.hp,pa:before.pa,pm:before.pm},after:{hp:after.hp,pa:after.pa,pm:after.pm,x:after.x,y:after.y,wound:after.status.wound},nextTurnPA:s.units.find(u=>u.id==='e').pa,triggered:out.events.filter(e=>e.type==='trap.triggered').length,blockedSteps:out.events.filter(e=>e.type==='hougan.dance.blocked').length,damage:out.events.filter(e=>e.type==='damage.applied').map(e=>({target:e.targetId,source:e.source,amount:e.amount}))};
};
test('Danza + dos Minas conserva PA actuales y resta dos en el próximo turno rival',()=>{
 const r=run(['trap_mine','trap_mine']);assert.equal(r.triggered,2);assert.equal(r.after.pa,6);assert.equal(r.nextTurnPA,4);assert.equal(r.before.hp-r.after.hp,16);
});
test('Danza + Pinchos aplica Herida en los pasos posteriores y consume ambas trampas',()=>{
 const r=run(['trap_spikes','trap_spikes']);assert.equal(r.triggered,2);assert.equal(r.before.hp-r.after.hp,23);assert.equal(r.after.wound,2);
});
test('Danza bloqueada no mueve al rival ni causa colisión',()=>{
 const r=run(['trap_spikes','trap_spikes'],true);assert.equal(r.blockedSteps,3);assert.equal(r.after.x,8);assert.equal(r.after.hp,r.before.hp);
});
test('Mina a objetivo sin PA guarda penalización y respeta cero mínimo sin deuda posterior',()=>{
 let s=c.initializeCombat({units:[c.createUnit({championId:'korgan',id:'k',team:'A',slot:1,controllerId:'a',position:{x:5,y:5}}),c.createUnit({championId:'coloso',id:'e',team:'B',slot:1,controllerId:'b',position:{x:8,y:5}})]}).state;
 s=c.useAbility(s,{unitId:'k',abilityId:'trap_mine',position:{x:7,y:5}}).state;s=c.endTurn(s,{unitId:'k'}).state;s.units[1].pa=0;s.units[1].status.paPenaltyNext=7;
 s=c.resolvePath(s,'e',[{x:8,y:5},{x:7,y:5}]).state;assert.equal(s.units[1].pa,0);assert.equal(s.units[1].status.paPenaltyNext,8);
 s=c.endTurn(s,{unitId:'e'}).state;s=c.endTurn(s,{unitId:'k'}).state;assert.equal(s.units[1].pa,0);assert.equal(s.units[1].status.paPenaltyNext,0);
 s=c.endTurn(s,{unitId:'e'}).state;s=c.endTurn(s,{unitId:'k'}).state;assert.equal(s.units[1].pa,6);
});
test('Muñecos aliados, enemigos e históricos bloquean LOS; destrucción la libera',()=>{
 for(const team of ['A','B']){
 const units=[c.createUnit({championId:'houngan',id:'h',team:'A',slot:1,controllerId:'a',position:{x:5,y:5}}),c.createUnit({championId:'coloso',id:'e',team:'B',slot:1,controllerId:'b',position:{x:8,y:5}})];
 if(team==='A')units.push(c.createUnit({championId:'arfeli',id:'a',team:'A',slot:2,controllerId:'a',position:{x:4,y:4}}),c.createUnit({championId:'onod',id:'b',team:'B',slot:2,controllerId:'b',position:{x:0,y:0}}));
 let s=c.initializeCombat({units,random:()=>0}).state;s=c.useAbility(s,{unitId:'h',abilityId:'needle',targetId:team==='A'?'a':'e'}).state;s=c.houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
 const [h,e]=s.units,d=s.objects[0];assert(!c.clearAbilityLOS(s,h,e));assert(c.clearAbilityLOS(s,h,d));
 d.blocksLOS=false;assert(!c.clearAbilityLOS(s,h,e));c.restoreState(c.serializeState(s));d.alive=false;d.hp=0;assert(c.clearAbilityLOS(s,h,e));
 }
});

test('Monolito conserva la penalización al salir durante el turno afectado',()=>{let s=c.initializeCombat({units:[c.createUnit({championId:'coloso',id:'e',team:'A',slot:1,controllerId:'a',position:{x:5,y:5}}),c.createUnit({championId:'piplus',id:'p',team:'B',slot:1,controllerId:'b',position:{x:8,y:5}})]}).state;s.units[0].monolith=true;s.units[0].pm=0;s.units[0].monolithStoredPm=3;s.units[0].status.pmPenaltyNext=2;s=c.endTurn(s,{unitId:'p'}).state;assert.equal(s.units[0].pm,0);s=c.colosoAction(s,{unitId:'e',action:'exit',targetId:'e'}).state;assert.equal(s.units[0].pm,1);});
