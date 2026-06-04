
import type {
  CreateOpinionTopicCommentInput,
  CreateOpinionTopicInput,
  ModerateOpinionTopicInput,
  OpinionHubSettingsView,
  OpinionMonthlySettlementItemStatus,
  OpinionMonthlySettlementItemView,
  OpinionMonthlySettlementRunDetailView,
  OpinionMonthlySettlementRunView,
  OpinionModerationReasonCategory,
  OpinionTopicDetailView,
  OpinionTopicDiscussionStatus,
  OpinionTopicReviewStatus,
  OpinionTopicSortMode,
  OpinionTopicStatus,
  OpinionTopicTag,
  UpdateOpinionHubSettingsInput,
  UpdateOpinionMonthlySettlementItemInput,
} from "@neuro/contracts";
import {
  getUserProgressionAccessRule,
  getUserProgressionSnapshot,
  transferBalance,
} from "@neuro/account-domain";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { getDevelopmentQueueStatusEventName } from "@/modules/development-queue/events";
import { developmentQueueItems } from "@/modules/development-queue/schema";
import { buildOpinionTopicQueueSnapshot, queueSourceForDevelopmentInTx } from "@/modules/development-queue/service";
import { getDevelopmentQueueItemByIdInTx } from "@/modules/development-queue/repository";
import {
  getOpinionHubSettingsInTx,
  getOpinionMonthlySettlementItemByIdInTx,
  getOpinionMonthlySettlementRunInTx,
  getOpinionTopicCommentByIdInTx,
  getOpinionTopicByIdInTx,
  getOpinionTopicOpposeCountForUserInTx,
  getOpinionTopicSupportCountForUserInTx,
  listOpinionMonthlySettlementItemsInTx,
  listOpinionMonthlySettlementRunsInTx,
  listOpinionTopicCommentsInTx,
  listOpinionTopicOpposeSummariesForUserInTx,
  listOpinionTopicMonthlyLeadersInTx,
  listOpinionTopicSupportSummariesForUserInTx,
  listOpinionTopicsForOperatorInTx,
  listOpinionTopicsForViewerInTx,
  type OpinionMonthlySettlementItemRecord,
  type OpinionMonthlySettlementRunRecord,
  type OpinionTopicCommentRecordWithAuthor,
  type OpinionTopicRecordWithCreator,
} from "@/modules/opinion-hub/repository";
import {
  opinionHubSettings,
  opinionTopicComments,
  opinionTopicMonthlySettlementItems,
  opinionTopicMonthlySettlementRuns,
  opinionTopicOpposes,
  opinionTopics,
  opinionTopicSupports,
} from "@/modules/opinion-hub/schema";
import {
  DEFAULT_COMMENT_TICKET_COST,
  DEFAULT_OPINION_TOPIC_CREATION_TICKET_COST,
  DEFAULT_OPINION_TOPIC_DIFFICULTY_LEVEL,
  DEFAULT_OPINION_TOPIC_TARGET_SUPPORT_COUNT,
  DEFAULT_SUPPORT_RATE_THRESHOLD,
  OPINION_HUB_SETTINGS_ID,
  OPINION_TOPIC_PAGE_SIZE,
  opinionTopicTagKeys,
  type OpinionGovernanceDetailView,
  type OpinionGovernanceView,
  type OpinionHubSettingsState,
  type OpinionTopicCollectionView,
  type OpinionTopicListOptions,
} from "@/modules/opinion-hub/types";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

const OPINION_TICKET_POOL_USER_ID = "platform:opinion_ticket_pool";
const DEFAULT_MONTHLY_LEADER_LIMIT = 10;
const DEFAULT_MONTHLY_SELECTION_LIMIT = 5;
const MAX_PAGE_SIZE = 50;
const MAX_COMMENT_LENGTH = 1200;
const MIN_COMMENT_LENGTH = 1;
const POLITICAL_KEYWORDS = [
  "涉政",
  "政治",
  "政府",
  "选举",
  "政党",
  "主席",
  "共产党",
  "反共",
  "官员",
  "民主运动",
  "示威",
  "游行",
  "台独",
  "港独",
  "疆独",
] as const;
const INVALID_KEYWORDS = [
  "傻逼",
  "傻b",
  "sb",
  "死妈",
  "去死",
  "滚",
  "垃圾",
  "废物",
  "脑残",
  "狗东西",
  "骂人",
] as const;

export type OpinionTopicSupportSummaryView = {
  topicId: string;
  ticketAmount: number;
  supportCount: number;
  lastSupportedAt: string;
};

export type OpinionTopicOpposeSummaryView = {
  topicId: string;
  ticketAmount: number;
  opposeCount: number;
  lastOpposedAt: string;
};

export type OpinionMonthlySettlementResult = {
  monthKey: string;
  settledCount: number;
  queuedCount: number;
  skipped: boolean;
  queueItemIds: string[];
};

