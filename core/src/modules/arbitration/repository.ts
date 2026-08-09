import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  arbitrationCaseEvidences,
  arbitrationCases,
  arbitrationEvidenceAttachments,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";

export async function listArbitrationCasesVisibleToUser(userId: string, includeAll = false) {
  if (includeAll) {
    return db.select().from(arbitrationCases).orderBy(asc(arbitrationCases.createdAt), asc(arbitrationCases.id));
  }

  return db
    .select()
    .from(arbitrationCases)
    .where(or(eq(arbitrationCases.requesterUserId, userId), eq(arbitrationCases.respondentUserId, userId)))
    .orderBy(asc(arbitrationCases.createdAt), asc(arbitrationCases.id));
}

export async function getArbitrationCaseById(caseId: string) {
  const [row] = await db.select().from(arbitrationCases).where(eq(arbitrationCases.id, caseId));
  return row ?? null;
}

export async function listActiveArbitrationCasesForEntity(entityType: string, entityId: string) {
  return db
    .select()
    .from(arbitrationCases)
    .where(
      and(
        eq(arbitrationCases.entityType, entityType),
        eq(arbitrationCases.entityId, entityId),
        inArray(arbitrationCases.status, ["open", "under_review"]),
      ),
    );
}

export async function listUnassignedActiveArbitrationCaseCandidates() {
  return db
    .select({
      id: arbitrationCases.id,
      status: arbitrationCases.status,
      createdAt: arbitrationCases.createdAt,
      evidenceCount: sql<number>`count(${arbitrationCaseEvidences.id})::int`,
    })
    .from(arbitrationCases)
    .leftJoin(arbitrationCaseEvidences, eq(arbitrationCaseEvidences.caseId, arbitrationCases.id))
    .where(
      and(
        inArray(arbitrationCases.status, ["open", "under_review"]),
        isNull(arbitrationCases.assignedOperatorUserId),
      ),
    )
    .groupBy(arbitrationCases.id, arbitrationCases.status, arbitrationCases.createdAt)
    .orderBy(asc(arbitrationCases.createdAt), asc(arbitrationCases.id));
}

export async function listArbitrationCaseEvidencesByCaseIds(caseIds: string[]) {
  if (caseIds.length === 0) return [];

  return db
    .select()
    .from(arbitrationCaseEvidences)
    .where(inArray(arbitrationCaseEvidences.caseId, caseIds))
    .orderBy(asc(arbitrationCaseEvidences.createdAt));
}

export async function getArbitrationEvidenceById(evidenceId: string) {
  const [row] = await db.select().from(arbitrationCaseEvidences).where(eq(arbitrationCaseEvidences.id, evidenceId));
  return row ?? null;
}

export async function getArbitrationEvidenceAttachmentById(attachmentId: string) {
  const [row] = await db
    .select()
    .from(arbitrationEvidenceAttachments)
    .where(eq(arbitrationEvidenceAttachments.id, attachmentId));
  return row ?? null;
}

export async function listArbitrationEvidenceAttachmentsByEvidenceIds(evidenceIds: string[]) {
  if (evidenceIds.length === 0) return [];

  return db
    .select()
    .from(arbitrationEvidenceAttachments)
    .where(inArray(arbitrationEvidenceAttachments.evidenceId, evidenceIds))
    .orderBy(asc(arbitrationEvidenceAttachments.createdAt));
}

export async function listArbitrationReviewRoundsByCaseIds(caseIds: string[]) {
  if (caseIds.length === 0) return [];

  return db
    .select()
    .from(arbitrationCaseReviewRounds)
    .where(inArray(arbitrationCaseReviewRounds.caseId, caseIds))
    .orderBy(asc(arbitrationCaseReviewRounds.roundNumber), asc(arbitrationCaseReviewRounds.startedAt));
}
