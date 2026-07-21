import type { AgentSnapshot, AssetSnapshot, DailyMissionKey, WeeklyMissionKey } from "@neuro/contracts";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { CoreAccountProductSnapshot } from "@/modules/account-integration/types";
import { getDailyMissionProgressCounts, getWeeklyMissionProgressCounts } from "@/modules/daily-rewards/repository";
import { ensureDefaultProducts } from "@/modules/product-order-item/service";
import { getReputationTaskStats } from "@/modules/reputation/repository";

import { buildPublishedTaskCreatorFilter } from "./task-scope";

type DbTx = NodePgDatabase<typeof schema>;

type PlatformDailyMissionKey = Extract<DailyMissionKey, "taskApply" | "productPurchase">;
type PlatformWeeklyMissionKey = Extract<WeeklyMissionKey, "taskApply" | "productPurchase" | "opinionSupport">;

export type CoreAccountPlatformSummary = {
  agents: AgentSnapshot;
  assets: AssetSnapshot;
  progressionMetrics: {
    taskApplicationCount: number;
    taskCreatedCount: number;
    taskCompletedCount: number;
    itemOwnedCount: number;
    opinionCreatedCount: number;
    opinionParticipationCount: number;
    agentCreatedCount: number;
    agentCapabilityCount: number;
  };
  reputationStats: {
    completedTaskCount: number;
    defaultedTaskCount: number;
    cancelledTaskCount: number;
    activeTaskCount: number;
    favorableArbitrationCount: number;
    unfavorableArbitrationCount: number;
  };
};

function mapProductSnapshot(product: typeof schema.products.$inferSelect): CoreAccountProductSnapshot {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    kind: product.kind,
    currency: product.currency,
    price: product.price,
    fulfillmentMode: product.fulfillmentMode,
    transferable: product.transferable,
    active: product.active,
    allowDiscountCodes: product.allowDiscountCodes,
    limitScope: product.limitScope,
    durationDays: product.durationDays,
    unitCount: product.unitCount,
    warrantyDays: product.warrantyDays,
    stockLabel: product.stockLabel,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function toCount(row: Array<{ count: number }>): number {
  return Number(row[0]?.count ?? 0);
}

async function getAgentSnapshot(tx: DbTx, userId: string): Promise<AgentSnapshot> {
  const [totalAgentRow, enabledAgentRow, externalAgentRow, capabilityRow, activeExecutionRow] = await Promise.all([
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(eq(schema.agents.ownerUserId, userId)),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(and(eq(schema.agents.ownerUserId, userId), eq(schema.agents.enabled, true))),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents)
      .where(and(eq(schema.agents.ownerUserId, userId), eq(schema.agents.sourceType, "external"))),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agentCapabilities)
      .innerJoin(schema.agents, eq(schema.agentCapabilities.agentId, schema.agents.id))
      .where(eq(schema.agents.ownerUserId, userId)),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agentExecutions)
      .where(
        and(
          eq(schema.agentExecutions.ownerUserId, userId),
          inArray(schema.agentExecutions.status, ["queued", "running", "submitted"]),
        ),
      ),
  ]);

  return {
    totalAgents: toCount(totalAgentRow),
    enabledAgents: toCount(enabledAgentRow),
    externalAgents: toCount(externalAgentRow),
    capabilityCount: toCount(capabilityRow),
    activeExecutions: toCount(activeExecutionRow),
  };
}

async function getAssetSnapshot(tx: DbTx, userId: string): Promise<AssetSnapshot> {
  const [totalItemRow, activeItemRow, listedItemRow] = await Promise.all([
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.items)
      .where(eq(schema.items.userId, userId)),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.items)
      .where(and(eq(schema.items.userId, userId), eq(schema.items.status, "active"))),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.items)
      .where(and(eq(schema.items.userId, userId), eq(schema.items.status, "listed"))),
  ]);

  return {
    totalItems: toCount(totalItemRow),
    activeItems: toCount(activeItemRow),
    listedItems: toCount(listedItemRow),
  };
}

