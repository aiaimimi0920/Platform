import type {
  CurrencyKey,
  AgentExecutionOutputEnvelope,
  AgentExecutionOutputKind,
  AgentExecutionPricingPolicyView,
  AgentExecutionObjectiveChecklistEntry,
  AgentExecutionRevenueContractView,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionRuntimeProfileView,
  AgentExecutionStepKind,
  AgentExecutionStepStatus,
  AgentExecutionSettlementAttemptStatus,
  AgentExecutionSettlementAttemptView,
  AgentExecutionSettlementLineItemKind,
  AgentExecutionSettlementLineItemView,
  AgentExecutionSettlementStatus,
  AgentExecutionSettlementView,
  AgentExecutionStepView,
  AgentExecutionRunView,
  AgentExecutionRunStatus,
  AgentExecutionStatus,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  agentExecutionRuns,
  agentExecutionSettlementLineItems,
  agentExecutionSettlementAttempts,
  agentExecutionSettlements,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { agentCapabilities } from "@/modules/agent-registry/schema";
import { ConflictError } from "@/platform/errors";

import { calculateExecutionBilledCostUnitsInTx } from "./settlement";
import {
  now,
  runtimeSubtaskPhaseOrder,
} from "./shared";

export function normalizeExecutionHostingMode(hostingMode?: string | null): "managed_light" | "managed_heavy" | "open_protocol" {
  if (hostingMode === "managed_heavy" || hostingMode === "registry_only") {
    return "managed_heavy";
  }
  if (hostingMode === "open_protocol" || hostingMode === "external_runtime") {
    return "open_protocol";
  }
  return "managed_light";
}

export function isManagedLightExecutionHostingMode(hostingMode?: string | null) {
  return normalizeExecutionHostingMode(hostingMode) === "managed_light";
}

export async function resolveManagedLightCapabilityRow(args: {
  agentId: string;
  capabilityId?: string | null;
  connection?: NodePgDatabase<typeof schema>;
}) {
  const connection = args.connection ?? db;
  const rows = await connection
    .select()
    .from(agentCapabilities)
    .where(
      and(
        eq(agentCapabilities.agentId, args.agentId),
        eq(agentCapabilities.enabled, true),
        ...(args.capabilityId ? [eq(agentCapabilities.id, args.capabilityId)] : []),
      ),
    )
    .orderBy(asc(agentCapabilities.createdAt))
    .limit(args.capabilityId ? 1 : 2);

  if (args.capabilityId) {
    const exact = rows[0] ?? null;
    if (!exact) {
      throw new ConflictError("羽量 Agent 任务能力不存在或未启用");
    }
    return exact;
  }

  if (rows.length === 0) {
    throw new ConflictError("羽量 Agent 尚未定义任务能力");
  }
  if (rows.length > 1) {
    throw new ConflictError("羽量 Agent 必须保持单任务能力");
  }
  return rows[0];
}

export function getInitialRuntimeState(sourceType: string, hostingMode?: string | null) {
  if (sourceType !== "platform" || isManagedLightExecutionHostingMode(hostingMode)) {
    return {
      executorPhase: null as PlatformExecutionPhase | null,
      progressPercent: null as number | null,
    };
  }

  return {
    executorPhase: "queued" as PlatformExecutionPhase,
    progressPercent: 0,
  };
}

export function getExecutionPhaseTimeoutSeconds(phase: PlatformExecutionPhase | null, overrideSeconds?: number | null) {
  if (overrideSeconds && Number.isFinite(overrideSeconds) && overrideSeconds >= 60) {
    return Math.floor(overrideSeconds);
  }

  if (!phase) {
    return env.agentExecutionStaleSeconds;
  }

  return env.agentExecutionPhaseTimeouts[phase] ?? env.agentExecutionStaleSeconds;
}

export function getMinimumExecutionPhaseTimeoutSeconds(overrideSeconds?: number | null) {
  if (overrideSeconds && Number.isFinite(overrideSeconds) && overrideSeconds >= 60) {
    return Math.floor(overrideSeconds);
  }

  return Math.min(
    env.agentExecutionStaleSeconds,
    ...Object.values(env.agentExecutionPhaseTimeouts).map((value) => Math.max(60, value)),
  );
}

export function getExecutionPhaseAgeSeconds(args: {
  updatedAt: Date;
  status: AgentExecutionStatus;
  phase: PlatformExecutionPhase | null;
  referenceTime?: Date;
}) {
  if (args.status !== "running" || !args.phase) {
    return null;
  }
  const referenceTime = args.referenceTime ?? now();
  return Math.max(0, Math.floor((referenceTime.getTime() - args.updatedAt.getTime()) / 1000));
}

export function isExecutionPhaseTimeoutApproaching(args: {
  updatedAt: Date;
  status: AgentExecutionStatus;
  phase: PlatformExecutionPhase | null;
  referenceTime?: Date;
}) {
  const phaseAgeSeconds = getExecutionPhaseAgeSeconds(args);
  if (phaseAgeSeconds === null || !args.phase) {
    return false;
  }
  const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(args.phase);
  return phaseAgeSeconds >= Math.max(1, Math.floor(phaseTimeoutSeconds * 0.9));
}

export function toSerializablePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

export function buildExecutionOutputEnvelope(args: {
  kind: AgentExecutionOutputKind;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown>;
  generatedAt?: Date | null;
}): AgentExecutionOutputEnvelope {
  return {
    version: 1,
    kind: args.kind,
    title: args.title,
    summary: args.summary ?? null,
    payload: args.payload ?? {},
    generatedAt: args.generatedAt ? args.generatedAt.toISOString() : null,
  };
}

export function getExecutionPhaseCostUnits(phase: PlatformExecutionPhase | null) {
  if (!phase) return 0;
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  let total = 0;
  for (const currentPhase of phaseOrder) {
    total += env.agentExecutionPhaseCostUnits[currentPhase] ?? 0;
    if (currentPhase === phase) {
      break;
    }
  }
  return total;
}

export function estimateExecutionRunCostUnits(args: {
  runKind: AgentExecutionRunView["runKind"];
  status: AgentExecutionRunStatus;
  artifactCount: number;
  executionPhase?: PlatformExecutionPhase | null;
}) {
  const baseUnits = env.agentExecutionRunBaseCostUnits[args.runKind] ?? 0;
  const artifactUnits = Math.max(0, args.artifactCount) * env.agentExecutionArtifactCostUnits;

  if (args.runKind !== "platform_executor") {
    return baseUnits + artifactUnits;
  }

  const platformPhase =
    args.executionPhase ??
    (args.status === "completed" ? "done" : args.status === "failed" ? "prepare" : "queued");
  return baseUnits + artifactUnits + getExecutionPhaseCostUnits(platformPhase);
}

export function estimateExecutionStepCostUnits(args: {
  kind: AgentExecutionStepKind;
  phase?: PlatformExecutionPhase | null;
  status: AgentExecutionStepStatus;
  progressPercent?: number | null;
}) {
  const phaseUnits = args.phase ? Math.max(0, Math.floor((env.agentExecutionPhaseCostUnits[args.phase] ?? 0) / 2)) : 0;
  const statusUnits = args.status === "completed" ? 2 : args.status === "failed" ? 1 : 1;
  const progressUnits = args.progressPercent ? Math.max(0, Math.floor(args.progressPercent / 20)) : 0;
  const kindUnits =
    args.kind === "artifact"
      ? env.agentExecutionArtifactCostUnits
      : args.kind === "status"
        ? 1
        : 2;
  return phaseUnits + statusUnits + progressUnits + kindUnits;
}

export function buildExecutionCostBuckets(runs: AgentExecutionRunView[]) {
  const bucketMap = new Map<string, number>();
  for (const run of runs) {
    bucketMap.set(run.runKind, (bucketMap.get(run.runKind) ?? 0) + run.costUnits);
  }
  return [...bucketMap.entries()]
    .map(([key, costUnits]) => ({ key, costUnits }))
    .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key));
}

