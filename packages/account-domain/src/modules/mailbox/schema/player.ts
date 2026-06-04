import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { items, products } from "@/modules/product-order-item/schema";
import { users } from "@/modules/identity/schema";

export const mailboxMessages = pgTable("mailbox_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  folder: text("folder").notNull().default("inbox"),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body").notNull(),
  sourceLabel: text("source_label"),
  type: text("type").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  favoritedAt: timestamp("favorited_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const mailboxAttachments = pgTable("mailbox_attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => mailboxMessages.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title"),
  currency: text("currency"),
  amount: integer("amount"),
  productId: text("product_id").references(() => products.id),
  itemId: text("item_id").references(() => items.id),
  sortOrder: integer("sort_order").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});
