import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProcessingRecoveryErrorMessage, shouldDeadLetterRecoveredProcessingEvent } from "./outbox-recovery";

describe("worker outbox processing recovery", () => {
  it("requeues stale processing events while attempts remain", () => {
    assert.equal(shouldDeadLetterRecoveredProcessingEvent(2, 3), false);
  });

  it("moves stale processing events to dead-letter when attempts are exhausted", () => {
    assert.equal(shouldDeadLetterRecoveredProcessingEvent(3, 3), true);
  });

  it("appends recovery context to an existing error when requeueing", () => {
    const message = buildProcessingRecoveryErrorMessage("handler deferred processing", "requeued");
    assert.match(message ?? "", /handler deferred processing/);
    assert.match(message ?? "", /requeued for retry/);
  });

  it("produces a dead-letter recovery message without a previous error", () => {
    const message = buildProcessingRecoveryErrorMessage(null, "dead_letter");
    assert.match(message ?? "", /moved to dead_letter/);
  });
});
