import type {
  ItemFulfillmentRunStatus,
  ItemFulfillmentRunTrigger,
  ItemManualReviewRoutingCode,
  ItemManualReviewSuggestedAction,
  ItemIssueRejectionCode,
  ItemUnitIssueReason,
  ItemView,
} from "@neuro/contracts";
import {
  and,
  asc,
  eq,
  sql,
} from "drizzle-orm";
import { db } from "@/db/client";
import {
  itemFulfillmentRuns,
  itemIssueReports,
  itemManualReviews,
  itemReplacementLogs,
  items,
  itemUnits,
} from "@/modules/product-order-item/schema";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";
import {
  now,
  isIssueReportingEnabled,
  type DbTx,
} from "./shared";
import {
  getManualReviewAgeHours,
  getManualReviewPriority,
  getManualReviewSlaPolicy,
  getManualReviewSlaAnomalyRuleState,
} from "./manual-review-policy";
import {
  upsertFulfillmentAnomalyInTx,
  resolveFulfillmentAnomaliesInTx,
} from "./anomaly-engine";
import {
  buildUnitCode,
  loadItemViewInTx,
} from "./item-views";

function getNonReplacementUnitStatus(reason: ItemUnitIssueReason): "inactive" | "consumed" {
  if (reason === "quota_exhausted" || reason === "normal_exhaustion") {
    return "consumed";
  }
  return "inactive";
}

function shouldReplaceWarrantyUnit(item: typeof items.$inferSelect, reason: ItemUnitIssueReason, timestamp: Date) {
  const withinWarranty = item.warrantyExpiresAt ? item.warrantyExpiresAt.getTime() >= timestamp.getTime() : false;
  if (!withinWarranty) {
    return false;
  }
  return reason === "invalidated" || reason === "expired";
}

function getWarrantyRejectionCode(item: typeof items.$inferSelect, reason: ItemUnitIssueReason, timestamp: Date) {
  const withinWarranty = item.warrantyExpiresAt ? item.warrantyExpiresAt.getTime() >= timestamp.getTime() : false;
  if (!withinWarranty) {
    return "warranty_expired" as ItemIssueRejectionCode;
  }
  if (reason === "quota_exhausted") {
    return "quota_exhausted_not_replaceable" as ItemIssueRejectionCode;
  }
  if (reason === "normal_exhaustion") {
    return "normal_exhaustion_not_replaceable" as ItemIssueRejectionCode;
  }
  if (!["invalidated", "expired"].includes(reason)) {
    return "reason_not_covered" as ItemIssueRejectionCode;
  }
  return null;
}

function getManualReviewRoutingDecision(
  item: typeof items.$inferSelect,
  reason: ItemUnitIssueReason,
): {
  routingCode: ItemManualReviewRoutingCode;
  routingSummary: string;
  suggestedAction: ItemManualReviewSuggestedAction;
} | null {
  if (!isIssueReportingEnabled(item.fulfillmentMode)) return null;
  if (["quota_exhausted", "normal_exhaustion"].includes(reason)) {
    return {
      routingCode: "usage_audit_required",
      routingSummary:
        item.fulfillmentMode === "maintained_pool"
          ? "该服务型资产被上报为使用耗尽，建议先核对资源池配额、使用记录和池内补位策略，再决定是否人工补位。"
          : "该质保资产被上报为使用耗尽，当前不属于自动补号范围，建议先核对使用记录后再决定是否例外补号。",
      suggestedAction: "audit_usage",
    };
  }
  if (!["invalidated", "expired"].includes(reason)) return null;
  if (item.replacementCount < 3) return null;

  return {
    routingCode: "high_replacement_frequency",
    routingSummary:
      item.fulfillmentMode === "maintained_pool"
        ? "同一服务型资产已连续多次触发替换，建议先检查资源池健康与来源稳定性，再决定是否继续补位。"
        : "同一质保资产已多次触发补号，建议人工确认失效模式后再决定是否继续补号。",
    suggestedAction:
      item.fulfillmentMode === "maintained_pool" ? "inspect_pool_health" : "approve_replacement",
  };
}

