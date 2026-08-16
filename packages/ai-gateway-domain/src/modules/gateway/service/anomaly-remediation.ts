import type { ExecuteGatewayAnalysisAnomalyIncidentRemediationInput, GatewayAnalysisAnomalyIncidentRemediationActionView, GatewayAnalysisAnomalyIncidentRemediationQueueItemView, GatewayAnalysisAnomalyIncidentRemediationQueueView, GatewayAnalysisAnomalyRemediationRunImpactView, GatewayAnalysisAnomalyRemediationRunSummaryView, GatewayAnalysisAnomalyIncidentRemediationRunView, GatewayAnalysisAnomalyIncidentRemediationPlanView, GatewayAnalysisAnomalyRemediationSweepView, GatewayAnalysisAnomalyRemediationRunStatus, GatewayAnalysisAnomalyIncidentView, GatewayAnalysisAnomalyPolicyView, GatewayRoutePolicyView } from "@neuro/contracts";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { resolveGatewayAnalysisAnomalyRemediationSchedule, resolveGatewayRoutingAnomalyAutoRemediationConfig, resolveGatewayRateLimitHotspotAutoRemediationConfig } from "@/modules/gateway/analysis-auto-remediation";
import { buildGatewayAnalysisAnomalyRemediationRunImpact, buildGatewayAnalysisAnomalyRemediationRunSummary } from "@/modules/gateway/analysis-remediation-impact";
import { buildGatewayAnalysisAnomalyIncidentRemediationPlan } from "@/modules/gateway/analysis-remediation";
import { resolveGatewayAnalysisAnomalyRoutePolicyPatch } from "@/modules/gateway/analysis-remediation-execution";
import { gatewayAnalysisAnomalyIncidentHistory, gatewayAnalysisAnomalyRemediationRuns, gatewayProviderAccounts } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeOptionalText, normalizeStringList, now, parseFilterTimestamp, truncateErrorSummary } from "./shared";
import type { GatewayAnalysisAnomalyRemediationQueueFilters, GatewayAnalysisAnomalyRemediationRunFilters, GatewayAnalysisAnomalyRemediationRunRow } from "./shared";
import { toGatewayRoutePolicyView } from "./views";
import { buildGatewayProviderBreakerOpenKey } from "./provider-health";
import { getGatewayAnalysisSummaryForOperator } from "./analysis-summary";
import { findGatewayAnalysisAnomalyPolicyRow, findGatewayRoutePolicyRow, toGatewayAnalysisAnomalyPolicyView } from "./anomaly-policies";
import { appendGatewayAnalysisAnomalyIncidentHistory, buildGatewayAnalysisAnomalyIncidentSnapshotMetadata, listGatewayAnalysisAnomalyIncidentsForOperator, updateGatewayAnalysisAnomalyIncidentFollowUpForOperator } from "./anomaly-incidents";
import { saveGatewayRoutePolicyForOperator } from "./provider-admin";

export function toGatewayAnalysisAnomalyRemediationRunView(
  row: GatewayAnalysisAnomalyRemediationRunRow,
): GatewayAnalysisAnomalyIncidentRemediationRunView {
  return {
    id: row.id,
    incidentId: row.incidentId,
    policyId: row.policyId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    actionKey: row.actionKey,
    title: row.title,
    executionMode: row.executionMode as GatewayAnalysisAnomalyIncidentRemediationRunView["executionMode"],
    status: row.status as GatewayAnalysisAnomalyIncidentRemediationRunView["status"],
    dryRun: row.dryRun,
    actorUserId: row.actorUserId,
    note: row.note ?? null,
    input: row.input ?? null,
    result: row.result ?? null,
    beforeIncident: (row.beforeIncident as GatewayAnalysisAnomalyIncidentRemediationRunView["beforeIncident"]) ?? null,
    afterIncident: (row.afterIncident as GatewayAnalysisAnomalyIncidentRemediationRunView["afterIncident"]) ?? null,
    beforeRoutePolicy:
      (row.beforeRoutePolicy as GatewayAnalysisAnomalyIncidentRemediationRunView["beforeRoutePolicy"]) ?? null,
    afterRoutePolicy:
      (row.afterRoutePolicy as GatewayAnalysisAnomalyIncidentRemediationRunView["afterRoutePolicy"]) ?? null,
    errorSummary: row.errorSummary ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

export async function getGatewayAnalysisAnomalyIncidentRemediationPlanForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
    operatorUserId,
    providerUserId,
    incidentId,
  );
  return context.plan;
}

