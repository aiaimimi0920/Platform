import { randomInt } from "node:crypto";

import type {
  CurrencyKey,
  FeatureModuleKey,
  MissionCardView,
  MissionClaimResult,
  MissionCheckinRewardView,
  MissionCheckinWagerResult,
  MissionCheckinWagerView,
  MissionDefinitionView,
  MissionKind,
  MissionMetricKey,
  MissionPanelView,
  MissionResetRule,
  MissionStatus,
  MissionStreakMode,
  MissionTabKey,
  UpsertMissionDefinitionInput,
} from "@neuro/contracts";
import { currencyKeys } from "@neuro/contracts";
import { count, eq, gte, lt, and } from "drizzle-orm";

import { db } from "@/db/client";
import { env } from "@/env";
import { ensureInternalUser } from "@/modules/identity/service";
import { mailboxAttachments, mailboxMessages } from "@/modules/mailbox/schema";
import { opinionTopicSupports } from "@/modules/opinion-hub/schema";
import { orders } from "@/modules/product-order-item/schema";
import {
  personalMissionCheckinWagers,
  personalMissionClaims,
  personalMissionDefinitions,
} from "@/modules/personal-missions/schema";
import {
  consumeMissionCheckinWagerRow,
  countMissionClaimsByKinds,
  deleteMissionDefinitionRow,
  getLatestMissionClaim,
  getMissionCheckinWagerByRewardPeriod,
  getMissionCheckinWagerBySourceDay,
  getMissionClaimByMissionAndPeriod,
  getMissionDefinitionRowById,
  hasPendingMissionCheckinWagers,
  insertMissionCheckinWagerRow,
  insertMissionDefinitionRow,
  listActiveMissionDefinitionRows,
  listMissionDefinitionRowsByIds,
  listOperatorMissionDefinitionRows,
  updateMissionDefinitionRow,
} from "@/modules/personal-missions/repository";
import { taskApplications } from "@/modules/task-hub/schema";
import { deductBalance, grantBalance } from "@/modules/wallet-ledger/service";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { getFeatureSnapshot } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import { getCoreMissionProgress } from "@/platform/core-integration/service";

const DEFAULT_MISSION_REWARD_CURRENCY = "mira" as const;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const CHECKIN_WAGER_MIN_AMOUNT = 20;
const CHECKIN_WAGER_MAX_AMOUNT = 200;
const CHECKIN_WAGER_MULTIPLIER = 2;
const TAB_ORDER: MissionTabKey[] = ["checkin", "permanent", "daily", "weekly", "event"];
const SUPPORTED_MISSION_REWARD_CURRENCIES = new Set<CurrencyKey>(currencyKeys);
const CURRENCY_LABELS: Record<CurrencyKey, string> = {
  mira: "米拉",
  obsidian: "曜石",
  opinionTickets: "意见券",
};

type MissionDefinitionRow = typeof personalMissionDefinitions.$inferSelect;
type MissionCheckinWagerRow = typeof personalMissionCheckinWagers.$inferSelect;

type BootstrapMissionDefinition = {
  id: string;
  kind: MissionKind;
  status: MissionStatus;
  title: string;
  subtitle: string | null;
  description: string;
  eyebrow: string;
  rewardCurrency?: CurrencyKey;
  rewardAmount: number;
  metricKey: MissionMetricKey;
  progressTarget: number;
  streakTarget: number | null;
  sortOrder: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

type WindowInfo = {
  periodKey: string;
  from: Date;
  to: Date;
};

const TAB_LABELS: Record<MissionTabKey, string> = {
  checkin: "签到",
  permanent: "永久任务",
  daily: "每日任务",
  weekly: "周任务",
  event: "活动任务",
};

function getCurrencyLabel(currency: CurrencyKey) {
  return CURRENCY_LABELS[currency];
}

const METRIC_DEPENDENCY: Record<MissionMetricKey, FeatureModuleKey> = {
  dailyCheckInClaim: "personalMissions",
  taskApply: "taskHub",
  mailClaim: "mailbox",
  productPurchase: "product",
  opinionSupport: "opinionHub",
};

function now() {
  return new Date();
}

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (!operatorIds.has(userId) && (!providerUserId || !operatorIds.has(providerUserId))) {
    throw new UnauthorizedError("Only platform operators can manage personal missions");
  }
}

function normalizeRequiredText(value: string, fieldLabel: string, maxLength: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestError(`${fieldLabel}不能为空。`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`${fieldLabel}长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestError(`副标题长度不能超过 ${maxLength} 个字符。`);
  }
  return trimmed;
}

function normalizePositiveInt(value: number, fieldLabel: string, maxValue = 100_000) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestError(`${fieldLabel}必须是正整数。`);
  }
  if (value > maxValue) {
    throw new BadRequestError(`${fieldLabel}不能超过 ${maxValue}。`);
  }
  return value;
}

function normalizeSortOrder(value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BadRequestError("排序值必须是整数。");
  }
  return value;
}

function parseIsoDate(value: string | null | undefined, fieldLabel: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldLabel}格式无效。`);
  }
  return parsed;
}

