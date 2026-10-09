import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnit, initializeCombat, abilityTargets, useAbility, houganDollDestinations,
  houganAction, applyDamage, serializeState, restoreState, endTurn,
  houganDollMovementAvailable, calculateHouganDollPath, moveHouganDoll, endHouganDollPhase
} from './combat-core.mjs';
import {createMatch, AuthoritativeService, MemoryRepository} from './server/authoritative-service.mjs';

const make=({enemy='piplus',enemyPos={x:8,y:5},houganPos={x:5,y:5},obstacles=[]}={})=>{
  const h=createUnit({championId:'houngan',id:'h',team:'A',slot:1,controllerId:'a',position:houganPos});
  h.initiative=99;
  const e=createUnit({championId:enemy,id:'e',team:'B',slot:1,controllerId:'b',position:enemyPos});
  return initializeCombat({units:[h,e],obstacles}).state;
};
const advancedReady=(options={})=>{
  let s=make(options);
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  s=endTurn(s,{unitId:'h'}).state;
  s=endHouganDollPhase(s,{unitId:'h'}).state;
  s=endTurn(s,{unitId:'e'}).state;
  return s;
};


test('Hougan usa stats efectivos y Aguja Vudú no puede apuntarse a sí mismo',()=>{
  const base=createUnit({championId:'houngan',id:'h',team:'A',slot:1,controllerId:'a',position:{x:1,y:1}});
  assert.deepEqual({hp:base.hp,pa:base.pa,pm:base.pm,initiative:base.initiative},{hp:90,pa:6,pm:3,initiative:5});
  const s=make({enemyPos:{x:8,y:5}});
  assert.deepEqual(abilityTargets(s,'h','needle'),['e']);
});

test('Aguja enemiga causa 6 daño y establece Vínculo sólo si el objetivo sobrevive',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  const r=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'});
  assert.equal(r.state.units.find(u=>u.id==='e').hp,84);
  assert.equal(r.state.units.find(u=>u.id==='h').pa,4);
  assert.equal(r.state.units.find(u=>u.id==='h').linkedTargetId,'e');
  assert(r.events.some(e=>e.type==='link.changed'&&e.targetId==='e'&&e.mode==='enemy'));

  s=make({enemyPos:{x:8,y:5}});
  s.units.find(u=>u.id==='e').hp=5;
  const lethal=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'});
  assert.equal(lethal.state.units.find(u=>u.id==='e').alive,false);
  assert.equal(lethal.state.units.find(u=>u.id==='h').linkedTargetId,null);
});

test('Muñeco enemigo requiere Vínculo, cuesta 2 PA, tiene 16 PV / 3 PM y bloquea LOS',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  assert.deepEqual(houganDollDestinations(s,'h'),[]);
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  assert(houganDollDestinations(s,'h').some(p=>p.x===6&&p.y===5));
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const h=s.units.find(u=>u.id==='h'),d=s.objects.find(o=>o.type==='doll');
  assert.equal(h.pa,2);
  assert.deepEqual({hp:d.hp,maxHp:d.maxHp,movePm:d.movePm,blocksLOS:d.blocksLOS,linkedTargetId:d.linkedTargetId,linkMode:d.linkMode},
    {hp:16,maxHp:16,movePm:3,blocksLOS:true,linkedTargetId:'e',linkMode:'enemy'});
  assert.deepEqual(restoreState(serializeState(s)),s);
});

test('Crear un nuevo Muñeco reemplaza al anterior sin cambiar su asociación fija histórica',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const first=s.objects.find(o=>o.type==='doll'&&o.alive).id;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:5,y:4}}).state;
  const active=s.objects.filter(o=>o.type==='doll'&&o.alive);
  assert.equal(active.length,1);assert.notEqual(active[0].id,first);
  assert.equal(s.objects.find(o=>o.id===first).alive,false);
  assert.equal(active[0].linkedTargetId,'e');
});