function now() {
  return new Date();
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toRateNumber(raw: number | string) {
  return typeof raw === "string" ? Number(raw) : raw;
}

function calculateSupportRate(supportTicketTotal: number, opposeTicketTotal: number) {
  const allTickets = supportTicketTotal + opposeTicketTotal;
  if (allTickets <= 0) return 0;
  return supportTicketTotal / allTickets;
}

function isQualifiedByGovernance(args: {
  supportTicketTotal: number;
  opposeTicketTotal: number;
  targetSupportCount: number;
  supportRateThreshold: number;
}) {
  const supportRate = calculateSupportRate(args.supportTicketTotal, args.opposeTicketTotal);
  return args.supportTicketTotal >= args.targetSupportCount && supportRate >= args.supportRateThreshold;
}

function calculateRankingScore(
  topic: Pick<
    OpinionTopicRecordWithCreator,
    | "status"
    | "adoptedAt"
    | "supportTicketTotal"
    | "targetSupportCount"
    | "opposeTicketTotal"
    | "uniqueSupporterCount"
    | "uniqueOpposerCount"
  >,
) {
  const progress = topic.targetSupportCount <= 0 ? 0 : topic.supportTicketTotal / topic.targetSupportCount;
  const supportRate = calculateSupportRate(topic.supportTicketTotal, topic.opposeTicketTotal);
  const normalizedProgress = Math.min(progress, 2);
  const statusBonus =
    topic.status === "qualified"
      ? topic.adoptedAt
        ? 2_000_000
        : 1_000_000
      : topic.status === "collecting"
        ? 100_000
        : 0;
  return (
    statusBonus +
    Math.round(normalizedProgress * 100_000) +
    Math.round(supportRate * 10_000) +
    topic.uniqueSupporterCount * 50 +
    topic.uniqueOpposerCount * 20 +
    topic.supportTicketTotal * 10
  );
}

function buildSummary(summary: string | undefined, description: string) {
  const trimmedSummary = summary?.trim();
  if (trimmedSummary) {
    return trimmedSummary;
  }
  return description.trim().slice(0, 220);
}

function normalizeOpinionTopicTag(tag: OpinionTopicTag) {
  const normalizedTag = tag.trim() as OpinionTopicTag;
  if (!normalizedTag) {
    throw new BadRequestError("请选择 1 个标签");
  }
  if (!opinionTopicTagKeys.includes(normalizedTag)) {
    throw new BadRequestError("存在不支持的议题标签");
  }
  return [normalizedTag];
}

function clampPage(page: number | undefined) {
  if (!page || !Number.isFinite(page)) {
    return 1;
  }
  return Math.max(1, Math.floor(page));
}

function clampPageSize(pageSize: number | undefined) {
  if (!pageSize || !Number.isFinite(pageSize)) {
    return OPINION_TOPIC_PAGE_SIZE;
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

function normalizeTopicSort(sort: OpinionTopicSortMode | undefined) {
  if (sort === "supportRate" || sort === "createdAt" || sort === "governance") {
    return sort;
  }
  return "governance" as const;
}

async function hasOpinionTopicVoteForUserTodayInTx(
  tx: Parameters<typeof getOpinionTopicByIdInTx>[0],
  topicId: string,
  userId: string,
) {
  const rows = await tx.execute<{ voted_today: boolean }>(sql`
    select exists(
      select 1
      from (
        select created_at
        from opinion_topic_supports
        where topic_id = ${topicId}
          and user_id = ${userId}
        union all
        select created_at
        from opinion_topic_opposes
        where topic_id = ${topicId}
          and user_id = ${userId}
      ) as topic_votes
      where timezone('Asia/Shanghai', created_at) >= date_trunc('day', timezone('Asia/Shanghai', now()))
    ) as voted_today
  `);

  return Boolean(rows.rows[0]?.voted_today);
}

function canViewerSeeTopic(viewerUserId: string, topic: OpinionTopicRecordWithCreator) {
  if (topic.reviewStatus === "published" && !topic.deletedAt) {
    return true;
  }

  return (
    topic.creatorUserId === viewerUserId &&
    (topic.reviewStatus === "pending_review" || topic.reviewStatus === "rejected" || topic.reviewStatus === "published")
  );
}

function canInteractWithTopic(topic: OpinionTopicRecordWithCreator) {
  return (
    topic.reviewStatus === "published" &&
    topic.status !== "archived" &&
    !topic.adoptedAt &&
    !topic.deletedAt &&
    !topic.bannedAt
  );
}

function toOpinionTopicView(
  topic: OpinionTopicRecordWithCreator,
  viewerUserId: string,
): OpinionGovernanceView {
  const isCreator = topic.creatorUserId === viewerUserId;
  const canInteract = canInteractWithTopic(topic);
  const supportRateThreshold = toRateNumber(topic.supportRateThreshold);
  const supportRate = calculateSupportRate(topic.supportTicketTotal, topic.opposeTicketTotal);
  const meetsGovernanceThreshold = isQualifiedByGovernance({
    supportTicketTotal: topic.supportTicketTotal,
    opposeTicketTotal: topic.opposeTicketTotal,
    targetSupportCount: topic.targetSupportCount,
    supportRateThreshold,
  });

  return {
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    description: topic.description,
    requirements: topic.requirements ?? null,
    tags: Array.isArray(topic.tags) ? (topic.tags as OpinionTopicTag[]) : [],
    creatorUserId: topic.creatorUserId,
    creatorUsername: topic.creatorUsername,
    difficultyLevel: topic.difficultyLevel as 1 | 2 | 3 | 4 | 5,
    creationTicketCost: topic.creationTicketCost,
    targetSupportCount: topic.targetSupportCount,
    supportTicketTotal: topic.supportTicketTotal,
    opposeTicketTotal: topic.opposeTicketTotal,
    uniqueSupporterCount: topic.uniqueSupporterCount,
    uniqueOpposerCount: topic.uniqueOpposerCount,
    supportProgressRate: Number(
      Math.min(1, topic.targetSupportCount <= 0 ? 0 : topic.supportTicketTotal / topic.targetSupportCount).toFixed(4),
    ),
    supportRate: Number(supportRate.toFixed(4)),
    supportRateThreshold: Number(supportRateThreshold.toFixed(4)),
    status: topic.status as OpinionTopicStatus,
    reviewStatus: topic.reviewStatus as OpinionTopicReviewStatus,
    discussionStatus: topic.discussionStatus as OpinionTopicDiscussionStatus,
    moderationReasonCategory: topic.moderationReasonCategory as OpinionModerationReasonCategory | null,
    moderationReasonDetail: topic.moderationReasonDetail ?? null,
    moderationNote: topic.moderationNote ?? null,
    reviewedAt: toIso(topic.reviewedAt),
    reviewedByUserId: topic.reviewedByUserId ?? null,
    commentCount: topic.commentCount,
    lastCommentedAt: toIso(topic.lastCommentedAt),
    adoptedAt: toIso(topic.adoptedAt),
    adoptedByUserId: topic.adoptedByUserId ?? null,
    archivedAt: toIso(topic.archivedAt),
    bannedAt: toIso(topic.bannedAt),
    deletedAt: toIso(topic.deletedAt),
    canArchive: isCreator && topic.reviewStatus === "published" && topic.status !== "archived",
    canAdopt: isCreator && topic.reviewStatus === "published" && topic.status === "qualified" && !topic.adoptedAt && meetsGovernanceThreshold,
    canSupport: canInteract,
    canOppose: canInteract,
    canComment: canInteract && topic.discussionStatus === "open",
    rankingScore: calculateRankingScore(topic),
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  };
}

function toOpinionTopicCommentView(comment: OpinionTopicCommentRecordWithAuthor) {
  return {
    id: comment.id,
    topicId: comment.topicId,
    authorUserId: comment.authorUserId,
    authorUsername: comment.authorUsername,
    parentCommentId: comment.parentCommentId ?? null,
    replyToCommentId: comment.replyToCommentId ?? null,
    replyToUserId: comment.replyToUserId ?? null,
    replyToUsername: comment.replyToUsername ?? null,
    content: comment.content,
    ticketCost: comment.ticketCost,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

function toOpinionHubSettingsView(settings: typeof opinionHubSettings.$inferSelect): OpinionHubSettingsState {
  return {
    preModerationEnabled: settings.preModerationEnabled,
    commentTicketCost: settings.commentTicketCost,
    updatedAt: settings.updatedAt.toISOString(),
    updatedByUserId: settings.updatedByUserId ?? null,
  };
}

function toMonthlyLeaderView(topic: OpinionTopicRecordWithCreator, rank: number) {
  return {
    rank,
    topicId: topic.id,
    title: topic.title,
    supportRate: Number(calculateSupportRate(topic.supportTicketTotal, topic.opposeTicketTotal).toFixed(4)),
    supportTicketTotal: topic.supportTicketTotal,
    uniqueSupporterCount: topic.uniqueSupporterCount,
  };
}

function createTopicCollection(args: {
  rows: OpinionTopicRecordWithCreator[];
  monthlyLeaders: OpinionTopicRecordWithCreator[];
  page: number;
  pageSize: number;
  sort: OpinionTopicSortMode;
  totalCount: number;
  viewerUserId: string;
}): OpinionTopicCollectionView {
  const totalPages = Math.max(1, Math.ceil(args.totalCount / args.pageSize));
  return {
    topics: args.rows.map((row) => toOpinionTopicView(row, args.viewerUserId)),
    page: Math.min(args.page, totalPages),
    pageSize: args.pageSize,
    totalCount: args.totalCount,
    totalPages,
    sort: args.sort,
    monthlyLeaders: args.monthlyLeaders.map((topic, index) => toMonthlyLeaderView(topic, index + 1)),
  };
}

function toOpinionMonthlySettlementItemView(item: OpinionMonthlySettlementItemRecord): OpinionMonthlySettlementItemView {
  return {
    id: item.id,
    monthKey: item.monthKey,
    rank: item.rank,
    topicId: item.topicId,
    title: item.title,
    supportRate: Number(toRateNumber(item.supportRate).toFixed(4)),
    supportTicketTotal: item.supportTicketTotal,
    uniqueSupporterCount: item.uniqueSupporterCount,
    queueItemId: item.queueItemId ?? null,
    selectionStatus: item.selectionStatus as OpinionMonthlySettlementItemStatus,
    selectedOrder: item.selectedOrder ?? null,
    operatorNote: item.operatorNote ?? null,
    operatorActionedAt: toIso(item.operatorActionedAt),
    operatorActionedByUserId: item.operatorActionedByUserId ?? null,
  };
}

function toOpinionMonthlySettlementRunView(run: OpinionMonthlySettlementRunRecord): OpinionMonthlySettlementRunView {
  return {
    monthKey: run.monthKey,
    candidateCount: run.settledCount,
    selectedCount: run.selectedCount,
    selectionLimit: run.selectionLimit,
    settledAt: run.settledAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function buildOpinionMonthlySettlementRunDetail(args: {
  run: OpinionMonthlySettlementRunRecord;
  items: OpinionMonthlySettlementItemRecord[];
}): OpinionMonthlySettlementRunDetailView {
  return {
    run: toOpinionMonthlySettlementRunView(args.run),
    items: args.items.map((item) => toOpinionMonthlySettlementItemView(item)),
  };
}

function containsKeyword(source: string, keywords: readonly string[]) {
  return keywords.find((keyword) => source.includes(keyword)) ?? null;
}

function evaluateTopicModeration(args: {
  title: string;
  summary: string;
  description: string;
  requirements: string | null;
  preModerationEnabled: boolean;
}) {
  const seed = `${args.title}\n${args.summary}\n${args.description}\n${args.requirements ?? ""}`.toLowerCase();
  const politicalKeyword = containsKeyword(seed, POLITICAL_KEYWORDS);
  if (politicalKeyword) {
    return {
      reviewStatus: "pending_review" as const,
      moderationReasonCategory: "political" as const,
      moderationReasonDetail: `自动命中涉政敏感词：${politicalKeyword}`,
    };
  }

  const invalidKeyword = containsKeyword(seed, INVALID_KEYWORDS);
  if (invalidKeyword) {
    return {
      reviewStatus: "pending_review" as const,
      moderationReasonCategory: "invalid" as const,
      moderationReasonDetail: `自动命中无效/辱骂词：${invalidKeyword}`,
    };
  }

  if (args.preModerationEnabled) {
    return {
      reviewStatus: "pending_review" as const,
      moderationReasonCategory: "pre_moderation" as const,
      moderationReasonDetail: "当前议题系统已开启先审后放。",
    };
  }

  return {
    reviewStatus: "published" as const,
    moderationReasonCategory: null,
    moderationReasonDetail: null,
  };
}

async function ensureOpinionHubSettingsInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const current = await getOpinionHubSettingsInTx(tx);
  if (current) {
    return current;
  }

  const [created] = await tx
    .insert(opinionHubSettings)
    .values({
      id: OPINION_HUB_SETTINGS_ID,
      preModerationEnabled: false,
      commentTicketCost: DEFAULT_COMMENT_TICKET_COST,
      updatedAt: now(),
      updatedByUserId: null,
    })
    .returning();

  return created;
}

function normalizeListOptions(options: OpinionTopicListOptions | undefined) {
  return {
    page: clampPage(options?.page),
    pageSize: clampPageSize(options?.pageSize),
    sort: normalizeTopicSort(options?.sort),
    topicTag: options?.topicTag,
    topicStatus: options?.topicStatus,
  };
}

function buildTopicDetail(args: {
  topic: OpinionTopicRecordWithCreator;
  comments: OpinionTopicCommentRecordWithAuthor[];
  viewerUserId: string;
}): OpinionTopicDetailView {
  return {
    topic: toOpinionTopicView(args.topic, args.viewerUserId),
    comments: args.comments.map((comment) => toOpinionTopicCommentView(comment)),
  };
}

export async function listOpinionTopicCollection(
  viewerUserId: string,
  options?: OpinionTopicListOptions,
): Promise<OpinionTopicCollectionView> {
  const normalized = normalizeListOptions(options);
  return db.transaction(async (tx) => {
    const [result, monthlyLeaders] = await Promise.all([
      listOpinionTopicsForViewerInTx(tx, {
        viewerUserId,
        page: normalized.page,
        pageSize: normalized.pageSize,
        sort: normalized.sort,
        topicTag: normalized.topicTag,
        topicStatus: normalized.topicStatus,
      }),
      listOpinionTopicMonthlyLeadersInTx(tx, DEFAULT_MONTHLY_LEADER_LIMIT),
    ]);

    return createTopicCollection({
      rows: result.rows,
      monthlyLeaders: monthlyLeaders.map((row) => ({
        ...row.topic,
        creatorUsername: row.creatorUsername,
      })),
      page: normalized.page,
      pageSize: normalized.pageSize,
      sort: normalized.sort,
      totalCount: result.totalCount,
      viewerUserId,
    });
  });
}

export async function listOpinionTopics(viewerUserId: string): Promise<OpinionGovernanceView[]> {
  const collection = await listOpinionTopicCollection(viewerUserId, {
    page: 1,
    pageSize: MAX_PAGE_SIZE,
    sort: "governance",
  });
  return collection.topics;
}

export async function getOpinionTopicDetail(
  viewerUserId: string,
  topicId: string,
): Promise<OpinionGovernanceDetailView> {
  return db.transaction(async (tx) => {
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic || !canViewerSeeTopic(viewerUserId, topic)) {
      throw new NotFoundError("议题不存在或当前不可见");
    }

    const comments = topic.reviewStatus === "published" ? await listOpinionTopicCommentsInTx(tx, topic.id) : [];
    return buildTopicDetail({
      topic,
      comments,
      viewerUserId,
    });
  });
}

export async function listOperatorOpinionTopicCollection(
  actorUserId: string,
  options?: OpinionTopicListOptions & { reviewStatus?: OpinionTopicReviewStatus | "all" },
): Promise<OpinionTopicCollectionView> {
  const normalized = normalizeListOptions(options);
  return db.transaction(async (tx) => {
    const [result, monthlyLeaders] = await Promise.all([
      listOpinionTopicsForOperatorInTx(tx, {
        page: normalized.page,
        pageSize: normalized.pageSize,
        reviewStatus: options?.reviewStatus,
        sort: normalized.sort,
        topicTag: normalized.topicTag,
        topicStatus: normalized.topicStatus,
      }),
      listOpinionTopicMonthlyLeadersInTx(tx, DEFAULT_MONTHLY_LEADER_LIMIT),
    ]);

    return createTopicCollection({
      rows: result.rows,
      monthlyLeaders: monthlyLeaders.map((row) => ({
        ...row.topic,
        creatorUsername: row.creatorUsername,
      })),
      page: normalized.page,
      pageSize: normalized.pageSize,
      sort: normalized.sort,
      totalCount: result.totalCount,
      viewerUserId: actorUserId,
    });
  });
}

export async function getOperatorOpinionTopicDetail(
  actorUserId: string,
  topicId: string,
): Promise<OpinionGovernanceDetailView> {
  return db.transaction(async (tx) => {
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic) {
      throw new NotFoundError("议题不存在");
    }

    const comments = await listOpinionTopicCommentsInTx(tx, topic.id);
    return buildTopicDetail({
      topic,
      comments,
      viewerUserId: actorUserId,
    });
  });
}

export async function listOpinionTopicSupportSummariesForUser(
  userId: string,
): Promise<OpinionTopicSupportSummaryView[]> {
  return db.transaction(async (tx) => {
    const rows = await listOpinionTopicSupportSummariesForUserInTx(tx, userId);
    return rows.map((row) => ({
      topicId: row.topicId,
      ticketAmount: Number(row.ticketAmount ?? 0),
      supportCount: Number(row.supportCount ?? 0),
      lastSupportedAt:
        row.lastSupportedAt instanceof Date ? row.lastSupportedAt.toISOString() : new Date().toISOString(),
    }));
  });
}

export async function listOpinionTopicOpposeSummariesForUser(
  userId: string,
): Promise<OpinionTopicOpposeSummaryView[]> {
  return db.transaction(async (tx) => {
    const rows = await listOpinionTopicOpposeSummariesForUserInTx(tx, userId);
    return rows.map((row) => ({
      topicId: row.topicId,
      ticketAmount: Number(row.ticketAmount ?? 0),
      opposeCount: Number(row.opposeCount ?? 0),
      lastOpposedAt:
        row.lastOpposedAt instanceof Date ? row.lastOpposedAt.toISOString() : new Date().toISOString(),
    }));
  });
}

export async function getOpinionHubSettings(): Promise<OpinionHubSettingsView> {
  return db.transaction(async (tx) => {
    const settings = await ensureOpinionHubSettingsInTx(tx);
    return toOpinionHubSettingsView(settings);
  });
}

export async function updateOpinionHubSettings(
  actorUserId: string,
  input: UpdateOpinionHubSettingsInput,
): Promise<OpinionHubSettingsView> {
  return db.transaction(async (tx) => {
    await ensureOpinionHubSettingsInTx(tx);
    const [updated] = await tx
      .update(opinionHubSettings)
      .set({
        preModerationEnabled: input.preModerationEnabled,
        updatedAt: now(),
        updatedByUserId: actorUserId,
      })
      .where(eq(opinionHubSettings.id, OPINION_HUB_SETTINGS_ID))
      .returning();

    return toOpinionHubSettingsView(updated);
  });
}

async function archiveDevelopmentQueueItemForSettlementInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  queueItemId: string,
) {
  const queueItem = await getDevelopmentQueueItemByIdInTx(tx, queueItemId);
  if (!queueItem || queueItem.status === "archived") {
    return queueItem ?? null;
  }

  const archivedAt = now();
  const [updated] = await tx
    .update(developmentQueueItems)
    .set({
      status: "archived",
      archivedAt,
      updatedAt: archivedAt,
    })
    .where(eq(developmentQueueItems.id, queueItem.id))
    .returning();

  await enqueueOutboxEvent(
    getDevelopmentQueueStatusEventName("archived"),
    {
      queueItemId: updated.id,
      sourceType: updated.sourceType,
      sourceId: updated.sourceId,
      ownerUserId: updated.ownerUserId,
      status: updated.status,
    },
    tx,
  );

  return updated;
}

async function reopenDevelopmentQueueItemForSettlementInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  queueItemId: string,
) {
  const queueItem = await getDevelopmentQueueItemByIdInTx(tx, queueItemId);
  if (!queueItem) {
    return null;
  }
  if (queueItem.status !== "archived") {
    return queueItem;
  }

  const reopenedAt = now();
  const [updated] = await tx
    .update(developmentQueueItems)
    .set({
      status: "queued",
      queuedAt: reopenedAt,
      startedAt: null,
      deliveredAt: null,
      archivedAt: null,
      updatedAt: reopenedAt,
    })
    .where(eq(developmentQueueItems.id, queueItem.id))
    .returning();

  await enqueueOutboxEvent(
    getDevelopmentQueueStatusEventName("queued"),
    {
      queueItemId: updated.id,
      sourceType: updated.sourceType,
      sourceId: updated.sourceId,
      ownerUserId: updated.ownerUserId,
      status: updated.status,
    },
    tx,
  );

  return updated;
}

async function ensureDevelopmentQueueItemForSettlementInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  item: OpinionMonthlySettlementItemRecord,
) {
  if (item.queueItemId) {
    const restored = await reopenDevelopmentQueueItemForSettlementInTx(tx, item.queueItemId);
    return restored?.id ?? item.queueItemId;
  }

  const topic = await getOpinionTopicByIdInTx(tx, item.topicId);
  if (!topic) {
    throw new NotFoundError("议题不存在，无法为候补池创建开发排期项");
  }

  const queueItem = await queueSourceForDevelopmentInTx(
    tx,
    buildOpinionTopicQueueSnapshot({
      topicId: topic.id,
      ownerUserId: topic.creatorUserId,
      title: topic.title,
      description: topic.description,
      difficultyLevel: topic.difficultyLevel,
      supportTicketTotal: topic.supportTicketTotal,
      opposeTicketTotal: topic.opposeTicketTotal,
      supportRate: calculateSupportRate(topic.supportTicketTotal, topic.opposeTicketTotal),
      priorityScore: calculateRankingScore(topic),
      adoptedAt: now(),
    }),
  );

  const restored = await reopenDevelopmentQueueItemForSettlementInTx(tx, queueItem.id);
  return restored?.id ?? queueItem.id;
}

async function reconcileOpinionMonthlySettlementRunInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  monthKey: string,
) {
  const run = await getOpinionMonthlySettlementRunInTx(tx, monthKey);
  if (!run) {
    throw new NotFoundError("当前月份还没有候补池结算记录");
  }

  const items = await listOpinionMonthlySettlementItemsInTx(tx, monthKey);
  let selectedCount = 0;
  const reconciledItems: OpinionMonthlySettlementItemRecord[] = [];

  for (const item of items) {
    const desiredSelectionStatus =
      item.selectionStatus === "excluded"
        ? ("excluded" as const)
        : selectedCount < Math.max(1, run.selectionLimit)
          ? ("selected" as const)
          : ("standby" as const);
    const desiredSelectedOrder = desiredSelectionStatus === "selected" ? selectedCount + 1 : null;
    let nextQueueItemId = item.queueItemId ?? null;

    if (desiredSelectionStatus === "selected") {
      nextQueueItemId = await ensureDevelopmentQueueItemForSettlementInTx(tx, item);
      selectedCount += 1;
    } else if (nextQueueItemId) {
      await archiveDevelopmentQueueItemForSettlementInTx(tx, nextQueueItemId);
    }

    if (
      item.selectionStatus !== desiredSelectionStatus ||
      (item.selectedOrder ?? null) !== desiredSelectedOrder ||
      item.queueItemId !== nextQueueItemId
    ) {
      const [updated] = await tx
        .update(opinionTopicMonthlySettlementItems)
        .set({
          selectionStatus: desiredSelectionStatus,
          selectedOrder: desiredSelectedOrder,
          queueItemId: nextQueueItemId,
        })
        .where(eq(opinionTopicMonthlySettlementItems.id, item.id))
        .returning();

      reconciledItems.push({
        ...updated,
        title: item.title,
      });
      continue;
    }

    reconciledItems.push({
      ...item,
      queueItemId: nextQueueItemId,
      selectedOrder: desiredSelectedOrder,
      selectionStatus: desiredSelectionStatus,
    });
  }

  const updatedAt = now();
  const [updatedRun] = await tx
    .update(opinionTopicMonthlySettlementRuns)
    .set({
      settledCount: items.length,
      selectedCount,
      updatedAt,
    })
    .where(eq(opinionTopicMonthlySettlementRuns.monthKey, monthKey))
    .returning();

  return buildOpinionMonthlySettlementRunDetail({
    run: updatedRun,
    items: reconciledItems,
  });
}

