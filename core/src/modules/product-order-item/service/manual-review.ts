import type {
  ItemManualReviewAction,
  ItemManualReviewPriority,
  ItemManualReviewAssignmentAction,
  ItemManualReviewRoutingCode,
  ItemManualReviewSlaBucket,
  ManualReviewRebalanceAssignmentView,
  ManualReviewRebalanceResult,
  ManualReviewSlaPolicyTemplateView,
  ManualReviewSlaSummaryView,
  ManualReviewWorkloadSnapshotView,
  ManualReviewWorkloadView,
  ItemManualReviewView,
  ItemUnitIssueReason,
  ItemView,
} from "@neuro/contracts";
import {
  and,
  asc,
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
  itemIssueReports,
  itemManualReviews,
  itemManualReviewAssignmentEvents,
  itemManualReviewWorkloadSnapshots,
  itemReplacementLogs,
  items,
  itemUnits,
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
  type DbTx,
} from "./shared";
import {
  getManualReviewAgeHours,
  getManualReviewPriority,
  getManualReviewPriorityRank,
  getManualReviewSlaPolicy,
  getManualReviewSlaBucket,
  getManualReviewSlaAnomalyRuleState,
  getManualReviewSlaRank,
  getManualReviewEscalationLevel,
  getManualReviewAgeBucket,
  getManualReviewClaimAgeHours,
  getManualReviewClaimAgeBucket,
  isManualReviewClaimStale,
  getRecommendedManualReviewAssignee,
  normalizeManualReviewAssigneePool,
  getRoutingAwareManualReviewAssigneePool,
  getManualReviewAutoAssignTemplate,
  getManualReviewTemplateScope,
  isManualReviewAnomalyRoutingCode,
  matchesManualReviewTemplateKey,
  getManualReviewAssigneeCapacity,
  isManualReviewAssigneeAtCapacity,
  getManualReviewAutoRebalancePolicy,
} from "./manual-review-policy";
import {
  upsertFulfillmentAnomalyInTx,
  resolveFulfillmentAnomaliesInTx,
  resolveManualReviewQueueLinkedAnomaliesInTx,
} from "./anomaly-engine";
import {
  buildUnitCode,
  getResolvedManualReviewRejectionCode,
  toItemManualReviewView,
  toItemManualReviewAssignmentEventView,
  buildManualReviewAssignmentHistoryMap,
  loadItemViewInTx,
} from "./item-views";

export async function listOpenItemManualReviews(
  operatorUserId: string,
  filters?: {
    status?: "open" | "approved" | "rejected" | "all";
    reason?: ItemUnitIssueReason;
    routingCode?: string;
    suggestedAction?: string;
    rejectionCategory?: ItemManualReviewView["rejectionCategory"];
    appealable?: "true" | "false";
    priority?: ItemManualReviewPriority;
    slaBucket?: ItemManualReviewSlaBucket;
    limit?: number;
    assignee?: string;
    claimedAt?: string;
  },
): Promise<ItemManualReviewView[]> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual reviews");
  }

  const clauses: SQL[] = [];
  if (filters?.status && filters.status !== "all") {
    clauses.push(eq(itemManualReviews.status, filters.status));
  } else if (!filters?.status) {
    clauses.push(eq(itemManualReviews.status, "open"));
  }
  if (filters?.reason) {
    clauses.push(eq(itemManualReviews.reason, filters.reason));
  }
  if (filters?.routingCode) {
    clauses.push(eq(itemManualReviews.routingCode, filters.routingCode));
  }
  if (filters?.suggestedAction) {
    clauses.push(eq(itemManualReviews.suggestedAction, filters.suggestedAction));
  }
  if (filters?.assignee === "me") {
    clauses.push(eq(itemManualReviews.assigneeUserId, operatorUserId));
  } else if (filters?.assignee === "unassigned") {
    clauses.push(sql`${itemManualReviews.assigneeUserId} is null`);
  } else if (filters?.assignee && filters.assignee !== "any") {
    clauses.push(eq(itemManualReviews.assigneeUserId, filters.assignee));
  }
  if (filters?.claimedAt === "claimed") {
    clauses.push(sql`${itemManualReviews.claimedAt} is not null`);
  } else if (filters?.claimedAt === "unclaimed") {
    clauses.push(sql`${itemManualReviews.claimedAt} is null`);
  }
  const requestedLimit = Math.max(1, Math.min(filters?.limit ?? 100, 200));
  const prioritizeOldest = Boolean(filters?.priority);
  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(prioritizeOldest ? sql`${itemManualReviews.createdAt} asc` : sql`${itemManualReviews.createdAt} desc`)
    .limit(prioritizeOldest ? Math.min(Math.max(requestedLimit * 4, 250), 600) : requestedLimit);

  const reportIds = Array.from(new Set(rows.map((row) => row.reportId)));
  const reports =
    reportIds.length > 0
      ? await db.select().from(itemIssueReports).where(inArray(itemIssueReports.id, reportIds))
      : [];
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap(rows.map((row) => row.id));
  const referenceTime = now();

  const views = rows.map((row) =>
    toItemManualReviewView(
      row,
      reportsById.get(row.reportId),
      referenceTime,
      operatorUserId,
      assignmentHistoryMap.get(row.id) ?? [],
    ),
  );
  const filtered = views.filter((view) => {
    if (filters?.priority && view.priority !== filters.priority) return false;
    if (filters?.slaBucket && view.slaBucket !== filters.slaBucket) return false;
    if (filters?.rejectionCategory && view.rejectionCategory !== filters.rejectionCategory) return false;
    if (filters?.appealable === "true" && !view.appealable) return false;
    if (filters?.appealable === "false" && view.appealable) return false;
    return true;
  });
  return filtered.slice(0, requestedLimit);
}

