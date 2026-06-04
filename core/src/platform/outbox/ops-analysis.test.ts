import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOutboxAlerts, buildOutboxRecommendations } from "./ops-analysis";

describe("outbox ops analysis", () => {
  it("returns dead-letter and backlog recommendations when thresholds are hit", () => {
    const recommendations = buildOutboxRecommendations({
      pendingCount: 28,
      processingCount: 7,
      deadLetterCount: 12,
      oldestPendingAgeHours: 3,
      processingLeaseTimeoutMinutes: 5,
      staleProcessingCount: 0,
      oldestStaleProcessingAgeMinutes: null,
      topDeadLetterEvents: [
        { key: "agentExecution.failed", count: 8 },
        { key: "task.submitted", count: 4 },
      ],
    });

    assert.equal(recommendations.length, 3);
    assert.equal(recommendations[0]?.kind, "retry_dead_letter_batch");
    assert.equal(recommendations[0]?.eventName, "agentExecution.failed");
    assert.equal(recommendations[1]?.status, "pending");
    assert.equal(recommendations[2]?.status, "processing");
  });

  it("returns an empty list when queues are healthy", () => {
    const recommendations = buildOutboxRecommendations({
      pendingCount: 3,
      processingCount: 1,
      deadLetterCount: 0,
      oldestPendingAgeHours: 0,
      processingLeaseTimeoutMinutes: 5,
      staleProcessingCount: 0,
      oldestStaleProcessingAgeMinutes: null,
      topDeadLetterEvents: [],
    });

    assert.deepEqual(recommendations, []);
  });

  it("returns a stale processing recommendation when lease timeout is exceeded", () => {
    const recommendations = buildOutboxRecommendations({
      pendingCount: 1,
      processingCount: 3,
      deadLetterCount: 0,
      oldestPendingAgeHours: 0,
      processingLeaseTimeoutMinutes: 5,
      staleProcessingCount: 2,
      oldestStaleProcessingAgeMinutes: 16,
      topDeadLetterEvents: [],
    });

    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0]?.kind, "recover_stale_processing_queue");
    assert.equal(recommendations[0]?.status, "processing");
    assert.equal(recommendations[0]?.severity, "danger");
  });

  it("builds proactive outbox alerts only when queue risk crosses threshold", () => {
    const alerts = buildOutboxAlerts({
      pendingCount: 90,
      deadLetterCount: 12,
      processingLeaseTimeoutMinutes: 5,
      oldestPendingAgeHours: 8,
      staleProcessingCount: 2,
      oldestStaleProcessingAgeMinutes: 7,
    });

    assert.equal(alerts.length, 3);
    assert.equal(alerts[0]?.kind, "dead_letter_backlog");
    assert.equal(alerts[0]?.alertLevel, 3);
    assert.equal(alerts[1]?.kind, "stale_processing");
    assert.equal(alerts[2]?.kind, "pending_backlog");
  });

  it("suppresses proactive alerts for small dead-letter and healthy pending queue", () => {
    const alerts = buildOutboxAlerts({
      pendingCount: 12,
      deadLetterCount: 1,
      processingLeaseTimeoutMinutes: 5,
      oldestPendingAgeHours: 0,
      staleProcessingCount: 0,
      oldestStaleProcessingAgeMinutes: null,
    });

    assert.deepEqual(alerts, []);
  });
});
