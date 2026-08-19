import type {
  AgentExecutionRuntimeProfileKey,
  AgentExecutionStatus,
  PlatformExecutionPhase,
} from "@neuro/contracts";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import {
  buildArtifactRuntimeDecision,
  buildFinalizeCompletedRuntimeDecision,
  buildFinalizeRuntimeDecision,
  buildPrepareRuntimeDecision,
} from "@/modules/agent-execution/runtime-decision";
import {
  getAgentExecutionById,
} from "@/modules/agent-execution/repository";
import {
  agentExecutionArtifacts,
  agentExecutionRuns,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { agents } from "@/modules/agent-registry/schema";
import { NotFoundError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  addOwnedAgentExecutionArtifactInTx,
  updateOwnedAgentExecutionStatus,
} from "./executions";
import {
  buildExecutionOutputEnvelope,
  buildRuntimeProfileOwnerKey,
  getArtifactResourceMinutes,
  getExecutionPhaseAgeSeconds,
  getExecutionPhaseTimeoutSeconds,
  getExecutionRuntimeHeadroomSnapshot,
  getExecutionRuntimeNearLimitState,
  getFinalizeReserveCostUnitsForExecution,
  getFinalizeReserveResourceMinutesForExecution,
  getMaximumAffordableAdditionalArtifacts,
  getMaximumComfortableAdditionalArtifacts,
  getMinimumExecutionPhaseTimeoutSeconds,
  getRequiredFinalizePasses,
  getRequiredPreparePasses,
  isExecutionPhaseTimeoutApproaching,
  normalizeObjectiveChecklist,
  resolveExecutionPricingPolicy,
  resolveRuntimeProfile,
} from "./pricing";
import {
  countCompletedPhaseStepsInTx,
  createExecutionRunInTx,
  finishExecutionRun,
  finishExecutionRunInTx,
  recordExecutionStepInTx,
} from "./runs";
import {
  createRuntimeSessionInTx,
  finalizeRuntimeSessionInTx,
  getOpenRuntimeSessionInTx,
  touchRuntimeSessionInTx,
} from "./runtime-sessions";
import {
  buildRuntimeArtifactDescriptor,
  getRuntimePhaseChecklistContext,
  syncRuntimeManagedSubtasksInTx,
} from "./runtime-subtasks";
import {
  calculateExecutionBilledCostUnitsInTx,
  enforceExecutionBudgetInTx,
  maybeAdvanceExecutionToFinalizeInTx,
} from "./settlement";
import {
  acquireEphemeralLock,
  now,
  platformRuntimeLoopLockKey,
  platformRuntimeLoopLockTtlSeconds,
  releaseEphemeralLock,
  startEphemeralLockRenewal,
  toWhereClause,
} from "./shared";
import { toStoredExecutionOutputEnvelope } from "./views";

export async function getActiveExecutionRunId(
  executionId: string,
  connection: NodePgDatabase<typeof schema> = db,
) {
  const [run] = await connection
    .select({ id: agentExecutionRuns.id })
    .from(agentExecutionRuns)
    .where(
      and(
        eq(agentExecutionRuns.executionId, executionId),
        eq(agentExecutionRuns.runKind, "platform_executor"),
        eq(agentExecutionRuns.status, "running"),
      ),
    )
    .orderBy(desc(agentExecutionRuns.createdAt))
    .limit(1);

  return run?.id ?? null;
}

export async function ensureActivePlatformRun(args: {
  executionId: string;
  ownerUserId: string;
  agentId: string;
}) {
  const existingRunId = await getActiveExecutionRunId(args.executionId);
  if (existingRunId) {
    return existingRunId;
  }

  const created = await db.transaction(async (tx) => {
    const [execution] = await tx
      .select()
      .from(agentExecutions)
      .where(eq(agentExecutions.id, args.executionId))
      .limit(1)
      .for("update");
    if (!execution) {
      throw new NotFoundError("Agent execution not found");
    }

    const activeRunId = await getActiveExecutionRunId(args.executionId, tx);
    if (activeRunId) {
      return activeRunId;
    }

    const run = await createExecutionRunInTx(tx, {
      executionId: args.executionId,
      agentId: args.agentId,
      ownerUserId: args.ownerUserId,
      runKind: "platform_executor",
      summary: "Execution claimed by platform executor loop.",
    });

    const openSession = await getOpenRuntimeSessionInTx(tx, execution.id, "platform_executor");
    if (!openSession) {
      await createRuntimeSessionInTx(tx, {
        execution,
        runId: run.id,
        kind: "platform_executor",
        trigger: "worker_loop",
        state: "running",
        startedPhase: (execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare",
        note: "Platform executor claimed the execution for runtime processing.",
      });
    }
    return run.id;
  });

  return created;
}

export async function advancePlatformExecution(executionId: string) {
  const execution = await getAgentExecutionById(executionId);
  if (!execution) {
    throw new NotFoundError("Agent execution not found");
  }
  if (execution.status !== "running") {
    return {
      executionId,
      runId: (await getActiveExecutionRunId(executionId)) ?? null,
      advanced: false,
      phase: execution.executorPhase ?? null,
    };
  }

  const runId = await ensureActivePlatformRun({
    executionId: execution.id,
    ownerUserId: execution.ownerUserId,
    agentId: execution.agentId,
  });

  const phase = (execution.executorPhase as PlatformExecutionPhase | null) ?? "prepare";
  const runtimeProfile = resolveRuntimeProfile(
    (execution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
  );

  const adaptedToFinalize = await db.transaction(async (tx) =>
    maybeAdvanceExecutionToFinalizeInTx({
      tx,
      execution,
      runId,
    }),
  );
  if (adaptedToFinalize) {
    return { executionId, runId, advanced: true, phase: "finalize" as PlatformExecutionPhase };
  }

  const budgetStopped = await db.transaction(async (tx) =>
    enforceExecutionBudgetInTx({
      tx,
      execution,
      runId,
    }),
  );
  if (budgetStopped) {
    return { executionId, runId, advanced: false, phase: "done" as PlatformExecutionPhase };
  }

  if (phase === "prepare" || phase === "queued") {
    let nextPhase: PlatformExecutionPhase = "prepare";
    await db.transaction(async (tx) => {
      const completedPreparePasses = await countCompletedPhaseStepsInTx(tx, execution.id, "prepare");
      const preparePassNumber = completedPreparePasses + 1;
      const objectiveChecklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
      const basePreparePassesRequired = getRequiredPreparePasses({
        objectiveChecklist,
        runtimeProfile,
      });
      const prepareHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution, tx);
      const prepareTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "prepare",
      });
      const preparePassesRequired = prepareTimeoutApproaching
        ? Math.min(
            preparePassNumber,
            prepareHeadroom.nearLimit
              ? Math.min(basePreparePassesRequired, Math.max(1, runtimeProfile.nearLimitPreparePassesCap))
              : basePreparePassesRequired,
          )
        : prepareHeadroom.nearLimit
          ? Math.min(basePreparePassesRequired, Math.max(1, runtimeProfile.nearLimitPreparePassesCap))
          : basePreparePassesRequired;
      const prepareChecklistContext = getRuntimePhaseChecklistContext({
        objectiveChecklist,
        phase: "prepare",
        passNumber: preparePassNumber,
      });
      const isFinalPreparePass = preparePassNumber >= preparePassesRequired;
      const prepareNearLimitCapApplied =
        prepareHeadroom.nearLimit && preparePassesRequired < basePreparePassesRequired;
      const prepareTimeoutAccelerationApplied = prepareTimeoutApproaching && isFinalPreparePass;
      const prepareFocus = prepareChecklistContext
        ? ` Focus: ${prepareChecklistContext.entry.text}.`
        : "";
      nextPhase = isFinalPreparePass ? "produce_artifact" : "prepare";
      const progressPercent = isFinalPreparePass
        ? Math.max(execution.progressPercent ?? 0, 35)
        : Math.max(
            execution.progressPercent ?? 0,
            Math.min(34, 10 + Math.floor((preparePassNumber / preparePassesRequired) * 20)),
          );
      const prepareDetail = isFinalPreparePass
        ? prepareTimeoutApproaching
          ? `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and advanced early toward artifact production because the prepare timeout window was nearly exhausted.${prepareFocus}`
          : `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and advanced toward artifact production.${prepareFocus}`
        : `Platform executor completed prepare pass ${preparePassNumber}/${preparePassesRequired} and remains in prepare for additional runtime setup.${prepareFocus}`;
      const runtimeDecision = buildPrepareRuntimeDecision({
        phase: "prepare",
        runtimeProfileKey: runtimeProfile.key,
        pricingPolicyKey: prepareHeadroom.pricingPolicy.key,
        budgetStatus: prepareHeadroom.budgetStatus,
        nearLimit: prepareHeadroom.nearLimit,
        pricingNearLimit: prepareHeadroom.pricingNearLimit,
        phaseTimeoutApproaching: prepareTimeoutApproaching,
        preparePassNumber,
        preparePassesRequired,
        nearLimitCapApplied: prepareNearLimitCapApplied,
        timeoutAccelerationApplied: prepareTimeoutAccelerationApplied,
      });
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          executorPhase: nextPhase,
          progressPercent,
          statusNote: isFinalPreparePass
            ? prepareTimeoutApproaching
              ? `Platform executor advanced toward artifact production because prepare headroom was nearly exhausted.${prepareChecklistContext ? ` Focused checklist entry: ${prepareChecklistContext.entry.text}.` : ""}`
              : `Platform executor prepared execution context and advanced toward artifact production.${prepareChecklistContext ? ` Focused checklist entry: ${prepareChecklistContext.entry.text}.` : ""}`
            : `Platform executor is still preparing execution context (${preparePassNumber}/${preparePassesRequired}).${prepareChecklistContext ? ` Current focus: ${prepareChecklistContext.entry.text}.` : ""}`,
          ...toStoredExecutionOutputEnvelope(
            buildExecutionOutputEnvelope({
              kind: "runtime_result",
              title: "Platform executor runtime result",
              summary: prepareDetail,
              generatedAt: now(),
              payload: {
                runtime: "platform_baseline",
                runtimeProfile: runtimeProfile.key,
                runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                artifactMode: runtimeProfile.artifactMode,
                executionId: execution.id,
                phase: nextPhase,
                preparePass: preparePassNumber,
                preparePassesRequired,
                objectiveChecklist,
                focusedChecklistEntry: prepareChecklistContext?.entry ?? null,
                runtimeDecision,
              },
            }),
          ),
          updatedAt: now(),
        })
        .where(eq(agentExecutions.id, execution.id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "prepare",
        title: isFinalPreparePass
          ? prepareChecklistContext
            ? `Prepared ${prepareChecklistContext.entry.text}`
            : `Prepared execution context (${preparePassNumber}/${preparePassesRequired})`
          : prepareChecklistContext
            ? `Prepare ${prepareChecklistContext.entry.text} (${preparePassNumber}/${preparePassesRequired})`
            : `Prepare pass ${preparePassNumber}/${preparePassesRequired}`,
        detail: prepareDetail,
        status: "completed",
        progressPercent,
      });

      await syncRuntimeManagedSubtasksInTx(tx, updatedExecution ?? execution, "advance");
      await touchRuntimeSessionInTx(tx, execution.id, {
        kind: "platform_executor",
        phase: nextPhase,
        note: prepareDetail,
      });
    });

    return { executionId, runId, advanced: true, phase: nextPhase };
  }

  if (phase === "produce_artifact") {
    let nextPhase: PlatformExecutionPhase = "produce_artifact";
    let progressPercent = execution.progressPercent ?? 35;
    let haltedByRuntimeRules = false;
    await db.transaction(async (tx) => {
      const artifactRows = await tx
        .select()
        .from(agentExecutionArtifacts)
        .where(eq(agentExecutionArtifacts.executionId, execution.id))
        .orderBy(asc(agentExecutionArtifacts.createdAt));
      const targetArtifactCount = Math.max(1, execution.targetArtifactCount);
      const remainingArtifactCount = Math.max(0, targetArtifactCount - artifactRows.length);
      const artifactsPerAdvance = Math.max(1, runtimeProfile.artifactsPerAdvance);
      const pricingPolicy = resolveExecutionPricingPolicy(runtimeProfile.pricingPolicyKey, runtimeProfile.key);
      const allowPartialFinalize = pricingPolicy.allowPartialFinalize;
      const minimumArtifactsBeforePartialFinalize = Math.max(
        1,
        pricingPolicy.minimumArtifactsBeforePartialFinalize,
      );
      const [measuredCostUnits, runTotals] = await Promise.all([
        calculateExecutionBilledCostUnitsInTx(tx, execution.id),
        tx
          .select({
            totalResourceMinutes: sql<number>`coalesce(sum(${agentExecutionRuns.resourceMinutes}), 0)::int`,
          })
          .from(agentExecutionRuns)
          .where(eq(agentExecutionRuns.executionId, execution.id)),
      ]);
      const finalizeReserveCostUnits = getFinalizeReserveCostUnitsForExecution({
        execution,
        runtimeProfile,
      });
      const finalizeReserveResourceMinutes = getFinalizeReserveResourceMinutesForExecution({
        execution,
        runtimeProfile,
      });
      const currentResourceMinutes = Number(runTotals[0]?.totalResourceMinutes ?? 0);
      const affordableAdditionalArtifactsByPricing = getMaximumAffordableAdditionalArtifacts({
        measuredCostUnits,
        pricingPolicy,
        maxAdditionalArtifacts: remainingArtifactCount,
        reserveCostUnits: finalizeReserveCostUnits,
      });
      const affordableAdditionalArtifactsByBudget =
        runtimeProfile.budgetCostUnits === null
          ? remainingArtifactCount
          : env.agentExecutionArtifactCostUnits <= 0
            ? remainingArtifactCount
            : Math.max(
                0,
                Math.floor(
                  (runtimeProfile.budgetCostUnits - measuredCostUnits - finalizeReserveCostUnits) /
                    env.agentExecutionArtifactCostUnits,
                ),
              );
      const affordableAdditionalArtifactsByResourceBudget =
        runtimeProfile.budgetResourceMinutes === null
          ? remainingArtifactCount
          : getArtifactResourceMinutes() <= 0
            ? remainingArtifactCount
            : Math.max(
                0,
                Math.floor(
                  (runtimeProfile.budgetResourceMinutes -
                    currentResourceMinutes -
                    finalizeReserveResourceMinutes) /
                    getArtifactResourceMinutes(),
                ),
              );
      const affordableAdditionalArtifacts = Math.max(
        0,
        Math.min(
          remainingArtifactCount,
          affordableAdditionalArtifactsByPricing,
          affordableAdditionalArtifactsByBudget,
          affordableAdditionalArtifactsByResourceBudget,
        ),
      );
      const comfortableAdditionalArtifacts = Math.max(
        0,
        Math.min(
          affordableAdditionalArtifacts,
          getMaximumComfortableAdditionalArtifacts({
            measuredCostUnits,
            currentResourceMinutes,
            pricingPolicy,
            maxAdditionalArtifacts: remainingArtifactCount,
            reserveCostUnits: finalizeReserveCostUnits,
            reserveResourceMinutes: finalizeReserveResourceMinutes,
            budgetCostUnits: runtimeProfile.budgetCostUnits,
            budgetResourceMinutes: runtimeProfile.budgetResourceMinutes,
          }),
        ),
      );
      const runtimeNearLimitState = getExecutionRuntimeNearLimitState({
        measuredCostUnits,
        currentResourceMinutes,
        runtimeProfile,
        pricingPolicy,
      });
      const phaseTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "produce_artifact",
      });
      const naturalArtifactsToProduce = Math.max(1, Math.min(remainingArtifactCount || 1, artifactsPerAdvance));
      const nearLimitArtifactsPerAdvanceCap = runtimeNearLimitState.nearLimit
        ? Math.max(1, runtimeProfile.nearLimitArtifactsPerAdvanceCap)
        : null;
      const requestedArtifactsToProduce = Math.max(
        1,
        Math.min(naturalArtifactsToProduce, nearLimitArtifactsPerAdvanceCap ?? artifactsPerAdvance),
      );
      const pricingCapLimited =
        remainingArtifactCount > 0 &&
        affordableAdditionalArtifactsByPricing > 0 &&
        affordableAdditionalArtifactsByPricing < remainingArtifactCount;
      const runtimeBudgetLimited =
        remainingArtifactCount > 0 &&
        ((affordableAdditionalArtifactsByBudget >= 0 &&
          affordableAdditionalArtifactsByBudget < remainingArtifactCount) ||
          (affordableAdditionalArtifactsByResourceBudget >= 0 &&
            affordableAdditionalArtifactsByResourceBudget < remainingArtifactCount));
      const partialFinalizeBlocked =
        artifactRows.length > 0 &&
        remainingArtifactCount > 0 &&
        affordableAdditionalArtifacts === 0 &&
        (!allowPartialFinalize || artifactRows.length < minimumArtifactsBeforePartialFinalize);
      if (partialFinalizeBlocked) {
        const failureDetail = pricingCapLimited
            ? `Runtime profile ${runtimeProfile.key} hit pricing policy ${pricingPolicy.key} headroom after ${artifactRows.length}/${targetArtifactCount} artifacts, but partial finalize requires at least ${minimumArtifactsBeforePartialFinalize} artifacts under the current pricing rules.`
            : `Runtime profile ${runtimeProfile.key} exhausted runtime budget headroom after ${artifactRows.length}/${targetArtifactCount} artifacts, but partial finalize requires at least ${minimumArtifactsBeforePartialFinalize} artifacts under pricing policy ${pricingPolicy.key}.`;
        const runtimeDecision = buildArtifactRuntimeDecision({
          phase: "produce_artifact",
          runtimeProfileKey: runtimeProfile.key,
          pricingPolicyKey: pricingPolicy.key,
          budgetStatus: runtimeNearLimitState.budgetStatus,
          nearLimit: runtimeNearLimitState.nearLimit,
          pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
          phaseTimeoutApproaching,
          adaptiveFinalize: false,
          partialArtifactCompletion: true,
          artifactCount: artifactRows.length,
          targetArtifactCount,
          requestedArtifactsToProduce: naturalArtifactsToProduce,
          plannedArtifactsToProduce: 0,
          nearLimitArtifactsPerAdvanceCap,
          batchDownshiftApplied: false,
          finalizeEarlyReason: null,
          partialFinalizeBlocked: true,
        });
        const [failedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "failed",
            statusNote:
              "Platform executor stopped because runtime headroom was exhausted before partial finalize became eligible.",
            resultSummary: failureDetail,
            executorPhase: "done",
            progressPercent: 100,
            ...toStoredExecutionOutputEnvelope(
              buildExecutionOutputEnvelope({
                kind: "runtime_result",
                title: "Platform executor runtime result",
                summary: failureDetail,
                generatedAt: now(),
                payload: {
                  runtime: "platform_baseline",
                  runtimeProfile: runtimeProfile.key,
                  runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                  artifactMode: runtimeProfile.artifactMode,
                  executionId: execution.id,
                  phase: "done",
                  artifactCount: artifactRows.length,
                  targetArtifactCount,
                  artifactsProducedThisAdvance: 0,
                  artifactsPerAdvance,
                  pricingPolicyKey: pricingPolicy.key,
                  runtimeRuleLimited: true,
                  phaseTimeoutApproaching,
                  runtimeNearLimit: runtimeNearLimitState.nearLimit,
                  budgetNearLimit: runtimeNearLimitState.budgetStatus === "near_limit",
                  pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
                  nearLimitArtifactsPerAdvanceCap,
                  affordableAdditionalArtifacts,
                  comfortableAdditionalArtifacts,
                  partialArtifactCompletion: true,
                  runtimeDecision,
                  objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
                  artifactSummaries: artifactRows.map((row) => row.summary),
                },
              }),
            ),
            updatedAt: now(),
            completedAt: now(),
          })
          .where(eq(agentExecutions.id, execution.id))
          .returning();
        await finishExecutionRunInTx(tx, runId, {
          status: "failed",
          summary:
            "Platform executor stopped because runtime headroom was exhausted before partial finalize became eligible.",
          errorMessage: failureDetail,
          artifactCount: artifactRows.length,
        });
        await recordExecutionStepInTx(tx, {
          executionId: execution.id,
          kind: "phase",
          phase: "produce_artifact",
          title: "Runtime headroom exhausted",
          detail: failureDetail,
          status: "failed",
          progressPercent: 100,
        });
        if (failedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, failedExecution, "failed");
          await finalizeRuntimeSessionInTx(tx, execution.id, {
            kind: "platform_executor",
            state: "failed",
            endedPhase: "done",
            note: failureDetail,
          });
        }
        await enqueueOutboxEvent(
          "agentExecution.failed",
          {
            executionId: execution.id,
            ownerUserId: execution.ownerUserId,
            agentId: execution.agentId,
            taskId: execution.taskId,
            trigger: pricingCapLimited ? "pricing_cap_exceeded" : "budget_exceeded",
          },
          tx,
        );
        nextPhase = "done";
        progressPercent = 100;
        haltedByRuntimeRules = true;
        return;
      }
      const finalizeEarlyForRuntimeRules =
          (phaseTimeoutApproaching &&
            allowPartialFinalize &&
            artifactRows.length >= minimumArtifactsBeforePartialFinalize &&
            remainingArtifactCount > 0) ||
          allowPartialFinalize &&
          artifactRows.length >= minimumArtifactsBeforePartialFinalize &&
          remainingArtifactCount > 0 &&
          affordableAdditionalArtifacts === 0;
      const artifactsToProduce = finalizeEarlyForRuntimeRules
        ? 0
        : comfortableAdditionalArtifacts > 0
          ? Math.max(1, Math.min(requestedArtifactsToProduce, comfortableAdditionalArtifacts))
          : Math.max(1, Math.min(requestedArtifactsToProduce, affordableAdditionalArtifacts || requestedArtifactsToProduce));
      const producedSummaries: string[] = [];
      let lastArtifactExecution = execution;

      for (let index = 0; index < artifactsToProduce; index += 1) {
        const nextArtifactNumber = artifactRows.length + index + 1;
        const runtimeArtifact = buildRuntimeArtifactDescriptor({
          execution,
          runtimeProfile,
          producedArtifactCount: nextArtifactNumber,
        });
        const artifactSummary = `${runtimeArtifact.summary} (${nextArtifactNumber}/${targetArtifactCount})`;
        producedSummaries.push(artifactSummary);
        lastArtifactExecution = await addOwnedAgentExecutionArtifactInTx(tx, execution, {
          kind: "note",
          title: runtimeArtifact.title,
          summary: artifactSummary,
        });
      }

      const producedArtifactCount = artifactRows.length + artifactsToProduce;
      const hasRemainingArtifacts = producedArtifactCount < targetArtifactCount;
      const finalizeEarlyAfterThisAdvance =
        hasRemainingArtifacts &&
        (pricingCapLimited || runtimeBudgetLimited) &&
        affordableAdditionalArtifacts <= artifactsToProduce;
      nextPhase =
        finalizeEarlyForRuntimeRules || finalizeEarlyAfterThisAdvance
          ? "finalize"
          : hasRemainingArtifacts
            ? "produce_artifact"
            : "finalize";
      progressPercent =
        nextPhase === "finalize"
          ? 80
          : Math.min(85, 35 + Math.floor((producedArtifactCount / targetArtifactCount) * 40));
      const artifactSummary = finalizeEarlyForRuntimeRules
        ? phaseTimeoutApproaching
          ? `Runtime approached the phase timeout after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize early.`
          : `Runtime exhausted execution headroom after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize early.`
        : producedSummaries.length > 1
          ? `${producedSummaries[0]} + ${producedSummaries.length - 1} more artifact(s)`
          : producedSummaries[0] ??
            `Platform executor advanced artifact production (${producedArtifactCount}/${targetArtifactCount}).`;
      const batchDownshiftApplied =
        remainingArtifactCount > 0 && artifactsToProduce > 0 && artifactsToProduce < naturalArtifactsToProduce;
      const runtimeDecision = buildArtifactRuntimeDecision({
        phase: "produce_artifact",
        runtimeProfileKey: runtimeProfile.key,
        pricingPolicyKey: pricingPolicy.key,
        budgetStatus: runtimeNearLimitState.budgetStatus,
        nearLimit: runtimeNearLimitState.nearLimit,
        pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
        phaseTimeoutApproaching,
        adaptiveFinalize: false,
        partialArtifactCompletion: false,
        artifactCount: producedArtifactCount,
        targetArtifactCount,
        requestedArtifactsToProduce: naturalArtifactsToProduce,
        plannedArtifactsToProduce: artifactsToProduce,
        nearLimitArtifactsPerAdvanceCap,
        batchDownshiftApplied,
        finalizeEarlyReason: finalizeEarlyForRuntimeRules
          ? phaseTimeoutApproaching
            ? "timeout"
            : "headroom"
          : finalizeEarlyAfterThisAdvance
            ? "headroom"
            : null,
        partialFinalizeBlocked: false,
      });
      const runtimeEnvelope = buildExecutionOutputEnvelope({
        kind: "runtime_result",
        title: "Platform executor runtime result",
        summary: artifactSummary,
        generatedAt: now(),
        payload: {
          runtime: "platform_baseline",
          runtimeProfile: runtimeProfile.key,
          runtimePlanVersion: runtimeProfile.runtimePlanVersion,
          artifactMode: runtimeProfile.artifactMode,
          executionId: execution.id,
          phase: nextPhase,
          artifactCount: producedArtifactCount,
          targetArtifactCount,
          artifactsProducedThisAdvance: artifactsToProduce,
          artifactsPerAdvance,
          pricingPolicyKey: pricingPolicy.key,
          pricingCapLimited: pricingCapLimited,
          runtimeBudgetLimited,
          resourceBudgetLimited:
            remainingArtifactCount > 0 &&
            affordableAdditionalArtifactsByResourceBudget >= 0 &&
            affordableAdditionalArtifactsByResourceBudget < remainingArtifactCount,
          runtimeRuleLimited: finalizeEarlyForRuntimeRules || finalizeEarlyAfterThisAdvance,
          phaseTimeoutApproaching,
          runtimeNearLimit: runtimeNearLimitState.nearLimit,
          budgetNearLimit: runtimeNearLimitState.budgetStatus === "near_limit",
          pricingNearLimit: runtimeNearLimitState.pricingNearLimit,
          nearLimitArtifactsPerAdvanceCap,
          requestedArtifactsToProduce: naturalArtifactsToProduce,
          plannedArtifactsToProduce: artifactsToProduce,
          affordableAdditionalArtifacts,
          comfortableAdditionalArtifacts,
          runtimeDecision,
          objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
          artifactSummaries: producedSummaries,
        },
      });
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          executorPhase: nextPhase,
          progressPercent,
          statusNote: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Platform executor approached the phase timeout after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
              : `Platform executor exhausted runtime headroom after ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
            : finalizeEarlyAfterThisAdvance
              ? `Platform executor hit the runtime headroom for further artifact production at ${producedArtifactCount}/${targetArtifactCount} artifacts and advanced to finalize.`
              : hasRemainingArtifacts
                ? `Platform executor generated artifact ${producedArtifactCount}/${targetArtifactCount}.`
                : "Platform executor generated the full artifact package and moved into finalize.",
          ...toStoredExecutionOutputEnvelope(runtimeEnvelope),
          updatedAt: now(),
        })
        .where(eq(agentExecutions.id, execution.id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "produce_artifact",
        title: finalizeEarlyForRuntimeRules
          ? phaseTimeoutApproaching
            ? "Advanced to finalize under phase-timeout pressure"
            : "Advanced to finalize under runtime headroom"
          : artifactsToProduce > 1
            ? hasRemainingArtifacts && !finalizeEarlyAfterThisAdvance
              ? `Produced artifact batch to ${producedArtifactCount}/${targetArtifactCount}`
              : "Produced final artifact batch"
            : hasRemainingArtifacts && !finalizeEarlyAfterThisAdvance
              ? `Produced artifact ${producedArtifactCount}/${targetArtifactCount}`
              : "Produced final artifact package",
          detail: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) approached the phase timeout and moved to finalize with a partial artifact set after reaching the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
              : `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) could not afford more artifacts under the current pricing/budget rules, so execution advanced to finalize with a partial artifact set after reaching the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
            : finalizeEarlyAfterThisAdvance
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) produced the last runtime-affordable artifact batch (${artifactsToProduce}) and moved the execution into finalize early.`
              : hasRemainingArtifacts
              ? `Runtime profile ${runtimeProfile.key} (${runtimeProfile.artifactMode}) produced ${artifactsToProduce} artifact(s) and requires more before finalize.`
              : `Platform executor generated the final ${artifactsToProduce} artifact(s) and moved the execution into finalize.`,
        status: "completed",
        progressPercent,
      });

      await syncRuntimeManagedSubtasksInTx(tx, updatedExecution ?? lastArtifactExecution, "advance");
      await touchRuntimeSessionInTx(tx, execution.id, {
        kind: "platform_executor",
        phase: nextPhase,
          note: finalizeEarlyForRuntimeRules
            ? phaseTimeoutApproaching
              ? `Platform executor advanced to finalize because the phase timeout was nearly exhausted after ${producedArtifactCount}/${targetArtifactCount} artifacts and the execution had reached the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
              : `Platform executor advanced to finalize because runtime headroom was exhausted after ${producedArtifactCount}/${targetArtifactCount} artifacts and the execution had reached the minimum partial-finalize threshold (${minimumArtifactsBeforePartialFinalize}).`
            : finalizeEarlyAfterThisAdvance
              ? `Platform executor moved to finalize because runtime headroom only allowed ${producedArtifactCount}/${targetArtifactCount} artifacts.`
              : hasRemainingArtifacts
              ? `Platform executor remains in artifact production (${producedArtifactCount}/${targetArtifactCount}) after producing ${artifactsToProduce} artifact(s).`
              : `Platform executor produced the target artifact package with a final batch of ${artifactsToProduce} artifact(s).`,
      });
    });

    if (haltedByRuntimeRules) {
      return { executionId, runId, advanced: false, phase: "done" as PlatformExecutionPhase };
    }
    return { executionId, runId, advanced: true, phase: nextPhase };
  }

  if (phase === "finalize") {
    const completedExecution = await db.transaction(async (tx) => {
      const completedFinalizePasses = await countCompletedPhaseStepsInTx(tx, execution.id, "finalize");
      const finalizePassNumber = completedFinalizePasses + 1;
      const objectiveChecklist = normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective);
      const baseFinalizePassesRequired = getRequiredFinalizePasses({
        objectiveChecklist,
        runtimeProfile,
      });
      const finalizeHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution, tx);
      const finalizeTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: execution.updatedAt,
        status: execution.status as AgentExecutionStatus,
        phase: "finalize",
      });
      const finalizePassesRequired = finalizeTimeoutApproaching
        ? Math.min(
            finalizePassNumber,
            finalizeHeadroom.nearLimit
              ? Math.min(baseFinalizePassesRequired, Math.max(1, runtimeProfile.nearLimitFinalizePassesCap))
              : baseFinalizePassesRequired,
          )
        : finalizeHeadroom.nearLimit
          ? Math.min(baseFinalizePassesRequired, Math.max(1, runtimeProfile.nearLimitFinalizePassesCap))
          : baseFinalizePassesRequired;
      const finalizeChecklistContext = getRuntimePhaseChecklistContext({
        objectiveChecklist,
        phase: "finalize",
        passNumber: finalizePassNumber,
      });
      const isFinalFinalizePass = finalizePassNumber >= finalizePassesRequired;
      const finalizeNearLimitCapApplied =
        finalizeHeadroom.nearLimit && finalizePassesRequired < baseFinalizePassesRequired;
      const finalizeTimeoutAccelerationApplied = finalizeTimeoutApproaching && isFinalFinalizePass;
      const artifactSummary = `Platform executor processed objective: ${execution.id}. This is the first internal execution-plane baseline result.`;

      if (!isFinalFinalizePass) {
        const progressPercent = Math.max(
          execution.progressPercent ?? 80,
          Math.min(95, 80 + Math.floor((finalizePassNumber / finalizePassesRequired) * 15)),
        );
        const detail = `Platform executor completed finalize pass ${finalizePassNumber}/${finalizePassesRequired} and remains in finalize for additional runtime consolidation.${finalizeChecklistContext ? ` Focus: ${finalizeChecklistContext.entry.text}.` : ""}`;
        const runtimeDecision = buildFinalizeRuntimeDecision({
          phase: "finalize",
          runtimeProfileKey: runtimeProfile.key,
          pricingPolicyKey: finalizeHeadroom.pricingPolicy.key,
          budgetStatus: finalizeHeadroom.budgetStatus,
          nearLimit: finalizeHeadroom.nearLimit,
          pricingNearLimit: finalizeHeadroom.pricingNearLimit,
          phaseTimeoutApproaching: finalizeTimeoutApproaching,
          finalizePassNumber,
          finalizePassesRequired,
          nearLimitCapApplied: finalizeNearLimitCapApplied,
          timeoutAccelerationApplied: finalizeTimeoutAccelerationApplied,
        });
        await tx
          .update(agentExecutions)
          .set({
            executorPhase: "finalize",
            progressPercent,
            statusNote: `Platform executor is finalizing runtime output (${finalizePassNumber}/${finalizePassesRequired}).${finalizeChecklistContext ? ` Current focus: ${finalizeChecklistContext.entry.text}.` : ""}`,
            ...toStoredExecutionOutputEnvelope(
              buildExecutionOutputEnvelope({
                kind: "runtime_result",
                title: "Platform executor runtime result",
                summary: artifactSummary,
                generatedAt: now(),
                payload: {
                  runtime: "platform_baseline",
                  runtimeProfile: runtimeProfile.key,
                  runtimePlanVersion: runtimeProfile.runtimePlanVersion,
                  artifactMode: runtimeProfile.artifactMode,
                  executionId: execution.id,
                  phase: "finalize",
                  finalizePass: finalizePassNumber,
                  finalizePassesRequired,
                  targetArtifactCount: execution.targetArtifactCount,
                  runtimeDecision,
                  objectiveChecklist,
                  focusedChecklistEntry: finalizeChecklistContext?.entry ?? null,
                },
              }),
            ),
            updatedAt: now(),
          })
          .where(eq(agentExecutions.id, execution.id));
        await recordExecutionStepInTx(tx, {
          executionId: execution.id,
          kind: "phase",
          phase: "finalize",
          title: finalizeChecklistContext
            ? `Finalize ${finalizeChecklistContext.entry.text} (${finalizePassNumber}/${finalizePassesRequired})`
            : `Finalize pass ${finalizePassNumber}/${finalizePassesRequired}`,
          detail,
          status: "completed",
          progressPercent,
        });
        await touchRuntimeSessionInTx(tx, execution.id, {
          kind: "platform_executor",
          phase: "finalize",
          note: detail,
        });
        return false;
      }
      return true;
    });

    if (!completedExecution) {
      return { executionId, runId, advanced: true, phase: "finalize" as PlatformExecutionPhase };
    }

    const [artifactCountRow] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(agentExecutionArtifacts)
      .where(eq(agentExecutionArtifacts.executionId, execution.id));
    const actualArtifactCount = Number(artifactCountRow?.count ?? 0);
    const partialArtifactCompletion = actualArtifactCount < execution.targetArtifactCount;
    const finalHeadroom = await getExecutionRuntimeHeadroomSnapshot(execution);
    const artifactSummary = partialArtifactCompletion
      ? `Platform executor finalized a pricing-aware partial runtime result with ${actualArtifactCount}/${execution.targetArtifactCount} artifacts.`
      : `Platform executor processed objective: ${execution.id}. This is the first internal execution-plane baseline result.`;
    const runtimeDecision = buildFinalizeCompletedRuntimeDecision({
      phase: "finalize",
      runtimeProfileKey: runtimeProfile.key,
      pricingPolicyKey: finalHeadroom.pricingPolicy.key,
      budgetStatus: finalHeadroom.budgetStatus,
      nearLimit: finalHeadroom.nearLimit,
      pricingNearLimit: finalHeadroom.pricingNearLimit,
      phaseTimeoutApproaching: false,
      artifactCount: actualArtifactCount,
      targetArtifactCount: execution.targetArtifactCount,
      partialArtifactCompletion,
    });
    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "submitted",
      statusNote: partialArtifactCompletion
        ? "Platform executor produced a partial result package under runtime pricing constraints."
        : "Platform executor produced a result package.",
      resultSummary: artifactSummary,
    });

    await updateOwnedAgentExecutionStatus(execution.ownerUserId, execution.id, {
      status: "completed",
      statusNote: partialArtifactCompletion
        ? "Platform executor completed successfully with a pricing-aware partial result."
        : "Platform executor completed successfully.",
      resultSummary: artifactSummary,
    });

    await db
      .update(agentExecutions)
      .set({
        ...toStoredExecutionOutputEnvelope(
          buildExecutionOutputEnvelope({
            kind: "runtime_result",
            title: "Platform executor runtime result",
            summary: artifactSummary,
            generatedAt: now(),
            payload: {
              runtime: "platform_baseline",
              runtimeProfile: runtimeProfile.key,
              runtimePlanVersion: runtimeProfile.runtimePlanVersion,
              artifactMode: runtimeProfile.artifactMode,
              executionId: execution.id,
              phase: "done",
              artifactCount: actualArtifactCount,
              targetArtifactCount: execution.targetArtifactCount,
              completionMode: "auto_finalize",
              objectiveChecklist: normalizeObjectiveChecklist(execution.objectiveChecklist, execution.objective),
              finalStatus: "completed",
              partialArtifactCompletion,
              runtimeDecision,
            },
          }),
        ),
        updatedAt: now(),
      })
      .where(eq(agentExecutions.id, execution.id));

    await finishExecutionRun(runId, {
      status: "completed",
      summary: "Platform executor completed after phased execution progress.",
      artifactCount: actualArtifactCount,
    });

    await db.transaction(async (tx) => {
      await recordExecutionStepInTx(tx, {
        executionId: execution.id,
        kind: "phase",
        phase: "finalize",
        title: "Finalized platform execution",
        detail: partialArtifactCompletion
          ? `Platform executor finished finalize with a partial artifact package (${actualArtifactCount}/${execution.targetArtifactCount}) after runtime pricing decisions.`
          : "Platform executor finished its finalize phase and marked the execution as completed.",
        status: "completed",
        progressPercent: 100,
      });
    });

    return { executionId, runId, advanced: true, phase: "done" as PlatformExecutionPhase };
  }

  return { executionId, runId, advanced: false, phase };
}

