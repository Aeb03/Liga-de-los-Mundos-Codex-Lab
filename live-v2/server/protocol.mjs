import { createHash } from "node:crypto";
export class ProtocolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}
export const phases = ["preparation", "deployment", "combat", "finished"];
export const commandTypes = [
  "select",
  "setReady",
  "setPosition",
  "confirmPosition",
  "startCombat",
  "ability",
  "createPillar",
  "colosoAction",
  "piplusMark",
  "onodAction",
  "move",
  "endTurn",
  "expireTurn",
];
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export function commandFingerprint(command) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(command)))
    .digest("hex");
}
export function stateFingerprint(state) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(state)))
    .digest("hex");
}
export function validateCommand(c) {
  if (
    !c ||
    typeof c.id !== "string" ||
    !c.id ||
    typeof c.matchId !== "string" ||
    !commandTypes.includes(c.type) ||
    !Number.isInteger(c.expectedVersion) ||
    c.expectedVersion < 0
  )
    throw new ProtocolError("INVALID_COMMAND", "Contrato de comando inválido");
  if (
    ["move", "endTurn", "ability", "createPillar", "colosoAction", "piplusMark", "onodAction"].includes(c.type) &&
    (!Number.isInteger(c.expectedTurn) || c.expectedTurn < 0)
  )
    throw new ProtocolError("INVALID_COMMAND", "Falta turno esperado");
  return c;
}
