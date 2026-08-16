import type {
  AgentExecutionCallbackAuditStatus,
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackAuditSummaryView,
  AgentExecutionCallbackAuditView,
  AgentExecutionCallbackRuntimeContextView,
  AgentExecutionRuntimeProfileKey,
  AgentSourceType,
} from "@neuro/contracts";
import { and, desc, eq, inArray, lt, max, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  classifyExternalCallbackRejection,
  getRejectionCategoriesForRetryability,
  resolveExternalCallbackCompatibility,
  type StoredExternalCallbackReplayEnvelope,
} from "@/modules/agent-execution/callback-governance";
import {
  classifyReplayFailureForRetryFallback,
} from "@/modules/agent-execution/callback-remediation-plan";
import {
  resolveRuntimeDecisionFromPayload,
} from "@/modules/agent-execution/runtime-decision";
import { buildCallbackAuditRecommendations } from "@/modules/agent-execution/operator-callback-analysis";
import {
  getExternalAgentExecution,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionCallbacks,
  agentExecutions,
} from "@/modules/agent-execution/schema";

import { toSerializablePayload } from "./pricing";
import {
  buildAutoRemediationReasonCategoryCondition,
  buildAutoRemediationReasonDispositionCondition,
  buildRemediationPolicyBuckets,
  buildRetryabilityBuckets,
  resolveExecutionCallbackRemediationPolicyMetadata,
} from "./remediation";
import { getAgentExecutionRuntimeCatalog } from "./runtime-catalog";
import {
  CallbackAuditOperatorQuery,
  now,
  toWhereClause,
} from "./shared";
import {
  buildAgentExecutionCallbackPlanAgentMap,
  buildCallbackRemediationAttemptMap,
  toAgentExecutionCallbackAuditView,
} from "./views";

export async function recordExternalCallbackAudit(args: {
  tx: NodePgDatabase<typeof schema>;
  executionId: string;
  agentId: string;
  remediationPolicyKey: AgentCallbackRemediationPolicyKey;
  callbackId: string;
  callbackType: AgentExecutionCallbackType;
  status: AgentExecutionCallbackAuditStatus;
  callbackVersion: number;
  secretVersion: number;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  callbackTimestamp: Date | null;
  rejectionCategory?: AgentExecutionCallbackRejectionCategory | null;
  payloadSummary: string | null;
  replayPayload?: StoredExternalCallbackReplayEnvelope | null;
}) {
  await args.tx.insert(agentExecutionCallbacks).values({
    id: crypto.randomUUID(),
    executionId: args.executionId,
    agentId: args.agentId,
    remediationPolicyKey: args.remediationPolicyKey,
    callbackId: args.callbackId,
    callbackType: args.callbackType,
    status: args.status,
    callbackVersion: args.callbackVersion,
    secretVersion: args.secretVersion,
    usedPreviousProtocol: args.usedPreviousProtocol,
    usedPreviousSecret: args.usedPreviousSecret,
    callbackTimestamp: args.callbackTimestamp,
    rejectionCategory: args.rejectionCategory ?? null,
    payloadSummary: args.payloadSummary,
    replayPayload: args.replayPayload ?? null,
    receivedAt: now(),
  });
}

export function getExecutionCallbackRemediationPolicyKey(args: {
  execution: typeof agentExecutions.$inferSelect;
  agent: { sourceType: string | null | undefined; externalCallbackRemediationPolicy: string | null | undefined };
}) {
  return resolveExecutionCallbackRemediationPolicyMetadata({
    execution: args.execution,
    agentSourceType: (args.agent.sourceType as AgentSourceType | null) ?? "platform",
    agentPolicyKey: args.agent.externalCallbackRemediationPolicy,
  }).key;
}

