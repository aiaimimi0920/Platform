import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { agentCapabilities, agents } from "@/modules/agent-registry/schema";
import { users } from "@/modules/identity/schema";

export const agentExecutions = pgTable("agent_executions", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").references(() => agentCapabilities.id, { onDelete: "set null" }),
  taskId: text("task_id"),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  objectiveChecklist: jsonb("objective_checklist").notNull().default([]),
  inputResourcePayload: jsonb("input_resource_payload"),
  normalizedResourcePayload: jsonb("normalized_resource_payload"),
  outputResourcePayload: jsonb("output_resource_payload"),
  marketplaceInvocation: jsonb("marketplace_invocation"),
  runtimeProfileKey: text("runtime_profile_key").notNull().default("baseline"),
  callbackRemediationPolicyKey: text("callback_remediation_policy_key"),
  targetArtifactCount: integer("target_artifact_count").notNull().default(1),
  status: text("status").notNull(),
  statusNote: text("status_note"),
  resultSummary: text("result_summary"),
  outputVersion: integer("output_version"),
  outputKind: text("output_kind"),
  outputPayload: jsonb("output_payload"),
  outputGeneratedAt: timestamp("output_generated_at", { withTimezone: true }),
  executorPhase: text("executor_phase"),
  progressPercent: integer("progress_percent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastExternalCallbackAt: timestamp("last_external_callback_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  autoRecoveryCount: integer("auto_recovery_count").notNull().default(0),
  maxAutoRecoveryCount: integer("max_auto_recovery_count").notNull().default(3),
  recoveryExhaustedAt: timestamp("recovery_exhausted_at", { withTimezone: true }),
});

export const agentExecutionLaunchPresets = pgTable(
  "agent_execution_launch_presets",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    preferredAgentId: text("preferred_agent_id").references(() => agents.id, { onDelete: "set null" }),
    runtimeProfileKey: text("runtime_profile_key").notNull().default("baseline"),
    callbackRemediationPolicyKey: text("callback_remediation_policy_key"),
    titleTemplate: text("title_template"),
    objectiveTemplate: text("objective_template"),
    launchGuidance: text("launch_guidance"),
    followUpExecutionStatus: text("follow_up_execution_status"),
    followUpRunKind: text("follow_up_run_kind"),
    followUpRunStatus: text("follow_up_run_status"),
    followUpFailureCategory: text("follow_up_failure_category"),
    followUpRecentWindow: text("follow_up_recent_window"),
    followUpCallbackStatus: text("follow_up_callback_status"),
    followUpCallbackRetryability: text("follow_up_callback_retryability"),
    followUpCallbackType: text("follow_up_callback_type"),
    followUpCallbackRejectionCategory: text("follow_up_callback_rejection_category"),
    followUpReplayPayloadCompatibility: text("follow_up_replay_payload_compatibility"),
    followUpReplayPayloadReplayable: boolean("follow_up_replay_payload_replayable"),
    followUpDecisionClass: text("follow_up_decision_class"),
    followUpReplayFailureClass: text("follow_up_replay_failure_class"),
    followUpRuntimeDecisionClass: text("follow_up_runtime_decision_class"),
    followUpRuntimeDecisionSeverity: text("follow_up_runtime_decision_severity"),
    followUpPressureLevel: text("follow_up_pressure_level"),
    followUpSchedulingDecisionClass: text("follow_up_scheduling_decision_class"),
    followUpRuntimeSessionKind: text("follow_up_runtime_session_kind"),
    followUpRuntimeSessionState: text("follow_up_runtime_session_state"),
    focusSection: text("focus_section"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    ownerNameUnique: uniqueIndex("agent_execution_launch_presets_owner_name_idx").on(table.ownerUserId, table.name),
    ownerIdx: index("agent_execution_launch_presets_owner_idx").on(table.ownerUserId),
    preferredAgentIdx: index("agent_execution_launch_presets_preferred_agent_idx").on(table.preferredAgentId),
    updatedAtIdx: index("agent_execution_launch_presets_updated_at_idx").on(table.updatedAt),
  }),
);

