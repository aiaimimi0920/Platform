import type {
  FulfillmentOpsSummaryView,
  ItemFulfillmentAnomalyKind,
  ItemFulfillmentAnomalySeverity,
  ItemManualReviewRoutingCode,
  ManualReviewRebalanceAssignmentView,
  ManualReviewSlaPolicyTemplateView,
  ItemIssueRejectionCode,
} from "@neuro/contracts";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/env";
import {
  buildFulfillmentOpsRecommendations,
  buildFulfillmentRecentRunWindows,
} from "@/modules/product-order-item/operator-ops-analysis";
import {
  itemFulfillmentRuns,
  itemFulfillmentAnomalies,
  itemIssueReports,
  itemManualReviews,
  itemManualReviewAssignmentEvents,
} from "@/modules/product-order-item/schema";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import {
  now,
  isPlatformOperator,
  sortSummaryBuckets,
} from "./shared";
import {
  getManualReviewAgeHours,
  getManualReviewPriority,
  getManualReviewSlaPolicy,
  getManualReviewSlaBucket,
  getManualReviewSlaAnomalyProgress,
  getManualReviewSlaAnomalyRuleState,
  getManualReviewLinkedAnomalyRuleStateInTx,
  getManualReviewSlaDrivenAutoAction,
  getManualReviewEscalationLevel,
  getRecommendedManualReviewAssignee,
  normalizeManualReviewAssigneePool,
  getRoutingAwareManualReviewAssigneePool,
  getManualReviewAutoAssignTemplate,
} from "./manual-review-policy";
import {
  getFulfillmentAnomalyPolicyTemplate,
  getFulfillmentAnomalyAlertLevel,
  getFulfillmentAnomalyRuleState,
  buildFulfillmentAnomalyAlertReason,
  buildFulfillmentAnomalyAutoActionFailureReason,
  getNextFulfillmentAnomalyEscalationAt,
  getNextFulfillmentAnomalyAlertEligibleAt,
  toItemFulfillmentAnomalyView,
  upsertFulfillmentAnomalyInTx,
  resolveFulfillmentAnomaliesInTx,
} from "./anomaly-engine";
import {
  getItemIssueRejectionCategory,
  isItemIssueAppealable,
  toItemFulfillmentRunView,
} from "./item-views";
import {
  getOpenItemManualReviewSummary,
  getManualReviewWorkload,
  assignItemManualReview,
  autoRebalanceItemManualReviews,
} from "./manual-review";

