import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentExecutionCallbackBacklogGuidance,
  buildAgentExecutionCallbackBacklogPlaybook,
  buildAgentExecutionCallbackBacklogSummary,
  formatAgentExecutionCallbackBridgeActionTargetLabel,
  formatAgentExecutionCallbackHandoffProfileLabel,
  resolveAgentExecutionCallbackBridgePlan,
  resolveAgentExecutionCallbackHandoffProfile,
} from "./agent-execution-callback-guidance";

test("callback backlog summary counts replayable, inspect, and incompatible callbacks", () => {
  const summary = buildAgentExecutionCallbackBacklogSummary({
    callbacks: [
      {
        id: "callback-1",
        executionId: "exec-1",
        agentId: "agent-1",
        remediationPolicyKey: "balanced",
        callbackId: "cb-1",
        callbackType: "artifact",
        status: "rejected",
        callbackVersion: 2,
        secretVersion: 2,
        usedPreviousProtocol: false,
        usedPreviousSecret: false,
        callbackTimestamp: null,
        rejectionCategory: "invalid_payload",
        retryability: "inspect",
        retryHint: null,
        payloadSummary: null,
        replayPayloadStored: true,
        replayPayloadReplayable: false,
        replayPayloadCompatibility: "invalid",
        replayPayloadSchemaVersion: null,
        remediationPlan: {
          primaryAction: "skip",
          fallbackAction: null,
          decisionClass: "skip_incompatible_payload",
          reasonCategory: "missing_payload",
          reason: "invalid",
          trace: [],
        },
        autoRemediationAttempts: 0,
        lastAutoRemediationAt: null,
        nextAutoRemediationAt: null,
        autoRemediationExhaustedAt: null,
        autoRemediationLastError: null,
        autoRemediationState: "idle",
        autoRemediationReasonCategory: null,
        autoRemediationReasonDisposition: null,
        runtimeContext: null,
        receivedAt: "2026-03-26T12:00:00.000Z",
        remediationAttempts: [],
      },
      {
        id: "callback-2",
        executionId: "exec-2",
        agentId: "agent-1",
        remediationPolicyKey: "balanced",
        callbackId: "cb-2",
        callbackType: "status",
        status: "rejected",
        callbackVersion: 2,
        secretVersion: 2,
        usedPreviousProtocol: false,
        usedPreviousSecret: false,
        callbackTimestamp: null,
        rejectionCategory: "processing_conflict",
        retryability: "retryable",
        retryHint: null,
        payloadSummary: null,
        replayPayloadStored: true,
        replayPayloadReplayable: true,
        replayPayloadCompatibility: "current",
        replayPayloadSchemaVersion: 1,
        remediationPlan: {
          primaryAction: "replay_payload",
          fallbackAction: "request_retry",
          decisionClass: "replay_current_payload",
          reasonCategory: null,
          reason: "replay",
          trace: [],
        },
        autoRemediationAttempts: 1,
        lastAutoRemediationAt: null,
        nextAutoRemediationAt: null,
        autoRemediationExhaustedAt: null,
        autoRemediationLastError: null,
        autoRemediationState: "idle",
        autoRemediationReasonCategory: null,
        autoRemediationReasonDisposition: null,
        runtimeContext: null,
        receivedAt: "2026-03-26T12:05:00.000Z",
        remediationAttempts: [],
      },
    ],
  });

  assert.deepEqual(summary, {
    totalCount: 2,
    executionCount: 2,
    rejectedCount: 2,
    replayableRejectedCount: 1,
    retryableRejectedCount: 1,
    inspectRejectedCount: 1,
    invalidPayloadCount: 1,
    byDecisionClass: [
      { key: "replay_current_payload", count: 1 },
      { key: "skip_incompatible_payload", count: 1 },
    ],
    byReplayFailureClass: [],
    dominantDecisionClass: "replay_current_payload",
    dominantReplayFailureClass: null,
  });
});

