import assert from "node:assert/strict";
import test from "node:test";

import { publicSurfaceKeys, type PublicSurfaceSnapshot } from "@neuro/contracts";

import {
  createClosedPublicSurfaceSnapshot,
  hasPublicSurfaceSnapshot,
  loadPublicSurfaceDependency,
} from "./public-surface-dependency";
import { isPublicSurfaceVisibleForViewer } from "./public-surface-visibility";

function createSnapshot(enabled: boolean): PublicSurfaceSnapshot {
  const updatedAt = "2026-08-10T00:00:00.000Z";
  return Object.fromEntries(
    publicSurfaceKeys.map((surfaceKey) => [surfaceKey, { surfaceKey, enabled, updatedAt }]),
  ) as PublicSurfaceSnapshot;
}

test("public surface dependency preserves a successful strict snapshot", async () => {
  const snapshot = createSnapshot(true);
  const result = await loadPublicSurfaceDependency(async () => snapshot);

  assert.equal(hasPublicSurfaceSnapshot(result), true);
  assert.equal(result.state, "ready");
  if (result.state === "ready") assert.equal(result.data, snapshot);
});

test("public surface dependency classifies a Core failure without opening surfaces", async () => {
  const result = await loadPublicSurfaceDependency(async () => {
    throw {
      category: "dependency",
      correlationId: "public-surface-correlation",
      retryable: true,
      service: "core",
      statusCode: 503,
    };
  });

  assert.equal(hasPublicSurfaceSnapshot(result), false);
  assert.equal(result.state, "unavailable");
  assert.equal(result.correlationId, "public-surface-correlation");
  assert.equal(result.failures[0].source, "public-surfaces");
  assert.deepEqual(
    publicSurfaceKeys.map((surfaceKey) => createClosedPublicSurfaceSnapshot()[surfaceKey].enabled),
    publicSurfaceKeys.map(() => false),
  );
});

test("public surface visibility fails closed when a snapshot omits a key", () => {
  const incomplete = { ...createSnapshot(false) } as Partial<PublicSurfaceSnapshot>;
  delete incomplete.wallet;

  assert.equal(
    isPublicSurfaceVisibleForViewer(incomplete as PublicSurfaceSnapshot, "wallet", "owner-user"),
    false,
  );
});
