import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentExecutionRuntimePressureGuidance,
  buildAgentExecutionRuntimePressurePlaybook,
  formatAgentExecutionRuntimeBridgeActionTargetLabel,
  formatAgentExecutionRuntimePlaybookStepActionLabel,
  formatAgentExecutionRuntimeIncidentLifecycleDispositionLabel,
  formatAgentExecutionRuntimePressureGuidanceActionKindLabel,
  resolveAgentExecutionRuntimeBridgePlan,
  resolveAgentExecutionRuntimeGuidanceBridgePlan,
  resolveAgentExecutionRuntimePressureGuidanceStepKey,
  resolveAgentExecutionRuntimeIncidentLifecycleDisposition,
  resolveAgentExecutionRuntimeIncidentFollowUpTarget,
  resolveAgentExecutionRuntimeIncidentFocusState,
} from "./agent-execution-runtime-guidance";
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

test("runtime pressure guidance marks saturated presets as danger and suggests a lower profile", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "deep_runtime",
    runtimeProfileLabel: "Deep Runtime",
    utilization: makeRuntimeUtilization({
      key: "deep_runtime",
      maxConcurrentExecutions: 3,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 3,
      queuedExecutionCount: 4,
      availableExecutionSlots: 0,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "critical",
      schedulingDecisionClass: "profile_and_owner_saturated",
      pressureDetail: "Deep runtime is saturated.",
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.severity, "danger");
  assert.equal(guidance.actionKind, "adjust_launch_preset");
  assert.equal(guidance.suggestedRuntimeProfileKey, "iterative");
});

test("runtime pressure guidance points owner hotspots at runtime sessions", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization: makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 0,
      availableExecutionSlots: 2,
      busiestOwnerUserId: "owner-b",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "watch",
      schedulingDecisionClass: "owner_hotspot",
      pressureDetail: "Owner-level concurrency is hot.",
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.severity, "warning");
  assert.equal(guidance.actionKind, "inspect_runtime_sessions");
  assert.equal(guidance.suggestedRuntimeProfileKey, null);
});

test("runtime pressure guidance escalates owner quota blocked queue to execution backlog", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization: makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 3,
      claimableQueuedExecutionCount: 1,
      blockedQueuedExecutionCount: 2,
      blockedByProfileCount: 0,
      blockedByOwnerCount: 2,
      blockedOwnerCount: 1,
      busiestBlockedOwnerUserId: "owner-b",
      busiestBlockedOwnerQueuedCount: 2,
      availableExecutionSlots: 2,
      busiestOwnerUserId: "owner-b",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "watch",
      schedulingDecisionClass: "owner_hotspot",
      pressureDetail: "Owner-level concurrency is hot.",
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.severity, "danger");
  assert.equal(guidance.actionKind, "inspect_owner_guardrail");
  assert.equal(guidance.ownerGuardrailUserId, "owner-b");
  assert.match(guidance.title, /owner quota/);
});

test("runtime pressure guidance keeps healthy presets launchable", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "baseline",
    runtimeProfileLabel: "Baseline",
    utilization: makeRuntimeUtilization({
      key: "baseline",
      maxConcurrentExecutions: 5,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 1,
      queuedExecutionCount: 0,
      availableExecutionSlots: 4,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 1,
      saturatedOwnerCount: 0,
      pressureLevel: "healthy",
      schedulingDecisionClass: "within_capacity",
      pressureDetail: "Baseline remains healthy.",
    }),
  });

  assert.ok(guidance);
  assert.equal(guidance.severity, "info");
  assert.equal(guidance.actionKind, "launch_now");
  assert.equal(guidance.suggestedRuntimeProfileKey, null);
});

test("runtime pressure playbook prioritizes preset downgrade and backlog inspection for saturation", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "deep_runtime",
    runtimeProfileLabel: "Deep Runtime",
    utilization: makeRuntimeUtilization({
      key: "deep_runtime",
      maxConcurrentExecutions: 3,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 3,
      queuedExecutionCount: 4,
      availableExecutionSlots: 0,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "critical",
      schedulingDecisionClass: "profile_and_owner_saturated",
      pressureDetail: "Deep runtime is saturated.",
    }),
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Deep Runtime",
    guidance,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["adjust_launch_preset", "inspect_execution_backlog", "inspect_runtime_sessions"],
  );
  assert.equal(playbook[0]?.priority, "primary");
});