export async function loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incidentId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidentHistory)
    .where(
      and(
        eq(gatewayAnalysisAnomalyIncidentHistory.incidentId, incidentId),
        inArray(gatewayAnalysisAnomalyIncidentHistory.eventType, ["sync_opened", "sync_updated"]),
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyIncidentHistory.createdAt))
    .limit(1);

  const metadata =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  return {
    entityKey: typeof metadata?.entityKey === "string" ? metadata.entityKey : null,
    snapshotId: typeof metadata?.snapshotId === "string" ? metadata.snapshotId : null,
  };
}

export async function loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  const incident = incidents[0];
  if (!incident) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const policyRow = incident.policyId ? await findGatewayAnalysisAnomalyPolicyRow(incident.policyId).catch(() => null) : null;
  const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
  const resolvedRoutePolicyId = policy?.routePolicyId ?? incident.routePolicyId ?? null;
  const routePolicyRow = resolvedRoutePolicyId ? await findGatewayRoutePolicyRow(resolvedRoutePolicyId).catch(() => null) : null;
  const routePolicy = routePolicyRow ? toGatewayRoutePolicyView(routePolicyRow) : null;
  const incidentContext = await loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incident.id);
  const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
    generatedAt: now().toISOString(),
    incident,
    policy,
    routePolicy,
    incidentContext,
  }) satisfies GatewayAnalysisAnomalyIncidentRemediationPlanView;
  return {
    incident,
    policy,
    routePolicy,
    incidentContext,
    plan,
  };
}

export async function listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        filters.incidentId ? eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, filters.incidentId) : undefined,
        filters.policyId ? eq(gatewayAnalysisAnomalyRemediationRuns.policyId, filters.policyId) : undefined,
        filters.routePolicyId ? eq(gatewayAnalysisAnomalyRemediationRuns.routePolicyId, filters.routePolicyId) : undefined,
        filters.actionKey ? eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, filters.actionKey) : undefined,
        filters.status ? eq(gatewayAnalysisAnomalyRemediationRuns.status, filters.status) : undefined,
        filters.executionMode ? eq(gatewayAnalysisAnomalyRemediationRuns.executionMode, filters.executionMode) : undefined,
        typeof filters.dryRun === "boolean" ? eq(gatewayAnalysisAnomalyRemediationRuns.dryRun, filters.dryRun) : undefined,
        createdFrom ? gte(gatewayAnalysisAnomalyRemediationRuns.createdAt, createdFrom) : undefined,
        createdTo ? lte(gatewayAnalysisAnomalyRemediationRuns.createdAt, createdTo) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyRemediationRuns.createdAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyRemediationRunView(row));
}

export async function findGatewayAnalysisAnomalyRemediationRunRow(runId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, runId))
    .limit(1);
  return row ?? null;
}

export function normalizeGatewayAnalysisRemediationImpactWindowMinutes(value: number | null | undefined) {
  return Math.max(5, Math.min(value ?? 180, 10_080));
}

export function buildGatewayAnalysisAnomalyRemediationImpactCapturePayload(args: {
  capturedAt: string;
  windowMinutes: number;
  impact: GatewayAnalysisAnomalyRemediationRunImpactView;
}) {
  return {
    capturedAt: args.capturedAt,
    windowMinutes: args.windowMinutes,
    impact: args.impact,
  } satisfies Record<string, unknown>;
}

export async function getGatewayAnalysisAnomalyRemediationRunSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
) {
  const runs = await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
  });
  return buildGatewayAnalysisAnomalyRemediationRunSummary({
    runs,
  }) satisfies GatewayAnalysisAnomalyRemediationRunSummaryView;
}

