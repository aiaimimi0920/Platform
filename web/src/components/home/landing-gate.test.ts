import assert from "node:assert/strict";
import test from "node:test";

import { LANDING_GATE_INITIAL_VIEWPORT_WIDTH, resolveLandingGateReadyWidthPx } from "./landing-gate";

test("landing gate initial ready width stays deterministic for hydration", () => {
  assert.equal(LANDING_GATE_INITIAL_VIEWPORT_WIDTH, 1440);
  assert.equal(resolveLandingGateReadyWidthPx(LANDING_GATE_INITIAL_VIEWPORT_WIDTH), 360);
});

test("landing gate ready width keeps the same clamp behavior for small viewports", () => {
  assert.equal(resolveLandingGateReadyWidthPx(800), 340);
});
