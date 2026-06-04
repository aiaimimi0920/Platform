import type {
  AgentExecutionOwnerReliefHandoffDefaultView,
  AgentExecutionOwnerReliefHandoffFocusSection,
  AgentExecutionOwnerReliefHandoffFollowUpProfile,
  AgentExecutionOwnerReliefRunHandoffStatus,
  AgentExecutionOwnerReliefRunHandoffView,
  AgentExecutionOwnerReliefRunHandoffTargetType,
  AgentExecutionOwnerReliefRunActionKind,
  AgentExecutionOwnerReliefRunActionStatus,
  AgentExecutionOwnerReliefRunActionView,
  AgentExecutionOwnerReliefRunResultStatus,
  AgentExecutionOwnerReliefRunSummary,
  AgentExecutionOwnerReliefRunView,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeSchedulingDecisionClass,
  FinalizeAgentExecutionOwnerReliefRunInput,
  ListAgentExecutionOwnerReliefRunsInput,
  OpenAgentExecutionOwnerReliefRunHandoffInput,
  RecordAgentExecutionOwnerReliefRunActionInput,
  ResolveAgentExecutionOwnerReliefRunHandoffInput,
  StartAgentExecutionOwnerReliefRunInput,
  UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
} from "@neuro/contracts";
import {
  agentExecutionOwnerReliefHandoffFocusSections,
  agentExecutionOwnerReliefHandoffFollowUpProfiles,
  agentExecutionRuntimePressureLevels,
  agentExecutionRuntimeSchedulingDecisionClasses,
  agentExecutionOwnerReliefRunActionKinds,
  agentExecutionOwnerReliefRunResultStatuses,
} from "@neuro/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { authIdentities } from "@/modules/identity/schema";
import {
  agentExecutionOwnerReliefHandoffDefaults,
  agentExecutionOwnerReliefRunHandoffs,
  agentExecutionOwnerReliefRunActions,
  agentExecutionOwnerReliefRuns,
} from "@/modules/agent-execution/schema";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";

function now() {
  return new Date();
}

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function normalizeText(value: string | null | undefined, maxLength = 400) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

function normalizeIdList(ids: string[] | null | undefined, limit = 20) {
  return Array.from(new Set((ids ?? []).map((id) => id.trim()).filter((id) => id.length > 0))).slice(0, limit);
}

function buildZeroOwnerReliefRunSummary(): AgentExecutionOwnerReliefRunSummary {
  return {
    sweepClosedCount: 0,
    sweepSkippedCount: 0,
    recoveredCount: 0,
    exhaustedCount: 0,
    processedCount: 0,
    failedCount: 0,
    recoveryExecutionIds: [],
    recoveryRunIds: [],
    executorExecutionIds: [],
    executorRunIds: [],
  };
}

function normalizeOwnerReliefRunSummary(
  input?: Partial<AgentExecutionOwnerReliefRunSummary> | null,
): AgentExecutionOwnerReliefRunSummary {
  return {
    sweepClosedCount: Math.max(0, Math.floor(input?.sweepClosedCount ?? 0)),
    sweepSkippedCount: Math.max(0, Math.floor(input?.sweepSkippedCount ?? 0)),
    recoveredCount: Math.max(0, Math.floor(input?.recoveredCount ?? 0)),
    exhaustedCount: Math.max(0, Math.floor(input?.exhaustedCount ?? 0)),
    processedCount: Math.max(0, Math.floor(input?.processedCount ?? 0)),
    failedCount: Math.max(0, Math.floor(input?.failedCount ?? 0)),
    recoveryExecutionIds: normalizeIdList(input?.recoveryExecutionIds),
    recoveryRunIds: normalizeIdList(input?.recoveryRunIds),
    executorExecutionIds: normalizeIdList(input?.executorExecutionIds),
    executorRunIds: normalizeIdList(input?.executorRunIds),
  };
}

function normalizeOwnerReliefRunActionKind(
  value: unknown,
): AgentExecutionOwnerReliefRunActionKind | null {
  return agentExecutionOwnerReliefRunActionKinds.includes(value as AgentExecutionOwnerReliefRunActionKind)
    ? (value as AgentExecutionOwnerReliefRunActionKind)
    : null;
}

function normalizeOwnerReliefRunActionStatus(
  value: unknown,
): AgentExecutionOwnerReliefRunActionStatus | null {
  return value === "success" || value === "error" ? value : null;
}

