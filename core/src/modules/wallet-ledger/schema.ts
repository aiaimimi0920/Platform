import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    currency: text("currency").notNull(),
    availableBalance: integer("available_balance").notNull(),
    frozenBalance: integer("frozen_balance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userCurrencyUnique: uniqueIndex("ledger_accounts_user_currency_idx").on(table.userId, table.currency),
  }),
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull().references(() => ledgerAccounts.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  entryType: text("entry_type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfterAvailable: integer("balance_after_available").notNull(),
  balanceAfterFrozen: integer("balance_after_frozen").notNull(),
  note: text("note"),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