test("runtime pressure playbook points owner hotspots at runtime sessions first", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization: makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 0,
      availableExecutionSlots: 2,
      busiestOwnerUserId: "owner-b",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "watch",
      schedulingDecisionClass: "owner_hotspot",
      pressureDetail: "Owner-level concurrency is hot.",
    }),
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["inspect_runtime_sessions", "inspect_execution_backlog", "inspect_cost_overview"],
  );
  assert.equal(playbook[0]?.priority, "primary");
});

test("runtime pressure playbook prioritizes queued backlog when owner quota blocks the queue", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "watch",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["inspect_execution_backlog", "inspect_runtime_sessions", "inspect_cost_overview"],
  );
  assert.equal(playbook[0]?.priority, "primary");
});

test("runtime pressure playbook keeps healthy presets launch-first", () => {
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "baseline",
    runtimeProfileLabel: "Baseline",
    utilization: makeRuntimeUtilization({
      key: "baseline",
      maxConcurrentExecutions: 5,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 1,
      queuedExecutionCount: 0,
      availableExecutionSlots: 4,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 1,
      saturatedOwnerCount: 0,
      pressureLevel: "healthy",
      schedulingDecisionClass: "within_capacity",
      pressureDetail: "Baseline remains healthy.",
    }),
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Baseline",
    guidance,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["launch_execution", "inspect_execution_backlog"],
  );
});

test("runtime pressure playbook adds callback backlog follow-up when preset defines callback slices", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 1,
    availableExecutionSlots: 1,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "watch",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    hasCallbackFollowUp: true,
    utilization,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_runtime_sessions",
      "inspect_execution_backlog",
      "inspect_cost_overview",
      "inspect_callback_backlog",
    ],
  );
  assert.equal(playbook.at(-1)?.priority, "secondary");
});

test("runtime pressure playbook can append alert dispatch when alert coverage is still missing", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: false,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "emit_runtime_alerts",
    ],
  );
});

test("runtime pressure playbook can append runtime incident inspection when coverage already exists", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: true,
    incidentCoverageCount: 2,
    activeIncidentCount: 1,
    silencedIncidentCount: 1,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "inspect_runtime_incidents",
      "acknowledge_runtime_incidents",
      "clear_runtime_incident_silence",
    ],
  );
});

test("runtime pressure playbook can suggest silencing duplicate active runtime incidents", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: true,
    incidentCoverageCount: 3,
    activeIncidentCount: 3,
    silencedIncidentCount: 0,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "inspect_runtime_incidents",
      "acknowledge_runtime_incidents",
      "silence_runtime_incidents",
    ],
  );
});

test("runtime pressure playbook can suggest silencing acknowledged runtime incidents when active coverage is already handled", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: true,
    incidentCoverageCount: 2,
    activeIncidentCount: 0,
    acknowledgedIncidentCount: 2,
    silencedIncidentCount: 0,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_runtime_incidents",
      "handoff_runtime_incidents",
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "inspect_runtime_incident_follow_up",
      "silence_runtime_incidents",
    ],
  );
  assert.equal(playbook[0]?.priority, "primary");
  assert.equal(playbook[1]?.followUpTarget, "runtime_sessions");
});

test("runtime pressure playbook keeps acknowledged-only slices in observe mode before duplicate pile-up", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: true,
    incidentCoverageCount: 1,
    activeIncidentCount: 0,
    acknowledgedIncidentCount: 1,
    silencedIncidentCount: 0,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "inspect_runtime_incidents",
      "observe_runtime_incidents",
      "handoff_runtime_incidents",
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "inspect_runtime_incident_follow_up",
    ],
  );
  assert.equal(playbook[0]?.priority, "primary");
  assert.equal(playbook[2]?.followUpTarget, "runtime_sessions");
});