export async function getOpenItemManualReviewSummary(operatorUserId: string) {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review summary");
  }

  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt);

  const byReason = new Map<string, number>();
  const byRoutingCode = new Map<string, number>();
  const bySuggestedAction = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const byAgeBucket = new Map<string, number>();
  const byClaimState = new Map<string, number>();
  const byClaimAgeBucket = new Map<string, number>();
  const byAssignee = new Map<string, number>();
  const referenceTime = now();
  let claimedCount = 0;
  let staleClaimedCount = 0;

  const [autoReleasedRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(itemManualReviews)
    .where(
      and(
        eq(itemManualReviews.lastClaimReleaseReason, "stale_timeout_release"),
        sql`${itemManualReviews.lastClaimReleasedAt} >= now() - interval '24 hours'`,
      ),
    );

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const claimAgeHours = getManualReviewClaimAgeHours(row.claimedAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    byRoutingCode.set(row.routingCode, (byRoutingCode.get(row.routingCode) ?? 0) + 1);
    bySuggestedAction.set(row.suggestedAction, (bySuggestedAction.get(row.suggestedAction) ?? 0) + 1);
    byPriority.set(priority, (byPriority.get(priority) ?? 0) + 1);
    const ageBucket = getManualReviewAgeBucket(ageHours);
    byAgeBucket.set(ageBucket, (byAgeBucket.get(ageBucket) ?? 0) + 1);
    const claimState = row.assigneeUserId ? "claimed" : "unclaimed";
    byClaimState.set(claimState, (byClaimState.get(claimState) ?? 0) + 1);
    byAssignee.set(row.assigneeUserId ?? "unassigned", (byAssignee.get(row.assigneeUserId ?? "unassigned") ?? 0) + 1);
    const claimAgeBucket = getManualReviewClaimAgeBucket(claimAgeHours);
    byClaimAgeBucket.set(claimAgeBucket, (byClaimAgeBucket.get(claimAgeBucket) ?? 0) + 1);
    if (row.assigneeUserId) {
      claimedCount += 1;
      if (isManualReviewClaimStale(row.claimedAt, referenceTime)) {
        staleClaimedCount += 1;
      }
    }
  }

  return {
    openCount: rows.length,
    oldestOpenAt: rows[0]?.createdAt ? rows[0].createdAt.toISOString() : null,
    oldestOpenAgeHours: rows[0]?.createdAt ? getManualReviewAgeHours(rows[0].createdAt, referenceTime) : null,
    claimedCount,
    unclaimedCount: Math.max(0, rows.length - claimedCount),
    staleClaimedCount,
    autoReleasedLast24h: Number(autoReleasedRow?.count ?? 0),
    byReason: sortSummaryBuckets(byReason),
    byRoutingCode: sortSummaryBuckets(byRoutingCode),
    bySuggestedAction: sortSummaryBuckets(bySuggestedAction),
    byPriority: sortSummaryBuckets(byPriority),
    byAgeBucket: sortSummaryBuckets(byAgeBucket),
    byClaimState: sortSummaryBuckets(byClaimState),
    byClaimAgeBucket: sortSummaryBuckets(byClaimAgeBucket),
    byAssignee: sortSummaryBuckets(byAssignee),
  };
}

export async function getManualReviewSlaSummary(
  operatorUserId: string,
  filters?: { assignee?: string | null; priority?: ItemManualReviewPriority | null },
): Promise<ManualReviewSlaSummaryView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review SLA summary");
  }

  const rows = await db
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.status, "open"))
    .orderBy(itemManualReviews.createdAt);

  const referenceTime = now();
  const bySlaBucket = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const policyBuckets = new Map<string, ManualReviewSlaPolicyTemplateView>();
  const byAssignee = new Map<string, { openCount: number; breachedCount: number; dueSoonCount: number; totalAgeHours: number }>();
  let openCount = 0;
  let oldestBreachedAgeHours: number | null = null;
  let escalatedCount = 0;
  let autoAssignedLast24h = 0;

  for (const row of rows) {
    if (filters?.assignee && (row.assigneeUserId ?? "unassigned") !== filters.assignee) {
      continue;
    }

    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    if (filters?.priority && priority !== filters.priority) {
      continue;
    }

    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    const escalationLevel = Math.max(
      row.escalationLevel ?? 0,
      getManualReviewEscalationLevel({
        ageHours,
        slaBucket,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
    );
    openCount += 1;
    bySlaBucket.set(slaBucket, (bySlaBucket.get(slaBucket) ?? 0) + 1);
    byPriority.set(priority, (byPriority.get(priority) ?? 0) + 1);
    const policyBucket = policyBuckets.get(policy.key) ?? {
      key: policy.key,
      scope: policy.scope,
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: 0,
      dueSoonCount: 0,
      breachedCount: 0,
      unclaimedCount: 0,
      escalatedCount: 0,
    };
    policyBucket.matchingReviewCount += 1;
    if (slaBucket === "due_soon") {
      policyBucket.dueSoonCount += 1;
    } else if (slaBucket === "breached") {
      policyBucket.breachedCount += 1;
    }
    if (!row.assigneeUserId) {
      policyBucket.unclaimedCount += 1;
    }
    if (escalationLevel > 0) {
      policyBucket.escalatedCount += 1;
    }
    policyBuckets.set(policy.key, policyBucket);

    if (slaBucket === "breached") {
      oldestBreachedAgeHours = oldestBreachedAgeHours === null ? ageHours : Math.max(oldestBreachedAgeHours, ageHours);
    }
    if (escalationLevel > 0) {
      escalatedCount += 1;
    }
    if (
      row.lastAutoAssignedAt &&
      row.lastAutoAssignedAt.getTime() >= referenceTime.getTime() - 24 * 60 * 60 * 1000
    ) {
      autoAssignedLast24h += 1;
    }

    const assigneeKey = row.assigneeUserId ?? "unassigned";
    const bucket = byAssignee.get(assigneeKey) ?? {
      openCount: 0,
      breachedCount: 0,
      dueSoonCount: 0,
      totalAgeHours: 0,
    };
    bucket.openCount += 1;
    bucket.totalAgeHours += ageHours;
    if (slaBucket === "breached") {
      bucket.breachedCount += 1;
    } else if (slaBucket === "due_soon") {
      bucket.dueSoonCount += 1;
    }
    byAssignee.set(assigneeKey, bucket);
  }

  const onTrackCount = bySlaBucket.get("on_track") ?? 0;
  const dueSoonCount = bySlaBucket.get("due_soon") ?? 0;
  const breachedCount = bySlaBucket.get("breached") ?? 0;

  return {
    openCount,
    onTrackCount,
    dueSoonCount,
    breachedCount,
    escalatedCount,
    autoAssignedLast24h,
    oldestBreachedAgeHours,
    bySlaBucket: sortSummaryBuckets(bySlaBucket),
    byPriority: sortSummaryBuckets(byPriority),
    byPolicy: Array.from(policyBuckets.values())
      .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key))
      .map((bucket) => ({ key: bucket.key, count: bucket.matchingReviewCount })),
    byAssignee: Array.from(byAssignee.entries())
      .map(([key, value]) => ({
        key,
        openCount: value.openCount,
        breachedCount: value.breachedCount,
        dueSoonCount: value.dueSoonCount,
        avgAgeHours: value.openCount > 0 ? Number((value.totalAgeHours / value.openCount).toFixed(1)) : null,
      }))
      .sort((left, right) => {
        if (right.breachedCount !== left.breachedCount) return right.breachedCount - left.breachedCount;
        if (right.dueSoonCount !== left.dueSoonCount) return right.dueSoonCount - left.dueSoonCount;
        if (right.openCount !== left.openCount) return right.openCount - left.openCount;
        return left.key.localeCompare(right.key);
      }),
  };
}

function toManualReviewWorkloadSnapshotView(
  row: typeof itemManualReviewWorkloadSnapshots.$inferSelect,
): ManualReviewWorkloadSnapshotView {
  return {
    id: row.id,
    source: row.source as "manual" | "auto",
    openCount: row.openCount,
    unclaimedCount: row.unclaimedCount,
    breachedUnclaimedCount: row.breachedUnclaimedCount,
    slaBreachedCount: row.slaBreachedCount,
    atCapacityCount: row.atCapacityCount,
    recommendedAssigneeUserId: row.recommendedAssigneeUserId,
    claimNextEta: row.claimNextEta,
    createdAt: row.createdAt.toISOString(),
  };
}

