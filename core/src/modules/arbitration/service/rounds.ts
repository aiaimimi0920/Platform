// Review round progression: operator-driven round advancement, open-round
// rebalance/repair, stale-round auto-advance, and terminal-round escalation.
// Moved verbatim from service.ts.
import type {
  AdvanceArbitrationReviewRoundInput,
  ArbitrationCaseView,
  ArbitrationReviewRoundRebalanceResult,
  ArbitrationStatus,
} from "@neuro/contracts";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  arbitrationCases,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { getArbitrationReviewRoundAgeHours as getReviewRoundAgeHours } from "@/modules/arbitration/workload-analysis";

import { getOpenReviewRound, isPlatformOperator, now } from "./shared";
import {
  assertOperatorCanTakeArbitrationRoundInTx,
  canAdvanceArbitrationRound,
  getArbitrationAutoAdvanceHoursForRound,
  getArbitrationEvidenceQuietSince,
  getArbitrationReviewRoundPolicy,
  getRecommendedArbitrationRoundAssigneeInTx,
  hasRecentArbitrationEvidenceActivitySinceInTx,
  isOperatorAllowedForArbitrationRound,
  isTerminalArbitrationRound,
} from "./round-policies";
import { loadVisibleArbitrationCaseOrThrow } from "./case-views";

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
