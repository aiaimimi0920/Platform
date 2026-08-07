import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdvanceArbitrationReviewRoundInput,
  ArbitrationCaseView,
  ArbitrationCaseSummaryView,
  ArbitrationEvidenceAttachmentAccessView,
  ArbitrationEvidenceAttachmentView,
  ArbitrationEvidenceAttachmentUploadPlanView,
  ArbitrationEvidenceStoragePolicyView,
  ArbitrationEvidenceView,
  ArbitrationRemoteAttachmentCleanupCandidateView,
  ArbitrationRemoteAttachmentCleanupQueueView,
  ArbitrationReviewRoundView,
  ArbitrationReviewRoundStatus,
  ArbitrationReviewRoundRebalanceResult,
  ArbitrationTaskResolutionAction,
  ArbitrationStatus,
  ArbitrationWorkloadView,
  CreateArbitrationCaseInput,
  CreateArbitrationEvidenceInput,
  PrepareArbitrationEvidenceAttachmentUploadInput,
  UploadArbitrationEvidenceAttachmentInput,
  UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";
import {
  requestInternalArrayBuffer,
  requestInternalText,
} from "@neuro/backend-foundation/platform/internal-request";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { buildArbitrationCaseSummary, buildArbitrationTimeline } from "@/modules/arbitration/case-analysis";
import {
  arbitrationCaseEvidences,
  arbitrationCases,
  arbitrationEvidenceAttachments,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import {
  getArbitrationCaseById,
  getArbitrationEvidenceAttachmentById,
  getArbitrationEvidenceById,
  listArbitrationCaseEvidencesByCaseIds,
  listArbitrationEvidenceAttachmentsByEvidenceIds,
  listArbitrationCasesVisibleToUser,
  listArbitrationReviewRoundsByCaseIds,
} from "@/modules/arbitration/repository";
import { env } from "@/env";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import {
  createSignedReadUrl,
  createSignedWriteUrl,
  deleteObject,
  getObjectMetadata,
  putObject,
  readObject,
  setObjectTags,
} from "@/platform/object-storage/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { getTaskById } from "@/modules/task-hub/repository";
import { settleTaskLifecycleByOperatorInTx } from "@/modules/task-hub/service";

function now() {
  return new Date();
}

function getArbitrationReviewRoundPolicy(roundNumber: number) {
  const roundKey = `round:${Math.max(1, roundNumber)}`;
  if (env.arbitrationReviewRoundPolicies[roundKey]) {
    return {
      key: roundKey,
      ...env.arbitrationReviewRoundPolicies[roundKey],
    };
  }
  return {
    key: "default",
    ...env.arbitrationReviewRoundPolicies.default,
  };
}

function getArbitrationClaimReleaseHoursForRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber === "number" && Number.isFinite(roundNumber) && roundNumber >= 1) {
    const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
    return roundPolicy.claimReleaseHours;
  }
  return env.arbitrationStaleClaimHours;
}

function getArbitrationReviewRoundOperatorPool(
  roundNumber: number | null | undefined,
  options?: { excludeOperatorUserId?: string | null },
) {
  const roundPolicy =
    typeof roundNumber === "number" && Number.isFinite(roundNumber) && roundNumber >= 1
      ? getArbitrationReviewRoundPolicy(roundNumber)
      : null;
  const configuredPool =
    roundPolicy?.assigneePool?.length ? roundPolicy.assigneePool : env.platformOperatorUserIds;
  return [...new Set(configuredPool)]
    .filter((operatorId) => operatorId.trim().length > 0)
    .filter((operatorId) => operatorId !== options?.excludeOperatorUserId);
}

function isOperatorAllowedForArbitrationRound(roundNumber: number | null | undefined, operatorUserId: string | null | undefined) {
  if (!operatorUserId) return false;
  return getArbitrationReviewRoundOperatorPool(roundNumber).includes(operatorUserId);
}

function getClaimAgeHours(claimedAt: Date | null, referenceTime: Date) {
  if (!claimedAt) return null;
  return Math.max(0, Math.floor((referenceTime.getTime() - claimedAt.getTime()) / (60 * 60 * 1000)));
}

function getReviewRoundAgeHours(startedAt: Date, endedAt: Date | null, referenceTime: Date) {
  const effectiveEnd = endedAt ?? referenceTime;
  return Math.max(0, Math.floor((effectiveEnd.getTime() - startedAt.getTime()) / (60 * 60 * 1000)));
}

function getArbitrationRoundAgeBucket(roundAgeHours: number, staleHours: number) {
  const threshold = Math.max(1, staleHours);
  if (roundAgeHours >= threshold) return "stale";
  if (roundAgeHours >= Math.max(1, Math.floor(threshold / 2))) return "approaching_stale";
  return "fresh";
}

async function getRecommendedArbitrationRoundAssigneeInTx(
  tx: NodePgDatabase<typeof schema>,
  options?: {
    excludeOperatorUserId?: string | null;
    roundNumber?: number | null;
    preferredOperatorUserId?: string | null;
  },
) {
  const roundPolicy =
    typeof options?.roundNumber === "number" && Number.isFinite(options.roundNumber) && options.roundNumber >= 1
      ? getArbitrationReviewRoundPolicy(options.roundNumber)
      : null;
  const operatorIds = getArbitrationReviewRoundOperatorPool(options?.roundNumber, {
    excludeOperatorUserId: options?.excludeOperatorUserId,
  });
  if (operatorIds.length === 0) {
    return null;
  }

  const [roundRows, caseRows] = await Promise.all([
    tx.execute(sql`
      select assigned_operator_user_id as operator_user_id, count(*)::int as count
      from arbitration_case_review_rounds
      where status = 'open'
        and assigned_operator_user_id is not null
      group by assigned_operator_user_id
    `),
    tx.execute(sql`
      select assigned_operator_user_id as operator_user_id, count(*)::int as count
      from arbitration_cases
      where status in ('open', 'under_review')
        and assigned_operator_user_id is not null
      group by assigned_operator_user_id
    `),
  ]);

  const openRoundCountByOperator = new Map<string, number>();
  const claimedCaseCountByOperator = new Map<string, number>();
  for (const row of roundRows.rows as Array<{ operator_user_id: string | null; count: number }>) {
    if (row.operator_user_id) {
      openRoundCountByOperator.set(row.operator_user_id, Number(row.count) || 0);
    }
  }
  for (const row of caseRows.rows as Array<{ operator_user_id: string | null; count: number }>) {
    if (row.operator_user_id) {
      claimedCaseCountByOperator.set(row.operator_user_id, Number(row.count) || 0);
    }
  }
  const preferredOperatorUserId =
    roundPolicy?.preferCaseAssignee && options?.preferredOperatorUserId && operatorIds.includes(options.preferredOperatorUserId)
      ? options.preferredOperatorUserId
      : null;
  const candidateOperatorIds =
    roundPolicy?.maxOpenRoundsPerOperator === null || roundPolicy?.maxOpenRoundsPerOperator === undefined
      ? operatorIds
      : operatorIds.filter(
          (operatorId) => (openRoundCountByOperator.get(operatorId) ?? 0) < roundPolicy.maxOpenRoundsPerOperator!,
        );
  const sortableOperatorIds = candidateOperatorIds.length > 0 ? candidateOperatorIds : operatorIds;

  return [...sortableOperatorIds]
    .sort((left, right) => {
      const preferredDiff = Number(right === preferredOperatorUserId) - Number(left === preferredOperatorUserId);
      if (preferredDiff !== 0) return preferredDiff;
      const roundDiff = (openRoundCountByOperator.get(left) ?? 0) - (openRoundCountByOperator.get(right) ?? 0);
      if (roundDiff !== 0) return roundDiff;
      const claimDiff = (claimedCaseCountByOperator.get(left) ?? 0) - (claimedCaseCountByOperator.get(right) ?? 0);
      if (claimDiff !== 0) return claimDiff;
      return left.localeCompare(right);
    })[0] ?? null;
}

async function countOperatorOpenArbitrationRoundsInTx(
  tx: NodePgDatabase<typeof schema>,
  args: {
    operatorUserId: string;
    excludeCaseId?: string | null;
    excludeRoundId?: string | null;
  },
) {
  const conditions: SQL[] = [
    eq(arbitrationCaseReviewRounds.status, "open"),
    eq(arbitrationCaseReviewRounds.assignedOperatorUserId, args.operatorUserId),
  ];
  if (args.excludeCaseId) {
    conditions.push(sql`${arbitrationCaseReviewRounds.caseId} <> ${args.excludeCaseId}`);
  }
  if (args.excludeRoundId) {
    conditions.push(sql`${arbitrationCaseReviewRounds.id} <> ${args.excludeRoundId}`);
  }
  const [row] = await tx
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(arbitrationCaseReviewRounds)
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

async function assertOperatorCanTakeArbitrationRoundInTx(
  tx: NodePgDatabase<typeof schema>,
  args: {
    operatorUserId: string;
    roundNumber: number;
    excludeCaseId?: string | null;
    excludeRoundId?: string | null;
  },
) {
  if (!isOperatorAllowedForArbitrationRound(args.roundNumber, args.operatorUserId)) {
    throw new ConflictError("Selected operator is not allowed for this review round policy");
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(args.roundNumber);
  if (roundPolicy.maxOpenRoundsPerOperator === null) {
    return;
  }
  const openRoundCount = await countOperatorOpenArbitrationRoundsInTx(tx, args);
  if (openRoundCount >= roundPolicy.maxOpenRoundsPerOperator) {
    throw new ConflictError("Selected operator has reached the round policy capacity");
  }
}

function getArbitrationAutoAdvanceHoursForRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber) || roundNumber < 1) {
    return env.arbitrationReviewRoundPolicies.default.autoAdvanceEnabled
      ? env.arbitrationReviewRoundPolicies.default.autoAdvanceAfterHours
      : null;
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
  if (!roundPolicy.autoAdvanceEnabled) {
    return null;
  }
  return roundPolicy.autoAdvanceAfterHours ?? roundPolicy.staleHours;
}

function getArbitrationEvidenceQuietSince(args: {
  roundNumber: number | null | undefined;
  referenceTime: Date;
  anchorTime: Date;
}) {
  const roundPolicy =
    typeof args.roundNumber === "number" && Number.isFinite(args.roundNumber) && args.roundNumber >= 1
      ? getArbitrationReviewRoundPolicy(args.roundNumber)
      : env.arbitrationReviewRoundPolicies.default;
  if (roundPolicy.evidenceQuietHours === null) {
    return null;
  }
  const quietWindowStart = new Date(args.referenceTime.getTime() - roundPolicy.evidenceQuietHours * 60 * 60 * 1000);
  return new Date(Math.max(args.anchorTime.getTime(), quietWindowStart.getTime()));
}

function canAdvanceArbitrationRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber) || roundNumber < 1) {
    return true;
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
  return roundPolicy.maxRoundNumber === null || roundNumber < roundPolicy.maxRoundNumber;
}

function isTerminalArbitrationRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber) || roundNumber < 1) {
    return false;
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
  return roundPolicy.maxRoundNumber !== null && roundNumber >= roundPolicy.maxRoundNumber;
}

async function hasRecentArbitrationEvidenceActivitySinceInTx(
  tx: NodePgDatabase<typeof schema>,
  args: {
    caseId: string;
    since: Date;
  },
) {
  const [evidenceRows, attachmentRows] = await Promise.all([
    tx
      .select({ id: arbitrationCaseEvidences.id })
      .from(arbitrationCaseEvidences)
      .where(
        and(
          eq(arbitrationCaseEvidences.caseId, args.caseId),
          sql`${arbitrationCaseEvidences.createdAt} > ${args.since}`,
        ),
      )
      .limit(1),
    tx.execute(sql`
      select aea.id
      from arbitration_evidence_attachments aea
      inner join arbitration_case_evidences ace
        on ace.id = aea.evidence_id
      where ace.case_id = ${args.caseId}
        and aea.created_at > ${args.since}
      limit 1
    `),
  ]);

  return evidenceRows.length > 0 || attachmentRows.rows.length > 0;
}

function getPreparedUploadExpiresAt(
  preparedAt: Date,
  args?: { evidenceKind?: ArbitrationEvidenceView["kind"] | null; policyKey?: string | null },
) {
  const policy = resolveArbitrationEvidenceStoragePolicy(args?.evidenceKind ?? null, args?.policyKey ?? null);
  return new Date(preparedAt.getTime() + policy.uploadPlanTtlSeconds * 1000);
}

function resolveArbitrationEvidenceStoragePolicy(
  evidenceKind?: ArbitrationEvidenceView["kind"] | null,
  policyKey?: string | null,
) {
  if (policyKey && env.arbitrationEvidenceStoragePolicies[policyKey]) {
    return {
      key: policyKey,
      ...env.arbitrationEvidenceStoragePolicies[policyKey],
    };
  }
  if (evidenceKind) {
    const matchedEntry = Object.entries(env.arbitrationEvidenceStoragePolicies).find(([, policy]) =>
      policy.evidenceKinds.includes(evidenceKind),
    );
    if (matchedEntry) {
      return {
        key: matchedEntry[0],
        ...matchedEntry[1],
      };
    }
  }
  const fallbackKey =
    env.arbitrationEvidenceStoragePolicies[env.arbitrationEvidenceStoragePolicyKey]
      ? env.arbitrationEvidenceStoragePolicyKey
      : env.arbitrationEvidenceStoragePolicies.default
        ? "default"
        : Object.keys(env.arbitrationEvidenceStoragePolicies)[0] ?? env.arbitrationEvidenceStoragePolicyKey;
  return {
    key: fallbackKey,
    ...env.arbitrationEvidenceStoragePolicies[fallbackKey],
  };
}

function getArbitrationRemoteRetentionExpiresAt(referenceTime: Date, policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return new Date(referenceTime.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000);
}

function getNextArbitrationCleanupAttemptAt(attemptCount: number, referenceTime: Date, policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  const backoffMinutes = policy.cleanupBaseBackoffMinutes * Math.max(1, 2 ** Math.max(0, attemptCount - 1));
  return new Date(referenceTime.getTime() + backoffMinutes * 60 * 1000);
}

