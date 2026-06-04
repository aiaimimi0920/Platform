import {
  and,
  asc,
  desc,
  eq,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type {
  OpinionTopicTag,
  OpinionTopicReviewStatus,
  OpinionTopicSortMode,
  OpinionTopicStatus,
} from "@neuro/contracts";

import * as schema from "@/db/schema";
import { users } from "@/modules/identity/schema";
import {
  opinionHubSettings,
  opinionTopicComments,
  opinionTopicMonthlySettlementItems,
  opinionTopicMonthlySettlementRuns,
  opinionTopicOpposes,
  opinionTopics,
  opinionTopicSupports,
} from "@/modules/opinion-hub/schema";

export type OpinionTopicRecordWithCreator = typeof opinionTopics.$inferSelect & {
  creatorUsername: string;
};

export type OpinionTopicCommentRecordWithAuthor = typeof opinionTopicComments.$inferSelect & {
  authorUsername: string;
  replyToUsername: string | null;
};

export type OpinionMonthlySettlementRunRecord = typeof opinionTopicMonthlySettlementRuns.$inferSelect;

export type OpinionMonthlySettlementItemRecord = typeof opinionTopicMonthlySettlementItems.$inferSelect & {
  title: string;
};

const PUBLISHED_REVIEW_STATUSES: OpinionTopicReviewStatus[] = ["published"];
const CREATOR_VISIBLE_REVIEW_STATUSES: OpinionTopicReviewStatus[] = ["published", "pending_review", "rejected"];

function buildSupportRateExpression() {
  return sql<number>`coalesce((${opinionTopics.supportTicketTotal}::numeric / nullif((${opinionTopics.supportTicketTotal} + ${opinionTopics.opposeTicketTotal}), 0)), 0)`;
}

function buildGovernanceOrder() {
  return [
    sql`
      case
        when ${opinionTopics.reviewStatus} = 'published' then 0
        else 1
      end
    `,
    sql`
      case
        when ${opinionTopics.status} = 'qualified' and ${opinionTopics.adoptedAt} is not null then 0
        when ${opinionTopics.status} = 'qualified' then 1
        when ${opinionTopics.status} = 'collecting' then 2
        else 3
      end
    `,
    desc(sql`coalesce((${opinionTopics.supportTicketTotal}::numeric / nullif(${opinionTopics.targetSupportCount}, 0)), 0)`),
    desc(buildSupportRateExpression()),
    desc(opinionTopics.uniqueSupporterCount),
    desc(opinionTopics.supportTicketTotal),
    desc(opinionTopics.updatedAt),
  ] satisfies SQL[];
}

function buildTopicOrder(sort: OpinionTopicSortMode) {
  if (sort === "supportRate") {
    return [
      sql`
        case
          when ${opinionTopics.reviewStatus} = 'published' then 0
          else 1
        end
      `,
      desc(buildSupportRateExpression()),
      desc(opinionTopics.supportTicketTotal),
      desc(opinionTopics.uniqueSupporterCount),
      desc(opinionTopics.createdAt),
    ] satisfies SQL[];
  }

  if (sort === "createdAt") {
    return [
      sql`
        case
          when ${opinionTopics.reviewStatus} = 'published' then 0
          else 1
        end
      `,
      desc(opinionTopics.createdAt),
      desc(opinionTopics.updatedAt),
    ] satisfies SQL[];
  }

  return buildGovernanceOrder();
}

function buildTopicStatusCondition(topicStatus?: OpinionTopicStatus | "all") {
  if (!topicStatus || topicStatus === "all") {
    return undefined;
  }

  return eq(opinionTopics.status, topicStatus);
}

function buildTopicTagCondition(topicTag?: OpinionTopicTag | "all") {
  if (!topicTag || topicTag === "all") {
    return undefined;
  }

  return sql`${opinionTopics.tags} @> ARRAY[${topicTag}]::text[]`;
}

function buildUserVisibleTopicCondition(viewerUserId: string) {
  return or(
    and(
      eq(opinionTopics.reviewStatus, PUBLISHED_REVIEW_STATUSES[0]),
      sql`${opinionTopics.deletedAt} is null`
    ),
    and(
      eq(opinionTopics.creatorUserId, viewerUserId),
      inArray(opinionTopics.reviewStatus, CREATOR_VISIBLE_REVIEW_STATUSES),
    ),
  )!;
}

function buildOperatorTopicCondition(args: {
  reviewStatus?: OpinionTopicReviewStatus | "all";
  topicTag?: OpinionTopicTag | "all";
  topicStatus?: OpinionTopicStatus | "all";
}) {
  const conditions: SQL[] = [];
  const topicStatusCondition = buildTopicStatusCondition(args.topicStatus);
  if (topicStatusCondition) {
    conditions.push(topicStatusCondition);
  }
  const topicTagCondition = buildTopicTagCondition(args.topicTag);
  if (topicTagCondition) {
    conditions.push(topicTagCondition);
  }
  if (args.reviewStatus && args.reviewStatus !== "all") {
    conditions.push(eq(opinionTopics.reviewStatus, args.reviewStatus));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return and(...conditions);
}

export async function listOpinionTopicsForViewerInTx(
  tx: NodePgDatabase<typeof schema>,
  args: {
    viewerUserId: string;
    page: number;
    pageSize: number;
    sort: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicStatus | "all";
  },
) {
  const conditions: SQL[] = [buildUserVisibleTopicCondition(args.viewerUserId)];
  const topicStatusCondition = buildTopicStatusCondition(args.topicStatus);
  if (topicStatusCondition) {
    conditions.push(topicStatusCondition);
  }
  const topicTagCondition = buildTopicTagCondition(args.topicTag);
  if (topicTagCondition) {
    conditions.push(topicTagCondition);
  }
  const whereClause = and(...conditions);
  const offset = Math.max(0, (args.page - 1) * args.pageSize);

  const baseRowsQuery = tx
    .select({
      topic: opinionTopics,
      creatorUsername: users.username,
    })
    .from(opinionTopics)
    .innerJoin(users, eq(opinionTopics.creatorUserId, users.id))
    .orderBy(...buildTopicOrder(args.sort))
    .limit(args.pageSize)
    .offset(offset);
  const rows = await (whereClause ? baseRowsQuery.where(whereClause) : baseRowsQuery);

  const baseCountQuery = tx
    .select({ count: sql<number>`count(*)` })
    .from(opinionTopics);
  const [countRow] = await (whereClause ? baseCountQuery.where(whereClause) : baseCountQuery);

  return {
    rows: rows.map((row) => ({
      ...row.topic,
      creatorUsername: row.creatorUsername,
    })),
    totalCount: Number(countRow?.count ?? 0),
  };
}

export async function listOpinionTopicsForOperatorInTx(
  tx: NodePgDatabase<typeof schema>,
  args: {
    page: number;
    pageSize: number;
    reviewStatus?: OpinionTopicReviewStatus | "all";
    sort: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicStatus | "all";
  },
) {
  const whereClause = buildOperatorTopicCondition({
    reviewStatus: args.reviewStatus,
    topicTag: args.topicTag,
    topicStatus: args.topicStatus,
  });
  const offset = Math.max(0, (args.page - 1) * args.pageSize);

  const baseRowsQuery = tx
    .select({
      topic: opinionTopics,
      creatorUsername: users.username,
    })
    .from(opinionTopics)
    .innerJoin(users, eq(opinionTopics.creatorUserId, users.id))
    .orderBy(...buildTopicOrder(args.sort))
    .limit(args.pageSize)
    .offset(offset);
  const rows = await (whereClause ? baseRowsQuery.where(whereClause) : baseRowsQuery);

  const baseCountQuery = tx
    .select({ count: sql<number>`count(*)` })
    .from(opinionTopics);
  const [countRow] = await (whereClause ? baseCountQuery.where(whereClause) : baseCountQuery);

  return {
    rows: rows.map((row) => ({
      ...row.topic,
      creatorUsername: row.creatorUsername,
    })),
    totalCount: Number(countRow?.count ?? 0),
  };
}

export async function listOpinionTopicMonthlyLeadersInTx(
  tx: NodePgDatabase<typeof schema>,
  limit: number,
) {
  return tx
    .select({
      topic: opinionTopics,
      creatorUsername: users.username,
    })
    .from(opinionTopics)
    .innerJoin(users, eq(opinionTopics.creatorUserId, users.id))
    .where(
      and(
        eq(opinionTopics.reviewStatus, "published"),
        inArray(opinionTopics.status, ["collecting", "qualified"]),
      ),
    )
    .orderBy(
      desc(buildSupportRateExpression()),
      desc(opinionTopics.supportTicketTotal),
      desc(opinionTopics.uniqueSupporterCount),
      desc(opinionTopics.updatedAt),
    )
    .limit(limit);
}

export async function getOpinionTopicByIdInTx(tx: NodePgDatabase<typeof schema>, topicId: string) {
  const [row] = await tx
    .select({
      topic: opinionTopics,
      creatorUsername: users.username,
    })
    .from(opinionTopics)
    .innerJoin(users, eq(opinionTopics.creatorUserId, users.id))
    .where(eq(opinionTopics.id, topicId));

  if (!row) {
    return null;
  }

  return {
    ...row.topic,
    creatorUsername: row.creatorUsername,
  } satisfies OpinionTopicRecordWithCreator;
}

export async function listOpinionTopicCommentsInTx(
  tx: NodePgDatabase<typeof schema>,
  topicId: string,
) {
  const rows = await tx
    .select({
      comment: opinionTopicComments,
      authorUsername: users.username,
    })
    .from(opinionTopicComments)
    .innerJoin(users, eq(opinionTopicComments.authorUserId, users.id))
    .where(eq(opinionTopicComments.topicId, topicId))
    .orderBy(asc(opinionTopicComments.createdAt));

  const replyToUserIds = Array.from(
    new Set(
      rows
        .map((row) => row.comment.replyToUserId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const replyToUsernames =
    replyToUserIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await tx
              .select({
                id: users.id,
                username: users.username,
              })
              .from(users)
              .where(inArray(users.id, replyToUserIds))
          ).map((row) => [row.id, row.username]),
        );

  return rows.map((row) => ({
    ...row.comment,
    authorUsername: row.authorUsername,
    replyToUsername: row.comment.replyToUserId ? (replyToUsernames.get(row.comment.replyToUserId) ?? null) : null,
  })) satisfies OpinionTopicCommentRecordWithAuthor[];
}

export async function getOpinionTopicCommentByIdInTx(
  tx: NodePgDatabase<typeof schema>,
  commentId: string,
) {
  const [comment] = await tx
    .select()
    .from(opinionTopicComments)
    .where(eq(opinionTopicComments.id, commentId))
    .limit(1);

  return comment ?? null;
}

export async function getOpinionTopicSupportCountForUserInTx(
  tx: NodePgDatabase<typeof schema>,
  topicId: string,
  userId: string,
) {
  const [row] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(opinionTopicSupports)
    .where(and(eq(opinionTopicSupports.topicId, topicId), eq(opinionTopicSupports.userId, userId)));
  return Number(row?.count ?? 0);
}

export async function getOpinionTopicOpposeCountForUserInTx(
  tx: NodePgDatabase<typeof schema>,
  topicId: string,
  userId: string,
) {
  const [row] = await tx
    .select({ count: sql<number>`count(*)` })
    .from(opinionTopicOpposes)
    .where(and(eq(opinionTopicOpposes.topicId, topicId), eq(opinionTopicOpposes.userId, userId)));
  return Number(row?.count ?? 0);
}

export async function listOpinionTopicSupportSummariesForUserInTx(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
) {
  return tx
    .select({
      topicId: opinionTopicSupports.topicId,
      ticketAmount: sql<number>`coalesce(sum(${opinionTopicSupports.ticketAmount}), 0)`,
      supportCount: sql<number>`count(*)`,
      lastSupportedAt: sql<Date>`max(${opinionTopicSupports.createdAt})`,
    })
    .from(opinionTopicSupports)
    .where(eq(opinionTopicSupports.userId, userId))
    .groupBy(opinionTopicSupports.topicId)
    .orderBy(desc(sql`max(${opinionTopicSupports.createdAt})`));
}

export async function listOpinionTopicOpposeSummariesForUserInTx(
  tx: NodePgDatabase<typeof schema>,
  userId: string,
) {
  return tx
    .select({
      topicId: opinionTopicOpposes.topicId,
      ticketAmount: sql<number>`coalesce(sum(${opinionTopicOpposes.ticketAmount}), 0)`,
      opposeCount: sql<number>`count(*)`,
      lastOpposedAt: sql<Date>`max(${opinionTopicOpposes.createdAt})`,
    })
    .from(opinionTopicOpposes)
    .where(eq(opinionTopicOpposes.userId, userId))
    .groupBy(opinionTopicOpposes.topicId)
    .orderBy(desc(sql`max(${opinionTopicOpposes.createdAt})`));
}

export async function getOpinionHubSettingsInTx(tx: NodePgDatabase<typeof schema>) {
  const [settings] = await tx.select().from(opinionHubSettings).where(eq(opinionHubSettings.id, "default"));
  return settings ?? null;
}

export async function listOpinionMonthlySettlementRunsInTx(
  tx: NodePgDatabase<typeof schema>,
  limit: number,
) {
  return tx
    .select()
    .from(opinionTopicMonthlySettlementRuns)
    .orderBy(desc(opinionTopicMonthlySettlementRuns.monthKey))
    .limit(limit);
}

export async function getOpinionMonthlySettlementRunInTx(
  tx: NodePgDatabase<typeof schema>,
  monthKey: string,
) {
  const [run] = await tx
    .select()
    .from(opinionTopicMonthlySettlementRuns)
    .where(eq(opinionTopicMonthlySettlementRuns.monthKey, monthKey))
    .limit(1);
  return run ?? null;
}

export async function listOpinionMonthlySettlementItemsInTx(
  tx: NodePgDatabase<typeof schema>,
  monthKey: string,
) {
  const rows = await tx
    .select({
      item: opinionTopicMonthlySettlementItems,
      title: opinionTopics.title,
    })
    .from(opinionTopicMonthlySettlementItems)
    .innerJoin(opinionTopics, eq(opinionTopicMonthlySettlementItems.topicId, opinionTopics.id))
    .where(eq(opinionTopicMonthlySettlementItems.monthKey, monthKey))
    .orderBy(asc(opinionTopicMonthlySettlementItems.rank));

  return rows.map((row) => ({
    ...row.item,
    title: row.title,
  })) satisfies OpinionMonthlySettlementItemRecord[];
}

export async function getOpinionMonthlySettlementItemByIdInTx(
  tx: NodePgDatabase<typeof schema>,
  monthKey: string,
  itemId: string,
) {
  const [row] = await tx
    .select({
      item: opinionTopicMonthlySettlementItems,
      title: opinionTopics.title,
    })
    .from(opinionTopicMonthlySettlementItems)
    .innerJoin(opinionTopics, eq(opinionTopicMonthlySettlementItems.topicId, opinionTopics.id))
    .where(
      and(
        eq(opinionTopicMonthlySettlementItems.monthKey, monthKey),
        eq(opinionTopicMonthlySettlementItems.id, itemId),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row.item,
    title: row.title,
  } satisfies OpinionMonthlySettlementItemRecord;
}
