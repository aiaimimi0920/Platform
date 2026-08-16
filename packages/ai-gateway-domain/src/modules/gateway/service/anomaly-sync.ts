import type { GatewayAnalysisExportTextMode, GatewaySyncRateLimitHotspotAnomalyIncidentsResult, GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult } from "@neuro/contracts";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { buildGatewayAnalysisExportAnomalyReport } from "@/modules/gateway/analysis-anomaly";
import { buildGatewayAnalysisAnomalyIncidentFingerprint } from "@/modules/gateway/analysis-incident";
import { resolveGatewayAnalysisAnomalyAutoEscalation, resolveGatewayProviderRoutingAutoEscalation, resolveGatewayRateLimitHotspotAutoEscalation } from "@/modules/gateway/analysis-escalation";
import { gatewayAnalysisAnomalyIncidents } from "@/modules/gateway/schema";

import { assertPlatformOperator, now } from "./shared";
import type { GatewayAnalysisExportAnomalyReportFilters, GatewayProviderRoutingAnalysisOperatorFilters } from "./shared";
import { getGatewayRateLimitHotspotAnomalySnapshotForOperator } from "./rate-limit-hotspots";
import { getGatewayProviderRoutingAnalysisAnomalyReportForOperator } from "./analysis-summary";
import { getGatewayAnalysisExportTrendReportForOperator } from "./analysis-exports";
import { resolveGatewayAnalysisAnomalyEvaluationContextForOperator, updateGatewayAnalysisAnomalyPolicySyncState } from "./anomaly-policies";
import { appendGatewayAnalysisAnomalyIncidentHistory, buildGatewayAnalysisAnomalyIncidentScopeWhere, buildGatewayAnalysisAnomalyIncidentSnapshotMetadata, buildGatewayProviderRoutingIncidentTag, buildGatewayRateLimitHotspotIncidentTag, listGatewayAnalysisAnomalyIncidentsForOperator, normalizeGatewayAnalysisAnomalyIncidentEscalationStatus, normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus, normalizeGatewayAnalysisAnomalyIncidentStatus } from "./anomaly-incidents";