function getArbitrationEvidenceStoragePolicy(policyKey?: string | null): ArbitrationEvidenceStoragePolicyView {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return {
    policyKey: policy.key,
    storageMode: env.arbitrationEvidenceStorageMode,
    bucketKey: policy.bucketKey,
    cleanupMode: policy.cleanupMode,
    evidenceKinds: [...policy.evidenceKinds],
    remoteProviderKey:
      env.arbitrationEvidenceStorageMode === "remote" ? env.arbitrationEvidenceRemoteProviderKey : null,
    remoteUploadStrategy: env.arbitrationEvidenceRemoteUploadStrategy,
    remoteBaseUrlConfigured: Boolean(env.arbitrationEvidenceRemoteBaseUrl),
    remoteUploadBaseUrlConfigured: Boolean(env.arbitrationEvidenceRemoteUploadBaseUrl),
    remoteAuthConfigured: Boolean(env.arbitrationEvidenceRemoteAuthToken),
    prepareUploadSupported:
      env.arbitrationEvidenceStorageMode === "remote" &&
      env.arbitrationEvidenceRemoteUploadStrategy === "prepared_remote_put",
    uploadPlanTtlSeconds: policy.uploadPlanTtlSeconds,
    retentionDays: policy.retentionDays,
    cleanupMaxAttempts: policy.cleanupMaxAttempts,
    cleanupBaseBackoffMinutes: policy.cleanupBaseBackoffMinutes,
  };
}

function shouldDeleteArbitrationAttachmentOnCleanup(policyKey?: string | null) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, policyKey ?? null);
  return policy.cleanupMode === "delete_object";
}

export async function listArbitrationEvidenceStoragePolicies(userId: string): Promise<ArbitrationEvidenceStoragePolicyView[]> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can inspect arbitration evidence storage policies");
  }

  return Object.keys(env.arbitrationEvidenceStoragePolicies)
    .sort((left, right) => left.localeCompare(right))
    .map((policyKey) => getArbitrationEvidenceStoragePolicy(policyKey));
}

function getRemoteAttachmentCleanupState(args: {
  attachment: typeof arbitrationEvidenceAttachments.$inferSelect;
  referenceTime: Date;
}) {
  const policy = resolveArbitrationEvidenceStoragePolicy(null, args.attachment.storagePolicyKey ?? null);
  if (args.attachment.cleanupRequestedAt) return "cleanup_requested" as const;
  if ((args.attachment.cleanupAttemptCount ?? 0) >= policy.cleanupMaxAttempts) return "exhausted" as const;
  if (args.attachment.lastCleanupError) {
    if (args.attachment.nextCleanupAttemptAt && args.attachment.nextCleanupAttemptAt.getTime() > args.referenceTime.getTime()) {
      return "retry_waiting" as const;
    }
    return "failed" as const;
  }
  if (args.attachment.retentionExpiresAt && args.attachment.retentionExpiresAt.getTime() <= args.referenceTime.getTime()) {
    return "due_now" as const;
  }
  return "pending" as const;
}

function getArbitrationAttachmentStorageRoot() {
  return path.resolve(process.cwd(), env.arbitrationEvidenceStorageDir);
}

function buildRemoteAttachmentObjectKey(caseId: string, evidenceId: string, attachmentId: string, fileName: string) {
  return `${caseId}/${evidenceId}/${attachmentId}-${fileName}`;
}

function buildArbitrationAttachmentObjectStorageDirectives(args: {
  storagePolicyKey: string;
  bucketKey: string | null;
  evidenceKind?: ArbitrationEvidenceView["kind"] | null;
  preparedUploadExpiresAt?: Date | null;
  retentionExpiresAt?: Date | null;
  cleanupRequestedAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedSizeBytes?: number | null;
  state: "prepared" | "uploaded" | "cleanup_requested" | "archived";
}) {
  const policy = resolveArbitrationEvidenceStoragePolicy(args.evidenceKind ?? null, args.storagePolicyKey);
  const metadata = {
    "policy-key": policy.key,
    "bucket-key": args.bucketKey ?? policy.bucketKey ?? "",
    "cleanup-mode": policy.cleanupMode,
    "retention-days": String(policy.retentionDays),
    "evidence-kind": args.evidenceKind ?? "",
    "prepared-upload-expires-at": args.preparedUploadExpiresAt?.toISOString() ?? "",
    "retention-expires-at": args.retentionExpiresAt?.toISOString() ?? "",
    "cleanup-requested-at": args.cleanupRequestedAt?.toISOString() ?? "",
    "verified-at": args.verifiedAt?.toISOString() ?? "",
    "verified-size-bytes":
      typeof args.verifiedSizeBytes === "number" && Number.isFinite(args.verifiedSizeBytes)
        ? String(args.verifiedSizeBytes)
        : "",
    state: args.state,
  };
  const tags = {
    nl_policy: policy.key,
    nl_bucket: args.bucketKey ?? policy.bucketKey ?? "default",
    nl_cleanup_mode: policy.cleanupMode,
    nl_retention_days: policy.retentionDays,
    nl_state: args.state,
    nl_prepare_exp_epoch:
      args.preparedUploadExpiresAt ? Math.floor(args.preparedUploadExpiresAt.getTime() / 1000) : undefined,
    nl_retention_exp_epoch:
      args.retentionExpiresAt ? Math.floor(args.retentionExpiresAt.getTime() / 1000) : undefined,
    nl_cleanup_requested_epoch:
      args.cleanupRequestedAt ? Math.floor(args.cleanupRequestedAt.getTime() / 1000) : undefined,
    nl_verified_epoch: args.verifiedAt ? Math.floor(args.verifiedAt.getTime() / 1000) : undefined,
    nl_verified_size_bytes:
      typeof args.verifiedSizeBytes === "number" && Number.isFinite(args.verifiedSizeBytes)
        ? args.verifiedSizeBytes
        : undefined,
  };
  return {
    metadata,
    tags,
  };
}

