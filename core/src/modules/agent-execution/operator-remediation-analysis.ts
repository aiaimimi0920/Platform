import type {
  AgentCallbackRemediationPolicyKey,
  AgentExecutionCallbackAuditSummaryBucket,
  AgentExecutionCallbackRemediationAlertView,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackAutoRemediationReasonDisposition,
  AgentExecutionCallbackRemediationRecommendationView,
  AgentExecutionCallbackRemediationSummaryView,
  AgentExecutionRuntimeDecisionClass,
  AgentExecutionRuntimeDecisionSeverity,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeSchedulingDecisionClass,
} from "@neuro/contracts";
import { classifyAutoRemediationReasonCategory } from "./auto-remediation-analysis";

export type CallbackRemediationRuntimeCorrelationContext = {
  runtimeDecisionClass: AgentExecutionRuntimeDecisionClass | null;
  runtimeDecisionSeverity: AgentExecutionRuntimeDecisionSeverity | null;
  runtimePressureLevel: AgentExecutionRuntimePressureLevel | null;
  runtimeSchedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass | null;
};

type CallbackRemediationRuntimeCorrelationSummary = {
  runtimeDecisionPresentCount: number;
  runtimePressureContextCount: number;
  byRuntimeDecisionClass: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimeDecisionSeverity: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimePressureLevel: AgentExecutionCallbackAuditSummaryBucket[];
  byRuntimeSchedulingDecisionClass: AgentExecutionCallbackAuditSummaryBucket[];
};