export async function syncGatewayAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayAnalysisExportAnomalyReportFilters = {},
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const requestedPolicyId = filters.policyId?.trim() ?? null;
  try {
    const context = await resolveGatewayAnalysisAnomalyEvaluationContextForOperator(operatorUserId, providerUserId, filters);
    const report = buildGatewayAnalysisExportAnomalyReport({
      trendReport: await getGatewayAnalysisExportTrendReportForOperator(operatorUserId, providerUserId, context.filters),
      profileKey: context.profileKey,
      thresholds: context.thresholds,
    });
    const timestamp = now();
    const existingRows = await db
      .select()
      .from(gatewayAnalysisAnomalyIncidents)
      .where(
        buildGatewayAnalysisAnomalyIncidentScopeWhere({
          policyId: context.policy?.id ?? null,
          projectId: context.filters.projectId ?? null,
          routePolicyId: context.policy?.routePolicyId ?? null,
          tag: context.filters.tag ?? null,
          textMode: context.filters.textMode ?? null,
        }),
      );
    const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
    const openedIncidentIds: string[] = [];
    const updatedIncidentIds: string[] = [];
    const resolvedIncidentIds: string[] = [];
    const seenFingerprints = new Set<string>();

    for (const anomaly of report.anomalies) {
      const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
        policyId: context.policy?.id ?? null,
        projectId: context.filters.projectId ?? null,
        routePolicyId: context.policy?.routePolicyId ?? null,
        tag: context.filters.tag ?? null,
        textMode: context.filters.textMode ?? null,
        code: anomaly.code,
      });
      seenFingerprints.add(fingerprint);
      const existing = existingByFingerprint.get(fingerprint);

      if (existing) {
        const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
        const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
        const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
        const wasResolved = previousStatus === "resolved";
        const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
        const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
        const escalationDecision = resolveGatewayAnalysisAnomalyAutoEscalation({
          policy: context.policy,
          anomalySeverity: anomaly.severity,
          syncHitCount: nextSyncHitCount,
        });
        const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
        const nextEscalationStatus = escalationDecision.shouldEscalate
          ? "escalated"
          : wasResolved
            ? "none"
            : previousEscalationStatus;
        const nextEscalatedAt = escalationDecision.shouldEscalate
          ? existing.escalatedAt ?? timestamp
          : wasResolved
            ? null
            : existing.escalatedAt;
        const nextEscalationReason = escalationDecision.shouldEscalate
          ? escalationDecision.reason
          : wasResolved
            ? null
            : existing.escalationReason;
        const nextOwnerUserId =
          escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
        const nextFollowUpStatus =
          escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
            ? escalationDecision.followUpStatus ?? previousFollowUpStatus
            : previousFollowUpStatus;
        await db
          .update(gatewayAnalysisAnomalyIncidents)
          .set({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt,
            escalationReason: nextEscalationReason,
            summary: anomaly.message,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
            lastSeenAt: timestamp,
            resolvedAt: null,
            updatedAt: timestamp,
          })
          .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "sync_updated",
          note: anomaly.message,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
        if (escalationTransitioned) {
          await appendGatewayAnalysisAnomalyIncidentHistory({
            incidentId: existing.id,
            eventType: "auto_escalated",
            note: escalationDecision.reason,
            metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
              policyId: context.policy?.id ?? null,
              projectId: context.filters.projectId ?? null,
              routePolicyId: context.policy?.routePolicyId ?? null,
              tag: context.filters.tag ?? null,
              textMode: context.filters.textMode ?? null,
              code: anomaly.code,
              severity: anomaly.severity,
              status: nextStatus,
              ownerUserId: nextOwnerUserId ?? null,
              followUpStatus: nextFollowUpStatus,
              syncHitCount: nextSyncHitCount,
              escalationStatus: nextEscalationStatus,
              escalatedAt: nextEscalatedAt?.toISOString() ?? null,
              escalationReason: nextEscalationReason,
              latestExportId: anomaly.latestExportId,
              previousExportId: anomaly.previousExportId,
              latestValue: anomaly.latestValue,
              previousValue: anomaly.previousValue,
              deltaValue: anomaly.deltaValue,
              deltaRatio: anomaly.deltaRatio,
              thresholdValue: anomaly.thresholdValue,
            }),
            createdAt: timestamp,
          });
        }
        updatedIncidentIds.push(existing.id);
        continue;
      }

      const nextSyncHitCount = 1;
      const escalationDecision = resolveGatewayAnalysisAnomalyAutoEscalation({
        policy: context.policy,
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
      const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
      const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
      const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
      const nextFollowUpStatus = escalationDecision.shouldEscalate
        ? escalationDecision.followUpStatus ?? "pending"
        : "pending";
      const incidentId = randomUUID();
      await db.insert(gatewayAnalysisAnomalyIncidents).values({
        id: incidentId,
        policyId: context.policy?.id ?? null,
        fingerprint,
        projectId: context.filters.projectId ?? null,
        routePolicyId: context.policy?.routePolicyId ?? null,
        tag: context.filters.tag ?? null,
        textMode: context.filters.textMode ?? null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt,
        escalationReason: nextEscalationReason,
        latestNote: null,
        resolutionNote: null,
        lastActionAt: null,
        summary: anomaly.message,
        latestExportId: anomaly.latestExportId,
        previousExportId: anomaly.previousExportId,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "sync_opened",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: context.policy?.id ?? null,
          projectId: context.filters.projectId ?? null,
          routePolicyId: context.policy?.routePolicyId ?? null,
          tag: context.filters.tag ?? null,
          textMode: context.filters.textMode ?? null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestExportId: anomaly.latestExportId,
          previousExportId: anomaly.previousExportId,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
      if (nextEscalationStatus === "escalated") {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId,
          eventType: "auto_escalated",
          note: nextEscalationReason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: context.policy?.id ?? null,
            projectId: context.filters.projectId ?? null,
            routePolicyId: context.policy?.routePolicyId ?? null,
            tag: context.filters.tag ?? null,
            textMode: context.filters.textMode ?? null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: "open",
            ownerUserId: nextOwnerUserId,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestExportId: anomaly.latestExportId,
            previousExportId: anomaly.previousExportId,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
      }
      openedIncidentIds.push(incidentId);
    }

    for (const row of existingRows) {
      if (seenFingerprints.has(row.fingerprint)) {
        continue;
      }
      if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
        continue;
      }
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          status: "resolved",
          syncHitCount: 0,
          escalationStatus:
            normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated" ? "resolved" : row.escalationStatus,
          resolvedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "sync_resolved",
        note: row.summary,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: row.policyId ?? null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus:
            normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated" ? "resolved" : row.escalationStatus,
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestExportId: row.latestExportId ?? null,
          previousExportId: row.previousExportId ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
        }),
        createdAt: timestamp,
      });
      if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: row.id,
          eventType: "escalation_cleared",
          note: row.escalationReason ?? "Escalation cleared because anomaly no longer matched.",
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: row.policyId ?? null,
            projectId: row.projectId ?? null,
            routePolicyId: row.routePolicyId ?? null,
            tag: row.tag ?? null,
            textMode: (row.textMode as GatewayAnalysisExportTextMode | null) ?? null,
            code: row.code,
            severity: row.severity,
            status: "resolved",
            ownerUserId: row.ownerUserId ?? null,
            followUpStatus: row.followUpStatus ?? null,
            syncHitCount: 0,
            escalationStatus: "resolved",
            escalatedAt: row.escalatedAt?.toISOString() ?? null,
            escalationReason: row.escalationReason ?? null,
            latestExportId: row.latestExportId ?? null,
            previousExportId: row.previousExportId ?? null,
            latestValue: row.latestValue ?? null,
            previousValue: row.previousValue ?? null,
            deltaValue: row.deltaValue ?? null,
            deltaRatio: row.deltaRatio ?? null,
            thresholdValue: row.thresholdValue ?? null,
          }),
          createdAt: timestamp,
        });
      }
      resolvedIncidentIds.push(row.id);
    }

    const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
      policyId: context.policy?.id ?? null,
      projectId: context.filters.projectId ?? null,
      routePolicyId: context.policy?.routePolicyId ?? null,
      tag: context.filters.tag ?? null,
      textMode: context.filters.textMode ?? null,
      limit: 200,
    });
    if (context.policy?.id) {
      await updateGatewayAnalysisAnomalyPolicySyncState({
        policyId: context.policy.id,
        status: "ok",
        syncedAt: timestamp,
        error: null,
      });
    }
    return {
      report,
      incidents,
      openedIncidentIds,
      updatedIncidentIds,
      resolvedIncidentIds,
    };
  } catch (error) {
    if (requestedPolicyId) {
      await updateGatewayAnalysisAnomalyPolicySyncState({
        policyId: requestedPolicyId,
        status: "error",
        syncedAt: now(),
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  filters: GatewayProviderRoutingAnalysisOperatorFilters = {},
): Promise<GatewaySyncProviderRoutingAnalysisAnomalyIncidentsResult> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const report = await getGatewayProviderRoutingAnalysisAnomalyReportForOperator(
    operatorUserId,
    providerUserId,
    filters,
  );
  const timestamp = now();
  const projectId = report.filters.projectId?.trim() ?? null;
  const routePolicyId = report.filters.routePolicyId?.trim() ?? null;
  const tag = buildGatewayProviderRoutingIncidentTag({
    profileKey: report.profileKey,
    filters: report.filters,
  });
  const existingRows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      buildGatewayAnalysisAnomalyIncidentScopeWhere({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
      }),
    );
  const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
  const openedIncidentIds: string[] = [];
  const updatedIncidentIds: string[] = [];
  const resolvedIncidentIds: string[] = [];
  const seenFingerprints = new Set<string>();

  for (const anomaly of report.anomalies) {
    const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
      policyId: null,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
    });
    seenFingerprints.add(fingerprint);
    const existing = existingByFingerprint.get(fingerprint);

    if (existing) {
      const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
      const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
      const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
      const wasResolved = previousStatus === "resolved";
      const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
      const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
      const escalationDecision = resolveGatewayProviderRoutingAutoEscalation({
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
      const nextEscalationStatus = escalationDecision.shouldEscalate
        ? "escalated"
        : wasResolved
          ? "none"
          : previousEscalationStatus;
      const nextEscalatedAt = escalationDecision.shouldEscalate
        ? existing.escalatedAt ?? timestamp
        : wasResolved
          ? null
          : existing.escalatedAt;
      const nextEscalationReason = escalationDecision.shouldEscalate
        ? escalationDecision.reason
        : wasResolved
          ? null
          : existing.escalationReason;
      const nextOwnerUserId =
        escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
      const nextFollowUpStatus =
        escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
          ? escalationDecision.followUpStatus ?? previousFollowUpStatus
          : previousFollowUpStatus;
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt,
          escalationReason: nextEscalationReason,
          summary: anomaly.message,
          latestExportId: null,
          previousExportId: null,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          lastSeenAt: timestamp,
          resolvedAt: null,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: existing.id,
        eventType: "sync_updated",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
      if (escalationTransitioned) {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "auto_escalated",
          note: escalationDecision.reason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: null,
            projectId,
            routePolicyId,
            tag,
            textMode: null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
          }),
          createdAt: timestamp,
        });
      }
      updatedIncidentIds.push(existing.id);
      continue;
    }

    const nextSyncHitCount = 1;
    const escalationDecision = resolveGatewayProviderRoutingAutoEscalation({
      anomalySeverity: anomaly.severity,
      syncHitCount: nextSyncHitCount,
    });
    const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
    const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
    const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
    const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
    const nextFollowUpStatus = escalationDecision.shouldEscalate
      ? escalationDecision.followUpStatus ?? "pending"
      : "pending";
    const incidentId = randomUUID();
    await db.insert(gatewayAnalysisAnomalyIncidents).values({
      id: incidentId,
      policyId: null,
      fingerprint,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
      severity: anomaly.severity,
      status: "open",
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      syncHitCount: nextSyncHitCount,
      escalationStatus: nextEscalationStatus,
      escalatedAt: nextEscalatedAt,
      escalationReason: nextEscalationReason,
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      summary: anomaly.message,
      latestExportId: null,
      previousExportId: null,
      latestValue: anomaly.latestValue,
      previousValue: anomaly.previousValue,
      deltaValue: anomaly.deltaValue,
      deltaRatio: anomaly.deltaRatio,
      thresholdValue: anomaly.thresholdValue,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId,
      eventType: "sync_opened",
      note: anomaly.message,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt?.toISOString() ?? null,
        escalationReason: nextEscalationReason,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
      }),
      createdAt: timestamp,
    });
    if (nextEscalationStatus === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "auto_escalated",
        note: nextEscalationReason,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
        }),
        createdAt: timestamp,
      });
    }
    openedIncidentIds.push(incidentId);
  }

  for (const row of existingRows) {
    if (seenFingerprints.has(row.fingerprint)) {
      continue;
    }
    if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
      continue;
    }
    const nextEscalationStatus =
      normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated"
        ? "resolved"
        : row.escalationStatus;
    await db
      .update(gatewayAnalysisAnomalyIncidents)
      .set({
        status: "resolved",
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: row.id,
      eventType: "sync_resolved",
      note: row.summary,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId: row.projectId ?? null,
        routePolicyId: row.routePolicyId ?? null,
        tag: row.tag ?? null,
        textMode: null,
        code: row.code,
        severity: row.severity,
        status: "resolved",
        ownerUserId: row.ownerUserId ?? null,
        followUpStatus: row.followUpStatus ?? null,
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        escalatedAt: row.escalatedAt?.toISOString() ?? null,
        escalationReason: row.escalationReason ?? null,
        latestValue: row.latestValue ?? null,
        previousValue: row.previousValue ?? null,
        deltaValue: row.deltaValue ?? null,
        deltaRatio: row.deltaRatio ?? null,
        thresholdValue: row.thresholdValue ?? null,
      }),
      createdAt: timestamp,
    });
    if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "escalation_cleared",
        note: row.escalationReason ?? "Escalation cleared because provider routing anomaly no longer matched.",
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus: "resolved",
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
        }),
        createdAt: timestamp,
      });
    }
    resolvedIncidentIds.push(row.id);
  }

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    projectId,
    routePolicyId,
    tag,
    limit: 200,
  });

  return {
    report,
    incidents,
    openedIncidentIds,
    updatedIncidentIds,
    resolvedIncidentIds,
  };
}