function normalizeOwnerReliefRunResultStatus(
  value: unknown,
): AgentExecutionOwnerReliefRunResultStatus | null {
  return agentExecutionOwnerReliefRunResultStatuses.includes(value as AgentExecutionOwnerReliefRunResultStatus)
    ? (value as AgentExecutionOwnerReliefRunResultStatus)
    : null;
}

function normalizeOwnerReliefTriggerAction(
  value: unknown,
): Exclude<
  AgentExecutionOwnerReliefRunActionKind,
  "open_session" | "open_handoff" | "resolve_handoff" | "reopen_session" | "finalize_closeout"
> | null {
  if (value === "sweep" || value === "recover" || value === "run" || value === "recover_then_run") {
    return value;
  }
  return null;
}

function normalizeOwnerReliefRunHandoffTargetType(
  value: unknown,
): AgentExecutionOwnerReliefRunHandoffTargetType | null {
  if (
    value === "runtime_pressure" ||
    value === "execution_run_watch" ||
    value === "runtime_session_watch" ||
    value === "callback_audits" ||
    value === "external_note"
  ) {
    return value as AgentExecutionOwnerReliefRunHandoffTargetType;
  }
  return null;
}

function normalizeOwnerReliefRunTarget(value: string | null | undefined, maxLength = 160) {
  return normalizeText(value, maxLength);
}

function normalizeOwnerReliefRunHandoffStatus(
  value: unknown,
): AgentExecutionOwnerReliefRunHandoffStatus | null {
  if (value === "pending" || value === "opened" || value === "resolved" || value === "reopened") {
    return value as AgentExecutionOwnerReliefRunHandoffStatus;
  }
  return null;
}

function normalizeOwnerReliefHandoffFocusSection(
  value: unknown,
): AgentExecutionOwnerReliefHandoffFocusSection | null {
  return agentExecutionOwnerReliefHandoffFocusSections.includes(
    value as AgentExecutionOwnerReliefHandoffFocusSection,
  )
    ? (value as AgentExecutionOwnerReliefHandoffFocusSection)
    : null;
}

function normalizeOwnerReliefHandoffFollowUpProfile(
  value: unknown,
): AgentExecutionOwnerReliefHandoffFollowUpProfile | null {
  return agentExecutionOwnerReliefHandoffFollowUpProfiles.includes(
    value as AgentExecutionOwnerReliefHandoffFollowUpProfile,
  )
    ? (value as AgentExecutionOwnerReliefHandoffFollowUpProfile)
    : null;
}

function isOwnerReliefHandoffFocusSectionAllowedForTargetType(
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType,
  followUpFocusSection: AgentExecutionOwnerReliefHandoffFocusSection | null,
) {
  if (!followUpFocusSection) {
    return true;
  }
  return handoffTargetType !== "external_note";
}

function normalizeRuntimePressureLevel(
  value: unknown,
): AgentExecutionRuntimePressureLevel | null {
  if (agentExecutionRuntimePressureLevels.includes(value as AgentExecutionRuntimePressureLevel)) {
    return value as AgentExecutionRuntimePressureLevel;
  }
  return null;
}

function normalizeRuntimeSchedulingDecisionClass(
  value: unknown,
): AgentExecutionRuntimeSchedulingDecisionClass | null {
  if (
    agentExecutionRuntimeSchedulingDecisionClasses.includes(
      value as AgentExecutionRuntimeSchedulingDecisionClass,
    )
  ) {
    return value as AgentExecutionRuntimeSchedulingDecisionClass;
  }
  return null;
}

function toOwnerReliefRunView(
  row: typeof agentExecutionOwnerReliefRuns.$inferSelect,
): AgentExecutionOwnerReliefRunView {
  return {
    id: row.id,
    operatorUserId: row.operatorUserId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId ?? null,
    triggerAction: normalizeOwnerReliefTriggerAction(row.triggerAction) ?? null,
    source: row.source ?? null,
    runtimePressureLevel: normalizeRuntimePressureLevel(row.runtimePressureLevel),
    runtimeSchedulingDecisionClass: normalizeRuntimeSchedulingDecisionClass(row.runtimeSchedulingDecisionClass),
    actionCount: row.actionCount,
    openingSummary: normalizeOwnerReliefRunSummary(row.openingSummary),
    latestSummary: normalizeOwnerReliefRunSummary(row.latestSummary),
    resultStatus: normalizeOwnerReliefRunResultStatus(row.resultStatus) ?? "active",
    resultNote: row.resultNote ?? null,
    handoffTargetType: normalizeOwnerReliefRunHandoffTargetType(row.handoffTargetType),
    handoffTarget: row.handoffTarget ?? null,
    reopenedFromRunId: row.reopenedFromRunId ?? null,
    supersededByRunId: row.supersededByRunId ?? null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    completedByUserId: row.completedByUserId ?? null,
    startedAt: row.startedAt.toISOString(),
    lastActionAt: row.lastActionAt ? row.lastActionAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    handoffSession: null,
  };
}

