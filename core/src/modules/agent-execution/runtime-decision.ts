import type {
  AgentExecutionBudgetStatus,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimeDecisionView,
  AgentExecutionRuntimeProfileKey,
  PlatformExecutionPhase,
} from "@neuro/contracts";

type RuntimeDecisionBaseArgs = {
  phase: PlatformExecutionPhase;
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  pricingPolicyKey?: string | null;
  budgetStatus?: AgentExecutionBudgetStatus | null;
  nearLimit?: boolean;
  pricingNearLimit?: boolean | null;
  phaseTimeoutApproaching?: boolean;
  adaptiveFinalize?: boolean;
  partialArtifactCompletion?: boolean;
  artifactCount?: number | null;
  targetArtifactCount?: number | null;
  requestedArtifactsToProduce?: number | null;
  plannedArtifactsToProduce?: number | null;
  nearLimitArtifactsPerAdvanceCap?: number | null;
  preparePassNumber?: number | null;
  preparePassesRequired?: number | null;
  finalizePassNumber?: number | null;
  finalizePassesRequired?: number | null;
};

type PrepareRuntimeDecisionArgs = RuntimeDecisionBaseArgs & {
  preparePassNumber: number;
  preparePassesRequired: number;
  nearLimitCapApplied: boolean;
  timeoutAccelerationApplied: boolean;
};

type ArtifactRuntimeDecisionArgs = RuntimeDecisionBaseArgs & {
  artifactCount: number;
  targetArtifactCount: number;
  requestedArtifactsToProduce: number;
  plannedArtifactsToProduce: number;
  nearLimitArtifactsPerAdvanceCap: number | null;
  batchDownshiftApplied: boolean;
  finalizeEarlyReason: "near_limit" | "timeout" | "headroom" | null;
  partialFinalizeBlocked: boolean;
};

type FinalizeRuntimeDecisionArgs = RuntimeDecisionBaseArgs & {
  finalizePassNumber: number;
  finalizePassesRequired: number;
  nearLimitCapApplied: boolean;
  timeoutAccelerationApplied: boolean;
};

type FinalizeCompletedRuntimeDecisionArgs = RuntimeDecisionBaseArgs & {
  artifactCount: number;
  targetArtifactCount: number;
  partialArtifactCompletion: boolean;
};

function buildDecision(args: RuntimeDecisionBaseArgs & {
  decisionClass: AgentExecutionRuntimeDecisionClass;
  severity: AgentExecutionRuntimeDecisionSeverity;
  title: string;
  detail: string;
}): AgentExecutionRuntimeDecisionView {
  return {
    phase: args.phase,
    decisionClass: args.decisionClass,
    severity: args.severity,
    title: args.title,
    detail: args.detail,
    runtimeProfileKey: args.runtimeProfileKey,
    pricingPolicyKey: args.pricingPolicyKey ?? null,
    budgetStatus: args.budgetStatus ?? null,
    nearLimit: Boolean(args.nearLimit),
    pricingNearLimit: args.pricingNearLimit ?? null,
    phaseTimeoutApproaching: Boolean(args.phaseTimeoutApproaching),
    adaptiveFinalize: Boolean(args.adaptiveFinalize),
    partialArtifactCompletion: Boolean(args.partialArtifactCompletion),
    artifactCount: args.artifactCount ?? null,
    targetArtifactCount: args.targetArtifactCount ?? null,
    requestedArtifactsToProduce: args.requestedArtifactsToProduce ?? null,
    plannedArtifactsToProduce: args.plannedArtifactsToProduce ?? null,
    nearLimitArtifactsPerAdvanceCap: args.nearLimitArtifactsPerAdvanceCap ?? null,
    preparePassNumber: args.preparePassNumber ?? null,
    preparePassesRequired: args.preparePassesRequired ?? null,
    finalizePassNumber: args.finalizePassNumber ?? null,
    finalizePassesRequired: args.finalizePassesRequired ?? null,
  };
}