export async function syncGatewayRateLimitHotspotAnomalyIncidentsForOperator(
  operatorUserId: string,
  providerUserId?: string | null,
  snapshotId?: string | null,
): Promise<GatewaySyncRateLimitHotspotAnomalyIncidentsResult> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const snapshot = await getGatewayRateLimitHotspotAnomalySnapshotForOperator(operatorUserId, providerUserId, snapshotId);
  const timestamp = now();
  const projectId = snapshot.filters.projectId?.trim() ?? null;
  const routePolicyId = snapshot.filters.routePolicyId?.trim() ?? null;
  const tag = buildGatewayRateLimitHotspotIncidentTag(snapshot);
  const existingRows = await db
    .select()
    .from(gatewayAnalysisAnomalyIncidents)
    .where(
      buildGatewayAnalysisAnomalyIncidentScopeWhere({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
      }),
    );
  const existingByFingerprint = new Map(existingRows.map((row) => [row.fingerprint, row] as const));
  const openedIncidentIds: string[] = [];
  const updatedIncidentIds: string[] = [];
  const resolvedIncidentIds: string[] = [];
  const seenFingerprints = new Set<string>();

  for (const anomaly of snapshot.report.anomalies) {
    const fingerprint = buildGatewayAnalysisAnomalyIncidentFingerprint({
      policyId: null,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
    });
    seenFingerprints.add(fingerprint);
    const existing = existingByFingerprint.get(fingerprint);

    if (existing) {
      const previousStatus = normalizeGatewayAnalysisAnomalyIncidentStatus(existing.status);
      const previousEscalationStatus = normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(existing.escalationStatus);
      const previousFollowUpStatus = normalizeGatewayAnalysisAnomalyIncidentFollowUpStatus(existing.followUpStatus);
      const wasResolved = previousStatus === "resolved";
      const nextStatus = previousStatus === "acknowledged" ? "acknowledged" : "open";
      const nextSyncHitCount = wasResolved ? 1 : Math.max(existing.syncHitCount ?? 0, 0) + 1;
      const escalationDecision = resolveGatewayRateLimitHotspotAutoEscalation({
        anomalySeverity: anomaly.severity,
        syncHitCount: nextSyncHitCount,
      });
      const escalationTransitioned = escalationDecision.shouldEscalate && previousEscalationStatus !== "escalated";
      const nextEscalationStatus = escalationDecision.shouldEscalate
        ? "escalated"
        : wasResolved
          ? "none"
          : previousEscalationStatus;
      const nextEscalatedAt = escalationDecision.shouldEscalate
        ? existing.escalatedAt ?? timestamp
        : wasResolved
          ? null
          : existing.escalatedAt;
      const nextEscalationReason = escalationDecision.shouldEscalate
        ? escalationDecision.reason
        : wasResolved
          ? null
          : existing.escalationReason;
      const nextOwnerUserId =
        escalationTransitioned && !existing.ownerUserId ? escalationDecision.ownerUserId ?? null : existing.ownerUserId;
      const nextFollowUpStatus =
        escalationTransitioned && (wasResolved || previousFollowUpStatus === "pending")
          ? escalationDecision.followUpStatus ?? previousFollowUpStatus
          : previousFollowUpStatus;
      await db
        .update(gatewayAnalysisAnomalyIncidents)
        .set({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt,
          escalationReason: nextEscalationReason,
          summary: anomaly.message,
          latestExportId: null,
          previousExportId: null,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          lastSeenAt: timestamp,
          resolvedAt: null,
          updatedAt: timestamp,
        })
        .where(eq(gatewayAnalysisAnomalyIncidents.id, existing.id));
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: existing.id,
        eventType: "sync_updated",
        note: anomaly.message,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: nextStatus,
          ownerUserId: nextOwnerUserId ?? null,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          snapshotId: snapshot.snapshotId,
          entityKey: anomaly.entityKey,
          latestBucketStartAt: anomaly.latestBucketStartAt,
          previousBucketStartAt: anomaly.previousBucketStartAt,
        }),
        createdAt: timestamp,
      });
      if (escalationTransitioned) {
        await appendGatewayAnalysisAnomalyIncidentHistory({
          incidentId: existing.id,
          eventType: "auto_escalated",
          note: escalationDecision.reason,
          metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
            policyId: null,
            projectId,
            routePolicyId,
            tag,
            textMode: null,
            code: anomaly.code,
            severity: anomaly.severity,
            status: nextStatus,
            ownerUserId: nextOwnerUserId ?? null,
            followUpStatus: nextFollowUpStatus,
            syncHitCount: nextSyncHitCount,
            escalationStatus: nextEscalationStatus,
            escalatedAt: nextEscalatedAt?.toISOString() ?? null,
            escalationReason: nextEscalationReason,
            latestValue: anomaly.latestValue,
            previousValue: anomaly.previousValue,
            deltaValue: anomaly.deltaValue,
            deltaRatio: anomaly.deltaRatio,
            thresholdValue: anomaly.thresholdValue,
            snapshotId: snapshot.snapshotId,
            entityKey: anomaly.entityKey,
            latestBucketStartAt: anomaly.latestBucketStartAt,
            previousBucketStartAt: anomaly.previousBucketStartAt,
          }),
          createdAt: timestamp,
        });
      }
      updatedIncidentIds.push(existing.id);
      continue;
    }

    const nextSyncHitCount = 1;
    const escalationDecision = resolveGatewayRateLimitHotspotAutoEscalation({
      anomalySeverity: anomaly.severity,
      syncHitCount: nextSyncHitCount,
    });
    const nextEscalationStatus = escalationDecision.shouldEscalate ? "escalated" : "none";
    const nextEscalatedAt = escalationDecision.shouldEscalate ? timestamp : null;
    const nextEscalationReason = escalationDecision.shouldEscalate ? escalationDecision.reason : null;
    const nextOwnerUserId = escalationDecision.shouldEscalate ? escalationDecision.ownerUserId ?? null : null;
    const nextFollowUpStatus = escalationDecision.shouldEscalate
      ? escalationDecision.followUpStatus ?? "pending"
      : "pending";
    const incidentId = randomUUID();
    await db.insert(gatewayAnalysisAnomalyIncidents).values({
      id: incidentId,
      policyId: null,
      fingerprint,
      projectId,
      routePolicyId,
      tag,
      textMode: null,
      code: anomaly.code,
      severity: anomaly.severity,
      status: "open",
      ownerUserId: nextOwnerUserId,
      followUpStatus: nextFollowUpStatus,
      syncHitCount: nextSyncHitCount,
      escalationStatus: nextEscalationStatus,
      escalatedAt: nextEscalatedAt,
      escalationReason: nextEscalationReason,
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      summary: anomaly.message,
      latestExportId: null,
      previousExportId: null,
      latestValue: anomaly.latestValue,
      previousValue: anomaly.previousValue,
      deltaValue: anomaly.deltaValue,
      deltaRatio: anomaly.deltaRatio,
      thresholdValue: anomaly.thresholdValue,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId,
      eventType: "sync_opened",
      note: anomaly.message,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId,
        routePolicyId,
        tag,
        textMode: null,
        code: anomaly.code,
        severity: anomaly.severity,
        status: "open",
        ownerUserId: nextOwnerUserId,
        followUpStatus: nextFollowUpStatus,
        syncHitCount: nextSyncHitCount,
        escalationStatus: nextEscalationStatus,
        escalatedAt: nextEscalatedAt?.toISOString() ?? null,
        escalationReason: nextEscalationReason,
        latestValue: anomaly.latestValue,
        previousValue: anomaly.previousValue,
        deltaValue: anomaly.deltaValue,
        deltaRatio: anomaly.deltaRatio,
        thresholdValue: anomaly.thresholdValue,
        snapshotId: snapshot.snapshotId,
        entityKey: anomaly.entityKey,
        latestBucketStartAt: anomaly.latestBucketStartAt,
        previousBucketStartAt: anomaly.previousBucketStartAt,
      }),
      createdAt: timestamp,
    });
    if (nextEscalationStatus === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId,
        eventType: "auto_escalated",
        note: nextEscalationReason,
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId,
          routePolicyId,
          tag,
          textMode: null,
          code: anomaly.code,
          severity: anomaly.severity,
          status: "open",
          ownerUserId: nextOwnerUserId,
          followUpStatus: nextFollowUpStatus,
          syncHitCount: nextSyncHitCount,
          escalationStatus: nextEscalationStatus,
          escalatedAt: nextEscalatedAt?.toISOString() ?? null,
          escalationReason: nextEscalationReason,
          latestValue: anomaly.latestValue,
          previousValue: anomaly.previousValue,
          deltaValue: anomaly.deltaValue,
          deltaRatio: anomaly.deltaRatio,
          thresholdValue: anomaly.thresholdValue,
          snapshotId: snapshot.snapshotId,
          entityKey: anomaly.entityKey,
          latestBucketStartAt: anomaly.latestBucketStartAt,
          previousBucketStartAt: anomaly.previousBucketStartAt,
        }),
        createdAt: timestamp,
      });
    }
    openedIncidentIds.push(incidentId);
  }

  for (const row of existingRows) {
    if (seenFingerprints.has(row.fingerprint)) {
      continue;
    }
    if (normalizeGatewayAnalysisAnomalyIncidentStatus(row.status) === "resolved") {
      continue;
    }
    const nextEscalationStatus =
      normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated"
        ? "resolved"
        : row.escalationStatus;
    await db
      .update(gatewayAnalysisAnomalyIncidents)
      .set({
        status: "resolved",
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        resolvedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(gatewayAnalysisAnomalyIncidents.id, row.id));
    await appendGatewayAnalysisAnomalyIncidentHistory({
      incidentId: row.id,
      eventType: "sync_resolved",
      note: row.summary,
      metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
        policyId: null,
        projectId: row.projectId ?? null,
        routePolicyId: row.routePolicyId ?? null,
        tag: row.tag ?? null,
        textMode: null,
        code: row.code,
        severity: row.severity,
        status: "resolved",
        ownerUserId: row.ownerUserId ?? null,
        followUpStatus: row.followUpStatus ?? null,
        syncHitCount: 0,
        escalationStatus: nextEscalationStatus,
        escalatedAt: row.escalatedAt?.toISOString() ?? null,
        escalationReason: row.escalationReason ?? null,
        latestValue: row.latestValue ?? null,
        previousValue: row.previousValue ?? null,
        deltaValue: row.deltaValue ?? null,
        deltaRatio: row.deltaRatio ?? null,
        thresholdValue: row.thresholdValue ?? null,
        snapshotId: snapshot.snapshotId,
      }),
      createdAt: timestamp,
    });
    if (normalizeGatewayAnalysisAnomalyIncidentEscalationStatus(row.escalationStatus) === "escalated") {
      await appendGatewayAnalysisAnomalyIncidentHistory({
        incidentId: row.id,
        eventType: "escalation_cleared",
        note: row.escalationReason ?? "Escalation cleared because hotspot anomaly no longer matched.",
        metadata: buildGatewayAnalysisAnomalyIncidentSnapshotMetadata({
          policyId: null,
          projectId: row.projectId ?? null,
          routePolicyId: row.routePolicyId ?? null,
          tag: row.tag ?? null,
          textMode: null,
          code: row.code,
          severity: row.severity,
          status: "resolved",
          ownerUserId: row.ownerUserId ?? null,
          followUpStatus: row.followUpStatus ?? null,
          syncHitCount: 0,
          escalationStatus: "resolved",
          escalatedAt: row.escalatedAt?.toISOString() ?? null,
          escalationReason: row.escalationReason ?? null,
          latestValue: row.latestValue ?? null,
          previousValue: row.previousValue ?? null,
          deltaValue: row.deltaValue ?? null,
          deltaRatio: row.deltaRatio ?? null,
          thresholdValue: row.thresholdValue ?? null,
          snapshotId: snapshot.snapshotId,
        }),
        createdAt: timestamp,
      });
    }
    resolvedIncidentIds.push(row.id);
  }

  const incidents = await listGatewayAnalysisAnomalyIncidentsForOperator(operatorUserId, providerUserId, {
    projectId,
    routePolicyId,
    tag,
    limit: 200,
  });

  return {
    snapshot,
    incidents,
    openedIncidentIds,
    updatedIncidentIds,
    resolvedIncidentIds,
  };
}
