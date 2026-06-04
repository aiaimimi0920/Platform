import type {
  AgentExecutionCallbackAuditRecommendationView,
  AgentExecutionCallbackAuditSummaryBucket,
  AgentExecutionCallbackAuditSummaryView,
} from "@neuro/contracts";

function getBucketCount(buckets: AgentExecutionCallbackAuditSummaryBucket[], key: string) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

export function buildCallbackAuditRecommendations(
  summary: Pick<
    AgentExecutionCallbackAuditSummaryView,
    "totalCount" | "byStatus" | "byProtocolMatch" | "bySecretMatch" | "byRejectionCategory" | "byRetryability"
  >,
): AgentExecutionCallbackAuditRecommendationView[] {
  if (summary.totalCount <= 0) {
    return [];
  }

  const recommendations: AgentExecutionCallbackAuditRecommendationView[] = [];
  const duplicateCount = getBucketCount(summary.byStatus, "duplicate");
  const rejectedCount = getBucketCount(summary.byStatus, "rejected");
  const previousProtocolCount = getBucketCount(summary.byProtocolMatch, "previous");
  const previousSecretCount = getBucketCount(summary.bySecretMatch, "previous");
  const retryableRejectedCount = getBucketCount(summary.byRetryability, "retryable");
  const topRejectedCategory =
    summary.byRejectionCategory.slice().sort((left, right) => right.count - left.count)[0] ?? null;
  const duplicateRate = duplicateCount / summary.totalCount;
  const rejectedRate = rejectedCount / summary.totalCount;
  const previousProtocolRate = previousProtocolCount / summary.totalCount;
  const previousSecretRate = previousSecretCount / summary.totalCount;

  if (previousProtocolCount > 0) {
    recommendations.push({
      kind: "inspect_previous_protocol",
      severity: previousProtocolCount >= 5 || previousProtocolRate >= 0.3 ? "danger" : "warning",
      title: "旧协议仍在命中",
      detail: `当前筛选范围内仍有 ${previousProtocolCount} 条 callback 命中了旧协议。建议核对 grace window 是否该收敛，并确认外部执行端是否已经完成协议切换。`,
      actionLabel: "筛选旧协议 callback",
      protocolMatch: "previous",
      secretMatch: null,
      status: null,
      rejectionCategory: null,
      retryability: null,
    });
  }

  if (previousSecretCount > 0) {
    recommendations.push({
      kind: "inspect_previous_secret",
      severity: previousSecretCount >= 5 || previousSecretRate >= 0.3 ? "danger" : "warning",
      title: "旧密钥仍在命中",
      detail: `当前筛选范围内仍有 ${previousSecretCount} 条 callback 命中了旧密钥。建议核对 secret grace window 与外部 runtime 的密钥轮换进度。`,
      actionLabel: "筛选旧密钥 callback",
      protocolMatch: null,
      secretMatch: "previous",
      status: null,
      rejectionCategory: null,
      retryability: null,
    });
  }

  if (duplicateCount > 0) {
    recommendations.push({
      kind: "inspect_duplicates",
      severity: duplicateCount >= 10 || duplicateRate >= 0.3 ? "danger" : "warning",
      title: "duplicate callback 偏高",
      detail: `当前筛选范围内 duplicate callback 为 ${duplicateCount} 条，占比约 ${Math.round(duplicateRate * 100)}%。建议核对 callback 重放、签名重试和幂等行为。`,
      actionLabel: "筛选 duplicate callback",
      protocolMatch: null,
      secretMatch: null,
      status: "duplicate",
      rejectionCategory: null,
      retryability: null,
    });
  }

  if (retryableRejectedCount > 0) {
    recommendations.push({
      kind: "inspect_rejected",
      severity: retryableRejectedCount >= 5 ? "danger" : "warning",
      title: "可重试 rejected callback 待补救",
      detail: `当前筛选范围内有 ${retryableRejectedCount} 条 rejected callback 被判定为可重试，适合由 operator 批量记录 retry request。`,
      actionLabel: "筛选 retryable rejected",
      protocolMatch: null,
      secretMatch: null,
      status: "rejected",
      rejectionCategory: null,
      retryability: "retryable",
    });
  }

  if (rejectedCount > 0) {
    const dominantCategoryLabel = topRejectedCategory?.key ? `，其中 ${topRejectedCategory.key} 最多` : "";
    recommendations.push({
      kind: "inspect_rejected",
      severity: rejectedCount >= 5 || rejectedRate >= 0.2 ? "danger" : "warning",
      title: "rejected callback 需要补救",
      detail:
        `当前筛选范围内 rejected callback 为 ${rejectedCount} 条${dominantCategoryLabel}。` +
        "建议先定位主拒绝类别，并由 operator 发起 retry request 让 external runtime 重新发送有效 callback。",
      actionLabel: topRejectedCategory?.key ? "筛选主拒绝类别" : "筛选 rejected callback",
      protocolMatch: null,
      secretMatch: null,
      status: "rejected",
      rejectionCategory: (topRejectedCategory?.key as AgentExecutionCallbackAuditRecommendationView["rejectionCategory"]) ?? null,
      retryability: null,
    });
  }

  return recommendations;
}
