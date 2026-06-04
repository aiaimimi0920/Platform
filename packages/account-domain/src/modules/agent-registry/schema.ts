import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  sourceType: text("source_type").notNull(),
  runtimeEndpoint: text("runtime_endpoint"),
  authMode: text("auth_mode").notNull(),
  enabled: boolean("enabled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const agentCapabilities = pgTable("agent_capabilities", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  pricingNote: text("pricing_note"),
  inputSchema: text("input_schema"),
  outputSchema: text("output_schema"),
  enabled: boolean("enabled").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
