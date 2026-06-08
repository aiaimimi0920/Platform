import Link from "next/link";
import { redirect } from "next/navigation";
import type { OpinionTopicTag } from "@neuro/contracts";
import type { CSSProperties } from "react";

import { auth } from "@/auth";
import { getPublicSurfaceSnapshot } from "@/lib/core-client";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

import { OPINION_PAGE_SIZE, OPINION_TOPIC_TAG_LABELS, OPINION_TOPIC_TAG_OPTIONS } from "./constants";
import {
  createOpinionTopicAction,
  createOpinionTopicCommentAction,
  getCurrentUser,
  getFeatureSnapshot,
  getOpinionTopicCollection,
  getOpinionTopicDetail,
  getWalletSummary,
  isFeatureSnapshotUnavailable,
  listOpinionTopicOpposeSummaries,
  listOpinionTopicSupportSummaries,
  opposeOpinionTopicAction,
  supportOpinionTopicAction,
} from "./server";
import type { OpinionCenterQueryParams } from "./types";

export type OpinionsPageProps = {
  searchParams?: Promise<OpinionCenterQueryParams>;
};

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildOpinionToggleStyle(active: boolean, tone: "default" | "cool" = "default"): CSSProperties {
  if (active) {
    return {
      borderColor: "rgba(255,255,255,0.18)",
      background:
        "linear-gradient(180deg, rgba(249,250,251,0.98), rgba(233,236,240,0.96)), rgba(244,246,248,0.98)",
      color: "#101419",
      boxShadow: "0 18px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.84)",
    };
  }

  return {
    borderColor: tone === "cool" ? "rgba(78,201,255,0.28)" : "rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: tone === "cool" ? "rgba(214,245,255,0.94)" : "rgba(230,236,241,0.86)",
    boxShadow: "none",
  };
}

function buildOpinionTagDropdownStyle(active: boolean): CSSProperties {
  if (active) {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      minHeight: 46,
      padding: "0 16px",
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.18)",
      background:
        "linear-gradient(180deg, rgba(249,250,251,0.98), rgba(233,236,240,0.96)), rgba(244,246,248,0.98)",
      color: "#101419",
      boxShadow: "0 12px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.84)",
      whiteSpace: "nowrap",
      fontSize: "0.84rem",
      fontWeight: 700,
      cursor: "pointer",
      listStyle: "none",
      userSelect: "none",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: "rgba(230,236,241,0.86)",
    boxShadow: "none",
    whiteSpace: "nowrap",
    fontSize: "0.84rem",
    fontWeight: 700,
    cursor: "pointer",
    listStyle: "none",
    userSelect: "none",
  };
}

function buildOpinionTerminalActionStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 60,
    paddingInline: 28,
    borderRadius: 22,
    border: disabled ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(217,255,56,0.22)",
    background: disabled
      ? "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)), rgba(12,15,20,0.68)"
      : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(16,18,22,0.94)",
    color: disabled ? "rgba(225,231,236,0.42)" : "rgba(244,248,252,0.94)",
    boxShadow: disabled ? "none" : "0 14px 26px rgba(0,0,0,0.24)",
    fontWeight: 800,
    letterSpacing: "0.02em",
  };
}

function buildOpinionDetailMetricStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 48,
    padding: "8px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), rgba(16,19,24,0.88)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    alignContent: "center",
  };
}

function isSameShanghaiDay(value: string, reference = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(value)) === formatter.format(reference);
}

function VoteUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{ display: "block", width: 16, height: 16, overflow: "visible" }}
    >
      <path
        d="M10.5 10.2V5.9c0-1.2.7-2.3 1.8-2.8l.3-.1.4.3c.6.5.9 1.3.9 2.1v2.9h3.2c1.6 0 2.7 1.6 2.2 3.1l-1.3 4.4a2.4 2.4 0 0 1-2.3 1.7h-5.2c-.8 0-1.6-.4-2.1-1l-1.4-1.7V10.2h3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 10.2h2.6v7.2H4.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function VoteDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{ display: "block", width: 16, height: 16, overflow: "visible" }}
    >
      <path
        d="M10.5 13.8v4.3c0 1.2.7 2.3 1.8 2.8l.3.1.4-.3c.6-.5.9-1.3.9-2.1v-2.9h3.2c1.6 0 2.7-1.6 2.2-3.1l-1.3-4.4a2.4 2.4 0 0 0-2.3-1.7h-5.2c-.8 0-1.6.4-2.1 1l-1.4 1.7v4.6h3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 6.6h2.6v7.2H4.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function buildOpinionVoteButtonStyle(active: boolean): CSSProperties {
  return {
    display: "inline-grid",
    placeItems: "center",
    width: 30,
    height: 30,
    minHeight: 30,
    padding: 0,
    borderRadius: 10,
    border: active ? "1px solid rgba(217,255,56,0.28)" : "1px solid rgba(255,255,255,0.08)",
    background: active
      ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(16,18,22,0.94)"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: active ? "rgba(217,255,56,0.92)" : "rgba(232,238,242,0.88)",
    boxShadow: active ? "0 12px 20px rgba(0,0,0,0.22)" : "none",
  };
}

function buildOpinionDiscussionReplyStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "rgba(214,220,225,0.72)",
    fontSize: "0.82rem",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: "none",
  };
}

