import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnit, initializeCombat, endTurn, resolvePath, useAbility,
  korganTrapDestinations, korganDisarmTargets, korganAction,
  hunterStepDestinations, abilityTargets, serializeState, restoreState
} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';
import {renderArena} from './client/presentation.mjs';
import {createMatch, AuthoritativeService, MemoryRepository} from './server/authoritative-service.mjs';

const make=(enemy='piplus',enemyPos={x:8,y:5},kPos={x:5,y:5})=>{
  const k=createUnit({championId:'korgan',id:'k',team:'A',slot:1,controllerId:'a',position:kPos});
  k.initiative=99;
  return initializeCombat({units:[k,createUnit({championId:enemy,id:'e',team:'B',slot:1,controllerId:'b',position:enemyPos})]}).state;
};
const cast=(s,abilityId,extra={})=>useAbility(s,{unitId:'k',abilityId,...extra});
const cycle=s=>endTurn(endTurn(s,{unitId:'k'}).state,{unitId:'e'}).state;
const atomic=(s,fn,code)=>{const before=serializeState(s);assert.throws(fn,e=>e.code===code);assert.equal(serializeState(s),before);};

test('Korgan usa stats y seis habilidades del rework congelado',()=>{
 const base=createUnit({championId:'korgan',id:'base',team:'A',slot:1,controllerId:'a',position:{x:1,y:1}});
 assert.deepEqual({hp:base.hp,pa:base.pa,pm:base.pm,initiative:base.initiative},{hp:100,pa:6,pm:4,initiative:4});
 const s=make();
 for(const id of ['trap_spikes','trap_mine','grenade','shot','hook','hunterstep'])assert.doesNotThrow(()=>abilityTargets(s,'k',id));
});

test('Trampas: colocación LOS/rango, límites por turno, máximo tres y persistencia',()=>{
 let s=make();
 assert(korganTrapDestinations(s,'k','trap_spikes').some(p=>p.x===6&&p.y===5));
 s=cast(s,'trap_spikes',{position:{x:6,y:5}}).state;
 s=cast(s,'trap_spikes',{position:{x:5,y:4}}).state;
 atomic(s,()=>cast(s,'trap_spikes',{position:{x:5,y:6}}),'ABILITY_LIMIT');
 s=cycle(s);s=cast(s,'trap_mine',{position:{x:5,y:6}}).state;
 assert.equal(s.traps.filter(t=>t.active).length,3);
 assert.equal(korganTrapDestinations(s,'k','trap_spikes').length,0);
 assert.equal(s.nextTrapId,4);assert.deepEqual(restoreState(serializeState(s)),s);
});

test('Pinchos y Mina se activan al entrar: daño, Herida y -1 PA inmediato',()=>{
 let s=make();
 s=cast(s,'trap_spikes',{position:{x:6,y:5}}).state;
 s=cast(s,'trap_mine',{position:{x:7,y:5}}).state;
 s=endTurn(s,{unitId:'k'}).state;
 const r=resolvePath(s,'e',[{x:8,y:5},{x:7,y:5},{x:6,y:5}]);
 const e=r.state.units[1];
 assert.equal(e.hp,71);assert.equal(e.status.wound,1);assert.equal(e.pa,5);assert.equal(e.status.paPenaltyNext,0);
 assert.deepEqual(r.state.traps.map(t=>t.active),[false,false]);
 assert.equal(r.events.filter(e=>e.type==='trap.triggered').length,2);
 assert.deepEqual(r.events.filter(e=>e.type==='resource.lost'&&e.resource==='pa').map(e=>e.value),[5]);
 const begun=endTurn(r.state,{unitId:'e'}).state;
 assert.equal(begun.units[0].pa,6);
});

test('dos Minas Eléctricas restan 1 PA cada una en el mismo recorrido: 6 → 5 → 4',()=>{
 let s=make();
 s.traps=[
  {id:'trap1',number:1,kind:'trap',trapType:'mine',ownerId:'k',team:'A',x:7,y:5,active:true,hidden:true,createdByKorganTurn:0},
  {id:'trap2',number:2,kind:'trap',trapType:'mine',ownerId:'k',team:'A',x:6,y:5,active:true,hidden:true,createdByKorganTurn:0}
 ];
 s.nextTrapId=3;
 s=endTurn(s,{unitId:'k'}).state;
 assert.equal(s.units[1].pa,6);
 const r=resolvePath(s,'e',[{x:8,y:5},{x:7,y:5},{x:6,y:5}]);
 assert.equal(r.state.units[1].pa,4);
 assert.equal(r.state.units[1].hp,74);
 assert.equal(r.state.units[1].status.paPenaltyNext,0);
 assert.deepEqual(r.events.filter(e=>e.type==='resource.lost'&&e.resource==='pa').map(e=>e.value),[5,4]);
 assert.deepEqual(r.state.traps.map(t=>t.active),[false,false]);
});

test('Gancho atrae 1/2 paso a paso y puede hacer caer al rival en una trampa',()=>{
 let s=make('piplus',{x:8,y:5});
 s=cast(s,'trap_spikes',{position:{x:7,y:5}}).state;
 const r=cast(s,'hook',{targetId:'e',distance:1});
 assert.equal(r.state.units[1].x,7);
 assert.equal(r.state.units[1].hp,73);
 assert.equal(r.state.units[1].status.wound,1);
 assert(r.events.some(e=>e.type==='trap.triggered'));
 s=make('piplus',{x:8,y:5});const pulled=cast(s,'hook',{targetId:'e',distance:2});
 assert.equal(pulled.state.units[1].x,6);assert.equal(pulled.state.units[1].hp,84);
 atomic(s,()=>cast(s,'hook',{targetId:'e',distance:3}),'INVALID_DISTANCE');
});

