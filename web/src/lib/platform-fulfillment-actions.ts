"use server";

import { redirect } from "next/navigation";

import {
  assignBalancedItemManualReview,
  assignItemManualReview,
  claimItemManualReview,
  claimNextItemManualReview,
  claimNextItemManualReviewWithTemplate,
  escalateFulfillmentAnomalies,
  reconcileItem,
  rebalanceItemManualReviews,
  releaseItemManualReview,
  releaseStaleItemManualReviews,
  reportItemUnitIssue,
  resolveItemManualReview,
  triggerManualReviewAutoAssignSla,
  triggerManualReviewAutoRebalance,
} from "@/lib/platform-client";
import { requirePlatformOperatorUserContext, requirePlatformUserContext } from "@/lib/platform-session";
import { toMessage } from "@/lib/platform-action-utils";

function buildFulfillmentOpsRedirect(args: {
  status: "success" | "error";
  message: string;
  routingCode?: string | null;
  suggestedAction?: string | null;
  reviewStatus?: string | null;
  reviewReason?: string | null;
  reviewPriority?: string | null;
  reviewSlaBucket?: string | null;
  rejectionCategory?: string | null;
  appealable?: string | null;
  assignee?: string | null;
  claimedAt?: string | null;
  runTrigger?: string | null;
  runStatus?: string | null;
  runWindow?: string | null;
}) {
  const params = new URLSearchParams({
    status: args.status,
    message: args.message,
  });
  if (args.routingCode) params.set("routingCode", args.routingCode);
  if (args.suggestedAction) params.set("suggestedAction", args.suggestedAction);
  if (args.reviewStatus) params.set("reviewStatus", args.reviewStatus);
  if (args.reviewReason) params.set("reviewReason", args.reviewReason);
  if (args.reviewPriority) params.set("reviewPriority", args.reviewPriority);
  if (args.reviewSlaBucket) params.set("reviewSlaBucket", args.reviewSlaBucket);
  if (args.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args.appealable) params.set("appealable", args.appealable);
  if (args.assignee) params.set("assignee", args.assignee);
  if (args.claimedAt) params.set("claimedAt", args.claimedAt);
  if (args.runTrigger) params.set("runTrigger", args.runTrigger);
  if (args.runStatus) params.set("runStatus", args.runStatus);
  if (args.runWindow) params.set("runWindow", args.runWindow);
  return `/ops/fulfillment?${params.toString()}`;
}

function readFulfillmentOpsFollowUp(formData: FormData) {
  return {
    routingCode: String(formData.get("followUpRoutingCode") || "").trim() || null,
    suggestedAction: String(formData.get("followUpSuggestedAction") || "").trim() || null,
    reviewStatus: String(formData.get("followUpReviewStatus") || "").trim() || null,
    reviewReason: String(formData.get("followUpReviewReason") || "").trim() || null,
    reviewPriority: String(formData.get("followUpReviewPriority") || "").trim() || null,
    reviewSlaBucket: String(formData.get("followUpReviewSlaBucket") || "").trim() || null,
    rejectionCategory: String(formData.get("followUpRejectionCategory") || "").trim() || null,
    appealable: String(formData.get("followUpAppealable") || "").trim() || null,
    assignee: String(formData.get("followUpAssignee") || "").trim() || null,
    claimedAt: String(formData.get("followUpClaimedAt") || "").trim() || null,
    runTrigger: String(formData.get("followUpRunTrigger") || "").trim() || null,
    runStatus: String(formData.get("followUpRunStatus") || "").trim() || null,
    runWindow: String(formData.get("followUpRunWindow") || "").trim() || null,
  };
}