async function recordManualReviewWorkloadSnapshot(source: "manual" | "auto", workload: ManualReviewWorkloadView) {
  const openCount = workload.byAssignee.reduce((sum, bucket) => sum + bucket.claimedCount, 0) + workload.unclaimedCount;
  await db.insert(itemManualReviewWorkloadSnapshots).values({
    id: crypto.randomUUID(),
    source,
    openCount,
    unclaimedCount: workload.unclaimedCount,
    breachedUnclaimedCount: workload.breachedUnclaimedCount,
    slaBreachedCount: workload.slaBreachedCount,
    atCapacityCount: workload.atCapacityCount,
    recommendedAssigneeUserId: workload.recommendedAssigneeUserId,
    claimNextEta: workload.claimNextEta,
    createdAt: now(),
  });
}

export async function resolveItemManualReview(
  operatorUserId: string,
  reviewId: string,
  action: ItemManualReviewAction,
  resolutionNote?: string,
): Promise<ItemView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can resolve manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Manual review already resolved");
    }
    if (review.assigneeUserId && review.assigneeUserId !== operatorUserId) {
      throw new UnauthorizedError("Manual review is currently claimed by another operator");
    }

    await tx.execute(sql`select id from items where id = ${review.itemId} for update`);
    await tx.execute(sql`select id from item_units where id = ${review.unitId} for update`);

    const [item] = await tx.select().from(items).where(eq(items.id, review.itemId));
    const [unit] = await tx.select().from(itemUnits).where(eq(itemUnits.id, review.unitId));
    if (!item || !unit) {
      throw new NotFoundError("Linked item or unit missing");
    }

    const timestamp = now();
    let nextActiveUnits = item.activeUnits;
    let nextReplacementCount = item.replacementCount;
    let replacementUnitId: string | null = null;

    if (action === "approve_replacement") {
      if (unit.status === "replaced" && unit.replacedByUnitId) {
        replacementUnitId = unit.replacedByUnitId;
      } else {
        const [createdReplacement] = await tx
          .insert(itemUnits)
          .values({
            id: crypto.randomUUID(),
            itemId: item.id,
            slotNumber: unit.slotNumber,
            generation: unit.generation + 1,
            code: buildUnitCode(unit.slotNumber, unit.generation + 1),
            status: "active",
            issueReason: null,
            activatedAt: timestamp,
            expiresAt: unit.expiresAt,
            replacedByUnitId: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning();

        replacementUnitId = createdReplacement.id;
        nextReplacementCount += 1;
        nextActiveUnits = nextActiveUnits !== null ? nextActiveUnits + 1 : nextActiveUnits;

        await tx
          .update(itemUnits)
          .set({
            status: "replaced",
            replacedByUnitId: createdReplacement.id,
            updatedAt: timestamp,
          })
          .where(eq(itemUnits.id, unit.id));

        await tx.insert(itemReplacementLogs).values({
          id: crypto.randomUUID(),
          itemId: item.id,
          previousUnitId: unit.id,
          replacementUnitId: createdReplacement.id,
          reason: review.reason,
          trigger: "manual_review",
          createdAt: timestamp,
        });

        await enqueueOutboxEvent(
          "item.replaced",
          {
            userId: item.userId,
            itemId: item.id,
            oldUnitId: unit.id,
            newUnitId: createdReplacement.id,
            reason: review.reason,
          },
          tx,
        );
      }
    }

    const nextItemStatus = nextActiveUnits !== null && nextActiveUnits <= 0 ? "consumed" : "active";

    await tx
      .update(items)
      .set({
        activeUnits: nextActiveUnits,
        replacementCount: nextReplacementCount,
        status: nextItemStatus,
        lastReconciledAt: timestamp,
      })
      .where(eq(items.id, item.id));

    const resolvedRejectionCode =
      action === "reject_report"
        ? getResolvedManualReviewRejectionCode({
            reason: review.reason as ItemUnitIssueReason,
            routingCode: review.routingCode as ItemManualReviewRoutingCode,
          })
        : null;

    await tx
      .update(itemIssueReports)
      .set({
        outcome: action === "approve_replacement" ? "replaced" : "rejected",
        rejectionCode: resolvedRejectionCode,
        replacementUnitId,
      })
      .where(eq(itemIssueReports.id, review.reportId));

    await tx
      .update(itemManualReviews)
      .set({
        status: action === "approve_replacement" ? "approved" : "rejected",
        resolutionAction: action,
        resolutionNote: resolutionNote?.trim() || null,
        reviewerUserId: operatorUserId,
        resolvedAt: timestamp,
      })
      .where(eq(itemManualReviews.id, review.id));

    await resolveFulfillmentAnomaliesInTx({
      tx,
      itemId: item.id,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        action === "approve_replacement"
          ? "Manual review approved replacement and closed the routed anomaly."
          : "Manual review rejected the report and closed the routed anomaly.",
    });

    await enqueueOutboxEvent(
      "item.manualReviewResolved",
      {
        userId: item.userId,
        itemId: item.id,
        reviewId: review.id,
        action,
        replacementUnitId,
        resolutionNote: resolutionNote?.trim() || null,
      },
      tx,
    );

    return loadItemViewInTx(tx, item.id);
  });
}

