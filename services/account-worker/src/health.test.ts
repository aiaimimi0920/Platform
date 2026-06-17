import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWorkerHealthState, markOutboxRecovery } from "./health";

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