function toOwnerReliefRunActionView(
  row: typeof agentExecutionOwnerReliefRunActions.$inferSelect,
): AgentExecutionOwnerReliefRunActionView {
  return {
    id: row.id,
    runId: row.runId,
    operatorUserId: row.operatorUserId,
    actionKind: normalizeOwnerReliefRunActionKind(row.actionKind) ?? "open_session",
    status: normalizeOwnerReliefRunActionStatus(row.status) ?? "success",
    title: row.title,
    detail: row.detail ?? null,
    summary: normalizeOwnerReliefRunSummary(row.summary),
    createdAt: row.createdAt.toISOString(),
  };
}

function toOwnerReliefHandoffDefaultView(
  row: typeof agentExecutionOwnerReliefHandoffDefaults.$inferSelect,
): AgentExecutionOwnerReliefHandoffDefaultView {
  return {
    operatorUserId: row.operatorUserId,
    handoffTargetType: normalizeOwnerReliefRunHandoffTargetType(row.handoffTargetType) ?? "runtime_pressure",
    handoffTarget: row.handoffTarget,
    noteTemplate: row.noteTemplate ?? null,
    followUpFocusSection: normalizeOwnerReliefHandoffFocusSection(row.followUpFocusSection),
    followUpProfile: normalizeOwnerReliefHandoffFollowUpProfile(row.followUpProfile),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOwnerReliefRunHandoffView(
  row: typeof agentExecutionOwnerReliefRunHandoffs.$inferSelect,
): AgentExecutionOwnerReliefRunHandoffView {
  return {
    id: row.id,
    runId: row.runId,
    operatorUserId: row.operatorUserId,
    handoffTargetType: normalizeOwnerReliefRunHandoffTargetType(row.handoffTargetType) ?? "runtime_pressure",
    handoffTarget: row.handoffTarget,
    followUpFocusSection: normalizeOwnerReliefHandoffFocusSection(row.followUpFocusSection),
    followUpProfile: normalizeOwnerReliefHandoffFollowUpProfile(row.followUpProfile),
    status: normalizeOwnerReliefRunHandoffStatus(row.status) ?? "pending",
    latestFollowUpHref: row.latestFollowUpHref ?? null,
    openCount: row.openCount,
    firstOpenedAt: row.firstOpenedAt ? row.firstOpenedAt.toISOString() : null,
    lastOpenedAt: row.lastOpenedAt ? row.lastOpenedAt.toISOString() : null,
    resultNote: row.resultNote ?? null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    completedByUserId: row.completedByUserId ?? null,
    reopenedRunId: row.reopenedRunId ?? null,
    reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnerReliefRunById(runId: string) {
  const [run] = await db
    .select()
    .from(agentExecutionOwnerReliefRuns)
    .where(eq(agentExecutionOwnerReliefRuns.id, runId))
    .limit(1);
  return run ?? null;
}

async function getOwnerReliefRunHandoffByRunId(runId: string) {
  const [handoff] = await db
    .select()
    .from(agentExecutionOwnerReliefRunHandoffs)
    .where(eq(agentExecutionOwnerReliefRunHandoffs.runId, runId))
    .limit(1);
  return handoff ?? null;
}

async function listOwnerReliefRunHandoffsByRunIds(runIds: string[]) {
  if (runIds.length === 0) {
    return [];
  }
  return await db
    .select()
    .from(agentExecutionOwnerReliefRunHandoffs)
    .where(inArray(agentExecutionOwnerReliefRunHandoffs.runId, runIds));
}

async function ensureOwnerReliefRunHandoffRow(args: {
  run: typeof agentExecutionOwnerReliefRuns.$inferSelect;
  timestamp: Date;
}) {
  const handoffTargetType = normalizeOwnerReliefRunHandoffTargetType(args.run.handoffTargetType);
  const handoffTarget = normalizeOwnerReliefRunTarget(args.run.handoffTarget ?? null);
  const handoffDefault =
    handoffTargetType
      ? await getOwnerReliefHandoffDefaultByUserAndType(args.run.operatorUserId, handoffTargetType)
      : null;
  if (
    (normalizeOwnerReliefRunResultStatus(args.run.resultStatus) ?? "active") !== "handed_off" ||
    !handoffTargetType ||
    !handoffTarget
  ) {
    return null;
  }

  const existing = await getOwnerReliefRunHandoffByRunId(args.run.id);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(agentExecutionOwnerReliefRunHandoffs)
    .values({
      id: crypto.randomUUID(),
      runId: args.run.id,
      operatorUserId: args.run.operatorUserId,
      handoffTargetType,
      handoffTarget,
      followUpFocusSection: normalizeOwnerReliefHandoffFocusSection(handoffDefault?.followUpFocusSection),
      followUpProfile: normalizeOwnerReliefHandoffFollowUpProfile(handoffDefault?.followUpProfile),
      status: "pending",
      latestFollowUpHref: null,
      openCount: 0,
      firstOpenedAt: null,
      lastOpenedAt: null,
      resultNote: null,
      completedAt: null,
      completedByUserId: null,
      reopenedRunId: null,
      reopenedAt: null,
      createdAt: args.timestamp,
      updatedAt: args.timestamp,
    })
    .returning();

  return created ?? null;
}

async function getOwnerReliefHandoffDefaultByUserAndType(
  operatorUserId: string,
  handoffTargetType: AgentExecutionOwnerReliefRunHandoffTargetType,
) {
  const [profile] = await db
    .select()
    .from(agentExecutionOwnerReliefHandoffDefaults)
    .where(
      and(
        eq(agentExecutionOwnerReliefHandoffDefaults.operatorUserId, operatorUserId),
        eq(agentExecutionOwnerReliefHandoffDefaults.handoffTargetType, handoffTargetType),
      ),
    )
    .limit(1);
  return profile ?? null;
}

async function resolvePlatformOperatorIdentity(userId: string) {
  const operatorIds = getPlatformOperatorUserIdSet();
  if (operatorIds.has(userId)) {
    return;
  }

  const [identity] = await db
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId))
    .limit(1);

  if (identity?.providerUserId && operatorIds.has(identity.providerUserId)) {
    return;
  }

  throw new UnauthorizedError("Only platform operators can manage agent execution owner relief runs");
}

export async function startAgentExecutionOwnerReliefRunForOperator(
  operatorUserId: string,
  input: StartAgentExecutionOwnerReliefRunInput,
): Promise<AgentExecutionOwnerReliefRunView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const ownerUserId = input.ownerUserId.trim();
  if (!ownerUserId) {
    throw new BadRequestError("Owner user id is required.");
  }

  const summary = buildZeroOwnerReliefRunSummary();
  const timestamp = now();
  const triggerAction = normalizeOwnerReliefTriggerAction(input.triggerAction);
  const [run] = await db
    .insert(agentExecutionOwnerReliefRuns)
    .values({
      id: crypto.randomUUID(),
      operatorUserId,
      ownerUserId,
      agentId: normalizeText(input.agentId ?? null, 120),
      triggerAction,
      source: normalizeText(input.source ?? null, 120),
      runtimePressureLevel: normalizeRuntimePressureLevel(input.runtimePressureLevel),
      runtimeSchedulingDecisionClass: normalizeRuntimeSchedulingDecisionClass(
        input.runtimeSchedulingDecisionClass,
      ),
      openingSummary: summary,
      latestSummary: summary,
      actionCount: 1,
      resultStatus: "active",
      resultNote: null,
      handoffTargetType: null,
      handoffTarget: null,
      reopenedFromRunId: null,
      supersededByRunId: null,
      completedAt: null,
      completedByUserId: null,
      startedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  await db.insert(agentExecutionOwnerReliefRunActions).values({
    id: crypto.randomUUID(),
    runId: run.id,
    operatorUserId,
    actionKind: "open_session",
    status: "success",
    title: "Opened owner relief session",
    detail: triggerAction ? `trigger ${triggerAction}` : null,
    summary,
    createdAt: timestamp,
  });

  return toOwnerReliefRunView(run);
}

export async function recordAgentExecutionOwnerReliefRunActionForOperator(
  operatorUserId: string,
  runId: string,
  input: RecordAgentExecutionOwnerReliefRunActionInput,
): Promise<AgentExecutionOwnerReliefRunActionView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const run = await getOwnerReliefRunById(runId);
  if (!run || run.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Owner relief run not found.");
  }
  if ((normalizeOwnerReliefRunResultStatus(run.resultStatus) ?? "active") !== "active") {
    throw new ConflictError("Owner relief run has already been closed.");
  }

  const actionKind = normalizeOwnerReliefRunActionKind(input.actionKind);
  if (
    !actionKind ||
    actionKind === "open_session" ||
    actionKind === "open_handoff" ||
    actionKind === "resolve_handoff" ||
    actionKind === "finalize_closeout"
  ) {
    throw new BadRequestError("Invalid owner relief action kind.");
  }

  const status = normalizeOwnerReliefRunActionStatus(input.status) ?? "success";
  const summary = normalizeOwnerReliefRunSummary(input.summary);
  const title = input.title.trim();
  if (!title) {
    throw new BadRequestError("Action title is required.");
  }

  const timestamp = now();
  const [action] = await db
    .insert(agentExecutionOwnerReliefRunActions)
    .values({
      id: crypto.randomUUID(),
      runId,
      operatorUserId,
      actionKind,
      status,
      title,
      detail: normalizeText(input.detail ?? null, 400),
      summary,
      createdAt: timestamp,
    })
    .returning();

  await db
    .update(agentExecutionOwnerReliefRuns)
    .set({
      latestSummary: summary,
      actionCount: run.actionCount + 1,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRuns.id, runId));

  return toOwnerReliefRunActionView(action);
}

export async function finalizeAgentExecutionOwnerReliefRunForOperator(
  operatorUserId: string,
  runId: string,
  input: FinalizeAgentExecutionOwnerReliefRunInput,
): Promise<AgentExecutionOwnerReliefRunView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const run = await getOwnerReliefRunById(runId);
  if (!run || run.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Owner relief run not found.");
  }
  if ((normalizeOwnerReliefRunResultStatus(run.resultStatus) ?? "active") !== "active") {
    throw new ConflictError("Owner relief run has already been closed.");
  }

  const resultStatus = normalizeOwnerReliefRunResultStatus(input.resultStatus);
  if (!resultStatus || resultStatus === "active") {
    throw new BadRequestError("Invalid owner relief closeout status.");
  }

  const timestamp = now();
  const latestSummary = normalizeOwnerReliefRunSummary(run.latestSummary);
  const handoffTargetType = normalizeOwnerReliefRunHandoffTargetType(input.handoffTargetType);
  const handoffDefault =
    resultStatus === "handed_off" && handoffTargetType
      ? await getOwnerReliefHandoffDefaultByUserAndType(operatorUserId, handoffTargetType)
      : null;
  const handoffTarget = normalizeOwnerReliefRunTarget(input.handoffTarget ?? null) ?? handoffDefault?.handoffTarget ?? null;
  const note =
    normalizeText(input.note ?? null, 400) ??
    (resultStatus === "handed_off" ? normalizeText(handoffDefault?.noteTemplate ?? null, 400) : null);

  if (resultStatus === "handed_off" && !handoffTargetType) {
    throw new BadRequestError("Handoff target type is required when finalizing as handed off.");
  }
  if (resultStatus === "handed_off" && !handoffTarget) {
    throw new BadRequestError("Handoff target is required when finalizing as handed off.");
  }

  await db.insert(agentExecutionOwnerReliefRunActions).values({
    id: crypto.randomUUID(),
    runId,
    operatorUserId,
    actionKind: "finalize_closeout",
    status: "success",
    title: `Marked owner relief as ${resultStatus}`,
    detail: note,
    summary: latestSummary,
    createdAt: timestamp,
  });

  const [updatedRun] = await db
    .update(agentExecutionOwnerReliefRuns)
    .set({
      latestSummary,
      actionCount: run.actionCount + 1,
      resultStatus,
      resultNote: note,
      handoffTargetType: resultStatus === "handed_off" ? handoffTargetType : null,
      handoffTarget: resultStatus === "handed_off" ? handoffTarget : null,
      completedAt: timestamp,
      completedByUserId: operatorUserId,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRuns.id, runId))
    .returning();

  const resolvedRun = updatedRun ?? run;
  const handoffSession =
    resultStatus === "handed_off" ? await ensureOwnerReliefRunHandoffRow({ run: resolvedRun, timestamp }) : null;

  return {
    ...toOwnerReliefRunView(resolvedRun),
    handoffSession: handoffSession ? toOwnerReliefRunHandoffView(handoffSession) : null,
  };
}

export async function reopenAgentExecutionOwnerReliefRunForOperator(
  operatorUserId: string,
  runId: string,
): Promise<AgentExecutionOwnerReliefRunView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const previousRun = await getOwnerReliefRunById(runId);
  if (!previousRun || previousRun.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Owner relief run not found.");
  }
  if ((normalizeOwnerReliefRunResultStatus(previousRun.resultStatus) ?? "active") === "active") {
    throw new ConflictError("Owner relief run is still active.");
  }
  if (previousRun.supersededByRunId) {
    throw new ConflictError("Owner relief run has already been reopened.");
  }

  const summary = normalizeOwnerReliefRunSummary(previousRun.latestSummary);
  const timestamp = now();
  const [run] = await db
    .insert(agentExecutionOwnerReliefRuns)
    .values({
      id: crypto.randomUUID(),
      operatorUserId,
      ownerUserId: previousRun.ownerUserId,
      agentId: previousRun.agentId ?? null,
      triggerAction: normalizeOwnerReliefTriggerAction(previousRun.triggerAction),
      source: previousRun.source ?? null,
      runtimePressureLevel: normalizeRuntimePressureLevel(previousRun.runtimePressureLevel),
      runtimeSchedulingDecisionClass: normalizeRuntimeSchedulingDecisionClass(
        previousRun.runtimeSchedulingDecisionClass,
      ),
      openingSummary: summary,
      latestSummary: summary,
      actionCount: 1,
      resultStatus: "active",
      resultNote: null,
      handoffTargetType: null,
      handoffTarget: null,
      reopenedFromRunId: previousRun.id,
      supersededByRunId: null,
      completedAt: null,
      completedByUserId: null,
      startedAt: timestamp,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();

  await db.insert(agentExecutionOwnerReliefRunActions).values({
    id: crypto.randomUUID(),
    runId: run.id,
    operatorUserId,
    actionKind: "reopen_session",
    status: "success",
    title: "Reopened owner relief session",
    detail: `Reopened from ${previousRun.id}${previousRun.handoffTarget ? ` / target ${previousRun.handoffTarget}` : ""}`,
    summary,
    createdAt: timestamp,
  });

  await db
    .update(agentExecutionOwnerReliefRuns)
    .set({
      supersededByRunId: run.id,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRuns.id, previousRun.id));

  if ((normalizeOwnerReliefRunResultStatus(previousRun.resultStatus) ?? "active") === "handed_off") {
    const handoff = await ensureOwnerReliefRunHandoffRow({ run: previousRun, timestamp });
    if (handoff) {
      await db
        .update(agentExecutionOwnerReliefRunHandoffs)
        .set({
          status: "reopened",
          reopenedRunId: run.id,
          reopenedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(agentExecutionOwnerReliefRunHandoffs.id, handoff.id));
    }
  }

  return toOwnerReliefRunView(run);
}

export async function openAgentExecutionOwnerReliefRunHandoffForOperator(
  operatorUserId: string,
  runId: string,
  input: OpenAgentExecutionOwnerReliefRunHandoffInput,
): Promise<AgentExecutionOwnerReliefRunHandoffView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const run = await getOwnerReliefRunById(runId);
  if (!run || run.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Owner relief run not found.");
  }
  if ((normalizeOwnerReliefRunResultStatus(run.resultStatus) ?? "active") !== "handed_off") {
    throw new ConflictError("Only handed-off owner relief runs can open a handoff follow-up.");
  }

  const timestamp = now();
  const handoff = await ensureOwnerReliefRunHandoffRow({ run, timestamp });
  if (!handoff) {
    throw new BadRequestError("Owner relief handoff session is unavailable for this run.");
  }

  const latestFollowUpHref = normalizeText(input.followUpHref ?? null, 800);
  const inferredFocusSection = latestFollowUpHref
    ? normalizeOwnerReliefHandoffFocusSection(
        decodeURIComponent(latestFollowUpHref.split("#")[1] ?? "").trim(),
      )
    : null;
  const firstOpenedAt = handoff.firstOpenedAt ?? timestamp;
  const [updated] = await db
    .update(agentExecutionOwnerReliefRunHandoffs)
    .set({
      status: "opened",
      followUpFocusSection:
        handoff.followUpFocusSection && !inferredFocusSection
          ? handoff.followUpFocusSection
          : inferredFocusSection,
      latestFollowUpHref,
      openCount: handoff.openCount + 1,
      firstOpenedAt,
      lastOpenedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRunHandoffs.id, handoff.id))
    .returning();

  await db.insert(agentExecutionOwnerReliefRunActions).values({
    id: crypto.randomUUID(),
    runId,
    operatorUserId,
    actionKind: "open_handoff",
    status: "success",
    title: "Opened owner relief handoff follow-up",
    detail:
      latestFollowUpHref ??
      `${handoff.handoffTargetType}${handoff.handoffTarget ? ` / ${handoff.handoffTarget}` : ""}`,
    summary: normalizeOwnerReliefRunSummary(run.latestSummary),
    createdAt: timestamp,
  });

  await db
    .update(agentExecutionOwnerReliefRuns)
    .set({
      actionCount: run.actionCount + 1,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRuns.id, runId));

  return toOwnerReliefRunHandoffView(updated ?? handoff);
}

export async function resolveAgentExecutionOwnerReliefRunHandoffForOperator(
  operatorUserId: string,
  runId: string,
  input: ResolveAgentExecutionOwnerReliefRunHandoffInput,
): Promise<AgentExecutionOwnerReliefRunHandoffView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const run = await getOwnerReliefRunById(runId);
  if (!run || run.operatorUserId !== operatorUserId) {
    throw new NotFoundError("Owner relief run not found.");
  }
  if ((normalizeOwnerReliefRunResultStatus(run.resultStatus) ?? "active") !== "handed_off") {
    throw new ConflictError("Only handed-off owner relief runs can resolve a handoff follow-up.");
  }

  const timestamp = now();
  const handoff = await ensureOwnerReliefRunHandoffRow({ run, timestamp });
  if (!handoff) {
    throw new BadRequestError("Owner relief handoff session is unavailable for this run.");
  }
  if ((normalizeOwnerReliefRunHandoffStatus(handoff.status) ?? "pending") === "reopened") {
    throw new ConflictError("Reopened owner relief handoff sessions cannot be resolved again.");
  }

  const resultNote = normalizeText(input.note ?? null, 400);
  const [updated] = await db
    .update(agentExecutionOwnerReliefRunHandoffs)
    .set({
      status: "resolved",
      resultNote,
      completedAt: timestamp,
      completedByUserId: operatorUserId,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRunHandoffs.id, handoff.id))
    .returning();

  await db.insert(agentExecutionOwnerReliefRunActions).values({
    id: crypto.randomUUID(),
    runId,
    operatorUserId,
    actionKind: "resolve_handoff",
    status: "success",
    title: "Resolved owner relief handoff follow-up",
    detail: resultNote,
    summary: normalizeOwnerReliefRunSummary(run.latestSummary),
    createdAt: timestamp,
  });

  await db
    .update(agentExecutionOwnerReliefRuns)
    .set({
      actionCount: run.actionCount + 1,
      lastActionAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(agentExecutionOwnerReliefRuns.id, runId));

  return toOwnerReliefRunHandoffView(updated ?? handoff);
}

export async function listAgentExecutionOwnerReliefHandoffDefaultsForOperator(
  operatorUserId: string,
): Promise<AgentExecutionOwnerReliefHandoffDefaultView[]> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const rows = await db
    .select()
    .from(agentExecutionOwnerReliefHandoffDefaults)
    .where(eq(agentExecutionOwnerReliefHandoffDefaults.operatorUserId, operatorUserId))
    .orderBy(desc(agentExecutionOwnerReliefHandoffDefaults.updatedAt));

  return rows.map(toOwnerReliefHandoffDefaultView);
}

export async function saveAgentExecutionOwnerReliefHandoffDefaultForOperator(
  operatorUserId: string,
  input: UpsertAgentExecutionOwnerReliefHandoffDefaultInput,
): Promise<AgentExecutionOwnerReliefHandoffDefaultView> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const handoffTargetType = normalizeOwnerReliefRunHandoffTargetType(input.handoffTargetType);
  if (!handoffTargetType) {
    throw new BadRequestError("Invalid owner relief handoff target type.");
  }
  const handoffTarget = normalizeOwnerReliefRunTarget(input.handoffTarget, 160);
  if (!handoffTarget) {
    throw new BadRequestError("Handoff target is required.");
  }
  const followUpFocusSection = normalizeOwnerReliefHandoffFocusSection(input.followUpFocusSection ?? null);
  const followUpProfile = normalizeOwnerReliefHandoffFollowUpProfile(input.followUpProfile ?? null);
  if (!isOwnerReliefHandoffFocusSectionAllowedForTargetType(handoffTargetType, followUpFocusSection)) {
    throw new BadRequestError("Invalid owner relief handoff follow-up focus section.");
  }

  const timestamp = now();
  const [row] = await db
    .insert(agentExecutionOwnerReliefHandoffDefaults)
    .values({
      operatorUserId,
      handoffTargetType,
      handoffTarget,
      noteTemplate: normalizeText(input.noteTemplate ?? null, 400),
      followUpFocusSection,
      followUpProfile,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [
        agentExecutionOwnerReliefHandoffDefaults.operatorUserId,
        agentExecutionOwnerReliefHandoffDefaults.handoffTargetType,
      ],
      set: {
        handoffTarget,
        noteTemplate: normalizeText(input.noteTemplate ?? null, 400),
        followUpFocusSection,
        followUpProfile,
        updatedAt: timestamp,
      },
    })
    .returning();

  if (!row) {
    throw new ConflictError("Unable to save owner relief handoff default.");
  }

  return toOwnerReliefHandoffDefaultView(row);
}