export async function getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  runId?: string | null,
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedRunId = runId?.trim() ?? "";
  if (!normalizedRunId) {
    throw new ConflictError("runId 不能为空。");
  }

  const row = await findGatewayAnalysisAnomalyRemediationRunRow(normalizedRunId);
  if (!row) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }

  const run = toGatewayAnalysisAnomalyRemediationRunView(row);
  const incident = run.afterIncident ?? run.beforeIncident ?? null;
  const projectId = incident?.projectId ?? null;
  if (!projectId) {
    throw new ConflictError("当前 remediation run 缺少 project 作用域，无法计算影响面。");
  }
  const routePolicyId = run.afterRoutePolicy?.id ?? run.beforeRoutePolicy?.id ?? run.routePolicyId ?? null;
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(options?.windowMinutes);
  const anchorAt = new Date(run.completedAt ?? run.createdAt);
  if (Number.isNaN(anchorAt.getTime())) {
    throw new ConflictError("当前 remediation run 缺少合法的时间锚点。");
  }

  const beforeStartedAt = new Date(anchorAt.getTime() - windowMinutes * 60_000);
  const beforeEndedAt = anchorAt;
  const afterStartedAt = anchorAt;
  const afterEndedAt = new Date(anchorAt.getTime() + windowMinutes * 60_000);

  const [beforeSummary, afterSummary] = await Promise.all([
    getGatewayAnalysisSummaryForOperator(operatorUserId, providerUserId, {
      projectId,
      routePolicyId,
      createdFrom: beforeStartedAt.toISOString(),
      createdTo: beforeEndedAt.toISOString(),
      limit: 1_000,
    }),
    getGatewayAnalysisSummaryForOperator(operatorUserId, providerUserId, {
      projectId,
      routePolicyId,
      createdFrom: afterStartedAt.toISOString(),
      createdTo: afterEndedAt.toISOString(),
      limit: 1_000,
    }),
  ]);

  return buildGatewayAnalysisAnomalyRemediationRunImpact({
    generatedAt: now().toISOString(),
    run,
    incident,
    projectId,
    routePolicyId,
    anchorAt: anchorAt.toISOString(),
    windowMinutes,
    beforeWindow: {
      startedAt: beforeStartedAt.toISOString(),
      endedAt: beforeEndedAt.toISOString(),
      summary: beforeSummary,
    },
    afterWindow: {
      startedAt: afterStartedAt.toISOString(),
      endedAt: afterEndedAt.toISOString(),
      summary: afterSummary,
    },
  }) satisfies GatewayAnalysisAnomalyRemediationRunImpactView;
}

