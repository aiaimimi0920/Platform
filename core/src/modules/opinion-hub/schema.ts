import { boolean, integer, numeric, pgTable, text, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const opinionTopics = pgTable("opinion_topics", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  tags: text("tags").array().notNull(),
  difficultyLevel: integer("difficulty_level").notNull(),
  creationTicketCost: integer("creation_ticket_cost").notNull(),
  targetSupportCount: integer("target_support_count").notNull(),
  supportTicketTotal: integer("support_ticket_total").notNull(),
  opposeTicketTotal: integer("oppose_ticket_total").notNull(),
  uniqueSupporterCount: integer("unique_supporter_count").notNull(),
  uniqueOpposerCount: integer("unique_opposer_count").notNull(),
  supportRateThreshold: numeric("support_rate_threshold", { precision: 5, scale: 4 }).notNull(),
  status: text("status").notNull(),
  reviewStatus: text("review_status").notNull(),
  discussionStatus: text("discussion_status").notNull(),
  moderationReasonCategory: text("moderation_reason_category"),
  moderationReasonDetail: text("moderation_reason_detail"),
  moderationNote: text("moderation_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  commentCount: integer("comment_count").notNull(),
  lastCommentedAt: timestamp("last_commented_at", { withTimezone: true }),
  adoptedAt: timestamp("adopted_at", { withTimezone: true }),
  adoptedByUserId: text("adopted_by_user_id").references(() => users.id),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const opinionTopicSupports = pgTable("opinion_topic_supports", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => opinionTopics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  ticketAmount: integer("ticket_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const opinionTopicOpposes = pgTable("opinion_topic_opposes", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => opinionTopics.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  ticketAmount: integer("ticket_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const opinionTopicComments = pgTable("opinion_topic_comments", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull().references(() => opinionTopics.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").notNull().references(() => users.id),
  parentCommentId: text("parent_comment_id").references((): AnyPgColumn => opinionTopicComments.id, {
    onDelete: "cascade",
  }),
  replyToCommentId: text("reply_to_comment_id").references((): AnyPgColumn => opinionTopicComments.id, {
    onDelete: "set null",
  }),
  replyToUserId: text("reply_to_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  ticketCost: integer("ticket_cost").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const opinionHubSettings = pgTable("opinion_hub_settings", {
  id: text("id").primaryKey(),
  preModerationEnabled: boolean("pre_moderation_enabled").notNull(),
  commentTicketCost: integer("comment_ticket_cost").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
});

export const opinionTopicMonthlySettlementRuns = pgTable("opinion_topic_monthly_settlement_runs", {
  monthKey: text("month_key").primaryKey(),
  settledCount: integer("settled_count").notNull(),
  selectedCount: integer("selected_count").notNull(),
  selectionLimit: integer("selection_limit").notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const opinionTopicMonthlySettlementItems = pgTable("opinion_topic_monthly_settlement_items", {
  id: text("id").primaryKey(),
  monthKey: text("month_key")
    .notNull()
    .references(() => opinionTopicMonthlySettlementRuns.monthKey, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  topicId: text("topic_id").notNull().references(() => opinionTopics.id, { onDelete: "cascade" }),
  supportRate: numeric("support_rate", { precision: 5, scale: 4 }).notNull(),
  supportTicketTotal: integer("support_ticket_total").notNull(),
  uniqueSupporterCount: integer("unique_supporter_count").notNull(),
  queueItemId: text("queue_item_id"),
  selectionStatus: text("selection_status").notNull(),
  selectedOrder: integer("selected_order"),
  operatorNote: text("operator_note"),
  operatorActionedAt: timestamp("operator_actioned_at", { withTimezone: true }),
  operatorActionedByUserId: text("operator_actioned_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
