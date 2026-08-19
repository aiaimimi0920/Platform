import type {
  AddAgentExecutionArtifactInput,
  AgentExecutionCallbackType,
  AgentExecutionStatus,
  AgentExecutionView,
  ExternalAgentCallbackInput,
  UpdateAgentExecutionStatusInput,
} from "@neuro/contracts";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import * as schema from "@/db/schema";
import {
  buildStoredExternalCallbackReplayEnvelope,
  normalizeStoredExternalCallbackReplayEnvelope,
  resolveExternalCallbackMatch,
  summarizeExternalCallbackPayload,
} from "@/modules/agent-execution/callback-governance";
import {
  getExternalAgentExecution,
} from "@/modules/agent-execution/repository";
import {
  agentExecutions,
  agentExecutionCallbacks,
} from "@/modules/agent-execution/schema";
import { ConflictError, NotFoundError } from "@/platform/errors";

import {
  buildExternalCallbackPayloadHash,
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
  startEphemeralLockRenewal,
  terminalExecutionStatuses,
} from "./shared";
import { getAgentExecutionViewById } from "./views";

export async function runExternalCallbackWithIdempotency<T>(
  executionId: string,
  callbackId: string,
  fingerprint: {
    callbackType: AgentExecutionCallbackType;
    payloadHash: string;
  },
  operation: () => Promise<T>,
  onDuplicate: () => Promise<T>,
) {
  const findAcceptedCallback = async () => {
    const [accepted] = await db
      .select({
        callbackType: agentExecutionCallbacks.callbackType,
        payloadHash: agentExecutionCallbacks.payloadHash,
        replayPayload: agentExecutionCallbacks.replayPayload,
      })
      .from(agentExecutionCallbacks)
      .where(
        and(
          eq(agentExecutionCallbacks.executionId, executionId),
          eq(agentExecutionCallbacks.callbackId, callbackId),
          eq(agentExecutionCallbacks.status, "accepted"),
        ),
      )
      .limit(1);
    return accepted ?? null;
  };
  const assertMatchingFingerprint = (accepted: Awaited<ReturnType<typeof findAcceptedCallback>>) => {
    const replayPayload = normalizeStoredExternalCallbackReplayEnvelope(accepted?.replayPayload);
    const persistedPayloadHash = accepted?.payloadHash
      ?? (replayPayload ? buildExternalCallbackPayloadHash(replayPayload) : null);
    if (
      !accepted ||
      accepted.callbackType !== fingerprint.callbackType ||
      (persistedPayloadHash !== null && persistedPayloadHash !== fingerprint.payloadHash)
    ) {
      throw new ConflictError("External callback id was reused with a different type or payload");
    }
  };

  const persisted = await findAcceptedCallback();
  if (persisted) {
    assertMatchingFingerprint(persisted);
    return onDuplicate();
  }

  const key = getExternalCallbackIdempotencyKey(executionId, callbackId);
  const claimToken = crypto.randomUUID();
  const pendingValue = JSON.stringify({ state: "pending", claimToken, ...fingerprint });
  const processedValue = JSON.stringify({ state: "processed", ...fingerprint });
  const claimed = await redis.set(key, pendingValue, "EX", externalCallbackPendingTtlSeconds, "NX");
  if (claimed !== "OK") {
    const accepted = await findAcceptedCallback();
    if (accepted) {
      assertMatchingFingerprint(accepted);
      return onDuplicate();
    }
    const rawState = await redis.get(key);
    let state: { state?: unknown; callbackType?: unknown; payloadHash?: unknown } | null = null;
    try {
      state = rawState
        ? JSON.parse(rawState) as { state?: unknown; callbackType?: unknown; payloadHash?: unknown }
        : null;
    } catch {
      state = null;
    }
    if (
      state?.callbackType !== fingerprint.callbackType ||
      state?.payloadHash !== fingerprint.payloadHash
    ) {
      throw new ConflictError("External callback id was reused with a different type or payload");
    }
    if (state?.state === "pending") {
      throw new ConflictError("External callback is already being processed");
    }
    return onDuplicate();
  }

  const stopClaimRenewal = startEphemeralLockRenewal(
    key,
    pendingValue,
    externalCallbackPendingTtlSeconds,
  );
  try {
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      await redis
        .eval(
          `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            end
            return 0
          `,
          1,
          key,
          pendingValue,
        )
        .catch(() => undefined);
      const accepted = await findAcceptedCallback();
      if (accepted) {
        assertMatchingFingerprint(accepted);
        return onDuplicate();
      }
      throw error;
    }
    await redis
      .eval(
        `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
          end
          return nil
        `,
        1,
        key,
        pendingValue,
        processedValue,
        externalCallbackProcessedTtlSeconds,
      )
      .catch(() => undefined);
    return result;
  } finally {
    stopClaimRenewal();
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
  if (!replayPayload) {
    throw new Error("Status callback replay payload could not be normalized");
  }
  const payloadHash = buildExternalCallbackPayloadHash(replayPayload);
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    { callbackType: "status", payloadHash },
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
  if (!replayPayload) {
    throw new Error("Artifact callback replay payload could not be normalized");
  }
  const payloadHash = buildExternalCallbackPayloadHash(replayPayload);
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    { callbackType: "artifact", payloadHash },
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
  if (!replayPayload) {
    throw new Error("Heartbeat callback replay payload could not be normalized");
  }
  const payloadHash = buildExternalCallbackPayloadHash(replayPayload);
  return runExternalCallbackWithIdempotency(
    execution.id,
    callbackId,
    { callbackType: "heartbeat", payloadHash },
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
