"use server";

import { redirect } from "next/navigation";

import {
  recordOperatorAgentExecutionOwnerReliefRunAction,
  startOperatorAgentExecutionOwnerReliefRun,
} from "@/lib/account-client";
import {
  recoverStalePlatformExecutions,
  retryAgentExecutionSettlement,
  runPlatformExecutorNow,
  sweepAgentExecutionRuntimeSessions,
} from "@/lib/platform-client";
import {
  buildAgentCallbackOpsRedirect,
  readAgentCallbackOpsFollowUp,
  readOwnerReliefAction,
  readOwnerReliefRunId,
} from "@/lib/platform-agent-callback-ops-action-utils";
import {
  coerceRuntimePressureLevel,
  coerceRuntimeSchedulingDecisionClass,
} from "@/lib/platform-agent-execution-runtime-action-utils";
import { buildStatusRedirect, resolveRedirectPath, toMessage } from "@/lib/platform-action-utils";
import { requirePlatformOperatorUserContext } from "@/lib/platform-session";

function readRuntimeSessionSlice(formData: FormData): {
  agentId?: string;
  ownerUserId?: string;
  state?: "running" | "completed" | "failed" | "requeued";
  kind?: "platform_executor" | "stale_recovery" | "owner_requeue";
  staleOnly?: boolean;
} {
  const agentId = String(formData.get("agentId") || "").trim() || undefined;
  const ownerUserId = String(formData.get("ownerUserId") || "").trim() || undefined;
  const state = String(formData.get("state") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const staleOnly = String(formData.get("staleOnly") || "").trim();

  return {
    agentId,
    ownerUserId,
    state:
      state === "running" || state === "completed" || state === "failed" || state === "requeued"
        ? state
        : undefined,
    kind:
      kind === "platform_executor" || kind === "stale_recovery" || kind === "owner_requeue"
        ? kind
        : undefined,
    staleOnly: staleOnly === "true" ? true : staleOnly === "false" ? false : undefined,
  };
}

function buildOwnerReliefSummary(args: {
  closedCount?: number | null;
  skippedCount?: number | null;
  recoveredCount?: number | null;
  exhaustedCount?: number | null;
  processedCount?: number | null;
  failedCount?: number | null;
  recoveryExecutionIds?: string[] | null;
  recoveryRunIds?: string[] | null;
  executorExecutionIds?: string[] | null;
  executorRunIds?: string[] | null;
}) {
  return {
    sweepClosedCount: Math.max(0, args.closedCount ?? 0),
    sweepSkippedCount: Math.max(0, args.skippedCount ?? 0),
    recoveredCount: Math.max(0, args.recoveredCount ?? 0),
    exhaustedCount: Math.max(0, args.exhaustedCount ?? 0),
    processedCount: Math.max(0, args.processedCount ?? 0),
    failedCount: Math.max(0, args.failedCount ?? 0),
    recoveryExecutionIds: args.recoveryExecutionIds ?? [],
    recoveryRunIds: args.recoveryRunIds ?? [],
    executorExecutionIds: args.executorExecutionIds ?? [],
    executorRunIds: args.executorRunIds ?? [],
  };
}

async function ensureOwnerReliefRunId(args: {
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>;
  formData: FormData;
  ownerReliefAction: "sweep" | "recover" | "run" | "recover_then_run" | null;
  runtimeSessionSlice: ReturnType<typeof readRuntimeSessionSlice>;
  followUp: ReturnType<typeof readAgentCallbackOpsFollowUp>;
}) {
  if (!args.ownerReliefAction) {
    return null;
  }
  const existingRunId = readOwnerReliefRunId(args.formData);
  if (existingRunId) {
    return existingRunId;
  }

  const ownerUserId = args.runtimeSessionSlice.ownerUserId ?? args.followUp.ownerUserId;
  if (!ownerUserId) {
    return null;
  }

  const run = await startOperatorAgentExecutionOwnerReliefRun(args.userContext, {
    ownerUserId,
    agentId: args.runtimeSessionSlice.agentId ?? args.followUp.agentId,
    triggerAction: args.ownerReliefAction,
    source: "ops/agent-callbacks",
    runtimePressureLevel: coerceRuntimePressureLevel(args.followUp.runtimePressureLevel) ?? null,
    runtimeSchedulingDecisionClass:
      coerceRuntimeSchedulingDecisionClass(args.followUp.runtimeSchedulingDecisionClass) ?? null,
  });
  return run.id;
}

async function recordOwnerReliefRunActionIfNeeded(args: {
  userContext: Awaited<ReturnType<typeof requirePlatformOperatorUserContext>>;
  runId: string | null;
  actionKind: "sweep" | "recover" | "run" | "recover_then_run";
  status: "success" | "error";
  title: string;
  detail?: string | null;
  summary: ReturnType<typeof buildOwnerReliefSummary>;
}) {
  if (!args.runId) {
    return;
  }
  await recordOperatorAgentExecutionOwnerReliefRunAction(args.userContext, args.runId, {
    actionKind: args.actionKind,
    status: args.status,
    title: args.title,
    detail: args.detail ?? null,
    summary: args.summary,
  });
}

export async function recoverStalePlatformExecutionsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 10);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 900);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 900, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await recoverStalePlatformExecutions(userContext, {
      limit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      result.recoveredCount > 0 || result.exhaustedCount > 0
        ? `恢复 watchdog 已处理：requeued ${result.recoveredCount}，budget exhausted ${result.exhaustedCount}。`
        : "当前没有命中 stale 条件的 platform execution。";
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "recover",
      status: "success",
      title: "Recovered stale executions",
      detail: message,
      summary: buildOwnerReliefSummary({
        recoveredCount: result.recoveredCount,
        exhaustedCount: result.exhaustedCount,
        recoveryExecutionIds: result.results.map((entry) => entry.executionId),
        recoveryRunIds: result.results.map((entry) => entry.runId),
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "recovery",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefRecoveredCount: ownerReliefAction ? result.recoveredCount : null,
          ownerReliefExhaustedCount: ownerReliefAction ? result.exhaustedCount : null,
          ownerReliefRecoveryExecutionIds: ownerReliefAction ? result.results.map((entry) => entry.executionId) : null,
          ownerReliefRecoveryRunIds: ownerReliefAction ? result.results.map((entry) => entry.runId) : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "stale platform execution 恢复失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "recover",
          status: "error",
          title: "Failed to recover stale executions",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "recovery",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function runPlatformExecutorNowAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 3);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 3, 20));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await runPlatformExecutorNow(userContext, {
      limit,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      result.processedCount > 0 || result.failedCount > 0
        ? `platform executor 手动推进完成：processed ${result.processedCount}，failed ${result.failedCount}。`
        : "当前没有可推进的 platform execution，或执行器正在由其他循环处理。";
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "run",
      status: "success",
      title: "Ran owner-scoped platform executor",
      detail: message,
      summary: buildOwnerReliefSummary({
        processedCount: result.processedCount,
        failedCount: result.failedCount,
        executorExecutionIds: [
          ...result.results.map((entry) => entry.executionId),
          ...result.failures.map((entry) => entry.executionId),
        ],
        executorRunIds: [
          ...result.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
          ...result.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
        ],
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "platform_executor",
          runStatus:
            followUp.runStatus ??
            (result.failedCount > 0 && result.processedCount === 0 ? "failed" : null),
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefProcessedCount: ownerReliefAction ? result.processedCount : null,
          ownerReliefFailedCount: ownerReliefAction ? result.failedCount : null,
          ownerReliefExecutorExecutionIds: ownerReliefAction
            ? [...result.results.map((entry) => entry.executionId), ...result.failures.map((entry) => entry.executionId)]
            : null,
          ownerReliefExecutorRunIds: ownerReliefAction
            ? [
                ...result.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
                ...result.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
              ]
            : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "platform executor 手动推进失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "run",
          status: "error",
          title: "Failed to run owner-scoped platform executor",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind ?? "platform_executor",
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function retryAgentExecutionSettlementAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const executionId = String(formData.get("executionId") || "").trim();
  if (!executionId) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: "缺少 executionId，无法重试结算。",
        ...followUp,
      }),
    );
  }

  try {
    await retryAgentExecutionSettlement(userContext, executionId);
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "success",
        message: `已触发 execution ${executionId} 的结算重试。`,
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildAgentCallbackOpsRedirect({
        result: "error",
        message: toMessage(error, "触发 execution 结算重试失败。"),
        ...followUp,
      }),
    );
  }
}