export async function captureGatewayAnalysisAnomalyRemediationRunImpactForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  runId?: string | null,
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const impact = await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
    operatorUserId,
    providerUserId,
    runId,
    options,
  );

  const runRow = await findGatewayAnalysisAnomalyRemediationRunRow(impact.run.id);
  if (!runRow) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }

  const resultPayload =
    runRow.result && typeof runRow.result === "object" ? { ...(runRow.result as Record<string, unknown>) } : {};
  resultPayload.impactCapture = buildGatewayAnalysisAnomalyRemediationImpactCapturePayload({
    capturedAt: impact.generatedAt,
    windowMinutes: impact.windowMinutes,
    impact,
  });

  const [updated] = await db
    .update(gatewayAnalysisAnomalyRemediationRuns)
    .set({
      result: resultPayload,
    })
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, impact.run.id))
    .returning();

  if (impact.incident) {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: impact.incident.id,
      eventType: "remediation_impact_captured",
      actorUserId: operatorUserId,
      note: `Captured remediation impact over ${impact.windowMinutes} minutes.`,
      metadata: {
        ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: impact.incident.policyId,
          projectId: impact.incident.projectId,
          routePolicyId: impact.incident.routePolicyId,
          tag: impact.incident.tag,
          textMode: impact.incident.textMode,
          code: impact.incident.code,
          severity: impact.incident.severity,
          status: impact.incident.status,
          ownerUserId: impact.incident.ownerUserId,
          followUpStatus: impact.incident.followUpStatus,
          syncHitCount: impact.incident.syncHitCount,
          escalationStatus: impact.incident.escalationStatus,
          escalatedAt: impact.incident.escalatedAt,
          escalationReason: impact.incident.escalationReason,
          latestExportId: impact.incident.latestExportId,
          previousExportId: impact.incident.previousExportId,
          latestValue: impact.incident.latestValue,
          previousValue: impact.incident.previousValue,
          deltaValue: impact.incident.deltaValue,
          deltaRatio: impact.incident.deltaRatio,
          thresholdValue: impact.incident.thresholdValue,
        }),
        remediationRunId: impact.run.id,
        routePolicyId: impact.routePolicyId,
        windowMinutes: impact.windowMinutes,
        completionRateDelta: impact.metrics.completionRate.deltaValue,
        failureRateDelta: impact.metrics.failureRate.deltaValue,
        requestArtifactCoverageDelta: impact.metrics.requestArtifactCoverage.deltaValue,
        responseArtifactCoverageDelta: impact.metrics.responseArtifactCoverage.deltaValue,
        firstTokenLatencyMsAvgDelta: impact.metrics.firstTokenLatencyMsAvg.deltaValue,
        totalTokensPerSampleDelta: impact.metrics.totalTokensPerSample.deltaValue,
      },
    });
  }

  return {
    run: toGatewayAnalysisAnomalyRemediationRunView(updated ?? runRow),
    impact,
  };
}

export function buildGatewayAnalysisAnomalyRemediationExecutionInputFromAction(
  action: GatewayAnalysisAnomalyIncidentRemediationActionView,
  status: GatewayAnalysisAnomalyRemediationRunStatus,
): ExecuteGatewayAnalysisAnomalyIncidentRemediationInput {
  const base = {
    actionKey: action.actionKey,
    dryRun: status === "dry_run",
  } satisfies ExecuteGatewayAnalysisAnomalyIncidentRemediationInput;
  const defaults = action.defaultExecutionInput ?? null;
  if (!defaults || typeof defaults !== "object") {
    return base;
  }
  return {
    ...base,
    ...(defaults as Omit<ExecuteGatewayAnalysisAnomalyIncidentRemediationInput, "actionKey" | "dryRun">),
  };
}