function toChinaDateKey(date: Date) {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function previousChinaDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 0, 0, 0)).toISOString().slice(0, 10);
}

function nextChinaMidnight(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - SHANGHAI_OFFSET_MS);
}

function nextChinaDateKey(dateKey: string) {
  return toChinaDateKey(nextChinaMidnight(dateKey));
}

function resolveDailyWindow(date: Date): WindowInfo {
  const dayKey = toChinaDateKey(date);
  const [year, month, day] = dayKey.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - SHANGHAI_OFFSET_MS);
  const to = new Date(from.getTime() + ONE_DAY_MS);
  return { periodKey: dayKey, from, to };
}

function resolveWeeklyWindow(date: Date): WindowInfo {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  const weekday = shifted.getUTCDay();
  const deltaToMonday = weekday === 0 ? 6 : weekday - 1;
  const mondayShifted = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - deltaToMonday, 0, 0, 0),
  );
  const from = new Date(mondayShifted.getTime() - SHANGHAI_OFFSET_MS);
  const to = new Date(from.getTime() + ONE_DAY_MS * 7);
  return {
    periodKey: mondayShifted.toISOString().slice(0, 10),
    from,
    to,
  };
}

function resolveMissionShape(kind: MissionKind, input: UpsertMissionDefinitionInput) {
  const startsAt = parseIsoDate(input.startsAt, "活动开始时间");
  const endsAt = parseIsoDate(input.endsAt, "活动结束时间");

  if (kind === "checkin") {
    return {
      metricKey: "dailyCheckInClaim" as const,
      progressTarget: 1,
      resetRule: "daily" as MissionResetRule,
      streakMode: "daily_checkin" as MissionStreakMode,
      streakTarget: input.streakTarget ? normalizePositiveInt(input.streakTarget, "连续签到目标", 365) : 7,
      startsAt: null,
      endsAt: null,
    };
  }

  if (kind === "daily") {
    return {
      metricKey: input.metricKey,
      progressTarget: normalizePositiveInt(input.progressTarget, "每日任务目标"),
      resetRule: "daily" as MissionResetRule,
      streakMode: "none" as MissionStreakMode,
      streakTarget: null,
      startsAt: null,
      endsAt: null,
    };
  }

  if (kind === "weekly") {
    return {
      metricKey: input.metricKey,
      progressTarget: normalizePositiveInt(input.progressTarget, "周任务目标"),
      resetRule: "weekly" as MissionResetRule,
      streakMode: "none" as MissionStreakMode,
      streakTarget: null,
      startsAt: null,
      endsAt: null,
    };
  }

  if (kind === "permanent") {
    return {
      metricKey: input.metricKey,
      progressTarget: normalizePositiveInt(input.progressTarget, "永久任务目标"),
      resetRule: "none" as MissionResetRule,
      streakMode: "none" as MissionStreakMode,
      streakTarget: null,
      startsAt: null,
      endsAt: null,
    };
  }

  if (!startsAt || !endsAt) {
    throw new BadRequestError("活动任务必须提供开始和结束时间。");
  }
  if (startsAt >= endsAt) {
    throw new BadRequestError("活动结束时间必须晚于开始时间。");
  }

  return {
    metricKey: input.metricKey,
    progressTarget: normalizePositiveInt(input.progressTarget, "活动任务目标"),
    resetRule: "event_window" as MissionResetRule,
    streakMode: "none" as MissionStreakMode,
    streakTarget: null,
    startsAt,
    endsAt,
  };
}

