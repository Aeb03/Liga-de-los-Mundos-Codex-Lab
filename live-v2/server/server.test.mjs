import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  AuthoritativeService,
  MemoryRepository,
} from "./authoritative-service.mjs";
import { SyncCoordinator } from "../sync/coordinator.mjs";
const slots = [
  { id: "A1", team: "A", slot: 1, controllerId: "u1" },
  { id: "B1", team: "B", slot: 1, controllerId: "u2" },
];
const cmd = (id, type, v, extra = {}) => ({
  id,
  matchId: "m",
  type,
  expectedVersion: v,
  ...extra,
});
async function ready() {
  let now = 1000;
  const match = createMatch({mapId:"central-classic",
    id: "m",
    creatorId: "u1",
    slots,
    createdAt: now,
  });
  const repo = new MemoryRepository([match]),
    svc = new AuthoritativeService(repo, {
      clock: () => now,
      random: () => 0.25,
    });
  let v = 0;
  for (const [who, c, s] of [
    ["u1", "arfeli", "A1"],
    ["u2", "coloso", "B1"],
  ]) {
    await svc.command(
      who,
      cmd(`s${s}`, "select", v, {
        slotId: s,
        championId: c,
        skills:
          c === "arfeli"
            ? ["sword", "daggers", "bow", "shield"]
            : ["rock", "stonearmor", "quake", "collapse"],
      }),
    );
    v++;
    await svc.command(
      who,
      cmd(`r${s}`, "setReady", v, { slotId: s, ready: true }),
    );
    v++;
  }
  for (const [who, s, p] of [
    ["u1", "A1", { x: 0, y: 3 }],
    ["u2", "B1", { x: 11, y: 3 }],
  ]) {
    await svc.command(
      who,
      cmd(`p${s}`, "setPosition", v, { slotId: s, position: p }),
    );
    v++;
    await svc.command(who, cmd(`c${s}`, "confirmPosition", v, { slotId: s }));
    v++;
  }
  return {
    svc,
    repo,
    get now() {
      return now;
    },
    set now(x) {
      now = x;
    },
    v,
  };
}
test("preparación, listo, despliegue oculto e inicio único", async () => {
  const x = await ready();
  const hidden = await x.svc.snapshot("u1", "m");
  assert.equal(hidden.slots.B1.position, null);
  const start = await x.svc.command("u1", cmd("start", "startCombat", x.v));
  assert.equal(start.state.phase, "combat");
  await assert.rejects(
    () => x.svc.command("u1", cmd("again", "startCombat", start.version)),
    (e) => e.code === "WRONG_PHASE",
  );
});
test("idempotencia, contenido cambiado y concurrencia CAS", async () => {
  const x = await ready();
  const a = await x.svc.command("u1", cmd("start", "startCombat", x.v));
  assert.deepEqual(
    await x.svc.command("u1", cmd("start", "startCombat", x.v)),
    a,
  );
  await assert.rejects(
    () => x.svc.command("u1", cmd("start", "startCombat", x.v, { x: 1 })),
    (e) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  const active = a.state.combat.order[0],
    who = a.state.slots[active].controllerId;
  const results = await Promise.allSettled([
    x.svc.command(
      who,
      cmd("e1", "endTurn", a.version, { slotId: active, expectedTurn: 0 }),
    ),
    x.svc.command(
      who,
      cmd("e2", "endTurn", a.version, { slotId: active, expectedTurn: 0 }),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("movimiento exacto, permisos, vencimiento y cierre backend sin celulares", async () => {
  const x = await ready();
  const a = await x.svc.command("u1", cmd("start", "startCombat", x.v));
  const active = a.state.combat.order[0],
    who = a.state.slots[active].controllerId,
    u = a.state.combat.units.find((z) => z.id === active);
  await assert.rejects(
    () =>
      x.svc.command(
        who === "u1" ? "u2" : "u1",
        cmd("bad", "move", a.version, {
          slotId: active,
          expectedTurn: 0,
          path: [
            { x: u.x, y: u.y },
            { x: u.x + 1, y: u.y },
          ],
        }),
      ),
    (e) => e.code === "FORBIDDEN",
  );
  x.now = 41000;
  await assert.rejects(
    () =>
      x.svc.command(
        who,
        cmd("late", "endTurn", a.version, { slotId: active, expectedTurn: 0 }),
      ),
    (e) => e.code === "TURN_EXPIRED",
  );
  const expired = await x.svc.command(
    "backend",
    cmd("auto", "expireTurn", a.version, { expectedTurn: 0 }),
  );
  assert.equal(expired.turn, 1);
  assert(expired.events.some((e) => e.type === "turn.expiry_delay"));
});
test("abandonar corta el reloj, termina la partida y el worker ya no puede avanzar", async () => {
  const x = await ready();
  const started = await x.svc.command("u1", cmd("abandon-start", "startCombat", x.v));
  const out = await x.svc.command("u1", cmd("abandon-now", "abandon", started.version, { slotId: "A1" }));
  assert.equal(out.state.phase, "finished");
  assert.equal(out.state.turnDeadline, null);
  assert.equal(out.state.combat.phase, "ended");
  assert.equal(out.state.combat.winnerTeam, "B");
  assert.equal(out.state.result.reason, "abandonment");
  assert.deepEqual(out.state.result.abandonedBy, ["A1"]);
  assert(out.events.some((e) => e.type === "match.abandoned" && e.winnerTeam === "B"));
  x.now = 999999;
  await assert.rejects(
    () => x.svc.command("backend", cmd("ghost-expire", "expireTurn", out.version, { expectedTurn: out.turn })),
    (e) => e.code === "NOT_EXPIRED",
  );
});

test("abandonar antes del combate cierra la sala sin declarar ganador", async () => {
  const x = await ready();
  const out = await x.svc.command("u2", cmd("leave-before-start", "abandon", x.v, { slotId: "B1" }));
  assert.equal(out.state.phase, "finished");
  assert.equal(out.state.turnDeadline, null);
  assert.equal(out.state.result.winnerTeam, null);
  assert.equal(out.state.result.reason, "abandonment");
});

test("un intruso no puede abandonar una partida ajena", async () => {
  const x = await ready();
  await assert.rejects(
    () => x.svc.command("intruder", cmd("bad-abandon", "abandon", x.v)),
    (e) => e.code === "FORBIDDEN",
  );
});

test("coordinador descarta previews, bloquea pendiente y no retrocede versiones", () => {
  const applied = [];
  const c = new SyncCoordinator({ applySnapshot: (s) => applied.push(s) });
  c.previewPath([{ x: 1, y: 1 }]);
  c.disconnect();
  assert.equal(c.preview, null);
  c.beginCommand({ id: "x" });
  assert.throws(() => c.beginCommand({ id: "y" }), /COMMAND_PENDING/);
  assert(c.applyEnvelope({ version: 2, state: { v: 2 }, commandId: "z" }));
  assert(!c.applyEnvelope({ version: 1, state: { v: 1 } }));
  assert.equal(applied.length, 1);
  c.applyEnvelope({
    version: 2,
    state: { v: 2 },
    commandId: "x",
    confirmed: true,
  });
  assert.equal(c.pendingCommand(), null);
});
test("un controlador puede poseer varios slots aunque esta etapa rechaza formato no 1v1", () => {
  assert.throws(
    () =>
      createMatch({mapId:"central-classic",
        id: "x",
        creatorId: "u",
        createdAt: 0,
        slots: [...slots, { id: "A2", team: "A", slot: 2, controllerId: "u1" }],
      }),
    (e) => e.code === "UNSUPPORTED_FORMAT",
  );
  assert.equal(slots[0].controllerId, "u1");
});

test("snapshot y recuperación están ligados a membresía e identidad", async () => {
  const x = await ready();
  await assert.rejects(
    () => x.svc.snapshot("intruder", "m"),
    (error) => error.code === "FORBIDDEN",
  );
  const accepted = await x.svc.command(
    "u1",
    cmd("start-private", "startCombat", x.v),
  );
  assert.deepEqual(await x.svc.recover("u1", "m", "start-private"), accepted);
  await assert.rejects(
    () => x.svc.recover("u2", "m", "start-private"),
    (error) => error.code === "FORBIDDEN",
  );
});

test("movimiento válido confirma exactamente el recorrido y puede recuperarse", async () => {
  const x = await ready();
  const started = await x.svc.command(
    "u1",
    cmd("start-move", "startCombat", x.v),
  );
  const active = started.state.combat.order[0];
  const actor = started.state.slots[active].controllerId;
  const unit = started.state.combat.units.find(
    (candidate) => candidate.id === active,
  );
  const path = [
    { x: unit.x, y: unit.y },
    { x: unit.x + (unit.team === "A" ? 1 : -1), y: unit.y },
  ];
  const moved = await x.svc.command(
    actor,
    cmd("move-ok", "move", started.version, {
      slotId: active,
      expectedTurn: 0,
      path,
    }),
  );
  assert.deepEqual(moved.events.at(-1).path, path);
  assert.deepEqual(await x.svc.recover(actor, "m", "move-ok"), moved);
});

test("un controlador puede controlar ambos slots 1v1 sin autoridad por dispositivo", () => {
  const match = createMatch({mapId:"central-classic",
    id: "shared",
    creatorId: "u1",
    createdAt: 0,
    slots: slots.map((slot) => ({ ...slot, controllerId: "u1" })),
  });
  assert.equal(
    Object.values(match.slots).filter((slot) => slot.controllerId === "u1")
      .length,
    2,
  );
});

test("confirmación atrasada resuelve pendiente sin aplicar snapshot antiguo", () => {
  const applied = [];
  const coordinator = new SyncCoordinator({
    applySnapshot: (state) => applied.push(state),
  });
  coordinator.beginCommand({
    id: "pending",
    expectedVersion: 1,
    expectedTurn: 0,
  });
  coordinator.applyEnvelope({
    version: 5,
    state: { version: 5 },
    commandId: "other",
  });
  coordinator.applyEnvelope({
    version: 2,
    state: { version: 2 },
    commandId: "pending",
    confirmed: true,
  });
  assert.equal(coordinator.pendingCommand(), null);
  assert.deepEqual(applied, [{ version: 5 }]);
});

test('confirmed movement history and facing reach both members once; retries do not append twice',async()=>{
 const x=await ready();await x.svc.command('u1',cmd('start-motion','startCombat',x.v));
 const before=await x.svc.snapshot('u2','m');
 const input=cmd('move-motion','move',before.version,{slotId:'A1',expectedTurn:before.turnSerial,path:[{x:0,y:3},{x:1,y:3},{x:1,y:4}]});
 const accepted=await x.svc.command('u1',input);
 const rival=await x.svc.snapshot('u2','m');
 assert.deepEqual(rival.presentation,accepted.state.presentation);
 assert.deepEqual(rival.presentation.moves[0].path,input.path);
 assert.equal(rival.presentation.facings.A1,'down-left');
 const deadline=rival.turnDeadline;await x.svc.command('u1',input);
 const retry=await x.svc.snapshot('u2','m');assert.equal(retry.presentation.moves.length,1);assert.equal(retry.turnDeadline,deadline);
 await assert.rejects(()=>x.svc.snapshot('intruder','m'),e=>e.code==='FORBIDDEN');
});

test('movement history stays bounded and cut-off snapshots remain explicit after many turns',async()=>{
 const x=await ready();let state=(await x.svc.command('u1',cmd('history-start','startCombat',x.v))).state;
 for(let i=0;i<35;i++){
  const u=state.combat.units.find(u=>u.id==='A1');
  state=(await x.svc.command('u1',cmd(`history-move-${i}`,'move',state.version,{slotId:'A1',expectedTurn:state.turnSerial,path:[{x:u.x,y:u.y},{x:u.x===0?1:0,y:u.y}]}))).state;
  state=(await x.svc.command('u1',cmd(`history-a-${i}`,'endTurn',state.version,{slotId:'A1',expectedTurn:state.turnSerial}))).state;
  state=(await x.svc.command('u2',cmd(`history-b-${i}`,'endTurn',state.version,{slotId:'B1',expectedTurn:state.turnSerial}))).state;
 }
 assert.equal(state.presentation.moves.length,32);
 assert(state.presentation.fromVersion>0);assert(state.presentation.moves.every(m=>m.version>state.presentation.fromVersion));
 assert.deepEqual((await x.svc.snapshot('u2','m')).presentation,state.presentation);
});

test('authoritative sword checks loadout, ownership, stale input, deadline and retries once',async()=>{
 const x=await ready();await x.svc.command('u1',cmd('sword-start','startCombat',x.v));
 const m=await x.repo.get('m');m.combat.units.find(u=>u.id==='B1').x=1;await x.repo.save(m,m.version);
 let state=await x.svc.snapshot('u1','m');
 const input=cmd('cut','ability',state.version,{slotId:'A1',expectedTurn:state.turnSerial,abilityId:'sword',targetId:'B1'});
 const out=await x.svc.command('u1',input);assert.equal(out.confirmed,true);assert.equal(out.state.combat.units[0].pa,4);assert.equal(out.state.combat.units[1].hp,105);
 assert.deepEqual(await x.svc.command('u1',input),out);
 assert.deepEqual((await x.svc.snapshot('u2','m')).combat,out.state.combat);
 await assert.rejects(()=>x.svc.command('u2',{...input,id:'intruder',expectedVersion:out.version}),e=>e.code==='FORBIDDEN');
 await assert.rejects(()=>x.svc.command('u1',{...input,id:'stale'}),e=>e.code==='VERSION_CONFLICT');
 const live=await x.repo.get('m');live.slots.A1.skills=['bow','daggers','shield','hammer'];await x.repo.save(live,live.version);
 await assert.rejects(()=>x.svc.command('u1',{...input,id:'missing',expectedVersion:out.version}),e=>e.code==='ABILITY_NOT_SELECTED');
 x.now=live.turnDeadline;await assert.rejects(()=>x.svc.command('u1',{...input,id:'late',expectedVersion:out.version}),e=>e.code==='TURN_EXPIRED');
});

test('shield and rock persist once, synchronize both members and expire by turn source',async()=>{
 const x=await ready();await x.svc.command('u1',cmd('shield-start','startCombat',x.v));let m=await x.repo.get('m');m.combat.units[1].x=3;await x.repo.save(m,m.version);
 let result=await x.svc.command('u1',cmd('shield','ability',m.version,{slotId:'A1',expectedTurn:m.turnSerial,abilityId:'shield',targetId:'A1'}));
 assert.equal(result.state.combat.units[0].shield[0].amount,15);
 result=await x.svc.command('u1',cmd('shield-end','endTurn',result.version,{slotId:'A1',expectedTurn:result.turn}));
 const rock=cmd('rock','ability',result.version,{slotId:'B1',expectedTurn:result.turn,abilityId:'rock',targetId:'A1'});result=await x.svc.command('u2',rock);assert.equal(result.state.combat.units[0].shield[0].amount,7);assert.equal(result.state.combat.units[0].hp,100);
 assert.deepEqual(await x.svc.command('u2',rock),result);assert.deepEqual((await x.svc.snapshot('u1','m')).combat,result.state.combat);
 result=await x.svc.command('u2',cmd('rock-end','endTurn',result.version,{slotId:'B1',expectedTurn:result.turn}));assert.deepEqual(result.state.combat.units[0].shield,[]);
 m=await x.repo.get('m');m.slots.A1.skills=['sword','bow','daggers','hammer'];await x.repo.save(m,m.version);
 await assert.rejects(()=>x.svc.command('u1',cmd('missing-shield','ability',m.version,{slotId:'A1',expectedTurn:m.turnSerial,abilityId:'shield',targetId:'A1'})),e=>e.code==='ABILITY_NOT_SELECTED');
});

test('Dagas persists to both members once; wounded move preserves confirmed route; timeout halves owner wound', async()=>{
 const x=await ready();await x.svc.command('u1',cmd('daggers-start','startCombat',x.v));let m=await x.repo.get('m');m.combat.units[0].x=2;m.combat.units[0].y=5;m.combat.units[1].x=3;m.combat.units[1].y=5;x.repo.matches.set('m',m);
 const dagger=cmd('dagger','ability',m.version,{slotId:'A1',expectedTurn:0,abilityId:'daggers',targetId:'B1'});
 let out=await x.svc.command('u1',dagger);const v=out.version;assert.equal(out.state.combat.units[1].status.wound,2);assert.deepEqual(await x.svc.command('u1',dagger),out);
 assert.equal((await x.svc.snapshot('u2','m')).combat.units[1].hp,105);
 out=await x.svc.command('u1',cmd('end-dagger','endTurn',v,{slotId:'A1',expectedTurn:0}));
 const route=[{x:3,y:5},{x:4,y:5},{x:5,y:5}];out=await x.svc.command('u2',cmd('wounded-move','move',out.version,{slotId:'B1',expectedTurn:1,path:route}));
 assert.equal(out.state.combat.units[1].hp,99);assert.deepEqual(out.state.presentation.moves.at(-1).path,route);
 const expiry=cmd('wound-expiry','expireTurn',out.version,{expectedTurn:1});x.now=41000;out=await x.svc.command('backend',expiry);assert.equal(out.state.combat.units[1].status.wound,1);assert.deepEqual(await x.svc.command('backend',expiry),out);assert.equal(out.state.turnSerial,2);
 assert.deepEqual((await x.svc.snapshot('u1','m')).combat,(await x.svc.snapshot('u2','m')).combat);
});
test('death during movement persists shortened animation path and finishes match atomically',async()=>{
 const x=await ready();await x.svc.command('u1',cmd('daggers-start','startCombat',x.v));let m=await x.repo.get('m');m.combat.units[0].x=2;m.combat.units[0].y=5;m.combat.units[1].x=3;m.combat.units[1].y=5;m.combat.turnIndex=1;m.combat.units[1].hp=5;m.combat.units[1].status.wound=2;x.repo.matches.set('m',m);
 const route=[{x:3,y:5},{x:4,y:5},{x:5,y:5},{x:6,y:5}],move=cmd('death-move','move',m.version,{slotId:'B1',expectedTurn:0,path:route});const out=await x.svc.command('u2',move);
 assert.equal(out.state.phase,'finished');assert.equal(out.state.turnDeadline,null);assert.equal(out.state.result.winnerTeam,'A');assert.deepEqual(out.state.presentation.moves.at(-1).path,route.slice(0,3));assert.equal(out.state.combat.units[1].pm,1);assert.deepEqual(await x.svc.command('u2',move),out);
});


test('forced enemy movement is authoritative, recoverable and synchronized once without spending victim PM',async()=>{
 const x=await ready();await x.svc.command('u1',cmd('force-start','startCombat',x.v));const m=await x.repo.get('m');
 m.slots.A1.skills=['sword','daggers','spear','shield'];m.combat.units[0].x=4;m.combat.units[0].y=5;m.combat.units[1].x=6;m.combat.units[1].y=5;m.combat.units[1].status.wound=2;x.repo.matches.set('m',m);
 const spear=cmd('force-spear','ability',m.version,{slotId:'A1',expectedTurn:m.turnSerial,abilityId:'spear',targetId:'B1'});
 let out=await x.svc.command('u1',spear);assert.equal(out.state.combat.units[1].hp,103);assert.equal(out.state.combat.units[1].pm,3);assert.equal(out.state.presentation.moves.length,1);assert.equal(out.state.presentation.moves[0].unitId,'B1');assert.deepEqual(out.state.presentation.moves[0].path,[{x:6,y:5},{x:5,y:5}]);
 assert.deepEqual(await x.svc.command('u1',spear),out);assert.deepEqual((await x.svc.snapshot('u2','m')).combat,out.state.combat);assert.equal((await x.svc.snapshot('u2','m')).presentation.moves.length,1);
 out=await x.svc.command('u1',cmd('force-end','endTurn',out.version,{slotId:'A1',expectedTurn:out.turn}));
 const quake=cmd('force-quake','ability',out.version,{slotId:'B1',expectedTurn:out.turn,abilityId:'quake',targetId:'A1'});out=await x.svc.command('u2',quake);
 assert.equal(out.state.combat.units[0].hp,90);assert.equal(out.state.combat.units[0].x,3);assert.equal(out.state.presentation.moves.at(-1).unitId,'A1');assert.equal(out.state.combat.units[0].pm,3);
 assert.deepEqual(await x.svc.command('u2',quake),out);assert.deepEqual((await x.svc.snapshot('u1','m')).presentation,out.state.presentation);
 await assert.rejects(()=>x.svc.command('u1',{...quake,id:'force-forbidden',expectedVersion:out.version}),e=>e.code==='FORBIDDEN');
});

test('Pilar opening action and hammer jump synchronize once, enforce owner/loadout/turn and persist PM penalty',async()=>{
 const x=await ready();let out=await x.svc.command('u1',cmd('pillar-start','startCombat',x.v));let m=await x.repo.get('m');m.slots.A1.skills=['sword','hammer','spear','shield'];m.combat.units[0].x=3;m.combat.units[0].y=5;m.combat.units[1].x=6;m.combat.units[1].y=5;x.repo.matches.set('m',m);
 out=await x.svc.command('u1',cmd('pillar-turn','endTurn',m.version,{slotId:'A1',expectedTurn:m.turnSerial}));
 const input=cmd('create-pillar','createPillar',out.version,{slotId:'B1',expectedTurn:out.turn,position:{x:4,y:5}});
 await assert.rejects(()=>x.svc.command('u1',input),e=>e.code==='FORBIDDEN');out=await x.svc.command('u2',input);assert.equal(out.state.combat.objects.length,1);assert.equal(out.state.combat.units[1].pa,6);assert.deepEqual(await x.svc.command('u2',input),out);assert.deepEqual((await x.svc.snapshot('u1','m')).combat,out.state.combat);
 await assert.rejects(()=>x.svc.command('u2',cmd('second-pillar','createPillar',out.version,{slotId:'B1',expectedTurn:out.turn,position:{x:5,y:6}})),e=>e.code==='PILLAR_UNAVAILABLE');
 out=await x.svc.command('u2',cmd('hammer-turn','endTurn',out.version,{slotId:'B1',expectedTurn:out.turn}));
 const hammer=cmd('hammer-hit','ability',out.version,{slotId:'A1',expectedTurn:out.turn,abilityId:'hammer',targetId:'B1'});out=await x.svc.command('u1',hammer);assert.equal(out.state.combat.units[0].x,5);assert.equal(out.state.combat.units[1].hp,102);assert.equal(out.state.presentation.moves.at(-1).kind,'jump');assert.deepEqual(out.state.presentation.moves.at(-1).path,[{x:3,y:5},{x:5,y:5}]);assert.deepEqual(await x.svc.command('u1',hammer),out);assert.deepEqual((await x.svc.snapshot('u2','m')).combat,out.state.combat);
 out=await x.svc.command('u1',cmd('hammer-end','endTurn',out.version,{slotId:'A1',expectedTurn:out.turn}));assert.equal(out.state.combat.units[1].pm,2);
 const stale=cmd('pillar-stale','createPillar',out.version,{slotId:'B1',expectedTurn:0,position:{x:5,y:6}});await assert.rejects(()=>x.svc.command('u2',stale),e=>e.code==='TURN_CONFLICT');
});

test('complete Coloso: own actions enforce ownership, stale turns, deadline, once-only recovery and equal snapshots',async()=>{
 const x=await ready();let out=await x.svc.command('u1',cmd('complete-start','startCombat',x.v));
 let m=await x.repo.get('m');m.slots.B1.skills=['stonearmor','absorb','collapse','magnetism'];m.combat.units[1].x=6;m.combat.units[1].y=5;x.repo.matches.set('m',m);
 out=await x.svc.command('u1',cmd('complete-turn','endTurn',m.version,{slotId:'A1',expectedTurn:m.turnSerial}));
 out=await x.svc.command('u2',cmd('complete-pillar','createPillar',out.version,{slotId:'B1',expectedTurn:out.turn,position:{x:7,y:5}}));
 const fusion=cmd('complete-fusion','colosoAction',out.version,{slotId:'B1',expectedTurn:out.turn,action:'fusion',targetId:'pillar1'});
 await assert.rejects(()=>x.svc.command('u1',fusion),e=>e.code==='FORBIDDEN');
 out=await x.svc.command('u2',fusion);assert(out.state.combat.units[1].monolith);assert.equal(out.state.combat.units[1].pa,3);assert.deepEqual(await x.svc.command('u2',fusion),out);assert.deepEqual(await x.svc.recover('u2','m',fusion.id),out);
 assert.deepEqual((await x.svc.snapshot('u1','m')).combat,(await x.svc.snapshot('u2','m')).combat);
 await assert.rejects(()=>x.svc.command('u2',cmd('complete-stale','colosoAction',out.version,{slotId:'B1',expectedTurn:0,action:'exit',targetId:'B1'})),e=>e.code==='TURN_CONFLICT');
 await assert.rejects(()=>x.svc.command('u2',cmd('complete-unselected','ability',out.version,{slotId:'B1',expectedTurn:out.turn,abilityId:'rock',targetId:'A1'})),e=>e.code==='ABILITY_NOT_SELECTED');
 const exit=cmd('complete-exit','colosoAction',out.version,{slotId:'B1',expectedTurn:out.turn,action:'exit',targetId:'B1'});out=await x.svc.command('u2',exit);assert(!out.state.combat.units[1].monolith);assert.equal(out.state.combat.units[1].pm,3);
});

test('authority forwards line direction and secondary target atomically, including idempotent collapse',async()=>{
 const x=await ready();let out=await x.svc.command('u1',cmd('cone-start','startCombat',x.v));let m=await x.repo.get('m');m.slots.B1.skills=['stonearmor','absorb','collapse','magnetism'];m.combat.units[0].x=8;m.combat.units[0].y=5;m.combat.units[1].x=6;m.combat.units[1].y=5;x.repo.matches.set('m',m);
 out=await x.svc.command('u1',cmd('cone-turn','endTurn',m.version,{slotId:'A1',expectedTurn:m.turnSerial}));out=await x.svc.command('u2',cmd('cone-pillar','createPillar',out.version,{slotId:'B1',expectedTurn:out.turn,position:{x:7,y:5}}));
 const args={slotId:'B1',expectedTurn:out.turn,abilityId:'magnetism',targetId:'pillar1'};
 await assert.rejects(()=>x.svc.command('u2',cmd('cone-missing-secondary','ability',out.version,args)),e=>e.code==='INVALID_TARGET');
 let current=await x.repo.get('m');current.combat.objects[0].createdByColosoTurn=0;x.repo.matches.set('m',current);
 const collapse=cmd('cone-collapse','ability',out.version,{...args,abilityId:'collapse',direction:{x:1,y:0}});out=await x.svc.command('u2',collapse);assert.equal(out.state.combat.units[0].hp,85);assert.equal(out.state.combat.objects[0].alive,false);assert.deepEqual(await x.svc.command('u2',collapse),out);assert.deepEqual((await x.svc.snapshot('u1','m')).combat,out.state.combat);
});

async function readyPiplus() {
  const x = await ready();
  const m = await x.repo.get('m');
  m.slots.A1.championId = 'piplus';
  m.slots.A1.skills = ['precise', 'vector', 'impulse', 'fixation'];
  await x.repo.save(m, m.version);
  await x.svc.command('u1', cmd('piplus-start', 'startCombat', x.v));
  const live = await x.repo.get('m');
  Object.assign(live.combat.units[0], {x:5, y:5});
  Object.assign(live.combat.units[1], {x:8, y:5});
  await x.repo.save(live, live.version);
  return x;
}

test('Piplus Marca authoritative: owner, version, turn, deadline, atomic rejection and recovery', async () => {
  const x = await readyPiplus(), m = await x.repo.get('m');
  const mark = cmd('piplus-mark', 'piplusMark', m.version, {slotId:'A1', expectedTurn:m.turnSerial, targetId:'B1'});
  await assert.rejects(() => x.svc.command('u2', mark), e => e.code === 'FORBIDDEN');
  const out = await x.svc.command('u1', mark);
  assert.equal(out.state.combat.units[0].markedTargetId, 'B1');
  assert.equal(out.state.combat.units[1].status.markedBy, 'A1');
  assert.equal(out.state.combat.units[0].pa, 6);
  assert.deepEqual(await x.svc.command('u1', mark), out);
  assert.deepEqual((await x.svc.snapshot('u2', 'm')).combat, out.state.combat);
  await assert.rejects(() => x.svc.command('u1', {...mark, id:'piplus-stale'}), e => e.code === 'VERSION_CONFLICT');
  await assert.rejects(() => x.svc.command('u1', {...mark, id:'piplus-old-turn', expectedVersion:out.version, expectedTurn:99}), e => e.code === 'TURN_CONFLICT');
  await assert.rejects(() => x.svc.command('u1', {...mark, id:'piplus-repeat', expectedVersion:out.version}), e => e.code === 'MARK_UNAVAILABLE');
  assert.deepEqual((await x.svc.snapshot('u1', 'm')).combat, out.state.combat);
  x.now = out.state.turnDeadline;
  await assert.rejects(() => x.svc.command('u1', {...mark, id:'piplus-late', expectedVersion:out.version}), e => e.code === 'TURN_EXPIRED');
});

test('Piplus selected skills: fixation, marked damage, exact dash and idempotent equal snapshots', async () => {
  const x = await readyPiplus(); let m = await x.repo.get('m');
  let out = await x.svc.command('u1', cmd('p-mark', 'piplusMark', m.version, {slotId:'A1', expectedTurn:m.turnSerial, targetId:'B1'}));
  out = await x.svc.command('u1', cmd('p-fix', 'ability', out.version, {slotId:'A1', expectedTurn:out.turn, abilityId:'fixation', targetId:'B1'}));
  m = await x.repo.get('m'); m.combat.board.obstacles.push('6,5'); await x.repo.save(m, m.version);
  const shot = cmd('p-shot', 'ability', out.version, {slotId:'A1', expectedTurn:out.turn, abilityId:'precise', targetId:'B1'});
  out = await x.svc.command('u1', shot);
  assert.equal(out.state.combat.units[1].hp, 105);
  assert.equal(out.state.combat.units[0].pa, 1);
  assert.equal(out.state.combat.units[0].piplusFixationTargetId, null);
  assert.deepEqual(await x.svc.command('u1', shot), out);
  assert.deepEqual((await x.svc.snapshot('u2', 'm')).combat, out.state.combat);
  await assert.rejects(() => x.svc.command('u1', cmd('p-unselected', 'ability', out.version, {slotId:'A1', expectedTurn:out.turn, abilityId:'rupture', targetId:'B1'})), e => e.code === 'ABILITY_NOT_SELECTED');
  out = await x.svc.command('u1', cmd('p-end', 'endTurn', out.version, {slotId:'A1', expectedTurn:out.turn}));
  out = await x.svc.command('u2', cmd('c-end', 'endTurn', out.version, {slotId:'B1', expectedTurn:out.turn}));
  const dash = cmd('p-dash', 'ability', out.version, {slotId:'A1', expectedTurn:out.turn, abilityId:'impulse', position:{x:7,y:5}});
  out = await x.svc.command('u1', dash);
  assert.equal(out.state.combat.units[0].x, 7);
  assert.equal(out.state.combat.units[0].pm, 3);
  assert.equal(out.state.combat.units[0].pa, 4);
  assert.equal(out.state.presentation.moves.at(-1).kind, 'dash');
  assert.deepEqual(out.state.presentation.moves.at(-1).path, [{x:5,y:5},{x:7,y:5}]);
  assert.deepEqual(await x.svc.command('u1', dash), out);
  assert.deepEqual((await x.svc.snapshot('u2', 'm')).combat, out.state.combat);
});

async function readyOnodPiplus(){
 const x=await ready(),m=await x.repo.get('m');
 m.slots.A1.championId='piplus';m.slots.A1.skills=['precise','vector','impulse','fixation'];
 m.slots.B1.championId='onod';m.slots.B1.skills=['thorn','vines','sap','spores'];
 await x.repo.save(m,m.version);await x.svc.command('u1',cmd('onod-start','startCombat',x.v));
 const live=await x.repo.get('m');Object.assign(live.combat.units[0],{x:4,y:5});Object.assign(live.combat.units[1],{x:7,y:5});await x.repo.save(live,live.version);
 const out=await x.svc.command('u1',cmd('piplus-wait','endTurn',live.version,{slotId:'A1',expectedTurn:live.turnSerial}));return {x,out};
}
test('Onod authority: Brotes, selection, ownership, stale turn, deadline and idempotent equal snapshots',async()=>{
 let {x,out}=await readyOnodPiplus();
 const seed=cmd('seed','onodAction',out.version,{slotId:'B1',expectedTurn:out.turn,action:'germinate',position:{x:5,y:5}});
 await assert.rejects(()=>x.svc.command('u1',seed),e=>e.code==='FORBIDDEN');out=await x.svc.command('u2',seed);
 assert.equal(out.state.combat.objects[0].hp,12);assert.equal(out.state.combat.units[1].pa,5);assert.deepEqual(await x.svc.command('u2',seed),out);
 assert.deepEqual((await x.svc.snapshot('u1','m')).combat,out.state.combat);
 await assert.rejects(()=>x.svc.command('u2',{...seed,id:'seed-old-version'}),e=>e.code==='VERSION_CONFLICT');
 await assert.rejects(()=>x.svc.command('u2',{...seed,id:'seed-old-turn',expectedVersion:out.version,expectedTurn:0}),e=>e.code==='TURN_CONFLICT');
 await assert.rejects(()=>x.svc.command('u2',cmd('unselected-awake','ability',out.version,{slotId:'B1',expectedTurn:out.turn,abilityId:'awakening',targetId:'B1'})),e=>e.code==='ABILITY_NOT_SELECTED');
 const thorn=cmd('poison-thorn','ability',out.version,{slotId:'B1',expectedTurn:out.turn,abilityId:'thorn',targetId:'A1'});out=await x.svc.command('u2',thorn);
 assert.equal(out.state.combat.units[0].hp,84);assert.equal(out.state.combat.units[0].status.poison,1);assert.deepEqual(await x.svc.command('u2',thorn),out);
 let m=await x.repo.get('m');m.combat.objects[0].hp=3;await x.repo.save(m,m.version);
 out=await x.svc.command('u2',cmd('onod-end','endTurn',out.version,{slotId:'B1',expectedTurn:out.turn}));
 const shot=cmd('poison-shot','ability',out.version,{slotId:'A1',expectedTurn:out.turn,abilityId:'precise',targetId:'B1'});out=await x.svc.command('u1',shot);
 assert.equal(out.state.combat.objects[0].hp,4);assert.equal(out.state.combat.units[0].hp,83);assert.equal(out.state.combat.units[1].hp,87);
 assert.deepEqual(await x.svc.command('u1',shot),out);assert.deepEqual((await x.svc.snapshot('u2','m')).combat,out.state.combat);
 x.now=out.state.turnDeadline;await assert.rejects(()=>x.svc.command('u1',{...shot,id:'late-shot',expectedVersion:out.version}),e=>e.code==='TURN_EXPIRED');
});
test('Onod Enredaderas authority accepts exact ground center, rejects blocked input without mutation, synchronizes once',async()=>{
 let {x,out}=await readyOnodPiplus();
 const ground=cmd('vines-ground','ability',out.version,{slotId:'B1',expectedTurn:out.turn,abilityId:'vines',position:{x:5,y:5}});
 out=await x.svc.command('u2',ground);assert.equal(out.state.combat.units[0].hp,86);assert.equal(out.state.combat.units[0].status.vinesSourceId,'B1');assert.equal(out.state.combat.units[1].pa,3);
 assert.deepEqual(await x.svc.command('u2',ground),out);assert.deepEqual((await x.svc.snapshot('u1','m')).combat,out.state.combat);
 const before=await x.svc.snapshot('u2','m');await assert.rejects(()=>x.svc.command('u2',{...ground,id:'invalid-vines',expectedVersion:out.version,position:{x:0,y:0}}),e=>e.code==='INVALID_TARGET');assert.deepEqual(await x.svc.snapshot('u2','m'),before);
 out=await x.svc.command('u2',cmd('vines-end','endTurn',out.version,{slotId:'B1',expectedTurn:out.turn}));assert.equal(out.state.combat.units[0].pm,2);
});

test('accepted audio is public, bounded, idempotent and absent after rejected command',async()=>{
 const x=await ready();let out=await x.svc.command('u1',cmd('audio-start','startCombat',x.v));
 const shield=cmd('audio-shield','ability',out.version,{slotId:'A1',expectedTurn:out.turn,abilityId:'shield',targetId:'A1'});
 out=await x.svc.command('u1',shield);
 assert.deepEqual(out.state.presentation.audio.at(-1).cues,[{key:'core.escudo',delay:0}]);
 assert.deepEqual((await x.svc.snapshot('u2','m')).presentation.audio,out.state.presentation.audio);
 assert.deepEqual(await x.svc.command('u1',shield),out);
 const count=out.state.presentation.audio.length;
 await assert.rejects(()=>x.svc.command('u1',cmd('audio-invalid','ability',out.version,{slotId:'A1',expectedTurn:out.turn,abilityId:'sword',targetId:'B1'})));
 assert.equal((await x.svc.snapshot('u1','m')).presentation.audio.length,count);
});

test('feedback/log history is shared, bounded and retry does not duplicate it',async()=>{
 const x=await ready();let out=await x.svc.command('u1',cmd('feedback-start','startCombat',x.v));
 const shield=cmd('feedback-shield','ability',out.version,{slotId:'A1',expectedTurn:out.turn,abilityId:'shield',targetId:'A1'});
 out=await x.svc.command('u1',shield);assert(out.state.presentation.feedback.at(-1).effects.some(e=>e.type==='shield'));
 assert.deepEqual((await x.svc.snapshot('u2','m')).presentation.feedback,out.state.presentation.feedback);
 assert.deepEqual(await x.svc.command('u1',shield),out);
 for(let i=0;i<20;i++){
  const id=out.state.combat.order[out.state.combat.turnIndex],who=out.state.slots[id].controllerId;
  out=await x.svc.command(who,cmd(`feedback-end-${i}`,'endTurn',out.version,{slotId:id,expectedTurn:out.turn}));
  const active=out.state.combat.order[out.state.combat.turnIndex],actor=out.state.slots[active].controllerId;
  out=await x.svc.command(actor,cmd(`feedback-buff-${i}`,'ability',out.version,{slotId:active,expectedTurn:out.turn,abilityId:active==='A1'?'shield':'stonearmor',targetId:active}));
 }
 assert.equal(out.state.presentation.feedback.length,16);assert.equal(out.state.presentation.log.length,8);
 assert.deepEqual((await x.svc.snapshot('u2','m')).presentation.log,out.state.presentation.log);
});
