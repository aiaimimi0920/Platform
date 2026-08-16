import type {
  ItemFulfillmentAnomalyKind,
  ItemFulfillmentAnomalySeverity,
  ItemManualReviewPriority,
  ItemManualReviewRoutingCode,
  ItemManualReviewSlaBucket,
  ManualReviewRebalanceAssignmentView,
} from "@neuro/contracts";
import { eq } from "drizzle-orm";

import { env } from "@/env";
import {
  itemFulfillmentAnomalies,
  itemManualReviews,
} from "@/modules/product-order-item/schema";

import type { DbTx } from "./shared";

export function getManualReviewAgeHours(createdAt: Date, referenceTime: Date) {
  return Math.max(0, Math.floor((referenceTime.getTime() - createdAt.getTime()) / (60 * 60 * 1000)));
}

export function getManualReviewPriority(args: {
  routingCode: ItemManualReviewRoutingCode;
  ageHours: number;
}): ItemManualReviewPriority {
  if (args.ageHours >= 72) {
    return "urgent";
  }
  if (args.routingCode === "high_replacement_frequency" || args.ageHours >= 24) {
    return "high";
  }
  return "normal";
}

export function getManualReviewPriorityRank(priority: ItemManualReviewPriority) {
  switch (priority) {
    case "urgent":
      return 3;
    case "high":
      return 2;
    default:
      return 1;
  }
}

export function getManualReviewSlaPolicy(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
}) {
  const routingKey = `routing:${args.routingCode}`;
  const priorityKey = `priority:${args.priority}`;
  if (env.manualReviewSlaPolicies[routingKey]) {
    return {
      key: routingKey,
      scope: "routing" as const,
      ...env.manualReviewSlaPolicies[routingKey],
    };
  }
  if (env.manualReviewSlaPolicies[priorityKey]) {
    return {
      key: priorityKey,
      scope: "priority" as const,
      ...env.manualReviewSlaPolicies[priorityKey],
    };
  }
  return {
    key: "default",
    scope: "default" as const,
    ...env.manualReviewSlaPolicies.default,
  };
}

