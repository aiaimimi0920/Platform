import type { GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig, GatewayAnalysisAnomalyPolicyStatus, GatewayAnalysisAnomalyPolicySummaryView, GatewayAnalysisAnomalyPolicySweepView, GatewayAnalysisAnomalyPolicySyncStatus, GatewayAnalysisAnomalyPolicyView, GatewayAnalysisExportAnomalyProfileKey, GatewayAnalysisExportAnomalySeverity, GatewayAnalysisExportAnomalyThresholdConfig, GatewayAnalysisExportTextMode, GatewayPersistedAnalysisExportView, UpsertGatewayAnalysisAnomalyPolicyInput } from "@neuro/contracts";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { buildGatewayAnalysisExportAnomalyThresholdConfig } from "@/modules/gateway/analysis-anomaly";
import { buildGatewayAnalysisAnomalyPolicySummary, resolveGatewayAnalysisAnomalyPolicySchedule } from "@/modules/gateway/analysis-policy";
import { gatewayAnalysisAnomalyPolicies, gatewayRoutePolicies } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeNonNegativeInt, normalizeNonNegativeNumber, normalizeOptionalText, normalizeRequiredText, normalizeStringList, now, truncateErrorSummary } from "./shared";
import type { GatewayAnalysisAnomalyPolicyFilters, GatewayAnalysisAnomalyPolicyRow, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters, GatewayAnalysisExportAnomalyReportFilters, GatewayAnalysisExportBaselineReportFilters } from "./shared";
import { normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus } from "./anomaly-incidents";

export function normalizeGatewayAnalysisAnomalyProfileKey(
  value: GatewayAnalysisExportAnomalyProfileKey | string | null | undefined,
): GatewayAnalysisExportAnomalyProfileKey {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "conservative" || normalized === "aggressive" || normalized === "balanced") {
    return normalized;
  }
  return "balanced";
}

export function normalizeGatewayAnalysisAnomalyPolicyStatus(
  value: GatewayAnalysisAnomalyPolicyStatus | string | null | undefined,
): GatewayAnalysisAnomalyPolicyStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "disabled") {
    return "disabled";
  }
  return "enabled";
}

export function normalizeGatewayAnalysisAnomalyPolicySyncStatus(
  value: GatewayAnalysisAnomalyPolicySyncStatus | string | null | undefined,
): GatewayAnalysisAnomalyPolicySyncStatus | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "ok" || normalized === "error") {
    return normalized;
  }
  return null;
}

export function normalizeGatewayAnalysisAnomalySeverity(
  value: GatewayAnalysisExportAnomalySeverity | string | null | undefined,
): GatewayAnalysisExportAnomalySeverity | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return null;
}

export function buildGatewayAnalysisAnomalyThresholdOverrides(
  filters: GatewayAnalysisExportAnomalyReportFilters,
): Partial<GatewayAnalysisExportAnomalyThresholdConfig> {
  return {
    failureRateWarningThreshold: normalizeNonNegativeNumber(filters.failureRateWarningThreshold, null) ?? undefined,
    failureRateCriticalThreshold: normalizeNonNegativeNumber(filters.failureRateCriticalThreshold, null) ?? undefined,
    failureRateDeltaRatioThreshold: normalizeNonNegativeNumber(filters.failureRateDeltaRatioThreshold, null) ?? undefined,
    completionRateWarningThreshold: normalizeNonNegativeNumber(filters.completionRateWarningThreshold, null) ?? undefined,
    completionRateCriticalThreshold: normalizeNonNegativeNumber(filters.completionRateCriticalThreshold, null) ?? undefined,
    completionRateDeltaValueThreshold:
      filters.completionRateDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.completionRateDeltaValueThreshold)
          ? filters.completionRateDeltaValueThreshold
          : (() => {
              throw new ConflictError("completionRateDeltaValueThreshold 必须是合法数字。");
            })(),
    responseArtifactCoverageWarningThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactCoverageWarningThreshold, null) ?? undefined,
    responseArtifactCoverageCriticalThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactCoverageCriticalThreshold, null) ?? undefined,
    responseArtifactCoverageDeltaValueThreshold:
      filters.responseArtifactCoverageDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.responseArtifactCoverageDeltaValueThreshold)
          ? filters.responseArtifactCoverageDeltaValueThreshold
          : (() => {
              throw new ConflictError("responseArtifactCoverageDeltaValueThreshold 必须是合法数字。");
            })(),
    requestArtifactCoverageWarningThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactCoverageWarningThreshold, null) ?? undefined,
    requestArtifactCoverageCriticalThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactCoverageCriticalThreshold, null) ?? undefined,
    requestArtifactCoverageDeltaValueThreshold:
      filters.requestArtifactCoverageDeltaValueThreshold == null
        ? undefined
        : Number.isFinite(filters.requestArtifactCoverageDeltaValueThreshold)
          ? filters.requestArtifactCoverageDeltaValueThreshold
          : (() => {
              throw new ConflictError("requestArtifactCoverageDeltaValueThreshold 必须是合法数字。");
            })(),
    tokensPerSampleWarningDeltaRatioThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleWarningDeltaRatioThreshold, null) ?? undefined,
    tokensPerSampleCriticalDeltaRatioThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleCriticalDeltaRatioThreshold, null) ?? undefined,
    tokensPerSampleCriticalAbsoluteThreshold:
      normalizeNonNegativeNumber(filters.tokensPerSampleCriticalAbsoluteThreshold, null) ?? undefined,
  };
}

