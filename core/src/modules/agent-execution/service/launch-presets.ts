import type {
  AgentExecutionCallbackAuditStatus,
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackType,
  AgentExecutionCallbackRetryability,
  AgentExecutionLaunchPresetView,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionRecentWindowKey,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionStoredReplayPayloadCompatibility,
  AgentExecutionRuntimeSessionState,
  AgentExecutionRuntimeSessionKind,
  AgentExecutionRunFailureCategory,
  AgentExecutionLaunchPresetFocusSection,
  AgentExecutionRunKind,
  AgentExecutionRunStatus,
  AgentExecutionStatus,
  CreateAgentExecutionLaunchPresetInput,
  ListAgentExecutionLaunchPresetsInput,
  UpdateAgentExecutionLaunchPresetInput,
} from "@neuro/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  getAgentExecutionLaunchDefaultPreset,
  getOwnedAgentExecutionLaunchPreset,
  listAgentExecutionLaunchPresetsByOwner,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionLaunchDefaultPresets,
  agentExecutionLaunchPresets,
} from "@/modules/agent-execution/schema";
import { getOwnedAgent } from "@/modules/agent-registry/repository";
import {
  buildAgentCallbackRemediationPolicyView,
} from "@/modules/agent-registry/service";
import { agents } from "@/modules/agent-registry/schema";
import { ConflictError, NotFoundError } from "@/platform/errors";

import {
  resolveRuntimeProfile,
  toRuntimeProfileView,
} from "./pricing";
import { normalizeExecutionCallbackRemediationPolicyOverrideKey } from "./remediation";
import { now } from "./shared";

export type NormalizedAgentExecutionLaunchPresetInput = {
  name: string;
  description: string | null;
  isDefault: boolean | null;
  preferredAgentId: string | null;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey | null;
  titleTemplate: string | null;
  objectiveTemplate: string | null;
  launchGuidance: string | null;
  followUpExecutionStatus: AgentExecutionStatus | null;
  followUpRunKind: AgentExecutionRunKind | null;
  followUpRunStatus: AgentExecutionRunStatus | null;
  followUpFailureCategory: AgentExecutionRunFailureCategory | null;
  followUpRecentWindow: AgentExecutionRecentWindowKey | null;
  followUpCallbackStatus: AgentExecutionCallbackAuditStatus | null;
  followUpCallbackRetryability: AgentExecutionCallbackRetryability | null;
  followUpCallbackType: AgentExecutionCallbackType | null;
  followUpCallbackRejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  followUpReplayPayloadCompatibility: AgentExecutionStoredReplayPayloadCompatibility | null;
  followUpReplayPayloadReplayable: boolean | null;
  followUpDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  followUpReplayFailureClass: AgentExecutionCallbackReplayFailureClass | null;
  followUpRuntimeDecisionClass: AgentExecutionRuntimeDecisionClass | null;
  followUpRuntimeDecisionSeverity: AgentExecutionRuntimeDecisionSeverity | null;
  followUpPressureLevel: AgentExecutionRuntimePressureLevel | null;
  followUpSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
  followUpRuntimeSessionKind: AgentExecutionRuntimeSessionKind | null;
  followUpRuntimeSessionState: AgentExecutionRuntimeSessionState | null;
  focusSection: AgentExecutionLaunchPresetFocusSection | null;
};

export function normalizeAgentExecutionLaunchPresetTextTemplate(
  value: string | null | undefined,
  minimumLength: number,
  label: string,
) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length < minimumLength) {
    throw new ConflictError(`${label} must be at least ${minimumLength} characters`);
  }
  return normalized;
}

export function normalizeAgentExecutionLaunchPresetGuidance(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  if (normalized && normalized.length > 4000) {
    throw new ConflictError("Launch guidance must be at most 4000 characters");
  }
  return normalized;
}

