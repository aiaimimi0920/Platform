import type { GatewayAnalysisExportAnomalyProfileKey, GatewayRateLimitHotspotFilterView, GatewayRateLimitHotspotTrendReportView, GatewayRateLimitHotspotAnomalyReportView, GatewayRateLimitHotspotSnapshotView, GatewayRateLimitHotspotSnapshotInventorySummaryView, GatewayRateLimitHotspotSnapshotTrendReportView, GatewayRateLimitHotspotAnomalySnapshotView } from "@neuro/contracts";
import { randomUUID } from "node:crypto";
import { buildGatewayRateLimitHotspotAnomalySnapshotObjectKey, buildGatewayRateLimitHotspotSnapshotObjectKey } from "@/modules/gateway/object-keys";
import { buildGatewayRateLimitHotspotSummary } from "../rate-limit-hotspot";
import { buildGatewayRateLimitHotspotSnapshotInventorySummary } from "../rate-limit-hotspot-snapshot-inventory";
import { buildGatewayRateLimitHotspotSnapshotTrendPoint, buildGatewayRateLimitHotspotSnapshotTrendReport } from "../rate-limit-hotspot-snapshot-trend";
import { buildGatewayRateLimitHotspotTrendReport } from "../rate-limit-hotspot-trend";
import { buildGatewayRateLimitHotspotAnomalyReport, buildGatewayRateLimitHotspotAnomalyThresholdConfig } from "../rate-limit-hotspot-anomaly";
import { listGatewayObjects, putGatewayObject, readGatewayObject } from "@/modules/gateway/object-storage";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeNonNegativeInt, now, parseFilterTimestamp } from "./shared";
import type { GatewayRateLimitHotspotAnomalyOperatorFilters, GatewayRateLimitHotspotAnomalySnapshotFilters, GatewayRateLimitHotspotOperatorFilters, GatewayRateLimitHotspotSnapshotFilters, GatewayRateLimitHotspotSnapshotTrendFilters, GatewayRequestAuditOperatorFilters } from "./shared";
import { listGatewayRequestAuditsForOperator } from "./operator-audits";
import { normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel } from "./remediation-effectiveness";

export async function summarizeGatewayRateLimitHotspotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRequestAuditOperatorFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1000));
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    status: "failed",
    limit,
  });
  return buildGatewayRateLimitHotspotSummary(rows);
}

export function toGatewayRateLimitHotspotFilterView(
  filters: GatewayRateLimitHotspotOperatorFilters,
  args: { limit: number; windowSize: number; bucketSizeMinutes: number },
): GatewayRateLimitHotspotFilterView {
  return {
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    providerAccountId: filters.providerAccountId ?? null,
    sessionId: filters.sessionId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    responseId: filters.responseId ?? null,
    protocolFamily: filters.protocolFamily ?? null,
    endpointKind: filters.endpointKind ?? null,
    errorCode: filters.errorCode ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: args.limit,
    windowSize: args.windowSize,
    bucketSizeMinutes: args.bucketSizeMinutes,
  };
}

export async function getGatewayRateLimitHotspotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotOperatorFilters = {},
): Promise<GatewayRateLimitHotspotTrendReportView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 1000, 1000));
  const windowSize = Math.max(1, Math.min(filters.windowSize ?? 12, 168));
  const bucketSizeMinutes = Math.max(1, Math.min(filters.bucketSizeMinutes ?? 60, 1440));
  const rows = await listGatewayRequestAuditsForOperator(operatorUserId, providerUserId, {
    ...filters,
    status: "failed",
    limit,
  });
  return buildGatewayRateLimitHotspotTrendReport({
    generatedAt: now().toISOString(),
    filters: toGatewayRateLimitHotspotFilterView(filters, {
      limit,
      windowSize,
      bucketSizeMinutes,
    }),
    rows,
  });
}

export async function getGatewayRateLimitHotspotAnomalyReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotAnomalyOperatorFilters = {},
): Promise<GatewayRateLimitHotspotAnomalyReportView> {
  const profileKey = filters.profileKey ?? "balanced";
  const trendReport = await getGatewayRateLimitHotspotTrendReportForOperator(operatorUserId, providerUserId, filters);
  const thresholds = buildGatewayRateLimitHotspotAnomalyThresholdConfig(profileKey, filters.thresholds ?? {});
  return buildGatewayRateLimitHotspotAnomalyReport({
    generatedAt: now().toISOString(),
    trendReport,
    profileKey,
    thresholds,
  });
}

