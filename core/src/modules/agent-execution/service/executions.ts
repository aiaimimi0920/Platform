import type {
  AddAgentExecutionArtifactInput,
  AgentMarketplaceInvocationSnapshotView,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionStepStatus,
  AgentExecutionSubtaskStatus,
  AgentExecutionStatus,
  AgentExecutionView,
  AgentSourceType,
  CreateAgentExecutionInput,
  CreateAgentExecutionSubtaskInput,
  PlatformExecutionPhase,
  UpdateAgentExecutionCallbackRemediationPolicyInput,
  UpdateAgentExecutionSubtaskStatusInput,
  UpdateAgentExecutionStatusInput,
} from "@neuro/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getOwnedAgentExecution,
  getOwnedRunnableAgent,
  listAgentExecutionsByOwner,
  listSuppliedMarketplaceAgentExecutions,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionArtifacts,
  agentExecutionSubtasks,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { getOwnedAgent } from "@/modules/agent-registry/repository";
import { ConflictError, NotFoundError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { toStoredMarketplaceInvocationSnapshot } from "./managed-light";
import {
  buildExecutionOutputEnvelope,
  getDerivedRuntimeTargetArtifactCount,
  getInitialRuntimeState,
  isManagedLightExecutionHostingMode,
  normalizeObjectiveChecklist,
  resolveManagedLightCapabilityRow,
  resolveRuntimeProfile,
} from "./pricing";
import {
  buildExecutionRemediationPolicyMap,
  normalizeExecutionCallbackRemediationPolicyOverrideKey,
  resolveExecutionCallbackRemediationPolicyMetadata,
} from "./remediation";
import {
  createExecutionRunInTx,
  finishExecutionRunInTx,
  recordExecutionStepInTx,
} from "./runs";
import {
  createRuntimeSessionInTx,
  finalizeRuntimeSessionInTx,
  touchRuntimeSessionInTx,
} from "./runtime-sessions";
import {
  ensureRuntimeManagedSubtasksInTx,
  syncRuntimeManagedSubtasksInTx,
} from "./runtime-subtasks";
import {
  ensureExecutionSettlementPlanInTx,
  settleExecutionById,
} from "./settlement";
import {
  now,
  subtaskTransitionMap,
  terminalExecutionStatuses,
  transitionMap,
} from "./shared";
import {
  buildArtifactBundleOutputEnvelope,
  buildArtifactMap,
  buildCallbackMap,
  buildRunMap,
  buildRuntimeSessionMap,
  buildSettlementMap,
  buildStatusReportOutputEnvelope,
  buildStepMap,
  buildSubtaskMap,
  getAgentExecutionEventName,
  getAgentExecutionViewById,
  toAgentExecutionView,
  toStoredExecutionOutputEnvelope,
} from "./views";

export async function listOwnedAgentExecutions(ownerUserId: string): Promise<AgentExecutionView[]> {
  const rows = await listAgentExecutionsByOwner(ownerUserId);
  const ownerMap = new Map(rows.map((row) => [row.id, row.ownerUserId]));
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
      buildArtifactMap(rows.map((row) => row.id)),
      buildStepMap(rows.map((row) => row.id)),
      buildSubtaskMap(rows.map((row) => row.id), ownerMap, ownerUserId),
      buildRuntimeSessionMap(rows),
      buildCallbackMap(rows.map((row) => row.id)),
      buildRunMap(rows.map((row) => row.id)),
      buildSettlementMap(rows.map((row) => row.id)),
      buildExecutionRemediationPolicyMap(rows),
    ]);
  return rows.map((row) =>
    toAgentExecutionView(
      row,
      ownerUserId,
      remediationPolicyMap.get(row.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: row,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(row.id) ?? [],
      stepMap.get(row.id) ?? [],
      subtaskMap.get(row.id) ?? [],
      runtimeSessionMap.get(row.id) ?? [],
      callbackMap.get(row.id) ?? [],
      runMap.get(row.id) ?? [],
      settlementMap.get(row.id) ?? null,
    ),
  );
}

