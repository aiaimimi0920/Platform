import {
  type CreateOpinionTopicCommentInput,
  type CreateOpinionTopicInput,
  type InternalUserContext,
  type OpinionHubSettingsView,
  type OpinionMonthlySettlementRunDetailView,
  type OpinionMonthlySettlementRunView,
  type OpinionMonthlySettlementResultView,
  type OpinionTopicDetailView,
  type OpinionTopicListView,
  type OpinionTopicOpposeSummaryView,
  type OpinionTopicReviewStatus,
  type OpinionTopicSortMode,
  type OpinionTopicTag,
  type OpinionTopicView,
  type OpinionTopicSupportSummaryView,
  type OpposeOpinionTopicInput,
  type UpdateOpinionMonthlySettlementItemInput,
  type UpdateOpinionHubSettingsInput,
  type ModerateOpinionTopicInput,
} from "@neuro/contracts";

import { coreRequest } from "./request";

function normalizeOpinionTopicView(raw: OpinionTopicView): OpinionTopicView {
  return {
    ...raw,
    tags: Array.isArray((raw as Partial<OpinionTopicView>).tags)
      ? (((raw as Partial<OpinionTopicView>).tags ?? []) as OpinionTopicTag[])
      : [],
  };
}

function normalizeOpinionTopicListView(raw: Partial<OpinionTopicListView> | null | undefined): OpinionTopicListView {
  const topics = Array.isArray(raw?.topics) ? raw.topics.map((topic) => normalizeOpinionTopicView(topic)) : [];
  const pageSize =
    typeof raw?.pageSize === "number" && Number.isFinite(raw.pageSize) && raw.pageSize > 0
      ? Math.floor(raw.pageSize)
      : 10;
  const totalCount =
    typeof raw?.totalCount === "number" && Number.isFinite(raw.totalCount) && raw.totalCount >= 0
      ? Math.floor(raw.totalCount)
      : topics.length;
  const totalPages =
    typeof raw?.totalPages === "number" && Number.isFinite(raw.totalPages) && raw.totalPages > 0
      ? Math.floor(raw.totalPages)
      : Math.max(1, Math.ceil(Math.max(1, totalCount) / Math.max(1, pageSize)));
  const page =
    typeof raw?.page === "number" && Number.isFinite(raw.page) && raw.page > 0
      ? Math.floor(raw.page)
      : 1;

  return {
    monthlyLeaders: Array.isArray(raw?.monthlyLeaders) ? raw.monthlyLeaders : [],
    page,
    pageSize,
    sort:
      raw?.sort === "supportRate" || raw?.sort === "createdAt" || raw?.sort === "governance"
        ? raw.sort
        : "supportRate",
    topics,
    totalCount,
    totalPages,
  };
}

function normalizeOpinionTopicDetailView(raw: Partial<OpinionTopicDetailView> | null | undefined): OpinionTopicDetailView | null {
  if (!raw?.topic) {
    return null;
  }

  return {
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    topic: normalizeOpinionTopicView(raw.topic),
  };
}

export async function getOpinionTopicCollection(
  userContext: InternalUserContext,
  options?: {
    page?: number;
    pageSize?: number;
    sort?: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicView["status"] | "all";
  },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.topicTag && options.topicTag !== "all") params.set("topicTag", options.topicTag);
  if (options?.topicStatus) params.set("topicStatus", options.topicStatus);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await coreRequest<Partial<OpinionTopicListView>>(`/v1/opinions/topics${suffix}`, {
    userContext,
  });
  return normalizeOpinionTopicListView(response);
}

export async function listOpinionTopics(userContext: InternalUserContext) {
  const response = await getOpinionTopicCollection(userContext, {
    page: 1,
    pageSize: 50,
    sort: "governance",
  });
  return response.topics;
}

export async function getOpinionTopicDetail(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ detail?: Partial<OpinionTopicDetailView> } | Partial<OpinionTopicDetailView>>(
    `/v1/opinions/topics/${encodeURIComponent(topicId)}`,
    {
      userContext,
    },
  );
  const normalizedSource: Partial<OpinionTopicDetailView> | null =
    response && typeof response === "object" && "detail" in response
      ? ((response.detail ?? null) as Partial<OpinionTopicDetailView> | null)
      : (response as Partial<OpinionTopicDetailView>);
  return normalizeOpinionTopicDetailView(normalizedSource);
}

export async function listOpinionTopicSupportSummaries(userContext: InternalUserContext) {
  const response = await coreRequest<{ supportSummaries: OpinionTopicSupportSummaryView[] }>(
    "/v1/opinions/topics/support-summary",
    {
      userContext,
    },
  );
  return response.supportSummaries;
}

export async function listOpinionTopicOpposeSummaries(userContext: InternalUserContext) {
  const response = await coreRequest<{ opposeSummaries: OpinionTopicOpposeSummaryView[] }>(
    "/v1/opinions/topics/oppose-summary",
    {
      userContext,
    },
  );
  return response.opposeSummaries;
}