export async function getFulfillmentOpsSummary(operatorUserId: string): Promise<FulfillmentOpsSummaryView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment ops summary");
  }

  const [manualReviews, rejectedIssueRows, recentRuns, resolvedReviewRows, assignmentRows, anomalyRows] = await Promise.all([
    getOpenItemManualReviewSummary(operatorUserId),
    db
      .select({
        rejectionCode: itemIssueReports.rejectionCode,
        count: count(),
      })
      .from(itemIssueReports)
      .where(and(eq(itemIssueReports.outcome, "rejected"), sql`${itemIssueReports.rejectionCode} is not null`))
      .groupBy(itemIssueReports.rejectionCode),
    db.select().from(itemFulfillmentRuns).orderBy(sql`${itemFulfillmentRuns.createdAt} desc`).limit(200),
    db
      .select({
        resolutionAction: itemManualReviews.resolutionAction,
        resolvedAt: itemManualReviews.resolvedAt,
      })
      .from(itemManualReviews)
      .where(and(sql`${itemManualReviews.resolvedAt} is not null`, sql`${itemManualReviews.status} <> 'open'`)),
    db
      .select({
        action: itemManualReviewAssignmentEvents.action,
        createdAt: itemManualReviewAssignmentEvents.createdAt,
      })
      .from(itemManualReviewAssignmentEvents)
      .orderBy(desc(itemManualReviewAssignmentEvents.createdAt))
      .limit(500),
    db.select().from(itemFulfillmentAnomalies).orderBy(desc(itemFulfillmentAnomalies.lastSeenAt)).limit(100),
  ]);

  const byRejectionCode = new Map<string, number>();
  const byRejectionCategory = new Map<string, number>();
  let appealableCount = 0;
  for (const row of rejectedIssueRows) {
    if (!row.rejectionCode) continue;
    const countValue = Number(row.count ?? 0);
    byRejectionCode.set(row.rejectionCode, countValue);
    const category = getItemIssueRejectionCategory(row.rejectionCode as ItemIssueRejectionCode);
    if (category) {
      byRejectionCategory.set(category, (byRejectionCategory.get(category) ?? 0) + countValue);
    }
    if (isItemIssueAppealable(row.rejectionCode as ItemIssueRejectionCode)) {
      appealableCount += countValue;
    }
  }

  const byRunTrigger = new Map<string, number>();
  const byRunStatus = new Map<string, number>();
  for (const row of recentRuns) {
    byRunTrigger.set(row.trigger, (byRunTrigger.get(row.trigger) ?? 0) + 1);
    byRunStatus.set(row.status, (byRunStatus.get(row.status) ?? 0) + 1);
  }
  const recentRunViews = recentRuns.slice(0, 20).map(toItemFulfillmentRunView);
  const recentRunWindows = buildFulfillmentRecentRunWindows(recentRunViews);

  const resolutionWindowStart = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
  let resolvedLast7Days = 0;
  const byResolutionAction = new Map<string, number>();
  for (const row of resolvedReviewRows) {
    if (row.resolvedAt && row.resolvedAt.getTime() >= resolutionWindowStart.getTime()) {
      resolvedLast7Days += 1;
    }
    if (row.resolutionAction) {
      byResolutionAction.set(
        row.resolutionAction,
        (byResolutionAction.get(row.resolutionAction) ?? 0) + 1,
      );
    }
  }

  const byAssignmentAction = new Map<string, number>();
  for (const row of assignmentRows) {
    byAssignmentAction.set(row.action, (byAssignmentAction.get(row.action) ?? 0) + 1);
  }

  const openAnomalies = anomalyRows.filter((row) => row.status === "open");
  const resolvedAnomalies = anomalyRows.filter((row) => row.status === "resolved");
  const byAnomalyKind = new Map<string, number>();
  const byAnomalySeverity = new Map<string, number>();
  const byAlertLevel = new Map<string, number>();
  const byPolicyKey = new Map<string, number>();
  const byAutoActionStatus = new Map<string, number>();
  const policyBuckets = new Map<
    string,
    {
      scope: "routing" | "kind" | "severity" | "default";
      thresholds: number[];
      escalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      failureEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review";
      autoAction: "none" | "assign_template" | "rebalance_queue";
      autoActionTemplateKey: string | null;
      cooldownMinutes: number;
      maxAlertLevel: number;
      maxAutoActionFailures: number;
      anomalyStages: Array<{
        key: string;
        minAgeHours: number;
        appliesToKinds: ItemFulfillmentAnomalyKind[] | null;
        routingCodes: ItemManualReviewRoutingCode[] | null;
        severity: ItemFulfillmentAnomalySeverity | null;
        alertLevel: number | null;
        anomalyPolicyKey: string | null;
        anomalyEscalationStrategy: "owner_notice" | "operator_review" | "urgent_operator_review" | null;
        anomalyAutoAction: "none" | "assign_template" | "rebalance_queue" | null;
        autoActionTemplateKey: string | null;
        cooldownMinutes: number | null;
      }>;
      matchingAnomalyCount: number;
    }
  >();
  let criticalCount = 0;
  let alertedCount = 0;
  let lastAlertedAt: Date | null = null;
  let autoActionedCount = 0;
  let lastAutoActionAt: Date | null = null;
  for (const row of openAnomalies) {
    byAnomalyKind.set(row.kind, (byAnomalyKind.get(row.kind) ?? 0) + 1);
    byAnomalySeverity.set(row.severity, (byAnomalySeverity.get(row.severity) ?? 0) + 1);
    if (row.policyKey) {
      byPolicyKey.set(row.policyKey, (byPolicyKey.get(row.policyKey) ?? 0) + 1);
      const template = env.fulfillmentAnomalyPolicyTemplates[row.policyKey];
      if (template) {
        policyBuckets.set(row.policyKey, {
          scope: row.policyKey.startsWith("routing:")
            ? "routing"
            : row.policyKey.startsWith("kind:")
              ? "kind"
              : row.policyKey.startsWith("severity:")
                ? "severity"
                : "default",
          thresholds: template.thresholds,
          escalationStrategy: template.escalationStrategy,
          failureEscalationStrategy: template.failureEscalationStrategy,
          autoAction: template.autoAction,
          autoActionTemplateKey: template.autoActionTemplateKey,
          cooldownMinutes: template.cooldownMinutes,
          maxAlertLevel: template.maxAlertLevel,
          maxAutoActionFailures: template.maxAutoActionFailures,
          anomalyStages: template.anomalyStages,
          matchingAnomalyCount: (policyBuckets.get(row.policyKey)?.matchingAnomalyCount ?? 0) + 1,
        });
      }
    }
    if (row.severity === "critical") criticalCount += 1;
    if ((row.alertLevel ?? 0) > 0) {
      alertedCount += 1;
      byAlertLevel.set(String(row.alertLevel), (byAlertLevel.get(String(row.alertLevel)) ?? 0) + 1);
      if (row.alertedAt && (!lastAlertedAt || row.alertedAt.getTime() > lastAlertedAt.getTime())) {
        lastAlertedAt = row.alertedAt;
      }
    }
    if (row.lastAutoActionAt) {
      autoActionedCount += 1;
      if (!lastAutoActionAt || row.lastAutoActionAt.getTime() > lastAutoActionAt.getTime()) {
        lastAutoActionAt = row.lastAutoActionAt;
      }
    }
    if (row.lastAutoActionStatus) {
      byAutoActionStatus.set(
        row.lastAutoActionStatus,
        (byAutoActionStatus.get(row.lastAutoActionStatus) ?? 0) + 1,
      );
    }
  }

  return {
    manualReviews,
    anomalies: {
      openCount: openAnomalies.length,
      criticalCount,
      alertedCount,
      autoActionedCount,
      latestDetectedAt: anomalyRows[0]?.detectedAt ? anomalyRows[0].detectedAt.toISOString() : null,
      latestResolvedAt: resolvedAnomalies[0]?.resolvedAt ? resolvedAnomalies[0].resolvedAt.toISOString() : null,
      lastAlertedAt: lastAlertedAt ? lastAlertedAt.toISOString() : null,
      lastAutoActionAt: lastAutoActionAt ? lastAutoActionAt.toISOString() : null,
      byKind: sortSummaryBuckets(byAnomalyKind),
      bySeverity: sortSummaryBuckets(byAnomalySeverity),
      byAlertLevel: sortSummaryBuckets(byAlertLevel),
      byPolicyKey: sortSummaryBuckets(byPolicyKey),
      byAutoActionStatus: sortSummaryBuckets(byAutoActionStatus),
      policies: Array.from(policyBuckets.entries())
        .map(([key, value]) => ({
          key,
          scope: value.scope,
          thresholds: value.thresholds,
          escalationStrategy: value.escalationStrategy,
          failureEscalationStrategy: value.failureEscalationStrategy,
          autoAction: value.autoAction,
          autoActionTemplateKey: value.autoActionTemplateKey,
          cooldownMinutes: value.cooldownMinutes,
          maxAlertLevel: value.maxAlertLevel,
          maxAutoActionFailures: value.maxAutoActionFailures,
          anomalyStages: value.anomalyStages,
          matchingAnomalyCount: value.matchingAnomalyCount,
        }))
        .sort((left, right) => right.matchingAnomalyCount - left.matchingAnomalyCount || left.key.localeCompare(right.key)),
    },
    byRejectionCode: sortSummaryBuckets(byRejectionCode),
    byRejectionCategory: sortSummaryBuckets(byRejectionCategory),
    appealableCount,
    resolvedLast7Days,
    byResolutionAction: sortSummaryBuckets(byResolutionAction),
    byAssignmentAction: sortSummaryBuckets(byAssignmentAction),
    latestAssignmentAt: assignmentRows[0]?.createdAt ? assignmentRows[0].createdAt.toISOString() : null,
    byRunTrigger: sortSummaryBuckets(byRunTrigger),
    byRunStatus: sortSummaryBuckets(byRunStatus),
    latestRunAt: recentRuns[0]?.createdAt ? recentRuns[0].createdAt.toISOString() : null,
    recentRunWindows,
    recentRuns: recentRunViews,
    recentAnomalies: anomalyRows.slice(0, 12).map(toItemFulfillmentAnomalyView),
    recommendations: buildFulfillmentOpsRecommendations({
      manualReviews,
      recentRunWindows,
      latestRunAt: recentRuns[0]?.createdAt ? recentRuns[0].createdAt.toISOString() : null,
    }),
  };
}

