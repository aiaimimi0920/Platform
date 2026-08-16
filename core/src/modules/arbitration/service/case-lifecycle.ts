// Case lifecycle: creation (with first review round and unique-active-case
// guard) and operator status transitions including task settlement and
// remote attachment retention lifecycle sync. Moved verbatim from service.ts.
import type {
  ArbitrationCaseView,
  ArbitrationEvidenceView,
  ArbitrationStatus,
  CreateArbitrationCaseInput,
  UpdateArbitrationCaseStatusInput,
} from "@neuro/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  arbitrationCaseEvidences,
  arbitrationCases,
  arbitrationEvidenceAttachments,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import { getArbitrationCaseById } from "@/modules/arbitration/repository";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { setObjectTags } from "@/platform/object-storage/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { getTaskById } from "@/modules/task-hub/repository";
import { settleTaskLifecycleByOperatorInTx } from "@/modules/task-hub/service";

import {
  assertStatusTransition,
  getOpenReviewRound,
  isPlatformOperator,
  isUniqueViolation,
  now,
  resolveTaskResolutionAction,
} from "./shared";
import {
  buildArbitrationAttachmentObjectStorageDirectives,
  getArbitrationRemoteRetentionExpiresAt,
  shouldDeleteArbitrationAttachmentOnCleanup,
} from "./attachment-storage";
import { loadVisibleArbitrationCaseOrThrow } from "./case-views";

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