export async function createOpinionTopic(userId: string, input: CreateOpinionTopicInput): Promise<OpinionGovernanceView> {
  return db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({
      where: (row, operators) => operators.eq(row.id, userId),
    });
    if (!user) {
      throw new UnauthorizedError("当前用户不存在，无法发起议题");
    }

    const progression = await getUserProgressionSnapshot(
      {
        userId: user.id,
        trustLevel: user.trustLevel,
      },
      tx,
    );
    const accessRule = getUserProgressionAccessRule(progression, "createOpinionTopic");
    if (!accessRule.satisfied) {
      throw new UnauthorizedError(accessRule.note);
    }

    const settings = await ensureOpinionHubSettingsInTx(tx);
    const summary = buildSummary(undefined, input.description);
    const requirements = null;
    const normalizedTags = normalizeOpinionTopicTag(input.tag);
    const moderation = evaluateTopicModeration({
      title: input.title,
      summary,
      description: input.description,
      requirements,
      preModerationEnabled: settings.preModerationEnabled,
    });
    const createdAt = now();
    const topicId = crypto.randomUUID();

    await transferBalance({
      fromUserId: userId,
      toUserId: OPINION_TICKET_POOL_USER_ID,
      currency: "opinionTickets",
      amount: DEFAULT_OPINION_TOPIC_CREATION_TICKET_COST,
      note: `发起议题门槛：${input.title}`,
      referenceType: "opinionTopicCreate",
      referenceId: topicId,
      tx,
    });

    const [topic] = await tx
      .insert(opinionTopics)
      .values({
        id: topicId,
        creatorUserId: userId,
        title: input.title.trim(),
        summary,
        description: input.description.trim(),
        requirements,
        tags: normalizedTags,
        difficultyLevel: DEFAULT_OPINION_TOPIC_DIFFICULTY_LEVEL,
        creationTicketCost: DEFAULT_OPINION_TOPIC_CREATION_TICKET_COST,
        targetSupportCount: DEFAULT_OPINION_TOPIC_TARGET_SUPPORT_COUNT,
        supportTicketTotal: 0,
        opposeTicketTotal: 0,
        uniqueSupporterCount: 0,
        uniqueOpposerCount: 0,
        supportRateThreshold: DEFAULT_SUPPORT_RATE_THRESHOLD.toFixed(4),
        status: "collecting",
        reviewStatus: moderation.reviewStatus,
        discussionStatus: "open",
        moderationReasonCategory: moderation.moderationReasonCategory,
        moderationReasonDetail: moderation.moderationReasonDetail,
        moderationNote: null,
        reviewedAt: moderation.reviewStatus === "published" ? createdAt : null,
        reviewedByUserId: null,
        commentCount: 0,
        lastCommentedAt: null,
        adoptedAt: null,
        adoptedByUserId: null,
        archivedAt: null,
        bannedAt: null,
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    await enqueueOutboxEvent("opinionTopic.created", { topicId, creatorUserId: userId }, tx);

    return toOpinionTopicView(
      {
        ...topic,
        creatorUsername: user.username,
      },
      userId,
    );
  });
}

