import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: text("id").primaryKey(),
});

export const outboxEvents = pgTable("outbox_events", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  consumerService: text("consumer_service").notNull().default("platform"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull(),
  maxAttempts: integer("max_attempts").notNull().default(5),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  lastError: text("last_error"),
});

export const outboxRetryAttempts = pgTable("outbox_retry_attempts", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => outboxEvents.id, { onDelete: "cascade" }),
  eventName: text("event_name").notNull(),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status").notNull(),
  previousAttempts: integer("previous_attempts").notNull(),
  lastError: text("last_error"),
  retriedAt: timestamp("retried_at", { withTimezone: true }).notNull(),
});
