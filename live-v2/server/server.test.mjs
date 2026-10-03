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
  const match = createMatch({
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
  x.now = 31000;
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
      createMatch({
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
  const match = createMatch({
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
