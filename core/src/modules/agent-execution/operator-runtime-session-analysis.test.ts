import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRuntimeSessionRecommendations } from "./operator-runtime-session-analysis";

describe("buildRuntimeSessionRecommendations", () => {
  it("returns no recommendations when there are no open runtime sessions", () => {
    const recommendations = buildRuntimeSessionRecommendations({
      openCount: 0,
      staleOpenCount: 0,
      terminalExecutionOpenCount: 0,
      oldestStaleStartedAt: null,
      openByKind: [],
      openByState: [],
    });

    assert.deepEqual(recommendations, []);
  });

  it("prioritizes terminal-open sweep and stale inspect before narrower slices", () => {
    const recommendations = buildRuntimeSessionRecommendations({
      openCount: 8,
      staleOpenCount: 5,
      terminalExecutionOpenCount: 3,
      oldestStaleStartedAt: "2026-03-27T02:00:00.000Z",
      openByKind: [
        { key: "platform_executor", count: 4 },
        { key: "owner_requeue", count: 2 },
        { key: "stale_recovery", count: 2 },
      ],
      openByState: [
        { key: "running", count: 3 },
        { key: "failed", count: 2 },
        { key: "requeued", count: 3 },
      ],
    });

    assert.deepEqual(
      recommendations.map((recommendation) => recommendation.kind),
      [
        "sweep_terminal_open_sessions",
        "inspect_stale_open_sessions",
        "inspect_owner_requeue_sessions",
        "inspect_stale_recovery_sessions",
        "inspect_failed_runtime_sessions",
      ],
    );
    assert.equal(recommendations[0]?.actionKind, "sweep_runtime_sessions");
    assert.equal(recommendations[1]?.actionKind, "inspect_runtime_session_slice");
    assert.equal(recommendations[0]?.suggestedStaleSeconds, 60);
    assert.equal(recommendations[1]?.staleOnly, true);
    assert.equal(recommendations[2]?.runtimeKind, "owner_requeue");
    assert.equal(recommendations[4]?.runtimeState, "failed");
  });

  it("keeps narrow inspect recommendations informational for small backlogs", () => {
    const recommendations = buildRuntimeSessionRecommendations({
      openCount: 2,
      staleOpenCount: 0,
      terminalExecutionOpenCount: 0,
      oldestStaleStartedAt: null,
      openByKind: [{ key: "owner_requeue", count: 1 }],
      openByState: [{ key: "failed", count: 1 }],
    });

    assert.deepEqual(
      recommendations.map((recommendation) => recommendation.severity),
      ["info", "info"],
    );
    assert.ok(recommendations.every((recommendation) => recommendation.actionKind === "inspect_runtime_session_slice"));
  });
});
