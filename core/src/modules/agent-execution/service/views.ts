import type {
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
  AgentExecutionCallbackRemediationAttemptStatus,
  AgentExecutionCallbackRemediationAttemptView,
  AgentExecutionCallbackRemediationMode,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackRetryability,
  AgentExecutionCallbackAuditView,
  AgentExecutionCallbackRuntimeContextView,
  AgentExecutionArtifactKind,
  AgentExecutionArtifactView,
  AgentExecutionOutputEnvelope,
  AgentExecutionOutputKind,
  AgentExecutionRuntimeSessionState,
  AgentExecutionRuntimeSessionView,
  AgentExecutionOperatorRunView,
  AgentExecutionStepKind,
  AgentExecutionStepStatus,
  AgentExecutionSettlementLineItemView,
  AgentExecutionSettlementView,
  AgentExecutionStepView,
  AgentExecutionSubtaskStatus,
  AgentExecutionSubtaskView,
  AgentExecutionRunView,
  AgentExecutionRunStatus,
  AgentExecutionStatus,
  AgentExecutionView,
  AgentSourceType,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  getExternalCallbackRetryGuidance,
  resolveStoredExternalCallbackReplayEnvelope,
} from "@/modules/agent-execution/callback-governance";
import {
  classifyAutoRemediationReasonCategory,
  getAutoRemediationReasonDisposition,
} from "@/modules/agent-execution/auto-remediation-analysis";
import {
  buildCallbackRemediationPlan,
} from "@/modules/agent-execution/callback-remediation-plan";
import {
  resolveRuntimeDecisionFromPayload,
} from "@/modules/agent-execution/runtime-decision";
import {
  classifyExecutionRunFailure,
} from "@/modules/agent-execution/operator-run-analysis";
import {
  getAgentExecutionById,
  listArtifactsByExecutionIds,
  listCallbacksByExecutionIds,
  listRuntimeSessionsByExecutionIds,
  listRunsByExecutionIds,
  listStepsByExecutionIds,
  listSubtasksByExecutionIds,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionArtifacts,
  agentExecutionCallbacks,
  agentExecutionCallbackRemediations,
  agentExecutionRuntimeSessions,
  agentExecutionRuns,
  agentExecutionSettlementLineItems,
  agentExecutionSettlements,
  agentExecutionSteps,
  agentExecutionSubtasks,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import {
  buildAgentCallbackRemediationPolicyView,
  normalizeRemediationPolicyKey,
} from "@/modules/agent-registry/service";
import { agents } from "@/modules/agent-registry/schema";
import { NotFoundError } from "@/platform/errors";

import { buildCallbackAuditRuntimeContextMap } from "./callback-audit";
import {
  toMarketplaceInvocationSnapshotView,
  toRecordPayload,
} from "./managed-light";
import {
  buildExecutionCostBuckets,
  buildExecutionOutputEnvelope,
  buildStepCostBuckets,
  getExecutionBudgetStatus,
  getExecutionPhaseAgeSeconds,
  getExecutionPhaseTimeoutSeconds,
  getRemainingExecutionPhaseCostUnits,
  normalizeObjectiveChecklist,
  toAgentExecutionSettlementLineItemView,
  toAgentExecutionSettlementView,
  toRuntimeProfileView,
  toSerializablePayload,
} from "./pricing";
import {
  buildExecutionRemediationPolicyMap,
  extractCallbackRetryAuditId,
  getCallbackAutoRemediationState,
  resolveExecutionCallbackRemediationPolicyMetadata,
} from "./remediation";
import {
  ExecutionCallbackRemediationPolicyMetadata,
  subtaskTransitionMap,
  terminalExecutionStatuses,
  transitionMap,
} from "./shared";

export function toStoredExecutionOutputEnvelope(
  envelope: AgentExecutionOutputEnvelope | null | undefined,
): {
  outputVersion: number | null;
  outputKind: string | null;
  outputPayload: Record<string, unknown> | null;
  outputGeneratedAt: Date | null;
} {
  if (!envelope) {
    return {
      outputVersion: null,
      outputKind: null,
      outputPayload: null,
      outputGeneratedAt: null,
    };
  }

  return {
    outputVersion: envelope.version,
    outputKind: envelope.kind,
    outputPayload: envelope.payload,
    outputGeneratedAt: envelope.generatedAt ? new Date(envelope.generatedAt) : null,
  };
}

export function toExecutionOutputEnvelope(row: typeof agentExecutions.$inferSelect): AgentExecutionOutputEnvelope | null {
  if (!row.outputKind || row.outputVersion === null) {
    return null;
  }

  return {
    version: row.outputVersion,
    kind: row.outputKind as AgentExecutionOutputKind,
    title:
      row.outputKind === "artifact_bundle"
        ? "Execution artifact bundle"
        : row.outputKind === "runtime_result"
          ? "Execution runtime result"
          : "Execution status report",
    summary: row.resultSummary ?? null,
    payload: toSerializablePayload(row.outputPayload),
    generatedAt: row.outputGeneratedAt ? row.outputGeneratedAt.toISOString() : null,
  };
}

export function buildArtifactBundleOutputEnvelope(args: {
  executionId: string;
  artifacts: Array<{
    id: string;
    kind: string;
    title: string;
    url: string | null;
    summary: string | null;
    createdAt: Date;
  }>;
  generatedAt: Date;
}): AgentExecutionOutputEnvelope {
  const latestArtifact = args.artifacts.at(-1) ?? null;
  return buildExecutionOutputEnvelope({
    kind: "artifact_bundle",
    title: "Execution artifact bundle",
    summary: latestArtifact?.summary ?? latestArtifact?.title ?? null,
    generatedAt: args.generatedAt,
    payload: {
      executionId: args.executionId,
      artifactCount: args.artifacts.length,
      latestArtifact: latestArtifact
        ? {
            id: latestArtifact.id,
            kind: latestArtifact.kind,
            title: latestArtifact.title,
            url: latestArtifact.url,
            summary: latestArtifact.summary,
            createdAt: latestArtifact.createdAt.toISOString(),
          }
        : null,
      artifacts: args.artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        title: artifact.title,
        url: artifact.url,
        summary: artifact.summary,
        createdAt: artifact.createdAt.toISOString(),
      })),
    },
  });
}