export function buildStepCostBuckets(steps: AgentExecutionStepView[]) {
  const bucketMap = new Map<string, number>();
  for (const step of steps) {
    bucketMap.set(step.kind, (bucketMap.get(step.kind) ?? 0) + step.costUnits);
  }
  return [...bucketMap.entries()]
    .map(([key, costUnits]) => ({ key, costUnits }))
    .sort((left, right) => right.costUnits - left.costUnits || left.key.localeCompare(right.key));
}

export function estimateSettlementAmount(costUnits: number, costUnitsPerCurrency = env.agentExecutionCostUnitsPerCurrency) {
  return Math.max(0, Math.ceil(Math.max(0, costUnits) / Math.max(1, costUnitsPerCurrency)));
}

export function applyExecutionPricingPolicyRules(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  const measuredCostUnits = Math.max(0, args.measuredCostUnits);
  const includedCostUnits = Math.min(measuredCostUnits, args.pricingPolicy.includedCostUnits);
  const billedCostUnits = Math.max(0, measuredCostUnits - includedCostUnits);
  const estimatedBilledAmount = estimateSettlementAmount(
    billedCostUnits,
    args.pricingPolicy.costUnitsPerCurrency,
  );
  const minimumAdjustedAmount =
    billedCostUnits > 0 ? Math.max(args.pricingPolicy.minimumBilledAmount, estimatedBilledAmount) : 0;
  const billedAmount =
    args.pricingPolicy.maxBilledAmount !== null
      ? Math.min(minimumAdjustedAmount, args.pricingPolicy.maxBilledAmount)
      : minimumAdjustedAmount;
  const pricingCapExceeded =
    args.pricingPolicy.maxBilledAmount !== null && minimumAdjustedAmount > args.pricingPolicy.maxBilledAmount;
  return {
    measuredCostUnits,
    includedCostUnits,
    billedCostUnits,
    estimatedBilledAmount,
    minimumAdjustedAmount,
    billedAmount,
    pricingCapExceeded,
  };
}