function toMissionDefinitionView(row: MissionDefinitionRow): MissionDefinitionView {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    eyebrow: row.eyebrow,
    rewardCurrency: row.rewardCurrency as CurrencyKey,
    rewardAmount: row.rewardAmount,
    metricKey: row.metricKey,
    progressTarget: row.progressTarget,
    resetRule: row.resetRule,
    streakMode: row.streakMode,
    streakTarget: row.streakTarget,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    sortOrder: row.sortOrder,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function normalizeMissionInput(input: UpsertMissionDefinitionInput, current?: MissionDefinitionRow | null) {
  const kind = input.kind;
  const status = input.status;
  const rewardCurrency = input.rewardCurrency;
  if (!["checkin", "daily", "weekly", "permanent", "event"].includes(kind)) {
    throw new BadRequestError("任务类型无效。");
  }
  if (!["draft", "active", "archived"].includes(status)) {
    throw new BadRequestError("任务状态无效。");
  }
  if (!SUPPORTED_MISSION_REWARD_CURRENCIES.has(rewardCurrency)) {
    throw new BadRequestError("任务奖励货币无效。");
  }

  const shape = resolveMissionShape(kind, input);

  return {
    kind,
    status,
    title: normalizeRequiredText(input.title, "任务标题", 120),
    subtitle: normalizeOptionalText(input.subtitle, 120),
    description: normalizeRequiredText(input.description, "任务说明", 5_000),
    eyebrow: normalizeRequiredText(input.eyebrow, "标签文案", 40),
    rewardCurrency,
    rewardAmount: normalizePositiveInt(input.rewardAmount, "奖励数额"),
    metricKey: shape.metricKey,
    progressTarget: shape.progressTarget,
    resetRule: shape.resetRule,
    streakMode: shape.streakMode,
    streakTarget: shape.streakTarget,
    startsAt: shape.startsAt,
    endsAt: shape.endsAt,
    sortOrder: normalizeSortOrder(input.sortOrder),
    archivedAt: status === "archived" ? current?.archivedAt ?? now() : null,
  };
}

function buildBootstrapMissionDefinitions(referenceTime: Date): BootstrapMissionDefinition[] {
  const activeEventStartsAt = new Date(referenceTime.getTime() - ONE_DAY_MS * 2);
  const activeEventEndsAt = new Date(referenceTime.getTime() + ONE_DAY_MS * 21);

  return [
    {
      id: "mission-checkin-daily",
      kind: "checkin",
      status: "active",
      title: "每日签到",
      subtitle: "每日激活一次个人终端回路",
      description: "每天只能签到当天一次，领取固定奖励，并结算昨日压注的双倍额外奖励。",
      eyebrow: "签到",
      rewardAmount: 100,
      metricKey: "dailyCheckInClaim",
      progressTarget: 1,
      streakTarget: 7,
      sortOrder: 10,
    },
    {
      id: "mission-daily-task-apply",
      kind: "daily",
      status: "active",
      title: "今日申请任务 1 次",
      subtitle: "保持协作链路活跃",
      description: "今日至少提交 1 次任务申请，可领取日常奖励。",
      eyebrow: "每日任务",
      rewardAmount: 8,
      metricKey: "taskApply",
      progressTarget: 1,
      streakTarget: null,
      sortOrder: 20,
    },
    {
      id: "mission-daily-mail-claim",
      kind: "daily",
      status: "active",
      title: "今日领取邮箱附件 1 次",
      subtitle: "保持站内回路畅通",
      description: "今日至少领取 1 个邮箱附件，可领取日常奖励。",
      eyebrow: "每日任务",
      rewardAmount: 6,
      metricKey: "mailClaim",
      progressTarget: 1,
      streakTarget: null,
      sortOrder: 30,
    },
    {
      id: "mission-daily-product-purchase",
      kind: "daily",
      status: "active",
      title: "今日完成商品购买 1 次",
      subtitle: "驱动平台消费与回流",
      description: "今日至少完成 1 次商品购买，可领取日常奖励。",
      eyebrow: "每日任务",
      rewardAmount: 12,
      metricKey: "productPurchase",
      progressTarget: 1,
      streakTarget: null,
      sortOrder: 40,
    },
    {
      id: "mission-weekly-checkin",
      kind: "weekly",
      status: "active",
      title: "本周完成签到 3 次",
      subtitle: "维持整周活跃",
      description: "本周至少完成 3 次每日签到，可领取周任务奖励。",
      eyebrow: "周任务",
      rewardAmount: 24,
      metricKey: "dailyCheckInClaim",
      progressTarget: 3,
      streakTarget: null,
      sortOrder: 50,
    },
    {
      id: "mission-weekly-task-apply",
      kind: "weekly",
      status: "active",
      title: "本周申请任务 3 次",
      subtitle: "维持任务参与度",
      description: "本周至少提交 3 次任务申请，可领取周任务奖励。",
      eyebrow: "周任务",
      rewardAmount: 18,
      metricKey: "taskApply",
      progressTarget: 3,
      streakTarget: null,
      sortOrder: 60,
    },
    {
      id: "mission-weekly-product-purchase",
      kind: "weekly",
      status: "active",
      title: "本周完成购买 2 次",
      subtitle: "维持市场回流",
      description: "本周至少完成 2 次商品购买，可领取周任务奖励。",
      eyebrow: "周任务",
      rewardAmount: 28,
      metricKey: "productPurchase",
      progressTarget: 2,
      streakTarget: null,
      sortOrder: 70,
    },
    {
      id: "mission-weekly-opinion-support",
      kind: "weekly",
      status: "active",
      title: "本周参与议题支持 2 次",
      subtitle: "维持治理参与度",
      description: "本周至少使用意见券支持 2 次议题，可领取周任务奖励。",
      eyebrow: "周任务",
      rewardAmount: 16,
      metricKey: "opinionSupport",
      progressTarget: 2,
      streakTarget: null,
      sortOrder: 80,
    },
    {
      id: "mission-permanent-task-explorer",
      kind: "permanent",
      status: "active",
      title: "累计申请任务 5 次",
      subtitle: "探索平台协作侧",
      description: "累计完成 5 次任务申请，用于引导用户探索平台协作能力。",
      eyebrow: "永久任务",
      rewardAmount: 50,
      metricKey: "taskApply",
      progressTarget: 5,
      streakTarget: null,
      sortOrder: 90,
    },
    {
      id: "mission-permanent-mail-relay",
      kind: "permanent",
      status: "active",
      title: "累计领取邮箱附件 5 次",
      subtitle: "探索站内消息回路",
      description: "累计领取 5 次邮箱附件，用于引导用户建立站内消息习惯。",
      eyebrow: "永久任务",
      rewardAmount: 30,
      metricKey: "mailClaim",
      progressTarget: 5,
      streakTarget: null,
      sortOrder: 100,
    },
    {
      id: "mission-event-sprint-market-loop",
      kind: "event",
      status: "active",
      title: "活动期内完成商品购买 2 次",
      subtitle: "阶段活动 · 市场回流冲刺",
      description: "在当前活动窗口内完成 2 次商品购买，可领取限时活动奖励。",
      eyebrow: "活动任务",
      rewardAmount: 36,
      metricKey: "productPurchase",
      progressTarget: 2,
      streakTarget: null,
      sortOrder: 110,
      startsAt: activeEventStartsAt,
      endsAt: activeEventEndsAt,
    },
  ];
}

function buildSeedInsert(seed: BootstrapMissionDefinition, referenceTime: Date) {
  const normalized = normalizeMissionInput({
    kind: seed.kind,
    status: seed.status,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    eyebrow: seed.eyebrow,
    rewardCurrency: seed.rewardCurrency ?? DEFAULT_MISSION_REWARD_CURRENCY,
    rewardAmount: seed.rewardAmount,
    metricKey: seed.metricKey,
    progressTarget: seed.progressTarget,
    streakTarget: seed.streakTarget,
    startsAt: seed.startsAt ? seed.startsAt.toISOString() : null,
    endsAt: seed.endsAt ? seed.endsAt.toISOString() : null,
    sortOrder: seed.sortOrder,
  });

  return {
    id: seed.id,
    ...normalized,
    createdByUserId: null,
    updatedByUserId: null,
    createdAt: referenceTime,
    updatedAt: referenceTime,
  };
}

function resolveMissionWindow(row: MissionDefinitionRow, referenceTime: Date): WindowInfo {
  if (row.resetRule === "daily") {
    return resolveDailyWindow(referenceTime);
  }
  if (row.resetRule === "weekly") {
    return resolveWeeklyWindow(referenceTime);
  }
  if (row.resetRule === "event_window") {
    if (!row.startsAt || !row.endsAt) {
      throw new ConflictError("活动任务缺少有效时间窗口。");
    }
    return {
      periodKey: `event:${row.id}`,
      from: row.startsAt,
      to: row.endsAt,
    };
  }

  return {
    periodKey: "all-time",
    from: new Date(Date.UTC(2020, 0, 1, 0, 0, 0)),
    to: referenceTime,
  };
}

function isMissionVisibleToUser(row: MissionDefinitionRow, referenceTime: Date) {
  if (row.status !== "active") {
    return false;
  }

  if (row.kind === "event") {
    if (!row.startsAt || !row.endsAt) {
      return false;
    }
    return row.startsAt <= referenceTime && referenceTime < row.endsAt;
  }

  return true;
}

function buildCheckinStateFromSnapshot(snapshot: Record<string, unknown> | null | undefined) {
  const streakValue = snapshot?.streakDays;
  return typeof streakValue === "number" && Number.isFinite(streakValue) ? streakValue : null;
}

function buildCheckinRewardPreviewText(fixedAmount: number, bonusAmount: number) {
  return `${fixedAmount}+${bonusAmount}`;
}

function buildCheckinRewardView(args: {
  fixedAmount: number;
  bonusAmount: number;
  bonusSourceWagerAmount: number | null;
}): MissionCheckinRewardView {
  return {
    fixedAmount: args.fixedAmount,
    bonusAmount: args.bonusAmount,
    bonusSourceWagerAmount: args.bonusSourceWagerAmount,
    bonusMultiplier: CHECKIN_WAGER_MULTIPLIER,
    previewText: buildCheckinRewardPreviewText(args.fixedAmount, args.bonusAmount),
  };
}

function buildCheckinWagerView(
  currentPeriodKey: string,
  todayWager: MissionCheckinWagerRow | null,
): MissionCheckinWagerView {
  return {
    canPlaceToday: !todayWager,
    todayWagerAmount: todayWager?.wagerAmount ?? null,
    todayBonusAmount: todayWager?.bonusAmount ?? null,
    minAmount: CHECKIN_WAGER_MIN_AMOUNT,
    maxAmount: CHECKIN_WAGER_MAX_AMOUNT,
    rewardPeriodKey: nextChinaDateKey(currentPeriodKey),
    placedAt: todayWager?.placedAt.toISOString() ?? null,
  };
}

async function countMetricProgress(
  tx: Parameters<typeof getMissionClaimByMissionAndPeriod>[0],
  userId: string,
  metricKey: MissionMetricKey,
  from: Date,
  to: Date,
) {
  if (metricKey === "dailyCheckInClaim") {
    return countMissionClaimsByKinds(tx, userId, ["checkin"], from, to);
  }

  if (metricKey === "taskApply") {
    if (env.usesDedicatedDatabase) {
      const progress = await getCoreMissionProgress({
        userId,
        scope: "daily",
        from,
        to,
        keys: ["taskApply"],
      });
      return Number(progress?.taskApply ?? 0);
    }

    const [row] = await tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(and(eq(taskApplications.applicantUserId, userId), gte(taskApplications.createdAt, from), lt(taskApplications.createdAt, to)));
    return Number(row?.count ?? 0);
  }

  if (metricKey === "mailClaim") {
    const [row] = await tx
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
    return Number(row?.count ?? 0);
  }

  if (metricKey === "productPurchase") {
    if (env.usesDedicatedDatabase) {
      const progress = await getCoreMissionProgress({
        userId,
        scope: "daily",
        from,
        to,
        keys: ["productPurchase"],
      });
      return Number(progress?.productPurchase ?? 0);
    }

    const [row] = await tx
      .select({ count: count(orders.id) })
      .from(orders)
      .where(and(eq(orders.userId, userId), gte(orders.createdAt, from), lt(orders.createdAt, to)));
    return Number(row?.count ?? 0);
  }

  if (env.usesDedicatedDatabase) {
    const progress = await getCoreMissionProgress({
      userId,
      scope: "weekly",
      from,
      to,
      keys: ["opinionSupport"],
    });
    return Number(progress?.opinionSupport ?? 0);
  }

  const [row] = await tx
    .select({ count: count(opinionTopicSupports.id) })
    .from(opinionTopicSupports)
    .where(
      and(
        eq(opinionTopicSupports.userId, userId),
        gte(opinionTopicSupports.createdAt, from),
        lt(opinionTopicSupports.createdAt, to),
      ),
    );
  return Number(row?.count ?? 0);
}

async function buildMissionCardView(
  tx: Parameters<typeof getMissionClaimByMissionAndPeriod>[0],
  row: MissionDefinitionRow,
  userId: string,
  referenceTime: Date,
  snapshot: Awaited<ReturnType<typeof getFeatureSnapshot>>,
  progressCache: Map<string, number>,
): Promise<MissionCardView> {
  const dependencyModule = METRIC_DEPENDENCY[row.metricKey];
  if (!snapshot[dependencyModule]?.enabled) {
    throw new ConflictError(`任务依赖模块 ${dependencyModule} 当前未开启。`);
  }

  const window = resolveMissionWindow(row, referenceTime);
  const existingClaim = await getMissionClaimByMissionAndPeriod(tx, userId, row.id, window.periodKey);

  if (row.kind === "checkin") {
    const latestClaim = existingClaim ? existingClaim : await getLatestMissionClaim(tx, userId, row.id);
    const rewardWager = await getMissionCheckinWagerByRewardPeriod(tx, userId, row.id, window.periodKey);
    const todayWager = await getMissionCheckinWagerBySourceDay(tx, userId, row.id, window.periodKey);
    const previousDayKey = previousChinaDateKey(window.periodKey);
    let streakDays = 0;

    if (existingClaim) {
      streakDays = buildCheckinStateFromSnapshot(existingClaim.progressSnapshot) ?? 1;
    } else if (latestClaim?.periodKey === previousDayKey) {
      streakDays = buildCheckinStateFromSnapshot(latestClaim.progressSnapshot) ?? 1;
    }

    const fixedRewardAmount = existingClaim?.baseRewardAmount ?? row.rewardAmount;
    const bonusRewardAmount = existingClaim?.bonusRewardAmount ?? rewardWager?.bonusAmount ?? 0;
    const bonusSourceWagerAmount =
      existingClaim?.bonusSourceWagerAmount ?? rewardWager?.wagerAmount ?? null;

    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      eyebrow: row.eyebrow,
      rewardCurrency: row.rewardCurrency as CurrencyKey,
      rewardAmount: fixedRewardAmount + bonusRewardAmount,
      metricKey: row.metricKey,
      progressCurrent: existingClaim ? 1 : 0,
      progressTarget: 1,
      completed: Boolean(existingClaim),
      claimed: Boolean(existingClaim),
      claimable: !existingClaim,
      available: true,
      lockedReason: existingClaim ? "今日已签到" : null,
      periodKey: window.periodKey,
      nextEligibleAt: existingClaim ? nextChinaMidnight(window.periodKey).toISOString() : null,
      streakDays,
      streakTarget: row.streakTarget,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      sortOrder: row.sortOrder,
      claimedAt: existingClaim?.claimedAt.toISOString() ?? null,
      checkinReward: buildCheckinRewardView({
        fixedAmount: fixedRewardAmount,
        bonusAmount: bonusRewardAmount,
        bonusSourceWagerAmount,
      }),
      checkinWager: buildCheckinWagerView(window.periodKey, todayWager),
    };
  }

  const cacheKey = `${row.metricKey}:${window.from.toISOString()}:${window.to.toISOString()}`;
  const progressCurrent =
    progressCache.get(cacheKey) ??
    (await (async () => {
      const nextValue = await countMetricProgress(tx, userId, row.metricKey, window.from, window.to);
      progressCache.set(cacheKey, nextValue);
      return nextValue;
    })());

  const completed = progressCurrent >= row.progressTarget;

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    eyebrow: row.eyebrow,
    rewardCurrency: row.rewardCurrency as CurrencyKey,
    rewardAmount: row.rewardAmount,
    metricKey: row.metricKey,
    progressCurrent,
    progressTarget: row.progressTarget,
    completed,
    claimed: Boolean(existingClaim),
    claimable: completed && !existingClaim,
    available: true,
    lockedReason: existingClaim ? "奖励已领取" : completed ? null : "任务尚未完成",
    periodKey: window.periodKey,
    nextEligibleAt: null,
    streakDays: null,
    streakTarget: null,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    sortOrder: row.sortOrder,
    claimedAt: existingClaim?.claimedAt.toISOString() ?? null,
    checkinReward: null,
    checkinWager: null,
  };
}