export async function runPlatformExecutor(args?: { limit?: number; agentId?: string; ownerUserId?: string }) {
  const lockToken = await acquireEphemeralLock(platformRuntimeLoopLockKey, platformRuntimeLoopLockTtlSeconds);
  if (!lockToken) {
    return {
      processedCount: 0,
      failedCount: 0,
      results: [],
      failures: [],
    };
  }

  const stopLockRenewal = startEphemeralLockRenewal(
    platformRuntimeLoopLockKey,
    lockToken,
    platformRuntimeLoopLockTtlSeconds,
  );

  try {
  const limit = Math.max(1, Math.min(args?.limit ?? 3, 20));
  const claimedRows = await db.transaction(async (tx) => {
    const runningRows = await tx.execute(sql`
      select ae.runtime_profile_key, count(*)::int as count
      from agent_executions ae
      inner join agents a on a.id = ae.agent_id
      where ae.status = 'running'
        and a.source_type = 'platform'
        and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
        and a.enabled = true
      group by ae.runtime_profile_key
    `);
    const runningOwnerRows = await tx.execute(sql`
      select ae.runtime_profile_key, ae.owner_user_id, count(*)::int as count
      from agent_executions ae
      inner join agents a on a.id = ae.agent_id
      where ae.status = 'running'
        and a.source_type = 'platform'
        and coalesce(a.hosting_mode, 'registry_only') not in ('managed_api', 'managed_light')
        and a.enabled = true
      group by ae.runtime_profile_key, ae.owner_user_id
    `);
    const runningCountByProfile = new Map<string, number>();
    const runningCountByProfileOwner = new Map<string, number>();
    for (const row of runningRows.rows as Array<{ runtime_profile_key: string | null; count: number }>) {
      const key = row.runtime_profile_key?.trim() || "baseline";
      runningCountByProfile.set(key, Number(row.count) || 0);
    }
    for (const row of runningOwnerRows.rows as Array<{ runtime_profile_key: string | null; owner_user_id: string | null; count: number }>) {
      const runtimeProfileKey = row.runtime_profile_key?.trim() || "baseline";
      const ownerUserId = row.owner_user_id?.trim();
      if (!ownerUserId) continue;
      runningCountByProfileOwner.set(
        buildRuntimeProfileOwnerKey(runtimeProfileKey, ownerUserId),
        Number(row.count) || 0,
      );
    }

    const candidateFetchLimit = Math.max(limit * 5, 20);
    const executorScopeWhereClause = toWhereClause([
      eq(agentExecutions.status, "queued"),
      eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
      eq(agents.enabled, true),
      ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
      ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
    ]);
    const rows = await tx.execute(sql`
      select
        ${agentExecutions.id} as execution_id,
        ${agentExecutions.ownerUserId} as owner_user_id,
        ${agentExecutions.agentId} as agent_id,
        ${agentExecutions.taskId} as task_id,
        ${agentExecutions.runtimeProfileKey} as runtime_profile_key
      from ${agentExecutions}
      inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
      where ${executorScopeWhereClause ?? sql`true`}
      order by ${agentExecutions.createdAt} asc
      limit ${candidateFetchLimit}
      for update skip locked
    `);

    const timestamp = now();
    const candidates = rows.rows as Array<{
      execution_id: string;
      owner_user_id: string;
      agent_id: string;
      task_id: string | null;
      runtime_profile_key: string | null;
    }>;
    const claimed = candidates
      .filter((row) => {
        const runtimeProfileKey = (row.runtime_profile_key?.trim() || "baseline") as AgentExecutionRuntimeProfileKey;
        const runtimeProfile = resolveRuntimeProfile(runtimeProfileKey);
        const ownerConcurrencyKey = buildRuntimeProfileOwnerKey(runtimeProfile.key, row.owner_user_id);
        if (runtimeProfile.maxConcurrentExecutions === null) {
          if (runtimeProfile.maxConcurrentExecutionsPerOwner === null) {
            return true;
          }
          const runningCountByOwner = runningCountByProfileOwner.get(ownerConcurrencyKey) ?? 0;
          if (runningCountByOwner >= runtimeProfile.maxConcurrentExecutionsPerOwner) {
            return false;
          }
          runningCountByProfileOwner.set(ownerConcurrencyKey, runningCountByOwner + 1);
          return true;
        }
        const runningCount = runningCountByProfile.get(runtimeProfile.key) ?? 0;
        if (runningCount >= runtimeProfile.maxConcurrentExecutions) {
          return false;
        }
        if (runtimeProfile.maxConcurrentExecutionsPerOwner !== null) {
          const runningCountByOwner = runningCountByProfileOwner.get(ownerConcurrencyKey) ?? 0;
          if (runningCountByOwner >= runtimeProfile.maxConcurrentExecutionsPerOwner) {
            return false;
          }
          runningCountByProfileOwner.set(ownerConcurrencyKey, runningCountByOwner + 1);
        }
        runningCountByProfile.set(runtimeProfile.key, runningCount + 1);
        return true;
      })
      .slice(0, limit);

    for (const row of claimed) {
      const [updatedExecution] = await tx
        .update(agentExecutions)
        .set({
          status: "running",
          statusNote: "Platform executor claimed this execution.",
          executorPhase: "prepare",
          progressPercent: 10,
          startedAt: timestamp,
          updatedAt: timestamp,
        })
        .where(eq(agentExecutions.id, row.execution_id))
        .returning();

      await recordExecutionStepInTx(tx, {
        executionId: row.execution_id,
        kind: "phase",
        phase: "prepare",
        title: "Claimed by platform executor",
        detail: "Worker claimed the queued execution and moved it into the prepare phase.",
        status: "info",
        progressPercent: 10,
      });

      await enqueueOutboxEvent(
        "agentExecution.started",
        {
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          agentId: row.agent_id,
          taskId: row.task_id,
        },
        tx,
      );

      if (updatedExecution) {
        await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "claim");
      }
    }

    return claimed;
  });

  const existingRunningWhereClause = toWhereClause([
    eq(agentExecutions.status, "running"),
    eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
    eq(agents.enabled, true),
    ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
    ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
  ]);
  const existingRunningRows = await db.execute(sql`
    select ${agentExecutions.id} as execution_id, ${agentExecutions.ownerUserId} as owner_user_id
    from ${agentExecutions}
    inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
    where ${existingRunningWhereClause ?? sql`true`}
    order by ${agentExecutions.updatedAt} asc
    limit ${limit}
  `);

  const candidateMap = new Map<string, { executionId: string; ownerUserId: string }>();
  for (const row of claimedRows) {
    candidateMap.set(row.execution_id, {
      executionId: row.execution_id,
      ownerUserId: row.owner_user_id,
    });
  }
  for (const row of existingRunningRows.rows as Array<{ execution_id: string; owner_user_id: string }>) {
    if (!candidateMap.has(row.execution_id)) {
      candidateMap.set(row.execution_id, {
        executionId: row.execution_id,
        ownerUserId: row.owner_user_id,
      });
    }
  }

  const results: Array<{
    executionId: string;
    ownerUserId: string;
    runId: string | null;
    phase: string | null;
    advancesPerformed: number;
  }> = [];
  const failures: Array<{ executionId: string; runId: string | null; message: string }> = [];

  for (const row of candidateMap.values()) {
    const executionId = row.executionId;
    const ownerUserId = row.ownerUserId;
    try {
      const latestExecution = await getAgentExecutionById(executionId);
      if (!latestExecution) {
        failures.push({ executionId, runId: null, message: "Execution disappeared before runtime processing." });
        continue;
      }
      const runtimeProfile = resolveRuntimeProfile(
        (latestExecution.runtimeProfileKey as AgentExecutionRuntimeProfileKey | null) ?? "baseline",
      );
      const runtimeHeadroom = await getExecutionRuntimeHeadroomSnapshot(latestExecution);
      const phaseTimeoutApproaching = isExecutionPhaseTimeoutApproaching({
        updatedAt: latestExecution.updatedAt,
        status: latestExecution.status as AgentExecutionStatus,
        phase: (latestExecution.executorPhase as PlatformExecutionPhase | null) ?? null,
      });
      const maxAdvances = phaseTimeoutApproaching
        ? 1
        : runtimeHeadroom.nearLimit
          ? Math.max(1, Math.min(runtimeProfile.phaseAdvancesPerRun, runtimeProfile.nearLimitPhaseAdvancesPerRunCap))
          : Math.max(1, runtimeProfile.phaseAdvancesPerRun);
      let lastPhase: string | null = latestExecution.executorPhase ?? null;
      let advancesPerformed = 0;
      for (let index = 0; index < maxAdvances; index += 1) {
        const result = await advancePlatformExecution(executionId);
        const runId = result.runId ?? null;
        lastPhase = result.phase;
        if (!result.advanced) {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
          break;
        }
        advancesPerformed += 1;
        if (result.phase === "done") {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
          break;
        }
        if (index === maxAdvances - 1) {
          results.push({ executionId, ownerUserId, runId, phase: lastPhase, advancesPerformed });
        }
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unknown platform executor failure";
      const runId = await getActiveExecutionRunId(executionId);
      if (runId) {
        await finishExecutionRun(runId, {
          status: "failed",
          summary: "Platform executor failed while processing the execution.",
          errorMessage: message,
          artifactCount: 0,
        });
      }
      failures.push({ executionId, runId: runId ?? null, message });
    }
  }

  return {
    processedCount: results.length,
    failedCount: failures.length,
    results,
    failures,
  };
  } finally {
    stopLockRenewal();
    await releaseEphemeralLock(platformRuntimeLoopLockKey, lockToken);
  }
}

