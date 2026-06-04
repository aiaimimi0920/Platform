import type {
  AgentExecutionOwnerReliefRunSummary,
  NotificationWebhookIncidentSavedViewFilters,
  NotificationWebhookIncidentSavedViewPlaybookDefaults,
} from "@neuro/contracts";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "@/modules/identity/schema";

export const agentExecutions = pgTable("agent_executions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const notificationWebhookIncidentSavedViews = pgTable(
  "notification_webhook_incident_saved_views",
  {
    id: text("id").primaryKey(),
    operatorUserId: text("operator_user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    filters: jsonb("filters").$type<NotificationWebhookIncidentSavedViewFilters>().notNull(),
    playbookDefaults: jsonb("playbook_defaults").$type<NotificationWebhookIncidentSavedViewPlaybookDefaults>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerNameUnique: uniqueIndex("notification_webhook_incident_saved_views_owner_name_idx").on(
      table.operatorUserId,
      table.name,
    ),
    ownerIdx: index("notification_webhook_incident_saved_views_owner_idx").on(table.operatorUserId),
    createdAtIdx: index("notification_webhook_incident_saved_views_created_at_idx").on(table.createdAt),
    updatedAtIdx: index("notification_webhook_incident_saved_views_updated_at_idx").on(table.updatedAt),
  }),
);

export const notificationWebhookIncidentDefaultViews = pgTable(
  "notification_webhook_incident_default_views",
  {
    operatorUserId: text("operator_user_id").primaryKey(),
    savedViewId: text("saved_view_id")
      .notNull()
      .references(() => notificationWebhookIncidentSavedViews.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    savedViewIdx: index("notification_webhook_incident_default_views_saved_view_idx").on(table.savedViewId),
    updatedAtIdx: index("notification_webhook_incident_default_views_updated_at_idx").on(table.updatedAt),
  }),
);

export const agentExecutionOwnerReliefRuns = pgTable(
  "agent_execution_owner_relief_runs",
  {
    id: text("id").primaryKey(),
    operatorUserId: text("operator_user_id").notNull().references(() => users.id),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id),
    agentId: text("agent_id"),
    triggerAction: text("trigger_action"),
    source: text("source"),
    runtimePressureLevel: text("runtime_pressure_level"),
    runtimeSchedulingDecisionClass: text("runtime_scheduling_decision_class"),
    openingSummary: jsonb("opening_summary").$type<AgentExecutionOwnerReliefRunSummary>().notNull(),
    latestSummary: jsonb("latest_summary").$type<AgentExecutionOwnerReliefRunSummary>().notNull(),
    actionCount: integer("action_count").notNull(),
    resultStatus: text("result_status").notNull(),
    resultNote: text("result_note"),
    handoffTargetType: text("handoff_target_type"),
    handoffTarget: text("handoff_target"),
    reopenedFromRunId: text("reopened_from_run_id"),
    supersededByRunId: text("superseded_by_run_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: text("completed_by_user_id").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    operatorStartedIdx: index("agent_execution_owner_relief_runs_operator_started_idx").on(
      table.operatorUserId,
      table.startedAt,
    ),
    ownerStartedIdx: index("agent_execution_owner_relief_runs_owner_started_idx").on(
      table.ownerUserId,
      table.startedAt,
    ),
    resultStatusIdx: index("agent_execution_owner_relief_runs_result_status_idx").on(
      table.operatorUserId,
      table.resultStatus,
      table.startedAt,
    ),
    agentIdx: index("agent_execution_owner_relief_runs_agent_idx").on(table.agentId, table.startedAt),
  }),
);

export const agentExecutionOwnerReliefHandoffDefaults = pgTable(
  "agent_execution_owner_relief_handoff_defaults",
  {
    operatorUserId: text("operator_user_id").notNull().references(() => users.id),
    handoffTargetType: text("handoff_target_type").notNull(),
    handoffTarget: text("handoff_target").notNull(),
    noteTemplate: text("note_template"),
    followUpFocusSection: text("follow_up_focus_section"),
    followUpProfile: text("follow_up_profile"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerTypeUnique: uniqueIndex("agent_execution_owner_relief_handoff_defaults_owner_type_idx").on(
      table.operatorUserId,
      table.handoffTargetType,
    ),
    ownerUpdatedIdx: index("agent_execution_owner_relief_handoff_defaults_owner_updated_idx").on(
      table.operatorUserId,
      table.updatedAt,
    ),
  }),
);

export const agentExecutionOwnerReliefRunHandoffs = pgTable(
  "agent_execution_owner_relief_run_handoffs",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentExecutionOwnerReliefRuns.id, { onDelete: "cascade" }),
    operatorUserId: text("operator_user_id").notNull().references(() => users.id),
    handoffTargetType: text("handoff_target_type").notNull(),
    handoffTarget: text("handoff_target").notNull(),
    followUpFocusSection: text("follow_up_focus_section"),
    followUpProfile: text("follow_up_profile"),
    status: text("status").notNull(),
    latestFollowUpHref: text("latest_follow_up_href"),
    openCount: integer("open_count").notNull(),
    firstOpenedAt: timestamp("first_opened_at", { withTimezone: true }),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    resultNote: text("result_note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: text("completed_by_user_id").references(() => users.id),
    reopenedRunId: text("reopened_run_id"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    runUnique: uniqueIndex("agent_execution_owner_relief_run_handoffs_run_idx").on(table.runId),
    operatorUpdatedIdx: index("agent_execution_owner_relief_run_handoffs_operator_updated_idx").on(
      table.operatorUserId,
      table.updatedAt,
    ),
    operatorStatusIdx: index("agent_execution_owner_relief_run_handoffs_operator_status_idx").on(
      table.operatorUserId,
      table.status,
      table.updatedAt,
    ),
  }),
);

export const agentExecutionOwnerReliefRunActions = pgTable(
  "agent_execution_owner_relief_run_actions",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentExecutionOwnerReliefRuns.id, { onDelete: "cascade" }),
    operatorUserId: text("operator_user_id").notNull().references(() => users.id),
    actionKind: text("action_kind").notNull(),
    status: text("status").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    summary: jsonb("summary").$type<AgentExecutionOwnerReliefRunSummary>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    runCreatedIdx: index("agent_execution_owner_relief_run_actions_run_idx").on(table.runId, table.createdAt),
    operatorCreatedIdx: index("agent_execution_owner_relief_run_actions_operator_idx").on(
      table.operatorUserId,
      table.createdAt,
    ),
  }),
);
