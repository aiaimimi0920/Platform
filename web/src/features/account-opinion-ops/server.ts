import type { InternalUserContext } from "@neuro/contracts";

import {
  getFeatureSnapshot,
  getOperatorOpinionTopicCollection,
  listOpinionMonthlySettlementRunsInternal,
} from "@/lib/core-client";

import type { IssueOpsQuery, IssueOpsServerResult } from "./types";

export async function loadIssueOpsServerResult(
  userContext: InternalUserContext,
  query?: Partial<IssueOpsQuery>,
): Promise<IssueOpsServerResult> {
  const reviewStatus =
    query?.reviewStatus === "published" ||
    query?.reviewStatus === "pending_review" ||
    query?.reviewStatus === "rejected" ||
    query?.reviewStatus === "banned" ||
    query?.reviewStatus === "deleted" ||
    query?.reviewStatus === "all"
      ? query.reviewStatus
      : "pending_review";
  const topicStatus =
    query?.topicStatus === "collecting" ||
    query?.topicStatus === "qualified" ||
    query?.topicStatus === "archived" ||
    query?.topicStatus === "all"
      ? query.topicStatus
      : "all";
  const features = await getFeatureSnapshot();
  const topicCollection = await getOperatorOpinionTopicCollection(userContext, {
    page: query?.page && query.page > 0 ? query.page : 1,
    pageSize: 10,
    sort: query?.sort === "createdAt" || query?.sort === "governance" ? query.sort : "supportRate",
    reviewStatus,
    topicStatus,
  });
  const settlementRuns = await listOpinionMonthlySettlementRunsInternal(userContext, 12).catch(() => []);
  return {
    features,
    topicCollection,
    settlementRuns,
  };
}
