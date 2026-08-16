import type { GatewayAnalysisAnomalyAlertDeliverySeverity, GatewayAnalysisAnomalyIncidentAlertQueueItemView, GatewayAnalysisAnomalyIncidentAlertQueueView, GatewayAnalysisAnomalyPolicyView } from "@neuro/contracts";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { resolveGatewayAnalysisAnomalyAlertDeliveryProfile, resolveGatewayAnalysisAnomalyIncidentAlertSchedule } from "@/modules/gateway/analysis-alert";
import { buildGatewayAnalysisAnomalyIncidentRemediationPlan } from "@/modules/gateway/analysis-remediation";
import { gatewayAnalysisAnomalyIncidents } from "@/modules/gateway/schema";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";

import { assertPlatformOperator, now } from "./shared";
import type { GatewayAnalysisAnomalyIncidentAlertQueueFilters } from "./shared";
import { toGatewayRoutePolicyView } from "./views";
import { normalizeGatewayAnalysisAnomalyAlertDeliverySeverity } from "./anomaly-normalizers";
import { findGatewayAnalysisAnomalyPolicyRow, findGatewayRoutePolicyRow, toGatewayAnalysisAnomalyPolicyView } from "./anomaly-policies";
import { appendGatewayAnalysisAnomalyIncidentHistory, buildGatewayAnalysisAnomalyIncidentSnapshotMetadata, listGatewayAnalysisAnomalyIncidentsForOperator, toGatewayAnalysisAnomalyIncidentView } from "./anomaly-incidents";
import { loadGatewayAnalysisAnomalyIncidentLatestSyncContext } from "./anomaly-remediation";

export { normalizeGatewayAnalysisAnomalyAlertDeliverySeverity } from "./anomaly-normalizers";

export function resolveGatewayAnalysisAnomalyPolicyAlertConfig(policy: GatewayAnalysisAnomalyPolicyView | null) {
  return {
    alertingEnabled: policy?.alertingEnabled ?? true,
    alertIntervalMinutes: policy?.alertIntervalMinutes ?? 180,
    notifyOperators: policy?.notifyOperatorsOnEscalation ?? true,
    notifyOwner: policy?.notifyOwnerOnEscalation ?? true,
  };
}

export async function listGatewayAnalysisAnomalyIncidentAlertQueueForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisAnomalyIncidentAlertQueueFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const dueOnly = filters.dueOnly === true;
  const referenceTime = now();
  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    ...filters,
    escalationStatus: "escalated",
    limit: Math.max(limit, 200),
  });

  const items: GatewayAnalysisAnomalyIncidentAlertQueueItemView[] = [];
  for (const incident of incidents) {
    const policyRow = incident.policyId ? await findGatewayAnalysisAnomalyPolicyRow(incident.policyId).catch(() => null) : null;
    const policy = policyRow ? toGatewayAnalysisAnomalyPolicyView(policyRow) : null;
    const resolvedRoutePolicyId = policy?.routePolicyId ?? incident.routePolicyId ?? null;
    const routePolicyRow = resolvedRoutePolicyId ? await findGatewayRoutePolicyRow(resolvedRoutePolicyId).catch(() => null) : null;
    const routePolicy = routePolicyRow ? toGatewayRoutePolicyView(routePolicyRow) : null;
    const incidentContext = await loadGatewayAnalysisAnomalyIncidentLatestSyncContext(incident.id);
    const alertConfig = resolveGatewayAnalysisAnomalyPolicyAlertConfig(policy);
    const schedule = resolveGatewayAnalysisAnomalyIncidentAlertSchedule({
      status: incident.status,
      escalationStatus: incident.escalationStatus,
      alertingEnabled: alertConfig.alertingEnabled,
      alertIntervalMinutes: alertConfig.alertIntervalMinutes,
      lastAlertAttemptAt: incident.lastAlertAttemptAt,
      now: referenceTime,
    });
    if (dueOnly && !schedule.alertDue) {
      continue;
    }
    const deliveryProfile = resolveGatewayAnalysisAnomalyAlertDeliveryProfile(incident.severity);
    const remediationPlan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: referenceTime.toISOString(),
      incident,
      policy,
      routePolicy,
      incidentContext,
    });
    items.push({
      incident,
      policy,
      routePolicy,
      alertIntervalMinutes: alertConfig.alertIntervalMinutes,
      alertDue: schedule.alertDue,
      nextAlertDueAt: schedule.nextAlertDueAt,
      notifyOperators: alertConfig.notifyOperators,
      notifyOwner: alertConfig.notifyOwner,
      alertLevel: deliveryProfile.alertLevel,
      webhookSeverity: deliveryProfile.webhookSeverity,
      remediationActionKeys: remediationPlan.actions.map((action) => action.actionKey),
    });
  }

  const sortedItems = items
    .sort((left, right) => {
      if (left.alertDue !== right.alertDue) {
        return left.alertDue ? -1 : 1;
      }
      if (left.incident.severity !== right.incident.severity) {
        return left.incident.severity === "critical" ? -1 : 1;
      }
      return Date.parse(right.incident.lastSeenAt) - Date.parse(left.incident.lastSeenAt);
    })
    .slice(0, limit);

  return {
    generatedAt: referenceTime.toISOString(),
    limit,
    dueOnly,
    incidentCount: sortedItems.length,
    dueCount: sortedItems.filter((item) => item.alertDue).length,
    items: sortedItems,
  } satisfies GatewayAnalysisAnomalyIncidentAlertQueueView;
}