export function buildGatewayRateLimitHotspotSnapshotFilterView(args: {
  filters: GatewayRateLimitHotspotOperatorFilters;
  limit: number;
  lookbackHours: number | null;
}) {
  return {
    projectId: args.filters.projectId ?? null,
    routePolicyId: args.filters.routePolicyId ?? null,
    providerAccountId: args.filters.providerAccountId ?? null,
    sessionId: args.filters.sessionId ?? null,
    apiKeyId: args.filters.apiKeyId ?? null,
    responseId: args.filters.responseId ?? null,
    protocolFamily: args.filters.protocolFamily ?? null,
    endpointKind: args.filters.endpointKind ?? null,
    errorCode: args.filters.errorCode ?? null,
    createdFrom: args.filters.createdFrom ?? null,
    createdTo: args.filters.createdTo ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
  } satisfies GatewayRateLimitHotspotSnapshotView["filters"];
}

export function buildGatewayRateLimitHotspotAnomalySnapshotFilterView(args: {
  filters: GatewayRateLimitHotspotAnomalyOperatorFilters;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
}) {
  return {
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.filters.label ?? null),
    projectId: args.filters.projectId ?? null,
    routePolicyId: args.filters.routePolicyId ?? null,
    apiKeyId: args.filters.apiKeyId ?? null,
    endpointKind: args.filters.endpointKind ?? null,
    createdFrom: args.filters.createdFrom ?? null,
    createdTo: args.filters.createdTo ?? null,
    limit: args.limit,
    lookbackHours: args.lookbackHours,
    profileKey: args.profileKey,
  } satisfies GatewayRateLimitHotspotAnomalySnapshotView["filters"];
}

export async function readGatewayRateLimitHotspotSnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayRateLimitHotspotSnapshotView;
}

export async function readGatewayRateLimitHotspotAnomalySnapshot(objectKey: string) {
  const buffer = await readGatewayObject(objectKey);
  return JSON.parse(buffer.toString("utf8")) as GatewayRateLimitHotspotAnomalySnapshotView;
}

export function matchesGatewayRateLimitHotspotSnapshotFilters(
  snapshot: GatewayRateLimitHotspotSnapshotView,
  filters: GatewayRateLimitHotspotSnapshotFilters,
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
  if (filters.projectId?.trim() && snapshot.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.apiKeyId?.trim() && snapshot.filters.apiKeyId !== filters.apiKeyId.trim()) {
    return false;
  }
  if (filters.endpointKind?.trim() && snapshot.filters.endpointKind !== filters.endpointKind.trim()) {
    return false;
  }
  const createdAt = Date.parse(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom.getTime()) {
    return false;
  }
  if (createdTo && createdAt > createdTo.getTime()) {
    return false;
  }
  return true;
}

export function matchesGatewayRateLimitHotspotAnomalySnapshotFilters(
  snapshot: GatewayRateLimitHotspotAnomalySnapshotView,
  filters: GatewayRateLimitHotspotAnomalySnapshotFilters,
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
  if (filters.projectId?.trim() && snapshot.filters.projectId !== filters.projectId.trim()) {
    return false;
  }
  if (filters.routePolicyId?.trim() && snapshot.filters.routePolicyId !== filters.routePolicyId.trim()) {
    return false;
  }
  if (filters.apiKeyId?.trim() && snapshot.filters.apiKeyId !== filters.apiKeyId.trim()) {
    return false;
  }
  if (filters.endpointKind?.trim() && snapshot.filters.endpointKind !== filters.endpointKind.trim()) {
    return false;
  }
  if (filters.profileKey?.trim() && snapshot.filters.profileKey !== filters.profileKey.trim()) {
    return false;
  }
  const createdAt = Date.parse(snapshot.createdAt);
  if (createdFrom && createdAt < createdFrom.getTime()) {
    return false;
  }
  if (createdTo && createdAt > createdTo.getTime()) {
    return false;
  }
  return true;
}

export function normalizeGatewayRateLimitHotspotSnapshotTrendFilters(
  filters: GatewayRateLimitHotspotSnapshotTrendFilters = {},
) {
  return {
    snapshotId: filters.snapshotId ?? null,
    label: filters.label ?? null,
    projectId: filters.projectId ?? null,
    routePolicyId: filters.routePolicyId ?? null,
    apiKeyId: filters.apiKeyId ?? null,
    endpointKind: filters.endpointKind ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
    limit: Math.max(1, Math.min(filters.limit ?? 10, 50)),
  } satisfies GatewayRateLimitHotspotSnapshotTrendFilters;
}

export async function persistGatewayRateLimitHotspotSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayRateLimitHotspotOperatorFilters & {
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
  const limit = Math.max(1, Math.min(args.limit ?? 1000, 1000));
  const summary = await summarizeGatewayRateLimitHotspotsForOperator(operatorUserId, providerUserId, {
    ...args,
    createdFrom,
    limit,
  });
  const snapshotId = randomUUID();
  const objectKey = buildGatewayRateLimitHotspotSnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayRateLimitHotspotSnapshotFilterView({
      filters: {
        ...args,
        createdFrom,
      },
      limit,
      lookbackHours,
    }),
    summary,
  } satisfies GatewayRateLimitHotspotSnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayRateLimitHotspotSnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/rate-limit-hotspot-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayRateLimitHotspotSnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayRateLimitHotspotSnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayRateLimitHotspotSnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayRateLimitHotspotSnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayRateLimitHotspotSnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayRateLimitHotspotSnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway rate-limit hotspot snapshot 不存在。");
  }
  return snapshot;
}

