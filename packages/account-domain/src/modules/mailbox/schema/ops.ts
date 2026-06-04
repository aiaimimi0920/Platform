import type { MailboxOpsAttachmentInput } from "@neuro/contracts";
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { mailboxMessages } from "./player";
import { users } from "@/modules/identity/schema";

export const mailboxOpsCampaigns = pgTable("mailbox_ops_campaigns", {
  id: text("id").primaryKey(),
  operatorLabel: text("operator_label").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body").notNull(),
  type: text("type").notNull(),
  sourceLabel: text("source_label"),
  recipientMode: text("recipient_mode").notNull(),
  recipientInput: text("recipient_input"),
  attachments: jsonb("attachments").$type<MailboxOpsAttachmentInput[]>().notNull(),
  previewRecipientCount: integer("preview_recipient_count").notNull(),
  previewUnresolvedCount: integer("preview_unresolved_count").notNull(),
  previewUnresolvedTargets: jsonb("preview_unresolved_targets").$type<string[]>().notNull(),
  targetCount: integer("target_count").notNull(),
  sentCount: integer("sent_count").notNull(),
  failedCount: integer("failed_count").notNull(),
  status: text("status").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  lastDispatchedAt: timestamp("last_dispatched_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  updatedByUserId: text("updated_by_user_id").notNull().references(() => users.id),
  dispatchedByUserId: text("dispatched_by_user_id").references(() => users.id),
  canceledByUserId: text("canceled_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const mailboxOpsCampaignDeliveries = pgTable(
  "mailbox_ops_campaign_deliveries",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => mailboxOpsCampaigns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    usernameSnapshot: text("username_snapshot"),
    providerUserIdSnapshot: text("provider_user_id_snapshot"),
    messageId: text("message_id").references(() => mailboxMessages.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => ({
    campaignUserUnique: uniqueIndex("mailbox_ops_campaign_deliveries_campaign_user_idx").on(
      table.campaignId,
      table.userId,
    ),
  }),
);

export const mailboxOpsTemplates = pgTable(
  "mailbox_ops_templates",
  {
    id: text("id").primaryKey(),
    operatorUserId: text("operator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    operatorLabel: text("operator_label").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    type: text("type").notNull(),
    sourceLabel: text("source_label"),
    attachments: jsonb("attachments").$type<MailboxOpsAttachmentInput[]>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    operatorNameUnique: uniqueIndex("mailbox_ops_templates_operator_name_idx").on(table.operatorUserId, table.name),
  }),
);

export const mailboxOpsRecipientBatches = pgTable(
  "mailbox_ops_recipient_batches",
  {
    id: text("id").primaryKey(),
    operatorUserId: text("operator_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    recipientMode: text("recipient_mode").notNull(),
    recipientInput: text("recipient_input"),
    previewRecipientCount: integer("preview_recipient_count").notNull(),
    previewUnresolvedCount: integer("preview_unresolved_count").notNull(),
    previewUnresolvedTargets: jsonb("preview_unresolved_targets").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    operatorNameUnique: uniqueIndex("mailbox_ops_recipient_batches_operator_name_idx").on(
      table.operatorUserId,
      table.name,
    ),
  }),
);