function buildOpinionHref(args: {
  composer?: "create" | null;
  discussionComposer?: "open" | null;
  leaderFilter?: "all" | "selected" | "standby";
  page?: number;
  replyToCommentId?: string | null;
  showReplies?: "top" | "all";
  sort?: "supportRate" | "createdAt";
  tagFilter?: OpinionTopicTag | "all";
  topicFilter?: "all" | "supported" | "opposed";
  topicId?: string | null;
}) {
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
  return query ? `/opinions?${query}` : "/opinions";
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function OpinionPanelIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.5 7.5h13v9h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 10.5h7M8.5 13.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 5.5h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const toneBadgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 12px",
  border: "1px solid transparent",
  borderRadius: 999,
  fontSize: "0.76rem",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "0.04em",
};

const toneBadgeStyles: Record<string, CSSProperties> = {
  success: { ...toneBadgeBase, background: "rgba(34,197,94,0.16)", borderColor: "rgba(34,197,94,0.24)", color: "#bbf7d0" },
  warning: { ...toneBadgeBase, background: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.24)", color: "#fde68a" },
  danger:  { ...toneBadgeBase, background: "rgba(244,63,94,0.16)",  borderColor: "rgba(244,63,94,0.24)",  color: "#fecdd3" },
  violet:  { ...toneBadgeBase, background: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.28)", color: "#d7c8ff" },
  cyan:    { ...toneBadgeBase, background: "rgba(6,182,212,0.16)",  borderColor: "rgba(6,182,212,0.26)",  color: "#b4f7ff" },
};

function ToneBadge({ label }: { label: string }) {
  const variant =
    label === "已采纳"
      ? "success"
      : label === "已归档" || label === "待审核"
        ? "warning"
        : label === "已驳回" || label === "已封禁" || label === "已删除"
          ? "danger"
          : "violet";
  return <span style={toneBadgeStyles[variant]}>{label}</span>;
}

function buildReviewLabel(reviewStatus: string) {
  if (reviewStatus === "pending_review") return "待审核";
  if (reviewStatus === "rejected") return "已驳回";
  if (reviewStatus === "banned") return "已封禁";
  if (reviewStatus === "deleted") return "已删除";
  return "已公开";
}

function buildDiscussionThreads<
  T extends {
    id: string;
    parentCommentId: string | null;
    createdAt: string;
  },
>(comments: T[]) {
  const repliesByParent = new Map<string, T[]>();
  const topLevel: T[] = [];

  for (const comment of comments) {
    if (!comment.parentCommentId) {
      topLevel.push(comment);
      continue;
    }

    const bucket = repliesByParent.get(comment.parentCommentId) ?? [];
    bucket.push(comment);
    repliesByParent.set(comment.parentCommentId, bucket);
  }

  topLevel.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  for (const bucket of repliesByParent.values()) {
    bucket.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }

  return topLevel.map((comment) => ({
    comment,
    replies: repliesByParent.get(comment.id) ?? [],
  }));
}