export async function listSuppliedAgentMarketplaceExecutions(
  supplierUserId: string,
  limit = 20,
): Promise<AgentExecutionView[]> {
  const rows = await listSuppliedMarketplaceAgentExecutions(supplierUserId, limit);
  const ownerMap = new Map(rows.map((row) => [row.id, row.ownerUserId]));
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
      buildArtifactMap(rows.map((row) => row.id)),
      buildStepMap(rows.map((row) => row.id)),
      buildSubtaskMap(rows.map((row) => row.id), ownerMap, supplierUserId),
      buildRuntimeSessionMap(rows),
      buildCallbackMap(rows.map((row) => row.id)),
      buildRunMap(rows.map((row) => row.id)),
      buildSettlementMap(rows.map((row) => row.id)),
      buildExecutionRemediationPolicyMap(rows),
    ]);

  return rows.map((row) =>
    toAgentExecutionView(
      row,
      supplierUserId,
      remediationPolicyMap.get(row.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: row,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(row.id) ?? [],
      stepMap.get(row.id) ?? [],
      subtaskMap.get(row.id) ?? [],
      runtimeSessionMap.get(row.id) ?? [],
      callbackMap.get(row.id) ?? [],
      runMap.get(row.id) ?? [],
      settlementMap.get(row.id) ?? null,
    ),
  );
}

export async function createOwnedAgentExecution(
  ownerUserId: string,
  input: CreateAgentExecutionInput,
): Promise<AgentExecutionView> {
  const agent = await getOwnedRunnableAgent(ownerUserId, input.agentId);
  if (!agent) {
    throw new NotFoundError("Agent not found or not owned by current user");
  }
  if (!agent.enabled) {
    throw new ConflictError("Agent is disabled");
  }

  return db.transaction(async (tx) => createOwnedAgentExecutionInTx(tx, ownerUserId, input));
}

export async function createOwnedAgentExecutionInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
  input: CreateAgentExecutionInput & {
    taskId?: string | null;
    marketplaceInvocation?: AgentMarketplaceInvocationSnapshotView | null;
  },
): Promise<AgentExecutionView> {
  const [agentRow] = await tx
    .select({
      sourceType: schema.agents.sourceType,
      hostingMode: schema.agents.hostingMode,
      externalCallbackRemediationPolicy: schema.agents.externalCallbackRemediationPolicy,
    })
    .from(schema.agents)
    .where(eq(schema.agents.id, input.agentId));
  if (!agentRow) {
    throw new NotFoundError("Agent not found");
  }

  const requestedCallbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    input.callbackRemediationPolicyKey,
  );
  if (agentRow.sourceType !== "external" && requestedCallbackRemediationPolicyKey) {
    throw new ConflictError("Only external executions support callback remediation policy override");
  }
  const managedLightCapability = isManagedLightExecutionHostingMode(agentRow.hostingMode)
    ? await resolveManagedLightCapabilityRow({
        agentId: input.agentId,
        capabilityId: input.capabilityId ?? null,
        connection: tx,
      })
    : null;

  const createdAt = now();
  const runtimeState = getInitialRuntimeState(agentRow.sourceType, agentRow.hostingMode);
  const objectiveChecklist = normalizeObjectiveChecklist(null, input.objective);
  const runtimeProfile = resolveRuntimeProfile(
    agentRow.sourceType === "platform"
      ? ((input.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline")
      : "baseline",
  );
  const derivedTargetArtifactCount = getDerivedRuntimeTargetArtifactCount({
    objectiveChecklist,
    runtimeProfile,
  });
  const initialOutputEnvelope = buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution queued",
    summary:
      agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)
        ? "Platform executor will claim this execution in a later worker tick."
        : isManagedLightExecutionHostingMode(agentRow.hostingMode)
          ? "Platform light dispatcher will invoke the hosted runtime in a later worker tick."
          : "Open Agent dispatcher will forward this execution and wait for callback updates.",
    generatedAt: createdAt,
    payload: {
      sourceType: agentRow.sourceType,
      hostingMode: agentRow.hostingMode,
      runtimeProfile: runtimeProfile.key,
      targetArtifactCount: derivedTargetArtifactCount,
      objectiveChecklist,
      capabilityId: managedLightCapability?.id ?? null,
      inputResourcePayload: input.inputResourcePayload ?? null,
      normalizedResourcePayload: null,
      outputResourcePayload: null,
      taskId: input.taskId ?? null,
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(input.marketplaceInvocation),
      phase: runtimeState.executorPhase,
      progressPercent: runtimeState.progressPercent,
    },
  });
  const [created] = await tx
    .insert(agentExecutions)
    .values({
      id: crypto.randomUUID(),
      ownerUserId,
      agentId: input.agentId,
      capabilityId: managedLightCapability?.id ?? null,
      taskId: input.taskId ?? null,
      title: input.title,
      objective: input.objective,
      objectiveChecklist,
      inputResourcePayload: input.inputResourcePayload ?? null,
      normalizedResourcePayload: null,
      outputResourcePayload: null,
      marketplaceInvocation: toStoredMarketplaceInvocationSnapshot(input.marketplaceInvocation),
      runtimeProfileKey: runtimeProfile.key,
      callbackRemediationPolicyKey: requestedCallbackRemediationPolicyKey,
      targetArtifactCount: derivedTargetArtifactCount,
      status: "queued",
      statusNote: null,
      resultSummary: null,
      ...toStoredExecutionOutputEnvelope(initialOutputEnvelope),
      executorPhase: runtimeState.executorPhase,
      progressPercent: runtimeState.progressPercent,
      autoRecoveryCount: 0,
      maxAutoRecoveryCount: runtimeProfile.maxAutoRecoveryCount,
      recoveryExhaustedAt: null,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      submittedAt: null,
      completedAt: null,
      lastExternalCallbackAt: null,
      lastHeartbeatAt: null,
    })
    .returning();

  await recordExecutionStepInTx(tx, {
    executionId: created.id,
    kind: "phase",
    phase: runtimeState.executorPhase,
    title: "Execution queued",
    detail:
      agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)
        ? "Platform executor will claim this execution in a later worker tick."
        : isManagedLightExecutionHostingMode(agentRow.hostingMode)
          ? "Platform light dispatcher will invoke the hosted runtime in a later worker tick."
          : "Open Agent dispatcher will forward this execution and wait for callback updates.",
    status: "info",
    progressPercent: runtimeState.progressPercent,
  });

  if (agentRow.sourceType === "platform" && !isManagedLightExecutionHostingMode(agentRow.hostingMode)) {
    await ensureRuntimeManagedSubtasksInTx(tx, created);
  }

  await enqueueOutboxEvent(
    "agentExecution.created",
    {
      executionId: created.id,
      ownerUserId: created.ownerUserId,
      agentId: created.agentId,
      taskId: created.taskId,
    },
    tx,
  );

  return toAgentExecutionView(
    created,
    ownerUserId,
    resolveExecutionCallbackRemediationPolicyMetadata({
      execution: created,
      agentSourceType: agentRow.sourceType as AgentSourceType,
      agentPolicyKey: agentRow.externalCallbackRemediationPolicy,
    }),
    [],
    [],
    [],
    [],
    [],
    [],
  );
}

export function validateArtifactInput(input: AddAgentExecutionArtifactInput) {
  if (input.kind === "link" && !input.url?.trim()) {
    throw new ConflictError("Link artifact requires a URL");
  }
}

export async function addOwnedAgentExecutionArtifactInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  input: AddAgentExecutionArtifactInput,
) {
  const createdAt = now();
  const [updatedExecution] = await tx
    .update(agentExecutions)
    .set({
      updatedAt: createdAt,
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();
  const [artifact] = await tx
    .insert(agentExecutionArtifacts)
    .values({
      id: crypto.randomUUID(),
      executionId: execution.id,
      kind: input.kind,
      title: input.title,
      url: input.url?.trim() || null,
      summary: input.summary?.trim() || null,
      createdAt,
    })
    .returning();

  await recordExecutionStepInTx(tx, {
    executionId: execution.id,
    kind: "artifact",
    phase: updatedExecution?.executorPhase as PlatformExecutionPhase | null,
    title: `Artifact added: ${artifact.title}`,
    detail: artifact.summary ?? artifact.url ?? null,
    status: "completed",
    progressPercent: updatedExecution?.progressPercent ?? execution.progressPercent,
  });

  await enqueueOutboxEvent(
    "agentExecution.artifactAdded",
    {
      executionId: execution.id,
      ownerUserId: execution.ownerUserId,
      agentId: execution.agentId,
      taskId: execution.taskId,
      artifactId: artifact.id,
      artifactTitle: artifact.title,
    },
    tx,
  );

  const artifactRows = await tx
    .select()
    .from(agentExecutionArtifacts)
    .where(eq(agentExecutionArtifacts.executionId, execution.id))
    .orderBy(asc(agentExecutionArtifacts.createdAt));

  const outputEnvelope = buildArtifactBundleOutputEnvelope({
    executionId: execution.id,
    artifacts: artifactRows,
    generatedAt: createdAt,
  });

  const [executionRow] = await tx
    .update(agentExecutions)
    .set({
      ...toStoredExecutionOutputEnvelope(outputEnvelope),
      updatedAt: createdAt,
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();

  return executionRow ?? updatedExecution ?? execution;
}

export async function updateOwnedAgentExecutionStatusInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
  input: UpdateAgentExecutionStatusInput,
) {
  const currentStatus = execution.status as AgentExecutionStatus;
  if (currentStatus === input.status) {
    return execution;
  }
  if (!transitionMap[currentStatus].includes(input.status)) {
    throw new ConflictError(`Cannot move agent execution from ${currentStatus} to ${input.status}`);
  }

  const updatedAt = now();
  const outputEnvelope =
    input.resultSummary || input.statusNote || ["submitted", "completed", "failed", "cancelled"].includes(input.status)
      ? buildStatusReportOutputEnvelope({
          executionId: execution.id,
          status: input.status,
          statusNote: input.statusNote ?? execution.statusNote,
          resultSummary: input.resultSummary ?? execution.resultSummary,
          generatedAt: updatedAt,
        })
      : null;
  const hasPlatformRuntime = execution.executorPhase !== null || execution.progressPercent !== null;
  const [updated] = await tx
    .update(agentExecutions)
    .set({
      status: input.status,
      statusNote: input.statusNote ?? execution.statusNote,
      resultSummary: input.resultSummary ?? execution.resultSummary,
      executorPhase: hasPlatformRuntime
        ? input.status === "running"
          ? ((execution.executorPhase ?? "prepare") as PlatformExecutionPhase)
          : input.status === "submitted"
            ? ("finalize" as PlatformExecutionPhase)
            : input.status === "completed"
              ? ("done" as PlatformExecutionPhase)
              : input.status === "failed" || input.status === "cancelled"
                ? ((execution.executorPhase ?? "done") as PlatformExecutionPhase)
                : execution.executorPhase
        : execution.executorPhase,
      progressPercent: hasPlatformRuntime
        ? input.status === "running"
          ? Math.max(execution.progressPercent ?? 0, 10)
          : input.status === "submitted"
            ? Math.max(execution.progressPercent ?? 0, 90)
            : input.status === "completed"
              ? 100
              : input.status === "failed" || input.status === "cancelled"
                ? execution.progressPercent ?? 0
                : execution.progressPercent
        : execution.progressPercent,
      updatedAt,
      startedAt: input.status === "running" ? execution.startedAt ?? updatedAt : execution.startedAt,
      submittedAt: input.status === "submitted" ? execution.submittedAt ?? updatedAt : execution.submittedAt,
      completedAt:
        input.status === "completed" || input.status === "failed" || input.status === "cancelled"
          ? execution.completedAt ?? updatedAt
          : execution.completedAt,
      ...toStoredExecutionOutputEnvelope(outputEnvelope),
    })
    .where(eq(agentExecutions.id, execution.id))
    .returning();

  if (updated.taskId) {
    const [linkedTask] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, updated.taskId));
    if (linkedTask && linkedTask.assignedUserId === updated.ownerUserId) {
      if (input.status === "running" && linkedTask.status === "assigned") {
        await tx.update(schema.tasks).set({ status: "in_progress" }).where(eq(schema.tasks.id, linkedTask.id));
        await enqueueOutboxEvent("task.started", { taskId: linkedTask.id, actorUserId: updated.ownerUserId }, tx);
      }

      if (
        (input.status === "submitted" || input.status === "completed") &&
        ["assigned", "in_progress"].includes(linkedTask.status)
      ) {
        await tx.update(schema.tasks).set({ status: "submitted" }).where(eq(schema.tasks.id, linkedTask.id));
        await enqueueOutboxEvent("task.submitted", { taskId: linkedTask.id, actorUserId: updated.ownerUserId }, tx);
      }
    }
  }

  if (hasPlatformRuntime) {
    if (input.status === "running") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "claim");
      await touchRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote,
      });
    } else if (input.status === "submitted") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "advance");
      await touchRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote,
      });
    } else if (input.status === "completed") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "complete");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "completed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution completed successfully.",
      });
    } else if (input.status === "failed") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "failed");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "failed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution failed.",
      });
    } else if (input.status === "cancelled") {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "cancelled");
      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "platform_executor",
        state: "failed",
        endedPhase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
        note: updated.statusNote ?? "Execution cancelled.",
      });
    }
  }

  await recordExecutionStepInTx(tx, {
    executionId: updated.id,
    kind: "status",
    phase: (updated.executorPhase as PlatformExecutionPhase | null) ?? null,
    title: `Execution moved to ${updated.status}`,
    detail: input.statusNote ?? null,
    status:
      input.status === "failed" || input.status === "cancelled"
        ? "failed"
        : ("completed" as AgentExecutionStepStatus),
    progressPercent: updated.progressPercent,
  });

  await enqueueOutboxEvent(
    getAgentExecutionEventName(input.status),
    {
      executionId: updated.id,
      ownerUserId: updated.ownerUserId,
      agentId: updated.agentId,
      status: updated.status,
    },
    tx,
  );

  if (input.status === "completed") {
    await ensureExecutionSettlementPlanInTx(tx, updated);
  }

  return updated;
}

