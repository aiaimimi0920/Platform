import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import {
  createExecutorHealthState,
  evaluateExecutorReadiness,
  markExecutorLoop,
  startExecutorHealthServer,
} from "./health";

const loopDefinitions = [
  { key: "fast", intervalMs: 1_000 },
  { key: "slow", intervalMs: 5_000 },
];

describe("executor readiness", () => {
  it("requires every loop to succeed and supports failure recovery", () => {
    const state = createExecutorHealthState(loopDefinitions, 0);

    assert.deepEqual(evaluateExecutorReadiness(state, 0).failingLoops, [
      { key: "fast", reason: "never_succeeded" },
      { key: "slow", reason: "never_succeeded" },
    ]);

    markExecutorLoop(state, "fast", "success", undefined, 1_000);
    assert.deepEqual(evaluateExecutorReadiness(state, 1_000).failingLoops, [
      { key: "slow", reason: "never_succeeded" },
    ]);

    markExecutorLoop(state, "slow", "success", undefined, 1_000);
    assert.equal(evaluateExecutorReadiness(state, 1_000).ready, true);

    markExecutorLoop(state, "slow", "error", "core unavailable", 2_000);
    assert.deepEqual(evaluateExecutorReadiness(state, 2_000).failingLoops, [
      { key: "slow", reason: "last_run_failed" },
    ]);

    markExecutorLoop(state, "slow", "success", undefined, 3_000);
    assert.equal(evaluateExecutorReadiness(state, 3_000).ready, true);
  });

  it("evaluates freshness independently for each loop", () => {
    const state = createExecutorHealthState(loopDefinitions, 0);
    markExecutorLoop(state, "fast", "success", undefined, 1_000);
    markExecutorLoop(state, "slow", "success", undefined, 1_000);

    const fastThreshold = state.loops.fast.readinessFreshnessMs;
    const readiness = evaluateExecutorReadiness(state, 1_000 + fastThreshold + 1);

    assert.equal(readiness.ready, false);
    assert.deepEqual(readiness.failingLoops, [{ key: "fast", reason: "stale_success" }]);
  });

  it("keeps liveness at 200 while readiness reports aggregate loop state", async (t) => {
    const state = createExecutorHealthState(loopDefinitions);
    const server = startExecutorHealthServer(0, state);
    t.after(() => server.close());
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);

    markExecutorLoop(state, "fast", "success");
    markExecutorLoop(state, "slow", "success");
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);

    markExecutorLoop(state, "fast", "error", "core unavailable");
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);
  });
});
