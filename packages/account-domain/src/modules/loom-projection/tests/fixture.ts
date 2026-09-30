import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import Redis from "ioredis";
import type { LoomAccountGrant, LoomAccountProof, LoomProjectionEnvelope, LoomProjectionOperation, LoomProjectionProof, LoomProjectionResult } from "@neuro/contracts";
import { LoomAccountError, proofMessage } from "../../loom-account/model";
import { LoomAccountRepository } from "../../loom-account/repository";
import { LoomAccountService } from "../../loom-account/service";
import { LoomProjectionError } from "../model";
import { projectionPolicy } from "../policy";
import { LoomProjectionRepository } from "../repository";
import { LoomProjectionService } from "../service";

export const integration = { skip: !process.env.LOOM_ACCOUNT_TEST_REDIS_URL };
export const hasCode = (code: string) => (error: unknown) =>
  (error instanceof LoomAccountError || error instanceof LoomProjectionError) && error.code === code;
export const policy = projectionPolicy("https://platform.example", ["https://relay.example/"]);

export async function withFixture(run: (fixture: Awaited<ReturnType<typeof setup>>) => Promise<void>): Promise<void> {
  const url = new URL(process.env.LOOM_ACCOUNT_TEST_REDIS_URL!);
  assert.equal(url.hostname, "127.0.0.1");
  const redis = new Redis(url.toString(), { maxRetriesPerRequest: 0, connectTimeout: 3000, retryStrategy: () => null });
  try { await run(await setup(redis)); }
  finally { await redis.quit(); }
}

async function setup(redis: Redis) {
  const clock = { now: Date.now() };
  const accounts = new LoomAccountService(new LoomAccountRepository(redis), () => clock.now);
  const repository = new LoomProjectionRepository(redis);
  const service = new LoomProjectionService(repository, accounts, () => policy, () => clock.now);
  const accountId = randomUUID();
  async function device(userId = accountId) {
    const keys = generateKeyPairSync("ed25519");
    const codeVerifier = randomBytes(32).toString("base64url");
    const grant: LoomAccountGrant = { protocol: "neuro.loom-account.v1", requestId: randomBytes(32).toString("hex"),
      codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
      publicKey: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64"),
      deviceName: "Projection test device", expiresAtMs: clock.now + 600_000 };
    const signed = (message: string) => sign(null, Buffer.from(message), keys.privateKey).toString("base64");
    await accounts.approve(grant, { userId, username: "Fixture" });
    const result = await accounts.exchange({ requestId: grant.requestId, codeVerifier,
      signature: signed(`neuro.loom-account.v1\nexchange\n${grant.requestId}\n${grant.codeChallenge}`) });
    assert.equal(result.status, "signed_in");
    if (result.status !== "signed_in") throw new Error("Missing fixture session");
    const { session } = result;
    const emptyProof = (): LoomAccountProof => ({ deviceId: session.deviceId, timestampMs: clock.now,
      nonce: randomBytes(16).toString("hex"), signature: "" });
    function proof(op: LoomProjectionOperation | string, overrides: Partial<LoomAccountProof> = {}): LoomProjectionProof {
      const payload = typeof op === "string" ? op : JSON.stringify(op);
      const value = { ...emptyProof(), ...overrides, payload };
      const digest = createHash("sha256").update(payload).digest("hex");
      value.signature = signed(`neuro.loom-account.v1\nprojection\n${value.deviceId}\n${value.timestampMs}\n${value.nonce}\n${digest}`);
      return value;
    }
    function accountProof(action: "status" | "revoke", nonce?: string): LoomAccountProof {
      const value = { ...emptyProof(), ...(nonce ? { nonce } : {}) };
      value.signature = signed(proofMessage(action, value));
      return value;
    }
    function seal(envelope: LoomProjectionEnvelope): LoomProjectionEnvelope {
      const e = structuredClone(envelope), s = e.source;
      const bytes = [e.protocol, e.projectionId, e.serverOrigin, s.deviceId, s.accountId, s.publicKey,
        s.sessionId, s.unitId, s.revision, e.content.kind, e.content.digest, e.expiresAtMs, e.nonce,
        e.signature.algorithm, e.signature.keyId].join("\n");
      e.signature.value = Buffer.from(signed(bytes), "base64").toString("base64url");
      return e;
    }
    function invitation(): LoomProjectionEnvelope {
      return seal({ protocol: "neuro.qr-projection.v2", projectionId: `projection:${randomBytes(16).toString("hex")}`,
        serverOrigin: policy.serverOrigin, source: { deviceId: session.deviceId, accountId: session.accountId,
          publicKey: session.publicKey, sessionId: randomUUID(), unitId: "sticker:source", revision: 1 },
        content: { kind: "sticker", digest: "a".repeat(64) }, expiresAtMs: clock.now + 300_000,
        nonce: randomBytes(16).toString("hex"), signature: { algorithm: "ed25519", keyId: session.deviceId, value: "" } });
    }
    return { session, proof, accountProof, invitation, seal,
      endpoint: { endpointId: Buffer.from(session.publicKey, "base64").toString("hex"),
        addresses: [{ ip: "192.168.10.12", port: 40123 }], relayUrl: policy.relayUrls[0] },
      call: (op: LoomProjectionOperation) => service.execute(proof(op)),
    };
  }
  return { redis, clock, accounts, accountId, repository, service, device };
}

export function view(result: LoomProjectionResult) {
  assert.equal(result.kind, "projection");
  if (result.kind !== "projection") throw new Error("Expected projection response");
  return result.view;
}

export const create = (envelope: LoomProjectionEnvelope): Extract<LoomProjectionOperation, { kind: "create" }> =>
  ({ kind: "create", envelope, width: 100, height: 120, byteLength: 2048 });
export const accept = (envelope: LoomProjectionEnvelope): Extract<LoomProjectionOperation, { kind: "accept" }> =>
  ({ kind: "accept", envelope, receiverUnitId: "sticker:receiver", expectedRevision: 1, expectedDigest: envelope.content.digest, confirmed: true });
export const publish = (envelope: LoomProjectionEnvelope): Extract<LoomProjectionOperation, { kind: "publish" }> =>
  ({ kind: "publish", projectionId: envelope.projectionId, sourceSessionId: envelope.source.sessionId,
    priorRevision: 1, revision: 2, digest: "b".repeat(64), width: 200, height: 200, byteLength: 4096 });