export async function getCoreAccountPlatformSummary(
  userId: string,
  tx: DbTx = db,
): Promise<CoreAccountPlatformSummary> {
  const [agents, assets, taskApplicationCountRow, taskCreatedCountRow, opinionCreatedCountRow, opinionSupportCountRow, opinionOpposeCountRow, reputationStats] =
    await Promise.all([
      getAgentSnapshot(tx, userId),
      getAssetSnapshot(tx, userId),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.taskApplications)
        .where(eq(schema.taskApplications.applicantUserId, userId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.tasks)
        .where(buildPublishedTaskCreatorFilter(userId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.opinionTopics)
        .where(eq(schema.opinionTopics.creatorUserId, userId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.opinionTopicSupports)
        .where(eq(schema.opinionTopicSupports.userId, userId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.opinionTopicOpposes)
        .where(eq(schema.opinionTopicOpposes.userId, userId)),
      getReputationTaskStats(tx, userId),
    ]);

  return {
    agents,
    assets,
    progressionMetrics: {
      taskApplicationCount: toCount(taskApplicationCountRow),
      taskCreatedCount: toCount(taskCreatedCountRow),
      taskCompletedCount: reputationStats.completedTaskCount,
      itemOwnedCount: assets.totalItems,
      opinionCreatedCount: toCount(opinionCreatedCountRow),
      opinionParticipationCount: toCount(opinionSupportCountRow) + toCount(opinionOpposeCountRow),
      agentCreatedCount: agents.totalAgents,
      agentCapabilityCount: agents.capabilityCount,
    },
    reputationStats: {
      completedTaskCount: reputationStats.completedTaskCount,
      defaultedTaskCount: reputationStats.defaultedTaskCount,
      cancelledTaskCount: reputationStats.cancelledTaskCount,
      activeTaskCount: reputationStats.activeTaskCount,
      favorableArbitrationCount: reputationStats.favorableArbitrationCount,
      unfavorableArbitrationCount: reputationStats.unfavorableArbitrationCount,
    },
  };
}

export async function getCoreAccountProductSnapshot(
  productId: string,
  tx: DbTx = db,
): Promise<CoreAccountProductSnapshot | null> {
  await ensureDefaultProducts();
  const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, productId)).limit(1);
  return product ? mapProductSnapshot(product) : null;
}

export async function listCoreAccountProductSnapshots(tx: DbTx = db): Promise<CoreAccountProductSnapshot[]> {
  await ensureDefaultProducts();
  const productRows = await tx.select().from(schema.products).orderBy(schema.products.updatedAt, schema.products.id);
  return productRows.map(mapProductSnapshot);
}

export async function getCoreAccountMissionProgress(
  args: {
    userId: string;
    scope: "daily";
    from: Date;
    to: Date;
    keys: PlatformDailyMissionKey[];
  },
  tx?: DbTx,
): Promise<Record<PlatformDailyMissionKey, number>>;
export async function getCoreAccountMissionProgress(
  args: {
    userId: string;
    scope: "weekly";
    from: Date;
    to: Date;
    keys: PlatformWeeklyMissionKey[];
  },
  tx?: DbTx,
): Promise<Record<PlatformWeeklyMissionKey, number>>;
export async function getCoreAccountMissionProgress(
  args: {
    userId: string;
    scope: "daily" | "weekly";
    from: Date;
    to: Date;
    keys: Array<PlatformDailyMissionKey | PlatformWeeklyMissionKey>;
  },
  tx: DbTx = db,
): Promise<Record<string, number>> {
  if (args.scope === "daily") {
    const dailyKeys = args.keys as PlatformDailyMissionKey[];
    if (dailyKeys.length === 0) {
      return {};
    }

    const progress = await getDailyMissionProgressCounts(tx, args.userId, args.from, args.to, dailyKeys);
    return Object.fromEntries(dailyKeys.map((key) => [key, progress[key]]));
  }

  const weeklyKeys = args.keys as PlatformWeeklyMissionKey[];
  if (weeklyKeys.length === 0) {
    return {};
  }

  const progress = await getWeeklyMissionProgressCounts(tx, args.userId, args.from, args.to, weeklyKeys);
  return Object.fromEntries(weeklyKeys.map((key) => [key, progress[key]]));
}
