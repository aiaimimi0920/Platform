import type {
  FulfillmentMode,
  ItemFulfillmentRunStatus,
  ItemFulfillmentRunTrigger,
  ItemFulfillmentRunView,
  ItemIssueRejectionCode,
  ItemIssueReportOutcome,
  ItemIssueReportView,
  ItemManualReviewAction,
  ItemManualReviewAssignmentAction,
  ItemManualReviewAssignmentEventView,
  ItemManualReviewPriority,
  ItemManualReviewRoutingCode,
  ItemManualReviewStatus,
  ItemManualReviewSuggestedAction,
  ItemManualReviewView,
  ItemReplacementLogTrigger,
  ItemReplacementLogView,
  ItemUnitIssueReason,
  ItemUnitView,
  ItemView,
  OrderDiscountSource,
  OrderView,
  ProductCurrency,
} from "@neuro/contracts";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  itemFulfillmentRuns,
  itemIssueReports,
  itemManualReviews,
  itemManualReviewAssignmentEvents,
  itemReplacementLogs,
  items,
  itemUnits,
  orders,
  products,
} from "@/modules/product-order-item/schema";
import { NotFoundError } from "@/platform/errors";

import {
  getManualReviewAgeHours,
  getManualReviewClaimAgeHours,
  getManualReviewEscalationLevel,
  getManualReviewPriority,
  getManualReviewSlaBucket,
  isManualReviewClaimStale,
} from "./manual-review-policy";
import { isIssueReportingEnabled, now, type DbTx } from "./shared";

export function buildUnitCode(slotNumber: number, generation: number) {
  return `UNIT-${String(slotNumber).padStart(2, "0")}-G${generation}`;
}

export function toOrderView(
  order: typeof orders.$inferSelect,
  product: typeof products.$inferSelect,
  discountMeta?: {
    discountSource?: OrderDiscountSource;
    discountLabel?: string | null;
  },
): OrderView {
  return {
    id: order.id,
    productId: order.productId,
    productTitle: product.title,
    currency: order.currency as ProductCurrency,
    originalAmount: order.originalAmount,
    discountAmount: order.discountAmount,
    finalAmount: order.finalAmount,
    discountCode: order.discountCode,
    discountSource: discountMeta?.discountSource ?? "none",
    discountLabel: discountMeta?.discountLabel ?? null,
    status: order.status as OrderView["status"],
    rolledBackAt: order.rolledBackAt ? order.rolledBackAt.toISOString() : null,
    rolledBackByUserId: order.rolledBackByUserId,
    rollbackReason: order.rollbackReason,
    rollbackNote: order.rollbackNote,
    createdAt: order.createdAt.toISOString(),
  };
}

export function toItemUnitView(unit: typeof itemUnits.$inferSelect): ItemUnitView {
  const statusMap: Record<string, ItemUnitView["status"]> = {
    active: "active",
    inactive: "inactive",
    replaced: "replaced",
    consumed: "consumed",
  };

  return {
    id: unit.id,
    code: unit.code,
    status: statusMap[unit.status] ?? "inactive",
    issueReason: (unit.issueReason as ItemUnitIssueReason | null) ?? null,
    activatedAt: unit.activatedAt ? unit.activatedAt.toISOString() : null,
    expiresAt: unit.expiresAt ? unit.expiresAt.toISOString() : null,
    replacedByUnitId: unit.replacedByUnitId,
  };
}

export function getItemIssueRejectionSummary(rejectionCode: ItemIssueRejectionCode | null) {
  return rejectionCode === "warranty_expired"
    ? "当前质保窗口已结束，本次上报不会再自动补号。"
    : rejectionCode === "reason_not_covered"
      ? "当前问题原因不在自动补号覆盖范围内。"
      : rejectionCode === "manual_review_required"
        ? "本次上报已进入人工复核队列，等待平台操作员处理。"
        : rejectionCode === "quota_exhausted_not_replaceable"
          ? "该问题被判定为额度耗尽，不属于自动补号范围。"
          : rejectionCode === "normal_exhaustion_not_replaceable"
        ? "该问题被判定为正常耗尽，不属于自动补号范围。"
            : null;
}