export async function listOpenFulfillmentAnomalies(operatorUserId: string, args?: {
  status?: "open" | "resolved";
  kind?: ItemFulfillmentAnomalyKind;
  severity?: ItemFulfillmentAnomalySeverity;
  alertLevel?: number;
  policyKey?: string;
  autoActionStatus?: "applied" | "noop" | "failed";
  limit?: number;
}) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment anomalies");
  }

  const clauses: SQL[] = [];
  if (args?.status) clauses.push(eq(itemFulfillmentAnomalies.status, args.status));
  if (args?.kind) clauses.push(eq(itemFulfillmentAnomalies.kind, args.kind));
  if (args?.severity) clauses.push(eq(itemFulfillmentAnomalies.severity, args.severity));
  if (typeof args?.alertLevel === "number") clauses.push(eq(itemFulfillmentAnomalies.alertLevel, args.alertLevel));
  if (args?.policyKey) clauses.push(eq(itemFulfillmentAnomalies.policyKey, args.policyKey));
  if (args?.autoActionStatus) clauses.push(eq(itemFulfillmentAnomalies.lastAutoActionStatus, args.autoActionStatus));
  const rows = await db
    .select()
    .from(itemFulfillmentAnomalies)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(itemFulfillmentAnomalies.lastSeenAt))
    .limit(Math.max(1, Math.min(args?.limit ?? 100, 200)));
  return rows.map(toItemFulfillmentAnomalyView);
}

