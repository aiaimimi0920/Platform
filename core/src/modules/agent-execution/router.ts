import type { FastifyPluginAsync } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  buildStoredExternalCallbackReplayEnvelope,
  buildExternalCallbackSignatureMessage,
  summarizeExternalCallbackPayload,
} from "@/modules/agent-execution/callback-governance";
import { env } from "@/env";
import {
  addExternalAgentExecutionArtifact,
  addOwnedAgentExecutionArtifact,
  autoRemediateRejectedCallbackPayloads,
  createOwnedAgentExecutionLaunchPreset,
  createOwnedAgentExecutionSubtask,
  createOwnedAgentExecution,
  deleteOwnedAgentExecutionLaunchPreset,
  emitCallbackRemediationAlerts,
  emitRuntimePressureAlerts,
  getCallbackRemediationSummaryForOperator,
  getRuntimeSessionSummaryForOperator,
  getRuntimePressureAlertSummaryForOperator,
  getAgentExecutionRuntimeCatalog,
  getCallbackAuditSummaryForOperator,
  getExecutionRunSummaryForOperator,
  handleExternalAgentCallback,
  listCallbackAuditsForOperator,
  listOwnedAgentExecutionLaunchPresets,
  listExecutionRunsForOperator,
  listRuntimeSessionsForOperator,
  listOwnedAgentExecutions,
  replayRejectedCallbackPayloadByOperator,
  retryAgentExecutionSettlement,
  runPendingAgentExecutionSettlements,
  setOwnedAgentExecutionLaunchDefaultPreset,
  getAgentExecutionSettlementSummary,
  listAgentExecutionSettlementAttempts,
  requestRejectedCallbackRetriesByOperator,
  requestRejectedCallbackRetryByOperator,
  recoverStalePlatformExecutions,
  recordRejectedExternalCallbackAudit,
  requeueOwnedAgentExecution,
  recordExternalAgentExecutionHeartbeat,
  runPendingDispatchableAgentExecutions,
  runPlatformExecutor,
  sweepRuntimeSessions,
  updateOwnedAgentExecutionLaunchPreset,
  updateOwnedAgentExecutionCallbackRemediationPolicy,
  updateOwnedAgentExecutionSubtaskStatus,
  updateExternalAgentExecutionStatus,
  updateOwnedAgentExecutionStatus,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { BadRequestError, UnauthorizedError } from "@/platform/errors";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";

const createExecutionSchema = z.object({
  agentId: z.string().min(1),
  capabilityId: z.string().min(1).nullable().optional(),
  title: z.string().min(3),
  objective: z.string().min(10),
  inputResourcePayload: z.record(z.string(), z.unknown()).nullable().optional(),
  runtimeProfileKey: z.enum(["baseline", "iterative", "deep_runtime"]).optional(),
  callbackRemediationPolicyKey: z
    .enum(["manual_only", "safe_retry", "balanced", "aggressive"])
    .nullable()
      .optional(),
});

const listExecutionLaunchPresetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const saveExecutionLaunchPresetSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  preferredAgentId: z.string().min(1).nullable().optional(),
  runtimeProfileKey: z.enum(["baseline", "iterative", "deep_runtime"]).nullable().optional(),
  callbackRemediationPolicyKey: z
    .enum(["manual_only", "safe_retry", "balanced", "aggressive"])
    .nullable()
    .optional(),
  titleTemplate: z.string().nullable().optional(),
  objectiveTemplate: z.string().nullable().optional(),
  launchGuidance: z.string().max(4000).nullable().optional(),
  followUpExecutionStatus: z
    .enum(["queued", "running", "submitted", "completed", "failed", "cancelled"])
    .nullable()
    .optional(),
  followUpRunKind: z
    .enum([
      "platform_executor",
      "requeue",
      "recovery",
      "callback_retry_request",
      "callback_payload_replay",
      "callback_auto_remediation",
    ])
    .nullable()
    .optional(),
  followUpRunStatus: z.enum(["running", "completed", "failed"]).nullable().optional(),
  followUpFailureCategory: z
    .enum(["stale_timeout", "executor_failure", "requeue_failure", "unknown_failure"])
    .nullable()
    .optional(),
  followUpRecentWindow: z.enum(["15m", "1h", "24h"]).nullable().optional(),
  followUpCallbackStatus: z.enum(["accepted", "duplicate", "rejected"]).nullable().optional(),
  followUpCallbackRetryability: z.enum(["retryable", "inspect", "not_retryable"]).nullable().optional(),
  followUpCallbackType: z.enum(["heartbeat", "status", "artifact", "callback"]).nullable().optional(),
  followUpCallbackRejectionCategory: z
    .enum([
      "invalid_secret",
      "invalid_signature",
      "invalid_timestamp",
      "invalid_version",
      "invalid_payload",
      "processing_conflict",
      "unsupported_target",
      "unknown",
    ])
    .nullable()
    .optional(),
  followUpReplayPayloadCompatibility: z.enum(["current", "legacy_normalized", "invalid"]).nullable().optional(),
  followUpReplayPayloadReplayable: z.boolean().nullable().optional(),
  followUpDecisionClass: z
    .enum([
      "replay_current_payload",
      "replay_legacy_payload",
      "retry_missing_payload",
      "retry_incompatible_payload",
      "retry_compatibility_policy",
      "retry_compat_window",
      "retry_policy_preferred",
      "skip_policy_disabled",
      "skip_missing_rejection_category",
      "skip_policy_budget_exhausted",
      "skip_missing_payload",
      "skip_incompatible_payload",
      "skip_compatibility_policy",
      "skip_compat_window",
      "skip_policy_not_covered",
      "skip_target_unavailable",
    ])
    .nullable()
    .optional(),
  followUpReplayFailureClass: z
    .enum([
      "stored_payload_unavailable",
      "callback_secret_unavailable",
      "duplicate_replay_cooldown",
      "agent_disabled",
      "callback_not_retryable",
      "unsupported_target",
      "callback_protocol_mismatch",
    ])
    .nullable()
    .optional(),
  followUpRuntimeDecisionClass: z
    .enum([
      "prepare_continue",
      "prepare_near_limit_cap",
      "prepare_timeout_accelerated",
      "artifact_batch_continue",
      "artifact_batch_downshift_near_limit",
      "artifact_finalize_early_near_limit",
      "artifact_finalize_early_timeout",
      "artifact_finalize_early_headroom",
      "artifact_partial_finalize_blocked",
      "finalize_continue",
      "finalize_near_limit_cap",
      "finalize_timeout_accelerated",
      "finalize_completed",
    ])
    .nullable()
    .optional(),
  followUpRuntimeDecisionSeverity: z.enum(["info", "warning", "critical"]).nullable().optional(),
  followUpPressureLevel: z.enum(["healthy", "watch", "critical"]).nullable().optional(),
  followUpSchedulingDecisionClass: z
    .enum([
      "within_capacity",
      "queue_backlog",
      "profile_saturated",
      "owner_hotspot",
      "profile_and_owner_saturated",
    ])
    .nullable()
    .optional(),
  followUpRuntimeSessionKind: z.enum(["platform_executor", "stale_recovery", "owner_requeue"]).nullable().optional(),
  followUpRuntimeSessionState: z.enum(["running", "completed", "failed", "requeued"]).nullable().optional(),
  focusSection: z
    .enum(["active-preset", "launch-presets", "create-execution", "runtime-sessions", "cost-overview", "execution-list"])
    .nullable()
    .optional(),
});

