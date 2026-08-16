import {
  type AddAgentExecutionArtifactInput,
  type AgentExecutionLaunchPresetView,
  type AgentExecutionRuntimeCatalogView,
  type AgentExecutionOperatorRunSummaryView,
  type AgentExecutionOperatorRunView,
  type AgentExecutionSettlementAttemptStatus,
  type AgentExecutionSettlementAttemptView,
  type AgentExecutionSettlementSummaryView,
  type AgentExecutionRuntimeSessionView,
  type AgentExecutionRuntimeSessionSummaryView,
  type AgentExecutionRuntimeSessionSweepResult,
  type PlatformExecutionRunResult,
  type PlatformExecutionRecoveryResult,
  type CreateAgentExecutionInput,
  type CreateAgentExecutionLaunchPresetInput,
  type CreateAgentExecutionSubtaskInput,
  type InternalUserContext,
  type UpdateAgentExecutionLaunchPresetInput,
  type UpdateAgentExecutionSubtaskStatusInput,
  type UpdateAgentExecutionStatusInput,
  type ListAgentExecutionLaunchPresetsInput,
} from "@neuro/contracts";

import type {
  AgentExecutionView,
} from "./types";

import { coreRequest } from "./request";

type AgentExecutionRunQueryArgs = {
  agentId?: string;
  ownerUserId?: string;
  executionIds?: string[];
  runIds?: string[];
  runKind?:
    | "platform_executor"
    | "requeue"
    | "recovery"
    | "callback_retry_request"
    | "callback_payload_replay"
    | "callback_auto_remediation";
  runStatus?: "running" | "completed" | "failed";
  executionStatus?: "queued" | "running" | "submitted" | "completed" | "failed" | "cancelled";
  failureCategory?: "stale_timeout" | "executor_failure" | "requeue_failure" | "unknown_failure";
  recentWindow?: "15m" | "1h" | "24h";
  limit?: number;
};

function buildAgentExecutionRunQueryString(args?: AgentExecutionRunQueryArgs) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.executionIds?.length) params.set("executionIds", args.executionIds.join(","));
  if (args?.runIds?.length) params.set("runIds", args.runIds.join(","));
  if (args?.runKind) params.set("runKind", args.runKind);
  if (args?.runStatus) params.set("runStatus", args.runStatus);
  if (args?.executionStatus) params.set("executionStatus", args.executionStatus);
  if (args?.failureCategory) params.set("failureCategory", args.failureCategory);
  if (args?.recentWindow) params.set("recentWindow", args.recentWindow);
  if (args?.limit) params.set("limit", String(args.limit));
  return params.toString();
}

export async function listAgentExecutions(userContext: InternalUserContext) {
  const response = await coreRequest<{ executions: AgentExecutionView[] }>("/v1/agent-executions", {
    userContext,
  });
  return response.executions;
}

