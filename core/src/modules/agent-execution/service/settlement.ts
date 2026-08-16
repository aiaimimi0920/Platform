import type {
  CurrencyKey,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionSettlementAttemptStatus,
  AgentExecutionSettlementSummaryView,
  AgentExecutionSettlementStatus,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { transferBalance } from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  buildArtifactRuntimeDecision,
} from "@/modules/agent-execution/runtime-decision";
import {
  agentExecutionArtifacts,
  agentExecutionRuns,
  agentExecutionSettlementLineItems,
  agentExecutionSettlementAttempts,
  agentExecutionSettlements,
  agentExecutionSteps,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { agents } from "@/modules/agent-registry/schema";
import { NotFoundError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { toMarketplaceInvocationSnapshotView } from "./managed-light";
import {
  applyExecutionPricingPolicyRules,
  buildExecutionOutputEnvelope,
  estimateSettlementAmount,
  getArtifactResourceMinutes,
  getExecutionBudgetStatus,
  getFinalizeReserveCostUnitsForExecution,
  getFinalizeReserveResourceMinutesForExecution,
  getRemainingExecutionPhaseCostUnits,
  getRemainingExecutionPhaseResourceMinutes,
  isExecutionPricingNearLimit,
  normalizeObjectiveChecklist,
  resolveExecutionPricingPolicy,
  resolveExecutionRevenueContract,
  resolveRuntimeProfile,
  toAgentExecutionSettlementAttemptView,
} from "./pricing";
import {
  finishExecutionRunInTx,
  recordExecutionStepInTx,
} from "./runs";
import {
  finalizeRuntimeSessionInTx,
  touchRuntimeSessionInTx,
} from "./runtime-sessions";
import { syncRuntimeManagedSubtasksInTx } from "./runtime-subtasks";
import { now } from "./shared";
import {
  getExecutionSettlementByExecutionId,
  getExecutionViewWithSettlement,
  toStoredExecutionOutputEnvelope,
} from "./views";

export async function calculateExecutionBilledCostUnitsInTx(
  tx: NodePgDatabase<typeof schema>,
  executionId: string,
) {
  const [runRow] = await tx
    .select({ total: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int` })
    .from(agentExecutionRuns)
    .where(eq(agentExecutionRuns.executionId, executionId));
  const [stepRow] = await tx
    .select({ total: sql<number>`coalesce(sum(${agentExecutionSteps.costUnits}), 0)::int` })
    .from(agentExecutionSteps)
    .where(eq(agentExecutionSteps.executionId, executionId));
  return Number(runRow?.total ?? 0) + Number(stepRow?.total ?? 0);
}

export async function refreshExecutionSettlementLineItemsInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  settlement: typeof agentExecutionSettlements.$inferSelect;
}) {
  const [runRows, stepRows] = await Promise.all([
    args.tx
      .select({
        key: agentExecutionRuns.runKind,
        costUnits: sql<number>`coalesce(sum(${agentExecutionRuns.costUnits}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.settlement.executionId))
      .groupBy(agentExecutionRuns.runKind),
    args.tx
      .select({
        key: agentExecutionSteps.kind,
        costUnits: sql<number>`coalesce(sum(${agentExecutionSteps.costUnits}), 0)::int`,
      })
      .from(agentExecutionSteps)
      .where(eq(agentExecutionSteps.executionId, args.settlement.executionId))
      .groupBy(agentExecutionSteps.kind),
  ]);

  await args.tx
    .delete(agentExecutionSettlementLineItems)
    .where(eq(agentExecutionSettlementLineItems.settlementId, args.settlement.id));

  const timestamp = now();
  const rows: Array<typeof agentExecutionSettlementLineItems.$inferInsert> = [
    {
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "owner_charge",
      title: "Owner charge",
      scopeType: "settlement",
      scopeId: args.settlement.id,
      costUnits: args.settlement.billedCostUnits,
      amount: args.settlement.billedAmount,
      createdAt: timestamp,
    },
  ];

  if (args.settlement.revenueRecipientUserId && args.settlement.revenueAmount > 0) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "revenue_share",
      title: "Agent revenue share",
      scopeType: "settlement",
      scopeId: args.settlement.id,
      costUnits: 0,
      amount: args.settlement.revenueAmount,
      createdAt: timestamp,
    });
  }

  for (const row of runRows) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "run_cost",
      title: `Run cost · ${row.key}`,
      scopeType: "run",
      scopeId: row.key,
      costUnits: Number(row.costUnits ?? 0),
      amount: estimateSettlementAmount(Number(row.costUnits ?? 0), args.settlement.costUnitsPerCurrency),
      createdAt: timestamp,
    });
  }

  for (const row of stepRows) {
    rows.push({
      id: crypto.randomUUID(),
      settlementId: args.settlement.id,
      executionId: args.settlement.executionId,
      ownerUserId: args.settlement.ownerUserId,
      agentId: args.settlement.agentId,
      lineKind: "step_cost",
      title: `Step cost · ${row.key}`,
      scopeType: "step",
      scopeId: row.key,
      costUnits: Number(row.costUnits ?? 0),
      amount: estimateSettlementAmount(Number(row.costUnits ?? 0), args.settlement.costUnitsPerCurrency),
      createdAt: timestamp,
    });
  }

  if (rows.length > 0) {
    await args.tx.insert(agentExecutionSettlementLineItems).values(rows);
  }
}