export function buildPrepareRuntimeDecision(args: PrepareRuntimeDecisionArgs): AgentExecutionRuntimeDecisionView {
  if (args.timeoutAccelerationApplied) {
    return buildDecision({
      ...args,
      decisionClass: "prepare_timeout_accelerated",
      severity: "warning",
      title: "Prepare accelerated by phase-timeout window",
      detail: `Prepare pass ${args.preparePassNumber}/${args.preparePassesRequired} became the final prepare pass because the timeout window for phase '${args.phase}' was nearly exhausted.`,
    });
  }
  if (args.nearLimitCapApplied) {
    return buildDecision({
      ...args,
      decisionClass: "prepare_near_limit_cap",
      severity: "info",
      title: "Prepare passes capped under near-limit headroom",
      detail: `Prepare remains within headroom, but runtime near-limit rules capped the remaining prepare passes at ${args.preparePassesRequired}.`,
    });
  }
  return buildDecision({
    ...args,
    decisionClass: "prepare_continue",
    severity: "info",
    title: "Prepare continuing under normal runtime plan",
    detail: `Prepare pass ${args.preparePassNumber}/${args.preparePassesRequired} completed without needing timeout or near-limit acceleration.`,
  });
}

export function buildArtifactRuntimeDecision(args: ArtifactRuntimeDecisionArgs): AgentExecutionRuntimeDecisionView {
  if (args.partialFinalizeBlocked) {
    return buildDecision({
      ...args,
      decisionClass: "artifact_partial_finalize_blocked",
      severity: "critical",
      title: "Runtime headroom exhausted before partial finalize became eligible",
      detail: `Artifact production stopped at ${args.artifactCount}/${args.targetArtifactCount} because runtime headroom was exhausted before partial finalize reached its pricing policy gate.`,
    });
  }
  if (args.finalizeEarlyReason === "timeout") {
    return buildDecision({
      ...args,
      decisionClass: "artifact_finalize_early_timeout",
      severity: "warning",
      title: "Artifact phase advanced to finalize under timeout pressure",
      detail: `Artifact production moved to finalize at ${args.artifactCount}/${args.targetArtifactCount} because the phase timeout window was nearly exhausted.`,
    });
  }
  if (args.finalizeEarlyReason === "near_limit") {
    return buildDecision({
      ...args,
      decisionClass: "artifact_finalize_early_near_limit",
      severity: "warning",
      title: "Adaptive finalize triggered before the next artifact batch",
      detail: `Runtime stayed inside headroom by switching directly to finalize at ${args.artifactCount}/${args.targetArtifactCount}, rather than pushing artifact production into the near-limit zone.`,
    });
  }
  if (args.finalizeEarlyReason === "headroom") {
    return buildDecision({
      ...args,
      decisionClass: "artifact_finalize_early_headroom",
      severity: "warning",
      title: "Artifact phase advanced to finalize under headroom constraints",
      detail: `Artifact production stopped at ${args.artifactCount}/${args.targetArtifactCount} because no further artifact batch remained affordable under the active runtime headroom and pricing reserve rules.`,
    });
  }
  if (args.batchDownshiftApplied) {
    return buildDecision({
      ...args,
      decisionClass: "artifact_batch_downshift_near_limit",
      severity: "info",
      title: "Artifact batch downshifted under near-limit headroom",
      detail: `This advance requested ${args.requestedArtifactsToProduce} artifact(s) but only planned ${args.plannedArtifactsToProduce} to stay inside the comfortable runtime headroom window.`,
    });
  }
  return buildDecision({
    ...args,
    decisionClass: "artifact_batch_continue",
    severity: "info",
    title: "Artifact phase continuing at the planned batch size",
    detail: `Artifact production remains within headroom and plans ${args.plannedArtifactsToProduce} artifact(s) for this advance.`,
  });
}

export function buildFinalizeRuntimeDecision(args: FinalizeRuntimeDecisionArgs): AgentExecutionRuntimeDecisionView {
  if (args.timeoutAccelerationApplied) {
    return buildDecision({
      ...args,
      decisionClass: "finalize_timeout_accelerated",
      severity: "warning",
      title: "Finalize compressed by phase-timeout window",
      detail: `Finalize pass ${args.finalizePassNumber}/${args.finalizePassesRequired} became the final consolidation pass because the timeout window was nearly exhausted.`,
    });
  }
  if (args.nearLimitCapApplied) {
    return buildDecision({
      ...args,
      decisionClass: "finalize_near_limit_cap",
      severity: "info",
      title: "Finalize passes capped under near-limit headroom",
      detail: `Finalize remains within headroom, but runtime near-limit rules capped the remaining finalize passes at ${args.finalizePassesRequired}.`,
    });
  }
  return buildDecision({
    ...args,
    decisionClass: "finalize_continue",
    severity: "info",
    title: "Finalize continuing under normal runtime plan",
    detail: `Finalize pass ${args.finalizePassNumber}/${args.finalizePassesRequired} completed without additional timeout or near-limit compression.`,
  });
}