export function buildGatewayAnalysisRemediationEffectivenessAnomalyThresholdOverrides(
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters,
): Partial<GatewayAnalysisAnomalyRemediationEffectivenessAnomalyThresholdConfig> {
  return {
    impactedRunRateWarningThreshold:
      normalizeNonNegativeNumber(filters.impactedRunRateWarningThreshold, null) ?? undefined,
    impactedRunRateCriticalThreshold:
      normalizeNonNegativeNumber(filters.impactedRunRateCriticalThreshold, null) ?? undefined,
    unavailableRunRateWarningThreshold:
      normalizeNonNegativeNumber(filters.unavailableRunRateWarningThreshold, null) ?? undefined,
    unavailableRunRateCriticalThreshold:
      normalizeNonNegativeNumber(filters.unavailableRunRateCriticalThreshold, null) ?? undefined,
    completionRateRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.completionRateRegressedWarningThreshold, null) ?? undefined,
    completionRateRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.completionRateRegressedCriticalThreshold, null) ?? undefined,
    failureRateRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.failureRateRegressedWarningThreshold, null) ?? undefined,
    failureRateRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.failureRateRegressedCriticalThreshold, null) ?? undefined,
    requestArtifactRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactRegressedWarningThreshold, null) ?? undefined,
    requestArtifactRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.requestArtifactRegressedCriticalThreshold, null) ?? undefined,
    responseArtifactRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactRegressedWarningThreshold, null) ?? undefined,
    responseArtifactRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.responseArtifactRegressedCriticalThreshold, null) ?? undefined,
    firstTokenLatencyRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.firstTokenLatencyRegressedWarningThreshold, null) ?? undefined,
    firstTokenLatencyRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.firstTokenLatencyRegressedCriticalThreshold, null) ?? undefined,
    totalTokensRegressedWarningThreshold:
      normalizeNonNegativeNumber(filters.totalTokensRegressedWarningThreshold, null) ?? undefined,
    totalTokensRegressedCriticalThreshold:
      normalizeNonNegativeNumber(filters.totalTokensRegressedCriticalThreshold, null) ?? undefined,
  };
}

