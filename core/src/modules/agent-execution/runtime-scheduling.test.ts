import assert from "node:assert/strict";
import test from "node:test";

import { buildRuntimeProfileUtilizationView } from "./runtime-scheduling";

test("runtime utilization view recognizes profile and owner saturation", () => {
  const view = buildRuntimeProfileUtilizationView({
    key: "baseline",
    maxConcurrentExecutions: 3,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 3,
    queuedExecutionCount: 4,
    ownerRunningCounts: [
      { ownerUserId: "owner-a", runningExecutionCount: 2 },
      { ownerUserId: "owner-b", runningExecutionCount: 1 },
    ],
    queuedCandidates: [
      { ownerUserId: "owner-a" },
      { ownerUserId: "owner-b" },
      { ownerUserId: "owner-c" },
      { ownerUserId: "owner-a" },
    ],
  });

  assert.equal(view.pressureLevel, "critical");
  assert.equal(view.schedulingDecisionClass, "profile_and_owner_saturated");
  assert.equal(view.busiestOwnerUserId, "owner-a");
  assert.equal(view.saturatedOwnerCount, 1);
  assert.equal(view.blockedQueuedExecutionCount, 4);
  assert.equal(view.blockedByProfileCount, 4);
  assert.equal(view.blockedByOwnerCount, 0);
});

test("runtime utilization view recognizes queue backlog before saturation", () => {
  const view = buildRuntimeProfileUtilizationView({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 2,
    ownerRunningCounts: [
      { ownerUserId: "owner-a", runningExecutionCount: 1 },
      { ownerUserId: "owner-b", runningExecutionCount: 1 },
    ],
    queuedCandidates: [{ ownerUserId: "owner-a" }, { ownerUserId: "owner-c" }],
  });

  assert.equal(view.pressureLevel, "watch");
  assert.equal(view.schedulingDecisionClass, "queue_backlog");
  assert.equal(view.availableExecutionSlots, 2);
  assert.equal(view.claimableQueuedExecutionCount, 2);
  assert.equal(view.blockedQueuedExecutionCount, 0);
});

test("runtime utilization view recognizes healthy capacity", () => {
  const view = buildRuntimeProfileUtilizationView({
    key: "deep_runtime",
    maxConcurrentExecutions: 5,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 1,
    queuedExecutionCount: 0,
    ownerRunningCounts: [{ ownerUserId: "owner-a", runningExecutionCount: 1 }],
  });

  assert.equal(view.pressureLevel, "healthy");
  assert.equal(view.schedulingDecisionClass, "within_capacity");
  assert.equal(view.saturatedOwnerCount, 0);
});

test("runtime utilization view recognizes owner quota blocked queue", () => {
  const view = buildRuntimeProfileUtilizationView({
    key: "iterative",
    maxConcurrentExecutions: 5,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    ownerRunningCounts: [{ ownerUserId: "owner-a", runningExecutionCount: 2 }],
    queuedCandidates: [
      { ownerUserId: "owner-a" },
      { ownerUserId: "owner-b" },
      { ownerUserId: "owner-a" },
    ],
  });

  assert.equal(view.schedulingDecisionClass, "owner_hotspot");
  assert.equal(view.claimableQueuedExecutionCount, 1);
  assert.equal(view.blockedQueuedExecutionCount, 2);
  assert.equal(view.blockedByOwnerCount, 2);
  assert.equal(view.blockedByProfileCount, 0);
  assert.equal(view.blockedOwnerCount, 1);
  assert.equal(view.busiestBlockedOwnerUserId, "owner-a");
  assert.equal(view.busiestBlockedOwnerQueuedCount, 2);
});
