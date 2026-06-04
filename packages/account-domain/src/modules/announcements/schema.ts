import type { AccountAnnouncementSection } from "@neuro/contracts";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const accountAnnouncements = pgTable("account_announcements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  railTitle: text("rail_title").notNull(),
  summary: text("summary").notNull(),
  eyebrow: text("eyebrow").notNull(),
  tone: text("tone").notNull(),
  status: text("status").notNull(),
  sections: jsonb("sections").$type<AccountAnnouncementSection[]>().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
