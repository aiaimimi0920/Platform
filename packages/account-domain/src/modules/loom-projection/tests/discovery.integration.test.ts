import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { ZodError } from "zod";
import { LoomProjectionService } from "../service";
import { LoomProjectionRepository } from "../repository";
import { accept, create, hasCode, integration, policy, publish, view, withFixture } from "./fixture";

test("A learns B from sync only after binding; presence expires and peer TLS identity is mandatory", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device(), c = await f.device(), outsider = await f.device(randomUUID());
  const envelope = a.invitation();
  await a.call(create(envelope));
  await a.call({ kind: "sync", endpoint: a.endpoint });
  assert.deepEqual(await b.call({ kind: "sync", endpoint: b.endpoint }), { kind: "sync", views: [] });
  assert.deepEqual(await c.call({ kind: "sync", endpoint: c.endpoint }), { kind: "sync", views: [] });
  const preview = view(await b.call({ kind: "inspect", envelope }));
  assert.deepEqual(preview.peer?.endpoint, a.endpoint);
  const peerRequest = { kind: "peer" as const, projectionId: envelope.projectionId,
    peerDeviceId: b.session.deviceId, peerPublicKey: b.session.publicKey };
  await assert.rejects(a.call(peerRequest), hasCode("projection_access_denied"));
  assert.equal((await a.call({ ...peerRequest, envelope })).kind, "peer");
  await assert.rejects(a.call({ ...peerRequest, envelope, peerPublicKey: c.session.publicKey }), hasCode("projection_access_denied"));
  await assert.rejects(a.call({ ...peerRequest, envelope, peerDeviceId: outsider.session.deviceId,
    peerPublicKey: outsider.session.publicKey }), hasCode("projection_peer_unavailable"));
  await b.call(accept(envelope));
  const sync = await a.call({ kind: "sync", endpoint: a.endpoint });
  assert.equal(sync.kind, "sync");
  if (sync.kind === "sync") {
    assert.equal(sync.views[0].peer?.deviceId, b.session.deviceId);
    assert.deepEqual(sync.views[0].peer?.endpoint, b.endpoint);
    assert.equal(sync.views[0].authorizedUntilMs, f.clock.now + 30_000);
  }
  await assert.rejects(a.call({ ...peerRequest, envelope, peerDeviceId: c.session.deviceId,
    peerPublicKey: c.session.publicKey }), hasCode("projection_access_denied"));
  await a.call(peerRequest);
  f.clock.now += 45_001;
  const afterExpiry = view(await a.call({ kind: "read", projectionId: envelope.projectionId }));
  assert.equal(afterExpiry.available, true);
  assert.equal(afterExpiry.peer?.endpoint, null);
  await b.call({ kind: "sync", endpoint: { ...b.endpoint, addresses: [{ ip: "10.1.2.3", port: 40222 }] } });
  assert.equal(view(await a.call({ kind: "read", projectionId: envelope.projectionId })).peer?.endpoint?.addresses[0].port, 40222);
}));

test("presence rejects forged endpoint identities, untrusted relays and invalid or excessive addresses", integration, async () => withFixture(async (f) => {
  const a = await f.device();
  for (const endpoint of [
    { ...a.endpoint, endpointId: "0".repeat(64) },
    { ...a.endpoint, relayUrl: "https://untrusted.example/" },
    ...["0.0.0.0", "::", "127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "ff02::1", "224.0.0.1", "not-an-ip", "::ffff:127.0.0.1"].map((ip) =>
      ({ ...a.endpoint, addresses: [{ ip, port: 40222 }] })),
  ]) await assert.rejects(a.call({ kind: "sync", endpoint }), hasCode("projection_invalid_endpoint"));
  await assert.rejects(a.call({ kind: "sync", endpoint: { ...a.endpoint, addresses: Array.from({ length: 9 }, () => a.endpoint.addresses[0]) } }), ZodError);
  await assert.rejects(a.call({ ...create(a.invitation()), width: 8192, height: 8192 }), ZodError);
}));

test("a revocation between proof and Redis commit prevents late binding and presence", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await a.call(create(envelope));
  class RevocationAtCommit extends LoomProjectionRepository {
    override async commit(...args: Parameters<LoomProjectionRepository["commit"]>) {
      await f.accounts.prove("revoke", a.accountProof("revoke"));
      return super.commit(...args);
    }
    override async setPresence(...args: Parameters<LoomProjectionRepository["setPresence"]>) {
      await f.accounts.prove("revoke", b.accountProof("revoke"));
      return super.setPresence(...args);
    }
  }
  const delayed = new LoomProjectionService(new RevocationAtCommit(f.redis), f.accounts, () => policy, () => f.clock.now);
  await assert.rejects(delayed.execute(b.proof(accept(envelope))), hasCode("projection_peer_unavailable"));
  assert.equal((await f.repository.get(f.accountId, envelope.projectionId))?.record.receiver, null);
  await assert.rejects(delayed.execute(b.proof({ kind: "sync", endpoint: b.endpoint })), hasCode("device_session_unavailable"));
  assert.equal((await f.repository.presences(f.accountId, [b.session.deviceId], f.clock.now)).size, 0);
}));

test("concurrent publish and unlink cannot overwrite the stopped state", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await a.call(create(envelope));
  await b.call(accept(envelope));
  const results = await Promise.allSettled([a.call(publish(envelope)), b.call({ kind: "unlink", projectionId: envelope.projectionId })]);
  assert.equal(results[1].status, "fulfilled");
  assert.equal(view(await a.call({ kind: "read", projectionId: envelope.projectionId })).record.status, "stopped");
}));