export async function listOpinionMonthlySettlementRuns(limit = 12): Promise<OpinionMonthlySettlementRunView[]> {
  const normalizedLimit = Math.max(1, Math.min(24, Math.floor(limit || 12)));
  return db.transaction(async (tx) => {
    const runs = await listOpinionMonthlySettlementRunsInTx(tx, normalizedLimit);
    return runs.map((run) => toOpinionMonthlySettlementRunView(run));
  });
}

export async function getOpinionMonthlySettlementRunDetail(
  monthKey: string,
): Promise<OpinionMonthlySettlementRunDetailView> {
  return db.transaction(async (tx) => {
    const run = await getOpinionMonthlySettlementRunInTx(tx, monthKey);
    if (!run) {
      throw new NotFoundError("当前月份还没有候补池结算记录");
    }
    const items = await listOpinionMonthlySettlementItemsInTx(tx, monthKey);
    return buildOpinionMonthlySettlementRunDetail({
      run,
      items,
    });
  });
}

export async function updateOpinionMonthlySettlementItemDecision(
  actorUserId: string,
  monthKey: string,
  itemId: string,
  input: UpdateOpinionMonthlySettlementItemInput,
): Promise<OpinionMonthlySettlementRunDetailView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select month_key
      from opinion_topic_monthly_settlement_runs
      where month_key = ${monthKey}
      for update
    `);

    const item = await getOpinionMonthlySettlementItemByIdInTx(tx, monthKey, itemId);
    if (!item) {
      throw new NotFoundError("当前候补池条目不存在");
    }

    const operatorNote = input.note?.trim() ? input.note.trim() : null;
    const operatorActionedAt = now();
    const selectionStatus = input.action === "exclude" ? "excluded" : item.selectionStatus === "excluded" ? "standby" : item.selectionStatus;

    if (input.action === "exclude" && item.selectionStatus === "excluded") {
      throw new ConflictError("该议题已经被排除出本月候补池");
    }
    if (input.action === "restore" && item.selectionStatus !== "excluded") {
      throw new ConflictError("该议题当前不在排除态，无需恢复");
    }

    await tx
      .update(opinionTopicMonthlySettlementItems)
      .set({
        selectionStatus,
        selectedOrder: null,
        operatorNote,
        operatorActionedAt,
        operatorActionedByUserId: actorUserId,
      })
      .where(eq(opinionTopicMonthlySettlementItems.id, item.id));

    return reconcileOpinionMonthlySettlementRunInTx(tx, monthKey);
  });
}

export async function runOpinionMonthlyLeaderSettlement(limit = DEFAULT_MONTHLY_LEADER_LIMIT): Promise<OpinionMonthlySettlementResult> {
  const settlementLimit = Math.max(
    DEFAULT_MONTHLY_SELECTION_LIMIT,
    Math.min(DEFAULT_MONTHLY_LEADER_LIMIT, Math.floor(limit || DEFAULT_MONTHLY_LEADER_LIMIT)),
  );

  return db.transaction(async (tx) => {
    const metaRows = await tx.execute<{
      month_key: string;
      current_month_start_local: string;
    }>(sql`
      select
        to_char((timezone('Asia/Shanghai', now()) - interval '1 month'), 'YYYY-MM') as month_key,
        date_trunc('month', timezone('Asia/Shanghai', now()))::text as current_month_start_local
    `);
    const meta = metaRows.rows[0];
    if (!meta?.month_key || !meta.current_month_start_local) {
      throw new ConflictError("无法计算当前月结窗口");
    }

    const timestamp = now();
    const runInsert = await tx
      .insert(opinionTopicMonthlySettlementRuns)
      .values({
        monthKey: meta.month_key,
        settledCount: 0,
        selectedCount: 0,
        selectionLimit: DEFAULT_MONTHLY_SELECTION_LIMIT,
        settledAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoNothing()
      .returning({ monthKey: opinionTopicMonthlySettlementRuns.monthKey });

    if (runInsert.length === 0) {
      const existingRun = await getOpinionMonthlySettlementRunInTx(tx, meta.month_key);
      const existingItems = await listOpinionMonthlySettlementItemsInTx(tx, meta.month_key);
      return {
        monthKey: meta.month_key,
        settledCount: existingRun?.settledCount ?? existingItems.length,
        queuedCount: 0,
        skipped: true,
        queueItemIds: existingItems
          .filter((item) => item.selectionStatus === "selected")
          .map((item) => item.queueItemId)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      };
    }

    const leaderRows = await tx.execute<{
      id: string;
      creator_user_id: string;
      title: string;
      description: string;
      difficulty_level: number | null;
      support_ticket_total: number | string;
      oppose_ticket_total: number | string;
      unique_supporter_count: number | string;
      unique_opposer_count: number | string;
    }>(sql`
      select
        id,
        creator_user_id,
        title,
        description,
        difficulty_level,
        support_ticket_total,
        oppose_ticket_total,
        unique_supporter_count,
        unique_opposer_count
      from opinion_topics
      where review_status = 'published'
        and status in ('collecting', 'qualified')
        and adopted_at is null
        and deleted_at is null
        and banned_at is null
        and (archived_at is null or timezone('Asia/Shanghai', archived_at) >= ${meta.current_month_start_local}::timestamp)
        and timezone('Asia/Shanghai', created_at) < ${meta.current_month_start_local}::timestamp
        and not exists (
          select 1
          from development_queue_items
          where development_queue_items.source_type = 'opinionTopic'
            and development_queue_items.source_id = opinion_topics.id
        )
      order by
        coalesce((support_ticket_total::numeric / nullif((support_ticket_total + oppose_ticket_total), 0)), 0) desc,
        support_ticket_total desc,
        unique_supporter_count desc,
        updated_at desc
      limit ${settlementLimit}
    `);

    const queueItemIds: string[] = [];
    let queuedCount = 0;

    for (const [index, topic] of leaderRows.rows.entries()) {
      const supportTicketTotal = Number(topic.support_ticket_total ?? 0);
      const opposeTicketTotal = Number(topic.oppose_ticket_total ?? 0);
      const uniqueSupporterCount = Number(topic.unique_supporter_count ?? 0);
      const uniqueOpposerCount = Number(topic.unique_opposer_count ?? 0);
      const supportRate = calculateSupportRate(supportTicketTotal, opposeTicketTotal);
      const selectionStatus: OpinionMonthlySettlementItemStatus =
        index < DEFAULT_MONTHLY_SELECTION_LIMIT ? "selected" : "standby";
      const queueItemId =
        selectionStatus === "selected"
          ? (
              await queueSourceForDevelopmentInTx(
                tx,
                buildOpinionTopicQueueSnapshot({
                  topicId: topic.id,
                  ownerUserId: topic.creator_user_id,
                  title: topic.title,
                  description: topic.description,
                  difficultyLevel: topic.difficulty_level,
                  supportTicketTotal,
                  opposeTicketTotal,
                  supportRate,
                  priorityScore: calculateRankingScore({
                    status: "qualified",
                    adoptedAt: null,
                    supportTicketTotal,
                    targetSupportCount: Math.max(1, supportTicketTotal),
                    opposeTicketTotal,
                    uniqueSupporterCount,
                    uniqueOpposerCount,
                  }),
                  adoptedAt: timestamp,
                }),
              )
            ).id
          : null;

      if (queueItemId) {
        queuedCount += 1;
        queueItemIds.push(queueItemId);
      }

      await tx.insert(opinionTopicMonthlySettlementItems).values({
        id: crypto.randomUUID(),
        monthKey: meta.month_key,
        rank: index + 1,
        topicId: topic.id,
        supportRate: supportRate.toFixed(4),
        supportTicketTotal,
        uniqueSupporterCount,
        queueItemId,
        selectionStatus,
        selectedOrder: selectionStatus === "selected" ? index + 1 : null,
        operatorNote: null,
        operatorActionedAt: null,
        operatorActionedByUserId: null,
        createdAt: timestamp,
      });
    }

    await tx
      .update(opinionTopicMonthlySettlementRuns)
      .set({
        settledCount: leaderRows.rows.length,
        selectedCount: Math.min(DEFAULT_MONTHLY_SELECTION_LIMIT, leaderRows.rows.length),
        selectionLimit: DEFAULT_MONTHLY_SELECTION_LIMIT,
        settledAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(opinionTopicMonthlySettlementRuns.monthKey, meta.month_key));

    return {
      monthKey: meta.month_key,
      settledCount: leaderRows.rows.length,
      queuedCount,
      skipped: false,
      queueItemIds,
    };
  });
}

export async function createOpinionTopicComment(
  userId: string,
  input: CreateOpinionTopicCommentInput,
): Promise<OpinionGovernanceDetailView> {
  const content = input.content.trim();
  if (content.length < MIN_COMMENT_LENGTH || content.length > MAX_COMMENT_LENGTH) {
    throw new BadRequestError(`讨论回复长度需在 ${MIN_COMMENT_LENGTH}-${MAX_COMMENT_LENGTH} 个字符之间`);
  }

  return db.transaction(async (tx) => {
    const settings = await ensureOpinionHubSettingsInTx(tx);
    await tx.execute(sql`select id from opinion_topics where id = ${input.topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, input.topicId);
    if (!topic || !canViewerSeeTopic(userId, topic)) {
      throw new NotFoundError("议题不存在或当前不可见");
    }
    if (topic.reviewStatus !== "published") {
      throw new ConflictError("当前议题尚未公开，暂时不能讨论");
    }
    if (topic.discussionStatus !== "open") {
      throw new ConflictError("当前议题已停止讨论");
    }
    if (!canInteractWithTopic(topic)) {
      throw new ConflictError("当前议题状态不允许继续讨论");
    }

    const user = await tx.query.users.findFirst({
      where: (row, operators) => operators.eq(row.id, userId),
    });
    if (!user) {
      throw new UnauthorizedError("当前用户不存在，无法参与讨论");
    }

    const replyToCommentId =
      typeof input.replyToCommentId === "string" && input.replyToCommentId.trim().length > 0
        ? input.replyToCommentId.trim()
        : null;
    let parentCommentId: string | null = null;
    let normalizedReplyToCommentId: string | null = null;
    let replyToUserId: string | null = null;

    if (replyToCommentId) {
      const targetComment = await getOpinionTopicCommentByIdInTx(tx, replyToCommentId);
      if (!targetComment || targetComment.topicId !== topic.id) {
        throw new NotFoundError("待回复的讨论不存在或不属于当前议题");
      }

      parentCommentId = targetComment.parentCommentId ?? targetComment.id;
      normalizedReplyToCommentId = targetComment.id;
      replyToUserId = targetComment.authorUserId;
    }

    const createdAt = now();
    await transferBalance({
      fromUserId: userId,
      toUserId: OPINION_TICKET_POOL_USER_ID,
      currency: "opinionTickets",
      amount: settings.commentTicketCost,
      note: `议题讨论：${topic.title}`,
      referenceType: "opinionTopicComment",
      referenceId: input.topicId,
      tx,
    });

    await tx.insert(opinionTopicComments).values({
      id: crypto.randomUUID(),
      topicId: input.topicId,
      authorUserId: userId,
      parentCommentId,
      replyToCommentId: normalizedReplyToCommentId,
      replyToUserId,
      content,
      ticketCost: settings.commentTicketCost,
      createdAt,
      updatedAt: createdAt,
    });

    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set({
        commentCount: topic.commentCount + 1,
        lastCommentedAt: createdAt,
        updatedAt: createdAt,
      })
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    const comments = await listOpinionTopicCommentsInTx(tx, topic.id);
    return buildTopicDetail({
      topic: {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      comments,
      viewerUserId: userId,
    });
  });
}
export async function supportOpinionTopic(userId: string, topicId: string, ticketAmount: number): Promise<OpinionGovernanceView> {
  if (!Number.isInteger(ticketAmount) || ticketAmount !== 1) {
    throw new BadRequestError("当前每次赞同固定消耗 1 张投票券");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from opinion_topics where id = ${topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic || !canViewerSeeTopic(userId, topic)) {
      throw new NotFoundError("议题不存在或当前不可见");
    }
    if (topic.reviewStatus !== "published") {
      throw new ConflictError("当前议题尚未公开，暂时不能投票");
    }
    if (topic.status === "archived") {
      throw new ConflictError("议题已归档，无法继续支持");
    }
    if (topic.adoptedAt) {
      throw new ConflictError("议题已采纳，当前阶段不再接受支持票");
    }
    if (await hasOpinionTopicVoteForUserTodayInTx(tx, topicId, userId)) {
      throw new ConflictError("当前议题今天已经投过票，每天只能投票 1 次");
    }

    const priorSupportCount = await getOpinionTopicSupportCountForUserInTx(tx, topicId, userId);
    const isFirstSupport = priorSupportCount === 0;
    const nextSupportTicketTotal = topic.supportTicketTotal + ticketAmount;
    const nextOpposeTicketTotal = topic.opposeTicketTotal;
    const nextUniqueSupporterCount = topic.uniqueSupporterCount + (isFirstSupport ? 1 : 0);
    const supportRateThreshold = toRateNumber(topic.supportRateThreshold);
    const qualified = isQualifiedByGovernance({
      supportTicketTotal: nextSupportTicketTotal,
      opposeTicketTotal: nextOpposeTicketTotal,
      targetSupportCount: topic.targetSupportCount,
      supportRateThreshold,
    });
    const nextStatus: OpinionTopicStatus = qualified ? "qualified" : "collecting";

    await transferBalance({
      fromUserId: userId,
      toUserId: OPINION_TICKET_POOL_USER_ID,
      currency: "opinionTickets",
      amount: ticketAmount,
      note: `支持议题：${topic.title}`,
      referenceType: "opinionTopicSupport",
      referenceId: topic.id,
      tx,
    });

    await tx.insert(opinionTopicSupports).values({
      id: crypto.randomUUID(),
      topicId: topic.id,
      userId,
      ticketAmount,
      createdAt: now(),
    });

    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set({
        supportTicketTotal: nextSupportTicketTotal,
        opposeTicketTotal: nextOpposeTicketTotal,
        uniqueSupporterCount: nextUniqueSupporterCount,
        status: nextStatus,
        updatedAt: now(),
      })
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    await enqueueOutboxEvent(
      "opinionTopic.supported",
      {
        topicId: topic.id,
        supporterUserId: userId,
        ticketAmount,
      },
      tx,
    );

    if (topic.status !== "qualified" && nextStatus === "qualified") {
      await enqueueOutboxEvent(
        "opinionTopic.qualified",
        {
          topicId: topic.id,
          creatorUserId: topic.creatorUserId,
        },
        tx,
      );
    }

    return toOpinionTopicView(
      {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      userId,
    );
  });
}

