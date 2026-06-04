import type { InternalUserContext } from "@neuro/contracts";

import {
  getFeatureSnapshot,
  getOperatorOpinionTopicCollection,
  listOpinionMonthlySettlementRunsInternal,
} from "@/lib/core-client";

export type IssueOpsQuery = {
  page?: number;
  reviewStatus?: string;
  topicStatus?: string;
  sort?: string;
  settlementMonth?: string;
  settlementSlice?: "all" | "excluded" | "promoted" | "baseline";
  topicId?: string;
  status?: "success" | "error";
  message?: string;
};

export type IssueOpsServerResult = {
  features: Awaited<ReturnType<typeof getFeatureSnapshot>>;
  topicCollection: Awaited<ReturnType<typeof getOperatorOpinionTopicCollection>>;
  settlementRuns: Awaited<ReturnType<typeof listOpinionMonthlySettlementRunsInternal>>;
};

export type IssueOpsShellProps = {
  data: IssueOpsServerResult;
  query?: IssueOpsQuery;
  context: InternalUserContext;
};