export async function reportItemUnitIssue(
  userId: string,
  itemId: string,
  unitId: string,
  reason: ItemUnitIssueReason,
): Promise<ItemView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from items where id = ${itemId} for update`);
    await tx.execute(sql`select id from item_units where id = ${unitId} for update`);

    const [item] = await tx.select().from(items).where(eq(items.id, itemId));
    if (!item || item.userId !== userId) {
      throw new NotFoundError("资产不存在或不属于当前用户");
    }
    if (item.status !== "active") {
      throw new ConflictError("当前资产不处于可履约处理状态");
    }
    if (!isIssueReportingEnabled(item.fulfillmentMode)) {
      throw new BadRequestError("当前资产不支持问题上报");
    }

    const [unit] = await tx
      .select()
      .from(itemUnits)
      .where(and(eq(itemUnits.id, unitId), eq(itemUnits.itemId, itemId)));
    if (!unit) {
      throw new NotFoundError("单元不存在");
    }
    if (unit.status !== "active") {
      throw new ConflictError("该单元当前不可重复上报");
    }

    const timestamp = now();
    const manualReviewDecision = getManualReviewRoutingDecision(item, reason);
    const manualReviewRequired = manualReviewDecision !== null;
    const replacementTriggered =
      manualReviewRequired
        ? false
        : item.fulfillmentMode === "maintained_pool"
        ? true
        : item.fulfillmentMode === "warranty_delivery"
          ? shouldReplaceWarrantyUnit(item, reason, timestamp)
          : false;
    const rejectionCode =
      manualReviewRequired
        ? ("manual_review_required" as ItemIssueRejectionCode)
        : item.fulfillmentMode === "warranty_delivery" && !replacementTriggered
        ? getWarrantyRejectionCode(item, reason, timestamp)
        : null;

    const fallbackStatus = getNonReplacementUnitStatus(reason);
    let nextActiveUnits = item.activeUnits;
    let nextReplacementCount = item.replacementCount;
    let replacementUnit: typeof itemUnits.$inferSelect | null = null;

    if (replacementTriggered) {
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
      replacementUnit = createdReplacement;
      nextReplacementCount += 1;

      await tx
        .update(itemUnits)
        .set({
          status: "replaced",
          issueReason: reason,
          replacedByUnitId: replacementUnit.id,
          updatedAt: timestamp,
        })
        .where(eq(itemUnits.id, unit.id));

      await tx.insert(itemReplacementLogs).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        previousUnitId: unit.id,
        replacementUnitId: replacementUnit.id,
        reason,
        trigger: "issue_report",
        createdAt: timestamp,
      });
    } else {
      nextActiveUnits = item.activeUnits !== null ? Math.max(0, item.activeUnits - 1) : item.activeUnits;

      await tx
        .update(itemUnits)
        .set({
          status: fallbackStatus,
          issueReason: reason,
          updatedAt: timestamp,
        })
        .where(eq(itemUnits.id, unit.id));
    }

    const [createdIssueReport] = await tx.insert(itemIssueReports).values({
      id: crypto.randomUUID(),
      itemId: item.id,
      unitId: unit.id,
      reporterUserId: userId,
      reason,
      outcome: manualReviewRequired ? "manual_review" : replacementTriggered ? "replaced" : "rejected",
      rejectionCode,
      replacementUnitId: replacementUnit?.id ?? null,
      createdAt: timestamp,
    }).returning();

    if (manualReviewRequired) {
      const [createdReview] = await tx.insert(itemManualReviews).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        unitId: unit.id,
        reportId: createdIssueReport.id,
        slotNumber: unit.slotNumber,
        status: "open",
        reason,
        routingCode: manualReviewDecision!.routingCode,
        routingSummary: manualReviewDecision!.routingSummary,
        suggestedAction: manualReviewDecision!.suggestedAction,
        resolutionAction: null,
        resolutionNote: null,
        reviewerUserId: null,
        createdAt: timestamp,
        resolvedAt: null,
      }).returning();
      const reviewAgeHours = getManualReviewAgeHours(createdReview.createdAt, timestamp);
      const reviewPriority = getManualReviewPriority({
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        ageHours: reviewAgeHours,
      });
      const reviewSlaPolicy = getManualReviewSlaPolicy({
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        priority: reviewPriority,
      });
      const routedAnomalyRuleState = getManualReviewSlaAnomalyRuleState({
        ageHours: reviewAgeHours,
        anomalyKind: "manual_review_routed",
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        priority: reviewPriority,
        slaPolicy: reviewSlaPolicy,
        referenceTime: timestamp,
      });

      await upsertFulfillmentAnomalyInTx({
        tx,
        itemId: item.id,
        reportId: createdIssueReport.id,
        reviewId: createdReview.id,
        kind: "manual_review_routed",
        routingCode: createdReview.routingCode as ItemManualReviewRoutingCode,
        policyKeyOverride: routedAnomalyRuleState.anomalyPolicyKey,
        severityOverride: routedAnomalyRuleState.severity,
        escalationStrategyOverride: routedAnomalyRuleState.anomalyEscalationStrategy,
        alertLevelOverride: routedAnomalyRuleState.alertLevel,
        nextAlertEligibleAtOverride: routedAnomalyRuleState.nextAlertEligibleAt,
        nextEscalationAtOverride: routedAnomalyRuleState.nextEscalationAt,
        autoActionOverride: routedAnomalyRuleState.anomalyAutoAction,
        autoActionTemplateKeyOverride: routedAnomalyRuleState.autoActionTemplateKey,
        summary: `Manual review routed via ${createdReview.routingCode}.`,
        detail: `${createdReview.routingSummary}${routedAnomalyRuleState.matchedStageKey ? ` Applied SLA anomaly stage ${routedAnomalyRuleState.matchedStageKey}.` : ""}`,
      });
    }

    const nextItemStatus = !replacementTriggered && nextActiveUnits !== null && nextActiveUnits <= 0 ? "consumed" : item.status;

    await tx
      .update(items)
      .set({
        activeUnits: nextActiveUnits,
        replacementCount: nextReplacementCount,
        status: nextItemStatus,
        lastReconciledAt: timestamp,
      })
      .where(eq(items.id, item.id));

    await enqueueOutboxEvent(
      "item.issueReported",
      {
        userId,
        itemId: item.id,
        unitId: unit.id,
        reason,
        routingCode: manualReviewDecision?.routingCode ?? null,
        suggestedAction: manualReviewDecision?.suggestedAction ?? null,
        replacementTriggered,
        manualReviewRequired,
        rejectionCode,
      },
      tx,
    );

    if (replacementUnit) {
      await enqueueOutboxEvent(
        "item.replaced",
        {
          userId,
          itemId: item.id,
          oldUnitId: unit.id,
          newUnitId: replacementUnit.id,
          reason,
        },
        tx,
      );
    }

    if (manualReviewRequired) {
      await enqueueOutboxEvent(
        "item.manualReviewRequested",
        {
          userId,
          itemId: item.id,
          unitId: unit.id,
          reason,
          routingCode: manualReviewDecision?.routingCode ?? null,
          routingSummary: manualReviewDecision?.routingSummary ?? null,
          suggestedAction: manualReviewDecision?.suggestedAction ?? null,
        },
        tx,
      );
    }

    return loadItemViewInTx(tx, item.id);
  });
}

type ReconcileItemOptions = {
  expectedUserId?: string;
  trigger: ItemFulfillmentRunTrigger;
};

async function reconcileItemFulfillmentInTx(
  tx: DbTx,
  itemId: string,
  options: ReconcileItemOptions,
): Promise<{ item: ItemView; replacementsCreated: number; userId: string }> {
  await tx.execute(sql`select id from items where id = ${itemId} for update`);

  const [item] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!item || (options.expectedUserId && item.userId !== options.expectedUserId)) {
    throw new NotFoundError("资产不存在或不属于当前用户");
  }
  if (!isIssueReportingEnabled(item.fulfillmentMode)) {
    throw new BadRequestError("当前资产不支持履约对账");
  }

  const timestamp = now();
  const unitsForItem = await tx
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.itemId, item.id))
    .orderBy(itemUnits.slotNumber, itemUnits.generation, itemUnits.createdAt);
  const openManualReviews = await tx
    .select()
    .from(itemManualReviews)
    .where(and(eq(itemManualReviews.itemId, item.id), eq(itemManualReviews.status, "open")));

  let replacementsCreated = 0;
  let nextReplacementCount = item.replacementCount;
  let nextActiveUnits = unitsForItem.filter((unit) => unit.status === "active").length;

  if (item.fulfillmentMode === "maintained_pool" && item.totalUnits) {
    const blockedSlots = new Set(openManualReviews.map((review) => review.slotNumber));
    const activeSlotSet = new Set(unitsForItem.filter((unit) => unit.status === "active").map((unit) => unit.slotNumber));
    const unitsBySlot = new Map<number, typeof itemUnits.$inferSelect[]>();

    for (const unit of unitsForItem) {
      const existing = unitsBySlot.get(unit.slotNumber) ?? [];
      existing.push(unit);
      unitsBySlot.set(unit.slotNumber, existing);
    }

    for (let slotNumber = 1; slotNumber <= item.totalUnits; slotNumber += 1) {
      if (activeSlotSet.has(slotNumber)) {
        continue;
      }
      if (blockedSlots.has(slotNumber)) {
        continue;
      }

      const slotUnits = unitsBySlot.get(slotNumber) ?? [];
      const previousUnit = slotUnits.length > 0 ? slotUnits[slotUnits.length - 1] : null;
      const nextGeneration = previousUnit ? previousUnit.generation + 1 : 1;

      const [replacementUnit] = await tx
        .insert(itemUnits)
        .values({
          id: crypto.randomUUID(),
          itemId: item.id,
          slotNumber,
          generation: nextGeneration,
          code: buildUnitCode(slotNumber, nextGeneration),
          status: "active",
          issueReason: null,
          activatedAt: timestamp,
          expiresAt: item.warrantyExpiresAt,
          replacedByUnitId: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning();

      await tx.insert(itemReplacementLogs).values({
        id: crypto.randomUUID(),
        itemId: item.id,
        previousUnitId: previousUnit?.id ?? null,
        replacementUnitId: replacementUnit.id,
        reason: null,
        trigger: options.trigger === "manual" ? "manual_reconcile" : "scheduled_reconcile",
        createdAt: timestamp,
      });

      await enqueueOutboxEvent(
        "item.replaced",
        {
          userId: item.userId,
          itemId: item.id,
          oldUnitId: previousUnit?.id ?? null,
          newUnitId: replacementUnit.id,
          reason: null,
        },
        tx,
      );

      replacementsCreated += 1;
      nextReplacementCount += 1;
    }

    nextActiveUnits = activeSlotSet.size + replacementsCreated;
  }

  if (item.fulfillmentMode === "warranty_delivery") {
    nextActiveUnits = unitsForItem.filter((unit) => unit.status === "active").length;
  }

  const nextStatus = nextActiveUnits <= 0 ? "consumed" : "active";
  const runStatus: ItemFulfillmentRunStatus = replacementsCreated > 0 ? "completed" : "noop";
  const runNote =
    item.fulfillmentMode === "maintained_pool"
      ? replacementsCreated > 0
        ? "Active slot gaps were replenished."
        : "No slot gap detected."
      : nextStatus === "consumed"
        ? "No active warranty units remain."
        : "Warranty delivery state recomputed.";

  await tx
    .update(items)
    .set({
      activeUnits: nextActiveUnits,
      replacementCount: nextReplacementCount,
      status: nextStatus,
      lastReconciledAt: timestamp,
    })
    .where(eq(items.id, item.id));

  await tx.insert(itemFulfillmentRuns).values({
    id: crypto.randomUUID(),
    itemId: item.id,
    trigger: options.trigger,
    status: runStatus,
    scannedUnits: unitsForItem.length,
    replacementsCreated,
    note: runNote,
    createdAt: timestamp,
  });

  await enqueueOutboxEvent(
    "item.reconciled",
    {
      userId: item.userId,
      itemId: item.id,
      replacementsCreated,
      trigger: options.trigger,
    },
    tx,
  );

  await resolveFulfillmentAnomaliesInTx({
    tx,
    itemId: item.id,
    kind: "reconcile_failure",
    resolutionNote: "Reconcile completed successfully after anomaly detection.",
  });

  return {
    item: await loadItemViewInTx(tx, item.id),
    replacementsCreated,
    userId: item.userId,
  };
}

export async function reconcileItemFulfillment(userId: string, itemId: string): Promise<ItemView> {
  const result = await db.transaction((tx) =>
    reconcileItemFulfillmentInTx(tx, itemId, {
      expectedUserId: userId,
      trigger: "manual",
    }),
  );

  return result.item;
}

export async function reconcileDueItems(limit = 20) {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const dueRows = await db.execute(sql`
    select id
    from items
    where status = 'active'
      and (
        (
          fulfillment_mode = 'maintained_pool'
          and (last_reconciled_at is null or last_reconciled_at <= now() - interval '6 hours')
        )
        or (
          fulfillment_mode = 'warranty_delivery'
          and (last_reconciled_at is null or last_reconciled_at <= now() - interval '24 hours')
        )
      )
    order by coalesce(last_reconciled_at, created_at) asc
    limit ${boundedLimit}
  `);

  const results: Array<{ itemId: string; userId: string; replacementsCreated: number }> = [];
  const failures: Array<{ itemId: string; message: string }> = [];

  for (const row of dueRows.rows as Array<{ id: string }>) {
    try {
      const reconciled = await db.transaction((tx) =>
        reconcileItemFulfillmentInTx(tx, row.id, {
          trigger: "scheduled",
        }),
      );

      results.push({
        itemId: reconciled.item.id,
        userId: reconciled.userId,
        replacementsCreated: reconciled.replacementsCreated,
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unknown reconcile failure";
      await db.transaction(async (tx) => {
        await upsertFulfillmentAnomalyInTx({
          tx,
          itemId: row.id,
          kind: "reconcile_failure",
          summary: "Scheduled reconcile failed and requires operator follow-up.",
          detail: message,
        });
      });
      failures.push({
        itemId: row.id,
        message,
      });
    }
  }

  return {
    processedCount: results.length,
    failedCount: failures.length,
    results,
    failures,
  };
}
