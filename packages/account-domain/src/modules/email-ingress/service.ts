import type { EmailProviderInboundMessageView } from "@neuro/contracts";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { ingestEmailNativeInboundMessage } from "@/modules/email-native/service";
import { ConflictError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import type { EmailIngressAttachmentMetadata, MailgunInboundFieldMap } from "./model";
import { normalizeMailgunInboundPayload } from "./model";
import { emailProviderInboundMessages } from "./schema";

type DbTx = typeof db | any;

function now() {
  return new Date();
}

function mapProviderInboundMessage(
  row: typeof emailProviderInboundMessages.$inferSelect,
): EmailProviderInboundMessageView {
  return {
    id: row.id,
    provider: row.provider,
    processingState: row.processingState as EmailProviderInboundMessageView["processingState"],
    providerEventId: row.providerEventId,
    providerMessageId: row.providerMessageId,
    fromEmail: row.fromEmail,
    toEmail: row.toEmail,
    subject: row.subject,
    attachmentCount: row.attachmentCount,
    canonicalInboundMessageId: row.canonicalInboundMessageId,
    canonicalInboundStatus: row.canonicalInboundStatus as EmailProviderInboundMessageView["canonicalInboundStatus"],
    canonicalRejectionReason: row.canonicalRejectionReason,
    lastError: row.lastError,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function createProviderInboundMessageInTx(args: {
  tx: DbTx;
  provider: "mailgun";
  providerEventId: string | null;
  providerMessageId: string | null;
  idempotencyKey: string;
  fromEmail: string;
  normalizedFromEmail: string;
  toEmail: string;
  normalizedToEmail: string;
  subject: string | null;
  textBody: string;
  htmlBody: string | null;
  attachmentCount: number;
  attachmentsJson: string | null;
  providerPayloadJson: string;
  receivedAt: string;
}) {
  const [existing] = await args.tx
    .select()
    .from(emailProviderInboundMessages)
    .where(eq(emailProviderInboundMessages.idempotencyKey, args.idempotencyKey))
    .limit(1);
  if (existing) {
    return {
      duplicate: true as const,
      message: existing,
    };
  }

  const currentTime = now();
  const [created] = await args.tx
    .insert(emailProviderInboundMessages)
    .values({
      id: crypto.randomUUID(),
      provider: args.provider,
      providerEventId: args.providerEventId,
      providerMessageId: args.providerMessageId,
      idempotencyKey: args.idempotencyKey,
      processingState: "received",
      fromEmail: args.fromEmail,
      normalizedFromEmail: args.normalizedFromEmail,
      toEmail: args.toEmail,
      normalizedToEmail: args.normalizedToEmail,
      subject: args.subject,
      textBody: args.textBody,
      htmlBody: args.htmlBody,
      attachmentCount: args.attachmentCount,
      attachmentsJson: args.attachmentsJson,
      providerPayloadJson: args.providerPayloadJson,
      canonicalInboundMessageId: null,
      canonicalInboundStatus: null,
      canonicalRejectionReason: null,
      lastError: null,
      receivedAt: new Date(args.receivedAt),
      processedAt: null,
      createdAt: currentTime,
      updatedAt: currentTime,
    })
    .returning();

  await enqueueOutboxEvent(
    "email.inbound.received",
    {
      providerInboundMessageId: created.id,
      provider: created.provider,
    },
    args.tx,
  );

  return {
    duplicate: false as const,
    message: created,
  };
}

export async function acceptMailgunInboundWebhook(args: {
  fields: MailgunInboundFieldMap;
  attachments: EmailIngressAttachmentMetadata[];
  receivedAt?: string | null;
}) {
  const normalized = normalizeMailgunInboundPayload({
    fields: args.fields,
    attachments: args.attachments,
    receivedAt: args.receivedAt,
  });

  const result = await db.transaction((tx) =>
    createProviderInboundMessageInTx({
      tx,
      provider: "mailgun",
      ...normalized,
    }),
  );

  return {
    duplicate: result.duplicate,
    message: mapProviderInboundMessage(result.message),
  };
}

export async function getEmailProviderInboundMessageById(id: string) {
  const [row] = await db
    .select()
    .from(emailProviderInboundMessages)
    .where(eq(emailProviderInboundMessages.id, id))
    .limit(1);
  return row ?? null;
}

export async function getEmailProviderInboundMessageViewById(id: string) {
  const row = await getEmailProviderInboundMessageById(id);
  return row ? mapProviderInboundMessage(row) : null;
}

export async function listRecentEmailProviderInboundMessages(limit = 20) {
  const normalizedLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  return db
    .select()
    .from(emailProviderInboundMessages)
    .orderBy(desc(emailProviderInboundMessages.createdAt))
    .limit(normalizedLimit);
}

export async function listRecentEmailProviderInboundMessageViews(limit = 20) {
  const rows = await listRecentEmailProviderInboundMessages(limit);
  return rows.map(mapProviderInboundMessage);
}

export async function processEmailProviderInboundMessage(providerInboundMessageId: string) {
  const message = await getEmailProviderInboundMessageById(providerInboundMessageId);
  if (!message) {
    return { processed: false as const, skippedReason: "missing_provider_inbound_message" };
  }

  if (message.processingState === "processed") {
    return { processed: false as const, skippedReason: "already_processed" };
  }

  try {
    const canonicalMessage = await ingestEmailNativeInboundMessage({
      fromEmail: message.fromEmail,
      toEmail: message.toEmail,
      subject: message.subject,
      textBody: message.textBody,
      htmlBody: message.htmlBody,
      providerMessageId: message.providerMessageId ?? message.providerEventId ?? message.id,
      receivedAt: message.receivedAt.toISOString(),
    });

    const currentTime = now();
    await db
      .update(emailProviderInboundMessages)
      .set({
        processingState: "processed",
        canonicalInboundMessageId: canonicalMessage.id,
        canonicalInboundStatus: canonicalMessage.status,
        canonicalRejectionReason: canonicalMessage.rejectionReason,
        lastError: null,
        processedAt: currentTime,
        updatedAt: currentTime,
      })
      .where(eq(emailProviderInboundMessages.id, message.id));

    return {
      processed: true as const,
      skippedReason: null,
      canonicalMessage,
    };
  } catch (error) {
    const currentTime = now();
    const messageText = error instanceof Error ? error.message : String(error);
    await db
      .update(emailProviderInboundMessages)
      .set({
        processingState: "failed",
        lastError: messageText,
        updatedAt: currentTime,
      })
      .where(eq(emailProviderInboundMessages.id, message.id));
    throw error;
  }
}

export async function retryEmailProviderInboundMessage(providerInboundMessageId: string) {
  return db.transaction(async (tx) => {
    const [message] = await tx
      .select()
      .from(emailProviderInboundMessages)
      .where(eq(emailProviderInboundMessages.id, providerInboundMessageId))
      .limit(1);

    if (!message) {
      return null;
    }

    if (message.processingState !== "failed") {
      throw new ConflictError("只有失败的真实邮件入站记录才允许重试");
    }

    const currentTime = now();
    const [updated] = await tx
      .update(emailProviderInboundMessages)
      .set({
        processingState: "received",
        lastError: null,
        processedAt: null,
        updatedAt: currentTime,
      })
      .where(eq(emailProviderInboundMessages.id, providerInboundMessageId))
      .returning();

    if (!updated) {
      return null;
    }

    await enqueueOutboxEvent(
      "email.inbound.received",
      {
        providerInboundMessageId: updated.id,
        provider: updated.provider,
      },
      tx,
    );

    return mapProviderInboundMessage(updated);
  });
}