export async function getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshots = await listGatewayRateLimitHotspotSnapshotsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(1, Math.min(filters.limit ?? 500, 500)),
  });
  return buildGatewayRateLimitHotspotSnapshotInventorySummary({
    snapshots,
  }) satisfies GatewayRateLimitHotspotSnapshotInventorySummaryView;
}

export async function getGatewayRateLimitHotspotSnapshotTrendReportForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotSnapshotTrendFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedFilters = normalizeGatewayRateLimitHotspotSnapshotTrendFilters(filters);
  const [snapshots, inventorySummary] = await Promise.all([
    listGatewayRateLimitHotspotSnapshotsForOperator(operatorUserId, providerUserId, normalizedFilters),
    getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(operatorUserId, providerUserId, {
      ...normalizedFilters,
      limit: 500,
    }),
  ]);
  const points = snapshots.map((snapshot) => buildGatewayRateLimitHotspotSnapshotTrendPoint(snapshot));
  return buildGatewayRateLimitHotspotSnapshotTrendReport({
    generatedAt: now().toISOString(),
    filters: {
      label: normalizedFilters.label ?? null,
      projectId: normalizedFilters.projectId ?? null,
      routePolicyId: normalizedFilters.routePolicyId ?? null,
      apiKeyId: normalizedFilters.apiKeyId ?? null,
      endpointKind: normalizedFilters.endpointKind ?? null,
      createdFrom: normalizedFilters.createdFrom ?? null,
      createdTo: normalizedFilters.createdTo ?? null,
    },
    windowSize: normalizedFilters.limit,
    inventorySummary,
    points,
  }) satisfies GatewayRateLimitHotspotSnapshotTrendReportView;
}

export async function persistGatewayRateLimitHotspotAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  args: GatewayRateLimitHotspotAnomalyOperatorFilters & {
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
  } satisfies GatewayRateLimitHotspotAnomalyOperatorFilters & { label?: string | null; lookbackHours?: number | null };
  const report = await getGatewayRateLimitHotspotAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    normalizedFilters,
  );
  const snapshotId = randomUUID();
  const objectKey = buildGatewayRateLimitHotspotAnomalySnapshotObjectKey(snapshotId);
  const snapshot = {
    snapshotId,
    label: normalizeGatewayAnalysisRemediationEffectivenessSnapshotLabel(args.label),
    createdAt: timestamp.toISOString(),
    objectKey,
    filters: buildGatewayRateLimitHotspotAnomalySnapshotFilterView({
      filters: normalizedFilters,
      limit: normalizedFilters.limit ?? 10,
      lookbackHours,
      profileKey: report.profileKey,
    }),
    report,
  } satisfies GatewayRateLimitHotspotAnomalySnapshotView;

  await putGatewayObject(objectKey, Buffer.from(JSON.stringify(snapshot, null, 2), "utf8"), "application/json");
  return snapshot;
}

export async function listGatewayRateLimitHotspotAnomalySnapshotsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayRateLimitHotspotAnomalySnapshotFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const createdFrom = parseFilterTimestamp(filters.createdFrom, "createdFrom");
  const createdTo = parseFilterTimestamp(filters.createdTo, "createdTo");
  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new ConflictError("createdFrom 不能晚于 createdTo。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const snapshotKeys = (await listGatewayObjects("ai-gateway/rate-limit-hotspot-anomaly-snapshots")).filter((key) =>
    key.endsWith("/snapshot.json"),
  );
  const snapshots: GatewayRateLimitHotspotAnomalySnapshotView[] = [];
  for (const objectKey of snapshotKeys) {
    const snapshot = await readGatewayRateLimitHotspotAnomalySnapshot(objectKey).catch(() => null);
    if (!snapshot) {
      continue;
    }
    if (!matchesGatewayRateLimitHotspotAnomalySnapshotFilters(snapshot, filters, createdFrom, createdTo)) {
      continue;
    }
    snapshots.push(snapshot);
  }
  return snapshots
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

export async function getGatewayRateLimitHotspotAnomalySnapshotForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedSnapshotId = snapshotId?.trim() ?? "";
  if (!normalizedSnapshotId) {
    throw new ConflictError("snapshotId 不能为空。");
  }
  const objectKey = buildGatewayRateLimitHotspotAnomalySnapshotObjectKey(normalizedSnapshotId);
  const snapshot = await readGatewayRateLimitHotspotAnomalySnapshot(objectKey).catch(() => null);
  if (!snapshot) {
    throw new NotFoundError("Gateway rate-limit hotspot anomaly snapshot 不存在。");
  }
  return snapshot;
}
