// Evidence attachment lifecycle endpoints: prepared upload plans, upload
// completion and verification, direct upload, content/signed access, archive,
// cleanup request, prepared-upload expiry sweep, resolved-case cleanup sweep,
// cleanup queue inspection and storage policy listing. Moved verbatim from
// service.ts.
import { readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  ArbitrationCaseView,
  ArbitrationEvidenceAttachmentAccessView,
  ArbitrationEvidenceAttachmentUploadPlanView,
  ArbitrationEvidenceStoragePolicyView,
  ArbitrationEvidenceView,
  ArbitrationRemoteAttachmentCleanupCandidateView,
  ArbitrationRemoteAttachmentCleanupQueueView,
  ArbitrationStatus,
  PrepareArbitrationEvidenceAttachmentUploadInput,
  UploadArbitrationEvidenceAttachmentInput,
} from "@neuro/contracts";
import { and, asc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  arbitrationCases,
  arbitrationEvidenceAttachments,
} from "@/modules/arbitration/schema";
import {
  getArbitrationCaseById,
  getArbitrationEvidenceAttachmentById,
  getArbitrationEvidenceById,
} from "@/modules/arbitration/repository";
import { env } from "@/env";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import {
  createSignedReadUrl,
  getObjectMetadata,
  setObjectTags,
} from "@/platform/object-storage/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { canViewCase, isPlatformOperator, now } from "./shared";
import {
  buildArbitrationAttachmentObjectStorageDirectives,
  buildPreparedRemoteAttachmentUploadPlan,
  buildRemoteAttachmentObjectKey,
  deleteRemoteArbitrationAttachment,
  ensureArbitrationAttachmentDirectory,
  getArbitrationEvidenceStoragePolicy,
  getArbitrationRemoteRetentionExpiresAt,
  getNextArbitrationCleanupAttemptAt,
  getPreparedUploadExpiresAt,
  getRemoteAttachmentCleanupState,
  joinRemoteAttachmentUrl,
  normalizeAttachmentPrepareInput,
  normalizeAttachmentUpload,
  readRemoteArbitrationAttachment,
  resolveArbitrationEvidenceStoragePolicy,
  shouldDeleteArbitrationAttachmentOnCleanup,
  storeRemoteArbitrationAttachment,
  verifyRemoteArbitrationAttachmentUpload,
} from "./attachment-storage";
import { loadVisibleArbitrationCaseOrThrow } from "./case-views";

const ARBITRATION_ATTACHMENT_CLEANUP_LEASE_MS = 15 * 60 * 1_000;

function createAttachmentCleanupLease(referenceTime: Date) {
  return {
    token: randomUUID(),
    expiresAt: new Date(referenceTime.getTime() + ARBITRATION_ATTACHMENT_CLEANUP_LEASE_MS),
  };
}

async function claimExpiredPreparedAttachment(attachmentId: string, referenceTime: Date) {
  const lease = createAttachmentCleanupLease(referenceTime);
  const [attachment] = await db
    .update(arbitrationEvidenceAttachments)
    .set({
      cleanupLeaseToken: lease.token,
      cleanupLeaseExpiresAt: lease.expiresAt,
    })
    .where(
      and(
        eq(arbitrationEvidenceAttachments.id, attachmentId),
        eq(arbitrationEvidenceAttachments.storageMode, "remote"),
        eq(arbitrationEvidenceAttachments.uploadState, "prepared"),
        isNull(arbitrationEvidenceAttachments.archivedAt),
        lte(arbitrationEvidenceAttachments.preparedUploadExpiresAt, referenceTime),
        or(
          isNull(arbitrationEvidenceAttachments.cleanupLeaseExpiresAt),
          lte(arbitrationEvidenceAttachments.cleanupLeaseExpiresAt, referenceTime),
        ),
      ),
    )
    .returning();
  return attachment ? { attachment, leaseToken: lease.token } : null;
}

