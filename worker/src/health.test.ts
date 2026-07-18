import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import {
  createWorkerHealthState,
  evaluateWorkerReadiness,
  markWorkerDependency,
  markWorkerCycle,
  startWorkerHealthServer,
} from "./health";

describe("worker readiness", () => {
  it("rejects never-successful, failed, and stale cycles and recovers after success", () => {
    const state = createWorkerHealthState(300_000, 1_000, 0);

    assert.deepEqual(evaluateWorkerReadiness(state, 0), {
      ready: false,
      reason: "never_succeeded",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: null,
      failingDependencies: [],
    });

    markWorkerCycle(state, "success", undefined, 1_000);
    assert.equal(evaluateWorkerReadiness(state, 1_000).ready, true);

    markWorkerCycle(state, "error", "database unavailable", 2_000);
    assert.deepEqual(evaluateWorkerReadiness(state, 2_000), {
      ready: false,
      reason: "last_cycle_failed",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: 1_000,
      failingDependencies: [],
    });

    markWorkerCycle(state, "success", undefined, 3_000);
    assert.equal(evaluateWorkerReadiness(state, 3_000).ready, true);
    assert.equal(
      evaluateWorkerReadiness(state, 3_000 + state.readinessFreshnessMs + 1).reason,
      "stale_success",
    );
  });

  it("keeps liveness at 200 while readiness follows the latest cycle", async (t) => {
    const state = createWorkerHealthState(300_000, 1_000);
    const server = startWorkerHealthServer(0, state);
    t.after(() => server.close());
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);

    markWorkerCycle(state, "success");
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);

    markWorkerCycle(state, "error", "valkey unavailable");
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/ready`)).status, 503);
  });

  it("stays unready after a critical dependency failure until that dependency recovers", () => {
    const state = createWorkerHealthState(300_000, 1_000, 0);
    markWorkerCycle(state, "success", undefined, 1_000);
    markWorkerDependency(state, "core-dispatch", "error", "core unavailable", 1_100);

    assert.deepEqual(evaluateWorkerReadiness(state, 1_100), {
      ready: false,
      reason: "dependency_failed",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: 100,
      failingDependencies: ["core-dispatch"],
    });

    markWorkerCycle(state, "success", undefined, 1_200);
    assert.equal(evaluateWorkerReadiness(state, 1_200).ready, false);

    markWorkerDependency(state, "core-dispatch", "success", undefined, 1_300);
    assert.equal(evaluateWorkerReadiness(state, 1_300).ready, true);
  });
});
