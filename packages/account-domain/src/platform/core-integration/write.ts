import type {
  AgentExecutionView,
  CreateAgentExecutionInput,
  CreateTaskInput,
  TaskView,
} from "@neuro/contracts";

import { env } from "@/env";

async function parseCoreError(response: Response) {
  const raw = await response.text();
  if (!raw) {
    return `Core request failed with ${response.status}`;
  }
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `Core request failed with ${response.status}`;
  } catch {
    return raw;
  }
}

async function coreUserWrite<T>(pathname: string, userId: string, body: unknown): Promise<T> {
  if (!env.internalApiToken) {
    throw new Error("INTERNAL_API_TOKEN is required for Email-Native core write integration");
  }

  const response = await fetch(`${env.platformInternalUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-token": env.internalApiToken,
      "x-neuro-user-id": userId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseCoreError(response));
  }

  return (await response.json()) as T;
}

export async function createCoreTaskAsUser(userId: string, input: CreateTaskInput) {
  const payload = await coreUserWrite<{ task: TaskView }>("/v1/tasks", userId, input);
  return payload.task;
}

export async function createCoreAgentExecutionAsUser(userId: string, input: CreateAgentExecutionInput) {
  const payload = await coreUserWrite<{ execution: AgentExecutionView }>("/v1/agent-executions", userId, input);
  return payload.execution;
}
