import { integer, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailProviderInboundMessages = pgTable(
  "email_provider_inbound_messages",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id"),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    processingState: text("processing_state").notNull(),
    fromEmail: text("from_email").notNull(),
    normalizedFromEmail: text("normalized_from_email").notNull(),
    toEmail: text("to_email").notNull(),
    normalizedToEmail: text("normalized_to_email").notNull(),
    subject: text("subject"),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body"),
    attachmentCount: integer("attachment_count").notNull().default(0),
    attachmentsJson: text("attachments_json"),
    providerPayloadJson: text("provider_payload_json"),
    canonicalInboundMessageId: text("canonical_inbound_message_id"),
    canonicalInboundStatus: text("canonical_inbound_status"),
    canonicalRejectionReason: text("canonical_rejection_reason"),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("email_provider_inbound_messages_idempotency_idx").on(table.idempotencyKey),
    providerEventIdx: index("email_provider_inbound_messages_provider_event_idx").on(
      table.provider,
      table.providerEventId,
      table.createdAt,
    ),
    processingIdx: index("email_provider_inbound_messages_processing_idx").on(
      table.processingState,
      table.createdAt,
    ),
    canonicalIdx: index("email_provider_inbound_messages_canonical_idx").on(
      table.canonicalInboundMessageId,
      table.createdAt,
    ),
  }),
);
