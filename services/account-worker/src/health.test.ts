import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";

import {
  createWorkerHealthState,
  evaluateWorkerReadiness,
  markOutboxRecovery,
  markProductShadowSync,
  markWorkerCycle,
  startWorkerHealthServer,
} from "./health";

describe("account worker health state", () => {
  it("records stale outbox recovery counts for the health endpoint", () => {
    const state = createWorkerHealthState();

    markOutboxRecovery(state, {
      status: "success",
      requeuedCount: 2,
      deadLetterCount: 1,
    });
    markOutboxRecovery(state, {
      status: "success",
      requeuedCount: 3,
      deadLetterCount: 0,
    });

    assert.match(state.lastOutboxRecoveryAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(state.lastOutboxRecoveryStatus, "success");
    assert.equal(state.lastOutboxRecoveryRequeuedCount, 3);
    assert.equal(state.lastOutboxRecoveryDeadLetterCount, 0);
    assert.equal(state.totalOutboxRecoveryRequeuedCount, 5);
    assert.equal(state.totalOutboxRecoveryDeadLetterCount, 1);
    assert.equal(state.lastOutboxRecoveryErrorAt, null);
    assert.equal(state.lastOutboxRecoveryErrorMessage, null);
  });

  it("records stale outbox recovery errors without erasing accumulated totals", () => {
    const state = createWorkerHealthState();

    markOutboxRecovery(state, {
      status: "success",
      requeuedCount: 2,
      deadLetterCount: 1,
    });
    markOutboxRecovery(state, {
      status: "error",
      error: "recovery query failed",
    });

    assert.equal(state.lastOutboxRecoveryStatus, "error");
    assert.equal(state.lastOutboxRecoveryRequeuedCount, null);
    assert.equal(state.lastOutboxRecoveryDeadLetterCount, null);
    assert.equal(state.totalOutboxRecoveryRequeuedCount, 2);
    assert.equal(state.totalOutboxRecoveryDeadLetterCount, 1);
    assert.match(state.lastOutboxRecoveryErrorAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(state.lastOutboxRecoveryErrorMessage, "recovery query failed");
  });
});

describe("account worker readiness", () => {
  it("rejects never-successful, failed, and stale cycles and recovers after success", () => {
    const state = createWorkerHealthState(1_000, 0);

    assert.equal(evaluateWorkerReadiness(state, 0).reason, "never_succeeded");

    markWorkerCycle(state, "success", undefined, 1_000);
    assert.equal(evaluateWorkerReadiness(state, 1_000).ready, true);

    markWorkerCycle(state, "error", "account database unavailable", 2_000);
    assert.equal(evaluateWorkerReadiness(state, 2_000).reason, "last_cycle_failed");

    markWorkerCycle(state, "success", undefined, 3_000);
    assert.equal(evaluateWorkerReadiness(state, 3_000).ready, true);
    assert.equal(
      evaluateWorkerReadiness(state, 3_000 + state.readinessFreshnessMs + 1).reason,
      "stale_success",
    );
  });

  it("keeps liveness at 200 while readiness follows the latest cycle", async (t) => {
    const state = createWorkerHealthState(1_000);
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

  it("does not let a successful top-level cycle hide a failed critical subloop", () => {
    const state = createWorkerHealthState(1_000, 0);
    markWorkerCycle(state, "success", undefined, 1_000);
    markProductShadowSync(state, "error", "core unavailable");

    const failed = evaluateWorkerReadiness(state, 1_100);
    assert.equal(failed.ready, false);
    assert.equal(failed.reason, "dependency_failed");
    assert.deepEqual(failed.failingDependencies, ["product-shadow-sync"]);

    markWorkerCycle(state, "success", undefined, 1_200);
    assert.equal(evaluateWorkerReadiness(state, 1_200).ready, false);

    markProductShadowSync(state, "success");
    assert.equal(evaluateWorkerReadiness(state, 1_300).ready, true);
  });
});
