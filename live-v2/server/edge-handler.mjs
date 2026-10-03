import { ProtocolError } from "./protocol.mjs";

const allowed = {
  create: ["room"],
  join: ["matchId", "slotId"],
  snapshot: ["matchId"],
  recover: ["matchId", "commandId"],
  command: ["command"],
  expire: ["matchId", "commandId", "expectedVersion", "expectedTurn"],
};
function pick(input, names) {
  return Object.fromEntries(
    names
      .filter((name) => input[name] !== undefined)
      .map((name) => [name, input[name]]),
  );
}
export function createEdgeHandler({
  authenticate,
  rooms,
  authority,
  backendSecret,
}) {
  return async ({ bearer, backendToken, body }) => {
    const operation = body?.operation;
    if (!allowed[operation])
      throw new ProtocolError("INVALID_OPERATION", "Operación inválida");
    const args = pick(body.args ?? {}, allowed[operation]);
    if (operation === "expire") {
      if (!backendSecret || backendToken !== backendSecret)
        throw new ProtocolError("FORBIDDEN", "Worker no autorizado");
      return authority.command("backend", {
        id: args.commandId,
        matchId: args.matchId,
        type: "expireTurn",
        expectedVersion: args.expectedVersion,
        expectedTurn: args.expectedTurn,
      });
    }
    const actor = await authenticate(bearer);
    if (!actor) throw new ProtocolError("UNAUTHENTICATED", "Sesión inválida");
    if (operation === "create") return rooms.create(actor, args.room);
    if (operation === "join")
      return rooms.join(actor, args.matchId, args.slotId);
    if (operation === "snapshot")
      return authority.snapshot(actor, args.matchId);
    if (operation === "recover")
      return authority.recover(actor, args.matchId, args.commandId);
    return authority.command(actor, args.command);
  };
}