export async function reportItemUnitIssueAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const itemId = String(formData.get("itemId") || "").trim();
  const unitId = String(formData.get("unitId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!itemId || !unitId || !["invalidated", "expired", "quota_exhausted", "normal_exhaustion"].includes(reason)) {
    redirect(`/products?status=error&message=${encodeURIComponent("问题上报参数无效。")}`);
  }

  try {
    await reportItemUnitIssue(
      userContext,
      itemId,
      unitId,
      reason as "invalidated" | "expired" | "quota_exhausted" | "normal_exhaustion",
    );
    redirect(`/products?status=success&message=${encodeURIComponent("单元问题已上报，系统将按履约规则处理。")}`);
  } catch (error) {
    const message = toMessage(error, "问题上报失败，请稍后重试。");
    redirect(`/products?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function reconcileItemAction(formData: FormData) {
  const userContext = await requirePlatformUserContext();
  const itemId = String(formData.get("itemId") || "").trim();
  if (!itemId) {
    redirect(`/products?status=error&message=${encodeURIComponent("对账参数无效。")}`);
  }

  try {
    await reconcileItem(userContext, itemId);
    redirect(`/products?status=success&message=${encodeURIComponent("手动对账已触发。")}`);
  } catch (error) {
    const message = toMessage(error, "手动对账失败，请稍后重试。");
    redirect(`/products?status=error&message=${encodeURIComponent(message)}`);
  }
}

export async function resolveItemManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const reviewId = String(formData.get("reviewId") || "").trim();
  const action = String(formData.get("action") || "").trim();
  const resolutionNote = String(formData.get("resolutionNote") || "").trim();
  const followUp = readFulfillmentOpsFollowUp(formData);

  if (!reviewId || !["approve_replacement", "reject_report"].includes(action)) {
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message: "人工复核参数无效。",
        ...followUp,
      }),
    );
  }

  try {
    await resolveItemManualReview(userContext, reviewId, {
      action: action as "approve_replacement" | "reject_report",
      resolutionNote: resolutionNote || undefined,
    });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: "人工复核已处理。",
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "人工复核处理失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function claimItemManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const reviewId = String(formData.get("reviewId") || "").trim();
  const followUp = readFulfillmentOpsFollowUp(formData);
  if (!reviewId) {
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message: "人工复核参数无效。",
        ...followUp,
      }),
    );
  }

  try {
    await claimItemManualReview(userContext, reviewId);
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: "人工复核已认领。",
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "人工复核认领失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function releaseItemManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const reviewId = String(formData.get("reviewId") || "").trim();
  const followUp = readFulfillmentOpsFollowUp(formData);
  if (!reviewId) {
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message: "人工复核参数无效。",
        ...followUp,
      }),
    );
  }

  try {
    await releaseItemManualReview(userContext, reviewId);
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: "人工复核已释放。",
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "人工复核释放失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function triggerManualReviewAutoRebalanceAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const strategy = String(formData.get("strategy") || "").trim() as
    | "least_loaded"
    | "priority_first"
    | "";
  const maxAssignments = Number(formData.get("maxAssignments") || 10);
  const assigneePoolRaw = String(formData.get("assigneePool") || "").trim();
  const assigneePool = assigneePoolRaw
    ? assigneePoolRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  try {
    await triggerManualReviewAutoRebalance(userContext, {
      strategy: strategy || undefined,
      maxAssignments: Number.isFinite(maxAssignments) && maxAssignments > 0 ? maxAssignments : undefined,
      assigneePool,
    });
    redirect("/ops/fulfillment?status=success&message=自动分配走完");
  } catch (error) {
    redirect(`/ops/fulfillment?status=error&message=${encodeURIComponent(toMessage(error, "自动分配失败"))}`);
  }
}

export async function triggerManualReviewAutoAssignSlaAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const maxAssignments = Number(formData.get("maxAssignments") || 10);
  const assigneePoolRaw = String(formData.get("assigneePool") || "").trim();
  const templateKey = String(formData.get("templateKey") || "").trim();
  const assigneePool = assigneePoolRaw
    ? assigneePoolRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  try {
    await triggerManualReviewAutoAssignSla(userContext, {
      maxAssignments: Number.isFinite(maxAssignments) && maxAssignments > 0 ? maxAssignments : undefined,
      assigneePool,
      templateKey: templateKey || undefined,
    });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: "SLA 自动分派已执行。",
        ...followUp,
      }),
    );
  } catch (error) {
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message: toMessage(error, "SLA 自动分派失败。"),
        ...followUp,
      }),
    );
  }
}

export async function releaseStaleItemManualReviewsAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const limitValue = String(formData.get("limit") || "").trim();
  const limit = Number(limitValue || "20");
  const followUp = readFulfillmentOpsFollowUp(formData);
  try {
    const result = await releaseStaleItemManualReviews(userContext, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
    });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `已释放 ${result.releasedCount} 条超时认领，阈值 ${result.staleHours} 小时。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "超时认领释放失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function claimNextManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const templateKey = String(formData.get("templateKey") || "").trim();
  try {
    const review = templateKey
      ? await claimNextItemManualReviewWithTemplate(userContext, { templateKey })
      : await claimNextItemManualReview(userContext);
    if (!review) {
      redirect(
        buildFulfillmentOpsRedirect({
          status: "success",
          message: "当前没有可认领的人工复核项。",
          ...followUp,
        }),
      );
    }
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `已认领下一条复核 ${review.id}（${review.assigneeUserId ?? "未知"}）。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "自动认领下一条复核失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function escalateFulfillmentAnomaliesAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const rawLimit = Number(formData.get("limit") || 200);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 200, 500));

  try {
    const response = await escalateFulfillmentAnomalies(userContext, { limit });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `异常升级扫描完成：${response.result.escalatedCount}/${response.result.scannedCount} 已升级。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "履约异常升级失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function assignBalancedManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const reviewId = String(formData.get("reviewId") || "").trim() || undefined;
  const assigneePoolRaw = String(formData.get("assigneePool") || "").trim();
  const assigneePool = assigneePoolRaw
    ? assigneePoolRaw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : undefined;
  try {
    const review = await assignBalancedItemManualReview(userContext, { reviewId, assigneePool });
    if (!review) {
      redirect(
        buildFulfillmentOpsRedirect({
          status: "success",
          message: "当前没有可均衡分派的人工复核项。",
          ...followUp,
        }),
      );
    }
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `已按负载均衡分派复核 ${review.id}（${review.assigneeUserId ?? "未知"}）。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "均衡分派人工复核失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function rebalanceManualReviewQueueAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const strategyValue = String(formData.get("strategy") || "").trim();
  const maxAssignmentsValue = Number(formData.get("maxAssignments") || 10);
  const assigneePoolRaw = String(formData.get("assigneePool") || "").trim();
  const templateKey = String(formData.get("templateKey") || "").trim();

  const strategy =
    strategyValue === "priority_first" || strategyValue === "least_loaded"
      ? (strategyValue as "priority_first" | "least_loaded")
      : undefined;
  const maxAssignments =
    Number.isFinite(maxAssignmentsValue) && maxAssignmentsValue > 0
      ? Math.min(Math.floor(maxAssignmentsValue), 200)
      : undefined;
  const assigneePool = assigneePoolRaw
    ? assigneePoolRaw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : undefined;

  try {
    const result = await rebalanceItemManualReviews(userContext, {
      strategy,
      maxAssignments,
      assigneePool,
      templateKey: templateKey || undefined,
    });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `均衡分派完成：assigned ${result.assignedCount}，skipped ${result.skippedCount}。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "队列均衡分派失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}

export async function assignManualReviewAction(formData: FormData) {
  const userContext = await requirePlatformOperatorUserContext();
  const followUp = readFulfillmentOpsFollowUp(formData);
  const reviewId = String(formData.get("reviewId") || "").trim();
  const assigneeUserId = String(formData.get("assigneeUserId") || "").trim();

  if (!reviewId || !assigneeUserId) {
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message: "派单参数无效。",
        ...followUp,
      }),
    );
  }

  try {
    const review = await assignItemManualReview(userContext, reviewId, { assigneeUserId });
    redirect(
      buildFulfillmentOpsRedirect({
        status: "success",
        message: `已将复核 ${review.id} 派单给 ${review.assigneeUserId ?? assigneeUserId}。`,
        ...followUp,
      }),
    );
  } catch (error) {
    const message = toMessage(error, "派单失败，请稍后重试。");
    redirect(
      buildFulfillmentOpsRedirect({
        status: "error",
        message,
        ...followUp,
      }),
    );
  }
}