export function getItemIssueRejectionCategory(
  rejectionCode: ItemIssueRejectionCode | null,
): ItemIssueReportView["rejectionCategory"] {
  if (rejectionCode === "manual_review_required") return "manual_review";
  if (rejectionCode === "warranty_expired") return "warranty_window";
  if (rejectionCode === "reason_not_covered") return "policy_restriction";
  if (
    rejectionCode === "quota_exhausted_not_replaceable" ||
    rejectionCode === "normal_exhaustion_not_replaceable"
  ) {
    return "usage_exhaustion";
  }
  return null;
}

export function getItemIssueOperatorHint(rejectionCode: ItemIssueRejectionCode | null): string | null {
  return rejectionCode === "manual_review_required"
    ? "等待平台操作员处理当前人工复核项，并确认是否需要补位、补号或拒绝上报。"
    : rejectionCode === "warranty_expired"
      ? "复核购买时间、质保窗口和异常发生时间，确认是否存在补偿或例外处理空间。"
      : rejectionCode === "reason_not_covered"
        ? "确认问题原因是否被正确分类；如分类错误，可改走人工复核或补位流程。"
        : rejectionCode === "quota_exhausted_not_replaceable"
          ? "核查额度审计记录，确认是否属于正常额度耗尽而非异常失效。"
          : rejectionCode === "normal_exhaustion_not_replaceable"
            ? "核查使用记录，确认该单元是否属于正常耗尽且不应再补位。"
            : null;
}

export function isItemIssueAppealable(rejectionCode: ItemIssueRejectionCode | null) {
  return (
    rejectionCode === "manual_review_required" ||
    rejectionCode === "warranty_expired" ||
    rejectionCode === "reason_not_covered"
  );
}

export function getResolvedManualReviewRejectionCode(args: {
  reason: ItemUnitIssueReason;
  routingCode: ItemManualReviewRoutingCode;
}) {
  if (args.routingCode === "usage_audit_required") {
    return args.reason === "quota_exhausted"
      ? ("quota_exhausted_not_replaceable" as ItemIssueRejectionCode)
      : args.reason === "normal_exhaustion"
        ? ("normal_exhaustion_not_replaceable" as ItemIssueRejectionCode)
        : ("manual_review_required" as ItemIssueRejectionCode);
  }

  return "manual_review_required" as ItemIssueRejectionCode;
}

export function toItemIssueReportView(report: typeof itemIssueReports.$inferSelect): ItemIssueReportView {
  const rejectionCode = (report.rejectionCode as ItemIssueRejectionCode | null) ?? null;
  return {
    id: report.id,
    itemId: report.itemId,
    unitId: report.unitId,
    reason: report.reason as ItemUnitIssueReason,
    outcome: report.outcome as ItemIssueReportOutcome,
    rejectionCode,
    rejectionCategory: getItemIssueRejectionCategory(rejectionCode),
    rejectionSummary: getItemIssueRejectionSummary(rejectionCode),
    operatorHint: getItemIssueOperatorHint(rejectionCode),
    appealable: isItemIssueAppealable(rejectionCode),
    replacementUnitId: report.replacementUnitId,
    createdAt: report.createdAt.toISOString(),
  };
}