export function normalizeAgentExecutionLaunchPresetFocusSection(
  value: AgentExecutionLaunchPresetFocusSection | null | undefined,
): AgentExecutionLaunchPresetFocusSection | null {
  return value === "active-preset" ||
    value === "launch-presets" ||
    value === "create-execution" ||
    value === "runtime-sessions" ||
    value === "cost-overview" ||
    value === "execution-list"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRunKind(
  value: AgentExecutionRunKind | null | undefined,
): AgentExecutionRunKind | null {
  return value === "platform_executor" ||
    value === "requeue" ||
    value === "recovery" ||
    value === "callback_retry_request" ||
    value === "callback_payload_replay" ||
    value === "callback_auto_remediation"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRunStatus(
  value: AgentExecutionRunStatus | null | undefined,
): AgentExecutionRunStatus | null {
  return value === "running" || value === "completed" || value === "failed" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetFailureCategory(
  value: AgentExecutionRunFailureCategory | null | undefined,
): AgentExecutionRunFailureCategory | null {
  return value === "stale_timeout" ||
    value === "executor_failure" ||
    value === "requeue_failure" ||
    value === "unknown_failure"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRecentWindow(
  value: AgentExecutionRecentWindowKey | null | undefined,
): AgentExecutionRecentWindowKey | null {
  return value === "15m" || value === "1h" || value === "24h" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetCallbackStatus(
  value: AgentExecutionCallbackAuditStatus | null | undefined,
): AgentExecutionCallbackAuditStatus | null {
  return value === "accepted" || value === "duplicate" || value === "rejected" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetCallbackRetryability(
  value: AgentExecutionCallbackRetryability | null | undefined,
): AgentExecutionCallbackRetryability | null {
  return value === "retryable" || value === "inspect" || value === "not_retryable" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetCallbackType(
  value: AgentExecutionCallbackType | null | undefined,
): AgentExecutionCallbackType | null {
  return value === "heartbeat" || value === "status" || value === "artifact" || value === "callback" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
  value: AgentExecutionCallbackRejectionCategory | null | undefined,
): AgentExecutionCallbackRejectionCategory | null {
  return value === "invalid_secret" ||
    value === "invalid_signature" ||
    value === "invalid_timestamp" ||
    value === "invalid_version" ||
    value === "invalid_payload" ||
    value === "processing_conflict" ||
    value === "unsupported_target" ||
    value === "unknown"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
  value: AgentExecutionStoredReplayPayloadCompatibility | null | undefined,
): AgentExecutionStoredReplayPayloadCompatibility | null {
  return value === "current" || value === "legacy_normalized" || value === "invalid" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetDecisionClass(
  value: AgentExecutionCallbackRemediationDecisionClass | null | undefined,
): AgentExecutionCallbackRemediationDecisionClass | null {
  return value === "replay_current_payload" ||
    value === "replay_legacy_payload" ||
    value === "retry_missing_payload" ||
    value === "retry_incompatible_payload" ||
    value === "retry_compatibility_policy" ||
    value === "retry_compat_window" ||
    value === "retry_policy_preferred" ||
    value === "skip_policy_disabled" ||
    value === "skip_missing_rejection_category" ||
    value === "skip_policy_budget_exhausted" ||
    value === "skip_missing_payload" ||
    value === "skip_incompatible_payload" ||
    value === "skip_compatibility_policy" ||
    value === "skip_compat_window" ||
    value === "skip_policy_not_covered" ||
    value === "skip_target_unavailable"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetReplayFailureClass(
  value: AgentExecutionCallbackReplayFailureClass | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  return value === "stored_payload_unavailable" ||
    value === "callback_secret_unavailable" ||
    value === "duplicate_replay_cooldown" ||
    value === "agent_disabled" ||
    value === "callback_not_retryable" ||
    value === "unsupported_target" ||
    value === "callback_protocol_mismatch"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
  value: AgentExecutionRuntimeDecisionClass | null | undefined,
): AgentExecutionRuntimeDecisionClass | null {
  return value === "prepare_continue" ||
    value === "prepare_near_limit_cap" ||
    value === "prepare_timeout_accelerated" ||
    value === "artifact_batch_continue" ||
    value === "artifact_batch_downshift_near_limit" ||
    value === "artifact_finalize_early_near_limit" ||
    value === "artifact_finalize_early_timeout" ||
    value === "artifact_finalize_early_headroom" ||
    value === "artifact_partial_finalize_blocked" ||
    value === "finalize_continue" ||
    value === "finalize_near_limit_cap" ||
    value === "finalize_timeout_accelerated" ||
    value === "finalize_completed"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
  value: AgentExecutionRuntimeDecisionSeverity | null | undefined,
): AgentExecutionRuntimeDecisionSeverity | null {
  return value === "info" || value === "warning" || value === "critical" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetPressureLevel(
  value: AgentExecutionRuntimePressureLevel | null | undefined,
): AgentExecutionRuntimePressureLevel | null {
  return value === "healthy" || value === "watch" || value === "critical" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
  value: AgentExecutionRuntimeSchedulingDecisionClass | null | undefined,
): AgentExecutionRuntimeSchedulingDecisionClass | null {
  return value === "within_capacity" ||
    value === "queue_backlog" ||
    value === "profile_saturated" ||
    value === "owner_hotspot" ||
    value === "profile_and_owner_saturated"
    ? value
    : null;
}

export function normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
  value: AgentExecutionRuntimeSessionKind | null | undefined,
): AgentExecutionRuntimeSessionKind | null {
  return value === "platform_executor" || value === "stale_recovery" || value === "owner_requeue" ? value : null;
}

export function normalizeAgentExecutionLaunchPresetRuntimeSessionState(
  value: AgentExecutionRuntimeSessionState | null | undefined,
): AgentExecutionRuntimeSessionState | null {
  return value === "running" || value === "completed" || value === "failed" || value === "requeued" ? value : null;
}

export async function normalizeAgentExecutionLaunchPresetInput(
  ownerUserId: string,
  input: CreateAgentExecutionLaunchPresetInput | UpdateAgentExecutionLaunchPresetInput,
): Promise<NormalizedAgentExecutionLaunchPresetInput> {
  const name = input.name.trim();
  if (!name) {
    throw new ConflictError("Execution launch preset name is required");
  }

  const preferredAgentId = input.preferredAgentId?.trim() || null;
  const callbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    input.callbackRemediationPolicyKey,
  );
  const runtimeProfileKey = resolveRuntimeProfile(
    (input.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline",
  ).key;
  const titleTemplate = normalizeAgentExecutionLaunchPresetTextTemplate(input.titleTemplate, 3, "Title template");
  const objectiveTemplate = normalizeAgentExecutionLaunchPresetTextTemplate(
    input.objectiveTemplate,
    10,
    "Objective template",
  );
  const launchGuidance = normalizeAgentExecutionLaunchPresetGuidance(input.launchGuidance);

  if (preferredAgentId) {
    const preferredAgent = await getOwnedAgent(ownerUserId, preferredAgentId);
    if (!preferredAgent) {
      throw new NotFoundError("Preferred agent not found");
    }
    if (preferredAgent.sourceType !== "external" && callbackRemediationPolicyKey) {
      throw new ConflictError("Preferred platform agent presets cannot pin callback remediation override");
    }
  }

  return {
    name,
    description: input.description?.trim() || null,
    isDefault: typeof input.isDefault === "boolean" ? input.isDefault : null,
    preferredAgentId,
    runtimeProfileKey,
    callbackRemediationPolicyKey,
    titleTemplate,
    objectiveTemplate,
    launchGuidance,
    followUpExecutionStatus: input.followUpExecutionStatus ?? null,
    followUpRunKind: normalizeAgentExecutionLaunchPresetRunKind(input.followUpRunKind),
    followUpRunStatus: normalizeAgentExecutionLaunchPresetRunStatus(input.followUpRunStatus),
    followUpFailureCategory: normalizeAgentExecutionLaunchPresetFailureCategory(input.followUpFailureCategory),
    followUpRecentWindow: normalizeAgentExecutionLaunchPresetRecentWindow(input.followUpRecentWindow),
    followUpCallbackStatus: normalizeAgentExecutionLaunchPresetCallbackStatus(input.followUpCallbackStatus),
    followUpCallbackRetryability: normalizeAgentExecutionLaunchPresetCallbackRetryability(
      input.followUpCallbackRetryability,
    ),
    followUpCallbackType: normalizeAgentExecutionLaunchPresetCallbackType(input.followUpCallbackType),
    followUpCallbackRejectionCategory: normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
      input.followUpCallbackRejectionCategory,
    ),
    followUpReplayPayloadCompatibility: normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
      input.followUpReplayPayloadCompatibility,
    ),
    followUpReplayPayloadReplayable: normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
      input.followUpReplayPayloadReplayable,
    ),
    followUpDecisionClass: normalizeAgentExecutionLaunchPresetDecisionClass(input.followUpDecisionClass),
    followUpReplayFailureClass: normalizeAgentExecutionLaunchPresetReplayFailureClass(
      input.followUpReplayFailureClass,
    ),
    followUpRuntimeDecisionClass: normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
      input.followUpRuntimeDecisionClass,
    ),
    followUpRuntimeDecisionSeverity: normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
      input.followUpRuntimeDecisionSeverity,
    ),
    followUpPressureLevel: normalizeAgentExecutionLaunchPresetPressureLevel(input.followUpPressureLevel),
    followUpSchedulingDecisionClass: normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
      input.followUpSchedulingDecisionClass,
    ),
    followUpRuntimeSessionKind: normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
      input.followUpRuntimeSessionKind,
    ),
    followUpRuntimeSessionState: normalizeAgentExecutionLaunchPresetRuntimeSessionState(
      input.followUpRuntimeSessionState,
    ),
    focusSection: normalizeAgentExecutionLaunchPresetFocusSection(input.focusSection),
  };
}

export function toAgentExecutionLaunchPresetView(args: {
  row: typeof agentExecutionLaunchPresets.$inferSelect;
  preferredAgentName: string | null;
  isDefault: boolean;
}): AgentExecutionLaunchPresetView {
  const runtimeProfileKey =
    (args.row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null | undefined) ?? "baseline";
  const runtimeProfile = toRuntimeProfileView({
    runtimeProfileKey,
    targetArtifactCount: env.agentExecutionRuntimeProfiles[runtimeProfileKey]?.targetArtifactCount ?? 1,
    maxAutoRecoveryCount: env.agentExecutionRuntimeProfiles[runtimeProfileKey]?.maxAutoRecoveryCount ?? 0,
  });
  const callbackRemediationPolicyKey = normalizeExecutionCallbackRemediationPolicyOverrideKey(
    args.row.callbackRemediationPolicyKey,
  );
  return {
    id: args.row.id,
    ownerUserId: args.row.ownerUserId,
    name: args.row.name,
    description: args.row.description ?? null,
    isDefault: args.isDefault,
    preferredAgentId: args.row.preferredAgentId ?? null,
    preferredAgentName: args.preferredAgentName,
    runtimeProfileKey: runtimeProfile.key,
    runtimeProfile,
    callbackRemediationPolicyKey,
    callbackRemediationPolicy: callbackRemediationPolicyKey
      ? buildAgentCallbackRemediationPolicyView(callbackRemediationPolicyKey)
      : null,
    titleTemplate: args.row.titleTemplate ?? null,
    objectiveTemplate: args.row.objectiveTemplate ?? null,
    launchGuidance: args.row.launchGuidance ?? null,
    followUpExecutionStatus: (args.row.followUpExecutionStatus as AgentExecutionStatus | null) ?? null,
    followUpRunKind: normalizeAgentExecutionLaunchPresetRunKind(
      args.row.followUpRunKind as AgentExecutionRunKind | null | undefined,
    ),
    followUpRunStatus: normalizeAgentExecutionLaunchPresetRunStatus(
      args.row.followUpRunStatus as AgentExecutionRunStatus | null | undefined,
    ),
    followUpFailureCategory: normalizeAgentExecutionLaunchPresetFailureCategory(
      args.row.followUpFailureCategory as AgentExecutionRunFailureCategory | null | undefined,
    ),
    followUpRecentWindow: normalizeAgentExecutionLaunchPresetRecentWindow(
      args.row.followUpRecentWindow as AgentExecutionRecentWindowKey | null | undefined,
    ),
    followUpCallbackStatus: normalizeAgentExecutionLaunchPresetCallbackStatus(
      args.row.followUpCallbackStatus as AgentExecutionCallbackAuditStatus | null | undefined,
    ),
    followUpCallbackRetryability: normalizeAgentExecutionLaunchPresetCallbackRetryability(
      args.row.followUpCallbackRetryability as AgentExecutionCallbackRetryability | null | undefined,
    ),
    followUpCallbackType: normalizeAgentExecutionLaunchPresetCallbackType(
      args.row.followUpCallbackType as AgentExecutionCallbackType | null | undefined,
    ),
    followUpCallbackRejectionCategory: normalizeAgentExecutionLaunchPresetCallbackRejectionCategory(
      args.row.followUpCallbackRejectionCategory as AgentExecutionCallbackRejectionCategory | null | undefined,
    ),
    followUpReplayPayloadCompatibility: normalizeAgentExecutionLaunchPresetReplayPayloadCompatibility(
      args.row.followUpReplayPayloadCompatibility as AgentExecutionStoredReplayPayloadCompatibility | null | undefined,
    ),
    followUpReplayPayloadReplayable: normalizeAgentExecutionLaunchPresetReplayPayloadReplayable(
      args.row.followUpReplayPayloadReplayable,
    ),
    followUpDecisionClass: normalizeAgentExecutionLaunchPresetDecisionClass(
      args.row.followUpDecisionClass as AgentExecutionCallbackRemediationDecisionClass | null | undefined,
    ),
    followUpReplayFailureClass: normalizeAgentExecutionLaunchPresetReplayFailureClass(
      args.row.followUpReplayFailureClass as AgentExecutionCallbackReplayFailureClass | null | undefined,
    ),
    followUpRuntimeDecisionClass: normalizeAgentExecutionLaunchPresetRuntimeDecisionClass(
      args.row.followUpRuntimeDecisionClass as AgentExecutionRuntimeDecisionClass | null | undefined,
    ),
    followUpRuntimeDecisionSeverity: normalizeAgentExecutionLaunchPresetRuntimeDecisionSeverity(
      args.row.followUpRuntimeDecisionSeverity as AgentExecutionRuntimeDecisionSeverity | null | undefined,
    ),
    followUpPressureLevel: normalizeAgentExecutionLaunchPresetPressureLevel(
      args.row.followUpPressureLevel as AgentExecutionRuntimePressureLevel | null | undefined,
    ),
    followUpSchedulingDecisionClass: normalizeAgentExecutionLaunchPresetSchedulingDecisionClass(
      args.row.followUpSchedulingDecisionClass as AgentExecutionRuntimeSchedulingDecisionClass | null | undefined,
    ),
    followUpRuntimeSessionKind: normalizeAgentExecutionLaunchPresetRuntimeSessionKind(
      args.row.followUpRuntimeSessionKind as AgentExecutionRuntimeSessionKind | null | undefined,
    ),
    followUpRuntimeSessionState: normalizeAgentExecutionLaunchPresetRuntimeSessionState(
      args.row.followUpRuntimeSessionState as AgentExecutionRuntimeSessionState | null | undefined,
    ),
    focusSection: normalizeAgentExecutionLaunchPresetFocusSection(
      args.row.focusSection as AgentExecutionLaunchPresetFocusSection | null | undefined,
    ),
    createdAt: args.row.createdAt.toISOString(),
    updatedAt: args.row.updatedAt.toISOString(),
  };
}

export async function buildAgentExecutionLaunchPresetViews(
  ownerUserId: string,
  rows: Array<typeof agentExecutionLaunchPresets.$inferSelect>,
): Promise<AgentExecutionLaunchPresetView[]> {
  if (rows.length === 0) {
    return [];
  }

  const defaultPresetRow = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  const defaultPresetId = defaultPresetRow?.presetId ?? null;
  const preferredAgentIds = Array.from(
    new Set(
      rows
        .map((row) => row.preferredAgentId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const preferredAgentNameMap =
    preferredAgentIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await db
              .select({
                id: agents.id,
                name: agents.name,
              })
              .from(agents)
              .where(and(eq(agents.ownerUserId, ownerUserId), inArray(agents.id, preferredAgentIds)))
          ).map((row) => [row.id, row.name]),
        );

  return rows.map((row) =>
    toAgentExecutionLaunchPresetView({
      row,
      preferredAgentName:
        row.preferredAgentId && preferredAgentNameMap.has(row.preferredAgentId)
          ? preferredAgentNameMap.get(row.preferredAgentId) ?? null
          : null,
      isDefault: defaultPresetId === row.id,
    }),
  );
}

export async function getOwnedAgentExecutionLaunchPresetView(ownerUserId: string, presetId: string) {
  const row = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!row) {
    throw new NotFoundError("Execution launch preset not found");
  }
  const [view] = await buildAgentExecutionLaunchPresetViews(ownerUserId, [row]);
  if (!view) {
    throw new NotFoundError("Execution launch preset not found");
  }
  return view;
}

export async function setOwnedAgentExecutionLaunchDefaultPresetInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
  presetId: string,
) {
  const timestamp = now();
  await tx.delete(agentExecutionLaunchDefaultPresets).where(eq(agentExecutionLaunchDefaultPresets.ownerUserId, ownerUserId));
  await tx.insert(agentExecutionLaunchDefaultPresets).values({
    ownerUserId,
    presetId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function clearOwnedAgentExecutionLaunchDefaultPresetInTx(
  tx: NodePgDatabase<typeof schema>,
  ownerUserId: string,
) {
  await tx.delete(agentExecutionLaunchDefaultPresets).where(eq(agentExecutionLaunchDefaultPresets.ownerUserId, ownerUserId));
}

export async function setOwnedAgentExecutionLaunchDefaultPreset(
  ownerUserId: string,
  presetId: string,
): Promise<AgentExecutionLaunchPresetView> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  await db.transaction(async (tx) => {
    await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, existing.id);
  });
  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, existing.id);
}

export async function listOwnedAgentExecutionLaunchPresets(
  ownerUserId: string,
  input?: ListAgentExecutionLaunchPresetsInput | null,
): Promise<AgentExecutionLaunchPresetView[]> {
  const rows = await listAgentExecutionLaunchPresetsByOwner(ownerUserId);
  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.floor(input.limit))
      : rows.length;
  return buildAgentExecutionLaunchPresetViews(ownerUserId, rows.slice(0, limit));
}