export async function claimUploadedAttachmentCleanup(
  attachmentId: string,
  referenceTime: Date,
  cleanupMaxAttempts: number,
) {
  const lease = createAttachmentCleanupLease(referenceTime);
  const [attachment] = await db
    .update(arbitrationEvidenceAttachments)
    .set({
      cleanupLeaseToken: lease.token,
      cleanupLeaseExpiresAt: lease.expiresAt,
    })
    .where(
      and(
        eq(arbitrationEvidenceAttachments.id, attachmentId),
        eq(arbitrationEvidenceAttachments.storageMode, "remote"),
        eq(arbitrationEvidenceAttachments.uploadState, "uploaded"),
        isNull(arbitrationEvidenceAttachments.archivedAt),
        lt(arbitrationEvidenceAttachments.cleanupAttemptCount, cleanupMaxAttempts),
        or(
          isNull(arbitrationEvidenceAttachments.nextCleanupAttemptAt),
          lte(arbitrationEvidenceAttachments.nextCleanupAttemptAt, referenceTime),
        ),
        or(
          isNull(arbitrationEvidenceAttachments.cleanupLeaseExpiresAt),
          lte(arbitrationEvidenceAttachments.cleanupLeaseExpiresAt, referenceTime),
        ),
      ),
    )
    .returning();
  return attachment ? { attachment, leaseToken: lease.token } : null;
}