function chooseDefaultTab(panel: Omit<MissionPanelView, "generatedAt" | "tabs" | "defaultTab">): MissionTabKey {
  if (panel.checkin?.claimable) {
    return "checkin";
  }

  for (const key of ["permanent", "daily", "weekly", "event"] as const) {
    if (panel[key].some((mission) => mission.claimable)) {
      return key;
    }
  }

  if (panel.permanent.length > 0) {
    return "permanent";
  }

  for (const key of TAB_ORDER) {
    if (key === "checkin" ? Boolean(panel.checkin) : panel[key].length > 0) {
      return key;
    }
  }

  return "checkin";
}

function buildTabSummary(panel: Omit<MissionPanelView, "generatedAt" | "tabs" | "defaultTab">) {
  return TAB_ORDER.map((key) => {
    const entries = key === "checkin" ? (panel.checkin ? [panel.checkin] : []) : panel[key];
    return {
      key,
      label: TAB_LABELS[key],
      totalCount: entries.length,
      claimableCount: entries.filter((entry) => entry.claimable).length,
    };
  });
}

export async function ensurePersonalMissionCatalogSeeded() {
  const referenceTime = now();
  const bootstrapDefinitions = buildBootstrapMissionDefinitions(referenceTime);
  const existingRows = await listMissionDefinitionRowsByIds(bootstrapDefinitions.map((seed) => seed.id));
  const existingIdSet = new Set(existingRows.map((row) => row.id));

  for (const seed of bootstrapDefinitions) {
    if (existingIdSet.has(seed.id)) {
      continue;
    }

    await insertMissionDefinitionRow(buildSeedInsert(seed, referenceTime));
  }
}

