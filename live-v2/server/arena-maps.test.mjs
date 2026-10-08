import test from 'node:test';import assert from 'node:assert/strict';
import {ARENA_MAPS,arenaObstacleCells} from '../arena-maps.mjs';
import {createMatch,MemoryRepository,AuthoritativeService,EFFECTIVE_SKILLS} from './authoritative-service.mjs';
const slots=[{id:'A1',team:'A',slot:1,controllerId:'u1'},{id:'B1',team:'B',slot:1,controllerId:'u2'}];
test('server uses each persisted map for legal deployment and combat; snapshots/rejoins preserve it',async()=>{
 for(const arena of ARENA_MAPS){
  let match=createMatch({id:'m',creatorId:'u1',slots,createdAt:1000,mapId:arena.id});
  const repo=new MemoryRepository([match]),svc=new AuthoritativeService(repo,{clock:()=>1000,random:()=>.25});let serial=0;
  const send=async(actor,type,args={})=>{const m=await repo.get('m');return svc.command(actor,{id:`c${serial++}`,matchId:'m',type,expectedVersion:m.version,...args});};
  for(const [slotId,actor,championId] of [['A1','u1','piplus'],['B1','u2','coloso']]){await send(actor,'select',{slotId,championId,skills:EFFECTIVE_SKILLS[championId].slice(0,4)});await send(actor,'setReady',{slotId,ready:true});}
  const m=await repo.get('m'),before=structuredClone(m);const blocked=arenaObstacleCells(arena)[0];
  await assert.rejects(send('u1','setPosition',{slotId:'A1',position:blocked}),e=>e.code==='INVALID_POSITION');assert.deepEqual(await repo.get('m'),before);
  for(const [slotId,actor,team] of [['A1','u1','A'],['B1','u2','B']]){const [x,y]=arena.deployment[team][0].split(',').map(Number);await send(actor,'setPosition',{slotId,position:{x,y}});await send(actor,'confirmPosition',{slotId});}
  await send('u1','startCombat');match=await svc.snapshot('u2','m');assert.deepEqual(match.arena,arena);assert.deepEqual(match.combat.board.obstacles,[...arenaObstacleCells(arena).map(p=>`${p.x},${p.y}`)].sort());assert.deepEqual((await svc.snapshot('u1','m')).arena,arena);
 }
});
test('AI deployment and alternating 2v2 work for all maps, without occupying obstacles or other slots',async()=>{
 for(const arena of ARENA_MAPS){
  const roster=[...slots,{id:'A2',team:'A',slot:2,controllerId:'ai:A2',controllerKind:'ai'},{id:'B2',team:'B',slot:2,controllerId:'ai:B2',controllerKind:'ai'}];
  const match=createMatch({id:'m',creatorId:'u1',slots:roster,mapId:arena.id});
  for(const s of Object.values(match.slots)){s.championId=s.id.endsWith('1')?'arfeli':'coloso';s.skills=EFFECTIVE_SKILLS[s.championId].slice(0,4);s.ready=s.controllerKind==='ai';}
  const repo=new MemoryRepository([match]),svc=new AuthoritativeService(repo,{clock:()=>1000,random:()=>.25});let serial=0;
  const send=async(actor,type,args={})=>{const m=await repo.get('m');return svc.command(actor,{id:`c${serial++}`,matchId:'m',type,expectedVersion:m.version,...args});};
  await send('u1','setReady',{slotId:'A1',ready:true});await send('u2','setReady',{slotId:'B1',ready:true});
  const deployed=await repo.get('m');for(const team of ['A','B']){const bot=deployed.slots[team+'2'];assert(bot.confirmed);assert(arena.deployment[team].includes(`${bot.position.x},${bot.position.y}`));}
  for(const [team,actor] of [['A','u1'],['B','u2']]){const [x,y]=arena.deployment[team][1].split(',').map(Number);await send(actor,'setPosition',{slotId:team+'1',position:{x,y}});await send(actor,'confirmPosition',{slotId:team+'1'});}
  await send('u1','startCombat');const combat=(await repo.get('m')).combat;assert.equal(new Set(combat.units.map(u=>`${u.x},${u.y}`)).size,4);assert.deepEqual(combat.order.map(id=>id[0]),['A','B','A','B']);
 }
});
