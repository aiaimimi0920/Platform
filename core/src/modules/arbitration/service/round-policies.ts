// Review round policy helpers: per-round policy resolution, operator pools,
// capacity assertions, load-balanced assignee recommendation, and the
// evidence quiet-window activity probe. Moved verbatim from service.ts.
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import {
  arbitrationCaseEvidences,
  arbitrationCaseReviewRounds,
} from "@/modules/arbitration/schema";
import { env } from "@/env";
import { ConflictError } from "@/platform/errors";

export function getArbitrationReviewRoundPolicy(roundNumber: number) {
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

export function getArbitrationClaimReleaseHoursForRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber === "number" && Number.isFinite(roundNumber) && roundNumber >= 1) {
    const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
    return roundPolicy.claimReleaseHours;
  }
  return env.arbitrationStaleClaimHours;
}

export function getArbitrationReviewRoundOperatorPool(
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

export function isOperatorAllowedForArbitrationRound(roundNumber: number | null | undefined, operatorUserId: string | null | undefined) {
  if (!operatorUserId) return false;
  return getArbitrationReviewRoundOperatorPool(roundNumber).includes(operatorUserId);
}

export async function getRecommendedArbitrationRoundAssigneeInTx(
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

export async function countOperatorOpenArbitrationRoundsInTx(
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

export async function assertOperatorCanTakeArbitrationRoundInTx(
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

export function getArbitrationAutoAdvanceHoursForRound(roundNumber: number | null | undefined) {
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

export function getArbitrationEvidenceQuietSince(args: {
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

export function canAdvanceArbitrationRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber) || roundNumber < 1) {
    return true;
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
  return roundPolicy.maxRoundNumber === null || roundNumber < roundPolicy.maxRoundNumber;
}

export function isTerminalArbitrationRound(roundNumber: number | null | undefined) {
  if (typeof roundNumber !== "number" || !Number.isFinite(roundNumber) || roundNumber < 1) {
    return false;
  }
  const roundPolicy = getArbitrationReviewRoundPolicy(roundNumber);
  return roundPolicy.maxRoundNumber !== null && roundNumber >= roundPolicy.maxRoundNumber;
}

export async function hasRecentArbitrationEvidenceActivitySinceInTx(
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
