import type {
  AgentExecutionOwnerReliefRunActionView,
  AgentExecutionOwnerReliefHandoffDefaultView,
  AgentExecutionOwnerReliefRunHandoffView,
  AgentExecutionOwnerReliefRunHandoffTargetType,
  AgentExecutionOwnerReliefRunView,
  InternalUserContext,
  ListAgentExecutionOwnerReliefRunsInput,
  RecordAgentExecutionOwnerReliefRunActionInput,
  OpenAgentExecutionOwnerReliefRunHandoffInput,
  ResolveAgentExecutionOwnerReliefRunHandoffInput,
  FinalizeAgentExecutionOwnerReliefRunInput,
  StartAgentExecutionOwnerReliefRunInput,
  UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
} from "@neuro/contracts";

import { accountRequest } from "@/lib/account-request";

export async function listOperatorAgentExecutionOwnerReliefRuns(
  userContext: InternalUserContext,
  input?: ListAgentExecutionOwnerReliefRunsInput,
) {
  const params = new URLSearchParams();
  if (input?.ownerUserId) {
    params.set("ownerUserId", input.ownerUserId);
  }
  if (input?.agentId) {
    params.set("agentId", input.agentId);
  }
  if (input?.resultStatus) {
    params.set("resultStatus", input.resultStatus);
  }
  if (typeof input?.limit === "number" && Number.isFinite(input.limit)) {
    params.set("limit", String(Math.max(1, Math.floor(input.limit))));
  }
  const pathname = params.size
    ? `/v1/internal/agent-executions/owner-relief-runs?${params.toString()}`
    : "/v1/internal/agent-executions/owner-relief-runs";
  const response = await accountRequest<{
    runs: Array<AgentExecutionOwnerReliefRunView & { recentActions: AgentExecutionOwnerReliefRunActionView[] }>;
  }>(pathname, {
    userContext,
  });
  return response.runs;
}

export async function listOperatorAgentExecutionOwnerReliefHandoffDefaults(
  userContext: InternalUserContext,
) {
  const response = await accountRequest<{ defaults: AgentExecutionOwnerReliefHandoffDefaultView[] }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    {
      userContext,
    },
  );
  return response.defaults;
}

export async function startOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  input: StartAgentExecutionOwnerReliefRunInput,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    "/v1/internal/agent-executions/owner-relief-runs/start",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.run;
}

export async function recordOperatorAgentExecutionOwnerReliefRunAction(
  userContext: InternalUserContext,
  runId: string,
  input: RecordAgentExecutionOwnerReliefRunActionInput,
) {
  const response = await accountRequest<{ action: AgentExecutionOwnerReliefRunActionView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/actions`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.action;
}

export async function finalizeOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  runId: string,
  input: FinalizeAgentExecutionOwnerReliefRunInput,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/finalize`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.run;
}

export async function reopenOperatorAgentExecutionOwnerReliefRun(
  userContext: InternalUserContext,
  runId: string,
) {
  const response = await accountRequest<{ run: AgentExecutionOwnerReliefRunView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/reopen`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.run;
}

export async function openOperatorAgentExecutionOwnerReliefRunHandoff(
  userContext: InternalUserContext,
  runId: string,
  input: OpenAgentExecutionOwnerReliefRunHandoffInput,
) {
  const response = await accountRequest<{ handoff: AgentExecutionOwnerReliefRunHandoffView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/handoff/open`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.handoff;
}

export async function resolveOperatorAgentExecutionOwnerReliefRunHandoff(
  userContext: InternalUserContext,
  runId: string,
  input: ResolveAgentExecutionOwnerReliefRunHandoffInput,
) {
  const response = await accountRequest<{ handoff: AgentExecutionOwnerReliefRunHandoffView }>(
    `/v1/internal/agent-executions/owner-relief-runs/${encodeURIComponent(runId)}/handoff/resolve`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.handoff;
}

export async function saveOperatorAgentExecutionOwnerReliefHandoffDefault(
  userContext: InternalUserContext,
  input: UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
) {
  const response = await accountRequest<{ profile: AgentExecutionOwnerReliefHandoffDefaultView }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults",
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.profile;
}

export async function clearOperatorAgentExecutionOwnerReliefHandoffDefault(
  userContext: InternalUserContext,
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType,
) {
  await accountRequest<{ ok: true }>(
    "/v1/internal/agent-executions/owner-relief-handoff-defaults/clear",
    {
      method: "POST",
      body: { handoffTargetType },
      userContext,
    },
  );
}