export function getManualReviewSlaBucket(args: {
  ageHours: number;
  priority: ItemManualReviewPriority;
  routingCode: ItemManualReviewRoutingCode;
}): ItemManualReviewSlaBucket {
  const policy = getManualReviewSlaPolicy({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  if (args.ageHours >= policy.slaHours) {
    return "breached";
  }
  if (args.ageHours >= Math.max(1, policy.slaHours - policy.dueSoonLeadHours)) {
    return "due_soon";
  }
  return "on_track";
}

export function getManualReviewSlaAnomalySeverity(args: {
  ageHours: number;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
}): ItemFulfillmentAnomalySeverity {
  if (args.slaPolicy.criticalAfterHours !== null && args.ageHours >= args.slaPolicy.criticalAfterHours) {
    return "critical";
  }
  return args.slaPolicy.anomalySeverity ?? "warning";
}

export function getManualReviewSlaAnomalyProgress(args: {
  ageHours: number;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  referenceTime: Date;
}) {
  const severity = getManualReviewSlaAnomalySeverity({
    ageHours: args.ageHours,
    slaPolicy: args.slaPolicy,
  });
  let alertLevel = severity === "critical" ? 2 : 1;
  let nextEscalationAt: Date | null = null;

  if (args.slaPolicy.urgentAfterHours !== null && args.ageHours >= args.slaPolicy.urgentAfterHours) {
    alertLevel = 3;
  } else if (args.slaPolicy.urgentAfterHours !== null && args.ageHours < args.slaPolicy.urgentAfterHours) {
    nextEscalationAt = new Date(
      args.referenceTime.getTime() + (args.slaPolicy.urgentAfterHours - args.ageHours) * 60 * 60 * 1000,
    );
  } else if (
    severity !== "critical" &&
    args.slaPolicy.criticalAfterHours !== null &&
    args.ageHours < args.slaPolicy.criticalAfterHours
  ) {
    nextEscalationAt = new Date(
      args.referenceTime.getTime() + (args.slaPolicy.criticalAfterHours - args.ageHours) * 60 * 60 * 1000,
    );
  }

  return {
    severity,
    alertLevel,
    nextEscalationAt,
  };
}

export function getManualReviewSlaAnomalyRuleState(args: {
  ageHours: number;
  anomalyKind: ItemFulfillmentAnomalyKind;
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  referenceTime: Date;
}) {
  const baseProgress = getManualReviewSlaAnomalyProgress(args);
  const sortedStages = [...args.slaPolicy.anomalyStages]
    .filter((stage) => {
      const kindMatch = !stage.appliesToKinds || stage.appliesToKinds.length === 0 || stage.appliesToKinds.includes(args.anomalyKind);
      const routingMatch =
        !stage.routingCodes || stage.routingCodes.length === 0 || stage.routingCodes.includes(args.routingCode);
      const priorityMatch =
        !stage.priorities || stage.priorities.length === 0 || stage.priorities.includes(args.priority);
      return kindMatch && routingMatch && priorityMatch;
    })
    .sort((left, right) => left.minAgeHours - right.minAgeHours);

  let severity = baseProgress.severity;
  let alertLevel = baseProgress.alertLevel;
  let anomalyPolicyKey = args.slaPolicy.anomalyPolicyKey;
  let anomalyEscalationStrategy = args.slaPolicy.anomalyEscalationStrategy;
  let anomalyAutoAction = args.slaPolicy.anomalyAutoAction;
  let autoActionTemplateKey = args.slaPolicy.autoAssignTemplateKey ?? null;
  let cooldownMinutes = args.slaPolicy.anomalyCooldownMinutes;
  let matchedStageKey: string | null = null;

  for (const stage of sortedStages) {
    if (args.ageHours < stage.minAgeHours) {
      break;
    }
    matchedStageKey = stage.key;
    if (stage.severity !== null) severity = stage.severity;
    if (stage.alertLevel !== null) alertLevel = stage.alertLevel;
    if (stage.anomalyPolicyKey !== null) anomalyPolicyKey = stage.anomalyPolicyKey;
    if (stage.anomalyEscalationStrategy !== null) anomalyEscalationStrategy = stage.anomalyEscalationStrategy;
    if (stage.anomalyAutoAction !== null) anomalyAutoAction = stage.anomalyAutoAction;
    if (stage.autoActionTemplateKey !== null) autoActionTemplateKey = stage.autoActionTemplateKey;
    if (stage.cooldownMinutes !== null) cooldownMinutes = stage.cooldownMinutes;
  }

  const nextStage = sortedStages.find((stage) => args.ageHours < stage.minAgeHours) ?? null;
  const nextEscalationAt = nextStage
    ? new Date(args.referenceTime.getTime() + (nextStage.minAgeHours - args.ageHours) * 60 * 60 * 1000)
    : baseProgress.nextEscalationAt;
  const nextAlertEligibleAt =
    cooldownMinutes !== null ? new Date(args.referenceTime.getTime() + cooldownMinutes * 60 * 1000) : null;

  return {
    severity,
    alertLevel,
    anomalyPolicyKey,
    anomalyEscalationStrategy,
    anomalyAutoAction,
    autoActionTemplateKey,
    cooldownMinutes,
    nextEscalationAt,
    nextAlertEligibleAt,
    matchedStageKey,
  };
}

const manualReviewLinkedAnomalyKinds = new Set<ItemFulfillmentAnomalyKind>([
  "manual_review_routed",
  "stale_manual_review",
  "sla_due_soon_unclaimed",
  "sla_breach_unclaimed",
]);

export async function getManualReviewLinkedAnomalyRuleStateInTx(args: {
  tx: DbTx;
  anomaly: typeof itemFulfillmentAnomalies.$inferSelect;
  referenceTime: Date;
}) {
  const anomalyKind = args.anomaly.kind as ItemFulfillmentAnomalyKind;
  if (!args.anomaly.reviewId || !manualReviewLinkedAnomalyKinds.has(anomalyKind)) {
    return null;
  }

  const [review] = await args.tx
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.id, args.anomaly.reviewId))
    .limit(1);
  if (!review || review.status !== "open") {
    return null;
  }

  const ageHours = getManualReviewAgeHours(review.createdAt, args.referenceTime);
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const slaPolicy = getManualReviewSlaPolicy({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    priority,
  });
  const anomalyProgress = getManualReviewSlaAnomalyProgress({
    ageHours,
    slaPolicy,
    referenceTime: args.referenceTime,
  });
  const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
    ageHours,
    anomalyKind,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    priority,
    slaPolicy,
    referenceTime: args.referenceTime,
  });
  const slaDrivenAutoAction = getManualReviewSlaDrivenAutoAction({
    slaPolicy,
    anomalyProgress,
    ageHours,
  });

  return {
    review,
    ageHours,
    priority,
    slaPolicy,
    anomalyRuleState,
    effectiveAutoAction: anomalyRuleState.anomalyAutoAction ?? slaDrivenAutoAction.autoAction,
    effectiveAutoActionTemplateKey:
      anomalyRuleState.autoActionTemplateKey ?? slaDrivenAutoAction.autoActionTemplateKey,
  };
}

