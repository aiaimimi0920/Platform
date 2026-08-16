// Statistics endpoints (summary/workload). These must keep following
// docs/40-engineering/arbitration-metric-query-baseline.md: visibility-filtered
// scalar case projections plus grouped evidence/attachment/round metrics only.
// Moved verbatim from service.ts.
import type {
  ArbitrationCaseSummaryView,
  ArbitrationReviewRoundStatus,
  ArbitrationTaskResolutionAction,
  ArbitrationStatus,
  ArbitrationWorkloadView,
} from "@neuro/contracts";

import { buildArbitrationCaseSummaryFromMetrics } from "@/modules/arbitration/case-analysis";
import {
  getArbitrationAttachmentMetricsByCaseIds,
  listArbitrationCaseMetricRowsVisibleToUser,
  listArbitrationEvidenceMetricsByCaseIds,
  listArbitrationReviewRoundMetricRowsByCaseIds,
} from "@/modules/arbitration/repository";
import { env } from "@/env";
import { UnauthorizedError } from "@/platform/errors";
import { listTaskParticipantRowsByIds } from "@/modules/task-hub/repository";
import { buildArbitrationCaseWorkload } from "@/modules/arbitration/workload-analysis";

import { getViewerReputationImpact, isPlatformOperator, now } from "./shared";
import { getArbitrationReviewRoundPolicy } from "./round-policies";

export async function getVisibleArbitrationCaseSummary(userId: string): Promise<ArbitrationCaseSummaryView> {
  const rows = await listArbitrationCaseMetricRowsVisibleToUser(userId, isPlatformOperator(userId));
  const caseIds = rows.map((row) => row.id);
  const taskIds = Array.from(new Set(rows.filter((row) => row.entityType === "task").map((row) => row.entityId)));
  const [taskRows, evidenceMetrics, attachmentMetrics] = await Promise.all([
    listTaskParticipantRowsByIds(taskIds),
    listArbitrationEvidenceMetricsByCaseIds(caseIds),
    getArbitrationAttachmentMetricsByCaseIds(caseIds),
  ]);
  const taskMap = new Map(taskRows.map((task) => [task.id, task]));
  const evidenceCountByCaseId = new Map<string, number>();
  for (const metric of evidenceMetrics) {
    evidenceCountByCaseId.set(metric.caseId, (evidenceCountByCaseId.get(metric.caseId) ?? 0) + Number(metric.evidenceCount));
  }

  return buildArbitrationCaseSummaryFromMetrics({
    cases: rows.map((row) => ({
      entityType: row.entityType,
      status: row.status as ArbitrationStatus,
      taskResolutionAction: (row.taskResolutionAction as ArbitrationTaskResolutionAction | null) ?? null,
      reputationImpactForViewer: getViewerReputationImpact({
        actorUserId: userId,
        task: taskMap.get(row.entityId) ?? null,
        taskResolutionAction: (row.taskResolutionAction as ArbitrationTaskResolutionAction | null) ?? null,
        status: row.status as ArbitrationStatus,
        effectsAppliedAt: row.effectsAppliedAt,
      }),
      effectsAppliedAt: row.effectsAppliedAt ? row.effectsAppliedAt.toISOString() : null,
      evidenceCount: evidenceCountByCaseId.get(row.id) ?? 0,
      assignedOperatorUserId: row.assignedOperatorUserId,
    })),
    evidenceKindCounts: evidenceMetrics.map((metric) => ({
      kind: metric.kind,
      count: Number(metric.evidenceCount),
    })),
    attachmentMetrics,
  });
}

export async function getArbitrationCaseWorkload(userId: string): Promise<ArbitrationWorkloadView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can view arbitration workload");
  }

  const rows = await listArbitrationCaseMetricRowsVisibleToUser(userId, true);
  const caseIds = rows.map((row) => row.id);
  const [evidenceMetrics, reviewRoundRows] = await Promise.all([
    listArbitrationEvidenceMetricsByCaseIds(caseIds),
    listArbitrationReviewRoundMetricRowsByCaseIds(caseIds),
  ]);

  return buildArbitrationCaseWorkload({
    cases: rows.map((row) => ({
      id: row.id,
      status: row.status as ArbitrationStatus,
      assignedOperatorUserId: row.assignedOperatorUserId,
      claimedAt: row.claimedAt,
      createdAt: row.createdAt,
    })),
    evidenceMetrics: evidenceMetrics.map((metric) => ({
      caseId: metric.caseId,
      evidenceCount: Number(metric.evidenceCount),
    })),
    reviewRounds: reviewRoundRows.map((row) => ({
      caseId: row.caseId,
      roundNumber: row.roundNumber,
      status: row.status as ArbitrationReviewRoundStatus,
      assignedOperatorUserId: row.assignedOperatorUserId,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    })),
    userId,
    operatorUserIds: env.platformOperatorUserIds,
    staleClaimHours: env.arbitrationStaleClaimHours,
    referenceTime: now(),
    getRoundStaleHours: (roundNumber) => getArbitrationReviewRoundPolicy(roundNumber).staleHours,
  });
}