export function toGatewayAnalysisAnomalyPolicyView(row: GatewayAnalysisAnomalyPolicyRow): GatewayAnalysisAnomalyPolicyView {
  const schedule = resolveGatewayAnalysisAnomalyPolicySchedule({
    status: row.status,
    autoSyncEnabled: row.autoSyncEnabled,
    autoSyncIntervalMinutes: row.autoSyncIntervalMinutes ?? null,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  });
  return {
    id: row.id,
    name: row.name,
    status: normalizeGatewayAnalysisAnomalyPolicyStatus(row.status),
    projectId: row.projectId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    tag: row.tag ?? null,
    textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
    profileKey: normalizeGatewayAnalysisAnomalyProfileKey(row.profileKey),
    thresholds: row.thresholds,
    autoSyncEnabled: row.autoSyncEnabled,
    autoSyncIntervalMinutes: row.autoSyncIntervalMinutes ?? null,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastSyncStatus: normalizeGatewayAnalysisAnomalyPolicySyncStatus(row.lastSyncStatus),
      lastSyncError: row.lastSyncError ?? null,
      nextSyncDueAt: schedule.nextSyncDueAt,
    syncDue: schedule.syncDue,
    autoEscalateEnabled: row.autoEscalateEnabled,
    escalateSeverityThreshold: normalizeGatewayAnalysisAnomalySeverity(row.escalateSeverityThreshold),
    escalateAfterSyncCount: row.escalateAfterSyncCount ?? null,
    autoEscalateOwnerUserId: row.autoEscalateOwnerUserId ?? null,
    autoEscalateFollowUpStatus:
      (row.autoEscalateFollowUpStatus as GatewayAnalysisAnomalyPolicyView["autoEscalateFollowUpStatus"]) ?? null,
    autoRemediationEnabled: row.autoRemediationEnabled,
    autoRemediationIntervalMinutes: row.autoRemediationIntervalMinutes ?? null,
    autoRemediationDryRunFirst: row.autoRemediationDryRunFirst,
    autoRemediationActionKeys: normalizeStringList(row.autoRemediationActionKeys ?? null),
    autoRemediationMaxApplyRunsPerIncident: row.autoRemediationMaxApplyRunsPerIncident ?? null,
    autoRemediationRequireAlertBeforeApply: row.autoRemediationRequireAlertBeforeApply,
    autoRemediationFreezeOnProviderHealthDegrade: row.autoRemediationFreezeOnProviderHealthDegrade,
    alertingEnabled: row.alertingEnabled,
    alertIntervalMinutes: row.alertIntervalMinutes ?? null,
    notifyOperatorsOnEscalation: row.notifyOperatorsOnEscalation,
    notifyOwnerOnEscalation: row.notifyOwnerOnEscalation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findGatewayAnalysisAnomalyPolicyRow(policyId: string) {
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyPolicies)
    .where(eq(gatewayAnalysisAnomalyPolicies.id, policyId))
    .limit(1);
  return row ?? null;
}

export async function findGatewayRoutePolicyRow(routePolicyId: string) {
  const [row] = await db
    .select()
    .from(gatewayRoutePolicies)
    .where(eq(gatewayRoutePolicies.id, routePolicyId))
    .limit(1);
  return row ?? null;
}

export async function updateGatewayAnalysisAnomalyPolicySyncState(args: {
  policyId?: string | null;
  status: GatewayAnalysisAnomalyPolicySyncStatus;
  syncedAt?: Date;
  error?: string | null;
}) {
  const policyId = args.policyId?.trim() ?? "";
  if (!policyId) {
    return;
  }
  await db
    .update(gatewayAnalysisAnomalyPolicies)
    .set({
      lastSyncedAt: args.syncedAt ?? now(),
      lastSyncStatus: args.status,
      lastSyncError: normalizeOptionalText(args.error, 2_000),
      updatedAt: now(),
    })
    .where(eq(gatewayAnalysisAnomalyPolicies.id, policyId));
}

export async function resolveGatewayAnalysisAnomalyEvaluationContextForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const policyId = filters.policyId?.trim() ?? "";
  const policyRow = policyId ? await findGatewayAnalysisAnomalyPolicyRow(policyId) : null;
  if (policyId && !policyRow) {
    throw new NotFoundError("Gateway analysis anomaly policy 不存在。");
  }
  const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
  const linkedRoutePolicyRow =
    policy?.routePolicyId != null ? await findGatewayRoutePolicyRow(policy.routePolicyId).catch(() => null) : null;
  if (policy?.projectId && linkedRoutePolicyRow && linkedRoutePolicyRow.projectId !== policy.projectId) {
    throw new ConflictError("当前 anomaly policy 绑定的 route policy 与 projectId 不一致。");
  }
  if (filters.projectId?.trim() && linkedRoutePolicyRow && linkedRoutePolicyRow.projectId !== filters.projectId.trim()) {
    throw new ConflictError("filters.projectId 与 anomaly policy 绑定的 route policy project 不一致。");
  }
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey ?? policy?.profileKey);
  const thresholds = buildGatewayAnalysisExportAnomalyThresholdConfig(profileKey, {
    ...(policy?.thresholds ?? {}),
    ...buildGatewayAnalysisAnomalyThresholdOverrides(filters),
  });

  return {
    policy,
    profileKey,
    thresholds,
    filters: {
      label: filters.label ?? null,
      tag: filters.tag ?? policy?.tag ?? null,
      projectId: filters.projectId ?? policy?.projectId ?? linkedRoutePolicyRow?.projectId ?? null,
      status: (filters.status?.trim() as GatewayPersistedAnalysisExportView["status"] | undefined) ?? "active",
      textMode: filters.textMode ?? policy?.textMode ?? null,
      createdFrom: filters.createdFrom ?? null,
      createdTo: filters.createdTo ?? null,
      limit: filters.limit,
    } satisfies GatewayAnalysisExportBaselineReportFilters,
  };
}

