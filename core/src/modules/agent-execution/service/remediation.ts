import type {
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAutoRemediationState,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackRemediationAttemptStatus,
  AgentExecutionCallbackRemediationMode,
  AgentExecutionCallbackAutoRemediationResult,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackRemediationSummaryView,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackReplayResult,
  AgentExecutionCallbackRetryBatchResult,
  AgentExecutionCallbackRetryRequestResult,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackRetryability,
  AgentExecutionCallbackAuditView,
  AgentExecutionCallbackRuntimeContextView,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionRunView,
  AgentSourceType,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, desc, eq, inArray, max, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  getExternalCallbackRetryGuidance,
  resolveStoredExternalCallbackReplayEnvelope,
} from "@/modules/agent-execution/callback-governance";
import {
  buildAutoRemediationReasonBuckets,
  getAutoRemediationReasonFilterPatterns,
  listAutoRemediationReasonCategoriesForDisposition,
} from "@/modules/agent-execution/auto-remediation-analysis";
import {
  buildCallbackRemediationPlan,
  classifyReplayFailureForRetryFallback,
  shouldFallbackReplayFailureToRetryRequestByPolicy,
} from "@/modules/agent-execution/callback-remediation-plan";
import {
  buildCallbackRemediationRuntimeCorrelationSummary,
  buildCallbackRemediationAlertBuckets,
  buildCallbackRemediationAlerts,
  buildCallbackRemediationRecommendations,
} from "@/modules/agent-execution/operator-remediation-analysis";
import {
  agentExecutionCallbacks,
  agentExecutionCallbackRemediations,
  agentExecutionRuns,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import {
  buildAgentCallbackRemediationPolicyView,
  normalizeRemediationPolicyKey,
} from "@/modules/agent-registry/service";
import { agents } from "@/modules/agent-registry/schema";
import { ConflictError, NotFoundError } from "@/platform/errors";

import {
  buildCallbackAuditConditions,
  buildCallbackAuditRuntimeContextMap,
  buildSummaryBuckets,
  callbackAuditSummaryBuckets,
  hasCallbackAuditDerivedFilters,
  incrementCallbackAuditSummaryBucket,
  inferReplayFailureClassFromFallbackReason,
  iterateCallbackAuditViewPagesForOperator,
  listCallbackAuditsForOperator,
  listLimitedCallbackAuditViewsForOperator,
} from "./callback-audit";
import {
  addExternalAgentExecutionArtifact,
  recordExternalAgentExecutionHeartbeat,
  updateExternalAgentExecutionStatus,
} from "./external-runtime";
import {
  createExecutionRunInTx,
  finishExecutionRunInTx,
  recordExecutionStepInTx,
} from "./runs";
import {
  CallbackAuditOperatorQuery,
  CallbackRemediationSummaryQuery,
  ExecutionCallbackRemediationPolicyMetadata,
  automaticCallbackRemediationActorId,
  now,
  toWhereClause,
} from "./shared";
import { buildAgentExecutionCallbackPlanAgentMap } from "./views";

export function getNextAutoRemediationAt(
  attempts: number,
  referenceTime: Date,
  baseBackoffSeconds = env.agentExecutionCallbackAutoRemediationBaseBackoffSeconds,
) {
  const backoffSeconds = baseBackoffSeconds * Math.max(1, 2 ** Math.max(0, attempts - 1));
  return new Date(referenceTime.getTime() + backoffSeconds * 1000);
}

export function getSkippedAutoRemediationNextAttemptAt(referenceTime: Date, baseBackoffSeconds: number) {
  const minimumSkipDelaySeconds = 15 * 60;
  const effectiveBackoffSeconds = Math.max(baseBackoffSeconds, minimumSkipDelaySeconds);
  return new Date(referenceTime.getTime() + effectiveBackoffSeconds * 1000);
}

export function getCallbackAutoRemediationState(
  row: Pick<
    typeof agentExecutionCallbacks.$inferSelect,
    "autoRemediationAttempts" | "nextAutoRemediationAt" | "autoRemediationExhaustedAt"
  >,
): AgentExecutionCallbackAutoRemediationState {
  if (row.autoRemediationExhaustedAt) {
    return "exhausted";
  }
  if (row.nextAutoRemediationAt) {
    return "scheduled";
  }
  return "idle";
}

export async function createCallbackRemediationAttemptInTx(
  tx: NodePgDatabase<typeof schema>,
  input: {
    callbackAuditId: string;
    executionId: string;
    agentId: string;
    runId?: string | null;
    actorUserId: string;
    mode: AgentExecutionCallbackRemediationMode;
    status?: AgentExecutionCallbackRemediationAttemptStatus;
    plannedDecisionClass?: AgentExecutionCallbackAuditView["remediationPlan"]["decisionClass"] | null;
    plannedPrimaryAction?: AgentExecutionCallbackAuditView["remediationPlan"]["primaryAction"] | null;
    plannedFallbackAction?: AgentExecutionCallbackAuditView["remediationPlan"]["fallbackAction"] | null;
    planReasonCategory?: AgentExecutionCallbackAuditView["remediationPlan"]["reasonCategory"] | null;
    planReason?: string | null;
    fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
    fallbackReason?: string | null;
    note?: string | null;
    errorMessage?: string | null;
  },
) {
  const timestamp = now();
  const [attempt] = await tx
    .insert(agentExecutionCallbackRemediations)
    .values({
      id: crypto.randomUUID(),
      callbackAuditId: input.callbackAuditId,
      executionId: input.executionId,
      agentId: input.agentId,
      runId: input.runId ?? null,
      actorUserId: input.actorUserId,
      mode: input.mode,
      status: input.status ?? "running",
      plannedDecisionClass: input.plannedDecisionClass ?? null,
      plannedPrimaryAction: input.plannedPrimaryAction ?? null,
      plannedFallbackAction: input.plannedFallbackAction ?? null,
      planReasonCategory: input.planReasonCategory ?? null,
      planReason: input.planReason ?? null,
      fallbackFailureClass: input.fallbackFailureClass ?? null,
      fallbackReason: input.fallbackReason ?? null,
      note: input.note ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: timestamp,
      finishedAt: input.status && input.status !== "running" ? timestamp : null,
    })
    .returning();

  return attempt;
}

export async function finishCallbackRemediationAttemptInTx(
  tx: NodePgDatabase<typeof schema>,
  attemptId: string,
  input: {
    status: Exclude<AgentExecutionCallbackRemediationAttemptStatus, "running">;
    errorMessage?: string | null;
    fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
    fallbackReason?: string | null;
  },
) {
  const [attempt] = await tx
    .update(agentExecutionCallbackRemediations)
    .set({
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      fallbackFailureClass: input.fallbackFailureClass ?? null,
      fallbackReason: input.fallbackReason ?? null,
      finishedAt: now(),
    })
    .where(eq(agentExecutionCallbackRemediations.id, attemptId))
    .returning();

  return attempt;
}

export function createCallbackRemediationSummaryAccumulator() {
  return {
    candidateCount: 0,
    replayPayloadStoredCount: 0,
    replayPayloadReplayableCount: 0,
    replayPayloadLegacyCompatibleCount: 0,
    replayPayloadInvalidCount: 0,
    latestFailureAt: null as string | null,
    nextDueAt: null as string | null,
    runtimeDecisionPresentCount: 0,
    runtimePressureContextCount: 0,
    reasonPolicyRows: new Map<
      string,
      { policyKey: AgentCallbackRemediationPolicyKey; reason: string; count: number }
    >(),
    decisionClass: new Map<string, number>(),
    plannedAction: new Map<string, number>(),
    fallbackAction: new Map<string, number>(),
    replayFailureClass: new Map<string, number>(),
    runtimeDecisionClass: new Map<string, number>(),
    runtimeDecisionSeverity: new Map<string, number>(),
    runtimePressureLevel: new Map<string, number>(),
    runtimeSchedulingDecisionClass: new Map<string, number>(),
    callbackType: new Map<string, number>(),
    rejectionCategory: new Map<string, number>(),
    retryability: new Map<string, number>(),
    policyKey: new Map<string, number>(),
    autoRemediationState: new Map<string, number>(),
    skipReason: new Map<string, number>(),
    failureReason: new Map<string, number>(),
  };
}

export type CallbackRemediationSummaryAccumulator = ReturnType<typeof createCallbackRemediationSummaryAccumulator>;

export function appendCallbackRemediationSummaryView(
  accumulator: CallbackRemediationSummaryAccumulator,
  callback: AgentExecutionCallbackAuditView,
  runtimeContext?: AgentExecutionCallbackRuntimeContextView | null,
) {
  accumulator.candidateCount += 1;
  accumulator.replayPayloadStoredCount += Number(callback.replayPayloadStored);
  accumulator.replayPayloadReplayableCount += Number(callback.replayPayloadReplayable);
  accumulator.replayPayloadLegacyCompatibleCount += Number(
    callback.replayPayloadCompatibility === "legacy_normalized",
  );
  accumulator.replayPayloadInvalidCount += Number(callback.replayPayloadCompatibility === "invalid");

  if (
    callback.lastAutoRemediationAt &&
    (!accumulator.latestFailureAt ||
      new Date(callback.lastAutoRemediationAt).getTime() > new Date(accumulator.latestFailureAt).getTime())
  ) {
    accumulator.latestFailureAt = callback.lastAutoRemediationAt;
  }
  if (
    callback.nextAutoRemediationAt &&
    (!accumulator.nextDueAt ||
      new Date(callback.nextAutoRemediationAt).getTime() < new Date(accumulator.nextDueAt).getTime())
  ) {
    accumulator.nextDueAt = callback.nextAutoRemediationAt;
  }

  incrementCallbackAuditSummaryBucket(accumulator.decisionClass, callback.remediationPlan.decisionClass);
  incrementCallbackAuditSummaryBucket(accumulator.plannedAction, callback.remediationPlan.primaryAction);
  incrementCallbackAuditSummaryBucket(accumulator.fallbackAction, callback.remediationPlan.fallbackAction);
  incrementCallbackAuditSummaryBucket(accumulator.callbackType, callback.callbackType);
  incrementCallbackAuditSummaryBucket(accumulator.rejectionCategory, callback.rejectionCategory ?? "none");
  incrementCallbackAuditSummaryBucket(accumulator.retryability, callback.retryability ?? "inspect");
  incrementCallbackAuditSummaryBucket(accumulator.policyKey, callback.remediationPolicyKey);
  incrementCallbackAuditSummaryBucket(accumulator.autoRemediationState, callback.autoRemediationState);

  for (const attempt of callback.remediationAttempts) {
    incrementCallbackAuditSummaryBucket(
      accumulator.replayFailureClass,
      attempt.fallbackFailureClass ?? inferReplayFailureClassFromFallbackReason(attempt.fallbackReason),
    );
  }

  if (callback.autoRemediationReasonCategory) {
    const key = `${callback.remediationPolicyKey}:${callback.autoRemediationReasonCategory}`;
    const reasonPolicyRow = accumulator.reasonPolicyRows.get(key) ?? {
      policyKey: callback.remediationPolicyKey,
      reason: callback.autoRemediationReasonCategory,
      count: 0,
    };
    reasonPolicyRow.count += 1;
    accumulator.reasonPolicyRows.set(key, reasonPolicyRow);
    if (callback.autoRemediationReasonDisposition === "skipped") {
      incrementCallbackAuditSummaryBucket(accumulator.skipReason, callback.autoRemediationReasonCategory);
    } else if (callback.autoRemediationReasonDisposition === "failed") {
      incrementCallbackAuditSummaryBucket(accumulator.failureReason, callback.autoRemediationReasonCategory);
    }
  }

  const resolvedRuntimeContext = runtimeContext ?? callback.runtimeContext;
  if (resolvedRuntimeContext?.runtimeDecisionClass) {
    accumulator.runtimeDecisionPresentCount += 1;
    incrementCallbackAuditSummaryBucket(
      accumulator.runtimeDecisionClass,
      resolvedRuntimeContext.runtimeDecisionClass,
    );
  }
  incrementCallbackAuditSummaryBucket(
    accumulator.runtimeDecisionSeverity,
    resolvedRuntimeContext?.runtimeDecisionSeverity,
  );
  if (resolvedRuntimeContext?.runtimePressureLevel) {
    accumulator.runtimePressureContextCount += 1;
    incrementCallbackAuditSummaryBucket(
      accumulator.runtimePressureLevel,
      resolvedRuntimeContext.runtimePressureLevel,
    );
  }
  incrementCallbackAuditSummaryBucket(
    accumulator.runtimeSchedulingDecisionClass,
    resolvedRuntimeContext?.runtimeSchedulingDecisionClass,
  );
}

export function buildCallbackRemediationSummaryFromAccumulator(
  accumulator: CallbackRemediationSummaryAccumulator,
): AgentExecutionCallbackRemediationSummaryView {
  const reasonPolicyRows = [...accumulator.reasonPolicyRows.values()];
  const bySkipReason = callbackAuditSummaryBuckets(accumulator.skipReason);
  const byFailureReason = callbackAuditSummaryBuckets(accumulator.failureReason);
  const byPolicyKey = callbackAuditSummaryBuckets(accumulator.policyKey);
  const alerts = buildCallbackRemediationAlerts({
    candidateCount: accumulator.candidateCount,
    bySkipReason,
    byFailureReason,
    byPolicyKey,
    reasonPolicyRows,
  });

  return {
    candidateCount: accumulator.candidateCount,
    replayPayloadStoredCount: accumulator.replayPayloadStoredCount,
    replayPayloadReplayableCount: accumulator.replayPayloadReplayableCount,
    replayPayloadLegacyCompatibleCount: accumulator.replayPayloadLegacyCompatibleCount,
    replayPayloadInvalidCount: accumulator.replayPayloadInvalidCount,
    latestFailureAt: accumulator.latestFailureAt,
    nextDueAt: accumulator.nextDueAt,
    runtimeDecisionPresentCount: accumulator.runtimeDecisionPresentCount,
    runtimePressureContextCount: accumulator.runtimePressureContextCount,
    byDecisionClass: callbackAuditSummaryBuckets(accumulator.decisionClass),
    byPlannedAction: callbackAuditSummaryBuckets(accumulator.plannedAction),
    byFallbackAction: callbackAuditSummaryBuckets(accumulator.fallbackAction),
    byReplayFailureClass: callbackAuditSummaryBuckets(accumulator.replayFailureClass),
    byRuntimeDecisionClass: callbackAuditSummaryBuckets(accumulator.runtimeDecisionClass),
    byRuntimeDecisionSeverity: callbackAuditSummaryBuckets(accumulator.runtimeDecisionSeverity),
    byRuntimePressureLevel: callbackAuditSummaryBuckets(accumulator.runtimePressureLevel),
    byRuntimeSchedulingDecisionClass: callbackAuditSummaryBuckets(accumulator.runtimeSchedulingDecisionClass),
    byCallbackType: callbackAuditSummaryBuckets(accumulator.callbackType),
    byRejectionCategory: callbackAuditSummaryBuckets(accumulator.rejectionCategory),
    byRetryability: callbackAuditSummaryBuckets(accumulator.retryability),
    byPolicyKey,
    byAutoRemediationState: callbackAuditSummaryBuckets(accumulator.autoRemediationState),
    byAlertLevel: buildCallbackRemediationAlertBuckets({ bySkipReason, byFailureReason }),
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    bySkipReason,
    byFailureReason,
    alerts,
    recommendations: buildCallbackRemediationRecommendations({
      candidateCount: accumulator.candidateCount,
      bySkipReason,
      byFailureReason,
      byPolicyKey,
      reasonPolicyRows,
    }),
  };
}

export function buildRetryabilityBuckets(rows: Array<{ key: string; count: number }>) {
  const bucketMap = new Map<string, number>();
  for (const row of rows) {
    const rejectionCategory =
      row.key === "none"
        ? null
        : (row.key as AgentExecutionCallbackRejectionCategory);
    const guidance = getExternalCallbackRetryGuidance(rejectionCategory);
    const retryability = guidance.retryability ?? "inspect";
    bucketMap.set(retryability, (bucketMap.get(retryability) ?? 0) + Number(row.count ?? 0));
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

export function buildRemediationPolicyBuckets(rows: Array<{ key: string; count: number }>) {
  const bucketMap = new Map<AgentCallbackRemediationPolicyKey, number>();
  for (const row of rows) {
    const key = normalizeRemediationPolicyKey(row.key);
    bucketMap.set(key, (bucketMap.get(key) ?? 0) + Number(row.count ?? 0));
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

export function normalizeExecutionCallbackRemediationPolicyOverrideKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return normalizeRemediationPolicyKey(value);
}

export function resolveExecutionCallbackRemediationPolicyMetadata(args: {
  execution: typeof agentExecutions.$inferSelect;
  agentSourceType: AgentSourceType;
  agentPolicyKey: string | null | undefined;
}): ExecutionCallbackRemediationPolicyMetadata {
  const overrideKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    args.execution.callbackRemediationPolicyKey,
  );
  const key = overrideKey ?? normalizeRemediationPolicyKey(args.agentPolicyKey);
  return {
    agentSourceType: args.agentSourceType,
    key,
    source: overrideKey ? "execution" : "agent",
    overrideKey,
    policy: buildAgentCallbackRemediationPolicyView(key),
  };
}

export async function buildExecutionRemediationPolicyMap(executions: Array<typeof agentExecutions.$inferSelect>) {
  if (executions.length === 0) {
    return new Map<string, ExecutionCallbackRemediationPolicyMetadata>();
  }

  const agentIds = Array.from(new Set(executions.map((row) => row.agentId)));
  const agentRows =
    agentIds.length > 0
      ? await db
          .select({
            id: agents.id,
            sourceType: agents.sourceType,
            remediationPolicyKey: agents.externalCallbackRemediationPolicy,
          })
          .from(agents)
          .where(inArray(agents.id, agentIds))
      : [];
  const agentMap = new Map(
    agentRows.map((row) => [
      row.id,
      {
        sourceType: row.sourceType as AgentSourceType,
        remediationPolicyKey: row.remediationPolicyKey,
      },
    ]),
  );

  return new Map(
    executions.map((execution) => {
      const agent = agentMap.get(execution.agentId);
      const metadata = resolveExecutionCallbackRemediationPolicyMetadata({
        execution,
        agentSourceType: agent?.sourceType ?? "platform",
        agentPolicyKey: agent?.remediationPolicyKey,
      });
      return [execution.id, metadata];
    }),
  );
}

export function buildKnownAutoRemediationReasonPatternConditions() {
  return listAutoRemediationReasonCategoriesForDisposition("skipped")
    .filter(
      (category): category is Exclude<AgentExecutionCallbackAutoRemediationReasonCategory, "attempt_failed"> =>
        category !== "attempt_failed",
    )
    .flatMap((category) => getAutoRemediationReasonFilterPatterns(category))
    .map((pattern) => sql`lower(coalesce(${agentExecutionCallbacks.autoRemediationLastError}, '')) like ${`%${pattern}%`}`);
}

export function buildAutoRemediationReasonCategoryCondition(
  category: AgentExecutionCallbackAutoRemediationReasonCategory,
): SQL {
  if (category === "attempt_failed") {
    const knownPatternConditions = buildKnownAutoRemediationReasonPatternConditions();
    return and(
      sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
      ...knownPatternConditions.map((condition) => sql`not (${condition})`),
    ) as SQL;
  }

  const patternConditions = getAutoRemediationReasonFilterPatterns(category).map(
    (pattern) => sql`lower(coalesce(${agentExecutionCallbacks.autoRemediationLastError}, '')) like ${`%${pattern}%`}`,
  );
  return and(
    sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
    or(...patternConditions) as SQL,
  ) as SQL;
}

export function buildAutoRemediationReasonDispositionCondition(
  disposition: AgentExecutionCallbackAutoRemediationReasonDisposition,
): SQL {
  const categoryConditions = listAutoRemediationReasonCategoriesForDisposition(disposition).map((category) =>
    buildAutoRemediationReasonCategoryCondition(category),
  );
  return and(
    sql`${agentExecutionCallbacks.autoRemediationLastError} is not null`,
    or(...categoryConditions) as SQL,
  ) as SQL;
}

export function extractCallbackRetryAuditId(summary: string | null | undefined) {
  if (!summary) {
    return null;
  }

  const match = summary.match(/callback audit ([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

export function buildRejectedCallbackRetryRequestDetail(args: {
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  operatorNote?: string | null;
}) {
  const parts = [
    `callbackId=${args.callbackId}`,
    `type=${args.callbackType}`,
    `callbackVersion=${args.callbackVersion}`,
    `secretVersion=${args.secretVersion}`,
    `protocolMatch=${args.usedPreviousProtocol ? "previous" : "current"}`,
    `secretMatch=${args.usedPreviousSecret ? "previous" : "current"}`,
  ];
  if (args.rejectionCategory) {
    parts.push(`rejection=${args.rejectionCategory}`);
  }
  if (args.operatorNote) {
    parts.push(`note=${args.operatorNote}`);
  }
  return parts.join(" | ");
}

export function buildStoredCallbackReplayDetail(args: {
  callbackId: string;
  replayCallbackId: string;
  callbackType: AgentExecutionCallbackType;
  operatorNote?: string | null;
}) {
  const parts = [
    `callbackId=${args.callbackId}`,
    `replayCallbackId=${args.replayCallbackId}`,
    `type=${args.callbackType}`,
  ];

  if (args.operatorNote) {
    parts.push(`operatorNote=${args.operatorNote}`);
  }

  return parts.join(" | ");
}

export async function getCallbackRemediationSummaryForOperator(
  args?: CallbackRemediationSummaryQuery,
): Promise<AgentExecutionCallbackRemediationSummaryView> {
  if (hasCallbackAuditDerivedFilters(args)) {
    const scanArgs = {
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected" as const,
      remediationPolicyKey: args?.remediationPolicyKey,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
      replayPayloadCompatibility: args?.replayPayloadCompatibility,
      replayPayloadReplayable: args?.replayPayloadReplayable,
      decisionClass: args?.decisionClass,
      replayFailureClass: args?.replayFailureClass,
      runtimeDecisionClass: args?.runtimeDecisionClass,
      runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
      runtimePressureLevel: args?.runtimePressureLevel,
      runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    } satisfies Omit<CallbackAuditOperatorQuery, "limit">;
    const accumulator = createCallbackRemediationSummaryAccumulator();
    for await (const page of iterateCallbackAuditViewPagesForOperator(scanArgs)) {
      for (const callback of page.callbacks) {
        appendCallbackRemediationSummaryView(
          accumulator,
          callback,
          page.runtimeContextMap.get(callback.executionId),
        );
      }
    }
    return buildCallbackRemediationSummaryFromAccumulator(accumulator);
  }
  const whereClause = toWhereClause([
    ...buildCallbackAuditConditions({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected",
      remediationPolicyKey: args?.remediationPolicyKey,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    }),
  ]);

  const [latestRow] = await db
    .select({
      candidateCount: sql<number>`count(*)::int`,
      latestFailureAt: max(agentExecutionCallbacks.lastAutoRemediationAt),
      nextDueAt: sql<Date | null>`min(${agentExecutionCallbacks.nextAutoRemediationAt})`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);

  const candidateRows = await db
    .select({
      id: agentExecutionCallbacks.id,
      executionId: agentExecutionCallbacks.executionId,
      agentId: agentExecutionCallbacks.agentId,
      status: agentExecutionCallbacks.status,
      rejectionCategory: agentExecutionCallbacks.rejectionCategory,
      remediationPolicyKey: agentExecutionCallbacks.remediationPolicyKey,
      usedPreviousProtocol: agentExecutionCallbacks.usedPreviousProtocol,
      usedPreviousSecret: agentExecutionCallbacks.usedPreviousSecret,
      replayPayload: agentExecutionCallbacks.replayPayload,
      autoRemediationAttempts: agentExecutionCallbacks.autoRemediationAttempts,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);
  const candidateAgentMap = await buildAgentExecutionCallbackPlanAgentMap(candidateRows.map((row) => row.agentId));
  const replayPayloadResolutions = candidateRows.map((row) =>
    resolveStoredExternalCallbackReplayEnvelope(row.replayPayload),
  );
  const remediationPlans = candidateRows.map((row, index) =>
    buildCallbackRemediationPlan({
      status: row.status as AgentExecutionCallbackAuditStatus,
      agentSourceType: candidateAgentMap.get(row.agentId)?.sourceType ?? "external",
      agentEnabled: candidateAgentMap.get(row.agentId)?.enabled ?? true,
      usedPreviousProtocol: row.usedPreviousProtocol,
      usedPreviousSecret: row.usedPreviousSecret,
      retryability:
        (getExternalCallbackRetryGuidance(
          (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
        ).retryability as AgentExecutionCallbackRetryability | null) ?? null,
      rejectionCategory: (row.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
      policy: buildAgentCallbackRemediationPolicyView(normalizeRemediationPolicyKey(row.remediationPolicyKey)),
      replayPayload: replayPayloadResolutions[index],
      autoRemediationAttempts: row.autoRemediationAttempts,
    }),
  );
  const replayPayloadStoredCount = replayPayloadResolutions.filter((row) => row.stored).length;
  const replayPayloadReplayableCount = replayPayloadResolutions.filter((row) => row.replayable).length;
  const replayPayloadLegacyCompatibleCount = replayPayloadResolutions.filter(
    (row) => row.compatibility === "legacy_normalized",
  ).length;
  const replayPayloadInvalidCount = replayPayloadResolutions.filter((row) => row.compatibility === "invalid").length;
  const byDecisionClass = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        map.set(plan.decisionClass, (map.get(plan.decisionClass) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const byPlannedAction = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        map.set(plan.primaryAction, (map.get(plan.primaryAction) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const byFallbackAction = buildSummaryBuckets(
    Array.from(
      remediationPlans.reduce((map, plan) => {
        if (plan.fallbackAction) {
          map.set(plan.fallbackAction, (map.get(plan.fallbackAction) ?? 0) + 1);
        }
        return map;
      }, new Map<string, number>()),
    ).map(([key, count]) => ({ key, count })),
  );
  const replayFailureClassRows = await db
    .select({
      key: agentExecutionCallbackRemediations.fallbackFailureClass,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbackRemediations)
    .innerJoin(
      agentExecutionCallbacks,
      eq(agentExecutionCallbackRemediations.callbackAuditId, agentExecutionCallbacks.id),
    )
    .where(
      toWhereClause([
        ...buildCallbackAuditConditions({
          agentId: args?.agentId,
          callbackType: args?.callbackType,
          status: "rejected",
          remediationPolicyKey: args?.remediationPolicyKey,
          autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
          autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
        }),
        sql`${agentExecutionCallbackRemediations.fallbackFailureClass} is not null`,
      ]),
    )
    .groupBy(agentExecutionCallbackRemediations.fallbackFailureClass);

  const callbackTypeRows = await db
    .select({
      key: agentExecutionCallbacks.callbackType,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackType);

  const rejectionCategoryRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`);

  const remediationPolicyRows = await db
    .select({
      key: agentExecutionCallbacks.remediationPolicyKey,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey);

  const remediationReasonPolicyRows = await db
    .select({
      policyKey: agentExecutionCallbacks.remediationPolicyKey,
      reason: sql<string>`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey, sql`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`);

  const autoRemediationStateRows = await db
    .select({
      key: sql<string>`
        case
          when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
          when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
          else 'idle'
        end
      `,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`
      case
        when ${agentExecutionCallbacks.autoRemediationExhaustedAt} is not null then 'exhausted'
        when ${agentExecutionCallbacks.nextAutoRemediationAt} is not null then 'scheduled'
        else 'idle'
      end
    `);

  const autoRemediationLastErrorRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(sql`coalesce(${agentExecutionCallbacks.autoRemediationLastError}, 'none')`);

  const byCallbackType = buildSummaryBuckets(callbackTypeRows as Array<{ key: string; count: number }>);
  const byRejectionCategory = buildSummaryBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRetryability = buildRetryabilityBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byPolicyKey = buildRemediationPolicyBuckets(remediationPolicyRows as Array<{ key: string; count: number }>);
  const byAutoRemediationState = buildSummaryBuckets(autoRemediationStateRows as Array<{ key: string; count: number }>);
  const byReplayFailureClass = buildSummaryBuckets(
    (replayFailureClassRows as Array<{ key: string | null; count: number }>)
      .filter((row): row is { key: string; count: number } => Boolean(row.key))
      .map((row) => ({ key: row.key, count: Number(row.count ?? 0) })),
  );
  const bySkipReason = buildAutoRemediationReasonBuckets(
    autoRemediationLastErrorRows as Array<{ key: string; count: number }>,
    "skipped",
  );
  const byFailureReason = buildAutoRemediationReasonBuckets(
    autoRemediationLastErrorRows as Array<{ key: string; count: number }>,
    "failed",
  );
  const byAlertLevel = buildCallbackRemediationAlertBuckets({
    bySkipReason,
    byFailureReason,
  });
  const reasonPolicyRows = (
    remediationReasonPolicyRows as Array<{ policyKey: string; reason: string; count: number }>
  ).map((row) => ({
    policyKey: normalizeRemediationPolicyKey(row.policyKey),
    reason: row.reason,
    count: Number(row.count ?? 0),
  }));
  const alerts = buildCallbackRemediationAlerts({
    candidateCount: Number(latestRow?.candidateCount ?? 0),
    bySkipReason,
    byFailureReason,
    byPolicyKey,
    reasonPolicyRows,
  });
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(
    candidateRows.map((row) => row.executionId),
  );
  const runtimeCorrelationSummary = buildCallbackRemediationRuntimeCorrelationSummary(
    candidateRows.map((row) => runtimeContextMap.get(row.executionId)),
  );

  return {
    candidateCount: Number(latestRow?.candidateCount ?? 0),
    replayPayloadStoredCount,
    replayPayloadReplayableCount,
    replayPayloadLegacyCompatibleCount,
    replayPayloadInvalidCount,
    latestFailureAt: latestRow?.latestFailureAt ? latestRow.latestFailureAt.toISOString() : null,
    nextDueAt: latestRow?.nextDueAt ? latestRow.nextDueAt.toISOString() : null,
    runtimeDecisionPresentCount: runtimeCorrelationSummary.runtimeDecisionPresentCount,
    runtimePressureContextCount: runtimeCorrelationSummary.runtimePressureContextCount,
    byDecisionClass,
    byPlannedAction,
    byFallbackAction,
    byReplayFailureClass,
    byRuntimeDecisionClass: runtimeCorrelationSummary.byRuntimeDecisionClass,
    byRuntimeDecisionSeverity: runtimeCorrelationSummary.byRuntimeDecisionSeverity,
    byRuntimePressureLevel: runtimeCorrelationSummary.byRuntimePressureLevel,
    byRuntimeSchedulingDecisionClass: runtimeCorrelationSummary.byRuntimeSchedulingDecisionClass,
    byCallbackType,
    byRejectionCategory,
    byRetryability,
    byPolicyKey,
    byAutoRemediationState,
    byAlertLevel,
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    bySkipReason,
    byFailureReason,
    alerts,
    recommendations: buildCallbackRemediationRecommendations({
      candidateCount: Number(latestRow?.candidateCount ?? 0),
      bySkipReason,
      byFailureReason,
      byPolicyKey,
      reasonPolicyRows,
    }),
  };
}

export async function requestRejectedCallbackRetryWithActor(args: {
  actorUserId: string;
  auditId: string;
  note?: string | null;
  actorLabel: string;
  remediationMode: AgentExecutionCallbackRemediationMode;
  plan?: AgentExecutionCallbackAuditView["remediationPlan"] | null;
  fallbackFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
  fallbackReason?: string | null;
}): Promise<AgentExecutionCallbackRetryRequestResult> {
  const normalizedAuditId = args.auditId.trim();
  if (!normalizedAuditId) {
    throw new NotFoundError("Callback audit not found");
  }

  const [row] = await db
    .select({
      callback: agentExecutionCallbacks,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionCallbacks)
    .innerJoin(agentExecutions, eq(agentExecutionCallbacks.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionCallbacks.agentId, agents.id))
    .where(eq(agentExecutionCallbacks.id, normalizedAuditId));

  if (!row) {
    throw new NotFoundError("Callback audit not found");
  }

  if (row.callback.status !== "rejected") {
    throw new ConflictError("Only rejected callback audits can be marked for retry requests");
  }

  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external callback audits support retry requests");
  }

  const operatorNote = args.note?.trim() || null;
  const duplicateSummary = `${args.actorLabel} requested a retry for rejected callback audit ${row.callback.id}.`;
  const [recentDuplicate] = await db
    .select({
      id: agentExecutionRuns.id,
    })
    .from(agentExecutionRuns)
    .where(
      and(
        eq(agentExecutionRuns.executionId, row.execution.id),
        eq(agentExecutionRuns.runKind, "callback_retry_request"),
        sql`${agentExecutionRuns.summary} like ${`%callback audit ${row.callback.id}%`}`,
        sql`${agentExecutionRuns.createdAt} >= now() - interval '15 minutes'`,
      ),
    )
    .limit(1);

  if (recentDuplicate) {
    throw new ConflictError("A callback retry request was already recorded recently for this audit");
  }

  const requestedAt = now();

  const run = await db.transaction(async (tx) => {
    await tx
      .update(agentExecutions)
      .set({
        updatedAt: requestedAt,
      })
      .where(eq(agentExecutions.id, row.execution.id));

    const createdRun = await createExecutionRunInTx(tx, {
      executionId: row.execution.id,
      agentId: row.agent.id,
      ownerUserId: row.execution.ownerUserId,
      runKind: "callback_retry_request",
      summary: duplicateSummary,
    });

    await recordExecutionStepInTx(tx, {
      executionId: row.execution.id,
      kind: "status",
      phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
        title: `${args.actorLabel} requested rejected callback retry`,
        detail: buildRejectedCallbackRetryRequestDetail({
        callbackId: row.callback.callbackId,
        callbackType: row.callback.callbackType as AgentExecutionCallbackType,
        rejectionCategory: (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
          callbackVersion: row.callback.callbackVersion,
          secretVersion: row.callback.secretVersion,
          usedPreviousProtocol: row.callback.usedPreviousProtocol,
          usedPreviousSecret: row.callback.usedPreviousSecret,
          operatorNote,
        }),
      status: "info",
      progressPercent: row.execution.progressPercent,
    });

    await createCallbackRemediationAttemptInTx(tx, {
      callbackAuditId: row.callback.id,
      executionId: row.execution.id,
      agentId: row.agent.id,
      runId: createdRun.id,
      actorUserId: args.actorUserId,
      mode: args.remediationMode,
      status: "completed",
      plannedDecisionClass: args.plan?.decisionClass ?? null,
      plannedPrimaryAction: args.plan?.primaryAction ?? "request_retry",
      plannedFallbackAction: args.plan?.fallbackAction ?? null,
      planReasonCategory: args.plan?.reasonCategory ?? null,
      planReason:
        args.plan?.reason ?? (args.fallbackReason ? "Retry request was recorded as a fallback remediation path." : null),
      fallbackFailureClass: args.fallbackFailureClass ?? null,
      fallbackReason: args.fallbackReason ?? null,
      note: operatorNote,
    });

    await finishExecutionRunInTx(tx, createdRun.id, {
      status: "completed",
      summary: `Retry request recorded for rejected callback audit ${row.callback.id} (${row.callback.callbackId}).`,
      artifactCount: 0,
    });

    return createdRun;
  });

  return {
    auditId: row.callback.id,
    executionId: row.execution.id,
    agentId: row.agent.id,
    callbackId: row.callback.callbackId,
    runId: run.id,
    operatorUserId: args.actorUserId,
    rejectionCategory: (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
    note: operatorNote,
    requestedAt: requestedAt.toISOString(),
  };
}

export async function requestRejectedCallbackRetryByOperator(
  operatorUserId: string,
  auditId: string,
  input?: { note?: string | null },
): Promise<AgentExecutionCallbackRetryRequestResult> {
  return requestRejectedCallbackRetryWithActor({
    actorUserId: operatorUserId,
    auditId,
    note: input?.note ?? null,
    actorLabel: "Operator",
    remediationMode: "retry_request",
    plan: null,
  });
}

export async function requestRejectedCallbackRetriesByOperator(
  operatorUserId: string,
  args?: {
    agentId?: string;
    callbackType?: AgentExecutionCallbackType;
    remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
    callbackVersion?: number;
    secretVersion?: number;
    protocolMatch?: "current" | "previous";
    secretMatch?: "current" | "previous";
    rejectionCategory?: AgentExecutionCallbackRejectionCategory;
    retryability?: AgentExecutionCallbackRetryability;
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
    limit?: number;
    note?: string | null;
  },
): Promise<AgentExecutionCallbackRetryBatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 50));
  const operatorNote = args?.note?.trim() || null;
  if (hasCallbackAuditDerivedFilters(args)) {
    const scopedCandidates = await listLimitedCallbackAuditViewsForOperator(
      {
        agentId: args?.agentId,
        callbackType: args?.callbackType,
        status: "rejected",
        remediationPolicyKey: args?.remediationPolicyKey,
        callbackVersion: args?.callbackVersion,
        secretVersion: args?.secretVersion,
        protocolMatch: args?.protocolMatch,
        secretMatch: args?.secretMatch,
        rejectionCategory: args?.rejectionCategory,
        retryability: args?.retryability,
        autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
        autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
        replayPayloadCompatibility: args?.replayPayloadCompatibility,
        replayPayloadReplayable: args?.replayPayloadReplayable,
        decisionClass: args?.decisionClass,
        replayFailureClass: args?.replayFailureClass,
        runtimeDecisionClass: args?.runtimeDecisionClass,
        runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
        runtimePressureLevel: args?.runtimePressureLevel,
        runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
      },
      limit,
    );
    const results: AgentExecutionCallbackRetryRequestResult[] = [];
    const skippedAuditIds: string[] = [];

    for (const candidate of scopedCandidates) {
      try {
        const result = await requestRejectedCallbackRetryByOperator(operatorUserId, candidate.id, {
          note: operatorNote,
        });
        results.push(result);
      } catch (error) {
        if (error instanceof ConflictError) {
          skippedAuditIds.push(candidate.id);
          continue;
        }
        throw error;
      }
    }

    return {
      requestedCount: results.length,
      skippedCount: skippedAuditIds.length,
      retryability: args?.retryability ?? null,
      results,
      skippedAuditIds,
    };
  }
  const whereClause = toWhereClause(
    buildCallbackAuditConditions({
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: "rejected",
      remediationPolicyKey: args?.remediationPolicyKey,
      callbackVersion: args?.callbackVersion,
      secretVersion: args?.secretVersion,
      protocolMatch: args?.protocolMatch,
      secretMatch: args?.secretMatch,
      rejectionCategory: args?.rejectionCategory,
      retryability: args?.retryability,
      autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
      autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    }),
  );

  let query = db
    .select({
      id: agentExecutionCallbacks.id,
    })
    .from(agentExecutionCallbacks)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const candidates = await query.orderBy(desc(agentExecutionCallbacks.receivedAt)).limit(limit);
  const results: AgentExecutionCallbackRetryRequestResult[] = [];
  const skippedAuditIds: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await requestRejectedCallbackRetryByOperator(operatorUserId, candidate.id, {
        note: operatorNote,
      });
      results.push(result);
    } catch (error) {
      if (error instanceof ConflictError) {
        skippedAuditIds.push(candidate.id);
        continue;
      }
      throw error;
    }
  }

  return {
    requestedCount: results.length,
    skippedCount: skippedAuditIds.length,
    retryability: args?.retryability ?? null,
    results,
    skippedAuditIds,
  };
}

export async function replayRejectedCallbackPayloadWithActor(args: {
  actorUserId: string;
  auditId: string;
  note?: string | null;
  runKind: AgentExecutionRunView["runKind"];
  actorLabel: string;
  plan?: AgentExecutionCallbackAuditView["remediationPlan"] | null;
}): Promise<AgentExecutionCallbackReplayResult> {
  const normalizedAuditId = args.auditId.trim();
  if (!normalizedAuditId) {
    throw new NotFoundError("Callback audit not found");
  }

  const [row] = await db
    .select({
      callback: agentExecutionCallbacks,
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutionCallbacks)
    .innerJoin(agentExecutions, eq(agentExecutionCallbacks.executionId, agentExecutions.id))
    .innerJoin(agents, eq(agentExecutionCallbacks.agentId, agents.id))
    .where(eq(agentExecutionCallbacks.id, normalizedAuditId));

  if (!row) {
    throw new NotFoundError("Callback audit not found");
  }
  if (row.callback.status !== "rejected") {
    throw new ConflictError("Only rejected callback audits can replay stored payloads");
  }
  if (row.agent.sourceType !== "external") {
    throw new ConflictError("Only external callback audits support stored payload replay");
  }
  if (!row.agent.enabled) {
    throw new ConflictError("External agent is disabled");
  }

  const retryGuidance = getExternalCallbackRetryGuidance(
    (row.callback.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null,
  );
  if (retryGuidance.retryability !== "retryable") {
    throw new ConflictError("Only retryable rejected callbacks support stored payload replay");
  }

  const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(row.callback.replayPayload);
  const replayPayload = replayPayloadResolution.envelope;
  if (!replayPayload) {
    throw new ConflictError("Stored payload replay is unavailable for this callback audit");
  }

  const callbackSecret = row.agent.externalCallbackSecret?.trim() || null;
  if (!callbackSecret) {
    throw new ConflictError("External agent callback secret is unavailable for payload replay");
  }

  const actorNote = args.note?.trim() || null;
  const duplicateSummary = `${args.actorLabel} replayed stored payload for callback audit ${row.callback.id}.`;
  const [recentDuplicate] = await db
    .select({
      id: agentExecutionRuns.id,
    })
    .from(agentExecutionRuns)
    .where(
      and(
        eq(agentExecutionRuns.executionId, row.execution.id),
        inArray(agentExecutionRuns.runKind, ["callback_payload_replay", "callback_auto_remediation"]),
        sql`${agentExecutionRuns.summary} like ${`%callback audit ${row.callback.id}%`}`,
        sql`${agentExecutionRuns.createdAt} >= now() - interval '15 minutes'`,
      ),
    )
    .limit(1);

  if (recentDuplicate) {
    throw new ConflictError("A callback payload replay was already recorded recently for this audit");
  }

  const replayedAt = now();
  const replayCallbackId = `replay:${row.callback.callbackId}:${crypto.randomUUID().slice(0, 8)}`;
  const remediationMode: AgentExecutionCallbackRemediationMode =
    args.runKind === "callback_auto_remediation" ? "auto_payload_replay" : "manual_payload_replay";

  const { run, attemptId } = await db.transaction(async (tx) => {
    await tx
      .update(agentExecutions)
      .set({
        updatedAt: replayedAt,
      })
      .where(eq(agentExecutions.id, row.execution.id));

    const createdRun = await createExecutionRunInTx(tx, {
      executionId: row.execution.id,
      agentId: row.agent.id,
      ownerUserId: row.execution.ownerUserId,
      runKind: args.runKind,
      summary: duplicateSummary,
    });

    await recordExecutionStepInTx(tx, {
      executionId: row.execution.id,
      kind: "status",
      phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
      title: `${args.actorLabel} replayed stored callback payload`,
      detail: buildStoredCallbackReplayDetail({
        callbackId: row.callback.callbackId,
        replayCallbackId,
        callbackType: row.callback.callbackType as AgentExecutionCallbackType,
        operatorNote: actorNote,
      }),
      status: "info",
      progressPercent: row.execution.progressPercent,
    });

    const attempt = await createCallbackRemediationAttemptInTx(tx, {
      callbackAuditId: row.callback.id,
      executionId: row.execution.id,
      agentId: row.agent.id,
      runId: createdRun.id,
      actorUserId: args.actorUserId,
      mode: remediationMode,
      plannedDecisionClass: args.plan?.decisionClass ?? null,
      plannedPrimaryAction: args.plan?.primaryAction ?? "replay_payload",
      plannedFallbackAction: args.plan?.fallbackAction ?? null,
      planReasonCategory: args.plan?.reasonCategory ?? null,
      planReason: args.plan?.reason ?? "Stored payload replay was chosen as the primary remediation path.",
      fallbackFailureClass: null,
      note: actorNote,
    });

    return {
      run: createdRun,
      attemptId: attempt.id,
    };
  });

  try {
    if (replayPayload.type === "heartbeat") {
      await recordExternalAgentExecutionHeartbeat(
        row.execution.id,
        callbackSecret,
        replayCallbackId,
        row.agent.externalCallbackProtocolVersion,
        replayedAt,
        replayPayload.statusNote ?? undefined,
      );
    } else if (replayPayload.type === "status") {
      await updateExternalAgentExecutionStatus(row.execution.id, callbackSecret, replayCallbackId, row.agent.externalCallbackProtocolVersion, replayedAt, {
        status: replayPayload.status,
        statusNote: replayPayload.statusNote ?? undefined,
        resultSummary: replayPayload.resultSummary ?? undefined,
      });
    } else {
      await addExternalAgentExecutionArtifact(
        row.execution.id,
        callbackSecret,
        replayCallbackId,
        row.agent.externalCallbackProtocolVersion,
        replayedAt,
        {
          kind: replayPayload.artifact.kind,
          title: replayPayload.artifact.title,
          url: replayPayload.artifact.url ?? undefined,
          summary: replayPayload.artifact.summary ?? undefined,
        },
      );
    }

    await db.transaction(async (tx) => {
      await finishExecutionRunInTx(tx, run.id, {
        status: "completed",
        summary: `${args.actorLabel} stored payload replay completed for callback audit ${row.callback.id} (${replayCallbackId}).`,
        artifactCount: 0,
      });
      await finishCallbackRemediationAttemptInTx(tx, attemptId, {
        status: "completed",
      });
    });
  } catch (error) {
    const replayFailureClass =
      error instanceof Error ? classifyReplayFailureForRetryFallback(error.message) : null;
    const fallbackReason =
      error instanceof Error
        ? replayFailureClass
          ? `${replayFailureClass}: ${error.message}`
          : error.message
        : "Stored payload replay failed";
    await db.transaction(async (tx) => {
      await finishExecutionRunInTx(tx, run.id, {
        status: "failed",
        summary: `${args.actorLabel} stored payload replay failed for callback audit ${row.callback.id}.`,
        errorMessage: error instanceof Error ? error.message : "Stored payload replay failed",
        artifactCount: 0,
      });
      await finishCallbackRemediationAttemptInTx(tx, attemptId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Stored payload replay failed",
        fallbackFailureClass: replayFailureClass,
        fallbackReason,
      });

      await recordExecutionStepInTx(tx, {
        executionId: row.execution.id,
        kind: "status",
        phase: (row.execution.executorPhase as PlatformExecutionPhase | null) ?? null,
        title: `${args.actorLabel} stored callback payload replay failed`,
        detail: error instanceof Error ? error.message : "Stored payload replay failed",
        status: "failed",
        progressPercent: row.execution.progressPercent,
      });
    });
    throw error;
  }

  return {
    auditId: row.callback.id,
    executionId: row.execution.id,
    agentId: row.agent.id,
    callbackId: row.callback.callbackId,
    replayCallbackId,
    callbackType: row.callback.callbackType as AgentExecutionCallbackType,
    replayPayloadCompatibility: replayPayloadResolution.compatibility,
    runId: run.id,
    operatorUserId: args.actorUserId,
    replayedAt: replayedAt.toISOString(),
  };
}

export async function replayRejectedCallbackPayloadByOperator(
  operatorUserId: string,
  auditId: string,
  input?: { note?: string | null },
): Promise<AgentExecutionCallbackReplayResult> {
  return replayRejectedCallbackPayloadWithActor({
    actorUserId: operatorUserId,
    auditId,
    note: input?.note ?? null,
    runKind: "callback_payload_replay",
    actorLabel: "Operator",
    plan: null,
  });
}

export async function autoRemediateRejectedCallbackPayloads(args?: {
  agentId?: string;
  callbackType?: AgentExecutionCallbackType;
  remediationPolicyKey?: AgentCallbackRemediationPolicyKey;
  callbackVersion?: number;
  secretVersion?: number;
  protocolMatch?: "current" | "previous";
  secretMatch?: "current" | "previous";
  rejectionCategory?: AgentExecutionCallbackRejectionCategory;
  retryability?: AgentExecutionCallbackRetryability;
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
  note?: string | null;
  actorUserId?: string | null;
  actorLabel?: string | null;
}): Promise<AgentExecutionCallbackAutoRemediationResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const callbackQuery: CallbackAuditOperatorQuery = {
    agentId: args?.agentId,
    callbackType: args?.callbackType,
    status: "rejected",
    remediationPolicyKey: args?.remediationPolicyKey,
    callbackVersion: args?.callbackVersion,
    secretVersion: args?.secretVersion,
    protocolMatch: args?.protocolMatch,
    secretMatch: args?.secretMatch,
    rejectionCategory: args?.rejectionCategory,
    retryability: args?.retryability ?? "retryable",
    autoRemediationReasonCategory: args?.autoRemediationReasonCategory,
    autoRemediationReasonDisposition: args?.autoRemediationReasonDisposition,
    replayPayloadCompatibility: args?.replayPayloadCompatibility,
    replayPayloadReplayable: args?.replayPayloadReplayable,
    decisionClass: args?.decisionClass,
    replayFailureClass: args?.replayFailureClass,
    runtimeDecisionClass: args?.runtimeDecisionClass,
    runtimeDecisionSeverity: args?.runtimeDecisionSeverity,
    runtimePressureLevel: args?.runtimePressureLevel,
    runtimeSchedulingDecisionClass: args?.runtimeSchedulingDecisionClass,
    limit: limit * 3,
  };
  const nowRef = now();
  const scheduleFilter = (candidate: typeof agentExecutionCallbacks.$inferSelect) =>
    !candidate.autoRemediationExhaustedAt &&
    (args?.ignoreScheduleWindow ||
      !candidate.nextAutoRemediationAt ||
      candidate.nextAutoRemediationAt.getTime() <= nowRef.getTime());

  let candidates: Array<typeof agentExecutionCallbacks.$inferSelect> = [];
  if (hasCallbackAuditDerivedFilters(callbackQuery)) {
    const candidateViews = await listCallbackAuditsForOperator(callbackQuery);
    const candidateIds = candidateViews.map((candidate) => candidate.id);
    const candidateRows =
      candidateIds.length > 0
        ? await db.select().from(agentExecutionCallbacks).where(inArray(agentExecutionCallbacks.id, candidateIds))
        : [];
    const candidateRowMap = new Map(candidateRows.map((row) => [row.id, row]));
    candidates = candidateIds
      .map((candidateId) => candidateRowMap.get(candidateId) ?? null)
      .filter((candidate): candidate is typeof agentExecutionCallbacks.$inferSelect => Boolean(candidate))
      .filter(scheduleFilter);
  } else {
    const whereClause = toWhereClause([
      ...buildCallbackAuditConditions(callbackQuery),
      sql`${agentExecutionCallbacks.autoRemediationExhaustedAt} is null`,
      args?.ignoreScheduleWindow
        ? sql`true`
        : sql`(${agentExecutionCallbacks.nextAutoRemediationAt} is null or ${agentExecutionCallbacks.nextAutoRemediationAt} <= now())`,
    ]);

    let query = db.select().from(agentExecutionCallbacks).$dynamic();
    if (whereClause) {
      query = query.where(whereClause);
    }
    candidates = await query.orderBy(desc(agentExecutionCallbacks.receivedAt)).limit(limit * 3);
  }

  const agentIds = Array.from(new Set(candidates.map((candidate) => candidate.agentId)));
  const agentRows =
    agentIds.length > 0 ? await db.select().from(agents).where(inArray(agents.id, agentIds)) : [];
  const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));
  const results: AgentExecutionCallbackReplayResult[] = [];
  const requestedRetryAuditIds: string[] = [];
  const skippedAuditIds: string[] = [];
  const failedAuditIds: string[] = [];
  const actorUserId = args?.actorUserId?.trim() || automaticCallbackRemediationActorId;
  const actorLabel = args?.actorLabel?.trim() || "Automatic remediation";

  async function recordSkippedAutoRemediation(
    candidate: typeof agentExecutionCallbacks.$inferSelect,
    reason: string,
    baseBackoffSeconds = env.agentExecutionCallbackAutoRemediationBaseBackoffSeconds,
  ) {
    const timestamp = now();
    await db
      .update(agentExecutionCallbacks)
      .set({
        lastAutoRemediationAt: timestamp,
        nextAutoRemediationAt: getSkippedAutoRemediationNextAttemptAt(timestamp, baseBackoffSeconds),
        autoRemediationExhaustedAt: null,
        autoRemediationLastError: reason,
      })
      .where(eq(agentExecutionCallbacks.id, candidate.id));
  }

  for (const candidate of candidates) {
    const agent = agentById.get(candidate.agentId);
    if (!agent) {
      await recordSkippedAutoRemediation(
        candidate,
        "Automatic remediation skipped because the linked agent is missing or no longer external.",
      );
      skippedAuditIds.push(candidate.id);
      continue;
    }

    const policy = buildAgentCallbackRemediationPolicyView(
      normalizeRemediationPolicyKey(candidate.remediationPolicyKey),
    );
    const maxAttempts = Math.max(0, policy.maxAttempts);
    const rejectionCategory =
      (candidate.rejectionCategory as AgentExecutionCallbackRejectionCategory | null) ?? null;

    if (results.length + requestedRetryAuditIds.length >= limit) {
      break;
    }

    const replayPayloadResolution = resolveStoredExternalCallbackReplayEnvelope(candidate.replayPayload);
    const plan = buildCallbackRemediationPlan({
      status: candidate.status as AgentExecutionCallbackAuditStatus,
      agentSourceType: agent.sourceType as AgentSourceType,
      agentEnabled: agent.enabled,
      usedPreviousProtocol: candidate.usedPreviousProtocol,
      usedPreviousSecret: candidate.usedPreviousSecret,
      retryability:
        (getExternalCallbackRetryGuidance(rejectionCategory).retryability as AgentExecutionCallbackRetryability | null) ??
        null,
      rejectionCategory,
      policy,
      replayPayload: replayPayloadResolution,
      autoRemediationAttempts: candidate.autoRemediationAttempts,
    });

    if (plan.primaryAction === "skip") {
      if (plan.reasonCategory === "policy_budget_exhausted") {
        const timestamp = now();
        await db
          .update(agentExecutionCallbacks)
          .set({
            autoRemediationExhaustedAt: candidate.autoRemediationExhaustedAt ?? timestamp,
            nextAutoRemediationAt: null,
            autoRemediationLastError: candidate.autoRemediationLastError ?? plan.reason,
          })
          .where(eq(agentExecutionCallbacks.id, candidate.id));
      } else {
        await recordSkippedAutoRemediation(candidate, plan.reason, policy.baseBackoffSeconds);
      }
      skippedAuditIds.push(candidate.id);
      continue;
    }

    try {
      if (plan.primaryAction === "replay_payload") {
        try {
          const result = await replayRejectedCallbackPayloadWithActor({
            actorUserId,
            auditId: candidate.id,
            note: args?.note ?? "Automatic remediation replayed a retryable stored callback payload.",
            runKind: "callback_auto_remediation",
            actorLabel,
            plan,
          });
          results.push(result);
        } catch (error) {
          const replayFailureClass =
            error instanceof Error ? classifyReplayFailureForRetryFallback(error.message) : null;
          if (
            plan.fallbackAction === "request_retry" &&
            error instanceof Error &&
            shouldFallbackReplayFailureToRetryRequestByPolicy({
              policy,
              errorMessage: error.message,
            })
          ) {
            await requestRejectedCallbackRetryWithActor({
              actorUserId,
              auditId: candidate.id,
              note:
                args?.note ??
                `Automatic remediation requested an external retry after stored payload replay could not proceed${
                  replayFailureClass ? ` (${replayFailureClass})` : ""
                }: ${error.message}`,
              actorLabel,
              remediationMode: "auto_retry_request",
              plan,
              fallbackFailureClass: replayFailureClass,
              fallbackReason: replayFailureClass ? `${replayFailureClass}: ${error.message}` : error.message,
            });
            requestedRetryAuditIds.push(candidate.id);
          } else {
            throw error;
          }
        }
      } else if (plan.primaryAction === "request_retry") {
        await requestRejectedCallbackRetryWithActor({
          actorUserId,
          auditId: candidate.id,
          note:
            args?.note ??
            "Automatic remediation requested an external retry because the callback is retryable but stored payload replay could not be used as the primary path.",
          actorLabel,
          remediationMode: "auto_retry_request",
          plan,
        });
        requestedRetryAuditIds.push(candidate.id);
      }

      await db
        .update(agentExecutionCallbacks)
        .set({
          autoRemediationAttempts: candidate.autoRemediationAttempts + 1,
          lastAutoRemediationAt: now(),
          nextAutoRemediationAt: null,
          autoRemediationExhaustedAt: null,
          autoRemediationLastError: null,
        })
        .where(eq(agentExecutionCallbacks.id, candidate.id));
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError) {
        await recordSkippedAutoRemediation(
          candidate,
          error.message,
          policy.baseBackoffSeconds,
        );
        skippedAuditIds.push(candidate.id);
        continue;
      }
      const attempts = candidate.autoRemediationAttempts + 1;
      const timestamp = now();
      const exhausted = attempts >= maxAttempts;
      await db
        .update(agentExecutionCallbacks)
        .set({
          autoRemediationAttempts: attempts,
          lastAutoRemediationAt: timestamp,
          nextAutoRemediationAt: exhausted ? null : getNextAutoRemediationAt(attempts, timestamp, policy.baseBackoffSeconds),
          autoRemediationExhaustedAt: exhausted ? timestamp : null,
          autoRemediationLastError: error instanceof Error ? error.message : "Automatic remediation failed",
        })
        .where(eq(agentExecutionCallbacks.id, candidate.id));
      failedAuditIds.push(candidate.id);
    }
  }

  return {
    remediatedCount: results.length,
    requestedRetryCount: requestedRetryAuditIds.length,
    skippedCount: skippedAuditIds.length,
    failedCount: failedAuditIds.length,
    results,
    requestedRetryAuditIds,
    skippedAuditIds,
    failedAuditIds,
  };
}
