import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createUnit,initializeCombat,endTurn,serializeState,restoreState,CombatRuleError,abilityTargets,useAbility,onodAction,germinateDestinations,onodActionTargets,onodEffectCells,vinesDestinations,movementAvailable,clearAbilityLOS,previewAbility,markPiplus} from './combat-core.mjs';
import {abilityOverlay} from './client/ability-overlay.mjs';
import {renderArena} from './client/presentation.mjs';
const make=(enemy='piplus',position={x:8,y:5})=>{const o=createUnit({championId:'onod',id:'o',team:'A',slot:1,controllerId:'a',position:{x:5,y:5}});o.initiative=99;return initializeCombat({units:[o,createUnit({championId:enemy,id:'e',team:'B',slot:1,controllerId:'b',position})]}).state;};
const cast=(s,abilityId,targetId='e',position)=>useAbility(s,{unitId:'o',abilityId,targetId,position});
const germ=(s,x,y)=>onodAction(s,{unitId:'o',action:'germinate',position:{x,y}}).state;
const cycle=s=>endTurn(endTurn(s,{unitId:'o'}).state,{unitId:'e'}).state;
const err=(fn,code)=>assert.throws(fn,e=>e instanceof CombatRuleError&&e.code===code);
const atomic=(s,fn,code)=>{const before=serializeState(s);err(fn,code);assert.equal(serializeState(s),before);};