export async function claimItemManualReview(
  operatorUserId: string,
  reviewId: string,
  assignmentAction: ItemManualReviewAssignmentAction = "claim",
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can claim manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be claimed");
    }
    if (review.assigneeUserId && review.assigneeUserId !== operatorUserId) {
      throw new ConflictError("Manual review is already claimed by another operator");
    }
    if (review.assigneeUserId !== operatorUserId) {
      await assertManualReviewAssigneeCapacityInTx(tx, operatorUserId);
    }

    const claimedAt = review.claimedAt ?? now();
    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId: operatorUserId,
        claimedAt,
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: assignmentAction,
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: operatorUserId,
      note: assignmentAction === "claim_next" ? "Operator claimed the next available review from the queue." : null,
    });

    await resolveManualReviewQueueLinkedAnomaliesInTx({
      tx,
      itemId: review.itemId,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        assignmentAction === "claim_next"
          ? "Manual review was claimed from the queue; queue-linked anomalies closed automatically."
          : "Manual review was claimed; queue-linked anomalies closed automatically.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function claimNextItemManualReview(
  operatorUserId: string,
  input?: { templateKey?: string | null },
): Promise<ItemManualReviewView | null> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can claim manual reviews");
  }

  const workload = await getManualReviewWorkload(operatorUserId);
  const operatorBucket = workload.byAssignee.find((bucket) => bucket.key === operatorUserId);
  if (operatorBucket?.atCapacity) {
    throw new ConflictError("Current operator is already at manual review capacity");
  }

  const candidates = await db
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.status, "open"), sql`${itemManualReviews.assigneeUserId} is null`))
    .orderBy(itemManualReviews.createdAt)
    .limit(250);

  const referenceTime = now();
  const sorted = candidates
    .map((row) => ({
      reviewId: row.id,
      priority: getManualReviewPriority({
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
      }),
      slaBucket: getManualReviewSlaBucket({
        ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
        priority: getManualReviewPriority({
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
        }),
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      createdAt: row.createdAt,
      ageHours: getManualReviewAgeHours(row.createdAt, referenceTime),
    }))
    .filter((candidate) =>
      matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: input?.templateKey ?? null,
      }),
    )
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      if (slaDiff !== 0) return slaDiff;
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      if (right.ageHours !== left.ageHours) return right.ageHours - left.ageHours;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  for (const candidate of sorted) {
    try {
      return await claimItemManualReview(operatorUserId, candidate.reviewId, "claim_next");
    } catch (error) {
      if (error instanceof ConflictError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

async function assertManualReviewAssigneeCapacityInTx(
  tx: DbTx,
  operatorUserId: string,
  options?: {
    excludeReviewId?: string | null;
  },
) {
  const capacity = getManualReviewAssigneeCapacity(operatorUserId);
  const clauses: SQL[] = [
    eq(itemManualReviews.status, "open"),
    eq(itemManualReviews.assigneeUserId, operatorUserId),
  ];
  if (options?.excludeReviewId) {
    clauses.push(sql`${itemManualReviews.id} <> ${options.excludeReviewId}`);
  }
  const rows = await tx
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(itemManualReviews)
    .where(and(...clauses));

  const claimedCount = Number(rows[0]?.count ?? 0);
  if (claimedCount >= capacity) {
    throw new ConflictError("Selected operator is already at manual review capacity");
  }

  return {
    capacity,
    claimedCount,
    remainingCapacity: Math.max(0, capacity - claimedCount),
  };
}

async function recordManualReviewAssignmentEventInTx(
  tx: DbTx,
  input: {
    review: typeof itemManualReviews.$inferSelect;
    actorUserId: string;
    action: ItemManualReviewAssignmentAction;
    fromAssigneeUserId: string | null;
    toAssigneeUserId: string | null;
    note?: string | null;
  },
) {
  await tx.insert(itemManualReviewAssignmentEvents).values({
    id: crypto.randomUUID(),
    reviewId: input.review.id,
    itemId: input.review.itemId,
    reportId: input.review.reportId,
    actorUserId: input.actorUserId,
    action: input.action,
    fromAssigneeUserId: input.fromAssigneeUserId,
    toAssigneeUserId: input.toAssigneeUserId,
    note: input.note ?? null,
    createdAt: now(),
  });
}

export async function listManualReviewSlaPolicies(operatorUserId: string): Promise<ManualReviewSlaPolicyTemplateView[]> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review SLA policies");
  }

  const rows = await db.select().from(itemManualReviews).where(eq(itemManualReviews.status, "open"));
  const referenceTime = now();
  const buckets = new Map<string, ManualReviewSlaPolicyTemplateView>();

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const escalationLevel = Math.max(
      row.escalationLevel ?? 0,
      getManualReviewEscalationLevel({
        ageHours,
        slaBucket,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      }),
    );
    const bucket = buckets.get(policy.key) ?? {
      key: policy.key,
      scope: policy.scope,
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: 0,
      dueSoonCount: 0,
      breachedCount: 0,
      unclaimedCount: 0,
      escalatedCount: 0,
    };
    bucket.matchingReviewCount += 1;
    if (slaBucket === "due_soon") {
      bucket.dueSoonCount += 1;
    } else if (slaBucket === "breached") {
      bucket.breachedCount += 1;
    }
    if (!row.assigneeUserId) {
      bucket.unclaimedCount += 1;
    }
    if (escalationLevel > 0) {
      bucket.escalatedCount += 1;
    }
    buckets.set(policy.key, bucket);
  }

  return Object.entries(env.manualReviewSlaPolicies)
    .map(([key, policy]) => ({
      key,
      scope: key.startsWith("routing:")
        ? ("routing" as const)
        : key.startsWith("priority:")
          ? ("priority" as const)
          : ("default" as const),
      slaHours: policy.slaHours,
      dueSoonLeadHours: policy.dueSoonLeadHours,
      criticalAfterHours: policy.criticalAfterHours,
      urgentAfterHours: policy.urgentAfterHours,
      assignAfterHours: policy.assignAfterHours,
      rebalanceAfterHours: policy.rebalanceAfterHours,
      autoAssignTemplateKey: policy.autoAssignTemplateKey,
      autoAssignEnabled: policy.autoAssignEnabled,
      maxAutoAssignmentsPerRun: policy.maxAutoAssignmentsPerRun,
      anomalyPolicyKey: policy.anomalyPolicyKey,
      anomalySeverity: policy.anomalySeverity,
      anomalyEscalationStrategy: policy.anomalyEscalationStrategy,
      anomalyAutoAction: policy.anomalyAutoAction,
      anomalyCooldownMinutes: policy.anomalyCooldownMinutes,
      anomalyStages: policy.anomalyStages,
      matchingReviewCount: buckets.get(key)?.matchingReviewCount ?? 0,
      dueSoonCount: buckets.get(key)?.dueSoonCount ?? 0,
      breachedCount: buckets.get(key)?.breachedCount ?? 0,
      unclaimedCount: buckets.get(key)?.unclaimedCount ?? 0,
      escalatedCount: buckets.get(key)?.escalatedCount ?? 0,
    }))
    .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key));
}

const MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT = 1_000;

