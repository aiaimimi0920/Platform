import { boolean, integer, pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

import { authIdentities, users } from "@/modules/identity/schema";

export const emailIdentityVerifications = pgTable(
  "email_identity_verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    verificationCodeHash: text("verification_code_hash").notNull(),
    markAsPrimary: boolean("mark_as_primary").notNull().default(false),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userEmailIdx: index("email_identity_verifications_user_email_idx").on(
      table.userId,
      table.normalizedEmail,
      table.requestedAt,
    ),
    statusExpiresIdx: index("email_identity_verifications_status_expires_idx").on(
      table.status,
      table.expiresAt,
      table.requestedAt,
    ),
  }),
);

export const emailDeliveryJobs = pgTable(
  "email_delivery_jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    emailIdentityId: text("email_identity_id").references(() => authIdentities.id, { onDelete: "set null" }),
    purpose: text("purpose").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body"),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    referenceUnique: uniqueIndex("email_delivery_jobs_reference_idx").on(table.referenceType, table.referenceId),
    statusCreatedIdx: index("email_delivery_jobs_status_created_idx").on(table.status, table.createdAt),
  }),
);

export const emailNativeInboundMessages = pgTable(
  "email_native_inbound_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    emailIdentityId: text("email_identity_id").references(() => authIdentities.id, { onDelete: "set null" }),
    fromEmail: text("from_email").notNull(),
    normalizedFromEmail: text("normalized_from_email").notNull(),
    toEmail: text("to_email").notNull(),
    normalizedToEmail: text("normalized_to_email").notNull(),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    subject: text("subject"),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body"),
    routeKind: text("route_kind"),
    status: text("status").notNull(),
    rejectionReason: text("rejection_reason"),
    createdTaskId: text("created_task_id"),
    createdExecutionId: text("created_execution_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("email_native_inbound_messages_idempotency_idx").on(table.idempotencyKey),
    userCreatedIdx: index("email_native_inbound_messages_user_created_idx").on(table.userId, table.createdAt),
    executionIdx: index("email_native_inbound_messages_execution_idx").on(table.createdExecutionId, table.createdAt),
    taskIdx: index("email_native_inbound_messages_task_idx").on(table.createdTaskId, table.createdAt),
  }),
);
