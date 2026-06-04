import type { OpinionTopicTag } from "@neuro/contracts";
import type {
  OpinionCenterLeaderFilter,
  OpinionCenterSort,
  OpinionCenterTagFilter,
  OpinionCenterTopicFilter,
} from "./types";

export const OPINION_PAGE_SIZE = 10;
export const OPINION_DEFAULT_SORT: OpinionCenterSort = "supportRate";
export const OPINION_TOPIC_TAG_OPTIONS: ReadonlyArray<{ key: OpinionTopicTag; label: string }> = [
  { key: "uiOptimization", label: "UI优化" },
  { key: "newFeature", label: "新功能" },
  { key: "channelExpansion", label: "增加渠道" },
  { key: "flowOptimization", label: "流程优化" },
  { key: "performance", label: "性能稳定" },
  { key: "other", label: "其他" },
];
export const OPINION_TOPIC_TAG_LABELS = new Map<OpinionTopicTag, string>(
  OPINION_TOPIC_TAG_OPTIONS.map((item) => [item.key, item.label]),
);
export const OPINION_SORT_OPTIONS: OpinionCenterSort[] = ["supportRate", "createdAt"];
export const OPINION_TOPIC_FILTERS: OpinionCenterTopicFilter[] = ["all", "supported", "opposed"];
export const OPINION_TAG_FILTER_DEFAULT: OpinionCenterTagFilter = "all";
export const OPINION_LEADER_FILTER_DEFAULT: OpinionCenterLeaderFilter = "all";
