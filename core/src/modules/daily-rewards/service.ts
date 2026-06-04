import {
  dailyMissionKeys,
  type DailyMissionClaimResult,
  type DailyMissionKey,
  type DailyMissionView,
  type DailyRewardClaimResult,
  type DailyRewardStatus,
  type WeeklyMissionClaimResult,
  type WeeklyMissionKey,
  type WeeklyMissionView,
  weeklyMissionKeys,
} from "@neuro/contracts";
import { grantBalance } from "@neuro/account-domain";

import { db } from "@/db/client";
import {
  getDailyMissionClaimByDateAndKey,
  getDailyMissionProgressCounts,
  getDailyRewardClaimByDate,
  getWeeklyMissionClaimByWeekAndKey,
  getWeeklyMissionProgressCounts,
  getLatestDailyRewardClaim,
  listDailyMissionClaimsByDate,
  listWeeklyMissionClaimsByWeek,
} from "@/modules/daily-rewards/repository";
import { dailyMissionClaims, dailyRewardClaims, weeklyMissionClaims } from "@/modules/daily-rewards/schema";
import type { DailyRewardWindow, WeeklyRewardWindow } from "@/modules/daily-rewards/types";
import { BadRequestError, ConflictError } from "@/platform/errors";
import { getFeatureSnapshot } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
const DAILY_REWARD_CURRENCY = "mira" as const;
const DAILY_REWARD_AMOUNT = 20;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const DAILY_MISSION_CONFIG: Record<
  DailyMissionKey,
  {
    title: string;
    description: string;
    rewardAmount: number;
    progressTarget: number;
    dependencyModule: "taskHub" | "mailbox" | "product";
  }
> = {
  taskApply: {
    title: "任务申请",
    description: "今日成功提交至少 1 次任务申请",
    rewardAmount: 8,
    progressTarget: 1,
    dependencyModule: "taskHub",
  },
  mailClaim: {
    title: "邮箱领取",
    description: "今日领取至少 1 个站内邮箱附件",
    rewardAmount: 6,
    progressTarget: 1,
    dependencyModule: "mailbox",
  },
  productPurchase: {
    title: "商品购买",
    description: "今日完成至少 1 次商品购买",
    rewardAmount: 12,
    progressTarget: 1,
    dependencyModule: "product",
  },
};

const WEEKLY_MISSION_CONFIG: Record<
  WeeklyMissionKey,
  {
    title: string;
    description: string;
    rewardAmount: number;
    progressTarget: number;
    dependencyModule: "personalMissions" | "taskHub" | "product" | "opinionHub";
  }
> = {
  dailyCheckIn: {
    title: "周常签到",
    description: "本周完成至少 3 次每日签到",
    rewardAmount: 24,
    progressTarget: 3,
    dependencyModule: "personalMissions",
  },
  taskApply: {
    title: "周常申请",
    description: "本周成功提交至少 3 次任务申请",
    rewardAmount: 18,
    progressTarget: 3,
    dependencyModule: "taskHub",
  },
  productPurchase: {
    title: "周常采购",
    description: "本周完成至少 2 次商品购买",
    rewardAmount: 28,
    progressTarget: 2,
    dependencyModule: "product",
  },
  opinionSupport: {
    title: "周常治理",
    description: "本周至少使用意见券支持 2 次议题",
    rewardAmount: 16,
    progressTarget: 2,
    dependencyModule: "opinionHub",
  },
};

function now() {
  return new Date();
}

function toChinaDateKey(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function resolveDailyRewardWindow(date: Date): DailyRewardWindow {
  const dayKey = toChinaDateKey(date);
  const [year, month, day] = dayKey.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - SHANGHAI_OFFSET_MS);
  const to = new Date(from.getTime() + ONE_DAY_MS);
  return { dayKey, from, to };
}

function resolveWeeklyRewardWindow(date: Date): WeeklyRewardWindow {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const weekday = shifted.getUTCDay();
  const deltaToMonday = weekday === 0 ? 6 : weekday - 1;
  const mondayShifted = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - deltaToMonday, 0, 0, 0),
  );
  const from = new Date(mondayShifted.getTime() - SHANGHAI_OFFSET_MS);
  const to = new Date(from.getTime() + ONE_DAY_MS * 7);
  return {
    weekKey: mondayShifted.toISOString().slice(0, 10),
    from,
    to,
  };
}

