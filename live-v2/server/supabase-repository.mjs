import { ProtocolError } from "./protocol.mjs";
export class SupabaseRepository {
  constructor(client) {
    this.client = client;
  }
  async rpc(name, args) {
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw new ProtocolError(error.code === "40001" ? "VERSION_CONFLICT" : error.message ?? error.code ?? "PERSISTENCE_ERROR", error.message);
    return data;
  }
  createRoom(actorId, room) {
    const mode=room?.mode??'1v1',players=room?.players??2;
    if(!['1v1','2v2'].includes(mode)||![2,4].includes(players)||(players===4&&mode!=='2v2'))throw new ProtocolError('UNSUPPORTED_FORMAT','Formato inválido');
    return this.rpc(players===4?'live_v2_create_four_player_room':mode==='2v2'?'live_v2_create_team_room':'live_v2_create_room', {
      p_actor: actorId,
      p_match: room.id,
    });
  }
  joinRoom(actorId, matchId, slotId) {
    return this.rpc("live_v2_join_room", {
      p_actor: actorId,
      p_match: matchId,
      p_slot: slotId,
    });
  }
  authorizedSnapshot(actorId, matchId) {
    return this.rpc("live_v2_snapshot", { p_actor: actorId, p_match: matchId });
  }
  recover(actorId, matchId, commandId) {
    return this.rpc("live_v2_recover_command", {
      p_actor: actorId,
      p_match: matchId,
      p_command: commandId,
    });
  }
  async get(matchId) {
    return this.rpc("live_v2_backend_match", { p_match: matchId });
  }
  async atomic(matchId, commandId, fingerprint, identity, work) {
    const prepared = await this.rpc("live_v2_prepare_command", {
      p_actor: identity === "backend" ? null : identity,
      p_match: matchId,
      p_command: commandId,
      p_fingerprint: fingerprint,
      p_automatic: identity === "backend",
    });
    if (prepared.status === "confirmed") return prepared.result;
    if (prepared.status === "rejected")
      throw new ProtocolError(
        prepared.error_code,
        "Rechazo previamente confirmado",
      );
    let next = null;
    const transaction = {
      get: async () => structuredClone(prepared.match),
      save: async (match, expectedVersion) => {
        if (expectedVersion !== prepared.match.version)
          throw new ProtocolError(
            "VERSION_CONFLICT",
            "Versión local inconsistente",
          );
        next = structuredClone(match);
      },
    };
    try {
      const result = await work(transaction);
      if (!next) throw new ProtocolError("MISSING_STATE", "Comando sin estado");
      return await this.rpc("live_v2_confirm_command", {
        p_actor: identity === "backend" ? null : identity,
        p_match: matchId,
        p_command: commandId,
        p_fingerprint: fingerprint,
        p_expected_version: prepared.match.version,
        p_expected_turn: prepared.match.turnSerial,
        p_expected_phase: prepared.match.phase,
        p_new_phase: next.phase,
        p_new_turn: next.turnSerial,
        p_new_deadline: next.turnDeadline,
        p_new_state: next,
        p_result: result,
        p_state_hash: result.diagnostic?.stateHash ?? null,
        p_automatic: identity === "backend",
      });
    } catch (error) {
      const rejection = await this.rpc("live_v2_reject_command", {
        p_actor: identity === "backend" ? null : identity,
        p_match: matchId,
        p_command: commandId,
        p_fingerprint: fingerprint,
        p_expected_version: prepared.match.version,
        p_expected_turn: prepared.match.turnSerial,
        p_error_code: error.code ?? "SERVER_ERROR",
        p_automatic: identity === "backend",
      });
      if (rejection.status === "confirmed") return rejection.result;
      throw error;
    }
  }
  commandResult(matchId, commandId, identity) {
    return this.recover(identity, matchId, commandId).then((reply) => {
      if (reply.status === "not_registered") return null;
      return reply.result;
    });
  }
  expired(limit = 50) {
    return this.rpc("live_v2_claim_expired", { p_limit: limit });
  }
}
