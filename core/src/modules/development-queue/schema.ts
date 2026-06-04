import { integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const developmentQueueItems = pgTable(
  "development_queue_items",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    difficultyLevel: integer("difficulty_level"),
    supportTicketTotal: integer("support_ticket_total").notNull(),
    opposeTicketTotal: integer("oppose_ticket_total").notNull(),
    supportRate: numeric("support_rate", { precision: 5, scale: 4 }).notNull(),
    priorityScore: integer("priority_score").notNull(),
    status: text("status").notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    sourceUnique: uniqueIndex("development_queue_items_source_idx").on(table.sourceType, table.sourceId),
  }),
);