export async function getMissionPanel(userId: string): Promise<MissionPanelView> {
  const snapshot = await getFeatureSnapshot();

  return db.transaction(async (tx) => {
    const referenceTime = now();
    const progressCache = new Map<string, number>();
    const rows = await listActiveMissionDefinitionRows();
    const visibleRows = rows.filter(
      (row) => isMissionVisibleToUser(row, referenceTime) && snapshot[METRIC_DEPENDENCY[row.metricKey]]?.enabled,
    );

    const cards = await Promise.all(
      visibleRows.map((row) => buildMissionCardView(tx, row, userId, referenceTime, snapshot, progressCache)),
    );

    const checkin = cards.find((card) => card.kind === "checkin") ?? null;
    const panel = {
      checkin,
      permanent: cards.filter((card) => card.kind === "permanent"),
      daily: cards.filter((card) => card.kind === "daily"),
      weekly: cards.filter((card) => card.kind === "weekly"),
      event: cards.filter((card) => card.kind === "event"),
    };

    const tabs = buildTabSummary(panel);

    return {
      ...panel,
      tabs,
      defaultTab: chooseDefaultTab(panel),
      generatedAt: referenceTime.toISOString(),
    };
  });
}

export async function placeCheckinWager(userId: string, missionId: string): Promise<MissionCheckinWagerResult> {
  const snapshot = await getFeatureSnapshot();
  const mission = await getMissionDefinitionRowById(missionId);
  if (!mission) {
    throw new NotFoundError("任务不存在。");
  }
  if (mission.kind !== "checkin") {
    throw new BadRequestError("只有签到任务支持压注。");
  }
  if (mission.status !== "active") {
    throw new ConflictError("该任务当前未开放。");
  }
  if (!snapshot.personalMissions?.enabled) {
    throw new ConflictError("个人任务模块当前未开放。");
  }
  if (!snapshot.wallet?.enabled || !snapshot.ledger?.enabled) {
    throw new ConflictError("压注当前依赖的钱包模块未开放。");
  }

  const referenceTime = now();
  if (!isMissionVisibleToUser(mission, referenceTime)) {
    throw new ConflictError("该任务当前不在可操作窗口内。");
  }

  return db.transaction(async (tx) => {
    await ensureInternalUser(userId, tx);
    const window = resolveMissionWindow(mission, referenceTime);
    const existingWager = await getMissionCheckinWagerBySourceDay(tx, userId, mission.id, window.periodKey);
    if (existingWager) {
      throw new ConflictError("今天已经压注过了。");
    }

    const wagerAmount = randomInt(CHECKIN_WAGER_MIN_AMOUNT, CHECKIN_WAGER_MAX_AMOUNT + 1);
    const bonusAmount = wagerAmount * CHECKIN_WAGER_MULTIPLIER;
    const rewardPeriodKey = nextChinaDateKey(window.periodKey);
    const placedAt = now();
    const rewardCurrency = mission.rewardCurrency as CurrencyKey;
    const rewardCurrencyLabel = getCurrencyLabel(rewardCurrency);

    try {
      await deductBalance(
        userId,
        rewardCurrency,
        wagerAmount,
        `签到压注：为 ${rewardPeriodKey} 的签到额外挂载 ${bonusAmount} ${rewardCurrencyLabel}`,
        "missionCheckinWager",
        `${mission.id}:${window.periodKey}`,
        tx,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Insufficient balance")) {
        throw new ConflictError(`${rewardCurrencyLabel}不足，无法完成压注。`);
      }
      throw error;
    }

    await insertMissionCheckinWagerRow(tx, {
      id: crypto.randomUUID(),
      missionId: mission.id,
      userId,
      sourceDayKey: window.periodKey,
      rewardPeriodKey,
      rewardCurrency,
      wagerAmount,
      bonusAmount,
      bonusMultiplier: CHECKIN_WAGER_MULTIPLIER,
      consumedByClaimId: null,
      placedAt,
      consumedAt: null,
    });

    return {
      missionId: mission.id,
      rewardCurrency,
      wagerAmount,
      bonusAmount,
      bonusMultiplier: CHECKIN_WAGER_MULTIPLIER,
      fixedRewardAmount: mission.rewardAmount,
      rewardPeriodKey,
      previewText: buildCheckinRewardPreviewText(mission.rewardAmount, bonusAmount),
      placedAt: placedAt.toISOString(),
    };
  });
}

