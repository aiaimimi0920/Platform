import type { AgentExecutionRuntimeProfileKey, AgentExecutionRuntimeProfileUtilizationView } from "@neuro/contracts";

type RuntimeProfileOwnerCount = {
  ownerUserId: string;
  runningExecutionCount: number;
};

type RuntimeProfileQueuedCandidate = {
  ownerUserId: string;
};

type BuildRuntimeProfileUtilizationArgs = {
  key: AgentExecutionRuntimeProfileKey;
  maxConcurrentExecutions: number | null;
  maxConcurrentExecutionsPerOwner: number | null;
  runningExecutionCount: number;
  queuedExecutionCount: number;
  ownerRunningCounts: RuntimeProfileOwnerCount[];
  queuedCandidates?: RuntimeProfileQueuedCandidate[];
};

function analyzeQueuedExecutionGuardrails(args: {
  maxConcurrentExecutions: number | null;
  maxConcurrentExecutionsPerOwner: number | null;
  runningExecutionCount: number;
  ownerRunningCounts: RuntimeProfileOwnerCount[];
  queuedCandidates: RuntimeProfileQueuedCandidate[];
}) {
  const runningByOwner = new Map(args.ownerRunningCounts.map((entry) => [entry.ownerUserId, entry.runningExecutionCount]));
  let remainingProfileSlots =
    args.maxConcurrentExecutions === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, args.maxConcurrentExecutions - args.runningExecutionCount);
  let claimableQueuedExecutionCount = 0;
  let blockedByProfileCount = 0;
  let blockedByOwnerCount = 0;
  const blockedByOwnerMap = new Map<string, number>();

  for (const candidate of args.queuedCandidates) {
    const ownerUserId = candidate.ownerUserId;
    const ownerRunningCount = runningByOwner.get(ownerUserId) ?? 0;
    const profileBlocked = args.maxConcurrentExecutions !== null && remainingProfileSlots <= 0;
    if (profileBlocked) {
      blockedByProfileCount += 1;
      continue;
    }
    if (
      args.maxConcurrentExecutionsPerOwner !== null &&
      ownerRunningCount >= args.maxConcurrentExecutionsPerOwner
    ) {
      blockedByOwnerCount += 1;
      blockedByOwnerMap.set(ownerUserId, (blockedByOwnerMap.get(ownerUserId) ?? 0) + 1);
      continue;
    }
    claimableQueuedExecutionCount += 1;
    runningByOwner.set(ownerUserId, ownerRunningCount + 1);
    if (Number.isFinite(remainingProfileSlots)) {
      remainingProfileSlots -= 1;
    }
  }

  const busiestBlockedOwner = [...blockedByOwnerMap.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0] ?? null;
  return {
    claimableQueuedExecutionCount,
    blockedQueuedExecutionCount: blockedByProfileCount + blockedByOwnerCount,
    blockedByProfileCount,
    blockedByOwnerCount,
    blockedOwnerCount: blockedByOwnerMap.size,
    busiestBlockedOwnerUserId: busiestBlockedOwner?.[0] ?? null,
    busiestBlockedOwnerQueuedCount: busiestBlockedOwner?.[1] ?? null,
  };
}