test('Muñeco enemigo refleja ceil(50%) de la pérdida REAL de PV mientras el Vínculo coincide',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive);
  const before=s.units.find(u=>u.id==='e').hp;
  const hit=applyDamage(s,{targetId:doll.id,amount:9,source:'test'});
  assert.equal(hit.state.objects.find(o=>o.id===doll.id).hp,7);
  assert.equal(hit.state.units.find(u=>u.id==='e').hp,before-5);
  assert(hit.events.some(e=>e.type==='damage.applied'&&e.source==='doll.enemy'&&e.amount===5));
});

test('Muñeco queda inactivo si el Vínculo deja de coincidir y entonces no refleja daño',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive);
  s.units.find(u=>u.id==='h').linkedTargetId=null;
  const before=s.units.find(u=>u.id==='e').hp;
  const hit=applyDamage(s,{targetId:doll.id,amount:4,source:'test'});
  assert.equal(hit.state.units.find(u=>u.id==='e').hp,before);
});


test('Transferencia cura hasta 8 PV y hace perder al Muñeco exactamente lo curado',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s.units.find(u=>u.id==='h').hp=80;
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive),enemyBefore=s.units.find(u=>u.id==='e').hp;
  const r=useAbility(s,{unitId:'h',abilityId:'transfer',targetId:doll.id});
  assert.equal(r.state.units.find(u=>u.id==='h').hp,88);
  assert.equal(r.state.objects.find(o=>o.id===doll.id).hp,8);
  assert.equal(r.state.units.find(u=>u.id==='e').hp,enemyBefore-4);
  assert(r.events.some(e=>e.type==='unit.healed'&&e.source==='ability.transfer'&&e.amount===8));
});

test('Transferencia no está disponible con Hougan a vida completa',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive);
  assert(!abilityTargets(s,'h','transfer').includes(doll.id));
  assert.throws(()=>useAbility(s,{unitId:'h',abilityId:'transfer',targetId:doll.id}),e=>e.code==='INVALID_TARGET');
});

test('Maldición ignora LOS, hace 8 daño + Veneno 1 y sólo puede usarse una vez por turno',()=>{
  let s=make({enemyPos:{x:8,y:5},obstacles:[{x:6,y:5}]});
  assert.deepEqual(abilityTargets(s,'h','curse'),['e']);
  const r=useAbility(s,{unitId:'h',abilityId:'curse',targetId:'e'});
  const e=r.state.units.find(u=>u.id==='e');
  assert.equal(e.hp,82);assert.equal(e.status.poison,1);assert.equal(r.state.units.find(u=>u.id==='h').pa,3);
  assert.equal(abilityTargets(r.state,'h','curse').length,0);
  assert.throws(()=>useAbility(r.state,{unitId:'h',abilityId:'curse',targetId:'e'}),e=>e.code==='ABILITY_LIMIT');
});

test('Ritual del Dolor hace 20 con Muñeco correspondiente cardinal, consume Vínculo y deja el Muñeco inactivo',()=>{
  let s=make({enemyPos:{x:8,y:5},houganPos:{x:5,y:4}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:8,y:4}}).state;
  s=endTurn(s,{unitId:'h'}).state;
  assert(s.dollPhase);
  s=endHouganDollPhase(s,{unitId:'h'}).state;
  s=endTurn(s,{unitId:'e'}).state;
  assert.equal(s.order[s.turnIndex],'h');
  const before=s.units.find(u=>u.id==='e').hp;
  const r=useAbility(s,{unitId:'h',abilityId:'ritual',targetId:'e'});
  assert.equal(r.state.units.find(u=>u.id==='e').hp,before-20);
  assert.equal(r.state.units.find(u=>u.id==='h').linkedTargetId,null);
  const doll=r.state.objects.find(o=>o.type==='doll'&&o.alive);
  assert(doll);assert.equal(doll.linkedTargetId,'e');
  const hit=applyDamage(r.state,{targetId:doll.id,amount:2,source:'post-ritual'});
  assert.equal(hit.state.units.find(u=>u.id==='e').hp,before-20);
});