export async function listFulfillmentAnomalyPolicies(operatorUserId: string) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view fulfillment anomaly policies");
  }

  const rows = await db
    .select({
      policyKey: itemFulfillmentAnomalies.policyKey,
      count: count(),
    })
    .from(itemFulfillmentAnomalies)
    .where(and(eq(itemFulfillmentAnomalies.status, "open"), sql`${itemFulfillmentAnomalies.policyKey} is not null`))
    .groupBy(itemFulfillmentAnomalies.policyKey);
  const counts = new Map(rows.map((row) => [row.policyKey ?? "default", Number(row.count ?? 0)]));

  return Object.entries(env.fulfillmentAnomalyPolicyTemplates)
    .map(([key, value]) => ({
      key,
      scope: key.startsWith("routing:")
        ? ("routing" as const)
        : key.startsWith("kind:")
          ? ("kind" as const)
          : key.startsWith("severity:")
            ? ("severity" as const)
            : ("default" as const),
      thresholds: value.thresholds,
      escalationStrategy: value.escalationStrategy,
      failureEscalationStrategy: value.failureEscalationStrategy,
      autoAction: value.autoAction,
      autoActionTemplateKey: value.autoActionTemplateKey,
      cooldownMinutes: value.cooldownMinutes,
      maxAlertLevel: value.maxAlertLevel,
      maxAutoActionFailures: value.maxAutoActionFailures,
      anomalyStages: value.anomalyStages,
      matchingAnomalyCount: counts.get(key) ?? 0,
    }))
    .sort((left, right) => right.matchingAnomalyCount - left.matchingAnomalyCount || left.key.localeCompare(right.key));
}

