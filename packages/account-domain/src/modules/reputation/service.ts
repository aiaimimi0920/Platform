import type { ReputationSummary, ReputationTier } from "@neuro/contracts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import { getReputationTaskStats, listReputationHistoryByUser } from "@/modules/reputation/repository";
import { reputationHistory, reputationSnapshots } from "@/modules/reputation/schema";
import type {
  ReputationBreakdown,
  ReputationComputationInput,
  ReputationComputedResult,
  ReputationDispatchProfile,
  ReputationHistoryPoint,
  ReputationScoreFactors,
} from "@/modules/reputation/types";
import { BadRequestError } from "@/platform/errors";

function now() {
  return new Date();
}

function resolveTier(score: number): ReputationTier {
  if (score >= 280) return "platinum";
  if (score >= 200) return "gold";
  if (score >= 130) return "silver";
  return "bronze";
}

function toRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function calculateScoreFactors(args: ReputationComputationInput): ReputationScoreFactors {
  const trustBonus = (args.trustLevel ?? 0) * 6;
  return {
    baseScore: 100,
    trustBonus,
    completedContribution: args.completedTaskCount * 24,
    defaultedPenalty: args.defaultedTaskCount * 32,
    cancelledPenalty: args.cancelledTaskCount * 8,
    activeContribution: Math.min(args.activeTaskCount, 10),
    arbitrationWinBonus: args.favorableArbitrationCount * 14,
    arbitrationLossPenalty: args.unfavorableArbitrationCount * 18,
  };
}

function calculateScore(factors: ReputationScoreFactors) {
  const raw =
    factors.baseScore +
    factors.trustBonus +
    factors.completedContribution -
    factors.defaultedPenalty -
    factors.cancelledPenalty +
    factors.activeContribution +
    factors.arbitrationWinBonus -
    factors.arbitrationLossPenalty;
  return Math.max(0, raw);
}

function mapSummary(args: {
  userId: string;
  reputationScore: number;
  completedTaskCount: number;
  defaultedTaskCount: number;
  cancelledTaskCount: number;
  activeTaskCount: number;
  favorableArbitrationCount: number;
  unfavorableArbitrationCount: number;
  completionRate: number;
  defaultRate: number;
  tier: ReputationTier;
  updatedAt: Date;
}): ReputationSummary {
  return {
    userId: args.userId,
    reputationScore: args.reputationScore,
    completedTaskCount: args.completedTaskCount,
    defaultedTaskCount: args.defaultedTaskCount,
    cancelledTaskCount: args.cancelledTaskCount,
    activeTaskCount: args.activeTaskCount,
    favorableArbitrationCount: args.favorableArbitrationCount,
    unfavorableArbitrationCount: args.unfavorableArbitrationCount,
    completionRate: args.completionRate,
    defaultRate: args.defaultRate,
    tier: args.tier,
    updatedAt: args.updatedAt.toISOString(),
  };
}

function computeReputation(args: ReputationComputationInput): ReputationComputedResult {
  const handledTaskCount = args.completedTaskCount + args.defaultedTaskCount;
  const completionRate = toRate(args.completedTaskCount, handledTaskCount);
  const defaultRate = toRate(args.defaultedTaskCount, handledTaskCount);
  const factors = calculateScoreFactors(args);
  const reputationScore = calculateScore(factors);
  const tier = resolveTier(reputationScore);
  return {
    reputationScore,
    completionRate,
    defaultRate,
    tier,
    factors,
  };
}

async function upsertSnapshotInTx(
  tx: NodePgDatabase<any>,
  args: {
    userId: string;
    stats: ReputationComputationInput;
    computed: ReputationComputedResult;
    updatedAt: Date;
  },
) {
  await tx
    .insert(reputationSnapshots)
    .values({
      userId: args.userId,
      reputationScore: args.computed.reputationScore,
      completedTaskCount: args.stats.completedTaskCount,
      defaultedTaskCount: args.stats.defaultedTaskCount,
      cancelledTaskCount: args.stats.cancelledTaskCount,
      activeTaskCount: args.stats.activeTaskCount,
      favorableArbitrationCount: args.stats.favorableArbitrationCount,
      unfavorableArbitrationCount: args.stats.unfavorableArbitrationCount,
      trustLevel: args.stats.trustLevel ?? 0,
      baseScore: args.computed.factors.baseScore,
      trustBonus: args.computed.factors.trustBonus,
      completedContribution: args.computed.factors.completedContribution,
      defaultedPenalty: args.computed.factors.defaultedPenalty,
      cancelledPenalty: args.computed.factors.cancelledPenalty,
      activeContribution: args.computed.factors.activeContribution,
      arbitrationWinBonus: args.computed.factors.arbitrationWinBonus,
      arbitrationLossPenalty: args.computed.factors.arbitrationLossPenalty,
      completionRate: args.computed.completionRate,
      defaultRate: args.computed.defaultRate,
      tier: args.computed.tier,
      updatedAt: args.updatedAt,
    })
    .onConflictDoUpdate({
      target: reputationSnapshots.userId,
      set: {
        reputationScore: args.computed.reputationScore,
        completedTaskCount: args.stats.completedTaskCount,
        defaultedTaskCount: args.stats.defaultedTaskCount,
        cancelledTaskCount: args.stats.cancelledTaskCount,
        activeTaskCount: args.stats.activeTaskCount,
        favorableArbitrationCount: args.stats.favorableArbitrationCount,
        unfavorableArbitrationCount: args.stats.unfavorableArbitrationCount,
        trustLevel: args.stats.trustLevel ?? 0,
        baseScore: args.computed.factors.baseScore,
        trustBonus: args.computed.factors.trustBonus,
        completedContribution: args.computed.factors.completedContribution,
        defaultedPenalty: args.computed.factors.defaultedPenalty,
        cancelledPenalty: args.computed.factors.cancelledPenalty,
        activeContribution: args.computed.factors.activeContribution,
        arbitrationWinBonus: args.computed.factors.arbitrationWinBonus,
        arbitrationLossPenalty: args.computed.factors.arbitrationLossPenalty,
        completionRate: args.computed.completionRate,
        defaultRate: args.computed.defaultRate,
        tier: args.computed.tier,
        updatedAt: args.updatedAt,
      },
    });
}