export async function listGatewayAnalysisAnomalyRemediationQueueForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const dueOnly = filters.dueOnly === true;
  const referenceTime = now();
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    escalationStatus: "escalated",
    limit: Math.max(limit, 200),
  });

  const items: GatewayAnalysisAnomalyIncidentRemediationQueueItemView[] = [];
  for (const incident of incidents) {
    const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
      operatorUserId,
      providerUserId,
      incident.id,
    );
    const policyConfig = resolveGatewayAnalysisAnomalyIncidentAutoRemediationConfig(
      context.policy,
      incident,
      context.routePolicy,
    );
    for (const action of context.plan.actions) {
      if (!action.executable) {
        continue;
      }
      if (filters.actionKey?.trim() && action.actionKey !== filters.actionKey.trim()) {
        continue;
      }
      if (filters.executionMode?.trim() && action.executionMode !== filters.executionMode.trim()) {
        continue;
      }
      const actionAllowed =
        !policyConfig.autoRemediationActionKeys ||
        policyConfig.autoRemediationActionKeys.includes(action.actionKey);
      const latestRun = await findLatestGatewayAnalysisAnomalyRemediationRun(incident.id, action.actionKey);
      const appliedRunCount = await countGatewayAnalysisAnomalyRemediationRunsByStatus(
        incident.id,
        action.actionKey,
        "applied",
      );
      const providerHealthDegraded = await readGatewayRoutePolicyHealthDegraded(context.routePolicy);
      const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
        incidentStatus: incident.status,
        escalationStatus: incident.escalationStatus,
        autoRemediationEnabled: policyConfig.autoRemediationEnabled,
        actionEnabled: actionAllowed,
        autoRemediationIntervalMinutes: policyConfig.autoRemediationIntervalMinutes,
        autoRemediationDryRunFirst: policyConfig.autoRemediationDryRunFirst,
        autoRemediationMaxApplyRunsPerIncident: policyConfig.autoRemediationMaxApplyRunsPerIncident,
        autoRemediationRequireAlertBeforeApply: policyConfig.autoRemediationRequireAlertBeforeApply,
        autoRemediationFreezeOnProviderHealthDegrade: policyConfig.autoRemediationFreezeOnProviderHealthDegrade,
        appliedRunCount,
        lastAlertedAt: incident.lastAlertedAt,
        providerHealthDegraded,
        latestRunStatus: latestRun?.status ?? null,
        latestRunDryRun: latestRun?.dryRun ?? null,
        latestRunCompletedAt: latestRun?.completedAt ?? null,
        latestRunCreatedAt: latestRun?.createdAt ?? null,
        now: referenceTime,
      });
      if (dueOnly && !schedule.remediationDue) {
        continue;
      }
      items.push({
        incident,
        policy: context.policy,
        routePolicy: context.routePolicy,
        action,
        remediationDue: schedule.remediationDue,
        nextExecutionStatus: schedule.nextExecutionStatus,
        nextRunDueAt: schedule.nextRunDueAt,
        blockedReason: schedule.blockedReason,
        latestRun,
      });
    }
  }

  const sortedItems = items
    .sort((left, right) => {
      if (left.remediationDue !== right.remediationDue) {
        return left.remediationDue ? -1 : 1;
      }
      if (left.incident.severity !== right.incident.severity) {
        return left.incident.severity === "critical" ? -1 : 1;
      }
      return right.incident.updatedAt.localeCompare(left.incident.updatedAt);
    })
    .slice(0, limit);

  return {
    generatedAt: referenceTime.toISOString(),
    limit,
    dueOnly,
    itemCount: sortedItems.length,
    dueCount: sortedItems.filter((item) => item.remediationDue).length,
    items: sortedItems,
  } satisfies GatewayAnalysisAnomalyIncidentRemediationQueueView;
}

export async function sweepGatewayAnalysisAnomalyRemediationsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const startedAt = now();
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
  const queue = await listGatewayAnalysisAnomalyRemediationQueueForOperator(operatorUserId, providerUserId, {
    ...filters,
    dueOnly: true,
    limit,
  });
  const items: GatewayAnalysisAnomalyRemediationSweepView["items"] = [];
  let dryRunCount = 0;
  let appliedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const item of queue.items) {
    if (!item.remediationDue || !item.nextExecutionStatus) {
      skippedCount += 1;
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "skipped",
        executionStatus: null,
        runId: null,
        error: null,
      });
      continue;
    }
    try {
      const run = await executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
        operatorUserId,
        providerUserId,
        item.incident.id,
        buildGatewayAnalysisAnomalyRemediationExecutionInputFromAction(item.action, item.nextExecutionStatus),
      );
      if (run.status === "dry_run") {
        dryRunCount += 1;
      } else {
        appliedCount += 1;
      }
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "ok",
        executionStatus: run.status,
        runId: run.id,
        error: null,
      });
    } catch (error) {
      errorCount += 1;
      items.push({
        incidentId: item.incident.id,
        actionKey: item.action.actionKey,
        status: "error",
        executionStatus: item.nextExecutionStatus,
        runId: null,
        error: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
      });
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    limit,
    attemptedCount: queue.items.length,
    dryRunCount,
    appliedCount,
    errorCount,
    skippedCount,
    items,
  } satisfies GatewayAnalysisAnomalyRemediationSweepView;
}

export function buildGatewayAnalysisAnomalyIncidentRemediationRunResult(args: {
  action: GatewayAnalysisAnomalyIncidentRemediationActionView;
  status: GatewayAnalysisAnomalyRemediationRunStatus;
  changedFields?: string[];
  summary?: string | null;
}) {
  return {
    actionKey: args.action.actionKey,
    executionMode: args.action.executionMode,
    status: args.status,
    changedFields: args.changedFields ?? [],
    summary: args.summary ?? null,
  } satisfies Record<string, unknown>;
}

