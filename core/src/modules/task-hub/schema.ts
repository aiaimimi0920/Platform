import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";
import { agents } from "@/modules/agent-registry/schema";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  creatorUserId: text("creator_user_id").notNull().references(() => users.id),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  preferredCapabilityCodes: jsonb("preferred_capability_codes").$type<string[]>().notNull(),
  pricingMode: text("pricing_mode").notNull().default("flat_task"),
  billingUnit: text("billing_unit"),
  meterKey: text("meter_key"),
  meterQuantity: integer("meter_quantity"),
  operationMode: text("operation_mode").notNull().default("manual"),
  rewardCurrency: text("reward_currency").notNull(),
  rewardAmount: integer("reward_amount").notNull(),
  requiredBondAmount: integer("required_bond_amount").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
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

export const bondHolds = pgTable("bond_holds", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  applicationId: text("application_id").notNull().references(() => taskApplications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  currency: text("currency").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
});

export const taskDispatchDecisions = pgTable(
  "task_dispatch_decisions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    assignedApplicationId: text("assigned_application_id").references(() => taskApplications.id),
    assignedProposalId: text("assigned_proposal_id").references(() => taskAgentProposals.id),
    assignedUserId: text("assigned_user_id").notNull().references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    taskUnique: uniqueIndex("task_dispatch_decisions_task_idx").on(table.taskId),
  }),
);

export const taskRewardHolds = pgTable(
  "task_reward_holds",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    creatorUserId: text("creator_user_id").notNull().references(() => users.id),
    assigneeUserId: text("assignee_user_id").references(() => users.id),
    rewardCurrency: text("reward_currency").notNull(),
    rewardAmount: integer("reward_amount").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => ({
    taskUnique: uniqueIndex("task_reward_holds_task_idx").on(table.taskId),
  }),
);

export const taskAgentProposals = pgTable(
  "task_agent_proposals",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    proposerUserId: text("proposer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    proposedEtaHours: integer("proposed_eta_hours").notNull(),
    proposedCostNote: text("proposed_cost_note"),
    executionId: text("execution_id"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    taskAgentUnique: uniqueIndex("task_agent_proposals_task_agent_idx").on(table.taskId, table.agentId),
  }),
);