export async function ensureExecutionSettlementPlanInTx(
  tx: NodePgDatabase<typeof schema>,
  execution: typeof agentExecutions.$inferSelect,
) {
  const [agentRow] = await tx
    .select({ ownerUserId: agents.ownerUserId, sourceType: agents.sourceType })
    .from(agents)
    .where(eq(agents.id, execution.agentId))
    .limit(1);
  if (!agentRow) {
    throw new NotFoundError("Agent not found for execution settlement");
  }

  const runtimeProfile = resolveRuntimeProfile(execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null);
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const revenueContract = resolveExecutionRevenueContract(runtimeProfile.revenueContractKey, runtimeProfile.key);
  const pricingRuleResult = applyExecutionPricingPolicyRules({
    measuredCostUnits: await calculateExecutionBilledCostUnitsInTx(tx, execution.id),
    pricingPolicy,
  });
  const marketplaceInvocation = toMarketplaceInvocationSnapshotView(execution.marketplaceInvocation);
  const { measuredCostUnits, includedCostUnits, billedCostUnits, estimatedBilledAmount, billedAmount: runtimeBilledAmount } =
    pricingRuleResult;
  const billedAmount = marketplaceInvocation?.quotedAmount ?? runtimeBilledAmount;
  const settlementCurrency = (marketplaceInvocation?.priceCurrency ?? pricingPolicy.currency) as CurrencyKey;
  const revenueRecipientUserId =
    revenueContract.revenueRecipientMode === "agent_owner" && agentRow.ownerUserId !== execution.ownerUserId
      ? agentRow.ownerUserId
      : null;
  const calculatedRevenueAmount = revenueRecipientUserId
    ? Math.max(0, Math.floor((billedAmount * revenueContract.revenueSharePercent) / 100))
    : 0;
  const revenueAmount =
    revenueRecipientUserId && calculatedRevenueAmount >= revenueContract.minimumPayoutAmount
      ? calculatedRevenueAmount
      : 0;
  const timestamp = now();
  const plannedStatus: AgentExecutionSettlementStatus =
    !env.agentExecutionBillingEnabled || billedAmount <= 0 ? "skipped" : "pending";
  const note =
    !env.agentExecutionBillingEnabled
      ? "Execution billing is disabled."
      : billedAmount <= 0
        ? "Execution produced no billable cost units after pricing policy offsets."
        : marketplaceInvocation
          ? `Marketplace invocation settlement will charge ${billedAmount} ${settlementCurrency} using ${marketplaceInvocation.billingMode}${marketplaceInvocation.billingUnit ? ` / ${marketplaceInvocation.billingUnit}` : ""}.`
        : pricingRuleResult.pricingCapExceeded
          ? "Execution completed and reached the pricing policy cap before settlement."
        : billedAmount > estimatedBilledAmount
          ? "Execution completed and is awaiting settlement after minimum charge policy uplift."
          : calculatedRevenueAmount > 0 && revenueAmount === 0
            ? "Execution completed and is awaiting settlement; revenue share is withheld until minimum payout is reached."
            : "Execution completed and is awaiting settlement.";

  const existing = await getExecutionSettlementByExecutionId(execution.id, tx);
  if (existing) {
    const nextStatus =
      existing.status === "settled"
        ? "settled"
        : (plannedStatus as typeof existing.status);
    const [updated] = await tx
      .update(agentExecutionSettlements)
      .set({
        currency: settlementCurrency,
        runtimeProfileKey: execution.runtimeProfileKey,
        pricingPolicyKey: pricingPolicy.key,
        pricingPolicyVersion: pricingPolicy.version,
        costUnitsPerCurrency: pricingPolicy.costUnitsPerCurrency,
        revenueContractKey: revenueContract.key,
        revenueContractVersion: revenueContract.version,
        revenueRecipientMode: revenueContract.revenueRecipientMode,
        revenueSharePercent: revenueContract.revenueSharePercent,
        treasuryUserId: revenueContract.treasuryUserId,
        measuredCostUnits,
        includedCostUnits,
        billedCostUnits,
        minimumBilledAmount: pricingPolicy.minimumBilledAmount,
        billedAmount,
        revenueRecipientUserId,
        minimumPayoutAmount: revenueContract.minimumPayoutAmount,
        revenueAmount,
        status: nextStatus,
        note,
        updatedAt: timestamp,
      })
      .where(eq(agentExecutionSettlements.id, existing.id))
      .returning();
    await refreshExecutionSettlementLineItemsInTx({ tx, settlement: updated });
    return updated;
  }

  const [created] = await tx
    .insert(agentExecutionSettlements)
    .values({
      id: crypto.randomUUID(),
        executionId: execution.id,
        ownerUserId: execution.ownerUserId,
        agentId: execution.agentId,
        currency: settlementCurrency,
        runtimeProfileKey: execution.runtimeProfileKey,
        pricingPolicyKey: pricingPolicy.key,
        pricingPolicyVersion: pricingPolicy.version,
        costUnitsPerCurrency: pricingPolicy.costUnitsPerCurrency,
        revenueContractKey: revenueContract.key,
        revenueContractVersion: revenueContract.version,
        revenueRecipientMode: revenueContract.revenueRecipientMode,
        revenueSharePercent: revenueContract.revenueSharePercent,
        treasuryUserId: revenueContract.treasuryUserId,
        measuredCostUnits,
        includedCostUnits,
        billedCostUnits,
        minimumBilledAmount: pricingPolicy.minimumBilledAmount,
        billedAmount,
      revenueRecipientUserId,
      minimumPayoutAmount: revenueContract.minimumPayoutAmount,
      revenueAmount,
      status: plannedStatus,
      note,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
  await refreshExecutionSettlementLineItemsInTx({ tx, settlement: created });
  return created;
}

export async function enforceExecutionBudgetInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  runId: string;
}) {
  const runtimeProfile = resolveRuntimeProfile(
    (args.execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  if (runtimeProfile.budgetCostUnits === null && runtimeProfile.budgetResourceMinutes === null) {
    return null;
  }

  const billedCostUnits = await calculateExecutionBilledCostUnitsInTx(args.tx, args.execution.id);
  const [artifactRow, runTotals] = await Promise.all([
    args.tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, args.execution.id)),
    args.tx
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.execution.id)),
  ]);

  const producedArtifactCount = Number(artifactRow[0]?.count ?? 0);
  const minimumContinuationArtifactCount = producedArtifactCount > 0 ? 0 : 1;
  const currentPhase = (args.execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const phaseCostUnits =
    currentPhase === "produce_artifact"
      ? (env.agentExecutionPhaseCostUnits.produce_artifact ?? 0) + finalizeReserveCostUnits
      : getRemainingExecutionPhaseCostUnits(currentPhase);
  const phaseResourceMinutes =
    currentPhase === "produce_artifact"
      ? Math.max(1, Math.ceil((env.agentExecutionPhaseTimeouts.produce_artifact ?? 60) / 60)) + finalizeReserveResourceMinutes
      : getRemainingExecutionPhaseResourceMinutes(currentPhase);
  const projectedCostUnits =
    billedCostUnits +
    phaseCostUnits +
    minimumContinuationArtifactCount * env.agentExecutionArtifactCostUnits;
  const projectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) +
    phaseResourceMinutes +
    minimumContinuationArtifactCount * getArtifactResourceMinutes();
  const projectedStatus = getExecutionBudgetStatus({
    totalCostUnits: projectedCostUnits,
    totalResourceMinutes: projectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  const projectedPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: projectedCostUnits,
    pricingPolicy,
  });
  const budgetExceeded = projectedStatus === "exceeded";
  const pricingCapExceeded = projectedPricing.pricingCapExceeded;

  if (!budgetExceeded && !pricingCapExceeded) {
    return null;
  }

  const detail = budgetExceeded
    ? `Execution exceeded runtime budget for profile ${runtimeProfile.key} and pricing policy ${pricingPolicy.key} during the minimum viable continuation path. Projected cost=${projectedCostUnits}/${runtimeProfile.budgetCostUnits ?? "unlimited"} cu, projected resource=${projectedResourceMinutes}/${runtimeProfile.budgetResourceMinutes ?? "unlimited"} min.`
    : `Execution would exceed pricing policy cap for profile ${runtimeProfile.key} during the minimum viable continuation path. Projected billed amount=${projectedPricing.minimumAdjustedAmount}/${pricingPolicy.maxBilledAmount} ${pricingPolicy.currency} after included cost units (${projectedPricing.includedCostUnits}) and minimum charge rules.`;
  const timestamp = now();
  const [updatedExecution] = await args.tx
    .update(agentExecutions)
    .set({
      status: "failed",
      statusNote: budgetExceeded
        ? "Execution stopped because the runtime budget would be exceeded."
        : "Execution stopped because the pricing policy cap would be exceeded.",
      resultSummary: budgetExceeded
        ? "Runtime budget exceeded before the next executor phase could proceed."
        : "Pricing policy cap exceeded before the next executor phase could proceed.",
      updatedAt: timestamp,
      completedAt: timestamp,
      executorPhase: "done",
      progressPercent: 100,
    })
    .where(eq(agentExecutions.id, args.execution.id))
    .returning();

  await finishExecutionRunInTx(args.tx, args.runId, {
    status: "failed",
    summary: budgetExceeded
      ? "Platform executor stopped because the runtime budget would be exceeded."
      : "Platform executor stopped because the pricing policy cap would be exceeded.",
    errorMessage: detail,
    artifactCount: producedArtifactCount,
  });
  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "phase",
    phase: "done",
    title: budgetExceeded ? "Runtime budget exceeded" : "Pricing cap exceeded",
    detail,
    status: "failed",
    progressPercent: 100,
  });
  if (updatedExecution) {
    await syncRuntimeManagedSubtasksInTx(args.tx, updatedExecution, "failed");
    await finalizeRuntimeSessionInTx(args.tx, updatedExecution.id, {
      kind: "platform_executor",
      state: "failed",
      endedPhase: "done",
      note: detail,
    });
  }
  await enqueueOutboxEvent(
    "agentExecution.failed",
    {
      executionId: args.execution.id,
      ownerUserId: args.execution.ownerUserId,
      agentId: args.execution.agentId,
      taskId: args.execution.taskId,
      trigger: budgetExceeded ? "budget_exceeded" : "pricing_cap_exceeded",
    },
    args.tx,
  );
  return updatedExecution;
}

