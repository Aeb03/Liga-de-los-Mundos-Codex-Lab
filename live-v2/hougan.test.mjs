import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnit, initializeCombat, abilityTargets, useAbility, houganDollDestinations,
  houganAction, applyDamage, serializeState, restoreState
} from './combat-core.mjs';
import {createMatch, AuthoritativeService, MemoryRepository} from './server/authoritative-service.mjs';

const make=({enemy='piplus',enemyPos={x:8,y:5},houganPos={x:5,y:5},obstacles=[]}={})=>{
  const h=createUnit({championId:'houngan',id:'h',team:'A',slot:1,controllerId:'a',position:houganPos});
  h.initiative=99;
  const e=createUnit({championId:enemy,id:'e',team:'B',slot:1,controllerId:'b',position:enemyPos});
  return initializeCombat({units:[h,e],obstacles}).state;
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

test('Muñeco enemigo requiere Vínculo, cuesta 2 PA, tiene 16 PV / 3 PM y no bloquea LOS',()=>{
  let s=make({enemyPos:{x:8,y:5}});
  assert.deepEqual(houganDollDestinations(s,'h'),[]);
  s=useAbility(s,{unitId:'h',abilityId:'needle',targetId:'e'}).state;
  assert(houganDollDestinations(s,'h').some(p=>p.x===6&&p.y===5));
  s=houganAction(s,{unitId:'h',action:'doll',position:{x:6,y:5}}).state;
  const h=s.units.find(u=>u.id==='h'),d=s.objects.find(o=>o.type==='doll');
  assert.equal(h.pa,2);
  assert.deepEqual({hp:d.hp,maxHp:d.maxHp,movePm:d.movePm,blocksLOS:d.blocksLOS,linkedTargetId:d.linkedTargetId,linkMode:d.linkMode},
    {hp:16,maxHp:16,movePm:3,blocksLOS:false,linkedTargetId:'e',linkMode:'enemy'});
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

test('Servidor acepta Aguja y acción propia Muñeco bajo autoridad del slot activo',async()=>{
  let now=1000;
  const slots=[{id:'A1',team:'A',slot:1,controllerId:'u1'},{id:'B1',team:'B',slot:1,controllerId:'u2'}];
  const repo=new MemoryRepository([createMatch({id:'m',creatorId:'u1',slots,createdAt:now})]);
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
  out=await svc.command('u1',cmd('needle','ability',v,{slotId:'A1',expectedTurn:out.turn,abilityId:'needle',targetId:'B1'}));v=out.version;
  // Needle from x2 to x9 is out of range; move Hougan closer in a deterministic legal path first is intentionally not hidden by the server.
  assert.fail('unreachable');
});
