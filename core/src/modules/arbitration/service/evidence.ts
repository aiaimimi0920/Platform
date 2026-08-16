// Evidence records: participant/operator evidence creation on active cases.
// Moved verbatim from service.ts.
import type {
  ArbitrationCaseView,
  CreateArbitrationEvidenceInput,
} from "@neuro/contracts";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  arbitrationCaseEvidences,
  arbitrationCases,
} from "@/modules/arbitration/schema";
import { getArbitrationCaseById } from "@/modules/arbitration/repository";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { canViewCase, normalizeEvidenceInput, now } from "./shared";
import { loadVisibleArbitrationCaseOrThrow } from "./case-views";

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