export function buildStatusReportOutputEnvelope(args: {
  executionId: string;
  status: AgentExecutionStatus;
  statusNote?: string | null;
  resultSummary?: string | null;
  generatedAt: Date;
}): AgentExecutionOutputEnvelope {
  return buildExecutionOutputEnvelope({
    kind: "status_report",
    title: "Execution status report",
    summary: args.resultSummary ?? args.statusNote ?? null,
    generatedAt: args.generatedAt,
    payload: {
      executionId: args.executionId,
      status: args.status,
      statusNote: args.statusNote ?? null,
      resultSummary: args.resultSummary ?? null,
    },
  });
}

export function toAgentExecutionArtifactView(
  row: typeof agentExecutionArtifacts.$inferSelect,
): AgentExecutionArtifactView {
  return {
    id: row.id,
    executionId: row.executionId,
    kind: row.kind as AgentExecutionArtifactKind,
    title: row.title,
    url: row.url,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAgentExecutionStepView(
  row: typeof agentExecutionSteps.$inferSelect,
): AgentExecutionStepView {
  return {
    id: row.id,
    executionId: row.executionId,
    kind: row.kind as AgentExecutionStepKind,
    phase: (row.phase as PlatformExecutionPhase | null) ?? null,
    title: row.title,
    detail: row.detail,
    status: row.status as AgentExecutionStepStatus,
    progressPercent: row.progressPercent,
    costUnits: row.costUnits,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAgentExecutionSubtaskView(
  row: typeof agentExecutionSubtasks.$inferSelect,
  ownerUserId: string,
  viewerUserId: string,
): AgentExecutionSubtaskView {
  return {
    id: row.id,
    executionId: row.executionId,
    parentSubtaskId: row.parentSubtaskId,
    title: row.title,
    detail: row.detail,
    status: row.status as AgentExecutionSubtaskStatus,
    managedByRuntime: row.managedByRuntime,
    runtimePhase: (row.runtimePhase as PlatformExecutionPhase | null) ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    canUpdateStatus:
      ownerUserId === viewerUserId &&
      !row.managedByRuntime &&
      (subtaskTransitionMap[row.status as AgentExecutionSubtaskStatus]?.length ?? 0) > 0,
  };
}

export type AgentExecutionCallbackPlanAgentContext = {
  sourceType: AgentSourceType;
  enabled: boolean;
};

export async function buildAgentExecutionCallbackPlanAgentMap(agentIds: string[]) {
  if (agentIds.length === 0) {
    return new Map<string, AgentExecutionCallbackPlanAgentContext>();
  }

  const rows = await db
    .select({
      id: agents.id,
      sourceType: agents.sourceType,
      enabled: agents.enabled,
    })
    .from(agents)
    .where(inArray(agents.id, Array.from(new Set(agentIds))));

  return new Map(
    rows.map((row) => [
      row.id,
      {
        sourceType: row.sourceType as AgentSourceType,
        enabled: row.enabled,
      },
    ]),
  );
}

export function toAgentExecutionCallbackAuditView(
  row: typeof agentExecutionCallbacks.$inferSelect,
  remediationAttempts: AgentExecutionCallbackRemediationAttemptView[] = [],
  agentContext?: AgentExecutionCallbackPlanAgentContext,
  runtimeContext?: AgentExecutionCallbackRuntimeContextView | null,
): AgentExecutionCallbackAuditView {
  const guidance = getExternalCallbackRetryGuidance(
    (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
  );
  const autoRemediationReasonCategory = classifyAutoRemediationReasonCategory(row.autoRemediationLastError);
  const autoRemediationReasonDisposition = getAutoRemediationReasonDisposition(autoRemediationReasonCategory);
  const remediationPolicyKey = normalizeRemediationPolicyKey(row.remediationPolicyKey);
  const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(row.replayPayload);
  const remediationPlan = buildCallbackRemediationPlan({
    status: row.status as AgentExecutionCallbackAuditStatus,
    agentSourceType: agentContext?.sourceType ?? "external",
    agentEnabled: agentContext?.enabled ?? true,
    usedPreviousProtocol: row.usedPreviousProtocol,
    usedPreviousSecret: row.usedPreviousSecret,
    retryability: (guidance.retryability as AgentExecutionCallbackRetryability | null) ?? null,
    rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    policy: buildAgentCallbackRemediationPolicyView(remediationPolicyKey),
    replayPayload: replayPayloadResolution,
    autoRemediationAttempts: row.autoRemediationAttempts,
  });
  return {
    id: row.id,
    executionId: row.executionId,
    agentId: row.agentId,
    remediationPolicyKey,
    callbackId: row.callbackId,
    callbackType: row.callbackType as AgentExecutionCallbackType,
    status: row.status as AgentExecutionCallbackAuditStatus,
    callbackVersion: row.callbackVersion,
    secretVersion: row.secretVersion,
    usedPreviousProtocol: row.usedPreviousProtocol,
    usedPreviousSecret: row.usedPreviousSecret,
    callbackTimestamp: row.callbackTimestamp ? row.callbackTimestamp.toISOString() : null,
    rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    retryability: guidance.retryability as AgentExecutionCallbackRetryability | null,
    retryHint: guidance.retryHint,
    payloadSummary: row.payloadSummary,
    replayPayloadStored: replayPayloadResolution.stored,
    replayPayloadReplayable: replayPayloadResolution.replayable,
    replayPayloadCompatibility: replayPayloadResolution.compatibility,
    replayPayloadSchemaVersion: replayPayloadResolution.schemaVersion,
    remediationPlan,
    autoRemediationAttempts: row.autoRemediationAttempts,
    lastAutoRemediationAt: row.lastAutoRemediationAt ? row.lastAutoRemediationAt.toISOString() : null,
    nextAutoRemediationAt: row.nextAutoRemediationAt ? row.nextAutoRemediationAt.toISOString() : null,
    autoRemediationExhaustedAt: row.autoRemediationExhaustedAt
      ? row.autoRemediationExhaustedAt.toISOString()
      : null,
    autoRemediationLastError: row.autoRemediationLastError,
    autoRemediationState: getCallbackAutoRemediationState(row),
    autoRemediationReasonCategory:
      (autoRemediationReasonCategory as AgentExecutionCallbackAutoRemediationReasonCategory | null) ?? null,
    autoRemediationReasonDisposition:
      (autoRemediationReasonDisposition as AgentExecutionCallbackAutoRemediationReasonDisposition | null) ?? null,
    runtimeContext: runtimeContext ?? null,
    receivedAt: row.receivedAt.toISOString(),
    remediationAttempts,
  };
}

export function toAgentExecutionCallbackRemediationAttemptView(
  row: typeof agentExecutionCallbackRemediations.$inferSelect,
): AgentExecutionCallbackRemediationAttemptView {
  return {
    id: row.id,
    callbackAuditId: row.callbackAuditId,
    executionId: row.executionId,
    agentId: row.agentId,
    runId: row.runId,
    actorUserId: row.actorUserId,
    mode: row.mode as AgentExecutionCallbackRemediationMode,
    status: row.status as AgentExecutionCallbackRemediationAttemptStatus,
    plannedDecisionClass:
      (row.plannedDecisionClass as AgentExecutionCallbackAuditView["remediationPlan"]["decisionClass"] | null) ?? null,
    plannedPrimaryAction: (row.plannedPrimaryAction as AgentExecutionCallbackAuditView["remediationPlan"]["primaryAction"] | null) ?? null,
    plannedFallbackAction:
      (row.plannedFallbackAction as AgentExecutionCallbackAuditView["remediationPlan"]["fallbackAction"] | null) ?? null,
    planReasonCategory:
      (row.planReasonCategory as AgentExecutionCallbackAutoRemediationReasonCategory | null) ?? null,
    planReason: row.planReason ?? null,
    fallbackFailureClass:
      (row.fallbackFailureClass as AgentExecutionCallbackReplayFailureClass | null) ?? null,
    fallbackReason: row.fallbackReason ?? null,
    note: row.note,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

export function toAgentExecutionRunView(
  row: typeof agentExecutionRuns.$inferSelect,
): AgentExecutionRunView {
  return {
    id: row.id,
    executionId: row.executionId,
    agentId: row.agentId,
    ownerUserId: row.ownerUserId,
    runKind: row.runKind as AgentExecutionRunView["runKind"],
    status: row.status as AgentExecutionRunView["status"],
    failureCategory: classifyExecutionRunFailure({
      runKind: row.runKind as AgentExecutionRunView["runKind"],
      status: row.status as AgentExecutionRunStatus,
      summary: row.summary,
      errorMessage: row.errorMessage,
    }),
    summary: row.summary,
    errorMessage: row.errorMessage,
    artifactCount: row.artifactCount,
    costUnits: row.costUnits,
    resourceMinutes: row.resourceMinutes,
    estimatedAmount: row.estimatedAmount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

export function toAgentExecutionOperatorRunView(args: {
  run: typeof agentExecutionRuns.$inferSelect;
  execution: typeof agentExecutions.$inferSelect;
  agent: typeof agents.$inferSelect;
}): AgentExecutionOperatorRunView {
  const output = toExecutionOutputEnvelope(args.execution);
  return {
    ...toAgentExecutionRunView(args.run),
    executionTitle: args.execution.title,
    executionStatus: args.execution.status as AgentExecutionStatus,
    executionUpdatedAt: args.execution.updatedAt.toISOString(),
    executorPhase: (args.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
    progressPercent: args.execution.progressPercent,
    agentName: args.agent.name,
    agentSourceType: args.agent.sourceType as AgentSourceType,
    callbackAuditId: extractCallbackRetryAuditId(args.run.summary),
    failureCategory: classifyExecutionRunFailure({
      runKind: args.run.runKind as AgentExecutionRunView["runKind"],
      status: args.run.status as AgentExecutionRunStatus,
      summary: args.run.summary,
      errorMessage: args.run.errorMessage,
    }),
    runtimeDecision: resolveRuntimeDecisionFromPayload(output?.payload ?? null),
  };
}

export function buildExecutionPhaseDiagnostics(row: typeof agentExecutions.$inferSelect) {
  const phase = (row.executorPhase as PlatformExecutionPhase | null) ?? null;
  const phaseTimeoutSeconds = phase ? getExecutionPhaseTimeoutSeconds(phase) : null;
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
    updatedAt: row.updatedAt,
    status: row.status as AgentExecutionStatus,
    phase,
  });

  return {
    phase,
    phaseTimeoutSeconds,
    phaseAgeSeconds,
    phaseOverdue:
      phaseTimeoutSeconds !== null && phaseAgeSeconds !== null ? phaseAgeSeconds >= phaseTimeoutSeconds : false,
  };
}

export function toAgentExecutionRuntimeSessionView(
  row: typeof agentExecutionRuntimeSessions.$inferSelect,
  execution: typeof agentExecutions.$inferSelect,
): AgentExecutionRuntimeSessionView {
  const diagnostics = buildExecutionPhaseDiagnostics(execution);
  return {
    id: row.id,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    executionTitle: execution.title,
    executionStatus: execution.status as AgentExecutionStatus,
    runId: row.runId,
    kind: row.kind as AgentExecutionRuntimeSessionView["kind"],
    state: row.state as AgentExecutionRuntimeSessionState,
    trigger: row.trigger as AgentExecutionRuntimeSessionView["trigger"],
    startedPhase: (row.startedPhase as PlatformExecutionPhase | null) ?? null,
    endedPhase: (row.endedPhase as PlatformExecutionPhase | null) ?? null,
    executorPhase: diagnostics.phase,
    progressPercent: execution.progressPercent,
    phaseTimeoutSeconds: diagnostics.phaseTimeoutSeconds,
    phaseAgeSeconds: diagnostics.phaseAgeSeconds,
    phaseOverdue: diagnostics.phaseOverdue,
    note: row.note,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgentExecutionView(
  row: typeof agentExecutions.$inferSelect,
  viewerUserId: string,
  remediationPolicyMetadata: ExecutionCallbackRemediationPolicyMetadata,
  artifacts: AgentExecutionArtifactView[] = [],
  steps: AgentExecutionStepView[] = [],
  subtasks: AgentExecutionSubtaskView[] = [],
  runtimeSessions: AgentExecutionRuntimeSessionView[] = [],
  callbacks: AgentExecutionCallbackAuditView[] = [],
  runs: AgentExecutionRunView[] = [],
  settlement: AgentExecutionSettlementView | null = null,
): AgentExecutionView {
  const phase = (row.executorPhase as PlatformExecutionPhase | null) ?? null;
  const output = toExecutionOutputEnvelope(row);
  const runtimeDecision = resolveRuntimeDecisionFromPayload(output?.payload ?? null);
  const phaseTimeoutSeconds = phase ? getExecutionPhaseTimeoutSeconds(phase) : null;
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
    updatedAt: row.updatedAt,
    status: row.status as AgentExecutionStatus,
    phase,
  });
  const totalCostUnits = runs.reduce((sum, run) => sum + run.costUnits, 0);
  const totalStepCostUnits = steps.reduce((sum, step) => sum + step.costUnits, 0);
  const totalResourceMinutes = runs.reduce((sum, run) => sum + run.resourceMinutes, 0);
  const totalEstimatedAmount = runs.reduce((sum, run) => sum + run.estimatedAmount, 0);
  const producedArtifactCount = artifacts.length;
  const remainingArtifactCount = Math.max(0, row.targetArtifactCount - producedArtifactCount);
  const estimatedRemainingCostUnits = terminalExecutionStatuses.has(row.status as AgentExecutionStatus)
    ? 0
    : getRemainingExecutionPhaseCostUnits(phase) + remainingArtifactCount * env.agentExecutionArtifactCostUnits;
  const runtimeProfile = toRuntimeProfileView(row);
  const costSummary = {
    totalCostUnits,
    totalStepCostUnits,
    totalResourceMinutes,
    totalEstimatedAmount,
    estimatedRemainingCostUnits,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
    budgetStatus: getExecutionBudgetStatus({
      totalCostUnits,
      totalResourceMinutes,
      budgetCostUnits: runtimeProfile.budgetCostUnits,
      budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
    }),
  } satisfies AgentExecutionView["costSummary"];
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    capabilityId: row.capabilityId ?? null,
    agentSourceType: remediationPolicyMetadata.agentSourceType,
    taskId: row.taskId,
    title: row.title,
    objective: row.objective,
    objectiveChecklist: normalizeObjectiveChecklist(row.objectiveChecklist, row.objective),
    inputResourcePayload: toRecordPayload(row.inputResourcePayload),
    normalizedResourcePayload: toRecordPayload(row.normalizedResourcePayload),
    outputResourcePayload: toRecordPayload(row.outputResourcePayload),
    status: row.status as AgentExecutionStatus,
    statusNote: row.statusNote,
    resultSummary: row.resultSummary,
    runtimeProfileKey: runtimeProfile.key,
    runtimeProfile,
    callbackRemediationPolicyKey: remediationPolicyMetadata.key,
    callbackRemediationPolicy: remediationPolicyMetadata.policy,
    callbackRemediationPolicySource: remediationPolicyMetadata.source,
    callbackRemediationPolicyOverrideKey: remediationPolicyMetadata.overrideKey,
    targetArtifactCount: row.targetArtifactCount,
    executorPhase: phase,
    progressPercent: row.progressPercent,
    phaseTimeoutSeconds,
    phaseAgeSeconds,
    phaseOverdue: phaseTimeoutSeconds !== null && phaseAgeSeconds !== null ? phaseAgeSeconds >= phaseTimeoutSeconds : false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    lastExternalCallbackAt: row.lastExternalCallbackAt ? row.lastExternalCallbackAt.toISOString() : null,
    lastHeartbeatAt: row.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null,
    autoRecoveryCount: row.autoRecoveryCount,
    maxAutoRecoveryCount: row.maxAutoRecoveryCount,
    recoveryExhaustedAt: row.recoveryExhaustedAt ? row.recoveryExhaustedAt.toISOString() : null,
    totalCostUnits,
    costByRunKind: buildExecutionCostBuckets(runs),
    totalStepCostUnits,
    costByStepKind: buildStepCostBuckets(steps),
    estimatedRemainingCostUnits,
    costSummary,
    settlement,
    marketplaceInvocation: toMarketplaceInvocationSnapshotView(row.marketplaceInvocation),
    output,
    runtimeDecision,
    artifacts,
    steps,
    subtasks,
    runtimeSessions,
    callbacks,
    runs,
    canUpdateStatus: row.ownerUserId === viewerUserId && transitionMap[row.status as AgentExecutionStatus].length > 0,
    canRequeue:
      row.ownerUserId === viewerUserId &&
      row.executorPhase !== null &&
      ["failed", "cancelled"].includes(row.status as AgentExecutionStatus),
  };
}

export async function buildCallbackRemediationAttemptMap(callbackAuditIds: string[]) {
  if (callbackAuditIds.length === 0) {
    return new Map<string, AgentExecutionCallbackRemediationAttemptView[]>();
  }

  const rows = await db
    .select()
    .from(agentExecutionCallbackRemediations)
    .where(inArray(agentExecutionCallbackRemediations.callbackAuditId, callbackAuditIds))
    .orderBy(desc(agentExecutionCallbackRemediations.createdAt));

  const map = new Map<string, AgentExecutionCallbackRemediationAttemptView[]>();
  for (const row of rows) {
    const attempts = map.get(row.callbackAuditId) ?? [];
    attempts.push(toAgentExecutionCallbackRemediationAttemptView(row));
    map.set(row.callbackAuditId, attempts);
  }
  return map;
}

export function getAgentExecutionEventName(status: AgentExecutionStatus) {
  switch (status) {
    case "running":
      return "agentExecution.started";
    case "submitted":
      return "agentExecution.submitted";
    case "completed":
      return "agentExecution.completed";
    case "failed":
      return "agentExecution.failed";
    case "cancelled":
      return "agentExecution.cancelled";
    case "queued":
      return "agentExecution.created";
    default:
      return "agentExecution.created";
  }
}

export async function buildArtifactMap(executionIds: string[]) {
  const artifactRows = await listArtifactsByExecutionIds(executionIds);
  const artifactMap = new Map<string, AgentExecutionArtifactView[]>();

  for (const row of artifactRows) {
    const artifacts = artifactMap.get(row.executionId) ?? [];
    artifacts.push(toAgentExecutionArtifactView(row));
    artifactMap.set(row.executionId, artifacts);
  }

  return artifactMap;
}

export async function buildStepMap(executionIds: string[]) {
  const stepRows = await listStepsByExecutionIds(executionIds);
  const stepMap = new Map<string, AgentExecutionStepView[]>();

  for (const row of stepRows) {
    const steps = stepMap.get(row.executionId) ?? [];
    steps.push(toAgentExecutionStepView(row));
    stepMap.set(row.executionId, steps);
  }

  return stepMap;
}

export async function buildSubtaskMap(
  executionIds: string[],
  ownerUserIdByExecutionId: Map<string, string>,
  viewerUserId: string,
) {
  const subtaskRows = await listSubtasksByExecutionIds(executionIds);
  const subtaskMap = new Map<string, AgentExecutionSubtaskView[]>();

  for (const row of subtaskRows) {
    const subtasks = subtaskMap.get(row.executionId) ?? [];
    const ownerUserId = ownerUserIdByExecutionId.get(row.executionId) ?? "";
    subtasks.push(toAgentExecutionSubtaskView(row, ownerUserId, viewerUserId));
    subtaskMap.set(row.executionId, subtasks);
  }

  return subtaskMap;
}

export async function buildRuntimeSessionMap(executions: Array<typeof agentExecutions.$inferSelect>) {
  const executionIds = executions.map((row) => row.id);
  const sessionRows = await listRuntimeSessionsByExecutionIds(executionIds);
  const sessionMap = new Map<string, AgentExecutionRuntimeSessionView[]>();
  const executionById = new Map(executions.map((row) => [row.id, row]));

  for (const row of sessionRows) {
    const execution = executionById.get(row.executionId);
    if (!execution) {
      continue;
    }
    const sessions = sessionMap.get(row.executionId) ?? [];
    sessions.push(toAgentExecutionRuntimeSessionView(row, execution));
    sessionMap.set(row.executionId, sessions);
  }

  return sessionMap;
}

export async function buildCallbackMap(executionIds: string[]) {
  const callbackRows = await listCallbacksByExecutionIds(executionIds);
  const attemptMap = await buildCallbackRemediationAttemptMap(callbackRows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(callbackRows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(callbackRows.map((row) => row.executionId));
  const callbackMap = new Map<string, AgentExecutionCallbackAuditView[]>();

  for (const row of callbackRows) {
    const callbacks = callbackMap.get(row.executionId) ?? [];
    callbacks.push(
      toAgentExecutionCallbackAuditView(
        row,
        attemptMap.get(row.id) ?? [],
        agentMap.get(row.agentId),
        runtimeContextMap.get(row.executionId),
      ),
    );
    callbackMap.set(row.executionId, callbacks);
  }

  return callbackMap;
}

export async function buildRunMap(executionIds: string[]) {
  const runRows = await listRunsByExecutionIds(executionIds);
  const runMap = new Map<string, AgentExecutionRunView[]>();

  for (const row of runRows) {
    const runs = runMap.get(row.executionId) ?? [];
    runs.push(toAgentExecutionRunView(row));
    runMap.set(row.executionId, runs);
  }

  return runMap;
}

export async function buildSettlementMap(executionIds: string[]) {
  if (executionIds.length === 0) {
    return new Map<string, AgentExecutionSettlementView>();
  }

  const rows = await db
    .select()
    .from(agentExecutionSettlements)
    .where(inArray(agentExecutionSettlements.executionId, executionIds));
  const settlementIds = rows.map((row) => row.id);
  const lineItemRows =
    settlementIds.length > 0
      ? await db
          .select()
          .from(agentExecutionSettlementLineItems)
          .where(inArray(agentExecutionSettlementLineItems.settlementId, settlementIds))
          .orderBy(asc(agentExecutionSettlementLineItems.createdAt))
      : [];
  const lineItemMap = new Map<string, AgentExecutionSettlementLineItemView[]>();
  for (const row of lineItemRows) {
    const items = lineItemMap.get(row.settlementId) ?? [];
    items.push(toAgentExecutionSettlementLineItemView(row));
    lineItemMap.set(row.settlementId, items);
  }

  return new Map(
    rows.map((row) => [row.executionId, toAgentExecutionSettlementView(row, lineItemMap.get(row.id) ?? [])]),
  );
}

export async function getExecutionSettlementByExecutionId(
  executionId: string,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const [row] = await connection
    .select()
    .from(agentExecutionSettlements)
    .where(eq(agentExecutionSettlements.executionId, executionId))
    .limit(1);
  return row ?? null;
}

export async function getExecutionViewWithSettlement(executionId: string) {
  return getAgentExecutionViewById(executionId);
}

export async function getAgentExecutionViewById(executionId: string) {
  const execution = await getAgentExecutionById(executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }

  const ownerMap = new Map([[execution.id, execution.ownerUserId]]);
  const [artifactMap, stepMap, subtaskMap, runtimeSessionMap, callbackMap, runMap, settlementMap, remediationPolicyMap] =
    await Promise.all([
    buildArtifactMap([execution.id]),
    buildStepMap([execution.id]),
    buildSubtaskMap([execution.id], ownerMap, execution.ownerUserId),
    buildRuntimeSessionMap([execution]),
    buildCallbackMap([execution.id]),
    buildRunMap([execution.id]),
    buildSettlementMap([execution.id]),
      buildExecutionRemediationPolicyMap([execution]),
    ]);
  return toAgentExecutionView(
    execution,
    execution.ownerUserId,
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
