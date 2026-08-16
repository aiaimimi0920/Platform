import type {
  ItemFulfillmentAnomalyKind,
  ItemFulfillmentAnomalySeverity,
  ItemFulfillmentAnomalyView,
  ItemManualReviewRoutingCode,
} from "@neuro/contracts";
import { and, eq, sql, type SQL } from "drizzle-orm";

import { env } from "@/env";
import { itemFulfillmentAnomalies } from "@/modules/product-order-item/schema";
import { ConflictError } from "@/platform/errors";

import { now, type DbTx } from "./shared";

export function getFulfillmentAnomalySeverity(
  kind: ItemFulfillmentAnomalyKind,
  routingCode: ItemManualReviewRoutingCode | null,
): ItemFulfillmentAnomalySeverity {
  if (
    kind === "reconcile_failure" ||
    kind === "sla_breach_unclaimed" ||
    routingCode === "high_replacement_frequency"
  ) {
    return "critical";
  }
  return "warning";
}

export function getFulfillmentAnomalyPolicyTemplate(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  preferredPolicyKey?: string | null;
}) {
  const candidateKeys = [
    args.preferredPolicyKey ? args.preferredPolicyKey : null,
    args.routingCode ? `routing:${args.routingCode}` : null,
    `kind:${args.kind}`,
    `severity:${args.severity}`,
    "default",
  ].filter((value): value is string => Boolean(value));
  const matchedKey =
    candidateKeys.find((key) => env.fulfillmentAnomalyPolicyTemplates[key]) ??
    (env.fulfillmentAnomalyPolicyTemplates.default ? "default" : candidateKeys[0]);
  const template = env.fulfillmentAnomalyPolicyTemplates[matchedKey];
  if (!template) {
    throw new ConflictError("Fulfillment anomaly policy template is not configured");
  }
  return {
    key: matchedKey,
    scope: matchedKey.startsWith("routing:")
      ? ("routing" as const)
      : matchedKey.startsWith("kind:")
        ? ("kind" as const)
        : matchedKey.startsWith("severity:")
          ? ("severity" as const)
          : ("default" as const),
    ...template,
  };
}

export function getFulfillmentAnomalyAlertLevel(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  detectedAt: Date;
  referenceTime?: Date;
}) {
  const referenceTime = args.referenceTime ?? now();
  const ageHours = Math.max(0, Math.floor((referenceTime.getTime() - args.detectedAt.getTime()) / (60 * 60 * 1000)));
  const template = getFulfillmentAnomalyPolicyTemplate({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
  });
  const thresholds = template.thresholds;
  let alertLevel = 0;
  thresholds.forEach((threshold, index) => {
    if (ageHours >= threshold) {
      alertLevel = index + 1;
    }
  });
  return Math.min(alertLevel, template.maxAlertLevel);
}

export function getFulfillmentAnomalyRuleState(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  routingCode: ItemManualReviewRoutingCode | null;
  detectedAt: Date;
  referenceTime: Date;
  preferredPolicyKey?: string | null;
}) {
  const ageHours = Math.max(0, Math.floor((args.referenceTime.getTime() - args.detectedAt.getTime()) / (60 * 60 * 1000)));
  const policy = getFulfillmentAnomalyPolicyTemplate({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
    preferredPolicyKey: args.preferredPolicyKey,
  });
  const baseAlertLevel = getFulfillmentAnomalyAlertLevel({
    kind: args.kind,
    severity: args.severity,
    routingCode: args.routingCode,
    detectedAt: args.detectedAt,
    referenceTime: args.referenceTime,
  });
  const matchedStage =
    [...policy.anomalyStages]
      .filter((stage) => ageHours >= stage.minAgeHours)
      .filter((stage) => !stage.appliesToKinds || stage.appliesToKinds.includes(args.kind))
      .filter((stage) => !stage.routingCodes || (args.routingCode ? stage.routingCodes.includes(args.routingCode) : false))
      .sort((left, right) => right.minAgeHours - left.minAgeHours || left.key.localeCompare(right.key))[0] ?? null;
  const cooldownMinutes = matchedStage?.cooldownMinutes ?? policy.cooldownMinutes;
  const nextAlertEligibleAt =
    cooldownMinutes !== null ? new Date(args.referenceTime.getTime() + cooldownMinutes * 60 * 1000) : null;

  return {
    ageHours,
    severity: matchedStage?.severity ?? args.severity,
    alertLevel: Math.max(baseAlertLevel, matchedStage?.alertLevel ?? 0),
    anomalyPolicyKey: matchedStage?.anomalyPolicyKey ?? policy.key,
    escalationStrategy: matchedStage?.anomalyEscalationStrategy ?? policy.escalationStrategy,
    autoAction: matchedStage?.anomalyAutoAction ?? policy.autoAction,
    autoActionTemplateKey: matchedStage?.autoActionTemplateKey ?? policy.autoActionTemplateKey,
    cooldownMinutes,
    nextAlertEligibleAt,
    matchedStageKey: matchedStage?.key ?? null,
    policy,
  };
}