export async function getManualReviewWorkload(operatorUserId: string): Promise<ManualReviewWorkloadView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can view manual review workload");
  }

  const [candidateRows, [openCountRow], recentAssignmentRows, historyRows] = await Promise.all([
    db
      .select()
      .from(itemManualReviews)
      .where(eq(itemManualReviews.status, "open"))
      .orderBy(asc(itemManualReviews.createdAt), asc(itemManualReviews.id))
      .limit(MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT + 1),
    db.select({ count: count() }).from(itemManualReviews).where(eq(itemManualReviews.status, "open")),
    db.select().from(itemManualReviewAssignmentEvents).orderBy(desc(itemManualReviewAssignmentEvents.createdAt)).limit(20),
    db.select().from(itemManualReviewWorkloadSnapshots).orderBy(desc(itemManualReviewWorkloadSnapshots.createdAt)).limit(20),
  ]);
  const hasMore = candidateRows.length > MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT;
  const rows = hasMore ? candidateRows.slice(0, MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT) : candidateRows;

  const referenceTime = now();
  const byAssignee = new Map<
    string,
    { claimedCount: number; processingCount: number; totalClaimAgeHours: number; claimAgeSamples: number }
  >();
  const bySlaBucket = new Map<string, number>();
  const byPolicy = new Map<string, number>();
  let unclaimedCount = 0;
  let breachedUnclaimedCount = 0;
  let slaBreachedCount = 0;
  let nextClaimCandidate: ManualReviewWorkloadView["nextClaimCandidate"] = null;
  const autoAssignQueue: Array<{
    reviewId: string;
    priority: ItemManualReviewPriority;
    slaBucket: ItemManualReviewSlaBucket;
    routingCode: ItemManualReviewRoutingCode;
    ageHours: number;
    templateKey: string | null;
  }> = [];
  const templateBuckets = new Map<
    string,
    {
      scope: "routing" | "priority" | "default";
      strategy: "least_loaded" | "priority_first";
      maxAssignments: number;
      assigneePool: string[];
      matchingReviewCount: number;
      anomalyReviewCount: number;
    }
  >();

  for (const row of rows) {
    const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
    const priority = getManualReviewPriority({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      ageHours,
    });
    const matchedTemplate = getManualReviewAutoAssignTemplate({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    if (matchedTemplate) {
      const templateBucket = templateBuckets.get(matchedTemplate.templateKey) ?? {
        scope: getManualReviewTemplateScope(matchedTemplate.templateKey),
        strategy: matchedTemplate.strategy,
        maxAssignments: matchedTemplate.maxAssignments,
        assigneePool: matchedTemplate.assigneePool,
        matchingReviewCount: 0,
        anomalyReviewCount: 0,
      };
      templateBucket.matchingReviewCount += 1;
      if (isManualReviewAnomalyRoutingCode(row.routingCode as ItemManualReviewRoutingCode)) {
        templateBucket.anomalyReviewCount += 1;
      }
      templateBuckets.set(matchedTemplate.templateKey, templateBucket);
    }
    const slaBucket = getManualReviewSlaBucket({
      ageHours,
      priority,
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
    });
    const policy = getManualReviewSlaPolicy({
      routingCode: row.routingCode as ItemManualReviewRoutingCode,
      priority,
    });
    bySlaBucket.set(slaBucket, (bySlaBucket.get(slaBucket) ?? 0) + 1);
    byPolicy.set(policy.key, (byPolicy.get(policy.key) ?? 0) + 1);
    if (slaBucket === "breached") {
      slaBreachedCount += 1;
    }

    if (!row.assigneeUserId) {
      unclaimedCount += 1;
      if (slaBucket === "breached") {
        breachedUnclaimedCount += 1;
      }
      if (slaBucket === "breached" || slaBucket === "due_soon") {
        autoAssignQueue.push({
          reviewId: row.id,
          priority,
          slaBucket,
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours,
          templateKey: matchedTemplate?.templateKey ?? null,
        });
      }
      if (
        !nextClaimCandidate ||
        getManualReviewSlaRank(slaBucket) > getManualReviewSlaRank(nextClaimCandidate.slaBucket ?? "on_track") ||
        (
          getManualReviewSlaRank(slaBucket) === getManualReviewSlaRank(nextClaimCandidate.slaBucket ?? "on_track") &&
        getManualReviewPriorityRank(priority) > getManualReviewPriorityRank(nextClaimCandidate.priority ?? "normal") ||
        (
          getManualReviewPriorityRank(priority) === getManualReviewPriorityRank(nextClaimCandidate.priority ?? "normal") &&
          ageHours > (nextClaimCandidate.ageHours ?? -1)
          )
        )
      ) {
        nextClaimCandidate = {
          reviewId: row.id,
          priority,
          slaBucket,
          routingCode: row.routingCode as ItemManualReviewRoutingCode,
          ageHours,
          templateKey: matchedTemplate?.templateKey ?? null,
        };
      }
      continue;
    }

    const claimAgeHours = getManualReviewClaimAgeHours(row.claimedAt, referenceTime);
    const bucket = byAssignee.get(row.assigneeUserId) ?? {
      claimedCount: 0,
      processingCount: 0,
      totalClaimAgeHours: 0,
      claimAgeSamples: 0,
    };
    bucket.claimedCount += 1;
    if (!isManualReviewClaimStale(row.claimedAt, referenceTime)) {
      bucket.processingCount += 1;
    }
    if (claimAgeHours !== null) {
      bucket.totalClaimAgeHours += claimAgeHours;
      bucket.claimAgeSamples += 1;
    }
    byAssignee.set(row.assigneeUserId, bucket);
  }

  for (const operatorId of normalizeManualReviewAssigneePool(operatorUserId, null)) {
    if (!byAssignee.has(operatorId)) {
      byAssignee.set(operatorId, {
        claimedCount: 0,
        processingCount: 0,
        totalClaimAgeHours: 0,
        claimAgeSamples: 0,
      });
    }
  }

  const byAssigneeBuckets = Array.from(byAssignee.entries())
    .map(([key, value]) => ({
      key,
      claimedCount: value.claimedCount,
      processingCount: value.processingCount,
      avgClaimAgeHours: value.claimAgeSamples > 0 ? Number((value.totalClaimAgeHours / value.claimAgeSamples).toFixed(1)) : null,
      capacity: getManualReviewAssigneeCapacity(key),
      remainingCapacity: Math.max(0, getManualReviewAssigneeCapacity(key) - value.claimedCount),
      atCapacity: isManualReviewAssigneeAtCapacity({
        operatorUserId: key,
        claimedCount: value.claimedCount,
      }),
    }))
    .sort((left, right) => {
      if (left.atCapacity !== right.atCapacity) return Number(left.atCapacity) - Number(right.atCapacity);
      if (right.claimedCount !== left.claimedCount) return right.claimedCount - left.claimedCount;
      return left.key.localeCompare(right.key);
    });
  const autoRebalancePolicy = getManualReviewAutoRebalancePolicy();
  const atCapacityCount = byAssigneeBuckets.filter((bucket) => bucket.atCapacity).length;
  const recommendedAssigneeUserId = getRecommendedManualReviewAssignee({
    currentOperatorUserId: operatorUserId,
    byAssignee: byAssigneeBuckets,
  });
  const slaPolicies = await listManualReviewSlaPolicies(operatorUserId);
  const recommendedAutoAssignments = autoAssignQueue.slice(0, env.manualReviewAutoRebalanceMaxAssignments).reduce<
    ManualReviewRebalanceAssignmentView[]
  >((acc, candidate) => {
    const poolDecision = getRoutingAwareManualReviewAssigneePool({
      operatorUserId,
      routingCode: candidate.routingCode,
    });
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: byAssigneeBuckets,
    });
    if (!assigneeUserId) {
      return acc;
    }
    acc.push({
      reviewId: candidate.reviewId,
      assigneeUserId,
      priority: candidate.priority,
      slaBucket: candidate.slaBucket,
      routingCode: candidate.routingCode,
      policySource: poolDecision.policySource,
      templateKey: candidate.templateKey,
    });
    return acc;
  }, []);

  return {
    scan: {
      limit: MANUAL_REVIEW_WORKLOAD_SCAN_LIMIT,
      scannedCount: rows.length,
      totalOpenCount: Number(openCountRow?.count ?? 0),
      hasMore,
    },
    byAssignee: byAssigneeBuckets,
    bySlaBucket: sortSummaryBuckets(bySlaBucket),
    byPolicy: sortSummaryBuckets(byPolicy),
    unclaimedCount,
    breachedUnclaimedCount,
    slaBreachedCount,
    atCapacityCount,
    autoRebalanceEnabled: autoRebalancePolicy.enabled,
    autoRebalancePool: autoRebalancePolicy.assigneePool,
    autoRebalanceMaxAssignments: autoRebalancePolicy.maxAssignments,
    autoRebalanceIntervalMinutes: autoRebalancePolicy.intervalMinutes,
    recommendedAssigneeUserId,
    claimNextEta: nextClaimCandidate ? (recommendedAssigneeUserId ? "available_now" : "capacity_blocked") : null,
    nextClaimCandidate,
    recommendedAutoAssignments,
    recentAssignments: recentAssignmentRows.map(toItemManualReviewAssignmentEventView),
    history: historyRows.map(toManualReviewWorkloadSnapshotView),
    templates: Array.from(templateBuckets.entries())
      .map(([key, value]) => ({
        key,
        scope: value.scope,
        strategy: value.strategy,
        maxAssignments: value.maxAssignments,
        assigneePool: value.assigneePool,
        matchingReviewCount: value.matchingReviewCount,
        anomalyReviewCount: value.anomalyReviewCount,
      }))
      .sort((left, right) => right.matchingReviewCount - left.matchingReviewCount || left.key.localeCompare(right.key)),
    slaPolicies,
  };
}