test('Germinar: 1 PA, 12 PV, dos por turno, cap tres, LOS, ocupación y persistencia',()=>{
 let s=make();
 s=germ(s,6,5);s=germ(s,5,4);assert.equal(s.units[0].pa,4);assert.equal(s.objects[0].hp,12);assert.equal(s.objects[0].blocksLOS,false);
 assert(!movementAvailable(s,'o').some(p=>p.x===6&&p.y===5));assert(clearAbilityLOS(s,s.units[0],s.units[1]));
 atomic(s,()=>germ(s,5,6),'ONOD_ACTION_UNAVAILABLE');s=cycle(s);s=germ(s,5,6);assert.equal(s.objects.length,3);assert.equal(germinateDestinations(s,'o').length,0);
 assert.deepEqual(restoreState(serializeState(s)),s);assert.equal(s.nextSproutId,4);
 const blocked=make();blocked.board.obstacles=['6,5'];atomic(blocked,()=>germ(blocked,7,5),'ONOD_ACTION_UNAVAILABLE');atomic(blocked,()=>germ(blocked,5,5),'ONOD_ACTION_UNAVAILABLE');atomic(blocked,()=>germ(blocked,9,5),'ONOD_ACTION_UNAVAILABLE');
});
test('Marchitar sin rango: retira sin beneficio, una vez, no afecta Brotes rivales ni habilita más de dos Germinar',()=>{
 let s=germ(germ(make(),6,5),5,4),pa=s.units[0].pa;
 s=onodAction(s,{unitId:'o',action:'wither',targetId:'sprout1'}).state;assert.equal(s.units[0].pa,pa);assert.equal(s.objects[0].alive,false);
 atomic(s,()=>onodAction(s,{unitId:'o',action:'wither',targetId:'sprout2'}),'ONOD_ACTION_UNAVAILABLE');assert.equal(germinateDestinations(s,'o').length,0);
 s=cycle(s);s=germ(s,6,5);assert.equal(s.objects.at(-1).id,'sprout3');assert.equal(onodActionTargets(s,'o','wither').length,2);
 atomic(s,()=>onodAction(s,{unitId:'e',action:'wither',targetId:'sprout3'}),'ONOD_ACTION_UNAVAILABLE');
});
test('Espina 6 daño y Veneno 1: escudo, límite, objetos enemigos, muertos y rechazo atómico',()=>{
 let s=make();s.units[1].shield=[{amount:4,sourceId:'e'}];s=cast(s,'thorn').state;assert.equal(s.units[1].hp,88);assert.equal(s.units[1].status.poison,1);s=cast(s,'thorn').state;assert.equal(s.units[1].status.poison,2);atomic(s,()=>cast(s,'thorn'),'ABILITY_LIMIT');
 s=make('coloso');s.objects.push({id:'pillar1',number:1,type:'pillar',kind:'object',ownerId:'e',team:'B',x:7,y:5,hp:15,maxHp:15,alive:true,shield:[],blocksLOS:true,createdByColosoTurn:0});s.nextPillarId=2;s=cast(s,'thorn','pillar1').state;assert.equal(s.objects[0].hp,9);assert.equal(s.objects[0].status,undefined);
 s=make();s.units[1].hp=5;const r=cast(s,'thorn');assert.equal(r.state.phase,'ended');assert.equal(r.state.units[1].status.poison,0);
 s=make();s.board.obstacles=['6,5'];atomic(s,()=>cast(s,'thorn'),'INVALID_TARGET');
});
test('Enredaderas: centro vacío o propio, cruz 6/4, penalización máxima, bordes y no fuego amigo',()=>{
 let s=make('piplus',{x:7,y:5}),r=cast(s,'vines',null,{x:7,y:5});assert.equal(r.state.units[1].hp,84);assert.equal(r.state.units[1].status.vinesSourceId,'o');
 r=cast(s,'vines',null,{x:6,y:5});assert.equal(r.state.units[1].hp,86);assert.equal(r.state.units[0].hp,95);
 s.units[1].status.pmPenaltyNext=3;r=cast(s,'vines',null,{x:6,y:5});assert.equal(r.state.units[1].status.pmPenaltyNext,3);
 assert.equal(onodEffectCells(s,{unitId:'o',abilityId:'vines',position:{x:0,y:0}}).length,3);
 s.board.obstacles=['6,5'];atomic(s,()=>cast(s,'vines',null,{x:7,y:5}),'INVALID_TARGET');
 assert(vinesDestinations(s,'o').some(p=>p.x===5&&p.y===5));
});
test('Savia 8/12: Simbiosis cura 4 a todos los Brotes ortogonales sólo con curación real',()=>{
 let s=make();s.units[0].hp=70;s=cast(s,'sap','o').state;assert.equal(s.units[0].hp,78);
 s=germ(s,6,5);s=germ(s,5,4);s=cycle(s);s.objects[0].hp=5;s.objects[1].hp=11;s.units[0].hp=80;
 let r=cast(s,'sap','o');assert.equal(r.state.units[0].hp,92);assert.deepEqual(r.state.objects.map(o=>o.hp),[9,12]);
 s=r.state;s=cast(s,'sap','o').state;assert.equal(s.units[0].hp,95);assert.equal(s.objects[0].hp,12);s.units[0].pa=3;atomic(s,()=>cast(s,'sap','o'),'ABILITY_LIMIT');
 s=cycle(s);s.objects[0].hp=2;r=cast(s,'sap','o');assert.equal(r.state.objects[0].hp,2);assert(!r.events.some(e=>e.source==='symbiosis.heal'));
 atomic(s,()=>cast(s,'sap','sprout1'),'INVALID_TARGET');atomic(s,()=>cast(s,'sap','e'),'INVALID_TARGET');
});
test('Esporas: ocho casillas sin límite de distancia/LOS, 8 daño + Veneno, Brote conservado',()=>{
 let s=germ(make('piplus',{x:8,y:5}),7,4);s.objects[0].x=8;s.objects[0].y=4;s.board.obstacles=['6,5'];
 const r=cast(s,'spores','sprout1');assert.equal(r.state.units[1].hp,82);assert.equal(r.state.units[1].status.poison,1);assert.equal(r.state.objects[0].hp,12);assert.equal(r.state.units[0].pa,1);
 assert.equal(onodEffectCells(s,{unitId:'o',abilityId:'spores',targetId:'sprout1'}).length,8);
 s.objects[0].x=0;s.objects[0].y=0;assert.equal(onodEffectCells(s,{unitId:'o',abilityId:'spores',targetId:'sprout1'}).length,3);
 atomic(s,()=>cast(s,'spores','e'),'INVALID_TARGET');
});
test('Despertar: suma 8 por Brote ortogonal, diagonal no cuenta, no consume ni daña aliados',()=>{
 let s=make('piplus',{x:7,y:5});s=germ(germ(s,6,5),7,4);s=cycle(s);s=germ(s,7,6);s=cycle(s);
 const r=cast(s,'awakening','o');assert.equal(r.state.units[1].hp,66);assert.equal(r.state.units[0].hp,95);assert(r.state.objects.every(o=>o.alive));
 assert.equal(onodEffectCells(s,{unitId:'o',abilityId:'awakening'}).find(c=>c.x===7&&c.y===5).hits,3);
 s.objects[2].x=8;s.objects[2].y=6;assert.equal(cast(s,'awakening','o').state.units[1].hp,74);
 atomic(make(),()=>cast(make(),'awakening','o'),'INVALID_TARGET');
});
test('Reabsorción: todos los Brotes antiguos, hasta 9 PA, una vez, bloquea Germinar y conserva los nuevos',()=>{
 let s=germ(germ(make(),6,5),5,4);atomic(s,()=>cast(s,'reabsorption','o'),'INVALID_TARGET');s=cycle(s);s=germ(s,5,6);
 s=cast(s,'reabsorption','o').state;assert.equal(s.units[0].pa,7);assert.deepEqual(s.objects.map(o=>o.alive),[false,false,true]);assert.equal(germinateDestinations(s,'o').length,0);assert.equal(s.units[0].onodReabsorptionUsedThisTurn,true);
 assert.deepEqual(restoreState(serializeState(s)),s);atomic(s,()=>cast(s,'reabsorption','o'),'ABILITY_LIMIT');s=cycle(s);assert(germinateDestinations(s,'o').length);
 s=germ(s,6,5);s=germ(s,5,4);s=cycle(s);s=cast(s,'reabsorption','o').state;assert.equal(s.units[0].pa,9);assert.doesNotThrow(()=>serializeState(s));
});
test('Veneno real en Piplus cura Brotes adyacentes: absorción, daño parcial, sobre-muerte y acción Marca exenta',()=>{
 let s=germ(germ(make('piplus',{x:7,y:5}),6,5),7,4);s.objects[0].hp=2;s.objects[1].hp=8;
 s=endTurn(s,{unitId:'o'}).state;s.units[1].status.poison=6;s.units[1].shield=[{amount:4,sourceId:'e'}];
 let r=useAbility(s,{unitId:'e',abilityId:'precise',targetId:'o'});assert.deepEqual(r.state.objects.map(o=>o.hp),[4,10]);assert.equal(r.state.units[1].hp,88);
 const marked=markPiplus(s,{unitId:'e',targetId:'o'});assert.deepEqual(marked.state.objects.map(o=>o.hp),[2,8]);assert.equal(marked.state.units[1].hp,90);
 s.units[1].shield=[{amount:10,sourceId:'e'}];r=useAbility(s,{unitId:'e',abilityId:'precise',targetId:'o'});assert.deepEqual(r.state.objects.map(o=>o.hp),[2,8]);
 s.units[1].shield=[];s.units[1].hp=1;r=useAbility(s,{unitId:'e',abilityId:'precise',targetId:'o'});assert.deepEqual(r.state.objects.map(o=>o.hp),[3,9]);assert.equal(r.state.units[0].hp,95);assert.equal(r.state.phase,'ended');
});
test('Simbiosis funciona con Veneno en Impulso, pero no con Herida, daño normal ni Brotes diagonales',()=>{
 let s=germ(make('piplus',{x:7,y:5}),6,5);s.objects[0].hp=1;s=endTurn(s,{unitId:'o'}).state;s.units[1].status.poison=3;s.units[1].status.wound=2;
 let r=useAbility(s,{unitId:'e',abilityId:'impulse',position:{x:8,y:5}});assert.equal(r.state.objects[0].hp,4);assert.equal(r.state.units[1].hp,85);
 s.objects[0].y=4;r=useAbility(s,{unitId:'e',abilityId:'impulse',position:{x:8,y:5}});assert.equal(r.state.objects[0].hp,1);
});
test('Veneno mortal cancela habilidades Onod incluso Reabsorción; Germinar y Marchitar no disparan Veneno',()=>{
 let s=germ(make(),6,5);s=cycle(s);s.units[0].status.poison=3;s.units[0].hp=2;
 const r=cast(s,'reabsorption','o');assert.equal(r.state.phase,'ended');assert.equal(r.state.objects[0].alive,true);assert.equal(r.state.units[0].pa,6);
 s=germ(s,5,4);assert.equal(s.units[0].hp,2);s=onodAction(s,{unitId:'o',action:'wither',targetId:'sprout1'}).state;assert.equal(s.units[0].hp,2);
});
test('Brotes dañables por Piplus: Marca excluye objetos, Vector no desplaza Brotes y muerte libera casilla',()=>{
 let s=germ(make('piplus',{x:8,y:5}),6,5);s=endTurn(s,{unitId:'o'}).state;
 let r=useAbility(s,{unitId:'e',abilityId:'vector',targetId:'sprout1'});assert.equal(r.state.objects[0].hp,6);assert.equal(r.state.objects[0].x,6);
 r=useAbility(r.state,{unitId:'e',abilityId:'vector',targetId:'sprout1'});assert.equal(r.state.objects[0].alive,false);assert.doesNotThrow(()=>serializeState(r.state));
});
test('Áreas originales offline y núcleo coinciden para todas las casillas y Brotes superpuestos',()=>{
 const source=execFileSync('git',['show','0b4983953a37fca0a60867f1007f78c67b263683:onod-rework-0629.js'],{encoding:'utf8'});
 const functions=source.slice(source.indexOf('function vinesCells('),source.indexOf('const _onodBaseAbilityRangeState='));
 const ctx=vm.createContext({inside:(x,y)=>x>=0&&y>=0&&x<12&&y<12,ownedSprouts:u=>u.sprouts});vm.runInContext(functions,ctx);
 const normalize=a=>JSON.parse(JSON.stringify(a)).map(({x,y,hits})=>({x,y,...(hits?{hits}: {})})).sort((a,b)=>a.y-b.y||a.x-b.x);
 let s=germ(germ(make(),6,5),5,4);
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){
  assert.deepEqual(normalize(onodEffectCells(s,{unitId:'o',abilityId:'vines',position:{x,y}})),normalize(ctx.vinesCells(x,y)));
  s.objects[0].x=x;s.objects[0].y=y;assert.deepEqual(normalize(onodEffectCells(s,{unitId:'o',abilityId:'spores',targetId:'sprout1'})),normalize(ctx.sporesCells({x,y})));
 }
 assert.deepEqual(normalize(onodEffectCells(s,{unitId:'o',abilityId:'awakening'})),normalize(ctx.awakeningCells({sprouts:s.objects})));
});
test('Preview de Onod es puro: cruz, daño, acumulación, curación, HUD y Brote con recurso correcto',()=>{
 let s=germ(make('piplus',{x:7,y:5}),6,5);const before=serializeState(s);
 const overlay=abilityOverlay(s,'o','vines',null,{position:{x:6,y:5}});assert.equal(overlay.effect.length,5);assert.equal(overlay.forced.damage[0].amount,4);assert.equal(serializeState(s),before);
 const awake=abilityOverlay(s,'o','awakening');assert(awake.effect.some(p=>p.x===7&&p.y===5));
 s.units[0].hp=80;const preview=previewAbility(s,{unitId:'o',abilityId:'sap',targetId:'o'});assert.equal(preview.healing[0].amount,12);
 const slots={o:{...s.units[0],skills:['thorn','vines','sap','spores']},e:{...s.units[1],skills:['precise','vector','impulse','fixation']}};
 const html=renderArena({state:{phase:'combat',slots,combat:s},actor:'a',slotId:'o',canMove:true,blocked:false,remaining:24,abilitySelection:{abilityId:'vines',position:{x:6,y:5}}});assert(html.includes('brote-onod.png'));assert(html.includes('Brote 1: 12/12 PV'));assert(html.includes('Germinar'));assert(!html.includes('NaN'));assert(html.includes('ability-selected ability-effect'));
});

