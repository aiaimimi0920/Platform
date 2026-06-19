import { and, desc, eq, isNotNull, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { accountAnnouncements } from "@/modules/announcements/schema";

export async function listPublishedAccountAnnouncementRows() {
  return db
    .select()
    .from(accountAnnouncements)
    .where(and(eq(accountAnnouncements.status, "published"), isNotNull(accountAnnouncements.publishedAt)))
    .orderBy(desc(accountAnnouncements.publishedAt), desc(accountAnnouncements.updatedAt));
}

export async function listOperatorAccountAnnouncementRows() {
  return db
    .select()
    .from(accountAnnouncements)
    .orderBy(desc(accountAnnouncements.publishedAt), desc(accountAnnouncements.updatedAt), desc(accountAnnouncements.createdAt));
}

export async function getAccountAnnouncementRowById(id: string) {
  const [row] = await db
    .select()
    .from(accountAnnouncements)
    .where(eq(accountAnnouncements.id, id))
    .limit(1);
  return row ?? null;
}

export async function listAccountAnnouncementRowsByIds(ids: string[]) {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (normalizedIds.length === 0) {
    return [];
  }

  return db.select().from(accountAnnouncements).where(inArray(accountAnnouncements.id, normalizedIds));
}

export async function insertAccountAnnouncementRow(
  values: typeof accountAnnouncements.$inferInsert,
) {
  const [row] = await db.insert(accountAnnouncements).values(values).returning();
  return row;
}

export async function updateAccountAnnouncementRow(
  id: string,
  values: Partial<typeof accountAnnouncements.$inferInsert>,
) {
  const [row] = await db
    .update(accountAnnouncements)
    .set(values)
    .where(eq(accountAnnouncements.id, id))
    .returning();
  return row ?? null;
}

export async function archiveAccountAnnouncementRowsByIds(ids: string[], timestamp: Date) {
  const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));
  if (normalizedIds.length === 0) {
    return [];
  }

  return db
    .update(accountAnnouncements)
    .set({
      status: "archived",
      archivedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(inArray(accountAnnouncements.id, normalizedIds))
    .returning({ id: accountAnnouncements.id });
}

export async function deleteAccountAnnouncementRow(id: string) {
  const [row] = await db
    .delete(accountAnnouncements)
    .where(eq(accountAnnouncements.id, id))
    .returning({ id: accountAnnouncements.id });
  return row ?? null;
}