export async function executeGatewayAnalysisAnomalyIncidentRemediationForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  input: ExecuteGatewayAnalysisAnomalyIncidentRemediationInput = { actionKey: "" },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const actionKey = input.actionKey?.trim() ?? "";
  if (!actionKey) {
    throw new ConflictError("actionKey 不能为空。");
  }

  const context = await loadGatewayAnalysisAnomalyIncidentRemediationContextForOperator(
    operatorUserId,
    providerUserId,
    incidentId,
  );
  const action = context.plan.actions.find((item) => item.actionKey === actionKey);
  if (!action) {
    throw new ConflictError(`incident 当前不存在 remediation action: ${actionKey}`);
  }
  if (!action.executable || action.executionMode === "informational") {
    throw new ConflictError(`remediation action ${action.actionKey} 仅提供建议，当前不支持直接执行。`);
  }

  const timestamp = now();
  const dryRun = input.dryRun === true;
  const runId = randomUUID();
  const note = normalizeOptionalText(input.note, 2_000);
  const beforeIncident = context.incident;
  const beforeRoutePolicy = context.routePolicy;

  let afterIncident: GatewayAnalysisAnomalyIncidentView | null = beforeIncident;
  let afterRoutePolicy: GatewayRoutePolicyView | null = beforeRoutePolicy;
  let resultPayload: Record<string, unknown> | null = null;
  let errorSummary: string | null = null;
  let runStatus: GatewayAnalysisAnomalyRemediationRunStatus = dryRun ? "dry_run" : "applied";

  try {
    if (action.executionMode === "incident_follow_up") {
      const requestedFollowUp = input.incidentFollowUp ?? {};
      const resolvedFollowUp = {
        ownerUserId: Object.prototype.hasOwnProperty.call(requestedFollowUp, "ownerUserId")
          ? requestedFollowUp.ownerUserId ?? null
          : beforeIncident.ownerUserId,
        followUpStatus: Object.prototype.hasOwnProperty.call(requestedFollowUp, "followUpStatus")
          ? requestedFollowUp.followUpStatus ?? beforeIncident.followUpStatus
          : beforeIncident.followUpStatus === "pending"
            ? "investigating"
            : beforeIncident.followUpStatus,
        note: Object.prototype.hasOwnProperty.call(requestedFollowUp, "note")
          ? requestedFollowUp.note ?? null
          : beforeIncident.latestNote,
        resolutionNote: Object.prototype.hasOwnProperty.call(requestedFollowUp, "resolutionNote")
          ? requestedFollowUp.resolutionNote ?? null
          : beforeIncident.resolutionNote,
      };
      if (dryRun) {
        afterIncident = {
          ...beforeIncident,
          ownerUserId: resolvedFollowUp.ownerUserId,
          followUpStatus:
            resolvedFollowUp.followUpStatus ?? beforeIncident.followUpStatus,
          latestNote: resolvedFollowUp.note,
          resolutionNote: resolvedFollowUp.resolutionNote,
          lastActionAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString(),
        };
      } else {
        afterIncident = await updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(
          operatorUserId,
          providerUserId,
          beforeIncident.id,
          resolvedFollowUp,
        );
      }
      resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
        action,
        status: runStatus,
        changedFields: ["ownerUserId", "followUpStatus", "note", "resolutionNote"],
        summary: "Updated incident ownership and follow-up fields.",
      });
    } else if (action.executionMode === "route_policy_patch") {
      if (!beforeRoutePolicy) {
        throw new ConflictError(`remediation action ${action.actionKey} 需要绑定 route policy 才能执行。`);
      }
      const patch = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
        action,
        routePolicy: beforeRoutePolicy,
        input,
      });
      if (dryRun) {
        afterRoutePolicy = {
          ...beforeRoutePolicy,
          config: patch.nextConfig,
          updatedAt: timestamp.toISOString(),
        };
      } else {
        afterRoutePolicy = await saveGatewayRoutePolicyForOperator(
          operatorUserId,
          providerUserId,
          beforeRoutePolicy.id,
          {
            projectId: beforeRoutePolicy.projectId,
            name: beforeRoutePolicy.name,
            isDefault: beforeRoutePolicy.isDefault,
            enabled: beforeRoutePolicy.enabled,
            config: patch.nextConfig,
          },
        );
      }
      resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
        action,
        status: runStatus,
        changedFields: patch.changedFields,
        summary: patch.summary,
      });
    }
  } catch (error) {
    runStatus = "failed";
    errorSummary = truncateErrorSummary(error instanceof Error ? error.message : String(error), 500);
    resultPayload = buildGatewayAnalysisAnomalyIncidentRemediationRunResult({
      action,
      status: runStatus,
      changedFields: [],
      summary: errorSummary,
    });
  }

  await db.insert(gatewayAnalysisAnomalyRemediationRuns).values({
    id: runId,
    incidentId: beforeIncident.id,
    policyId: beforeIncident.policyId ?? null,
    routePolicyId: afterRoutePolicy?.id ?? beforeRoutePolicy?.id ?? null,
    actionKey: action.actionKey,
    title: action.title,
    executionMode: action.executionMode,
    status: runStatus,
    dryRun,
    actorUserId: operatorUserId,
    note,
    input: {
      actionKey,
      dryRun,
      incidentFollowUp: input.incidentFollowUp ?? null,
      routePolicyPatch: input.routePolicyPatch ?? null,
    },
    result: resultPayload,
    beforeIncident,
    afterIncident,
    beforeRoutePolicy,
    afterRoutePolicy,
    errorSummary,
    createdAt: timestamp,
    completedAt: timestamp,
  });

  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: beforeIncident.id,
    eventType: runStatus === "failed" ? "remediation_failed" : dryRun ? "remediation_dry_run" : "remediation_applied",
    actorUserId: operatorUserId,
    note: note ?? resultPayload?.summary?.toString() ?? action.title,
    metadata: {
      ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: beforeIncident.policyId,
        projectId: beforeIncident.projectId,
        tag: beforeIncident.tag,
        textMode: beforeIncident.textMode,
        code: beforeIncident.code,
        severity: beforeIncident.severity,
        status: afterIncident?.status ?? beforeIncident.status,
        ownerUserId: afterIncident?.ownerUserId ?? beforeIncident.ownerUserId,
        followUpStatus: afterIncident?.followUpStatus ?? beforeIncident.followUpStatus,
        syncHitCount: afterIncident?.syncHitCount ?? beforeIncident.syncHitCount,
        escalationStatus: afterIncident?.escalationStatus ?? beforeIncident.escalationStatus,
        escalatedAt: afterIncident?.escalatedAt ?? beforeIncident.escalatedAt,
        escalationReason: afterIncident?.escalationReason ?? beforeIncident.escalationReason,
        lastAlertAttemptAt: afterIncident?.lastAlertAttemptAt ?? beforeIncident.lastAlertAttemptAt,
        lastAlertedAt: afterIncident?.lastAlertedAt ?? beforeIncident.lastAlertedAt,
        lastAlertSeverity: afterIncident?.lastAlertSeverity ?? beforeIncident.lastAlertSeverity,
        alertDeliveryCount: afterIncident?.alertDeliveryCount ?? beforeIncident.alertDeliveryCount,
        latestExportId: afterIncident?.latestExportId ?? beforeIncident.latestExportId,
        previousExportId: afterIncident?.previousExportId ?? beforeIncident.previousExportId,
        latestValue: afterIncident?.latestValue ?? beforeIncident.latestValue,
        previousValue: afterIncident?.previousValue ?? beforeIncident.previousValue,
        deltaValue: afterIncident?.deltaValue ?? beforeIncident.deltaValue,
        deltaRatio: afterIncident?.deltaRatio ?? beforeIncident.deltaRatio,
        thresholdValue: afterIncident?.thresholdValue ?? beforeIncident.thresholdValue,
      }),
      remediationRunId: runId,
      actionKey: action.actionKey,
      executionMode: action.executionMode,
      runStatus,
      dryRun,
      routePolicyId: afterRoutePolicy?.id ?? beforeRoutePolicy?.id ?? null,
      result: resultPayload,
      errorSummary,
    },
    createdAt: timestamp,
  });

  if (runStatus === "failed") {
    throw new ConflictError(errorSummary ?? `remediation action ${action.actionKey} 执行失败。`);
  }

  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(eq(gatewayAnalysisAnomalyRemediationRuns.id, runId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway anomaly remediation run 不存在。");
  }
  return toGatewayAnalysisAnomalyRemediationRunView(row);
}