export async function createOwnedAgentExecutionLaunchPreset(
  ownerUserId: string,
  input: CreateAgentExecutionLaunchPresetInput,
): Promise<AgentExecutionLaunchPresetView> {
  const normalized = await normalizeAgentExecutionLaunchPresetInput(ownerUserId, input);
  const existingDefault = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  const created = await db.transaction(async (tx) => {
    const timestamp = now();
    const [row] = await tx
      .insert(agentExecutionLaunchPresets)
      .values({
        id: crypto.randomUUID(),
        ownerUserId,
        name: normalized.name,
        description: normalized.description,
        preferredAgentId: normalized.preferredAgentId,
        runtimeProfileKey: normalized.runtimeProfileKey,
        callbackRemediationPolicyKey: normalized.callbackRemediationPolicyKey,
        titleTemplate: normalized.titleTemplate,
        objectiveTemplate: normalized.objectiveTemplate,
        launchGuidance: normalized.launchGuidance,
        followUpExecutionStatus: normalized.followUpExecutionStatus,
        followUpRunKind: normalized.followUpRunKind,
        followUpRunStatus: normalized.followUpRunStatus,
        followUpFailureCategory: normalized.followUpFailureCategory,
        followUpRecentWindow: normalized.followUpRecentWindow,
        followUpCallbackStatus: normalized.followUpCallbackStatus,
        followUpCallbackRetryability: normalized.followUpCallbackRetryability,
        followUpCallbackType: normalized.followUpCallbackType,
        followUpCallbackRejectionCategory: normalized.followUpCallbackRejectionCategory,
        followUpReplayPayloadCompatibility: normalized.followUpReplayPayloadCompatibility,
        followUpReplayPayloadReplayable: normalized.followUpReplayPayloadReplayable,
        followUpDecisionClass: normalized.followUpDecisionClass,
        followUpReplayFailureClass: normalized.followUpReplayFailureClass,
        followUpRuntimeDecisionClass: normalized.followUpRuntimeDecisionClass,
        followUpRuntimeDecisionSeverity: normalized.followUpRuntimeDecisionSeverity,
        followUpPressureLevel: normalized.followUpPressureLevel,
        followUpSchedulingDecisionClass: normalized.followUpSchedulingDecisionClass,
        followUpRuntimeSessionKind: normalized.followUpRuntimeSessionKind,
        followUpRuntimeSessionState: normalized.followUpRuntimeSessionState,
        focusSection: normalized.focusSection,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new ConflictError("Execution launch preset could not be created");
    }

    if (normalized.isDefault === true || !existingDefault) {
      await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, row.id);
    }
    return row;
  });

  if (!created) {
    throw new ConflictError("Execution launch preset could not be created");
  }
  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, created.id);
}

