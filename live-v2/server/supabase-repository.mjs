import { ProtocolError } from "./protocol.mjs";
export class SupabaseRepository {
  constructor(client) {
    this.client = client;
  }
  async rpc(name, args) {
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw new ProtocolError(error.code ?? "PERSISTENCE_ERROR", error.message);
    return data;
  }
  createRoom(actorId, room) {
    return this.rpc("live_v2_create_room", { p_actor: actorId, p_room: room });
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
      p_actor: identity,
      p_match: matchId,
      p_command: commandId,
      p_fingerprint: fingerprint,
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
        p_actor: identity,
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
      await this.rpc("live_v2_reject_command", {
        p_actor: identity === "backend" ? null : identity,
        p_match: matchId,
        p_command: commandId,
        p_fingerprint: fingerprint,
        p_expected_version: prepared.match.version,
        p_expected_turn: prepared.match.turnSerial,
        p_error_code: error.code ?? "SERVER_ERROR",
      });
      throw error;
    }
  }
  commandResult(matchId, commandId, identity) {
    return this.recover(identity, matchId, commandId);
  }
  expired(limit = 50) {
    return this.rpc("live_v2_claim_expired", { p_limit: limit });
  }
}