function joinRemoteAttachmentUrl(baseUrl: string, objectKey: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encodedPath = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizedBase}/${encodedPath}`;
}

function sanitizeFileName(input: string) {
  return input.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "attachment.bin";
}

async function ensureArbitrationAttachmentDirectory(caseId: string, evidenceId: string) {
  const directory = path.join(getArbitrationAttachmentStorageRoot(), caseId, evidenceId);
  await mkdir(directory, { recursive: true });
  return directory;
}

function normalizeAttachmentUpload(input: UploadArbitrationEvidenceAttachmentInput) {
  const fileName = sanitizeFileName(input.fileName.trim());
  const contentType = input.contentType.trim().toLowerCase();
  if (!fileName) {
    throw new ConflictError("Attachment filename is required");
  }
  if (!contentType || !env.arbitrationEvidenceAllowedContentTypes.includes(contentType)) {
    throw new ConflictError("Attachment content type is not allowed");
  }
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.base64Content, "base64");
  } catch {
    throw new ConflictError("Attachment payload is not valid base64");
  }
  if (buffer.length === 0) {
    throw new ConflictError("Attachment payload is empty");
  }
  if (buffer.length > env.arbitrationEvidenceMaxBytes) {
    throw new ConflictError("Attachment exceeds the configured size limit");
  }
  return {
    fileName,
    contentType,
    buffer,
  };
}

function normalizeAttachmentPrepareInput(input: PrepareArbitrationEvidenceAttachmentUploadInput) {
  const fileName = sanitizeFileName(input.fileName.trim());
  const contentType = input.contentType.trim().toLowerCase();
  const sizeBytes = Math.max(0, Math.floor(input.sizeBytes));
  if (!fileName) {
    throw new ConflictError("Attachment filename is required");
  }
  if (!contentType || !env.arbitrationEvidenceAllowedContentTypes.includes(contentType)) {
    throw new ConflictError("Attachment content type is not allowed");
  }
  if (sizeBytes <= 0) {
    throw new ConflictError("Attachment size must be greater than zero");
  }
  if (sizeBytes > env.arbitrationEvidenceMaxBytes) {
    throw new ConflictError("Attachment exceeds the configured size limit");
  }
  return {
    fileName,
    contentType,
    sizeBytes,
  };
}

function isPlatformOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

function isCaseParticipant(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "requesterUserId" | "respondentUserId">,
) {
  return row.requesterUserId === userId || row.respondentUserId === userId;
}

function canViewCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "requesterUserId" | "respondentUserId">,
) {
  return isPlatformOperator(userId) || isCaseParticipant(userId, row);
}

function canAddEvidence(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "requesterUserId" | "respondentUserId">,
) {
  return ["open", "under_review"].includes(row.status) && canViewCase(userId, row);
}

function canClaimCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "assignedOperatorUserId">,
) {
  return isPlatformOperator(userId) && ["open", "under_review"].includes(row.status) && !row.assignedOperatorUserId;
}

function canReleaseCase(
  userId: string,
  row: Pick<typeof arbitrationCases.$inferSelect, "status" | "assignedOperatorUserId">,
) {
  return isPlatformOperator(userId) && ["open", "under_review"].includes(row.status) && Boolean(row.assignedOperatorUserId);
}

function isStaleClaim(claimedAt: Date | null, referenceTime: Date) {
  const claimAgeHours = getClaimAgeHours(claimedAt, referenceTime);
  return claimAgeHours !== null && claimAgeHours >= env.arbitrationStaleClaimHours;
}

function getViewerReputationImpact(args: {
  actorUserId: string;
  task:
    | {
        creatorUserId: string;
        assignedUserId: string | null;
      }
    | null;
  taskResolutionAction: ArbitrationTaskResolutionAction | null;
  status: ArbitrationStatus;
  effectsAppliedAt: Date | null;
}): "favorable" | "unfavorable" | "neutral" {
  if (!args.task || args.status !== "resolved" || !args.effectsAppliedAt) {
    return "neutral";
  }

  if (args.taskResolutionAction === "accept") {
    if (args.task.assignedUserId === args.actorUserId) return "favorable";
    if (args.task.creatorUserId === args.actorUserId) return "unfavorable";
  }

  if (args.taskResolutionAction === "default") {
    if (args.task.creatorUserId === args.actorUserId) return "favorable";
    if (args.task.assignedUserId === args.actorUserId) return "unfavorable";
  }

  return "neutral";
}

function toArbitrationEvidenceAttachmentView(
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

function toRemoteAttachmentCleanupCandidateView(args: {
  attachment: typeof arbitrationEvidenceAttachments.$inferSelect;
  caseStatus: ArbitrationStatus;
  referenceTime: Date;
}): ArbitrationRemoteAttachmentCleanupCandidateView {
  const hoursPastRetention =
    args.attachment.retentionExpiresAt && !args.attachment.archivedAt
      ? Math.max(
          0,
          Math.floor((args.referenceTime.getTime() - args.attachment.retentionExpiresAt.getTime()) / (60 * 60 * 1000)),
        )
      : null;

  const policy = resolveArbitrationEvidenceStoragePolicy(null, args.attachment.storagePolicyKey ?? null);
  return {
    attachmentId: args.attachment.id,
    caseId: args.attachment.caseId,
    evidenceId: args.attachment.evidenceId,
    fileName: args.attachment.fileName,
    caseStatus: args.caseStatus,
    storagePolicyKey: args.attachment.storagePolicyKey,
    bucketKey: args.attachment.bucketKey,
    retentionExpiresAt: args.attachment.retentionExpiresAt ? args.attachment.retentionExpiresAt.toISOString() : null,
    cleanupRequestedAt: args.attachment.cleanupRequestedAt ? args.attachment.cleanupRequestedAt.toISOString() : null,
    cleanupAttemptCount: args.attachment.cleanupAttemptCount,
    lastCleanupAttemptAt: args.attachment.lastCleanupAttemptAt ? args.attachment.lastCleanupAttemptAt.toISOString() : null,
    lastCleanupError: args.attachment.lastCleanupError,
    nextCleanupAttemptAt: args.attachment.nextCleanupAttemptAt ? args.attachment.nextCleanupAttemptAt.toISOString() : null,
    cleanupExhausted: args.attachment.cleanupAttemptCount >= policy.cleanupMaxAttempts,
    archivedAt: args.attachment.archivedAt ? args.attachment.archivedAt.toISOString() : null,
    hoursPastRetention,
    createdAt: args.attachment.createdAt.toISOString(),
  };
}

async function storeRemoteArbitrationAttachment(args: {
  objectKey: string;
  contentType: string;
  buffer: Buffer;
  bucketKey: string | null;
  storagePolicyKey: string;
  evidenceKind?: ArbitrationEvidenceView["kind"] | null;
}) {
  const storageDirectives = buildArbitrationAttachmentObjectStorageDirectives({
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    evidenceKind: args.evidenceKind ?? null,
    state: "uploaded",
  });
  if (env.objectStorageDriver === "s3-compatible") {
    const result = await putObject({
      objectKey: args.objectKey,
      contentType: args.contentType,
      body: args.buffer,
      bucketKey: args.bucketKey,
      metadata: storageDirectives.metadata,
      tags: storageDirectives.tags,
    });
    return {
      remoteUrl: result.publicUrl,
    };
  }

  const uploadBaseUrl = env.arbitrationEvidenceRemoteUploadBaseUrl ?? env.arbitrationEvidenceRemoteBaseUrl;
  if (!uploadBaseUrl) {
    throw new ConflictError("Remote arbitration evidence storage is not configured");
  }

  const uploadUrl = joinRemoteAttachmentUrl(uploadBaseUrl, args.objectKey);
  const { response } = await requestInternalText(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        "content-type": args.contentType,
        ...(env.arbitrationEvidenceRemoteAuthToken
          ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
          : {}),
      },
      body: args.buffer,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment upload timed out",
    },
  );
  if (!response.ok) {
    throw new ConflictError(`Remote arbitration attachment upload failed with status ${response.status}`);
  }

  return {
    remoteUrl: env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : uploadUrl,
  };
}

async function buildPreparedRemoteAttachmentUploadPlan(args: {
  attachmentId: string;
  evidenceId: string;
  caseId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  objectKey: string;
  bucketKey: string | null;
  storagePolicyKey: string;
  preparedAt: Date;
}): Promise<ArbitrationEvidenceAttachmentUploadPlanView> {
  const expiresAt = getPreparedUploadExpiresAt(args.preparedAt, { policyKey: args.storagePolicyKey }).toISOString();
  const storageDirectives = buildArbitrationAttachmentObjectStorageDirectives({
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    preparedUploadExpiresAt: new Date(expiresAt),
    state: "prepared",
  });
  if (env.objectStorageDriver === "s3-compatible") {
    const signedUpload = await createSignedWriteUrl({
      objectKey: args.objectKey,
      contentType: args.contentType,
      bucketKey: args.bucketKey,
      metadata: storageDirectives.metadata,
      tags: storageDirectives.tags,
    });
    return {
      attachmentId: args.attachmentId,
      evidenceId: args.evidenceId,
      caseId: args.caseId,
      fileName: args.fileName,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      storageMode: "remote",
      uploadStrategy: "prepared_remote_put",
      storagePolicyKey: args.storagePolicyKey,
      bucketKey: args.bucketKey,
      uploadUrl: signedUpload.url,
      uploadMethod: "PUT",
      requiredHeaders: signedUpload.requiredHeaders,
      objectKey: args.objectKey,
      remoteUrl: env.objectStoragePublicBaseUrl
        ? joinRemoteAttachmentUrl(env.objectStoragePublicBaseUrl, args.objectKey)
        : null,
      expiresAt: signedUpload.expiresAt ?? expiresAt,
      completeUploadRequired: true,
    };
  }

  const uploadBaseUrl = env.arbitrationEvidenceRemoteUploadBaseUrl ?? env.arbitrationEvidenceRemoteBaseUrl;
  if (!uploadBaseUrl) {
    throw new ConflictError("Remote arbitration evidence upload target is not configured");
  }
  const uploadUrl = joinRemoteAttachmentUrl(uploadBaseUrl, args.objectKey);
  const remoteUrl = env.arbitrationEvidenceRemoteBaseUrl
    ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
    : uploadUrl;
  return {
    attachmentId: args.attachmentId,
    evidenceId: args.evidenceId,
    caseId: args.caseId,
    fileName: args.fileName,
    contentType: args.contentType,
    sizeBytes: args.sizeBytes,
    storageMode: "remote",
    uploadStrategy: "prepared_remote_put",
    storagePolicyKey: args.storagePolicyKey,
    bucketKey: args.bucketKey,
    uploadUrl,
    uploadMethod: "PUT",
    requiredHeaders: {
      "content-type": args.contentType,
      ...(env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : {}),
    },
    objectKey: args.objectKey,
    remoteUrl,
    expiresAt,
    completeUploadRequired: true,
  };
}

async function readRemoteArbitrationAttachment(args: {
  objectKey: string | null;
  remoteUrl: string | null;
  bucketKey: string | null;
}) {
  if (env.objectStorageDriver === "s3-compatible" && args.objectKey) {
    return readObject({
      objectKey: args.objectKey,
      bucketKey: args.bucketKey,
    });
  }

  const targetUrl =
    args.remoteUrl ??
    (args.objectKey && env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : null);
  if (!targetUrl) {
    throw new NotFoundError("Remote arbitration attachment URL is unavailable");
  }

  const { response, arrayBuffer } = await requestInternalArrayBuffer(
    targetUrl,
    {
      headers: env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : undefined,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment download timed out",
    },
  );
  if (!response.ok) {
    throw new NotFoundError("Remote arbitration attachment could not be fetched");
  }

  return Buffer.from(arrayBuffer);
}

async function deleteRemoteArbitrationAttachment(args: {
  objectKey: string | null;
  remoteUrl: string | null;
  bucketKey: string | null;
}) {
  if (env.objectStorageDriver === "s3-compatible" && args.objectKey) {
    await deleteObject({
      objectKey: args.objectKey,
      bucketKey: args.bucketKey,
    });
    return;
  }

  const targetUrl =
    args.remoteUrl ??
    (args.objectKey && env.arbitrationEvidenceRemoteBaseUrl
      ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, args.objectKey)
      : null);
  if (!targetUrl) {
    throw new ConflictError("Remote arbitration attachment URL is unavailable");
  }

  const { response } = await requestInternalText(
    targetUrl,
    {
      method: "DELETE",
      headers: env.arbitrationEvidenceRemoteAuthToken
        ? { authorization: `Bearer ${env.arbitrationEvidenceRemoteAuthToken}` }
        : undefined,
    },
    {
      timeoutMs: env.objectStorageFetchTimeoutMs,
      timeoutMessage: "Remote arbitration attachment cleanup timed out",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new ConflictError(`Remote arbitration attachment cleanup failed with status ${response.status}`);
  }
}

async function verifyRemoteArbitrationAttachmentUpload(args: {
  attachment: typeof arbitrationEvidenceAttachments.$inferSelect;
}) {
  if (!args.attachment.objectKey) {
    throw new ConflictError("Prepared remote arbitration attachment is missing object key");
  }

  const metadata = await getObjectMetadata({
    objectKey: args.attachment.objectKey,
    bucketKey: args.attachment.bucketKey,
  });
  if (!metadata.exists) {
    throw new ConflictError("Prepared remote arbitration attachment was not uploaded to object storage");
  }

  if (typeof metadata.sizeBytes === "number" && metadata.sizeBytes !== args.attachment.sizeBytes) {
    throw new ConflictError(
      `Prepared remote arbitration attachment size mismatch: expected ${args.attachment.sizeBytes}, got ${metadata.sizeBytes}`,
    );
  }

  const expectedContentType = args.attachment.contentType.trim().toLowerCase();
  const actualContentType = metadata.contentType?.trim().toLowerCase() ?? null;
  if (actualContentType && actualContentType !== expectedContentType) {
    throw new ConflictError(
      `Prepared remote arbitration attachment content type mismatch: expected ${args.attachment.contentType}, got ${metadata.contentType}`,
    );
  }

  return metadata;
}

function toArbitrationEvidenceView(
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

function toArbitrationReviewRoundView(
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

function toArbitrationCaseView(args: {
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

function assertStatusTransition(current: ArbitrationStatus, next: Exclude<ArbitrationStatus, "open">) {
  if (current === "open" && next === "under_review") return;
  if (current === "under_review" && ["resolved", "rejected"].includes(next)) return;
  throw new ConflictError(`Cannot move arbitration case from ${current} to ${next}`);
}

function resolveTaskResolutionAction(
  input: UpdateArbitrationCaseStatusInput,
): ArbitrationTaskResolutionAction | null {
  if (input.status !== "resolved") return null;
  return input.taskResolutionAction ?? "none";
}

function getOpenReviewRound(rows: Array<typeof arbitrationCaseReviewRounds.$inferSelect>) {
  return rows.find((row) => row.status === "open") ?? null;
}

function assertHttpUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConflictError("Evidence URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ConflictError("Evidence URL must use http or https");
  }
}

function normalizeEvidenceInput(input: CreateArbitrationEvidenceInput) {
  const title = input.title.trim();
  const content = input.content?.trim() || null;
  const url = input.url?.trim() || null;

  if (!title) {
    throw new ConflictError("Evidence title is required");
  }

  if (["external_link", "screenshot_ref"].includes(input.kind) && !url) {
    throw new ConflictError("This evidence kind requires a URL");
  }

  if (["text_note", "log_excerpt"].includes(input.kind) && !content) {
    throw new ConflictError("This evidence kind requires textual content");
  }

  if (!content && !url) {
    throw new ConflictError("Evidence requires content or URL");
  }

  if (url) {
    assertHttpUrl(url);
  }

  return {
    kind: input.kind,
    title,
    content,
    url,
  };
}

async function loadVisibleArbitrationCaseOrThrow(userId: string, caseId: string): Promise<ArbitrationCaseView> {
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
  const [taskEntries, evidenceRows, reviewRoundRows] = await Promise.all([
    Promise.all(
      taskIds.map(async (taskId) => {
        const task = await getTaskById(taskId);
        return [taskId, task] as const;
      }),
    ),
    listArbitrationCaseEvidencesByCaseIds(rows.map((row) => row.id)),
    listArbitrationReviewRoundsByCaseIds(rows.map((row) => row.id)),
  ]);
  const attachmentRows = await listArbitrationEvidenceAttachmentsByEvidenceIds(evidenceRows.map((row) => row.id));
  const taskMap = new Map(taskEntries);
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

export async function getVisibleArbitrationCaseSummary(userId: string): Promise<ArbitrationCaseSummaryView> {
  const cases = await listVisibleArbitrationCases(userId);
  return buildArbitrationCaseSummary(
    cases.map((arbitrationCase) => ({
      entityType: arbitrationCase.entityType,
      status: arbitrationCase.status,
      taskResolutionAction: arbitrationCase.taskResolutionAction,
      reputationImpactForViewer: arbitrationCase.reputationImpactForViewer,
      effectsAppliedAt: arbitrationCase.effectsAppliedAt,
      evidences: arbitrationCase.evidences,
      assignedOperatorUserId: arbitrationCase.assignedOperatorUserId,
    })),
  );
}

export async function getArbitrationCaseWorkload(userId: string): Promise<ArbitrationWorkloadView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can view arbitration workload");
  }

  const cases = await listVisibleArbitrationCases(userId);
  const referenceTime = now();
  const byAssignee = new Map<
    string,
    {
      claimedCount: number;
      openRoundCount: number;
      totalClaimAgeHours: number;
      claimAgeSamples: number;
      staleClaimCount: number;
    }
  >();
  const byRoundAssignee = new Map<
    string,
    {
      openRoundCount: number;
      staleRoundCount: number;
      totalRoundAgeHours: number;
      roundAgeSamples: number;
    }
  >();
  const byStatus = new Map<string, number>();
  const byReviewRoundStatus = new Map<string, number>();
  const byRoundAgeBucket = new Map<string, number>();

  let claimedCount = 0;
  let unclaimedCount = 0;
  let unassignedOpenRoundCount = 0;
  let staleClaimedCount = 0;
  let staleRoundCount = 0;
  let oldestStaleRoundAgeHours: number | null = null;
  let mineCount = 0;
  let nextClaimCandidate: ArbitrationWorkloadView["nextClaimCandidate"] = null;

  for (const arbitrationCase of cases) {
    byStatus.set(arbitrationCase.status, (byStatus.get(arbitrationCase.status) ?? 0) + 1);
    for (const round of arbitrationCase.reviewRounds) {
      byReviewRoundStatus.set(round.status, (byReviewRoundStatus.get(round.status) ?? 0) + 1);
      if (round.status === "open" && typeof round.roundAgeHours === "number") {
        const roundAssigneeKey = round.assignedOperatorUserId ?? "unassigned";
        const bucket = byRoundAssignee.get(roundAssigneeKey) ?? {
          openRoundCount: 0,
          staleRoundCount: 0,
          totalRoundAgeHours: 0,
          roundAgeSamples: 0,
        };
        bucket.openRoundCount += 1;
        bucket.totalRoundAgeHours += round.roundAgeHours;
        bucket.roundAgeSamples += 1;
        if (round.isRoundStale) {
          bucket.staleRoundCount += 1;
        }
        byRoundAssignee.set(roundAssigneeKey, bucket);
        if (!round.assignedOperatorUserId) {
          unassignedOpenRoundCount += 1;
        }
        const roundPolicy = getArbitrationReviewRoundPolicy(round.roundNumber);
        const roundAgeBucket = getArbitrationRoundAgeBucket(round.roundAgeHours, roundPolicy.staleHours);
        byRoundAgeBucket.set(roundAgeBucket, (byRoundAgeBucket.get(roundAgeBucket) ?? 0) + 1);
      }
      if (round.isRoundStale) {
        staleRoundCount += 1;
        if (typeof round.roundAgeHours === "number") {
          oldestStaleRoundAgeHours =
            oldestStaleRoundAgeHours === null ? round.roundAgeHours : Math.max(oldestStaleRoundAgeHours, round.roundAgeHours);
        }
      }
    }

    if (arbitrationCase.assignedOperatorUserId) {
      claimedCount += 1;
      if (arbitrationCase.assignedOperatorUserId === userId) {
        mineCount += 1;
      }
      const claimAgeHours = arbitrationCase.claimAgeHours ?? 0;
      const stale = arbitrationCase.isStaleClaim;
      if (stale) staleClaimedCount += 1;
      const bucket = byAssignee.get(arbitrationCase.assignedOperatorUserId) ?? {
        claimedCount: 0,
        openRoundCount: 0,
        totalClaimAgeHours: 0,
        claimAgeSamples: 0,
        staleClaimCount: 0,
      };
      bucket.claimedCount += 1;
      bucket.openRoundCount += arbitrationCase.reviewRounds.filter((round) => round.status === "open").length;
      bucket.totalClaimAgeHours += claimAgeHours;
      bucket.claimAgeSamples += 1;
      if (stale) bucket.staleClaimCount += 1;
      byAssignee.set(arbitrationCase.assignedOperatorUserId, bucket);
      continue;
    }

    unclaimedCount += 1;
    const candidate = {
      caseId: arbitrationCase.id,
      status: arbitrationCase.status,
      currentReviewRoundNumber: arbitrationCase.currentReviewRoundNumber,
      evidenceCount: arbitrationCase.evidences.length,
      createdAt: arbitrationCase.createdAt,
    };
    if (!nextClaimCandidate) {
      nextClaimCandidate = candidate;
      continue;
    }
    const statusRank = (value: ArbitrationStatus) => (value === "under_review" ? 2 : value === "open" ? 1 : 0);
    const left = nextClaimCandidate;
    const right = candidate;
    if (statusRank(right.status) > statusRank(left.status)) {
      nextClaimCandidate = right;
      continue;
    }
    if (statusRank(right.status) === statusRank(left.status)) {
      if (right.currentReviewRoundNumber > left.currentReviewRoundNumber) {
        nextClaimCandidate = right;
        continue;
      }
      if (right.currentReviewRoundNumber === left.currentReviewRoundNumber) {
        if (right.evidenceCount > left.evidenceCount) {
          nextClaimCandidate = right;
          continue;
        }
        if (right.evidenceCount === left.evidenceCount && new Date(right.createdAt).getTime() < new Date(left.createdAt).getTime()) {
          nextClaimCandidate = right;
        }
      }
    }
  }

  for (const operatorId of env.platformOperatorUserIds) {
    if (!byAssignee.has(operatorId)) {
      byAssignee.set(operatorId, {
        claimedCount: 0,
        openRoundCount: 0,
        totalClaimAgeHours: 0,
        claimAgeSamples: 0,
        staleClaimCount: 0,
      });
    }
    if (!byRoundAssignee.has(operatorId)) {
      byRoundAssignee.set(operatorId, {
        openRoundCount: 0,
        staleRoundCount: 0,
        totalRoundAgeHours: 0,
        roundAgeSamples: 0,
      });
    }
  }

  const byAssigneeBuckets = Array.from(byAssignee.entries())
    .map(([key, value]) => ({
      key,
      claimedCount: value.claimedCount,
      openRoundCount: value.openRoundCount,
      avgClaimAgeHours: value.claimAgeSamples > 0 ? Number((value.totalClaimAgeHours / value.claimAgeSamples).toFixed(1)) : null,
      staleClaimCount: value.staleClaimCount,
    }))
    .sort((left, right) => right.claimedCount - left.claimedCount || left.key.localeCompare(right.key));
  const byRoundAssigneeBuckets = Array.from(byRoundAssignee.entries())
    .map(([key, value]) => ({
      key,
      openRoundCount: value.openRoundCount,
      staleRoundCount: value.staleRoundCount,
      avgRoundAgeHours: value.roundAgeSamples > 0 ? Number((value.totalRoundAgeHours / value.roundAgeSamples).toFixed(1)) : null,
    }))
    .sort((left, right) => right.openRoundCount - left.openRoundCount || left.key.localeCompare(right.key));

  const recommendedAssigneeUserId =
    [...byAssigneeBuckets]
      .sort((left, right) => {
        const staleDiff = left.staleClaimCount - right.staleClaimCount;
        if (staleDiff !== 0) return staleDiff;
        const claimedDiff = left.claimedCount - right.claimedCount;
        if (claimedDiff !== 0) return claimedDiff;
        const roundDiff = left.openRoundCount - right.openRoundCount;
        if (roundDiff !== 0) return roundDiff;
        return left.key.localeCompare(right.key);
      })[0]?.key ?? null;

  return {
    claimedCount,
    unclaimedCount,
    unassignedOpenRoundCount,
    staleClaimedCount,
    staleRoundCount,
    oldestStaleRoundAgeHours,
    mineCount,
    byAssignee: byAssigneeBuckets,
    byRoundAssignee: byRoundAssigneeBuckets,
    byRoundAgeBucket: Array.from(byRoundAgeBucket.entries()).map(([key, count]) => ({ key, count })),
    byStatus: Array.from(byStatus.entries()).map(([key, count]) => ({ key, count })),
    byReviewRoundStatus: Array.from(byReviewRoundStatus.entries()).map(([key, count]) => ({ key, count })),
    nextClaimCandidate,
    recommendedAssigneeUserId,
    autoReleaseEnabled: env.arbitrationStaleClaimHours > 0,
    autoReleaseIntervalMinutes: null,
  };
}

export async function createArbitrationCase(
  userId: string,
  input: CreateArbitrationCaseInput,
): Promise<ArbitrationCaseView> {
  if (input.entityType !== "task") {
    throw new ConflictError("Only task arbitration is supported in the current phase");
  }

  const task = await getTaskById(input.entityId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  if (!task.assignedUserId) {
    throw new ConflictError("Task has no assignee and cannot enter arbitration");
  }
  if (![task.creatorUserId, task.assignedUserId].includes(userId)) {
    throw new UnauthorizedError("Only task participants can create arbitration cases");
  }
  if (!["in_progress", "submitted", "accepted", "defaulted", "cancelled"].includes(task.status)) {
    throw new ConflictError("Current task status does not support arbitration");
  }

  const respondentUserId = task.creatorUserId === userId ? task.assignedUserId : task.creatorUserId;
  let createdCaseId = "";
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from arbitration_cases where entity_type = ${"task"} and entity_id = ${task.id} for update`);
      const existingActiveCases = await tx
        .select()
        .from(arbitrationCases)
        .where(
          and(
            eq(arbitrationCases.entityType, "task"),
            eq(arbitrationCases.entityId, task.id),
            inArray(arbitrationCases.status, ["open", "under_review"]),
          ),
        );
      if (existingActiveCases.length > 0) {
        throw new ConflictError("An active arbitration case already exists for this task");
      }

      const timestamp = now();
      const [created] = await tx
        .insert(arbitrationCases)
        .values({
          id: crypto.randomUUID(),
          entityType: "task",
          entityId: task.id,
          requesterUserId: userId,
          respondentUserId,
          status: "open",
          reason: input.reason,
          evidenceSummary: input.evidenceSummary ?? null,
          resolutionSummary: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          resolvedAt: null,
        })
        .returning();

      createdCaseId = created.id;

      await tx.insert(arbitrationCaseReviewRounds).values({
        id: crypto.randomUUID(),
        caseId: created.id,
        roundNumber: 1,
        status: "open",
        summary: "案件创建后进入首轮审理。",
        assignedOperatorUserId: null,
        startedByUserId: null,
        endedByUserId: null,
        startedAt: timestamp,
        endedAt: null,
      });

      const summaryContent = input.evidenceSummary?.trim();
      if (summaryContent) {
        await tx.insert(arbitrationCaseEvidences).values({
          id: crypto.randomUUID(),
          caseId: created.id,
          creatorUserId: userId,
          kind: "text_note",
          title: "建案证据摘要",
          content: summaryContent,
          url: null,
          createdAt: timestamp,
        });
      }

      await enqueueOutboxEvent(
        "arbitration.created",
        {
          caseId: created.id,
          entityType: created.entityType,
          entityId: created.entityId,
          requesterUserId: created.requesterUserId,
          respondentUserId: created.respondentUserId,
        },
        tx,
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("An active arbitration case already exists for this task");
    }
    throw error;
  }

  return loadVisibleArbitrationCaseOrThrow(userId, createdCaseId);
}

