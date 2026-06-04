import type { OpinionTopicTag } from "@neuro/contracts";

export type OpinionCenterSort = "supportRate" | "createdAt";
export type OpinionCenterLeaderFilter = "all" | "selected" | "standby";
export type OpinionCenterTopicFilter = "all" | "supported" | "opposed";
export type OpinionCenterTagFilter = OpinionTopicTag | "all";

export interface OpinionCenterRouteArgs {
  composer?: "create" | null;
  discussionComposer?: "open" | null;
  leaderFilter?: OpinionCenterLeaderFilter;
  page?: number;
  replyToCommentId?: string | null;
  showReplies?: "top" | "all";
  sort?: OpinionCenterSort;
  status?: "success" | "error";
  tagFilter?: OpinionCenterTagFilter;
  topicFilter?: OpinionCenterTopicFilter;
  topicId?: string | null;
}

export type OpinionCenterQueryParams = {
  composer?: "create";
  discussionComposer?: "open";
  leaderFilter?: OpinionCenterLeaderFilter;
  page?: string;
  replyToCommentId?: string;
  showReplies?: "top" | "all";
  sort?: OpinionCenterSort;
  status?: "success" | "error";
  tagFilter?: OpinionCenterTagFilter;
  topicFilter?: OpinionCenterTopicFilter;
  topicId?: string;
  message?: string;
};

export type OpinionComposerMode = "create" | null;
export type OpinionDiscussionComposerMode = "open" | null;