export function resolveGatewayAnalysisAnomalyPolicyAutoRemediationConfig(policy: GatewayAnalysisAnomalyPolicyView | null) {
  return {
    autoRemediationEnabled: policy?.autoRemediationEnabled ?? false,
    autoRemediationIntervalMinutes: policy?.autoRemediationIntervalMinutes ?? 180,
    autoRemediationDryRunFirst: policy?.autoRemediationDryRunFirst ?? true,
    autoRemediationActionKeys: normalizeStringList(policy?.autoRemediationActionKeys ?? null),
    autoRemediationMaxApplyRunsPerIncident: policy?.autoRemediationMaxApplyRunsPerIncident ?? null,
    autoRemediationRequireAlertBeforeApply: policy?.autoRemediationRequireAlertBeforeApply ?? false,
    autoRemediationFreezeOnProviderHealthDegrade: policy?.autoRemediationFreezeOnProviderHealthDegrade ?? true,
  };
}

export function resolveGatewayAnalysisAnomalyIncidentAutoRemediationConfig(
  policy: GatewayAnalysisAnomalyPolicyView | null,
  incident: GatewayAnalysisAnomalyIncidentView,
  routePolicy: GatewayRoutePolicyView | null,
) {
  if (policy) {
    return resolveGatewayAnalysisAnomalyPolicyAutoRemediationConfig(policy);
  }
  const hotspotConfig = resolveGatewayRateLimitHotspotAutoRemediationConfig(incident, routePolicy);
  if (hotspotConfig.autoRemediationEnabled) {
    return hotspotConfig;
  }
  return resolveGatewayRoutingAnomalyAutoRemediationConfig(incident, routePolicy);
}