function buildSummaryBucketsFromValues(values: Array<string | null | undefined>): AgentExecutionCallbackAuditSummaryBucket[] {
  const bucketMap = new Map<string, number>();
  for (const value of values) {
    const normalized = value?.trim() ?? "";
    if (!normalized) {
      continue;
    }
    bucketMap.set(normalized, (bucketMap.get(normalized) ?? 0) + 1);
  }
  return [...bucketMap.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export function buildCallbackRemediationRuntimeCorrelationSummary(
  runtimeContexts: Array<CallbackRemediationRuntimeCorrelationContext | null | undefined>,
): CallbackRemediationRuntimeCorrelationSummary {
  const normalized = runtimeContexts.filter(
    (context): context is CallbackRemediationRuntimeCorrelationContext => Boolean(context),
  );
  return {
    runtimeDecisionPresentCount: normalized.filter((context) => Boolean(context.runtimeDecisionClass)).length,
    runtimePressureContextCount: normalized.filter((context) => Boolean(context.runtimePressureLevel)).length,
    byRuntimeDecisionClass: buildSummaryBucketsFromValues(
      normalized.map((context) => context.runtimeDecisionClass),
    ),
    byRuntimeDecisionSeverity: buildSummaryBucketsFromValues(
      normalized.map((context) => context.runtimeDecisionSeverity),
    ),
    byRuntimePressureLevel: buildSummaryBucketsFromValues(
      normalized.map((context) => context.runtimePressureLevel),
    ),
    byRuntimeSchedulingDecisionClass: buildSummaryBucketsFromValues(
      normalized.map((context) => context.runtimeSchedulingDecisionClass),
    ),
  };
}

function getBucketCount(
  buckets: AgentExecutionCallbackRemediationSummaryView["bySkipReason"] | AgentExecutionCallbackRemediationSummaryView["byFailureReason"],
  key: AgentExecutionCallbackAutoRemediationReasonCategory,
) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

function toSeverity(count: number, warningThreshold = 1, dangerThreshold = 5) {
  if (count >= dangerThreshold) {
    return "danger" as const;
  }
  if (count >= warningThreshold) {
    return "warning" as const;
  }
  return "info" as const;
}

function getAlertLevelForReason(
  category: AgentExecutionCallbackAutoRemediationReasonCategory,
  count: number,
) {
  switch (category) {
    case "attempt_failed":
    case "policy_budget_exhausted":
      return 3;
    case "policy_disabled":
    case "missing_agent":
    case "target_unavailable":
      return 2;
    case "missing_payload":
      return count >= 5 ? 2 : 1;
    case "duplicate_cooldown":
      return count >= 8 ? 2 : 1;
    case "missing_rejection_category":
    case "policy_not_covered":
    default:
      return 1;
  }
}

function toSeverityFromAlertLevel(alertLevel: number) {
  if (alertLevel >= 3) {
    return "danger" as const;
  }
  if (alertLevel >= 2) {
    return "warning" as const;
  }
  return "info" as const;
}

function getTopPolicyByReason(
  reasonPolicyRows: Array<{
    policyKey: AgentCallbackRemediationPolicyKey;
    reason: string;
    count: number;
  }> = [],
) {
  const topPolicyByReason = new Map<
    AgentExecutionCallbackAutoRemediationReasonCategory,
    AgentCallbackRemediationPolicyKey
  >();

  for (const category of [
    "attempt_failed",
    "missing_payload",
    "policy_disabled",
    "policy_budget_exhausted",
    "duplicate_cooldown",
    "target_unavailable",
    "missing_agent",
    "missing_rejection_category",
    "policy_not_covered",
  ] as const) {
    const matchingRows = reasonPolicyRows
      .filter((row) => classifyAutoRemediationReasonCategory(row.reason === "none" ? null : row.reason) === category)
      .sort((left, right) => right.count - left.count || left.policyKey.localeCompare(right.policyKey));
    if (matchingRows[0]) {
      topPolicyByReason.set(category, matchingRows[0].policyKey);
    }
  }

  return topPolicyByReason;
}

function getTargetUnavailableCount(summary: Pick<AgentExecutionCallbackRemediationSummaryView, "bySkipReason">) {
  return getBucketCount(summary.bySkipReason, "target_unavailable") + getBucketCount(summary.bySkipReason, "missing_agent");
}

function getTargetUnavailableCategory(summary: Pick<AgentExecutionCallbackRemediationSummaryView, "bySkipReason">) {
  return getBucketCount(summary.bySkipReason, "missing_agent") >= getBucketCount(summary.bySkipReason, "target_unavailable")
    ? "missing_agent"
    : "target_unavailable";
}

function pushReasonRecommendation(
  recommendations: AgentExecutionCallbackRemediationRecommendationView[],
  args: {
    count: number;
    reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory;
    reasonDisposition: AgentExecutionCallbackAutoRemediationReasonDisposition;
    policyKey?: AgentCallbackRemediationPolicyKey | null;
    title: string;
    detail: string;
    actionLabel: string;
    warningThreshold?: number;
    dangerThreshold?: number;
  },
) {
  if (args.count <= 0) {
    return;
  }
  recommendations.push({
    kind: "inspect_reason",
    severity: toSeverity(args.count, args.warningThreshold, args.dangerThreshold),
    title: args.title,
    detail: args.detail,
    actionLabel: args.actionLabel,
    reasonCategory: args.reasonCategory,
    reasonDisposition: args.reasonDisposition,
    policyKey: args.policyKey ?? null,
  });
}

function pushAlert(
  alerts: AgentExecutionCallbackRemediationAlertView[],
  args: {
    count: number;
    reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory;
    reasonDisposition: AgentExecutionCallbackAutoRemediationReasonDisposition;
    policyKey?: AgentCallbackRemediationPolicyKey | null;
    title: string;
    detail: string;
    actionLabel: string;
  },
) {
  if (args.count <= 0) {
    return;
  }
  const alertLevel = getAlertLevelForReason(args.reasonCategory, args.count);
  alerts.push({
    count: args.count,
    alertLevel,
    severity: toSeverityFromAlertLevel(alertLevel),
    title: args.title,
    detail: args.detail,
    actionLabel: args.actionLabel,
    reasonCategory: args.reasonCategory,
    reasonDisposition: args.reasonDisposition,
    policyKey: args.policyKey ?? null,
  });
}

export function buildCallbackRemediationAlertBuckets(
  summary: Pick<AgentExecutionCallbackRemediationSummaryView, "bySkipReason" | "byFailureReason">,
) {
  const alertCounts = new Map<number, number>();

  for (const bucket of [...summary.bySkipReason, ...summary.byFailureReason]) {
    const alertLevel = getAlertLevelForReason(
      bucket.key as AgentExecutionCallbackAutoRemediationReasonCategory,
      bucket.count,
    );
    if (alertLevel <= 0) {
      continue;
    }
    alertCounts.set(alertLevel, (alertCounts.get(alertLevel) ?? 0) + bucket.count);
  }

  return [...alertCounts.entries()]
    .map(([key, count]) => ({
      key: String(key),
      count,
    }))
    .sort((left, right) => Number(right.key) - Number(left.key));
}

export function buildCallbackRemediationAlerts(
  summary: Pick<
    AgentExecutionCallbackRemediationSummaryView,
    "candidateCount" | "bySkipReason" | "byFailureReason" | "byPolicyKey"
  > & {
    reasonPolicyRows?: Array<{
      policyKey: AgentCallbackRemediationPolicyKey;
      reason: string;
      count: number;
    }>;
  },
): AgentExecutionCallbackRemediationAlertView[] {
  if (summary.candidateCount <= 0) {
    return [];
  }

  const alerts: AgentExecutionCallbackRemediationAlertView[] = [];
  const attemptFailedCount = getBucketCount(summary.byFailureReason, "attempt_failed");
  const missingPayloadCount = getBucketCount(summary.bySkipReason, "missing_payload");
  const policyDisabledCount = getBucketCount(summary.bySkipReason, "policy_disabled");
  const policyBudgetExhaustedCount = getBucketCount(summary.bySkipReason, "policy_budget_exhausted");
  const duplicateCooldownCount = getBucketCount(summary.bySkipReason, "duplicate_cooldown");
  const targetUnavailableCount = getTargetUnavailableCount(summary);
  const topPolicyByReason = getTopPolicyByReason(summary.reasonPolicyRows);

  pushAlert(alerts, {
    count: attemptFailedCount,
    reasonCategory: "attempt_failed",
    reasonDisposition: "failed",
    policyKey: topPolicyByReason.get("attempt_failed") ?? null,
    title: "自动补救出现硬失败",
    detail: `当前筛选范围内有 ${attemptFailedCount} 条 callback 在自动补救阶段真实执行失败。建议优先核对对应 remediation run 的错误信息，避免 backlog 在 worker 循环里持续放大。`,
    actionLabel: "查看 attempt failed",
  });

  pushAlert(alerts, {
    count: policyBudgetExhaustedCount,
    reasonCategory: "policy_budget_exhausted",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("policy_budget_exhausted") ?? null,
    title: "自动补救预算已耗尽",
    detail: `当前筛选范围内有 ${policyBudgetExhaustedCount} 条 callback 已耗尽自动补救预算。建议尽快确认对应 policy 是否过于保守，或直接转人工 replay / retry request。`,
    actionLabel: "查看 budget exhausted",
  });

  pushAlert(alerts, {
    count: policyDisabledCount,
    reasonCategory: "policy_disabled",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("policy_disabled") ?? null,
    title: "agent policy 正在拦截自动补救",
    detail: `当前筛选范围内有 ${policyDisabledCount} 条 callback 因 remediation policy disabled 被跳过。建议核对对应 agent 是否仍应保持 manual_only。`,
    actionLabel: "查看 policy disabled",
  });

  pushAlert(alerts, {
    count: targetUnavailableCount,
    reasonCategory: getTargetUnavailableCategory(summary),
    reasonDisposition: "skipped",
    policyKey:
      topPolicyByReason.get("missing_agent") ??
      topPolicyByReason.get("target_unavailable") ??
      null,
    title: "callback 目标对象不可用",
    detail: `当前筛选范围内有 ${targetUnavailableCount} 条 callback 因 execution / agent / callback target 不可用而被跳过。建议优先检查 agent 生命周期和 execution 当前状态。`,
    actionLabel: "查看 target unavailable",
  });

  pushAlert(alerts, {
    count: missingPayloadCount,
    reasonCategory: "missing_payload",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("missing_payload") ?? null,
    title: "stored payload 缺失",
    detail: `当前筛选范围内有 ${missingPayloadCount} 条 callback 没有可重放的 stored payload。建议优先走 retry request 或核对 payload envelope 存储覆盖率。`,
    actionLabel: "查看 missing payload",
  });

  pushAlert(alerts, {
    count: duplicateCooldownCount,
    reasonCategory: "duplicate_cooldown",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("duplicate_cooldown") ?? null,
    title: "重复 cooldown 正在抑制补救",
    detail: `当前筛选范围内有 ${duplicateCooldownCount} 条 callback 因 duplicate cooldown 被暂时抑制。建议在冷却窗口结束前避免重复触发 operator remediation。`,
    actionLabel: "查看 duplicate cooldown",
  });

  return alerts;
}

export function buildCallbackRemediationRecommendations(
  summary: Pick<
    AgentExecutionCallbackRemediationSummaryView,
    "candidateCount" | "bySkipReason" | "byFailureReason" | "byPolicyKey"
  > & {
    reasonPolicyRows?: Array<{
      policyKey: AgentCallbackRemediationPolicyKey;
      reason: string;
      count: number;
    }>;
  },
): AgentExecutionCallbackRemediationRecommendationView[] {
  if (summary.candidateCount <= 0) {
    return [];
  }

  const recommendations: AgentExecutionCallbackRemediationRecommendationView[] = [];
  const attemptFailedCount = getBucketCount(summary.byFailureReason, "attempt_failed");
  const missingPayloadCount = getBucketCount(summary.bySkipReason, "missing_payload");
  const policyDisabledCount = getBucketCount(summary.bySkipReason, "policy_disabled");
  const policyBudgetExhaustedCount = getBucketCount(summary.bySkipReason, "policy_budget_exhausted");
  const duplicateCooldownCount = getBucketCount(summary.bySkipReason, "duplicate_cooldown");
  const targetUnavailableCount = getTargetUnavailableCount(summary);
  const topPolicyByReason = getTopPolicyByReason(summary.reasonPolicyRows);

  pushReasonRecommendation(recommendations, {
    count: attemptFailedCount,
    reasonCategory: "attempt_failed",
    reasonDisposition: "failed",
    policyKey: topPolicyByReason.get("attempt_failed") ?? null,
    title: "自动补救出现硬失败",
    detail: `当前筛选范围内有 ${attemptFailedCount} 条 callback 在自动补救阶段真正执行失败。建议先切到 failure slice，确认最近 remediation run 的 error message，再决定是否手动 replay 或 request retry。`,
    actionLabel: "筛选 attempt failed",
    warningThreshold: 1,
    dangerThreshold: 3,
  });

  pushReasonRecommendation(recommendations, {
    count: missingPayloadCount,
    reasonCategory: "missing_payload",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("missing_payload") ?? null,
    title: "stored payload 缺失，无法自动 replay",
    detail: `当前筛选范围内有 ${missingPayloadCount} 条 callback 因缺少 replay-safe payload 被自动跳过。切到该 slice 后可直接使用现有的 batch retry request，让 external runtime 重新发送有效 callback。`,
    actionLabel: "筛选 missing payload",
    warningThreshold: 1,
    dangerThreshold: 5,
  });

  pushReasonRecommendation(recommendations, {
    count: policyDisabledCount,
    reasonCategory: "policy_disabled",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("policy_disabled") ?? null,
    title: "agent remediation policy 已禁用",
    detail: `当前筛选范围内有 ${policyDisabledCount} 条 callback 因 agent remediation policy disabled 而被跳过。建议核对对应 agent 的自动补救策略是否被显式关闭。`,
    actionLabel: "筛选 policy disabled",
    warningThreshold: 1,
    dangerThreshold: 3,
  });

  pushReasonRecommendation(recommendations, {
    count: policyBudgetExhaustedCount,
    reasonCategory: "policy_budget_exhausted",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("policy_budget_exhausted") ?? null,
    title: "自动补救预算已耗尽",
    detail: `当前筛选范围内有 ${policyBudgetExhaustedCount} 条 callback 已耗尽自动补救预算。建议优先检查失败原因，再决定是调整 policy budget 还是改走人工 request retry / payload replay。`,
    actionLabel: "筛选 budget exhausted",
    warningThreshold: 1,
    dangerThreshold: 3,
  });

  pushReasonRecommendation(recommendations, {
    count: targetUnavailableCount,
    reasonCategory: getTargetUnavailableCategory(summary),
    reasonDisposition: "skipped",
    policyKey:
      topPolicyByReason.get("missing_agent") ??
      topPolicyByReason.get("target_unavailable") ??
      null,
    title: "callback 目标对象不可用",
    detail: `当前筛选范围内有 ${targetUnavailableCount} 条 callback 因 execution / agent / callback target 不可用而被跳过。建议优先核对 agent 是否仍启用，以及 execution 是否仍保留在预期状态。`,
    actionLabel: "筛选 target unavailable",
    warningThreshold: 1,
    dangerThreshold: 3,
  });

  pushReasonRecommendation(recommendations, {
    count: duplicateCooldownCount,
    reasonCategory: "duplicate_cooldown",
    reasonDisposition: "skipped",
    policyKey: topPolicyByReason.get("duplicate_cooldown") ?? null,
    title: "cooldown 正在抑制重复补救",
    detail: `当前筛选范围内有 ${duplicateCooldownCount} 条 callback 因重复 cooldown 被暂时跳过。建议切到该 slice 查看 next attempt 时间，避免 operator 在冷却窗口内重复触发。`,
    actionLabel: "筛选 duplicate cooldown",
    warningThreshold: 2,
    dangerThreshold: 8,
  });

  return recommendations;
}