export async function recordRejectedExternalCallbackAudit(input: {
  executionId: string;
  callbackSecret?: string | null;
  callbackId?: string | null;
  callbackType: AgentExecutionCallbackType;
  callbackVersion?: number | null;
  callbackTimestamp?: Date | null;
  payloadSummary?: string | null;
  replayPayload?: StoredExternalCallbackReplayEnvelope | null;
  rejectionReason: string;
}) {
  const row = await getExternalAgentExecution(input.executionId);
  if (!row || row.agent.sourceType !== "external") {
    return;
  }

  const callbackId = input.callbackId?.trim() || `rejected:${crypto.randomUUID()}`;
  const payloadSummary = [input.rejectionReason, input.payloadSummary].filter(Boolean).join(" | ");
  const rejectionCategory = classifyExternalCallbackRejection(input.rejectionReason);
  const compatibility = resolveExternalCallbackCompatibility(row.agent, {
    callbackSecret: input.callbackSecret ?? null,
    callbackVersion: input.callbackVersion ?? null,
    now: now(),
  });

  try {
    await db.transaction(async (tx) => {
      await recordExternalCallbackAudit({
        tx,
        executionId: row.execution.id,
        agentId: row.agent.id,
        remediationPolicyKey: getExecutionCallbackRemediationPolicyKey(row),
        callbackId,
        callbackType: input.callbackType,
        status: "rejected",
        callbackVersion: input.callbackVersion ?? 0,
        secretVersion: compatibility.matchedSecretVersion ?? row.agent.externalCallbackSecretVersion,
        usedPreviousProtocol: compatibility.usedPreviousProtocol,
        usedPreviousSecret: compatibility.usedPreviousSecret,
        callbackTimestamp: input.callbackTimestamp ?? null,
        rejectionCategory,
        payloadSummary: payloadSummary || null,
        replayPayload: input.replayPayload ?? null,
      });
    });
  } catch (auditError) {
    console.error("Failed to persist rejected external callback audit", auditError);
  }
}

export function getExternalCallbackIdempotencyKey(executionId: string, callbackId: string) {
  return `agent-execution:external-callback:${executionId}:${callbackId}`;
}