const updateExecutionCallbackRemediationPolicySchema = z.object({
  policyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["running", "submitted", "completed", "failed", "cancelled"]),
  statusNote: z.string().max(2000).optional(),
  resultSummary: z.string().max(4000).optional(),
});

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Only http and https URLs are allowed");

const addArtifactSchema = z.object({
  kind: z.enum(["link", "note"]),
  title: z.string().min(3).max(200),
  url: httpUrlSchema.optional(),
  summary: z.string().max(4000).optional(),
});

const callbackReplayPayloadCompatibilitySchema = z.enum(["current", "legacy_normalized", "invalid"]);
const callbackReplayPayloadReplayableQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const createSubtaskSchema = z.object({
  title: z.string().min(3).max(200),
  detail: z.string().max(4000).optional(),
  parentSubtaskId: z.string().min(1).optional(),
});

const updateSubtaskStatusSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  detail: z.string().max(4000).optional(),
});

const heartbeatSchema = z.object({
  statusNote: z.string().max(2000).optional(),
});

const callbackAutoRemediationReasonCategorySchema = z.enum([
  "policy_disabled",
  "missing_rejection_category",
  "policy_budget_exhausted",
  "missing_agent",
  "missing_payload",
  "incompatible_payload",
  "compatibility_policy_blocked",
  "compat_window_blocked",
  "policy_not_covered",
  "duplicate_cooldown",
  "target_unavailable",
  "attempt_failed",
]);