export async function opposeOpinionTopic(userId: string, topicId: string, ticketAmount: number): Promise<OpinionGovernanceView> {
  if (!Number.isInteger(ticketAmount) || ticketAmount !== 1) {
    throw new BadRequestError("当前每次反对固定消耗 1 张投票券");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from opinion_topics where id = ${topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic || !canViewerSeeTopic(userId, topic)) {
      throw new NotFoundError("议题不存在或当前不可见");
    }
    if (topic.reviewStatus !== "published") {
      throw new ConflictError("当前议题尚未公开，暂时不能投票");
    }
    if (topic.status === "archived") {
      throw new ConflictError("议题已归档，无法继续反对");
    }
    if (topic.adoptedAt) {
      throw new ConflictError("议题已采纳，当前阶段不再接受反对票");
    }
    if (await hasOpinionTopicVoteForUserTodayInTx(tx, topicId, userId)) {
      throw new ConflictError("当前议题今天已经投过票，每天只能投票 1 次");
    }

    const priorOpposeCount = await getOpinionTopicOpposeCountForUserInTx(tx, topicId, userId);
    const isFirstOppose = priorOpposeCount === 0;
    const nextSupportTicketTotal = topic.supportTicketTotal;
    const nextOpposeTicketTotal = topic.opposeTicketTotal + ticketAmount;
    const nextUniqueOpposerCount = topic.uniqueOpposerCount + (isFirstOppose ? 1 : 0);
    const supportRateThreshold = toRateNumber(topic.supportRateThreshold);
    const qualified = isQualifiedByGovernance({
      supportTicketTotal: nextSupportTicketTotal,
      opposeTicketTotal: nextOpposeTicketTotal,
      targetSupportCount: topic.targetSupportCount,
      supportRateThreshold,
    });
    const nextStatus: OpinionTopicStatus = qualified ? "qualified" : "collecting";

    await transferBalance({
      fromUserId: userId,
      toUserId: OPINION_TICKET_POOL_USER_ID,
      currency: "opinionTickets",
      amount: ticketAmount,
      note: `反对议题：${topic.title}`,
      referenceType: "opinionTopicOppose",
      referenceId: topic.id,
      tx,
    });

    await tx.insert(opinionTopicOpposes).values({
      id: crypto.randomUUID(),
      topicId: topic.id,
      userId,
      ticketAmount,
      createdAt: now(),
    });

    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set({
        supportTicketTotal: nextSupportTicketTotal,
        opposeTicketTotal: nextOpposeTicketTotal,
        uniqueOpposerCount: nextUniqueOpposerCount,
        status: nextStatus,
        updatedAt: now(),
      })
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    await enqueueOutboxEvent(
      "opinionTopic.opposed",
      {
        topicId: topic.id,
        opposerUserId: userId,
        ticketAmount,
      },
      tx,
    );

    if (topic.status !== "qualified" && nextStatus === "qualified") {
      await enqueueOutboxEvent(
        "opinionTopic.qualified",
        {
          topicId: topic.id,
          creatorUserId: topic.creatorUserId,
        },
        tx,
      );
    }

    return toOpinionTopicView(
      {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      userId,
    );
  });
}
export async function archiveOpinionTopic(userId: string, topicId: string): Promise<OpinionGovernanceView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from opinion_topics where id = ${topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic) {
      throw new NotFoundError("议题不存在");
    }
    if (topic.creatorUserId !== userId) {
      throw new UnauthorizedError("只有议题创建者可以归档该议题");
    }
    if (topic.reviewStatus !== "published") {
      throw new ConflictError("当前议题尚未公开，暂不支持归档");
    }
    if (topic.status === "archived") {
      throw new ConflictError("议题已归档");
    }

    const archivedAt = now();
    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set({
        status: "archived",
        archivedAt,
        updatedAt: archivedAt,
      })
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    await enqueueOutboxEvent(
      "opinionTopic.archived",
      {
        topicId: topic.id,
        creatorUserId: topic.creatorUserId,
      },
      tx,
    );

    return toOpinionTopicView(
      {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      userId,
    );
  });
}

