import test from "node:test";
import assert from "node:assert/strict";
import { createEdgeHandler } from "./edge-handler.mjs";
test("endpoint ignora p_actor inyectado y usa identidad autenticada", async () => {
  let seen;
  const handler = createEdgeHandler({
    authenticate: async () => "real",
    rooms: {
      create(actor, room) {
        seen = { actor, room };
        return seen;
      },
    },
    authority: {},
    backendSecret: "secret",
  });
  const result = await handler({
    bearer: "token",
    body: {
      operation: "create",
      args: { p_actor: "attacker", actor: "attacker", room: { id: "r" } },
    },
  });
  assert.equal(result.actor, "real");
  assert.deepEqual(Object.keys(seen.room), ["id"]);
});
test("vencimiento sólo acepta credencial backend y conserva condiciones", async () => {
  let seen;
  const handler = createEdgeHandler({
    authenticate: async () => null,
    rooms: {},
    authority: {
      command(actor, command) {
        seen = { actor, command };
        return seen;
      },
    },
    backendSecret: "secret",
  });
  await assert.rejects(
    () =>
      handler({
        backendToken: "bad",
        body: { operation: "expire", args: { matchId: "m" } },
      }),
    (e) => e.code === "FORBIDDEN",
  );
  await handler({
    backendToken: "secret",
    body: {
      operation: "expire",
      args: {
        matchId: "m",
        commandId: "c",
        expectedVersion: 4,
        expectedTurn: 2,
        p_actor: "evil",
      },
    },
  });
  assert.equal(seen.actor, "backend");
  assert.equal(seen.command.expectedVersion, 4);
});
import { SyncCoordinator } from "../sync/coordinator.mjs";
test("rechazo definitivo puede reconocerse y desbloquea comandos posteriores", () => {
  const c = new SyncCoordinator({ applySnapshot() {} });
  c.beginCommand({ id: "bad" });
  c.rejectPending({ code: "FORBIDDEN" });
  assert.equal(c.retryCommand(), null);
  assert.equal(c.acknowledgeRejection(), true);
  c.beginCommand({ id: "next" });
  assert.equal(c.pendingCommand().command.id, "next");
});

test('worker uses async backend verification and rejects an absent credential', async () => {
  let calls=0;
  const handler=createEdgeHandler({authenticate:async()=>null,rooms:{},
    authority:{command:async()=>{calls++;return {confirmed:true};}},
    authenticateBackend:async token=>token==='verified-worker'});
  const body={operation:'expire',args:{matchId:'m',commandId:'c',expectedVersion:1,expectedTurn:0}};
  await assert.rejects(()=>handler({body}),e=>e.code==='FORBIDDEN');
  assert.equal(calls,0);
  assert.equal((await handler({body,backendToken:'verified-worker'})).confirmed,true);
  assert.equal(calls,1);
});