export async function listGatewayAnalysisAnomalyPoliciesForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const dueOnly = filters.dueOnly === true;
  const rawLimit = dueOnly ? Math.max(limit, 500) : limit;
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyPolicies)
    .where(
      and(
        filters.policyId?.trim() ? eq(gatewayAnalysisAnomalyPolicies.id, filters.policyId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisAnomalyPolicies.projectId, filters.projectId.trim()) : undefined,
        filters.routePolicyId?.trim()
          ? eq(gatewayAnalysisAnomalyPolicies.routePolicyId, filters.routePolicyId.trim())
          : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisAnomalyPolicies.status, filters.status.trim()) : undefined,
        filters.tag?.trim() ? eq(gatewayAnalysisAnomalyPolicies.tag, filters.tag.trim().toLowerCase()) : undefined,
        filters.textMode ? eq(gatewayAnalysisAnomalyPolicies.textMode, filters.textMode) : undefined,
        typeof filters.autoSyncEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoSyncEnabled, filters.autoSyncEnabled)
          : undefined,
        typeof filters.autoEscalateEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoEscalateEnabled, filters.autoEscalateEnabled)
          : undefined,
        typeof filters.autoRemediationEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.autoRemediationEnabled, filters.autoRemediationEnabled)
          : undefined,
        typeof filters.alertingEnabled === "boolean"
          ? eq(gatewayAnalysisAnomalyPolicies.alertingEnabled, filters.alertingEnabled)
          : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyPolicies.updatedAt))
    .limit(rawLimit);
  const views = rows.map((row) => toGatewayAnalysisAnomalyPolicyView(row));
  return (dueOnly ? views.filter((row) => row.syncDue) : views).slice(0, limit);
}

export async function getGatewayAnalysisAnomalyPolicySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  const policies = await listGatewayAnalysisAnomalyPoliciesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(filters.limit ?? 200, 200),
  });
  return buildGatewayAnalysisAnomalyPolicySummary(policies) satisfies GatewayAnalysisAnomalyPolicySummaryView;
}

