// Case view assembly: row-to-view mappers for evidences, attachments,
// review rounds and full cases, the shared visibility-checked case loader,
// and the rich-hydration list endpoint. Moved verbatim from service.ts.
import type {
  ArbitrationCaseView,
  ArbitrationEvidenceAttachmentView,
  ArbitrationEvidenceView,
  ArbitrationReviewRoundView,
  ArbitrationReviewRoundStatus,
  ArbitrationTaskResolutionAction,
  ArbitrationStatus,
} from "@neuro/contracts";

import { buildArbitrationTimeline } from "@/modules/arbitration/case-analysis";
import {
  arbitrationCaseEvidences,
  arbitrationCases,
  arbitrationEvidenceAttachments,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import {
  getArbitrationCaseById,
  listArbitrationCaseEvidencesByCaseIds,
  listArbitrationEvidenceAttachmentsByEvidenceIds,
  listArbitrationCasesVisibleToUser,
  listArbitrationReviewRoundsByCaseIds,
} from "@/modules/arbitration/repository";
import { NotFoundError, UnauthorizedError } from "@/platform/errors";
import { getTaskById, listTasksByIds } from "@/modules/task-hub/repository";
import {
  getArbitrationClaimAgeHours as getClaimAgeHours,
  getArbitrationReviewRoundAgeHours as getReviewRoundAgeHours,
} from "@/modules/arbitration/workload-analysis";

import {
  canAddEvidence,
  canClaimCase,
  canReleaseCase,
  canViewCase,
  getViewerReputationImpact,
  isPlatformOperator,
  isStaleClaim,
  now,
} from "./shared";
import { getArbitrationReviewRoundPolicy } from "./round-policies";

export function toArbitrationEvidenceAttachmentView(
  row: typeof arbitrationEvidenceAttachments.$inferSelect,
): ArbitrationEvidenceAttachmentView {
  return {
    id: row.id,
    evidenceId: row.evidenceId,
    caseId: row.caseId,
    uploaderUserId: row.uploaderUserId,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    storageMode: row.storageMode as "local" | "remote",
    uploadState: (row.uploadState as "prepared" | "uploaded" | "archived") ?? (row.archivedAt ? "archived" : "uploaded"),
    storagePolicyKey: row.storagePolicyKey,
    bucketKey: row.bucketKey,
    objectKey: row.objectKey,
    remoteUrl: row.remoteUrl,
    uploadPreparedAt: row.uploadPreparedAt ? row.uploadPreparedAt.toISOString() : null,
    preparedUploadExpiresAt: row.preparedUploadExpiresAt ? row.preparedUploadExpiresAt.toISOString() : null,
    uploadCompletedAt: row.uploadCompletedAt ? row.uploadCompletedAt.toISOString() : null,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    verifiedSizeBytes: row.verifiedSizeBytes,
    verifiedContentType: row.verifiedContentType,
    retentionExpiresAt: row.retentionExpiresAt ? row.retentionExpiresAt.toISOString() : null,
    cleanupRequestedAt: row.cleanupRequestedAt ? row.cleanupRequestedAt.toISOString() : null,
    cleanupAttemptCount: row.cleanupAttemptCount,
    lastCleanupAttemptAt: row.lastCleanupAttemptAt ? row.lastCleanupAttemptAt.toISOString() : null,
    lastCleanupError: row.lastCleanupError,
    nextCleanupAttemptAt: row.nextCleanupAttemptAt ? row.nextCleanupAttemptAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    archiveReason: row.archiveReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toArbitrationEvidenceView(
  row: typeof arbitrationCaseEvidences.$inferSelect,
  attachments: ArbitrationEvidenceAttachmentView[] = [],
): ArbitrationEvidenceView {
  return {
    id: row.id,
    caseId: row.caseId,
    creatorUserId: row.creatorUserId,
    kind: row.kind as ArbitrationEvidenceView["kind"],
    title: row.title,
    content: row.content,
    url: row.url,
    attachments,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toArbitrationReviewRoundView(
  row: typeof arbitrationCaseReviewRounds.$inferSelect,
): ArbitrationReviewRoundView {
  const roundAgeHours = getReviewRoundAgeHours(row.startedAt, row.endedAt, now());
  const roundPolicy = getArbitrationReviewRoundPolicy(row.roundNumber);
  return {
    id: row.id,
    caseId: row.caseId,
    roundNumber: row.roundNumber,
    status: row.status as ArbitrationReviewRoundStatus,
    summary: row.summary,
    assignedOperatorUserId: row.assignedOperatorUserId,
    startedByUserId: row.startedByUserId,
    endedByUserId: row.endedByUserId,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    roundAgeHours,
    isRoundStale: row.status === "open" && roundAgeHours >= roundPolicy.staleHours,
  };
}

export function toArbitrationCaseView(args: {
  row: typeof arbitrationCases.$inferSelect;
  actorUserId: string;
  task?: { creatorUserId: string; assignedUserId: string | null } | null;
  evidences?: ArbitrationEvidenceView[];
  reviewRounds?: ArbitrationReviewRoundView[];
}): ArbitrationCaseView {
  const { row, actorUserId, task = null, evidences = [], reviewRounds = [] } = args;
  const operator = isPlatformOperator(actorUserId);
  const claimOwner = row.assignedOperatorUserId;
  const claimAgeHours = getClaimAgeHours(row.claimedAt, now());
  const canUpdateStatus =
    operator &&
    ["open", "under_review"].includes(row.status) &&
    (!claimOwner || claimOwner === actorUserId);
  const currentReviewRoundNumber =
    reviewRounds.filter((round) => round.status === "open").at(-1)?.roundNumber ??
    reviewRounds.at(-1)?.roundNumber ??
    1;

  return {
    id: row.id,
    entityType: row.entityType as "task",
    entityId: row.entityId,
    requesterUserId: row.requesterUserId,
    respondentUserId: row.respondentUserId,
    status: row.status as ArbitrationStatus,
    reason: row.reason,
    evidenceSummary: row.evidenceSummary,
    resolutionSummary: row.resolutionSummary,
    taskResolutionAction: (row.taskResolutionAction as ArbitrationTaskResolutionAction | null) ?? null,
    reputationImpactForViewer: getViewerReputationImpact({
      actorUserId,
      task,
      taskResolutionAction: (row.taskResolutionAction as ArbitrationTaskResolutionAction | null) ?? null,
      status: row.status as ArbitrationStatus,
      effectsAppliedAt: row.effectsAppliedAt,
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    effectsAppliedAt: row.effectsAppliedAt ? row.effectsAppliedAt.toISOString() : null,
    assignedOperatorUserId: row.assignedOperatorUserId,
    claimedAt: row.claimedAt ? row.claimedAt.toISOString() : null,
    claimAgeHours,
    isStaleClaim: isStaleClaim(row.claimedAt, now()),
    currentReviewRoundNumber,
    canUpdateStatus,
    canAddEvidence: canAddEvidence(actorUserId, row),
    canClaim: canClaimCase(actorUserId, row),
    canRelease: canReleaseCase(actorUserId, row),
    canAdvanceReviewRound:
      operator &&
      row.status === "under_review" &&
      (!claimOwner || claimOwner === actorUserId),
    evidences,
    reviewRounds,
    timeline: buildArbitrationTimeline({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      effectsAppliedAt: row.effectsAppliedAt,
      reason: row.reason,
      evidenceSummary: row.evidenceSummary,
      resolutionSummary: row.resolutionSummary,
      status: row.status as ArbitrationStatus,
      evidences,
    }),
  };
}

export async function loadVisibleArbitrationCaseOrThrow(userId: string, caseId: string): Promise<ArbitrationCaseView> {
  const row = await getArbitrationCaseById(caseId);
  if (!row) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, row)) {
    throw new UnauthorizedError("You do not have access to this arbitration case");
  }

  const [task, evidenceRows, reviewRoundRows] = await Promise.all([
    row.entityType === "task" ? getTaskById(row.entityId) : Promise.resolve(null),
    listArbitrationCaseEvidencesByCaseIds([row.id]),
    listArbitrationReviewRoundsByCaseIds([row.id]),
  ]);
  const attachmentRows = await listArbitrationEvidenceAttachmentsByEvidenceIds(evidenceRows.map((evidence) => evidence.id));
  const attachmentsByEvidenceId = new Map<string, ArbitrationEvidenceAttachmentView[]>();
  for (const attachmentRow of attachmentRows) {
    const attachments = attachmentsByEvidenceId.get(attachmentRow.evidenceId) ?? [];
    attachments.push(toArbitrationEvidenceAttachmentView(attachmentRow));
    attachmentsByEvidenceId.set(attachmentRow.evidenceId, attachments);
  }

  return toArbitrationCaseView({
    row,
    actorUserId: userId,
    task,
    evidences: evidenceRows.map((evidenceRow) =>
      toArbitrationEvidenceView(evidenceRow, attachmentsByEvidenceId.get(evidenceRow.id) ?? []),
    ),
    reviewRounds: reviewRoundRows.map(toArbitrationReviewRoundView),
  });
}

export async function listVisibleArbitrationCases(userId: string): Promise<ArbitrationCaseView[]> {
  const rows = await listArbitrationCasesVisibleToUser(userId, isPlatformOperator(userId));
  const taskIds = Array.from(new Set(rows.filter((row) => row.entityType === "task").map((row) => row.entityId)));
  const [taskRows, evidenceRows, reviewRoundRows] = await Promise.all([
    listTasksByIds(taskIds),
    listArbitrationCaseEvidencesByCaseIds(rows.map((row) => row.id)),
    listArbitrationReviewRoundsByCaseIds(rows.map((row) => row.id)),
  ]);
  const attachmentRows = await listArbitrationEvidenceAttachmentsByEvidenceIds(evidenceRows.map((row) => row.id));
  const taskMap = new Map(taskRows.map((task) => [task.id, task]));
  const evidenceMap = new Map<string, ArbitrationEvidenceView[]>();
  const attachmentMap = new Map<string, ArbitrationEvidenceAttachmentView[]>();
  const reviewRoundMap = new Map<string, ArbitrationReviewRoundView[]>();

  for (const attachmentRow of attachmentRows) {
    const attachments = attachmentMap.get(attachmentRow.evidenceId) ?? [];
    attachments.push(toArbitrationEvidenceAttachmentView(attachmentRow));
    attachmentMap.set(attachmentRow.evidenceId, attachments);
  }

  for (const evidenceRow of evidenceRows) {
    const evidence = toArbitrationEvidenceView(evidenceRow, attachmentMap.get(evidenceRow.id) ?? []);
    const existing = evidenceMap.get(evidence.caseId) ?? [];
    existing.push(evidence);
    evidenceMap.set(evidence.caseId, existing);
  }
  for (const roundRow of reviewRoundRows) {
    const rounds = reviewRoundMap.get(roundRow.caseId) ?? [];
    rounds.push(toArbitrationReviewRoundView(roundRow));
    reviewRoundMap.set(roundRow.caseId, rounds);
  }

  return rows.map((row) =>
    toArbitrationCaseView({
      row,
      actorUserId: userId,
      task: taskMap.get(row.entityId) ?? null,
      evidences: evidenceMap.get(row.id) ?? [],
      reviewRounds: reviewRoundMap.get(row.id) ?? [],
    }),
  );
}
