import type {
  EventName,
  OutboxAlertView,
  OutboxOpsRecommendationView,
  OutboxSummaryBucket,
  OutboxSummaryView,
} from "@neuro/contracts";

function getBucketCount(buckets: OutboxSummaryBucket[], key: string) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

export function buildOutboxRecommendations(summary: Pick<
  OutboxSummaryView,
  | "pendingCount"
  | "processingCount"
  | "deadLetterCount"
  | "oldestPendingAgeHours"
  | "processingLeaseTimeoutMinutes"
  | "staleProcessingCount"
  | "oldestStaleProcessingAgeMinutes"
  | "topDeadLetterEvents"
>): OutboxOpsRecommendationView[] {
  const recommendations: OutboxOpsRecommendationView[] = [];

  if (summary.deadLetterCount > 0) {
    const dominantDeadLetter = summary.topDeadLetterEvents[0] ?? null;
    const dominantShare =
      dominantDeadLetter && summary.deadLetterCount > 0 ? dominantDeadLetter.count / summary.deadLetterCount : 0;
    const suggestedLimit = Math.min(Math.max(summary.deadLetterCount, 5), 50);
    recommendations.push({
      kind: "retry_dead_letter_batch",
      severity: summary.deadLetterCount >= 10 ? "danger" : "warning",
      title: "dead-letter 队列需要清理",
      detail: dominantDeadLetter
        ? `当前 dead-letter 共 ${summary.deadLetterCount} 条，其中 ${dominantDeadLetter.key} 占 ${dominantDeadLetter.count} 条。适合先做一轮批量重放。`
        : `当前 dead-letter 共 ${summary.deadLetterCount} 条，适合先做一轮批量重放。`,
      actionLabel: dominantDeadLetter && dominantShare >= 0.5 ? "重放主失败事件" : "批量重放 dead-letter",
      status: "dead_letter",
      eventName:
        dominantDeadLetter && dominantShare >= 0.5 ? (dominantDeadLetter.key as EventName) : null,
      suggestedLimit,
    });
  }

  if (summary.pendingCount > 20 || (summary.oldestPendingAgeHours ?? 0) >= 1) {
    recommendations.push({
      kind: "inspect_pending_backlog",
      severity: summary.pendingCount >= 50 || (summary.oldestPendingAgeHours ?? 0) >= 6 ? "danger" : "warning",
      title: "pending backlog 需要排查",
      detail: `当前 pending 为 ${summary.pendingCount} 条，最老待处理约 ${summary.oldestPendingAgeHours ?? 0} 小时。建议先检查 backlog 是否在增长。`,
      actionLabel: "查看 pending 队列",
      status: "pending",
      eventName: null,
      suggestedLimit: null,
    });
  }

  if (summary.staleProcessingCount > 0) {
    recommendations.push({
      kind: "recover_stale_processing_queue",
      severity:
        summary.staleProcessingCount >= 5 ||
        (summary.oldestStaleProcessingAgeMinutes ?? 0) >= summary.processingLeaseTimeoutMinutes * 3
          ? "danger"
          : "warning",
      title: "processing 队列存在超时租约",
      detail: `当前有 ${summary.staleProcessingCount} 条 processing 事件已超过 ${summary.processingLeaseTimeoutMinutes} 分钟未完成，最老超时约 ${summary.oldestStaleProcessingAgeMinutes ?? 0} 分钟。worker 正常运行时会自动回收；若数字持续不下降，应排查 worker 停摆或同类事件重复卡死。`,
      actionLabel: "查看 processing 队列",
      status: "processing",
      eventName: null,
      suggestedLimit: null,
    });
  }

  if (summary.processingCount > 5 && summary.staleProcessingCount === 0) {
    recommendations.push({
      kind: "inspect_processing_queue",
      severity: summary.processingCount >= 15 ? "danger" : "warning",
      title: "processing 队列偏高",
      detail: `当前 processing 为 ${summary.processingCount} 条，建议排查是否存在 worker 卡顿或同类事件持续阻塞。`,
      actionLabel: "查看 processing 队列",
      status: "processing",
      eventName: null,
      suggestedLimit: null,
    });
  }

  return recommendations;
}

export function buildOutboxAlerts(summary: Pick<
  OutboxSummaryView,
  | "pendingCount"
  | "deadLetterCount"
  | "processingLeaseTimeoutMinutes"
  | "oldestPendingAgeHours"
  | "staleProcessingCount"
  | "oldestStaleProcessingAgeMinutes"
>): OutboxAlertView[] {
  const alerts: OutboxAlertView[] = [];

  if (summary.deadLetterCount >= 3) {
    const alertLevel = summary.deadLetterCount >= 10 ? 3 : 2;
    alerts.push({
      kind: "dead_letter_backlog",
      count: summary.deadLetterCount,
      alertLevel,
      severity: alertLevel >= 3 ? "danger" : "warning",
      title: "Outbox dead-letter backlog 需要处理",
      detail: `当前 dead-letter 队列有 ${summary.deadLetterCount} 条事件。若不及时重放或修复根因，相关异步副作用会长期停留在失败态。`,
      actionLabel: "查看 dead-letter 队列",
      status: "dead_letter",
      eventName: null,
      suggestedLimit: Math.min(Math.max(summary.deadLetterCount, 5), 50),
    });
  }

  if (summary.staleProcessingCount > 0) {
    const alertLevel =
      summary.staleProcessingCount >= 5 ||
      (summary.oldestStaleProcessingAgeMinutes ?? 0) >= summary.processingLeaseTimeoutMinutes * 3
        ? 3
        : 2;
    alerts.push({
      kind: "stale_processing",
      count: summary.staleProcessingCount,
      alertLevel,
      severity: alertLevel >= 3 ? "danger" : "warning",
      title: "Outbox processing 队列出现超时租约",
      detail: `当前有 ${summary.staleProcessingCount} 条 processing 事件超过 ${summary.processingLeaseTimeoutMinutes} 分钟仍未完成，最老超时约 ${summary.oldestStaleProcessingAgeMinutes ?? 0} 分钟。`,
      actionLabel: "查看 processing 队列",
      status: "processing",
      eventName: null,
      suggestedLimit: null,
    });
  }

  const pendingAlert =
    summary.pendingCount >= 50 || (summary.oldestPendingAgeHours ?? 0) >= 6;
  if (pendingAlert) {
    const alertLevel =
      summary.pendingCount >= 150 || (summary.oldestPendingAgeHours ?? 0) >= 24
        ? 3
        : 2;
    alerts.push({
      kind: "pending_backlog",
      count: summary.pendingCount,
      alertLevel,
      severity: alertLevel >= 3 ? "danger" : "warning",
      title: "Outbox pending backlog 持续堆积",
      detail: `当前 pending 队列有 ${summary.pendingCount} 条事件，最老待处理约 ${summary.oldestPendingAgeHours ?? 0} 小时，说明消费速度可能已落后于事件写入速度。`,
      actionLabel: "查看 pending 队列",
      status: "pending",
      eventName: null,
      suggestedLimit: null,
    });
  }

  return alerts;
}