export async function sweepRuntimeSessionsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawLimit = Number(formData.get("limit") || 50);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 1800);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50, 500));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 1800, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/agent-executions");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;
  const sweepMessage = (result: { closedCount: number; skippedCount: number }) =>
    `Runtime session sweep 完成：closed ${result.closedCount}，skipped ${result.skippedCount}。`;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const result = await sweepAgentExecutionRuntimeSessions(userContext, {
      limit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
      state: runtimeSessionSlice.state,
      kind: runtimeSessionSlice.kind,
      staleOnly: runtimeSessionSlice.staleOnly,
    });
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "sweep",
      status: "success",
      title: "Swept owner-scoped runtime sessions",
      detail: sweepMessage(result),
      summary: buildOwnerReliefSummary({
        closedCount: result.closedCount,
        skippedCount: result.skippedCount,
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message: sweepMessage(result),
          ...followUp,
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefClosedCount: ownerReliefAction ? result.closedCount : null,
          ownerReliefSkippedCount: ownerReliefAction ? result.skippedCount : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", sweepMessage(result)));
  } catch (error) {
    const message = toMessage(error, "Runtime session sweep 失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "sweep",
          status: "error",
          title: "Failed to sweep owner-scoped runtime sessions",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}

export async function recoverThenRunPlatformExecutorAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const rawRecoveryLimit = Number(formData.get("recoveryLimit") || formData.get("limit") || 10);
  const rawExecutorLimit = Number(formData.get("executorLimit") || 3);
  const rawStaleSeconds = Number(formData.get("staleSeconds") || 900);
  const recoveryLimit = Math.max(1, Math.min(Number.isFinite(rawRecoveryLimit) ? Math.floor(rawRecoveryLimit) : 10, 50));
  const executorLimit = Math.max(1, Math.min(Number.isFinite(rawExecutorLimit) ? Math.floor(rawExecutorLimit) : 3, 20));
  const staleSeconds = Math.max(60, Math.min(Number.isFinite(rawStaleSeconds) ? Math.floor(rawStaleSeconds) : 900, 86_400));
  const redirectTo = resolveRedirectPath(formData.get("redirectTo"), "/ops/agent-callbacks");
  const followUp = readAgentCallbackOpsFollowUp(formData);
  const runtimeSessionSlice = readRuntimeSessionSlice(formData);
  const ownerReliefAction = readOwnerReliefAction(formData);
  let ownerReliefRunId: string | null = null;

  try {
    ownerReliefRunId = await ensureOwnerReliefRunId({
      userContext,
      formData,
      ownerReliefAction,
      runtimeSessionSlice,
      followUp,
    });
    const recoveryResult = await recoverStalePlatformExecutions(userContext, {
      limit: recoveryLimit,
      staleSeconds,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const executorResult = await runPlatformExecutorNow(userContext, {
      limit: executorLimit,
      agentId: runtimeSessionSlice.agentId,
      ownerUserId: runtimeSessionSlice.ownerUserId,
    });
    const message =
      `组合 playbook 完成：recovery ${recoveryResult.recoveredCount}，` +
      `executor processed ${executorResult.processedCount}，failed ${executorResult.failedCount}。`;
    await recordOwnerReliefRunActionIfNeeded({
      userContext,
      runId: ownerReliefRunId,
      actionKind: "recover_then_run",
      status: "success",
      title: "Recovered then ran owner slice",
      detail: message,
      summary: buildOwnerReliefSummary({
        recoveredCount: recoveryResult.recoveredCount,
        exhaustedCount: recoveryResult.exhaustedCount,
        processedCount: executorResult.processedCount,
        failedCount: executorResult.failedCount,
        recoveryExecutionIds: recoveryResult.results.map((entry) => entry.executionId),
        recoveryRunIds: recoveryResult.results.map((entry) => entry.runId),
        executorExecutionIds: [
          ...executorResult.results.map((entry) => entry.executionId),
          ...executorResult.failures.map((entry) => entry.executionId),
        ],
        executorRunIds: [
          ...executorResult.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
          ...executorResult.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
        ],
      }),
    });
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "success",
          message,
          ...followUp,
          runKind: followUp.runKind,
          runStatus:
            followUp.runStatus ??
            (executorResult.failedCount > 0 && executorResult.processedCount === 0 ? "failed" : null),
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
          ownerReliefRecoveredCount: ownerReliefAction ? recoveryResult.recoveredCount : null,
          ownerReliefExhaustedCount: ownerReliefAction ? recoveryResult.exhaustedCount : null,
          ownerReliefProcessedCount: ownerReliefAction ? executorResult.processedCount : null,
          ownerReliefFailedCount: ownerReliefAction ? executorResult.failedCount : null,
          ownerReliefRecoveryExecutionIds: ownerReliefAction
            ? recoveryResult.results.map((entry) => entry.executionId)
            : null,
          ownerReliefRecoveryRunIds: ownerReliefAction ? recoveryResult.results.map((entry) => entry.runId) : null,
          ownerReliefExecutorExecutionIds: ownerReliefAction
            ? [
                ...executorResult.results.map((entry) => entry.executionId),
                ...executorResult.failures.map((entry) => entry.executionId),
              ]
            : null,
          ownerReliefExecutorRunIds: ownerReliefAction
            ? [
                ...executorResult.results.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
                ...executorResult.failures.map((entry) => entry.runId).filter((value): value is string => Boolean(value)),
              ]
            : null,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "success", message));
  } catch (error) {
    const message = toMessage(error, "组合 playbook 执行失败，请稍后重试。");
    if (ownerReliefAction) {
      try {
        ownerReliefRunId =
          ownerReliefRunId ??
          (await ensureOwnerReliefRunId({
            userContext,
            formData,
            ownerReliefAction,
            runtimeSessionSlice,
            followUp,
          }));
        await recordOwnerReliefRunActionIfNeeded({
          userContext,
          runId: ownerReliefRunId,
          actionKind: "recover_then_run",
          status: "error",
          title: "Failed to recover and run owner slice",
          detail: message,
          summary: buildOwnerReliefSummary({}),
        });
      } catch {}
    }
    if (redirectTo.startsWith("/ops/agent-callbacks")) {
      redirect(
        buildAgentCallbackOpsRedirect({
          result: "error",
          message,
          ...followUp,
          runKind: followUp.runKind,
          recentWindow: followUp.recentWindow ?? "15m",
          ownerReliefAction,
          ownerReliefRunId,
        }),
      );
    }
    redirect(buildStatusRedirect(redirectTo, "error", message));
  }
}