export function buildFulfillmentAnomalyAlertReason(args: {
  kind: ItemFulfillmentAnomalyKind;
  severity: ItemFulfillmentAnomalySeverity;
  alertLevel: number;
  policyKey: string;
  escalationStrategy: string;
}) {
  return `Anomaly ${args.kind} escalated to alert level ${args.alertLevel} (${args.severity}) via policy ${args.policyKey} / ${args.escalationStrategy}.`;
}

export function buildFulfillmentAnomalyAutoActionFailureReason(args: {
  anomalyId: string;
  action: string;
  attemptCount: number;
  maxAutoActionFailures: number;
  failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
  policyKey: string;
}) {
  return `Anomaly ${args.anomalyId} exhausted auto action ${args.action} after ${args.attemptCount}/${args.maxAutoActionFailures} attempts and was escalated via ${args.policyKey} / ${args.failureEscalationStrategy}.`;
}

export function getNextFulfillmentAnomalyEscalationAt(args: {
  detectedAt: Date;
  currentAlertLevel: number;
  policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
}) {
  const nextThreshold = args.policy.thresholds[args.currentAlertLevel];
  if (typeof nextThreshold !== "number") {
    return null;
  }
  return new Date(args.detectedAt.getTime() + nextThreshold * 60 * 60 * 1000);
}

export function getNextFulfillmentAnomalyAlertEligibleAt(referenceTime: Date, policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>) {
  return new Date(referenceTime.getTime() + policy.cooldownMinutes * 60 * 1000);
}

export function toItemFulfillmentAnomalyView(
  row: typeof itemFulfillmentAnomalies.$inferSelect,
): ItemFulfillmentAnomalyView {
  return {
    id: row.id,
    itemId: row.itemId,
    reportId: row.reportId,
    reviewId: row.reviewId,
    kind: row.kind as ItemFulfillmentAnomalyKind,
    severity: row.severity as ItemFulfillmentAnomalySeverity,
    status: row.status as "open" | "resolved",
    routingCode: (row.routingCode as ItemManualReviewRoutingCode | null) ?? null,
    policyKey: row.policyKey,
    escalationStrategy: row.escalationStrategy,
    autoAction: (row.autoAction as "none" | "assign_template" | "rebalance_queue") ?? "none",
    autoActionTemplateKey: row.autoActionTemplateKey,
    summary: row.summary,
    detail: row.detail,
    detectedAt: row.detectedAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    occurrenceCount: row.occurrenceCount,
    alertLevel: row.alertLevel,
    alertedAt: row.alertedAt ? row.alertedAt.toISOString() : null,
    lastAlertReason: row.lastAlertReason,
    nextAlertEligibleAt: row.nextAlertEligibleAt ? row.nextAlertEligibleAt.toISOString() : null,
    nextEscalationAt: row.nextEscalationAt ? row.nextEscalationAt.toISOString() : null,
    lastAutoAction: row.lastAutoAction,
    lastAutoActionAt: row.lastAutoActionAt ? row.lastAutoActionAt.toISOString() : null,
    autoActionAttemptCount: row.autoActionAttemptCount,
    lastAutoActionStatus: (row.lastAutoActionStatus as "applied" | "noop" | "failed" | null) ?? null,
    lastAutoActionError: row.lastAutoActionError,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolutionNote: row.resolutionNote,
  };
}

