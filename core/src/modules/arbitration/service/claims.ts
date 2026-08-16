// Claim/assignment lifecycle: prioritized claim-next, direct claim, operator
// assignment, manual release, and the stale-claim release sweep. Moved
// verbatim from service.ts.
import type {
  ArbitrationCaseView,
} from "@neuro/contracts";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { env } from "@/env";
import {
  arbitrationCases,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";

import { isPlatformOperator, now } from "./shared";
import {
  assertOperatorCanTakeArbitrationRoundInTx,
  getArbitrationClaimReleaseHoursForRound,
  getArbitrationEvidenceQuietSince,
  hasRecentArbitrationEvidenceActivitySinceInTx,
  isTerminalArbitrationRound,
} from "./round-policies";
import { loadVisibleArbitrationCaseOrThrow } from "./case-views";

/**
 * Keep claim-next ordering equivalent to the round-policy resolver while still
 * doing the ranking in PostgreSQL.  Policies may be overridden per round via
 * ARBITRATION_REVIEW_ROUND_POLICIES_JSON, so a fixed interval would silently
 * change which cases are considered stale (especially for rounds 2 and 3).
 */
function getRoundStaleHoursSql() {
  const clauses = Object.entries(env.arbitrationReviewRoundPolicies)
    .flatMap(([key, policy]) => {
      const match = /^round:(\d+)$/.exec(key);
      if (!match) return [];
      const roundNumber = Number(match[1]);
      if (!Number.isSafeInteger(roundNumber) || roundNumber < 1) return [];
      return [sql`when open_round.round_number = ${roundNumber} then ${policy.staleHours}`];
    });

  if (clauses.length === 0) {
    return sql`${env.arbitrationReviewRoundStaleHours}`;
  }

  return sql`case ${sql.join(clauses, sql` `)} else ${env.arbitrationReviewRoundStaleHours} end`;
}

export async function claimNextArbitrationCase(userId: string): Promise<ArbitrationCaseView | null> {
  if (!isPlatformOperator(userId)) {
    throw new UnauthorizedError("Only platform operators can claim arbitration cases");
  }

  const claimedCaseId = await db.transaction(async (tx) => {
    const staleHoursSql = getRoundStaleHoursSql();
    // Rank and lock a bounded candidate set in PostgreSQL. The old implementation
    // hydrated every case and every review round before trying claims in JS, which
    // was both unbounded and vulnerable to a race between ranking and claiming.
    const candidateRows = await tx.execute(sql`
      select
        ac.id as case_id,
        ac.status as case_status,
        ac.created_at,
        open_round.id as open_round_id,
        open_round.round_number as open_round_number,
        open_round.started_at as open_round_started_at,
        coalesce(open_round.round_number, latest_round.round_number, 1) as current_round_number,
        (
          select count(*)::int
          from arbitration_case_evidences ace
          where ace.case_id = ac.id
        ) as evidence_count
      from arbitration_cases ac
      left join lateral (
        select rr.id, rr.round_number, rr.started_at
        from arbitration_case_review_rounds rr
        where rr.case_id = ac.id and rr.status = 'open'
        order by rr.round_number desc
        limit 1
      ) open_round on true
      left join lateral (
        select rr.round_number
        from arbitration_case_review_rounds rr
        where rr.case_id = ac.id
        order by rr.round_number desc
        limit 1
      ) latest_round on true
      where ac.status in ('open', 'under_review')
        and ac.assigned_operator_user_id is null
      order by
        case
          when open_round.started_at is not null
            and open_round.started_at <= now() - make_interval(hours => (${staleHoursSql})::int)
          then 1 else 0
        end desc,
        case ac.status when 'under_review' then 2 when 'open' then 1 else 0 end desc,
        coalesce(open_round.round_number, latest_round.round_number, 1) desc,
        evidence_count desc,
        ac.created_at asc,
        ac.id asc
      for update of ac skip locked
      limit 100
    `);

    for (const row of candidateRows.rows as Array<{
      case_id: string;
      open_round_id: string | null;
      open_round_number: number | string | null;
    }>) {
      const caseId = String(row.case_id);
      const roundNumber = row.open_round_number === null ? null : Number(row.open_round_number);
      if (row.open_round_id && roundNumber !== null) {
        try {
          await assertOperatorCanTakeArbitrationRoundInTx(tx, {
            operatorUserId: userId,
            roundNumber,
            excludeCaseId: caseId,
            excludeRoundId: String(row.open_round_id),
          });
        } catch (error) {
          if (error instanceof ConflictError) continue;
          throw error;
        }
      }

      const timestamp = now();
      const [updated] = await tx
        .update(arbitrationCases)
        .set({
          assignedOperatorUserId: userId,
          claimedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(and(eq(arbitrationCases.id, caseId), isNull(arbitrationCases.assignedOperatorUserId)))
        .returning({ id: arbitrationCases.id });
      if (!updated) continue;

      if (row.open_round_id) {
        await tx
          .update(arbitrationCaseReviewRounds)
          .set({ assignedOperatorUserId: userId })
          .where(eq(arbitrationCaseReviewRounds.id, String(row.open_round_id)));
      }
      return updated.id;
    }
    return null;
  });

  return claimedCaseId ? loadVisibleArbitrationCaseOrThrow(userId, claimedCaseId) : null;
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