test("runtime pressure playbook prioritizes clear-silence when the slice is already silenced", () => {
  const utilization = makeRuntimeUtilization({
    key: "iterative",
    maxConcurrentExecutions: 4,
    maxConcurrentExecutionsPerOwner: 2,
    runningExecutionCount: 2,
    queuedExecutionCount: 3,
    claimableQueuedExecutionCount: 1,
    blockedQueuedExecutionCount: 2,
    blockedByProfileCount: 0,
    blockedByOwnerCount: 2,
    blockedOwnerCount: 1,
    busiestBlockedOwnerUserId: "owner-b",
    busiestBlockedOwnerQueuedCount: 2,
    availableExecutionSlots: 2,
    busiestOwnerUserId: "owner-b",
    busiestOwnerRunningCount: 2,
    saturatedOwnerCount: 1,
    pressureLevel: "critical",
    schedulingDecisionClass: "owner_hotspot",
    pressureDetail: "Owner-level concurrency is hot.",
  });
  const guidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization,
  });

  const playbook = buildAgentExecutionRuntimePressurePlaybook({
    runtimeProfileLabel: "Iterative",
    guidance,
    utilization,
    includeAlertDispatch: true,
    matchedAlertLevel: 3,
    hasIncidentCoverage: true,
    incidentCoverageCount: 1,
    activeIncidentCount: 0,
    acknowledgedIncidentCount: 0,
    silencedIncidentCount: 1,
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    [
      "clear_runtime_incident_silence",
      "inspect_runtime_incidents",
      "handoff_runtime_incidents",
      "inspect_execution_backlog",
      "inspect_runtime_sessions",
      "inspect_cost_overview",
      "inspect_runtime_incident_follow_up",
    ],
  );
  assert.equal(playbook[0]?.priority, "primary");
  assert.equal(playbook[2]?.followUpTarget, "runtime_sessions");
});

test("runtime incident focus-state helper prioritizes active, then acknowledged, then silenced slices", () => {
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFocusState({
      activeIncidentCount: 2,
      acknowledgedIncidentCount: 1,
      silencedIncidentCount: 1,
    }),
    "active",
  );
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFocusState({
      activeIncidentCount: 0,
      acknowledgedIncidentCount: 1,
      silencedIncidentCount: 2,
    }),
    "acknowledged",
  );
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFocusState({
      activeIncidentCount: 0,
      acknowledgedIncidentCount: 0,
      silencedIncidentCount: 2,
    }),
    "silenced",
  );
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFocusState({
      activeIncidentCount: 0,
      acknowledgedIncidentCount: 0,
      silencedIncidentCount: 0,
    }),
    null,
  );
});

test("runtime incident follow-up target prefers sessions, then backlog, then callback backlog", () => {
  const hotspotGuidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization: makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 0,
      availableExecutionSlots: 2,
      busiestOwnerUserId: "owner-b",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "watch",
      schedulingDecisionClass: "owner_hotspot",
      pressureDetail: "Owner-level concurrency is hot.",
    }),
  });
  assert.ok(hotspotGuidance);
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFollowUpTarget({
      guidance: hotspotGuidance,
      utilization: makeRuntimeUtilization({
        key: "iterative",
        maxConcurrentExecutions: 4,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 2,
        queuedExecutionCount: 0,
        availableExecutionSlots: 2,
        busiestOwnerUserId: "owner-b",
        busiestOwnerRunningCount: 2,
        saturatedOwnerCount: 1,
        pressureLevel: "watch",
        schedulingDecisionClass: "owner_hotspot",
        pressureDetail: "Owner-level concurrency is hot.",
      }),
    }),
    "runtime_sessions",
  );

  const backlogGuidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "baseline",
    runtimeProfileLabel: "Baseline",
    utilization: makeRuntimeUtilization({
      key: "baseline",
      maxConcurrentExecutions: 5,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 1,
      queuedExecutionCount: 2,
      blockedQueuedExecutionCount: 2,
      blockedByProfileCount: 1,
      availableExecutionSlots: 1,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 1,
      saturatedOwnerCount: 0,
      pressureLevel: "watch",
      schedulingDecisionClass: "queue_backlog",
      pressureDetail: "Baseline has queued backlog.",
    }),
  });
  assert.ok(backlogGuidance);
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFollowUpTarget({
      guidance: backlogGuidance,
      utilization: makeRuntimeUtilization({
        key: "baseline",
        maxConcurrentExecutions: 5,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 1,
        queuedExecutionCount: 2,
        blockedQueuedExecutionCount: 2,
        blockedByProfileCount: 1,
        availableExecutionSlots: 1,
        busiestOwnerUserId: "owner-a",
        busiestOwnerRunningCount: 1,
        saturatedOwnerCount: 0,
        pressureLevel: "watch",
        schedulingDecisionClass: "queue_backlog",
        pressureDetail: "Baseline has queued backlog.",
      }),
    }),
    "execution_backlog",
  );

  const healthyGuidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "baseline",
    runtimeProfileLabel: "Baseline",
    utilization: makeRuntimeUtilization({
      key: "baseline",
      maxConcurrentExecutions: 5,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 1,
      queuedExecutionCount: 0,
      availableExecutionSlots: 4,
      busiestOwnerUserId: "owner-a",
      busiestOwnerRunningCount: 1,
      saturatedOwnerCount: 0,
      pressureLevel: "healthy",
      schedulingDecisionClass: "within_capacity",
      pressureDetail: "Baseline remains healthy.",
    }),
  });
  assert.ok(healthyGuidance);
  assert.equal(
    resolveAgentExecutionRuntimeIncidentFollowUpTarget({
      guidance: healthyGuidance,
      hasCallbackFollowUp: true,
      utilization: makeRuntimeUtilization({
        key: "baseline",
        maxConcurrentExecutions: 5,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 1,
        queuedExecutionCount: 0,
        availableExecutionSlots: 4,
        busiestOwnerUserId: "owner-a",
        busiestOwnerRunningCount: 1,
        saturatedOwnerCount: 0,
        pressureLevel: "healthy",
        schedulingDecisionClass: "within_capacity",
        pressureDetail: "Baseline remains healthy.",
      }),
    }),
    "callback_backlog",
  );
});

