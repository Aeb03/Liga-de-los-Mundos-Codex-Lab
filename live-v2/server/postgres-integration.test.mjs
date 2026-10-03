import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AuthoritativeService, EFFECTIVE_SKILLS } from './authoritative-service.mjs';
import { SupabaseRepository } from './supabase-repository.mjs';
import { createEdgeHandler } from './edge-handler.mjs';
import { SyncCoordinator } from '../sync/coordinator.mjs';

const exec = promisify(execFile);
const enabled = process.env.LIVE_V2_POSTGRES_TEST === '1';
const literal = value => value === null ? 'null' : typeof value === 'object'
  ? `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`
  : typeof value === 'boolean' || typeof value === 'number' ? String(value)
  : `'${String(value).replaceAll("'", "''")}'`;
async function sql(query) {
  return (await exec(process.env.PSQL_BIN ?? 'psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query])).stdout.trim();
}
// Same named SQL arguments and service-role ACL as PostgREST, with real PostgreSQL transactions.
// Auth/network transport are controlled; handler, service, repository, rules and SQL are real.
const client = { async rpc(name, args) {
  assert.match(name, /^live_v2_[a-z_]+$/);
  try {
    const data = await sql(`set role service_role; select public.${name}(${Object.entries(args)
      .map(([k,v]) => `${k} => ${literal(v)}`).join(',')});`);
    return { data: JSON.parse(data), error: null };
  } catch (e) {
    const message = /ERROR:\s+([^\n]+)/.exec(e.stderr)?.[1] ?? e.message;
    return { data: null, error: { message, code: message === 'VERSION_CONFLICT' ? '40001' : 'P0001' } };
  }
}};

async function fixture() {
  const a=randomUUID(), b=randomUUID(), outsider=randomUUID(), match=randomUUID();
  const repo=new SupabaseRepository(client);
  const authority=new AuthoritativeService(repo, { random:()=>0.25 });
  const handler=createEdgeHandler({ authenticate:async token=>({a,b,outsider})[token],
    rooms:{ create:(actor,room)=>repo.createRoom(actor,room), join:(actor,id,slot)=>repo.joinRoom(actor,id,slot) },
    authority, backendSecret:'worker-test' });
  const request=(who,operation,args)=>handler({bearer:who,body:{operation,args}});
  const initial=await request('a','create',{room:{id:match,phase:'combat',creatorId:outsider}});
  assert.equal(initial.phase,'preparation'); assert.equal(initial.creatorId,a);
  const joined=await request('b','join',{matchId:match,slotId:'B1'});
  assert.equal(joined.version,1); assert.equal(joined.slots.B1.controllerId,b);
  const command=(who,type,version,extra={})=>request(who,'command',{command:{id:randomUUID(),matchId:match,type,expectedVersion:version,...extra}});
  return {a,b,outsider,match,repo,authority,handler,request,command};
}
async function combat(x) {
  let version=1;
  for (const [who,slotId,championId] of [['a','A1','arfeli'],['b','B1','coloso']]) {
    await x.command(who,'select',version++,{slotId,championId,skills:EFFECTIVE_SKILLS[championId].slice(0,4)});
    await x.command(who,'setReady',version++,{slotId,ready:true});
  }
  for (const [who,slotId,position] of [['a','A1',{x:0,y:3}],['b','B1',{x:11,y:3}]]) {
    await x.command(who,'setPosition',version++,{slotId,position});
    await x.command(who,'confirmPosition',version++,{slotId});
  }
  const hidden=await x.request('a','snapshot',{matchId:x.match});
  assert.equal(hidden.slots.B1.position,null);
  assert.equal(hidden.diagnostics,undefined);
  return x.command('a','startCombat',version);
}

test('PostgreSQL: handler → authority → repository → SQL, privacy, move, recovery and expiry', {skip:!enabled}, async()=>{
  const x=await fixture();
  await assert.rejects(()=>x.request('outsider','snapshot',{matchId:x.match}), e=>e.code==='FORBIDDEN');
  await assert.rejects(()=>x.request('outsider','join',{matchId:x.match,slotId:'B1'}), e=>e.code==='SLOT_TAKEN');
  const stateBefore=(await x.repo.get(x.match));
  assert.equal(stateBefore.slots.B1.controllerId,x.b);
  const start=await combat(x);
  assert.equal(start.state.combat.board.obstacles.length,4);
  assert(start.state.turnDeadline>Date.now()+29000);
  const id=randomUUID();
  const intent={id,matchId:x.match,type:'move',expectedVersion:start.version,expectedTurn:0,slotId:'A1',path:[{x:0,y:3},{x:1,y:3}]};
  const moved=await x.request('a','command',{command:intent});
  assert.equal(moved.state.combat.units.find(u=>u.id==='A1').x,1);
  assert.deepEqual(await x.request('a','command',{command:intent}),moved);
  await assert.rejects(()=>x.request('b','command',{command:intent}), e=>e.code==='FORBIDDEN');
  await assert.rejects(()=>x.request('a','command',{command:{...intent,path:[{x:0,y:3},{x:0,y:4}]}}),e=>e.code==='IDEMPOTENCY_CONFLICT');
  assert.deepEqual(await x.request('a','recover',{matchId:x.match,commandId:id}),moved);
  const coordinator=new SyncCoordinator({applySnapshot(){}});
  coordinator.beginCommand(intent); coordinator.applyEnvelope({version:moved.version+1,state:{}});
  assert.equal(coordinator.recover(await x.request('a','recover',{matchId:x.match,commandId:id})),'confirmed');
  assert.equal(coordinator.pendingCommand(),null);
  const missing=randomUUID(); coordinator.beginCommand({id:missing});
  assert.equal(coordinator.recover(await x.request('a','recover',{matchId:x.match,commandId:missing})),'retry-original');
  const rejectedId=randomUUID();
  await assert.rejects(()=>x.request('a','command',{command:{...intent,id:rejectedId,expectedVersion:moved.version,path:[{x:1,y:3},{x:3,y:3}]}}));
  const rejected=await x.request('a','recover',{matchId:x.match,commandId:rejectedId});
  assert.equal(rejected.rejected,true);
  const rejectedCoordinator=new SyncCoordinator({applySnapshot(){}}); rejectedCoordinator.beginCommand({id:rejectedId});
  assert.equal(rejectedCoordinator.recover(rejected),'rejected'); assert(rejectedCoordinator.acknowledgeRejection());
  await sql(`update live_v2.matches set turn_deadline=clock_timestamp()-interval '1 second',
    state=jsonb_set(state,'{turnDeadline}',to_jsonb(floor(extract(epoch from clock_timestamp())*1000)-1000)) where id=${literal(x.match)};`);
  const scan=await sql('set role service_role; select coalesce(jsonb_agg(j),\'[]\'::jsonb) from public.live_v2_claim_expired(50) j;');
  const job=JSON.parse(scan).find(j=>j.match_id===x.match); assert(job);
  const expired=await x.handler({backendToken:'worker-test',body:{operation:'expire',args:{matchId:job.match_id,commandId:job.command_id,expectedVersion:job.expected_version,expectedTurn:job.expected_turn}}});
  assert.equal(expired.turn,1); assert(expired.state.turnDeadline>Date.now()+29000);
  assert.deepEqual(await x.handler({backendToken:'worker-test',body:{operation:'expire',args:{matchId:job.match_id,commandId:job.command_id,expectedVersion:job.expected_version,expectedTurn:job.expected_turn}}}),expired);
});

test('PostgreSQL: concurrent CAS, same-ID retry and independent matches', {skip:!enabled}, async()=>{
  const x=await fixture(); const started=await combat(x);
  const commands=[0,1].map(()=>({id:randomUUID(),matchId:x.match,type:'endTurn',expectedVersion:started.version,expectedTurn:0,slotId:'A1'}));
  const results=await Promise.allSettled(commands.map(command=>x.request('a','command',{command})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'VERSION_CONFLICT');
  const persisted=await x.repo.get(x.match); assert.equal(persisted.version,started.version+1); assert.equal(persisted.turnSerial,1);
  assert.equal(Number(await sql(`select count(*) from live_v2.commands where match_id=${literal(x.match)} and accepted and command_id in (${commands.map(c=>literal(c.id)).join(',')});`)),1);
  const current=await x.repo.get(x.match), active=current.combat.order[current.combat.turnIndex];
  const who=active==='A1'?'a':'b';
  const same={id:randomUUID(),matchId:x.match,type:'endTurn',expectedVersion:current.version,expectedTurn:current.turnSerial,slotId:active};
  const retries=await Promise.all([x.request(who,'command',{command:same}),x.request(who,'command',{command:same})]);
  assert.deepEqual(retries[0],retries[1]);
  const y=await fixture();
  const other=await Promise.all([x.command('a','endTurn',retries[0].version,{expectedTurn:2,slotId:'A1'}),y.command('a','select',1,{slotId:'A1',championId:'arfeli',skills:EFFECTIVE_SKILLS.arfeli.slice(0,4)})]);
  assert.equal(other[0].state.id,x.match); assert.equal(other[1].state.id,y.match);
});
