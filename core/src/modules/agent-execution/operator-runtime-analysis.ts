import type {
  AgentExecutionOperatorRecommendationSeverity,
  AgentExecutionRuntimePressureAlertView,
  AgentExecutionRuntimeProfileUtilizationView,
  AgentExecutionRuntimeSummaryBucket,
} from "@neuro/contracts";

function toSeverityFromAlertLevel(alertLevel: number): AgentExecutionOperatorRecommendationSeverity {
  if (alertLevel >= 3) {
    return "danger";
  }
  if (alertLevel >= 2) {
    return "warning";
  }
  return "info";
}

export function getRuntimePressureAlertLevel(entry: AgentExecutionRuntimeProfileUtilizationView) {
  switch (entry.schedulingDecisionClass) {
    case "profile_and_owner_saturated":
      return 3;
    case "profile_saturated":
      return entry.queuedExecutionCount > 0 ? 3 : 2;
    case "owner_hotspot":
      return entry.blockedByOwnerCount > 0 ? 3 : 2;
    case "queue_backlog":
      return entry.queuedExecutionCount >= 3 ? 2 : 1;
    case "within_capacity":
    default:
      return entry.pressureLevel === "watch" ? 1 : 0;
  }
}

function buildRuntimePressureAlertTitle(entry: AgentExecutionRuntimeProfileUtilizationView) {
  switch (entry.schedulingDecisionClass) {
    case "profile_and_owner_saturated":
      return `Runtime profile ${entry.key} 同时命中 profile saturation 与 owner hotspot`;
    case "profile_saturated":
      return `Runtime profile ${entry.key} 已达到并发上限`;
    case "owner_hotspot":
      return entry.blockedByOwnerCount > 0
        ? `Runtime profile ${entry.key} 的 owner quota 正在阻塞队列`
        : `Runtime profile ${entry.key} 出现 owner hotspot`;
    case "queue_backlog":
      return `Runtime profile ${entry.key} 出现 queue backlog`;
    case "within_capacity":
    default:
      return `Runtime profile ${entry.key} 正接近并发上限`;
  }
}

function buildRuntimePressureAlertDetail(entry: AgentExecutionRuntimeProfileUtilizationView) {
  const slotDetail =
    entry.maxConcurrentExecutions === null
      ? "profile slot=unbounded"
      : `profile slot=${entry.runningExecutionCount}/${entry.maxConcurrentExecutions}, available=${entry.availableExecutionSlots ?? 0}`;
  const ownerDetail =
    entry.maxConcurrentExecutionsPerOwner === null
      ? "owner slot=unbounded"
      : `owner slot=${entry.busiestOwnerRunningCount ?? 0}/${entry.maxConcurrentExecutionsPerOwner}, saturated=${entry.saturatedOwnerCount}`;
  const hotspotDetail = entry.busiestOwnerUserId ? ` busiestOwner=${entry.busiestOwnerUserId}.` : ".";
  const queueDetail = ` claimableQueued=${entry.claimableQueuedExecutionCount}, blockedQueued=${entry.blockedQueuedExecutionCount}, blockedByProfile=${entry.blockedByProfileCount}, blockedByOwner=${entry.blockedByOwnerCount}.`;
  const blockedOwnerDetail =
    entry.busiestBlockedOwnerUserId
      ? ` hottestBlockedOwner=${entry.busiestBlockedOwnerUserId}/${entry.busiestBlockedOwnerQueuedCount ?? 0}.`
      : "";
  return `${entry.pressureDetail} running=${entry.runningExecutionCount}, queued=${entry.queuedExecutionCount}, ${slotDetail}, ${ownerDetail}.${hotspotDetail}${queueDetail}${blockedOwnerDetail}`;
}

function buildRuntimePressureActionLabel(entry: AgentExecutionRuntimeProfileUtilizationView) {
  switch (entry.schedulingDecisionClass) {
    case "profile_and_owner_saturated":
      return "查看 profile + owner saturation";
    case "profile_saturated":
      return "查看 profile saturation";
    case "owner_hotspot":
      return entry.blockedByOwnerCount > 0 ? "查看 owner quota guardrail" : "查看 owner hotspot";
    case "queue_backlog":
      return "查看 queue backlog";
    case "within_capacity":
    default:
      return "查看 near-limit profile";
  }
}

export function buildRuntimePressureAlertBuckets(
  utilization: AgentExecutionRuntimeProfileUtilizationView[],
): AgentExecutionRuntimeSummaryBucket[] {
  const counts = new Map<number, number>();
  for (const entry of utilization) {
    const alertLevel = getRuntimePressureAlertLevel(entry);
    if (alertLevel <= 0) {
      continue;
    }
    counts.set(alertLevel, (counts.get(alertLevel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({
      key: String(key),
      count,
    }))
    .sort((left, right) => Number(right.key) - Number(left.key));
}

export function buildRuntimePressureAlerts(
  utilization: AgentExecutionRuntimeProfileUtilizationView[],
): AgentExecutionRuntimePressureAlertView[] {
  return utilization
    .map((entry) => {
      const alertLevel = getRuntimePressureAlertLevel(entry);
      if (alertLevel <= 0) {
        return null;
      }
      return {
        profileKey: entry.key,
        pressureLevel: entry.pressureLevel,
        schedulingDecisionClass: entry.schedulingDecisionClass,
        alertLevel,
        severity: toSeverityFromAlertLevel(alertLevel),
        title: buildRuntimePressureAlertTitle(entry),
        detail: buildRuntimePressureAlertDetail(entry),
        actionLabel: buildRuntimePressureActionLabel(entry),
        runningExecutionCount: entry.runningExecutionCount,
        queuedExecutionCount: entry.queuedExecutionCount,
        claimableQueuedExecutionCount: entry.claimableQueuedExecutionCount,
        blockedQueuedExecutionCount: entry.blockedQueuedExecutionCount,
        blockedByProfileCount: entry.blockedByProfileCount,
        blockedByOwnerCount: entry.blockedByOwnerCount,
        blockedOwnerCount: entry.blockedOwnerCount,
        availableExecutionSlots: entry.availableExecutionSlots,
        maxConcurrentExecutions: entry.maxConcurrentExecutions,
        maxConcurrentExecutionsPerOwner: entry.maxConcurrentExecutionsPerOwner,
        busiestOwnerUserId: entry.busiestOwnerUserId,
        busiestOwnerRunningCount: entry.busiestOwnerRunningCount,
        busiestBlockedOwnerUserId: entry.busiestBlockedOwnerUserId,
        busiestBlockedOwnerQueuedCount: entry.busiestBlockedOwnerQueuedCount,
        saturatedOwnerCount: entry.saturatedOwnerCount,
      } satisfies AgentExecutionRuntimePressureAlertView;
    })
    .filter((entry): entry is AgentExecutionRuntimePressureAlertView => Boolean(entry))
    .sort((left, right) => {
      return (
        right.alertLevel - left.alertLevel ||
        right.queuedExecutionCount - left.queuedExecutionCount ||
        right.runningExecutionCount - left.runningExecutionCount ||
        left.profileKey.localeCompare(right.profileKey)
      );
    });
}