export async function updateOwnedAgentExecutionLaunchPreset(
  ownerUserId: string,
  presetId: string,
  input: UpdateAgentExecutionLaunchPresetInput,
): Promise<AgentExecutionLaunchPresetView> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  const normalized = await normalizeAgentExecutionLaunchPresetInput(ownerUserId, input);
  const defaultPreset = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  await db.transaction(async (tx) => {
    await tx
      .update(agentExecutionLaunchPresets)
      .set({
        name: normalized.name,
        description: normalized.description,
        preferredAgentId: normalized.preferredAgentId,
        runtimeProfileKey: normalized.runtimeProfileKey,
        callbackRemediationPolicyKey: normalized.callbackRemediationPolicyKey,
        titleTemplate: normalized.titleTemplate,
        objectiveTemplate: normalized.objectiveTemplate,
        launchGuidance: normalized.launchGuidance,
        followUpExecutionStatus: normalized.followUpExecutionStatus,
        followUpRunKind: normalized.followUpRunKind,
        followUpRunStatus: normalized.followUpRunStatus,
        followUpFailureCategory: normalized.followUpFailureCategory,
        followUpRecentWindow: normalized.followUpRecentWindow,
        followUpCallbackStatus: normalized.followUpCallbackStatus,
        followUpCallbackRetryability: normalized.followUpCallbackRetryability,
        followUpCallbackType: normalized.followUpCallbackType,
        followUpCallbackRejectionCategory: normalized.followUpCallbackRejectionCategory,
        followUpReplayPayloadCompatibility: normalized.followUpReplayPayloadCompatibility,
        followUpReplayPayloadReplayable: normalized.followUpReplayPayloadReplayable,
        followUpDecisionClass: normalized.followUpDecisionClass,
        followUpReplayFailureClass: normalized.followUpReplayFailureClass,
        followUpRuntimeDecisionClass: normalized.followUpRuntimeDecisionClass,
        followUpRuntimeDecisionSeverity: normalized.followUpRuntimeDecisionSeverity,
        followUpPressureLevel: normalized.followUpPressureLevel,
        followUpSchedulingDecisionClass: normalized.followUpSchedulingDecisionClass,
        followUpRuntimeSessionKind: normalized.followUpRuntimeSessionKind,
        followUpRuntimeSessionState: normalized.followUpRuntimeSessionState,
        focusSection: normalized.focusSection,
        updatedAt: now(),
      })
      .where(eq(agentExecutionLaunchPresets.id, existing.id));

    if (normalized.isDefault === true) {
      await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, existing.id);
    } else if (normalized.isDefault === false && defaultPreset?.presetId === existing.id) {
      await clearOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId);
    }
  });

  return getOwnedAgentExecutionLaunchPresetView(ownerUserId, existing.id);
}

export async function deleteOwnedAgentExecutionLaunchPreset(ownerUserId: string, presetId: string): Promise<void> {
  const existing = await getOwnedAgentExecutionLaunchPreset(ownerUserId, presetId);
  if (!existing) {
    throw new NotFoundError("Execution launch preset not found");
  }

  const defaultPreset = await getAgentExecutionLaunchDefaultPreset(ownerUserId);
  await db.transaction(async (tx) => {
    await tx.delete(agentExecutionLaunchPresets).where(eq(agentExecutionLaunchPresets.id, existing.id));

    if (defaultPreset?.presetId === existing.id) {
      const [fallbackPreset] = await tx
        .select({ id: agentExecutionLaunchPresets.id })
        .from(agentExecutionLaunchPresets)
        .where(eq(agentExecutionLaunchPresets.ownerUserId, ownerUserId))
        .orderBy(desc(agentExecutionLaunchPresets.updatedAt), desc(agentExecutionLaunchPresets.createdAt));
      if (fallbackPreset) {
        await setOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId, fallbackPreset.id);
      } else {
        await clearOwnedAgentExecutionLaunchDefaultPresetInTx(tx, ownerUserId);
      }
    }
  });
}
