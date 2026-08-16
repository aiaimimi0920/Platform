import type { GatewayAnalysisAnomalyIncidentHistoryEventType, GatewayAnalysisAnomalyIncidentHistoryView, GatewayAnalysisAnomalyIncidentFollowUpInput, GatewayAnalysisAnomalyIncidentFollowUpStatus, GatewayAnalysisAnomalyIncidentEscalationStatus, GatewayAnalysisAnomalyIncidentStatus, GatewayAnalysisAnomalyIncidentSummaryView, GatewayAnalysisAnomalyIncidentView, GatewayAnalysisExportAnomalyProfileKey, GatewayAnalysisExportTextMode, GatewayProviderRoutingAnalysisFilterView, GatewayRateLimitHotspotAnomalySnapshotView } from "@neuro/contracts";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { buildGatewayAnalysisAnomalyIncidentSummary } from "@/modules/gateway/analysis-incident";
import { gatewayAnalysisAnomalyIncidentHistory, gatewayAnalysisAnomalyIncidents } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, normalizeOptionalText, now } from "./shared";
import type { GatewayAnalysisAnomalyIncidentFilters, GatewayAnalysisAnomalyIncidentHistoryFilters, GatewayAnalysisAnomalyIncidentHistoryRow, GatewayAnalysisAnomalyIncidentRow } from "./shared";
import { normalizeGatewayAnalysisAnomalyAlertDeliverySeverity } from "./anomaly-normalizers";

export function normalizeGatewayAnalysisAnomalyIncidentStatus(
  value: GatewayAnalysisAnomalyIncidentStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "acknowledged" || normalized === "resolved") {
    return normalized;
  }
  return "open";
}

export function normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(
  value: GatewayAnalysisAnomalyIncidentFollowUpStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentFollowUpStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "investigating" || normalized === "monitoring" || normalized === "done") {
    return normalized;
  }
  return "pending";
}

export function normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(
  value: GatewayAnalysisAnomalyIncidentEscalationStatus | string | null | undefined,
): GatewayAnalysisAnomalyIncidentEscalationStatus {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "escalated" || normalized === "resolved") {
    return normalized;
  }
  return "none";
}

