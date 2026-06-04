import type {
  FulfillmentOpsRecentRunView,
  FulfillmentOpsRecentRunWindowKey,
  FulfillmentOpsRecentRunWindowView,
  FulfillmentOpsRecommendationView,
  FulfillmentOpsSummaryBucket,
  ItemFulfillmentRunStatus,
  ItemFulfillmentRunTrigger,
  ItemManualReviewSummaryView,
} from "@neuro/contracts";

function getBucketCount(buckets: FulfillmentOpsSummaryBucket[], key: string) {
  return buckets.find((bucket) => bucket.key === key)?.count ?? 0;
}

function isWithinWindow(createdAt: string, windowKey: FulfillmentOpsRecentRunWindowKey, referenceTime: Date) {
  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return false;
  const durationMs = windowKey === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return createdAtMs >= referenceTime.getTime() - durationMs;
}

export function buildFulfillmentRecentRunWindows(
  runs: FulfillmentOpsRecentRunView[],
  referenceTime = new Date(),
): FulfillmentOpsRecentRunWindowView[] {
  const windowKeys: FulfillmentOpsRecentRunWindowKey[] = ["24h", "7d"];

  return windowKeys.map((key) => {
    const matchingRuns = runs.filter((run) => isWithinWindow(run.createdAt, key, referenceTime));
    const manualCount = matchingRuns.filter((run) => run.trigger === "manual").length;
    const scheduledCount = matchingRuns.filter((run) => run.trigger === "scheduled").length;
    const replacementRunCount = matchingRuns.filter((run) => run.replacementsCreated > 0).length;
    const replacementsCreated = matchingRuns.reduce((total, run) => total + run.replacementsCreated, 0);

    return {
      key,
      totalCount: matchingRuns.length,
      manualCount,
      scheduledCount,
      replacementRunCount,
      replacementsCreated,
    };
  });
}

function getWindowByKey(
  windows: FulfillmentOpsRecentRunWindowView[],
  key: FulfillmentOpsRecentRunWindowKey,
) {
  return windows.find((window) => window.key === key) ?? null;
}

export function buildFulfillmentOpsRecommendations(args: {
  manualReviews: ItemManualReviewSummaryView;
  recentRunWindows: FulfillmentOpsRecentRunWindowView[];
  latestRunAt: string | null;
}): FulfillmentOpsRecommendationView[] {
  const recommendations: FulfillmentOpsRecommendationView[] = [];
  const urgentCount = getBucketCount(args.manualReviews.byPriority, "urgent");
  const usageAuditCount = getBucketCount(args.manualReviews.byRoutingCode, "usage_audit_required");
  const poolHealthCount = getBucketCount(args.manualReviews.byRoutingCode, "high_replacement_frequency");
  const recent24h = getWindowByKey(args.recentRunWindows, "24h");
  const scheduled24h = recent24h?.scheduledCount ?? 0;
  const hasSweepGap = args.manualReviews.openCount > 0 && scheduled24h <= 0;

  if (urgentCount > 0 || (args.manualReviews.oldestOpenAgeHours ?? 0) >= 72) {
    recommendations.push({
      kind: "focus_urgent_queue",
      severity: urgentCount >= 3 || (args.manualReviews.oldestOpenAgeHours ?? 0) >= 96 ? "danger" : "warning",
      title: "先处理高龄人工复核",
      detail: `当前 open manual review 中有 ${urgentCount} 条 urgent 项，最老待处理约 ${args.manualReviews.oldestOpenAgeHours ?? 0} 小时。建议先收敛高优先级队列。`,
      actionLabel: "筛选 urgent 队列",
      priority: "urgent",
      routingCode: null,
      suggestedAction: null,
      reviewStatus: "open",
      runTrigger: null,
      runStatus: null,
      recentWindow: null,
    });
  }

  if (usageAuditCount > 0) {
    recommendations.push({
      kind: "inspect_usage_queue",
      severity: usageAuditCount >= 3 ? "warning" : "info",
      title: "核对 usage 争议队列",
      detail: `当前有 ${usageAuditCount} 条 review 落在 usage_audit_required，建议优先核对配额耗尽与正常耗尽的分流是否准确。`,
      actionLabel: "筛选 usage review",
      priority: null,
      routingCode: "usage_audit_required",
      suggestedAction: "audit_usage",
      reviewStatus: "open",
      runTrigger: null,
      runStatus: null,
      recentWindow: null,
    });
  }

  if (poolHealthCount > 0) {
    recommendations.push({
      kind: "inspect_pool_health",
      severity: poolHealthCount >= 3 ? "warning" : "info",
      title: "检查高替换频率资产",
      detail: `当前有 ${poolHealthCount} 条 high_replacement_frequency review，建议优先检查 maintained_pool 的来源稳定性和补位质量。`,
      actionLabel: "筛选 pool health review",
      priority: null,
      routingCode: "high_replacement_frequency",
      suggestedAction: "inspect_pool_health",
      reviewStatus: "open",
      runTrigger: null,
      runStatus: null,
      recentWindow: null,
    });
  }

  if (hasSweepGap) {
    recommendations.push({
      kind: "inspect_sweep_activity",
      severity: args.latestRunAt ? "warning" : "danger",
      title: "检查后台巡检活动",
      detail: `当前 open review 仍有 ${args.manualReviews.openCount} 条，但最近 24 小时没有 scheduled reconcile run。建议确认 worker sweep 是否按期执行。`,
      actionLabel: "查看 scheduled 巡检",
      priority: null,
      routingCode: null,
      suggestedAction: null,
      reviewStatus: null,
      runTrigger: "scheduled",
      runStatus: null,
      recentWindow: "7d",
    });
  }

  return recommendations;
}

export function filterFulfillmentRuns(args: {
  runs: FulfillmentOpsRecentRunView[];
  runTrigger?: ItemFulfillmentRunTrigger | "";
  runStatus?: ItemFulfillmentRunStatus | "";
  runWindow?: FulfillmentOpsRecentRunWindowKey | "";
  referenceTime?: Date;
}) {
  const referenceTime = args.referenceTime ?? new Date();
  return args.runs.filter((run) => {
    if (args.runTrigger && run.trigger !== args.runTrigger) return false;
    if (args.runStatus && run.status !== args.runStatus) return false;
    if (args.runWindow && !isWithinWindow(run.createdAt, args.runWindow, referenceTime)) return false;
    return true;
  });
}
