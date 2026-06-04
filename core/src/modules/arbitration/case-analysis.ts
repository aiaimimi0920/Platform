import type {
  ArbitrationCaseSummaryBucket,
  ArbitrationEvidenceView,
  ArbitrationCaseSummaryView,
  ArbitrationCaseTimelineEntryView,
  ArbitrationStatus,
  ArbitrationTaskResolutionAction,
  ArbitrationViewerImpact,
} from "@neuro/contracts";

function sortSummaryBuckets(bucketMap: Map<string, number>): ArbitrationCaseSummaryBucket[] {
  return [...bucketMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function buildArbitrationTimeline(args: {
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  effectsAppliedAt: Date | null;
  reason: string;
  evidenceSummary: string | null;
  evidences: ArbitrationEvidenceView[];
  resolutionSummary: string | null;
  status: ArbitrationStatus;
}): ArbitrationCaseTimelineEntryView[] {
  const timeline: ArbitrationCaseTimelineEntryView[] = [
    {
      kind: "created",
      title: "案件已创建",
      detail: args.reason,
      occurredAt: args.createdAt.toISOString(),
    },
  ];

  if (args.evidences.length > 0) {
    for (const evidence of args.evidences) {
      const detailParts = [evidence.title];
      if (evidence.content) detailParts.push(evidence.content);
      if (evidence.url) detailParts.push(evidence.url);
      timeline.push({
        kind: "evidence",
        title: `证据已补充 · ${evidence.kind}`,
        detail: detailParts.filter(Boolean).join(" | "),
        occurredAt: evidence.createdAt,
      });
    }
  } else if (args.evidenceSummary) {
    timeline.push({
      kind: "evidence",
      title: "证据摘要已提交",
      detail: args.evidenceSummary,
      occurredAt: args.createdAt.toISOString(),
    });
  }

  if (args.status === "under_review" || args.status === "resolved" || args.status === "rejected") {
    timeline.push({
      kind: "under_review",
      title: "案件进入审理",
      detail: args.status === "under_review" ? "等待操作员继续处理。" : "案件已离开 open 状态并进入正式审理流程。",
      occurredAt: args.status === "under_review" ? args.updatedAt.toISOString() : (args.resolvedAt ?? args.updatedAt).toISOString(),
    });
  }

  if (args.status === "resolved" || args.status === "rejected") {
    timeline.push({
      kind: args.status,
      title: args.status === "resolved" ? "案件已裁决" : "案件已驳回",
      detail: args.resolutionSummary ?? null,
      occurredAt: (args.resolvedAt ?? args.updatedAt).toISOString(),
    });
  }

  if (args.effectsAppliedAt) {
    timeline.push({
      kind: "effects_applied",
      title: "结案效果已回写",
      detail: "任务结算与信誉影响已应用。",
      occurredAt: args.effectsAppliedAt.toISOString(),
    });
  }

  return timeline.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

export function buildArbitrationCaseSummary(
  cases: Array<{
    entityType: string;
    status: ArbitrationStatus;
    taskResolutionAction: ArbitrationTaskResolutionAction | null;
    reputationImpactForViewer: ArbitrationViewerImpact;
    effectsAppliedAt: string | null;
    evidences: ArbitrationEvidenceView[];
    assignedOperatorUserId: string | null;
  }>,
): ArbitrationCaseSummaryView {
  const byStatus = new Map<string, number>();
  const byEntityType = new Map<string, number>();
  const byEvidenceKind = new Map<string, number>();
  const byTaskResolutionAction = new Map<string, number>();
  const byReputationImpact = new Map<string, number>();
  let awaitingOperatorCount = 0;
  let resolvedWithEffectsCount = 0;
  let evidenceCount = 0;
  let casesWithEvidenceCount = 0;
  let claimedCount = 0;
  let remoteAttachmentCount = 0;
  let cleanupRequestedRemoteAttachmentCount = 0;
  let archivedRemoteAttachmentCount = 0;

  for (const arbitrationCase of cases) {
    byStatus.set(arbitrationCase.status, (byStatus.get(arbitrationCase.status) ?? 0) + 1);
    byEntityType.set(arbitrationCase.entityType, (byEntityType.get(arbitrationCase.entityType) ?? 0) + 1);
    byTaskResolutionAction.set(
      arbitrationCase.taskResolutionAction ?? "none",
      (byTaskResolutionAction.get(arbitrationCase.taskResolutionAction ?? "none") ?? 0) + 1,
    );
    byReputationImpact.set(
      arbitrationCase.reputationImpactForViewer,
      (byReputationImpact.get(arbitrationCase.reputationImpactForViewer) ?? 0) + 1,
    );
    if (arbitrationCase.status === "open" || arbitrationCase.status === "under_review") {
      awaitingOperatorCount += 1;
    }
    if (arbitrationCase.status === "resolved" && arbitrationCase.effectsAppliedAt) {
      resolvedWithEffectsCount += 1;
    }
    evidenceCount += arbitrationCase.evidences.length;
    if (arbitrationCase.evidences.length > 0) {
      casesWithEvidenceCount += 1;
    }
    if (arbitrationCase.assignedOperatorUserId) {
      claimedCount += 1;
    }
    for (const evidence of arbitrationCase.evidences) {
      byEvidenceKind.set(evidence.kind, (byEvidenceKind.get(evidence.kind) ?? 0) + 1);
      for (const attachment of evidence.attachments) {
        if (attachment.storageMode === "remote") {
          remoteAttachmentCount += 1;
          if (attachment.cleanupRequestedAt && !attachment.archivedAt) {
            cleanupRequestedRemoteAttachmentCount += 1;
          }
          if (attachment.archivedAt) {
            archivedRemoteAttachmentCount += 1;
          }
        }
      }
    }
  }

  return {
    totalCount: cases.length,
    awaitingOperatorCount,
    resolvedWithEffectsCount,
    evidenceCount,
    casesWithEvidenceCount,
    casesWithoutEvidenceCount: Math.max(0, cases.length - casesWithEvidenceCount),
    claimedCount,
    unclaimedCount: Math.max(0, cases.length - claimedCount),
    remoteAttachmentCount,
    cleanupRequestedRemoteAttachmentCount,
    archivedRemoteAttachmentCount,
    byStatus: sortSummaryBuckets(byStatus),
    byEntityType: sortSummaryBuckets(byEntityType),
    byEvidenceKind: sortSummaryBuckets(byEvidenceKind),
    byTaskResolutionAction: sortSummaryBuckets(byTaskResolutionAction),
    byReputationImpact: sortSummaryBuckets(byReputationImpact),
  };
}