export async function adoptOpinionTopic(userId: string, topicId: string): Promise<OpinionGovernanceView> {
  const developmentQueueFeature = await getSingleFeatureModule("developmentQueue");

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from opinion_topics where id = ${topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic) {
      throw new NotFoundError("议题不存在");
    }
    if (topic.creatorUserId !== userId) {
      throw new UnauthorizedError("只有议题创建者可以采纳该议题");
    }
    if (topic.reviewStatus !== "published") {
      throw new ConflictError("当前议题尚未公开，暂不支持采纳");
    }
    if (topic.status !== "qualified") {
      throw new ConflictError("只有已达标议题才可采纳");
    }
    if (topic.archivedAt) {
      throw new ConflictError("议题已归档，无法采纳");
    }
    if (topic.adoptedAt) {
      throw new ConflictError("议题已采纳");
    }
    const qualified = isQualifiedByGovernance({
      supportTicketTotal: topic.supportTicketTotal,
      opposeTicketTotal: topic.opposeTicketTotal,
      targetSupportCount: topic.targetSupportCount,
      supportRateThreshold: toRateNumber(topic.supportRateThreshold),
    });
    if (!qualified) {
      throw new ConflictError("议题尚未同时满足目标支持票数和支持率门槛");
    }

    const adoptedAt = now();
    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set({
        adoptedAt,
        adoptedByUserId: userId,
        updatedAt: adoptedAt,
      })
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    if (developmentQueueFeature?.enabled) {
      await queueSourceForDevelopmentInTx(
        tx,
        buildOpinionTopicQueueSnapshot({
          topicId: updatedTopic.id,
          ownerUserId: updatedTopic.creatorUserId,
          title: updatedTopic.title,
          description: updatedTopic.description,
          difficultyLevel: updatedTopic.difficultyLevel,
          supportTicketTotal: updatedTopic.supportTicketTotal,
          opposeTicketTotal: updatedTopic.opposeTicketTotal,
          supportRate: calculateSupportRate(updatedTopic.supportTicketTotal, updatedTopic.opposeTicketTotal),
          priorityScore: calculateRankingScore({
            ...updatedTopic,
          }),
          adoptedAt,
        }),
      );
    }

    await enqueueOutboxEvent(
      "opinionTopic.adopted",
      {
        topicId: topic.id,
        creatorUserId: topic.creatorUserId,
        adoptedByUserId: userId,
      },
      tx,
    );

    return toOpinionTopicView(
      {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      userId,
    );
  });
}