export async function upsertFulfillmentAnomalyInTx(args: {
  tx: DbTx;
  itemId: string;
  reportId?: string | null;
  reviewId?: string | null;
  kind: ItemFulfillmentAnomalyKind;
  routingCode?: ItemManualReviewRoutingCode | null;
  policyKeyOverride?: string | null;
  severityOverride?: ItemFulfillmentAnomalySeverity | null;
  escalationStrategyOverride?: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
  alertLevelOverride?: number | null;
  nextAlertEligibleAtOverride?: Date | null;
  nextEscalationAtOverride?: Date | null;
  autoActionOverride?: "none" | "assign_template" | "rebalance_queue" | null;
  autoActionTemplateKeyOverride?: string | null;
  summary: string;
  detail?: string | null;
}) {
  const [existing] = await args.tx
    .select()
    .from(itemFulfillmentAnomalies)
    .where(
      and(
        eq(itemFulfillmentAnomalies.itemId, args.itemId),
        eq(itemFulfillmentAnomalies.kind, args.kind),
        eq(itemFulfillmentAnomalies.status, "open"),
        args.reviewId
          ? eq(itemFulfillmentAnomalies.reviewId, args.reviewId)
          : sql`${itemFulfillmentAnomalies.reviewId} is null`,
        args.reportId
          ? eq(itemFulfillmentAnomalies.reportId, args.reportId)
          : sql`${itemFulfillmentAnomalies.reportId} is null`,
      ),
    )
    .limit(1);

  const timestamp = now();
  const baseSeverity = getFulfillmentAnomalySeverity(args.kind, args.routingCode ?? null);
  const ruleState = getFulfillmentAnomalyRuleState({
    kind: args.kind,
    severity: args.severityOverride ?? baseSeverity,
    routingCode: args.routingCode ?? null,
    detectedAt: existing?.detectedAt ?? timestamp,
    referenceTime: timestamp,
    preferredPolicyKey: args.policyKeyOverride,
  });
  const severity = args.severityOverride ?? ruleState.severity ?? baseSeverity;
  const policy =
    args.policyKeyOverride && env.fulfillmentAnomalyPolicyTemplates[args.policyKeyOverride]
      ? {
          key: args.policyKeyOverride,
          scope: args.policyKeyOverride.startsWith("routing:")
            ? ("routing" as const)
            : args.policyKeyOverride.startsWith("kind:")
              ? ("kind" as const)
              : args.policyKeyOverride.startsWith("severity:")
                ? ("severity" as const)
                : ("default" as const),
          ...env.fulfillmentAnomalyPolicyTemplates[args.policyKeyOverride],
        }
      : ruleState.policy;
  const effectiveEscalationStrategy =
    args.escalationStrategyOverride !== undefined && args.escalationStrategyOverride !== null
      ? args.escalationStrategyOverride
      : ruleState.escalationStrategy ?? policy.escalationStrategy;
  const alertLevel = getFulfillmentAnomalyAlertLevel({
    kind: args.kind,
    severity,
    routingCode: args.routingCode ?? null,
    detectedAt: timestamp,
    referenceTime: timestamp,
  });
  const targetAlertLevel = Math.max(0, args.alertLevelOverride ?? ruleState.alertLevel ?? alertLevel);
  const targetAutoAction =
    args.autoActionOverride !== undefined && args.autoActionOverride !== null
      ? args.autoActionOverride
      : ruleState.autoAction ?? policy.autoAction;
  const targetAutoActionTemplateKey =
    args.autoActionTemplateKeyOverride !== undefined
      ? args.autoActionTemplateKeyOverride
      : ruleState.autoActionTemplateKey ?? policy.autoActionTemplateKey;
  const nextEscalationAt = getNextFulfillmentAnomalyEscalationAt({
    detectedAt: timestamp,
    currentAlertLevel: targetAlertLevel,
    policy,
  });
  const targetNextEscalationAt = args.nextEscalationAtOverride ?? nextEscalationAt;
  const nextAlertEligibleAt =
    ruleState.nextAlertEligibleAt ?? getNextFulfillmentAnomalyAlertEligibleAt(timestamp, policy);
  const targetNextAlertEligibleAt = args.nextAlertEligibleAtOverride ?? nextAlertEligibleAt;
  if (existing) {
    const nextAlertLevel = Math.max(existing.alertLevel ?? 0, targetAlertLevel);
    const [updated] = await args.tx
      .update(itemFulfillmentAnomalies)
      .set({
        severity,
        routingCode: args.routingCode ?? existing.routingCode,
        policyKey: policy.key,
        escalationStrategy: effectiveEscalationStrategy,
        autoAction: targetAutoAction,
        autoActionTemplateKey: targetAutoActionTemplateKey,
        summary: args.summary,
        detail: args.detail ?? existing.detail,
        lastSeenAt: timestamp,
        occurrenceCount: (existing.occurrenceCount ?? 1) + 1,
        alertLevel: nextAlertLevel,
        alertedAt: nextAlertLevel > 0 ? existing.alertedAt ?? timestamp : existing.alertedAt,
        lastAlertReason:
          nextAlertLevel > 0
            ? buildFulfillmentAnomalyAlertReason({
                kind: args.kind,
                severity,
                alertLevel: nextAlertLevel,
                policyKey: policy.key,
                escalationStrategy: effectiveEscalationStrategy,
              })
            : existing.lastAlertReason,
        nextAlertEligibleAt:
          nextAlertLevel > 0
            ? nextAlertLevel > (existing.alertLevel ?? 0)
              ? targetNextAlertEligibleAt
              : existing.nextAlertEligibleAt ?? targetNextAlertEligibleAt
            : existing.nextAlertEligibleAt,
        nextEscalationAt:
          args.nextEscalationAtOverride ??
          getNextFulfillmentAnomalyEscalationAt({
            detectedAt: existing.detectedAt,
            currentAlertLevel: nextAlertLevel,
            policy,
          }),
        resolutionNote: null,
        resolvedAt: null,
      })
      .where(eq(itemFulfillmentAnomalies.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await args.tx
    .insert(itemFulfillmentAnomalies)
    .values({
      id: crypto.randomUUID(),
      itemId: args.itemId,
      reportId: args.reportId ?? null,
      reviewId: args.reviewId ?? null,
      kind: args.kind,
      severity,
      status: "open",
      routingCode: args.routingCode ?? null,
      policyKey: policy.key,
      escalationStrategy: effectiveEscalationStrategy,
      autoAction: targetAutoAction,
      autoActionTemplateKey: targetAutoActionTemplateKey,
      summary: args.summary,
      detail: args.detail ?? null,
      alertLevel: targetAlertLevel,
      alertedAt: targetAlertLevel > 0 ? timestamp : null,
      lastAlertReason:
        targetAlertLevel > 0
          ? buildFulfillmentAnomalyAlertReason({
              kind: args.kind,
              severity,
              alertLevel: targetAlertLevel,
              policyKey: policy.key,
              escalationStrategy: effectiveEscalationStrategy,
            })
          : null,
      nextAlertEligibleAt: targetAlertLevel > 0 ? targetNextAlertEligibleAt : null,
      nextEscalationAt: targetNextEscalationAt,
      autoActionAttemptCount: 0,
      lastAutoActionStatus: null,
      lastAutoActionError: null,
      detectedAt: timestamp,
      lastSeenAt: timestamp,
      occurrenceCount: 1,
      resolvedAt: null,
      resolutionNote: null,
    })
    .returning();
  return created;
}

export async function resolveFulfillmentAnomaliesInTx(args: {
  tx: DbTx;
  itemId: string;
  kind?: ItemFulfillmentAnomalyKind;
  reportId?: string | null;
  reviewId?: string | null;
  resolutionNote: string;
}) {
  const clauses: SQL[] = [
    eq(itemFulfillmentAnomalies.itemId, args.itemId),
    eq(itemFulfillmentAnomalies.status, "open"),
  ];
  if (args.kind) clauses.push(eq(itemFulfillmentAnomalies.kind, args.kind));
  if (args.reportId) clauses.push(eq(itemFulfillmentAnomalies.reportId, args.reportId));
  if (args.reviewId) clauses.push(eq(itemFulfillmentAnomalies.reviewId, args.reviewId));

  await args.tx
    .update(itemFulfillmentAnomalies)
    .set({
      status: "resolved",
      alertLevel: 0,
      nextAlertEligibleAt: null,
      nextEscalationAt: null,
      resolvedAt: now(),
      resolutionNote: args.resolutionNote,
    })
    .where(and(...clauses));
}

export async function resolveManualReviewQueueLinkedAnomaliesInTx(args: {
  tx: DbTx;
  itemId: string;
  reportId: string;
  reviewId: string;
  resolutionNote: string;
}) {
  for (const kind of [
    "manual_review_routed",
    "sla_due_soon_unclaimed",
    "sla_breach_unclaimed",
    "stale_manual_review",
  ] as ItemFulfillmentAnomalyKind[]) {
    await resolveFulfillmentAnomaliesInTx({
      tx: args.tx,
      itemId: args.itemId,
      reportId: args.reportId,
      reviewId: args.reviewId,
      kind,
      resolutionNote: args.resolutionNote,
    });
  }
}
