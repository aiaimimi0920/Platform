import type {
  AgentExecutionOperatorRunView,
  AgentExecutionOwnerReliefHandoffFocusSection,
  AgentExecutionOwnerReliefHandoffFollowUpProfile,
  AgentExecutionOwnerReliefRunHandoffTargetType,
  AgentExecutionOwnerReliefRunHandoffStatus,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
} from "@neuro/contracts";

type CountBucket<T extends string> = {
  key: T;
  count: number;
};

export type OwnerReliefActionKind = "sweep" | "recover" | "run" | "recover_then_run";

export type OwnerReliefMatchedRunSummary = {
  matchedCount: number;
  expectedCount: number;
  artifactCount: number;
  runtimeDecisionCount: number;
  byStatus: CountBucket<AgentExecutionOperatorRunView["status"]>[];
  byRuntimeDecisionSeverity: CountBucket<AgentExecutionRuntimeDecisionSeverity>[];
  byRuntimeDecisionClass: CountBucket<AgentExecutionRuntimeDecisionClass>[];
  newestCreatedAt: string | null;
  latestFinishedAt: string | null;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  infoDecisionCount: number;
  warningDecisionCount: number;
  criticalDecisionCount: number;
  uncoveredCount: number;
};

export type OwnerReliefCloseoutSuggestionState = "continue" | "observe" | "escalate" | "relaunch";

export type OwnerReliefCloseoutSuggestionActionKind =
  | "open_recovery_runs"
  | "open_executor_runs"
  | "open_runtime_sessions"
  | "open_runtime_pressure"
  | "run_owner_slice";

export type OwnerReliefCloseoutSuggestion = {
  key: string;
  state: OwnerReliefCloseoutSuggestionState;
  variant: "cyan" | "warning" | "fuchsia";
  title: string;
  detail: string;
  actionKind: OwnerReliefCloseoutSuggestionActionKind;
  actionLabel: string;
};

export type OwnerReliefHandoffFollowUpProfilePlan = {
  profile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null;
  primaryAction: "inspect_follow_up";
  primaryLabel: string;
  secondaryAction: "resolve_handoff" | "reopen_relief" | null;
  secondaryLabel: string | null;
  detail: string;
};

export type OwnerReliefHandoffFollowUpLifecycleDisposition = "inspect" | "resolve" | "reopen";

export type OwnerReliefHandoffFollowUpLifecyclePlan = {
  profile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null;
  handoffStatus: AgentExecutionOwnerReliefRunHandoffStatus | "default_profile";
  targetLabel: string;
  primaryAction: "inspect_follow_up" | "resolve_handoff" | "reopen_relief";
  primaryDisposition: OwnerReliefHandoffFollowUpLifecycleDisposition;
  primaryLabel: string;
  secondaryAction: "inspect_follow_up" | "resolve_handoff" | "reopen_relief" | null;
  secondaryDisposition: OwnerReliefHandoffFollowUpLifecycleDisposition | null;
  secondaryLabel: string | null;
  detail: string;
};

function resolveOwnerReliefHandoffTargetLabel(args: {
  focusSection?: AgentExecutionOwnerReliefHandoffFocusSection | null;
  handoffTargetType?: AgentExecutionOwnerReliefRunHandoffTargetType | null;
}) {
  switch (args.focusSection) {
    case "runtime-pressure":
      return "runtime pressure";
    case "execution-run-watch":
      return "execution run watch";
    case "runtime-session-watch":
      return "runtime session watch";
    case "callback-audits":
      return "callback audit slice";
    default:
      break;
  }

  switch (args.handoffTargetType) {
    case "runtime_pressure":
      return "runtime pressure";
    case "execution_run_watch":
      return "execution run watch";
    case "runtime_session_watch":
      return "runtime session watch";
    case "callback_audits":
      return "callback audit slice";
    case "external_note":
      return "external note";
    default:
      return "handoff follow-up";
  }
}