export async function saveGatewayAnalysisAnomalyPolicyForOperator(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertGatewayAnalysisAnomalyPolicyInput,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const policyId = input.id?.trim() || randomUUID();
  const policyName = normalizeRequiredText(input.name, "Policy 名称", 120);
  const status = normalizeGatewayAnalysisAnomalyPolicyStatus(input.status);
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(input.profileKey);
  const thresholds = buildGatewayAnalysisExportAnomalyThresholdConfig(profileKey, input.thresholds ?? {});
  const tag = normalizeOptionalText(input.tag, 40)?.toLowerCase() ?? null;
  const routePolicyId = input.routePolicyId?.trim() || null;
  const linkedRoutePolicy = routePolicyId ? await findGatewayRoutePolicyRow(routePolicyId) : null;
  if (routePolicyId && !linkedRoutePolicy) {
    throw new NotFoundError("绑定的 route policy 不存在。");
  }
  const requestedProjectId = input.projectId?.trim() || null;
  if (requestedProjectId && linkedRoutePolicy && linkedRoutePolicy.projectId !== requestedProjectId) {
    throw new ConflictError("anomaly policy 的 projectId 必须与 route policy 所属 project 一致。");
  }
  const projectId = requestedProjectId ?? linkedRoutePolicy?.projectId ?? null;
  const autoSyncEnabled = input.autoSyncEnabled ?? false;
  const autoSyncIntervalMinutes = autoSyncEnabled ? normalizeNonNegativeInt(input.autoSyncIntervalMinutes, 60, 10_080) : null;
  const autoEscalateEnabled = input.autoEscalateEnabled ?? false;
  const escalateSeverityThreshold = autoEscalateEnabled
    ? normalizeGatewayAnalysisAnomalySeverity(input.escalateSeverityThreshold ?? "critical")
    : null;
  const escalateAfterSyncCount = autoEscalateEnabled ? normalizeNonNegativeInt(input.escalateAfterSyncCount, 3, 1_000) : null;
  const autoEscalateOwnerUserId = autoEscalateEnabled ? input.autoEscalateOwnerUserId?.trim() || null : null;
  const autoEscalateFollowUpStatus = autoEscalateEnabled
    ? input.autoEscalateFollowUpStatus
      ? normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(input.autoEscalateFollowUpStatus)
      : "investigating"
    : null;
  const autoRemediationEnabled = input.autoRemediationEnabled ?? false;
  const autoRemediationIntervalMinutes = autoRemediationEnabled
    ? normalizeNonNegativeInt(input.autoRemediationIntervalMinutes, 180, 10_080)
    : null;
  const autoRemediationDryRunFirst = autoRemediationEnabled ? input.autoRemediationDryRunFirst !== false : true;
  const autoRemediationActionKeys = autoRemediationEnabled
    ? normalizeStringList(input.autoRemediationActionKeys ?? null)
    : null;
  const autoRemediationMaxApplyRunsPerIncident = autoRemediationEnabled
    ? normalizeNonNegativeInt(input.autoRemediationMaxApplyRunsPerIncident, null, 1_000)
    : null;
  const autoRemediationRequireAlertBeforeApply = autoRemediationEnabled
    ? input.autoRemediationRequireAlertBeforeApply === true
    : false;
  const autoRemediationFreezeOnProviderHealthDegrade = autoRemediationEnabled
    ? input.autoRemediationFreezeOnProviderHealthDegrade !== false
    : true;
  const alertingEnabled = input.alertingEnabled ?? true;
  const alertIntervalMinutes = alertingEnabled ? normalizeNonNegativeInt(input.alertIntervalMinutes, 180, 10_080) : null;
  const notifyOperatorsOnEscalation = alertingEnabled ? input.notifyOperatorsOnEscalation ?? true : false;
  const notifyOwnerOnEscalation = alertingEnabled ? input.notifyOwnerOnEscalation ?? true : false;
  const timestamp = now();

  await db
    .insert(gatewayAnalysisAnomalyPolicies)
    .values({
      id: policyId,
      name: policyName,
      status,
      projectId,
      routePolicyId,
      tag,
      textMode: input.textMode ?? null,
      profileKey,
      thresholds,
      autoSyncEnabled,
      autoSyncIntervalMinutes,
      autoEscalateEnabled,
      escalateSeverityThreshold,
      escalateAfterSyncCount,
      autoEscalateOwnerUserId,
      autoEscalateFollowUpStatus,
      autoRemediationEnabled,
      autoRemediationIntervalMinutes,
      autoRemediationDryRunFirst,
      autoRemediationActionKeys,
      autoRemediationMaxApplyRunsPerIncident,
      autoRemediationRequireAlertBeforeApply,
      autoRemediationFreezeOnProviderHealthDegrade,
      alertingEnabled,
      alertIntervalMinutes,
      notifyOperatorsOnEscalation,
      notifyOwnerOnEscalation,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: gatewayAnalysisAnomalyPolicies.id,
      set: {
        name: policyName,
        status,
        projectId,
        routePolicyId,
        tag,
        textMode: input.textMode ?? null,
        profileKey,
        thresholds,
        autoSyncEnabled,
        autoSyncIntervalMinutes,
        autoEscalateEnabled,
        escalateSeverityThreshold,
        escalateAfterSyncCount,
        autoEscalateOwnerUserId,
        autoEscalateFollowUpStatus,
        autoRemediationEnabled,
        autoRemediationIntervalMinutes,
        autoRemediationDryRunFirst,
        autoRemediationActionKeys,
        autoRemediationMaxApplyRunsPerIncident,
        autoRemediationRequireAlertBeforeApply,
        autoRemediationFreezeOnProviderHealthDegrade,
        alertingEnabled,
        alertIntervalMinutes,
        notifyOperatorsOnEscalation,
        notifyOwnerOnEscalation,
        updatedAt: timestamp,
      },
    });

  const row = await findGatewayAnalysisAnomalyPolicyRow(policyId);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly policy 保存失败。");
  }
  return toGatewayAnalysisAnomalyPolicyView(row);
}