const callbackRemediationDecisionClassSchema = z.enum([
  "replay_current_payload",
  "replay_legacy_payload",
  "retry_missing_payload",
  "retry_incompatible_payload",
  "retry_compatibility_policy",
  "retry_compat_window",
  "retry_policy_preferred",
  "skip_policy_disabled",
  "skip_missing_rejection_category",
  "skip_policy_budget_exhausted",
  "skip_missing_payload",
  "skip_incompatible_payload",
  "skip_compatibility_policy",
  "skip_compat_window",
  "skip_policy_not_covered",
  "skip_target_unavailable",
]);

const callbackReplayFailureClassSchema = z.enum([
  "stored_payload_unavailable",
  "callback_secret_unavailable",
  "duplicate_replay_cooldown",
  "agent_disabled",
  "callback_not_retryable",
  "unsupported_target",
  "callback_protocol_mismatch",
]);

const runtimeDecisionClassSchema = z.enum([
  "prepare_continue",
  "prepare_near_limit_cap",
  "prepare_timeout_accelerated",
  "artifact_batch_continue",
  "artifact_batch_downshift_near_limit",
  "artifact_finalize_early_near_limit",
  "artifact_finalize_early_timeout",
  "artifact_finalize_early_headroom",
  "artifact_partial_finalize_blocked",
  "finalize_continue",
  "finalize_near_limit_cap",
  "finalize_timeout_accelerated",
  "finalize_completed",
]);

const runtimeDecisionSeveritySchema = z.enum(["info", "warning", "critical"]);

