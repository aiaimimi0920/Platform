import type { LoomProjectionOperation, LoomProjectionPolicy, LoomProjectionResult } from "@neuro/contracts";
import { LoomAccountService } from "../loom-account/service";
import { LoomProjectionAccess } from "./access";
import { LoomProjectionError, parseOperation, requireFreshInvitation, verifyInvitation } from "./model";
import { validateEndpoint } from "./policy";
import { LoomProjectionRepository } from "./repository";
import { acceptRecord, createRecord, publishRecord, requireActive, requireParticipant, requireSameInvitation, requireSource } from "./transitions";

export class LoomProjectionService {
  constructor(private readonly repository: LoomProjectionRepository, private readonly accounts: LoomAccountService,
    private readonly policy: () => LoomProjectionPolicy, private readonly now = Date.now) {}

  async execute(input: unknown): Promise<LoomProjectionResult> {
    const caller = await this.accounts.authorizeProjection(input);
    const op = parseOperation(caller.payload);
    const policy = this.policy();
    const access = new LoomProjectionAccess(caller, this.accounts, this.repository, policy, this.now());
    if ("envelope" in op && op.envelope) {
      verifyInvitation(op.envelope, policy.serverOrigin);
      if (op.envelope.source.accountId !== caller.session.accountId) throw new LoomProjectionError(403, "projection_access_denied");
    }
    if (op.kind === "configuration") return { kind: "configuration", policy };
    if (op.kind === "sync") return this.sync(op, access);
    if (op.kind === "peer") return this.authorizePeer(op, access);
    const id = "envelope" in op ? op.envelope.projectionId : op.projectionId;
    for (let attempt = 0; attempt < 4; attempt++) {
      const stored = await this.repository.get(caller.session.accountId, id);
      if (op.kind === "create") {
        const record = createRecord(op, caller.session, stored?.record ?? null, access.now);
        if (!stored && !await this.repository.commit(caller.session.accountId, null, record, [caller.fence], access.now)) continue;
        return { kind: "projection", view: await access.view(record) };
      }
      if (!stored) throw new LoomProjectionError(404, "projection_not_found");
      const { record } = stored;
      if (op.kind === "read" || op.kind === "unlink") requireParticipant(record, caller.session.deviceId);
      if (op.kind === "read") return { kind: "projection", view: await access.view(record) };
      if (op.kind === "inspect") {
        requireActive(record, access.now);
        requireSameInvitation(record, op.envelope);
        requireFreshInvitation(op.envelope, access.now);
        if (record.status !== "invited" || record.envelope.source.deviceId === caller.session.deviceId
            || record.envelope.source.publicKey === caller.session.publicKey) {
          throw new LoomProjectionError(409, "projection_already_linked");
        }
        return { kind: "projection", view: await access.view(record) };
      }
      // Cleanup remains available to a live participant when the other device
      // has already been revoked. All other mutations fence both sessions.
      const devices = op.kind === "unlink" ? [caller] : [caller, ...await access.pair(record)];
      const updated = op.kind === "accept" ? acceptRecord(op, caller.session, record, access.now)
        : op.kind === "publish" ? publishRecord(op, caller.session, record, access.now)
        : record.status === "stopped" ? record : { ...record, status: "stopped" as const, updatedAtMs: access.now };
      if (!await this.repository.commit(caller.session.accountId, stored.raw, updated, devices.map((device) => device.fence), access.now)) continue;
      return { kind: "projection", view: await access.view(updated) };
    }
    throw new LoomProjectionError(409, "projection_retry_required");
  }

  private async sync(op: Extract<LoomProjectionOperation, { kind: "sync" }>, access: LoomProjectionAccess): Promise<LoomProjectionResult> {
    validateEndpoint(op.endpoint, access.caller.session, access.policy);
    await this.repository.setPresence(access.caller, op.endpoint, access.now);
    const records = (await this.repository.list(access.caller.session.accountId, access.now)).filter((record) =>
      record.envelope.source.deviceId === access.caller.session.deviceId || record.receiver?.deviceId === access.caller.session.deviceId);
    // At most 64 records and 16 live account devices. Per-request caches bound
    // session and presence reads by distinct peers, not by association count.
    return { kind: "sync", views: await Promise.all(records.map((record) => access.view(record, true))) };
  }

  private async authorizePeer(op: Extract<LoomProjectionOperation, { kind: "peer" }>, access: LoomProjectionAccess): Promise<LoomProjectionResult> {
    const stored = await this.repository.get(access.caller.session.accountId, op.projectionId);
    if (!stored) throw new LoomProjectionError(404, "projection_not_found");
    const { record } = stored;
    requireSource(record, access.caller.session.deviceId);
    requireActive(record, access.now);
    const peer = await access.device(op.peerDeviceId);
    if (peer.session.publicKey !== op.peerPublicKey || peer.session.publicKey === access.caller.session.publicKey) {
      throw new LoomProjectionError(403, "projection_access_denied");
    }
    if (record.receiver) {
      if (record.receiver.deviceId !== op.peerDeviceId) throw new LoomProjectionError(403, "projection_access_denied");
    } else {
      if (!op.envelope) throw new LoomProjectionError(403, "projection_access_denied");
      requireSameInvitation(record, op.envelope);
      requireFreshInvitation(op.envelope, access.now);
    }
    const devices = await access.pair(record);
    return { kind: "peer", peer: await access.peer(peer), authorizedUntilMs: access.lease(record, [...devices, peer]) };
  }
}
