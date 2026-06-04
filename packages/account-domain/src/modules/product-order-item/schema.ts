import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  kind: text("kind").notNull(),
  currency: text("currency").notNull(),
  price: integer("price").notNull(),
  fulfillmentMode: text("fulfillment_mode").notNull(),
  transferable: boolean("transferable").notNull(),
  active: boolean("active").notNull(),
  allowDiscountCodes: boolean("allow_discount_codes").notNull(),
  limitScope: text("limit_scope").notNull(),
  durationDays: integer("duration_days"),
  unitCount: integer("unit_count"),
  warrantyDays: integer("warranty_days"),
  stockLabel: text("stock_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => ({
  slugUnique: uniqueIndex("products_slug_idx").on(table.slug),
}));

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  currency: text("currency").notNull(),
  amount: integer("amount").notNull(),
  originalAmount: integer("original_amount").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  finalAmount: integer("final_amount").notNull(),
  discountCodeId: text("discount_code_id"),
  discountCode: text("discount_code"),
  status: text("status").notNull(),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  rolledBackByUserId: text("rolled_back_by_user_id"),
  rollbackReason: text("rollback_reason"),
  rollbackNote: text("rollback_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  orderId: text("order_id"),
  productTitle: text("product_title").notNull(),
  fulfillmentMode: text("fulfillment_mode").notNull(),
  transferable: boolean("transferable").notNull(),
  status: text("status").notNull(),
  remainingUses: integer("remaining_uses"),
  totalUnits: integer("total_units"),
  activeUnits: integer("active_units"),
  replacementCount: integer("replacement_count").notNull().default(0),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedByUserId: text("revoked_by_user_id"),
  revocationReason: text("revocation_reason"),
  warrantyExpiresAt: timestamp("warranty_expires_at", { withTimezone: true }),
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const itemUnits = pgTable(
  "item_units",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    slotNumber: integer("slot_number").notNull(),
    generation: integer("generation").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull(),
    issueReason: text("issue_reason"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    replacedByUnitId: text("replaced_by_unit_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("item_units_item_code_idx").on(table.itemId, table.code),
  }),
);
