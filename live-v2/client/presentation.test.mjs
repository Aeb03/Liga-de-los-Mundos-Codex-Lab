import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArena, turnSequence, unitIndicators, compactStatusIcons, statusChipLabels, shieldTotal, dollVariant, boardPoint } from './presentation.mjs';
import { createUnit, initializeCombat } from '../combat-core.mjs';
function fixture() {
 const slots={A1:{id:'A1',team:'A',controllerId:'shared',championId:'piplus',position:{x:2,y:5},skills:['precise','vector','impulse','interference']},B1:{id:'B1',team:'B',controllerId:'rival',championId:'coloso',position:{x:9,y:5},skills:['rock','stonearmor','absorb','quake']}};
 const combat=initializeCombat({units:Object.values(slots).map(s=>createUnit({...s,slot:1})),random:.25}).state;
 return {phase:'combat',slots,combat};
}
test('HUD uses authoritative resources without mutating state or charging preview damage',()=>{
 const state=fixture(),u=state.combat.units[0];u.hp=78;u.pa=4;u.pm=2;u.shield=[{amount:7,sourceId:'A1'},{amount:5,sourceId:'B1'}];
 const before=structuredClone(state);
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:24,canMove:true,blocked:false,preview:{path:[{x:2,y:5},{x:3,y:5}],cost:1,tackleDamage:2}});
 assert.match(html,/78\/90 PV/);assert.match(html,/4 PA/);assert.match(html,/2 PM/);assert.match(html,/Escudo 12/);
 assert.equal((html.match(/<button class="combat-skill[^"]*"[^>]* disabled/g)??[]).length,0);
 assert.match(html,/Flecha de Precisión/);assert.deepEqual(state,before);
});
test('turn queue rotates from active slot, excludes dead units and preserves independent identities',()=>{
 const state=fixture();const extra=createUnit({championId:'onod',id:'A2',team:'A',slot:2,controllerId:'shared',position:{x:3,y:5}});
 state.combat.units.push(extra);state.combat.order=['A1','B1','A2'];state.combat.turnIndex=1;state.combat.units[0].alive=false;
 assert.deepEqual(turnSequence(state.combat).map(u=>u.id),['B1','A2']);
 assert.equal(extra.controllerId,state.slots.A1.controllerId);assert.equal(extra.team,'A');
});
test('status display sums shields and reads positive confirmed values without inventing effects',()=>{
 const u=fixture().combat.units[0];assert.deepEqual(unitIndicators(u),[]);
 u.status={wound:3,poison:2,burn:1};u.shield=[{amount:4},{amount:6}];
 assert.deepEqual(unitIndicators(u),[['Escudo',10],['Herida',3],['Veneno',2],['Quemadura',1]]);
});

test('sword targets are marked and action is enabled only for own valid active slot',()=>{
 const state=fixture();state.slots.A1.championId='arfeli';state.slots.A1.skills=['sword','daggers','bow','shield'];state.combat=initializeCombat({units:[createUnit({...state.slots.A1,slot:1,position:{x:2,y:5}}),createUnit({...state.slots.B1,slot:1,position:{x:3,y:5}})]}).state;
 const args={state,actor:'shared',slotId:'A1',remaining:24,blocked:false,canMove:true,abilitySelection:{targetId:'B1'}};
 const before=structuredClone(state);let html=renderArena(args);assert.match(html,/data-action="sword"  title/);assert.match(html,/ability-target ability-selected ability-effect/);assert.match(html,/Corte con Espada: 10 daño · 2 PA/);assert.match(html,/0\/2/);assert.deepEqual(state,before);
 html=renderArena({...args,canMove:false});assert.match(html,/data-action="sword" disabled/);
 state.combat.units[0].skillUsesThisTurn.sword=2;html=renderArena(args);assert.match(html,/data-action="sword" disabled/);assert.match(html,/2\/2/);
});

