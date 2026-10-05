import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArena, turnSequence, unitIndicators, compactStatusIcons, statusChipLabels, shieldTotal } from './presentation.mjs';
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
 enemy.championId='piplus';enemy.markedTargetId='A1';
 const hougan=createUnit({championId:'houngan',id:'H',team:'B',slot:2,controllerId:'rival',position:{x:8,y:5}});hougan.linkedTargetId='A1';
 state.combat.units.push(hougan);
 assert.equal(shieldTotal(u),7);
 assert.deepEqual(compactStatusIcons(u,state.combat),['🩸2','☠️3','🔨-1PA','🌿-2PM','🎯','🪡','🗿']);
 assert.deepEqual(statusChipLabels(u,state.combat),['🩸 Herida 2','☠️ Veneno 3','🔥 Quemadura 4','🔨 PA -1 próximo','🌿 PM -2 próximo','🎯 Marcado','🪡 Vinculado','🗿 Monolito']);
 const html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'A1'});
 assert.match(html,/class="piece-status"[^>]*>🩸2 ☠️3 🔨-1PA 🌿-2PM 🎯 🪡 🗿</);
 assert.match(html,/class="piece-shield"[^>]*>🛡️7</);
 assert.match(html,/🩸 Herida 2/);assert.match(html,/🔥 Quemadura 4/);
});

test('paridad visual: inspección puede mostrar rival u objeto sin cambiar al campeón activo',()=>{
 const state=fixture();
 let html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'B1'});
 assert.match(html,/Coloso · B1/);assert.match(html,/data-inspect-id="B1"/);assert.match(html,/Flecha de Precisión/);
 const object={id:'pillar1',number:1,kind:'object',type:'pillar',ownerId:'B1',team:'B',x:8,y:5,hp:12,maxHp:15,alive:true,shield:[{amount:3,sourceId:'B1'}],blocksLOS:true};
 state.combat.objects.push(object);
 html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true,inspectedId:'pillar1'});
 assert.match(html,/Pilar 1/);assert.match(html,/12\/15 PV/);assert.match(html,/Escudo 3/);assert.match(html,/Bloquea movimiento y línea de visión/);
});

test('Muñeco enemigo usa variante 02 y aliado usa variante 01, también en datos de animación',()=>{
 const state=fixture();
 state.combat.objects.push({id:'d1',number:1,kind:'object',type:'doll',ownerId:'A1',team:'A',x:4,y:5,hp:16,maxHp:16,alive:true,shield:[],blocksLOS:false,linkedTargetId:'B1',linkMode:'enemy',movePm:3});
 let html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true});
 assert.match(html,/muneco-houngan-02\/down-right\.png/);assert.match(html,/data-doll-variant="muneco-houngan-02"/);
 state.combat.objects[0].linkMode='ally';state.combat.objects[0].maxHp=20;state.combat.objects[0].hp=20;
 html=renderArena({state,actor:'shared',slotId:'A1',remaining:20,blocked:false,canMove:true});
 assert.match(html,/muneco-houngan-01\/down-right\.png/);assert.match(html,/data-doll-variant="muneco-houngan-01"/);
});
