import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { InternalUserContext, LoomAccountExchangeResult, LoomAccountSession } from "@neuro/contracts";
import {
  exchangeMessage, exchangeSchema, grantSchema, GRANT_TTL_MS, LoomAccountError,
  proofMessage, proofSchema, projectionProofMessage, projectionProofSchema,
  PROOF_WINDOW_MS, PROTOCOL, publicKeyFor, SESSION_TTL_MS,
  verifySignature,
} from "./model";
import { LoomAccountRepository } from "./repository";

// The fence is compared inside the projection transaction so a concurrent
// logout cannot commit a new binding or presence after session revocation.
export interface LoomDeviceAuthorization {
  session: LoomAccountSession;
  fence: { key: string; value: string };
}

export function createLoomAccountService(redis: Pick<Redis, "get" | "eval">): LoomAccountService {
  return new LoomAccountService(new LoomAccountRepository(redis));
}

export class LoomAccountService {
  constructor(private readonly repository: LoomAccountRepository, private readonly now = Date.now) {}

  async projectionDevice(deviceId: string, accountId: string): Promise<LoomDeviceAuthorization | null> {
    const record = await this.repository.session(deviceId);
    if (!record || record.session.expiresAtMs <= this.now() || record.session.accountId !== accountId) return null;
    return { session: record.session, fence: this.repository.sessionFence(deviceId, record.raw) };
  }

  async authorizeProjection(input: unknown): Promise<LoomDeviceAuthorization & { payload: string }> {
    const proof = projectionProofSchema.parse(input);
    const now = this.now();
    if (Math.abs(now - proof.timestampMs) > PROOF_WINDOW_MS) {
      throw new LoomAccountError(401, "device_clock_skew");
    }
    const record = await this.repository.session(proof.deviceId);
    if (!record || record.session.expiresAtMs <= now) {
      throw new LoomAccountError(401, "device_session_unavailable");
    }
    verifySignature(record.session.publicKey, projectionProofMessage(proof), proof.signature);
    await this.repository.prove(record.raw, record.session, proof.nonce, "projection", now);
    return { session: record.session, fence: this.repository.sessionFence(proof.deviceId, record.raw), payload: proof.payload };
  }

  async approve(input: unknown, user: InternalUserContext): Promise<{ status: "approved" }> {
    const grant = grantSchema.parse(input);
    const now = this.now();
    if (grant.expiresAtMs <= now || grant.expiresAtMs > now + GRANT_TTL_MS
        || !user.userId || user.userId.length > 160) {
      throw new LoomAccountError(400, "authorization_expired");
    }
    publicKeyFor(grant.publicKey);
    await this.repository.approve({ grant, accountId: user.userId, username: (user.username || "").slice(0,160) }, now);
    return { status: "approved" };
  }

  async exchange(input: unknown): Promise<LoomAccountExchangeResult> {
    const payload = exchangeSchema.parse(input);
    // The second read recovers a concurrent exchange without issuing another identity.
    for (let attempt = 0; attempt < 2; attempt++) {
      const stored = await this.repository.grant(payload.requestId);
      const now = this.now();
      if (!stored || stored.record.grant.expiresAtMs <= now) return { status: "pending" };
      const { record, raw } = stored;
      verifySignature(record.grant.publicKey, exchangeMessage(record.grant, payload.codeVerifier), payload.signature);
      if (record.deviceId) {
        const existing = await this.repository.session(record.deviceId);
        if (!existing || existing.session.expiresAtMs <= now) {
          throw new LoomAccountError(401, "device_session_unavailable");
        }
        return { status: "signed_in", session: existing.session };
      }
      const session: LoomAccountSession = {
        protocol: PROTOCOL, deviceId: randomUUID(), accountId: record.accountId,
        username: record.username, deviceName: record.grant.deviceName,
        publicKey: record.grant.publicKey, expiresAtMs: now + SESSION_TTL_MS,
      };
      const result = await this.repository.exchange(raw, record, session, now);
      if (result === "ok") return { status: "signed_in", session };
      if (result === "limit") throw new LoomAccountError(429, "device_limit_reached");
    }
    throw new LoomAccountError(409, "authorization_retry_required");
  }

  async prove(action: "status" | "revoke", input: unknown) {
    const proof = proofSchema.parse(input);
    const now = this.now();
    if (Math.abs(now - proof.timestampMs) > PROOF_WINDOW_MS) {
      throw new LoomAccountError(401, "device_clock_skew");
    }
    const record = await this.repository.session(proof.deviceId);
    if (!record || record.session.expiresAtMs <= now) {
      throw new LoomAccountError(401, "device_session_unavailable");
    }
    verifySignature(record.session.publicKey, proofMessage(action, proof), proof.signature);
    await this.repository.prove(record.raw, record.session, proof.nonce, action, now);
    return action === "status"
      ? { status: "signed_in" as const, session: record.session }
      : { status: "signed_out" as const };
  }
}