test('Ritual del Dolor sin Muñeco correspondiente cardinal hace 14 y exige enemigo Vinculado',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  const before=s.units.find(u=>u.id==='e').hp;
  const r=useAbility(s,{unitId:'h',abilityId:'ritual',targetId:'e'});
  assert.equal(r.state.units.find(u=>u.id==='e').hp,before-14);
  assert.equal(r.state.units.find(u=>u.id==='h').linkedTargetId,null);
});

test('al terminar turno Hougan entra en fase del Muñeco con 3 PM y puede dividir el movimiento',()=>{
  let s=make({enemyPos:{x:9,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  s=endTurn(s,{unitId:'h'}).state;
  assert.deepEqual(s.dollPhase,{ownerId:'h',dollId:s.objects.find(o=>o.type==='doll'&&o.alive).id,pm:3,maxPm:3});
  assert.equal(s.order[s.turnIndex],'h');
  assert(houganDollMovementAvailable(s,'h').some(p=>p.x===6&&p.y===6&&p.cost===1));
  let path=calculateHouganDollPath(s,'h',{x:6,y:6});
  s=moveHouganDoll(s,{unitId:'h',path}).state;
  assert.equal(s.dollPhase.pm,2);assert.equal(s.objects.find(o=>o.type==='doll'&&o.alive).y,6);
  path=calculateHouganDollPath(s,'h',{x:7,y:6});
  s=moveHouganDoll(s,{unitId:'h',path}).state;
  assert.equal(s.dollPhase.pm,1);
  s=endHouganDollPhase(s,{unitId:'h'}).state;
  assert.equal(s.dollPhase,null);assert.equal(s.order[s.turnIndex],'e');
});

test('el Muñeco conserva sus 3 PM aunque esté inactivo por cambio de Vínculo',()=>{
  let s=make({enemyPos:{x:9,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  s.units.find(u=>u.id==='h').linkedTargetId=null;
  s=endTurn(s,{unitId:'h'}).state;
  assert(s.dollPhase);assert.equal(s.dollPhase.pm,3);
});


test('Transferencia de Dolor requiere Vínculo + Muñeco correspondiente y cuesta 3 PA',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  assert.deepEqual(abilityTargets(s,'h','paintransfer'),[]);
  s=advancedReady({enemyPos:{x:8,y:5}});
  assert.deepEqual(abilityTargets(s,'h','paintransfer'),['h']);
  const r=useAbility(s,{unitId:'h',abilityId:'paintransfer',targetId:'h'});
  const h=r.state.units.find(u=>u.id==='h'),d=r.state.objects.find(o=>o.type==='doll'&&o.alive);
  assert.equal(h.pa,3);
  assert.deepEqual(h.houganPainTransfer,{dollId:d.id,targetId:'e'});
  assert.deepEqual(abilityTargets(r.state,'h','paintransfer'),[]);
});

test('Transferencia de Dolor divide daño impar antes de escudos: Hougan recibe la mitad mayor',()=>{
  let s=advancedReady({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'paintransfer',targetId:'h'}).state;
  const h=s.units.find(u=>u.id==='h'),d=s.objects.find(o=>o.type==='doll'&&o.alive),e=s.units.find(u=>u.id==='e');
  h.shield=[{sourceId:'h',amount:3}];d.shield=[{sourceId:'h',amount:2}];
  const before={h:h.hp,d:d.hp,e:e.hp};
  const r=applyDamage(s,{targetId:'h',amount:9,source:'test.odd'});
  const rh=r.state.units.find(u=>u.id==='h'),rd=r.state.objects.find(o=>o.id===d.id),re=r.state.units.find(u=>u.id==='e');
  assert.equal(rh.hp,before.h-2);
  assert.equal(rd.hp,before.d-2);
  assert.equal(re.hp,before.e-1);
  const split=r.events.find(e=>e.type==='hougan.paintransfer.split');
  assert.deepEqual({amount:split.amount,houganShare:split.houganShare,dollShare:split.dollShare},{amount:9,houganShare:5,dollShare:4});
});

test('si el Muñeco no soporta su mitad de Transferencia de Dolor, el excedente no vuelve a Hougan',()=>{
  let s=advancedReady({enemyPos:{x:8,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'paintransfer',targetId:'h'}).state;
  const h=s.units.find(u=>u.id==='h'),d=s.objects.find(o=>o.type==='doll'&&o.alive),e=s.units.find(u=>u.id==='e');
  d.hp=1;const beforeH=h.hp,beforeE=e.hp;
  const r=applyDamage(s,{targetId:'h',amount:9,source:'test.lethal-doll'});
  assert.equal(r.state.units.find(u=>u.id==='h').hp,beforeH-5);
  assert.equal(r.state.objects.find(o=>o.id===d.id).hp,0);
  assert.equal(r.state.units.find(u=>u.id==='e').hp,beforeE-1);
  assert.equal(r.state.units.find(u=>u.id==='h').houganPainTransfer,null);
});

test('Danza Vudú copia cada paso y cada cambio de dirección sin gastar PM del Vinculado',()=>{
  let s=advancedReady({enemyPos:{x:9,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'dance',targetId:'h'}).state;
  const linked=s.units.find(u=>u.id==='e');linked.status.wound=2;const pm=linked.pm,hp=linked.hp;
  s=endTurn(s,{unitId:'h'}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive);
  const r=moveHouganDoll(s,{unitId:'h',path:[{x:doll.x,y:doll.y},{x:doll.x,y:doll.y+1},{x:doll.x+1,y:doll.y+1}]});
  const e=r.state.units.find(u=>u.id==='e');
  assert.deepEqual({x:e.x,y:e.y},{x:10,y:6});
  assert.equal(e.pm,pm);
  assert.equal(e.hp,hp-4);
  assert.equal(r.state.units.find(u=>u.id==='h').houganDance!==null,true);
  assert.equal(r.events.filter(x=>x.type==='unit.moved'&&x.source==='hougan.dance').length,2);
});

test('Danza Vudú: un paso bloqueado falla sin colisión y la Danza continúa con el siguiente paso',()=>{
  let s=advancedReady({enemyPos:{x:9,y:5},obstacles:[{x:9,y:6}]});
  s=useAbility(s,{unitId:'h',abilityId:'dance',targetId:'h'}).state;
  s=endTurn(s,{unitId:'h'}).state;
  const doll=s.objects.find(o=>o.type==='doll'&&o.alive);
  const r=moveHouganDoll(s,{unitId:'h',path:[{x:doll.x,y:doll.y},{x:doll.x,y:doll.y+1},{x:doll.x+1,y:doll.y+1}]});
  const e=r.state.units.find(u=>u.id==='e');
  assert.deepEqual({x:e.x,y:e.y},{x:10,y:5});
  assert(r.events.some(x=>x.type==='hougan.dance.blocked'));
  assert(r.events.some(x=>x.type==='unit.moved'&&x.source==='hougan.dance'));
  assert.equal(e.hp,84);
});

test('Danza Vudú termina exactamente al finalizar la fase del Muñeco',()=>{
  let s=advancedReady({enemyPos:{x:9,y:5}});
  s=useAbility(s,{unitId:'h',abilityId:'dance',targetId:'h'}).state;
  s=endTurn(s,{unitId:'h'}).state;
  assert(s.units.find(u=>u.id==='h').houganDance);
  s=endHouganDollPhase(s,{unitId:'h'}).state;
  assert.equal(s.units.find(u=>u.id==='h').houganDance,null);
  assert.equal(s.order[s.turnIndex],'e');
});

test('Ritual que consume Vínculo corta Transferencia de Dolor y Danza si estaban ligadas',()=>{
  let s=advancedReady({enemyPos:{x:8,y:5}});
  const h=s.units.find(u=>u.id==='h'),d=s.objects.find(o=>o.type==='doll'&&o.alive);
  h.houganPainTransfer={dollId:d.id,targetId:'e'};
  h.houganDance={dollId:d.id,targetId:'e'};
  d.y=4;
  const r=useAbility(s,{unitId:'h',abilityId:'ritual',targetId:'e'});
  const after=r.state.units.find(u=>u.id==='h');
  assert.equal(after.linkedTargetId,null);
  assert.equal(after.houganPainTransfer,null);
  assert.equal(after.houganDance,null);
});

test('Servidor acepta Aguja y acción propia Muñeco bajo autoridad del slot activo',async()=>{
  let now=1000;
  const slots=[{id:'A1',team:'A',slot:1,controllerId:'u1'},{id:'B1',team:'B',slot:1,controllerId:'u2'}];
  const repo=new MemoryRepository([createMatch({mapId:"central-classic",id:'m',creatorId:'u1',slots,createdAt:now})]);
  const svc=new AuthoritativeService(repo,{clock:()=>now,random:()=>.25});
  const cmd=(id,type,v,extra={})=>({id,matchId:'m',type,expectedVersion:v,...extra});
  let v=0;
  for(const [who,champion,slot,skills] of [
    ['u1','houngan','A1',['needle','transfer','ritual','curse']],
    ['u2','piplus','B1',['precise','vector','impulse','fixation']]
  ]){
    await svc.command(who,cmd('s'+slot,'select',v,{slotId:slot,championId:champion,skills}));v++;
    await svc.command(who,cmd('r'+slot,'setReady',v,{slotId:slot,ready:true}));v++;
  }
  for(const [who,slot,position] of [['u1','A1',{x:2,y:5}],['u2','B1',{x:9,y:5}]]){
    await svc.command(who,cmd('p'+slot,'setPosition',v,{slotId:slot,position}));v++;
    await svc.command(who,cmd('c'+slot,'confirmPosition',v,{slotId:slot}));v++;
  }
  let out=await svc.command('u1',cmd('start','startCombat',v));v=out.version;
  // Piplus (ini 6) termina; Hougan queda activo.
  out=await svc.command('u2',cmd('endp','endTurn',v,{slotId:'B1',expectedTurn:out.turn}));v=out.version;
  out=await svc.command('u1',cmd('moveh','move',v,{slotId:'A1',expectedTurn:out.turn,path:[{x:2,y:5},{x:3,y:5},{x:4,y:5},{x:5,y:5}]}));v=out.version;
  out=await svc.command('u1',cmd('needle','ability',v,{slotId:'A1',expectedTurn:out.turn,abilityId:'needle',targetId:'B1'}));v=out.version;
  assert.equal(out.state.combat.units.find(u=>u.id==='A1').linkedTargetId,'B1');
  out=await svc.command('u1',cmd('doll','houganAction',v,{slotId:'A1',expectedTurn:out.turn,action:'doll',position:{x:6,y:5}}));
  const doll=out.state.combat.objects.find(o=>o.type==='doll'&&o.alive);
  assert(doll);assert.equal(doll.linkedTargetId,'B1');assert.equal(doll.maxHp,16);
  v=out.version;
  out=await svc.command('u1',cmd('endh','endTurn',v,{slotId:'A1',expectedTurn:out.turn}));v=out.version;
  assert(out.state.combat.dollPhase);const dollTurn=out.turn;
  out=await svc.command('u1',cmd('movedoll','houganDollMove',v,{slotId:'A1',expectedTurn:dollTurn,path:[{x:6,y:5},{x:6,y:6}]}));v=out.version;
  assert.equal(out.turn,dollTurn);assert.equal(out.state.combat.dollPhase.pm,2);
  const dollMotion=out.state.presentation.moves.at(-1);
  assert.equal(dollMotion.objectId,doll.id);assert.deepEqual(dollMotion.path,[{x:6,y:5},{x:6,y:6}]);
  out=await svc.command('u1',cmd('enddoll','houganDollEnd',v,{slotId:'A1',expectedTurn:dollTurn}));v=out.version;
  assert.equal(out.turn,dollTurn+1);assert.equal(out.state.combat.dollPhase,null);
  assert.equal(out.state.combat.order[out.state.combat.turnIndex],'B1');
});