async function runFulfillmentAnomalyAutoAction(args: {
  anomaly: typeof itemFulfillmentAnomalies.$inferSelect;
  policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
  operatorUserId: string;
}) {
  const effectiveAutoAction =
    ((args.anomaly.autoAction as "none" | "assign_template" | "rebalance_queue" | null) ?? args.policy.autoAction) ||
    "none";
  const effectiveAutoActionTemplateKey = args.anomaly.autoActionTemplateKey ?? args.policy.autoActionTemplateKey;

  if (effectiveAutoAction === "none") {
    return { action: "none", applied: false, errorMessage: null };
  }

  if (effectiveAutoAction === "rebalance_queue") {
    const result = await autoRebalanceItemManualReviews({
      templateKey: effectiveAutoActionTemplateKey ?? null,
      maxAssignments: 1,
    });
    return {
      action: result.assignedCount > 0 ? "rebalance_queue" : "rebalance_queue_noop",
      applied: result.assignedCount > 0,
      errorMessage: result.assignedCount > 0 ? null : "Automatic rebalance did not assign any review.",
    };
  }

  if (!args.anomaly.reviewId) {
    return { action: "assign_template_no_review", applied: false, errorMessage: "Anomaly does not reference an open review." };
  }

  const [review] = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.id, args.anomaly.reviewId))
    .limit(1);
  if (!review || review.status !== "open") {
    return { action: "assign_template_review_closed", applied: false, errorMessage: "Linked review is no longer open." };
  }
  if (review.assigneeUserId) {
    return { action: "assign_template_already_claimed", applied: false, errorMessage: "Linked review is already claimed." };
  }

  const ageHours = getManualReviewAgeHours(review.createdAt, now());
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const template =
    effectiveAutoActionTemplateKey && env.manualReviewAutoAssignTemplates[effectiveAutoActionTemplateKey]
      ? {
          templateKey: effectiveAutoActionTemplateKey,
          policySource: (
            effectiveAutoActionTemplateKey.startsWith("routing:")
              ? "template_routing"
              : effectiveAutoActionTemplateKey.startsWith("priority:")
                ? "template_priority"
                : "template_default"
          ) as ManualReviewRebalanceAssignmentView["policySource"],
          ...env.manualReviewAutoAssignTemplates[effectiveAutoActionTemplateKey],
        }
      : getManualReviewAutoAssignTemplate({
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          priority,
        });

  const assigneePool =
    template?.assigneePool?.length
      ? normalizeManualReviewAssigneePool(args.operatorUserId, template.assigneePool)
      : getRoutingAwareManualReviewAssigneePool({
          operatorUserId: args.operatorUserId,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          explicitAssigneePool: null,
        }).assigneePool;
  const workload = await getManualReviewWorkload(args.operatorUserId);
  const assigneeUserId = getRecommendedManualReviewAssignee({
    currentOperatorUserId: args.operatorUserId,
    assigneePool,
    byAssignee: workload.byAssignee,
  });
  if (!assigneeUserId) {
    return {
      action: "assign_template_capacity_blocked",
      applied: false,
      errorMessage: "No assignee currently has remaining capacity for this template.",
    };
  }

  try {
    await assignItemManualReview(args.operatorUserId, review.id, assigneeUserId, "assign_auto_sla");
    return { action: "assign_template", applied: true, errorMessage: null };
  } catch (error) {
    if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
      return { action: "assign_template_conflict", applied: false, errorMessage: error.message };
    }
    throw error;
  }
}