test("runtime incident lifecycle disposition escalates acknowledged or silenced hotspots when backlog pressure remains high", () => {
  const backlogGuidance = buildAgentExecutionRuntimePressureGuidance({
    runtimeProfileKey: "iterative",
    runtimeProfileLabel: "Iterative",
    utilization: makeRuntimeUtilization({
      key: "iterative",
      maxConcurrentExecutions: 4,
      maxConcurrentExecutionsPerOwner: 2,
      runningExecutionCount: 2,
      queuedExecutionCount: 3,
      blockedQueuedExecutionCount: 2,
      blockedByProfileCount: 1,
      availableExecutionSlots: 0,
      busiestOwnerUserId: "owner-b",
      busiestOwnerRunningCount: 2,
      saturatedOwnerCount: 1,
      pressureLevel: "critical",
      schedulingDecisionClass: "queue_backlog",
      pressureDetail: "Queue backlog remains hot.",
    }),
  });
  assert.ok(backlogGuidance);

  assert.equal(
    resolveAgentExecutionRuntimeIncidentLifecycleDisposition({
      focusIncidentState: "acknowledged",
      acknowledgedIncidentCount: 3,
      silencedIncidentCount: 0,
      matchedAlertLevel: 3,
      followUpTarget: "execution_backlog",
      guidance: backlogGuidance,
      utilization: makeRuntimeUtilization({
        key: "iterative",
        maxConcurrentExecutions: 4,
        maxConcurrentExecutionsPerOwner: 2,
        runningExecutionCount: 2,
        queuedExecutionCount: 3,
        blockedQueuedExecutionCount: 2,
        blockedByProfileCount: 1,
        availableExecutionSlots: 0,
        busiestOwnerUserId: "owner-b",
        busiestOwnerRunningCount: 2,
        saturatedOwnerCount: 1,
        pressureLevel: "critical",
        schedulingDecisionClass: "queue_backlog",
        pressureDetail: "Queue backlog remains hot.",
      }),
    }),
    "escalate",
  );

  assert.equal(
    resolveAgentExecutionRuntimeIncidentLifecycleDisposition({
      focusIncidentState: "acknowledged",
      acknowledgedIncidentCount: 1,
      silencedIncidentCount: 0,
      matchedAlertLevel: 2,
      followUpTarget: "runtime_sessions",
      guidance: backlogGuidance,
      utilization: null,
    }),
    "handoff",
  );

  assert.equal(
    resolveAgentExecutionRuntimeIncidentLifecycleDisposition({
      focusIncidentState: "silenced",
      acknowledgedIncidentCount: 0,
      silencedIncidentCount: 2,
      matchedAlertLevel: 2,
      followUpTarget: "cost_overview",
      guidance: backlogGuidance,
      utilization: null,
    }),
    "escalate",
  );
});

