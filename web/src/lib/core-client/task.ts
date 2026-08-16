import {
  type CreateTaskAgentProposalInput,
  type DevelopmentQueueItemView,
  type TaskAgentProposalView,
  type CreateTaskInput,
  type InternalUserContext,
  type TaskApplicationView,
  type TaskLifecycleAction,
  type UpdateDevelopmentQueueStatusInput,
  type TaskView,
} from "@neuro/contracts";

import { coreRequest } from "./request";

export async function listTasks(userContext: InternalUserContext) {
  const response = await coreRequest<{ tasks: TaskView[] }>("/v1/tasks", {
    userContext,
  });
  return response.tasks;
}

export async function listMyTasks(userContext: InternalUserContext) {
  const response = await coreRequest<{ tasks: TaskView[] }>("/v1/tasks/mine", {
    userContext,
  });
  return response.tasks;
}

export async function createTask(userContext: InternalUserContext, input: CreateTaskInput) {
  return coreRequest("/v1/tasks", {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function listTaskApplications(userContext: InternalUserContext, taskId: string) {
  const response = await coreRequest<{ applications: TaskApplicationView[] }>(`/v1/tasks/${taskId}/applications`, {
    userContext,
  });
  return response.applications;
}

export async function listTaskAgentProposals(userContext: InternalUserContext, taskId: string) {
  const response = await coreRequest<{ proposals: TaskAgentProposalView[] }>(`/v1/tasks/${taskId}/agent-proposals`, {
    userContext,
  });
  return response.proposals;
}

export async function createTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  input: CreateTaskAgentProposalInput,
) {
  return coreRequest<{ proposal: TaskAgentProposalView }>(`/v1/tasks/${taskId}/agent-proposals`, {
    method: "POST",
    body: input,
    userContext,
  });
}

export async function acceptTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  proposalId: string,
) {
  return coreRequest<{ task: TaskView; proposal: TaskAgentProposalView; executionId: string }>(
    `/v1/tasks/${taskId}/agent-proposals/${proposalId}/accept`,
    {
      method: "POST",
      userContext,
    },
  );
}

export async function rejectTaskAgentProposal(
  userContext: InternalUserContext,
  taskId: string,
  proposalId: string,
) {
  return coreRequest<{ proposal: TaskAgentProposalView }>(`/v1/tasks/${taskId}/agent-proposals/${proposalId}/reject`, {
    method: "POST",
    userContext,
  });
}

export async function listDevelopmentQueue(userContext: InternalUserContext) {
  const response = await coreRequest<{ items: DevelopmentQueueItemView[] }>("/v1/development-queue/items", {
    userContext,
  });
  return response.items;
}

export async function updateDevelopmentQueueStatus(
  userContext: InternalUserContext,
  itemId: string,
  input: UpdateDevelopmentQueueStatusInput,
) {
  const response = await coreRequest<{ item: DevelopmentQueueItemView }>(
    `/v1/development-queue/items/${itemId}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.item;
}

export async function dispatchTaskNow(userContext: InternalUserContext, taskId: string) {
  return coreRequest(`/v1/tasks/${taskId}/dispatch`, {
    method: "POST",
    userContext,
  });
}

export async function applyForTask(
  userContext: InternalUserContext,
  taskId: string,
  statement: string,
  proposedEtaHours: number,
) {
  return coreRequest(`/v1/tasks/${taskId}/applications`, {
    method: "POST",
    body: { statement, proposedEtaHours },
    userContext,
  });
}

export async function updateTaskLifecycle(
  userContext: InternalUserContext,
  taskId: string,
  action: TaskLifecycleAction,
) {
  return coreRequest(`/v1/tasks/${taskId}/lifecycle`, {
    method: "POST",
    body: { action },
    userContext,
  });
}
