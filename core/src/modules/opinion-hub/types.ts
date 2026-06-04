import type {
  OpinionDifficultyLevel,
  OpinionHubSettingsView,
  OpinionModerationReasonCategory,
  OpinionTopicTag,
  OpinionTopicDetailView,
  OpinionTopicDiscussionStatus,
  OpinionTopicListView,
  OpinionTopicReviewStatus,
  OpinionTopicSortMode,
  OpinionTopicView,
} from "@neuro/contracts";

export const opinionDifficultyConfig: Record<
  OpinionDifficultyLevel,
  {
    creationTicketCost: number;
    targetSupportCount: number;
  }
> = {
  1: { creationTicketCost: 5, targetSupportCount: 20 },
  2: { creationTicketCost: 8, targetSupportCount: 50 },
  3: { creationTicketCost: 12, targetSupportCount: 100 },
  4: { creationTicketCost: 20, targetSupportCount: 200 },
  5: { creationTicketCost: 32, targetSupportCount: 400 },
};

export const OPINION_HUB_SETTINGS_ID = "default";
export const DEFAULT_SUPPORT_RATE_THRESHOLD = 0.7;
export const DEFAULT_COMMENT_TICKET_COST = 1;
export const OPINION_TOPIC_PAGE_SIZE = 10;
export const DEFAULT_OPINION_TOPIC_CREATION_TICKET_COST = 10;
export const DEFAULT_OPINION_TOPIC_DIFFICULTY_LEVEL: OpinionDifficultyLevel = 3;
export const DEFAULT_OPINION_TOPIC_TARGET_SUPPORT_COUNT = 100;
export const opinionTopicTagKeys = [
  "uiOptimization",
  "newFeature",
  "channelExpansion",
  "flowOptimization",
  "performance",
  "other",
] as const satisfies readonly OpinionTopicTag[];

export const opinionTopicReviewStatuses = [
  "published",
  "pending_review",
  "rejected",
  "banned",
  "deleted",
] as const satisfies readonly OpinionTopicReviewStatus[];

export const opinionTopicDiscussionStatuses = [
  "open",
  "closed",
] as const satisfies readonly OpinionTopicDiscussionStatus[];

export const opinionTopicSortModes = [
  "governance",
  "supportRate",
  "createdAt",
] as const satisfies readonly OpinionTopicSortMode[];

export const opinionModerationReasonCategories = [
  "clean",
  "pre_moderation",
  "invalid",
  "political",
  "abuse",
  "manual",
] as const satisfies readonly OpinionModerationReasonCategory[];

export type OpinionGovernanceView = OpinionTopicView;

export type OpinionTopicCollectionView = OpinionTopicListView;

export type OpinionGovernanceDetailView = OpinionTopicDetailView;

export type OpinionHubSettingsState = OpinionHubSettingsView;

export type OpinionTopicListOptions = {
  page?: number;
  pageSize?: number;
  reviewStatus?: OpinionTopicReviewStatus | "all";
  sort?: OpinionTopicSortMode;
  topicTag?: OpinionTopicTag | "all";
  topicStatus?: OpinionTopicView["status"] | "all";
};
