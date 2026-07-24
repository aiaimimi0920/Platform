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

    const healthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get("content-type"), "application/json");
    assert.deepEqual(await healthResponse.json(), {
      ok: true,
      service: "executor",
      role: "platform-runtime",
      state,
    });

    const initialReadyResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(initialReadyResponse.status, 503);
    assert.equal(initialReadyResponse.headers.get("content-type"), "application/json");
    assert.deepEqual(await initialReadyResponse.json(), {
      ok: false,
      ready: false,
      service: "executor",
      role: "platform-runtime",
      readiness: {
        ready: false,
        failingLoops: [
          { key: "fast", reason: "never_succeeded" },
          { key: "slow", reason: "never_succeeded" },
        ],
      },
      state,
    });

    const notFoundResponse = await fetch(`${baseUrl}/missing`);
    assert.equal(notFoundResponse.status, 404);
    assert.equal(await notFoundResponse.text(), "");

    markExecutorLoop(state, "fast", "success");
    markExecutorLoop(state, "slow", "success");
    const readyResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(readyResponse.status, 200);
    assert.deepEqual(await readyResponse.json(), {
      ok: true,
      ready: true,
      service: "executor",
      role: "platform-runtime",
      readiness: {
        ready: true,
        failingLoops: [],
      },
      state,
    });

    markExecutorLoop(state, "fast", "error", "core unavailable");
    const degradedHealthResponse = await fetch(`${baseUrl}/health`);
    assert.equal(degradedHealthResponse.status, 200);
    assert.deepEqual(await degradedHealthResponse.json(), {
      ok: true,
      service: "executor",
      role: "platform-runtime",
      state,
    });

    const degradedReadyResponse = await fetch(`${baseUrl}/ready`);
    assert.equal(degradedReadyResponse.status, 503);
    assert.deepEqual(await degradedReadyResponse.json(), {
      ok: false,
      ready: false,
      service: "executor",
      role: "platform-runtime",
      readiness: {
        ready: false,
        failingLoops: [{ key: "fast", reason: "last_run_failed" }],
      },
      state,
    });
  });
});
