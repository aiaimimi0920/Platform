import {
  type AgentCallbackConfigHistoryView,
  type AgentCallbackCompatibilityCleanupResult,
  type AgentCallbackCompatibilitySummaryView,
  type AgentCallbackHealthSummaryView,
  type AgentCallbackRemediationPolicyKey,
  type AgentCallbackRemediationPolicyView,
  type AgentRecentCallbackView,
  type AgentExecutionCallbackAuditSummaryView,
  type AgentExecutionCallbackAutoRemediationResult,
  type AgentExecutionCallbackAutoRemediationReasonCategory,
  type AgentExecutionCallbackAutoRemediationReasonDisposition,
  type AgentExecutionCallbackRemediationAlertDispatchResult,
  type AgentExecutionCallbackRemediationDecisionClass,
  type AgentExecutionCallbackRemediationSummaryView,
  type AgentExecutionCallbackReplayResult,
  type AgentExecutionCallbackReplayFailureClass,
  type AgentExecutionCallbackRetryBatchResult,
  type AgentExecutionCallbackRetryRequestResult,
  type AgentExecutionCallbackAuditView,
  type AgentExecutionStoredReplayPayloadCompatibility,
  type AgentExecutionRuntimeDecisionClass,
  type AgentExecutionRuntimeDecisionSeverity,
  type AgentExecutionRuntimePressureAlertDispatchResult,
  type AgentExecutionRuntimePressureAlertSummaryView,
  type AgentExecutionRuntimePressureLevel,
  type AgentExecutionRuntimeSchedulingDecisionClass,
  type InternalUserContext,
} from "@neuro/contracts";

import type {
  AgentView,
  RotateAgentCallbackSecretResult,
} from "./types";

import { coreRequest } from "./request";

type CallbackAuditQueryArgs = {
  agentId?: string;
  callbackType?: "status" | "artifact" | "heartbeat" | "callback";
  status?: "accepted" | "duplicate" | "rejected";
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  secretVersion?: number;
  callbackVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  retryability?: "retryable" | "inspect" | "not_retryable";
  autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
  autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
  replayPayloadReplayable?: boolean;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
  runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
  runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
  runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
  runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  rejectionCategory?:
    | "invalid_secret"
    | "invalid_signature"
    | "invalid_timestamp"
    | "invalid_version"
    | "invalid_payload"
    | "processing_conflict"
    | "unsupported_target"
    | "unknown";
  limit?: number;
};