export async function syncManualReviewSlaAnomalies(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 500));
  const referenceTime = now();
  const reviews = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt)
    .limit(limit);

  const reportIds = Array.from(new Set(reviews.map((review) => review.reportId)));
  const reports =
    reportIds.length > 0
      ? await db.select().from(itemIssueReports).where(inArray(itemIssueReports.id, reportIds))
      : [];
  const reportsById = new Map(reports.map((report) => [report.id, report]));

  let createdOrUpdatedCount = 0;
  let resolvedCount = 0;
  const affectedReviewIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const review of reviews) {
      const ageHours = getManualReviewAgeHours(review.createdAt, referenceTime);
      const priority = getManualReviewPriority({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaPolicy = getManualReviewSlaPolicy({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
      });
      const slaBucket = getManualReviewSlaBucket({
        ageHours,
        priority,
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
      });
      const shouldTrack = !review.assigneeUserId && (slaBucket === "due_soon" || slaBucket === "breached");

      if (shouldTrack) {
        const anomalyProgress = getManualReviewSlaAnomalyProgress({
          ageHours,
          slaPolicy,
          referenceTime,
        });
        const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
          ageHours,
          anomalyKind:
            slaBucket === "due_soon"
              ? ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind)
              : ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind),
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          priority,
          slaPolicy,
          referenceTime,
        });
        const slaDrivenAutoAction = getManualReviewSlaDrivenAutoAction({
          slaPolicy,
          anomalyProgress,
          ageHours,
        });
        const effectiveAutoAction = anomalyRuleState.anomalyAutoAction ?? slaDrivenAutoAction.autoAction;
        const effectiveAutoActionTemplateKey =
          anomalyRuleState.autoActionTemplateKey ?? slaDrivenAutoAction.autoActionTemplateKey;
        const anomalyKind =
          slaBucket === "due_soon"
            ? ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind)
            : ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind);
        await upsertFulfillmentAnomalyInTx({
          tx,
          itemId: review.itemId,
          reportId: review.reportId,
          reviewId: review.id,
          kind: anomalyKind,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          policyKeyOverride: anomalyRuleState.anomalyPolicyKey,
          severityOverride: anomalyRuleState.severity,
          escalationStrategyOverride: anomalyRuleState.anomalyEscalationStrategy,
          alertLevelOverride: anomalyRuleState.alertLevel,
          nextAlertEligibleAtOverride: anomalyRuleState.nextAlertEligibleAt,
          nextEscalationAtOverride: anomalyRuleState.nextEscalationAt,
          autoActionOverride: effectiveAutoAction,
          autoActionTemplateKeyOverride: effectiveAutoActionTemplateKey,
          summary:
            slaBucket === "due_soon"
              ? "Manual review is approaching SLA breach while remaining unclaimed."
              : "Manual review breached SLA while remaining unclaimed.",
          detail: `Priority ${priority} review is ${ageHours}h old and still unassigned. Current SLA bucket=${slaBucket}, anomaly severity=${anomalyRuleState.severity}, alertLevel=${anomalyRuleState.alertLevel}${anomalyRuleState.matchedStageKey ? ` via SLA stage ${anomalyRuleState.matchedStageKey}` : ""}${slaPolicy.criticalAfterHours !== null ? ` (critical after ${slaPolicy.criticalAfterHours}h)` : ""}${slaPolicy.urgentAfterHours !== null ? `, urgent after ${slaPolicy.urgentAfterHours}h` : ""}.`,
        });
        await resolveFulfillmentAnomaliesInTx({
          tx,
          itemId: review.itemId,
          reportId: review.reportId,
          reviewId: review.id,
          kind:
            slaBucket === "due_soon"
              ? ("sla_breach_unclaimed" as ItemFulfillmentAnomalyKind)
              : ("sla_due_soon_unclaimed" as ItemFulfillmentAnomalyKind),
          resolutionNote:
            slaBucket === "due_soon"
              ? "Review remains in due-soon window and has not breached SLA yet."
              : "Review progressed from due-soon into breached SLA handling.",
        });
        createdOrUpdatedCount += 1;
        affectedReviewIds.push(review.id);
      } else {
        for (const kind of ["sla_due_soon_unclaimed", "sla_breach_unclaimed"] as ItemFulfillmentAnomalyKind[]) {
          await resolveFulfillmentAnomaliesInTx({
            tx,
            itemId: review.itemId,
            reportId: review.reportId,
            reviewId: review.id,
            kind,
            resolutionNote: review.assigneeUserId
              ? "Review was assigned before further SLA escalation."
              : "Review no longer matches SLA-driven anomaly criteria.",
          });
        }
      }
    }

    const staleResolvedRows = await tx
      .select()
      .from(itemFulfillmentAnomalies)
      .where(
        inArray(
          itemFulfillmentAnomalies.kind,
          ["sla_due_soon_unclaimed", "sla_breach_unclaimed"] as ItemFulfillmentAnomalyKind[],
        ),
      );

    for (const row of staleResolvedRows) {
      const reviewStillOpen = reviews.some((review) => review.id === row.reviewId);
        if (!reviewStillOpen && row.status === "open") {
          await resolveFulfillmentAnomaliesInTx({
            tx,
            itemId: row.itemId,
            reportId: row.reportId,
            reviewId: row.reviewId,
            kind: row.kind as ItemFulfillmentAnomalyKind,
            resolutionNote: "Review left the open queue; SLA-driven anomaly closed automatically.",
          });
          resolvedCount += 1;
        }
    }
  });

  return {
    scannedCount: reviews.length,
    createdOrUpdatedCount,
    resolvedCount,
    affectedReviewIds,
    trackedOpenReviews: reviews
      .map((review) => {
        const report = reportsById.get(review.reportId);
        return {
          reviewId: review.id,
          itemId: review.itemId,
          reportId: review.reportId,
          assigneeUserId: review.assigneeUserId,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
          appealable: report ? isItemIssueAppealable((report.rejectionCode as ItemIssueRejectionCode | null) ?? null) : false,
        };
      })
      .slice(0, 20),
  };
}

