import { z } from "zod";
import type { LoomProjectionEnvelope, LoomProjectionOperation } from "@neuro/contracts";
import { verifySignature } from "../loom-account/model";

export const PROJECTION_PROTOCOL = "neuro.qr-projection.v2" as const;
export const INVITATION_TTL_MS = 300_000;
export const MAX_RECORDS = 64;
export const AUTHORIZATION_LEASE_MS = 30_000;
export const PRESENCE_TTL_MS = 45_000;
const identifier = z.string().min(1).max(160).regex(/^[A-Za-z0-9._:/-]+$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const projectionId = z.string().regex(/^projection:[a-f0-9]{32}$/);
const publicKey = z.string().regex(/^[A-Za-z0-9+/]{43}=$/);
const imageShape = {
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
  byteLength: z.number().int().min(1).max(4 * 1024 * 1024),
};
const pixels = (image: { width: number; height: number }) => image.width * image.height <= 16_777_216;
export const envelopeSchema = z.object({
  protocol: z.literal(PROJECTION_PROTOCOL), projectionId,
  serverOrigin: z.string().min(1).max(256).regex(/^[\x21-\x7e]+$/),
  source: z.object({ deviceId: z.string().uuid(), accountId: identifier, publicKey,
    sessionId: identifier, unitId: identifier, revision }).strict(),
  content: z.object({ kind: z.enum(["sticker", "art"]), digest }).strict(),
  expiresAtMs: revision, nonce: z.string().regex(/^[a-f0-9]{32}$/),
  signature: z.object({ algorithm: z.literal("ed25519"), keyId: z.string().uuid(),
    value: z.string().regex(/^[A-Za-z0-9_-]{86}$/) }).strict(),
}).strict();
export const endpointSchema = z.object({
  endpointId: digest,
  addresses: z.array(z.object({ ip: z.string().max(64), port: z.number().int().min(1).max(65535) }).strict()).max(8),
  relayUrl: z.string().max(256).nullable(),
}).strict();
const operationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("configuration") }).strict(),
  z.object({ kind: z.literal("create"), envelope: envelopeSchema, ...imageShape }).strict().refine(pixels),
  z.object({ kind: z.literal("inspect"), envelope: envelopeSchema }).strict(),
  z.object({ kind: z.literal("accept"), envelope: envelopeSchema, receiverUnitId: identifier,
    expectedRevision: revision, expectedDigest: digest, confirmed: z.literal(true) }).strict(),
  z.object({ kind: z.literal("publish"), projectionId, sourceSessionId: identifier, priorRevision: revision,
    revision, digest, ...imageShape }).strict().refine(pixels),
  z.object({ kind: z.enum(["read", "unlink"]), projectionId }).strict(),
  z.object({ kind: z.literal("sync"), endpoint: endpointSchema }).strict(),
  z.object({ kind: z.literal("peer"), projectionId, peerDeviceId: z.string().uuid(),
    peerPublicKey: publicKey, envelope: envelopeSchema.optional() }).strict(),
]);

export class LoomProjectionError extends Error {
  constructor(readonly statusCode: number, readonly code: string) { super(code); }
}

export function parseOperation(payload: string): LoomProjectionOperation {
  let value: unknown;
  try { value = JSON.parse(payload) as unknown; }
  catch { throw new LoomProjectionError(400, "projection_invalid_request"); }
  return operationSchema.parse(value);
}

// Fixed LF-delimited ASCII fields, no trailing LF. Signature encoding is v1's
// canonical unpadded base64url; account request proofs use standard base64.
export function invitationMessage(envelope: LoomProjectionEnvelope): string {
  const { source, content, signature } = envelope;
  return [envelope.protocol, envelope.projectionId, envelope.serverOrigin,
    source.deviceId, source.accountId, source.publicKey, source.sessionId, source.unitId,
    source.revision, content.kind, content.digest, envelope.expiresAtMs, envelope.nonce,
    signature.algorithm, signature.keyId].join("\n");
}

export function verifyInvitation(envelope: LoomProjectionEnvelope, origin: string): void {
  if (envelope.serverOrigin !== origin || envelope.signature.keyId !== envelope.source.deviceId) {
    throw new LoomProjectionError(400, "projection_invalid_invitation");
  }
  const bytes = Buffer.from(envelope.signature.value, "base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== envelope.signature.value) {
    throw new LoomProjectionError(400, "projection_invalid_invitation");
  }
  try { verifySignature(envelope.source.publicKey, invitationMessage(envelope), bytes.toString("base64")); }
  catch { throw new LoomProjectionError(400, "projection_invalid_invitation"); }
}

export function requireFreshInvitation(envelope: LoomProjectionEnvelope, now: number): void {
  if (envelope.expiresAtMs <= now || envelope.expiresAtMs > now + INVITATION_TTL_MS) {
    throw new LoomProjectionError(409, "projection_invitation_expired");
  }
}