test('Granada usa cruz 10/6, empuja laterales y no daña al propio Korgan',()=>{
 let s=make('piplus',{x:8,y:5});
 const r=cast(s,'grenade',{position:{x:7,y:5}});
 assert.equal(r.state.units[1].hp,84);assert.equal(r.state.units[1].x,9);assert.equal(r.state.units[0].hp,100);
 const overlay=abilityOverlay(s,'k','grenade',null,{position:{x:7,y:5}});
 assert.equal(overlay.effect.length,5);assert(overlay.forced.moves.some(m=>m.unitId==='e'));
});

test('Disparo sólo fila/columna y Gancho sólo campeón enemigo con LOS',()=>{
 let s=make('piplus',{x:8,y:5});
 assert.deepEqual(abilityTargets(s,'k','shot'),['e']);assert.deepEqual(abilityTargets(s,'k','hook'),['e']);
 assert.equal(cast(s,'shot',{targetId:'e'}).state.units[1].hp,80);
 s=make('piplus',{x:7,y:6});assert.deepEqual(abilityTargets(s,'k','shot'),[]);
 s.board.obstacles=['6,5'];s.units[1].x=7;s.units[1].y=5;assert.deepEqual(abilityTargets(s,'k','shot'),[]);assert.deepEqual(abilityTargets(s,'k','hook'),[]);
});

test('Paso del Cazador cuesta 1 PA, no PM, cobra Herida por paso y una vez por turno',()=>{
 let s=make('piplus',{x:9,y:5});s.units[0].status.wound=2;
 assert(hunterStepDestinations(s,'k').some(p=>p.x===7&&p.y===5));
 const r=cast(s,'hunterstep',{position:{x:7,y:5}});
 assert.equal(r.state.units[0].x,7);assert.equal(r.state.units[0].pa,5);assert.equal(r.state.units[0].pm,4);assert.equal(r.state.units[0].hp,96);
 atomic(r.state,()=>useAbility(r.state,{unitId:'k',abilityId:'hunterstep',position:{x:8,y:5}}),'ABILITY_LIMIT');
});

test('Desarmar retira trampa propia, suma +1 PA, no supera una vez por turno',()=>{
 let s=make();s=cast(s,'trap_spikes',{position:{x:6,y:5}}).state;s=cast(s,'trap_spikes',{position:{x:5,y:4}}).state;
 const pa=s.units[0].pa,targets=korganDisarmTargets(s,'k');assert.equal(targets.length,2);
 s=korganAction(s,{unitId:'k',action:'disarm',targetId:targets[0]}).state;
 assert.equal(s.units[0].pa,pa+1);assert.equal(s.traps[0].active,false);assert.equal(korganDisarmTargets(s,'k').length,0);
 atomic(s,()=>korganAction(s,{unitId:'k',action:'disarm',targetId:targets[1]}),'KORGAN_ACTION_UNAVAILABLE');
});

test('HUD muestra trampas propias, controles de Korgan y nunca NaN',()=>{
 let s=make();s=cast(s,'trap_spikes',{position:{x:6,y:5}}).state;
 const slots={k:{...s.units[0],skills:['trap_spikes','grenade','shot','hook']},e:{...s.units[1],skills:['precise','vector','impulse','fixation']}};
 const html=renderArena({state:{phase:'combat',slots,combat:s},actor:'a',slotId:'k',canMove:true,blocked:false,remaining:20,abilitySelection:{abilityId:'hook',targetId:'e'}});
 assert(html.includes('trampa-korgan.png'));assert(html.includes('Preparación Oculta'));assert(html.includes('Atraer 1'));assert(html.includes('Atraer 2'));assert(!html.includes('NaN'));
});

test('Servidor oculta trampas rivales pero el dueño las conserva',async()=>{
 let now=1000;const slots=[{id:'A1',team:'A',slot:1,controllerId:'u1'},{id:'B1',team:'B',slot:1,controllerId:'u2'}];
 const repo=new MemoryRepository([createMatch({mapId:"central-classic",id:'m',creatorId:'u1',slots,createdAt:now})]);
 const svc=new AuthoritativeService(repo,{clock:()=>now,random:()=>.25});
 const cmd=(id,type,v,extra={})=>({id,matchId:'m',type,expectedVersion:v,...extra});
 let v=0;
 for(const [who,champion,slot,skills] of [
  ['u1','korgan','A1',['trap_spikes','grenade','shot','hook']],
  ['u2','piplus','B1',['precise','vector','impulse','fixation']]
 ]){
  await svc.command(who,cmd('s'+slot,'select',v,{slotId:slot,championId:champion,skills}));v++;
  await svc.command(who,cmd('r'+slot,'setReady',v,{slotId:slot,ready:true}));v++;
 }
 for(const [who,slot,position] of [['u1','A1',{x:0,y:3}],['u2','B1',{x:11,y:3}]]){
  await svc.command(who,cmd('p'+slot,'setPosition',v,{slotId:slot,position}));v++;
  await svc.command(who,cmd('c'+slot,'confirmPosition',v,{slotId:slot}));v++;
 }
 let out=await svc.command('u1',cmd('start','startCombat',v));v=out.version;
 // Piplus starts by initiative; end its turn so Korgan becomes active.
 out=await svc.command('u2',cmd('endp','endTurn',v,{slotId:'B1',expectedTurn:out.turn}));v=out.version;
 out=await svc.command('u1',cmd('trap','ability',v,{slotId:'A1',expectedTurn:out.turn,abilityId:'trap_spikes',position:{x:1,y:3}}));
 const own=await svc.snapshot('u1','m'),rival=await svc.snapshot('u2','m');
 assert.equal(own.combat.traps.filter(t=>t.active).length,1);assert.equal(rival.combat.traps.length,0);
});