export function getManualReviewSlaDrivenAutoAction(args: {
  slaPolicy: ReturnType<typeof getManualReviewSlaPolicy>;
  anomalyProgress: ReturnType<typeof getManualReviewSlaAnomalyProgress>;
  ageHours: number;
}) {
  if (!args.slaPolicy.autoAssignEnabled) {
    return {
      autoAction: null,
      autoActionTemplateKey: null,
    };
  }

  if (args.slaPolicy.rebalanceAfterHours !== null && args.ageHours >= args.slaPolicy.rebalanceAfterHours) {
    return {
      autoAction: "rebalance_queue" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.slaPolicy.assignAfterHours !== null && args.ageHours >= args.slaPolicy.assignAfterHours) {
    return {
      autoAction: "assign_template" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.slaPolicy.anomalyAutoAction) {
    return {
      autoAction: args.slaPolicy.anomalyAutoAction,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.anomalyProgress.alertLevel >= 3) {
    return {
      autoAction: "rebalance_queue" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  if (args.anomalyProgress.alertLevel >= 2) {
    return {
      autoAction: "assign_template" as const,
      autoActionTemplateKey: args.slaPolicy.autoAssignTemplateKey ?? null,
    };
  }

  return {
    autoAction: null,
    autoActionTemplateKey: null,
  };
}

export function getManualReviewSlaRank(bucket: ItemManualReviewSlaBucket) {
  switch (bucket) {
    case "breached":
      return 3;
    case "due_soon":
      return 2;
    default:
      return 1;
  }
}

export function getManualReviewEscalationLevel(args: {
  ageHours: number;
  slaBucket: ItemManualReviewSlaBucket;
  priority: ItemManualReviewPriority;
  routingCode: ItemManualReviewRoutingCode;
}) {
  const policy = getManualReviewSlaPolicy({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  if (args.slaBucket !== "breached") return 0;
  if (policy.urgentAfterHours !== null && args.ageHours >= policy.urgentAfterHours) return 3;
  if (policy.criticalAfterHours !== null && args.ageHours >= policy.criticalAfterHours) return 2;
  return 1;
}

export function getManualReviewAgeBucket(ageHours: number) {
  if (ageHours < 24) return "under_24h";
  if (ageHours < 72) return "24h_to_72h";
  return "72h_plus";
}

export function getManualReviewClaimAgeHours(claimedAt: Date | null, referenceTime: Date) {
  if (!claimedAt) return null;
  return Math.max(0, Math.floor((referenceTime.getTime() - claimedAt.getTime()) / (60 * 60 * 1000)));
}

export function getManualReviewClaimAgeBucket(claimAgeHours: number | null) {
  if (claimAgeHours === null) return "unclaimed";
  if (claimAgeHours < env.manualReviewStaleClaimHours) return "active_claim";
  return "stale_claim";
}

export function isManualReviewClaimStale(claimedAt: Date | null, referenceTime: Date) {
  const claimAgeHours = getManualReviewClaimAgeHours(claimedAt, referenceTime);
  return claimAgeHours !== null && claimAgeHours >= env.manualReviewStaleClaimHours;
}

export function getRecommendedManualReviewAssignee(args: {
  currentOperatorUserId: string;
  assigneePool?: string[] | null;
  byAssignee: Array<{
    key: string;
    claimedCount: number;
    processingCount: number;
    avgClaimAgeHours: number | null;
    capacity?: number;
    remainingCapacity?: number;
    atCapacity?: boolean;
  }>;
}) {
  const operatorIds =
    args.assigneePool && args.assigneePool.length > 0
      ? args.assigneePool
      : env.platformOperatorUserIds.length > 0
        ? env.platformOperatorUserIds
        : [args.currentOperatorUserId];
  const loadByOperator = new Map<
    string,
    {
      claimedCount: number;
      processingCount: number;
      avgClaimAgeHours: number;
      capacity?: number;
      remainingCapacity?: number;
      atCapacity?: boolean;
    }
  >(
    args.byAssignee.map((bucket) => [
      bucket.key,
      {
        claimedCount: bucket.claimedCount,
        processingCount: bucket.processingCount,
        avgClaimAgeHours: bucket.avgClaimAgeHours ?? 0,
      },
    ]),
  );

  const ranked = operatorIds
    .map((operatorId) => ({
      operatorId,
      claimedCount: loadByOperator.get(operatorId)?.claimedCount ?? 0,
      processingCount: loadByOperator.get(operatorId)?.processingCount ?? 0,
      avgClaimAgeHours: loadByOperator.get(operatorId)?.avgClaimAgeHours ?? 0,
      capacity: loadByOperator.get(operatorId)?.capacity ?? getManualReviewAssigneeCapacity(operatorId),
      remainingCapacity:
        loadByOperator.get(operatorId)?.remainingCapacity ??
        Math.max(0, getManualReviewAssigneeCapacity(operatorId) - (loadByOperator.get(operatorId)?.claimedCount ?? 0)),
      atCapacity:
        loadByOperator.get(operatorId)?.atCapacity ??
        isManualReviewAssigneeAtCapacity({
          operatorUserId: operatorId,
          claimedCount: loadByOperator.get(operatorId)?.claimedCount ?? 0,
        }),
    }))
    .sort((left, right) => {
      if (left.atCapacity !== right.atCapacity) return Number(left.atCapacity) - Number(right.atCapacity);
      if (left.processingCount !== right.processingCount) return left.processingCount - right.processingCount;
      if (left.claimedCount !== right.claimedCount) return left.claimedCount - right.claimedCount;
      if (left.avgClaimAgeHours !== right.avgClaimAgeHours) return left.avgClaimAgeHours - right.avgClaimAgeHours;
      return left.operatorId.localeCompare(right.operatorId);
    });

  const available = ranked.filter((candidate) => !candidate.atCapacity && candidate.remainingCapacity > 0);
  return available[0]?.operatorId ?? null;
}

export function normalizeManualReviewAssigneePool(operatorUserId: string, assigneePool?: string[] | null) {
  const allowedPool =
    env.platformOperatorUserIds.length > 0 ? new Set(env.platformOperatorUserIds) : new Set([operatorUserId]);
  const normalized = (assigneePool ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && allowedPool.has(value));

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  if (allowedPool.size > 0) {
    return Array.from(allowedPool);
  }

  return [operatorUserId];
}

export function getRoutingAwareManualReviewAssigneePool(args: {
  operatorUserId: string;
  routingCode: ItemManualReviewRoutingCode;
  explicitAssigneePool?: string[] | null;
}) {
  const explicitPool = normalizeManualReviewAssigneePool(args.operatorUserId, args.explicitAssigneePool ?? null);
  if ((args.explicitAssigneePool ?? []).length > 0 && explicitPool.length > 0) {
    return {
      assigneePool: explicitPool,
      policySource: "explicit_pool" as const,
    };
  }

  const routingPool = env.manualReviewRoutingAssigneePools[args.routingCode] ?? [];
  if (routingPool.length > 0) {
    return {
      assigneePool: routingPool,
      policySource: "routing_pool" as const,
    };
  }

  return {
    assigneePool: normalizeManualReviewAssigneePool(args.operatorUserId, null),
    policySource: "global_pool" as const,
  };
}

export function getManualReviewAutoAssignTemplate(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
}) {
  const slaPolicy = getManualReviewSlaPolicy(args);
  if (
    slaPolicy.autoAssignTemplateKey &&
    env.manualReviewAutoAssignTemplates[slaPolicy.autoAssignTemplateKey]
  ) {
    const policySource: ManualReviewRebalanceAssignmentView["policySource"] = slaPolicy.key.startsWith("routing:")
      ? "template_routing"
      : slaPolicy.key.startsWith("priority:")
        ? "template_priority"
        : "template_default";
    return {
      templateKey: slaPolicy.autoAssignTemplateKey,
      policySource,
      ...env.manualReviewAutoAssignTemplates[slaPolicy.autoAssignTemplateKey],
    };
  }
  const routingKey = `routing:${args.routingCode}`;
  const priorityKey = `priority:${args.priority}`;
  if (env.manualReviewAutoAssignTemplates[routingKey]) {
    return {
      templateKey: routingKey,
      policySource: "template_routing" as const,
      ...env.manualReviewAutoAssignTemplates[routingKey],
    };
  }
  if (env.manualReviewAutoAssignTemplates[priorityKey]) {
    return {
      templateKey: priorityKey,
      policySource: "template_priority" as const,
      ...env.manualReviewAutoAssignTemplates[priorityKey],
    };
  }
  if (env.manualReviewAutoAssignTemplates.default) {
    return {
      templateKey: "default",
      policySource: "template_default" as const,
      ...env.manualReviewAutoAssignTemplates.default,
    };
  }
  return null;
}

export function getManualReviewTemplateScope(templateKey: string): "routing" | "priority" | "default" {
  if (templateKey.startsWith("routing:")) return "routing";
  if (templateKey.startsWith("priority:")) return "priority";
  return "default";
}

export function isManualReviewAnomalyRoutingCode(routingCode: ItemManualReviewRoutingCode) {
  return routingCode === "usage_audit_required" || routingCode === "high_replacement_frequency";
}

export function matchesManualReviewTemplateKey(args: {
  routingCode: ItemManualReviewRoutingCode;
  priority: ItemManualReviewPriority;
  templateKey: string | null | undefined;
}) {
  if (!args.templateKey) return true;
  const matchedTemplate = getManualReviewAutoAssignTemplate({
    routingCode: args.routingCode,
    priority: args.priority,
  });
  return matchedTemplate?.templateKey === args.templateKey;
}

export function getManualReviewAssigneeCapacity(operatorUserId: string) {
  return env.manualReviewAssigneeCapacities[operatorUserId] ?? env.manualReviewDefaultAssigneeCapacity;
}

export function isManualReviewAssigneeAtCapacity(args: { operatorUserId: string; claimedCount: number }) {
  return args.claimedCount >= getManualReviewAssigneeCapacity(args.operatorUserId);
}

export function getManualReviewAutoRebalancePolicy() {
  const assigneePool = env.platformOperatorUserIds.filter((value) => value.trim().length > 0);
  return {
    enabled: assigneePool.length > 0 && env.manualReviewAutoRebalanceMaxAssignments > 0,
    assigneePool,
    maxAssignments: env.manualReviewAutoRebalanceMaxAssignments,
    intervalMinutes: Math.max(1, Math.floor(env.manualReviewAutoRebalanceIntervalMs / 60_000)),
  };
}