export default async function OpinionCenterPage({ searchParams }: OpinionsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const publicSurfaces = await getPublicSurfaceSnapshot();
  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "opinions", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const composerMode = params?.composer === "create";
  const discussionComposerOpen = params?.discussionComposer === "open";
  const selectedSort = params?.sort === "createdAt" ? "createdAt" : "supportRate";
  const page = Math.max(1, Number(params?.page || 1) || 1);
  const tagFilter = OPINION_TOPIC_TAG_OPTIONS.some((item) => item.key === params?.tagFilter)
    ? (params?.tagFilter as OpinionTopicTag)
    : "all";
  const leaderFilter = params?.leaderFilter === "selected" || params?.leaderFilter === "standby" ? params.leaderFilter : "all";
  const replyToCommentId = params?.replyToCommentId?.trim() || null;
  const showReplies = "all";
  const topicFilter =
    params?.topicFilter === "supported" || params?.topicFilter === "opposed" ? params.topicFilter : "all";
  const topicId = params?.topicId?.trim() || null;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;
  const userContext = {
    userId: session.user.id,
    providerUserId: session.user.providerUserId || undefined,
    username: session.user.username || undefined,
  };

  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return <main className="app-page"><div className="mg-shell"><p className="mg-copy">模块状态暂不可用，请稍后再试。</p></div></main>;
  }
  if (!features.opinionHub.enabled) {
    return <main className="app-page"><div className="mg-shell"><p className="mg-copy">议题模块已关闭。</p></div></main>;
  }

  const walletEnabled = features.wallet.enabled && features.ledger.enabled;
  const [wallet, currentUser, collection, supportSummaries, opposeSummaries] = await Promise.all([
      walletEnabled ? getWalletSummary(userContext).catch(() => null) : Promise.resolve(null),
      features.userProgression.enabled ? getCurrentUser(userContext).catch(() => null) : Promise.resolve(null),
      getOpinionTopicCollection(userContext, {
        page,
        pageSize: OPINION_PAGE_SIZE,
        sort: selectedSort,
        topicTag: tagFilter,
      }),
    listOpinionTopicSupportSummaries(userContext).catch(() => []),
    listOpinionTopicOpposeSummaries(userContext).catch(() => []),
  ]);

  const progression = currentUser?.snapshot?.progression ?? null;
  const createTopicAccess = progression?.access.find((rule) => rule.key === "createOpinionTopic") ?? null;
  const canCreateTopic = walletEnabled && (features.userProgression.enabled ? createTopicAccess?.satisfied === true : true);
  const supportedTopicSummaries = [...supportSummaries]
    .filter((item) => item.ticketAmount > 0)
    .sort((left, right) => new Date(right.lastSupportedAt).getTime() - new Date(left.lastSupportedAt).getTime());
  const supportedTopicIdSet = new Set(supportedTopicSummaries.map((item) => item.topicId));
  const supportSummaryByTopicId = new Map(supportedTopicSummaries.map((item) => [item.topicId, item]));
  const opposedTopicSummaries = [...opposeSummaries]
    .filter((item) => item.ticketAmount > 0)
    .sort((left, right) => new Date(right.lastOpposedAt).getTime() - new Date(left.lastOpposedAt).getTime());
  const opposedTopicIdSet = new Set(opposedTopicSummaries.map((item) => item.topicId));
  const opposeSummaryByTopicId = new Map(opposedTopicSummaries.map((item) => [item.topicId, item]));
  const filteredTopicSummaries =
    topicFilter === "supported"
      ? supportedTopicSummaries
      : topicFilter === "opposed"
        ? opposedTopicSummaries
        : [];
  const filteredTopicIdSet =
    topicFilter === "supported"
      ? supportedTopicIdSet
      : topicFilter === "opposed"
        ? opposedTopicIdSet
        : null;
  const supportedTopicPageById = new Map(
      supportedTopicSummaries.map((item, index) => [item.topicId, Math.floor(index / OPINION_PAGE_SIZE) + 1]),
    );
    const opposedTopicPageById = new Map(
      opposedTopicSummaries.map((item, index) => [item.topicId, Math.floor(index / OPINION_PAGE_SIZE) + 1]),
    );
  const filteredTopicCandidates =
    topicFilter !== "all" && filteredTopicSummaries.length > 0
      ? (
          await Promise.all(
            filteredTopicSummaries.map(async (summary) => {
              try {
                const response = await getOpinionTopicDetail(userContext, summary.topicId);
                return response?.topic ?? null;
              } catch {
                return null;
              }
            }),
          )
        ).filter((topic): topic is NonNullable<typeof topic> => topic !== null)
      : [];
  const tagFilteredTopicCandidates =
    topicFilter !== "all" && tagFilter !== "all"
      ? filteredTopicCandidates.filter((topic) => topic.tags.includes(tagFilter))
      : filteredTopicCandidates;
  const effectiveFilteredTopicSummaries =
    topicFilter !== "all"
      ? filteredTopicSummaries.filter((summary) =>
          tagFilter === "all" ? true : tagFilteredTopicCandidates.some((topic) => topic.id === summary.topicId),
        )
      : [];
  const requestedEffectiveFilteredTopicIndex =
    topicFilter !== "all" && topicId
      ? effectiveFilteredTopicSummaries.findIndex((item) => item.topicId === topicId)
      : -1;
  const effectiveFilteredTopicTotalCount = topicFilter !== "all" ? effectiveFilteredTopicSummaries.length : 0;
  const effectiveFilteredTopicTotalPages =
      topicFilter !== "all" ? Math.max(1, Math.ceil(Math.max(1, effectiveFilteredTopicTotalCount) / OPINION_PAGE_SIZE)) : 1;
    const effectiveTopicPageWithTag =
      topicFilter !== "all"
        ? requestedEffectiveFilteredTopicIndex >= 0
          ? Math.floor(requestedEffectiveFilteredTopicIndex / OPINION_PAGE_SIZE) + 1
          : Math.min(page, effectiveFilteredTopicTotalPages)
        : page;
    const filteredTopicPageSummaries =
      topicFilter !== "all"
        ? effectiveFilteredTopicSummaries.slice(
            (effectiveTopicPageWithTag - 1) * OPINION_PAGE_SIZE,
            effectiveTopicPageWithTag * OPINION_PAGE_SIZE,
          )
        : [];
  const filteredPageTopics =
    topicFilter !== "all"
      ? tagFilteredTopicCandidates.filter((topic) =>
          filteredTopicPageSummaries.some((summary) => summary.topicId === topic.id),
        )
      : [];
  const visibleTopics = topicFilter === "all" ? collection.topics : filteredPageTopics;
  const activeTopicId =
    topicId && (topicFilter === "all" || filteredTopicIdSet?.has(topicId))
      ? topicId
      : visibleTopics[0]?.id ?? null;
  const detail = activeTopicId ? await getOpinionTopicDetail(userContext, activeTopicId).catch(() => null) : null;
  const currentHref = buildOpinionHref({
    leaderFilter,
    page: topicFilter === "all" ? page : effectiveTopicPageWithTag,
    discussionComposer: discussionComposerOpen || replyToCommentId ? "open" : null,
    showReplies,
    sort: selectedSort,
    tagFilter,
    topicFilter,
    topicId: detail?.topic.id ?? activeTopicId,
  });
  const composerHref = buildOpinionHref({
    composer: "create",
    leaderFilter,
    page: topicFilter === "all" ? page : effectiveTopicPageWithTag,
    showReplies,
    sort: selectedSort,
    tagFilter,
    topicFilter,
    topicId: detail?.topic.id ?? activeTopicId,
  });
  const replyTarget =
    detail && replyToCommentId ? detail.comments.find((comment) => comment.id === replyToCommentId) ?? null : null;
  const discussionThreads = detail ? buildDiscussionThreads(detail.comments) : [];
  const visibleTopicTotalCount = topicFilter === "all" ? collection.totalCount : effectiveFilteredTopicTotalCount;
  const visibleTopicPage = topicFilter === "all" ? collection.page : effectiveTopicPageWithTag;
  const visibleTopicTotalPages = topicFilter === "all" ? collection.totalPages : effectiveFilteredTopicTotalPages;
  const activeTagLabel = tagFilter === "all" ? "全部标签" : (OPINION_TOPIC_TAG_LABELS.get(tagFilter) ?? "全部标签");
  const activeTopicSupport = detail ? supportSummaryByTopicId.get(detail.topic.id) ?? null : null;
  const activeTopicOppose = detail ? opposeSummaryByTopicId.get(detail.topic.id) ?? null : null;
  const activeTopicEffectiveVotes = detail ? detail.topic.supportTicketTotal - detail.topic.opposeTicketTotal : null;
  const rightPanelTitle = composerMode ? "\u63d0\u51fa\u8bae\u9898" : detail?.topic.title ?? "\u8bae\u9898\u8be6\u60c5";
  const latestActiveTopicVoteAt = [activeTopicSupport?.lastSupportedAt ?? null, activeTopicOppose?.lastOpposedAt ?? null]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
  const activeTopicVoteLockedToday = latestActiveTopicVoteAt ? isSameShanghaiDay(latestActiveTopicVoteAt) : false;
  const activeTopicVoteDirection =
    activeTopicVoteLockedToday && activeTopicSupport?.lastSupportedAt === latestActiveTopicVoteAt
      ? "support"
      : activeTopicVoteLockedToday && activeTopicOppose?.lastOpposedAt === latestActiveTopicVoteAt
        ? "oppose"
        : null;
  const showReplyComposer = discussionComposerOpen || Boolean(replyTarget);
  return (
    <main className="app-page">
      <div aria-label="议题中心" aria-modal="true" className="app-honor-overlay" role="dialog">
        <Link aria-label="返回控制台" className="app-honor-backdrop" href="/dashboard" />

        {status && message ? (
          <div aria-atomic="true" aria-live="polite" className="app-toast-stack">
            <section className={`app-toast app-toast--${status === "success" ? "success" : "error"}`} role="status">
              <div className="app-toast__signal" aria-hidden="true" />
              <div className="app-toast__body">
                <strong className="app-toast__title">{status === "success" ? "操作完成" : "操作失败"}</strong>
                <p className="app-toast__message">{message}</p>
              </div>
              <Link aria-label="关闭提示" className="app-toast__close" href={currentHref}>
                ×
              </Link>
            </section>
          </div>
        ) : null}

        <section className="app-honor">
          <aside className="app-honor__rail" style={{ gridTemplateRows: "auto auto minmax(0, 1fr)" }}>
            <div className="app-honor__rail-head">
              <div className="app-honor__rail-mark" aria-hidden="true">
                <OpinionPanelIcon />
              </div>
              <div className="app-honor__rail-copy">
                <h1>议题</h1>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", padding: "0 8px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 0,
                  padding: "12px 16px",
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background:
                    "linear-gradient(180deg, rgba(31,34,40,0.92), rgba(17,20,26,0.92)), radial-gradient(circle at 0 0, rgba(217,255,56,0.04), transparent 24%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: "rgba(255,196,72,0.1)",
                    border: "1px solid rgba(255,196,72,0.18)",
                    flex: "0 0 auto",
                  }}
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    draggable={false}
                    height="26"
                    loading="lazy"
                    src="/assets/currency/opinion-tickets.png"
                    style={{ display: "block", width: 26, height: 26, objectFit: "contain" }}
                    width="26"
                  />
                </span>
                <strong style={{ color: "rgba(248,250,252,0.96)", fontSize: "1.15rem", lineHeight: 1 }}>
                  {wallet?.balances.opinionTickets.available ?? 0}
                </strong>
              </div>

              <Link
                className="mg-btn mg-btn--glass"
                href={composerHref}
                style={{
                  ...buildOpinionToggleStyle(composerMode),
                  minHeight: 60,
                  paddingInline: 28,
                  borderRadius: 22,
                  whiteSpace: "nowrap",
                }}
              >
                提出议题
              </Link>
            </div>

            <div
              className="mg-terminal-rail-card"
              style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto", gap: 12, minHeight: 0 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <h3 className="mg-card__title">议题榜单</h3>
                </div>
                {topicFilter === "all" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Link
                      className="mg-btn mg-btn--glass"
                    href={buildOpinionHref({
                      composer: composerMode ? "create" : null,
                      leaderFilter,
                      page: 1,
                      showReplies,
                      sort: "supportRate",
                      tagFilter,
                      topicFilter,
                      topicId: activeTopicId,
                    })}
                      style={buildOpinionToggleStyle(selectedSort === "supportRate")}
                    >
                      支持率
                    </Link>
                    <Link
                      className="mg-btn mg-btn--glass"
                    href={buildOpinionHref({
                      composer: composerMode ? "create" : null,
                      leaderFilter,
                      page: 1,
                      showReplies,
                      sort: "createdAt",
                      tagFilter,
                      topicFilter,
                      topicId: activeTopicId,
                    })}
                      style={buildOpinionToggleStyle(selectedSort === "createdAt")}
                    >
                      时间
                    </Link>
                  </div>
                ) : (
                  <span style={toneBadgeStyles.cyan}>{topicFilter === "supported" ? "支持记录" : "反对记录"}</span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    minWidth: 0,
                  }}
                >
                  <Link
                    className="mg-btn mg-btn--glass"
                    href={buildOpinionHref({
                      composer: composerMode ? "create" : null,
                      leaderFilter,
                      page: 1,
                      showReplies,
                      sort: selectedSort,
                      tagFilter,
                      topicFilter: "all",
                      topicId: activeTopicId,
                    })}
                    style={buildOpinionToggleStyle(topicFilter === "all")}
                  >
                    全部
                  </Link>
                  <Link
                    className="mg-btn mg-btn--glass"
                    href={buildOpinionHref({
                      composer: composerMode ? "create" : null,
                      leaderFilter,
                      page: 1,
                      showReplies,
                      sort: selectedSort,
                      tagFilter,
                      topicFilter: "supported",
                      topicId: activeTopicId,
                    })}
                    style={buildOpinionToggleStyle(topicFilter === "supported")}
                  >
                    我支持
                  </Link>
                  <Link
                    className="mg-btn mg-btn--glass"
                    href={buildOpinionHref({
                      composer: composerMode ? "create" : null,
                      leaderFilter,
                      page: 1,
                      showReplies,
                      sort: selectedSort,
                      tagFilter,
                      topicFilter: "opposed",
                      topicId: activeTopicId,
                    })}
                    style={buildOpinionToggleStyle(topicFilter === "opposed")}
                  >
                    我反对
                  </Link>
                </div>

                <details style={{ position: "relative", flex: "0 0 auto" }}>
                  <summary style={buildOpinionTagDropdownStyle(tagFilter !== "all")}>
                    <span>{activeTagLabel}</span>
                    <span aria-hidden="true" style={{ fontSize: 12, lineHeight: 1 }}>
                      ▾
                    </span>
                  </summary>
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 10px)",
                      zIndex: 8,
                      display: "grid",
                      gap: 6,
                      minWidth: 188,
                      padding: 10,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(23,25,30,0.98), rgba(12,15,20,0.96)), radial-gradient(circle at 0 0, rgba(217,255,56,0.05), transparent 28%)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.34)",
                    }}
                  >
                    <Link
                      className="mg-btn mg-btn--glass"
                      href={buildOpinionHref({
                        composer: composerMode ? "create" : null,
                        leaderFilter,
                        page: 1,
                        showReplies,
                        sort: selectedSort,
                        tagFilter: "all",
                        topicFilter,
                        topicId: activeTopicId,
                      })}
                      style={{
                        ...buildOpinionTagDropdownStyle(tagFilter === "all"),
                        justifyContent: "space-between",
                        minHeight: 40,
                        padding: "0 14px",
                        borderRadius: 14,
                        width: "100%",
                      }}
                    >
                      全部标签
                    </Link>
                    {OPINION_TOPIC_TAG_OPTIONS.map((tag) => (
                      <Link
                        className="mg-btn mg-btn--glass"
                        href={buildOpinionHref({
                          composer: composerMode ? "create" : null,
                          leaderFilter,
                          page: 1,
                          showReplies,
                          sort: selectedSort,
                          tagFilter: tag.key,
                          topicFilter,
                          topicId: activeTopicId,
                        })}
                        key={tag.key}
                        style={{
                          ...buildOpinionTagDropdownStyle(tagFilter === tag.key),
                          justifyContent: "space-between",
                          minHeight: 40,
                          padding: "0 14px",
                          borderRadius: 14,
                          width: "100%",
                        }}
                      >
                        {tag.label}
                      </Link>
                    ))}
                  </div>
                </details>
              </div>

              <div className="mg-terminal-list" style={{ minHeight: 0, overflow: "auto", paddingRight: 6 }}>
                {visibleTopics.length === 0 ? (
                  <p className="mg-copy" style={{ margin: 0 }}>
                    {topicFilter === "supported"
                      ? "暂无已支持议题。"
                      : topicFilter === "opposed"
                        ? "暂无已反对议题。"
                        : "当前还没有议题。"}
                  </p>
                ) : (
                  visibleTopics.map((topic) => {
                    const mySupportSummary = supportSummaryByTopicId.get(topic.id);
                    const myOpposeSummary = opposeSummaryByTopicId.get(topic.id);
                    const isSupportedByCurrentUser = Boolean(mySupportSummary);
                    const isOpposedByCurrentUser = Boolean(myOpposeSummary);
                    const rowShadow = [
                      topic.id === activeTopicId ? "inset 0 0 0 1px rgba(217,255,56,0.14)" : null,
                      isSupportedByCurrentUser ? "0 0 0 1px rgba(109,214,255,0.12)" : null,
                      isOpposedByCurrentUser ? "0 0 0 1px rgba(255,138,120,0.1)" : null,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <Link
                        className="mg-terminal-list__row"
                        href={buildOpinionHref({
                          leaderFilter,
                          page: visibleTopicPage,
                          showReplies,
                          sort: selectedSort,
                          tagFilter,
                          topicFilter,
                          topicId: topic.id,
                        })}
                        key={topic.id}
                        style={{
                          borderColor: topic.id === activeTopicId
                            ? "rgba(217,255,56,0.36)"
                            : isSupportedByCurrentUser
                              ? "rgba(109,214,255,0.28)"
                              : isOpposedByCurrentUser
                                ? "rgba(255,138,120,0.24)"
                                : undefined,
                          boxShadow: rowShadow || undefined,
                        }}
                      >
                        <div className="mg-terminal-list__meta">
                          <strong className="mg-terminal-list__title">{topic.title}</strong>
                          <span className="mg-terminal-list__subtitle">{topic.summary}</span>
                          {topic.tags.length > 0 ? (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              {topic.tags.map((tag) => (
                                <span
                                  key={`${topic.id}-${tag}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    minHeight: 24,
                                    padding: "0 10px",
                                    borderRadius: 999,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    background: "rgba(255,255,255,0.05)",
                                    color: "rgba(222,228,233,0.86)",
                                    fontSize: "0.74rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  {OPINION_TOPIC_TAG_LABELS.get(tag) ?? tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {mySupportSummary ? <span style={toneBadgeStyles.violet}>{`支持 ${mySupportSummary.ticketAmount}`}</span> : null}
                            {myOpposeSummary ? <span style={toneBadgeStyles.danger}>{`反对 ${myOpposeSummary.ticketAmount}`}</span> : null}
                            {topic.reviewStatus !== "published" ? <ToneBadge label={buildReviewLabel(topic.reviewStatus)} /> : null}
                          </div>
                          <span className="mg-note">{`${formatPercent(topic.supportRate)} / ${topic.supportTicketTotal} / ${topic.opposeTicketTotal}`}</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <Link
                  className={visibleTopicPage > 1 ? "mg-btn mg-btn--glass" : "mg-btn mg-btn--glass opacity-50 pointer-events-none"}
                  href={buildOpinionHref({
                    composer: composerMode ? "create" : null,
                    leaderFilter,
                    page: Math.max(1, visibleTopicPage - 1),
                    showReplies,
                    sort: selectedSort,
                    tagFilter,
                    topicFilter,
                    topicId: activeTopicId,
                  })}
                >
                  上一页
                </Link>
                <span className="mg-note">{`第 ${visibleTopicPage}/${visibleTopicTotalPages} 页`}</span>
                <Link
                  className={visibleTopicPage < visibleTopicTotalPages ? "mg-btn mg-btn--glass" : "mg-btn mg-btn--glass opacity-50 pointer-events-none"}
                  href={buildOpinionHref({
                    composer: composerMode ? "create" : null,
                    leaderFilter,
                    page: Math.min(visibleTopicTotalPages, visibleTopicPage + 1),
                    showReplies,
                    sort: selectedSort,
                    tagFilter,
                    topicFilter,
                    topicId: activeTopicId,
                  })}
                >
                  下一页
                </Link>
              </div>
            </div>
          </aside>

          <div className="app-honor__content">
            <Link aria-label="关闭议题中心" className="app-honor-close" href="/dashboard"><CloseIcon /></Link>

            <div className="app-honor__body" style={{ display: "grid", gap: 12 }}>
              <section
                className="mg-terminal-section"
                style={{
                  minHeight: 0,
                  display: "grid",
                  gap: 12,
                  alignContent: "start",
                  gridTemplateRows: composerMode ? undefined : detail ? "auto auto minmax(0, 1fr)" : undefined,
                  overflow: composerMode ? "auto" : "hidden",
                  paddingRight: 4,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    {!composerMode ? <span className="mg-terminal-kicker">议题详情</span> : null}
                    <h3 className="mg-card__title" style={{ marginTop: composerMode ? 0 : 6 }}>{rightPanelTitle}</h3>
                  </div>
                </div>

                {composerMode ? (
                  <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 14 }}>
                    <form action={createOpinionTopicAction} style={{ display: "grid", gap: 12 }}>
                      <input name="redirectTo" type="hidden" value={currentHref} />
                      <input className="mg-input" name="title" placeholder="议题标题" type="text" />
                      <textarea className="mg-input app-textarea" name="description" placeholder="详细描述" rows={8} />
                      <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 10, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                          <h4 className="mg-card__title">标签</h4>
                          <span className="mg-note">单选</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {OPINION_TOPIC_TAG_OPTIONS.map((tag) => (
                            <label
                              key={`create-tag-${tag.key}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                minHeight: 44,
                                padding: "0 14px",
                                borderRadius: 999,
                                border: "1px solid rgba(255,255,255,0.08)",
                                background:
                                  "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)), rgba(10,13,17,0.72)",
                                color: "rgba(232,238,242,0.9)",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                name="tag"
                                style={{ width: 16, height: 16, accentColor: "#d9ff38" }}
                                required
                                type="radio"
                                value={tag.key}
                              />
                              <span>{tag.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          className="mg-btn mg-btn--glass"
                          disabled={!canCreateTopic}
                          style={buildOpinionTerminalActionStyle(!canCreateTopic)}
                          type="submit"
                        >
                          提交议题（10票）
                        </button>
                      </div>
                    </form>
                    {!canCreateTopic ? <p className="mg-copy" style={{ margin: 0 }}>需满足 Lv.2。</p> : null}
                  </div>
                ) : detail ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "minmax(0, 1.65fr) minmax(320px, 0.95fr)",
                        alignItems: "stretch",
                      }}
                    >
                      <div
                        className="mg-terminal-rail-card"
                        style={{
                          display: "grid",
                          gap: 0,
                          minHeight: 0,
                          height: "100%",
                          alignContent: "start",
                          paddingBlock: 24,
                        }}
                      >
                        <p className="mg-copy" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.72 }}>
                          {detail.topic.description}
                        </p>
                      </div>

                      <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 8, alignContent: "start", height: "100%" }}>
                        <div style={buildOpinionDetailMetricStyle()}>
                          <span className="mg-note" style={{ fontSize: "0.68rem", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>支持率</span>
                          <strong style={{ color: "rgba(245,248,252,0.96)", fontSize: "1.08rem", lineHeight: 1, fontWeight: 800, whiteSpace: "nowrap" }}>
                            {formatPercent(detail.topic.supportRate)}
                          </strong>
                        </div>

                        <div style={buildOpinionDetailMetricStyle()}>
                          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                            <span className="mg-note" style={{ fontSize: "0.68rem", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>支持 / 反对</span>
                            <strong style={{ color: "rgba(245,248,252,0.96)", fontSize: "1.08rem", lineHeight: 1, fontWeight: 800, whiteSpace: "nowrap" }}>
                              {`${detail.topic.supportTicketTotal} / ${detail.topic.opposeTicketTotal}`}
                            </strong>
                          </div>
                          <div style={{ display: "inline-flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                            <form action={supportOpinionTopicAction}>
                              <input name="redirectTo" type="hidden" value={currentHref} />
                              <input name="topicId" type="hidden" value={detail.topic.id} />
                              <input name="ticketAmount" type="hidden" value="1" />
                              <button
                                aria-label="赞同"
                                className="mg-btn"
                                disabled={!detail.topic.canSupport || activeTopicVoteLockedToday}
                                style={buildOpinionVoteButtonStyle(activeTopicVoteDirection === "support")}
                                title={activeTopicVoteLockedToday ? "当前议题今天已经投过票" : "赞同"}
                                type="submit"
                              >
                                <VoteUpIcon />
                              </button>
                            </form>
                            <form action={opposeOpinionTopicAction}>
                              <input name="redirectTo" type="hidden" value={currentHref} />
                              <input name="topicId" type="hidden" value={detail.topic.id} />
                              <input name="ticketAmount" type="hidden" value="1" />
                              <button
                                aria-label="反对"
                                className="mg-btn"
                                disabled={!detail.topic.canOppose || activeTopicVoteLockedToday}
                                style={buildOpinionVoteButtonStyle(activeTopicVoteDirection === "oppose")}
                                title={activeTopicVoteLockedToday ? "当前议题今天已经投过票" : "反对"}
                                type="submit"
                              >
                                <VoteDownIcon />
                              </button>
                            </form>
                          </div>
                        </div>

                        <div style={buildOpinionDetailMetricStyle()}>
                          <span className="mg-note" style={{ fontSize: "0.68rem", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>折合票数</span>
                          <strong style={{ color: "rgba(245,248,252,0.96)", fontSize: "1.08rem", lineHeight: 1, fontWeight: 800, whiteSpace: "nowrap" }}>
                            {activeTopicEffectiveVotes}
                          </strong>
                        </div>

                        <div style={buildOpinionDetailMetricStyle()}>
                          <span className="mg-note" style={{ fontSize: "0.68rem", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>发起者</span>
                          <strong
                            style={{
                              color: "rgba(245,248,252,0.96)",
                              fontSize: "0.94rem",
                              lineHeight: 1.1,
                              fontWeight: 800,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {detail.topic.creatorUsername}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div
                      className="mg-terminal-rail-card"
                      style={{
                        minHeight: 0,
                        display: "grid",
                        gap: 12,
                        overflow: "hidden",
                        gridTemplateRows: showReplyComposer ? "auto auto minmax(0, 1fr)" : "auto minmax(0, 1fr)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <h4 className="mg-card__title">讨论楼</h4>
                        {!showReplyComposer && detail.topic.canComment ? (
                          <Link
                            className="mg-btn mg-btn--glass"
                            href={`${buildOpinionHref({
                              discussionComposer: "open",
                              leaderFilter,
                              page: visibleTopicPage,
                              replyToCommentId: null,
                              showReplies,
                              sort: selectedSort,
                              tagFilter,
                              topicFilter,
                              topicId: detail.topic.id,
                            })}#discussion-compose`}
                          >
                            回帖
                          </Link>
                        ) : null}
                      </div>

                      {showReplyComposer ? (
                        <div className="mg-terminal-rail-card" id="discussion-compose" style={{ display: "grid", gap: 10, padding: 16 }}>
                          {replyTarget ? (
                            <div className="mg-terminal-focus">
                              <span className="mg-terminal-focus__label">回复目标</span>
                              <strong className="mg-terminal-focus__value">{`@${replyTarget.authorUsername}`}</strong>
                              <p className="mg-copy" style={{ margin: "6px 0 0" }}>
                                {replyTarget.content.length > 96 ? `${replyTarget.content.slice(0, 96)}…` : replyTarget.content}
                              </p>
                            </div>
                          ) : null}

                          <form action={createOpinionTopicCommentAction} style={{ display: "grid", gap: 8 }}>
                            <input name="redirectTo" type="hidden" value={currentHref} />
                            <input name="topicId" type="hidden" value={detail.topic.id} />
                            <input name="replyToCommentId" type="hidden" value={replyTarget?.id ?? ""} />
                            <textarea
                              className="mg-input app-textarea"
                              disabled={!detail.topic.canComment}
                              name="content"
                              placeholder={
                                detail.topic.canComment
                                  ? replyTarget
                                    ? `回复 @${replyTarget.authorUsername}`
                                    : "写下你的讨论内容"
                                  : "当前议题暂不允许继续讨论。"
                              }
                              rows={4}
                            />
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                              <button
                                className="mg-btn mg-btn--glass"
                                disabled={!detail.topic.canComment}
                                style={{ ...buildOpinionTerminalActionStyle(!detail.topic.canComment), minHeight: 46, paddingInline: 22, borderRadius: 18 }}
                                type="submit"
                              >
                                {replyTarget ? "发送回复" : "回帖"}
                              </button>
                              <Link
                                className="mg-btn mg-btn--glass"
                                href={buildOpinionHref({
                                  discussionComposer: null,
                                  leaderFilter,
                                  page: visibleTopicPage,
                                  replyToCommentId: null,
                                  showReplies,
                                  sort: selectedSort,
                                  tagFilter,
                                  topicFilter,
                                  topicId: detail.topic.id,
                                })}
                              >
                                取消
                              </Link>
                            </div>
                          </form>
                        </div>
                      ) : null}

                      <div
                        className="mg-terminal-list"
                        style={{
                          minHeight: 0,
                          display: "grid",
                          gap: 12,
                          overflowY: "auto",
                          paddingRight: 4,
                          alignContent: "start",
                          alignItems: "start",
                          gridAutoRows: "max-content",
                        }}
                      >
                        {discussionThreads.length === 0 ? (
                          <p className="mg-copy">当前还没有讨论回复。</p>
                        ) : (
                          discussionThreads.map(({ comment, replies }) => (
                            <article
                              className="mg-terminal-rail-card"
                              key={comment.id}
                              style={{ display: "grid", gap: 10, padding: 18, alignSelf: "start", height: "auto" }}
                            >
                              <div style={{ display: "grid", gap: 8 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    <strong className="mg-terminal-list__title">{comment.authorUsername}</strong>
                                    <span className="mg-note">{formatDateTime(comment.createdAt)}</span>
                                    {detail.topic.canComment ? (
                                      <Link
                                        style={buildOpinionDiscussionReplyStyle()}
                                        href={`${buildOpinionHref({
                                          discussionComposer: "open",
                                          leaderFilter,
                                          page: visibleTopicPage,
                                          replyToCommentId: comment.id,
                                          showReplies,
                                          sort: selectedSort,
                                          tagFilter,
                                          topicFilter,
                                          topicId: detail.topic.id,
                                        })}#discussion-compose`}
                                      >
                                        回复
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mg-copy" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{comment.content}</p>
                              </div>

                              {replies.length > 0 ? (
                                <div style={{ display: "grid", gap: 8, paddingTop: 2 }}>
                                  <div style={{ display: "grid", gap: 8, paddingLeft: 14, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                                  {replies.map((reply) => (
                                    <div
                                      key={reply.id}
                                      style={{
                                        display: "grid",
                                        gap: 6,
                                        padding: "10px 12px",
                                        borderRadius: 16,
                                        border: "1px solid rgba(255,255,255,0.07)",
                                        background:
                                          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(13,16,20,0.74)",
                                      }}
                                    >
                                      <div style={{ display: "grid", gap: 6 }}>
                                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                          <strong className="mg-terminal-list__title" style={{ fontSize: "0.98rem" }}>{reply.authorUsername}</strong>
                                          {reply.replyToUsername ? (
                                            <span className="mg-note">{`→ @${reply.replyToUsername}`}</span>
                                          ) : null}
                                          <span className="mg-note">{formatDateTime(reply.createdAt)}</span>
                                          {detail.topic.canComment ? (
                                            <Link
                                              style={buildOpinionDiscussionReplyStyle()}
                                              href={`${buildOpinionHref({
                                                discussionComposer: "open",
                                                leaderFilter,
                                                page: visibleTopicPage,
                                                replyToCommentId: reply.id,
                                                showReplies,
                                                sort: selectedSort,
                                                tagFilter,
                                                topicFilter,
                                                topicId: detail.topic.id,
                                              })}#discussion-compose`}
                                            >
                                            @回复
                                            </Link>
                                          ) : null}
                                        </div>
                                        <p className="mg-copy" style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{reply.content}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                </div>
                              ) : null}
                            </article>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mg-terminal-rail-card"><p className="mg-copy">请从左侧榜单选择一个议题。</p></div>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