export function toItemManualReviewView(
  review: typeof itemManualReviews.$inferSelect,
  report?: typeof itemIssueReports.$inferSelect | null,
  referenceTime: Date = now(),
  viewerUserId?: string | null,
  assignmentHistory: ItemManualReviewAssignmentEventView[] = [],
): ItemManualReviewView {
  const ageHours = getManualReviewAgeHours(review.createdAt, referenceTime);
  const claimAgeHours = getManualReviewClaimAgeHours(review.claimedAt, referenceTime);
  const isStaleClaim = isManualReviewClaimStale(review.claimedAt, referenceTime);
  const priority = getManualReviewPriority({
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    ageHours,
  });
  const slaBucket = getManualReviewSlaBucket({
    ageHours,
    priority,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
  });
  const escalationLevel = Math.max(
    review.escalationLevel ?? 0,
    getManualReviewEscalationLevel({
      ageHours,
      slaBucket,
      priority,
      routingCode: review.routingCode as ItemManualReviewRoutingCode,
    }),
  );
  const rejectionCode =
    (report?.rejectionCode as ItemIssueRejectionCode | null) ??
    (review.status === "rejected"
      ? getResolvedManualReviewRejectionCode({
          reason: review.reason as ItemUnitIssueReason,
          routingCode: review.routingCode as ItemManualReviewRoutingCode,
        })
      : ("manual_review_required" as ItemIssueRejectionCode));
  return {
    id: review.id,
    itemId: review.itemId,
    unitId: review.unitId,
    reportId: review.reportId,
    slotNumber: review.slotNumber,
    status: review.status as ItemManualReviewStatus,
    reason: review.reason as ItemUnitIssueReason,
    routingCode: review.routingCode as ItemManualReviewRoutingCode,
    routingSummary: review.routingSummary,
    suggestedAction: review.suggestedAction as ItemManualReviewSuggestedAction,
    rejectionCode,
    rejectionCategory: getItemIssueRejectionCategory(rejectionCode),
    rejectionSummary: getItemIssueRejectionSummary(rejectionCode),
    operatorHint: getItemIssueOperatorHint(rejectionCode),
    appealable: isItemIssueAppealable(rejectionCode),
    assigneeUserId: review.assigneeUserId,
    claimedAt: review.claimedAt ? review.claimedAt.toISOString() : null,
    claimAgeHours,
    isStaleClaim,
    lastClaimReleasedAt: review.lastClaimReleasedAt ? review.lastClaimReleasedAt.toISOString() : null,
    lastClaimReleaseReason:
      (review.lastClaimReleaseReason as "operator_release" | "stale_timeout_release" | null) ?? null,
    autoAssignmentCount: review.autoAssignmentCount,
    lastAutoAssignedAt: review.lastAutoAssignedAt ? review.lastAutoAssignedAt.toISOString() : null,
    escalationLevel,
    slaEscalatedAt: review.slaEscalatedAt ? review.slaEscalatedAt.toISOString() : null,
    priority,
    ageHours,
    slaBucket,
    slaBreached: slaBucket === "breached",
    resolutionAction: (review.resolutionAction as ItemManualReviewAction | null) ?? null,
    resolutionNote: review.resolutionNote,
    reviewerUserId: review.reviewerUserId,
    createdAt: review.createdAt.toISOString(),
    resolvedAt: review.resolvedAt ? review.resolvedAt.toISOString() : null,
    canClaim: review.status === "open" && !review.assigneeUserId && Boolean(viewerUserId),
    canRelease:
      review.status === "open" &&
      Boolean(viewerUserId) &&
      review.assigneeUserId === viewerUserId,
    assignmentHistory,
  };
}

