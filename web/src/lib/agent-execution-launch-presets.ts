import type {
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackRetryability,
  AgentExecutionCallbackType,
  AgentExecutionLaunchPresetFocusSection,
  AgentExecutionRecentWindowKey,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionRunFailureCategory,
  AgentExecutionRunKind,
  AgentExecutionRunStatus,
  AgentExecutionLaunchPresetView,
  AgentExecutionRuntimeSessionKind,
  AgentExecutionRuntimeSessionState,
  AgentExecutionRuntimeProfileKey,
} from "@neuro/contracts";

type LaunchPresetAgentCarrier = {
  id: string;
  enabled: boolean;
};

export type AgentExecutionLaunchPresetFormDefaults = {
  agentId: string;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey | "inherit_agent";
  title: string;
  objective: string;
};

export type AgentExecutionLaunchPresetActivationSource = "explicit" | "default";

export const agentExecutionLaunchPresetRuntimeProfileOptions: Array<{
  value: AgentExecutionRuntimeProfileKey;
  label: string;
}> = [
  { value: "baseline", label: "Baseline" },
  { value: "iterative", label: "Iterative" },
  { value: "deep_runtime", label: "Deep Runtime" },
];

export const agentExecutionLaunchPresetFocusSectionOptions: Array<{
  value: AgentExecutionLaunchPresetFocusSection;
  label: string;
}> = [
  { value: "active-preset", label: "Active Preset" },
  { value: "launch-presets", label: "Launch Presets" },
  { value: "create-execution", label: "Create Execution" },
  { value: "runtime-sessions", label: "Runtime Sessions" },
  { value: "cost-overview", label: "Cost Overview" },
  { value: "execution-list", label: "Execution List" },
];

export const agentExecutionLaunchPresetRunKindOptions: Array<{
  value: AgentExecutionRunKind;
  label: string;
}> = [
  { value: "platform_executor", label: "Platform Executor" },
  { value: "requeue", label: "Requeue" },
  { value: "recovery", label: "Recovery" },
  { value: "callback_retry_request", label: "Callback Retry Request" },
  { value: "callback_payload_replay", label: "Callback Payload Replay" },
  { value: "callback_auto_remediation", label: "Callback Auto Remediation" },
];