export function buildSummaryBuckets(rows: Array<{ key: string; count: number }>) {
  return rows
    .map((row) => ({ key: row.key, count: Number(row.count ?? 0) }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function buildSummaryBucketsFromValues(values: Array<string | null | undefined>, options?: { noneKey?: string }) {
  const bucketMap = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim() || options?.noneKey || "";
    if (!normalized) {
      continue;
    }
    bucketMap.set(normalized, (bucketMap.get(normalized) ?? 0) + 1);
  }
  return buildSummaryBuckets([...bucketMap.entries()].map(([key, count]) => ({ key, count })));
}

export function inferReplayFailureClassFromFallbackReason(
  fallbackReason: string | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  const normalized = fallbackReason?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("stored_payload_unavailable:")) {
    return "stored_payload_unavailable";
  }
  if (normalized.startsWith("callback_secret_unavailable:")) {
    return "callback_secret_unavailable";
  }
  if (normalized.startsWith("duplicate_replay_cooldown:")) {
    return "duplicate_replay_cooldown";
  }
  if (normalized.startsWith("agent_disabled:")) {
    return "agent_disabled";
  }
  if (normalized.startsWith("callback_not_retryable:")) {
    return "callback_not_retryable";
  }
  if (normalized.startsWith("unsupported_target:")) {
    return "unsupported_target";
  }
  if (normalized.startsWith("callback_protocol_mismatch:")) {
    return "callback_protocol_mismatch";
  }
  return classifyReplayFailureForRetryFallback(normalized);
}

export async function buildCallbackAuditRuntimeContextMap(
  executionIds: string[],
): Promise<Map<string, AgentExecutionCallbackRuntimeContextView>> {
  const uniqueExecutionIds = Array.from(new Set(executionIds));
  if (uniqueExecutionIds.length === 0) {
    return new Map();
  }

  const runtimeCatalog = await getAgentExecutionRuntimeCatalog();
  const utilizationByProfileKey = new Map(runtimeCatalog.utilization.map((entry) => [entry.key, entry]));
  const executionRows = await db
    .select({
      id: agentExecutions.id,
      ownerUserId: agentExecutions.ownerUserId,
      runtimeProfileKey: agentExecutions.runtimeProfileKey,
      outputPayload: agentExecutions.outputPayload,
    })
    .from(agentExecutions)
    .where(inArray(agentExecutions.id, uniqueExecutionIds));

  return new Map(
    executionRows.map((row) => {
      const runtimeDecision = resolveRuntimeDecisionFromPayload(toSerializablePayload(row.outputPayload));
      const runtimeProfileKey =
        (row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? runtimeDecision?.runtimeProfileKey ?? null;
      const utilization = runtimeProfileKey ? utilizationByProfileKey.get(runtimeProfileKey) ?? null : null;
      return [
        row.id,
        {
          runtimeProfileKey,
          ownerUserId: row.ownerUserId,
          runtimeDecisionClass: runtimeDecision?.decisionClass ?? null,
          runtimeDecisionSeverity: runtimeDecision?.severity ?? null,
          runtimePressureLevel: utilization?.pressureLevel ?? null,
          runtimeSchedulingDecisionClass: utilization?.schedulingDecisionClass ?? null,
        } satisfies AgentExecutionCallbackRuntimeContextView,
      ];
    }),
  );
}

export function callbackAuditMatchesDerivedFilters(
  callback: AgentExecutionCallbackAuditView,
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "replayPayloadCompatibility"
    | "replayPayloadReplayable"
    | "decisionClass"
    | "replayFailureClass"
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
  runtimeContext?: AgentExecutionCallbackRuntimeContextView | null,
) {
  const effectiveRuntimeContext = runtimeContext ?? callback.runtimeContext;
  if (
    args?.replayPayloadCompatibility &&
    callback.replayPayloadCompatibility !== args.replayPayloadCompatibility
  ) {
    return false;
  }
  if (
    typeof args?.replayPayloadReplayable === "boolean" &&
    callback.replayPayloadReplayable !== args.replayPayloadReplayable
  ) {
    return false;
  }
  if (args?.decisionClass && callback.remediationPlan.decisionClass !== args.decisionClass) {
    return false;
  }
  if (args?.replayFailureClass) {
    const matchedAttempt = callback.remediationAttempts.some((attempt) => {
      const failureClass =
        attempt.fallbackFailureClass ?? inferReplayFailureClassFromFallbackReason(attempt.fallbackReason);
      return failureClass === args.replayFailureClass;
    });
    if (!matchedAttempt) {
      return false;
    }
  }
  if (args?.runtimeDecisionClass && effectiveRuntimeContext?.runtimeDecisionClass !== args.runtimeDecisionClass) {
    return false;
  }
  if (args?.runtimeDecisionSeverity && effectiveRuntimeContext?.runtimeDecisionSeverity !== args.runtimeDecisionSeverity) {
    return false;
  }
  if (args?.runtimePressureLevel && effectiveRuntimeContext?.runtimePressureLevel !== args.runtimePressureLevel) {
    return false;
  }
  if (
    args?.runtimeSchedulingDecisionClass &&
    effectiveRuntimeContext?.runtimeSchedulingDecisionClass !== args.runtimeSchedulingDecisionClass
  ) {
    return false;
  }
  return true;
}

export function hasCallbackAuditRuntimeDerivedFilters(
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
) {
  return Boolean(
    args?.runtimeDecisionClass ||
      args?.runtimeDecisionSeverity ||
      args?.runtimePressureLevel ||
      args?.runtimeSchedulingDecisionClass,
  );
}

export function hasCallbackAuditDerivedFilters(
  args?: Pick<
    CallbackAuditOperatorQuery,
    | "replayPayloadCompatibility"
    | "replayPayloadReplayable"
    | "decisionClass"
    | "replayFailureClass"
    | "runtimeDecisionClass"
    | "runtimeDecisionSeverity"
    | "runtimePressureLevel"
    | "runtimeSchedulingDecisionClass"
  >,
) {
  return Boolean(
    args?.replayPayloadCompatibility !== undefined ||
      args?.replayPayloadReplayable !== undefined ||
      args?.decisionClass ||
      args?.replayFailureClass ||
      hasCallbackAuditRuntimeDerivedFilters(args),
  );
}

export const CALLBACK_AUDIT_DERIVED_SCAN_PAGE_SIZE = 200;

export async function buildCallbackAuditViewsFromRows(
  rows: Array<typeof agentExecutionCallbacks.$inferSelect>,
  args?: Omit<CallbackAuditOperatorQuery, "limit">,
) {
  const attemptMap = await buildCallbackRemediationAttemptMap(rows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(rows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(rows.map((row) => row.executionId));
  const callbacks = rows
    .map((row) =>
      toAgentExecutionCallbackAuditView(
        row,
        attemptMap.get(row.id) ?? [],
        agentMap.get(row.agentId),
        runtimeContextMap.get(row.executionId),
      ),
    )
    .filter((callback) => callbackAuditMatchesDerivedFilters(callback, args, runtimeContextMap.get(callback.executionId)));

  return {
    callbacks,
    runtimeContextMap,
  };
}

export async function* iterateCallbackAuditViewPagesForOperator(args: Omit<CallbackAuditOperatorQuery, "limit">) {
  let cursor: { receivedAt: Date; id: string } | null = null;

  while (true) {
    const conditions = buildCallbackAuditConditions(args);
    if (cursor) {
      conditions.push(
        or(
          lt(agentExecutionCallbacks.receivedAt, cursor.receivedAt),
          and(eq(agentExecutionCallbacks.receivedAt, cursor.receivedAt), lt(agentExecutionCallbacks.id, cursor.id)),
        ) as SQL,
      );
    }
    const whereClause = toWhereClause(conditions);
    let query = db.select().from(agentExecutionCallbacks).$dynamic();
    if (whereClause) query = query.where(whereClause);

    const rows = await query
      .orderBy(desc(agentExecutionCallbacks.receivedAt), desc(agentExecutionCallbacks.id))
      .limit(CALLBACK_AUDIT_DERIVED_SCAN_PAGE_SIZE);
    if (rows.length === 0) break;

    yield await buildCallbackAuditViewsFromRows(rows, args);

    const lastRow = rows.at(-1)!;
    cursor = { receivedAt: lastRow.receivedAt, id: lastRow.id };
    if (rows.length < CALLBACK_AUDIT_DERIVED_SCAN_PAGE_SIZE) break;
  }
}

export async function listLimitedCallbackAuditViewsForOperator(
  args: Omit<CallbackAuditOperatorQuery, "limit">,
  limit: number,
) {
  const callbacks: AgentExecutionCallbackAuditView[] = [];

  for await (const page of iterateCallbackAuditViewPagesForOperator(args)) {
    callbacks.push(...page.callbacks.slice(0, limit - callbacks.length));
    if (callbacks.length >= limit) break;
  }

  return callbacks;
}

export function createCallbackAuditSummaryAccumulator() {
  return {
    totalCount: 0,
    newestReceivedAt: null as string | null,
    callbackType: new Map<string, number>(),
    status: new Map<string, number>(),
    callbackVersion: new Map<string, number>(),
    secretVersion: new Map<string, number>(),
    protocolMatch: new Map<string, number>(),
    secretMatch: new Map<string, number>(),
    rejectionCategory: new Map<string, number>(),
    retryability: new Map<string, number>(),
    remediationPolicyKey: new Map<string, number>(),
    autoRemediationState: new Map<string, number>(),
  };
}

export type CallbackAuditSummaryAccumulator = ReturnType<typeof createCallbackAuditSummaryAccumulator>;

export function incrementCallbackAuditSummaryBucket(bucket: Map<string, number>, value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return;
  bucket.set(normalized, (bucket.get(normalized) ?? 0) + 1);
}

export function appendCallbackAuditSummaryView(
  accumulator: CallbackAuditSummaryAccumulator,
  callback: AgentExecutionCallbackAuditView,
) {
  accumulator.totalCount += 1;
  accumulator.newestReceivedAt ??= callback.receivedAt;
  incrementCallbackAuditSummaryBucket(accumulator.callbackType, callback.callbackType);
  incrementCallbackAuditSummaryBucket(accumulator.status, callback.status);
  incrementCallbackAuditSummaryBucket(accumulator.callbackVersion, String(callback.callbackVersion));
  incrementCallbackAuditSummaryBucket(accumulator.secretVersion, String(callback.secretVersion));
  incrementCallbackAuditSummaryBucket(
    accumulator.protocolMatch,
    callback.usedPreviousProtocol ? "previous" : "current",
  );
  incrementCallbackAuditSummaryBucket(accumulator.secretMatch, callback.usedPreviousSecret ? "previous" : "current");
  incrementCallbackAuditSummaryBucket(accumulator.remediationPolicyKey, callback.remediationPolicyKey);
  incrementCallbackAuditSummaryBucket(accumulator.autoRemediationState, callback.autoRemediationState);
  if (callback.status === "rejected") {
    incrementCallbackAuditSummaryBucket(accumulator.rejectionCategory, callback.rejectionCategory ?? "none");
    incrementCallbackAuditSummaryBucket(accumulator.retryability, callback.retryability ?? "inspect");
  }
}

export function callbackAuditSummaryBuckets(bucket: Map<string, number>) {
  return buildSummaryBuckets([...bucket.entries()].map(([key, count]) => ({ key, count })));
}

export function buildCallbackAuditSummaryFromAccumulator(
  accumulator: CallbackAuditSummaryAccumulator,
): AgentExecutionCallbackAuditSummaryView {
  const byStatus = callbackAuditSummaryBuckets(accumulator.status);
  const byProtocolMatch = callbackAuditSummaryBuckets(accumulator.protocolMatch);
  const bySecretMatch = callbackAuditSummaryBuckets(accumulator.secretMatch);
  const byRejectionCategory = callbackAuditSummaryBuckets(accumulator.rejectionCategory);
  const byRetryability = callbackAuditSummaryBuckets(accumulator.retryability);

  return {
    totalCount: accumulator.totalCount,
    newestReceivedAt: accumulator.newestReceivedAt,
    byCallbackType: callbackAuditSummaryBuckets(accumulator.callbackType),
    byStatus,
    byCallbackVersion: callbackAuditSummaryBuckets(accumulator.callbackVersion),
    bySecretVersion: callbackAuditSummaryBuckets(accumulator.secretVersion),
    byProtocolMatch,
    bySecretMatch,
    byRejectionCategory,
    byRetryability,
    byRemediationPolicyKey: callbackAuditSummaryBuckets(accumulator.remediationPolicyKey),
    byAutoRemediationState: callbackAuditSummaryBuckets(accumulator.autoRemediationState),
    recommendations: buildCallbackAuditRecommendations({
      totalCount: accumulator.totalCount,
      byStatus,
      byProtocolMatch,
      bySecretMatch,
      byRejectionCategory,
      byRetryability,
    }),
  };
}

export function buildCallbackAuditSummaryFromViews(
  callbacks: AgentExecutionCallbackAuditView[],
): AgentExecutionCallbackAuditSummaryView {
  const accumulator = createCallbackAuditSummaryAccumulator();
  for (const callback of callbacks) appendCallbackAuditSummaryView(accumulator, callback);
  return buildCallbackAuditSummaryFromAccumulator(accumulator);
}

export function buildCallbackAuditConditions(args?: CallbackAuditOperatorQuery) {
  const conditions: SQL[] = [];
  if (args?.agentId) conditions.push(eq(agentExecutionCallbacks.agentId, args.agentId));
  if (args?.callbackType) conditions.push(eq(agentExecutionCallbacks.callbackType, args.callbackType));
  if (args?.status) conditions.push(eq(agentExecutionCallbacks.status, args.status));
  if (args?.remediationPolicyKey) {
    conditions.push(eq(agentExecutionCallbacks.remediationPolicyKey, args.remediationPolicyKey));
  }
  if (typeof args?.callbackVersion === "number") {
    conditions.push(eq(agentExecutionCallbacks.callbackVersion, args.callbackVersion));
  }
  if (typeof args?.secretVersion === "number") {
    conditions.push(eq(agentExecutionCallbacks.secretVersion, args.secretVersion));
  }
  if (args?.protocolMatch === "current") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousProtocol, false));
  }
  if (args?.protocolMatch === "previous") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousProtocol, true));
  }
  if (args?.secretMatch === "current") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousSecret, false));
  }
  if (args?.secretMatch === "previous") {
    conditions.push(eq(agentExecutionCallbacks.usedPreviousSecret, true));
  }
  if (args?.rejectionCategory) {
    conditions.push(eq(agentExecutionCallbacks.rejectionCategory, args.rejectionCategory));
  }
  if (args?.retryability) {
    conditions.push(eq(agentExecutionCallbacks.status, "rejected"));
    conditions.push(
      inArray(agentExecutionCallbacks.rejectionCategory, getRejectionCategoriesForRetryability(args.retryability)),
    );
  }
  if (args?.autoRemediationReasonCategory) {
    conditions.push(buildAutoRemediationReasonCategoryCondition(args.autoRemediationReasonCategory));
  } else if (args?.autoRemediationReasonDisposition) {
    conditions.push(buildAutoRemediationReasonDispositionCondition(args.autoRemediationReasonDisposition));
  }
  return conditions;
}