export async function addArbitrationEvidence(
  userId: string,
  caseId: string,
  input: CreateArbitrationEvidenceInput,
): Promise<ArbitrationCaseView> {
  const arbitrationCase = await getArbitrationCaseById(caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("Only case participants or platform operators can add evidence");
  }
  if (!["open", "under_review"].includes(arbitrationCase.status)) {
    throw new ConflictError("Evidence can only be added before the case is closed");
  }

  const evidence = normalizeEvidenceInput(input);

  await db.transaction(async (tx) => {
    const timestamp = now();
    const [created] = await tx
      .insert(arbitrationCaseEvidences)
      .values({
        id: crypto.randomUUID(),
        caseId,
        creatorUserId: userId,
        kind: evidence.kind,
        title: evidence.title,
        content: evidence.content,
        url: evidence.url,
        createdAt: timestamp,
      })
      .returning();

    await tx
      .update(arbitrationCases)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, caseId));

    await enqueueOutboxEvent(
      "arbitration.evidenceAdded",
      {
        caseId,
        evidenceId: created.id,
        actorUserId: userId,
        kind: created.kind,
        title: created.title,
      },
      tx,
    );
  });

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function prepareArbitrationEvidenceAttachmentUpload(
  userId: string,
  evidenceId: string,
  input: PrepareArbitrationEvidenceAttachmentUploadInput,
): Promise<{ case: ArbitrationCaseView; upload: ArbitrationEvidenceAttachmentUploadPlanView }> {
  if (env.arbitrationEvidenceStorageMode !== "remote") {
    throw new ConflictError("Prepared upload plans are only available when arbitration evidence storage is remote");
  }
  if (env.arbitrationEvidenceRemoteUploadStrategy !== "prepared_remote_put") {
    throw new ConflictError("Current arbitration evidence upload strategy does not support prepared upload plans");
  }

  const evidence = await getArbitrationEvidenceById(evidenceId);
  if (!evidence) {
    throw new NotFoundError("Arbitration evidence not found");
  }

  const arbitrationCase = await getArbitrationCaseById(evidence.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("Only case participants or platform operators can prepare evidence uploads");
  }
  if (!["open", "under_review"].includes(arbitrationCase.status)) {
    throw new ConflictError("Evidence attachments can only be prepared before the case is closed");
  }

  const attachment = normalizeAttachmentPrepareInput(input);
  const timestamp = now();
  const storagePolicy = resolveArbitrationEvidenceStoragePolicy(evidence.kind as ArbitrationEvidenceView["kind"]);
  const preparedUploadExpiresAt = getPreparedUploadExpiresAt(timestamp, {
    evidenceKind: evidence.kind as ArbitrationEvidenceView["kind"],
    policyKey: storagePolicy.key,
  });
  const attachmentId = crypto.randomUUID();
  const objectKey = buildRemoteAttachmentObjectKey(arbitrationCase.id, evidence.id, attachmentId, attachment.fileName);
  const uploadPlan = await buildPreparedRemoteAttachmentUploadPlan({
    attachmentId,
    evidenceId: evidence.id,
    caseId: arbitrationCase.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    objectKey,
    bucketKey: storagePolicy.bucketKey,
    storagePolicyKey: storagePolicy.key,
    preparedAt: timestamp,
  });

  await db.transaction(async (tx) => {
    await tx.insert(arbitrationEvidenceAttachments).values({
      id: attachmentId,
      evidenceId: evidence.id,
      caseId: arbitrationCase.id,
      uploaderUserId: userId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      storageMode: "remote",
      uploadState: "prepared",
      storagePolicyKey: storagePolicy.key,
      bucketKey: storagePolicy.bucketKey,
      objectKey,
      remoteUrl: uploadPlan.remoteUrl,
      storagePath: objectKey,
      uploadPreparedAt: timestamp,
      preparedUploadExpiresAt,
      uploadCompletedAt: null,
      verifiedAt: null,
      verifiedSizeBytes: null,
      verifiedContentType: null,
      retentionExpiresAt: null,
      cleanupRequestedAt: null,
      cleanupAttemptCount: 0,
      lastCleanupAttemptAt: null,
      lastCleanupError: null,
      nextCleanupAttemptAt: null,
      createdAt: timestamp,
    });

    await tx
      .update(arbitrationCases)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, arbitrationCase.id));
  });

  return {
    case: await loadVisibleArbitrationCaseOrThrow(userId, arbitrationCase.id),
    upload: uploadPlan,
  };
}

export async function completeArbitrationEvidenceAttachmentUpload(
  userId: string,
  attachmentId: string,
): Promise<ArbitrationCaseView> {
  const attachment = await getArbitrationEvidenceAttachmentById(attachmentId);
  if (!attachment) {
    throw new NotFoundError("Arbitration evidence attachment not found");
  }
  const arbitrationCase = await getArbitrationCaseById(attachment.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("You do not have access to this arbitration attachment");
  }
  if (!["open", "under_review"].includes(arbitrationCase.status)) {
    throw new ConflictError("Evidence attachments can only be completed before the case is closed");
  }
  if (attachment.storageMode !== "remote") {
    throw new ConflictError("Only remote arbitration attachments support completion");
  }
  if (attachment.archivedAt) {
    throw new ConflictError("This arbitration attachment has already been archived");
  }
  if (attachment.uploadState === "uploaded") {
    return loadVisibleArbitrationCaseOrThrow(userId, arbitrationCase.id);
  }
  if (attachment.uploadState !== "prepared") {
    throw new ConflictError("Arbitration attachment is not awaiting upload completion");
  }
  if (
    (attachment.preparedUploadExpiresAt && attachment.preparedUploadExpiresAt.getTime() < now().getTime()) ||
    (!attachment.preparedUploadExpiresAt &&
      attachment.uploadPreparedAt &&
      attachment.uploadPreparedAt.getTime() + env.arbitrationEvidenceUploadPlanTtlSeconds * 1000 < now().getTime())
  ) {
    throw new ConflictError("Prepared upload has expired and must be regenerated");
  }

  const timestamp = now();
  const verifiedMetadata = await verifyRemoteArbitrationAttachmentUpload({
    attachment,
  });
  if (attachment.objectKey) {
    const uploadedDirectives = buildArbitrationAttachmentObjectStorageDirectives({
      storagePolicyKey: attachment.storagePolicyKey ?? "default",
      bucketKey: attachment.bucketKey,
      preparedUploadExpiresAt: attachment.preparedUploadExpiresAt,
      verifiedAt: timestamp,
      verifiedSizeBytes: verifiedMetadata.sizeBytes,
      state: "uploaded",
    });
    await setObjectTags({
      objectKey: attachment.objectKey,
      bucketKey: attachment.bucketKey,
      tags: uploadedDirectives.tags,
    });
  }
  await db.transaction(async (tx) => {
    await tx
      .update(arbitrationEvidenceAttachments)
      .set({
        uploadState: "uploaded",
        uploadCompletedAt: timestamp,
        verifiedAt: timestamp,
        verifiedSizeBytes: verifiedMetadata.sizeBytes,
        verifiedContentType: verifiedMetadata.contentType ?? attachment.contentType,
        preparedUploadExpiresAt:
          attachment.preparedUploadExpiresAt ??
          getPreparedUploadExpiresAt(timestamp, { policyKey: attachment.storagePolicyKey }),
        remoteUrl:
          attachment.remoteUrl ??
          (attachment.objectKey && env.arbitrationEvidenceRemoteBaseUrl
            ? joinRemoteAttachmentUrl(env.arbitrationEvidenceRemoteBaseUrl, attachment.objectKey)
            : null),
      })
      .where(eq(arbitrationEvidenceAttachments.id, attachment.id));

    await tx
      .update(arbitrationCases)
      .set({
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, arbitrationCase.id));

    await enqueueOutboxEvent(
      "arbitration.evidenceAdded",
      {
        caseId: arbitrationCase.id,
        evidenceId: attachment.evidenceId,
        attachmentId: attachment.id,
        actorUserId: userId,
        title: attachment.fileName,
      },
      tx,
    );
  });

  return loadVisibleArbitrationCaseOrThrow(userId, arbitrationCase.id);
}

