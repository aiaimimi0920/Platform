import type {
  AgentExecutionView,
  CreateAgentExecutionInput,
  CreateTaskInput,
  TaskView,
} from "@neuro/contracts";
import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";

import { env } from "@/env";

function parseCoreError(status: number, raw: string) {
  if (!raw) {
    return `Core request failed with ${status}`;
  }
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || `Core request failed with ${status}`;
  } catch {
    return raw;
  }
}

async function coreUserWrite<T>(pathname: string, userId: string, body: unknown): Promise<T> {
  if (!env.internalApiToken) {
    throw new Error("INTERNAL_API_TOKEN is required for Email-Native core write integration");
  }

  const { response, text } = await requestInternalText(
    `${env.platformInternalUrl}${pathname}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-api-token": env.internalApiToken,
        "x-neuro-user-id": userId,
      },
      body: JSON.stringify(body),
    },
    {
      timeoutMs: env.coreInternalFetchTimeoutMs,
      timeoutMessage: `Core write request timed out: ${pathname}`,
    },
  );

  if (!response.ok) {
    throw new Error(parseCoreError(response.status, text));
  }

  return JSON.parse(text) as T;
}

export async function createCoreTaskAsUser(userId: string, input: CreateTaskInput) {
  const payload = await coreUserWrite<{ task: TaskView }>("/v1/tasks", userId, input);
  return payload.task;
}

export async function createCoreAgentExecutionAsUser(userId: string, input: CreateAgentExecutionInput) {
  const payload = await coreUserWrite<{ execution: AgentExecutionView }>("/v1/agent-executions", userId, input);
  return payload.execution;
}