async function appendHistoryInTx(
  tx: NodePgDatabase<any>,
  args: {
    userId: string;
    stats: ReputationComputationInput;
    computed: ReputationComputedResult;
    recordedAt: Date;
  },
) {
  await tx.insert(reputationHistory).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    reputationScore: args.computed.reputationScore,
    completedTaskCount: args.stats.completedTaskCount,
    defaultedTaskCount: args.stats.defaultedTaskCount,
    cancelledTaskCount: args.stats.cancelledTaskCount,
    activeTaskCount: args.stats.activeTaskCount,
    favorableArbitrationCount: args.stats.favorableArbitrationCount,
    unfavorableArbitrationCount: args.stats.unfavorableArbitrationCount,
    trustLevel: args.stats.trustLevel ?? 0,
    baseScore: args.computed.factors.baseScore,
    trustBonus: args.computed.factors.trustBonus,
    completedContribution: args.computed.factors.completedContribution,
    defaultedPenalty: args.computed.factors.defaultedPenalty,
    cancelledPenalty: args.computed.factors.cancelledPenalty,
    activeContribution: args.computed.factors.activeContribution,
    arbitrationWinBonus: args.computed.factors.arbitrationWinBonus,
    arbitrationLossPenalty: args.computed.factors.arbitrationLossPenalty,
    completionRate: args.computed.completionRate,
    defaultRate: args.computed.defaultRate,
    tier: args.computed.tier,
    recordedAt: args.recordedAt,
  });
}

function shouldAppendHistory(args: {
  previous: typeof reputationSnapshots.$inferSelect | null;
  stats: ReputationComputationInput;
  computed: ReputationComputedResult;
}) {
  const previous = args.previous;
  if (!previous) return true;

  return !(
    previous.reputationScore === args.computed.reputationScore &&
    previous.completedTaskCount === args.stats.completedTaskCount &&
    previous.defaultedTaskCount === args.stats.defaultedTaskCount &&
    previous.cancelledTaskCount === args.stats.cancelledTaskCount &&
    previous.activeTaskCount === args.stats.activeTaskCount &&
    previous.favorableArbitrationCount === args.stats.favorableArbitrationCount &&
    previous.unfavorableArbitrationCount === args.stats.unfavorableArbitrationCount &&
    previous.trustLevel === (args.stats.trustLevel ?? 0) &&
    previous.baseScore === args.computed.factors.baseScore &&
    previous.trustBonus === args.computed.factors.trustBonus &&
    previous.completedContribution === args.computed.factors.completedContribution &&
    previous.defaultedPenalty === args.computed.factors.defaultedPenalty &&
    previous.cancelledPenalty === args.computed.factors.cancelledPenalty &&
    previous.activeContribution === args.computed.factors.activeContribution &&
    previous.arbitrationWinBonus === args.computed.factors.arbitrationWinBonus &&
    previous.arbitrationLossPenalty === args.computed.factors.arbitrationLossPenalty &&
    previous.completionRate === args.computed.completionRate &&
    previous.defaultRate === args.computed.defaultRate &&
    previous.tier === args.computed.tier
  );
}

async function refreshReputationInTx(tx: NodePgDatabase<any>, userId: string) {
  const stats = await getReputationTaskStats(tx, userId);
  const computed = computeReputation(stats);
  const updatedAt = now();
  const [previousSnapshot] = await tx
    .select()
    .from(reputationSnapshots)
    .where(eq(reputationSnapshots.userId, userId));

  await upsertSnapshotInTx(tx, {
    userId,
    stats,
    computed,
    updatedAt,
  });

  if (
    shouldAppendHistory({
      previous: previousSnapshot ?? null,
      stats,
      computed,
    })
  ) {
    await appendHistoryInTx(tx, {
      userId,
      stats,
      computed,
      recordedAt: updatedAt,
    });
  }

  return { stats, computed, updatedAt };
}

