import { ProtocolError } from "./protocol.mjs";

export class SupabaseRepository {
  constructor(serviceClient) {
    this.client = serviceClient;
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
  joinRoom(actorId, roomId, slotId) {
    return this.rpc("live_v2_join_room", {
      p_actor: actorId,
      p_match: roomId,
      p_slot: slotId,
    });
  }
  authorizedSnapshot(actorId, roomId) {
    return this.rpc("live_v2_snapshot", { p_actor: actorId, p_match: roomId });
  }
  recover(actorId, roomId, commandId) {
    return this.rpc("live_v2_recover_command", {
      p_actor: actorId,
      p_match: roomId,
      p_command: commandId,
    });
  }
  confirm(args) {
    return this.rpc("live_v2_confirm_command", args);
  }
  reject(args) {
    return this.rpc("live_v2_reject_command", args);
  }
  expired(limit = 50) {
    return this.rpc("live_v2_claim_expired", { p_limit: limit });
  }
}
