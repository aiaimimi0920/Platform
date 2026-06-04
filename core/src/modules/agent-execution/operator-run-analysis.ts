import type {
  AgentExecutionOperatorRecommendationView,
  AgentExecutionOperatorRunSummaryView,
  AgentExecutionRecentWindowKey,
  AgentExecutionRunFailureCategory,
  AgentExecutionRunSummaryBucket,
  AgentExecutionRunStatus,
  AgentExecutionRunView,
  PlatformExecutionPhase,
} from "@neuro/contracts";

export function classifyExecutionRunFailure(args: {
  runKind: AgentExecutionRunView["runKind"];
  status: AgentExecutionRunStatus;
  summary?: string | null;
  errorMessage?: string | null;
}): AgentExecutionRunFailureCategory | null {
  if (args.status !== "failed") {
    return null;
  }

  const haystack = `${args.summary ?? ""} ${args.errorMessage ?? ""}`.toLowerCase();
  if (haystack.includes("stale timeout") || haystack.includes("stale platform execution")) {
    return "stale_timeout";
  }

  if (args.runKind === "platform_executor") {
    return "executor_failure";
  }

  if (args.runKind === "requeue") {
    return "requeue_failure";
  }

  return "unknown_failure";
}

export function toExecutionPhaseBucket(phase: PlatformExecutionPhase | "none" | null | undefined) {
  return phase ?? "none";
}

export function getRecentWindowInterval(windowKey: AgentExecutionRecentWindowKey) {
  switch (windowKey) {
    case "15m":
      return "15 minutes";
    case "1h":
      return "1 hour";
    case "24h":
      return "24 hours";
    default:
      return "24 hours";
  }
}

function getBucketCount(buckets: AgentExecutionRunSummaryBucket[], key: string) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

function pickRecommendedWindow(
  recentWindows: AgentExecutionOperatorRunSummaryView["recentWindows"],
): AgentExecutionRecentWindowKey | null {
  if (recentWindows.find((window) => window.key === "15m" && window.failedCount > 0)) return "15m";
  if (recentWindows.find((window) => window.key === "1h" && window.failedCount > 0)) return "1h";
  if (recentWindows.find((window) => window.key === "24h" && window.failedCount > 0)) return "24h";
  return null;
}

export function buildExecutionRunRecommendations(
  summary: Pick<
    AgentExecutionOperatorRunSummaryView,
    "byExecutionStatus" | "byFailureCategory" | "recentWindows"
  >,
): AgentExecutionOperatorRecommendationView[] {
  const recommendations: AgentExecutionOperatorRecommendationView[] = [];
  const staleTimeoutCount = getBucketCount(summary.byFailureCategory, "stale_timeout");
  const executorFailureCount = getBucketCount(summary.byFailureCategory, "executor_failure");
  const requeueFailureCount = getBucketCount(summary.byFailureCategory, "requeue_failure");
  const queuedCount = getBucketCount(summary.byExecutionStatus, "queued");
  const recommendedWindow = pickRecommendedWindow(summary.recentWindows);
  const shouldRecommendPlaybook = staleTimeoutCount > 0 && queuedCount > 0;

  if (shouldRecommendPlaybook) {
    recommendations.push({
      kind: "recover_then_run",
      severity: staleTimeoutCount >= 3 || queuedCount >= 5 ? "danger" : "warning",
      title: "先 recovery，再推进 executor",
      detail: `当前命中了 ${staleTimeoutCount} 条 stale timeout，且仍有 ${queuedCount} 条 queued execution。建议顺序执行 recovery watchdog 再跑一轮 platform executor。`,
      actionLabel: "执行组合 playbook",
      suggestedLimit: Math.min(Math.max(staleTimeoutCount, 3), 50),
      suggestedExecutorLimit: Math.min(Math.max(queuedCount, 3), 20),
      suggestedStaleSeconds: 900,
      failureCategory: "stale_timeout",
      recentWindow: recommendedWindow,
      runStatus: null,
    });
  }

  if (!shouldRecommendPlaybook && staleTimeoutCount > 0) {
    recommendations.push({
      kind: "recover_stale",
      severity: staleTimeoutCount >= 3 ? "danger" : "warning",
      title: "先回收 stale platform execution",
      detail: `当前命中了 ${staleTimeoutCount} 条 stale timeout 失败记录，建议先执行 recovery watchdog 再继续推进 executor。`,
      actionLabel: "执行 recovery",
      suggestedLimit: Math.min(Math.max(staleTimeoutCount, 3), 50),
      suggestedExecutorLimit: null,
      suggestedStaleSeconds: 900,
      failureCategory: "stale_timeout",
      recentWindow: recommendedWindow,
      runStatus: "failed",
    });
  }

  if (!shouldRecommendPlaybook && queuedCount > 0) {
    recommendations.push({
      kind: "run_executor",
      severity: queuedCount >= 5 ? "warning" : "info",
      title: "推进 queued execution",
      detail: `当前有 ${queuedCount} 条 execution 仍处于 queued 状态，适合手动触发一轮 platform executor。`,
      actionLabel: "执行一轮 executor",
      suggestedLimit: Math.min(Math.max(queuedCount, 3), 20),
      suggestedExecutorLimit: null,
      suggestedStaleSeconds: null,
      failureCategory: null,
      recentWindow: null,
      runStatus: null,
    });
  }

  if (executorFailureCount > 0) {
    recommendations.push({
      kind: "inspect_failures",
      severity: executorFailureCount >= 3 ? "danger" : "warning",
      title: "检查 executor failure",
      detail: `当前记录到 ${executorFailureCount} 条 executor failure，建议按失败分类直接筛查最近异常 run。`,
      actionLabel: "筛选 executor failure",
      suggestedLimit: null,
      suggestedExecutorLimit: null,
      suggestedStaleSeconds: null,
      failureCategory: "executor_failure",
      recentWindow: recommendedWindow,
      runStatus: "failed",
    });
  }

  if (requeueFailureCount > 0) {
    recommendations.push({
      kind: "inspect_failures",
      severity: "warning",
      title: "检查 requeue failure",
      detail: `当前记录到 ${requeueFailureCount} 条 requeue failure，建议核对 owner 重排队与执行器交接链路。`,
      actionLabel: "筛选 requeue failure",
      suggestedLimit: null,
      suggestedExecutorLimit: null,
      suggestedStaleSeconds: null,
      failureCategory: "requeue_failure",
      recentWindow: recommendedWindow,
      runStatus: "failed",
    });
  }

  return recommendations;
}