export const agentExecutionLaunchPresetRunStatusOptions: Array<{
  value: AgentExecutionRunStatus;
  label: string;
}> = [
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export const agentExecutionLaunchPresetFailureCategoryOptions: Array<{
  value: AgentExecutionRunFailureCategory;
  label: string;
}> = [
  { value: "stale_timeout", label: "Stale Timeout" },
  { value: "executor_failure", label: "Executor Failure" },
  { value: "requeue_failure", label: "Requeue Failure" },
  { value: "unknown_failure", label: "Unknown Failure" },
];

export const agentExecutionLaunchPresetRecentWindowOptions: Array<{
  value: AgentExecutionRecentWindowKey;
  label: string;
}> = [
  { value: "15m", label: "Recent 15m" },
  { value: "1h", label: "Recent 1h" },
  { value: "24h", label: "Recent 24h" },
];

export const agentExecutionLaunchPresetCallbackStatusOptions: Array<{
  value: AgentExecutionCallbackAuditStatus;
  label: string;
}> = [
  { value: "accepted", label: "Callback Accepted" },
  { value: "duplicate", label: "Callback Duplicate" },
  { value: "rejected", label: "Callback Rejected" },
];

export const agentExecutionLaunchPresetCallbackRetryabilityOptions: Array<{
  value: AgentExecutionCallbackRetryability;
  label: string;
}> = [
  { value: "retryable", label: "Callback Retryable" },
  { value: "inspect", label: "Callback Inspect" },
  { value: "not_retryable", label: "Callback Not Retryable" },
];

export const agentExecutionLaunchPresetCallbackTypeOptions: Array<{
  value: AgentExecutionCallbackType;
  label: string;
}> = [
  { value: "heartbeat", label: "Callback Heartbeat" },
  { value: "status", label: "Callback Status" },
  { value: "artifact", label: "Callback Artifact" },
  { value: "callback", label: "Callback Generic" },
];

export const agentExecutionLaunchPresetCallbackRejectionCategoryOptions: Array<{
  value: AgentExecutionCallbackRejectionCategory;
  label: string;
}> = [
  { value: "invalid_secret", label: "Reject Invalid Secret" },
  { value: "invalid_signature", label: "Reject Invalid Signature" },
  { value: "invalid_timestamp", label: "Reject Invalid Timestamp" },
  { value: "invalid_version", label: "Reject Invalid Version" },
  { value: "invalid_payload", label: "Reject Invalid Payload" },
  { value: "processing_conflict", label: "Reject Processing Conflict" },
  { value: "unsupported_target", label: "Reject Unsupported Target" },
  { value: "unknown", label: "Reject Unknown" },
];

export const agentExecutionLaunchPresetReplayPayloadCompatibilityOptions: Array<{
  value: AgentExecutionStoredReplayPayloadCompatibility;
  label: string;
}> = [
  { value: "current", label: "Replay Current Payload" },
  { value: "legacy_normalized", label: "Replay Legacy Normalized" },
  { value: "invalid", label: "Replay Invalid Payload" },
];

export const agentExecutionLaunchPresetReplayPayloadReplayableOptions: Array<{
  value: "true" | "false";
  label: string;
}> = [
  { value: "true", label: "Replay Replayable" },
  { value: "false", label: "Replay Not Replayable" },
];

export const agentExecutionLaunchPresetDecisionClassOptions: Array<{
  value: AgentExecutionCallbackRemediationDecisionClass;
  label: string;
}> = [
  { value: "replay_current_payload", label: "Decision Replay Current Payload" },
  { value: "replay_legacy_payload", label: "Decision Replay Legacy Payload" },
  { value: "retry_missing_payload", label: "Decision Retry Missing Payload" },
  { value: "retry_incompatible_payload", label: "Decision Retry Incompatible Payload" },
  { value: "retry_compatibility_policy", label: "Decision Retry Compatibility Policy" },
  { value: "retry_compat_window", label: "Decision Retry Compat Window" },
  { value: "retry_policy_preferred", label: "Decision Retry Policy Preferred" },
  { value: "skip_policy_disabled", label: "Decision Skip Policy Disabled" },
  { value: "skip_missing_rejection_category", label: "Decision Skip Missing Rejection Category" },
  { value: "skip_policy_budget_exhausted", label: "Decision Skip Budget Exhausted" },
  { value: "skip_missing_payload", label: "Decision Skip Missing Payload" },
  { value: "skip_incompatible_payload", label: "Decision Skip Incompatible Payload" },
  { value: "skip_compatibility_policy", label: "Decision Skip Compatibility Policy" },
  { value: "skip_compat_window", label: "Decision Skip Compat Window" },
  { value: "skip_policy_not_covered", label: "Decision Skip Policy Not Covered" },
  { value: "skip_target_unavailable", label: "Decision Skip Target Unavailable" },
];

export const agentExecutionLaunchPresetReplayFailureClassOptions: Array<{
  value: AgentExecutionCallbackReplayFailureClass;
  label: string;
}> = [
  { value: "stored_payload_unavailable", label: "Replay Failure Stored Payload Unavailable" },
  { value: "callback_secret_unavailable", label: "Replay Failure Secret Unavailable" },
  { value: "duplicate_replay_cooldown", label: "Replay Failure Duplicate Cooldown" },
  { value: "agent_disabled", label: "Replay Failure Agent Disabled" },
  { value: "callback_not_retryable", label: "Replay Failure Callback Not Retryable" },
  { value: "unsupported_target", label: "Replay Failure Unsupported Target" },
  { value: "callback_protocol_mismatch", label: "Replay Failure Protocol Mismatch" },
];

export const agentExecutionLaunchPresetRuntimeDecisionClassOptions: Array<{
  value: AgentExecutionRuntimeDecisionClass;
  label: string;
}> = [
  { value: "prepare_continue", label: "Runtime Decision Prepare Continue" },
  { value: "prepare_near_limit_cap", label: "Runtime Decision Prepare Near-Limit Cap" },
  { value: "prepare_timeout_accelerated", label: "Runtime Decision Prepare Timeout Acceleration" },
  { value: "artifact_batch_continue", label: "Runtime Decision Artifact Batch Continue" },
  { value: "artifact_batch_downshift_near_limit", label: "Runtime Decision Artifact Batch Downshift" },
  { value: "artifact_finalize_early_near_limit", label: "Runtime Decision Early Finalize (Near-Limit)" },
  { value: "artifact_finalize_early_timeout", label: "Runtime Decision Early Finalize (Timeout)" },
  { value: "artifact_finalize_early_headroom", label: "Runtime Decision Early Finalize (Headroom)" },
  { value: "artifact_partial_finalize_blocked", label: "Runtime Decision Partial Finalize Blocked" },
  { value: "finalize_continue", label: "Runtime Decision Finalize Continue" },
  { value: "finalize_near_limit_cap", label: "Runtime Decision Finalize Near-Limit Cap" },
  { value: "finalize_timeout_accelerated", label: "Runtime Decision Finalize Timeout Acceleration" },
  { value: "finalize_completed", label: "Runtime Decision Finalize Completed" },
];

export const agentExecutionLaunchPresetRuntimeDecisionSeverityOptions: Array<{
  value: AgentExecutionRuntimeDecisionSeverity;
  label: string;
}> = [
  { value: "info", label: "Runtime Decision Info" },
  { value: "warning", label: "Runtime Decision Warning" },
  { value: "critical", label: "Runtime Decision Critical" },
];

export const agentExecutionLaunchPresetPressureLevelOptions: Array<{
  value: AgentExecutionRuntimePressureLevel;
  label: string;
}> = [
  { value: "healthy", label: "Pressure Healthy" },
  { value: "watch", label: "Pressure Watch" },
  { value: "critical", label: "Pressure Critical" },
];

export const agentExecutionLaunchPresetSchedulingDecisionClassOptions: Array<{
  value: AgentExecutionRuntimeSchedulingDecisionClass;
  label: string;
}> = [
  { value: "within_capacity", label: "Scheduling Within Capacity" },
  { value: "queue_backlog", label: "Scheduling Queue Backlog" },
  { value: "profile_saturated", label: "Scheduling Profile Saturated" },
  { value: "owner_hotspot", label: "Scheduling Owner Hotspot" },
  { value: "profile_and_owner_saturated", label: "Scheduling Profile + Owner Saturated" },
];

export const agentExecutionLaunchPresetRuntimeSessionKindOptions: Array<{
  value: AgentExecutionRuntimeSessionKind;
  label: string;
}> = [
  { value: "platform_executor", label: "Runtime Platform Executor" },
  { value: "stale_recovery", label: "Runtime Stale Recovery" },
  { value: "owner_requeue", label: "Runtime Owner Requeue" },
];

export const agentExecutionLaunchPresetRuntimeSessionStateOptions: Array<{
  value: AgentExecutionRuntimeSessionState;
  label: string;
}> = [
  { value: "running", label: "Runtime Running" },
  { value: "completed", label: "Runtime Completed" },
  { value: "failed", label: "Runtime Failed" },
  { value: "requeued", label: "Runtime Requeued" },
];

export function resolveActiveAgentExecutionLaunchPresetState<
  T extends Pick<AgentExecutionLaunchPresetView, "id" | "isDefault">,
>(presets: T[], selectedPresetId?: string | null): {
  preset: T | null;
  source: AgentExecutionLaunchPresetActivationSource | null;
} {
  const normalizedSelectedPresetId = selectedPresetId?.trim() || "";
  if (normalizedSelectedPresetId) {
    return {
      preset: presets.find((preset) => preset.id === normalizedSelectedPresetId) ?? null,
      source: "explicit",
    };
  }
  return {
    preset: presets.find((preset) => preset.isDefault) ?? null,
    source: presets.some((preset) => preset.isDefault) ? "default" : null,
  };
}

export function resolveActiveAgentExecutionLaunchPreset<T extends Pick<AgentExecutionLaunchPresetView, "id" | "isDefault">>(
  presets: T[],
  selectedPresetId?: string | null,
) {
  return resolveActiveAgentExecutionLaunchPresetState(presets, selectedPresetId).preset;
}

export function resolveAgentExecutionLaunchPresetFormDefaults(args: {
  ownedAgents: LaunchPresetAgentCarrier[];
  selectedPreset?: Pick<
    AgentExecutionLaunchPresetView,
    "preferredAgentId" | "runtimeProfileKey" | "callbackRemediationPolicyKey" | "titleTemplate" | "objectiveTemplate"
  > | null;
}): AgentExecutionLaunchPresetFormDefaults {
  const fallbackAgentId = args.ownedAgents[0]?.id ?? "";
  const selectedPreset = args.selectedPreset ?? null;
  const preferredAgentIsUsable =
    selectedPreset?.preferredAgentId &&
    args.ownedAgents.some((agent) => agent.enabled && agent.id === selectedPreset.preferredAgentId);

  return {
    agentId: preferredAgentIsUsable ? selectedPreset.preferredAgentId ?? fallbackAgentId : fallbackAgentId,
    runtimeProfileKey: selectedPreset?.runtimeProfileKey ?? "baseline",
    callbackRemediationPolicyKey: selectedPreset?.callbackRemediationPolicyKey ?? "inherit_agent",
    title: selectedPreset?.titleTemplate ?? "",
    objective: selectedPreset?.objectiveTemplate ?? "",
  };
}

export function canQuickLaunchAgentExecutionPreset(args: {
  preset: Pick<AgentExecutionLaunchPresetView, "preferredAgentId" | "titleTemplate" | "objectiveTemplate">;
  ownedAgents: LaunchPresetAgentCarrier[];
}) {
  return Boolean(
    args.preset.preferredAgentId &&
      args.preset.titleTemplate &&
      args.preset.objectiveTemplate &&
      args.ownedAgents.some((agent) => agent.enabled && agent.id === args.preset.preferredAgentId),
  );
}

export function normalizeAgentExecutionLaunchPresetFocusSection(
  value: string | null | undefined,
): AgentExecutionLaunchPresetFocusSection | null {
  return value === "active-preset" ||
    value === "launch-presets" ||
    value === "create-execution" ||
    value === "runtime-sessions" ||
    value === "cost-overview" ||
    value === "execution-list"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetFocusSectionLabel(
  value: AgentExecutionLaunchPresetFocusSection | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetFocusSection(value ?? null);
  return agentExecutionLaunchPresetFocusSectionOptions.find((option) => option.value === normalized)?.label ?? "不自动聚焦";
}

export function formatAgentExecutionLaunchPresetActivationSourceLabel(
  value: AgentExecutionLaunchPresetActivationSource | null | undefined,
) {
  if (value === "explicit") {
    return "显式套用";
  }
  if (value === "default") {
    return "默认激活";
  }
  return "未激活";
}

export function normalizeAgentExecutionLaunchPresetRuntimeProfileKey(
  value: string | null | undefined,
): AgentExecutionRuntimeProfileKey | null {
  return value === "baseline" || value === "iterative" || value === "deep_runtime" ? value : null;
}

export function formatAgentExecutionLaunchPresetRuntimeProfileLabel(
  value: AgentExecutionRuntimeProfileKey | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRuntimeProfileKey(value ?? null);
  return (
    agentExecutionLaunchPresetRuntimeProfileOptions.find((option) => option.value === normalized)?.label ??
    "所有 Runtime Profile"
  );
}

export function normalizeAgentExecutionLaunchPresetRunKind(
  value: string | null | undefined,
): AgentExecutionRunKind | null {
  return value === "platform_executor" ||
    value === "requeue" ||
    value === "recovery" ||
    value === "callback_retry_request" ||
    value === "callback_payload_replay" ||
    value === "callback_auto_remediation"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetRunKindLabel(
  value: AgentExecutionRunKind | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRunKind(value ?? null);
  return agentExecutionLaunchPresetRunKindOptions.find((option) => option.value === normalized)?.label ?? "不自动聚焦运行记录";
}

export function normalizeAgentExecutionLaunchPresetRunStatus(
  value: string | null | undefined,
): AgentExecutionRunStatus | null {
  return value === "running" || value === "completed" || value === "failed" ? value : null;
}

export function formatAgentExecutionLaunchPresetRunStatusLabel(
  value: AgentExecutionRunStatus | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRunStatus(value ?? null);
  return agentExecutionLaunchPresetRunStatusOptions.find((option) => option.value === normalized)?.label ?? "不自动聚焦运行状态";
}

export function normalizeAgentExecutionLaunchPresetFailureCategory(
  value: string | null | undefined,
): AgentExecutionRunFailureCategory | null {
  return value === "stale_timeout" ||
    value === "executor_failure" ||
    value === "requeue_failure" ||
    value === "unknown_failure"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetFailureCategoryLabel(
  value: AgentExecutionRunFailureCategory | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetFailureCategory(value ?? null);
  return agentExecutionLaunchPresetFailureCategoryOptions.find((option) => option.value === normalized)?.label ?? "不自动聚焦失败分类";
}

export function normalizeAgentExecutionLaunchPresetRecentWindow(
  value: string | null | undefined,
): AgentExecutionRecentWindowKey | null {
  return value === "15m" || value === "1h" || value === "24h" ? value : null;
}

export function formatAgentExecutionLaunchPresetRecentWindowLabel(
  value: AgentExecutionRecentWindowKey | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRecentWindow(value ?? null);
  return agentExecutionLaunchPresetRecentWindowOptions.find((option) => option.value === normalized)?.label ?? "不自动聚焦最近窗口";
}

export function normalizeAgentExecutionLaunchPresetCallbackStatus(
  value: string | null | undefined,
): AgentExecutionCallbackAuditStatus | null {
  return value === "accepted" || value === "duplicate" || value === "rejected" ? value : null;
}

export function formatAgentExecutionLaunchPresetCallbackStatusLabel(
  value: AgentExecutionCallbackAuditStatus | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetCallbackStatus(value ?? null);
  return (
    agentExecutionLaunchPresetCallbackStatusOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦回调状态"
  );
}

export function normalizeAgentExecutionLaunchPresetCallbackRetryability(
  value: string | null | undefined,
): AgentExecutionCallbackRetryability | null {
  return value === "retryable" || value === "inspect" || value === "not_retryable" ? value : null;
}

export function formatAgentExecutionLaunchPresetCallbackRetryabilityLabel(
  value: AgentExecutionCallbackRetryability | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetCallbackRetryability(value ?? null);
  return (
    agentExecutionLaunchPresetCallbackRetryabilityOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦重试建议"
  );
}

export function normalizeAgentExecutionLaunchPresetCallbackType(
  value: string | null | undefined,
): AgentExecutionCallbackType | null {
  return value === "heartbeat" || value === "status" || value === "artifact" || value === "callback" ? value : null;
}

export function formatAgentExecutionLaunchPresetCallbackTypeLabel(
  value: AgentExecutionCallbackType | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetCallbackType(value ?? null);
  return (
    agentExecutionLaunchPresetCallbackTypeOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦回调类型"
  );
}

export function normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
  value: string | null | undefined,
): AgentExecutionCallbackRejectionCategory | null {
  return value === "invalid_secret" ||
    value === "invalid_signature" ||
    value === "invalid_timestamp" ||
    value === "invalid_version" ||
    value === "invalid_payload" ||
    value === "processing_conflict" ||
    value === "unsupported_target" ||
    value === "unknown"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetCallbackRejectionCategoryLabel(
  value: AgentExecutionCallbackRejectionCategory | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(value ?? null);
  return (
    agentExecutionLaunchPresetCallbackRejectionCategoryOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦拒绝原因"
  );
}

export function normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
  value: string | null | undefined,
): AgentExecutionStoredReplayPayloadCompatibility | null {
  return value === "current" || value === "legacy_normalized" || value === "invalid" ? value : null;
}

export function formatAgentExecutionLaunchPresetReplayPayloadCompatibilityLabel(
  value: AgentExecutionStoredReplayPayloadCompatibility | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(value ?? null);
  return (
    agentExecutionLaunchPresetReplayPayloadCompatibilityOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦 replay payload 兼容性"
  );
}

export function normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
  value: string | boolean | null | undefined,
): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

export function formatAgentExecutionLaunchPresetReplayPayloadReplayableLabel(
  value: boolean | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(value ?? null);
  return normalized === true
    ? "Replay Replayable"
    : normalized === false
      ? "Replay Not Replayable"
      : "不自动聚焦 replay payload 可重放性";
}

export function normalizeAgentExecutionLaunchPresetDecisionClass(
  value: string | null | undefined,
): AgentExecutionCallbackRemediationDecisionClass | null {
  return value === "replay_current_payload" ||
    value === "replay_legacy_payload" ||
    value === "retry_missing_payload" ||
    value === "retry_incompatible_payload" ||
    value === "retry_compatibility_policy" ||
    value === "retry_compat_window" ||
    value === "retry_policy_preferred" ||
    value === "skip_policy_disabled" ||
    value === "skip_missing_rejection_category" ||
    value === "skip_policy_budget_exhausted" ||
    value === "skip_missing_payload" ||
    value === "skip_incompatible_payload" ||
    value === "skip_compatibility_policy" ||
    value === "skip_compat_window" ||
    value === "skip_policy_not_covered" ||
    value === "skip_target_unavailable"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetDecisionClassLabel(
  value: AgentExecutionCallbackRemediationDecisionClass | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetDecisionClass(value ?? null);
  return (
    agentExecutionLaunchPresetDecisionClassOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦 remediation decision"
  );
}

export function normalizeAgentExecutionLaunchPresetReplayFailureClass(
  value: string | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  return value === "stored_payload_unavailable" ||
    value === "callback_secret_unavailable" ||
    value === "duplicate_replay_cooldown" ||
    value === "agent_disabled" ||
    value === "callback_not_retryable" ||
    value === "unsupported_target" ||
    value === "callback_protocol_mismatch"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetReplayFailureClassLabel(
  value: AgentExecutionCallbackReplayFailureClass | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetReplayFailureClass(value ?? null);
  return (
    agentExecutionLaunchPresetReplayFailureClassOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦 replay failure"
  );
}

export function normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
  value: string | null | undefined,
): AgentExecutionRuntimeDecisionClass | null {
  return value === "prepare_continue" ||
    value === "prepare_near_limit_cap" ||
    value === "prepare_timeout_accelerated" ||
    value === "artifact_batch_continue" ||
    value === "artifact_batch_downshift_near_limit" ||
    value === "artifact_finalize_early_near_limit" ||
    value === "artifact_finalize_early_timeout" ||
    value === "artifact_finalize_early_headroom" ||
    value === "artifact_partial_finalize_blocked" ||
    value === "finalize_continue" ||
    value === "finalize_near_limit_cap" ||
    value === "finalize_timeout_accelerated" ||
    value === "finalize_completed"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetRuntimeDecisionClassLabel(
  value: AgentExecutionRuntimeDecisionClass | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(value ?? null);
  return (
    agentExecutionLaunchPresetRuntimeDecisionClassOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦 runtime decision"
  );
}

export function normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
  value: string | null | undefined,
): AgentExecutionRuntimeDecisionSeverity | null {
  return value === "info" || value === "warning" || value === "critical" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetPressureLevel(
  value: string | null | undefined,
): AgentExecutionRuntimePressureLevel | null {
  return value === "healthy" || value === "watch" || value === "critical" ? value : null;
}

export function formatAgentExecutionLaunchPresetPressureLevelLabel(
  value: AgentExecutionRuntimePressureLevel | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetPressureLevel(value ?? null);
  return (
    agentExecutionLaunchPresetPressureLevelOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦运行压力级别"
  );
}

export function normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
  value: string | null | undefined,
): AgentExecutionRuntimeSchedulingDecisionClass | null {
  return value === "within_capacity" ||
    value === "queue_backlog" ||
    value === "profile_saturated" ||
    value === "owner_hotspot" ||
    value === "profile_and_owner_saturated"
    ? value
    : null;
}

export function formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
  value: AgentExecutionRuntimeSchedulingDecisionClass | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(value ?? null);
  return (
    agentExecutionLaunchPresetSchedulingDecisionClassOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦调度决策"
  );
}

export function formatAgentExecutionLaunchPresetRuntimeDecisionSeverityLabel(
  value: AgentExecutionRuntimeDecisionSeverity | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(value ?? null);
  return (
    agentExecutionLaunchPresetRuntimeDecisionSeverityOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦 runtime severity"
  );
}

export function normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
  value: string | null | undefined,
): AgentExecutionRuntimeSessionKind | null {
  return value === "platform_executor" || value === "stale_recovery" || value === "owner_requeue" ? value : null;
}

export function formatAgentExecutionLaunchPresetRuntimeSessionKindLabel(
  value: AgentExecutionRuntimeSessionKind | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRuntimeSessionKind(value ?? null);
  return (
    agentExecutionLaunchPresetRuntimeSessionKindOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦运行会话类型"
  );
}

export function normalizeAgentExecutionLaunchPresetRuntimeSessionState(
  value: string | null | undefined,
): AgentExecutionRuntimeSessionState | null {
  return value === "running" || value === "completed" || value === "failed" || value === "requeued" ? value : null;
}

export function formatAgentExecutionLaunchPresetRuntimeSessionStateLabel(
  value: AgentExecutionRuntimeSessionState | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetRuntimeSessionState(value ?? null);
  return (
    agentExecutionLaunchPresetRuntimeSessionStateOptions.find((option) => option.value === normalized)?.label ??
    "不自动聚焦运行会话状态"
  );
}

export function toAgentExecutionLaunchPresetFocusSectionFragment(
  value: AgentExecutionLaunchPresetFocusSection | null | undefined,
) {
  const normalized = normalizeAgentExecutionLaunchPresetFocusSection(value ?? null);
  return normalized ? `section-${normalized}` : null;
}
