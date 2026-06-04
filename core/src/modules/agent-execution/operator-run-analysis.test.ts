import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildExecutionRunRecommendations,
  classifyExecutionRunFailure,
  getRecentWindowInterval,
  toExecutionPhaseBucket,
} from "./operator-run-analysis";

describe("agent execution operator run analysis", () => {
  it("classifies stale timeout failures ahead of run kind", () => {
    assert.equal(
      classifyExecutionRunFailure({
        runKind: "platform_executor",
        status: "failed",
        summary: "Recovery watchdog marked the stale platform execution as interrupted.",
        errorMessage: "Execution exceeded stale timeout of 900 seconds.",
      }),
      "stale_timeout",
    );
  });

  it("classifies failed platform executor runs", () => {
    assert.equal(
      classifyExecutionRunFailure({
        runKind: "platform_executor",
        status: "failed",
        summary: "Platform executor failed while processing the execution.",
        errorMessage: "Unknown platform executor failure",
      }),
      "executor_failure",
    );
  });

  it("classifies failed requeue runs", () => {
    assert.equal(
      classifyExecutionRunFailure({
        runKind: "requeue",
        status: "failed",
        summary: "Requeue failed.",
        errorMessage: "Execution cannot be requeued.",
      }),
      "requeue_failure",
    );
  });

  it("returns null for non-failed runs", () => {
    assert.equal(
      classifyExecutionRunFailure({
        runKind: "recovery",
        status: "completed",
        summary: "Recovery watchdog returned the execution to queued state.",
      }),
      null,
    );
  });

  it("normalizes empty execution phase buckets", () => {
    assert.equal(toExecutionPhaseBucket(null), "none");
    assert.equal(toExecutionPhaseBucket("prepare"), "prepare");
  });

  it("maps recent windows to SQL intervals", () => {
    assert.equal(getRecentWindowInterval("15m"), "15 minutes");
    assert.equal(getRecentWindowInterval("1h"), "1 hour");
    assert.equal(getRecentWindowInterval("24h"), "24 hours");
  });

  it("builds combo playbook recommendations when stale timeouts and queued executions coexist", () => {
    const recommendations = buildExecutionRunRecommendations({
      byExecutionStatus: [
        { key: "queued", count: 6 },
        { key: "running", count: 2 },
      ],
      byFailureCategory: [
        { key: "stale_timeout", count: 4 },
        { key: "executor_failure", count: 2 },
      ],
      recentWindows: [
        { key: "15m", totalCount: 5, failedCount: 2 },
        { key: "1h", totalCount: 8, failedCount: 3 },
        { key: "24h", totalCount: 12, failedCount: 4 },
      ],
    });

    assert.equal(recommendations.length, 2);
    assert.equal(recommendations[0]?.kind, "recover_then_run");
    assert.equal(recommendations[0]?.severity, "danger");
    assert.equal(recommendations[0]?.recentWindow, "15m");
    assert.equal(recommendations[0]?.suggestedLimit, 4);
    assert.equal(recommendations[0]?.suggestedExecutorLimit, 6);
    assert.equal(recommendations[1]?.failureCategory, "executor_failure");
  });
});
