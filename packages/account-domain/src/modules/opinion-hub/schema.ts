import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const opinionTopics = pgTable("opinion_topics", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficultyLevel: integer("difficulty_level").notNull(),
  status: text("status").notNull(),
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