export function toGatewayAnalysisAnomalyIncidentView(row: GatewayAnalysisAnomalyIncidentRow): GatewayAnalysisAnomalyIncidentView {
  return {
    id: row.id,
    policyId: row.policyId ?? null,
    fingerprint: row.fingerprint,
    projectId: row.projectId ?? null,
    routePolicyId: row.routePolicyId ?? null,
    tag: row.tag ?? null,
    textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
    code: row.code as GatewayAnalysisAnomalyIncidentView["code"],
    severity: row.severity as GatewayAnalysisAnomalyIncidentView["severity"],
    status: normalizeGatewayAnalysisAnomalyIncidentStatus(row.status),
    ownerUserId: row.ownerUserId ?? null,
    followUpStatus: normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus),
    syncHitCount: row.syncHitCount,
    escalationStatus: normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus),
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    escalationReason: row.escalationReason ?? null,
    latestNote: row.latestNote ?? null,
    resolutionNote: row.resolutionNote ?? null,
    lastActionAt: row.lastActionAt?.toISOString() ?? null,
    lastAlertAttemptAt: row.lastAlertAttemptAt?.toISOString() ?? null,
    lastAlertedAt: row.lastAlertedAt?.toISOString() ?? null,
    lastAlertSeverity: normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(row.lastAlertSeverity),
    alertDeliveryCount: row.alertDeliveryCount,
    summary: row.summary,
    latestExportId: row.latestExportId ?? null,
    previousExportId: row.previousExportId ?? null,
    latestValue: row.latestValue ?? null,
    previousValue: row.previousValue ?? null,
    deltaValue: row.deltaValue ?? null,
    deltaRatio: row.deltaRatio ?? null,
    thresholdValue: row.thresholdValue ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toGatewayAnalysisAnomalyIncidentHistoryView(
  row: GatewayAnalysisAnomalyIncidentHistoryRow,
): GatewayAnalysisAnomalyIncidentHistoryView {
  return {
    id: row.id,
    incidentId: row.incidentId,
    eventType: row.eventType as GatewayAnalysisAnomalyIncidentHistoryEventType,
    actorUserId: row.actorUserId ?? null,
    note: row.note ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function buildGatewayAnalysisAnomalyIncidentSnapshotMetadata(args: {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
  code: string;
  severity?: string | null;
  status?: string | null;
  ownerUserId?: string | null;
  followUpStatus?: string | null;
  syncHitCount?: number | null;
  escalationStatus?: string | null;
  escalatedAt?: string | null;
  escalationReason?: string | null;
  lastAlertAttemptAt?: string | null;
  lastAlertedAt?: string | null;
  lastAlertSeverity?: string | null;
  alertDeliveryCount?: number | null;
  latestExportId?: string | null;
  previousExportId?: string | null;
  latestValue?: number | null;
  previousValue?: number | null;
  deltaValue?: number | null;
  deltaRatio?: number | null;
  thresholdValue?: number | null;
  snapshotId?: string | null;
  entityKey?: string | null;
  latestBucketStartAt?: string | null;
  previousBucketStartAt?: string | null;
}) {
  return {
    policyId: args.policyId ?? null,
    projectId: args.projectId ?? null,
    routePolicyId: args.routePolicyId ?? null,
    tag: args.tag ?? null,
    textMode: args.textMode ?? null,
    code: args.code,
    severity: args.severity ?? null,
    status: args.status ?? null,
    ownerUserId: args.ownerUserId ?? null,
    followUpStatus: args.followUpStatus ?? null,
    syncHitCount: args.syncHitCount ?? null,
    escalationStatus: args.escalationStatus ?? null,
    escalatedAt: args.escalatedAt ?? null,
    escalationReason: args.escalationReason ?? null,
    lastAlertAttemptAt: args.lastAlertAttemptAt ?? null,
    lastAlertedAt: args.lastAlertedAt ?? null,
    lastAlertSeverity: args.lastAlertSeverity ?? null,
    alertDeliveryCount: args.alertDeliveryCount ?? null,
    latestExportId: args.latestExportId ?? null,
    previousExportId: args.previousExportId ?? null,
    latestValue: args.latestValue ?? null,
    previousValue: args.previousValue ?? null,
    deltaValue: args.deltaValue ?? null,
    deltaRatio: args.deltaRatio ?? null,
    thresholdValue: args.thresholdValue ?? null,
    snapshotId: args.snapshotId ?? null,
    entityKey: args.entityKey ?? null,
    latestBucketStartAt: args.latestBucketStartAt ?? null,
    previousBucketStartAt: args.previousBucketStartAt ?? null,
  } satisfies Record<string, unknown>;
}

export function buildGatewayRateLimitHotspotIncidentTag(snapshot: GatewayRateLimitHotspotAnomalySnapshotView) {
  const parts = [`rate-limit-hotspot:${snapshot.filters.profileKey}`];
  if (snapshot.filters.apiKeyId?.trim()) {
    parts.push(`api-key:${snapshot.filters.apiKeyId.trim()}`);
  }
  if (snapshot.filters.endpointKind?.trim()) {
    parts.push(`endpoint:${snapshot.filters.endpointKind.trim().toLowerCase()}`);
  }
  return parts.join(":");
}

export function buildGatewayProviderRoutingIncidentTag(args: {
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  filters: GatewayProviderRoutingAnalysisFilterView;
}) {
  const parts = [`provider-routing:${args.profileKey}`];
  if (args.filters.providerAccountId?.trim()) {
    parts.push(`provider:${args.filters.providerAccountId.trim()}`);
  }
  if (args.filters.protocolFamily?.trim()) {
    parts.push(`protocol:${args.filters.protocolFamily.trim().toLowerCase()}`);
  }
  if (args.filters.endpointKind?.trim()) {
    parts.push(`endpoint:${args.filters.endpointKind.trim().toLowerCase()}`);
  }
  if (args.filters.apiKeyId?.trim()) {
    parts.push(`api-key:${args.filters.apiKeyId.trim()}`);
  }
  if (args.filters.sessionId?.trim()) {
    parts.push(`session:${args.filters.sessionId.trim()}`);
  }
  if (args.filters.responseId?.trim()) {
    parts.push(`response:${args.filters.responseId.trim()}`);
  }
  if (args.filters.status?.trim()) {
    parts.push(`status:${args.filters.status.trim().toLowerCase()}`);
  }
  return parts.join(":");
}

export async function appendGatewayAnalysisAnomalyIncidentHistory(args: {
  incidentId: string;
  eventType: GatewayAnalysisAnomalyIncidentHistoryEventType;
  actorUserId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}) {
  await db.insert(gatewayAnalysisAnomalyIncidentHistory).values({
    id: randomUUID(),
    incidentId: args.incidentId,
    eventType: args.eventType,
    actorUserId: args.actorUserId?.trim() || null,
    note: normalizeOptionalText(args.note, 2_000),
    metadata: args.metadata ?? null,
    createdAt: args.createdAt ?? now(),
  });
}

export function buildGatewayAnalysisAnomalyIncidentScopeWhere(args: {
  policyId?: string | null;
  projectId?: string | null;
  routePolicyId?: string | null;
  tag?: string | null;
  textMode?: GatewayAnalysisExportTextMode | null;
}) {
  return and(
    args.policyId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.policyId, args.policyId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.policyId),
    args.projectId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.projectId, args.projectId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.projectId),
    args.routePolicyId?.trim()
      ? eq(gatewayAnalysisAnomalyIncidents.routePolicyId, args.routePolicyId.trim())
      : isNull(gatewayAnalysisAnomalyIncidents.routePolicyId),
    args.tag?.trim() ? eq(gatewayAnalysisAnomalyIncidents.tag, args.tag.trim()) : isNull(gatewayAnalysisAnomalyIncidents.tag),
    args.textMode ? eq(gatewayAnalysisAnomalyIncidents.textMode, args.textMode) : isNull(gatewayAnalysisAnomalyIncidents.textMode),
  );
}

