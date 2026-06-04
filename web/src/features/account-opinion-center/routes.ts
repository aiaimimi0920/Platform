import type { OpinionCenterRouteArgs } from "./types";

export const OPINION_BASE_ROUTE = "/opinions";

export function buildOpinionHref(args: OpinionCenterRouteArgs) {
  const params = new URLSearchParams();
  if (args.composer === "create") params.set("composer", "create");
  if (args.discussionComposer === "open") params.set("discussionComposer", "open");
  if (args.leaderFilter && args.leaderFilter !== "all") params.set("leaderFilter", args.leaderFilter);
  if (args.page && args.page > 1) params.set("page", String(args.page));
  if (args.replyToCommentId) params.set("replyToCommentId", args.replyToCommentId);
  if (args.showReplies && args.showReplies !== "all") params.set("showReplies", args.showReplies);
  if (args.sort && args.sort !== "supportRate") params.set("sort", args.sort);
  if (args.tagFilter && args.tagFilter !== "all") params.set("tagFilter", args.tagFilter);
  if (args.topicFilter && args.topicFilter !== "all") params.set("topicFilter", args.topicFilter);
  if (args.topicId) params.set("topicId", args.topicId);
  const query = params.toString();
  return query ? `${OPINION_BASE_ROUTE}?${query}` : OPINION_BASE_ROUTE;
}