export async function addOwnedAgentExecutionArtifact(
  ownerUserId: string,
  executionId: string,
  input: AddAgentExecutionArtifactInput,
): Promise<AgentExecutionView> {
  validateArtifactInput(input);

  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  await db.transaction(async (tx) => {
    await addOwnedAgentExecutionArtifactInTx(tx, execution, input);
  });

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionStatus(
  ownerUserId: string,
  executionId: string,
  input: UpdateAgentExecutionStatusInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  if ((execution.status as AgentExecutionStatus) === input.status) {
    const ownerMap = new Map([[execution.id, execution.ownerUserId]]);
    const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
      await Promise.all([
        buildArtifactMap([execution.id]),
        buildStepMap([execution.id]),
        buildSubtaskMap([execution.id], ownerMap, ownerUserId),
        buildRuntimeSessionMap([execution]),
        buildCallbackMap([execution.id]),
        buildRunMap([execution.id]),
        buildSettlementMap([execution.id]),
        buildExecutionRemediationPolicyMap([execution]),
      ]);
    return toAgentExecutionView(
      execution,
      ownerUserId,
      remediationPolicyMap.get(execution.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(execution.id) ?? [],
      stepMap.get(execution.id) ?? [],
      subtaskMap.get(execution.id) ?? [],
      runtimeSessionMap.get(execution.id) ?? [],
      callbackMap.get(execution.id) ?? [],
      runMap.get(execution.id) ?? [],
      settlementMap.get(execution.id) ?? null,
    );
  }
  await db.transaction(async (tx) => {
    await updateOwnedAgentExecutionStatusInTx(tx, execution, input);
  });

  if (input.status === "completed") {
    return settleExecutionById(execution.id);
  }

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionCallbackRemediationPolicy(
  ownerUserId: string,
  executionId: string,
  input: UpdateAgentExecutionCallbackRemediationPolicyInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Terminal executions cannot update callback remediation policy");
  }

  const agent = await getOwnedAgent(ownerUserId, execution.agentId);
  if (!agent) {
    throw new NotFoundError("Linked agent not found");
  }
  if (agent.sourceType !== "external") {
    throw new ConflictError("Only external executions support callback remediation policy override");
  }

  const nextPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(input.policyKey);
  const currentPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(execution.callbackRemediationPolicyKey);
  if (currentPolicyKey === nextPolicyKey) {
    return getAgentExecutionViewById(execution.id);
  }

  await db.transaction(async (tx) => {
    const timestamp = now();
    await tx
      .update(agentExecutions)
      .set({
        callbackRemediationPolicyKey: nextPolicyKey,
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: nextPolicyKey
        ? `Execution callback policy overridden to ${nextPolicyKey}`
        : "Execution callback policy reset to agent default",
      detail: nextPolicyKey
        ? `Execution now overrides the agent callback remediation policy with '${nextPolicyKey}'.`
        : "Execution now inherits the linked agent callback remediation policy again.",
      status: "completed",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function createOwnedAgentExecutionSubtask(
  ownerUserId: string,
  executionId: string,
  input: CreateAgentExecutionSubtaskInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Cannot add subtasks to a terminal execution");
  }

  const title = input.title.trim();
  const detail = input.detail?.trim() || null;
  const parentSubtaskId = input.parentSubtaskId?.trim() || null;
  if (!title) {
    throw new ConflictError("Subtask title is required");
  }

  await db.transaction(async (tx) => {
    if (parentSubtaskId) {
      const [parentSubtask] = await tx
        .select()
        .from(agentExecutionSubtasks)
        .where(and(eq(agentExecutionSubtasks.id, parentSubtaskId), eq(agentExecutionSubtasks.executionId, execution.id)));
      if (!parentSubtask) {
        throw new NotFoundError("Parent subtask not found");
      }
      if (parentSubtask.managedByRuntime) {
        throw new ConflictError("Runtime-managed subtasks cannot accept owner-created children");
      }
    }

    const [sortRow] = await tx
      .select({
        maxSortOrder: sql<number>`coalesce(max(${agentExecutionSubtasks.sortOrder}), -1)::int`,
      })
      .from(agentExecutionSubtasks)
      .where(eq(agentExecutionSubtasks.executionId, execution.id));

    const timestamp = now();
    await tx.insert(agentExecutionSubtasks).values({
      id: crypto.randomUUID(),
      executionId: execution.id,
      parentSubtaskId,
      title,
      detail,
      status: "pending",
      managedByRuntime: false,
      runtimePhase: null,
      sortOrder: Number(sortRow?.maxSortOrder ?? -1) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    });

    await tx
      .update(agentExecutions)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `Subtask added: ${title}`,
      detail,
      status: "info",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function updateOwnedAgentExecutionSubtaskStatus(
  ownerUserId: string,
  executionId: string,
  subtaskId: string,
  input: UpdateAgentExecutionSubtaskStatusInput,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (terminalExecutionStatuses.has(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Cannot update subtasks on a terminal execution");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from agent_execution_subtasks where id = ${subtaskId} for update`);
    const [subtask] = await tx
      .select()
      .from(agentExecutionSubtasks)
      .where(and(eq(agentExecutionSubtasks.id, subtaskId), eq(agentExecutionSubtasks.executionId, execution.id)));
    if (!subtask) {
      throw new NotFoundError("Execution subtask not found");
    }
    if (subtask.managedByRuntime) {
      throw new ConflictError("Runtime-managed subtasks cannot be updated manually");
    }

    const currentStatus = subtask.status as AgentExecutionSubtaskStatus;
    if (currentStatus !== input.status && !subtaskTransitionMap[currentStatus].includes(input.status)) {
      throw new ConflictError(`Cannot move execution subtask from ${currentStatus} to ${input.status}`);
    }

    const timestamp = now();
    const detail = input.detail?.trim() || subtask.detail || null;
    await tx
      .update(agentExecutionSubtasks)
      .set({
        status: input.status,
        detail,
        updatedAt: timestamp,
        completedAt:
          input.status === "completed" || input.status === "failed" || input.status === "cancelled"
            ? subtask.completedAt ?? timestamp
            : null,
      })
      .where(eq(agentExecutionSubtasks.id, subtask.id));

    await tx
      .update(agentExecutions)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(agentExecutions.id, execution.id));

    await recordExecutionStepInTx(tx, {
      executionId: execution.id,
      kind: "status",
      phase: (execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `Subtask moved to ${input.status}: ${subtask.title}`,
      detail,
      status: input.status === "failed" || input.status === "cancelled" ? "failed" : "completed",
      progressPercent: execution.progressPercent,
    });
  });

  return getAgentExecutionViewById(execution.id);
}

export async function requeueOwnedAgentExecution(
  ownerUserId: string,
  executionId: string,
): Promise<AgentExecutionView> {
  const execution = await getOwnedAgentExecution(ownerUserId, executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (!["failed", "cancelled"].includes(execution.status as AgentExecutionStatus)) {
    throw new ConflictError("Only failed or cancelled executions can be requeued");
  }

  const agent = await getOwnedAgent(ownerUserId, execution.agentId);
  if (!agent) {
    throw new NotFoundError("Linked agent not found");
  }
  if (agent.sourceType !== "platform") {
    throw new ConflictError("Only platform agent executions can be requeued");
  }
  if (!agent.enabled) {
    throw new ConflictError("Agent is disabled and cannot be requeued");
  }

  return db.transaction(async (tx) => {
    const updatedAt = now();
    const [updated] = await tx
      .update(agentExecutions)
      .set({
        status: "queued",
        statusNote: "Execution requeued by owner.",
        resultSummary: null,
        outputVersion: null,
        outputKind: null,
        outputPayload: null,
        outputGeneratedAt: null,
        executorPhase: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : "queued",
        progressPercent: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : 0,
        autoRecoveryCount: 0,
        recoveryExhaustedAt: null,
        updatedAt,
        startedAt: null,
        submittedAt: null,
        completedAt: null,
      })
      .where(eq(agentExecutions.id, execution.id))
      .returning();

    const run = await createExecutionRunInTx(tx, {
      executionId: execution.id,
      agentId: execution.agentId,
      ownerUserId,
      runKind: "requeue",
      summary: "Execution moved back to queued state by owner.",
    });

    await finishExecutionRunInTx(tx, run.id, {
      status: "completed",
      summary: "Execution requeued for another platform executor attempt.",
      artifactCount: 0,
    });

    if (!isManagedLightExecutionHostingMode(agent.hostingMode)) {
      const requeueSession = await createRuntimeSessionInTx(tx, {
        execution: updated,
        runId: run.id,
        kind: "owner_requeue",
        trigger: "owner_requeue",
        state: "requeued",
        startedPhase: "queued",
        note: "Owner requeued the platform execution.",
      });

      await finalizeRuntimeSessionInTx(tx, updated.id, {
        kind: "owner_requeue",
        state: "requeued",
        endedPhase: "queued",
        note: requeueSession.note ?? "Owner requeued the platform execution.",
      });
    }

    await recordExecutionStepInTx(tx, {
      executionId: updated.id,
      kind: "phase",
      phase: isManagedLightExecutionHostingMode(agent.hostingMode) ? null : "queued",
      title: "Execution requeued",
      detail:
        isManagedLightExecutionHostingMode(agent.hostingMode)
          ? "Owner moved the platform light execution back into the pending dispatcher queue."
          : "Owner moved the platform execution back into the queued state.",
      status: "completed",
      progressPercent: updated.progressPercent,
    });

    if (!isManagedLightExecutionHostingMode(agent.hostingMode)) {
      await syncRuntimeManagedSubtasksInTx(tx, updated, "requeue");
    }

    await enqueueOutboxEvent(
      "agentExecution.requeued",
      {
        executionId: updated.id,
        ownerUserId: updated.ownerUserId,
        agentId: updated.agentId,
        taskId: updated.taskId,
      },
      tx,
    );

    const ownerMap = new Map([[updated.id, updated.ownerUserId]]);
    const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, remediationPolicyMap] =
      await Promise.all([
        buildArtifactMap([updated.id]),
        buildStepMap([updated.id]),
        buildSubtaskMap([updated.id], ownerMap, ownerUserId),
        buildRuntimeSessionMap([updated]),
        buildCallbackMap([updated.id]),
        buildRunMap([updated.id]),
        buildExecutionRemediationPolicyMap([updated]),
      ]);
    return toAgentExecutionView(
      updated,
      ownerUserId,
      remediationPolicyMap.get(updated.id) ??
        resolveExecutionCallbackRemediationPolicyMetadata({
          execution: updated,
          agentSourceType: "platform",
          agentPolicyKey: null,
        }),
      artifactMap.get(updated.id) ?? [],
      stepMap.get(updated.id) ?? [],
      subtaskMap.get(updated.id) ?? [],
      runtimeSessionMap.get(updated.id) ?? [],
      callbackMap.get(updated.id) ?? [],
      runMap.get(updated.id) ?? [],
    );
  });
}