export function getMaximumAffordableAdditionalArtifacts(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
  maxAdditionalArtifacts: number;
  reserveCostUnits?: number;
}) {
  const maxAdditionalArtifacts = Math.max(0, args.maxAdditionalArtifacts);
  if (maxAdditionalArtifacts === 0) {
    return 0;
  }
  if (args.pricingPolicy.maxBilledAmount === null) {
    return maxAdditionalArtifacts;
  }

  const reserveCostUnits = Math.max(0, args.reserveCostUnits ?? 0);
  let affordableArtifacts = 0;
  for (let count = 1; count <= maxAdditionalArtifacts; count += 1) {
    const projectedPricing = applyExecutionPricingPolicyRules({
      measuredCostUnits: args.measuredCostUnits + reserveCostUnits + count * env.agentExecutionArtifactCostUnits,
      pricingPolicy: args.pricingPolicy,
    });
    if (projectedPricing.pricingCapExceeded) {
      break;
    }
    affordableArtifacts = count;
  }
  return affordableArtifacts;
}

export function isExecutionPricingNearLimit(args: {
  measuredCostUnits: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  if (args.pricingPolicy.maxBilledAmount === null || args.pricingPolicy.maxBilledAmount <= 0) {
    return false;
  }
  const projectedPricing = applyExecutionPricingPolicyRules(args);
  return (
    !projectedPricing.pricingCapExceeded &&
    projectedPricing.minimumAdjustedAmount / args.pricingPolicy.maxBilledAmount >=
      env.agentExecutionBudgetNearLimitThresholdPercent
  );
}

export function getMaximumComfortableAdditionalArtifacts(args: {
  measuredCostUnits: number;
  currentResourceMinutes: number;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
  maxAdditionalArtifacts: number;
  reserveCostUnits?: number;
  reserveResourceMinutes?: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
}) {
  const maxAdditionalArtifacts = Math.max(0, args.maxAdditionalArtifacts);
  if (maxAdditionalArtifacts === 0) {
    return 0;
  }

  const reserveCostUnits = Math.max(0, args.reserveCostUnits ?? 0);
  const reserveResourceMinutes = Math.max(0, args.reserveResourceMinutes ?? 0);
  let comfortableArtifacts = 0;
  for (let count = 1; count <= maxAdditionalArtifacts; count += 1) {
    const projectedCostUnits = args.measuredCostUnits + reserveCostUnits + count * env.agentExecutionArtifactCostUnits;
    const projectedResourceMinutes =
      args.currentResourceMinutes + reserveResourceMinutes + count * getArtifactResourceMinutes();
    const budgetStatus = getExecutionBudgetStatus({
      totalCostUnits: projectedCostUnits,
      totalResourceMinutes: projectedResourceMinutes,
      budgetCostUnits: args.budgetCostUnits,
      budgetResourceMinutes: args.budgetResourceMinutes,
    });
    const pricingCapExceeded = applyExecutionPricingPolicyRules({
      measuredCostUnits: projectedCostUnits,
      pricingPolicy: args.pricingPolicy,
    }).pricingCapExceeded;
    const pricingNearLimit = isExecutionPricingNearLimit({
      measuredCostUnits: projectedCostUnits,
      pricingPolicy: args.pricingPolicy,
    });
    if (budgetStatus !== "within_budget" || pricingCapExceeded || pricingNearLimit) {
      break;
    }
    comfortableArtifacts = count;
  }
  return comfortableArtifacts;
}

export function estimateRunResourceMinutes(args: {
  createdAt: Date;
  finishedAt: Date;
}) {
  return Math.max(1, Math.ceil((args.finishedAt.getTime() - args.createdAt.getTime()) / 60_000));
}

export function getExecutionBudgetStatus(args: {
  totalCostUnits: number;
  totalResourceMinutes: number;
  budgetCostUnits: number | null;
  budgetResourceMinutes: number | null;
}): "no_budget" | "within_budget" | "near_limit" | "exceeded" {
  if (args.budgetCostUnits === null && args.budgetResourceMinutes === null) {
    return "no_budget";
  }

  const costRatio =
    args.budgetCostUnits !== null && args.budgetCostUnits > 0 ? args.totalCostUnits / args.budgetCostUnits : 0;
  const minuteRatio =
    args.budgetResourceMinutes !== null && args.budgetResourceMinutes > 0
      ? args.totalResourceMinutes / args.budgetResourceMinutes
      : 0;
  const highestRatio = Math.max(costRatio, minuteRatio);

  if (highestRatio > 1) return "exceeded";
  if (highestRatio >= env.agentExecutionBudgetNearLimitThresholdPercent) return "near_limit";
  return "within_budget";
}

export function getExecutionRuntimeNearLimitState(args: {
  measuredCostUnits: number;
  currentResourceMinutes: number;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
  pricingPolicy: ReturnType<typeof resolveExecutionPricingPolicy>;
}) {
  const budgetStatus = getExecutionBudgetStatus({
    totalCostUnits: args.measuredCostUnits,
    totalResourceMinutes: args.currentResourceMinutes,
    budgetCostUnits: args.runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: args.runtimeProfile.budgetResourceMinutes,
  });
  const pricingNearLimit = isExecutionPricingNearLimit({
    measuredCostUnits: args.measuredCostUnits,
    pricingPolicy: args.pricingPolicy,
  });
  return {
    budgetStatus,
    pricingNearLimit,
    nearLimit: budgetStatus === "near_limit" || pricingNearLimit,
  };
}

export function toAgentExecutionSettlementView(
  row: typeof agentExecutionSettlements.$inferSelect,
  lineItems: AgentExecutionSettlementLineItemView[] = [],
): AgentExecutionSettlementView {
  return {
    id: row.id,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    currency: row.currency as CurrencyKey,
    runtimeProfileKey: row.runtimeProfileKey as AgentExecutionRuntimeProfileKey,
    pricingPolicyKey: row.pricingPolicyKey,
    pricingPolicyVersion: row.pricingPolicyVersion,
    revenueContractKey: row.revenueContractKey,
    revenueContractVersion: row.revenueContractVersion,
    revenueRecipientMode: row.revenueRecipientMode as "agent_owner" | "platform_only",
    costUnitsPerCurrency: row.costUnitsPerCurrency,
    revenueSharePercent: row.revenueSharePercent,
    treasuryUserId: row.treasuryUserId,
    measuredCostUnits: row.measuredCostUnits,
    includedCostUnits: row.includedCostUnits,
    billedCostUnits: row.billedCostUnits,
    minimumBilledAmount: row.minimumBilledAmount,
    billedAmount: row.billedAmount,
    revenueRecipientUserId: row.revenueRecipientUserId,
    minimumPayoutAmount: row.minimumPayoutAmount,
    revenueAmount: row.revenueAmount,
    status: row.status as AgentExecutionSettlementStatus,
    note: row.note,
    lastError: row.lastError,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    lineItems,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAgentExecutionSettlementLineItemView(
  row: typeof agentExecutionSettlementLineItems.$inferSelect,
): AgentExecutionSettlementLineItemView {
  return {
    id: row.id,
    settlementId: row.settlementId,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    lineKind: row.lineKind as AgentExecutionSettlementLineItemKind,
    title: row.title,
    scopeType: (row.scopeType as AgentExecutionSettlementLineItemView["scopeType"]) ?? null,
    scopeId: row.scopeId,
    costUnits: row.costUnits,
    amount: row.amount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAgentExecutionSettlementAttemptView(
  row: typeof agentExecutionSettlementAttempts.$inferSelect,
): AgentExecutionSettlementAttemptView {
  return {
    id: row.id,
    settlementId: row.settlementId,
    executionId: row.executionId,
    ownerUserId: row.ownerUserId,
    agentId: row.agentId,
    currency: row.currency as CurrencyKey,
    billedAmount: row.billedAmount,
    revenueAmount: row.revenueAmount,
    status: row.status as AgentExecutionSettlementAttemptStatus,
    note: row.note,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  };
}

export function getRemainingExecutionPhaseCostUnits(phase: PlatformExecutionPhase | null) {
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  if (!phase) {
    return phaseOrder.reduce((sum, currentPhase) => sum + (env.agentExecutionPhaseCostUnits[currentPhase] ?? 0), 0);
  }
  const startIndex = phaseOrder.indexOf(phase);
  const relevant = startIndex >= 0 ? phaseOrder.slice(startIndex) : phaseOrder;
  return relevant.reduce((sum, currentPhase) => sum + (env.agentExecutionPhaseCostUnits[currentPhase] ?? 0), 0);
}

export function buildObjectiveChecklist(objective: string) {
  const normalized = objective
    .split(/\r?\n|[。！？!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 5).map((item, index) => ({
    order: index + 1,
    text: item,
  }));
}

export function normalizeObjectiveChecklist(
  value: unknown,
  fallbackObjective: string,
): AgentExecutionObjectiveChecklistEntry[] {
  if (!Array.isArray(value)) {
    return buildObjectiveChecklist(fallbackObjective).map((entry, index) => ({
      order: entry.order ?? index + 1,
      text: entry.text,
      runtimePhase: getRuntimeManagedSubtaskPhase(index),
    }));
  }

  const entries = value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { order?: unknown; text?: unknown; runtimePhase?: unknown };
      const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
      if (!text) return null;
      const runtimePhase =
        candidate.runtimePhase === "queued" ||
        candidate.runtimePhase === "prepare" ||
        candidate.runtimePhase === "produce_artifact" ||
        candidate.runtimePhase === "finalize"
          ? candidate.runtimePhase
          : getRuntimeManagedSubtaskPhase(index);
      return {
        order:
          typeof candidate.order === "number" && Number.isInteger(candidate.order) && candidate.order > 0
            ? candidate.order
            : index + 1,
        text,
        runtimePhase,
      } satisfies AgentExecutionObjectiveChecklistEntry;
    })
    .filter((item): item is AgentExecutionObjectiveChecklistEntry => Boolean(item));

  if (entries.length > 0) {
    return entries.slice(0, 5);
  }

  return buildObjectiveChecklist(fallbackObjective).map((entry, index) => ({
    order: entry.order ?? index + 1,
    text: entry.text,
    runtimePhase: getRuntimeManagedSubtaskPhase(index),
  }));
}

export function getDerivedRuntimeTargetArtifactCount(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  if (args.runtimeProfile.artifactMode !== "checklist_progressive") {
    return args.runtimeProfile.targetArtifactCount;
  }
  return Math.max(args.runtimeProfile.targetArtifactCount, Math.max(1, args.objectiveChecklist.length));
}

export function getRequiredPreparePasses(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const prepareEntryCount = args.objectiveChecklist.filter((entry) => entry.runtimePhase === "prepare").length;
  return Math.max(args.runtimeProfile.preparePassesRequired, Math.max(1, prepareEntryCount));
}

export function getRequiredFinalizePasses(args: {
  objectiveChecklist: AgentExecutionObjectiveChecklistEntry[];
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const finalizeEntryCount = args.objectiveChecklist.filter((entry) => entry.runtimePhase === "finalize").length;
  return Math.max(args.runtimeProfile.finalizePassesRequired, Math.max(1, finalizeEntryCount));
}

export function getFinalizeReserveCostUnitsForExecution(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const finalizePassesRequired = getRequiredFinalizePasses({
    objectiveChecklist,
    runtimeProfile: args.runtimeProfile,
  });
  return Math.max(1, finalizePassesRequired) * (env.agentExecutionPhaseCostUnits.finalize ?? 0);
}

export function getFinalizeReserveResourceMinutesForExecution(args: {
  execution: typeof agentExecutions.$inferSelect;
  runtimeProfile: ReturnType<typeof resolveRuntimeProfile>;
}) {
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const finalizePassesRequired = getRequiredFinalizePasses({
    objectiveChecklist,
    runtimeProfile: args.runtimeProfile,
  });
  return Math.max(1, finalizePassesRequired) * Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts.finalize ?? 60) / 60));
}

export function getArtifactResourceMinutes() {
  return Math.max(0, env.agentExecutionArtifactResourceMinutes);
}

export function getRuntimeManagedSubtaskPhase(index: number): PlatformExecutionPhase | null {
  return runtimeSubtaskPhaseOrder[index] ?? null;
}

export function resolveRuntimeProfile(key: AgentExecutionRuntimeProfileKey | null | undefined) {
  if (key && env.agentExecutionRuntimeProfiles[key]) {
    return {
      key,
      ...env.agentExecutionRuntimeProfiles[key],
    };
  }

  return {
    key: "baseline" as AgentExecutionRuntimeProfileKey,
    ...env.agentExecutionRuntimeProfiles.baseline,
  };
}

export function resolveExecutionPricingPolicy(preferredPolicyKey?: string | null, runtimeProfileKey?: string | null | undefined) {
  const policyKey =
    preferredPolicyKey && env.agentExecutionPricingPolicies[preferredPolicyKey]
      ? preferredPolicyKey
      : runtimeProfileKey && env.agentExecutionPricingPolicies[runtimeProfileKey]
        ? runtimeProfileKey
      : env.agentExecutionPricingPolicies.default
        ? "default"
        : Object.keys(env.agentExecutionPricingPolicies)[0] ?? "default";
  const policy = env.agentExecutionPricingPolicies[policyKey];
  if (!policy) {
    throw new ConflictError("Agent execution pricing policy is not configured");
  }
  return {
    key: policyKey,
    ...policy,
  };
}

export function resolveExecutionRevenueContract(
  preferredContractKey?: string | null,
  runtimeProfileKey?: string | null | undefined,
) {
  const contractKey =
    preferredContractKey && env.agentExecutionRevenueContracts[preferredContractKey]
      ? preferredContractKey
      : runtimeProfileKey && env.agentExecutionRevenueContracts[runtimeProfileKey]
        ? runtimeProfileKey
      : env.agentExecutionRevenueContracts.default
        ? "default"
        : Object.keys(env.agentExecutionRevenueContracts)[0] ?? "default";
  const contract = env.agentExecutionRevenueContracts[contractKey];
  if (!contract) {
    throw new ConflictError("Agent execution revenue contract is not configured");
  }
  return {
    key: contractKey,
    ...contract,
  };
}

export function getRemainingExecutionPhaseResourceMinutes(phase: PlatformExecutionPhase | null) {
  const phaseOrder: PlatformExecutionPhase[] = ["queued", "prepare", "produce_artifact", "finalize", "done"];
  const startIndex = phase ? phaseOrder.indexOf(phase) : 0;
  const relevant = startIndex >= 0 ? phaseOrder.slice(startIndex) : phaseOrder;
  return relevant.reduce(
    (sum, currentPhase) => sum + Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts[currentPhase] ?? 60) / 60)),
    0,
  );
}

