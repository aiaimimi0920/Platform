import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { marketplaceListings, mailboxAttachments, mailboxMessages, redemptionCodes } from "@/modules/redemption-mailbox-marketplace/schema";

export async function getRedemptionCodeByCode(code: string) {
  const [row] = await db.select().from(redemptionCodes).where(eq(redemptionCodes.code, code));
  return row ?? null;
}

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
    .where(inArray(mailboxAttachments.messageId, messageIds));
}

export async function getMarketplaceListingById(listingId: string) {
  const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, listingId));
  return listing ?? null;
}

export async function listActiveMarketplaceListings() {
  return db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.status, "active"))
    .orderBy(desc(marketplaceListings.createdAt));
}

export async function countMailboxMessages(userId: string) {
  const [row] = await db
    .select({ total: count(mailboxMessages.id) })
    .from(mailboxMessages)
    .where(eq(mailboxMessages.userId, userId));
  return Number(row?.total ?? 0);
}

export async function countUnreadMailboxMessages(userId: string) {
  const [row] = await db
    .select({ total: count(mailboxMessages.id) })
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.userId, userId), isNull(mailboxMessages.readAt)));
  return Number(row?.total ?? 0);
}

export async function countPendingMailboxAttachments(userId: string) {
  const [row] = await db
    .select({ total: count(mailboxAttachments.id) })
    .from(mailboxAttachments)
    .innerJoin(mailboxMessages, eq(mailboxAttachments.messageId, mailboxMessages.id))
    .where(and(eq(mailboxMessages.userId, userId), isNull(mailboxAttachments.claimedAt)));
  return Number(row?.total ?? 0);
}
