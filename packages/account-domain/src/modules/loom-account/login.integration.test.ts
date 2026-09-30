import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { test } from "node:test";
import Redis from "ioredis";
import type { LoomAccountGrant, LoomAccountProof } from "@neuro/contracts";
import { challengeFor, exchangeMessage, LoomAccountError, proofMessage, PROTOCOL } from "./model";
import { LoomAccountRepository } from "./repository";
import { LoomAccountService } from "./service";

function device(now: number) {
  const keys = generateKeyPairSync("ed25519");
  const verifier = randomBytes(32).toString("base64url");
  const grant: LoomAccountGrant = {
    protocol: PROTOCOL, requestId: randomBytes(32).toString("hex"),
    codeChallenge: challengeFor(verifier),
    publicKey: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64"),
    deviceName: "Loom test device", expiresAtMs: now + 600_000,
  };
  return {
    grant,
    exchange: { requestId: grant.requestId, codeVerifier: verifier,
      signature: sign(null, Buffer.from(exchangeMessage(grant, verifier)), keys.privateKey).toString("base64") },
    proof(action: "status" | "revoke", deviceId: string, timestampMs = Date.now()): LoomAccountProof {
      const payload = { deviceId, timestampMs, nonce: randomBytes(16).toString("hex"), signature: "" };
      payload.signature = sign(null, Buffer.from(proofMessage(action, payload)), keys.privateKey).toString("base64");
      return payload;
    },
  };
}

const hasCode = (code: string) => (error: unknown) => error instanceof LoomAccountError && error.code === code;

test("real Redis: Loom account authorization, identity, replay and revocation", {
  skip: !process.env.LOOM_ACCOUNT_TEST_REDIS_URL,
}, async (t) => {
  const url = new URL(process.env.LOOM_ACCOUNT_TEST_REDIS_URL!);
  assert.equal(url.hostname, "127.0.0.1", "The harness must supply an isolated loopback Redis");
  const redis = new Redis(url.toString(), { maxRetriesPerRequest: 0, connectTimeout: 3000 });
  const repository = new LoomAccountRepository(redis);
  const service = new LoomAccountService(repository);
  const user = () => ({ userId: randomUUID(), username: "Fixture user" });
  try {
    await t.test("approval is required and public metadata does not grant access", async () => {
      const a = device(Date.now());
      assert.deepEqual(await service.exchange(a.exchange), { status: "pending" });
      await service.approve(a.grant, user());
      await assert.rejects(service.exchange({ ...a.exchange, codeVerifier: randomBytes(32).toString("base64url") }), hasCode("invalid_code_verifier"));
      const other = device(Date.now());
      await assert.rejects(service.exchange({ ...a.exchange, signature: other.exchange.signature }), hasCode("invalid_device_proof"));
    });
    await t.test("simultaneous exchanges bind once and retain response-loss recovery", async () => {
      const a = device(Date.now());
      const owner = user();
      await service.approve(a.grant, owner);
      await assert.rejects(service.approve(a.grant, user()), hasCode("authorization_unavailable"));
      const results = await Promise.all(Array.from({ length: 6 }, () => service.exchange(a.exchange)));
      for (const result of results) assert.equal(result.status, "signed_in");
      const ids = results.flatMap((r) => r.status === "signed_in" ? [r.session.deviceId] : []);
      assert.equal(new Set(ids).size, 1);
      await service.approve(a.grant, owner);
      const recovered = await new LoomAccountService(new LoomAccountRepository(redis)).exchange(a.exchange);
      assert.deepEqual(recovered, results[0]);
    });
    await t.test("same account keeps two distinct device identities and enforces signed action scope", async () => {
      const owner = user();
      const a = device(Date.now()), b = device(Date.now());
      await service.approve(a.grant, owner);
      await service.approve(b.grant, owner);
      const sa = await service.exchange(a.exchange), sb = await service.exchange(b.exchange);
      assert.equal(sa.status, "signed_in"); assert.equal(sb.status, "signed_in");
      if (sa.status !== "signed_in" || sb.status !== "signed_in") throw new Error("Expected devices");
      assert.equal(sa.session.accountId, sb.session.accountId);
      assert.notEqual(sa.session.deviceId, sb.session.deviceId);
      await assert.rejects(service.prove("status", b.proof("status", sa.session.deviceId)), hasCode("invalid_device_proof"));
      const proof = a.proof("status", sa.session.deviceId);
      await assert.rejects(service.prove("revoke", proof), hasCode("invalid_device_proof"));
      assert.equal((await service.prove("status", proof)).status, "signed_in");
      await assert.rejects(service.prove("status", proof), hasCode("device_proof_replayed"));
      await assert.rejects(service.prove("status", a.proof("status", sa.session.deviceId, Date.now() - 61_000)), hasCode("device_clock_skew"));
      assert.equal((await service.prove("revoke", a.proof("revoke", sa.session.deviceId))).status, "signed_out");
      await assert.rejects(service.exchange(a.exchange), hasCode("device_session_unavailable"));
      await assert.rejects(service.prove("status", a.proof("status", sa.session.deviceId)), hasCode("device_session_unavailable"));
      assert.equal((await service.prove("status", b.proof("status", sb.session.deviceId))).status, "signed_in");
    });
    await t.test("grant expiry, malformed keys and per-account pending budget", async () => {
      const a = device(Date.now());
      await assert.rejects(service.approve({ ...a.grant, expiresAtMs: Date.now() - 1 }, user()), hasCode("authorization_expired"));
      await assert.rejects(service.approve({ ...a.grant, publicKey: "x" }, user()));
      const owner = user();
      for (let index = 0; index < 8; index++) await service.approve(device(Date.now()).grant, owner);
      await assert.rejects(service.approve(device(Date.now()).grant, owner), hasCode("authorization_unavailable"));
      const future = new LoomAccountService(repository, () => Date.now() + 700_000);
      await service.approve(a.grant, user());
      assert.equal((await future.exchange(a.exchange)).status, "pending");
    });
  } finally {
    await redis.quit();
  }
});