function buildCallbackAuditQueryString(args?: CallbackAuditQueryArgs) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.callbackType) params.set("callbackType", args.callbackType);
  if (args?.status) params.set("status", args.status);
  if (args?.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (typeof args?.secretVersion === "number") params.set("secretVersion", String(args.secretVersion));
  if (typeof args?.callbackVersion === "number") params.set("callbackVersion", String(args.callbackVersion));
  if (args?.protocolMatch) params.set("protocolMatch", args.protocolMatch);
  if (args?.secretMatch) params.set("secretMatch", args.secretMatch);
  if (args?.retryability) params.set("retryability", args.retryability);
  if (args?.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args?.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args?.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (typeof args?.replayPayloadReplayable === "boolean") {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable ? "true" : "false");
  }
  if (args?.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args?.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args?.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args?.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args?.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args?.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  if (args?.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args?.limit) params.set("limit", String(args.limit));
  return params.toString();
}

export async function listAgentCallbackHealthSummaries(
  userContext: InternalUserContext,
  windowHours = 168,
) {
  const response = await coreRequest<{ summaries: AgentCallbackHealthSummaryView[] }>(
    `/v1/agents/callback-health?windowHours=${encodeURIComponent(String(windowHours))}`,
    {
      userContext,
    },
  );
  return response.summaries;
}

export async function listAgentCallbackRemediationPolicies(userContext: InternalUserContext) {
  const response = await coreRequest<{ policies: AgentCallbackRemediationPolicyView[] }>(
    "/v1/agents/callback-remediation-policies",
    {
      userContext,
    },
  );
  return response.policies;
}

export async function getAgentCallbackCompatibilitySummary(
  userContext: InternalUserContext,
) {
  const response = await coreRequest<{ summary: AgentCallbackCompatibilitySummaryView }>(
    "/v1/internal/agents/callback-compatibility/summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function cleanupExpiredAgentCallbackCompatibility(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  const response = await coreRequest<{ result: AgentCallbackCompatibilityCleanupResult }>(
    "/v1/internal/agents/callback-compatibility/cleanup-expired",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentRecentCallbacks(
  userContext: InternalUserContext,
  agentId: string,
  limit = 5,
) {
  const response = await coreRequest<{ callbacks: AgentRecentCallbackView[] }>(
    `/v1/agents/${encodeURIComponent(agentId)}/recent-callbacks?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.callbacks;
}

export async function listAgentExecutionCallbackAudits(
  userContext: InternalUserContext,
  args?: CallbackAuditQueryArgs,
) {
  const query = buildCallbackAuditQueryString(args);
  const response = await coreRequest<{ callbacks: AgentExecutionCallbackAuditView[] }>(
    `/v1/internal/agent-executions/callback-audits${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.callbacks;
}

export async function getAgentExecutionCallbackAuditSummary(
  userContext: InternalUserContext,
  args?: CallbackAuditQueryArgs,
) {
  const query = buildCallbackAuditQueryString(args);
  const response = await coreRequest<{ summary: AgentExecutionCallbackAuditSummaryView }>(
    `/v1/internal/agent-executions/callback-audits/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionCallbackRemediationSummary(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
    autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
    replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
    replayPayloadReplayable?: boolean;
    decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
    replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
    runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
    runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
    runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
    runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.callbackType) params.set("callbackType", args.callbackType);
  if (args?.remediationPolicyKey) params.set("remediationPolicyKey", args.remediationPolicyKey);
  if (args?.autoRemediationReasonCategory) {
    params.set("autoRemediationReasonCategory", args.autoRemediationReasonCategory);
  }
  if (args?.autoRemediationReasonDisposition) {
    params.set("autoRemediationReasonDisposition", args.autoRemediationReasonDisposition);
  }
  if (args?.replayPayloadCompatibility) {
    params.set("replayPayloadCompatibility", args.replayPayloadCompatibility);
  }
  if (typeof args?.replayPayloadReplayable === "boolean") {
    params.set("replayPayloadReplayable", args.replayPayloadReplayable ? "true" : "false");
  }
  if (args?.decisionClass) params.set("decisionClass", args.decisionClass);
  if (args?.replayFailureClass) params.set("replayFailureClass", args.replayFailureClass);
  if (args?.runtimeDecisionClass) params.set("runtimeDecisionClass", args.runtimeDecisionClass);
  if (args?.runtimeDecisionSeverity) params.set("runtimeDecisionSeverity", args.runtimeDecisionSeverity);
  if (args?.runtimePressureLevel) params.set("runtimePressureLevel", args.runtimePressureLevel);
  if (args?.runtimeSchedulingDecisionClass) {
    params.set("runtimeSchedulingDecisionClass", args.runtimeSchedulingDecisionClass);
  }
  const query = params.toString();
  const response = await coreRequest<{ summary: AgentExecutionCallbackRemediationSummaryView }>(
    `/v1/internal/agent-executions/callback-audits/remediation-summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function emitAgentExecutionCallbackRemediationAlerts(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
    autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
    replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
    replayPayloadReplayable?: boolean;
    decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
    replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
    runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
    runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
    runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
    runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    minimumAlertLevel?: number;
    limit?: number;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRemediationAlertDispatchResult }>(
    "/v1/internal/agent-executions/callback-audits/emit-alerts",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function autoRemediateRejectedCallbackPayloads(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    rejectionCategory?:
      | "invalid_secret"
      | "invalid_signature"
      | "invalid_timestamp"
      | "invalid_version"
      | "invalid_payload"
      | "processing_conflict"
      | "unsupported_target"
      | "unknown";
    retryability?: "retryable" | "inspect" | "not_retryable";
    autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
    autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
    replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
    replayPayloadReplayable?: boolean;
    decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
    replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
    runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
    runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
    runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
    runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    ignoreScheduleWindow?: boolean;
    limit?: number;
    note?: string;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackAutoRemediationResult }>(
    "/v1/internal/agent-executions/callback-audits/auto-remediate",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function getAgentExecutionRuntimePressureAlertSummary(
  userContext: InternalUserContext,
  args?: {
    pressureLevel?: AgentExecutionRuntimePressureLevel;
    schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
  },
) {
  const params = new URLSearchParams();
  if (args?.pressureLevel) params.set("pressureLevel", args.pressureLevel);
  if (args?.schedulingDecisionClass) params.set("schedulingDecisionClass", args.schedulingDecisionClass);
  const query = params.toString();
  const response = await coreRequest<{ summary: AgentExecutionRuntimePressureAlertSummaryView }>(
    `/v1/internal/agent-executions/runtime-alerts/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function emitAgentExecutionRuntimePressureAlerts(
  userContext: InternalUserContext,
  input?: {
    pressureLevel?: AgentExecutionRuntimePressureLevel;
    schedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    minimumAlertLevel?: number;
    limit?: number;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionRuntimePressureAlertDispatchResult }>(
    "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function requestRejectedCallbackRetry(
  userContext: InternalUserContext,
  auditId: string,
  input?: { note?: string },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRetryRequestResult }>(
    `/v1/internal/agent-executions/callback-audits/${encodeURIComponent(auditId)}/request-retry`,
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function requestRejectedCallbackRetryBatch(
  userContext: InternalUserContext,
  input?: {
    agentId?: string;
    callbackType?: "status" | "artifact" | "heartbeat" | "callback";
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    retryability?: "retryable" | "inspect" | "not_retryable";
    autoRemediationReasonCategory?: AgentExecutionCallbackAutoRemediationReasonCategory;
    autoRemediationReasonDisposition?: AgentExecutionCallbackAutoRemediationReasonDisposition;
    replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility;
    replayPayloadReplayable?: boolean;
    decisionClass?: AgentExecutionCallbackRemediationDecisionClass;
    replayFailureClass?: AgentExecutionCallbackReplayFailureClass;
    runtimeDecisionClass?: AgentExecutionRuntimeDecisionClass;
    runtimeDecisionSeverity?: AgentExecutionRuntimeDecisionSeverity;
    runtimePressureLevel?: AgentExecutionRuntimePressureLevel;
    runtimeSchedulingDecisionClass?: AgentExecutionRuntimeSchedulingDecisionClass;
    rejectionCategory?:
      | "invalid_secret"
      | "invalid_signature"
      | "invalid_timestamp"
      | "invalid_version"
      | "invalid_payload"
      | "processing_conflict"
      | "unsupported_target"
      | "unknown";
    limit?: number;
    note?: string;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackRetryBatchResult }>(
    "/v1/internal/agent-executions/callback-audits/request-retry-batch",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function replayRejectedCallbackPayload(
  userContext: InternalUserContext,
  auditId: string,
  input?: { note?: string },
) {
  const response = await coreRequest<{ result: AgentExecutionCallbackReplayResult }>(
    `/v1/internal/agent-executions/callback-audits/${encodeURIComponent(auditId)}/replay-payload`,
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentCallbackHistory(
  userContext: InternalUserContext,
  agentId: string,
  limit = 20,
) {
  const response = await coreRequest<{ history: AgentCallbackConfigHistoryView[] }>(
    `/v1/agents/${agentId}/callback-history?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.history;
}

export async function listOperatorAgentCallbackHistory(
  userContext: InternalUserContext,
  agentId: string,
  limit = 20,
) {
  const response = await coreRequest<{ history: AgentCallbackConfigHistoryView[] }>(
    `/v1/internal/agents/${encodeURIComponent(agentId)}/callback-history?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.history;
}

export async function rotateAgentCallbackSecret(userContext: InternalUserContext, agentId: string) {
  return coreRequest<RotateAgentCallbackSecretResult>(`/v1/agents/${agentId}/rotate-callback-secret`, {
    method: "POST",
    userContext,
  });
}

export async function updateAgentCallbackProtocolVersion(
  userContext: InternalUserContext,
  agentId: string,
  protocolVersion: number,
) {
  const response = await coreRequest<{ agent: AgentView }>(`/v1/agents/${agentId}/callback-protocol`, {
    method: "POST",
    body: { protocolVersion },
    userContext,
  });
  return response.agent;
}

export async function updateAgentCallbackRemediationPolicy(
  userContext: InternalUserContext,
  agentId: string,
  policyKey: AgentCallbackRemediationPolicyKey,
) {
  const response = await coreRequest<{ agent: AgentView }>(
    `/v1/agents/${encodeURIComponent(agentId)}/callback-remediation-policy`,
    {
      method: "POST",
      body: { policyKey },
      userContext,
    },
  );
  return response.agent;
}
