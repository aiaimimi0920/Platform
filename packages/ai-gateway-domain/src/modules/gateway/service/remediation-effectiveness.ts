import type { GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView, GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView, GatewayAnalysisAnomalyRemediationEffectivenessSummaryView, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView, GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView, GatewayAnalysisAnomalyRemediationRunImpactView, GatewayAnalysisExportAnomalyProfileKey } from "@neuro/contracts";
import { randomUUID } from "node:crypto";
import { buildGatewayAnalysisAnomalyRemediationEffectivenessSummary } from "@/modules/gateway/analysis-remediation-effectiveness";
import { buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport, buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig } from "@/modules/gateway/analysis-remediation-snapshot-anomaly";
import { buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary } from "@/modules/gateway/analysis-remediation-snapshot-inventory";
import { buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint, buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport } from "@/modules/gateway/analysis-remediation-snapshot-trend";
import { buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey, buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey } from "@/modules/gateway/object-keys";
import { listGatewayObjects, putGatewayObject, readGatewayObject } from "@/modules/gateway/object-storage";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeNonNegativeInt, now, parseFilterTimestamp } from "./shared";
import type { GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters, GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters, GatewayAnalysisAnomalyRemediationRunFilters } from "./shared";
import { buildGatewayAnalysisRemediationEffectivenessAnomalyThresholdOverrides, normalizeGatewayAnalysisAnomalyProfileKey } from "./anomaly-policies";
import { getGatewayAnalysisAnomalyRemediationRunImpactForOperator, listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator, normalizeGatewayAnalysisRemediationImpactWindowMinutes } from "./anomaly-remediation";

