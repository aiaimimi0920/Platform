import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { mailboxAttachments, mailboxMessages } from "@/modules/mailbox/schema";

export async function getMailboxMessagesByUser(userId: string) {
  return db
    .select()
    .from(mailboxMessages)
    .where(eq(mailboxMessages.userId, userId))
    .orderBy(desc(mailboxMessages.createdAt));
}

export async function getMailboxMessageByUserAndId(userId: string, messageId: string) {
  const [message] = await db
    .select()
    .from(mailboxMessages)
    .where(and(eq(mailboxMessages.userId, userId), eq(mailboxMessages.id, messageId)))
    .limit(1);
  return message ?? null;
}

export async function getMailboxMessageByUserAndIdempotencyKey(userId: string, idempotencyKey: string) {
  const [message] = await db
    .select()
    .from(mailboxMessages)
    .where(
      and(
        eq(mailboxMessages.userId, userId),
        eq(mailboxMessages.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return message ?? null;
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