export async function findLatestGatewayAnalysisAnomalyRemediationRun(
  incidentId: string,
  actionKey: string,
) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, incidentId),
        eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, actionKey),
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyRemediationRuns.createdAt))
    .limit(1);
  return row ? toGatewayAnalysisAnomalyRemediationRunView(row) : null;
}

export async function countGatewayAnalysisAnomalyRemediationRunsByStatus(
  incidentId: string,
  actionKey: string,
  status: GatewayAnalysisAnomalyRemediationRunStatus,
) {
  const rows = await db
    .select({ id: gatewayAnalysisAnomalyRemediationRuns.id })
    .from(gatewayAnalysisAnomalyRemediationRuns)
    .where(
      and(
        eq(gatewayAnalysisAnomalyRemediationRuns.incidentId, incidentId),
        eq(gatewayAnalysisAnomalyRemediationRuns.actionKey, actionKey),
        eq(gatewayAnalysisAnomalyRemediationRuns.status, status),
      ),
    );
  return rows.length;
}

export async function readGatewayRoutePolicyHealthDegraded(routePolicy: GatewayRoutePolicyView | null) {
  if (!routePolicy?.config.allowedProviderAccountIds?.length) {
    return false;
  }
  const providerIds = routePolicy.config.allowedProviderAccountIds;
  const providerRows = await db
    .select()
    .from(gatewayProviderAccounts)
    .where(inArray(gatewayProviderAccounts.id, providerIds));
  if (providerRows.some((row) => row.status !== "active")) {
    return true;
  }
  for (const providerId of providerIds) {
    const breakerOpenRaw = await redis.get(buildGatewayProviderBreakerOpenKey(providerId)).catch(() => null);
    if (breakerOpenRaw) {
      return true;
    }
  }
  return false;
}
