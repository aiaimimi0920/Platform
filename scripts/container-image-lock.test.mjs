import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_CONTAINER_IMAGES,
  aggregateContainerImageLockEntries,
  createContainerImageLockEntry,
} from "./container-image-lock.mjs";

const revision = "1".repeat(40);

function buildEntry(image, overrides = {}) {
  return createContainerImageLockEntry({
    image,
    reference: `ghcr.io/aiaimimi0920/neuro-platform-${image}`,
    digest: `sha256:${String(PLATFORM_CONTAINER_IMAGES.indexOf(image) + 1).repeat(64)}`,
    revision,
    repository: "aiaimimi0920/Platform",
    refName: "main",
    runId: "12345",
    runAttempt: "1",
    platform: "linux/amd64",
    ...overrides,
  });
}

test("container image lock entries validate and expose immutable references", () => {
  const entry = buildEntry("core");
  assert.equal(entry.image, "core");
  assert.equal(entry.source.revision, revision);
  assert.equal(entry.immutableReference, `${entry.reference}@${entry.digest}`);
  assert.throws(() => buildEntry("core", { digest: "sha256:bad" }), /digest is invalid/);
  assert.throws(() => buildEntry("unknown"), /Unknown Platform image/);
});

test("container image lock aggregation requires all six images and preserves canonical order", () => {
  const entries = PLATFORM_CONTAINER_IMAGES.map((image) => buildEntry(image)).reverse();
  const lock = aggregateContainerImageLockEntries(entries);

  assert.deepEqual(lock.images.map((entry) => entry.image), PLATFORM_CONTAINER_IMAGES);
  assert.equal(lock.source.revision, revision);
  assert.equal(lock.workflow.runId, "12345");
  assert.throws(() => aggregateContainerImageLockEntries(entries.slice(1)), /Expected 6 image lock entries/);
});

test("container image lock aggregation rejects duplicate and cross-run entries", () => {
  const entries = PLATFORM_CONTAINER_IMAGES.map((image) => buildEntry(image));
  assert.throws(
    () => aggregateContainerImageLockEntries([...entries.slice(0, -1), entries[0]]),
    /Duplicate image lock entry/,
  );
  assert.throws(
    () => aggregateContainerImageLockEntries([...entries.slice(0, -1), buildEntry("web", { runId: "99999" })]),
    /workflow runId does not match/,
  );
});