export async function listGatewayAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      and(
        filters.incidentId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.id, filters.incidentId.trim()) : undefined,
        filters.policyId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.policyId, filters.policyId.trim()) : undefined,
        filters.projectId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.projectId, filters.projectId.trim()) : undefined,
        filters.routePolicyId?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.routePolicyId, filters.routePolicyId.trim())
          : undefined,
        filters.ownerUserId?.trim() ? eq(gatewayAnalysisAnomalyIncidents.ownerUserId, filters.ownerUserId.trim()) : undefined,
        filters.tag?.trim() ? eq(gatewayAnalysisAnomalyIncidents.tag, filters.tag.trim().toLowerCase()) : undefined,
        filters.textMode ? eq(gatewayAnalysisAnomalyIncidents.textMode, filters.textMode) : undefined,
        filters.status?.trim() ? eq(gatewayAnalysisAnomalyIncidents.status, filters.status.trim()) : undefined,
        filters.followUpStatus?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.followUpStatus, filters.followUpStatus.trim())
          : undefined,
        filters.escalationStatus?.trim()
          ? eq(gatewayAnalysisAnomalyIncidents.escalationStatus, filters.escalationStatus.trim())
          : undefined,
        filters.code?.trim() ? eq(gatewayAnalysisAnomalyIncidents.code, filters.code.trim()) : undefined,
        filters.severity?.trim() ? eq(gatewayAnalysisAnomalyIncidents.severity, filters.severity.trim()) : undefined,
      ),
    )
    .orderBy(desc(gatewayAnalysisAnomalyIncidents.updatedAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyIncidentView(row));
}

export async function getGatewayAnalysisAnomalyIncidentSummaryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentFilters = {},
) {
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    limit: Math.max(filters.limit ?? 200, 200),
  });
  return buildGatewayAnalysisAnomalyIncidentSummary(incidents) satisfies GatewayAnalysisAnomalyIncidentSummaryView;
}

