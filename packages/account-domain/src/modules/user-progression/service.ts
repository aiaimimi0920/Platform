import type { UserProgressionSnapshot } from "@neuro/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "../../db/client";
import * as schema from "../../db/schema";
import { env } from "../../env";
import type { PlatformProgressionMetrics } from "../../platform/core-integration/service";
import { buildUserProgressionSnapshot, type UserProgressionMetricValues } from "./model";
import { buildPublishedTaskCreatorFilter } from "./task-scope";

export { buildUserProgressionSnapshot, getUserProgressionAccessRule } from "./model";

type DbTx = NodePgDatabase<any>;

type UserProgressionSeed = {
  userId: string;
  trustLevel: number | null;
};

function toCount(row: Array<{ count: number }>): number {
  return row[0]?.count ?? 0;
}

export async function getUserProgressionSnapshot(
  seed: UserProgressionSeed,
  tx: DbTx = db,
  platformMetrics: PlatformProgressionMetrics | null = null,
): Promise<UserProgressionSnapshot> {
  const dailyRewardCountRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.personalMissionClaims)
    .innerJoin(
      schema.personalMissionDefinitions,
      eq(schema.personalMissionClaims.missionId, schema.personalMissionDefinitions.id),
    )
    .where(
      and(
        eq(schema.personalMissionClaims.userId, seed.userId),
        eq(schema.personalMissionDefinitions.kind, "checkin"),
      ),
    );
  const dailyMissionCountRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.personalMissionClaims)
    .innerJoin(
      schema.personalMissionDefinitions,
      eq(schema.personalMissionClaims.missionId, schema.personalMissionDefinitions.id),
    )
    .where(
      and(
        eq(schema.personalMissionClaims.userId, seed.userId),
        eq(schema.personalMissionDefinitions.kind, "daily"),
      ),
    );
  const weeklyMissionCountRow = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.personalMissionClaims)
    .innerJoin(
      schema.personalMissionDefinitions,
      eq(schema.personalMissionClaims.missionId, schema.personalMissionDefinitions.id),
    )
    .where(
      and(
        eq(schema.personalMissionClaims.userId, seed.userId),
        eq(schema.personalMissionDefinitions.kind, "weekly"),
      ),
    );

  const metrics: UserProgressionMetricValues = {
    dailyRewardCount: toCount(dailyRewardCountRow),
    dailyMissionCount: toCount(dailyMissionCountRow),
    weeklyMissionCount: toCount(weeklyMissionCountRow),
    taskApplicationCount: 0,
    taskCreatedCount: 0,
    taskCompletedCount: 0,
    itemOwnedCount: 0,
    opinionCreatedCount: 0,
    opinionParticipationCount: 0,
    agentCreatedCount: 0,
    agentCapabilityCount: 0,
  };

  if (!env.usesDedicatedDatabase) {
    const taskApplicationCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.taskApplications)
      .where(eq(schema.taskApplications.applicantUserId, seed.userId));
    const taskCreatedCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .where(buildPublishedTaskCreatorFilter(seed.userId));
    const taskCompletedCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.assignedUserId, seed.userId), eq(schema.tasks.status, "accepted")));
    const itemOwnedCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.items)
      .where(eq(schema.items.userId, seed.userId));
    const opinionCreatedCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.opinionTopics)
      .where(eq(schema.opinionTopics.creatorUserId, seed.userId));
    const opinionSupportCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.opinionTopicSupports)
      .where(eq(schema.opinionTopicSupports.userId, seed.userId));
    const opinionOpposeCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.opinionTopicOpposes)
      .where(eq(schema.opinionTopicOpposes.userId, seed.userId));
    const agentCreatedCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(eq(schema.agents.ownerUserId, seed.userId));
    const agentCapabilityCountRow = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agentCapabilities)
      .innerJoin(schema.agents, eq(schema.agentCapabilities.agentId, schema.agents.id))
      .where(eq(schema.agents.ownerUserId, seed.userId));

    metrics.taskApplicationCount = toCount(taskApplicationCountRow);
    metrics.taskCreatedCount = toCount(taskCreatedCountRow);
    metrics.taskCompletedCount = toCount(taskCompletedCountRow);
    metrics.itemOwnedCount = toCount(itemOwnedCountRow);
    metrics.opinionCreatedCount = toCount(opinionCreatedCountRow);
    metrics.opinionParticipationCount = toCount(opinionSupportCountRow) + toCount(opinionOpposeCountRow);
    metrics.agentCreatedCount = toCount(agentCreatedCountRow);
    metrics.agentCapabilityCount = toCount(agentCapabilityCountRow);
  } else if (platformMetrics) {
    metrics.taskApplicationCount = platformMetrics.taskApplicationCount;
    metrics.taskCreatedCount = platformMetrics.taskCreatedCount;
    metrics.taskCompletedCount = platformMetrics.taskCompletedCount;
    metrics.itemOwnedCount = platformMetrics.itemOwnedCount;
    metrics.opinionCreatedCount = platformMetrics.opinionCreatedCount;
    metrics.opinionParticipationCount = platformMetrics.opinionParticipationCount;
    metrics.agentCreatedCount = platformMetrics.agentCreatedCount;
    metrics.agentCapabilityCount = platformMetrics.agentCapabilityCount;
  }

  return buildUserProgressionSnapshot({
    trustLevel: seed.trustLevel,
    metrics,
  });
}