export async function listCallbackAuditsForOperator(
  args?: CallbackAuditOperatorQuery,
): Promise<AgentExecutionCallbackAuditView[]> {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  if (hasCallbackAuditDerivedFilters(args)) {
    return listLimitedCallbackAuditViewsForOperator(
      {
        agentId: args?.agentId,
        callbackType: args?.callbackType,
        status: args?.status,
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
  }
  const whereClause = toWhereClause(buildCallbackAuditConditions(args));
  let query = db.select().from(agentExecutionCallbacks).$dynamic();

  if (whereClause) query = query.where(whereClause);

  const rows = await query
    .orderBy(desc(agentExecutionCallbacks.receivedAt), desc(agentExecutionCallbacks.id))
    .limit(limit);
  const attemptMap = await buildCallbackRemediationAttemptMap(rows.map((row) => row.id));
  const agentMap = await buildAgentExecutionCallbackPlanAgentMap(rows.map((row) => row.agentId));
  const runtimeContextMap = await buildCallbackAuditRuntimeContextMap(rows.map((row) => row.executionId));
  return rows.map((row) =>
    toAgentExecutionCallbackAuditView(
      row,
      attemptMap.get(row.id) ?? [],
      agentMap.get(row.agentId),
      runtimeContextMap.get(row.executionId),
    ),
  );
}

export async function getCallbackAuditSummaryForOperator(
  args?: CallbackAuditOperatorQuery,
): Promise<AgentExecutionCallbackAuditSummaryView> {
  if (hasCallbackAuditDerivedFilters(args)) {
    const scanArgs = {
      agentId: args?.agentId,
      callbackType: args?.callbackType,
      status: args?.status,
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
    } satisfies Omit<CallbackAuditOperatorQuery, "limit">;
    const accumulator = createCallbackAuditSummaryAccumulator();
    for await (const page of iterateCallbackAuditViewPagesForOperator(scanArgs)) {
      for (const callback of page.callbacks) appendCallbackAuditSummaryView(accumulator, callback);
    }
    return buildCallbackAuditSummaryFromAccumulator(accumulator);
  }
  const whereClause = toWhereClause(buildCallbackAuditConditions(args));

  const [latestRow] = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      newestReceivedAt: max(agentExecutionCallbacks.receivedAt),
    })
    .from(agentExecutionCallbacks)
    .where(whereClause);

  const callbackTypeRows = await db
    .select({
      key: agentExecutionCallbacks.callbackType,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackType);

  const statusRows = await db
    .select({
      key: agentExecutionCallbacks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.status);

  const callbackVersionRows = await db
    .select({
      key: sql<string>`${agentExecutionCallbacks.callbackVersion}::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.callbackVersion);

  const secretVersionRows = await db
    .select({
      key: sql<string>`${agentExecutionCallbacks.secretVersion}::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.secretVersion);

  const protocolMatchRows = await db
    .select({
      key: sql<string>`case when ${agentExecutionCallbacks.usedPreviousProtocol} then 'previous' else 'current' end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.usedPreviousProtocol);

  const secretMatchRows = await db
    .select({
      key: sql<string>`case when ${agentExecutionCallbacks.usedPreviousSecret} then 'previous' else 'current' end`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.usedPreviousSecret);

  const rejectionCategoryRows = await db
    .select({
      key: sql<string>`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(
      toWhereClause([
        ...buildCallbackAuditConditions(args),
        eq(agentExecutionCallbacks.status, "rejected"),
      ]),
    )
    .groupBy(sql`coalesce(${agentExecutionCallbacks.rejectionCategory}, 'none')`);

  const remediationPolicyRows = await db
    .select({
      key: agentExecutionCallbacks.remediationPolicyKey,
      count: sql<number>`count(*)::int`,
    })
    .from(agentExecutionCallbacks)
    .where(whereClause)
    .groupBy(agentExecutionCallbacks.remediationPolicyKey);

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

  const byStatus = buildSummaryBuckets(statusRows as Array<{ key: string; count: number }>);
  const byProtocolMatch = buildSummaryBuckets(protocolMatchRows as Array<{ key: string; count: number }>);
  const bySecretMatch = buildSummaryBuckets(secretMatchRows as Array<{ key: string; count: number }>);
  const byRejectionCategory = buildSummaryBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRetryability = buildRetryabilityBuckets(rejectionCategoryRows as Array<{ key: string; count: number }>);
  const byRemediationPolicyKey = buildRemediationPolicyBuckets(
    remediationPolicyRows as Array<{ key: string; count: number }>,
  );
  const totalCount = Number(latestRow?.totalCount ?? 0);

  return {
    totalCount,
    newestReceivedAt: latestRow?.newestReceivedAt ? latestRow.newestReceivedAt.toISOString() : null,
    byCallbackType: buildSummaryBuckets(callbackTypeRows as Array<{ key: string; count: number }>),
    byStatus,
    byCallbackVersion: buildSummaryBuckets(callbackVersionRows as Array<{ key: string; count: number }>),
    bySecretVersion: buildSummaryBuckets(secretVersionRows as Array<{ key: string; count: number }>),
    byProtocolMatch,
    bySecretMatch,
    byRejectionCategory,
    byRetryability,
    byRemediationPolicyKey,
    byAutoRemediationState: buildSummaryBuckets(autoRemediationStateRows as Array<{ key: string; count: number }>),
    recommendations: buildCallbackAuditRecommendations({
      totalCount,
      byStatus,
      byProtocolMatch,
      bySecretMatch,
      byRejectionCategory,
      byRetryability,
    }),
  };
}
