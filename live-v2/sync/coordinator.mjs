export class SyncCoordinator {
  constructor({ applySnapshot }) {
    this.applySnapshot = applySnapshot;
    this.version = -1;
    this.pending = null;
    this.preview = null;
    this.connected = true;
  }
  previewPath(path) {
    this.preview = structuredClone(path);
  }
  disconnect() {
    this.connected = false;
    this.preview = null;
  }
  reconnect() {
    this.connected = true;
  }
  beginCommand(command) {
    if (this.pending) throw new Error("COMMAND_PENDING");
    this.pending = {
      command: structuredClone(command),
      status: "awaiting-confirmation",
    };
  }
  applyEnvelope(envelope) {
    if (!Number.isInteger(envelope?.version))
      throw new Error("INVALID_ENVELOPE");
    const isPending = this.pending?.command.id === envelope.commandId;
    if (isPending && envelope.confirmed) this.pending = null;
    if (isPending && envelope.rejected)
      this.pending = {
        ...this.pending,
        status: "rejected",
        error: envelope.error,
      };
    if (envelope.version <= this.version) return false;
    this.version = envelope.version;
    this.applySnapshot(structuredClone(envelope.state));
    return true;
  }
  recover(result) {
    if (!this.pending) return "none";
    if (result) {
      this.applyEnvelope(result);
      return "confirmed";
    }
    return "retry-original";
  }
  rejectPending(error) {
    if (this.pending)
      this.pending = { ...this.pending, status: "rejected", error };
  }
  acknowledgeRejection() {
    if (this.pending?.status !== "rejected") return false;
    this.pending = null;
    return true;
  }
  retryCommand() {
    if (!this.pending || this.pending.status === "rejected") return null;
    return structuredClone(this.pending.command);
  }
  pendingCommand() {
    return structuredClone(this.pending);
  }
}
