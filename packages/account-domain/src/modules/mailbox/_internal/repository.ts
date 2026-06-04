import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import {
  mailboxAttachments,
  mailboxMessages,
  mailboxOpsCampaigns,
  mailboxOpsCampaignDeliveries,
  mailboxOpsRecipientBatches,
  mailboxOpsTemplates,
} from "@/modules/mailbox/schema";

export async function getMailboxMessagesByUser(userId: string) {
  return db
    .select()
    .from(mailboxMessages)
    .where(eq(mailboxMessages.userId, userId))
    .orderBy(desc(mailboxMessages.createdAt));
}

export async function getMailboxAttachmentsByMessageIds(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  return db
    .select()
    .from(mailboxAttachments)
    .where(inArray(mailboxAttachments.messageId, messageIds))
    .orderBy(asc(mailboxAttachments.sortOrder), asc(mailboxAttachments.id));
}

export async function countMailboxMessages(userId: string, folder = "inbox") {
  const [row] = await db
    .select({ total: count(mailboxMessages.id) })
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.userId, userId), eq(mailboxMessages.folder, folder)));
  return Number(row?.total ?? 0);
}

export async function countUnreadMailboxMessages(userId: string, folder = "inbox") {
  const [row] = await db
    .select({ total: count(mailboxMessages.id) })
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.userId, userId), eq(mailboxMessages.folder, folder), isNull(mailboxMessages.readAt)));
  return Number(row?.total ?? 0);
}

export async function countPendingMailboxAttachments(userId: string, folder = "inbox") {
  const [row] = await db
    .select({ total: count(mailboxAttachments.id) })
    .from(mailboxAttachments)
    .innerJoin(mailboxMessages, eq(mailboxAttachments.messageId, mailboxMessages.id))
      .where(
        and(
          eq(mailboxMessages.userId, userId),
          eq(mailboxMessages.folder, folder),
          isNull(mailboxAttachments.claimedAt),
        ),
      );
  return Number(row?.total ?? 0);
}

export async function listMailboxOpsCampaignsByOperator(
  operatorUserId: string,
  input?: { status?: string | null; limit?: number | null },
) {
  void operatorUserId;
  const filters = [];
  if (input?.status && input.status !== "all") {
    filters.push(eq(mailboxOpsCampaigns.status, input.status));
  }

  const query = db
    .select()
    .from(mailboxOpsCampaigns)
    .orderBy(desc(mailboxOpsCampaigns.updatedAt), desc(mailboxOpsCampaigns.createdAt));

  const filteredQuery = filters.length > 0 ? query.where(and(...filters)) : query;

  const limit = typeof input?.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, input.limit) : null;
  return limit ? filteredQuery.limit(limit) : filteredQuery;
}

export async function getMailboxOpsCampaignById(id: string) {
  const [row] = await db
    .select()
    .from(mailboxOpsCampaigns)
    .where(eq(mailboxOpsCampaigns.id, id))
    .limit(1);
  return row ?? null;
}

export async function listDueMailboxOpsCampaigns(dueAt: Date, limit = 10) {
  return db
    .select()
    .from(mailboxOpsCampaigns)
    .where(
      and(
        eq(mailboxOpsCampaigns.status, "scheduled"),
        isNotNull(mailboxOpsCampaigns.scheduledAt),
        lte(mailboxOpsCampaigns.scheduledAt, dueAt),
      ),
    )
    .orderBy(asc(mailboxOpsCampaigns.scheduledAt), asc(mailboxOpsCampaigns.createdAt))
    .limit(limit);
}

export async function listMailboxOpsCampaignDeliveriesByCampaignId(campaignId: string, limit?: number | null) {
  const query = db
    .select()
    .from(mailboxOpsCampaignDeliveries)
    .where(eq(mailboxOpsCampaignDeliveries.campaignId, campaignId))
    .orderBy(desc(mailboxOpsCampaignDeliveries.createdAt));

  if (typeof limit === "number" && Number.isFinite(limit)) {
    return query.limit(Math.max(1, limit));
  }

  return query;
}

export async function listMailboxOpsTemplatesByOperator(userId: string, limit = 24) {
  return db
    .select()
    .from(mailboxOpsTemplates)
    .where(eq(mailboxOpsTemplates.operatorUserId, userId))
    .orderBy(desc(mailboxOpsTemplates.updatedAt), desc(mailboxOpsTemplates.createdAt))
    .limit(limit);
}

export async function getMailboxOpsTemplateById(id: string) {
  const [row] = await db
    .select()
    .from(mailboxOpsTemplates)
    .where(eq(mailboxOpsTemplates.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMailboxOpsTemplateByOperatorAndName(userId: string, name: string) {
  const [row] = await db
    .select()
    .from(mailboxOpsTemplates)
    .where(and(eq(mailboxOpsTemplates.operatorUserId, userId), eq(mailboxOpsTemplates.name, name)))
    .limit(1);
  return row ?? null;
}

export async function listMailboxOpsRecipientBatchesByOperator(userId: string, limit = 24) {
  return db
    .select()
    .from(mailboxOpsRecipientBatches)
    .where(eq(mailboxOpsRecipientBatches.operatorUserId, userId))
    .orderBy(desc(mailboxOpsRecipientBatches.updatedAt), desc(mailboxOpsRecipientBatches.createdAt))
    .limit(limit);
}

export async function getMailboxOpsRecipientBatchById(id: string) {
  const [row] = await db
    .select()
    .from(mailboxOpsRecipientBatches)
    .where(eq(mailboxOpsRecipientBatches.id, id))
    .limit(1);
  return row ?? null;
}

export async function getMailboxOpsRecipientBatchByOperatorAndName(userId: string, name: string) {
  const [row] = await db
    .select()
    .from(mailboxOpsRecipientBatches)
    .where(and(eq(mailboxOpsRecipientBatches.operatorUserId, userId), eq(mailboxOpsRecipientBatches.name, name)))
    .limit(1);
  return row ?? null;
}