export async function clearAgentExecutionOwnerReliefHandoffDefaultForOperator(
  operatorUserId: string,
  handoffTargetTypeInput: AgentExecutionOwnerReliefRunHandoffTargetType,
): Promise<void> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const handoffTargetType = normalizeOwnerReliefRunHandoffTargetType(handoffTargetTypeInput);
  if (!handoffTargetType) {
    throw new BadRequestError("Invalid owner relief handoff target type.");
  }

  await db
    .delete(agentExecutionOwnerReliefHandoffDefaults)
    .where(
      and(
        eq(agentExecutionOwnerReliefHandoffDefaults.operatorUserId, operatorUserId),
        eq(agentExecutionOwnerReliefHandoffDefaults.handoffTargetType, handoffTargetType),
      ),
    );
}

export async function listAgentExecutionOwnerReliefRunsForOperator(
  operatorUserId: string,
  input?: ListAgentExecutionOwnerReliefRunsInput,
): Promise<Array<AgentExecutionOwnerReliefRunView & { recentActions: AgentExecutionOwnerReliefRunActionView[] }>> {
  await resolvePlatformOperatorIdentity(operatorUserId);

  const filters = [eq(agentExecutionOwnerReliefRuns.operatorUserId, operatorUserId)];
  if (input?.ownerUserId?.trim()) {
    filters.push(eq(agentExecutionOwnerReliefRuns.ownerUserId, input.ownerUserId.trim()));
  }
  if (input?.agentId?.trim()) {
    filters.push(eq(agentExecutionOwnerReliefRuns.agentId, input.agentId.trim()));
  }
  const resultStatus = normalizeOwnerReliefRunResultStatus(input?.resultStatus ?? null);
  if (resultStatus) {
    filters.push(eq(agentExecutionOwnerReliefRuns.resultStatus, resultStatus));
  }

  const limit =
    typeof input?.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(Math.floor(input.limit), 20))
      : 8;

  const runs = await db
    .select()
    .from(agentExecutionOwnerReliefRuns)
    .where(and(...filters))
    .orderBy(desc(agentExecutionOwnerReliefRuns.startedAt), desc(agentExecutionOwnerReliefRuns.updatedAt))
    .limit(limit);

  const runIds = runs.map((run) => run.id);
  let actions: Array<typeof agentExecutionOwnerReliefRunActions.$inferSelect> = [];
  let handoffRows: Array<typeof agentExecutionOwnerReliefRunHandoffs.$inferSelect> = [];
  if (runIds.length > 0) {
    [actions, handoffRows] = await Promise.all([
      db
        .select()
        .from(agentExecutionOwnerReliefRunActions)
        .where(inArray(agentExecutionOwnerReliefRunActions.runId, runIds))
        .orderBy(desc(agentExecutionOwnerReliefRunActions.createdAt)),
      listOwnerReliefRunHandoffsByRunIds(runIds),
    ]);
  }

  const actionsByRunId = new Map<string, AgentExecutionOwnerReliefRunActionView[]>();
  for (const action of actions.map(toOwnerReliefRunActionView)) {
    const list = actionsByRunId.get(action.runId) ?? [];
    if (list.length < 6) {
      list.push(action);
      actionsByRunId.set(action.runId, list);
    }
  }

  const handoffByRunId = new Map(
    handoffRows.map((row) => [row.runId, toOwnerReliefRunHandoffView(row)] as const),
  );

  return runs.map((run) => ({
    ...toOwnerReliefRunView(run),
    handoffSession: handoffByRunId.get(run.id) ?? null,
    recentActions: actionsByRunId.get(run.id) ?? [],
  }));
}
