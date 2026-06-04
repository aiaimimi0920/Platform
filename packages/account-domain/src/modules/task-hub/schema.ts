import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  creatorUserId: text("creator_user_id").notNull().references(() => users.id),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  rewardCurrency: text("reward_currency").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  requiredBondAmount: integer("required_bond_amount").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const taskApplications = pgTable("task_applications", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  applicantUserId: text("applicant_user_id").notNull().references(() => users.id),
  statement: text("statement").notNull(),
  proposedEtaHours: integer("proposed_eta_hours").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
