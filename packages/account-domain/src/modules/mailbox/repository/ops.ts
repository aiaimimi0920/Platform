import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db/client";
import {
  mailboxOpsCampaignDeliveries,
  mailboxOpsCampaigns,
  mailboxOpsRecipientBatches,
  mailboxOpsTemplates,
} from "@/modules/mailbox/schema";

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