test('Dagas preview names wound and movement preview distinguishes normal wound damage without mutating',()=>{
 const state=fixture();state.slots.A1.championId='arfeli';state.slots.A1.skills=['sword','daggers','bow','shield'];state.combat=initializeCombat({units:[createUnit({...state.slots.A1,slot:1,position:{x:2,y:5}}),createUnit({...state.slots.B1,slot:1,position:{x:3,y:5}})]}).state;
 const args={state,actor:'shared',slotId:'A1',remaining:24,blocked:false,canMove:true,abilitySelection:{abilityId:'daggers',targetId:'B1'}};
 const before=structuredClone(state);let html=renderArena(args);assert.match(html,/Dagas Danzantes: 10 daño \+ Herida 2 · 3 PA/);assert.match(html,/data-action="daggers"  title/);assert.deepEqual(state,before);
 html=renderArena({...args,abilitySelection:null,preview:{path:[{x:2,y:5},{x:2,y:6}],cost:1,tackleDamage:2,woundDamage:2,remainingHp:0,diesDuringPath:true}});assert.match(html,/Herida: 2 daño · PV final: 0 · MUERTE DURANTE EL RECORRIDO/);
});


test('paridad visual: estados compactos van sobre PV y Escudo queda en línea separada',()=>{
 const state=fixture(),u=state.combat.units.find(u=>u.id==='A1'),enemy=state.combat.units.find(u=>u.id==='B1');
 u.status.wound=2;u.status.poison=3;u.status.burn=4;u.status.paPenaltyNext=1;u.status.pmPenaltyNext=2;u.shield=[{amount:7,sourceId:'A1'}];u.monolith=true;
 const hougan={id:'H',alive:true,championId:'houngan',linkedTargetId:'A1'};
 const marker={id:'M',alive:true,championId:'piplus',markedTargetId:'A1'};
 assert.equal(shieldTotal(u),7);
 assert.deepEqual(compactStatusIcons(u,{units:[marker,hougan]}),['🩸2','☠️3','🔨-1PA','🌿-2PM','🎯','🪡','🗿']);
 assert.deepEqual(statusChipLabels(u,{units:[marker,hougan]}),['🩸 Herida 2','☠️ Veneno 3','🔥 Quemadura 4','🔨 PA -1 próximo','🌿 PM -2 próximo','🎯 Marcado','🪡 Vinculado','🗿 Monolito']);
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'A1'});
 assert.match(html,/class="piece-status"[^>]*>🩸2 ☠️3 🔨-1PA 🌿-2PM 🗿</);
 assert.match(html,/class="piece-shield"[^>]*>🛡️7</);
 assert.match(html,/🩸 Herida 2/);assert.match(html,/🔥 Quemadura 4/);
});

test('paridad visual: inspección puede mostrar rival u objeto sin cambiar al campeón activo',()=>{
 const state=fixture();
 let html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'B1'});
 assert.match(html,/Coloso · B1/);assert.match(html,/data-inspect-id="B1"/);assert.match(html,/Flecha de Precisión/);
 const object={id:'pillar1',number:1,kind:'object',type:'pillar',ownerId:'B1',team:'B',x:8,y:5,hp:12,maxHp:15,alive:true,shield:[{amount:3,sourceId:'B1'}],blocksLOS:true,createdByColosoTurn:0};
 state.combat.objects.push(object);state.combat.nextPillarId=2;
 html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'pillar1'});
 assert.match(html,/Pilar 1/);assert.match(html,/12\/15 PV/);assert.match(html,/Escudo 3/);assert.match(html,/Bloquea movimiento y línea de visión/);
});

test('Muñeco enemigo usa variante 02 y aliado usa variante 01, también en datos de animación',()=>{
 const slots={
   A1:{id:'A1',team:'A',controllerId:'shared',championId:'houngan',position:{x:2,y:5},skills:['needle','transfer','ritual','curse']},
   B1:{id:'B1',team:'B',controllerId:'rival',championId:'piplus',position:{x:9,y:5},skills:['precise','vector','impulse','interference']}
 };
 const state={phase:'combat',slots,combat:initializeCombat({units:Object.values(slots).map(s=>createUnit({...s,slot:1}))}).state};
 const owner=state.combat.units.find(u=>u.id==='A1');owner.linkedTargetId='B1';
 state.combat.objects.push({id:'doll1',number:1,kind:'object',type:'doll',ownerId:'A1',team:'A',x:4,y:5,hp:16,maxHp:16,alive:true,shield:[],blocksLOS:false,linkedTargetId:'B1',linkMode:'enemy',movePm:3});
 state.combat.nextDollId=2;
 let html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true});
 assert.match(html,/muneco-houngan-02\/down-right\.png/);assert.match(html,/data-doll-variant="muneco-houngan-02"/);
 assert.equal(dollVariant({linkMode:'ally'}),'muneco-houngan-01');
 assert.equal(dollVariant({linkMode:'enemy'}),'muneco-houngan-02');
});