export async function recoverStalePlatformExecutions(args?: {
  limit?: number;
  staleSeconds?: number;
  agentId?: string;
  ownerUserId?: string;
}) {
  const lockToken = await acquireEphemeralLock(platformRuntimeLoopLockKey, platformRuntimeLoopLockTtlSeconds);
  const staleSeconds = getMinimumExecutionPhaseTimeoutSeconds(args?.staleSeconds ?? null);
  if (!lockToken) {
    return {
      recoveredCount: 0,
      exhaustedCount: 0,
      staleSeconds,
      results: [],
    };
  }


  const stopLockRenewal = startEphemeralLockRenewal(
    platformRuntimeLoopLockKey,
    lockToken,
    platformRuntimeLoopLockTtlSeconds,
  );

  try {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 50));
  const actionResults = await db.transaction(async (tx) => {
    const recoveryWhereClause = toWhereClause([
      eq(agentExecutions.status, "running"),
      eq(agents.sourceType, "platform"),
        sql`coalesce(${agents.hostingMode}, 'registry_only') not in ('managed_api', 'managed_light')`,
      eq(agents.enabled, true),
      sql`${agentExecutions.updatedAt} <= now() - (${staleSeconds} * interval '1 second')`,
      ...(args?.agentId ? [eq(agentExecutions.agentId, args.agentId)] : []),
      ...(args?.ownerUserId ? [eq(agentExecutions.ownerUserId, args.ownerUserId)] : []),
    ]);

    const rows = await tx.execute(sql`
      select
        ${agentExecutions.id} as execution_id,
        ${agentExecutions.ownerUserId} as owner_user_id,
        ${agentExecutions.agentId} as agent_id,
        ${agentExecutions.taskId} as task_id,
        ${agentExecutions.executorPhase} as executor_phase,
        ${agentExecutions.updatedAt} as updated_at,
        ${agentExecutions.autoRecoveryCount} as auto_recovery_count,
        ${agentExecutions.maxAutoRecoveryCount} as max_auto_recovery_count
      from ${agentExecutions}
      inner join ${agents} on ${agents.id} = ${agentExecutions.agentId}
      where ${recoveryWhereClause ?? sql`true`}
      order by ${agentExecutions.updatedAt} asc
      limit ${limit}
      for update skip locked
    `);

    const timestamp = now();
    const recovered = rows.rows as Array<{
      execution_id: string;
      owner_user_id: string;
      agent_id: string;
      task_id: string | null;
      executor_phase: string | null;
      updated_at: Date;
      auto_recovery_count: number;
      max_auto_recovery_count: number;
      run_id?: string;
    }>;
    const handledResults: Array<{
      executionId: string;
      ownerUserId: string;
      action: "requeued" | "exhausted";
      runId: string;
    }> = [];

    for (const row of recovered) {
      const phaseTimeoutSeconds = getExecutionPhaseTimeoutSeconds(
        (row.executor_phase as PlatformExecutionPhase | null) ?? null,
        args?.staleSeconds ?? null,
      );
      const phaseAgeSeconds = getExecutionPhaseAgeSeconds({
        updatedAt: row.updated_at,
        status: "running",
        phase: (row.executor_phase as PlatformExecutionPhase | null) ?? null,
      });
      if (phaseAgeSeconds === null || phaseAgeSeconds < phaseTimeoutSeconds) {
        continue;
      }

      const activeRunId = await getActiveExecutionRunId(row.execution_id, tx);
      if (activeRunId) {
        await finishExecutionRunInTx(tx, activeRunId, {
          status: "failed",
          summary: "Recovery watchdog marked the stale platform execution as interrupted.",
          errorMessage: `Execution exceeded phase timeout of ${phaseTimeoutSeconds} seconds.`,
          artifactCount: 0,
        });
      }

      const nextAutoRecoveryCount = Number(row.auto_recovery_count ?? 0) + 1;
      const maxAutoRecoveryCount = Number(row.max_auto_recovery_count ?? env.agentExecutionMaxAutoRecoveries);
      const recoveryBudgetExhausted = nextAutoRecoveryCount > maxAutoRecoveryCount;

      if (recoveryBudgetExhausted) {
        const [updatedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "failed",
            statusNote: "Execution exceeded stale timeout and exhausted the automatic recovery budget.",
            resultSummary: "Automatic stale recovery budget exhausted.",
            autoRecoveryCount: nextAutoRecoveryCount,
            recoveryExhaustedAt: timestamp,
            updatedAt: timestamp,
            completedAt: timestamp,
          })
          .where(eq(agentExecutions.id, row.execution_id))
          .returning();

        const run = await createExecutionRunInTx(tx, {
          executionId: row.execution_id,
          agentId: row.agent_id,
          ownerUserId: row.owner_user_id,
          runKind: "recovery",
          summary: `Execution exceeded stale timeout and exhausted the automatic recovery budget after ${maxAutoRecoveryCount} attempts.`,
        });

        await finishExecutionRunInTx(tx, run.id, {
          status: "failed",
          summary: "Recovery watchdog stopped requeueing because the automatic recovery budget was exhausted.",
          errorMessage: `Automatic recovery attempts exceeded the configured maximum (${maxAutoRecoveryCount}).`,
          artifactCount: 0,
        });
        handledResults.push({
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          action: "exhausted",
          runId: run.id,
        });

        await recordExecutionStepInTx(tx, {
          executionId: row.execution_id,
          kind: "phase",
          phase: "done",
          title: "Automatic recovery budget exhausted",
          detail: `Execution remained stale beyond the ${phaseTimeoutSeconds}-second timeout for phase ${(row.executor_phase as string | null) ?? "unknown"} and exhausted ${maxAutoRecoveryCount} automatic recovery attempts.`,
          status: "failed",
          progressPercent: 100,
        });

        await enqueueOutboxEvent(
          "agentExecution.failed",
          {
            executionId: row.execution_id,
            ownerUserId: row.owner_user_id,
            agentId: row.agent_id,
            taskId: row.task_id,
            trigger: "recovery_exhausted",
          },
          tx,
        );

        if (updatedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "failed");
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "platform_executor",
            state: "failed",
            endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "done",
            note: "Automatic recovery budget exhausted after repeated stale runtime recovery attempts.",
          });
          const recoverySession = await createRuntimeSessionInTx(tx, {
            execution: updatedExecution,
            runId: run.id,
            kind: "stale_recovery",
            trigger: "auto_recovery",
            state: "failed",
            startedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "done",
            note: "Recovery watchdog exhausted the automatic recovery budget.",
          });
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "stale_recovery",
            state: "failed",
            endedPhase: "done",
            note: recoverySession.note ?? "Recovery watchdog exhausted the automatic recovery budget.",
          });
        }
      } else {
        const [updatedExecution] = await tx
          .update(agentExecutions)
          .set({
            status: "queued",
            statusNote: "Execution automatically requeued after stale running timeout.",
            resultSummary: null,
            executorPhase: "queued",
            progressPercent: 0,
            autoRecoveryCount: nextAutoRecoveryCount,
            updatedAt: timestamp,
            startedAt: null,
            submittedAt: null,
            completedAt: null,
          })
          .where(eq(agentExecutions.id, row.execution_id))
          .returning();

        const run = await createExecutionRunInTx(tx, {
          executionId: row.execution_id,
          agentId: row.agent_id,
          ownerUserId: row.owner_user_id,
          runKind: "recovery",
          summary: `Execution auto-requeued after exceeding stale timeout of ${staleSeconds} seconds.`,
        });

        await finishExecutionRunInTx(tx, run.id, {
          status: "completed",
          summary: "Recovery watchdog returned the execution to queued state.",
          artifactCount: 0,
        });
        handledResults.push({
          executionId: row.execution_id,
          ownerUserId: row.owner_user_id,
          action: "requeued",
          runId: run.id,
        });

        await enqueueOutboxEvent(
          "agentExecution.requeued",
          {
            executionId: row.execution_id,
            ownerUserId: row.owner_user_id,
            agentId: row.agent_id,
            taskId: row.task_id,
            trigger: "recovery",
          },
          tx,
        );

        await recordExecutionStepInTx(tx, {
          executionId: row.execution_id,
          kind: "phase",
          phase: "queued",
          title: "Execution auto-requeued",
          detail: `Recovery watchdog detected a stale platform execution and returned it to the queue after ${nextAutoRecoveryCount} automatic attempts.`,
          status: "completed",
          progressPercent: 0,
        });

        if (updatedExecution) {
          await syncRuntimeManagedSubtasksInTx(tx, updatedExecution, "requeue");
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "platform_executor",
            state: "requeued",
            endedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "queued",
            note: "Recovery watchdog returned the stale execution to the queue.",
          });
          const recoverySession = await createRuntimeSessionInTx(tx, {
            execution: updatedExecution,
            runId: run.id,
            kind: "stale_recovery",
            trigger: "auto_recovery",
            state: "requeued",
            startedPhase: (row.executor_phase as PlatformExecutionPhase | null) ?? "queued",
            note: "Recovery watchdog requeued the stale execution.",
          });
          await finalizeRuntimeSessionInTx(tx, updatedExecution.id, {
            kind: "stale_recovery",
            state: "requeued",
            endedPhase: "queued",
            note: recoverySession.note ?? "Recovery watchdog requeued the stale execution.",
          });
        }
      }
    }

    return handledResults;
  });

  const exhaustedResults = actionResults.filter((row) => row.action === "exhausted");
  const recoveredResults = actionResults.filter((row) => row.action === "requeued");
  return {
    recoveredCount: recoveredResults.length,
    exhaustedCount: exhaustedResults.length,
    staleSeconds,
    results: actionResults,
  };
  } finally {
    stopLockRenewal();
    await releaseEphemeralLock(platformRuntimeLoopLockKey, lockToken);
  }
}