function nextChinaMidnight(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - SHANGHAI_OFFSET_MS);
}

function previousChinaDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString().slice(0, 10);
}

function buildStatus(args: {
  rewardAmount: number;
  streakDays: number;
  todayClaimed: boolean;
  lastClaimedAt: Date | null;
  nextEligibleAt: Date | null;
}): DailyRewardStatus {
  return {
    rewardCurrency: DAILY_REWARD_CURRENCY,
    rewardAmount: args.rewardAmount,
    streakDays: args.streakDays,
    todayClaimed: args.todayClaimed,
    lastClaimedAt: args.lastClaimedAt ? args.lastClaimedAt.toISOString() : null,
    nextEligibleAt: args.nextEligibleAt ? args.nextEligibleAt.toISOString() : null,
  };
}

function isDailyRewardDuplicateClaim(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

function isDailyMissionDuplicateClaim(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

function buildDailyMissionView(args: {
  missionKey: DailyMissionKey;
  progressCurrent: number;
  claimed: boolean;
}): DailyMissionView {
  const config = DAILY_MISSION_CONFIG[args.missionKey];
  const completed = args.progressCurrent >= config.progressTarget;
  return {
    key: args.missionKey,
    title: config.title,
    description: config.description,
    rewardCurrency: DAILY_REWARD_CURRENCY,
    rewardAmount: config.rewardAmount,
    progressCurrent: args.progressCurrent,
    progressTarget: config.progressTarget,
    completed,
    claimed: args.claimed,
  };
}

function buildWeeklyMissionView(args: {
  missionKey: WeeklyMissionKey;
  progressCurrent: number;
  claimed: boolean;
  weekKey: string;
}): WeeklyMissionView {
  const config = WEEKLY_MISSION_CONFIG[args.missionKey];
  const completed = args.progressCurrent >= config.progressTarget;
  return {
    key: args.missionKey,
    title: config.title,
    description: config.description,
    rewardCurrency: DAILY_REWARD_CURRENCY,
    rewardAmount: config.rewardAmount,
    progressCurrent: args.progressCurrent,
    progressTarget: config.progressTarget,
    completed,
    claimed: args.claimed,
    weekKey: args.weekKey,
  };
}

function assertMissionKey(input: string): DailyMissionKey {
  if (!dailyMissionKeys.includes(input as DailyMissionKey)) {
    throw new BadRequestError("不支持的日常任务类型");
  }
  return input as DailyMissionKey;
}

function assertWeeklyMissionKey(input: string): WeeklyMissionKey {
  if (!weeklyMissionKeys.includes(input as WeeklyMissionKey)) {
    throw new BadRequestError("不支持的周常任务类型");
  }
  return input as WeeklyMissionKey;
}

export async function getDailyRewardStatus(userId: string): Promise<DailyRewardStatus> {
  return db.transaction(async (tx) => {
    const todayKey = resolveDailyRewardWindow(now()).dayKey;
    const latestClaim = await getLatestDailyRewardClaim(tx, userId);
    const todayClaim = latestClaim?.rewardDate === todayKey
      ? latestClaim
      : await getDailyRewardClaimByDate(tx, userId, todayKey);

    let streakDays = 0;
    if (todayClaim) {
      streakDays = todayClaim.streakDaysAfterClaim;
    } else if (latestClaim && latestClaim.rewardDate === previousChinaDateKey(todayKey)) {
      streakDays = latestClaim.streakDaysAfterClaim;
    }

    return buildStatus({
      rewardAmount: DAILY_REWARD_AMOUNT,
      streakDays,
      todayClaimed: Boolean(todayClaim),
      lastClaimedAt: latestClaim?.claimedAt ?? null,
      nextEligibleAt: todayClaim ? nextChinaMidnight(todayKey) : null,
    });
  });
}

export async function claimDailyReward(userId: string): Promise<DailyRewardClaimResult> {
  try {
    return await db.transaction(async (tx) => {
      const claimTime = now();
      const todayKey = toChinaDateKey(claimTime);
      const todayClaim = await getDailyRewardClaimByDate(tx, userId, todayKey);
      if (todayClaim) {
        throw new ConflictError("今日签到奖励已经领取过了");
      }

      const latestClaim = await getLatestDailyRewardClaim(tx, userId);
      const streakDays =
        latestClaim && latestClaim.rewardDate === previousChinaDateKey(todayKey)
          ? latestClaim.streakDaysAfterClaim + 1
          : 1;

      await tx.insert(dailyRewardClaims).values({
        id: crypto.randomUUID(),
        userId,
        rewardDate: todayKey,
        rewardCurrency: DAILY_REWARD_CURRENCY,
        rewardAmount: DAILY_REWARD_AMOUNT,
        streakDaysAfterClaim: streakDays,
        claimedAt: claimTime,
      });

      await grantBalance(
        userId,
        DAILY_REWARD_CURRENCY,
        DAILY_REWARD_AMOUNT,
        `每日签到奖励：连续 ${streakDays} 天`,
        "dailyReward",
        todayKey,
        tx,
      );

      await enqueueOutboxEvent(
        "dailyReward.claimed",
        {
          userId,
          rewardCurrency: DAILY_REWARD_CURRENCY,
          claimedAmount: DAILY_REWARD_AMOUNT,
          streakDays,
          rewardDate: todayKey,
        },
        tx,
      );

      return {
        rewardCurrency: DAILY_REWARD_CURRENCY,
        claimedAmount: DAILY_REWARD_AMOUNT,
        streakDays,
        claimedAt: claimTime.toISOString(),
      };
    });
  } catch (error) {
    if (isDailyRewardDuplicateClaim(error)) {
      throw new ConflictError("今日签到奖励已经领取过了");
    }

    throw error;
  }
}

export async function listDailyMissions(userId: string): Promise<DailyMissionView[]> {
  const snapshot = await getFeatureSnapshot();
  const activeMissionKeys = dailyMissionKeys.filter((missionKey) => {
    const dependencyModule = DAILY_MISSION_CONFIG[missionKey].dependencyModule;
    return snapshot[dependencyModule]?.enabled;
  });

  return db.transaction(async (tx) => {
    const rewardWindow = resolveDailyRewardWindow(now());
    const progress = await getDailyMissionProgressCounts(tx, userId, rewardWindow.from, rewardWindow.to, activeMissionKeys);
    const claims = await listDailyMissionClaimsByDate(tx, userId, rewardWindow.dayKey);
    const claimedSet = new Set(claims.map((item) => item.missionKey as DailyMissionKey));

    return activeMissionKeys.map((missionKey) =>
      buildDailyMissionView({
        missionKey,
        progressCurrent: progress[missionKey],
        claimed: claimedSet.has(missionKey),
      }),
    );
  });
}

export async function claimDailyMission(userId: string, missionKeyInput: string): Promise<DailyMissionClaimResult> {
  const missionKey = assertMissionKey(missionKeyInput);
  const snapshot = await getFeatureSnapshot();
  const dependencyModule = DAILY_MISSION_CONFIG[missionKey].dependencyModule;
  if (!snapshot[dependencyModule]?.enabled) {
    throw new ConflictError("该日常任务依赖的模块当前未开放");
  }

  try {
    return await db.transaction(async (tx) => {
      const rewardWindow = resolveDailyRewardWindow(now());
      const existingClaim = await getDailyMissionClaimByDateAndKey(tx, userId, rewardWindow.dayKey, missionKey);
      if (existingClaim) {
        throw new ConflictError("今日该日常任务奖励已经领取过了");
      }

      const progress = await getDailyMissionProgressCounts(tx, userId, rewardWindow.from, rewardWindow.to, [missionKey]);
      const config = DAILY_MISSION_CONFIG[missionKey];
      if (progress[missionKey] < config.progressTarget) {
        throw new ConflictError("日常任务尚未完成");
      }

      const claimedAt = now();
      await tx.insert(dailyMissionClaims).values({
        id: crypto.randomUUID(),
        userId,
        missionKey,
        rewardDate: rewardWindow.dayKey,
        rewardCurrency: DAILY_REWARD_CURRENCY,
        rewardAmount: config.rewardAmount,
        claimedAt,
      });

      await grantBalance(
        userId,
        DAILY_REWARD_CURRENCY,
        config.rewardAmount,
        `日常任务奖励：${config.title}`,
        "dailyMission",
        `${rewardWindow.dayKey}:${missionKey}`,
        tx,
      );

      await enqueueOutboxEvent(
        "dailyMission.claimed",
        {
          userId,
          missionKey,
          rewardCurrency: DAILY_REWARD_CURRENCY,
          claimedAmount: config.rewardAmount,
          rewardDate: rewardWindow.dayKey,
        },
        tx,
      );

      return {
        missionKey,
        rewardCurrency: DAILY_REWARD_CURRENCY,
        claimedAmount: config.rewardAmount,
        claimedAt: claimedAt.toISOString(),
      };
    });
  } catch (error) {
    if (isDailyMissionDuplicateClaim(error)) {
      throw new ConflictError("今日该日常任务奖励已经领取过了");
    }
    throw error;
  }
}

export async function listWeeklyMissions(userId: string): Promise<WeeklyMissionView[]> {
  const snapshot = await getFeatureSnapshot();
  const activeMissionKeys = weeklyMissionKeys.filter((missionKey) => {
    const dependencyModule = WEEKLY_MISSION_CONFIG[missionKey].dependencyModule;
    return snapshot[dependencyModule]?.enabled;
  });

  return db.transaction(async (tx) => {
    const rewardWindow = resolveWeeklyRewardWindow(now());
    const progress = await getWeeklyMissionProgressCounts(tx, userId, rewardWindow.from, rewardWindow.to, activeMissionKeys);
    const claims = await listWeeklyMissionClaimsByWeek(tx, userId, rewardWindow.weekKey);
    const claimedSet = new Set(claims.map((item) => item.missionKey as WeeklyMissionKey));

    return activeMissionKeys.map((missionKey) =>
      buildWeeklyMissionView({
        missionKey,
        progressCurrent: progress[missionKey],
        claimed: claimedSet.has(missionKey),
        weekKey: rewardWindow.weekKey,
      }),
    );
  });
}

export async function claimWeeklyMission(userId: string, missionKeyInput: string): Promise<WeeklyMissionClaimResult> {
  const missionKey = assertWeeklyMissionKey(missionKeyInput);
  const snapshot = await getFeatureSnapshot();
  const dependencyModule = WEEKLY_MISSION_CONFIG[missionKey].dependencyModule;
  if (!snapshot[dependencyModule]?.enabled) {
    throw new ConflictError("该周常任务依赖的模块当前未开放");
  }

  try {
    return await db.transaction(async (tx) => {
      const rewardWindow = resolveWeeklyRewardWindow(now());
      const existingClaim = await getWeeklyMissionClaimByWeekAndKey(tx, userId, rewardWindow.weekKey, missionKey);
      if (existingClaim) {
        throw new ConflictError("本周该周常任务奖励已经领取过了");
      }

      const progress = await getWeeklyMissionProgressCounts(tx, userId, rewardWindow.from, rewardWindow.to, [missionKey]);
      const config = WEEKLY_MISSION_CONFIG[missionKey];
      if (progress[missionKey] < config.progressTarget) {
        throw new ConflictError("周常任务尚未完成");
      }

      const claimedAt = now();
      await tx.insert(weeklyMissionClaims).values({
        id: crypto.randomUUID(),
        userId,
        missionKey,
        weekKey: rewardWindow.weekKey,
        rewardCurrency: DAILY_REWARD_CURRENCY,
        rewardAmount: config.rewardAmount,
        claimedAt,
      });

      await grantBalance(
        userId,
        DAILY_REWARD_CURRENCY,
        config.rewardAmount,
        `周常任务奖励：${config.title}`,
        "weeklyMission",
        `${rewardWindow.weekKey}:${missionKey}`,
        tx,
      );

      await enqueueOutboxEvent(
        "weeklyMission.claimed",
        {
          userId,
          missionKey,
          rewardCurrency: DAILY_REWARD_CURRENCY,
          claimedAmount: config.rewardAmount,
          weekKey: rewardWindow.weekKey,
        },
        tx,
      );

      return {
        missionKey,
        rewardCurrency: DAILY_REWARD_CURRENCY,
        claimedAmount: config.rewardAmount,
        claimedAt: claimedAt.toISOString(),
        weekKey: rewardWindow.weekKey,
      };
    });
  } catch (error) {
    if (isDailyMissionDuplicateClaim(error)) {
      throw new ConflictError("本周该周常任务奖励已经领取过了");
    }
    throw error;
  }
}