export async function maybeAdvanceExecutionToFinalizeInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  execution: typeof agentExecutions.$inferSelect;
  runId: string;
}) {
  const currentPhase = (args.execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  if (currentPhase !== "produce_artifact") {
    return null;
  }

  const runtimeProfile = resolveRuntimeProfile(
    (args.execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );
  const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
  if (!pricingPolicy.allowPartialFinalize) {
    return null;
  }

  const [artifactRow, runTotals] = await Promise.all([
    args.tx
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, args.execution.id)),
    args.tx
      .select({
        totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
      })
      .from(agentExecutionRuns)
      .where(eq(agentExecutionRuns.executionId, args.execution.id)),
  ]);

  const producedArtifactCount = Number(artifactRow[0]?.count ?? 0);
  const minimumArtifactsBeforePartialFinalize = Math.max(1, pricingPolicy.minimumArtifactsBeforePartialFinalize);
  if (producedArtifactCount < minimumArtifactsBeforePartialFinalize) {
    return null;
  }

  const billedCostUnits = await calculateExecutionBilledCostUnitsInTx(args.tx, args.execution.id);
  const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
    execution: args.execution,
    runtimeProfile,
  });
  const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
    execution: args.execution,
    runtimeProfile,
  });

  const continuationProjectedCostUnits =
    billedCostUnits + finalizeReserveCostUnits + env.agentExecutionArtifactCostUnits;
  const continuationProjectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) + finalizeReserveResourceMinutes + getArtifactResourceMinutes();
  const continuationProjectedStatus = getExecutionBudgetStatus({
    totalCostUnits: continuationProjectedCostUnits,
    totalResourceMinutes: continuationProjectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const continuationProjectedPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: continuationProjectedCostUnits,
    pricingPolicy,
  });
  const continuationPricingNearLimit = isExecutionPricingNearLimit({
    measuredCostUnits: continuationProjectedCostUnits,
    pricingPolicy,
  });
  const continuationNearLimit = continuationProjectedStatus === "near_limit" || continuationPricingNearLimit;
  const continuationWouldFail =
    continuationProjectedStatus === "exceeded" || continuationProjectedPricing.pricingCapExceeded;
  if (!continuationWouldFail && !continuationNearLimit) {
    return null;
  }

  const finalizeOnlyProjectedCostUnits = billedCostUnits + finalizeReserveCostUnits;
  const finalizeOnlyProjectedResourceMinutes =
    Number(runTotals[0]?.totalResourceMinutes ?? 0) + finalizeReserveResourceMinutes;
  const finalizeOnlyStatus = getExecutionBudgetStatus({
    totalCostUnits: finalizeOnlyProjectedCostUnits,
    totalResourceMinutes: finalizeOnlyProjectedResourceMinutes,
    budgetCostUnits: runtimeProfile.budgetCostUnits,
    budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
  });
  const finalizeOnlyPricing = applyExecutionPricingPolicyRules({
    measuredCostUnits: finalizeOnlyProjectedCostUnits,
    pricingPolicy,
  });
  if (finalizeOnlyStatus === "exceeded" || finalizeOnlyPricing.pricingCapExceeded) {
    return null;
  }

  const artifactRows = await args.tx
    .select()
    .from(agentExecutionArtifacts)
    .where(eq(agentExecutionArtifacts.executionId, args.execution.id))
    .orderBy(asc(agentExecutionArtifacts.createdAt));
  const targetArtifactCount = Math.max(1, args.execution.targetArtifactCount);
  const objectiveChecklist = normalizeObjectiveChecklist(args.execution.objectiveChecklist, args.execution.objective);
  const detail =
    continuationProjectedStatus === "exceeded"
      ? `Platform executor advanced directly to finalize because producing another artifact would exceed the runtime budget for profile ${runtimeProfile.key}, while finalize-only completion remains within headroom.`
      : continuationNearLimit
        ? `Platform executor advanced directly to finalize because producing another artifact would push runtime utilization into the near-limit zone (${Math.round(env.agentExecutionBudgetNearLimitThresholdPercent * 100)}%) for profile ${runtimeProfile.key}, while finalize-only completion remains within headroom.`
      : `Platform executor advanced directly to finalize because producing another artifact would exceed pricing policy ${pricingPolicy.key}, while finalize-only completion remains within headroom.`;
  const runtimeDecision = buildArtifactRuntimeDecision({
    phase: "produce_artifact",
    runtimeProfileKey: runtimeProfile.key,
    pricingPolicyKey: pricingPolicy.key,
    budgetStatus: continuationProjectedStatus,
    nearLimit: continuationNearLimit,
    pricingNearLimit: continuationPricingNearLimit,
    phaseTimeoutApproaching: false,
    adaptiveFinalize: true,
    partialArtifactCompletion: false,
    artifactCount: producedArtifactCount,
    targetArtifactCount,
    requestedArtifactsToProduce: 1,
    plannedArtifactsToProduce: 0,
    nearLimitArtifactsPerAdvanceCap: continuationNearLimit
      ? Math.max(1, runtimeProfile.nearLimitArtifactsPerAdvanceCap)
      : null,
    batchDownshiftApplied: false,
    finalizeEarlyReason: continuationNearLimit ? "near_limit" : "headroom",
    partialFinalizeBlocked: false,
  });

  const runtimeEnvelope = buildExecutionOutputEnvelope({
    kind: "runtime_result",
    title: "Platform executor runtime result",
    summary: `Execution advanced to finalize early after delivering ${producedArtifactCount}/${targetArtifactCount} artifacts under runtime headroom rules.`,
    generatedAt: now(),
    payload: {
      runtime: "platform_baseline",
      runtimeProfile: runtimeProfile.key,
      runtimePlanVersion: runtimeProfile.runtimePlanVersion,
      artifactMode: runtimeProfile.artifactMode,
      executionId: args.execution.id,
      phase: "finalize",
      artifactCount: producedArtifactCount,
      targetArtifactCount,
      artifactsProducedThisAdvance: 0,
      artifactsPerAdvance: runtimeProfile.artifactsPerAdvance,
      pricingPolicyKey: pricingPolicy.key,
      runtimeRuleLimited: true,
      adaptiveFinalize: true,
      budgetNearLimitTriggered: continuationNearLimit,
      runtimeDecision,
      objectiveChecklist,
      artifactSummaries: artifactRows.map((row) => row.summary),
    },
  });

  const [updatedExecution] = await args.tx
    .update(agentExecutions)
    .set({
      executorPhase: "finalize",
      progressPercent: Math.max(args.execution.progressPercent ?? 35, 80),
      statusNote: detail,
      ...toStoredExecutionOutputEnvelope(runtimeEnvelope),
      updatedAt: now(),
    })
    .where(eq(agentExecutions.id, args.execution.id))
    .returning();

  await recordExecutionStepInTx(args.tx, {
    executionId: args.execution.id,
    kind: "phase",
    phase: "produce_artifact",
    title: "Advanced to finalize under runtime decision rules",
    detail,
    status: "completed",
    progressPercent: 80,
  });
  await syncRuntimeManagedSubtasksInTx(args.tx, updatedExecution ?? args.execution, "advance");
  await touchRuntimeSessionInTx(args.tx, args.execution.id, {
    kind: "platform_executor",
    phase: "finalize",
    note: detail,
  });

  return updatedExecution;
}