export function toItemManualReviewAssignmentEventView(
  row: typeof itemManualReviewAssignmentEvents.$inferSelect,
): ItemManualReviewAssignmentEventView {
  return {
    id: row.id,
    reviewId: row.reviewId,
    itemId: row.itemId,
    reportId: row.reportId,
    actorUserId: row.actorUserId,
    action: row.action as ItemManualReviewAssignmentAction,
    fromAssigneeUserId: row.fromAssigneeUserId,
    toAssigneeUserId: row.toAssigneeUserId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function buildManualReviewAssignmentHistoryMap(reviewIds: string[], executor: DbTx | typeof db = db) {
  if (reviewIds.length === 0) {
    return new Map<string, ItemManualReviewAssignmentEventView[]>();
  }

  const rows = await executor
    .select()
    .from(itemManualReviewAssignmentEvents)
    .where(inArray(itemManualReviewAssignmentEvents.reviewId, reviewIds))
    .orderBy(desc(itemManualReviewAssignmentEvents.createdAt));

  const map = new Map<string, ItemManualReviewAssignmentEventView[]>();
  for (const row of rows) {
    const events = map.get(row.reviewId) ?? [];
    events.push(toItemManualReviewAssignmentEventView(row));
    map.set(row.reviewId, events);
  }
  return map;
}

export function toItemReplacementLogView(log: typeof itemReplacementLogs.$inferSelect): ItemReplacementLogView {
  return {
    id: log.id,
    itemId: log.itemId,
    previousUnitId: log.previousUnitId,
    replacementUnitId: log.replacementUnitId,
    reason: (log.reason as ItemUnitIssueReason | null) ?? null,
    trigger: log.trigger as ItemReplacementLogTrigger,
    createdAt: log.createdAt.toISOString(),
  };
}

export function toItemFulfillmentRunView(run: typeof itemFulfillmentRuns.$inferSelect): ItemFulfillmentRunView {
  return {
    id: run.id,
    itemId: run.itemId,
    trigger: run.trigger as ItemFulfillmentRunTrigger,
    status: run.status as ItemFulfillmentRunStatus,
    scannedUnits: run.scannedUnits,
    replacementsCreated: run.replacementsCreated,
    note: run.note,
    createdAt: run.createdAt.toISOString(),
  };
}

export function toItemView(
  item: typeof items.$inferSelect,
  unitsForItem: typeof itemUnits.$inferSelect[] = [],
  issueReportsForItem: typeof itemIssueReports.$inferSelect[] = [],
  manualReviewsForItem: typeof itemManualReviews.$inferSelect[] = [],
  replacementLogsForItem: typeof itemReplacementLogs.$inferSelect[] = [],
  fulfillmentRunsForItem: typeof itemFulfillmentRuns.$inferSelect[] = [],
  manualReviewAssignmentHistoryByReviewId: Map<string, ItemManualReviewAssignmentEventView[]> = new Map(),
): ItemView {
  const issueReportsById = new Map(issueReportsForItem.map((report) => [report.id, report]));
  return {
    id: item.id,
    productId: item.productId,
    productTitle: item.productTitle,
    fulfillmentMode: item.fulfillmentMode as FulfillmentMode,
    transferable: item.transferable,
    status: item.status as ItemView["status"],
    remainingUses: item.remainingUses,
    totalUnits: item.totalUnits,
    activeUnits: item.activeUnits,
    replacementCount: item.replacementCount,
    warrantyExpiresAt: item.warrantyExpiresAt ? item.warrantyExpiresAt.toISOString() : null,
    issueReportingEnabled: isIssueReportingEnabled(item.fulfillmentMode),
    units: unitsForItem.map(toItemUnitView),
    issueReports: issueReportsForItem.map(toItemIssueReportView),
    manualReviews: manualReviewsForItem.map((review) =>
      toItemManualReviewView(
        review,
        issueReportsById.get(review.reportId),
        now(),
        null,
        manualReviewAssignmentHistoryByReviewId.get(review.id) ?? [],
      ),
    ),
    replacementLogs: replacementLogsForItem.map(toItemReplacementLogView),
    fulfillmentRuns: fulfillmentRunsForItem.map(toItemFulfillmentRunView),
    lastReconciledAt: item.lastReconciledAt ? item.lastReconciledAt.toISOString() : null,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    revokedAt: item.revokedAt ? item.revokedAt.toISOString() : null,
    revokedByUserId: item.revokedByUserId,
    revocationReason: item.revocationReason,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function loadItemViewInTx(tx: DbTx, itemId: string) {
  const [item] = await tx.select().from(items).where(eq(items.id, itemId));
  if (!item) {
    throw new NotFoundError("资产不存在");
  }

  const unitsForItem = await tx
    .select()
    .from(itemUnits)
    .where(eq(itemUnits.itemId, itemId))
    .orderBy(itemUnits.slotNumber, itemUnits.generation, itemUnits.createdAt);
  const issueReportsForItem = await tx
    .select()
    .from(itemIssueReports)
    .where(eq(itemIssueReports.itemId, itemId))
    .orderBy(itemIssueReports.createdAt);
  const manualReviewsForItem = await tx
    .select()
    .from(itemManualReviews)
    .where(eq(itemManualReviews.itemId, itemId))
    .orderBy(itemManualReviews.createdAt);
  const replacementLogsForItem = await tx
    .select()
    .from(itemReplacementLogs)
    .where(eq(itemReplacementLogs.itemId, itemId))
    .orderBy(itemReplacementLogs.createdAt);
  const fulfillmentRunsForItem = await tx
    .select()
    .from(itemFulfillmentRuns)
    .where(eq(itemFulfillmentRuns.itemId, itemId))
    .orderBy(itemFulfillmentRuns.createdAt);

  return toItemView(
    item,
    unitsForItem,
    issueReportsForItem,
    manualReviewsForItem,
    replacementLogsForItem,
    fulfillmentRunsForItem,
  );
}
