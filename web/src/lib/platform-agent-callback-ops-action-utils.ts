function appendFragmentToPath(path: string, fragment?: string | null) {
  return fragment ? `${path}#${encodeURIComponent(fragment)}` : path;
}

export function buildAgentCallbackOpsRedirect(args: {
  result: "success" | "error";
  message: string;
  agentId?: string | null;
  ownerUserId?: string | null;
  callbackType?: string | null;
  callbackVersion?: string | null;
  secretVersion?: string | null;
  callbackStatus?: string | null;
  remediationPolicyKey?: string | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  autoRemediationReasonCategory?: string | null;
  autoRemediationReasonDisposition?: string | null;
  replayPayloadCompatibility?: string | null;
  replayPayloadReplayable?: string | null;
  decisionClass?: string | null;
  replayFailureClass?: string | null;
  runtimeDecisionClass?: string | null;
  runtimeDecisionSeverity?: string | null;
  incidentReasonDisposition?: string | null;
  incidentAlertLevel?: string | null;
  projectId?: string | null;
  incidentId?: string | null;
  routePolicyId?: string | null;
  snapshotId?: string | null;
  rejectionCategory?: string | null;
  runKind?: string | null;
  runStatus?: string | null;
  executionStatus?: string | null;
  failureCategory?: string | null;
  recentWindow?: string | null;
  incidentState?: string | null;
  runtimePressureLevel?: string | null;
  runtimeSchedulingDecisionClass?: string | null;
  runtimeState?: string | null;
  runtimeKind?: string | null;
  runtimeStaleOnly?: string | null;
  ownerReliefAction?: string | null;
  ownerReliefClosedCount?: number | null;
  ownerReliefSkippedCount?: number | null;
  ownerReliefRecoveredCount?: number | null;
  ownerReliefExhaustedCount?: number | null;
  ownerReliefProcessedCount?: number | null;
  ownerReliefFailedCount?: number | null;
  ownerReliefRunId?: string | null;
  ownerReliefRecoveryExecutionIds?: string[] | null;
  ownerReliefExecutorExecutionIds?: string[] | null;
  ownerReliefRecoveryRunIds?: string[] | null;
  ownerReliefExecutorRunIds?: string[] | null;
  fragment?: string | null;
}) {
  const params = new URLSearchParams({
    result: args.result,
    message: args.message,
  });
  if (args.agentId) params.set("agentId", args.agentId);
  if (args.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args.callbackType) params.set("callbackType", args.callbackType);
  if (args.callbackVersion) params.set("callbackVersion", args.callbackVersion);
  if (args.secretVersion) params.set("secretVersion", args.secretVersion);
  if (args.callbackStatus) params.set("status", args.callbackStatus);
  if (args.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (args.protocolMatch) params.set("protocolMatch", args.protocolMatch);
  if (args.secretMatch) params.set("secretMatch", args.secretMatch);
  if (args.retryability) params.set("retryability", args.retryability);
  if (args.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (args.replayPayloadReplayable) {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable);
  }
  if (args.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args.incidentReasonDisposition) params.set("incidentReasonDisposition", args.incidentReasonDisposition);
  if (args.incidentAlertLevel) params.set("incidentAlertLevel", args.incidentAlertLevel);
  if (args.projectId) params.set("projectId", args.projectId);
  if (args.incidentId) params.set("incidentId", args.incidentId);
  if (args.routePolicyId) params.set("routePolicyId", args.routePolicyId);
  if (args.snapshotId) params.set("snapshotId", args.snapshotId);
  if (args.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args.runKind) params.set("runKind", args.runKind);
  if (args.runStatus) params.set("runStatus", args.runStatus);
  if (args.executionStatus) params.set("executionStatus", args.executionStatus);
  if (args.failureCategory) params.set("failureCategory", args.failureCategory);
  if (args.recentWindow) params.set("recentWindow", args.recentWindow);
  if (args.incidentState) params.set("incidentState", args.incidentState);
  if (args.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  if (args.runtimeState) params.set("runtimeState", args.runtimeState);
  if (args.runtimeKind) params.set("runtimeKind", args.runtimeKind);
  if (args.runtimeStaleOnly) params.set("runtimeStaleOnly", args.runtimeStaleOnly);
  if (args.ownerReliefAction) params.set("ownerReliefAction", args.ownerReliefAction);
  if (typeof args.ownerReliefClosedCount === "number") {
    params.set("ownerReliefClosedCount", String(args.ownerReliefClosedCount));
  }
  if (typeof args.ownerReliefSkippedCount === "number") {
    params.set("ownerReliefSkippedCount", String(args.ownerReliefSkippedCount));
  }
  if (typeof args.ownerReliefRecoveredCount === "number") {
    params.set("ownerReliefRecoveredCount", String(args.ownerReliefRecoveredCount));
  }
  if (typeof args.ownerReliefExhaustedCount === "number") {
    params.set("ownerReliefExhaustedCount", String(args.ownerReliefExhaustedCount));
  }
  if (typeof args.ownerReliefProcessedCount === "number") {
    params.set("ownerReliefProcessedCount", String(args.ownerReliefProcessedCount));
  }
  if (typeof args.ownerReliefFailedCount === "number") {
    params.set("ownerReliefFailedCount", String(args.ownerReliefFailedCount));
  }
  if (args.ownerReliefRunId) {
    params.set("ownerReliefRunId", args.ownerReliefRunId);
  }
  if (args.ownerReliefRecoveryExecutionIds?.length) {
    params.set(
      "ownerReliefRecoveryExecutionIds",
      Array.from(new Set(args.ownerReliefRecoveryExecutionIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefExecutorExecutionIds?.length) {
    params.set(
      "ownerReliefExecutorExecutionIds",
      Array.from(new Set(args.ownerReliefExecutorExecutionIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefRecoveryRunIds?.length) {
    params.set(
      "ownerReliefRecoveryRunIds",
      Array.from(new Set(args.ownerReliefRecoveryRunIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  if (args.ownerReliefExecutorRunIds?.length) {
    params.set(
      "ownerReliefExecutorRunIds",
      Array.from(new Set(args.ownerReliefExecutorRunIds.map((value) => value.trim()).filter(Boolean)))
        .slice(0, 20)
        .join(","),
    );
  }
  return appendFragmentToPath(`/ops/agent-callbacks?${params.toString()}`, args.fragment);
}

export function readAgentCallbackOpsFollowUp(formData: FormData) {
  const agentId = String(formData.get("followUpAgentId") || "").trim() || null;
  const ownerUserId = String(formData.get("followUpOwnerUserId") || "").trim() || null;
  const callbackType = String(formData.get("followUpCallbackType") || "").trim() || null;
  const callbackVersion = String(formData.get("followUpCallbackVersion") || "").trim() || null;
  const secretVersion = String(formData.get("followUpSecretVersion") || "").trim() || null;
  const callbackStatus = String(formData.get("followUpCallbackStatus") || "").trim() || null;
  const remediationPolicyKey = String(formData.get("followUpRemediationPolicyKey") || "").trim() || null;
  const protocolMatch = String(formData.get("followUpProtocolMatch") || "").trim() || null;
  const secretMatch = String(formData.get("followUpSecretMatch") || "").trim() || null;
  const retryability = String(formData.get("followUpRetryability") || "").trim() || null;
  const autoRemediationReasonCategory =
    String(formData.get("followUpAutoRemediationReasonCategory") || "").trim() || null;
  const autoRemediationReasonDisposition =
    String(formData.get("followUpAutoRemediationReasonDisposition") || "").trim() || null;
  const replayPayloadCompatibility =
    String(formData.get("followUpReplayPayloadCompatibility") || "").trim() || null;
  const replayPayloadReplayable =
    String(formData.get("followUpReplayPayloadReplayable") || "").trim() || null;
  const decisionClass = String(formData.get("followUpDecisionClass") || "").trim() || null;
  const replayFailureClass = String(formData.get("followUpReplayFailureClass") || "").trim() || null;
  const runtimeDecisionClass = String(formData.get("followUpRuntimeDecisionClass") || "").trim() || null;
  const runtimeDecisionSeverity = String(formData.get("followUpRuntimeDecisionSeverity") || "").trim() || null;
  const incidentReasonDisposition = String(formData.get("followUpIncidentReasonDisposition") || "").trim() || null;
  const incidentAlertLevel = String(formData.get("followUpIncidentAlertLevel") || "").trim() || null;
  const projectId = String(formData.get("followUpProjectId") || "").trim() || null;
  const incidentId = String(formData.get("followUpIncidentId") || "").trim() || null;
  const routePolicyId = String(formData.get("followUpRoutePolicyId") || "").trim() || null;
  const snapshotId = String(formData.get("followUpSnapshotId") || "").trim() || null;
  const rejectionCategory = String(formData.get("followUpRejectionCategory") || "").trim() || null;
  const runKind = String(formData.get("followUpRunKind") || "").trim() || null;
  const runStatus = String(formData.get("followUpRunStatus") || "").trim() || null;
  const executionStatus = String(formData.get("followUpExecutionStatus") || "").trim() || null;
  const failureCategory = String(formData.get("followUpFailureCategory") || "").trim() || null;
  const recentWindow = String(formData.get("followUpRecentWindow") || "").trim() || null;
  const incidentState = String(formData.get("followUpIncidentState") || "").trim() || null;
  const runtimePressureLevel = String(formData.get("followUpRuntimePressureLevel") || "").trim() || null;
  const runtimeSchedulingDecisionClass =
    String(formData.get("followUpRuntimeSchedulingDecisionClass") || "").trim() || null;
  const runtimeState = String(formData.get("followUpRuntimeState") || "").trim() || null;
  const runtimeKind = String(formData.get("followUpRuntimeKind") || "").trim() || null;
  const runtimeStaleOnly = String(formData.get("followUpRuntimeStaleOnly") || "").trim() || null;
  const fragment = String(formData.get("followUpFragment") || "").trim() || null;
  return {
    agentId,
    ownerUserId,
    callbackType,
    callbackVersion,
    secretVersion,
    callbackStatus,
    remediationPolicyKey,
    protocolMatch,
    secretMatch,
    retryability,
    autoRemediationReasonCategory,
    autoRemediationReasonDisposition,
    replayPayloadCompatibility,
    replayPayloadReplayable,
    decisionClass,
    replayFailureClass,
    runtimeDecisionClass,
    runtimeDecisionSeverity,
    incidentReasonDisposition,
    incidentAlertLevel,
    projectId,
    incidentId,
    routePolicyId,
    snapshotId,
    rejectionCategory,
    runKind,
    runStatus,
    executionStatus,
    failureCategory,
    recentWindow,
    incidentState,
    runtimePressureLevel,
    runtimeSchedulingDecisionClass,
    runtimeState,
    runtimeKind,
    runtimeStaleOnly,
    fragment,
  };
}

export function readOwnerReliefAction(formData: FormData) {
  const action = String(formData.get("ownerReliefAction") || "").trim();
  return action === "sweep" ||
    action === "recover" ||
    action === "run" ||
    action === "recover_then_run"
    ? action
    : null;
}

export function readOwnerReliefRunId(formData: FormData) {
  return String(formData.get("ownerReliefRunId") || "").trim() || null;
}

export type OwnerReliefRunHandoffTargetType =
  | "runtime_pressure"
  | "execution_run_watch"
  | "runtime_session_watch"
  | "callback_audits"
  | "external_note";

export type OwnerReliefRunHandoffFocusSection =
  | "runtime-pressure"
  | "execution-run-watch"
  | "runtime-session-watch"
  | "callback-audits";

export type OwnerReliefRunHandoffFollowUpProfile =
  | "inspect_only"
  | "resolve_after_review"
  | "reopen_after_review";

export function parseOwnerReliefRunResultStatus(
  value: FormDataEntryValue | null,
): "continue" | "observe" | "escalate" | "handed_off" | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "continue" || raw === "observe" || raw === "escalate" || raw === "handed_off" ? raw : null;
}

export function parseOwnerReliefRunHandoffTargetType(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffTargetType | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (
    raw === "runtime_pressure" ||
    raw === "execution_run_watch" ||
    raw === "runtime_session_watch" ||
    raw === "callback_audits" ||
    raw === "external_note"
  ) {
    return raw;
  }
  if (raw === "callback_backlog") {
    return "callback_audits";
  }
  return null;
}

export function parseOwnerReliefRunHandoffFocusSection(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffFocusSection | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "runtime-pressure" ||
    raw === "execution-run-watch" ||
    raw === "runtime-session-watch" ||
    raw === "callback-audits"
    ? raw
    : null;
}

export function parseOwnerReliefRunHandoffFollowUpProfile(
  value: FormDataEntryValue | null,
): OwnerReliefRunHandoffFollowUpProfile | null {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw === "inspect_only" || raw === "resolve_after_review" || raw === "reopen_after_review"
    ? raw
    : null;
}