export async function recordSettlementAttemptInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  settlement: typeof agentExecutionSettlements.$inferSelect;
  status: AgentExecutionSettlementAttemptStatus;
  note: string | null;
  error: string | null;
}) {
  await args.tx.insert(agentExecutionSettlementAttempts).values({
    id: crypto.randomUUID(),
    settlementId: args.settlement.id,
    executionId: args.settlement.executionId,
    ownerUserId: args.settlement.ownerUserId,
    agentId: args.settlement.agentId,
    currency: args.settlement.currency,
    billedAmount: args.settlement.billedAmount,
    revenueAmount: args.settlement.revenueAmount,
    status: args.status,
    note: args.note,
    error: args.error,
    createdAt: now(),
  });
}

export function isInsufficientBalanceError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("insufficient balance");
}

export async function settleExecutionById(executionId: string) {
  if (!env.agentExecutionBillingEnabled) {
    return getExecutionViewWithSettlement(executionId);
  }

  await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(agentExecutionSettlements)
      .where(eq(agentExecutionSettlements.executionId, executionId))
      .limit(1);
    if (!settlement) {
      return;
    }
    if (settlement.status === "settled" || settlement.status === "skipped") {
      return;
    }

    const timestamp = now();
    try {
      if (settlement.billedAmount > 0) {
        await transferBalance({
          fromUserId: settlement.ownerUserId,
          toUserId: settlement.treasuryUserId,
          currency: settlement.currency as CurrencyKey,
          amount: settlement.billedAmount,
          note: `Agent execution settlement for ${settlement.executionId}`,
          referenceType: "agentExecutionSettlement",
          referenceId: settlement.id,
          tx,
        });
      }

      if (
        settlement.revenueRecipientUserId &&
        settlement.revenueAmount > 0 &&
        settlement.revenueRecipientUserId !== settlement.treasuryUserId
      ) {
        await transferBalance({
          fromUserId: settlement.treasuryUserId,
          toUserId: settlement.revenueRecipientUserId,
          currency: settlement.currency as CurrencyKey,
          amount: settlement.revenueAmount,
          note: `Agent execution revenue share for ${settlement.executionId}`,
          referenceType: "agentExecutionRevenueShare",
          referenceId: settlement.id,
          tx,
        });
      }

      await tx
        .update(agentExecutionSettlements)
        .set({
          status: "settled",
          lastError: null,
          lastAttemptAt: timestamp,
          settledAt: timestamp,
          updatedAt: timestamp,
          note: "Execution settlement completed.",
        })
        .where(eq(agentExecutionSettlements.id, settlement.id));
      await recordSettlementAttemptInTx({
        tx,
        settlement,
        status: "settled",
        note: "Execution settlement completed.",
        error: null,
      });
    } catch (error) {
      const nextStatus = isInsufficientBalanceError(error) ? "pending_insufficient_balance" : "pending";
      const message = error instanceof Error ? error.message : "Unknown settlement error";
      await tx
        .update(agentExecutionSettlements)
        .set({
          status: nextStatus,
          lastError: message,
          lastAttemptAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(agentExecutionSettlements.id, settlement.id));
      await recordSettlementAttemptInTx({
        tx,
        settlement,
        status: nextStatus,
        note: null,
        error: message,
      });
    }
  });

  return getExecutionViewWithSettlement(executionId);
}