test('cámara rota vista isométrica sin cambiar coordenadas lógicas ni acciones',()=>{
 const state=fixture();
 assert.deepEqual(boardPoint(2,5,1),boardPoint(6,2,0));
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,camera:{x:12,y:-8,rotation:1,zoom:1.25}});
 assert.match(html,/data-arena-rotation="1"/);
 assert.match(html,/arena-scene" style="transform:translate\(12px,-8px\) scale\(1\.25\)"/);
 assert.match(html,/data-action="rotateCameraLeft"/);
 assert.match(html,/data-action="rotateCameraRight"/);
 assert.match(html,/data-hud-panel="round"/);
 assert.match(html,/data-hud-panel="player"/);
 assert.match(html,/data-hud-panel="enemy"/);
 assert.match(html,/data-hud-panel="command"/);
 assert.match(html,/data-hud-panel="camera"/);
 assert.match(html,/data-action="precise"/);
});

test('paneles laterales admiten horizontal/vertical y ronda/comando permanecen horizontales',()=>{
 const state=fixture();
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,hudSettings:{
   player:{orientation:'horizontal',collapsed:false},
   enemy:{orientation:'vertical',collapsed:true},
   round:{orientation:'vertical',collapsed:false},
   command:{orientation:'vertical',collapsed:true}
 }});
 assert.match(html,/live-roster own hud-horizontal/);
 assert.match(html,/live-roster rival collapsed hud-vertical/);
 assert.match(html,/live-round hud-horizontal/);
 assert.match(html,/live-command battle-command-panel collapsed hud-horizontal/);
 assert.match(html,/data-hud-orient="player"/);
 assert.match(html,/data-hud-orient="enemy"/);
 assert.doesNotMatch(html,/data-hud-orient="round"/);
 assert.doesNotMatch(html,/data-hud-orient="command"/);
});


test('HUD mantiene las cuatro habilidades visibles y sólo Mover + Fin turno como acciones',()=>{
  const state=fixture();
  const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true});
  assert.match(html,/data-action="moveMode"/);
  assert.match(html,/data-action="end"/);
  assert.doesNotMatch(html,/data-action="toggleSkills"/);
  assert.doesNotMatch(html,/skill-drawer/);
  assert.match(html,/data-skill="precise"/);
  assert.match(html,/data-skill="vector"/);
  assert.match(html,/data-skill="impulse"/);
  assert.match(html,/data-skill="interference"/);
  assert.match(html,/tile\s+reachable/);
});

test('campeones tienen hitbox táctil para inspección directa desde la arena',()=>{
  const state=fixture();
  const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'B1'});
  assert.match(html,/data-inspect-id="B1" class="inspected-entity"/);
  assert.match(html,/class="piece-hitbox"/);
  assert.match(html,/Coloso · B1/);
});


test('AoE fijado usa magenta semántico sin reemplazar las casillas de alcance LIVE v2',()=>{
  const slots={
    A1:{id:'A1',team:'A',controllerId:'shared',championId:'korgan',position:{x:2,y:5},skills:['grenade','shot','hook','hunterstep']},
    B1:{id:'B1',team:'B',controllerId:'rival',championId:'piplus',position:{x:8,y:5},skills:['precise','vector','impulse','interference']}
  };
  const combat=initializeCombat({units:Object.values(slots).map(s=>createUnit({...s,slot:1}))}).state;
  combat.order=['A1','B1'];combat.turnIndex=0;
  const state={phase:'combat',slots,combat};
  const selection={abilityId:'grenade',unitId:'A1',version:1,position:{x:4,y:5},aoe:{active:true,abilityId:'grenade',target:{x:4,y:5},locked:true}};
  const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,abilitySelection:selection});
  assert.match(html,/class="live-board aoe-preview-active aoe-preview-locked-state"/);
  assert.match(html,/ability-range/);
  assert.match(html,/aoe-preview/);
  assert.match(html,/aoe-preview-center/);
  assert.match(html,/aoe-preview-locked/);
  assert.match(html,/Área afectada/);
  assert.match(html,/Área fijada\. Arrastrá para cambiarla o tocá otra vez el centro para lanzar\./);
});