export function buildRuntimeProfileUtilizationView(
  args: BuildRuntimeProfileUtilizationArgs,
): AgentExecutionRuntimeProfileUtilizationView {
  const maxConcurrentExecutionsPerOwner = args.maxConcurrentExecutionsPerOwner;
  const availableExecutionSlots =
    args.maxConcurrentExecutions === null ? null : Math.max(0, args.maxConcurrentExecutions - args.runningExecutionCount);
  const sortedOwnerCounts = [...args.ownerRunningCounts].sort(
    (left, right) => right.runningExecutionCount - left.runningExecutionCount || left.ownerUserId.localeCompare(right.ownerUserId),
  );
  const busiestOwner = sortedOwnerCounts[0] ?? null;
  const saturatedOwnerCount =
    maxConcurrentExecutionsPerOwner === null
      ? 0
      : sortedOwnerCounts.filter((entry) => entry.runningExecutionCount >= maxConcurrentExecutionsPerOwner).length;
  const profileSaturated =
    args.maxConcurrentExecutions !== null && args.runningExecutionCount >= args.maxConcurrentExecutions;
  const profileNearLimit =
    args.maxConcurrentExecutions !== null &&
    !profileSaturated &&
    args.maxConcurrentExecutions > 0 &&
    args.runningExecutionCount >= Math.max(1, args.maxConcurrentExecutions - 1);
  const ownerHotspot = saturatedOwnerCount > 0;
  const ownerNearLimit =
    maxConcurrentExecutionsPerOwner !== null &&
    maxConcurrentExecutionsPerOwner >= 3 &&
    !!busiestOwner &&
    busiestOwner.runningExecutionCount >= maxConcurrentExecutionsPerOwner - 1;
  const queuedGuardrail = analyzeQueuedExecutionGuardrails({
    maxConcurrentExecutions: args.maxConcurrentExecutions,
    maxConcurrentExecutionsPerOwner: args.maxConcurrentExecutionsPerOwner,
    runningExecutionCount: args.runningExecutionCount,
    ownerRunningCounts: args.ownerRunningCounts,
    queuedCandidates: args.queuedCandidates ?? [],
  });

  const schedulingDecisionClass: AgentExecutionRuntimeProfileUtilizationView["schedulingDecisionClass"] =
    args.queuedExecutionCount > 0 && profileSaturated && ownerHotspot
      ? "profile_and_owner_saturated"
      : profileSaturated
        ? "profile_saturated"
        : ownerHotspot
          ? "owner_hotspot"
          : args.queuedExecutionCount > 0
            ? "queue_backlog"
            : "within_capacity";

  const pressureLevel: AgentExecutionRuntimeProfileUtilizationView["pressureLevel"] =
    args.queuedExecutionCount > 0 && (profileSaturated || ownerHotspot)
      ? "critical"
      : args.queuedExecutionCount > 0 || profileNearLimit || ownerNearLimit
        ? "watch"
        : "healthy";

  const pressureDetail =
    schedulingDecisionClass === "profile_and_owner_saturated"
      ? `Runtime profile ${args.key} is fully saturated, carries ${args.queuedExecutionCount} queued execution(s), and at least one owner is already at the per-owner concurrency ceiling.`
      : schedulingDecisionClass === "profile_saturated"
        ? `Runtime profile ${args.key} is at the profile-wide concurrency ceiling${args.queuedExecutionCount > 0 ? ` with ${args.queuedExecutionCount} queued execution(s) waiting for slots.` : "."}`
        : schedulingDecisionClass === "owner_hotspot"
          ? `Runtime profile ${args.key} remains globally available, but owner-level concurrency is hot${busiestOwner ? ` around ${busiestOwner.ownerUserId}` : ""}.`
          : schedulingDecisionClass === "queue_backlog"
          ? `Runtime profile ${args.key} still has capacity, but ${args.queuedExecutionCount} queued execution(s) indicate backlog pressure that may soon exhaust slots.`
            : `Runtime profile ${args.key} currently runs within its profile and owner concurrency envelope.`;
  const guardrailDetail =
    queuedGuardrail.blockedQueuedExecutionCount > 0
      ? ` claimable=${queuedGuardrail.claimableQueuedExecutionCount}, blockedByProfile=${queuedGuardrail.blockedByProfileCount}, blockedByOwner=${queuedGuardrail.blockedByOwnerCount}${queuedGuardrail.busiestBlockedOwnerUserId ? `, hottestBlockedOwner=${queuedGuardrail.busiestBlockedOwnerUserId}/${queuedGuardrail.busiestBlockedOwnerQueuedCount ?? 0}` : ""}.`
      : args.queuedExecutionCount > 0
        ? ` claimable=${queuedGuardrail.claimableQueuedExecutionCount}, blocked=0.`
        : "";

  return {
    key: args.key,
    maxConcurrentExecutions: args.maxConcurrentExecutions,
    maxConcurrentExecutionsPerOwner: args.maxConcurrentExecutionsPerOwner,
    runningExecutionCount: args.runningExecutionCount,
    queuedExecutionCount: args.queuedExecutionCount,
    claimableQueuedExecutionCount: queuedGuardrail.claimableQueuedExecutionCount,
    blockedQueuedExecutionCount: queuedGuardrail.blockedQueuedExecutionCount,
    blockedByProfileCount: queuedGuardrail.blockedByProfileCount,
    blockedByOwnerCount: queuedGuardrail.blockedByOwnerCount,
    blockedOwnerCount: queuedGuardrail.blockedOwnerCount,
    availableExecutionSlots,
    busiestOwnerUserId: busiestOwner?.ownerUserId ?? null,
    busiestOwnerRunningCount: busiestOwner?.runningExecutionCount ?? null,
    busiestBlockedOwnerUserId: queuedGuardrail.busiestBlockedOwnerUserId,
    busiestBlockedOwnerQueuedCount: queuedGuardrail.busiestBlockedOwnerQueuedCount,
    saturatedOwnerCount,
    pressureLevel,
    schedulingDecisionClass,
    pressureDetail: `${pressureDetail}${guardrailDetail}`,
  };
}