export async function listGatewayAnalysisAnomalyIncidentHistoryForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentHistoryFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const incidentId = filters.incidentId?.trim() ?? "";
  if (!incidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [incidentRow] = await db
    .select({ id: gatewayAnalysisAnomalyIncidents.id })
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, incidentId))
    .limit(1);
  if (!incidentRow) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 1_000));
  const rows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidentHistory)
    .where(eq(gatewayAnalysisAnomalyIncidentHistory.incidentId, incidentId))
    .orderBy(desc(gatewayAnalysisAnomalyIncidentHistory.createdAt))
    .limit(limit);
  return rows.map((row) => toGatewayAnalysisAnomalyIncidentHistoryView(row));
}

export async function acknowledgeGatewayAnalysisAnomalyIncidentForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const timestamp = now();
  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      status: "acknowledged",
      followUpStatus: "investigating",
      acknowledgedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "acknowledged",
    actorUserId: operatorUserId,
    note: "Operator acknowledged incident.",
    metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
      policyId: incidents[0].policyId,
      projectId: incidents[0].projectId,
      routePolicyId: incidents[0].routePolicyId,
      tag: incidents[0].tag,
      textMode: incidents[0].textMode,
      code: incidents[0].code,
      severity: incidents[0].severity,
      status: incidents[0].status,
      ownerUserId: incidents[0].ownerUserId,
      followUpStatus: incidents[0].followUpStatus,
      syncHitCount: incidents[0].syncHitCount,
      escalationStatus: incidents[0].escalationStatus,
      escalatedAt: incidents[0].escalatedAt,
      escalationReason: incidents[0].escalationReason,
      latestExportId: incidents[0].latestExportId,
      previousExportId: incidents[0].previousExportId,
      latestValue: incidents[0].latestValue,
      previousValue: incidents[0].previousValue,
      deltaValue: incidents[0].deltaValue,
      deltaRatio: incidents[0].deltaRatio,
      thresholdValue: incidents[0].thresholdValue,
    }),
    createdAt: timestamp,
  });
  return incidents[0];
}

export async function resolveGatewayAnalysisAnomalyIncidentForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus);
  const timestamp = now();
  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      status: "resolved",
      followUpStatus: "done",
      escalationStatus: previousEscalationStatus === "escalated" ? "resolved" : row.escalationStatus,
      resolvedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "resolved",
    actorUserId: operatorUserId,
    note: incidents[0].resolutionNote ?? "Operator resolved incident.",
    metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
      policyId: incidents[0].policyId,
      projectId: incidents[0].projectId,
      routePolicyId: incidents[0].routePolicyId,
      tag: incidents[0].tag,
      textMode: incidents[0].textMode,
      code: incidents[0].code,
      severity: incidents[0].severity,
      status: incidents[0].status,
      ownerUserId: incidents[0].ownerUserId,
      followUpStatus: incidents[0].followUpStatus,
      syncHitCount: incidents[0].syncHitCount,
      escalationStatus: incidents[0].escalationStatus,
      escalatedAt: incidents[0].escalatedAt,
      escalationReason: incidents[0].escalationReason,
      latestExportId: incidents[0].latestExportId,
      previousExportId: incidents[0].previousExportId,
      latestValue: incidents[0].latestValue,
      previousValue: incidents[0].previousValue,
      deltaValue: incidents[0].deltaValue,
      deltaRatio: incidents[0].deltaRatio,
      thresholdValue: incidents[0].thresholdValue,
    }),
    createdAt: timestamp,
  });
  if (previousEscalationStatus === "escalated") {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: normalizedIncidentId,
      eventType: "escalation_cleared",
      actorUserId: operatorUserId,
      note: incidents[0].escalationReason ?? "Escalation cleared by operator resolution.",
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: incidents[0].policyId,
        projectId: incidents[0].projectId,
        routePolicyId: incidents[0].routePolicyId,
        tag: incidents[0].tag,
        textMode: incidents[0].textMode,
        code: incidents[0].code,
        severity: incidents[0].severity,
        status: incidents[0].status,
        ownerUserId: incidents[0].ownerUserId,
        followUpStatus: incidents[0].followUpStatus,
        syncHitCount: incidents[0].syncHitCount,
        escalationStatus: incidents[0].escalationStatus,
        escalatedAt: incidents[0].escalatedAt,
        escalationReason: incidents[0].escalationReason,
        latestExportId: incidents[0].latestExportId,
        previousExportId: incidents[0].previousExportId,
        latestValue: incidents[0].latestValue,
        previousValue: incidents[0].previousValue,
        deltaValue: incidents[0].deltaValue,
        deltaRatio: incidents[0].deltaRatio,
        thresholdValue: incidents[0].thresholdValue,
      }),
      createdAt: timestamp,
    });
  }
  return incidents[0];
}