export async function syncGatewayAnalysisAnomalyPolicyForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  policyId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedPolicyId = policyId?.trim() ?? "";
  if (!normalizedPolicyId) {
    throw new ConflictError("policyId 不能为空。");
  }
  const policyRow = await findGatewayAnalysisAnomalyPolicyRow(normalizedPolicyId);
  if (!policyRow) {
    throw new NotFoundError("Gateway analysis anomaly policy 不存在。");
  }
  const { syncGatewayAnalysisAnomalyIncidentsForOperator } = await import("./anomaly-sync");
  const sync = await syncGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    policyId: normalizedPolicyId,
  });
  const refreshedPolicy = await findGatewayAnalysisAnomalyPolicyRow(normalizedPolicyId);
  if (!refreshedPolicy) {
    throw new NotFoundError("Gateway analysis anomaly policy 同步后不存在。");
  }
  return {
    policy: toGatewayAnalysisAnomalyPolicyView(refreshedPolicy),
    sync,
  };
}

export async function sweepGatewayAnalysisAnomalyPoliciesForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyPolicyFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const startedAt = now();
  const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
  const candidates = await listGatewayAnalysisAnomalyPoliciesForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit,
  });
  const items: GatewayAnalysisAnomalyPolicySweepView["items"] = [];
  let okCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const policy of candidates) {
    if (policy.status !== "enabled" || !policy.autoSyncEnabled || !policy.syncDue) {
      skippedCount += 1;
      items.push({
        policyId: policy.id,
        policyName: policy.name,
        status: "skipped",
        error: null,
        lastSyncedAt: policy.lastSyncedAt,
        nextSyncDueAt: policy.nextSyncDueAt,
        syncDue: policy.syncDue,
        anomalyCount: 0,
        openedIncidentCount: 0,
        updatedIncidentCount: 0,
        resolvedIncidentCount: 0,
      });
      continue;
    }

    try {
      const result = await syncGatewayAnalysisAnomalyPolicyForOperator(operatorUserId, providerUserId, policy.id);
      okCount += 1;
      items.push({
        policyId: result.policy.id,
        policyName: result.policy.name,
        status: "ok",
        error: null,
        lastSyncedAt: result.policy.lastSyncedAt,
        nextSyncDueAt: result.policy.nextSyncDueAt,
        syncDue: result.policy.syncDue,
        anomalyCount: result.sync.report.anomalies.length,
        openedIncidentCount: result.sync.openedIncidentIds.length,
        updatedIncidentCount: result.sync.updatedIncidentIds.length,
        resolvedIncidentCount: result.sync.resolvedIncidentIds.length,
      });
    } catch (error) {
      errorCount += 1;
      items.push({
        policyId: policy.id,
        policyName: policy.name,
        status: "error",
        error: truncateErrorSummary(error instanceof Error ? error.message : String(error), 240),
        lastSyncedAt: policy.lastSyncedAt,
        nextSyncDueAt: policy.nextSyncDueAt,
        syncDue: policy.syncDue,
        anomalyCount: 0,
        openedIncidentCount: 0,
        updatedIncidentCount: 0,
        resolvedIncidentCount: 0,
      });
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    completedAt: now().toISOString(),
    limit,
    attemptedCount: items.length,
    okCount,
    errorCount,
    skippedCount,
    items,
  } satisfies GatewayAnalysisAnomalyPolicySweepView;
}
