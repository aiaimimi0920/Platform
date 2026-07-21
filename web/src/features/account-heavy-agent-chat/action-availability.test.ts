import assert from "node:assert/strict";
import test from "node:test";

import {
  featureModuleKeys,
  publicSurfaceKeys,
  type FeatureSnapshot,
  type PublicSurfaceSnapshot,
} from "@neuro/contracts";

import { resolveChatActionAvailability } from "./action-availability";

function snapshots(): { features: FeatureSnapshot; surfaces: PublicSurfaceSnapshot } {
  const updatedAt = "2026-07-20T08:00:00.000Z";
  const features = Object.fromEntries(featureModuleKeys.map((moduleKey) => [
    moduleKey,
    { moduleKey, enabled: true, rolloutNote: null, updatedAt },
  ])) as FeatureSnapshot;
  const surfaces = Object.fromEntries(publicSurfaceKeys.map((surfaceKey) => [
    surfaceKey,
    { surfaceKey, enabled: true, updatedAt },
  ])) as PublicSurfaceSnapshot;
  return { features, surfaces };
}

test("P2-05: task and mailbox actions require both their module and surface", () => {
  const { features, surfaces } = snapshots();
  assert.deepEqual(resolveChatActionAvailability(features, surfaces, "user-a"), {
    task: true,
    mailbox: true,
  });

  features.taskHub.enabled = false;
  surfaces.mailbox.enabled = false;
  assert.deepEqual(resolveChatActionAvailability(features, surfaces, "user-a"), {
    task: false,
    mailbox: false,
  });
});