export async function moderateOpinionTopic(
  actorUserId: string,
  topicId: string,
  input: ModerateOpinionTopicInput,
): Promise<OpinionGovernanceView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from opinion_topics where id = ${topicId} for update`);
    const topic = await getOpinionTopicByIdInTx(tx, topicId);
    if (!topic) {
      throw new NotFoundError("议题不存在");
    }

    const reviewedAt = now();
    const moderationNote = input.note?.trim() ? input.note.trim() : topic.moderationNote ?? null;
    let patch: Partial<typeof opinionTopics.$inferInsert> = {
      updatedAt: reviewedAt,
      reviewedAt,
      reviewedByUserId: actorUserId,
      moderationNote,
    };

    switch (input.action) {
      case "approve": {
        if (topic.reviewStatus === "deleted" || topic.reviewStatus === "banned") {
          throw new ConflictError("已删除或封禁的议题不能重新通过");
        }
        patch = {
          ...patch,
          reviewStatus: "published",
          discussionStatus: topic.discussionStatus === "closed" ? "closed" : "open",
          bannedAt: null,
          deletedAt: null,
        };
        break;
      }
      case "reject": {
        patch = {
          ...patch,
          reviewStatus: "rejected",
          discussionStatus: "closed",
        };
        break;
      }
      case "ban": {
        patch = {
          ...patch,
          reviewStatus: "banned",
          discussionStatus: "closed",
          bannedAt: reviewedAt,
        };
        break;
      }
      case "stopDiscussion": {
        patch = {
          ...patch,
          discussionStatus: "closed",
        };
        break;
      }
      case "resumeDiscussion": {
        patch = {
          ...patch,
          discussionStatus: "open",
        };
        break;
      }
      case "delete": {
        patch = {
          ...patch,
          reviewStatus: "deleted",
          discussionStatus: "closed",
          deletedAt: reviewedAt,
        };
        break;
      }
      default:
        throw new BadRequestError("不支持的议题管理动作");
    }

    const [updatedTopic] = await tx
      .update(opinionTopics)
      .set(patch)
      .where(eq(opinionTopics.id, topic.id))
      .returning();

    return toOpinionTopicView(
      {
        ...updatedTopic,
        creatorUsername: topic.creatorUsername,
      },
      actorUserId,
    );
  });
}
