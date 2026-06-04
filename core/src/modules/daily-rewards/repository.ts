import type { DailyMissionKey, WeeklyMissionKey } from "@neuro/contracts";
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { dailyMissionClaims, dailyRewardClaims } from "@/modules/daily-rewards/schema";
import { mailboxAttachments, mailboxMessages } from "@/modules/redemption-mailbox-marketplace/schema";
import { taskApplications } from "@/modules/task-hub/schema";
import { orders } from "@/modules/product-order-item/schema";
import { opinionTopicSupports } from "@/modules/opinion-hub/schema";
import { weeklyMissionClaims } from "@/modules/daily-rewards/schema";

export async function getLatestDailyRewardClaim(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
) {
  const [claim] = await tx
    .select()
    .from(dailyRewardClaims)
    .where(eq(dailyRewardClaims.userId, userId))
    .orderBy(desc(dailyRewardClaims.claimedAt))
    .limit(1);

  return claim ?? null;
}

export async function getDailyRewardClaimByDate(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  rewardDate: string,
) {
  const [claim] = await tx
    .select()
    .from(dailyRewardClaims)
    .where(and(eq(dailyRewardClaims.userId, userId), eq(dailyRewardClaims.rewardDate, rewardDate)))
    .limit(1);

  return claim ?? null;
}

export async function listDailyMissionClaimsByDate(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  rewardDate: string,
) {
  return tx
    .select()
    .from(dailyMissionClaims)
    .where(and(eq(dailyMissionClaims.userId, userId), eq(dailyMissionClaims.rewardDate, rewardDate)));
}

export async function getDailyMissionClaimByDateAndKey(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  rewardDate: string,
  missionKey: DailyMissionKey,
) {
  const [claim] = await tx
    .select()
    .from(dailyMissionClaims)
    .where(
      and(
        eq(dailyMissionClaims.userId, userId),
        eq(dailyMissionClaims.rewardDate, rewardDate),
        eq(dailyMissionClaims.missionKey, missionKey),
      ),
    )
    .limit(1);

  return claim ?? null;
}

export async function getDailyMissionProgressCounts(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  from: Date,
  to: Date,
  missionKeys: DailyMissionKey[],
): Promise<Record<DailyMissionKey, number>> {
  const requested = new Set(missionKeys);
  const progress: Record<DailyMissionKey, number> = {
    taskApply: 0,
    mailClaim: 0,
    productPurchase: 0,
  };

  if (requested.has("taskApply")) {
    const [taskApplyRow] = await tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(
        and(
          eq(taskApplications.applicantUserId, userId),
          gte(taskApplications.createdAt, from),
          lt(taskApplications.createdAt, to),
        ),
      );
    progress.taskApply = Number(taskApplyRow?.count ?? 0);
  }

  if (requested.has("mailClaim")) {
    const [mailClaimRow] = await tx
      .select({ count: count(mailboxAttachments.id) })
      .from(mailboxAttachments)
      .innerJoin(mailboxMessages, eq(mailboxAttachments.messageId, mailboxMessages.id))
      .where(
        and(
          eq(mailboxMessages.userId, userId),
          gte(mailboxAttachments.claimedAt, from),
          lt(mailboxAttachments.claimedAt, to),
        ),
      );
    progress.mailClaim = Number(mailClaimRow?.count ?? 0);
  }

  if (requested.has("productPurchase")) {
    const [productPurchaseRow] = await tx
      .select({ count: count(orders.id) })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, from),
          lt(orders.createdAt, to),
        ),
      );
    progress.productPurchase = Number(productPurchaseRow?.count ?? 0);
  }

  return progress;
}

export async function listWeeklyMissionClaimsByWeek(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  weekKey: string,
) {
  return tx
    .select()
    .from(weeklyMissionClaims)
    .where(and(eq(weeklyMissionClaims.userId, userId), eq(weeklyMissionClaims.weekKey, weekKey)));
}

export async function getWeeklyMissionClaimByWeekAndKey(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  weekKey: string,
  missionKey: WeeklyMissionKey,
) {
  const [claim] = await tx
    .select()
    .from(weeklyMissionClaims)
    .where(
      and(
        eq(weeklyMissionClaims.userId, userId),
        eq(weeklyMissionClaims.weekKey, weekKey),
        eq(weeklyMissionClaims.missionKey, missionKey),
      ),
    )
    .limit(1);

  return claim ?? null;
}

export async function getWeeklyMissionProgressCounts(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
  from: Date,
  to: Date,
  missionKeys: WeeklyMissionKey[],
): Promise<Record<WeeklyMissionKey, number>> {
  const requested = new Set(missionKeys);
  const progress: Record<WeeklyMissionKey, number> = {
    dailyCheckIn: 0,
    taskApply: 0,
    productPurchase: 0,
    opinionSupport: 0,
  };

  if (requested.has("dailyCheckIn")) {
    const [dailyCheckInRow] = await tx
      .select({ count: count(dailyRewardClaims.id) })
      .from(dailyRewardClaims)
      .where(
        and(
          eq(dailyRewardClaims.userId, userId),
          gte(dailyRewardClaims.claimedAt, from),
          lt(dailyRewardClaims.claimedAt, to),
        ),
      );
    progress.dailyCheckIn = Number(dailyCheckInRow?.count ?? 0);
  }

  if (requested.has("taskApply")) {
    const [taskApplyRow] = await tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(
        and(
          eq(taskApplications.applicantUserId, userId),
          gte(taskApplications.createdAt, from),
          lt(taskApplications.createdAt, to),
        ),
      );
    progress.taskApply = Number(taskApplyRow?.count ?? 0);
  }

  if (requested.has("productPurchase")) {
    const [productPurchaseRow] = await tx
      .select({ count: count(orders.id) })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          gte(orders.createdAt, from),
          lt(orders.createdAt, to),
        ),
      );
    progress.productPurchase = Number(productPurchaseRow?.count ?? 0);
  }

  if (requested.has("opinionSupport")) {
    const [opinionSupportRow] = await tx
      .select({ count: count(opinionTopicSupports.id) })
      .from(opinionTopicSupports)
      .where(
        and(
          eq(opinionTopicSupports.userId, userId),
          gte(opinionTopicSupports.createdAt, from),
          lt(opinionTopicSupports.createdAt, to),
        ),
      );
    progress.opinionSupport = Number(opinionSupportRow?.count ?? 0);
  }

  return progress;
}
