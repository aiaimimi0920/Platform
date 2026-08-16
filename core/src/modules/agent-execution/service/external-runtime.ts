import type {
  AddAgentExecutionArtifactInput,
  AgentExecutionStatus,
  AgentExecutionView,
  ExternalAgentCallbackInput,
  UpdateAgentExecutionStatusInput,
} from "@neuro/contracts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import * as schema from "@/db/schema";
import {
  buildStoredExternalCallbackReplayEnvelope,
  resolveExternalCallbackMatch,
  summarizeExternalCallbackPayload,
} from "@/modules/agent-execution/callback-governance";
import {
  getExternalAgentExecution,
} from "@/modules/agent-execution/repository";
import {
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { ConflictError, NotFoundError } from "@/platform/errors";

import {
  getExecutionCallbackRemediationPolicyKey,
  getExternalCallbackIdempotencyKey,
  recordExternalCallbackAudit,
} from "./callback-audit";
import {
  addOwnedAgentExecutionArtifactInTx,
  updateOwnedAgentExecutionStatusInTx,
} from "./executions";
import { settleExecutionById } from "./settlement";
import {
  externalCallbackPendingTtlSeconds,
  externalCallbackProcessedTtlSeconds,
  now,
  terminalExecutionStatuses,
} from "./shared";
import { getAgentExecutionViewById } from "./views";

export async function runExternalCallbackWithIdempotency<T>(
  executionId: string,
  callbackId: string,
  operation: () => Promise<T>,
  onDuplicate: () => Promise<T>,
) {
  const key = getExternalCallbackIdempotencyKey(executionId, callbackId);
  const claimed = await redis.set(key, "pending", "EX", externalCallbackPendingTtlSeconds, "NX");
  if (claimed !== "OK") {
    const status = await redis.get(key);
    if (status === "pending") {
      throw new ConflictError("External callback is already being processed");
    }
    return onDuplicate();
  }

  try {
    const result = await operation();
    await redis.set(key, "processed", "EX", externalCallbackProcessedTtlSeconds);
    return result;
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}

export async function assertExternalAgentExecutionAccess(
  executionId: string,
  callbackSecret: string,
  callbackVersion: number,
) {
  const row = await getExternalAgentExecution(executionId);
  if (!row) {
    throw new NotFoundError("Agent execution not found");
  }
  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external agent executions support callback updates");
  }
  if (!row.agent.enabled) {
    throw new ConflictError("External agent is disabled");
  }
  const currentTime = now();
  const matched = resolveExternalCallbackMatch(row.agent, {
    callbackSecret,
    callbackVersion,
    now: currentTime,
  });

  if (!matched) {
    throw new ConflictError("External callback protocol version does not match agent configuration");
  }

  return {
    ...row,
    matchedProtocolVersion: matched.matchedProtocolVersion,
    usedPreviousProtocol: matched.usedPreviousProtocol,
    matchedSecretVersion: matched.matchedSecretVersion,
    usedPreviousSecret: matched.usedPreviousSecret,
  };
}

export async function touchExternalExecutionCallback(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
  options: { heartbeat?: boolean; statusNote?: string },
) {
  const timestamp = now();
  const [updated] = await tx
    .update(agentExecutions)
    .set({
      updatedAt: timestamp,
      lastExternalCallbackAt: timestamp,
      lastHeartbeatAt: options.heartbeat ? timestamp : undefined,
      statusNote: options.statusNote ?? undefined,
    })
    .where(eq(agentExecutions.id, executionId))
    .returning();

  return updated;
}

export async function updateExternalAgentExecutionStatus(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: UpdateAgentExecutionStatusInput,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload(input);
  const replayPayload = buildStoredExternalCallbackReplayEnvelope({
    type: "status",
    status: input.status,
    statusNote: input.statusNote,
    resultSummary: input.resultSummary,
  });
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      await db.transaction(async (tx) => {
        await updateOwnedAgentExecutionStatusInTx(tx, execution, input);
        await touchExternalExecutionCallback(tx, execution.id, { statusNote: input.statusNote });
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "status",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      if (input.status === "completed") {
        return settleExecutionById(execution.id);
      }
      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "status",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function addExternalAgentExecutionArtifact(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: AddAgentExecutionArtifactInput,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload(input);
  const replayPayload = buildStoredExternalCallbackReplayEnvelope(input);
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      await db.transaction(async (tx) => {
        await addOwnedAgentExecutionArtifactInTx(tx, execution, input);
        await touchExternalExecutionCallback(tx, execution.id, {});
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "artifact",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "artifact",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function recordExternalAgentExecutionHeartbeat(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  statusNote?: string,
): Promise<AgentExecutionView> {
  const access = await assertExternalAgentExecutionAccess(executionId, callbackSecret, callbackVersion);
  const execution = access.execution;
  const effectiveRemediationPolicyKey = getExecutionCallbackRemediationPolicyKey(access);
  const payloadSummary = summarizeExternalCallbackPayload({ type: "heartbeat", statusNote });
  const replayPayload = buildStoredExternalCallbackReplayEnvelope({
    type: "heartbeat",
    statusNote,
  });
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    async () => {
      const latestExecution = await db.transaction(async (tx) => {
        const [currentExecution] = await tx
          .select()
          .from(agentExecutions)
          .where(eq(agentExecutions.id, execution.id));

        if (!currentExecution) {
          throw new NotFoundError("Agent execution not found");
        }

        if (terminalExecutionStatuses.has(currentExecution.status as AgentExecutionStatus)) {
          return currentExecution;
        }

        const updatedExecution = await touchExternalExecutionCallback(tx, execution.id, {
          heartbeat: true,
          statusNote,
        });
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "heartbeat",
          status: "accepted",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });

        return updatedExecution ?? currentExecution;
      });

      if (terminalExecutionStatuses.has(latestExecution.status as AgentExecutionStatus)) {
        return getAgentExecutionViewById(latestExecution.id);
      }

      return getAgentExecutionViewById(execution.id);
    },
    async () => {
      await db.transaction(async (tx) => {
        await recordExternalCallbackAudit({
          tx,
          executionId: execution.id,
          agentId: execution.agentId,
          remediationPolicyKey: effectiveRemediationPolicyKey,
          callbackId,
          callbackType: "heartbeat",
          status: "duplicate",
          callbackVersion,
          secretVersion: access.matchedSecretVersion,
          usedPreviousProtocol: access.usedPreviousProtocol,
          usedPreviousSecret: access.usedPreviousSecret,
          callbackTimestamp,
          payloadSummary,
          replayPayload,
        });
      });
      return getAgentExecutionViewById(execution.id);
    },
  );
}

export async function handleExternalAgentCallback(
  executionId: string,
  callbackSecret: string,
  callbackId: string,
  callbackVersion: number,
  callbackTimestamp: Date | null,
  input: ExternalAgentCallbackInput,
): Promise<AgentExecutionView> {
  if (input.type === "heartbeat") {
    return recordExternalAgentExecutionHeartbeat(
      executionId,
      callbackSecret,
      callbackId,
      callbackVersion,
      callbackTimestamp,
      input.statusNote,
    );
  }
  if (input.type === "status") {
    return updateExternalAgentExecutionStatus(executionId, callbackSecret, callbackId, callbackVersion, callbackTimestamp, {
      status: input.status,
      statusNote: input.statusNote,
      resultSummary: input.resultSummary,
    });
  }
  return addExternalAgentExecutionArtifact(
    executionId,
    callbackSecret,
    callbackId,
    callbackVersion,
    callbackTimestamp,
    input.artifact,
  );
}