export async function runPendingAgentExecutionSettlements(args?: { limit?: number; executionId?: string }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 100));

  if (args?.executionId) {
    const execution = await settleExecutionById(args.executionId);
    return {
      settledCount: execution?.settlement?.status === "settled" ? 1 : 0,
      insufficientBalanceCount: execution?.settlement?.status === "pending_insufficient_balance" ? 1 : 0,
      skippedCount:
        !execution?.settlement || ["pending", "skipped"].includes(execution.settlement.status) ? 1 : 0,
    };
  }

  const rows = await db
    .select({ executionId: agentExecutionSettlements.executionId })
    .from(agentExecutionSettlements)
    .where(inArray(agentExecutionSettlements.status, ["pending", "pending_insufficient_balance"]))
    .orderBy(asc(agentExecutionSettlements.updatedAt))
    .limit(limit);

  let settledCount = 0;
  let insufficientBalanceCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const execution = await settleExecutionById(row.executionId);
    if (!execution?.settlement) {
      skippedCount += 1;
      continue;
    }
    if (execution.settlement.status === "settled") {
      settledCount += 1;
    } else if (execution.settlement.status === "pending_insufficient_balance") {
      insufficientBalanceCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    settledCount,
    insufficientBalanceCount,
    skippedCount,
  };
}