export function toRuntimeProfileView(row: Pick<typeof agentExecutions.$inferSelect, "runtimeProfileKey" | "targetArtifactCount" | "maxAutoRecoveryCount">): AgentExecutionRuntimeProfileView {
  const profile = resolveRuntimeProfile((row.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline");
  const pricingPolicy = resolveExecutionPricingPolicy(profile.pricingPolicyKey, profile.key);
  const revenueContract = resolveExecutionRevenueContract(profile.revenueContractKey, profile.key);
  return {
    key: profile.key,
    label: profile.label,
    description: profile.description,
    targetArtifactCount: row.targetArtifactCount ?? profile.targetArtifactCount,
    artifactsPerAdvance: profile.artifactsPerAdvance,
    nearLimitArtifactsPerAdvanceCap: profile.nearLimitArtifactsPerAdvanceCap,
    maxAutoRecoveryCount: row.maxAutoRecoveryCount ?? profile.maxAutoRecoveryCount,
    maxConcurrentExecutions: profile.maxConcurrentExecutions,
    maxConcurrentExecutionsPerOwner: profile.maxConcurrentExecutionsPerOwner,
    nearLimitPhaseAdvancesPerRunCap: profile.nearLimitPhaseAdvancesPerRunCap,
    nearLimitPreparePassesCap: profile.nearLimitPreparePassesCap,
    nearLimitFinalizePassesCap: profile.nearLimitFinalizePassesCap,
    preparePassesRequired: profile.preparePassesRequired,
    finalizePassesRequired: profile.finalizePassesRequired,
    phaseAdvancesPerRun: profile.phaseAdvancesPerRun,
    budgetCostUnits: profile.budgetCostUnits,
    budgetResourceMinutes: profile.budgetResourceMinutes,
    pricingPolicyKey: pricingPolicy.key,
    pricingPolicyVersion: pricingPolicy.version,
    revenueContractKey: revenueContract.key,
    revenueContractVersion: revenueContract.version,
    artifactMode: profile.artifactMode,
    runtimePlanVersion: profile.runtimePlanVersion,
  };
}

export function buildRuntimeProfileOwnerKey(runtimeProfileKey: string, ownerUserId: string) {
  return `${runtimeProfileKey}:${ownerUserId}`;
}

export async function getRuntimeProfileUtilizationMap() {
  const runningRows = await db.execute(sql`
    select ae.runtime_profile_key, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'running'
    group by ae.runtime_profile_key
  `);
  const queuedRows = await db.execute(sql`
    select ae.runtime_profile_key, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'queued'
    group by ae.runtime_profile_key
  `);
  const runningOwnerRows = await db.execute(sql`
    select ae.runtime_profile_key, ae.owner_user_id, count(*)::int as count
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'running'
    group by ae.runtime_profile_key, ae.owner_user_id
  `);
  const queuedExecutionRows = await db.execute(sql`
    select ae.id as execution_id, ae.runtime_profile_key, ae.owner_user_id
    from agent_executions ae
    inner join agents a on a.id = ae.agent_id
    where a.source_type = 'platform'
      and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
      and a.enabled = true
      and ae.status = 'queued'
    order by ae.created_at asc
  `);

  const runningCountByProfile = new Map<string, number>();
  const queuedCountByProfile = new Map<string, number>();
  const runningCountByProfileOwner = new Map<string, number>();
  const queuedCandidatesByProfile = new Map<string, Array<{ ownerUserId: string }>>();
  for (const row of runningRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
    const key = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    runningCountByProfile.set(key, Number(row.count) || 0);
  }
  for (const row of queuedRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
    const key = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    queuedCountByProfile.set(key, Number(row.count) || 0);
  }
  for (const row of runningOwnerRows.rows as Array<{ runtime_profile_key: string | null; owner_user_id: string | null; count: number }>) {
    const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    const ownerUserId = row.owner_user_id?.trim();
    if (!ownerUserId) continue;
    runningCountByProfileOwner.set(
      buildRuntimeProfileOwnerKey(runtimeProfileKey, ownerUserId),
      Number(row.count) || 0,
    );
  }
  for (const row of queuedExecutionRows.rows as Array<{ execution_id: string; runtime_profile_key: string | null; owner_user_id: string | null }>) {
    const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
    const ownerUserId = row.owner_user_id?.trim() || `unknown:${row.execution_id}`;
    const candidates = queuedCandidatesByProfile.get(runtimeProfileKey) ?? [];
    candidates.push({ ownerUserId });
    queuedCandidatesByProfile.set(runtimeProfileKey, candidates);
  }

  return {
    runningCountByProfile,
    queuedCountByProfile,
    runningCountByProfileOwner,
    queuedCandidatesByProfile,
  };
}

export async function getExecutionRuntimeHeadroomSnapshot(
  execution: typeof agentExecutions.$inferSelect,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const runtimeProfile = resolveRuntimeProfile(
    (execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const [measuredCostUnits, runTotals] = await Promise.all([
    calculateExecutionBilledCostUnitsInTx(connection, execution.id),
    connection
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, execution.id)),
  ]);
  const currentResourceMinutes = Number(runTotals[0]?.totalResourceMinutes ?? 0);
  const nearLimitState = getExecutionRuntimeNearLimitState({
    measuredCostUnits,
    currentResourceMinutes,
    runtimeProfile,
    pricingPolicy,
  });
  return {
    runtimeProfile,
    pricingPolicy,
    measuredCostUnits,
    currentResourceMinutes,
    ...nearLimitState,
  };
}

export function toAgentExecutionPricingPolicyView(
  key: string,
  policy: (typeof env.agentExecutionPricingPolicies)[string],
): AgentExecutionPricingPolicyView {
  return {
    key,
    label: policy.label,
    version: policy.version,
    currency: policy.currency,
    costUnitsPerCurrency: policy.costUnitsPerCurrency,
    includedCostUnits: policy.includedCostUnits,
    minimumBilledAmount: policy.minimumBilledAmount,
    maxBilledAmount: policy.maxBilledAmount,
    allowPartialFinalize: policy.allowPartialFinalize,
    minimumArtifactsBeforePartialFinalize: policy.minimumArtifactsBeforePartialFinalize,
    revenueSharePercent: policy.revenueSharePercent,
    treasuryUserId: policy.treasuryUserId,
  };
}

export function toAgentExecutionRevenueContractView(
  key: string,
  contract: (typeof env.agentExecutionRevenueContracts)[string],
): AgentExecutionRevenueContractView {
  return {
    key,
    label: contract.label,
    version: contract.version,
    revenueSharePercent: contract.revenueSharePercent,
    minimumPayoutAmount: contract.minimumPayoutAmount,
    treasuryUserId: contract.treasuryUserId,
    revenueRecipientMode: contract.revenueRecipientMode,
  };
}