test('Enredaderas persiste al inicio rival y vence al inicio de Onod, con snapshot',()=>{
 let s=cast(make('piplus',{x:7,y:5}),'vines',null,{x:7,y:5}).state;
 assert.equal(s.units[1].pm,2);
 s=endTurn(restoreState(serializeState(s)),{unitId:'o'}).state;
 assert.equal(s.units[1].pm,2);assert.equal(s.units[1].status.vinesSourceId,'o');
 assert(renderArena({state:{phase:'combat',slots:{},combat:s},actor:'b',slotId:'e',canMove:true,blocked:false,remaining:24}).includes('hasta el próximo turno de Onod'));
 s=endTurn(s,{unitId:'e'}).state;assert.equal(s.units[1].status.vinesSourceId,undefined);
 s=endTurn(s,{unitId:'o'}).state;assert.equal(s.units[1].pm,3);
});

test('Enredaderas repetida no acumula reducción de PM y convive con penalización mayor',()=>{
 let s=make('piplus',{x:7,y:5});s.units[1].status.pmPenaltyNext=3;
 s=cast(s,'vines',null,{x:7,y:5}).state;s=cast(s,'vines',null,{x:7,y:5}).state;
 assert.equal(s.units[1].pm,2);s=endTurn(s,{unitId:'o'}).state;
 assert.equal(s.units[1].pm,0);assert.equal(s.units[1].status.vinesSourceId,'o');
});
