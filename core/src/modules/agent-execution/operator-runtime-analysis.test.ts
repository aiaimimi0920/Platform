import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRuntimePressureAlertBuckets,
  buildRuntimePressureAlerts,
  getRuntimePressureAlertLevel,
} from "./operator-runtime-analysis";
import type { AgentExecutionRuntimeProfileUtilizationView } from "@neuro/contracts";

function makeRuntimeUtilization(
  overrides: Partial<AgentExecutionRuntimeProfileUtilizationView> &
    Pick<
      AgentExecutionRuntimeProfileUtilizationView,
      | "key"
      | "maxConcurrentExecutions"
      | "maxConcurrentExecutionsPerOwner"
      | "runningExecutionCount"
      | "queuedExecutionCount"
      | "availableExecutionSlots"
      | "busiestOwnerUserId"
      | "busiestOwnerRunningCount"
      | "saturatedOwnerCount"
      | "pressureLevel"
      | "schedulingDecisionClass"
      | "pressureDetail"
    >,
): AgentExecutionRuntimeProfileUtilizationView {
  return {
    claimableQueuedExecutionCount: 0,
    blockedQueuedExecutionCount: 0,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 0,
    blockedOwnerCount: 0,
    busiestBlockedOwnerUserId: null,
    busiestBlockedOwnerQueuedCount: null,
    ...overrides,
  };
}

describe("buildRuntimePressureAlerts", () => {
  it("treats profile and owner saturation as a critical alert", () => {
    const alerts = buildRuntimePressureAlerts([
      makeRuntimeUtilization({
        key: "baseline",
        maxConcurrentExecutions: 3,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 3,
        queuedExecutionCount: 4,
        claimableQueuedExecutionCount: 0,
        blockedQueuedExecutionCount: 4,
        blockedByProfileCount: 2,
        blockedByOwnerCount: 2,
        blockedOwnerCount: 1,
        availableExecutionSlots: 0,
        busiestOwnerUserId: "owner-a",
        busiestOwnerRunningCount: 2,
        busiestBlockedOwnerUserId: "owner-a",
        busiestBlockedOwnerQueuedCount: 2,
        saturatedOwnerCount: 1,
        pressureLevel: "critical",
        schedulingDecisionClass: "profile_and_owner_saturated",
        pressureDetail: "profile and owner are both saturated",
      }),
    ]);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]?.profileKey, "baseline");
    assert.equal(alerts[0]?.alertLevel, 3);
    assert.equal(alerts[0]?.severity, "danger");
  });

  it("treats queue backlog before saturation as a watch alert", () => {
    const entry = makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 2,
      claimableQueuedExecutionCount: 1,
      blockedQueuedExecutionCount: 1,
      blockedByProfileCount: 0,
      blockedByOwnerCount: 1,
      blockedOwnerCount: 1,
      availableExecutionSlots: 2,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 1,
      busiestBlockedOwnerUserId: "owner-b",
      busiestBlockedOwnerQueuedCount: 1,
      saturatedOwnerCount: 0,
      pressureLevel: "watch",
      schedulingDecisionClass: "queue_backlog",
      pressureDetail: "queue backlog is forming",
    } as const);

    const alerts = buildRuntimePressureAlerts([entry]);

    assert.equal(getRuntimePressureAlertLevel(entry), 1);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]?.alertLevel, 1);
    assert.equal(alerts[0]?.severity, "info");
  });

  it("returns buckets only for active alert levels", () => {
    const buckets = buildRuntimePressureAlertBuckets([
      makeRuntimeUtilization({
        key: "baseline",
        maxConcurrentExecutions: 3,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 3,
        queuedExecutionCount: 1,
        claimableQueuedExecutionCount: 0,
        blockedQueuedExecutionCount: 1,
        blockedByProfileCount: 1,
        blockedByOwnerCount: 0,
        blockedOwnerCount: 0,
        availableExecutionSlots: 0,
        busiestOwnerUserId: "owner-a",
        busiestOwnerRunningCount: 2,
        busiestBlockedOwnerUserId: null,
        busiestBlockedOwnerQueuedCount: null,
        saturatedOwnerCount: 1,
        pressureLevel: "critical",
        schedulingDecisionClass: "profile_and_owner_saturated",
        pressureDetail: "critical hotspot",
      }),
      makeRuntimeUtilization({
        key: "iterative",
        maxConcurrentExecutions: 4,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 3,
        queuedExecutionCount: 0,
        claimableQueuedExecutionCount: 0,
        blockedQueuedExecutionCount: 0,
        blockedByProfileCount: 0,
        blockedByOwnerCount: 0,
        blockedOwnerCount: 0,
        availableExecutionSlots: 1,
        busiestOwnerUserId: "owner-b",
        busiestOwnerRunningCount: 1,
        busiestBlockedOwnerUserId: null,
        busiestBlockedOwnerQueuedCount: null,
        saturatedOwnerCount: 0,
        pressureLevel: "watch",
        schedulingDecisionClass: "within_capacity",
        pressureDetail: "approaching cap",
      }),
      makeRuntimeUtilization({
        key: "deep_runtime",
        maxConcurrentExecutions: 1,
        maxConcurrentExecutionsPerOwner: 1,
        runningExecutionCount: 0,
        queuedExecutionCount: 0,
        claimableQueuedExecutionCount: 0,
        blockedQueuedExecutionCount: 0,
        blockedByProfileCount: 0,
        blockedByOwnerCount: 0,
        blockedOwnerCount: 0,
        availableExecutionSlots: 1,
        busiestOwnerUserId: null,
        busiestOwnerRunningCount: null,
        busiestBlockedOwnerUserId: null,
        busiestBlockedOwnerQueuedCount: null,
        saturatedOwnerCount: 0,
        pressureLevel: "healthy",
        schedulingDecisionClass: "within_capacity",
        pressureDetail: "healthy",
      }),
    ]);

    assert.deepEqual(buckets, [
      { key: "3", count: 1 },
      { key: "1", count: 1 },
    ]);
  });

  it("escalates owner hotspot when queued executions are blocked by owner quota", () => {
    const alerts = buildRuntimePressureAlerts([
      makeRuntimeUtilization({
        key: "iterative",
        maxConcurrentExecutions: 5,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 2,
        queuedExecutionCount: 3,
        claimableQueuedExecutionCount: 1,
        blockedQueuedExecutionCount: 2,
        blockedByProfileCount: 0,
        blockedByOwnerCount: 2,
        blockedOwnerCount: 1,
        availableExecutionSlots: 3,
        busiestOwnerUserId: "owner-a",
        busiestOwnerRunningCount: 2,
        busiestBlockedOwnerUserId: "owner-a",
        busiestBlockedOwnerQueuedCount: 2,
        saturatedOwnerCount: 1,
        pressureLevel: "watch",
        schedulingDecisionClass: "owner_hotspot",
        pressureDetail: "owner quota is blocking queued executions",
      }),
    ]);

    assert.equal(alerts[0]?.alertLevel, 3);
    assert.match(alerts[0]?.detail ?? "", /blockedByOwner=2/);
    assert.equal(alerts[0]?.actionLabel, "查看 owner quota guardrail");
  });
});