export async function addArbitrationEvidenceAttachment(
  userId: string,
  evidenceId: string,
  input: UploadArbitrationEvidenceAttachmentInput,
): Promise<ArbitrationCaseView> {
  const evidence = await getArbitrationEvidenceById(evidenceId);
  if (!evidence) {
    throw new NotFoundError("Arbitration evidence not found");
  }

  const arbitrationCase = await getArbitrationCaseById(evidence.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("Only case participants or platform operators can add evidence attachments");
  }
  if (!["open", "under_review"].includes(arbitrationCase.status)) {
    throw new ConflictError("Evidence attachments can only be added before the case is closed");
  }

  const attachment = normalizeAttachmentUpload(input);
  const timestamp = now();
  const attachmentId = crypto.randomUUID();
  let storagePath = "";
  let storageMode: "local" | "remote" = "local";
  let objectKey: string | null = null;
  let remoteUrl: string | null = null;
  let retentionExpiresAt: Date | null = null;
  let storagePolicyKey: string | null = null;
  let bucketKey: string | null = null;

  if (env.arbitrationEvidenceStorageMode === "remote") {
    const storagePolicy = resolveArbitrationEvidenceStoragePolicy(evidence.kind as ArbitrationEvidenceView["kind"]);
    objectKey = buildRemoteAttachmentObjectKey(arbitrationCase.id, evidence.id, attachmentId, attachment.fileName);
    const remoteStorage = await storeRemoteArbitrationAttachment({
      objectKey,
      contentType: attachment.contentType,
      buffer: attachment.buffer,
      bucketKey: storagePolicy.bucketKey,
      storagePolicyKey: storagePolicy.key,
      evidenceKind: evidence.kind as ArbitrationEvidenceView["kind"],
    });
    storageMode = "remote";
    storagePolicyKey = storagePolicy.key;
    bucketKey = storagePolicy.bucketKey;
    storagePath = objectKey;
    remoteUrl = remoteStorage.remoteUrl;
  } else {
    const directory = await ensureArbitrationAttachmentDirectory(arbitrationCase.id, evidence.id);
    storagePath = path.join(directory, `${attachmentId}-${attachment.fileName}`);
    await writeFile(storagePath, attachment.buffer);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(arbitrationEvidenceAttachments).values({
        id: attachmentId,
        evidenceId: evidence.id,
        caseId: arbitrationCase.id,
        uploaderUserId: userId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        sizeBytes: attachment.buffer.byteLength,
        storageMode,
        uploadState: "uploaded",
        storagePolicyKey,
        bucketKey,
        objectKey,
        remoteUrl,
        storagePath,
        uploadPreparedAt: storageMode === "remote" ? timestamp : null,
        preparedUploadExpiresAt: null,
        uploadCompletedAt: timestamp,
        verifiedAt: storageMode === "remote" ? timestamp : null,
        verifiedSizeBytes: storageMode === "remote" ? attachment.buffer.byteLength : null,
        verifiedContentType: storageMode === "remote" ? attachment.contentType : null,
        retentionExpiresAt,
        cleanupAttemptCount: 0,
        lastCleanupAttemptAt: null,
        lastCleanupError: null,
        nextCleanupAttemptAt: null,
        createdAt: timestamp,
      });

      await tx
        .update(arbitrationCases)
        .set({
          updatedAt: timestamp,
        })
        .where(eq(arbitrationCases.id, arbitrationCase.id));

      await enqueueOutboxEvent(
        "arbitration.evidenceAdded",
        {
          caseId: arbitrationCase.id,
          evidenceId: evidence.id,
          attachmentId,
          actorUserId: userId,
          title: evidence.title,
        },
        tx,
      );
    });
  } catch (error) {
    if (storageMode === "local") {
      await unlink(storagePath).catch(() => undefined);
    }
    throw error;
  }

  return loadVisibleArbitrationCaseOrThrow(userId, arbitrationCase.id);
}

export async function getArbitrationEvidenceAttachmentContent(
  userId: string,
  attachmentId: string,
): Promise<{
  fileName: string;
  contentType: string;
  content: Buffer;
}> {
  const attachment = await getArbitrationEvidenceAttachmentById(attachmentId);
  if (!attachment) {
    throw new NotFoundError("Arbitration evidence attachment not found");
  }
  const arbitrationCase = await getArbitrationCaseById(attachment.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("You do not have access to this arbitration attachment");
  }
  if (attachment.archivedAt) {
    throw new ConflictError("This arbitration attachment has already been archived from remote storage");
  }
  if (attachment.uploadState !== "uploaded") {
    throw new ConflictError("This arbitration attachment has not completed upload yet");
  }

  const content =
    attachment.storageMode === "remote"
      ? await readRemoteArbitrationAttachment({
          objectKey: attachment.objectKey,
          remoteUrl: attachment.remoteUrl,
          bucketKey: attachment.bucketKey,
        })
      : await readFile(attachment.storagePath);
  return {
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    content,
  };
}

export async function getArbitrationEvidenceAttachmentAccess(
  userId: string,
  attachmentId: string,
): Promise<ArbitrationEvidenceAttachmentAccessView> {
  const attachment = await getArbitrationEvidenceAttachmentById(attachmentId);
  if (!attachment) {
    throw new NotFoundError("Arbitration evidence attachment not found");
  }

  const arbitrationCase = await getArbitrationCaseById(attachment.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!canViewCase(userId, arbitrationCase)) {
    throw new UnauthorizedError("You do not have access to this arbitration attachment");
  }
  if (attachment.archivedAt) {
    throw new ConflictError("This arbitration attachment has already been archived from remote storage");
  }
  if (attachment.storageMode !== "remote" || !attachment.objectKey || env.objectStorageDriver !== "s3-compatible") {
    throw new ConflictError("Direct attachment access is unavailable for the current storage mode");
  }

  const access = await createSignedReadUrl({
    objectKey: attachment.objectKey,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    bucketKey: attachment.bucketKey,
  });

  return {
    attachmentId: attachment.id,
    url: access.url,
    expiresAt: access.expiresAt,
    direct: true,
  };
}

export async function archiveArbitrationEvidenceAttachment(
  userId: string,
  attachmentId: string,
): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can archive arbitration attachments");
  }

  const attachment = await getArbitrationEvidenceAttachmentById(attachmentId);
  if (!attachment) {
    throw new NotFoundError("Arbitration evidence attachment not found");
  }
  if (attachment.storageMode !== "remote") {
    throw new ConflictError("Only remote arbitration attachments can be archived");
  }
  if (attachment.uploadState !== "uploaded") {
    throw new ConflictError("Only uploaded remote arbitration attachments can be archived");
  }
  if (attachment.archivedAt) {
    return loadVisibleArbitrationCaseOrThrow(userId, attachment.caseId);
  }

  const arbitrationCase = await getArbitrationCaseById(attachment.caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (!["resolved", "rejected"].includes(arbitrationCase.status)) {
    throw new ConflictError("Remote arbitration attachments can only be archived after the case is closed");
  }

  const shouldDeleteObject = shouldDeleteArbitrationAttachmentOnCleanup(attachment.storagePolicyKey);
  const cleanupRequestedAt = now();
  const retentionExpiresAt =
    attachment.retentionExpiresAt ?? getArbitrationRemoteRetentionExpiresAt(cleanupRequestedAt, attachment.storagePolicyKey);
  if (shouldDeleteObject) {
    await deleteRemoteArbitrationAttachment({
      objectKey: attachment.objectKey,
      remoteUrl: attachment.remoteUrl,
      bucketKey: attachment.bucketKey,
    });
  } else if (attachment.objectKey) {
    const lifecycleDirectives = buildArbitrationAttachmentObjectStorageDirectives({
      storagePolicyKey: attachment.storagePolicyKey ?? "default",
      bucketKey: attachment.bucketKey,
      retentionExpiresAt,
      cleanupRequestedAt,
      state: "cleanup_requested",
    });
    await setObjectTags({
      objectKey: attachment.objectKey,
      bucketKey: attachment.bucketKey,
      tags: lifecycleDirectives.tags,
    });
  }

  await db
    .update(arbitrationEvidenceAttachments)
    .set({
      cleanupRequestedAt,
      cleanupAttemptCount: attachment.cleanupAttemptCount + 1,
      lastCleanupAttemptAt: cleanupRequestedAt,
      lastCleanupError: null,
      nextCleanupAttemptAt: null,
      uploadState: "archived",
      archivedAt: cleanupRequestedAt,
      retentionExpiresAt,
      archiveReason: shouldDeleteObject ? "manual_remote_cleanup" : "bucket_lifecycle_cleanup",
      remoteUrl: null,
    })
    .where(eq(arbitrationEvidenceAttachments.id, attachmentId));

  return loadVisibleArbitrationCaseOrThrow(userId, attachment.caseId);
}

export async function requestArbitrationEvidenceAttachmentCleanup(
  userId: string,
  attachmentId: string,
): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can request remote arbitration attachment cleanup");
  }

  const attachment = await getArbitrationEvidenceAttachmentById(attachmentId);
  if (!attachment) {
    throw new NotFoundError("Arbitration evidence attachment not found");
  }
  if (attachment.storageMode !== "remote") {
    throw new ConflictError("Only remote arbitration attachments can be requested for cleanup");
  }
  if (attachment.uploadState !== "uploaded") {
    throw new ConflictError("Only uploaded remote arbitration attachments can be requested for cleanup");
  }
  if (attachment.archivedAt) {
    return loadVisibleArbitrationCaseOrThrow(userId, attachment.caseId);
  }

  await db
    .update(arbitrationEvidenceAttachments)
    .set({
      cleanupRequestedAt: attachment.cleanupRequestedAt ?? now(),
      lastCleanupError: null,
      nextCleanupAttemptAt: now(),
    })
    .where(eq(arbitrationEvidenceAttachments.id, attachmentId));

  return loadVisibleArbitrationCaseOrThrow(userId, attachment.caseId);
}

export async function expirePreparedArbitrationEvidenceUploads(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db
    .select()
    .from(arbitrationEvidenceAttachments)
    .where(
      and(
        eq(arbitrationEvidenceAttachments.storageMode, "remote"),
        eq(arbitrationEvidenceAttachments.uploadState, "prepared"),
        sql`${arbitrationEvidenceAttachments.archivedAt} is null`,
        sql`${arbitrationEvidenceAttachments.preparedUploadExpiresAt} is not null`,
        sql`${arbitrationEvidenceAttachments.preparedUploadExpiresAt} <= ${referenceTime}`,
      ),
    )
    .orderBy(asc(arbitrationEvidenceAttachments.uploadPreparedAt), asc(arbitrationEvidenceAttachments.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    return {
      scannedCount: 0,
      expiredCount: 0,
      expiredAttachmentIds: [] as string[],
    };
  }

  const expiredIds: string[] = [];
  const failures: Array<{ attachmentId: string; message: string }> = [];

  for (const row of rows) {
    const expiredAt = now();
    try {
      let objectExists = false;
      if (row.objectKey) {
        const metadata = await getObjectMetadata({
          objectKey: row.objectKey,
          bucketKey: row.bucketKey,
        });
        objectExists = metadata.exists;
        if (objectExists) {
          const shouldDeleteObject = shouldDeleteArbitrationAttachmentOnCleanup(row.storagePolicyKey);
          if (shouldDeleteObject) {
            await deleteRemoteArbitrationAttachment({
              objectKey: row.objectKey,
              remoteUrl: row.remoteUrl,
              bucketKey: row.bucketKey,
            });
          } else {
            const lifecycleDirectives = buildArbitrationAttachmentObjectStorageDirectives({
              storagePolicyKey: row.storagePolicyKey ?? "default",
              bucketKey: row.bucketKey,
              preparedUploadExpiresAt: row.preparedUploadExpiresAt,
              retentionExpiresAt: expiredAt,
              cleanupRequestedAt: expiredAt,
              state: "archived",
            });
            await setObjectTags({
              objectKey: row.objectKey,
              bucketKey: row.bucketKey,
              tags: lifecycleDirectives.tags,
            });
          }
        }
      }

      await db
        .update(arbitrationEvidenceAttachments)
        .set({
          uploadState: "archived",
          archivedAt: expiredAt,
          archiveReason: "prepared_upload_expired",
          remoteUrl: null,
          retentionExpiresAt: objectExists ? expiredAt : null,
          cleanupRequestedAt: objectExists ? expiredAt : null,
          cleanupAttemptCount: objectExists ? row.cleanupAttemptCount + 1 : row.cleanupAttemptCount,
          lastCleanupAttemptAt: objectExists ? expiredAt : row.lastCleanupAttemptAt,
          lastCleanupError: "Prepared upload expired before completion.",
          nextCleanupAttemptAt: null,
        })
        .where(eq(arbitrationEvidenceAttachments.id, row.id));
      expiredIds.push(row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prepared upload cleanup error";
      const cleanupPolicy = resolveArbitrationEvidenceStoragePolicy(null, row.storagePolicyKey ?? null);
      const nextAttemptCount = row.cleanupAttemptCount + 1;
      await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupAttemptCount: nextAttemptCount,
          lastCleanupAttemptAt: expiredAt,
          lastCleanupError: message,
          nextCleanupAttemptAt:
            nextAttemptCount >= cleanupPolicy.cleanupMaxAttempts
              ? null
              : getNextArbitrationCleanupAttemptAt(nextAttemptCount, expiredAt, row.storagePolicyKey),
        })
        .where(eq(arbitrationEvidenceAttachments.id, row.id));
      failures.push({
        attachmentId: row.id,
        message,
      });
    }
  }

  return {
    scannedCount: rows.length,
    expiredCount: expiredIds.length,
    expiredAttachmentIds: expiredIds,
    failedCount: failures.length,
    failures,
  };
}

