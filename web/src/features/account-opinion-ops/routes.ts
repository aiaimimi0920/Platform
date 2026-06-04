import { ISSUE_OPS_ROUTE_PATH } from "./constants";

export type SettlementSlice = "all" | "excluded" | "promoted" | "baseline";

export type OpsHrefArgs = {
  page?: number;
  reviewStatus?: string;
  settlementFocusItemId?: string | null;
  settlementMonth?: string | null;
  settlementSlice?: SettlementSlice;
  sort?: string;
  topicId?: string | null;
  topicStatus?: string;
};

export function buildOpsHref(args: OpsHrefArgs) {
  const params = new URLSearchParams();
  if (args.page && args.page > 1) params.set("page", String(args.page));
  if (args.reviewStatus && args.reviewStatus !== "pending_review") params.set("reviewStatus", args.reviewStatus);
  if (args.settlementFocusItemId) params.set("settlementFocusItemId", args.settlementFocusItemId);
  if (args.settlementMonth) params.set("settlementMonth", args.settlementMonth);
  if (args.settlementSlice && args.settlementSlice !== "all") params.set("settlementSlice", args.settlementSlice);
  if (args.sort && args.sort !== "supportRate") params.set("sort", args.sort);
  if (args.topicStatus && args.topicStatus !== "all") params.set("topicStatus", args.topicStatus);
  if (args.topicId) params.set("topicId", args.topicId);
  const query = params.toString();
  return query ? `${ISSUE_OPS_ROUTE_PATH}?${query}` : ISSUE_OPS_ROUTE_PATH;
}