export async function escalateFulfillmentAnomalies(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 100, 500));
  const referenceTime = now();
  const rows = await db
    .select()
    .from(itemFulfillmentAnomalies)
    .where(eq(itemFulfillmentAnomalies.status, "open"))
    .orderBy(itemFulfillmentAnomalies.detectedAt)
    .limit(limit);

  let escalatedCount = 0;
  let unchangedCount = 0;
  const affectedIds: string[] = [];
  const autoActionCandidates: Array<{
    anomalyId: string;
    policy: ReturnType<typeof getFulfillmentAnomalyPolicyTemplate>;
    effectiveAutoAction: "none" | "assign_template" | "rebalance_queue";
    effectiveAutoActionTemplateKey: string | null;
  }> = [];

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const linkedRuleState = await getManualReviewLinkedAnomalyRuleStateInTx({
        tx,
        anomaly: row,
        referenceTime,
      });
      const baseSeverity = linkedRuleState?.anomalyRuleState.severity ?? (row.severity as ItemFulfillmentAnomalySeverity);
      const effectiveRoutingCode =
        (linkedRuleState?.review.routingCode as ItemManualReviewRoutingCode | undefined) ??
        ((row.routingCode as ItemManualReviewRoutingCode | null) ?? null);
      const fallbackRuleState = getFulfillmentAnomalyRuleState({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: baseSeverity,
        routingCode: effectiveRoutingCode,
        detectedAt: row.detectedAt,
        referenceTime,
        preferredPolicyKey: row.policyKey,
      });
      const effectiveSeverity =
        linkedRuleState?.anomalyRuleState.severity ?? fallbackRuleState.severity;
      const policy = getFulfillmentAnomalyPolicyTemplate({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        routingCode: effectiveRoutingCode,
        preferredPolicyKey:
          linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
          fallbackRuleState.anomalyPolicyKey ??
          row.policyKey,
      });
      const effectiveAutoAction =
        linkedRuleState?.effectiveAutoAction ?? fallbackRuleState.autoAction ?? policy.autoAction;
      const effectiveAutoActionTemplateKey =
        linkedRuleState?.effectiveAutoActionTemplateKey ??
        fallbackRuleState.autoActionTemplateKey ??
        policy.autoActionTemplateKey;
      const thresholdAlertLevel = getFulfillmentAnomalyAlertLevel({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        routingCode: effectiveRoutingCode,
        detectedAt: row.detectedAt,
        referenceTime,
      });
      const targetAlertLevel = Math.max(
        thresholdAlertLevel,
        linkedRuleState?.anomalyRuleState.alertLevel ?? 0,
        fallbackRuleState.alertLevel ?? 0,
      );
      if (row.nextAlertEligibleAt && row.nextAlertEligibleAt.getTime() > referenceTime.getTime()) {
        unchangedCount += 1;
        continue;
      }
      if (targetAlertLevel <= (row.alertLevel ?? 0)) {
        unchangedCount += 1;
        continue;
      }

      const alertReason = buildFulfillmentAnomalyAlertReason({
        kind: row.kind as ItemFulfillmentAnomalyKind,
        severity: effectiveSeverity,
        alertLevel: targetAlertLevel,
        policyKey: policy.key,
        escalationStrategy:
          linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ?? policy.escalationStrategy,
      });

      await tx
        .update(itemFulfillmentAnomalies)
        .set({
          severity: effectiveSeverity,
          alertLevel: targetAlertLevel,
          alertedAt: row.alertedAt ?? referenceTime,
          lastAlertReason: alertReason,
          policyKey:
            linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
            fallbackRuleState.anomalyPolicyKey ??
            policy.key,
          escalationStrategy:
            linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ??
            fallbackRuleState.escalationStrategy ??
            policy.escalationStrategy,
          autoAction: effectiveAutoAction,
          autoActionTemplateKey: effectiveAutoActionTemplateKey,
          nextAlertEligibleAt:
            linkedRuleState?.anomalyRuleState.nextAlertEligibleAt ??
            fallbackRuleState.nextAlertEligibleAt ??
            getNextFulfillmentAnomalyAlertEligibleAt(referenceTime, policy),
          nextEscalationAt: linkedRuleState?.anomalyRuleState.nextEscalationAt ?? getNextFulfillmentAnomalyEscalationAt({
            detectedAt: row.detectedAt,
            currentAlertLevel: targetAlertLevel,
            policy,
          }),
          lastSeenAt: referenceTime,
        })
        .where(eq(itemFulfillmentAnomalies.id, row.id));

      await enqueueOutboxEvent(
        "item.anomalyEscalated",
        {
          anomalyId: row.id,
          itemId: row.itemId,
          reportId: row.reportId,
          reviewId: row.reviewId,
          kind: row.kind,
          severity: effectiveSeverity,
          alertLevel: targetAlertLevel,
          policyKey:
            linkedRuleState?.anomalyRuleState.anomalyPolicyKey ??
            fallbackRuleState.anomalyPolicyKey ??
            policy.key,
          escalationStrategy:
            linkedRuleState?.anomalyRuleState.anomalyEscalationStrategy ??
            fallbackRuleState.escalationStrategy ??
            policy.escalationStrategy,
        },
        tx,
      );

      escalatedCount += 1;
      affectedIds.push(row.id);
      if (effectiveAutoAction !== "none") {
        const autoActionExhausted =
          row.lastAutoActionStatus === "failed" && (row.autoActionAttemptCount ?? 0) >= policy.maxAutoActionFailures;
        if (autoActionExhausted) {
          continue;
        }
        autoActionCandidates.push({
          anomalyId: row.id,
          policy,
          effectiveAutoAction,
          effectiveAutoActionTemplateKey,
        });
      }
    }
  });

  const automationOperatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (automationOperatorUserId) {
    for (const candidate of autoActionCandidates) {
      const [anomaly] = await db
        .select()
        .from(itemFulfillmentAnomalies)
        .where(eq(itemFulfillmentAnomalies.id, candidate.anomalyId))
        .limit(1);
      if (!anomaly || anomaly.status !== "open") {
        continue;
      }
      const result = await runFulfillmentAnomalyAutoAction({
        anomaly,
        policy: candidate.policy,
        operatorUserId: automationOperatorUserId,
      });
      const autoActionAttemptCount = (anomaly.autoActionAttemptCount ?? 0) + 1;
      const autoActionStatus = result.applied ? "applied" : result.action === "none" ? "noop" : "failed";
      const autoActionError =
        result.applied || result.action === "none"
          ? null
          : result.errorMessage ?? "Auto action did not produce a queue mutation.";
      const autoActionFailureExhausted =
        autoActionStatus === "failed" && autoActionAttemptCount >= candidate.policy.maxAutoActionFailures;

      await db
        .update(itemFulfillmentAnomalies)
        .set({
          autoActionAttemptCount,
          lastAutoAction: result.action !== "none" ? result.action : anomaly.lastAutoAction,
          lastAutoActionAt: now(),
          lastAutoActionStatus: autoActionStatus,
          lastAutoActionError: autoActionError,
          escalationStrategy: autoActionFailureExhausted
            ? candidate.policy.failureEscalationStrategy
            : anomaly.escalationStrategy ?? candidate.policy.escalationStrategy,
          nextAlertEligibleAt: autoActionFailureExhausted ? now() : anomaly.nextAlertEligibleAt,
          lastAlertReason: autoActionFailureExhausted
            ? buildFulfillmentAnomalyAutoActionFailureReason({
                anomalyId: candidate.anomalyId,
                action: result.action,
                attemptCount: autoActionAttemptCount,
                maxAutoActionFailures: candidate.policy.maxAutoActionFailures,
                failureEscalationStrategy: candidate.policy.failureEscalationStrategy,
                policyKey: candidate.policy.key,
              })
            : anomaly.lastAlertReason,
        })
        .where(eq(itemFulfillmentAnomalies.id, candidate.anomalyId));
        await enqueueOutboxEvent("item.anomalyAutoActionApplied", {
          anomalyId: candidate.anomalyId,
          itemId: anomaly.itemId,
          reportId: anomaly.reportId,
          reviewId: anomaly.reviewId,
        policyKey: anomaly.policyKey ?? candidate.policy.key,
          escalationStrategy: autoActionFailureExhausted
            ? candidate.policy.failureEscalationStrategy
            : anomaly.escalationStrategy ?? candidate.policy.escalationStrategy,
          autoAction: candidate.effectiveAutoAction,
          autoActionTemplateKey: candidate.effectiveAutoActionTemplateKey,
          autoActionStatus,
          autoActionError,
          autoActionResult: result.action,
        });
      if (autoActionFailureExhausted) {
        await enqueueOutboxEvent("item.anomalyEscalated", {
          anomalyId: candidate.anomalyId,
          itemId: anomaly.itemId,
          reportId: anomaly.reportId,
          reviewId: anomaly.reviewId,
          kind: anomaly.kind,
          severity: anomaly.severity,
          alertLevel: anomaly.alertLevel,
          policyKey: anomaly.policyKey ?? candidate.policy.key,
          escalationStrategy: candidate.policy.failureEscalationStrategy,
        });
      }
    }
  }

  return {
    scannedCount: rows.length,
    escalatedCount,
    unchangedCount,
    affectedIds,
  };
}
