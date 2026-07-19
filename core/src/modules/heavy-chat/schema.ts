import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { agents } from "@/modules/agent-registry/schema";
import { users } from "@/modules/identity/schema";

export const heavyChatSlots = pgTable(
  "heavy_chat_slots",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    slotKey: text("slot_key").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    personaLabel: text("persona_label"),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerSlotKeyUnique: uniqueIndex("heavy_chat_slots_owner_slot_key_idx").on(table.ownerUserId, table.slotKey),
    ownerIdUnique: uniqueIndex("heavy_chat_slots_owner_id_idx").on(table.ownerUserId, table.id),
    kindCheck: check("heavy_chat_slots_kind_check", sql`${table.kind} in ('default', 'custom', 'purchased')`),
  }),
);

export const heavyChatSlotAgents = pgTable(
  "heavy_chat_slot_agents",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    slotId: text("slot_id").notNull(),
    agentId: text("agent_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerIdUnique: uniqueIndex("heavy_chat_slot_agents_owner_id_idx").on(table.ownerUserId, table.id),
    ownerSlotUnique: uniqueIndex("heavy_chat_slot_agents_owner_slot_idx").on(table.ownerUserId, table.slotId),
    ownerAgentUnique: uniqueIndex("heavy_chat_slot_agents_owner_agent_idx").on(table.ownerUserId, table.agentId),
    slotOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.slotId],
      foreignColumns: [heavyChatSlots.ownerUserId, heavyChatSlots.id],
      name: "heavy_chat_slot_agents_owner_slot_fk",
    }).onDelete("cascade"),
    agentOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.agentId],
      foreignColumns: [agents.ownerUserId, agents.id],
      name: "heavy_chat_slot_agents_owner_agent_fk",
    }).onDelete("cascade"),
  }),
);

export const heavyChatProjects = pgTable(
  "heavy_chat_projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    instructions: text("instructions"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerIdUnique: uniqueIndex("heavy_chat_projects_owner_id_idx").on(table.ownerUserId, table.id),
  }),
);

export const heavyChatSlotProjects = pgTable(
  "heavy_chat_slot_projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    slotId: text("slot_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerSlotProjectUnique: uniqueIndex("heavy_chat_slot_projects_owner_slot_project_idx").on(
      table.ownerUserId,
      table.slotId,
      table.projectId,
    ),
    slotOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.slotId],
      foreignColumns: [heavyChatSlots.ownerUserId, heavyChatSlots.id],
      name: "heavy_chat_slot_projects_owner_slot_fk",
    }).onDelete("cascade"),
    projectOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.projectId],
      foreignColumns: [heavyChatProjects.ownerUserId, heavyChatProjects.id],
      name: "heavy_chat_slot_projects_owner_project_fk",
    }).onDelete("cascade"),
  }),
);

export const heavyChatThreads = pgTable(
  "heavy_chat_threads",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    slotId: text("slot_id").notNull(),
    projectId: text("project_id"),
    title: text("title").notNull(),
    favorite: boolean("favorite").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerIdUnique: uniqueIndex("heavy_chat_threads_owner_id_idx").on(table.ownerUserId, table.id),
    slotOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.slotId],
      foreignColumns: [heavyChatSlots.ownerUserId, heavyChatSlots.id],
      name: "heavy_chat_threads_owner_slot_fk",
    }).onDelete("cascade"),
    projectOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.projectId],
      foreignColumns: [heavyChatProjects.ownerUserId, heavyChatProjects.id],
      name: "heavy_chat_threads_owner_project_fk",
    }).onDelete("restrict"),
    slotProjectBindingForeignKey: foreignKey({
      columns: [table.ownerUserId, table.slotId, table.projectId],
      foreignColumns: [
        heavyChatSlotProjects.ownerUserId,
        heavyChatSlotProjects.slotId,
        heavyChatSlotProjects.projectId,
      ],
      name: "heavy_chat_threads_owner_slot_project_binding_fk",
    }).onDelete("restrict"),
    favoriteCheck: check("heavy_chat_threads_favorite_check", sql`${table.favorite} in (true, false)`),
  }),
);

export const heavyChatMessages = pgTable(
  "heavy_chat_messages",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    threadId: text("thread_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    sequence: integer("sequence").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(0),
    content: text("content").notNull().default(""),
    references: jsonb("reference_data").$type<unknown[]>().notNull().default([]),
    actions: jsonb("actions").$type<unknown[]>().notNull().default([]),
    idempotencyKey: text("idempotency_key"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerIdUnique: uniqueIndex("heavy_chat_messages_owner_id_idx").on(table.ownerUserId, table.id),
    ownerIdempotencyUnique: uniqueIndex("heavy_chat_messages_owner_idempotency_idx").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
    ownerThreadSequenceUnique: uniqueIndex("heavy_chat_messages_owner_thread_sequence_idx").on(
      table.ownerUserId,
      table.threadId,
      table.sequence,
    ),
    threadOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.threadId],
      foreignColumns: [heavyChatThreads.ownerUserId, heavyChatThreads.id],
      name: "heavy_chat_messages_owner_thread_fk",
    }).onDelete("cascade"),
    roleCheck: check("heavy_chat_messages_role_check", sql`${table.role} in ('user', 'assistant', 'system')`),
    statusCheck: check(
      "heavy_chat_messages_status_check",
      sql`${table.status} in ('pending', 'streaming', 'complete', 'failed')`,
    ),
    sequenceCheck: check("heavy_chat_messages_sequence_check", sql`${table.sequence} > 0`),
    attemptNumberCheck: check("heavy_chat_messages_attempt_number_check", sql`${table.attemptNumber} >= 0`),
  }),
);

export const heavyChatMessageAttempts = pgTable(
  "heavy_chat_message_attempts",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerIdUnique: uniqueIndex("heavy_chat_message_attempts_owner_id_idx").on(table.ownerUserId, table.id),
    ownerIdempotencyUnique: uniqueIndex("heavy_chat_message_attempts_owner_idempotency_idx").on(
      table.ownerUserId,
      table.idempotencyKey,
    ),
    ownerMessageAttemptUnique: uniqueIndex("heavy_chat_message_attempts_owner_message_attempt_idx").on(
      table.ownerUserId,
      table.messageId,
      table.attemptNumber,
    ),
    messageOwnerForeignKey: foreignKey({
      columns: [table.ownerUserId, table.messageId],
      foreignColumns: [heavyChatMessages.ownerUserId, heavyChatMessages.id],
      name: "heavy_chat_message_attempts_owner_message_fk",
    }).onDelete("cascade"),
    attemptNumberCheck: check("heavy_chat_message_attempts_attempt_number_check", sql`${table.attemptNumber} > 0`),
  }),
);
