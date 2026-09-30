import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { LoomProjectionService } from "../service";
import { LoomProjectionRepository } from "../repository";
import { accept, create, hasCode, integration, policy, publish, view, withFixture } from "./fixture";

test("central projection: same-account invitation, one receiver, source updates and restart", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device(), c = await f.device(), outsider = await f.device(randomUUID());
  const envelope = a.invitation();
  const initial = view(await a.call(create(envelope)));
  assert.equal(initial.record.status, "invited");
  assert.deepEqual(view(await a.call(create(envelope))), initial);
  await assert.rejects(a.call({ ...create(envelope), width: 101 }), hasCode("projection_conflict"));
  await assert.rejects(outsider.call({ kind: "inspect", envelope }), hasCode("projection_access_denied"));
  await assert.rejects(outsider.call({ kind: "read", projectionId: envelope.projectionId }), hasCode("projection_not_found"));
  await assert.rejects(b.call({ kind: "read", projectionId: envelope.projectionId }), hasCode("projection_access_denied"));
  assert.equal(view(await b.call({ kind: "inspect", envelope })).peer?.deviceId, a.session.deviceId);
  const attempts = await Promise.allSettled([b.call(accept(envelope)), c.call(accept(envelope))]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  const winner = attempts[0].status === "fulfilled" ? b : c;
  const loser = winner === b ? c : b;
  const retry = view(await winner.call(accept(envelope)));
  assert.equal(retry.record.receiver?.deviceId, winner.session.deviceId);
  await assert.rejects(loser.call(accept(envelope)), hasCode("projection_already_linked"));
  const update = publish(envelope);
  await assert.rejects(winner.call(update), hasCode("projection_access_denied"));
  assert.equal(view(await a.call(update)).record.revision, 2);
  assert.equal(view(await a.call(update)).record.revision, 2);
  await assert.rejects(a.call({ ...update, digest: "c".repeat(64) }), hasCode("projection_revision_conflict"));
  await assert.rejects(a.call({ ...update, sourceSessionId: "different-epoch" }), hasCode("projection_revision_conflict"));
  const restored = new LoomProjectionService(new LoomProjectionRepository(f.redis), f.accounts, () => policy, () => f.clock.now);
  const recovered = view(await restored.execute(winner.proof({ kind: "read", projectionId: envelope.projectionId })));
  assert.equal(recovered.record.revision, 2);
  assert.equal(recovered.record.receiver?.unitId, "sticker:receiver");
  f.clock.now += 300_001;
  assert.equal(view(await winner.call(accept(envelope))).record.revision, 2, "Accepted retry survives invitation expiry and later revisions");
  assert.equal(view(await a.call(create(envelope))).record.revision, 2, "Creation retry keeps the original identity");
  await winner.call({ kind: "unlink", projectionId: envelope.projectionId });
  assert.equal(view(await a.call({ kind: "read", projectionId: envelope.projectionId })).available, false);
  assert.equal(view(await a.call({ kind: "unlink", projectionId: envelope.projectionId })).record.status, "stopped");
  await assert.rejects(a.call(create(envelope)), hasCode("projection_stopped"));
  await assert.rejects(winner.call(accept(envelope)), hasCode("projection_stopped"));
  await assert.rejects(a.call({ ...update, priorRevision: 2, revision: 3 }), hasCode("projection_stopped"));
}));

test("central projection: stopped and revoked views have no lease on a slower device clock", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await a.call(create(envelope));
  await b.call(accept(envelope));
  const slowerDeviceNow = f.clock.now - 2000;
  const stopped = view(await b.call({ kind: "unlink", projectionId: envelope.projectionId }));
  assert.equal(stopped.available, false);
  assert.ok(stopped.authorizedUntilMs <= slowerDeviceNow, "A stopped view must be expired on the receiving clock");
  const sync = await a.call({ kind: "sync", endpoint: a.endpoint });
  assert.equal(sync.kind, "sync");
  if (sync.kind === "sync") assert.ok(sync.views.every((v) => !v.available && v.authorizedUntilMs <= slowerDeviceNow));
  const second = a.invitation();
  await a.call(create(second));
  await b.call(accept(second));
  await f.accounts.prove("revoke", b.accountProof("revoke"));
  const revoked = await a.call({ kind: "sync", endpoint: a.endpoint });
  assert.equal(revoked.kind, "sync");
  if (revoked.kind === "sync") assert.ok(revoked.views.every((v) => !v.available && v.authorizedUntilMs <= slowerDeviceNow));
}));

test("central projection: preview revision must still match when the receiver confirms", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await a.call(create(envelope));
  await b.call({ kind: "inspect", envelope });
  await a.call(publish(envelope));
  await assert.rejects(b.call(accept(envelope)), hasCode("projection_revision_conflict"));
  const result = await b.call({ kind: "accept", envelope, receiverUnitId: "b:unit", expectedRevision: 2,
    expectedDigest: "b".repeat(64), confirmed: true });
  assert.equal(view(result).record.receiver?.revision, 2);
}));

test("central projection: source or receiver revocation closes access and leaves cleanup available", integration, async () => withFixture(async (f) => {
  for (const revokeSource of [true, false]) {
    const a = await f.device(), b = await f.device();
    const envelope = a.invitation();
    await a.call(create(envelope));
    await b.call(accept(envelope));
    const revoked = revokeSource ? a : b, survivor = revokeSource ? b : a;
    await f.accounts.prove("revoke", revoked.accountProof("revoke"));
    await assert.rejects(survivor.call({ kind: "read", projectionId: envelope.projectionId }), hasCode("projection_peer_unavailable"));
    assert.equal((await f.accounts.prove("status", survivor.accountProof("status"))).status, "signed_in");
    const sync = await survivor.call({ kind: "sync", endpoint: survivor.endpoint });
    assert.equal(sync.kind, "sync");
    if (sync.kind === "sync") assert.ok(sync.views.every((v) => !v.available && v.peer === null));
    assert.equal(view(await survivor.call({ kind: "unlink", projectionId: envelope.projectionId })).record.status, "stopped");
    await assert.rejects(revoked.call({ kind: "read", projectionId: envelope.projectionId }), hasCode("device_session_unavailable"));
  }
}));

test("central projection: expired unaccepted invitations and account sessions fail closed", integration, async () => withFixture(async (f) => {
  const a = await f.device(), b = await f.device();
  const envelope = a.invitation();
  await a.call(create(envelope));
  f.clock.now += 300_001;
  await assert.rejects(b.call({ kind: "inspect", envelope }), hasCode("projection_invitation_expired"));
  await assert.rejects(b.call(accept(envelope)), hasCode("projection_invitation_expired"));
  f.clock.now = a.session.expiresAtMs + 1;
  await assert.rejects(a.call({ kind: "configuration" }), hasCode("device_session_unavailable"));
}));
