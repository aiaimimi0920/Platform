import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { ZodError } from "zod";
import { accept, create, hasCode, integration, withFixture } from "./fixture";

test("projection proofs bind exact payload bytes, purpose, clock, and a nonce shared with account requests", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const proof = a.proof({ kind: "configuration" });
  await assert.rejects(f.service.execute({ ...proof, payload: '{ "kind": "configuration" }' }), hasCode("invalid_device_proof"));
  await assert.rejects(f.service.execute({ ...proof, signature: b.proof({ kind: "configuration" }).signature }), hasCode("invalid_device_proof"));
  const status = a.accountProof("status");
  await assert.rejects(f.service.execute({ ...status, payload: proof.payload }), hasCode("invalid_device_proof"));
  await f.service.execute(proof);
  await assert.rejects(f.service.execute(proof), hasCode("device_proof_replayed"));
  await assert.rejects(f.accounts.prove("status", a.accountProof("status", proof.nonce)), hasCode("device_proof_replayed"));
  await assert.rejects(f.service.execute(a.proof({ kind: "configuration" }, { timestampMs: f.clock.now - 60_001 })), hasCode("device_clock_skew"));
  await assert.rejects(f.service.execute(a.proof('"' + "汉".repeat(4096) + '"')), ZodError);
  await assert.rejects(f.service.execute(a.proof("{")), hasCode("projection_invalid_request"));
  await assert.rejects(f.service.execute(a.proof('{"kind":"configuration","accountId":"other"}')), ZodError);
}));

test("projection rate budget cannot consume account status or logout budget", integration, async () => withFixture(async (f) => {
  const a = await f.device();
  for (let index = 0; index < 240; index++) await a.call({ kind: "configuration" });
  await assert.rejects(a.call({ kind: "configuration" }), (error: unknown) =>
    typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 429);
  assert.equal((await f.accounts.prove("status", a.accountProof("status"))).status, "signed_in");
  assert.equal((await f.accounts.prove("revoke", a.accountProof("revoke"))).status, "signed_out");
}));

test("invitations bind all source identity fields and only the authenticated source can register them", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await assert.rejects(b.call(create(envelope)), hasCode("projection_source_mismatch"));
  const substitutions = [
    { ...envelope, source: { ...envelope.source, sessionId: "other-epoch" } },
    { ...envelope, source: { ...envelope.source, unitId: "other-unit" } },
    { ...envelope, source: { ...envelope.source, accountId: randomUUID() } },
    { ...envelope, content: { ...envelope.content, digest: "b".repeat(64) } },
    { ...envelope, nonce: "0".repeat(32) },
    { ...envelope, expiresAtMs: envelope.expiresAtMs - 1 },
  ];
  for (const changed of substitutions) await assert.rejects(a.call(create(changed)), hasCode("projection_invalid_invitation"));
  await assert.rejects(a.call(create(a.seal({ ...envelope, serverOrigin: "https://attacker.example" }))), hasCode("projection_invalid_invitation"));
  const wrongKey = b.seal({ ...envelope, source: { ...envelope.source, publicKey: b.session.publicKey } });
  await assert.rejects(a.call(create(wrongKey)), hasCode("projection_source_mismatch"));
  await a.call(create(envelope));
  await assert.rejects(a.call(accept(envelope)), hasCode("projection_source_mismatch"));
}));

test("record quota includes stopped invitations and cannot be evaded by unlinking", integration, async () => withFixture(async (f) => {
  const a = await f.device();
  for (let index = 0; index < 64; index++) {
    const envelope = a.invitation();
    await a.call(create(envelope));
    await a.call({ kind: "unlink", projectionId: envelope.projectionId });
  }
  await assert.rejects(a.call(create(a.invitation())), hasCode("projection_limit_reached"));
  const sync = await a.call({ kind: "sync", endpoint: a.endpoint });
  assert.equal(sync.kind, "sync");
  if (sync.kind === "sync") {
    assert.equal(sync.views.length, 64);
    assert.ok(Buffer.byteLength(JSON.stringify(sync)) < 256 * 1024);
    assert.ok(sync.views.every((v) => v.record.status === "stopped" && v.peer === null));
  }
}));