export async function listArbitrationEvidenceStoragePolicies(userId: string): Promise<ArbitrationEvidenceStoragePolicyView[]> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can inspect arbitration evidence storage policies");
  }

  return Object.keys(env.arbitrationEvidenceStoragePolicies)
    .sort((left, right) => left.localeCompare(right))
    .map((policyKey) => getArbitrationEvidenceStoragePolicy(policyKey));
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
        cleanupLeaseToken: null,
        cleanupLeaseExpiresAt: null,
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
      cleanupLeaseToken: null,
      cleanupLeaseExpiresAt: null,
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
        sql`(${arbitrationEvidenceAttachments.cleanupLeaseExpiresAt} is null or ${arbitrationEvidenceAttachments.cleanupLeaseExpiresAt} <= ${referenceTime})`,
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

  for (const candidate of rows) {
    const expiredAt = now();
    const claim = await claimExpiredPreparedAttachment(candidate.id, expiredAt);
    if (!claim) {
      continue;
    }
    const row = claim.attachment;
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

      const [updated] = await db
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
          cleanupLeaseToken: null,
          cleanupLeaseExpiresAt: null,
        })
        .where(
          and(
            eq(arbitrationEvidenceAttachments.id, row.id),
            eq(arbitrationEvidenceAttachments.uploadState, "prepared"),
            eq(arbitrationEvidenceAttachments.cleanupLeaseToken, claim.leaseToken),
            isNull(arbitrationEvidenceAttachments.archivedAt),
          ),
        )
        .returning({ id: arbitrationEvidenceAttachments.id });
      if (updated) {
        expiredIds.push(row.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown prepared upload cleanup error";
      const cleanupPolicy = resolveArbitrationEvidenceStoragePolicy(null, row.storagePolicyKey ?? null);
      const nextAttemptCount = row.cleanupAttemptCount + 1;
      const [updated] = await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupAttemptCount: nextAttemptCount,
          lastCleanupAttemptAt: expiredAt,
          lastCleanupError: message,
          nextCleanupAttemptAt:
            nextAttemptCount >= cleanupPolicy.cleanupMaxAttempts
              ? null
              : getNextArbitrationCleanupAttemptAt(nextAttemptCount, expiredAt, row.storagePolicyKey),
          cleanupLeaseToken: null,
          cleanupLeaseExpiresAt: null,
        })
        .where(
          and(
            eq(arbitrationEvidenceAttachments.id, row.id),
            eq(arbitrationEvidenceAttachments.uploadState, "prepared"),
            eq(arbitrationEvidenceAttachments.cleanupLeaseToken, claim.leaseToken),
            isNull(arbitrationEvidenceAttachments.archivedAt),
          ),
        )
        .returning({ id: arbitrationEvidenceAttachments.id });
      if (updated) {
        failures.push({
          attachmentId: row.id,
          message,
        });
      }
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
        sql`(${arbitrationEvidenceAttachments.cleanupLeaseExpiresAt} is null or ${arbitrationEvidenceAttachments.cleanupLeaseExpiresAt} <= ${referenceTime})`,
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

  for (const candidate of rows) {
    const candidatePolicy = resolveArbitrationEvidenceStoragePolicy(
      null,
      candidate.attachment.storagePolicyKey ?? null,
    );
    if (candidate.attachment.cleanupAttemptCount >= candidatePolicy.cleanupMaxAttempts) {
      continue;
    }
    const attemptTimestamp = now();
    const claim = await claimUploadedAttachmentCleanup(
      candidate.attachment.id,
      attemptTimestamp,
      candidatePolicy.cleanupMaxAttempts,
    );
    if (!claim) {
      continue;
    }
    const row = {
      ...candidate,
      attachment: claim.attachment,
    };
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
      const [updated] = await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupRequestedAt: row.attachment.cleanupRequestedAt ?? now(),
          cleanupAttemptCount: row.attachment.cleanupAttemptCount + 1,
          lastCleanupAttemptAt: attemptTimestamp,
          lastCleanupError: null,
          nextCleanupAttemptAt: null,
          cleanupLeaseToken: null,
          cleanupLeaseExpiresAt: null,
          uploadState: "archived",
          archivedAt: now(),
          retentionExpiresAt:
            row.attachment.retentionExpiresAt ??
            getArbitrationRemoteRetentionExpiresAt(now(), row.attachment.storagePolicyKey),
          archiveReason: shouldDeleteObject ? "resolved_case_cleanup" : "bucket_lifecycle_cleanup",
          remoteUrl: null,
        })
        .where(
          and(
            eq(arbitrationEvidenceAttachments.id, row.attachment.id),
            eq(arbitrationEvidenceAttachments.uploadState, "uploaded"),
            eq(arbitrationEvidenceAttachments.cleanupLeaseToken, claim.leaseToken),
            isNull(arbitrationEvidenceAttachments.archivedAt),
          ),
        )
        .returning({ id: arbitrationEvidenceAttachments.id });
      if (updated) {
        archivedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error";
      const nextAttemptCount = row.attachment.cleanupAttemptCount + 1;
      const cleanupPolicy = resolveArbitrationEvidenceStoragePolicy(null, row.attachment.storagePolicyKey ?? null);
      const nextCleanupAttemptAt =
        nextAttemptCount >= cleanupPolicy.cleanupMaxAttempts
          ? null
          : getNextArbitrationCleanupAttemptAt(nextAttemptCount, attemptTimestamp, row.attachment.storagePolicyKey);
      const [updated] = await db
        .update(arbitrationEvidenceAttachments)
        .set({
          cleanupAttemptCount: nextAttemptCount,
          lastCleanupAttemptAt: attemptTimestamp,
          lastCleanupError: message,
          nextCleanupAttemptAt,
          cleanupLeaseToken: null,
          cleanupLeaseExpiresAt: null,
        })
        .where(
          and(
            eq(arbitrationEvidenceAttachments.id, row.attachment.id),
            eq(arbitrationEvidenceAttachments.uploadState, "uploaded"),
            eq(arbitrationEvidenceAttachments.cleanupLeaseToken, claim.leaseToken),
            isNull(arbitrationEvidenceAttachments.archivedAt),
          ),
        )
        .returning({ id: arbitrationEvidenceAttachments.id });
      if (updated) {
        failures.push({
          attachmentId: row.attachment.id,
          message,
        });
      }
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