function buildCountBuckets<T extends string>(values: T[]): CountBucket<T>[] {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function addSuggestion(
  suggestions: OwnerReliefCloseoutSuggestion[],
  next: OwnerReliefCloseoutSuggestion,
) {
  if (suggestions.some((entry) => entry.key === next.key)) {
    return;
  }
  suggestions.push(next);
}

function buildUncoveredRunDetail(summary: OwnerReliefMatchedRunSummary) {
  if (summary.expectedCount <= 0 || summary.uncoveredCount <= 0) {
    return null;
  }
  return `当前 exact run 只命中了 ${summary.matchedCount}/${summary.expectedCount} 条，还有 ${summary.uncoveredCount} 条待回看。`;
}

export function formatOwnerReliefHandoffFollowUpProfileLabel(
  profile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null | undefined,
) {
  switch (profile) {
    case "resolve_after_review":
      return "resolve after review";
    case "reopen_after_review":
      return "reopen after review";
    case "inspect_only":
    default:
      return "inspect only";
  }
}

export function formatOwnerReliefHandoffFollowUpLifecycleDispositionLabel(
  disposition: OwnerReliefHandoffFollowUpLifecycleDisposition,
) {
  switch (disposition) {
    case "resolve":
      return "next resolve";
    case "reopen":
      return "next reopen";
    case "inspect":
    default:
      return "next inspect";
  }
}

export function resolveOwnerReliefHandoffFollowUpProfilePlan(
  profile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null | undefined,
): OwnerReliefHandoffFollowUpProfilePlan {
  switch (profile) {
    case "resolve_after_review":
      return {
        profile,
        primaryAction: "inspect_follow_up",
        primaryLabel: "打开并准备结案",
        secondaryAction: "resolve_handoff",
        secondaryLabel: "检查后结案 handoff",
        detail: "这类 handoff 默认先检查目标 slice，再将当前 handoff follow-up 显式结案。",
      };
    case "reopen_after_review":
      return {
        profile,
        primaryAction: "inspect_follow_up",
        primaryLabel: "打开并准备复开",
        secondaryAction: "reopen_relief",
        secondaryLabel: "检查后复开 owner relief",
        detail: "这类 handoff 默认先检查目标 slice，再按结果复开 owner relief run。",
      };
    case "inspect_only":
    default:
      return {
        profile: profile ?? null,
        primaryAction: "inspect_follow_up",
        primaryLabel: "打开 handoff 下一跳",
        secondaryAction: null,
        secondaryLabel: null,
        detail: "这类 handoff 默认只要求先检查目标 slice，不强制立即结案或复开。",
      };
  }
}

export function resolveOwnerReliefHandoffFollowUpLifecyclePlan(
  profile: AgentExecutionOwnerReliefHandoffFollowUpProfile | null | undefined,
  handoffStatus: AgentExecutionOwnerReliefRunHandoffStatus | null | undefined,
  options?: {
    focusSection?: AgentExecutionOwnerReliefHandoffFocusSection | null;
    handoffTargetType?: AgentExecutionOwnerReliefRunHandoffTargetType | null;
  },
): OwnerReliefHandoffFollowUpLifecyclePlan {
  const basePlan = resolveOwnerReliefHandoffFollowUpProfilePlan(profile);
  const normalizedStatus = handoffStatus ?? "default_profile";
  const targetLabel = resolveOwnerReliefHandoffTargetLabel({
    focusSection: options?.focusSection ?? null,
    handoffTargetType: options?.handoffTargetType ?? null,
  });

  if (normalizedStatus === "opened") {
    if (profile === "resolve_after_review") {
      return {
        profile: profile ?? null,
        handoffStatus: normalizedStatus,
        targetLabel,
        primaryAction: "resolve_handoff",
        primaryDisposition: "resolve",
        primaryLabel: `检查 ${targetLabel} 后结案 handoff`,
        secondaryAction: "inspect_follow_up",
        secondaryDisposition: "inspect",
        secondaryLabel: `重新打开 ${targetLabel}`,
        detail: `当前 handoff 已经打开过。默认下一步是检查 ${targetLabel} 后结案；若需要重新核对该 follow-up，再回到 ${targetLabel}。`,
      };
    }
    if (profile === "reopen_after_review") {
      return {
        profile: profile ?? null,
        handoffStatus: normalizedStatus,
        targetLabel,
        primaryAction: "reopen_relief",
        primaryDisposition: "reopen",
        primaryLabel: `检查 ${targetLabel} 后复开 owner relief`,
        secondaryAction: "inspect_follow_up",
        secondaryDisposition: "inspect",
        secondaryLabel: `重新打开 ${targetLabel}`,
        detail: `当前 handoff 已经打开过。默认下一步是按 ${targetLabel} 的检查结果复开 owner relief run；只有在需要继续核对时才再次打开 ${targetLabel}。`,
      };
    }
    return {
      profile: profile ?? null,
      handoffStatus: normalizedStatus,
      targetLabel,
      primaryAction: "inspect_follow_up",
      primaryDisposition: "inspect",
      primaryLabel: `继续检查 ${targetLabel}`,
      secondaryAction: null,
      secondaryDisposition: null,
      secondaryLabel: null,
      detail: `当前 handoff 已经打开过，这类 profile 仍以继续检查 ${targetLabel} 为主，不强制立即结案或复开。`,
    };
  }

  if (normalizedStatus === "resolved") {
    return {
      profile: profile ?? null,
      handoffStatus: normalizedStatus,
      targetLabel,
      primaryAction: "inspect_follow_up",
      primaryDisposition: "inspect",
      primaryLabel: `回看已结案的 ${targetLabel}`,
      secondaryAction: null,
      secondaryDisposition: null,
      secondaryLabel: null,
      detail: `这条 handoff 已经 resolved。当前仅保留 ${targetLabel} 的只读回看入口，不再继续提示结案或复开动作。`,
    };
  }

  if (normalizedStatus === "reopened") {
    return {
      profile: profile ?? null,
      handoffStatus: normalizedStatus,
      targetLabel,
      primaryAction: "inspect_follow_up",
      primaryDisposition: "inspect",
      primaryLabel: `查看 ${targetLabel} 的复开轨迹`,
      secondaryAction: null,
      secondaryDisposition: null,
      secondaryLabel: null,
      detail: `这条 handoff 已经从 ${targetLabel} 回流到新的 owner relief run。当前只保留审计回看入口，不再继续提示原 handoff 的收尾动作。`,
    };
  }

  return {
    profile: basePlan.profile,
    handoffStatus: normalizedStatus,
    targetLabel,
    primaryAction: basePlan.primaryAction,
    primaryDisposition: "inspect",
    primaryLabel:
      profile === "inspect_only" || !profile
        ? `打开 ${targetLabel}`
        : basePlan.primaryLabel.replace("打开并准备结案", `打开 ${targetLabel} 并准备结案`).replace(
            "打开并准备复开",
            `打开 ${targetLabel} 并准备复开`,
          ),
    secondaryAction: basePlan.secondaryAction,
    secondaryDisposition:
      basePlan.secondaryAction === "resolve_handoff"
        ? "resolve"
        : basePlan.secondaryAction === "reopen_relief"
          ? "reopen"
          : null,
    secondaryLabel:
      basePlan.secondaryAction === "resolve_handoff"
        ? `检查 ${targetLabel} 后结案 handoff`
        : basePlan.secondaryAction === "reopen_relief"
          ? `检查 ${targetLabel} 后复开 owner relief`
          : basePlan.secondaryLabel,
    detail:
      profile === "inspect_only" || !profile
        ? `这类 handoff 默认先检查 ${targetLabel}，不强制立即结案或复开。`
        : profile === "resolve_after_review"
          ? `这类 handoff 默认先检查 ${targetLabel}，再将当前 handoff follow-up 显式结案。`
          : `这类 handoff 默认先检查 ${targetLabel}，再按结果复开 owner relief run。`,
  };
}

export function summarizeOwnerReliefMatchedRuns(args: {
  runs: AgentExecutionOperatorRunView[];
  expectedCount: number;
}): OwnerReliefMatchedRunSummary {
  const byStatus = buildCountBuckets(args.runs.map((run) => run.status));
  const runtimeDecisionSeverities = args.runs
    .map((run) => run.runtimeDecision?.severity)
    .filter((value): value is AgentExecutionRuntimeDecisionSeverity => Boolean(value));
  const runtimeDecisionClasses = args.runs
    .map((run) => run.runtimeDecision?.decisionClass)
    .filter((value): value is AgentExecutionRuntimeDecisionClass => Boolean(value));
  return {
    matchedCount: args.runs.length,
    expectedCount: args.expectedCount,
    artifactCount: args.runs.reduce((sum, run) => sum + run.artifactCount, 0),
    runtimeDecisionCount: args.runs.filter((run) => Boolean(run.runtimeDecision)).length,
    byStatus,
    byRuntimeDecisionSeverity: buildCountBuckets(runtimeDecisionSeverities),
    byRuntimeDecisionClass: buildCountBuckets(runtimeDecisionClasses),
    newestCreatedAt:
      args.runs
        .map((run) => run.createdAt)
        .filter(Boolean)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null,
    latestFinishedAt:
      args.runs
        .map((run) => run.finishedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null,
    runningCount: args.runs.filter((run) => run.status === "running").length,
    completedCount: args.runs.filter((run) => run.status === "completed").length,
    failedCount: args.runs.filter((run) => run.status === "failed").length,
    infoDecisionCount: runtimeDecisionSeverities.filter((value) => value === "info").length,
    warningDecisionCount: runtimeDecisionSeverities.filter((value) => value === "warning").length,
    criticalDecisionCount: runtimeDecisionSeverities.filter((value) => value === "critical").length,
    uncoveredCount: Math.max(args.expectedCount - args.runs.length, 0),
  };
}

export function formatOwnerReliefCloseoutSuggestionStateLabel(
  state: OwnerReliefCloseoutSuggestionState,
) {
  return state;
}

export function buildOwnerReliefCloseoutSuggestions(args: {
  action: OwnerReliefActionKind;
  closedCount: number;
  skippedCount: number;
  recoveredCount: number;
  exhaustedCount: number;
  processedCount: number;
  failedCount: number;
  recoveryMatchedRunSummary?: OwnerReliefMatchedRunSummary | null;
  executorMatchedRunSummary?: OwnerReliefMatchedRunSummary | null;
}): OwnerReliefCloseoutSuggestion[] {
  const suggestions: OwnerReliefCloseoutSuggestion[] = [];
  const recovery = args.recoveryMatchedRunSummary ?? null;
  const executor = args.executorMatchedRunSummary ?? null;
  const recoveryNeedsFollowUp = Boolean(
    recovery && (recovery.uncoveredCount > 0 || recovery.runningCount > 0),
  );
  const executorNeedsFollowUp = Boolean(
    executor && (executor.uncoveredCount > 0 || executor.runningCount > 0),
  );
  const recoveryUncoveredDetail = recovery ? buildUncoveredRunDetail(recovery) : null;
  const executorUncoveredDetail = executor ? buildUncoveredRunDetail(executor) : null;
  const hasRecoveryEscalation =
    args.exhaustedCount > 0 || Boolean(recovery && (recovery.failedCount > 0 || recovery.criticalDecisionCount > 0));
  const hasExecutorEscalation =
    args.failedCount > 0 || Boolean(executor && (executor.failedCount > 0 || executor.criticalDecisionCount > 0));

  if (args.action === "sweep") {
    if (args.skippedCount > 0) {
      addSuggestion(suggestions, {
        key: "sweep-continue",
        state: "continue",
        variant: "fuchsia",
        title: "仍有 runtime session 未被关闭，建议继续核对 owner slice",
        detail: `本轮 sweep 已关闭 ${args.closedCount} 条 session，但还有 ${args.skippedCount} 条被跳过。优先回到同一 owner 的 runtime sessions，确认是否仍有 stale 或 terminal-open 会话占住 quota。`,
        actionKind: "open_runtime_sessions",
        actionLabel: "查看 owner runtime sessions",
      });
      return suggestions;
    }
    addSuggestion(suggestions, {
      key: "sweep-observe",
      state: "observe",
      variant: "cyan",
      title: "stale / terminal 会话已收敛，可转入观察",
      detail:
        args.closedCount > 0
          ? `本轮 sweep 已关闭 ${args.closedCount} 条 session，当前更适合回看 owner runtime sessions，确认 guardrail 是否已经自然回落。`
          : "本轮没有命中可关闭的 runtime session，更适合回看 owner runtime sessions，确认这次操作是否只是一次空扫。",
      actionKind: "open_runtime_sessions",
      actionLabel: "查看 owner runtime sessions",
    });
    return suggestions;
  }

  if (args.action === "recover") {
    if (args.recoveredCount > 0) {
      addSuggestion(suggestions, {
        key: "recover-relaunch",
        state: "relaunch",
        variant: "fuchsia",
        title: "stale executions 已回收到队列，建议立刻推进 owner slice",
        detail: `本轮 recovery 已 requeue ${args.recoveredCount} 条 execution。直接跑一轮 scoped executor，能最快确认这批 execution 是否已经重新进入正常执行轨道。`,
        actionKind: "run_owner_slice",
        actionLabel: "Run owner slice",
      });
    }
    if (hasRecoveryEscalation) {
      addSuggestion(suggestions, {
        key: "recover-escalate",
        state: "escalate",
        variant: "warning",
        title: "recovery 结果里仍有 exhausted 或 critical 信号，建议回到 runtime pressure",
        detail:
          args.exhaustedCount > 0
            ? `本轮 recovery 里有 ${args.exhaustedCount} 条 execution 已进入 budget exhausted，说明这批 owner slice 不只是 stale，需要继续回到 runtime pressure / guardrail 面板核对热点。`
            : "exact matched recovery runs 已出现 failed 或 critical runtime decision，说明这轮 recovery 仍有结构化风险，需要回到 runtime pressure 继续排障。",
        actionKind: "open_runtime_pressure",
        actionLabel: "查看 runtime pressure",
      });
    }
    if (recoveryNeedsFollowUp) {
      addSuggestion(suggestions, {
        key: "recover-continue",
        state: "continue",
        variant: "fuchsia",
        title: "recovery runs 仍在落盘，建议继续核对 exact run",
        detail:
          recoveryUncoveredDetail ??
          `当前 recovery runs 里仍有 running ${recovery?.runningCount ?? 0} 条。先在 exact run 视图里确认这轮 recovery 是否已经全部完成，再决定是否继续扩展动作。`,
        actionKind: "open_recovery_runs",
        actionLabel: "查看 recovery runs",
      });
    }
    if (suggestions.length === 0) {
      addSuggestion(suggestions, {
        key: "recover-observe",
        state: "observe",
        variant: "cyan",
        title: "recovery 已完成，先观察 owner slice 是否自然恢复",
        detail:
          "本轮 recovery 没有留下 exhausted 项，也没有新的 running / failed recovery run。更适合回到 owner runtime sessions，确认 guardrail 是否已经自然回落。",
        actionKind: "open_runtime_sessions",
        actionLabel: "查看 owner runtime sessions",
      });
    }
    return suggestions;
  }

  if (args.action === "run" || args.action === "recover_then_run") {
    if (hasExecutorEscalation || (args.action === "recover_then_run" && args.exhaustedCount > 0)) {
      addSuggestion(suggestions, {
        key: "executor-escalate",
        state: "escalate",
        variant: "warning",
        title: "本轮 owner relief 仍有失败或高压信号，建议回到 runtime pressure",
        detail:
          args.failedCount > 0
            ? `本轮 executor 已产生 failed ${args.failedCount} 条 run。优先回到 runtime pressure / execution backlog，确认这是 owner quota、profile cap 还是执行阶段本身的结构化失败。`
            : args.exhaustedCount > 0
              ? `recovery 仍留有 exhausted ${args.exhaustedCount} 条 execution，说明这轮组合处置还没把 owner slice 完全拉回正常轨道。`
              : "exact matched executor runs 已出现 failed 或 critical runtime decision，需要回到 runtime pressure 继续检查限流与执行策略。",
        actionKind: "open_runtime_pressure",
        actionLabel: "查看 runtime pressure",
      });
    }
    if (executorNeedsFollowUp) {
      addSuggestion(suggestions, {
        key: "executor-continue",
        state: "continue",
        variant: "fuchsia",
        title: "executor runs 仍在推进，建议继续盯 exact run",
        detail:
          executorUncoveredDetail ??
          `当前 exact executor runs 里仍有 running ${executor?.runningCount ?? 0} 条。继续看同一批 run，比回到全局 recent window 更能判断这轮 owner slice 是否真正恢复。`,
        actionKind: "open_executor_runs",
        actionLabel: "查看 executor runs",
      });
    }
    if (suggestions.length === 0) {
      addSuggestion(suggestions, {
        key: "executor-observe",
        state: "observe",
        variant: "cyan",
        title: "本轮 owner relief 已进入观察阶段",
        detail:
          args.processedCount > 0
            ? `本轮 executor 已 processed ${args.processedCount} 条，exact matched runs 也没有继续冒出 failed / critical 信号。当前更适合转入观察，而不是继续叠加更多动作。`
            : "本轮没有继续放大 owner slice 的风险信号，更适合先回看 exact executor runs 或 runtime sessions，再决定是否追加动作。",
        actionKind: "open_executor_runs",
        actionLabel: "查看 executor runs",
      });
    }
    return suggestions;
  }

  addSuggestion(suggestions, {
    key: "fallback-observe",
    state: "observe",
    variant: "cyan",
    title: "当前 owner relief 更适合先观察",
    detail: "这轮动作没有暴露出更明确的 follow-up 信号，可先回看 owner runtime sessions。",
    actionKind: "open_runtime_sessions",
    actionLabel: "查看 owner runtime sessions",
  });
  return suggestions;
}
