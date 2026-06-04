import test from "node:test";
import assert from "node:assert/strict";

import {
  canQuickLaunchAgentExecutionPreset,
  formatAgentExecutionLaunchPresetActivationSourceLabel,
  formatAgentExecutionLaunchPresetCallbackRejectionCategoryLabel,
  formatAgentExecutionLaunchPresetCallbackRetryabilityLabel,
  formatAgentExecutionLaunchPresetCallbackStatusLabel,
  formatAgentExecutionLaunchPresetCallbackTypeLabel,
  formatAgentExecutionLaunchPresetDecisionClassLabel,
  formatAgentExecutionLaunchPresetFailureCategoryLabel,
  formatAgentExecutionLaunchPresetFocusSectionLabel,
  formatAgentExecutionLaunchPresetRecentWindowLabel,
  formatAgentExecutionLaunchPresetReplayFailureClassLabel,
  formatAgentExecutionLaunchPresetReplayPayloadCompatibilityLabel,
  formatAgentExecutionLaunchPresetReplayPayloadReplayableLabel,
  formatAgentExecutionLaunchPresetPressureLevelLabel,
  formatAgentExecutionLaunchPresetRuntimeProfileLabel,
  formatAgentExecutionLaunchPresetRuntimeDecisionClassLabel,
  formatAgentExecutionLaunchPresetRuntimeDecisionSeverityLabel,
  formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionKindLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionStateLabel,
  formatAgentExecutionLaunchPresetRunKindLabel,
  formatAgentExecutionLaunchPresetRunStatusLabel,
  normalizeAgentExecutionLaunchPresetCallbackRetryability,
  normalizeAgentExecutionLaunchPresetCallbackRejectionCategory,
  normalizeAgentExecutionLaunchPresetCallbackStatus,
  normalizeAgentExecutionLaunchPresetCallbackType,
  normalizeAgentExecutionLaunchPresetDecisionClass,
  normalizeAgentExecutionLaunchPresetFailureCategory,
  normalizeAgentExecutionLaunchPresetFocusSection,
  normalizeAgentExecutionLaunchPresetRecentWindow,
  normalizeAgentExecutionLaunchPresetReplayFailureClass,
  normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility,
  normalizeAgentExecutionLaunchPresetReplayPayloadReplayable,
  normalizeAgentExecutionLaunchPresetPressureLevel,
  normalizeAgentExecutionLaunchPresetRuntimeProfileKey,
  normalizeAgentExecutionLaunchPresetRuntimeDecisionClass,
  normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity,
  normalizeAgentExecutionLaunchPresetSchedulingDecisionClass,
  normalizeAgentExecutionLaunchPresetRuntimeSessionKind,
  normalizeAgentExecutionLaunchPresetRuntimeSessionState,
  normalizeAgentExecutionLaunchPresetRunKind,
  normalizeAgentExecutionLaunchPresetRunStatus,
  resolveActiveAgentExecutionLaunchPreset,
  resolveActiveAgentExecutionLaunchPresetState,
  resolveAgentExecutionLaunchPresetFormDefaults,
  toAgentExecutionLaunchPresetFocusSectionFragment,
} from "./agent-execution-launch-presets";

test("resolveAgentExecutionLaunchPresetFormDefaults prefers selected preset defaults", () => {
  const defaults = resolveAgentExecutionLaunchPresetFormDefaults({
    ownedAgents: [
      { id: "agent-a", enabled: true },
      { id: "agent-b", enabled: true },
    ],
    selectedPreset: {
      preferredAgentId: "agent-b",
      runtimeProfileKey: "deep_runtime",
      callbackRemediationPolicyKey: "balanced",
      titleTemplate: "Deep review pass",
      objectiveTemplate: "Complete a deep runtime execution with full callback auditing.",
    },
  });

  assert.deepEqual(defaults, {
    agentId: "agent-b",
    runtimeProfileKey: "deep_runtime",
    callbackRemediationPolicyKey: "balanced",
    title: "Deep review pass",
    objective: "Complete a deep runtime execution with full callback auditing.",
  });
});