export function normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 120);
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationRunFilters = {},
  options?: { windowMinutes?: number | null },
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(options?.windowMinutes);
  const runs = await listGatewayAnalysisAnomalyIncidentRemediationRunsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 100, 200)),
  });

  const impacts = await Promise.all(
    runs.map(async (run) => {
      if (run.status !== "applied") {
        return null;
      }
      const cachedImpact =
        run.result &&
        typeof run.result === "object" &&
        (run.result as Record<string, unknown>).impactCapture &&
        typeof (run.result as Record<string, unknown>).impactCapture === "object"
          ? (((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).windowMinutes ===
              windowMinutes &&
            ((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).impact &&
            typeof ((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>).impact === "object")
            ? (((run.result as Record<string, unknown>).impactCapture as Record<string, unknown>)
                .impact as GatewayAnalysisAnomalyRemediationRunImpactView)
            : null
          : null;
      if (cachedImpact) {
        return cachedImpact;
      }
      try {
        return await getGatewayAnalysisAnomalyRemediationRunImpactForOperator(
          operatorUserId,
          providerUserId,
          run.id,
          { windowMinutes },
        );
      } catch {
        return null;
      }
    }),
  );

  return buildGatewayAnalysisAnomalyRemediationEffectivenessSummary({
    generatedAt: now().toISOString(),
    windowMinutes,
    runs,
    impacts,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessSummaryView;
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView(args: {
  filters: GatewayAnalysisAnomalyRemediationRunFilters;
  limit: number;
  lookbackHours: number | null;
  windowMinutes: number;
}): GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView["filters"] {
  const normalizedStatus =
    args.filters.status === "dry_run" || args.filters.status === "applied" || args.filters.status === "failed"
      ? args.filters.status
      : null;
  const normalizedExecutionMode =
    args.filters.executionMode === "informational" ||
    args.filters.executionMode === "incident_follow_up" ||
    args.filters.executionMode === "route_policy_patch"
      ? args.filters.executionMode
      : null;
  return {
    incidentId: args.filters.incidentId?.trim() ?? null,
    policyId: args.filters.policyId?.trim() ?? null,
    routePolicyId: args.filters.routePolicyId?.trim() ?? null,
    actionKey: args.filters.actionKey?.trim() ?? null,
    status: normalizedStatus,
    executionMode: normalizedExecutionMode,
    dryRun: typeof args.filters.dryRun === "boolean" ? args.filters.dryRun : null,
    createdFrom: args.filters.createdFrom?.trim() ?? null,
    createdTo: args.filters.createdTo?.trim() ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    windowMinutes: args.windowMinutes,
  };
}

export function buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView(args: {
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
}): GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView["filters"] {
  return {
    label: args.filters.label?.trim() || null,
    routePolicyId: args.filters.routePolicyId?.trim() || null,
    actionKey: args.filters.actionKey?.trim() || null,
    createdFrom: args.filters.createdFrom?.trim() || null,
    createdTo: args.filters.createdTo?.trim() || null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    profileKey: args.profileKey,
  };
}

export function matchesGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters(
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.actionKey?.trim() && snapshot.filters.actionKey !== filters.actionKey.trim()) {
    return false;
  }
  const createdAt = new Date(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

export async function readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;
}

export function matchesGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters(
  snapshot: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters,
  createdFrom: Date | null,
  createdTo: Date | null,
) {
  if (filters.snapshotId?.trim() && snapshot.snapshotId !== filters.snapshotId.trim()) {
    return false;
  }
  if (filters.label?.trim()) {
    const needle = filters.label.trim().toLowerCase();
    const haystack = snapshot.label?.trim().toLowerCase() ?? "";
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.actionKey?.trim() && snapshot.filters.actionKey !== filters.actionKey.trim()) {
    return false;
  }
  if (filters.profileKey?.trim()) {
    const expected = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey);
    if (snapshot.filters.profileKey !== expected) {
      return false;
    }
  }
  const createdAt = new Date(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom) {
    return false;
  }
  if (createdTo && createdAt > createdTo) {
    return false;
  }
  return true;
}

export async function readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;
}

export async function persistGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisAnomalyRemediationRunFilters & {
    label?: string | null;
    windowMinutes?: number | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const windowMinutes = normalizeGatewayAnalysisRemediationImpactWindowMinutes(args.windowMinutes);
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const summary = await getGatewayAnalysisAnomalyRemediationEffectivenessForOperator(
    operatorUserId,
    providerUserId,
    {
      ...args,
      createdFrom,
      limit,
    },
    {
      windowMinutes,
    },
  );

  const snapshotId = randomUUID();
  const objectKey = buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilterView({
      filters: {
        ...args,
        createdFrom,
      },
      limit,
      lookbackHours,
      windowMinutes,
    }),
    summary,
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/remediation-effectiveness-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessSnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway remediation effectiveness snapshot 不存在。");
  }
  return snapshot;
}

export function normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters = {},
) {
  return {
    snapshotId: filters.snapshotId ?? null,
    label: filters.label ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    actionKey: filters.actionKey ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters;
}

export async function resolveGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyContext(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const profileKey = normalizeGatewayAnalysisAnomalyProfileKey(filters.profileKey);
  const thresholds = buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig(profileKey, {
    ...buildGatewayAnalysisRemediationEffectivenessAnomalyThresholdOverrides(filters),
  });

  return {
    profileKey,
    thresholds,
    filters: normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(filters),
  };
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshots = await listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
    operatorUserId,
    providerUserId,
    {
      ...filters,
      limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
    },
  );
  return buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary({
    snapshots,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryView;
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = normalizeGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendFilters(filters);
  const [snapshots, inventorySummary] = await Promise.all([
    listGatewayAnalysisAnomalyRemediationEffectivenessSnapshotsForOperator(
      operatorUserId,
      providerUserId,
      normalizedFilters,
    ),
    getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummaryForOperator(
      operatorUserId,
      providerUserId,
      {
        ...normalizedFilters,
        limit: 500,
      },
    ),
  ]);
  const points = snapshots.map((snapshot) =>
    buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint(snapshot),
  );

  return buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      routePolicyId: normalizedFilters.routePolicyId ?? null,
      actionKey: normalizedFilters.actionKey ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView;
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters = {},
) {
  const context = await resolveGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyContext(
    operatorUserId,
    providerUserId,
    filters,
  );
  const trendReport = await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotTrendReportForOperator(
    operatorUserId,
    providerUserId,
    context.filters,
  );
  return buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport({
    trendReport,
    profileKey: context.profileKey,
    thresholds: context.thresholds,
  }) satisfies GatewayAnalysisAnomalyRemediationEffectivenessAnomalyReportView;
}

export async function persistGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters & {
    label?: string | null;
    lookbackHours?: number | null;
  } = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const lookbackHours = normalizeNonNegativeInt(args.lookbackHours, null, 24 * 365);
  const createdFrom =
    args.createdFrom?.trim() ||
    (lookbackHours != null ? new Date(timestamp.getTime() - lookbackHours * 60 * 60 * 1000).toISOString() : null);
  const normalizedFilters = {
    ...args,
    createdFrom,
    limit: Math.max(1, Math.min(args.limit ?? 10, 50)),
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportFilters;
  const report = await getGatewayAnalysisAnomalyRemediationEffectivenessSnapshotAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    normalizedFilters,
  );
  const snapshotId = randomUUID();
  const objectKey = buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilterView({
      filters: normalizedFilters,
      limit: normalizedFilters.limit ?? 10,
      lookbackHours,
      profileKey: report.profileKey,
    }),
    report,
  } satisfies GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/remediation-effectiveness-anomaly-snapshots")).filter(
    (key) => key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (
      !matchesGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotFilters(
        snapshot,
        filters,
        createdFrom,
        createdTo,
      )
    ) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayAnalysisAnomalyRemediationEffectivenessAnomalySnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway remediation effectiveness anomaly snapshot 不存在。");
  }
  return snapshot;
}
