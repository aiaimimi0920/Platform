import { boolean, integer, pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const honorProjects = pgTable(
  "honor_projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    publicHref: text("public_href"),
    ownerHandle: text("owner_handle").notNull(),
    ownerLabel: text("owner_label").notNull(),
    categoryLabel: text("category_label").notNull(),
    stageLabel: text("stage_label").notNull(),
    progressPercent: integer("progress_percent").notNull(),
    progressLabel: text("progress_label").notNull(),
    rewardShareLabel: text("reward_share_label").notNull(),
    sponsorOpen: boolean("sponsor_open").notNull(),
    sponsorStatusLabel: text("sponsor_status_label").notNull(),
    joinOpen: boolean("join_open").notNull(),
    joinStatusLabel: text("join_status_label").notNull(),
    collaborationLabel: text("collaboration_label").notNull(),
    fundingTargetAmount: integer("funding_target_amount").notNull(),
    workspaceHref: text("workspace_href").notNull(),
    workspaceLabel: text("workspace_label").notNull(),
    detailBody: text("detail_body").notNull(),
    sponsorCount: integer("sponsor_count").notNull(),
    sponsoredAmount: integer("sponsored_amount").notNull(),
    sponsoredCurrencyLabel: text("sponsored_currency_label").notNull(),
    sortOrder: integer("sort_order").notNull(),
    status: text("status").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    statusSortIdx: index("honor_projects_status_sort_idx").on(table.status, table.sortOrder, table.updatedAt),
  }),
);

export const honorProjectInvestments = pgTable(
  "honor_project_investments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => honorProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investedAmount: integer("invested_amount").notNull(),
    currencyLabel: text("currency_label").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectUserUnique: uniqueIndex("honor_project_investments_project_user_idx").on(table.projectId, table.userId),
    userUpdatedIdx: index("honor_project_investments_user_updated_idx").on(table.userId, table.updatedAt),
    projectUpdatedIdx: index("honor_project_investments_project_updated_idx").on(table.projectId, table.updatedAt),
  }),
);

export const honorProjectMemberships = pgTable(
  "honor_project_memberships",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => honorProjects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleLabel: text("role_label").notNull(),
    note: text("note"),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    projectUserUnique: uniqueIndex("honor_project_memberships_project_user_idx").on(table.projectId, table.userId),
    userUpdatedIdx: index("honor_project_memberships_user_updated_idx").on(table.userId, table.updatedAt),
    projectUpdatedIdx: index("honor_project_memberships_project_updated_idx").on(table.projectId, table.updatedAt),
  }),
);