test("resolveActiveAgentExecutionLaunchPreset prefers explicit selection and otherwise falls back to default", () => {
  const presets = [
    { id: "preset-a", isDefault: false },
    { id: "preset-b", isDefault: true },
  ];

  assert.deepEqual(resolveActiveAgentExecutionLaunchPreset(presets, "preset-a"), presets[0]);
  assert.deepEqual(resolveActiveAgentExecutionLaunchPreset(presets, ""), presets[1]);
  assert.equal(resolveActiveAgentExecutionLaunchPreset(presets, "missing"), null);
});

test("resolveActiveAgentExecutionLaunchPresetState exposes activation source", () => {
  const presets = [
    { id: "preset-a", isDefault: false },
    { id: "preset-b", isDefault: true },
  ];

  assert.deepEqual(resolveActiveAgentExecutionLaunchPresetState(presets, "preset-a"), {
    preset: presets[0],
    source: "explicit",
  });
  assert.deepEqual(resolveActiveAgentExecutionLaunchPresetState(presets, ""), {
    preset: presets[1],
    source: "default",
  });
  assert.deepEqual(resolveActiveAgentExecutionLaunchPresetState(presets, "missing"), {
    preset: null,
    source: "explicit",
  });
  assert.equal(formatAgentExecutionLaunchPresetActivationSourceLabel("explicit"), "显式套用");
  assert.equal(formatAgentExecutionLaunchPresetActivationSourceLabel("default"), "默认激活");
  assert.equal(formatAgentExecutionLaunchPresetActivationSourceLabel(null), "未激活");
});

test("resolveAgentExecutionLaunchPresetFormDefaults falls back when preferred agent is unavailable", () => {
  const defaults = resolveAgentExecutionLaunchPresetFormDefaults({
    ownedAgents: [
      { id: "agent-a", enabled: true },
      { id: "agent-b", enabled: false },
    ],
    selectedPreset: {
      preferredAgentId: "agent-b",
      runtimeProfileKey: "iterative",
      callbackRemediationPolicyKey: null,
      titleTemplate: null,
      objectiveTemplate: null,
    },
  });

  assert.deepEqual(defaults, {
    agentId: "agent-a",
    runtimeProfileKey: "iterative",
    callbackRemediationPolicyKey: "inherit_agent",
    title: "",
    objective: "",
  });
});

test("canQuickLaunchAgentExecutionPreset requires enabled preferred agent and filled templates", () => {
  assert.equal(
    canQuickLaunchAgentExecutionPreset({
      ownedAgents: [{ id: "agent-a", enabled: true }],
      preset: {
        preferredAgentId: "agent-a",
        titleTemplate: "Quick launch",
        objectiveTemplate: "Use the preset to create a callback-governed execution.",
      },
    }),
    true,
  );

  assert.equal(
    canQuickLaunchAgentExecutionPreset({
      ownedAgents: [{ id: "agent-a", enabled: true }],
      preset: {
        preferredAgentId: "agent-a",
        titleTemplate: "Quick launch",
        objectiveTemplate: null,
      },
    }),
    false,
  );
});

test("launch preset focus-section helpers normalize labels and fragments", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetFocusSection("active-preset"), "active-preset");
  assert.equal(normalizeAgentExecutionLaunchPresetFocusSection("execution-list"), "execution-list");
  assert.equal(normalizeAgentExecutionLaunchPresetFocusSection("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetFocusSectionLabel("active-preset"), "Active Preset");
  assert.equal(formatAgentExecutionLaunchPresetFocusSectionLabel("create-execution"), "Create Execution");
  assert.equal(formatAgentExecutionLaunchPresetFocusSectionLabel(null), "不自动聚焦");
  assert.equal(toAgentExecutionLaunchPresetFocusSectionFragment("active-preset"), "section-active-preset");
  assert.equal(toAgentExecutionLaunchPresetFocusSectionFragment("runtime-sessions"), "section-runtime-sessions");
  assert.equal(toAgentExecutionLaunchPresetFocusSectionFragment(null), null);
});

test("launch preset runtime-profile helpers normalize and label runtime profiles", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeProfileKey("baseline"), "baseline");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeProfileKey("deep_runtime"), "deep_runtime");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeProfileKey("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetRuntimeProfileLabel("iterative"), "Iterative");
  assert.equal(formatAgentExecutionLaunchPresetRuntimeProfileLabel(null), "所有 Runtime Profile");
});