export const agentExecutionLaunchDefaultPresets = pgTable(
  "agent_execution_launch_default_presets",
  {
    ownerUserId: text("owner_user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    presetId: text("preset_id")
      .notNull()
      .references(() => agentExecutionLaunchPresets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    presetIdx: index("agent_execution_launch_default_presets_preset_idx").on(table.presetId),
    updatedAtIdx: index("agent_execution_launch_default_presets_updated_at_idx").on(table.updatedAt),
  }),
);

export const agentExecutionArtifacts = pgTable("agent_execution_artifacts", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agentExecutionSteps = pgTable("agent_execution_steps", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  phase: text("phase"),
  title: text("title").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  progressPercent: integer("progress_percent"),
  costUnits: integer("cost_units").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agentExecutionSubtasks = pgTable("agent_execution_subtasks", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  parentSubtaskId: text("parent_subtask_id"),
  title: text("title").notNull(),
  detail: text("detail"),
  status: text("status").notNull(),
  managedByRuntime: boolean("managed_by_runtime").notNull().default(false),
  runtimePhase: text("runtime_phase"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const agentExecutionCallbacks = pgTable(
  "agent_execution_callbacks",
  {
    id: text("id").primaryKey(),
    executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    callbackId: text("callback_id").notNull(),
    callbackType: text("callback_type").notNull(),
    status: text("status").notNull(),
    remediationPolicyKey: text("remediation_policy_key").notNull().default("balanced"),
    callbackVersion: integer("callback_version").notNull().default(1),
    secretVersion: integer("secret_version").notNull().default(1),
    usedPreviousProtocol: boolean("used_previous_protocol").notNull().default(false),
    usedPreviousSecret: boolean("used_previous_secret").notNull().default(false),
    callbackTimestamp: timestamp("callback_timestamp", { withTimezone: true }),
    rejectionCategory: text("rejection_category"),
    payloadSummary: text("payload_summary"),
    replayPayload: jsonb("replay_payload"),
    autoRemediationAttempts: integer("auto_remediation_attempts").notNull().default(0),
    lastAutoRemediationAt: timestamp("last_auto_remediation_at", { withTimezone: true }),
    nextAutoRemediationAt: timestamp("next_auto_remediation_at", { withTimezone: true }),
    autoRemediationExhaustedAt: timestamp("auto_remediation_exhausted_at", { withTimezone: true }),
    autoRemediationLastError: text("auto_remediation_last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    receivedIdx: index("agent_execution_callbacks_received_idx").on(table.receivedAt.desc(), table.id.desc()),
  }),
);

export const agentExecutionCallbackRemediations = pgTable("agent_execution_callback_remediations", {
  id: text("id").primaryKey(),
  callbackAuditId: text("callback_audit_id")
    .notNull()
    .references(() => agentExecutionCallbacks.id, { onDelete: "cascade" }),
  executionId: text("execution_id")
    .notNull()
    .references(() => agentExecutions.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => agentExecutionRuns.id, { onDelete: "set null" }),
  actorUserId: text("actor_user_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  plannedDecisionClass: text("planned_decision_class"),
  plannedPrimaryAction: text("planned_primary_action"),
  plannedFallbackAction: text("planned_fallback_action"),
  planReasonCategory: text("plan_reason_category"),
  planReason: text("plan_reason"),
  fallbackFailureClass: text("fallback_failure_class"),
  fallbackReason: text("fallback_reason"),
  note: text("note"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const agentExecutionRuns = pgTable("agent_execution_runs", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  runKind: text("run_kind").notNull(),
  status: text("status").notNull(),
  summary: text("summary"),
  errorMessage: text("error_message"),
  artifactCount: integer("artifact_count").notNull().default(0),
  costUnits: integer("cost_units").notNull().default(0),
  resourceMinutes: integer("resource_minutes").notNull().default(0),
  estimatedAmount: integer("estimated_amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const agentExecutionRuntimeSessions = pgTable("agent_execution_runtime_sessions", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  runId: text("run_id"),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  state: text("state").notNull(),
  trigger: text("trigger").notNull(),
  startedPhase: text("started_phase"),
  endedPhase: text("ended_phase"),
  note: text("note"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const agentExecutionSettlements = pgTable("agent_execution_settlements", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  runtimeProfileKey: text("runtime_profile_key").notNull().default("baseline"),
  pricingPolicyKey: text("pricing_policy_key").notNull().default("default"),
  pricingPolicyVersion: integer("pricing_policy_version").notNull().default(1),
  revenueContractKey: text("revenue_contract_key").notNull().default("default"),
  revenueContractVersion: integer("revenue_contract_version").notNull().default(1),
  revenueRecipientMode: text("revenue_recipient_mode").notNull().default("agent_owner"),
  costUnitsPerCurrency: integer("cost_units_per_currency").notNull().default(10),
  revenueSharePercent: integer("revenue_share_percent").notNull().default(100),
  treasuryUserId: text("treasury_user_id").notNull(),
  measuredCostUnits: integer("measured_cost_units").notNull().default(0),
  includedCostUnits: integer("included_cost_units").notNull().default(0),
  billedCostUnits: integer("billed_cost_units").notNull().default(0),
  minimumBilledAmount: integer("minimum_billed_amount").notNull().default(0),
  billedAmount: integer("billed_amount").notNull().default(0),
  revenueRecipientUserId: text("revenue_recipient_user_id"),
  minimumPayoutAmount: integer("minimum_payout_amount").notNull().default(0),
  revenueAmount: integer("revenue_amount").notNull().default(0),
  status: text("status").notNull(),
  note: text("note"),
  lastError: text("last_error"),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const agentExecutionSettlementAttempts = pgTable("agent_execution_settlement_attempts", {
  id: text("id").primaryKey(),
  settlementId: text("settlement_id")
    .notNull()
    .references(() => agentExecutionSettlements.id, { onDelete: "cascade" }),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  billedAmount: integer("billed_amount").notNull().default(0),
  revenueAmount: integer("revenue_amount").notNull().default(0),
  status: text("status").notNull(),
  note: text("note"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agentExecutionSettlementLineItems = pgTable("agent_execution_settlement_line_items", {
  id: text("id").primaryKey(),
  settlementId: text("settlement_id")
    .notNull()
    .references(() => agentExecutionSettlements.id, { onDelete: "cascade" }),
  executionId: text("execution_id").notNull().references(() => agentExecutions.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  lineKind: text("line_kind").notNull(),
  title: text("title").notNull(),
  scopeType: text("scope_type"),
  scopeId: text("scope_id"),
  costUnits: integer("cost_units").notNull().default(0),
  amount: integer("amount").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