export async function assignBalancedItemManualReview(
  operatorUserId: string,
  input?: { reviewId?: string | null; assigneePool?: string[] | null },
): Promise<ItemManualReviewView | null> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can assign manual reviews");
  }

  const workload = await getManualReviewWorkload(operatorUserId);
  const reviewId = input?.reviewId?.trim() || workload.nextClaimCandidate?.reviewId || null;
  if (!reviewId) {
    return null;
  }

  const assigneeUserId =
    getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: normalizeManualReviewAssigneePool(operatorUserId, input?.assigneePool ?? null),
      byAssignee: workload.byAssignee,
    }) ?? workload.recommendedAssigneeUserId;
  if (!assigneeUserId) {
    return null;
  }
  return assignItemManualReview(operatorUserId, reviewId, assigneeUserId, "assign_balanced");
}

export async function assignItemManualReview(
  operatorUserId: string,
  reviewId: string,
  assigneeUserId: string,
  assignmentAction: ItemManualReviewAssignmentAction = "assign_explicit",
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can assign manual reviews");
  }
  const allowedAssignees = normalizeManualReviewAssigneePool(operatorUserId, [assigneeUserId]);
  if (!allowedAssignees.includes(assigneeUserId)) {
    throw new UnauthorizedError("Assignee must be a configured platform operator");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be assigned");
    }
    if (review.assigneeUserId && review.assigneeUserId !== assigneeUserId) {
      throw new ConflictError("Manual review is already claimed by another operator");
    }
    if (review.assigneeUserId !== assigneeUserId) {
      await assertManualReviewAssigneeCapacityInTx(tx, assigneeUserId, {
        excludeReviewId: review.id,
      });
    }

    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId,
        claimedAt: review.claimedAt ?? now(),
        autoAssignmentCount:
          assignmentAction === "assign_auto_sla" ? (review.autoAssignmentCount ?? 0) + 1 : review.autoAssignmentCount,
        lastAutoAssignedAt: assignmentAction === "assign_auto_sla" ? now() : review.lastAutoAssignedAt,
        escalationLevel:
          assignmentAction === "assign_auto_sla"
            ? Math.max(review.escalationLevel ?? 0, 1)
            : review.escalationLevel,
        slaEscalatedAt:
          assignmentAction === "assign_auto_sla" && !review.slaEscalatedAt ? now() : review.slaEscalatedAt,
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: assignmentAction,
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: assigneeUserId,
      note:
        assignmentAction === "assign_balanced"
          ? "Balanced assignment selected the least-loaded operator."
          : assignmentAction === "rebalance_manual"
            ? "Manual rebalance assigned the review to a different operator."
            : assignmentAction === "rebalance_auto"
              ? "Automatic rebalance assigned the review to the configured operator pool."
              : assignmentAction === "assign_auto_sla"
                ? "SLA automation assigned the review because it reached due-soon/breached state."
              : null,
    });

    await resolveManualReviewQueueLinkedAnomaliesInTx({
      tx,
      itemId: review.itemId,
      reportId: review.reportId,
      reviewId: review.id,
      resolutionNote:
        assignmentAction === "assign_auto_sla"
          ? "Manual review was automatically assigned; queue-linked anomalies closed automatically."
          : "Manual review was assigned; queue-linked anomalies closed automatically.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function rebalanceItemManualReviews(
  operatorUserId: string,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[] | null;
    templateKey?: string | null;
    assignmentAction?: "rebalance_manual" | "rebalance_auto";
  },
): Promise<ManualReviewRebalanceResult> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can rebalance manual reviews");
  }

  const maxAssignments = Math.max(1, Math.min(input?.maxAssignments ?? 10, 100));
  const strategy = input?.strategy ?? "least_loaded";
  const assignmentAction = input?.assignmentAction ?? "rebalance_manual";
  const assigneePool = normalizeManualReviewAssigneePool(operatorUserId, input?.assigneePool ?? null);
  const workload = await getManualReviewWorkload(operatorUserId);

  const candidates = await db
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.status, "open"), sql`${itemManualReviews.assigneeUserId} is null`))
    .orderBy(itemManualReviews.createdAt)
    .limit(500);

  const referenceTime = now();
  const queue = candidates
    .map((row) => {
      const ageHours = getManualReviewAgeHours(row.createdAt, referenceTime);
      const priority = getManualReviewPriority({
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaBucket = getManualReviewSlaBucket({
        ageHours,
        priority,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
      });
      return {
        reviewId: row.id,
        priority,
        slaBucket,
        routingCode: row.routingCode as ItemManualReviewRoutingCode,
        ageHours,
        templateKey:
          getManualReviewAutoAssignTemplate({
            routingCode: row.routingCode as ItemManualReviewRoutingCode,
            priority,
          })?.templateKey ?? null,
        createdAt: row.createdAt,
      };
    })
    .filter((candidate) =>
      matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: input?.templateKey ?? null,
      }),
    )
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (strategy === "priority_first") {
        if (slaDiff !== 0) return slaDiff;
        if (priorityDiff !== 0) return priorityDiff;
      } else {
        if (priorityDiff !== 0) return priorityDiff;
        if (slaDiff !== 0) return slaDiff;
      }
      if (right.ageHours !== left.ageHours) return right.ageHours - left.ageHours;
      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  const localBuckets = new Map(
    workload.byAssignee
      .filter((bucket) => assigneePool.includes(bucket.key))
      .map((bucket) => [
        bucket.key,
        {
          claimedCount: bucket.claimedCount,
          processingCount: bucket.processingCount,
          avgClaimAgeHours: bucket.avgClaimAgeHours,
        },
      ]),
  );

  const assignments: ManualReviewRebalanceAssignmentView[] = [];
  let skippedCount = 0;

  for (const candidate of queue) {
    if (assignments.length >= maxAssignments) {
      break;
    }

    const poolDecision = getRoutingAwareManualReviewAssigneePool({
      operatorUserId,
      routingCode: candidate.routingCode,
      explicitAssigneePool: input?.assigneePool ?? null,
    });
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: poolDecision.assigneePool.map((key) => ({
        key,
        claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        processingCount: localBuckets.get(key)?.processingCount ?? 0,
        avgClaimAgeHours: localBuckets.get(key)?.avgClaimAgeHours ?? null,
        capacity: getManualReviewAssigneeCapacity(key),
        remainingCapacity: Math.max(
          0,
          getManualReviewAssigneeCapacity(key) - (localBuckets.get(key)?.claimedCount ?? 0),
        ),
        atCapacity: isManualReviewAssigneeAtCapacity({
          operatorUserId: key,
          claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        }),
      })),
    });
    if (!assigneeUserId) {
      skippedCount += 1;
      continue;
    }

    try {
      await assignItemManualReview(operatorUserId, candidate.reviewId, assigneeUserId, assignmentAction);
      const bucket = localBuckets.get(assigneeUserId) ?? {
        claimedCount: 0,
        processingCount: 0,
        avgClaimAgeHours: 0,
      };
      bucket.claimedCount += 1;
      bucket.processingCount += 1;
      localBuckets.set(assigneeUserId, bucket);
      assignments.push({
        reviewId: candidate.reviewId,
        assigneeUserId,
        priority: candidate.priority,
        slaBucket: candidate.slaBucket,
        routingCode: candidate.routingCode,
        policySource: poolDecision.policySource,
        templateKey: candidate.templateKey,
      });
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
        skippedCount += 1;
        continue;
      }
      throw error;
    }
  }

  const result = {
    assignedCount: assignments.length,
    skippedCount,
    assignments,
  } satisfies ManualReviewRebalanceResult;

  const refreshedWorkload = await getManualReviewWorkload(operatorUserId);
  await recordManualReviewWorkloadSnapshot(
    assignmentAction === "rebalance_auto" ? "auto" : "manual",
    refreshedWorkload,
  );

  return result;
}