test("launch preset run-kind helpers normalize and label execution runs", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRunKind("callback_payload_replay"), "callback_payload_replay");
  assert.equal(normalizeAgentExecutionLaunchPresetRunKind("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetRunKindLabel("platform_executor"), "Platform Executor");
  assert.equal(formatAgentExecutionLaunchPresetRunKindLabel("callback_auto_remediation"), "Callback Auto Remediation");
  assert.equal(formatAgentExecutionLaunchPresetRunKindLabel(null), "不自动聚焦运行记录");
});

test("launch preset run-status helpers normalize and label execution run states", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRunStatus("running"), "running");
  assert.equal(normalizeAgentExecutionLaunchPresetRunStatus("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetRunStatusLabel("completed"), "Completed");
  assert.equal(formatAgentExecutionLaunchPresetRunStatusLabel("failed"), "Failed");
  assert.equal(formatAgentExecutionLaunchPresetRunStatusLabel(null), "不自动聚焦运行状态");
});

test("launch preset failure-category helpers normalize and label run failures", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetFailureCategory("executor_failure"), "executor_failure");
  assert.equal(normalizeAgentExecutionLaunchPresetFailureCategory("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetFailureCategoryLabel("stale_timeout"), "Stale Timeout");
  assert.equal(formatAgentExecutionLaunchPresetFailureCategoryLabel("unknown_failure"), "Unknown Failure");
  assert.equal(formatAgentExecutionLaunchPresetFailureCategoryLabel(null), "不自动聚焦失败分类");
});

test("launch preset recent-window helpers normalize and label run windows", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRecentWindow("15m"), "15m");
  assert.equal(normalizeAgentExecutionLaunchPresetRecentWindow("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetRecentWindowLabel("1h"), "Recent 1h");
  assert.equal(formatAgentExecutionLaunchPresetRecentWindowLabel("24h"), "Recent 24h");
  assert.equal(formatAgentExecutionLaunchPresetRecentWindowLabel(null), "不自动聚焦最近窗口");
});

test("launch preset callback-status helpers normalize and label callback states", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackStatus("accepted"), "accepted");
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackStatus("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetCallbackStatusLabel("duplicate"), "Callback Duplicate");
  assert.equal(formatAgentExecutionLaunchPresetCallbackStatusLabel(null), "不自动聚焦回调状态");
});

test("launch preset callback-retryability helpers normalize and label retryability", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackRetryability("retryable"), "retryable");
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackRetryability("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetCallbackRetryabilityLabel("not_retryable"),
    "Callback Not Retryable",
  );
  assert.equal(formatAgentExecutionLaunchPresetCallbackRetryabilityLabel(null), "不自动聚焦重试建议");
});

test("launch preset callback-type helpers normalize and label callback types", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackType("artifact"), "artifact");
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackType("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetCallbackTypeLabel("status"), "Callback Status");
  assert.equal(formatAgentExecutionLaunchPresetCallbackTypeLabel(null), "不自动聚焦回调类型");
});

test("launch preset callback-rejection helpers normalize and label rejection categories", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackRejectionCategory("invalid_payload"), "invalid_payload");
  assert.equal(normalizeAgentExecutionLaunchPresetCallbackRejectionCategory("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetCallbackRejectionCategoryLabel("processing_conflict"),
    "Reject Processing Conflict",
  );
  assert.equal(formatAgentExecutionLaunchPresetCallbackRejectionCategoryLabel(null), "不自动聚焦拒绝原因");
});

test("launch preset replay-payload compatibility helpers normalize and label compatibility", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility("current"), "current");
  assert.equal(normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetReplayPayloadCompatibilityLabel("legacy_normalized"),
    "Replay Legacy Normalized",
  );
  assert.equal(
    formatAgentExecutionLaunchPresetReplayPayloadCompatibilityLabel(null),
    "不自动聚焦 replay payload 兼容性",
  );
});

test("launch preset replay-payload replayable helpers normalize and label replayability", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetReplayPayloadReplayable("true"), true);
  assert.equal(normalizeAgentExecutionLaunchPresetReplayPayloadReplayable("false"), false);
  assert.equal(normalizeAgentExecutionLaunchPresetReplayPayloadReplayable("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetReplayPayloadReplayableLabel(true), "Replay Replayable");
  assert.equal(formatAgentExecutionLaunchPresetReplayPayloadReplayableLabel(false), "Replay Not Replayable");
  assert.equal(
    formatAgentExecutionLaunchPresetReplayPayloadReplayableLabel(null),
    "不自动聚焦 replay payload 可重放性",
  );
});