export async function claimMission(userId: string, missionId: string): Promise<MissionClaimResult> {
  const snapshot = await getFeatureSnapshot();
  const mission = await getMissionDefinitionRowById(missionId);
  if (!mission) {
    throw new NotFoundError("任务不存在。");
  }
  if (mission.status !== "active") {
    throw new ConflictError("该任务当前未开放。");
  }

  const dependencyModule = METRIC_DEPENDENCY[mission.metricKey];
  if (!snapshot[dependencyModule]?.enabled) {
    throw new ConflictError("该任务依赖的模块当前未开放。");
  }

  const referenceTime = now();
  if (!isMissionVisibleToUser(mission, referenceTime)) {
    throw new ConflictError("该任务当前不在可领取窗口内。");
  }

  return db.transaction(async (tx) => {
    await ensureInternalUser(userId, tx);
    const window = resolveMissionWindow(mission, referenceTime);
    const existingClaim = await getMissionClaimByMissionAndPeriod(tx, userId, mission.id, window.periodKey);
    if (existingClaim) {
      throw new ConflictError("该任务奖励已经领取过了。");
    }

    let progressCurrent = 0;
    let streakDays: number | null = null;
    let baseRewardAmount: number | null = null;
    let bonusRewardAmount: number | null = null;
    let bonusSourceWagerAmount: number | null = null;
    let rewardPreviewText: string | null = null;
    let rewardWager: MissionCheckinWagerRow | null = null;
    const rewardCurrency = mission.rewardCurrency as CurrencyKey;

    if (mission.kind === "checkin") {
      const latestClaim = await getLatestMissionClaim(tx, userId, mission.id);
      rewardWager = await getMissionCheckinWagerByRewardPeriod(tx, userId, mission.id, window.periodKey);
      if (rewardWager && rewardWager.rewardCurrency !== rewardCurrency) {
        throw new ConflictError("签到奖励的待结算压注币种与当前任务配置不一致，请先联系管理员处理。");
      }
      streakDays =
        latestClaim && latestClaim.periodKey === previousChinaDateKey(window.periodKey)
          ? (buildCheckinStateFromSnapshot(latestClaim.progressSnapshot) ?? 1) + 1
          : 1;
      progressCurrent = 1;
      baseRewardAmount = mission.rewardAmount;
      bonusRewardAmount = rewardWager?.bonusAmount ?? 0;
      bonusSourceWagerAmount = rewardWager?.wagerAmount ?? null;
      rewardPreviewText = buildCheckinRewardPreviewText(baseRewardAmount, bonusRewardAmount);
    } else {
      progressCurrent = await countMetricProgress(tx, userId, mission.metricKey, window.from, window.to);
      if (progressCurrent < mission.progressTarget) {
        throw new ConflictError("任务尚未完成。");
      }
    }

    const claimedAt = now();
    const claimedAmount = mission.kind === "checkin" ? (baseRewardAmount ?? 0) + (bonusRewardAmount ?? 0) : mission.rewardAmount;
    const claimId = crypto.randomUUID();

    await tx.insert(personalMissionClaims).values({
      id: claimId,
      missionId: mission.id,
      userId,
      periodKey: window.periodKey,
      progressSnapshot:
        mission.kind === "checkin"
          ? {
              progressCurrent,
              progressTarget: 1,
              streakDays,
            }
          : {
              progressCurrent,
              progressTarget: mission.progressTarget,
            },
      rewardCurrency,
      rewardAmount: claimedAmount,
      baseRewardAmount,
      bonusRewardAmount,
      bonusSourceWagerAmount,
      bonusMultiplier: mission.kind === "checkin" ? CHECKIN_WAGER_MULTIPLIER : null,
      claimedAt,
    });

    if (rewardWager) {
      await consumeMissionCheckinWagerRow(tx, rewardWager.id, claimId, claimedAt);
    }

    const note =
      mission.kind === "checkin"
        ? `签到奖励：${rewardPreviewText ?? claimedAmount}，连续 ${streakDays ?? 1} 天`
        : `个人任务奖励：${mission.title}`;

    await grantBalance(
      userId,
      rewardCurrency,
      claimedAmount,
      note,
      "mission",
      `${mission.id}:${window.periodKey}`,
      tx,
    );

    await enqueueOutboxEvent(
      "mission.claimed",
      {
        userId,
        missionId: mission.id,
        kind: mission.kind,
        metricKey: mission.metricKey,
        rewardCurrency,
        claimedAmount,
        baseRewardAmount,
        bonusRewardAmount,
        bonusSourceWagerAmount,
        rewardPreviewText,
        periodKey: window.periodKey,
        streakDays,
      },
      tx,
    );

    return {
      missionId: mission.id,
      kind: mission.kind,
      rewardCurrency,
      claimedAmount,
      baseRewardAmount,
      bonusRewardAmount,
      bonusSourceWagerAmount,
      rewardPreviewText,
      claimedAt: claimedAt.toISOString(),
      periodKey: window.periodKey,
      streakDays,
    };
  });
}

