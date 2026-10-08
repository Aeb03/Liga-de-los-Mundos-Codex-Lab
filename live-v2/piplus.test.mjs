import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createUnit,initializeCombat,endTurn,useAbility,abilityTargets,markPiplus,piplusMarkTargets,impulseDestinations,serializeState,restoreState,previewAbility,createPillar} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';
import {renderArena} from './client/presentation.mjs';
import {confirmedRoutes,MotionTimeline} from './client/motion.mjs';
const make=(p={x:5,y:5},enemy={x:8,y:5},obstacles=[])=>initializeCombat({units:[createUnit({championId:'piplus',id:'p',team:'A',slot:1,controllerId:'one',position:p}),createUnit({championId:'coloso',id:'c',team:'B',slot:1,controllerId:'two',position:enemy})],obstacles}).state;
const cast=(s,abilityId,extra={})=>useAbility(s,{unitId:'p',abilityId,targetId:'c',...extra});
const mark=s=>markPiplus(s,{unitId:'p',targetId:'c'}).state;
const atomic=(s,fn,code)=>{const before=serializeState(s);assert.throws(fn,e=>e.code===code);assert.equal(serializeState(s),before);};
const newTurn=s=>endTurn(endTurn(s,{unitId:'p'}).state,{unitId:'c'}).state;
test('Marca 0 PA, una vez/turno, no activa Veneno, persiste entre turnos y en restauración',()=>{
 let s=make();s.units[0].status.poison=2;s=mark(s);assert.equal(s.units[0].pa,6);assert.equal(s.units[0].hp,90);assert.equal(s.units[0].markedTargetId,'c');assert.equal(s.units[1].status.markedBy,'p');assert.deepEqual(piplusMarkTargets(s,'p'),[]);atomic(s,()=>mark(s),'MARK_UNAVAILABLE');s=newTurn(s);assert.equal(s.units[0].markedTargetId,'c');assert.deepEqual(piplusMarkTargets(s,'p'),['c']);assert.equal(restoreState(serializeState(s)).units[0].markedTargetId,'c');
});
test('Marca rechaza fuera de alcance, LOS, propio, Pilar y unidad inactiva sin mutar',()=>{
 let s=make(undefined,{x:10,y:5});atomic(s,()=>mark(s),'MARK_UNAVAILABLE');s=make(undefined,undefined,[{x:7,y:5}]);atomic(s,()=>mark(s),'MARK_UNAVAILABLE');s=make();atomic(s,()=>markPiplus(s,{unitId:'p',targetId:'p'}),'MARK_UNAVAILABLE');s=endTurn(s,{unitId:'p'}).state;s=createPillar(s,{unitId:'c',position:{x:8,y:6}}).state;atomic(s,()=>markPiplus(s,{unitId:'p',targetId:'pillar1'}),'MARK_UNAVAILABLE');
});
test('Precisión 8/10, PA3, escudo, LOS y objetivo Pilar enemigo sin bonus de Marca',()=>{
 let s=make();assert.equal(cast(s,'precise').state.units[1].hp,107);s=mark(s);s.units[1].shield=[{amount:7,sourceId:'c'}];let o=cast(s,'precise');assert.equal(o.state.units[1].hp,112);assert.equal(o.state.units[0].pa,3);
 s=endTurn(make(),{unitId:'p'}).state;s=createPillar(s,{unitId:'c',position:{x:7,y:5}}).state;s=endTurn(s,{unitId:'c'}).state;o=cast(s,'precise',{targetId:'pillar1'});assert.equal(o.state.objects[0].hp,7);
});
test('Fijación exige Marca+LOS, ignora sólo LOS de la siguiente ofensiva contra ese objetivo y se consume',()=>{
 let s=make();atomic(s,()=>cast(s,'fixation'),'INVALID_TARGET');s=mark(s);s=cast(s,'fixation').state;assert.equal(s.units[0].pa,4);s.board.obstacles.push('7,5');assert.deepEqual(abilityTargets(s,'p','precise'),['c']);const before=serializeState(s);let o=cast(s,'precise');assert.equal(o.state.units[1].hp,105);assert.equal(o.state.units[0].piplusFixationTargetId,null);assert.equal(serializeState(s),before);o.state.units[0].pa=3;atomic(o.state,()=>cast(o.state,'precise'),'BLOCKED_LOS');
 s=mark(make(undefined,undefined));s.board.obstacles.push('7,5');atomic(s,()=>cast(s,'fixation'),'INVALID_TARGET');
});
test('Fijación expira al cierre; Impulso no la consume y tampoco anula alcance',()=>{
 let s=cast(mark(make()),'fixation').state;s=cast(s,'impulse',{position:{x:5,y:6}}).state;assert.equal(s.units[0].piplusFixationTargetId,'c');s=newTurn(s);assert.equal(s.units[0].piplusFixationTargetId,null);s=cast(s,'fixation').state;s.units[1].x=11;assert.deepEqual(abilityTargets(s,'p','precise'),[]);atomic(s,()=>cast(s,'precise'),'OUT_OF_RANGE');
});
test('Vector daño6, empuje1/2, Herida por paso real, colisión por pasos restantes y mitad al Pilar',()=>{
 let s=make(undefined,{x:6,y:5});let o=cast(s,'vector');assert.equal(o.state.units[1].x,7);assert.equal(o.state.units[1].hp,109);s=mark(s);s.units[1].status.wound=2;o=cast(s,'vector');assert.equal(o.state.units[1].x,8);assert.equal(o.state.units[1].hp,105);assert.equal(o.state.units[1].pm,3);
 s=mark(make(undefined,{x:6,y:5},[{x:7,y:5}]));o=cast(s,'vector');assert.equal(o.state.units[1].hp,105);assert.equal(o.events.filter(e=>e.type==='unit.moved').length,0);
});
test('Interferencia exige Marca, una vez por rival, consume Fijación, penalización max1 y reset',()=>{
 let s=make();atomic(s,()=>cast(s,'interference'),'INVALID_TARGET');s=cast(mark(s),'fixation').state;s.board.obstacles.push('7,5');s=cast(s,'interference').state;assert.equal(s.units[1].status.pmPenaltyNext,1);assert.equal(s.units[0].piplusFixationTargetId,null);atomic(s,()=>cast(s,'interference'),'INVALID_TARGET');s=endTurn(s,{unitId:'p'}).state;assert.equal(s.units[1].pm,2);assert.equal(s.units[1].status.pmPenaltyNext,0);s=endTurn(s,{unitId:'c'}).state;assert.deepEqual(s.units[0].piplusInterferenceTargets,[]);
});
test('Ruptura 14/4PA consume Marca y Fijación y bloquea remarcar hasta nuevo turno',()=>{
 let s=cast(mark(make()),'fixation').state;s.board.obstacles.push('7,5');s=cast(s,'rupture').state;assert.equal(s.units[1].hp,101);assert.equal(s.units[0].pa,0);assert.equal(s.units[0].markedTargetId,null);assert.equal(s.units[1].status.markedBy,null);assert.equal(s.units[0].piplusFixationTargetId,null);assert(s.units[0].piplusMarkBlockedThisTurn);atomic(s,()=>mark(s),'MARK_UNAVAILABLE');s=newTurn(s);s.board.obstacles=[];assert.deepEqual(piplusMarkTargets(s,'p'),['c']);
});
test('Impulso cardinal 1/2, atraviesa obstáculos/ocupación intermedia, destino libre y límite, sin PM/placaje',()=>{
 let s=make(undefined,{x:8,y:5},[{x:6,y:5}]),before=serializeState(s);assert(impulseDestinations(s,'p').some(p=>p.x===7&&p.y===5));let o=cast(s,'impulse',{position:{x:7,y:5}});assert.equal(o.state.units[0].x,7);assert.equal(o.state.units[0].pa,4);assert.equal(o.state.units[0].pm,3);assert.equal(o.state.units[0].hp,90);assert.equal(o.events.find(e=>e.kind==='dash').path.length,2);assert.equal(serializeState(s),before);atomic(o.state,()=>cast(o.state,'impulse',{position:{x:7,y:6}}),'ABILITY_LIMIT');
 for(const pos of [{x:6,y:6},{x:6,y:5},{x:8,y:5},{x:12,y:5}])atomic(s,()=>cast(s,'impulse',{position:pos}),'INVALID_POSITION');
 s=make(undefined,{x:6,y:5});assert.equal(cast(s,'impulse',{position:{x:7,y:5}}).state.units[0].x,7);
});
test('Impulso empuja primero al enemigo exactamente detrás; colisión, escudo y muerte detienen antes del dash',()=>{
 let s=make(undefined,{x:4,y:5}),o=cast(s,'impulse',{position:{x:7,y:5}});assert.equal(o.state.units[1].x,3);assert.equal(o.state.units[0].x,7);assert.equal(o.events.filter(e=>e.type==='unit.moved')[0].unitId,'c');
 s=make(undefined,{x:4,y:5},[{x:3,y:5}]);s.units[1].hp=2;o=cast(s,'impulse',{position:{x:7,y:5}});assert.equal(o.state.phase,'ended');assert.equal(o.state.units[0].x,5);assert.equal(o.state.units[0].pa,4);assert(!o.events.some(e=>e.kind==='dash'));
 s=make(undefined,{x:5,y:4});o=cast(s,'impulse',{position:{x:7,y:5}});assert.equal(o.state.units[1].y,4);
});
test('Veneno mortal cancela antes del efecto; Herida de Impulso cobra distancia en destino y escudo absorbe',()=>{
 let s=mark(make());s.units[0].hp=2;s.units[0].status.poison=2;let o=cast(s,'rupture');assert.equal(o.state.units[1].hp,115);assert.equal(o.state.units[0].markedTargetId,'c');assert.equal(o.state.units[0].pa,2);
 s=make();s.units[0].status.wound=3;s.units[0].shield=[{amount:4,sourceId:'p'}];o=cast(s,'impulse',{position:{x:5,y:7}});assert.equal(o.state.units[0].hp,88);assert.equal(o.state.units[0].pm,3);
 s=make();s.units[0].hp=2;s.units[0].status.wound=2;o=cast(s,'impulse',{position:{x:5,y:7}});assert.equal(o.state.units[0].y,7);assert.equal(o.state.phase,'ended');assert.equal(o.events.filter(e=>e.source==='wound.impulse').length,1);
});
test('reglas de destinos y enemigo detrás coinciden con funciones ejecutadas del offline congelado',()=>{
 const src=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:piplus-rework-0628.js'],{encoding:'utf8'}),s=make(undefined,{x:4,y:5},[{x:6,y:5}]);
 const ctx=vm.createContext({isPiplus:u=>u.championId==='piplus',inside:(x,y)=>x>=0&&y>=0&&x<12&&y<12,free:(x,y)=>!s.board.obstacles.includes(`${x},${y}`)&&!s.units.some(t=>t.alive&&t.x===x&&t.y===y),entityAt:(x,y)=>{const t=s.units.find(t=>t.alive&&t.x===x&&t.y===y);return t?{...t,kind:'unit',side:t.team}:null;}});
 const extract=n=>src.slice(src.indexOf(`function ${n}(`),src.indexOf('\n}',src.indexOf(`function ${n}(`))+2);vm.runInContext(['piplusImpulseDestinationValid','impulseAwayEnemy'].map(extract).join('\n'),ctx);
 const u={...s.units[0],side:'A'},valid=new Set(impulseDestinations(s,'p').map(p=>`${p.x},${p.y}`));for(let y=0;y<12;y++)for(let x=0;x<12;x++)assert.equal(valid.has(`${x},${y}`),ctx.piplusImpulseDestinationValid(u,x,y));assert.equal(ctx.impulseAwayEnemy(u,7,5)?.id,'c');assert.equal(ctx.impulseAwayEnemy(u,5,7),null);
});
test('overlays previews no mutan, Fijación muestra LOS ignorada, Impulso ruta y daño, HUD Marca y habilidades',()=>{
 let s=cast(mark(make()),'fixation').state;s.board.obstacles.push('7,5');const before=serializeState(s),o=abilityOverlay(s,'p','precise','c');assert.equal(o.range.find(p=>p.x===8&&p.y===5).blocked,false);assert.equal(o.forced.damage[0].amount,10);assert.equal(serializeState(s),before);
 s=make();s.units[0].status.wound=2;const impulse=abilityOverlay(s,'p','impulse',null,{position:{x:5,y:7}});assert.equal(impulse.forced.moves[0].kind,'dash');assert.equal(impulse.forced.damage.reduce((n,e)=>n+e.amount,0),4);
 const state={phase:'combat',combat:s,slots:{p:{id:'p',team:'A',controllerId:'one',championId:'piplus',skills:['precise','vector','impulse','rupture']},c:{id:'c',team:'B',controllerId:'two',championId:'coloso',skills:['rock','quake','absorb','collapse']}}},html=renderArena({state,actor:'one',slotId:'p',blocked:false,canMove:true,remaining:20,abilitySelection:{abilityId:'impulse',position:{x:5,y:7}}});assert.match(html,/data-action="piplusMark"/);assert.match(html,/forced-destination/);assert.match(html,/ability-selected ability-effect/);assert(!html.includes('NaN'));
});
test('dash aceptado anima endpoints sobre obstáculo sin falso BFS, sin arco de salto y sin mutación',()=>{
 const s=make(undefined,{x:8,y:5},[{x:6,y:5}]),o=cast(s,'impulse',{position:{x:7,y:5}});const prev={id:'m',version:1,combat:s},next={id:'m',version:2,combat:o.state,presentation:{moves:o.events.filter(e=>e.type==='unit.moved').map(e=>({...e,version:2})),fromVersion:0}},before=structuredClone(next);assert.equal(confirmedRoutes(prev,next)[0].dash,true);const t=new MotionTimeline();t.receive(prev,0);t.receive(next,0);const sample=t.sample('p',120);assert.equal(sample.x,6);assert.equal(sample.lift,undefined);assert.deepEqual(next,before);
});
