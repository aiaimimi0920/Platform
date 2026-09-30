import type { LoomProjectionPeer, LoomProjectionPolicy, LoomProjectionRecord, LoomProjectionView } from "@neuro/contracts";
import { LoomAccountService, type LoomDeviceAuthorization } from "../loom-account/service";
import { LoomProjectionError } from "./model";
import { validateEndpoint } from "./policy";
import { LoomProjectionRepository } from "./repository";

// Request-scoped caches only; a new request always checks central authorization.
export class LoomProjectionAccess {
  private readonly devices = new Map<string, Promise<LoomDeviceAuthorization | null>>();
  private readonly peers = new Map<string, Promise<LoomProjectionPeer>>();

  constructor(readonly caller: LoomDeviceAuthorization, private readonly accounts: LoomAccountService,
    private readonly repository: LoomProjectionRepository, readonly policy: LoomProjectionPolicy, readonly now: number) {
    this.devices.set(caller.session.deviceId, Promise.resolve(caller));
  }

  async device(deviceId: string): Promise<LoomDeviceAuthorization> {
    if (!this.devices.has(deviceId)) {
      this.devices.set(deviceId, this.accounts.projectionDevice(deviceId, this.caller.session.accountId));
    }
    const device = await this.devices.get(deviceId)!;
    if (!device) throw new LoomProjectionError(409, "projection_peer_unavailable");
    return device;
  }

  async pair(record: LoomProjectionRecord): Promise<LoomDeviceAuthorization[]> {
    const source = await this.device(record.envelope.source.deviceId);
    if (source.session.publicKey !== record.envelope.source.publicKey) {
      throw new LoomProjectionError(409, "projection_peer_unavailable");
    }
    return record.receiver ? [source, await this.device(record.receiver.deviceId)] : [source];
  }

  lease(record: LoomProjectionRecord, devices: LoomDeviceAuthorization[]): number {
    return Math.min(this.now + this.policy.authorizationLeaseMs, record.expiresAtMs,
      record.status === "invited" ? record.envelope.expiresAtMs : Infinity,
      ...devices.map((device) => device.session.expiresAtMs));
  }

  peer(device: LoomDeviceAuthorization): Promise<LoomProjectionPeer> {
    const { session } = device;
    if (!this.peers.has(session.deviceId)) {
      this.peers.set(session.deviceId, (async () => {
        const endpoints = await this.repository.presences(session.accountId, [session.deviceId], this.now);
        let endpoint = endpoints.get(session.deviceId) ?? null;
        // A relay removed from current deployment policy cannot survive in presence.
        if (endpoint) {
          try { validateEndpoint(endpoint, session, this.policy); }
          catch { endpoint = null; }
        }
        return { deviceId: session.deviceId, publicKey: session.publicKey, deviceName: session.deviceName, endpoint };
      })());
    }
    return this.peers.get(session.deviceId)!;
  }

  async view(record: LoomProjectionRecord, tolerateUnavailable = false): Promise<LoomProjectionView> {
    // A stopped/unavailable view grants no lease, even when the client clock lags the server.
    const unavailable: LoomProjectionView = { record, available: false, authorizedUntilMs: 0, peer: null };
    if (record.status === "stopped") return unavailable;
    try {
      const devices = await this.pair(record);
      const authorizedUntilMs = this.lease(record, [...devices, this.caller]);
      if (authorizedUntilMs <= this.now) return unavailable;
      const source = devices[0];
      const peer = source.session.deviceId === this.caller.session.deviceId ? devices[1] : source;
      return { record, available: true, authorizedUntilMs, peer: peer ? await this.peer(peer) : null };
    } catch (error) {
      if (tolerateUnavailable && error instanceof LoomProjectionError && error.code === "projection_peer_unavailable") return unavailable;
      throw error;
    }
  }
}