export async function cleanupResolvedRemoteArbitrationAttachments(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db
    .select({
      attachment: arbitrationEvidenceAttachments,
      caseStatus: arbitrationCases.status,
      resolvedAt: arbitrationCases.resolvedAt,
    })
    .from(arbitrationEvidenceAttachments)
    .innerJoin(arbitrationCases, eq(arbitrationCases.id, arbitrationEvidenceAttachments.caseId))
    .where(
      and(
        eq(arbitrationEvidenceAttachments.storageMode, "remote"),
        eq(arbitrationEvidenceAttachments.uploadState, "uploaded"),
        sql`${arbitrationEvidenceAttachments.archivedAt} is null`,
        sql`(${arbitrationEvidenceAttachments.nextCleanupAttemptAt} is null or ${arbitrationEvidenceAttachments.nextCleanupAttemptAt} <= ${referenceTime})`,
        sql`(
          ${arbitrationEvidenceAttachments.cleanupRequestedAt} is not null
          or (
            ${arbitrationCases.status} in ('resolved', 'rejected')
            and ${arbitrationCases.resolvedAt} is not null
            and ${arbitrationEvidenceAttachments.retentionExpiresAt} is not null
            and ${arbitrationEvidenceAttachments.retentionExpiresAt} <= ${referenceTime}
          )
        )`,
      ),
    )
    .orderBy(
      asc(sql`case when ${arbitrationEvidenceAttachments.cleanupRequestedAt} is null then 1 else 0 end`),
      asc(arbitrationEvidenceAttachments.cleanupRequestedAt),
      asc(arbitrationCases.resolvedAt),
      asc(arbitrationEvidenceAttachments.createdAt),
    )
    .limit(limit);

  let archivedCount = 0;
  const failures: Array<{ attachmentId: string; message: string }> = [];

  for (const row of rows) {
    const cleanupPolicy = resolveArbitrationEvidenceStoragePolicy(null, row.attachment.storagePolicyKey ?? null);
    if (row.attachment.cleanupAttemptCount >= cleanupPolicy.cleanupMaxAttempts) {
      continue;
    }
    const attemptTimestamp = now();
    try {
      const shouldDeleteObject = shouldDeleteArbitrationAttachmentOnCleanup(row.attachment.storagePolicyKey);
      if (shouldDeleteObject) {
        await deleteRemoteArbitrationAttachment({
          objectKey: row.attachment.objectKey,
          remoteUrl: row.attachment.remoteUrl,
          bucketKey: row.attachment.bucketKey,
        });
      } else if (row.attachment.objectKey) {
        const lifecycleDirectives = buildArbitrationAttachmentObjectStorageDirectives({
          storagePolicyKey: row.attachment.storagePolicyKey ?? "default",
          bucketKey: row.attachment.bucketKey,
          retentionExpiresAt:
            row.attachment.retentionExpiresAt ??
            getArbitrationRemoteRetentionExpiresAt(attemptTimestamp, row.attachment.storagePolicyKey),
          cleanupRequestedAt: row.attachment.cleanupRequestedAt ?? attemptTimestamp,
          state: "cleanup_requested",
        });
        await setObjectTags({
          objectKey: row.attachment.objectKey,
          bucketKey: row.attachment.bucketKey,
          tags: lifecycleDirectives.tags,
        });
      }
      await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupRequestedAt: row.attachment.cleanupRequestedAt ?? now(),
          cleanupAttemptCount: row.attachment.cleanupAttemptCount + 1,
          lastCleanupAttemptAt: attemptTimestamp,
          lastCleanupError: null,
          nextCleanupAttemptAt: null,
          uploadState: "archived",
          archivedAt: now(),
          retentionExpiresAt:
            row.attachment.retentionExpiresAt ??
            getArbitrationRemoteRetentionExpiresAt(now(), row.attachment.storagePolicyKey),
          archiveReason: shouldDeleteObject ? "resolved_case_cleanup" : "bucket_lifecycle_cleanup",
          remoteUrl: null,
        })
        .where(eq(arbitrationEvidenceAttachments.id, row.attachment.id));
      archivedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error";
      const nextAttemptCount = row.attachment.cleanupAttemptCount + 1;
      const cleanupPolicy = resolveArbitrationEvidenceStoragePolicy(null, row.attachment.storagePolicyKey ?? null);
      const nextCleanupAttemptAt =
        nextAttemptCount >= cleanupPolicy.cleanupMaxAttempts
          ? null
          : getNextArbitrationCleanupAttemptAt(nextAttemptCount, attemptTimestamp, row.attachment.storagePolicyKey);
      await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupAttemptCount: nextAttemptCount,
          lastCleanupAttemptAt: attemptTimestamp,
          lastCleanupError: message,
          nextCleanupAttemptAt,
        })
        .where(eq(arbitrationEvidenceAttachments.id, row.attachment.id));
      failures.push({
        attachmentId: row.attachment.id,
        message,
      });
    }
  }

  return {
    scannedCount: rows.length,
    archivedCount,
    failedCount: failures.length,
    failures,
  };
}

export async function getArbitrationRemoteAttachmentCleanupQueue(
  userId: string,
  args?: {
    limit?: number;
    policyKey?: string;
    bucketKey?: string;
    cleanupState?: "due_now" | "cleanup_requested" | "retry_waiting" | "exhausted" | "failed";
  },
): Promise<ArbitrationRemoteAttachmentCleanupQueueView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can inspect arbitration attachment cleanup queue");
  }

  const referenceTime = now();
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const fetchLimit = Math.max(limit, Math.min(limit * 5, 500));
  const clauses = [
    eq(arbitrationEvidenceAttachments.storageMode, "remote"),
    eq(arbitrationEvidenceAttachments.uploadState, "uploaded"),
    sql`${arbitrationEvidenceAttachments.archivedAt} is null`,
  ];
  if (args?.policyKey) {
    clauses.push(eq(arbitrationEvidenceAttachments.storagePolicyKey, args.policyKey));
  }
  if (typeof args?.bucketKey === "string" && args.bucketKey.trim().length > 0) {
    clauses.push(eq(arbitrationEvidenceAttachments.bucketKey, args.bucketKey.trim()));
  }
  const rows = await db
    .select({
      attachment: arbitrationEvidenceAttachments,
      caseStatus: arbitrationCases.status,
    })
    .from(arbitrationEvidenceAttachments)
    .innerJoin(arbitrationCases, eq(arbitrationCases.id, arbitrationEvidenceAttachments.caseId))
    .where(
      and(...clauses),
    )
    .orderBy(
      asc(sql`coalesce(${arbitrationEvidenceAttachments.retentionExpiresAt}, ${arbitrationEvidenceAttachments.createdAt})`),
      asc(arbitrationEvidenceAttachments.createdAt),
    )
    .limit(fetchLimit);

  const filteredRows = rows.filter((row) => {
    if (!args?.cleanupState) return true;
    return getRemoteAttachmentCleanupState({
      attachment: row.attachment,
      referenceTime,
    }) === args.cleanupState;
  });

  const byCaseStatus = new Map<string, number>();
  let dueNowCount = 0;
  let cleanupRequestedCount = 0;
  let retryWaitingCount = 0;
  let exhaustedCount = 0;
  let failedCount = 0;
  let oldestRetentionExpiresAt: Date | null = null;
  const byPolicyKey = new Map<string, number>();
  const byBucketKey = new Map<string, number>();

  for (const row of filteredRows) {
    const policy = resolveArbitrationEvidenceStoragePolicy(null, row.attachment.storagePolicyKey ?? null);
    byCaseStatus.set(row.caseStatus, (byCaseStatus.get(row.caseStatus) ?? 0) + 1);
    byPolicyKey.set(row.attachment.storagePolicyKey ?? "default", (byPolicyKey.get(row.attachment.storagePolicyKey ?? "default") ?? 0) + 1);
    byBucketKey.set(row.attachment.bucketKey ?? "default", (byBucketKey.get(row.attachment.bucketKey ?? "default") ?? 0) + 1);
    if (row.attachment.cleanupRequestedAt) {
      cleanupRequestedCount += 1;
    }
    if (row.attachment.lastCleanupError) {
      failedCount += 1;
    }
    if (row.attachment.cleanupAttemptCount >= policy.cleanupMaxAttempts) {
      exhaustedCount += 1;
    } else if (
      row.attachment.nextCleanupAttemptAt &&
      row.attachment.nextCleanupAttemptAt.getTime() > referenceTime.getTime()
    ) {
      retryWaitingCount += 1;
    }
    if (
      row.attachment.retentionExpiresAt &&
      row.attachment.retentionExpiresAt.getTime() <= referenceTime.getTime()
    ) {
      dueNowCount += 1;
      if (!oldestRetentionExpiresAt || row.attachment.retentionExpiresAt.getTime() < oldestRetentionExpiresAt.getTime()) {
        oldestRetentionExpiresAt = row.attachment.retentionExpiresAt;
      }
    }
  }

  return {
    policy: getArbitrationEvidenceStoragePolicy(),
    pendingCount: rows.length,
    dueNowCount,
    cleanupRequestedCount,
    retryWaitingCount,
    exhaustedCount,
    failedCount,
    oldestRetentionExpiresAt: oldestRetentionExpiresAt ? oldestRetentionExpiresAt.toISOString() : null,
    byCaseStatus: [...byCaseStatus.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    byPolicyKey: [...byPolicyKey.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    byBucketKey: [...byBucketKey.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    candidates: filteredRows.slice(0, limit).map((row) =>
      toRemoteAttachmentCleanupCandidateView({
        attachment: row.attachment,
        caseStatus: row.caseStatus as ArbitrationStatus,
        referenceTime,
      }),
    ),
  };
}

export async function updateArbitrationCaseStatus(
  userId: string,
  caseId: string,
  input: UpdateArbitrationCaseStatusInput,
): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can update arbitration status");
  }

  const arbitrationCase = await getArbitrationCaseById(caseId);
  if (!arbitrationCase) {
    throw new NotFoundError("Arbitration case not found");
  }
  if (arbitrationCase.assignedOperatorUserId && arbitrationCase.assignedOperatorUserId !== userId) {
    throw new ConflictError("This case is currently claimed by another operator");
  }

  assertStatusTransition(arbitrationCase.status as ArbitrationStatus, input.status);
  const lifecycleSyncCandidates: Array<{
    objectKey: string;
    bucketKey: string | null;
    storagePolicyKey: string;
    evidenceKind: ArbitrationEvidenceView["kind"] | null;
    retentionExpiresAt: Date;
    verifiedAt: Date | null;
    verifiedSizeBytes: number | null;
  }> = [];

  await db.transaction(async (tx) => {
    const timestamp = now();
    const taskResolutionAction = resolveTaskResolutionAction(input);
    const roundRows = await tx
      .select()
      .from(arbitrationCaseReviewRounds)
      .where(eq(arbitrationCaseReviewRounds.caseId, caseId))
      .orderBy(asc(arbitrationCaseReviewRounds.roundNumber));
    const openRound = getOpenReviewRound(roundRows);

    if (input.status === "resolved" && arbitrationCase.entityType === "task" && taskResolutionAction && taskResolutionAction !== "none") {
      await settleTaskLifecycleByOperatorInTx(tx, userId, arbitrationCase.entityId, taskResolutionAction);
    }

    const [updated] = await tx
      .update(arbitrationCases)
      .set({
        status: input.status,
        resolutionSummary: input.resolutionSummary ?? arbitrationCase.resolutionSummary,
        taskResolutionAction,
        updatedAt: timestamp,
        resolvedAt: ["resolved", "rejected"].includes(input.status) ? timestamp : arbitrationCase.resolvedAt,
        effectsAppliedAt:
          input.status === "resolved" && taskResolutionAction && taskResolutionAction !== "none"
            ? timestamp
            : arbitrationCase.effectsAppliedAt,
      })
      .where(eq(arbitrationCases.id, caseId))
      .returning();

    if (["resolved", "rejected"].includes(input.status)) {
      const attachments = await tx
        .select()
        .from(arbitrationEvidenceAttachments)
        .where(
          and(
            eq(arbitrationEvidenceAttachments.caseId, caseId),
            eq(arbitrationEvidenceAttachments.storageMode, "remote"),
            sql`${arbitrationEvidenceAttachments.archivedAt} is null`,
          ),
        );

      for (const attachment of attachments) {
        const retentionExpiresAt =
          attachment.retentionExpiresAt ??
          getArbitrationRemoteRetentionExpiresAt(timestamp, attachment.storagePolicyKey);
        await tx
          .update(arbitrationEvidenceAttachments)
          .set({
            retentionExpiresAt,
          })
          .where(eq(arbitrationEvidenceAttachments.id, attachment.id));
        if (!shouldDeleteArbitrationAttachmentOnCleanup(attachment.storagePolicyKey) && attachment.objectKey) {
          lifecycleSyncCandidates.push({
            objectKey: attachment.objectKey,
            bucketKey: attachment.bucketKey,
            storagePolicyKey: attachment.storagePolicyKey ?? "default",
            evidenceKind: null,
            retentionExpiresAt,
            verifiedAt: attachment.verifiedAt,
            verifiedSizeBytes: attachment.verifiedSizeBytes,
          });
        }
      }
    }

    if (openRound && ["resolved", "rejected"].includes(input.status)) {
      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          status: "completed",
          summary: input.resolutionSummary ?? openRound.summary,
          assignedOperatorUserId: arbitrationCase.assignedOperatorUserId ?? openRound.assignedOperatorUserId,
          endedByUserId: userId,
          endedAt: timestamp,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
    }

    const eventName =
      input.status === "under_review"
        ? "arbitration.reviewing"
        : input.status === "resolved"
          ? "arbitration.resolved"
          : "arbitration.rejected";
    await enqueueOutboxEvent(
      eventName,
      {
        caseId: updated.id,
        entityType: updated.entityType,
        entityId: updated.entityId,
        requesterUserId: updated.requesterUserId,
        respondentUserId: updated.respondentUserId,
        status: updated.status,
        taskResolutionAction: updated.taskResolutionAction,
      },
      tx,
    );
  });

  for (const candidate of lifecycleSyncCandidates) {
    const lifecycleDirectives = buildArbitrationAttachmentObjectStorageDirectives({
      storagePolicyKey: candidate.storagePolicyKey,
      bucketKey: candidate.bucketKey,
      evidenceKind: candidate.evidenceKind,
      retentionExpiresAt: candidate.retentionExpiresAt,
      verifiedAt: candidate.verifiedAt,
      verifiedSizeBytes: candidate.verifiedSizeBytes,
      state: "uploaded",
    });
    await setObjectTags({
      objectKey: candidate.objectKey,
      bucketKey: candidate.bucketKey,
      tags: lifecycleDirectives.tags,
    });
  }

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function advanceArbitrationReviewRound(
  userId: string,
  caseId: string,
  input: AdvanceArbitrationReviewRoundInput,
): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can advance arbitration review rounds");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from arbitration_cases where id = ${caseId} for update`);
    const [lockedCase] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, caseId));
    if (!lockedCase) {
      throw new NotFoundError("Arbitration case not found");
    }
    if (lockedCase.status !== "under_review") {
      throw new ConflictError("Only cases in under_review can advance to the next review round");
    }
    if (lockedCase.assignedOperatorUserId && lockedCase.assignedOperatorUserId !== userId) {
      throw new ConflictError("This case is currently claimed by another operator");
    }

    const roundRows = await tx
      .select()
      .from(arbitrationCaseReviewRounds)
      .where(eq(arbitrationCaseReviewRounds.caseId, caseId))
      .orderBy(asc(arbitrationCaseReviewRounds.roundNumber));
    const openRound = getOpenReviewRound(roundRows);
    if (!openRound) {
      throw new ConflictError("No open review round is available to advance");
    }
    if (!canAdvanceArbitrationRound(openRound.roundNumber)) {
      throw new ConflictError("Current review round reached the policy maximum and cannot advance automatically");
    }

    const timestamp = now();
    const nextRoundNumber = roundRows.reduce((max, row) => Math.max(max, row.roundNumber), 0) + 1;
    const requestedAssigneeUserId = input.assignToOperatorUserId?.trim() || null;
    if (requestedAssigneeUserId && !isPlatformOperator(requestedAssigneeUserId)) {
      throw new ConflictError("Next review round assignee must be a configured platform operator");
    }
    if (requestedAssigneeUserId) {
      await assertOperatorCanTakeArbitrationRoundInTx(tx, {
        operatorUserId: requestedAssigneeUserId,
        roundNumber: nextRoundNumber,
        excludeCaseId: caseId,
      });
    }
    const assignToOperatorUserId =
      requestedAssigneeUserId ??
      (await getRecommendedArbitrationRoundAssigneeInTx(tx, {
        excludeOperatorUserId: lockedCase.assignedOperatorUserId,
        roundNumber: nextRoundNumber,
        preferredOperatorUserId: lockedCase.assignedOperatorUserId,
      }));
    const summary = input.summary?.trim() || `第 ${openRound.roundNumber} 轮审理已结束，进入下一轮。`;

    await tx
      .update(arbitrationCaseReviewRounds)
      .set({
        status: "completed",
        summary,
        endedByUserId: userId,
        endedAt: timestamp,
      })
      .where(eq(arbitrationCaseReviewRounds.id, openRound.id));

    await tx.insert(arbitrationCaseReviewRounds).values({
      id: crypto.randomUUID(),
      caseId,
      roundNumber: nextRoundNumber,
      status: "open",
      summary: `进入第 ${nextRoundNumber} 轮审理。`,
      assignedOperatorUserId: assignToOperatorUserId,
      startedByUserId: userId,
      endedByUserId: null,
      startedAt: timestamp,
      endedAt: null,
    });

    await tx
      .update(arbitrationCases)
      .set({
        assignedOperatorUserId: assignToOperatorUserId,
        claimedAt: assignToOperatorUserId ? timestamp : null,
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, caseId));

    await enqueueOutboxEvent(
      "arbitration.reviewing",
      {
        caseId,
        entityType: lockedCase.entityType,
        entityId: lockedCase.entityId,
        requesterUserId: lockedCase.requesterUserId,
        respondentUserId: lockedCase.respondentUserId,
        status: lockedCase.status,
        roundNumber: nextRoundNumber,
      },
      tx,
    );
  });

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function claimNextArbitrationCase(userId: string): Promise<ArbitrationCaseView | null> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can claim arbitration cases");
  }

  const cases = await listVisibleArbitrationCases(userId);
  const candidates = cases
    .filter((arbitrationCase) => ["open", "under_review"].includes(arbitrationCase.status) && !arbitrationCase.assignedOperatorUserId)
    .sort((left, right) => {
      const leftHasStaleOpenRound = left.reviewRounds.some((round) => round.status === "open" && round.isRoundStale);
      const rightHasStaleOpenRound = right.reviewRounds.some((round) => round.status === "open" && round.isRoundStale);
      if (leftHasStaleOpenRound !== rightHasStaleOpenRound) {
        return Number(rightHasStaleOpenRound) - Number(leftHasStaleOpenRound);
      }
      const statusRank = (value: ArbitrationStatus) => (value === "under_review" ? 2 : value === "open" ? 1 : 0);
      const statusDiff = statusRank(right.status) - statusRank(left.status);
      if (statusDiff !== 0) return statusDiff;
      if (right.currentReviewRoundNumber !== left.currentReviewRoundNumber) {
        return right.currentReviewRoundNumber - left.currentReviewRoundNumber;
      }
      if (right.evidences.length !== left.evidences.length) {
        return right.evidences.length - left.evidences.length;
      }
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });

  for (const candidate of candidates) {
    try {
      return await claimArbitrationCase(userId, candidate.id);
    } catch (error) {
      if (error instanceof ConflictError) {
        continue;
      }
      throw error;
    }
  }
  return null;
}