export async function listOperatorMissionDefinitions(
  operatorUserId: string,
  providerUserId?: string | null,
): Promise<MissionDefinitionView[]> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const rows = await listOperatorMissionDefinitionRows();
  return rows.map(toMissionDefinitionView);
}

export async function createOperatorMissionDefinition(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  input: UpsertMissionDefinitionInput,
): Promise<MissionDefinitionView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const timestamp = now();
  const normalized = normalizeMissionInput(input);
  const row = await insertMissionDefinitionRow({
    id: crypto.randomUUID(),
    ...normalized,
    createdByUserId: operatorUserId,
    updatedByUserId: operatorUserId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return toMissionDefinitionView(row);
}

export async function updateOperatorMissionDefinition(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  missionId: string,
  input: UpsertMissionDefinitionInput,
): Promise<MissionDefinitionView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getMissionDefinitionRowById(missionId);
  if (!current) {
    throw new NotFoundError("任务不存在。");
  }

  if (current.kind === "checkin" && current.rewardCurrency !== input.rewardCurrency) {
    const hasPendingWagers = await hasPendingMissionCheckinWagers(missionId);
    if (hasPendingWagers) {
      throw new ConflictError("该签到任务仍有待结算压注，暂不能切换奖励货币。");
    }
  }

  const normalized = normalizeMissionInput(input, current);
  const updated = await updateMissionDefinitionRow(missionId, {
    ...normalized,
    updatedByUserId: operatorUserId,
    updatedAt: now(),
  });

  if (!updated) {
    throw new NotFoundError("任务不存在。");
  }

  return toMissionDefinitionView(updated);
}

export async function archiveOperatorMissionDefinition(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  missionId: string,
): Promise<MissionDefinitionView> {
  assertPlatformOperator(operatorUserId, providerUserId);
  const current = await getMissionDefinitionRowById(missionId);
  if (!current) {
    throw new NotFoundError("任务不存在。");
  }

  const updated = await updateMissionDefinitionRow(missionId, {
    status: "archived",
    archivedAt: current.archivedAt ?? now(),
    updatedByUserId: operatorUserId,
    updatedAt: now(),
  });

  if (!updated) {
    throw new NotFoundError("任务不存在。");
  }

  return toMissionDefinitionView(updated);
}

export async function deleteOperatorMissionDefinition(
  operatorUserId: string,
  providerUserId: string | null | undefined,
  missionId: string,
) {
  assertPlatformOperator(operatorUserId, providerUserId);
  const deleted = await deleteMissionDefinitionRow(missionId);
  if (!deleted) {
    throw new NotFoundError("任务不存在。");
  }
  return { id: missionId };
}