export async function refreshReputationSummaryInTx(tx: NodePgDatabase<any>, userId: string) {
  const { computed, stats, updatedAt } = await refreshReputationInTx(tx, userId);
  return mapSummary({
    userId,
    reputationScore: computed.reputationScore,
    completedTaskCount: stats.completedTaskCount,
    defaultedTaskCount: stats.defaultedTaskCount,
    cancelledTaskCount: stats.cancelledTaskCount,
    activeTaskCount: stats.activeTaskCount,
    favorableArbitrationCount: stats.favorableArbitrationCount,
    unfavorableArbitrationCount: stats.unfavorableArbitrationCount,
    completionRate: computed.completionRate,
    defaultRate: computed.defaultRate,
    tier: computed.tier,
    updatedAt,
  });
}

export async function refreshReputationUsersInTx(tx: NodePgDatabase<any>, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => userId.trim().length > 0)));
  for (const userId of uniqueUserIds) {
    await refreshReputationInTx(tx, userId);
  }
}

function mapBreakdown(args: {
  userId: string;
  stats: ReputationComputationInput;
  computed: ReputationComputedResult;
  updatedAt: Date;
}): ReputationBreakdown {
  return {
    userId: args.userId,
    factors: args.computed.factors,
    inputs: args.stats,
    completionRate: args.computed.completionRate,
    defaultRate: args.computed.defaultRate,
    reputationScore: args.computed.reputationScore,
    tier: args.computed.tier,
    updatedAt: args.updatedAt.toISOString(),
  };
}

function mapHistoryPoint(row: typeof reputationHistory.$inferSelect): ReputationHistoryPoint {
  return {
    id: row.id,
    userId: row.userId,
    reputationScore: row.reputationScore,
    tier: row.tier as ReputationTier,
    completionRate: row.completionRate,
    defaultRate: row.defaultRate,
    completedTaskCount: row.completedTaskCount,
    defaultedTaskCount: row.defaultedTaskCount,
    cancelledTaskCount: row.cancelledTaskCount,
    activeTaskCount: row.activeTaskCount,
    favorableArbitrationCount: row.favorableArbitrationCount,
    unfavorableArbitrationCount: row.unfavorableArbitrationCount,
    trustLevel: row.trustLevel,
    factors: {
      baseScore: row.baseScore,
      trustBonus: row.trustBonus,
      completedContribution: row.completedContribution,
      defaultedPenalty: row.defaultedPenalty,
      cancelledPenalty: row.cancelledPenalty,
      activeContribution: row.activeContribution,
      arbitrationWinBonus: row.arbitrationWinBonus,
      arbitrationLossPenalty: row.arbitrationLossPenalty,
    },
    recordedAt: row.recordedAt.toISOString(),
  };
}

export async function getDispatchReputationProfilesInTx(
  tx: NodePgDatabase<any>,
  userIds: string[],
): Promise<Map<string, ReputationDispatchProfile>> {
  const profiles = new Map<string, ReputationDispatchProfile>();
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return profiles;

  for (const userId of uniqueUserIds) {
    const { stats, computed } = await refreshReputationInTx(tx, userId);

    profiles.set(userId, {
      userId,
      reputationScore: computed.reputationScore,
      completionRate: computed.completionRate,
      defaultRate: computed.defaultRate,
      trustLevel: stats.trustLevel ?? 0,
    });
  }

  return profiles;
}

export async function getReputationSummary(userId: string): Promise<ReputationSummary> {
  return db.transaction(async (tx) => {
    await refreshReputationInTx(tx, userId);

    const [snapshot] = await tx
      .select()
      .from(reputationSnapshots)
      .where(eq(reputationSnapshots.userId, userId));

    if (!snapshot) {
      throw new Error("Reputation snapshot missing after refresh");
    }

    return mapSummary({
      userId: snapshot.userId,
      reputationScore: snapshot.reputationScore,
      completedTaskCount: snapshot.completedTaskCount,
      defaultedTaskCount: snapshot.defaultedTaskCount,
      cancelledTaskCount: snapshot.cancelledTaskCount,
      activeTaskCount: snapshot.activeTaskCount,
      favorableArbitrationCount: snapshot.favorableArbitrationCount,
      unfavorableArbitrationCount: snapshot.unfavorableArbitrationCount,
      completionRate: snapshot.completionRate,
      defaultRate: snapshot.defaultRate,
      tier: snapshot.tier as ReputationTier,
      updatedAt: snapshot.updatedAt,
    });
  });
}

export async function getReputationBreakdown(userId: string): Promise<ReputationBreakdown> {
  return db.transaction(async (tx) => {
    const { stats, computed, updatedAt } = await refreshReputationInTx(tx, userId);
    return mapBreakdown({
      userId,
      stats,
      computed,
      updatedAt,
    });
  });
}

export async function getReputationHistory(userId: string, limit: number): Promise<ReputationHistoryPoint[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestError("reputation history limit must be an integer between 1 and 100");
  }

  return db.transaction(async (tx) => {
    const rows = await listReputationHistoryByUser(tx, userId, limit);
    return rows.map(mapHistoryPoint);
  });
}
