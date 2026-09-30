import type { LoomAccountSession, LoomProjectionEnvelope, LoomProjectionOperation, LoomProjectionRecord } from "@neuro/contracts";
import { invitationMessage, LoomProjectionError, requireFreshInvitation } from "./model";

type Create = Extract<LoomProjectionOperation, { kind: "create" }>;
type Accept = Extract<LoomProjectionOperation, { kind: "accept" }>;
type Publish = Extract<LoomProjectionOperation, { kind: "publish" }>;
const conflict = (code = "projection_conflict"): never => { throw new LoomProjectionError(409, code); };

export function requireSameInvitation(record: LoomProjectionRecord, envelope: LoomProjectionEnvelope): void {
  if (invitationMessage(record.envelope) !== invitationMessage(envelope)
      || record.envelope.signature.value !== envelope.signature.value) conflict("projection_invalid_invitation");
}

export function requireParticipant(record: LoomProjectionRecord, deviceId: string): void {
  if (record.envelope.source.deviceId !== deviceId && record.receiver?.deviceId !== deviceId) {
    throw new LoomProjectionError(403, "projection_access_denied");
  }
}

export function requireSource(record: LoomProjectionRecord, deviceId: string): void {
  if (record.envelope.source.deviceId !== deviceId) throw new LoomProjectionError(403, "projection_access_denied");
}

export function requireActive(record: LoomProjectionRecord, now: number): void {
  if (record.status === "stopped" || record.expiresAtMs <= now) conflict("projection_stopped");
}

export function createRecord(op: Create, session: LoomAccountSession, previous: LoomProjectionRecord | null, now: number): LoomProjectionRecord {
  const source = op.envelope.source;
  if (source.deviceId !== session.deviceId || source.accountId !== session.accountId
      || source.publicKey !== session.publicKey) throw new LoomProjectionError(403, "projection_source_mismatch");
  if (previous) {
    requireActive(previous, now);
    requireSameInvitation(previous, op.envelope);
    if (previous.initialImage.width !== op.width || previous.initialImage.height !== op.height
        || previous.initialImage.byteLength !== op.byteLength) conflict();
    return previous;
  }
  requireFreshInvitation(op.envelope, now);
  if (source.revision !== 1 || op.envelope.expiresAtMs > session.expiresAtMs) conflict();
  const initialImage = { width: op.width, height: op.height, byteLength: op.byteLength };
  return { envelope: op.envelope, initialImage, ...initialImage,
    revision: 1, digest: op.envelope.content.digest, status: "invited", receiver: null,
    expiresAtMs: session.expiresAtMs, updatedAtMs: now };
}

export function acceptRecord(op: Accept, session: LoomAccountSession, record: LoomProjectionRecord, now: number): LoomProjectionRecord {
  requireActive(record, now);
  requireSameInvitation(record, op.envelope);
  if (session.deviceId === record.envelope.source.deviceId || session.publicKey === record.envelope.source.publicKey) {
    throw new LoomProjectionError(403, "projection_source_mismatch");
  }
  if (record.receiver) {
    const receiver = record.receiver;
    if (receiver.deviceId !== session.deviceId || receiver.unitId !== op.receiverUnitId
        || receiver.revision !== op.expectedRevision || receiver.digest !== op.expectedDigest) conflict("projection_already_linked");
    return record;
  }
  requireFreshInvitation(op.envelope, now);
  if (record.revision !== op.expectedRevision || record.digest !== op.expectedDigest) conflict("projection_revision_conflict");
  return { ...record, status: "linked", updatedAtMs: now, receiver: {
    deviceId: session.deviceId, unitId: op.receiverUnitId, revision: op.expectedRevision, digest: op.expectedDigest,
  } };
}

export function publishRecord(op: Publish, session: LoomAccountSession, record: LoomProjectionRecord, now: number): LoomProjectionRecord {
  requireSource(record, session.deviceId);
  requireActive(record, now);
  if (op.sourceSessionId !== record.envelope.source.sessionId || op.priorRevision + 1 !== op.revision) conflict("projection_revision_conflict");
  if (record.revision === op.revision && record.digest === op.digest && record.width === op.width
      && record.height === op.height && record.byteLength === op.byteLength) return record;
  if (record.revision !== op.priorRevision) conflict("projection_revision_conflict");
  return { ...record, revision: op.revision, digest: op.digest, width: op.width,
    height: op.height, byteLength: op.byteLength, updatedAtMs: now };
}