export async function listAgentExecutionSettlementAttempts(args?: {
  status?: AgentExecutionSettlementAttemptStatus;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const conditions: SQL[] = [];
  if (args?.status) {
    conditions.push(eq(agentExecutionSettlementAttempts.status, args.status));
  }
  const rows = await db
    .select()
    .from(agentExecutionSettlementAttempts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentExecutionSettlementAttempts.createdAt))
    .limit(limit);
  return rows.map(toAgentExecutionSettlementAttemptView);
}

export async function getAgentExecutionSettlementSummary(): Promise<AgentExecutionSettlementSummaryView> {
  const [counts, totals, recentAttempts] = await Promise.all([
    db
      .select({
        status: agentExecutionSettlements.status,
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionSettlements)
      .groupBy(agentExecutionSettlements.status),
    db
      .select({
        totalBilledAmount: sql<number>`coalesce(sum(${agentExecutionSettlements.billedAmount}), 0)::int`,
        totalRevenueAmount: sql<number>`coalesce(sum(${agentExecutionSettlements.revenueAmount}), 0)::int`,
      })
      .from(agentExecutionSettlements),
    db.select().from(agentExecutionSettlementAttempts).orderBy(desc(agentExecutionSettlementAttempts.createdAt)).limit(20),
  ]);

  const countMap = new Map(counts.map((row) => [row.status, Number(row.count ?? 0)]));
  return {
    pendingCount: countMap.get("pending") ?? 0,
    pendingInsufficientBalanceCount: countMap.get("pending_insufficient_balance") ?? 0,
    settledCount: countMap.get("settled") ?? 0,
    skippedCount: countMap.get("skipped") ?? 0,
    totalBilledAmount: Number(totals[0]?.totalBilledAmount ?? 0),
    totalRevenueAmount: Number(totals[0]?.totalRevenueAmount ?? 0),
    recentAttempts: recentAttempts.map(toAgentExecutionSettlementAttemptView),
  };
}

export async function retryAgentExecutionSettlement(executionId: string) {
  return settleExecutionById(executionId);
}