export async function autoRebalanceItemManualReviews(args?: {
  strategy?: "least_loaded" | "priority_first";
  maxAssignments?: number;
  assigneePool?: string[] | null;
  templateKey?: string | null;
}) {
  const autoRebalancePolicy = getManualReviewAutoRebalancePolicy();
  if (!autoRebalancePolicy.enabled) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  const operatorUserId = autoRebalancePolicy.assigneePool[0];
  if (!operatorUserId) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  return rebalanceItemManualReviews(operatorUserId, {
    strategy: args?.strategy ?? "priority_first",
    maxAssignments: args?.maxAssignments ?? autoRebalancePolicy.maxAssignments,
    assigneePool: args?.assigneePool ?? autoRebalancePolicy.assigneePool,
    templateKey: args?.templateKey ?? null,
    assignmentAction: "rebalance_auto",
  });
}

export async function autoAssignSlaItemManualReviews(args?: {
  maxAssignments?: number;
  assigneePool?: string[] | null;
  templateKey?: string | null;
}) {
  const operatorUserId = env.platformOperatorUserIds[0];
  if (!operatorUserId) {
    return {
      assignedCount: 0,
      skippedCount: 0,
      assignments: [],
    } satisfies ManualReviewRebalanceResult;
  }

  const maxAssignments = Math.max(1, Math.min(args?.maxAssignments ?? env.manualReviewAutoRebalanceMaxAssignments, 50));
  const reviews = await listOpenItemManualReviews(operatorUserId, {
    status: "open",
    limit: 200,
  });
  const queue = reviews
    .filter((review) => !review.assigneeUserId && (review.slaBucket === "breached" || review.slaBucket === "due_soon"))
    .sort((left, right) => {
      const slaDiff = getManualReviewSlaRank(right.slaBucket) - getManualReviewSlaRank(left.slaBucket);
      if (slaDiff !== 0) return slaDiff;
      const priorityDiff = getManualReviewPriorityRank(right.priority) - getManualReviewPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return right.ageHours - left.ageHours;
    });

  const assignments: ManualReviewRebalanceAssignmentView[] = [];
  const templateAssignmentCounts = new Map<string, number>();
  const slaPolicyAssignmentCounts = new Map<string, number>();
  const initialWorkload = await getManualReviewWorkload(operatorUserId);
  const localBuckets = new Map(
    initialWorkload.byAssignee.map((bucket) => [
      bucket.key,
      {
        claimedCount: bucket.claimedCount,
        processingCount: bucket.processingCount,
        avgClaimAgeHours: bucket.avgClaimAgeHours,
      },
    ]),
  );
  let skippedCount = 0;
  for (const candidate of queue) {
    if (assignments.length >= maxAssignments) break;
    const slaPolicy = getManualReviewSlaPolicy({
      routingCode: candidate.routingCode,
      priority: candidate.priority,
    });
    if (!slaPolicy.autoAssignEnabled) {
      skippedCount += 1;
      continue;
    }
    if ((slaPolicyAssignmentCounts.get(slaPolicy.key) ?? 0) >= slaPolicy.maxAutoAssignmentsPerRun) {
      skippedCount += 1;
      continue;
    }
    const template = getManualReviewAutoAssignTemplate({
      routingCode: candidate.routingCode,
      priority: candidate.priority,
    });
    if (
      !matchesManualReviewTemplateKey({
        routingCode: candidate.routingCode,
        priority: candidate.priority,
        templateKey: args?.templateKey ?? null,
      })
    ) {
      skippedCount += 1;
      continue;
    }
    if (template && (templateAssignmentCounts.get(template.templateKey) ?? 0) >= template.maxAssignments) {
      skippedCount += 1;
      continue;
    }
    const poolDecision =
      template && !args?.assigneePool?.length
        ? {
            assigneePool: normalizeManualReviewAssigneePool(operatorUserId, template.assigneePool),
            policySource: template.policySource,
            templateKey: template.templateKey,
          }
        : {
            ...getRoutingAwareManualReviewAssigneePool({
              operatorUserId,
              routingCode: candidate.routingCode,
              explicitAssigneePool: args?.assigneePool ?? null,
            }),
            templateKey: null as string | null,
          };
    const assigneeUserId = getRecommendedManualReviewAssignee({
      currentOperatorUserId: operatorUserId,
      assigneePool: poolDecision.assigneePool,
      byAssignee: poolDecision.assigneePool.map((key) => ({
        key,
        claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        processingCount: localBuckets.get(key)?.processingCount ?? 0,
        avgClaimAgeHours: localBuckets.get(key)?.avgClaimAgeHours ?? null,
        capacity: getManualReviewAssigneeCapacity(key),
        remainingCapacity: Math.max(
          0,
          getManualReviewAssigneeCapacity(key) - (localBuckets.get(key)?.claimedCount ?? 0),
        ),
        atCapacity: isManualReviewAssigneeAtCapacity({
          operatorUserId: key,
          claimedCount: localBuckets.get(key)?.claimedCount ?? 0,
        }),
      })),
    });
    if (!assigneeUserId) {
      skippedCount += 1;
      continue;
    }
    try {
      const review = await assignItemManualReview(operatorUserId, candidate.id, assigneeUserId, "assign_auto_sla");
      const localBucket = localBuckets.get(assigneeUserId) ?? {
        claimedCount: 0,
        processingCount: 0,
        avgClaimAgeHours: null,
      };
      localBucket.claimedCount += 1;
      localBucket.processingCount += 1;
      localBuckets.set(assigneeUserId, localBucket);
      assignments.push({
        reviewId: review.id,
        assigneeUserId,
        priority: review.priority,
        slaBucket: review.slaBucket,
        routingCode: review.routingCode,
        policySource: poolDecision.policySource,
        templateKey: poolDecision.templateKey,
      });
      if (template) {
        templateAssignmentCounts.set(template.templateKey, (templateAssignmentCounts.get(template.templateKey) ?? 0) + 1);
      }
      slaPolicyAssignmentCounts.set(slaPolicy.key, (slaPolicyAssignmentCounts.get(slaPolicy.key) ?? 0) + 1);
    } catch (error) {
      if (error instanceof ConflictError || error instanceof NotFoundError || error instanceof UnauthorizedError) {
        skippedCount += 1;
        continue;
      }
      throw error;
    }
  }

  const refreshedWorkload = await getManualReviewWorkload(operatorUserId);
  await recordManualReviewWorkloadSnapshot("auto", refreshedWorkload);
  return {
    assignedCount: assignments.length,
    skippedCount,
    assignments,
  } satisfies ManualReviewRebalanceResult;
}