export async function updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  input: GatewayAnalysisAnomalyIncidentFollowUpInput = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const normalizedIncidentId = incidentId?.trim() ?? "";
  if (!normalizedIncidentId) {
    throw new ConflictError("incidentId 不能为空。");
  }
  const [row] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const timestamp = now();
  const nextOwnerUserId = Object.prototype.hasOwnProperty.call(input, "ownerUserId") ? input.ownerUserId?.trim() || null : row.ownerUserId;
  const nextFollowUpStatus = input.followUpStatus
    ? normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(input.followUpStatus)
    : normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus);
  const nextNote = Object.prototype.hasOwnProperty.call(input, "note")
    ? normalizeOptionalText(input.note, 2_000)
    : row.latestNote;
  const nextResolutionNote = Object.prototype.hasOwnProperty.call(input, "resolutionNote")
    ? normalizeOptionalText(input.resolutionNote, 2_000)
    : row.resolutionNote;

  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      latestNote: nextNote,
      resolutionNote: nextResolutionNote,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    incidentId: normalizedIncidentId,
    limit: 1,
  });
  if (!incidents[0]) {
    throw new NotFoundError("Gateway analysis anomaly incident 不存在。");
  }
  const changedFields = [
    Object.prototype.hasOwnProperty.call(input, "ownerUserId") ? "ownerUserId" : null,
    Object.prototype.hasOwnProperty.call(input, "followUpStatus") ? "followUpStatus" : null,
    Object.prototype.hasOwnProperty.call(input, "note") ? "note" : null,
    Object.prototype.hasOwnProperty.call(input, "resolutionNote") ? "resolutionNote" : null,
  ].filter((value): value is string => Boolean(value));
  await appendGatewayAnalysisAnomalyIncidentHistory({
    incidentId: normalizedIncidentId,
    eventType: "follow_up_updated",
    actorUserId: operatorUserId,
    note: nextResolutionNote ?? nextNote ?? "Operator updated incident follow-up.",
    metadata: {
      ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: incidents[0].policyId,
        projectId: incidents[0].projectId,
        routePolicyId: incidents[0].routePolicyId,
        tag: incidents[0].tag,
        textMode: incidents[0].textMode,
        code: incidents[0].code,
        severity: incidents[0].severity,
        status: incidents[0].status,
        ownerUserId: incidents[0].ownerUserId,
        followUpStatus: incidents[0].followUpStatus,
        syncHitCount: incidents[0].syncHitCount,
        escalationStatus: incidents[0].escalationStatus,
        escalatedAt: incidents[0].escalatedAt,
        escalationReason: incidents[0].escalationReason,
        latestExportId: incidents[0].latestExportId,
        previousExportId: incidents[0].previousExportId,
        latestValue: incidents[0].latestValue,
        previousValue: incidents[0].previousValue,
        deltaValue: incidents[0].deltaValue,
        deltaRatio: incidents[0].deltaRatio,
        thresholdValue: incidents[0].thresholdValue,
      }),
      changedFields,
      previousOwnerUserId: row.ownerUserId ?? null,
      previousFollowUpStatus: normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(row.followUpStatus),
      previousSyncHitCount: row.syncHitCount,
      previousEscalationStatus: normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus),
      previousEscalatedAt: row.escalatedAt?.toISOString() ?? null,
      previousEscalationReason: row.escalationReason ?? null,
      previousLatestNote: row.latestNote ?? null,
      previousResolutionNote: row.resolutionNote ?? null,
    },
    createdAt: timestamp,
  });
  return incidents[0];
}