export async function claimArbitrationCase(userId: string, caseId: string): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can claim arbitration cases");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from arbitration_cases where id = ${caseId} for update`);
    const [locked] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, caseId));

    if (!locked) {
      throw new NotFoundError("Arbitration case not found");
    }
    if (!["open", "under_review"].includes(locked.status)) {
      throw new ConflictError("Only active arbitration cases can be claimed");
    }
    if (locked.assignedOperatorUserId && locked.assignedOperatorUserId !== userId) {
      throw new ConflictError("This case is already claimed by another operator");
    }
    if (locked.assignedOperatorUserId === userId) {
      return;
    }

    const timestamp = now();
    const [openRound] = await tx
      .select()
      .from(arbitrationCaseReviewRounds)
      .where(and(eq(arbitrationCaseReviewRounds.caseId, caseId), eq(arbitrationCaseReviewRounds.status, "open")))
      .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
      .limit(1);
    if (openRound) {
      await assertOperatorCanTakeArbitrationRoundInTx(tx, {
        operatorUserId: userId,
        roundNumber: openRound.roundNumber,
        excludeCaseId: caseId,
        excludeRoundId: openRound.id,
      });
    }
    await tx
      .update(arbitrationCases)
      .set({
        assignedOperatorUserId: userId,
        claimedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, caseId));
    if (openRound) {
      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          assignedOperatorUserId: userId,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
    }
  });

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function assignArbitrationCase(
  userId: string,
  caseId: string,
  assigneeUserId: string,
): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can assign arbitration cases");
  }
  if (!isPlatformOperator(assigneeUserId)) {
    throw new ConflictError("Arbitration assignee must be a configured platform operator");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from arbitration_cases where id = ${caseId} for update`);
    const [locked] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, caseId));

    if (!locked) {
      throw new NotFoundError("Arbitration case not found");
    }
    if (!["open", "under_review"].includes(locked.status)) {
      throw new ConflictError("Only active arbitration cases can be assigned");
    }

    const timestamp = now();
    const [openRound] = await tx
      .select()
      .from(arbitrationCaseReviewRounds)
      .where(and(eq(arbitrationCaseReviewRounds.caseId, caseId), eq(arbitrationCaseReviewRounds.status, "open")))
      .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
      .limit(1);
    if (openRound) {
      await assertOperatorCanTakeArbitrationRoundInTx(tx, {
        operatorUserId: assigneeUserId,
        roundNumber: openRound.roundNumber,
        excludeCaseId: caseId,
        excludeRoundId: openRound.id,
      });
    }
    await tx
      .update(arbitrationCases)
      .set({
        assignedOperatorUserId: assigneeUserId,
        claimedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, caseId));
    if (openRound) {
      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          assignedOperatorUserId: assigneeUserId,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
    }
  });

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function releaseArbitrationCase(userId: string, caseId: string): Promise<ArbitrationCaseView> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can release arbitration cases");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from arbitration_cases where id = ${caseId} for update`);
    const [locked] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, caseId));

    if (!locked) {
      throw new NotFoundError("Arbitration case not found");
    }
    if (!["open", "under_review"].includes(locked.status)) {
      throw new ConflictError("Only active arbitration cases can be released");
    }
    if (locked.assignedOperatorUserId && locked.assignedOperatorUserId !== userId) {
      throw new ConflictError("This case is currently claimed by another operator");
    }
    if (!locked.assignedOperatorUserId) {
      return;
    }

    const timestamp = now();
    await tx
      .update(arbitrationCases)
      .set({
        assignedOperatorUserId: null,
        claimedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(arbitrationCases.id, caseId));

    const [openRound] = await tx
      .select()
      .from(arbitrationCaseReviewRounds)
      .where(and(eq(arbitrationCaseReviewRounds.caseId, caseId), eq(arbitrationCaseReviewRounds.status, "open")))
      .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
      .limit(1);
    if (openRound) {
      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          assignedOperatorUserId: null,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
    }
  });

  return loadVisibleArbitrationCaseOrThrow(userId, caseId);
}

export async function releaseStaleArbitrationClaims(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db.execute(sql`
    select
      ac.id as case_id,
      ac.claimed_at,
      rr.round_number
    from arbitration_cases ac
    left join lateral (
      select round_number
      from arbitration_case_review_rounds
      where case_id = ac.id
        and status = 'open'
      order by round_number desc
      limit 1
    ) rr on true
    where ac.status in ('open', 'under_review')
      and ac.assigned_operator_user_id is not null
      and ac.claimed_at is not null
    order by ac.claimed_at asc
    limit ${Math.max(limit * 4, 40)}
  `);
  const candidates = (rows.rows as Array<{ case_id: string; claimed_at: Date | null; round_number: number | null }>)
    .filter((row) => {
      if (!row.claimed_at) return false;
      const releaseHours = getArbitrationClaimReleaseHoursForRound(row.round_number);
      if (releaseHours === null) return false;
      const cutoff = new Date(referenceTime.getTime() - releaseHours * 60 * 60 * 1000);
      return row.claimed_at.getTime() <= cutoff.getTime();
    })
    .slice(0, limit);

  let releasedCount = 0;
  const caseIds: string[] = [];
  for (const row of candidates) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from arbitration_cases where id = ${row.case_id} for update`);
      const [locked] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, row.case_id));
      if (!locked || !locked.assignedOperatorUserId || !locked.claimedAt) {
        return;
      }

      const [openRound] = await tx
        .select()
        .from(arbitrationCaseReviewRounds)
        .where(and(eq(arbitrationCaseReviewRounds.caseId, row.case_id), eq(arbitrationCaseReviewRounds.status, "open")))
        .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
        .limit(1);
      const releaseHours = getArbitrationClaimReleaseHoursForRound(openRound?.roundNumber ?? row.round_number);
      if (releaseHours === null) {
        return;
      }
      if (isTerminalArbitrationRound(openRound?.roundNumber ?? row.round_number)) {
        return;
      }
      const cutoff = new Date(referenceTime.getTime() - releaseHours * 60 * 60 * 1000);
      if (locked.claimedAt.getTime() > cutoff.getTime()) {
        return;
      }
      const evidenceQuietSince = getArbitrationEvidenceQuietSince({
        roundNumber: openRound?.roundNumber ?? row.round_number,
        referenceTime,
        anchorTime: locked.claimedAt,
      });
      const hasRecentEvidenceActivity =
        evidenceQuietSince === null
          ? false
          : await hasRecentArbitrationEvidenceActivitySinceInTx(tx, {
              caseId: row.case_id,
              since: evidenceQuietSince,
            });
      if (hasRecentEvidenceActivity) {
        return;
      }

      const timestamp = now();
      await tx
        .update(arbitrationCases)
        .set({
          assignedOperatorUserId: null,
          claimedAt: null,
          updatedAt: timestamp,
        })
        .where(eq(arbitrationCases.id, row.case_id));

      if (openRound) {
        await tx
          .update(arbitrationCaseReviewRounds)
          .set({
            assignedOperatorUserId: null,
          })
          .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
      }
      releasedCount += 1;
      caseIds.push(row.case_id);
    });
  }

  return {
    scannedCount: candidates.length,
    releasedCount,
    caseIds,
  };
}

export async function rebalanceArbitrationReviewRounds(args?: {
  limit?: number;
}): Promise<ArbitrationReviewRoundRebalanceResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db.execute(sql`
    select
      ac.id as case_id,
      ac.status as case_status,
      ac.assigned_operator_user_id as case_assignee_user_id,
      ac.claimed_at as case_claimed_at,
      rr.id as round_id,
      rr.round_number,
      rr.assigned_operator_user_id as round_assignee_user_id,
      rr.started_at
    from arbitration_cases ac
    inner join arbitration_case_review_rounds rr
      on rr.case_id = ac.id
     and rr.status = 'open'
    where ac.status in ('open', 'under_review')
    order by rr.started_at asc
    limit ${Math.max(limit * 4, 40)}
  `);

  const candidates = (rows.rows as Array<{
    case_id: string;
    case_status: ArbitrationStatus;
    case_assignee_user_id: string | null;
    case_claimed_at: Date | null;
    round_id: string;
    round_number: number;
    round_assignee_user_id: string | null;
    started_at: Date;
  }>)
    .map((row) => {
      const roundAgeHours = getReviewRoundAgeHours(row.started_at, null, referenceTime);
      const roundPolicy = getArbitrationReviewRoundPolicy(row.round_number);
      const terminalRound = isTerminalArbitrationRound(row.round_number);
      const roundStale = roundAgeHours >= roundPolicy.staleHours;
      const roundRebalanceDue = roundAgeHours >= roundPolicy.rebalanceAfterHours;
      const claimReleaseHours = roundPolicy.claimReleaseHours;
      const claimStaleCutoff =
        claimReleaseHours === null
          ? null
          : new Date(referenceTime.getTime() - claimReleaseHours * 60 * 60 * 1000);
      const claimStale =
        claimStaleCutoff !== null &&
        row.case_claimed_at !== null &&
        row.case_claimed_at.getTime() <= claimStaleCutoff.getTime();
      const currentAssigneeUserId = row.round_assignee_user_id ?? row.case_assignee_user_id;
      const needsPoolRepair =
        Boolean(currentAssigneeUserId) && !isOperatorAllowedForArbitrationRound(row.round_number, currentAssigneeUserId);
      const needsFreshAssignment = !currentAssigneeUserId;
      const needsDriftRepair =
        Boolean(currentAssigneeUserId) &&
        row.round_assignee_user_id !== row.case_assignee_user_id &&
        isOperatorAllowedForArbitrationRound(row.round_number, row.case_assignee_user_id);
      const needsReassignment =
        roundPolicy.rebalanceEnabled &&
        Boolean(currentAssigneeUserId) &&
        !needsDriftRepair &&
        (needsPoolRepair || (!terminalRound && (roundRebalanceDue || claimStale)));
      const evidenceQuietSince = getArbitrationEvidenceQuietSince({
        roundNumber: row.round_number,
        referenceTime,
        anchorTime: row.started_at,
      });
      return {
        ...row,
        roundPolicy,
        terminalRound,
        currentAssigneeUserId,
        roundAgeHours,
        roundStale,
        roundRebalanceDue,
        claimStale,
        needsPoolRepair,
        needsFreshAssignment,
        needsDriftRepair,
        needsReassignment,
        evidenceQuietSince,
      };
    })
    .filter((row) => row.needsFreshAssignment || row.needsDriftRepair || row.needsReassignment)
    .sort((left, right) => {
      const rank = (value: typeof left) =>
        value.needsReassignment ? 3 : value.needsFreshAssignment ? 2 : value.needsDriftRepair ? 1 : 0;
      const rankDiff = rank(right) - rank(left);
      if (rankDiff !== 0) return rankDiff;
      if (right.roundAgeHours !== left.roundAgeHours) {
        return right.roundAgeHours - left.roundAgeHours;
      }
      return left.started_at.getTime() - right.started_at.getTime();
    })
    .slice(0, limit);

  let assignedCount = 0;
  let reassignedCount = 0;
  let skippedCount = 0;
  const assignments: ArbitrationReviewRoundRebalanceResult["assignments"] = [];

  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from arbitration_cases where id = ${candidate.case_id} for update`);
      const [lockedCase] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, candidate.case_id));
      if (!lockedCase || !["open", "under_review"].includes(lockedCase.status)) {
        skippedCount += 1;
        return;
      }

      const [openRound] = await tx
        .select()
        .from(arbitrationCaseReviewRounds)
        .where(and(eq(arbitrationCaseReviewRounds.caseId, candidate.case_id), eq(arbitrationCaseReviewRounds.status, "open")))
        .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
        .limit(1);
      if (!openRound) {
        skippedCount += 1;
        return;
      }

      const timestamp = now();
      const roundAgeHours = getReviewRoundAgeHours(openRound.startedAt, null, timestamp);
      const roundPolicy = getArbitrationReviewRoundPolicy(openRound.roundNumber);
      const terminalRound = isTerminalArbitrationRound(openRound.roundNumber);
      const roundStale = roundAgeHours >= roundPolicy.staleHours;
      const roundRebalanceDue = roundAgeHours >= roundPolicy.rebalanceAfterHours;
      const claimReleaseHours = roundPolicy.claimReleaseHours;
      const claimStaleCutoff =
        claimReleaseHours === null ? null : new Date(timestamp.getTime() - claimReleaseHours * 60 * 60 * 1000);
      const claimStale =
        claimStaleCutoff !== null &&
        lockedCase.claimedAt !== null &&
        lockedCase.claimedAt.getTime() <= claimStaleCutoff.getTime();
      const currentAssigneeUserId = openRound.assignedOperatorUserId ?? lockedCase.assignedOperatorUserId;
      const needsPoolRepair =
        Boolean(currentAssigneeUserId) && !isOperatorAllowedForArbitrationRound(openRound.roundNumber, currentAssigneeUserId);
      const needsFreshAssignment = !currentAssigneeUserId;
      const needsDriftRepair =
        Boolean(currentAssigneeUserId) &&
        openRound.assignedOperatorUserId !== lockedCase.assignedOperatorUserId &&
        isOperatorAllowedForArbitrationRound(openRound.roundNumber, lockedCase.assignedOperatorUserId);
      const needsReassignment =
        roundPolicy.rebalanceEnabled &&
        Boolean(currentAssigneeUserId) &&
        !needsDriftRepair &&
        (needsPoolRepair || (!terminalRound && (roundRebalanceDue || claimStale)));
      if (needsReassignment) {
        const evidenceQuietSince = getArbitrationEvidenceQuietSince({
          roundNumber: openRound.roundNumber,
          referenceTime: timestamp,
          anchorTime: openRound.startedAt,
        });
        const hasRecentEvidenceActivity =
          evidenceQuietSince === null
            ? false
            : await hasRecentArbitrationEvidenceActivitySinceInTx(tx, {
                caseId: candidate.case_id,
                since: evidenceQuietSince,
              });
        if (hasRecentEvidenceActivity) {
          skippedCount += 1;
          return;
        }
      }
      if (!needsFreshAssignment && !needsDriftRepair && !needsReassignment) {
        skippedCount += 1;
        return;
      }

      const assigneeUserId = needsDriftRepair
        ? lockedCase.assignedOperatorUserId
        : await getRecommendedArbitrationRoundAssigneeInTx(tx, {
            excludeOperatorUserId: needsReassignment ? currentAssigneeUserId : null,
            roundNumber: openRound.roundNumber,
            preferredOperatorUserId: lockedCase.assignedOperatorUserId,
          });
      if (!assigneeUserId) {
        skippedCount += 1;
        return;
      }
      if (needsReassignment && assigneeUserId === currentAssigneeUserId) {
        skippedCount += 1;
        return;
      }

      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          assignedOperatorUserId: assigneeUserId,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));
      await tx
        .update(arbitrationCases)
        .set({
          assignedOperatorUserId: assigneeUserId,
          claimedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(arbitrationCases.id, candidate.case_id));

      assignments.push({
        caseId: candidate.case_id,
        roundId: openRound.id,
        roundNumber: openRound.roundNumber,
        assigneeUserId,
        previousAssigneeUserId: currentAssigneeUserId ?? null,
        roundAgeHours,
        action: needsReassignment ? "reassign" : "assign",
      });
      if (needsReassignment) {
        reassignedCount += 1;
      } else {
        assignedCount += 1;
      }
    });
  }

  return {
    scannedCount: candidates.length,
    assignedCount,
    reassignedCount,
    skippedCount,
    assignments,
  };
}

