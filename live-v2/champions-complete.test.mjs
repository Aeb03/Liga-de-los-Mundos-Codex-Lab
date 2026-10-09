import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnit,initializeCombat,endTurn,useAbility,abilityTargets,colosoAction,colosoActionTargets,createPillar,collapseCells,magnetismTargets,previewAbility,serializeState,restoreState,applyDamage,movementAvailable,resolvePath,pillarAvailable,clearAbilityLOS} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';
import {renderArena} from './client/presentation.mjs';
const make=(enemy={x:9,y:6})=>endTurn(initializeCombat({units:[createUnit({championId:'arfeli',id:'a',team:'A',slot:1,controllerId:'one',position:enemy}),createUnit({championId:'coloso',id:'b',team:'B',slot:1,controllerId:'two',position:{x:5,y:5}})]}).state,{unitId:'a'}).state;
const pillar=(s,x,y,hp=15,created=0)=>{let n=s.nextPillarId++;s.objects.push({id:`pillar${n}`,number:n,kind:'object',type:'pillar',ownerId:'b',team:'B',x,y,hp,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:created});return `pillar${n}`;};
const cast=(s,id,targetId,extra={})=>useAbility(s,{unitId:'b',abilityId:id,targetId,...extra});
const atomic=(s,fn,code)=>{const before=serializeState(s);assert.throws(fn,e=>!code||e.code===code);assert.equal(serializeState(s),before);};
test('Arco aplica 8 + Maestría, LOS, veneno y gasto; repetición reinicia cadena',()=>{
 let s=endTurn(make({x:8,y:5}),{unitId:'b'}).state;s.units[0].arfeliMasteryChain=['shield'];s.units[0].status.poison=2;
 let o=useAbility(s,{unitId:'a',abilityId:'bow',targetId:'b'});assert.equal(o.state.units[1].hp,106);assert.equal(o.state.units[0].hp,98);assert.equal(o.state.units[0].pa,3);
 o=useAbility(o.state,{unitId:'a',abilityId:'bow',targetId:'b'});assert.equal(o.state.units[1].hp,98);assert.equal(o.state.units[0].pa,0);assert.deepEqual(o.state.units[0].arfeliMasteryChain,['bow']);
 s.board.obstacles.push('7,5');atomic(s,()=>useAbility(s,{unitId:'a',abilityId:'bow',targetId:'b'}),'BLOCKED_LOS');
});
test('Armadura: propio, Pilar, un uso por objetivo, dos por turno, escudo absorbido y expiración en objetos',()=>{
 let s=make(),p=pillar(s,6,5);s=cast(s,'stonearmor','b').state;s=cast(s,'stonearmor',p).state;
 assert.equal(s.units[1].pa,2);assert.equal(s.objects[0].shield[0].amount,10);
 atomic(s,()=>cast(s,'stonearmor',p),'ABILITY_LIMIT');s=applyDamage(s,{targetId:p,amount:12}).state;assert.equal(s.objects[0].hp,13);
 s=endTurn(s,{unitId:'b'}).state;s=endTurn(s,{unitId:'a'}).state;assert.deepEqual(s.units[1].shield,[]);assert.deepEqual(s.objects[0].shield,[]);assert.deepEqual(s.units[1].stoneArmorTargetsUsed,[]);
});
test('Armadura no permite repetir objetivo con usos disponibles ni proteger enemigo o atravesar LOS',()=>{
 let s=make(),p=pillar(s,7,5);s=cast(s,'stonearmor','b').state;atomic(s,()=>cast(s,'stonearmor','b'),'INVALID_TARGET');atomic(s,()=>cast(s,'stonearmor','a'),'INVALID_TARGET');s.board.obstacles.push('6,5');atomic(s,()=>cast(s,'stonearmor',p),'INVALID_TARGET');
});
test('Absorción consume Pilar antiguo y cura 15 reales aunque su HP sea menor; limita al máximo',()=>{
 let s=make(),p=pillar(s,6,5,4);s.units[1].hp=90;s=cast(s,'absorb',p).state;assert.equal(s.units[1].hp,105);assert.equal(s.units[1].pa,4);assert.equal(s.objects[0].alive,false);
 p=pillar(s,5,6,7);s=cast(s,'absorb',p).state;assert.equal(s.units[1].hp,115);
});
test('Absorción rechaza Pilar nuevo, salud completa, muerto y LOS sin consumir PA o Pilar',()=>{
 let s=make(),p=pillar(s,6,5,15,1);s.units[1].hp=90;atomic(s,()=>cast(s,'absorb',p),'INVALID_TARGET');s.objects[0].createdByColosoTurn=0;s.units[1].hp=115;atomic(s,()=>cast(s,'absorb',p),'INVALID_TARGET');
});
test('Fusión conserva PM, cuesta 3 y da escudo según PV; salir recupera PM e impide nueva fusión ese turno',()=>{
 let s=make(),p=pillar(s,6,5);s.units[1].pm=2;s=colosoAction(s,{unitId:'b',action:'fusion',targetId:p}).state;assert.equal(s.units[1].pa,3);assert.equal(s.units[1].pm,0);assert(s.units[1].monolith);assert.deepEqual(s.units[1].shield,[{amount:15,sourceId:'b'}]);assert.deepEqual(movementAvailable(s,'b'),[]);
 s=colosoAction(s,{unitId:'b',action:'exit',targetId:'b'}).state;assert.equal(s.units[1].pm,2);assert(!s.units[1].monolith);p=pillar(s,5,6);atomic(s,()=>colosoAction(s,{unitId:'b',action:'fusion',targetId:p}),'INVALID_TARGET');
});
test('Monolito permite 3 Pilares; salir no destruye excedente y bloquea nuevas creaciones',()=>{
 let s=make();s.units[1].monolith=true;s.units[1].pm=0;pillar(s,6,5);pillar(s,5,6);s=createPillar(s,{unitId:'b',position:{x:4,y:5}}).state;assert.equal(s.objects.length,3);assert.equal(restoreState(serializeState(s)).objects.length,3);
 s=colosoAction(s,{unitId:'b',action:'exit',targetId:'b'}).state;assert.equal(s.objects.filter(p=>p.alive).length,3);atomic(s,()=>createPillar(s,{unitId:'b',position:{x:4,y:6}}),'PILLAR_UNAVAILABLE');
});
test('Reciclaje repara el Pilar con menor HP, desempate por número; una vez por turno y escudo si ninguno dañado',()=>{
 let s=make();s.units[1].monolith=true;const p=pillar(s,6,5),q=pillar(s,5,6,7),r=pillar(s,4,5,7);s=colosoAction(s,{unitId:'b',action:'recycle',targetId:p}).state;assert.equal(s.objects.find(o=>o.id===q).hp,15);assert.equal(s.objects.find(o=>o.id===r).hp,7);assert.equal(s.units[1].pa,6);atomic(s,()=>colosoAction(s,{unitId:'b',action:'recycle',targetId:r}),'INVALID_TARGET');
 s=make();s.units[1].monolith=true;const only=pillar(s,6,5);s=colosoAction(s,{unitId:'b',action:'recycle',targetId:only}).state;assert.equal(s.units[1].shield[0].amount,6);
});
test('Colapso previsualiza línea exacta de 3 casillas, usa PV reales, ignora aliados y consume Pilar',()=>{
 let s=make({x:7,y:5}),p=pillar(s,6,5,10);const c={unitId:'b',abilityId:'collapse',targetId:p,direction:{x:1,y:0}},before=serializeState(s),preview=previewAbility(s,c);assert.equal(preview.effect.length,3);assert.equal(preview.damage[0].amount,10);assert.equal(serializeState(s),before);s=useAbility(s,c).state;assert.equal(s.units[0].hp,90);assert.equal(s.objects[0].alive,false);assert.equal(s.units[1].pa,3);
});
test('Colapso resta 2 por casilla, mínimo cero, excluye laterales y rechaza Pilar nuevo sin mutar',()=>{
 let s=make(),p=pillar(s,6,5);atomic(s,()=>cast(s,'collapse',p,{direction:{x:1,y:1}}),'INVALID_DIRECTION');
 for(const hp of [15,13,10,2,1])for(const step of [1,2,3]){s=make({x:6+step,y:5});p=pillar(s,6,5,hp);assert.equal(cast(s,'collapse',p,{direction:{x:1,y:0}}).state.units[0].hp,100-Math.max(0,hp-2*(step-1)));}
 s=make({x:7,y:6});p=pillar(s,6,5);assert.equal(cast(s,'collapse',p,{direction:{x:1,y:0}}).state.units[0].hp,100);
 s=make();p=pillar(s,6,5,15,s.units[1].colosoTurnSerial);assert(!abilityTargets(s,'b','collapse').includes(p));atomic(s,()=>cast(s,'collapse',p,{direction:{x:1,y:0}}),'INVALID_TARGET');
 for(const [x,y] of [[1,0],[-1,0],[0,1],[0,-1]])assert.deepEqual(collapseCells({x:5,y:5},{x,y}).map(c=>[c.x,c.y]),[1,2,3].map(step=>[5+x*step,5+y*step]));
 assert.deepEqual(collapseCells({x:11,y:11},{x:1,y:0}),[]);
});
test('Pilar después de movimiento y habilidad; alcance 3 normal y 5 Monolito; uno por turno',()=>{
 let s=make();s=resolvePath(s,'b',[{x:5,y:5},{x:5,y:4}]).state;s=cast(s,'stonearmor','b').state;
 assert(pillarAvailable(s,'b').some(p=>p.x===8&&p.y===4));assert(!pillarAvailable(s,'b').some(p=>p.x===9&&p.y===4));
 s=createPillar(s,{unitId:'b',position:{x:8,y:4}}).state;assert.deepEqual(pillarAvailable(s,'b'),[]);
 s=make();s.units[1].monolith=true;assert(pillarAvailable(s,'b').some(p=>p.x===10&&p.y===5));assert(!pillarAvailable(s,'b').some(p=>p.x===11&&p.y===5));
});
test('Fusión usa PV actuales, conserva escudo previo y expira al siguiente turno propio',()=>{
 let s=make(),p=pillar(s,6,5,7);s=cast(s,'stonearmor','b').state;s=colosoAction(s,{unitId:'b',action:'fusion',targetId:p}).state;
 assert.deepEqual(s.units[1].shield,[{amount:10,sourceId:'b'},{amount:7,sourceId:'b'}]);assert(!s.objects[0].alive);
 s=endTurn(s,{unitId:'b'}).state;assert.equal(s.units[1].shield.length,2);s=endTurn(s,{unitId:'a'}).state;assert.deepEqual(s.units[1].shield,[]);
});
test('Magnetismo selección válida, atrae 2 con Herida y sin PM/placaje, colisión 2 por paso restante',()=>{
 let s=make({x:9,y:5}),p=pillar(s,6,5);s.units[0].status.wound=2;assert(magnetismTargets(s,'b',p).includes('a'));let o=cast(s,'magnetism',p,{secondaryTargetId:'a'});assert.equal(o.state.units[0].x,7);assert.equal(o.state.units[0].hp,96);assert.equal(o.state.units[0].pm,3);assert.equal(o.events.filter(e=>e.type==='unit.moved').length,2);
 s=make({x:7,y:5});p=pillar(s,6,5);o=cast(s,'magnetism',p,{secondaryTargetId:'a'});assert.equal(o.state.units[0].hp,96);assert.equal(o.state.objects[0].hp,13);
});
test('Magnetismo puede atraer al dueño móvil; Monolito impide autoobjetivo; rechazo secundario atómico',()=>{
 let s=make(),p=pillar(s,7,5);assert(magnetismTargets(s,'b',p).includes('b'));assert.equal(cast(s,'magnetism',p,{secondaryTargetId:'b'}).state.units[1].x,6);s.units[1].monolith=true;atomic(s,()=>cast(s,'magnetism',p,{secondaryTargetId:'b'}),'INVALID_TARGET');atomic(s,()=>cast(s,'magnetism',p,{secondaryTargetId:p}),'INVALID_TARGET');
});
test('Sísmico proyectado 8, Réplicas 6 una vez por Pilar y colisión4/2, fuera de Monolito no proyecta',()=>{
 let s=make({x:8,y:5}),p=pillar(s,7,5);assert.deepEqual(abilityTargets(s,'b','quake'),[]);s.units[1].monolith=true;const q=pillar(s,9,4);let o=cast(s,'quake','a');assert.equal(o.state.units[0].hp,86);assert.equal(o.state.units[0].x,9);assert.equal(o.state.units[0].y,6);assert.equal(o.events.filter(e=>e.type==='pillar.replica').length,1);assert.equal(o.events.find(e=>e.type==='pillar.replica').objectId,q);
 s=make({x:8,y:5});pillar(s,7,5);pillar(s,9,5);s.units[1].monolith=true;o=cast(s,'quake','a');assert.equal(o.state.units[0].hp,78);assert.equal(o.state.objects[1].hp,13);
});
test('Veneno mortal cancela habilidad antes de consumir Pilar o añadir escudo; Herida mortal detiene Magnetismo',()=>{
 let s=make(),p=pillar(s,6,5);s.units[1].hp=1;s.units[1].status.poison=1;let o=cast(s,'collapse',p,{direction:{x:1,y:0}});assert.equal(o.state.phase,'ended');assert(o.state.objects[0].alive);assert.equal(o.state.units[1].pa,3);
 s=make({x:9,y:5});p=pillar(s,6,5);s.units[0].hp=2;s.units[0].status.wound=2;o=cast(s,'magnetism',p,{secondaryTargetId:'a'});assert.equal(o.state.units[0].x,8);assert.equal(o.state.phase,'ended');assert.equal(o.events.filter(e=>e.type==='unit.moved').length,1);
});
test('HUD y overlays muestran línea, segundo objetivo, Monolito y acciones propias sin mutar',()=>{
 let s=make({x:9,y:5}),p=pillar(s,6,5);const before=serializeState(s);let o=abilityOverlay(s,'b','collapse',p,{direction:{x:1,y:0}});assert.equal(o.effect.length,3);assert.equal(o.range.length,4);
 o=abilityOverlay(s,'b','magnetism',p,{secondaryTargetId:'a'});assert.equal(o.forced.moves.length,2);assert.equal(serializeState(s),before);s.units[1].monolith=true;
 const html=renderArena({state:{phase:'combat',combat:s,slots:{a:{id:'a',team:'A',controllerId:'one',championId:'arfeli',skills:['sword','bow','shield','hammer']},b:{id:'b',team:'B',controllerId:'two',championId:'coloso',skills:['stonearmor','absorb','collapse','magnetism']}}},actor:'two',slotId:'b',canMove:true,blocked:false,remaining:20,abilitySelection:{abilityId:'collapse',targetId:p,direction:{x:1,y:0}}});assert.match(html,/monolito-coloso/);assert.match(html,/data-action="recycle"/);assert.match(html,/data-action="exit"/);assert.match(html,/ability-selected ability-effect/);assert(!html.includes('class="board-note"')); assert(!html.includes('NaN'));
});

test('Colapso can target an old diagonal pillar beside Arfeli: corner contact does not block LOS',()=>{
 let s=make({x:4,y:11});Object.assign(s.units[1],{x:3,y:11,monolith:true,pm:0,colosoTurnSerial:5});
 const p=pillar(s,4,10,15,1);pillar(s,2,9,15,4);const target=s.objects.find(o=>o.id===p);
 assert(clearAbilityLOS(s,s.units[1],target));assert(clearAbilityLOS(s,target,s.units[1]));assert(abilityTargets(s,'b','collapse').includes(p));
 const out=cast(s,'collapse',p,{direction:{x:0,y:1}});assert.equal(out.state.units[0].hp,85);assert(!out.state.objects[0].alive);
});
test('LOS still rejects a champion or obstacle actually inside the line to a pillar',()=>{
 let s=make({x:6,y:5}),p=pillar(s,7,5);assert(!abilityTargets(s,'b','collapse').includes(p));
 s=make({x:9,y:6});p=pillar(s,7,5);s.board.obstacles.push('6,5');assert(!abilityTargets(s,'b','collapse').includes(p));
});