const listCallbackAuditQuerySchema = z.object({
  agentId: z.string().min(1).optional(),
  callbackType: z.enum(["status", "artifact", "heartbeat", "callback"]).optional(),
  status: z.enum(["accepted", "duplicate", "rejected"]).optional(),
  remediationPolicyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).optional(),
  callbackVersion: z.coerce.number().int().positive().optional(),
  secretVersion: z.coerce.number().int().positive().optional(),
  protocolMatch: z.enum(["current", "previous"]).optional(),
  secretMatch: z.enum(["current", "previous"]).optional(),
  retryability: z.enum(["retryable", "inspect", "not_retryable"]).optional(),
  autoRemediationReasonCategory: callbackAutoRemediationReasonCategorySchema.optional(),
  autoRemediationReasonDisposition: z.enum(["skipped", "failed"]).optional(),
  replayPayloadCompatibility: callbackReplayPayloadCompatibilitySchema.optional(),
  replayPayloadReplayable: callbackReplayPayloadReplayableQuerySchema.optional(),
  decisionClass: callbackRemediationDecisionClassSchema.optional(),
  replayFailureClass: callbackReplayFailureClassSchema.optional(),
  runtimeDecisionClass: runtimeDecisionClassSchema.optional(),
  runtimeDecisionSeverity: runtimeDecisionSeveritySchema.optional(),
  runtimePressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  runtimeSchedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
  rejectionCategory: z
    .enum([
      "invalid_secret",
      "invalid_signature",
      "invalid_timestamp",
      "invalid_version",
      "invalid_payload",
      "processing_conflict",
      "unsupported_target",
      "unknown",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listExecutionRunQuerySchema = z.object({
  agentId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  executionIds: z.string().min(1).optional(),
  runIds: z.string().min(1).optional(),
  runKind: z
    .enum([
      "platform_executor",
      "requeue",
      "recovery",
      "callback_retry_request",
      "callback_payload_replay",
      "callback_auto_remediation",
    ])
    .optional(),
  runStatus: z.enum(["running", "completed", "failed"]).optional(),
  executionStatus: z.enum(["queued", "running", "submitted", "completed", "failed", "cancelled"]).optional(),
  failureCategory: z.enum(["stale_timeout", "executor_failure", "requeue_failure", "unknown_failure"]).optional(),
  recentWindow: z.enum(["15m", "1h", "24h"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

function parseDelimitedIdList(raw?: string, limit = 50) {
  if (!raw) {
    return undefined;
  }
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
  return ids.length > 0 ? ids : undefined;
}

const runPlatformExecutorSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
  agentId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
});

const dispatchPendingExecutionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  executionId: z.string().min(1).optional(),
});

const recoverPlatformExecutorSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  staleSeconds: z.coerce.number().int().min(60).max(86_400).optional(),
  agentId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
});

const requestCallbackRetrySchema = z.object({
  note: z.string().max(500).optional(),
});

const replayCallbackPayloadSchema = z.object({
  note: z.string().max(500).optional(),
});

const requestCallbackRetryBatchSchema = z.object({
  agentId: z.string().min(1).optional(),
  callbackType: z.enum(["status", "artifact", "heartbeat", "callback"]).optional(),
  remediationPolicyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).optional(),
  callbackVersion: z.coerce.number().int().positive().optional(),
  secretVersion: z.coerce.number().int().positive().optional(),
  protocolMatch: z.enum(["current", "previous"]).optional(),
  secretMatch: z.enum(["current", "previous"]).optional(),
  retryability: z.enum(["retryable", "inspect", "not_retryable"]).optional(),
  autoRemediationReasonCategory: callbackAutoRemediationReasonCategorySchema.optional(),
  autoRemediationReasonDisposition: z.enum(["skipped", "failed"]).optional(),
  replayPayloadCompatibility: callbackReplayPayloadCompatibilitySchema.optional(),
  replayPayloadReplayable: z.boolean().optional(),
  decisionClass: callbackRemediationDecisionClassSchema.optional(),
  replayFailureClass: callbackReplayFailureClassSchema.optional(),
  runtimeDecisionClass: runtimeDecisionClassSchema.optional(),
  runtimeDecisionSeverity: runtimeDecisionSeveritySchema.optional(),
  runtimePressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  runtimeSchedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
  rejectionCategory: z
    .enum([
      "invalid_secret",
      "invalid_signature",
      "invalid_timestamp",
      "invalid_version",
      "invalid_payload",
      "processing_conflict",
      "unsupported_target",
      "unknown",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  note: z.string().max(500).optional(),
});

const autoRemediateCallbackPayloadSchema = z.object({
  agentId: z.string().min(1).optional(),
  callbackType: z.enum(["status", "artifact", "heartbeat", "callback"]).optional(),
  remediationPolicyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).optional(),
  callbackVersion: z.coerce.number().int().min(1).max(10).optional(),
  secretVersion: z.coerce.number().int().min(1).max(10).optional(),
  protocolMatch: z.enum(["current", "previous"]).optional(),
  secretMatch: z.enum(["current", "previous"]).optional(),
  retryability: z.enum(["retryable", "inspect", "not_retryable"]).optional(),
  autoRemediationReasonCategory: callbackAutoRemediationReasonCategorySchema.optional(),
  autoRemediationReasonDisposition: z.enum(["skipped", "failed"]).optional(),
  replayPayloadCompatibility: callbackReplayPayloadCompatibilitySchema.optional(),
  replayPayloadReplayable: z.boolean().optional(),
  decisionClass: callbackRemediationDecisionClassSchema.optional(),
  replayFailureClass: callbackReplayFailureClassSchema.optional(),
  runtimeDecisionClass: runtimeDecisionClassSchema.optional(),
  runtimeDecisionSeverity: runtimeDecisionSeveritySchema.optional(),
  runtimePressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  runtimeSchedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
  rejectionCategory: z
    .enum([
      "invalid_secret",
      "invalid_signature",
      "invalid_timestamp",
      "invalid_version",
      "invalid_payload",
      "processing_conflict",
      "unsupported_target",
      "unknown",
    ])
    .optional(),
  ignoreScheduleWindow: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  note: z.string().max(500).optional(),
});

const emitCallbackRemediationAlertsSchema = z.object({
  agentId: z.string().min(1).optional(),
  callbackType: z.enum(["status", "artifact", "heartbeat", "callback"]).optional(),
  remediationPolicyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).optional(),
  autoRemediationReasonCategory: callbackAutoRemediationReasonCategorySchema.optional(),
  autoRemediationReasonDisposition: z.enum(["skipped", "failed"]).optional(),
  replayPayloadCompatibility: callbackReplayPayloadCompatibilitySchema.optional(),
  replayPayloadReplayable: z.boolean().optional(),
  decisionClass: callbackRemediationDecisionClassSchema.optional(),
  replayFailureClass: callbackReplayFailureClassSchema.optional(),
  runtimeDecisionClass: runtimeDecisionClassSchema.optional(),
  runtimeDecisionSeverity: runtimeDecisionSeveritySchema.optional(),
  runtimePressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  runtimeSchedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
  minimumAlertLevel: z.coerce.number().int().min(1).max(3).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const runtimePressureAlertQuerySchema = z.object({
  pressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  schedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
});

const emitRuntimePressureAlertsSchema = runtimePressureAlertQuerySchema.extend({
  minimumAlertLevel: z.coerce.number().int().min(1).max(3).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const callbackRemediationSummaryQuerySchema = z.object({
  agentId: z.string().min(1).optional(),
  callbackType: z.enum(["status", "artifact", "heartbeat", "callback"]).optional(),
  remediationPolicyKey: z.enum(["manual_only", "safe_retry", "balanced", "aggressive"]).optional(),
  autoRemediationReasonCategory: callbackAutoRemediationReasonCategorySchema.optional(),
  autoRemediationReasonDisposition: z.enum(["skipped", "failed"]).optional(),
  replayPayloadCompatibility: callbackReplayPayloadCompatibilitySchema.optional(),
  replayPayloadReplayable: callbackReplayPayloadReplayableQuerySchema.optional(),
  decisionClass: callbackRemediationDecisionClassSchema.optional(),
  replayFailureClass: callbackReplayFailureClassSchema.optional(),
  runtimeDecisionClass: runtimeDecisionClassSchema.optional(),
  runtimeDecisionSeverity: runtimeDecisionSeveritySchema.optional(),
  runtimePressureLevel: z.enum(["healthy", "watch", "critical"]).optional(),
  runtimeSchedulingDecisionClass: z
    .enum(["within_capacity", "queue_backlog", "profile_saturated", "owner_hotspot", "profile_and_owner_saturated"])
    .optional(),
});

const runtimeSessionSweepSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  staleSeconds: z.coerce.number().int().min(60).max(86_400).optional(),
  agentId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  state: z.enum(["running", "completed", "failed", "requeued"]).optional(),
  kind: z.enum(["platform_executor", "stale_recovery", "owner_requeue"]).optional(),
  staleOnly: z.boolean().optional(),
});

const settlementRunSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  executionId: z.string().min(1).optional(),
});

