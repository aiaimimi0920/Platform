import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  profileTagline: text("profile_tagline"),
  honorShowcasedAgentIds: text("honor_showcased_agent_ids"),
  honorShowcasedProjectIds: text("honor_showcased_project_ids"),
  honorShowcasedInvestmentProjectIds: text("honor_showcased_investment_project_ids"),
  honorShowcasedIssueIds: text("honor_showcased_issue_ids"),
  honorShowcasedInvestmentIssueIds: text("honor_showcased_investment_issue_ids"),
  trustLevel: integer("trust_level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    providerIdentityUnique: uniqueIndex("auth_identities_provider_identity_idx").on(table.provider, table.providerUserId),
  }),
);