export function buildFinalizeCompletedRuntimeDecision(
  args: FinalizeCompletedRuntimeDecisionArgs,
): AgentExecutionRuntimeDecisionView {
  return buildDecision({
    ...args,
    phase: "done",
    decisionClass: "finalize_completed",
    severity: args.partialArtifactCompletion ? "warning" : "info",
    title: args.partialArtifactCompletion
      ? "Runtime completed with a partial artifact package"
      : "Runtime completed the planned artifact package",
    detail: args.partialArtifactCompletion
      ? `Finalize completed with ${args.artifactCount}/${args.targetArtifactCount} artifacts after runtime headroom rules had already narrowed the deliverable set.`
      : `Finalize completed with the full artifact package (${args.artifactCount}/${args.targetArtifactCount}).`,
  });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const runtimeDecisionClasses = new Set<AgentExecutionRuntimeDecisionClass>([
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

const runtimeDecisionSeverities = new Set<AgentExecutionRuntimeDecisionSeverity>(["info", "warning", "critical"]);
const platformExecutionPhases = new Set<PlatformExecutionPhase>([
  "queued",
  "prepare",
  "produce_artifact",
  "finalize",
  "done",
]);
const budgetStatuses = new Set<AgentExecutionBudgetStatus>(["no_budget", "within_budget", "near_limit", "exceeded"]);

export function resolveRuntimeDecisionFromPayload(
  payload: Record<string, unknown> | null | undefined,
): AgentExecutionRuntimeDecisionView | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload.runtimeDecision;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const decisionClass = asString(record.decisionClass);
  const severity = asString(record.severity);
  const phase = asString(record.phase);
  const title = asString(record.title);
  const detail = asString(record.detail);
  if (
    !decisionClass ||
    !runtimeDecisionClasses.has(decisionClass as AgentExecutionRuntimeDecisionClass) ||
    !severity ||
    !runtimeDecisionSeverities.has(severity as AgentExecutionRuntimeDecisionSeverity) ||
    !phase ||
    !platformExecutionPhases.has(phase as PlatformExecutionPhase) ||
    !title ||
    !detail
  ) {
    return null;
  }
  const budgetStatus = asString(record.budgetStatus);
  return {
    phase: phase as PlatformExecutionPhase,
    decisionClass: decisionClass as AgentExecutionRuntimeDecisionClass,
    severity: severity as AgentExecutionRuntimeDecisionSeverity,
    title,
    detail,
    runtimeProfileKey: (asString(record.runtimeProfileKey) as AgentExecutionRuntimeProfileKey | null) ?? null,
    pricingPolicyKey: asString(record.pricingPolicyKey),
    budgetStatus:
      budgetStatus && budgetStatuses.has(budgetStatus as AgentExecutionBudgetStatus)
        ? (budgetStatus as AgentExecutionBudgetStatus)
        : null,
    nearLimit: asBoolean(record.nearLimit) ?? false,
    pricingNearLimit: asBoolean(record.pricingNearLimit),
    phaseTimeoutApproaching: asBoolean(record.phaseTimeoutApproaching) ?? false,
    adaptiveFinalize: asBoolean(record.adaptiveFinalize) ?? false,
    partialArtifactCompletion: asBoolean(record.partialArtifactCompletion) ?? false,
    artifactCount: asNumber(record.artifactCount),
    targetArtifactCount: asNumber(record.targetArtifactCount),
    requestedArtifactsToProduce: asNumber(record.requestedArtifactsToProduce),
    plannedArtifactsToProduce: asNumber(record.plannedArtifactsToProduce),
    nearLimitArtifactsPerAdvanceCap: asNumber(record.nearLimitArtifactsPerAdvanceCap),
    preparePassNumber: asNumber(record.preparePassNumber),
    preparePassesRequired: asNumber(record.preparePassesRequired),
    finalizePassNumber: asNumber(record.finalizePassNumber),
    finalizePassesRequired: asNumber(record.finalizePassesRequired),
  };
}