export async function listAgentExecutionRunsForOperator(
  userContext: InternalUserContext,
  args?: AgentExecutionRunQueryArgs,
) {
  const query = buildAgentExecutionRunQueryString(args);
  const response = await coreRequest<{ runs: AgentExecutionOperatorRunView[] }>(
    `/v1/internal/agent-executions/runs${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.runs;
}

export async function getAgentExecutionRunSummaryForOperator(
  userContext: InternalUserContext,
  args?: AgentExecutionRunQueryArgs,
) {
  const query = buildAgentExecutionRunQueryString(args);
  const response = await coreRequest<{ summary: AgentExecutionOperatorRunSummaryView }>(
    `/v1/internal/agent-executions/runs/summary${query ? `?${query}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionRuntimeSessionSummary(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.state) params.set("state", args.state);
  if (args?.kind) params.set("kind", args.kind);
  if (typeof args?.staleOnly === "boolean") params.set("staleOnly", args.staleOnly ? "true" : "false");
  const response = await coreRequest<{ summary: AgentExecutionRuntimeSessionSummaryView }>(
    `/v1/internal/agent-executions/runtime-sessions/summary${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.summary;
}

export async function getAgentExecutionRuntimeCatalog(userContext: InternalUserContext) {
  const response = await coreRequest<{ catalog: AgentExecutionRuntimeCatalogView }>(
    "/v1/agent-executions/runtime-catalog",
    {
      userContext,
    },
  );
  return response.catalog;
}

export async function listAgentExecutionSettlementAttempts(
  userContext: InternalUserContext,
  args?: { status?: AgentExecutionSettlementAttemptStatus; limit?: number },
) {
  const params = new URLSearchParams();
  if (args?.status) params.set("status", args.status);
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ settlements: AgentExecutionSettlementAttemptView[] }>(
    `/v1/internal/agent-executions/settlements${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.settlements;
}

export async function getAgentExecutionSettlementSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: AgentExecutionSettlementSummaryView }>(
    "/v1/internal/agent-executions/settlements/summary",
    { userContext },
  );
  return response.summary;
}

export async function retryAgentExecutionSettlement(userContext: InternalUserContext, executionId: string) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/internal/agent-executions/settlements/${executionId}/retry`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.execution;
}

export async function listAgentExecutionRuntimeSessions(
  userContext: InternalUserContext,
  args?: {
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
    limit?: number;
  },
) {
  const params = new URLSearchParams();
  if (args?.agentId) params.set("agentId", args.agentId);
  if (args?.ownerUserId) params.set("ownerUserId", args.ownerUserId);
  if (args?.state) params.set("state", args.state);
  if (args?.kind) params.set("kind", args.kind);
  if (typeof args?.staleOnly === "boolean") params.set("staleOnly", args.staleOnly ? "true" : "false");
  if (typeof args?.limit === "number") params.set("limit", String(args.limit));
  const response = await coreRequest<{ sessions: AgentExecutionRuntimeSessionView[] }>(
    `/v1/internal/agent-executions/runtime-sessions${params.size > 0 ? `?${params.toString()}` : ""}`,
    { userContext },
  );
  return response.sessions;
}

export async function sweepAgentExecutionRuntimeSessions(
  userContext: InternalUserContext,
  input?: {
    limit?: number;
    staleSeconds?: number;
    agentId?: string;
    ownerUserId?: string;
    state?: "running" | "completed" | "failed" | "requeued";
    kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
    staleOnly?: boolean;
  },
) {
  const response = await coreRequest<{ result: AgentExecutionRuntimeSessionSweepResult }>(
    "/v1/internal/agent-executions/runtime-sessions/sweep",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentExecutionLaunchPresets(
  userContext: InternalUserContext,
  input?: ListAgentExecutionLaunchPresetsInput,
) {
  const params = new URLSearchParams();
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size > 0 ? `/v1/agent-executions/presets?${params.toString()}` : "/v1/agent-executions/presets";
  const response = await coreRequest<{ presets: AgentExecutionLaunchPresetView[] }>(pathname, {
    userContext,
  });
  return response.presets;
}

export async function createAgentExecutionLaunchPreset(
  userContext: InternalUserContext,
  input: CreateAgentExecutionLaunchPresetInput,
) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>("/v1/agent-executions/presets", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.preset;
}

export async function updateAgentExecutionLaunchPreset(
  userContext: InternalUserContext,
  presetId: string,
  input: UpdateAgentExecutionLaunchPresetInput,
) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>(
    `/v1/agent-executions/presets/${encodeURIComponent(presetId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.preset;
}

export async function setAgentExecutionLaunchPresetAsDefault(userContext: InternalUserContext, presetId: string) {
  const response = await coreRequest<{ preset: AgentExecutionLaunchPresetView }>(
    `/v1/agent-executions/presets/${encodeURIComponent(presetId)}/default`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.preset;
}

export async function deleteAgentExecutionLaunchPreset(userContext: InternalUserContext, presetId: string) {
  await coreRequest<{ ok: true }>(`/v1/agent-executions/presets/${encodeURIComponent(presetId)}/delete`, {
    method: "POST",
    userContext,
  });
}

export async function createAgentExecution(userContext: InternalUserContext, input: CreateAgentExecutionInput) {
  const response = await coreRequest<{ execution: AgentExecutionView }>("/v1/agent-executions", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.execution;
}

export async function updateAgentExecutionStatus(
  userContext: InternalUserContext,
  executionId: string,
  input: UpdateAgentExecutionStatusInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function updateAgentExecutionCallbackRemediationPolicy(
  userContext: InternalUserContext,
  executionId: string,
  input: { policyKey?: "manual_only" | "safe_retry" | "balanced" | "aggressive" | null },
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/callback-remediation-policy`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function createAgentExecutionSubtask(
  userContext: InternalUserContext,
  executionId: string,
  input: CreateAgentExecutionSubtaskInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/subtasks`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function updateAgentExecutionSubtaskStatus(
  userContext: InternalUserContext,
  executionId: string,
  subtaskId: string,
  input: UpdateAgentExecutionSubtaskStatusInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/subtasks/${subtaskId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}

export async function requeueAgentExecution(userContext: InternalUserContext, executionId: string) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/requeue`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.execution;
}

export async function recoverStalePlatformExecutions(
  userContext: InternalUserContext,
  input?: { limit?: number; staleSeconds?: number; agentId?: string; ownerUserId?: string },
) {
  return coreRequest<PlatformExecutionRecoveryResult>("/v1/internal/agent-executions/recover-stale", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function runPlatformExecutorNow(
  userContext: InternalUserContext,
  input?: { limit?: number; agentId?: string; ownerUserId?: string },
) {
  return coreRequest<PlatformExecutionRunResult>("/v1/internal/agent-executions/run-platform-executor", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function addAgentExecutionArtifact(
  userContext: InternalUserContext,
  executionId: string,
  input: AddAgentExecutionArtifactInput,
) {
  const response = await coreRequest<{ execution: AgentExecutionView }>(
    `/v1/agent-executions/${executionId}/artifacts`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.execution;
}
