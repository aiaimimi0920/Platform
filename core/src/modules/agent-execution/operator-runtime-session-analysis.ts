import type {
  AgentExecutionCallbackAuditSummaryBucket,
  AgentExecutionRuntimeSessionKind,
  AgentExecutionRuntimeSessionRecommendationView,
  AgentExecutionRuntimeSessionState,
} from "@neuro/contracts";

type AgentExecutionRuntimeSessionSummaryAnalysisInput = {
  openCount: number;
  staleOpenCount: number;
  terminalExecutionOpenCount: number;
  oldestStaleStartedAt: string | null;
  openByKind: AgentExecutionCallbackAuditSummaryBucket[];
  openByState: AgentExecutionCallbackAuditSummaryBucket[];
};

function getBucketCount(
  buckets: AgentExecutionCallbackAuditSummaryBucket[],
  key: AgentExecutionRuntimeSessionKind | AgentExecutionRuntimeSessionState,
) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

function toSuggestedLimit(count: number) {
  return Math.max(10, Math.min(Math.max(count, 1), 100));
}

export function buildRuntimeSessionRecommendations(
  input: AgentExecutionRuntimeSessionSummaryAnalysisInput,
): AgentExecutionRuntimeSessionRecommendationView[] {
  if (input.openCount <= 0) {
    return [];
  }

  const recommendations: AgentExecutionRuntimeSessionRecommendationView[] = [];
  const ownerRequeueOpenCount = getBucketCount(input.openByKind, "owner_requeue");
  const staleRecoveryOpenCount = getBucketCount(input.openByKind, "stale_recovery");
  const failedOpenCount = getBucketCount(input.openByState, "failed");

  if (input.terminalExecutionOpenCount > 0) {
    recommendations.push({
      kind: "sweep_terminal_open_sessions",
      severity: input.terminalExecutionOpenCount >= 3 ? "danger" : "warning",
      title: "终态 execution 仍持有 open runtime session",
      detail: `当前仍有 ${input.terminalExecutionOpenCount} 条 open runtime session 绑定到 queued/completed/failed/cancelled execution，建议先 sweep 收口，避免 recovery 与统计继续放大。`,
      actionKind: "sweep_runtime_sessions",
      actionLabel: "Sweep Terminal-Open Sessions",
      runtimeState: null,
      runtimeKind: null,
      staleOnly: null,
      suggestedLimit: toSuggestedLimit(input.terminalExecutionOpenCount),
      suggestedStaleSeconds: 60,
    });
  }

  if (input.staleOpenCount > 0) {
    recommendations.push({
      kind: "inspect_stale_open_sessions",
      severity: input.staleOpenCount >= 5 ? "danger" : "warning",
      title: "存在 stale runtime session backlog",
      detail: `当前有 ${input.staleOpenCount} 条 open runtime session 已进入 stale/异常窗口${input.oldestStaleStartedAt ? `，最老一条开始于 ${input.oldestStaleStartedAt}` : ""}，建议先检查同一 slice 再决定是否 sweep。`,
      actionKind: "inspect_runtime_session_slice",
      actionLabel: "Inspect Stale Runtime Sessions",
      runtimeState: null,
      runtimeKind: null,
      staleOnly: true,
      suggestedLimit: toSuggestedLimit(input.staleOpenCount),
      suggestedStaleSeconds: null,
    });
  }

  if (ownerRequeueOpenCount > 0) {
    recommendations.push({
      kind: "inspect_owner_requeue_sessions",
      severity: ownerRequeueOpenCount >= 3 ? "warning" : "info",
      title: "存在 owner requeue backlog",
      detail: `当前有 ${ownerRequeueOpenCount} 条 open runtime session 来自 owner requeue，建议先确认是否存在重复重排或长时间未完成的人工回推。`,
      actionKind: "inspect_runtime_session_slice",
      actionLabel: "Inspect Owner Requeue Sessions",
      runtimeState: null,
      runtimeKind: "owner_requeue",
      staleOnly: null,
      suggestedLimit: toSuggestedLimit(ownerRequeueOpenCount),
      suggestedStaleSeconds: null,
    });
  }

  if (staleRecoveryOpenCount > 0) {
    recommendations.push({
      kind: "inspect_stale_recovery_sessions",
      severity: staleRecoveryOpenCount >= 3 ? "warning" : "info",
      title: "存在 stale recovery backlog",
      detail: `当前有 ${staleRecoveryOpenCount} 条 open runtime session 正处于 stale recovery，建议确认它们是在正常收敛，还是 recovery 本身已卡住。`,
      actionKind: "inspect_runtime_session_slice",
      actionLabel: "Inspect Stale Recovery Sessions",
      runtimeState: null,
      runtimeKind: "stale_recovery",
      staleOnly: null,
      suggestedLimit: toSuggestedLimit(staleRecoveryOpenCount),
      suggestedStaleSeconds: null,
    });
  }

  if (failedOpenCount > 0) {
    recommendations.push({
      kind: "inspect_failed_runtime_sessions",
      severity: failedOpenCount >= 3 ? "warning" : "info",
      title: "存在 failed runtime session backlog",
      detail: `当前有 ${failedOpenCount} 条 open runtime session 已标记为 failed，建议检查它们是否需要 recovery/sweep，避免失败态会话长期滞留。`,
      actionKind: "inspect_runtime_session_slice",
      actionLabel: "Inspect Failed Runtime Sessions",
      runtimeState: "failed",
      runtimeKind: null,
      staleOnly: null,
      suggestedLimit: toSuggestedLimit(failedOpenCount),
      suggestedStaleSeconds: null,
    });
  }

  return recommendations;
}