export async function createOpinionTopic(userContext: InternalUserContext, input: CreateOpinionTopicInput) {
  const response = await coreRequest<{ topic: OpinionTopicView }>("/v1/opinions/topics", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.topic;
}

export async function createOpinionTopicComment(
  userContext: InternalUserContext,
  topicId: string,
  input: Omit<CreateOpinionTopicCommentInput, "topicId">,
) {
  const response = await coreRequest<{ detail: OpinionTopicDetailView }>(
    `/v1/opinions/topics/${encodeURIComponent(topicId)}/comments`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.detail;
}

export async function supportOpinionTopic(userContext: InternalUserContext, topicId: string, ticketAmount: number) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/support`, {
    method: "POST",
    body: { ticketAmount },
    userContext,
  });
  return response.topic;
}

export async function opposeOpinionTopic(userContext: InternalUserContext, topicId: string, ticketAmount: number) {
  const body: OpposeOpinionTopicInput = { topicId, ticketAmount };
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/oppose`, {
    method: "POST",
    body,
    userContext,
  });
  return response.topic;
}

export async function archiveOpinionTopic(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/archive`, {
    method: "POST",
    userContext,
  });
  return response.topic;
}

export async function adoptOpinionTopic(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(`/v1/opinions/topics/${topicId}/adopt`, {
    method: "POST",
    userContext,
  });
  return response.topic;
}

export async function getOpinionHubSettingsInternal(userContext: InternalUserContext) {
  const response = await coreRequest<{ settings: OpinionHubSettingsView }>("/v1/internal/opinions/settings", {
    userContext,
  });
  return response.settings;
}

export async function updateOpinionHubSettingsInternal(
  userContext: InternalUserContext,
  input: UpdateOpinionHubSettingsInput,
) {
  const response = await coreRequest<{ settings: OpinionHubSettingsView }>("/v1/internal/opinions/settings", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.settings;
}

export async function getOperatorOpinionTopicCollection(
  userContext: InternalUserContext,
  options?: {
    page?: number;
    pageSize?: number;
    sort?: OpinionTopicSortMode;
    topicTag?: OpinionTopicTag | "all";
    topicStatus?: OpinionTopicView["status"] | "all";
    reviewStatus?: OpinionTopicReviewStatus | "all";
  },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.sort) params.set("sort", options.sort);
  if (options?.topicTag && options.topicTag !== "all") params.set("topicTag", options.topicTag);
  if (options?.topicStatus) params.set("topicStatus", options.topicStatus);
  if (options?.reviewStatus) params.set("reviewStatus", options.reviewStatus);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await coreRequest<Partial<OpinionTopicListView>>(`/v1/internal/opinions/topics${suffix}`, {
    userContext,
  });
  return normalizeOpinionTopicListView(response);
}

export async function getOperatorOpinionTopicDetail(userContext: InternalUserContext, topicId: string) {
  const response = await coreRequest<{ detail?: Partial<OpinionTopicDetailView> } | Partial<OpinionTopicDetailView>>(
    `/v1/internal/opinions/topics/${encodeURIComponent(topicId)}`,
    {
      userContext,
    },
  );
  const normalizedSource: Partial<OpinionTopicDetailView> | null =
    response && typeof response === "object" && "detail" in response
      ? ((response.detail ?? null) as Partial<OpinionTopicDetailView> | null)
      : (response as Partial<OpinionTopicDetailView>);
  return normalizeOpinionTopicDetailView(normalizedSource);
}

export async function moderateOpinionTopicInternal(
  userContext: InternalUserContext,
  topicId: string,
  input: ModerateOpinionTopicInput,
) {
  const response = await coreRequest<{ topic: OpinionTopicView }>(
    `/v1/internal/opinions/topics/${encodeURIComponent(topicId)}/moderate`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.topic;
}

export async function runOpinionMonthlyLeaderSettlementInternal(
  userContext: InternalUserContext,
  limit = 10,
) {
  const response = await coreRequest<{ result: OpinionMonthlySettlementResultView }>(
    "/v1/internal/opinions/monthly-leaders/run",
    {
      method: "POST",
      body: { limit },
      userContext,
    },
  );
  return response.result;
}

export async function listOpinionMonthlySettlementRunsInternal(
  userContext: InternalUserContext,
  limit = 12,
) {
  const response = await coreRequest<{ runs: OpinionMonthlySettlementRunView[] }>(
    `/v1/internal/opinions/monthly-leaders/runs?limit=${encodeURIComponent(String(limit))}`,
    {
      userContext,
    },
  );
  return response.runs;
}

export async function getOpinionMonthlySettlementRunDetailInternal(
  userContext: InternalUserContext,
  monthKey: string,
) {
  const response = await coreRequest<{ detail: OpinionMonthlySettlementRunDetailView }>(
    `/v1/internal/opinions/monthly-leaders/${encodeURIComponent(monthKey)}`,
    {
      userContext,
    },
  );
  return response.detail;
}

export async function updateOpinionMonthlySettlementItemDecisionInternal(
  userContext: InternalUserContext,
  monthKey: string,
  itemId: string,
  input: UpdateOpinionMonthlySettlementItemInput,
) {
  const response = await coreRequest<{ detail: OpinionMonthlySettlementRunDetailView }>(
    `/v1/internal/opinions/monthly-leaders/${encodeURIComponent(monthKey)}/items/${encodeURIComponent(itemId)}/decision`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.detail;
}