const listSettlementAttemptsQuerySchema = z.object({
  status: z.enum(["settled", "pending", "pending_insufficient_balance", "skipped"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listRuntimeSessionsQuerySchema = z.object({
  agentId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  state: z.enum(["running", "completed", "failed", "requeued"]).optional(),
  kind: z.enum(["platform_executor", "stale_recovery", "owner_requeue"]).optional(),
  staleOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const externalCallbackSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heartbeat"),
    statusNote: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("status"),
    status: z.enum(["running", "submitted", "completed", "failed", "cancelled"]),
    statusNote: z.string().max(2000).optional(),
    resultSummary: z.string().max(4000).optional(),
  }),
  z.object({
    type: z.literal("artifact"),
    artifact: addArtifactSchema,
  }),
]);

export const agentExecutionRouter: FastifyPluginAsync = async (app) => {
  function readOptionalHeader(request: Parameters<typeof assertUserContext>[0], headerName: string) {
    const header = request.headers[headerName];
    if (typeof header !== "string") return null;
    const value = header.trim();
    return value.length > 0 ? value : null;
  }

  function getExternalCallbackSecret(request: Parameters<typeof assertUserContext>[0]) {
    const header = readOptionalHeader(request, "x-external-agent-secret");
    if (!header) {
      throw new UnauthorizedError("Missing external agent callback secret");
    }
    return header;
  }

  function getExternalCallbackId(request: Parameters<typeof assertUserContext>[0]) {
    const header = readOptionalHeader(request, "x-external-callback-id");
    if (!header) {
      throw new BadRequestError("Missing external callback id");
    }
    return header;
  }

  function getExternalCallbackTimestamp(request: Parameters<typeof assertUserContext>[0]) {
    const header = readOptionalHeader(request, "x-external-callback-timestamp");
    if (!header) {
      throw new BadRequestError("Missing external callback timestamp");
    }

    const parsed = Number(header);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestError("Invalid external callback timestamp");
    }

    return parsed;
  }

  function getExternalCallbackVersion(request: Parameters<typeof assertUserContext>[0]) {
    const header = readOptionalHeader(request, "x-external-callback-version");
    if (!header) {
      throw new BadRequestError("Missing external callback version");
    }

    const parsed = Number(header);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      throw new BadRequestError("Invalid external callback version");
    }

    return parsed;
  }

  function getExternalCallbackSignature(request: Parameters<typeof assertUserContext>[0]) {
    const header = readOptionalHeader(request, "x-external-callback-signature");
    if (!header) {
      throw new UnauthorizedError("Missing external callback signature");
    }
    return header.toLowerCase();
  }

  async function auditRejectedExternalCallback(args: {
    request: Parameters<typeof assertUserContext>[0];
    executionId: string;
    callbackType: "status" | "artifact" | "heartbeat" | "callback";
    payload: unknown;
    replayPayload?: ReturnType<typeof buildStoredExternalCallbackReplayEnvelope>;
    reason: string;
  }) {
    const rawVersion = readOptionalHeader(args.request, "x-external-callback-version");
    const rawTimestamp = readOptionalHeader(args.request, "x-external-callback-timestamp");
    const callbackVersion = rawVersion && Number.isFinite(Number(rawVersion)) ? Number(rawVersion) : null;
    const callbackTimestamp =
      rawTimestamp && Number.isFinite(Number(rawTimestamp)) ? new Date(Number(rawTimestamp) * 1000) : null;

    await recordRejectedExternalCallbackAudit({
      executionId: args.executionId,
      callbackSecret: readOptionalHeader(args.request, "x-external-agent-secret"),
      callbackId: readOptionalHeader(args.request, "x-external-callback-id"),
      callbackType: args.callbackType,
      callbackVersion,
      callbackTimestamp,
      payloadSummary: summarizeExternalCallbackPayload(args.payload),
      replayPayload: args.replayPayload ?? null,
      rejectionReason: args.reason,
    });
  }

  function assertExternalCallbackSignature(args: {
    request: Parameters<typeof assertUserContext>[0];
    executionId: string;
    payload: unknown;
    callbackSecret: string;
    callbackId: string;
  }) {
    const timestamp = getExternalCallbackTimestamp(args.request);
    const signature = getExternalCallbackSignature(args.request);
    const timestampAgeSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (timestampAgeSeconds > env.externalCallbackMaxSkewSeconds) {
      throw new UnauthorizedError("External callback timestamp is outside the accepted skew window");
    }

    const signedMessage = buildExternalCallbackSignatureMessage({
      executionId: args.executionId,
      callbackId: args.callbackId,
      timestamp,
      payload: args.payload,
    });
    const expectedSignature = createHmac("sha256", args.callbackSecret).update(signedMessage).digest("hex");
    const providedBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedError("Invalid external callback signature");
    }
  }

  app.get("/v1/agent-executions", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    const { userId } = assertUserContext(request);
    return {
      executions: await listOwnedAgentExecutions(userId),
    };
  });

  app.get<{ Querystring: z.infer<typeof listExecutionLaunchPresetsQuerySchema> }>(
    "/v1/agent-executions/presets",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        presets: await listOwnedAgentExecutionLaunchPresets(
          userId,
          listExecutionLaunchPresetsQuerySchema.parse(request.query),
        ),
      };
    },
  );

  app.get("/v1/agent-executions/runtime-catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    assertUserContext(request);
    return {
      catalog: await getAgentExecutionRuntimeCatalog(),
    };
  });

  app.get("/v1/internal/agent-executions/runtime-catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    const { userId } = assertUserContext(request);
    assertPlatformOperator(userId);
    return {
      catalog: await getAgentExecutionRuntimeCatalog(),
    };
  });

  app.get<{ Querystring: z.infer<typeof runtimePressureAlertQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-alerts/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getRuntimePressureAlertSummaryForOperator(runtimePressureAlertQuerySchema.parse(request.query)),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listCallbackAuditQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listCallbackAuditQuerySchema.parse(request.query);
      return {
        callbacks: await listCallbackAuditsForOperator(query),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listCallbackAuditQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listCallbackAuditQuerySchema.parse(request.query);
      return {
        summary: await getCallbackAuditSummaryForOperator(query),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof callbackRemediationSummaryQuerySchema> }>(
    "/v1/internal/agent-executions/callback-audits/remediation-summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getCallbackRemediationSummaryForOperator(
          callbackRemediationSummaryQuerySchema.parse(request.query),
        ),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listExecutionRunQuerySchema> }>(
    "/v1/internal/agent-executions/runs",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listExecutionRunQuerySchema.parse(request.query);
      const executionIds = parseDelimitedIdList(query.executionIds);
      const runIds = parseDelimitedIdList(query.runIds);
      return {
        runs: await listExecutionRunsForOperator({
          ...query,
          executionIds,
          runIds,
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listExecutionRunQuerySchema> }>(
    "/v1/internal/agent-executions/runs/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listExecutionRunQuerySchema.parse(request.query);
      const executionIds = parseDelimitedIdList(query.executionIds);
      const runIds = parseDelimitedIdList(query.runIds);
      return {
        summary: await getExecutionRunSummaryForOperator({
          ...query,
          executionIds,
          runIds,
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listRuntimeSessionsQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-sessions/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listRuntimeSessionsQuerySchema.parse(request.query);
      return {
        summary: await getRuntimeSessionSummaryForOperator({
          agentId: query.agentId,
          ownerUserId: query.ownerUserId,
          state: query.state,
          kind: query.kind,
          staleOnly: query.staleOnly === "true",
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listRuntimeSessionsQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-sessions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listRuntimeSessionsQuerySchema.parse(request.query);
      return {
        sessions: await listRuntimeSessionsForOperator({
          agentId: query.agentId,
          ownerUserId: query.ownerUserId,
          state: query.state,
          kind: query.kind,
          staleOnly: query.staleOnly === "true",
          limit: query.limit,
        }),
      };
    },
  );

  app.post<{ Params: { auditId: string }; Body: z.infer<typeof requestCallbackRetrySchema> }>(
    "/v1/internal/agent-executions/callback-audits/:auditId/request-retry",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = requestCallbackRetrySchema.parse(request.body ?? {});
      return {
        result: await requestRejectedCallbackRetryByOperator(userId, request.params.auditId, body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof requestCallbackRetryBatchSchema> }>(
    "/v1/internal/agent-executions/callback-audits/request-retry-batch",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = requestCallbackRetryBatchSchema.parse(request.body ?? {});
      return {
        result: await requestRejectedCallbackRetriesByOperator(userId, body),
      };
    },
  );

  app.post<{ Params: { auditId: string }; Body: z.infer<typeof replayCallbackPayloadSchema> }>(
    "/v1/internal/agent-executions/callback-audits/:auditId/replay-payload",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const body = replayCallbackPayloadSchema.parse(request.body ?? {});
      return {
        result: await replayRejectedCallbackPayloadByOperator(userId, request.params.auditId, body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof autoRemediateCallbackPayloadSchema> }>(
    "/v1/internal/agent-executions/callback-audits/auto-remediate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = autoRemediateCallbackPayloadSchema.parse(request.body ?? {});
      return {
        result: await autoRemediateRejectedCallbackPayloads({
          ...body,
          actorUserId: typeof headerUserId === "string" && headerUserId.length > 0 ? headerUserId : null,
          actorLabel:
            typeof headerUserId === "string" && headerUserId.length > 0
              ? "Operator auto remediation"
              : "Automatic remediation",
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof emitCallbackRemediationAlertsSchema> }>(
    "/v1/internal/agent-executions/callback-audits/emit-alerts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = emitCallbackRemediationAlertsSchema.parse(request.body ?? {});
      return {
        result: await emitCallbackRemediationAlerts(body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof emitRuntimePressureAlertsSchema> }>(
    "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = emitRuntimePressureAlertsSchema.parse(request.body ?? {});
      return {
        result: await emitRuntimePressureAlerts(body),
      };
    },
  );

  app.post<{ Body: z.infer<typeof dispatchPendingExecutionsSchema> }>(
    "/v1/internal/agent-executions/dispatch-pending",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      return {
        result: await runPendingDispatchableAgentExecutions(dispatchPendingExecutionsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof runPlatformExecutorSchema> }>(
    "/v1/internal/agent-executions/run-platform-executor",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const query = runPlatformExecutorSchema.parse(request.body ?? {});
      return runPlatformExecutor(query);
    },
  );

  app.post<{ Body: z.infer<typeof recoverPlatformExecutorSchema> }>(
    "/v1/internal/agent-executions/recover-stale",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const query = recoverPlatformExecutorSchema.parse(request.body ?? {});
      return recoverStalePlatformExecutions(query);
    },
  );

  app.post<{ Body: z.infer<typeof runtimeSessionSweepSchema> }>(
    "/v1/internal/agent-executions/runtime-sessions/sweep",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = runtimeSessionSweepSchema.parse(request.body ?? {});
      return sweepRuntimeSessions(body);
    },
  );

  app.post<{ Body: z.infer<typeof createExecutionSchema> }>(
    "/v1/agent-executions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await createOwnedAgentExecution(userId, createExecutionSchema.parse(request.body)),
      };
      },
    );

  app.post<{ Body: z.infer<typeof saveExecutionLaunchPresetSchema> }>(
    "/v1/agent-executions/presets",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        preset: await createOwnedAgentExecutionLaunchPreset(userId, saveExecutionLaunchPresetSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Params: { presetId: string }; Body: z.infer<typeof saveExecutionLaunchPresetSchema> }>(
    "/v1/agent-executions/presets/:presetId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        preset: await updateOwnedAgentExecutionLaunchPreset(
          userId,
          request.params.presetId,
          saveExecutionLaunchPresetSchema.parse(request.body),
        ),
      };
      },
    );

  app.post<{ Params: { presetId: string } }>(
    "/v1/agent-executions/presets/:presetId/default",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        preset: await setOwnedAgentExecutionLaunchDefaultPreset(userId, request.params.presetId),
      };
    },
  );

  app.post<{ Params: { presetId: string } }>(
    "/v1/agent-executions/presets/:presetId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      await deleteOwnedAgentExecutionLaunchPreset(userId, request.params.presetId);
      return { ok: true as const };
    },
  );

  app.post<{ Body: z.infer<typeof settlementRunSchema> }>(
    "/v1/internal/agent-executions/settlements/run",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        const { userId } = assertUserContext(request);
        assertPlatformOperator(userId);
      }
      return {
        result: await runPendingAgentExecutionSettlements(settlementRunSchema.parse(request.body ?? {})),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listSettlementAttemptsQuerySchema> }>(
    "/v1/internal/agent-executions/settlements",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        settlements: await listAgentExecutionSettlementAttempts(listSettlementAttemptsQuerySchema.parse(request.query)),
      };
    },
  );

  app.get(
    "/v1/internal/agent-executions/settlements/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getAgentExecutionSettlementSummary(),
      };
    },
  );

  app.post<{ Params: { executionId: string } }>(
    "/v1/internal/agent-executions/settlements/:executionId/retry",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        execution: await retryAgentExecutionSettlement(request.params.executionId),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof createSubtaskSchema> }>(
    "/v1/agent-executions/:executionId/subtasks",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await createOwnedAgentExecutionSubtask(
          userId,
          request.params.executionId,
          createSubtaskSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string; subtaskId: string }; Body: z.infer<typeof updateSubtaskStatusSchema> }>(
    "/v1/agent-executions/:executionId/subtasks/:subtaskId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionSubtaskStatus(
          userId,
          request.params.executionId,
          request.params.subtaskId,
          updateSubtaskStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateStatusSchema> }>(
    "/v1/agent-executions/:executionId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionStatus(
          userId,
          request.params.executionId,
          updateStatusSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateExecutionCallbackRemediationPolicySchema> }>(
    "/v1/agent-executions/:executionId/callback-remediation-policy",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await updateOwnedAgentExecutionCallbackRemediationPolicy(
          userId,
          request.params.executionId,
          updateExecutionCallbackRemediationPolicySchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof addArtifactSchema> }>(
    "/v1/agent-executions/:executionId/artifacts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await addOwnedAgentExecutionArtifact(
          userId,
          request.params.executionId,
          addArtifactSchema.parse(request.body),
        ),
      };
    },
  );

  app.post<{ Params: { executionId: string } }>(
    "/v1/agent-executions/:executionId/requeue",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        execution: await requeueOwnedAgentExecution(userId, request.params.executionId),
      };
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof updateStatusSchema> }>(
    "/external/agent-executions/:executionId/status",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = updateStatusSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await updateExternalAgentExecutionStatus(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "status",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "status",
            status: payload.status,
            statusNote: payload.statusNote,
            resultSummary: payload.resultSummary,
          }),
          reason: error instanceof Error ? error.message : "status callback rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof heartbeatSchema> }>(
    "/external/agent-executions/:executionId/heartbeat",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = heartbeatSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await recordExternalAgentExecutionHeartbeat(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload.statusNote,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "heartbeat",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "heartbeat",
            statusNote: payload.statusNote,
          }),
          reason: error instanceof Error ? error.message : "heartbeat rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof addArtifactSchema> }>(
    "/external/agent-executions/:executionId/artifacts",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = addArtifactSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await addExternalAgentExecutionArtifact(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: "artifact",
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope({
            type: "artifact",
            artifact: payload,
          }),
          reason: error instanceof Error ? error.message : "artifact callback rejected",
        });
        throw error;
      }
    },
  );

  app.post<{ Params: { executionId: string }; Body: z.infer<typeof externalCallbackSchema> }>(
    "/external/agent-executions/:executionId/callback",
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const payload = externalCallbackSchema.parse(request.body);
      try {
        const callbackSecret = getExternalCallbackSecret(request);
        const callbackId = getExternalCallbackId(request);
        const callbackVersion = getExternalCallbackVersion(request);
        const callbackTimestamp = new Date(getExternalCallbackTimestamp(request) * 1000);
        assertExternalCallbackSignature({
          request,
          executionId: request.params.executionId,
          payload,
          callbackSecret,
          callbackId,
        });
        return {
          execution: await handleExternalAgentCallback(
            request.params.executionId,
            callbackSecret,
            callbackId,
            callbackVersion,
            callbackTimestamp,
            payload,
          ),
        };
      } catch (error) {
        await auditRejectedExternalCallback({
          request,
          executionId: request.params.executionId,
          callbackType: payload.type === "status" ? "status" : payload.type === "artifact" ? "artifact" : payload.type,
          payload,
          replayPayload: buildStoredExternalCallbackReplayEnvelope(payload),
          reason: error instanceof Error ? error.message : "callback rejected",
        });
        throw error;
      }
    },
  );
};
