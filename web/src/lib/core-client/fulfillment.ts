import {
  type FulfillmentOpsSummaryView,
  type InternalUserContext,
  type ItemManualReviewView,
  type ItemManualReviewSummaryView,
  type ManualReviewRebalanceResult,
  type ManualReviewSlaSummaryView,
  type ManualReviewWorkloadView,
} from "@neuro/contracts";

import type {
  ItemUnitIssueReason,
  ItemView,
} from "./types";

import { coreRequest } from "./request";

type ManualReviewQueryArgs = {
  routingCode?: string;
  suggestedAction?: string;
  status?: string;
  reason?: string;
  priority?: string;
  slaBucket?: string;
  rejectionCategory?: string;
  appealable?: string;
  assignee?: string;
  claimedAt?: string;
  limit?: number;
};

export async function listItems(userContext: InternalUserContext) {
  const response = await coreRequest<{ items: ItemView[] }>("/v1/items", {
    userContext,
  });
  return response.items;
}

export async function reportItemUnitIssue(
  userContext: InternalUserContext,
  itemId: string,
  unitId: string,
  reason: ItemUnitIssueReason,
) {
  return coreRequest<{ item: ItemView }>(`/v1/items/${itemId}/units/${unitId}/report-issue`, {
    method: "POST",
    body: { reason },
    userContext,
  });
}

export async function reconcileItem(userContext: InternalUserContext, itemId: string) {
  const response = await coreRequest<{ item: ItemView }>(`/v1/items/${itemId}/reconcile`, {
    method: "POST",
    userContext,
  });
  return response.item;
}

export async function listOpenItemManualReviews(userContext: InternalUserContext, args?: ManualReviewQueryArgs) {
  const params = new URLSearchParams();
  if (args?.routingCode) params.set("routingCode", args.routingCode);
  if (args?.suggestedAction) params.set("suggestedAction", args.suggestedAction);
  if (args?.status) params.set("status", args.status);
  if (args?.reason) params.set("reason", args.reason);
  if (args?.priority) params.set("priority", args.priority);
  if (args?.slaBucket) params.set("slaBucket", args.slaBucket);
  if (args?.rejectionCategory) params.set("rejectionCategory", args.rejectionCategory);
  if (args?.appealable) params.set("appealable", args.appealable);
  if (args?.assignee) params.set("assignee", args.assignee);
  if (args?.claimedAt) params.set("claimedAt", args.claimedAt);
  if (args?.limit) params.set("limit", String(args.limit));
  const query = params.toString();
  const response = await coreRequest<{ reviews: ItemManualReviewView[] }>(
    `/v1/internal/items/manual-reviews${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.reviews;
}

export async function escalateFulfillmentAnomalies(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{
    result: {
      scannedCount: number;
      escalatedCount: number;
      unchangedCount: number;
      affectedIds: string[];
    };
  }>("/v1/internal/items/anomalies/escalate", {
    method: "POST",
    body: input ?? {},
    userContext,
  });
}

export async function getOpenItemManualReviewSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: ItemManualReviewSummaryView }>(
    "/v1/internal/items/manual-reviews/summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getManualReviewWorkload(userContext: InternalUserContext) {
  const response = await coreRequest<{ workload: ManualReviewWorkloadView }>(
    "/v1/internal/items/manual-reviews/workload",
    {
      userContext,
    },
  );
  return response.workload;
}

export async function getManualReviewSlaSummary(
  userContext: InternalUserContext,
  args?: { assignee?: string; priority?: "normal" | "high" | "urgent" },
) {
  const params = new URLSearchParams();
  if (args?.assignee) params.set("assignee", args.assignee);
  if (args?.priority) params.set("priority", args.priority);
  const query = params.toString();
  const response = await coreRequest<{ summary: ManualReviewSlaSummaryView }>(
    `/v1/internal/items/manual-reviews/sla-summary${query ? `?${query}` : ""}`,
    {
      userContext,
    },
  );
  return response.summary;
}

export async function getFulfillmentOpsSummary(userContext: InternalUserContext) {
  const response = await coreRequest<{ summary: FulfillmentOpsSummaryView }>(
    "/v1/internal/items/ops-summary",
    {
      userContext,
    },
  );
  return response.summary;
}

export async function resolveItemManualReview(
  userContext: InternalUserContext,
  reviewId: string,
  input: { action: "approve_replacement" | "reject_report"; resolutionNote?: string },
) {
  const response = await coreRequest<{ item: ItemView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/resolve`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.item;
}

export async function claimItemManualReview(userContext: InternalUserContext, reviewId: string) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/claim`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.review;
}

export async function claimNextItemManualReview(userContext: InternalUserContext) {
  return claimNextItemManualReviewWithTemplate(userContext, {});
}

export async function claimNextItemManualReviewWithTemplate(
  userContext: InternalUserContext,
  input?: { templateKey?: string | null },
) {
  const response = await coreRequest<{ review: ItemManualReviewView | null }>(
    "/v1/internal/items/manual-reviews/claim-next",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.review;
}

export async function assignBalancedItemManualReview(
  userContext: InternalUserContext,
  input?: { reviewId?: string; assigneePool?: string[] },
) {
  const response = await coreRequest<{ review: ItemManualReviewView | null }>(
    "/v1/internal/items/manual-reviews/assign-balanced",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.review;
}

export async function rebalanceItemManualReviews(
  userContext: InternalUserContext,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[];
    templateKey?: string;
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/rebalance",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function triggerManualReviewAutoRebalance(
  userContext: InternalUserContext,
  input?: {
    strategy?: "least_loaded" | "priority_first";
    maxAssignments?: number;
    assigneePool?: string[];
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/rebalance-auto",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function triggerManualReviewAutoAssignSla(
  userContext: InternalUserContext,
  input?: {
    maxAssignments?: number;
    assigneePool?: string[];
    templateKey?: string;
  },
) {
  const response = await coreRequest<{ result: ManualReviewRebalanceResult }>(
    "/v1/internal/items/manual-reviews/auto-assign-sla",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
  return response.result;
}

export async function assignItemManualReview(
  userContext: InternalUserContext,
  reviewId: string,
  input: { assigneeUserId: string },
) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/assign`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.review;
}

export async function releaseItemManualReview(userContext: InternalUserContext, reviewId: string) {
  const response = await coreRequest<{ review: ItemManualReviewView }>(
    `/v1/internal/items/manual-reviews/${encodeURIComponent(reviewId)}/release`,
    {
      method: "POST",
      userContext,
    },
  );
  return response.review;
}

export async function releaseStaleItemManualReviews(
  userContext: InternalUserContext,
  input?: { limit?: number },
) {
  return coreRequest<{ releasedCount: number; staleHours: number; reviewIds: string[] }>(
    "/v1/internal/items/manual-reviews/release-stale",
    {
      method: "POST",
      body: input ?? {},
      userContext,
    },
  );
}