export async function releaseItemManualReview(
  operatorUserId: string,
  reviewId: string,
): Promise<ItemManualReviewView> {
  if (!isPlatformOperator(operatorUserId)) {
    throw new UnauthorizedError("Only platform operators can release manual reviews");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item_manual_reviews where id = ${reviewId} for update`);
    const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, reviewId));
    if (!review) {
      throw new NotFoundError("Manual review not found");
    }
    if (review.status !== "open") {
      throw new ConflictError("Only open manual reviews can be released");
    }
    if (!review.assigneeUserId) {
      throw new ConflictError("Manual review is not currently claimed");
    }
    if (review.assigneeUserId !== operatorUserId) {
      throw new UnauthorizedError("Only the claiming operator can release this manual review");
    }

    const [updated] = await tx
      .update(itemManualReviews)
      .set({
        assigneeUserId: null,
        claimedAt: null,
        lastClaimReleasedAt: now(),
        lastClaimReleaseReason: "operator_release",
      })
      .where(eq(itemManualReviews.id, review.id))
      .returning();

    await recordManualReviewAssignmentEventInTx(tx, {
      review,
      actorUserId: operatorUserId,
      action: "release",
      fromAssigneeUserId: review.assigneeUserId,
      toAssigneeUserId: null,
      note: "Operator released the claimed manual review back to the queue.",
    });

    const [report] = await tx.select().from(itemIssueReports).where(eq(itemIssueReports.id, updated.reportId));
    const assignmentHistoryMap = await buildManualReviewAssignmentHistoryMap([updated.id], tx);
    return toItemManualReviewView(updated, report, now(), operatorUserId, assignmentHistoryMap.get(updated.id) ?? []);
  });
}

export async function releaseStaleItemManualReviews(args?: { limit?: number }) {
  const limit = Math.max(1, Math.min(args?.limit ?? 25, 100));
  const staleHours = Math.max(1, env.manualReviewStaleClaimHours);

  return db.transaction(async (tx) => {
    const rows = await tx.execute<{
      id: string;
      item_id: string;
      report_id: string;
    }>(sql`
      select id, item_id, report_id
      from item_manual_reviews
      where status = 'open'
        and assignee_user_id is not null
        and claimed_at is not null
        and claimed_at <= now() - (${staleHours} * interval '1 hour')
      order by claimed_at asc
      limit ${limit}
      for update skip locked
    `);

    const releasedReviewIds: string[] = [];
    for (const row of rows.rows) {
      const [review] = await tx.select().from(itemManualReviews).where(eq(itemManualReviews.id, row.id));
      if (!review || review.status !== "open" || !review.assigneeUserId || !review.claimedAt) {
        continue;
      }
      if (!isManualReviewClaimStale(review.claimedAt, now())) {
        continue;
      }

      const timestamp = now();
      await tx
        .update(itemManualReviews)
        .set({
          assigneeUserId: null,
          claimedAt: null,
          lastClaimReleasedAt: timestamp,
          lastClaimReleaseReason: "stale_timeout_release",
        })
        .where(eq(itemManualReviews.id, review.id));

      await recordManualReviewAssignmentEventInTx(tx, {
        review,
        actorUserId: "system:manual-review-stale-release",
        action: "stale_release",
        fromAssigneeUserId: review.assigneeUserId,
        toAssigneeUserId: null,
        note: `Claim auto-released after exceeding the ${staleHours}-hour stale threshold.`,
      });

      await enqueueOutboxEvent(
        "item.manualReviewReleased",
        {
          itemId: review.itemId,
          reviewId: review.id,
          reportId: review.reportId,
          releaseReason: "stale_timeout_release",
        },
        tx,
      );
      const ageHours = getManualReviewAgeHours(review.createdAt, timestamp);
      const priority = getManualReviewPriority({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        ageHours,
      });
      const slaPolicy = getManualReviewSlaPolicy({
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
      });
      const anomalyRuleState = getManualReviewSlaAnomalyRuleState({
        ageHours,
        anomalyKind: "stale_manual_review",
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        priority,
        slaPolicy,
        referenceTime: timestamp,
      });
      await upsertFulfillmentAnomalyInTx({
        tx,
        itemId: review.itemId,
        reportId: review.reportId,
        reviewId: review.id,
        kind: "stale_manual_review",
        routingCode: review.routingCode as ItemManualReviewRoutingCode,
        policyKeyOverride: anomalyRuleState.anomalyPolicyKey,
        severityOverride: anomalyRuleState.severity,
        escalationStrategyOverride: anomalyRuleState.anomalyEscalationStrategy,
        alertLevelOverride: anomalyRuleState.alertLevel,
        nextAlertEligibleAtOverride: anomalyRuleState.nextAlertEligibleAt,
        nextEscalationAtOverride: anomalyRuleState.nextEscalationAt,
        autoActionOverride: anomalyRuleState.anomalyAutoAction,
        autoActionTemplateKeyOverride: anomalyRuleState.autoActionTemplateKey,
        summary: "Manual review claim became stale and was auto-released back to the queue.",
        detail: `Claim exceeded the ${staleHours}-hour stale threshold and was auto-released.${anomalyRuleState.matchedStageKey ? ` Applied SLA anomaly stage ${anomalyRuleState.matchedStageKey}.` : ""}`,
      });
      releasedReviewIds.push(review.id);
    }

    return {
      releasedCount: releasedReviewIds.length,
      staleHours,
      reviewIds: releasedReviewIds,
    };
  });
}