test("launch preset decision-class helpers normalize and label remediation decisions", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetDecisionClass("retry_compat_window"), "retry_compat_window");
  assert.equal(normalizeAgentExecutionLaunchPresetDecisionClass("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetDecisionClassLabel("replay_current_payload"),
    "Decision Replay Current Payload",
  );
  assert.equal(formatAgentExecutionLaunchPresetDecisionClassLabel(null), "不自动聚焦 remediation decision");
});

test("launch preset replay-failure helpers normalize and label replay failures", () => {
  assert.equal(
    normalizeAgentExecutionLaunchPresetReplayFailureClass("callback_secret_unavailable"),
    "callback_secret_unavailable",
  );
  assert.equal(normalizeAgentExecutionLaunchPresetReplayFailureClass("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetReplayFailureClassLabel("duplicate_replay_cooldown"),
    "Replay Failure Duplicate Cooldown",
  );
  assert.equal(formatAgentExecutionLaunchPresetReplayFailureClassLabel(null), "不自动聚焦 replay failure");
});

test("launch preset runtime-decision helpers normalize and label runtime decisions", () => {
  assert.equal(
    normalizeAgentExecutionLaunchPresetRuntimeDecisionClass("artifact_finalize_early_timeout"),
    "artifact_finalize_early_timeout",
  );
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeDecisionClass("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetRuntimeDecisionClassLabel("finalize_completed"),
    "Runtime Decision Finalize Completed",
  );
  assert.equal(formatAgentExecutionLaunchPresetRuntimeDecisionClassLabel(null), "不自动聚焦 runtime decision");
});

test("launch preset runtime-decision severity helpers normalize and label severity", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity("warning"), "warning");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetRuntimeDecisionSeverityLabel("critical"),
    "Runtime Decision Critical",
  );
  assert.equal(
    formatAgentExecutionLaunchPresetRuntimeDecisionSeverityLabel(null),
    "不自动聚焦 runtime severity",
  );
});

test("launch preset runtime-pressure helpers normalize and label pressure", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetPressureLevel("watch"), "watch");
  assert.equal(normalizeAgentExecutionLaunchPresetPressureLevel("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetPressureLevelLabel("critical"), "Pressure Critical");
  assert.equal(formatAgentExecutionLaunchPresetPressureLevelLabel(null), "不自动聚焦运行压力级别");
});

test("launch preset scheduling-decision helpers normalize and label runtime scheduling", () => {
  assert.equal(
    normalizeAgentExecutionLaunchPresetSchedulingDecisionClass("profile_and_owner_saturated"),
    "profile_and_owner_saturated",
  );
  assert.equal(normalizeAgentExecutionLaunchPresetSchedulingDecisionClass("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel("owner_hotspot"),
    "Scheduling Owner Hotspot",
  );
  assert.equal(
    formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(null),
    "不自动聚焦调度决策",
  );
});

test("launch preset runtime-session-kind helpers normalize and label runtime kinds", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionKind("platform_executor"), "platform_executor");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionKind("owner_requeue"), "owner_requeue");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionKind("missing"), null);
  assert.equal(
    formatAgentExecutionLaunchPresetRuntimeSessionKindLabel("stale_recovery"),
    "Runtime Stale Recovery",
  );
  assert.equal(formatAgentExecutionLaunchPresetRuntimeSessionKindLabel(null), "不自动聚焦运行会话类型");
});

test("launch preset runtime-session helpers normalize and label runtime session states", () => {
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionState("running"), "running");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionState("requeued"), "requeued");
  assert.equal(normalizeAgentExecutionLaunchPresetRuntimeSessionState("missing"), null);
  assert.equal(formatAgentExecutionLaunchPresetRuntimeSessionStateLabel("completed"), "Runtime Completed");
  assert.equal(formatAgentExecutionLaunchPresetRuntimeSessionStateLabel("failed"), "Runtime Failed");
  assert.equal(formatAgentExecutionLaunchPresetRuntimeSessionStateLabel(null), "不自动聚焦运行会话状态");
});
