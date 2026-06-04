import { integer, jsonb, pgTable, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

import { items, products } from "@/modules/product-order-item/schema";
import { users } from "@/modules/identity/schema";

export const redemptionCodes = pgTable(
  "redemption_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    active: boolean("active").notNull(),
    rewardKind: text("reward_kind").notNull(),
    currency: text("currency"),
    amount: integer("amount"),
    productId: text("product_id").references(() => products.id),
    maxUses: integer("max_uses").notNull(),
    usedCount: integer("used_count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    // V2 fields
    exclusionGroup: text("exclusion_group"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    eligibility: jsonb("eligibility"),
    rewards: jsonb("rewards"),
    mailTitle: text("mail_title"),
    mailBody: text("mail_body"),
    batchLabel: text("batch_label"),
    description: text("description"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => ({
    codeUnique: uniqueIndex("redemption_codes_code_idx").on(table.code),
  }),
);

export const redemptionCodeUsages = pgTable("redemption_code_usages", {
  id: text("id").primaryKey(),
  redemptionCodeId: text("redemption_code_id").notNull().references(() => redemptionCodes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const mailboxMessages = pgTable("mailbox_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const mailboxAttachments = pgTable("mailbox_attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => mailboxMessages.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  currency: text("currency"),
  amount: integer("amount"),
  productId: text("product_id").references(() => products.id),
  itemId: text("item_id").references(() => items.id),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});

export const marketplaceListings = pgTable("marketplace_listings", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  sellerUserId: text("seller_user_id").notNull().references(() => users.id),
  productTitle: text("product_title").notNull(),
  currency: text("currency").notNull(),
  price: integer("price").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
