// Exercise the local Hook contract against two actual, independently logged-in Loom processes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { ProjectionClient, digest, png, type Identity } from "../../../Loom/scripts/qr-projection-smoke/protocol.ts";
import { ProjectionRuntime, object, textField, type JsonObject } from "../../../Loom/scripts/qr-projection-smoke/runtime.ts";

export async function nativeProjectionLifecycle(a: ProjectionRuntime, b: ProjectionRuntime): Promise<string[]> {
  const source = new ProjectionClient(a);
  const receiver = new ProjectionClient(b);
  const hookA = await source.pair("Projection Hook A");
  const hookB = await receiver.pair("Projection Hook B");
  const post = (client: ProjectionClient, actor: Identity, kind: string, fields: JsonObject = {}, status = 200) =>
    client.post(actor, `v2/${kind}`, { kind, ...fields }, status);
  const eventually = async (operation: () => Promise<JsonObject | undefined>) => {
    const deadline = Date.now() + 35_000;
    while (Date.now() < deadline) {
      const value = await operation();
      if (value) return value;
      await delay(500, undefined, { signal: a.signal });
    }
    throw new Error("native projection convergence timed out");
  };

  assert.equal((await a.request("/v1/projections/v2/context", { kind: "context" })).status, 401);
  const context = await post(source, hookA, "context");
  assert.equal(context.projectionProtocol, "neuro.qr-projection.v2");
  const created = await post(source, hookA, "create", { unitId: "native-source", contentKind: "sticker", snapshot: png(10) });
  const envelope = object(created.envelope);
  const sourceIdentity = object(envelope.source);
  assert.equal(envelope.protocol, "neuro.qr-projection.v2");
  assert.equal(sourceIdentity.accountId, context.accountId);
  assert.equal(sourceIdentity.deviceId, context.deviceId);
  assert.notEqual(sourceIdentity.deviceId, hookA.id);
  const projectionId = textField(envelope.projectionId, "projection identifier");
  let lastPreviewStatus = "";
  const preview = await eventually(async () => {
    const result = await b.request("/v1/projections/v2/inspect", { kind: "inspect", envelope }, {
      Authorization: `Device ${hookB.token}`, "X-Loom-Device-Nonce": randomUUID(),
    });
    if (result.status === 200) return result.body;
    const failure = JSON.stringify({ status: result.status, error: result.body.error });
    if (failure !== lastPreviewStatus) console.log("Projection preview pending:", failure);
    lastPreviewStatus = failure;
    assert.ok([409, 503, 504].includes(result.status), `preview status ${result.status}`);
    return undefined;
  });
  assert.equal(object(preview.snapshot).imageBase64, png(10).imageBase64);
  const accepted = await post(receiver, hookB, "accept", { envelope, receiverUnitId: "native-receiver",
    expectedRevision: 1, expectedDigest: digest(png(10)), confirmed: true });
  assert.equal(accepted.receiverUnitId, "native-receiver");

  for (const priorRevision of [1, 2]) {
    if (priorRevision === 2) {
      await Promise.all([a.stop(), b.stop()]);
      await Promise.all([a.start(), b.start()]);
      await source.session(hookA);
      await receiver.session(hookB);
      const restored = await post(receiver, hookB, "read", { projectionId, knownRevision: 2 });
      assert.equal(restored.revision, 2);
      assert.equal(restored.receiverUnitId, "native-receiver");
    }
    const snapshot = png(10 + priorRevision);
    await post(source, hookA, "update", { projectionId, sourceSessionId: sourceIdentity.sessionId,
      priorRevision, revision: priorRevision + 1, snapshot });
    const received = await eventually(async () => {
      const response = await post(receiver, hookB, "read", { projectionId, knownRevision: priorRevision });
      return response.revision === priorRevision + 1 ? response : undefined;
    });
    assert.equal(received.digest, digest(snapshot));
    assert.equal(object(received.snapshot).imageBase64, snapshot.imageBase64);
    assert.equal(received.transport, "direct");
  }
  await post(receiver, hookB, "unlink", { projectionId });
  console.log("Projection milestones: preview, acceptance, two direct PNG updates and restart passed; waiting for unlink");
  let lastSourceState = "";
  await eventually(async () => {
    const reply = await a.request("/v1/projections/v2/read", { kind: "read", projectionId, knownRevision: 3 }, {
      Authorization: `Device ${hookA.token}`, "X-Loom-Device-Nonce": randomUUID(),
    });
    if (reply.status === 410) {
      assert.equal(object(reply.body.error).code, "projection_unlinked");
      return reply.body;
    }
    const state = JSON.stringify({ status: reply.status, linked: reply.body.linked, transport: reply.body.transport, error: reply.body.error });
    if (state !== lastSourceState) console.log("Source unlink pending:", state);
    lastSourceState = state;
    assert.equal(reply.status, 200);
    return undefined;
  });
  await post(source, hookA, "update", { projectionId, sourceSessionId: sourceIdentity.sessionId,
    priorRevision: 3, revision: 4, snapshot: png(20) }, 410);
  return ["local_hook_authorization_required", "loom_account_signs_v2_invitation", "native_iroh_preview_and_accept",
    "two_native_png_updates", "restart_reconnects_and_receives_new_pixels", "observed_direct_transport",
    "receiver_unlink_fences_source_updates"];
}