export async function autoAdvanceStaleArbitrationReviewRounds(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db.execute(sql`
    select
      ac.id as case_id,
      rr.id as round_id,
      rr.round_number,
      rr.started_at
    from arbitration_cases ac
    inner join arbitration_case_review_rounds rr
      on rr.case_id = ac.id
     and rr.status = 'open'
    where ac.status = 'under_review'
    order by rr.started_at asc
    limit ${Math.max(limit * 4, 40)}
  `);

  const candidates = (rows.rows as Array<{
    case_id: string;
    round_id: string;
    round_number: number;
    started_at: Date;
  }>)
    .filter((row) => {
      const autoAdvanceAfterHours = getArbitrationAutoAdvanceHoursForRound(row.round_number);
      if (autoAdvanceAfterHours === null) return false;
      if (!canAdvanceArbitrationRound(row.round_number)) return false;
      const roundAgeHours = getReviewRoundAgeHours(row.started_at, null, referenceTime);
      return roundAgeHours >= autoAdvanceAfterHours;
    })
    .slice(0, limit);

  let advancedCount = 0;
  let skippedCount = 0;
  const caseIds: string[] = [];

  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from arbitration_cases where id = ${candidate.case_id} for update`);
      const [lockedCase] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, candidate.case_id));
      if (!lockedCase || lockedCase.status !== "under_review") {
        skippedCount += 1;
        return;
      }

      const roundRows = await tx
        .select()
        .from(arbitrationCaseReviewRounds)
        .where(eq(arbitrationCaseReviewRounds.caseId, candidate.case_id))
        .orderBy(asc(arbitrationCaseReviewRounds.roundNumber));
      const openRound = getOpenReviewRound(roundRows);
      if (!openRound || openRound.id !== candidate.round_id) {
        skippedCount += 1;
        return;
      }

      const roundPolicy = getArbitrationReviewRoundPolicy(openRound.roundNumber);
      const autoAdvanceAfterHours = getArbitrationAutoAdvanceHoursForRound(openRound.roundNumber);
      if (autoAdvanceAfterHours === null) {
        skippedCount += 1;
        return;
      }
      if (!canAdvanceArbitrationRound(openRound.roundNumber)) {
        skippedCount += 1;
        return;
      }
      const roundAgeHours = getReviewRoundAgeHours(openRound.startedAt, null, referenceTime);
      if (roundAgeHours < autoAdvanceAfterHours) {
        skippedCount += 1;
        return;
      }
      const evidenceQuietSince = getArbitrationEvidenceQuietSince({
        roundNumber: openRound.roundNumber,
        referenceTime,
        anchorTime: openRound.startedAt,
      });
      const hasRecentEvidenceActivity =
        evidenceQuietSince === null
          ? false
          : await hasRecentArbitrationEvidenceActivitySinceInTx(tx, {
              caseId: candidate.case_id,
              since: evidenceQuietSince,
            });
      if (hasRecentEvidenceActivity) {
        skippedCount += 1;
        return;
      }

      const timestamp = now();
      const nextRoundNumber = roundRows.reduce((max, row) => Math.max(max, row.roundNumber), 0) + 1;
      const assignToOperatorUserId = await getRecommendedArbitrationRoundAssigneeInTx(tx, {
        excludeOperatorUserId: lockedCase.assignedOperatorUserId,
        roundNumber: nextRoundNumber,
        preferredOperatorUserId: lockedCase.assignedOperatorUserId,
      });
      const summary = `第 ${openRound.roundNumber} 轮审理超过 ${autoAdvanceAfterHours}h 未完成，系统自动推进到下一轮。`;

      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          status: "completed",
          summary,
          endedByUserId: null,
          endedAt: timestamp,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));

      await tx.insert(arbitrationCaseReviewRounds).values({
        id: crypto.randomUUID(),
        caseId: candidate.case_id,
        roundNumber: nextRoundNumber,
        status: "open",
        summary: `系统自动进入第 ${nextRoundNumber} 轮审理。`,
        assignedOperatorUserId: assignToOperatorUserId,
        startedByUserId: assignToOperatorUserId,
        endedByUserId: null,
        startedAt: timestamp,
        endedAt: null,
      });

      await tx
        .update(arbitrationCases)
        .set({
          assignedOperatorUserId: assignToOperatorUserId,
          claimedAt: assignToOperatorUserId ? timestamp : null,
          updatedAt: timestamp,
        })
        .where(eq(arbitrationCases.id, candidate.case_id));

      await enqueueOutboxEvent(
        "arbitration.reviewing",
        {
          caseId: candidate.case_id,
          entityType: lockedCase.entityType,
          entityId: lockedCase.entityId,
          roundNumber: nextRoundNumber,
        },
        tx,
      );

      advancedCount += 1;
      caseIds.push(candidate.case_id);
    });
  }

  return {
    scannedCount: candidates.length,
    advancedCount,
    skippedCount,
    caseIds,
  };
}

export async function escalateTerminalArbitrationReviewRounds(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  const referenceTime = now();
  const rows = await db.execute(sql`
    select
      ac.id as case_id,
      rr.id as round_id,
      rr.round_number,
      rr.assigned_operator_user_id as round_assignee_user_id,
      rr.started_at,
      rr.final_escalated_at
    from arbitration_cases ac
    inner join arbitration_case_review_rounds rr
      on rr.case_id = ac.id
     and rr.status = 'open'
    where ac.status = 'under_review'
    order by rr.started_at asc
    limit ${Math.max(limit * 4, 40)}
  `);

  const candidates = (rows.rows as Array<{
    case_id: string;
    round_id: string;
    round_number: number;
    round_assignee_user_id: string | null;
    started_at: Date;
    final_escalated_at: Date | null;
  }>)
    .filter((row) => {
      if (!isTerminalArbitrationRound(row.round_number)) return false;
      const roundPolicy = getArbitrationReviewRoundPolicy(row.round_number);
      const roundAgeHours = getReviewRoundAgeHours(row.started_at, null, referenceTime);
      if (roundAgeHours < roundPolicy.staleHours) return false;
      const evidenceQuietSince = getArbitrationEvidenceQuietSince({
        roundNumber: row.round_number,
        referenceTime,
        anchorTime: row.started_at,
      });
      if (row.final_escalated_at && evidenceQuietSince && row.final_escalated_at.getTime() >= evidenceQuietSince.getTime()) {
        return false;
      }
      return true;
    })
    .slice(0, limit);

  let escalatedCount = 0;
  let skippedCount = 0;
  const caseIds: string[] = [];
  const roundIds: string[] = [];

  for (const candidate of candidates) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from arbitration_cases where id = ${candidate.case_id} for update`);
      const [lockedCase] = await tx.select().from(arbitrationCases).where(eq(arbitrationCases.id, candidate.case_id));
      if (!lockedCase || lockedCase.status !== "under_review") {
        skippedCount += 1;
        return;
      }

      const [openRound] = await tx
        .select()
        .from(arbitrationCaseReviewRounds)
        .where(and(eq(arbitrationCaseReviewRounds.caseId, candidate.case_id), eq(arbitrationCaseReviewRounds.status, "open")))
        .orderBy(desc(arbitrationCaseReviewRounds.roundNumber))
        .limit(1);
      if (!openRound || !isTerminalArbitrationRound(openRound.roundNumber)) {
        skippedCount += 1;
        return;
      }

      const roundPolicy = getArbitrationReviewRoundPolicy(openRound.roundNumber);
      const roundAgeHours = getReviewRoundAgeHours(openRound.startedAt, null, referenceTime);
      if (roundAgeHours < roundPolicy.staleHours) {
        skippedCount += 1;
        return;
      }

      const evidenceQuietSince = getArbitrationEvidenceQuietSince({
        roundNumber: openRound.roundNumber,
        referenceTime,
        anchorTime: openRound.startedAt,
      });
      const hasRecentEvidenceActivity =
        evidenceQuietSince === null
          ? false
          : await hasRecentArbitrationEvidenceActivitySinceInTx(tx, {
              caseId: candidate.case_id,
              since: evidenceQuietSince,
            });
      if (hasRecentEvidenceActivity) {
        skippedCount += 1;
        return;
      }
      if (openRound.finalEscalatedAt && evidenceQuietSince && openRound.finalEscalatedAt.getTime() >= evidenceQuietSince.getTime()) {
        skippedCount += 1;
        return;
      }

      await tx
        .update(arbitrationCaseReviewRounds)
        .set({
          finalEscalatedAt: referenceTime,
          finalEscalationCount: sql`${arbitrationCaseReviewRounds.finalEscalationCount} + 1`,
          summary:
            openRound.summary ??
            `Final review round ${openRound.roundNumber} exceeded terminal-round SLA and requires operator intervention.`,
        })
        .where(eq(arbitrationCaseReviewRounds.id, openRound.id));

      escalatedCount += 1;
      caseIds.push(candidate.case_id);
      roundIds.push(openRound.id);
    });
  }

  return {
    scannedCount: candidates.length,
    escalatedCount,
    skippedCount,
    caseIds,
    roundIds,
  };
}
