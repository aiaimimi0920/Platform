import type {
  ArbitrationReviewRoundStatus,
  ArbitrationStatus,
  ArbitrationWorkloadView,
} from "@neuro/contracts";

export interface ArbitrationWorkloadCaseMetric {
  id: string;
  status: ArbitrationStatus;
  assignedOperatorUserId: string | null;
  claimedAt: Date | null;
  createdAt: Date;
}

export interface ArbitrationWorkloadEvidenceMetric {
  caseId: string;
  evidenceCount: number;
}

export interface ArbitrationWorkloadRoundMetric {
  caseId: string;
  roundNumber: number;
  status: ArbitrationReviewRoundStatus;
  assignedOperatorUserId: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export function getArbitrationClaimAgeHours(claimedAt: Date | null, referenceTime: Date) {
  if (!claimedAt) return null;
  return Math.max(0, Math.floor((referenceTime.getTime() - claimedAt.getTime()) / (60 * 60 * 1000)));
}

export function getArbitrationReviewRoundAgeHours(startedAt: Date, endedAt: Date | null, referenceTime: Date) {
  const effectiveEnd = endedAt ?? referenceTime;
  return Math.max(0, Math.floor((effectiveEnd.getTime() - startedAt.getTime()) / (60 * 60 * 1000)));
}

function getArbitrationRoundAgeBucket(roundAgeHours: number, staleHours: number) {
  const threshold = Math.max(1, staleHours);
  if (roundAgeHours >= threshold) return "stale";
  if (roundAgeHours >= Math.max(1, Math.floor(threshold / 2))) return "approaching_stale";
  return "fresh";
}

export function buildArbitrationCaseWorkload(args: {
  cases: ArbitrationWorkloadCaseMetric[];
  evidenceMetrics: ArbitrationWorkloadEvidenceMetric[];
  reviewRounds: ArbitrationWorkloadRoundMetric[];
  userId: string;
  operatorUserIds: string[];
  staleClaimHours: number;
  referenceTime: Date;
  getRoundStaleHours: (roundNumber: number) => number;
}): ArbitrationWorkloadView {
  const evidenceCountByCaseId = new Map<string, number>();
  for (const metric of args.evidenceMetrics) {
    evidenceCountByCaseId.set(metric.caseId, (evidenceCountByCaseId.get(metric.caseId) ?? 0) + Number(metric.evidenceCount));
  }

  const reviewRoundsByCaseId = new Map<string, ArbitrationWorkloadRoundMetric[]>();
  for (const round of args.reviewRounds) {
    const rounds = reviewRoundsByCaseId.get(round.caseId) ?? [];
    rounds.push(round);
    reviewRoundsByCaseId.set(round.caseId, rounds);
  }

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

  for (const arbitrationCase of args.cases) {
    byStatus.set(arbitrationCase.status, (byStatus.get(arbitrationCase.status) ?? 0) + 1);
    const reviewRounds = reviewRoundsByCaseId.get(arbitrationCase.id) ?? [];
    for (const round of reviewRounds) {
      byReviewRoundStatus.set(round.status, (byReviewRoundStatus.get(round.status) ?? 0) + 1);
      const roundAgeHours = getArbitrationReviewRoundAgeHours(round.startedAt, round.endedAt, args.referenceTime);
      const isRoundStale = round.status === "open" && roundAgeHours >= args.getRoundStaleHours(round.roundNumber);
      if (round.status === "open") {
        const roundAssigneeKey = round.assignedOperatorUserId ?? "unassigned";
        const bucket = byRoundAssignee.get(roundAssigneeKey) ?? {
          openRoundCount: 0,
          staleRoundCount: 0,
          totalRoundAgeHours: 0,
          roundAgeSamples: 0,
        };
        bucket.openRoundCount += 1;
        bucket.totalRoundAgeHours += roundAgeHours;
        bucket.roundAgeSamples += 1;
        if (isRoundStale) bucket.staleRoundCount += 1;
        byRoundAssignee.set(roundAssigneeKey, bucket);
        if (!round.assignedOperatorUserId) unassignedOpenRoundCount += 1;
        const roundAgeBucket = getArbitrationRoundAgeBucket(roundAgeHours, args.getRoundStaleHours(round.roundNumber));
        byRoundAgeBucket.set(roundAgeBucket, (byRoundAgeBucket.get(roundAgeBucket) ?? 0) + 1);
      }
      if (isRoundStale) {
        staleRoundCount += 1;
        oldestStaleRoundAgeHours =
          oldestStaleRoundAgeHours === null ? roundAgeHours : Math.max(oldestStaleRoundAgeHours, roundAgeHours);
      }
    }

    if (arbitrationCase.assignedOperatorUserId) {
      claimedCount += 1;
      if (arbitrationCase.assignedOperatorUserId === args.userId) mineCount += 1;
      const claimAgeHours = getArbitrationClaimAgeHours(arbitrationCase.claimedAt, args.referenceTime) ?? 0;
      const stale = arbitrationCase.claimedAt !== null && claimAgeHours >= args.staleClaimHours;
      if (stale) staleClaimedCount += 1;
      const bucket = byAssignee.get(arbitrationCase.assignedOperatorUserId) ?? {
        claimedCount: 0,
        openRoundCount: 0,
        totalClaimAgeHours: 0,
        claimAgeSamples: 0,
        staleClaimCount: 0,
      };
      bucket.claimedCount += 1;
      bucket.openRoundCount += reviewRounds.filter((round) => round.status === "open").length;
      bucket.totalClaimAgeHours += claimAgeHours;
      bucket.claimAgeSamples += 1;
      if (stale) bucket.staleClaimCount += 1;
      byAssignee.set(arbitrationCase.assignedOperatorUserId, bucket);
      continue;
    }

    unclaimedCount += 1;
    const currentReviewRoundNumber =
      reviewRounds.filter((round) => round.status === "open").at(-1)?.roundNumber ??
      reviewRounds.at(-1)?.roundNumber ??
      1;
    const candidate = {
      caseId: arbitrationCase.id,
      status: arbitrationCase.status,
      currentReviewRoundNumber,
      evidenceCount: evidenceCountByCaseId.get(arbitrationCase.id) ?? 0,
      createdAt: arbitrationCase.createdAt.toISOString(),
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
        if (right.evidenceCount === left.evidenceCount && right.createdAt < left.createdAt) nextClaimCandidate = right;
      }
    }
  }

  for (const operatorId of args.operatorUserIds) {
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
    autoReleaseEnabled: args.staleClaimHours > 0,
    autoReleaseIntervalMinutes: null,
  };
}