export async function recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  incidentId?: string | null,
  args?: {
    alertedAt?: Date | string | null;
    alertSeverity?: GatewayAnalysisAnomalyAlertDeliverySeverity | string | null;
    alertLevel?: number | null;
    note?: string | null;
    mailboxRecipientCount?: number | null;
    webhookDispatched?: boolean | null;
    webhookSkippedReason?: string | null;
    remediationActionKeys?: string[] | null;
  },
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

  const alertTimestamp =
    args?.alertedAt instanceof Date
      ? args.alertedAt
      : typeof args?.alertedAt === "string"
        ? new Date(args.alertedAt)
        : now();
  if (!Number.isFinite(alertTimestamp.getTime())) {
    throw new ConflictError("alertedAt 必须是合法的 ISO 时间。");
  }

  const mailboxRecipientCount = Math.max(0, Math.floor(args?.mailboxRecipientCount ?? 0));
  const webhookDispatched = args?.webhookDispatched === true;
  const deliverySucceeded = mailboxRecipientCount > 0 || webhookDispatched;
  const alertSeverity = normalizeGatewayAnalysisAnomalyAlertDeliverySeverity(args?.alertSeverity);

  await db
    .update(gatewayAnalysisAnomalyIncidents)
    .set({
      lastAlertAttemptAt: alertTimestamp,
      lastAlertedAt: deliverySucceeded ? alertTimestamp : row.lastAlertedAt,
      lastAlertSeverity: deliverySucceeded ? alertSeverity : row.lastAlertSeverity,
      alertDeliveryCount: deliverySucceeded ? row.alertDeliveryCount + 1 : row.alertDeliveryCount,
      updatedAt: alertTimestamp,
    })
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId));

  const [updatedRow] = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(eq(gatewayAnalysisAnomalyIncidents.id, normalizedIncidentId))
    .limit(1);
  if (!updatedRow) {
    throw new NotFoundError("Gateway analysis anomaly incident 告警回写失败。");
  }

  const incident = toGatewayAnalysisAnomalyIncidentView(updatedRow);
  if (deliverySucceeded) {
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: normalizedIncidentId,
      eventType: "alert_dispatched",
      actorUserId: operatorUserId,
      note: args?.note ?? "Gateway anomaly alert dispatched.",
      metadata: {
        ...buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: incident.policyId,
          projectId: incident.projectId,
          routePolicyId: incident.routePolicyId,
          tag: incident.tag,
          textMode: incident.textMode,
          code: incident.code,
          severity: incident.severity,
          status: incident.status,
          ownerUserId: incident.ownerUserId,
          followUpStatus: incident.followUpStatus,
          syncHitCount: incident.syncHitCount,
          escalationStatus: incident.escalationStatus,
          escalatedAt: incident.escalatedAt,
          escalationReason: incident.escalationReason,
          lastAlertAttemptAt: incident.lastAlertAttemptAt,
          lastAlertedAt: incident.lastAlertedAt,
          lastAlertSeverity: incident.lastAlertSeverity,
          alertDeliveryCount: incident.alertDeliveryCount,
          latestExportId: incident.latestExportId,
          previousExportId: incident.previousExportId,
          latestValue: incident.latestValue,
          previousValue: incident.previousValue,
          deltaValue: incident.deltaValue,
          deltaRatio: incident.deltaRatio,
          thresholdValue: incident.thresholdValue,
        }),
        alertLevel: args?.alertLevel ?? null,
        mailboxRecipientCount,
        webhookDispatched,
        webhookSkippedReason: args?.webhookSkippedReason ?? null,
        remediationActionKeys: args?.remediationActionKeys ?? null,
      },
      createdAt: alertTimestamp,
    });
  }

  return incident;
}