test("callback backlog guidance prioritizes incompatible payload backlog", () => {
  const guidance = buildAgentExecutionCallbackBacklogGuidance({
    runtimeProfileLabel: "Iterative",
    summary: {
      totalCount: 3,
      executionCount: 2,
      rejectedCount: 2,
      replayableRejectedCount: 1,
      retryableRejectedCount: 1,
      inspectRejectedCount: 1,
      invalidPayloadCount: 1,
      byDecisionClass: [{ key: "skip_incompatible_payload", count: 1 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "skip_incompatible_payload",
      dominantReplayFailureClass: null,
    },
  });

  assert.ok(guidance);
  assert.equal(guidance.severity, "danger");
  assert.equal(guidance.actionKind, "inspect_incompatible_callbacks");
  assert.equal(guidance.preferredActionKind, "inspect");
});

test("callback backlog playbook prioritizes replayable callbacks before full backlog", () => {
  const playbook = buildAgentExecutionCallbackBacklogPlaybook({
    summary: {
      totalCount: 4,
      executionCount: 2,
      rejectedCount: 2,
      replayableRejectedCount: 2,
      retryableRejectedCount: 2,
      inspectRejectedCount: 0,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "replay_current_payload", count: 2 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "replay_current_payload",
      dominantReplayFailureClass: null,
    },
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["inspect_replayable_callbacks", "inspect_callback_backlog"],
  );
  assert.equal(playbook[0]?.priority, "primary");
  assert.equal(playbook[0]?.preferredActionKind, "auto_remediate");
});

test("callback backlog guidance prefers compat-window blocked slice before generic replay guidance", () => {
  const guidance = buildAgentExecutionCallbackBacklogGuidance({
    runtimeProfileLabel: "Deep Runtime",
    summary: {
      totalCount: 4,
      executionCount: 2,
      rejectedCount: 3,
      replayableRejectedCount: 1,
      retryableRejectedCount: 1,
      inspectRejectedCount: 0,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "retry_compat_window", count: 2 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "retry_compat_window",
      dominantReplayFailureClass: null,
    },
  });

  assert.ok(guidance);
  assert.equal(guidance.actionKind, "inspect_decision_slice");
  assert.equal(guidance.filterOverrides.decisionClass, "retry_compat_window");
  assert.equal(guidance.preferredActionKind, "inspect");
});

test("callback backlog playbook can prioritize replay failure hotspots", () => {
  const playbook = buildAgentExecutionCallbackBacklogPlaybook({
    summary: {
      totalCount: 3,
      executionCount: 2,
      rejectedCount: 2,
      replayableRejectedCount: 0,
      retryableRejectedCount: 1,
      inspectRejectedCount: 1,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "retry_policy_preferred", count: 2 }],
      byReplayFailureClass: [{ key: "callback_secret_unavailable", count: 2 }],
      dominantDecisionClass: "retry_policy_preferred",
      dominantReplayFailureClass: "callback_secret_unavailable",
    },
  });

  assert.deepEqual(
    playbook.map((step) => step.key),
    ["inspect_replay_failure_slice", "inspect_callback_backlog"],
  );
  assert.equal(playbook[0]?.preferredActionKind, "inspect");
  assert.equal(playbook[0]?.filterOverrides?.replayFailureClass, "callback_secret_unavailable");
});

test("callback backlog playbook surfaces retry-request batch guidance for retryable backlog", () => {
  const playbook = buildAgentExecutionCallbackBacklogPlaybook({
    summary: {
      totalCount: 5,
      executionCount: 3,
      rejectedCount: 4,
      replayableRejectedCount: 0,
      retryableRejectedCount: 3,
      inspectRejectedCount: 1,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "retry_policy_preferred", count: 3 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "retry_policy_preferred",
      dominantReplayFailureClass: null,
    },
  });

  assert.equal(playbook[0]?.preferredActionKind, "request_retry_batch");
  assert.equal(playbook[0]?.filterOverrides?.callbackRetryability, "retryable");
});

test("callback handoff profile resolves inspect vs operator action bridges", () => {
  assert.equal(
    resolveAgentExecutionCallbackHandoffProfile({
      preferredActionKind: "inspect",
      canUseOperatorActions: true,
    }),
    "inspect_only",
  );
  assert.equal(
    resolveAgentExecutionCallbackHandoffProfile({
      preferredActionKind: "auto_remediate",
      canUseOperatorActions: true,
    }),
    "operator_action_auto_remediate",
  );
  assert.equal(
    resolveAgentExecutionCallbackHandoffProfile({
      preferredActionKind: "request_retry_batch",
      canUseOperatorActions: true,
    }),
    "operator_action_retry_batch",
  );
  assert.equal(
    resolveAgentExecutionCallbackHandoffProfile({
      preferredActionKind: "request_retry_batch",
      canUseOperatorActions: false,
    }),
    "inspect_only",
  );
  assert.equal(formatAgentExecutionCallbackHandoffProfileLabel("inspect_only"), "inspect-only");
  assert.equal(
    formatAgentExecutionCallbackHandoffProfileLabel("operator_action_auto_remediate"),
    "ops-auto-remediate",
  );
  assert.equal(
    formatAgentExecutionCallbackHandoffProfileLabel("operator_action_retry_batch"),
    "ops-retry-batch",
  );
});

test("callback bridge plan can keep owner inspect primary while surfacing ops action", () => {
  const plan = resolveAgentExecutionCallbackBridgePlan({
    preferredActionKind: "auto_remediate",
    canUseOperatorActions: true,
    inspectActionKey: "inspect_replayable_callbacks",
  });

  assert.equal(plan.profile, "operator_action_auto_remediate");
  assert.equal(plan.primaryAction.target, "owner_local");
  assert.equal(plan.primaryAction.label, "打开 Replayable Backlog");
  assert.equal(plan.secondaryAction?.target, "ops_action");
  assert.equal(plan.secondaryAction?.label, "去 Ops 执行 Auto Remediation");
});

test("callback bridge plan can prioritize ops action for runtime escalation", () => {
  const plan = resolveAgentExecutionCallbackBridgePlan({
    preferredActionKind: "request_retry_batch",
    canUseOperatorActions: true,
    inspectActionKey: "inspect_callback_backlog",
    preferOperatorPrimary: true,
  });

  assert.equal(plan.profile, "operator_action_retry_batch");
  assert.equal(plan.primaryAction.target, "ops_action");
  assert.equal(plan.primaryAction.label, "去 Ops 批量记录 Retry Request");
  assert.equal(plan.secondaryAction?.target, "owner_local");
  assert.equal(plan.secondaryAction?.label, "打开 Callback Backlog");
  assert.equal(formatAgentExecutionCallbackBridgeActionTargetLabel(plan.primaryAction.target), "ops-bridge");
});
