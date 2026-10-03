import {
  createUnit,
  initializeCombat,
  resolvePath,
  endTurn,
  serializeState,
} from "../combat-core.mjs";
import {
  ProtocolError,
  validateCommand,
  commandFingerprint,
  stateFingerprint,
} from "./protocol.mjs";
export const EFFECTIVE_SKILLS = {
  arfeli: ["sword", "daggers", "bow", "spear", "shield", "hammer"],
  coloso: ["rock", "stonearmor", "absorb", "quake", "collapse", "magnetism"],
  piplus: [
    "precise",
    "vector",
    "impulse",
    "interference",
    "rupture",
    "fixation",
  ],
  onod: ["thorn", "vines", "sap", "spores", "awakening", "reabsorption"],
  korgan: ["trap_spikes", "trap_mine", "grenade", "shot", "hook", "hunterstep"],
  houngan: ["needle", "transfer", "ritual", "curse"],
};
const DEPLOY = {
  A: new Set(["0,3", "1,3", "0,4", "2,5", "1,6", "2,6"]),
  B: new Set(["11,3", "10,3", "11,4", "9,5", "10,6", "9,6"]),
};
const err = (c, m) => {
  throw new ProtocolError(c, m);
};
const nowMs = (n) => (typeof n === "function" ? n() : n);
export function createMatch({ id, creatorId, slots, createdAt }) {
  if (!id || !creatorId || !Array.isArray(slots) || slots.length !== 2)
    err("UNSUPPORTED_FORMAT", "Etapa 2 habilita exactamente 1v1");
  const ids = new Set();
  for (const s of slots) {
    if (
      s.id !== `${s.team}${s.slot}` ||
      !/^([AB][1-3])$/.test(s.id) ||
      ids.has(s.id) ||
      !["A", "B"].includes(s.team) ||
      !Number.isInteger(s.slot) ||
      s.slot < 1 ||
      s.slot > 3 ||
      !s.controllerId
    )
      err("INVALID_SLOT", "Slot inválido");
    ids.add(s.id);
  }
  if (new Set(slots.map((s) => s.team)).size !== 2)
    err("UNSUPPORTED_FORMAT", "Se requiere un slot A y uno B");
  return {
    id,
    creatorId,
    phase: "preparation",
    version: 0,
    turnSerial: 0,
    turnDeadline: null,
    slots: Object.fromEntries(
      slots.map((s) => [
        s.id,
        {
          ...s,
          championId: null,
          skills: [],
          ready: false,
          position: null,
          confirmed: false,
        },
      ]),
    ),
    combat: null,
    result: null,
    createdAt,
    diagnostics: [],
  };
}
function publicView(m, viewer) {
  const own = new Set(
    Object.values(m.slots)
      .filter((s) => s.controllerId === viewer)
      .map((s) => s.id),
  );
  return {
    ...structuredClone(m),
    slots: Object.fromEntries(
      Object.entries(m.slots).map(([id, s]) => [
        id,
        m.phase === "deployment" && !own.has(id)
          ? {
              id: s.id,
              team: s.team,
              slot: s.slot,
              controllerId: null,
              championId: s.championId,
              skills: s.skills,
              ready: s.ready,
              position: null,
              confirmed: s.confirmed,
            }
          : structuredClone(s),
      ]),
    ),
    diagnostics: undefined,
  };
}
export class AuthoritativeService {
  constructor(
    repository,
    { clock = () => Date.now(), random = () => Math.random() } = {},
  ) {
    this.repo = repository;
    this.clock = clock;
    this.random = random;
  }
  async command(identity, input) {
    validateCommand(input);
    const fingerprint = commandFingerprint(input);
    return this.repo.atomic(
      input.matchId,
      input.id,
      fingerprint,
      identity,
      async (transaction) => {
        const m = await transaction.get();
        if (!m) err("MATCH_NOT_FOUND", "Partida inexistente");
        if (m.version !== input.expectedVersion)
          err("VERSION_CONFLICT", "Versión obsoleta");
        const started = this.clock();
        let events = [];
        const slot = input.slotId ? m.slots[input.slotId] : null;
        if (slot && slot.controllerId !== identity)
          err("FORBIDDEN", "El slot pertenece a otro controlador");
        if (["move", "endTurn"].includes(input.type)) {
          if (m.phase !== "combat") err("WRONG_PHASE", "No está en combate");
          if (input.expectedTurn !== m.turnSerial)
            err("TURN_CONFLICT", "Turno obsoleto");
          if (started >= m.turnDeadline) err("TURN_EXPIRED", "El turno venció");
          const active = m.combat.order[m.combat.turnIndex];
          if (!slot || slot.id !== active || slot.controllerId !== identity)
            err("FORBIDDEN", "Sólo controla el slot activo");
          const out =
            input.type === "move"
              ? resolvePath(m.combat, slot.id, input.path)
              : endTurn(m.combat, { unitId: slot.id });
          m.combat = out.state;
          events = out.events;
          if (input.type === "endTurn") {
            m.turnSerial++;
            m.turnDeadline = started + 30000;
          }
          if (m.combat.phase === "ended") {
            m.phase = "finished";
            m.result = { winnerTeam: m.combat.winnerTeam, finishedAt: started };
            m.turnDeadline = null;
          }
        } else if (input.type === "select") {
          if (m.phase !== "preparation" || !slot)
            err("WRONG_PHASE", "Selección no disponible");
          const valid = EFFECTIVE_SKILLS[input.championId];
          if (
            !valid ||
            !Array.isArray(input.skills) ||
            input.skills.length !== 4 ||
            new Set(input.skills).size !== 4 ||
            input.skills.some((x) => !valid.includes(x))
          )
            err("INVALID_SELECTION", "Campeón o habilidades inválidos");
          Object.assign(slot, {
            championId: input.championId,
            skills: [...input.skills],
            ready: false,
          });
        } else if (input.type === "setReady") {
          if (m.phase !== "preparation" || !slot || !slot.championId)
            err("WRONG_PHASE", "Listo no disponible");
          slot.ready = !!input.ready;
          if (Object.values(m.slots).every((s) => s.ready))
            m.phase = "deployment";
        } else if (input.type === "setPosition") {
          if (m.phase !== "deployment" || !slot)
            err("WRONG_PHASE", "Despliegue no disponible");
          if (
            !input.position ||
            !Number.isInteger(input.position.x) ||
            !Number.isInteger(input.position.y) ||
            input.position.x < 0 ||
            input.position.y < 0 ||
            input.position.x >= 12 ||
            input.position.y >= 12 ||
            !DEPLOY[slot.team].has(`${input.position.x},${input.position.y}`)
          )
            err("INVALID_POSITION", "Posición fuera de la zona efectiva");
          slot.position = { ...input.position };
          slot.confirmed = false;
        } else if (input.type === "confirmPosition") {
          if (m.phase !== "deployment" || !slot?.position)
            err("WRONG_PHASE", "Confirmación no disponible");
          if (
            Object.values(m.slots).some(
              (s) =>
                s.id !== slot.id &&
                s.position &&
                s.position.x === slot.position.x &&
                s.position.y === slot.position.y,
            )
          )
            err("INVALID_POSITION", "Posición ocupada");
          slot.confirmed = true;
        } else if (input.type === "startCombat") {
          if (m.phase !== "deployment")
            err("WRONG_PHASE", "Inicio no disponible");
          if (identity !== m.creatorId)
            err("FORBIDDEN", "Sólo el creador solicita el inicio");
          if (!Object.values(m.slots).every((s) => s.confirmed))
            err("NOT_CONFIRMED", "Faltan confirmaciones");
          const units = Object.values(m.slots).map((s) =>
            createUnit({
              championId: s.championId,
              id: s.id,
              team: s.team,
              slot: s.slot,
              controllerId: s.controllerId,
              position: s.position,
            }),
          );
          const out = initializeCombat({
            units,
            random: this.random,
            clock: started,
          });
          m.combat = out.state;
          m.phase = "combat";
          m.turnSerial = 0;
          m.turnDeadline = started + 30000;
          events = out.events;
        } else if (input.type === "expireTurn") {
          if (identity !== "backend") err("FORBIDDEN", "Sólo backend");
          if (
            m.phase !== "combat" ||
            input.expectedTurn !== m.turnSerial ||
            started < m.turnDeadline
          )
            err("NOT_EXPIRED", "Turno no vencido");
          const scheduled = m.turnDeadline;
          const out = endTurn(m.combat, {
            unitId: m.combat.order[m.combat.turnIndex],
          });
          m.combat = out.state;
          m.turnSerial++;
          m.turnDeadline = started + 30000;
          if (m.combat.phase === "ended") {
            m.phase = "finished";
            m.result = { winnerTeam: m.combat.winnerTeam, finishedAt: started };
            m.turnDeadline = null;
          }
          events = [
            ...out.events,
            { type: "turn.expiry_delay", milliseconds: started - scheduled },
          ];
        } else err("UNSUPPORTED_COMMAND", "Comando no soportado");
        m.version++;
        const diagnostic = {
          commandId: input.id,
          type: input.type,
          accepted: true,
          version: m.version,
          turn: m.turnSerial,
          serverTime: started,
          stateHash: stateFingerprint(m.combat ?? m),
        };
        m.diagnostics.push(diagnostic);
        const result = {
          commandId: input.id,
          version: m.version,
          turn: m.turnSerial,
          state: publicView(m, identity),
          events,
          diagnostic,
          confirmed: true,
        };
        await transaction.save(m, input.expectedVersion);
        return result;
      },
    );
  }
  async snapshot(identity, id) {
    const m = await this.repo.get(id);
    if (!m) err("MATCH_NOT_FOUND", "Partida inexistente");
    if (!Object.values(m.slots).some((s) => s.controllerId === identity))
      err("FORBIDDEN", "No pertenece a la partida");
    return publicView(m, identity);
  }
  async recover(identity, matchId, commandId) {
    return this.repo.commandResult(matchId, commandId, identity);
  }
}
export class MemoryRepository {
  constructor(matches = []) {
    this.matches = new Map(matches.map((m) => [m.id, structuredClone(m)]));
    this.commands = new Map();
    this.locks = new Map();
  }
  async get(id) {
    return structuredClone(this.matches.get(id));
  }
  async save(m, version) {
    const old = this.matches.get(m.id);
    if (!old || old.version !== version)
      err("VERSION_CONFLICT", "Confirmación concurrente perdida");
    this.matches.set(m.id, structuredClone(m));
  }
  async atomic(matchId, id, fingerprint, identity, work) {
    const prior = this.locks.get(matchId) || Promise.resolve();
    let release;
    const gate = new Promise((r) => (release = r));
    this.locks.set(
      matchId,
      prior.then(() => gate),
    );
    await prior;
    try {
      const key = `${matchId}:${id}`,
        known = this.commands.get(key);
      if (known) {
        if (known.identity !== identity)
          err("FORBIDDEN", "Resultado privado de otro controlador");
        if (known.fingerprint !== fingerprint)
          err("IDEMPOTENCY_CONFLICT", "ID reutilizado con otro contenido");
        return structuredClone(known.result);
      }
      const result = await work({
        get: async () => structuredClone(this.matches.get(matchId)),
        save: async (match, version) => this.save(match, version),
      });
      this.commands.set(key, {
        fingerprint,
        identity,
        result: structuredClone(result),
      });
      return result;
    } finally {
      release();
    }
  }
  async commandResult(matchId, id, identity) {
    const known = this.commands.get(`${matchId}:${id}`);
    if (!known) return null;
    if (known.identity !== identity)
      err("FORBIDDEN", "Resultado privado de otro controlador");
    return structuredClone(known.result);
  }
}