test("runtime guidance label helpers stay stable across owner and operator surfaces", () => {
  assert.equal(formatAgentExecutionRuntimePressureGuidanceActionKindLabel("adjust_launch_preset"), "preset");
  assert.equal(formatAgentExecutionRuntimePressureGuidanceActionKindLabel("inspect_execution_backlog"), "backlog");
  assert.equal(formatAgentExecutionRuntimePressureGuidanceActionKindLabel("inspect_owner_guardrail"), "quota");
  assert.equal(resolveAgentExecutionRuntimePressureGuidanceStepKey("launch_now"), "launch_execution");
  assert.equal(
    resolveAgentExecutionRuntimePressureGuidanceStepKey("inspect_owner_guardrail"),
    "inspect_execution_backlog",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "adjust_launch_preset",
      suggestedRuntimeProfileLabel: "Iterative",
    }),
    "切换到 Iterative",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "inspect_callback_backlog",
    }),
    "打开 Callback Backlog",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "emit_runtime_alerts",
    }),
    "派发 Runtime Alerts",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "inspect_runtime_incidents",
    }),
    "打开 Runtime Incidents",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "observe_runtime_incidents",
    }),
    "继续观察 Runtime Incidents",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "inspect_runtime_incident_follow_up",
      incidentFollowUpTarget: "runtime_sessions",
    }),
    "转到 Runtime Sessions",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "handoff_runtime_incidents",
      incidentFollowUpTarget: "callback_backlog",
      incidentLifecycleDisposition: "escalate",
    }),
    "升级到 Callback Backlog",
  );
  assert.equal(formatAgentExecutionRuntimeIncidentLifecycleDispositionLabel("observe"), "observe");
  assert.equal(formatAgentExecutionRuntimeIncidentLifecycleDispositionLabel("handoff"), "handoff");
  assert.equal(formatAgentExecutionRuntimeIncidentLifecycleDispositionLabel("escalate"), "escalate");
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "acknowledge_runtime_incidents",
    }),
    "确认 Runtime Incidents",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "silence_runtime_incidents",
    }),
    "静默 Runtime Incidents",
  );
  assert.equal(
    formatAgentExecutionRuntimePlaybookStepActionLabel({
      stepKey: "clear_runtime_incident_silence",
    }),
    "解除 Incident 静默",
  );
});

test("runtime guidance bridge plan maps guidance actions onto the shared runtime bridge model", () => {
  const launchPlan = resolveAgentExecutionRuntimeGuidanceBridgePlan({
    actionKind: "launch_now",
  });
  assert.equal(launchPlan.primaryAction.target, "owner_bridge");
  assert.equal(launchPlan.primaryAction.destination, "launch_execution");

  const guardrailPlan = resolveAgentExecutionRuntimeGuidanceBridgePlan({
    actionKind: "inspect_owner_guardrail",
  });
  assert.equal(guardrailPlan.primaryAction.target, "owner_bridge");
  assert.equal(guardrailPlan.primaryAction.destination, "execution_backlog");
});

test("runtime bridge plan can prioritize ops actions while keeping a slice fallback", () => {
  const plan = resolveAgentExecutionRuntimeBridgePlan({
    stepKey: "emit_runtime_alerts",
  });

  assert.equal(plan.primaryAction.target, "ops_action");
  assert.equal(plan.primaryAction.destination, "runtime_pressure");
  assert.equal(plan.primaryAction.label, "派发 Runtime Alerts");
  assert.equal(plan.secondaryAction?.target, "ops_slice");
  assert.equal(plan.secondaryAction?.destination, "runtime_pressure");
  assert.equal(plan.secondaryAction?.label, "回到 Runtime Pressure");
});

test("runtime bridge plan can model incident handoff as slice primary plus incident fallback", () => {
  const plan = resolveAgentExecutionRuntimeBridgePlan({
    stepKey: "handoff_runtime_incidents",
    incidentFollowUpTarget: "callback_backlog",
    incidentLifecycleDisposition: "escalate",
  });

  assert.equal(plan.primaryAction.target, "ops_slice");
  assert.equal(plan.primaryAction.destination, "callback_backlog");
  assert.equal(plan.primaryAction.label, "升级到 Callback Backlog");
  assert.equal(plan.secondaryAction?.target, "ops_slice");
  assert.equal(plan.secondaryAction?.destination, "runtime_incidents");
  assert.equal(plan.secondaryAction?.label, "回看 Runtime Incidents");
  assert.equal(formatAgentExecutionRuntimeBridgeActionTargetLabel(plan.primaryAction.target), "ops-slice");
});
