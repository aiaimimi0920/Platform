import Link from "next/link";
import { redirect } from "next/navigation";

import type { OpinionMonthlySettlementItemStatus } from "@neuro/contracts";
import { auth } from "@/auth";
import {
  getFeatureSnapshot,
  getOpinionHubSettingsInternal,
  getOpinionMonthlySettlementRunDetailInternal,
  getOperatorOpinionTopicCollection,
  getOperatorOpinionTopicDetail,
  isFeatureSnapshotUnavailable,
  listOpinionMonthlySettlementRunsInternal,
} from "@/lib/core-client";
import {
  batchRestoreOpinionMonthlySettlementItemsAction,
  batchExcludeOpinionMonthlySettlementItemsAction,
  moderateOpinionTopicAction,
  runOpinionMonthlyLeaderSettlementAction,
  updateOpinionHubSettingsAction,
  updateOpinionMonthlySettlementItemDecisionAction,
} from "@/lib/platform-actions";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";

import { QUICK_EXCLUSION_REASONS } from "./constants";
import { OpinionOpsShell } from "./OpinionOpsShell";
import { buildOpsHref } from "./routes";

import "./styles.css";

type OpinionOpsPageProps = {
  searchParams?: Promise<{
    message?: string;
    batchAction?: string;
    batchAffectedCount?: string;
    batchExcludedCount?: string;
    batchDroppedSelectedItemIds?: string;
    batchSelectedCount?: string;
    batchStandbyCount?: string;
    batchNewSelectedItemIds?: string;
    batchOperatedItemIds?: string;
    page?: string;
    reviewStatus?: string;
    settlementFocusItemId?: string;
    settlementMonth?: string;
    settlementSlice?: string;
    roadmapItemIds?: string;
    settlementQueuedCount?: string;
    settlementSettledCount?: string;
    settlementSkipped?: string;
    sort?: string;
    status?: string;
    topicId?: string;
    topicStatus?: string;
  }>;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
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

function parseUniqueQueryList(value: string | null | undefined) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function mapReviewBadge(status: string) {
  const modifier =
    status === "published"
      ? "ops-status-dot--active"
      : status === "pending_review"
        ? "ops-status-dot--scheduled"
        : status === "rejected" || status === "banned" || status === "deleted"
          ? "ops-status-dot--inactive"
          : "";
  return <span className={`ops-status-dot ${modifier}`.trim()}>{status}</span>;
}

function mapSelectionBadge(status: OpinionMonthlySettlementItemStatus, selectedOrder: number | null) {
  if (status === "selected") {
    return <span className="ops-status-dot ops-status-dot--active">{selectedOrder ? `已入选 #${selectedOrder}` : "已入选"}</span>;
  }
  if (status === "excluded") {
    return <span className="ops-status-dot ops-status-dot--inactive">已排除</span>;
  }
  return <span className="ops-status-dot">候补中</span>;
}

function inferQuickExclusionReasonLabel(note: string | null | undefined) {
  const normalized = note?.trim();
  if (!normalized) {
    return null;
  }
  const matched = QUICK_EXCLUSION_REASONS.find(
    (reason) => normalized === reason.note || normalized.startsWith(`${reason.label}：`),
  );
  return matched?.label ?? null;
}

export default async function OpinionOpsPage({ searchParams }: OpinionOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台运维人员可以访问该议题运维面。")}`);
  }

  const userContext = await requirePlatformOperatorUserContext();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page || 1) || 1);
  const sort = params.sort === "createdAt" || params.sort === "governance" ? params.sort : "supportRate";
  const reviewStatus = params.reviewStatus || "pending_review";
  const topicStatus =
    params.topicStatus === "collecting" || params.topicStatus === "qualified" || params.topicStatus === "archived"
      ? params.topicStatus
      : "all";
  const topicId = params.topicId?.trim() || null;
  const status = params.status === "success" ? "success" : params.status === "error" ? "error" : null;
  const message = params.message ?? null;
  const batchAction = params.batchAction === "restore" ? "restore" : params.batchAction === "exclude" ? "exclude" : null;
  const batchAffectedCount = Math.max(0, Number(params.batchAffectedCount || 0) || 0);
  const batchSelectedCount = Math.max(0, Number(params.batchSelectedCount || 0) || 0);
  const batchStandbyCount = Math.max(0, Number(params.batchStandbyCount || 0) || 0);
  const batchExcludedCount = Math.max(0, Number(params.batchExcludedCount || 0) || 0);
  const batchOperatedItemIds = parseUniqueQueryList(params.batchOperatedItemIds);
  const batchNewSelectedItemIds = parseUniqueQueryList(params.batchNewSelectedItemIds);
  const batchDroppedSelectedItemIds = parseUniqueQueryList(params.batchDroppedSelectedItemIds);
  const settlementFocusItemId = params.settlementFocusItemId?.trim() || null;
  const settlementMonth = params.settlementMonth?.trim() || null;
  const settlementSlice =
    params.settlementSlice === "excluded" || params.settlementSlice === "promoted" || params.settlementSlice === "baseline"
      ? params.settlementSlice
      : "all";
  const roadmapItemIds = parseUniqueQueryList(params.roadmapItemIds);
  const settlementSettledCount = Math.max(0, Number(params.settlementSettledCount || 0) || 0);
  const settlementQueuedCount = Math.max(0, Number(params.settlementQueuedCount || 0) || 0);
  const settlementSkipped = params.settlementSkipped === "1";

  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return <main className="app-page"><div className="mg-shell"><p className="mg-copy">模块状态暂不可用。</p></div></main>;
  }
  if (!features.opinionHub.enabled) {
    return <main className="app-page"><div className="mg-shell"><p className="mg-copy">议题模块已关闭。</p></div></main>;
  }

  const [settings, collection, settlementRuns] = await Promise.all([
    getOpinionHubSettingsInternal(userContext),
    getOperatorOpinionTopicCollection(userContext, {
      page,
      pageSize: 10,
      sort,
      reviewStatus: reviewStatus as "published" | "pending_review" | "rejected" | "banned" | "deleted" | "all",
      topicStatus,
    }),
    listOpinionMonthlySettlementRunsInternal(userContext, 12).catch(() => []),
  ]);

  const activeSettlementMonth = settlementMonth || settlementRuns[0]?.monthKey || null;
  const activeTopicId = topicId || collection.topics[0]?.id || null;

  const [detail, settlementDetail] = await Promise.all([
    activeTopicId ? getOperatorOpinionTopicDetail(userContext, activeTopicId).catch(() => null) : Promise.resolve(null),
    activeSettlementMonth
      ? getOpinionMonthlySettlementRunDetailInternal(userContext, activeSettlementMonth).catch(() => null)
      : Promise.resolve(null),
  ]);

  const selectedRoadmapItemIds = settlementDetail
    ? settlementDetail.items
        .filter((item) => item.selectionStatus === "selected")
        .map((item) => item.queueItemId)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    : roadmapItemIds;

  const exclusionSummary = settlementDetail
    ? (() => {
        const counts = new Map<string, number>();
        let otherCount = 0;
        for (const item of settlementDetail.items) {
          if (item.selectionStatus !== "excluded") continue;
          const label = inferQuickExclusionReasonLabel(item.operatorNote);
          if (!label) {
            otherCount += 1;
            continue;
          }
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        const buckets: Array<{ label: string; count: number }> = QUICK_EXCLUSION_REASONS.map((reason) => ({
          label: reason.label,
          count: counts.get(reason.label) ?? 0,
        })).filter((bucket) => bucket.count > 0);
        if (otherCount > 0) {
          buckets.push({ label: "其他备注", count: otherCount });
        }
        return buckets;
      })()
    : [];
  const promotionPairs = settlementDetail
    ? (() => {
        const displaced = settlementDetail.items
          .filter(
            (item) =>
              item.selectionStatus === "excluded" &&
              item.rank <= settlementDetail.run.selectionLimit,
          )
          .sort((left, right) => left.rank - right.rank);
        const promoted = settlementDetail.items
          .filter(
            (item) =>
              item.selectionStatus === "selected" &&
              item.rank > settlementDetail.run.selectionLimit,
          )
          .sort((left, right) => (left.selectedOrder ?? 99) - (right.selectedOrder ?? 99));
        const pairs = new Map<string, { kind: "promoted" | "displaced"; counterpart: { rank: number; title: string } }>();
        for (let index = 0; index < Math.min(displaced.length, promoted.length); index += 1) {
          const displacedItem = displaced[index];
          const promotedItem = promoted[index];
          pairs.set(displacedItem.id, {
            kind: "displaced",
            counterpart: { rank: promotedItem.rank, title: promotedItem.title },
          });
          pairs.set(promotedItem.id, {
            kind: "promoted",
            counterpart: { rank: displacedItem.rank, title: displacedItem.title },
          });
        }
        return pairs;
      })()
    : new Map<string, { kind: "promoted" | "displaced"; counterpart: { rank: number; title: string } }>();
  const visibleSettlementItems = settlementDetail
    ? settlementDetail.items.filter((item) => {
        if (settlementSlice === "excluded") {
          return item.selectionStatus === "excluded";
        }
        if (settlementSlice === "promoted") {
          return item.selectionStatus === "selected" && item.rank > settlementDetail.run.selectionLimit;
        }
        if (settlementSlice === "baseline") {
          return item.rank <= settlementDetail.run.selectionLimit;
        }
        return true;
      })
    : [];
  const currentHref = buildOpsHref({
    page,
    reviewStatus,
    settlementFocusItemId,
    settlementMonth: activeSettlementMonth,
    settlementSlice,
    sort,
    topicId: activeTopicId,
    topicStatus,
  });
  const batchEligibleSettlementItems = visibleSettlementItems.filter((item) => item.selectionStatus !== "excluded");
  const batchRestorableSettlementItems = visibleSettlementItems.filter((item) => item.selectionStatus === "excluded");
  const visibleSettlementItemIdSet = new Set(visibleSettlementItems.map((item) => item.id));
  const settlementItemById = new Map((settlementDetail?.items ?? []).map((item) => [item.id, item]));
  const batchOperatedItems = batchOperatedItemIds
    .map((itemId) => settlementItemById.get(itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const batchNewSelectedItems = batchNewSelectedItemIds
    .map((itemId) => settlementItemById.get(itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const batchDroppedSelectedItems = batchDroppedSelectedItemIds
    .map((itemId) => settlementItemById.get(itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const batchSummarySections = [
    {
      emptyText: batchAction === "restore" ? "本次恢复后没有新增进入前5的条目。" : "本次批量排除后没有新的候补条目递补进前5。",
      items: batchNewSelectedItems,
      key: "new-selected",
      label: batchAction === "restore" ? "本次重新进入前5" : "本次递补入选",
      note:
        batchAction === "restore"
          ? "这些条目在恢复候补资格后，重新进入了当前前5入选位。"
          : "这些条目在本次批量治理后，从候补位递补进当前前5。",
    },
    {
      emptyText: batchAction === "restore" ? "本次恢复没有挤出当前前5的条目。" : "本次批量排除未造成新的前5退出条目。",
      items: batchDroppedSelectedItems,
      key: "dropped-selected",
      label: batchAction === "restore" ? "本次回退为候补" : "本次退出前5",
      note:
        batchAction === "restore"
          ? "这些条目在原高位议题恢复后，从当前前5回退为候补。"
          : "这些条目不再处于当前前5，需要由后续候补继续补位。",
    },
    {
      emptyText: "当前没有可展示的本次处理条目。",
      items: batchOperatedItems,
      key: "operated",
      label: batchAction === "restore" ? "本次恢复条目" : "本次处理条目",
      note:
        batchAction === "restore"
          ? "这里列出本轮批量恢复候补资格的议题，方便与实际进位结果对照。"
          : "这里列出本轮统一原因批量治理命中的议题，便于和后续进位变化对照。",
    },
  ] as const;
  const shellData = {
    features,
    settlementRuns,
    topicCollection: collection,
  };
  const shellQuery = {
    page,
    reviewStatus,
    settlementMonth: activeSettlementMonth ?? undefined,
    settlementSlice: settlementSlice as "all" | "excluded" | "promoted" | "baseline",
    sort,
    topicId: activeTopicId ?? undefined,
    topicStatus,
  };

  return (
    <main className="app-page issue-ops-page">
      <div className="mg-shell issue-ops-page__shell">
        <OpinionOpsShell context={userContext} data={shellData} query={shellQuery} />

        {status && message ? (
          <div
            className={`mg-terminal-focus issue-ops-page__flash ${
              status === "success" ? "issue-ops-page__flash--success" : "issue-ops-page__flash--error"
            }`}
          >
            <span className="mg-terminal-focus__label">治理反馈</span>
            <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>{message}</strong>
          </div>
        ) : null}

        <section className="mg-terminal-section issue-ops-page__stage">
          <div className="issue-ops-page__stage-grid">
            {status === "success" && batchAction && batchAffectedCount > 0 ? (
              <div
                className="mg-terminal-focus issue-ops-page__batch-summary"
                id="batch-summary"
                style={{ display: "grid", gap: 10, scrollMarginTop: 120 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <span className="mg-terminal-focus__label">批量治理结果摘要</span>
                    <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>
                      {batchAction === "restore"
                        ? `本次批量恢复影响 ${batchAffectedCount} 条候补池条目。`
                        : `本次批量排除影响 ${batchAffectedCount} 条候补池条目。`}
                    </strong>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className={`ops-status-dot ${batchAction === "restore" ? "ops-status-dot--active" : "ops-status-dot--scheduled"}`}>
                      {batchAction === "restore" ? "批量恢复" : "批量排除"}
                    </span>
                    {activeSettlementMonth ? <span className="ops-status-dot">{activeSettlementMonth}</span> : null}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                  <div className="mg-terminal-focus">
                    <span className="mg-terminal-focus__label">影响条目</span>
                    <strong className="mg-terminal-focus__value">{batchAffectedCount}</strong>
                  </div>
                  <div className="mg-terminal-focus">
                    <span className="mg-terminal-focus__label">当前入选</span>
                    <strong className="mg-terminal-focus__value">{batchSelectedCount}</strong>
                  </div>
                  <div className="mg-terminal-focus">
                    <span className="mg-terminal-focus__label">候补中</span>
                    <strong className="mg-terminal-focus__value">{batchStandbyCount}</strong>
                  </div>
                  <div className="mg-terminal-focus">
                    <span className="mg-terminal-focus__label">已排除</span>
                    <strong className="mg-terminal-focus__value">{batchExcludedCount}</strong>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {batchSummarySections.map((section) => (
                    <div className="mg-terminal-rail-card" key={section.key} style={{ display: "grid", gap: 10 }}>
                      <div>
                        <span className="mg-terminal-kicker">{section.label}</span>
                        <p className="mg-copy" style={{ margin: "6px 0 0" }}>{section.note}</p>
                      </div>
                      {section.items.length > 0 ? (
                        <div className="mg-terminal-list" style={{ display: "grid", gap: 8 }}>
                          {section.items.slice(0, 6).map((item) => {
                            const targetSlice = visibleSettlementItemIdSet.has(item.id) ? settlementSlice : "all";
                            const targetHref = `${buildOpsHref({
                              page,
                              reviewStatus,
                              settlementFocusItemId: item.id,
                              settlementMonth: activeSettlementMonth,
                              settlementSlice: targetSlice,
                              sort,
                              topicId: item.topicId,
                              topicStatus,
                            })}#settlement-item-${item.id}`;
                            return (
                              <Link className="mg-terminal-list__row" href={targetHref} key={`${section.key}-${item.id}`}>
                                <div className="mg-terminal-list__meta">
                                  <strong className="mg-terminal-list__title">{item.title}</strong>
                                  <span className="mg-terminal-list__subtitle">
                                    {`Rank #${item.rank} · ${formatPercent(item.supportRate)} · ${item.supportTicketTotal} 票${targetSlice !== settlementSlice ? " · 已切回全部候补池定位" : ""}`}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                                  {mapSelectionBadge(item.selectionStatus, item.selectedOrder)}
                                  <span className="mg-note">定位到明细</span>
                                </div>
                              </Link>
                            );
                          })}
                          {section.items.length > 6 ? (
                            <p className="mg-note" style={{ margin: 0 }}>{`另有 ${section.items.length - 6} 条已收起，可在下方候补池明细中继续查看。`}</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mg-copy" style={{ margin: 0 }}>{section.emptyText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="issue-ops-page__governance-grid">
              <div className="issue-ops-page__governance-rail">
                <form action={updateOpinionHubSettingsAction} className="mg-terminal-rail-card" style={{ display: "grid", gap: 12 }}>
                  <input name="redirectTo" type="hidden" value={currentHref} />
                  <div>
                    <span className="mg-terminal-kicker">Moderation Gate</span>
                    <h3 className="mg-card__title" style={{ marginTop: 8 }}>审核开关</h3>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input defaultChecked={settings.preModerationEnabled} name="preModerationEnabled" type="checkbox" />
                    <span className="mg-copy">开启先审后放</span>
                  </label>
                  <p className="mg-copy" style={{ margin: 0 }}>
                    开启后，所有新议题先进入待审队列；关闭时，仅命中敏感 / 无效关键词的议题进入待审。
                  </p>
                  <button className="mg-btn mg-btn--primary" type="submit">保存审核设置</button>
                </form>

                <form action={runOpinionMonthlyLeaderSettlementAction} className="mg-terminal-rail-card" style={{ display: "grid", gap: 12 }}>
                  <input name="redirectTo" type="hidden" value={currentHref} />
                  <input name="limit" type="hidden" value="10" />
                  <div>
                    <span className="mg-terminal-kicker">Monthly Settlement</span>
                    <h3 className="mg-card__title" style={{ marginTop: 8 }}>手动执行上月候补池结算</h3>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span className="ops-status-dot ops-status-dot--scheduled">前 10 候补池</span>
                    <span className="ops-status-dot ops-status-dot--active">前 5 入选</span>
                    <span className="ops-status-dot">候补进位</span>
                  </div>
                  <p className="mg-copy" style={{ margin: 0 }}>
                    该动作会先形成上月支持率前 10 的候补池，再默认选中前 5 进入 development queue；若高位议题被排除，系统会自动从候补位递补进来。
                  </p>
                  <button className="mg-btn mg-btn--primary" type="submit">立即执行上月候补池结算</button>
                </form>

                {activeSettlementMonth ? (
                  <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 12 }}>
                  <div>
                    <span className="mg-terminal-kicker">Settlement Result</span>
                    <h3 className="mg-card__title" style={{ marginTop: 8 }}>当前候补池结果</h3>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span className={`ops-status-dot ${settlementSkipped ? "ops-status-dot--scheduled" : "ops-status-dot--active"}`}>
                      {settlementSkipped ? "已跳过重复写入" : "当前已加载"}
                    </span>
                    <span className="ops-status-dot">{activeSettlementMonth}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                    <div className="mg-terminal-focus">
                      <span className="mg-terminal-focus__label">候补池</span>
                      <strong className="mg-terminal-focus__value">
                        {settlementDetail?.run.candidateCount ?? settlementSettledCount}
                      </strong>
                    </div>
                    <div className="mg-terminal-focus">
                      <span className="mg-terminal-focus__label">当前入选</span>
                      <strong className="mg-terminal-focus__value">
                        {settlementDetail?.run.selectedCount ?? Math.min(5, settlementSettledCount)}
                      </strong>
                    </div>
                    <div className="mg-terminal-focus">
                      <span className="mg-terminal-focus__label">当前排期项</span>
                      <strong className="mg-terminal-focus__value">{selectedRoadmapItemIds.length || settlementQueuedCount}</strong>
                    </div>
                  </div>
                  <p className="mg-copy" style={{ margin: 0 }}>
                    {settlementSkipped
                        ? "该月份已存在结算 run，本次只是重新加载现有候补池。"
                        : "你可以在下方明细里排除高敏 / 无效议题；系统会自动把后续候补递补进前 5。"}
                  </p>
                </div>
                ) : null}
              </div>

              <form action="/ops/account/issues" className="mg-terminal-section issue-ops-page__filters-card" style={{ display: "grid", gap: 12 }}>
                {activeSettlementMonth ? <input type="hidden" name="settlementMonth" value={activeSettlementMonth} /> : null}
                <div>
                  <span className="mg-terminal-kicker">Filters</span>
                  <h3 className="mg-card__title" style={{ marginTop: 8 }}>筛选队列</h3>
                </div>
                <div className="issue-ops-page__filters-grid">
                  <select className="mg-input" defaultValue={reviewStatus} name="reviewStatus">
                    <option value="pending_review">待审核</option>
                    <option value="published">已公开</option>
                    <option value="rejected">已驳回</option>
                    <option value="banned">已封禁</option>
                    <option value="deleted">已删除</option>
                    <option value="all">全部审核态</option>
                  </select>
                  <select className="mg-input" defaultValue={sort} name="sort">
                    <option value="supportRate">支持率排序</option>
                    <option value="createdAt">时间排序</option>
                    <option value="governance">治理排序</option>
                  </select>
                  <select className="mg-input" defaultValue={topicStatus} name="topicStatus">
                    <option value="all">全部治理态</option>
                    <option value="collecting">拉票中</option>
                    <option value="qualified">已达标</option>
                    <option value="archived">已归档</option>
                  </select>
                  <select className="mg-input" defaultValue={settlementSlice} name="settlementSlice">
                    <option value="all">候补池全部</option>
                    <option value="excluded">只看已排除</option>
                    <option value="promoted">只看递补入选</option>
                    <option value="baseline">只看原始前5</option>
                  </select>
                  <button className="mg-btn mg-btn--glass" type="submit">应用筛选</button>
                </div>
              </form>
            </div>
          </div>
        </section>
        {settlementRuns.length > 0 ? (
          <section className="mg-terminal-section issue-ops-page__settlement-section" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <span className="mg-terminal-kicker">Monthly Selection Pool</span>
                <h2 className="mg-card__title" style={{ marginTop: 8 }}>候补池历史与进位明细</h2>
                <p className="mg-copy" style={{ marginTop: 8 }}>
                  左侧按月份回看历史结算 run，右侧查看该月前 10 候补池、当前前 5 入选、以及运维排除/恢复记录。对条目执行排除后，系统会自动递补下一个候补项。
                </p>
              </div>
              {settlementDetail ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span className="ops-status-dot ops-status-dot--scheduled">{`${settlementDetail.run.candidateCount} 候补`}</span>
                  <span className="ops-status-dot ops-status-dot--active">{`${settlementDetail.run.selectedCount}/${settlementDetail.run.selectionLimit} 入选`}</span>
                  <span className="ops-status-dot">{`更新于 ${formatDateTime(settlementDetail.run.updatedAt)}`}</span>
                </div>
              ) : null}
            </div>

            <div className="issue-ops-page__settlement-grid">
              <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 12, minHeight: 0 }}>
                <div>
                  <span className="mg-terminal-kicker">Runs</span>
                  <h3 className="mg-card__title" style={{ marginTop: 8 }}>历史结算</h3>
                </div>
                <div className="mg-terminal-list" style={{ display: "grid", gap: 10, minHeight: 0, overflow: "auto", paddingRight: 6 }}>
                  {settlementRuns.map((run) => (
                    <Link
                      className="mg-terminal-list__row"
                      href={buildOpsHref({
                        page,
                        reviewStatus,
                        settlementMonth: run.monthKey,
                        settlementSlice,
                        sort,
                        topicId: activeTopicId,
                        topicStatus,
                      })}
                      key={run.monthKey}
                      style={{ borderColor: run.monthKey === activeSettlementMonth ? "rgba(217,255,56,0.36)" : undefined }}
                    >
                      <div className="mg-terminal-list__meta">
                        <strong className="mg-terminal-list__title">{run.monthKey}</strong>
                        <span className="mg-terminal-list__subtitle">{`候补 ${run.candidateCount} · 入选 ${run.selectedCount}/${run.selectionLimit}`}</span>
                      </div>
                      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                        <span className="ops-status-dot">{formatDateTime(run.settledAt)}</span>
                        <span className="mg-note">{`更新 ${formatDateTime(run.updatedAt)}`}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 14 }}>
                {settlementDetail ? (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <span className="ops-status-dot">{settlementDetail.run.monthKey}</span>
                      <span className="ops-status-dot ops-status-dot--scheduled">{`前 ${settlementDetail.run.candidateCount} 候补池`}</span>
                      <span className="ops-status-dot ops-status-dot--active">{`最终前 ${settlementDetail.run.selectionLimit} 入选`}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                      <div className="mg-terminal-focus">
                        <span className="mg-terminal-focus__label">候补池条数</span>
                        <strong className="mg-terminal-focus__value">{settlementDetail.run.candidateCount}</strong>
                      </div>
                      <div className="mg-terminal-focus">
                        <span className="mg-terminal-focus__label">当前入选</span>
                        <strong className="mg-terminal-focus__value">{settlementDetail.run.selectedCount}</strong>
                      </div>
                      <div className="mg-terminal-focus">
                        <span className="mg-terminal-focus__label">结算时间</span>
                        <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>
                          {formatDateTime(settlementDetail.run.settledAt)}
                        </strong>
                      </div>
                    </div>
                    {exclusionSummary.length > 0 ? (
                      <div className="mg-terminal-focus" style={{ display: "grid", gap: 8 }}>
                        <span className="mg-terminal-focus__label">当前排除原因分布</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {exclusionSummary.map((bucket) => (
                            <span key={bucket.label} className={`ops-status-dot ${bucket.label === "涉政" ? "ops-status-dot--inactive" : "ops-status-dot--scheduled"}`}>
                              {`${bucket.label} ${bucket.count} 条`}
                            </span>
                          ))}
                        </div>
                        <p className="mg-copy" style={{ margin: 0 }}>
                          这里按快捷排除原因归并本月已排除条目，便于运维快速判断本月候补池主要被什么类型的问题拦下。
                        </p>
                      </div>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link
                        className={settlementSlice === "all" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"}
                        href={buildOpsHref({ page, reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice: "all", sort, topicId: activeTopicId, topicStatus })}
                      >
                        全部
                      </Link>
                      <Link
                        className={settlementSlice === "excluded" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"}
                        href={buildOpsHref({ page, reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice: "excluded", sort, topicId: activeTopicId, topicStatus })}
                      >
                        只看已排除
                      </Link>
                      <Link
                        className={settlementSlice === "promoted" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"}
                        href={buildOpsHref({ page, reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice: "promoted", sort, topicId: activeTopicId, topicStatus })}
                      >
                        只看递补入选
                      </Link>
                      <Link
                        className={settlementSlice === "baseline" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"}
                        href={buildOpsHref({ page, reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice: "baseline", sort, topicId: activeTopicId, topicStatus })}
                      >
                        只看原始前5
                      </Link>
                    </div>
                    <div className="mg-terminal-focus" style={{ display: "grid", gap: 10 }}>
                      <div>
                        <span className="mg-terminal-focus__label">{"批量候补池治理"}</span>
                        <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>
                          {`当前切片 ${visibleSettlementItems.length} 条，其中可批量排除 ${batchEligibleSettlementItems.length} 条、可批量恢复 ${batchRestorableSettlementItems.length} 条。`}
                        </strong>
                        <p className="mg-copy" style={{ margin: "6px 0 0" }}>
                          {"如果当前切片里的议题属于同一类问题，可以直接按统一原因批量排除；若需要回滚误判，也可以把当前切片中的已排除条目批量恢复。"}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {QUICK_EXCLUSION_REASONS.map((reason) => (
                          <form action={batchExcludeOpinionMonthlySettlementItemsAction} key={`batch-${reason.label}`}>
                            <input name="redirectTo" type="hidden" value={currentHref} />
                            <input name="monthKey" type="hidden" value={settlementDetail.run.monthKey} />
                            <input name="note" type="hidden" value={reason.note} />
                            {batchEligibleSettlementItems.map((item) => (
                              <input key={`batch-item-${reason.label}-${item.id}`} name="itemIds" type="hidden" value={item.id} />
                            ))}
                            <button className="mg-btn mg-btn--glass" disabled={batchEligibleSettlementItems.length === 0} type="submit">
                              {`批量标记${reason.label}`}
                            </button>
                          </form>
                        ))}
                        <form action={batchRestoreOpinionMonthlySettlementItemsAction}>
                          <input name="redirectTo" type="hidden" value={currentHref} />
                          <input name="monthKey" type="hidden" value={settlementDetail.run.monthKey} />
                          <input name="note" type="hidden" value="批量恢复：当前切片恢复候补资格。" />
                          {batchRestorableSettlementItems.map((item) => (
                            <input key={`restore-item-${item.id}`} name="itemIds" type="hidden" value={item.id} />
                          ))}
                          <button className="mg-btn mg-btn--primary" disabled={batchRestorableSettlementItems.length === 0} type="submit">
                            批量恢复当前切片
                          </button>
                        </form>
                      </div>
                    </div>
                    <div className="mg-terminal-list" style={{ display: "grid", gap: 12 }}>
                      {visibleSettlementItems.length === 0 ? (
                        <div className="mg-terminal-focus">
                          <span className="mg-terminal-focus__label">当前切片没有命中条目</span>
                          <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>
                            {settlementSlice === "excluded"
                              ? "本月候补池里还没有已排除条目。"
                              : settlementSlice === "promoted"
                                ? "当前还没有候补递补进前5的条目。"
                                : settlementSlice === "baseline"
                                  ? "当前还没有原始前5条目。"
                                  : "当前没有可显示的候补池条目。"}
                          </strong>
                        </div>
                      ) : visibleSettlementItems.map((item) => {
                        const topicHref = buildOpsHref({
                          page,
                          reviewStatus,
                          settlementMonth: activeSettlementMonth,
                          settlementSlice,
                          sort,
                          topicId: item.topicId,
                          topicStatus,
                        });
                        const action = item.selectionStatus === "excluded" ? "restore" : "exclude";
                        const actionLabel = item.selectionStatus === "excluded" ? "恢复候补资格" : "排除并触发候补进位";
                        const promotionRelation = promotionPairs.get(item.id);

                        return (
                          <div
                            className="mg-terminal-rail-card"
                            id={`settlement-item-${item.id}`}
                            key={item.id}
                            style={{
                              borderColor: item.id === settlementFocusItemId ? "rgba(217,255,56,0.38)" : undefined,
                              boxShadow:
                                item.id === settlementFocusItemId
                                  ? "inset 0 0 0 1px rgba(217,255,56,0.16), 0 0 0 1px rgba(217,255,56,0.14), 0 18px 48px rgba(217,255,56,0.08)"
                                  : undefined,
                              display: "grid",
                              gap: 12,
                              scrollMarginTop: 120,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  <span className="ops-status-dot ops-status-dot--scheduled">{`Rank #${item.rank}`}</span>
                                  {mapSelectionBadge(item.selectionStatus, item.selectedOrder)}
                                  {item.id === settlementFocusItemId ? <span className="ops-status-dot">当前定位</span> : null}
                                </div>
                                <strong className="mg-card__title">{item.title}</strong>
                                <span className="mg-note">{`${formatPercent(item.supportRate)} · ${item.supportTicketTotal} 票 / ${item.uniqueSupporterCount} 人`}</span>
                                {item.id === settlementFocusItemId && status === "success" && batchAction && batchAffectedCount > 0 ? (
                                  <div style={{ marginTop: 4 }}>
                                    <Link className="mg-btn mg-btn--glass" href={`${currentHref}#batch-summary`}>
                                      返回本次批量摘要
                                    </Link>
                                  </div>
                                ) : null}
                              </div>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Link className="mg-btn mg-btn--glass" href={topicHref}>查看议题</Link>
                              </div>
                            </div>

                            {promotionRelation ? (
                              <div className="mg-terminal-focus">
                                <span className="mg-terminal-focus__label">
                                  {promotionRelation.kind === "promoted" ? "递补入选关系" : "排除后递补关系"}
                                </span>
                                <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>
                                  {promotionRelation.kind === "promoted"
                                    ? `当前由候补递补入选，顶替 Rank #${promotionRelation.counterpart.rank} ${promotionRelation.counterpart.title}`
                                    : `当前排除后，已由 Rank #${promotionRelation.counterpart.rank} ${promotionRelation.counterpart.title} 递补`}
                                </strong>
                              </div>
                            ) : null}

                            {item.operatorNote ? (
                              <div className="mg-terminal-focus">
                                <span className="mg-terminal-focus__label">最近处理备注</span>
                                <strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>{item.operatorNote}</strong>
                                <p className="mg-copy" style={{ margin: "6px 0 0" }}>
                                  {`操作时间：${formatDateTime(item.operatorActionedAt)} · 操作人：${item.operatorActionedByUserId ?? "未记录"}`}
                                </p>
                              </div>
                            ) : null}

                            {item.selectionStatus !== "excluded" ? (
                              <div className="mg-terminal-focus" style={{ display: "grid", gap: 10 }}>
                                <div>
                                  <span className="mg-terminal-focus__label">快捷排除原因</span>
                                  <p className="mg-copy" style={{ margin: "6px 0 0" }}>
                                    直接用标准原因排除该议题，系统会立刻触发候补进位；若需要更细说明，可继续使用下方手工备注。
                                  </p>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {QUICK_EXCLUSION_REASONS.map((reason) => (
                                    <form action={updateOpinionMonthlySettlementItemDecisionAction} key={reason.label}>
                                      <input name="redirectTo" type="hidden" value={currentHref} />
                                      <input name="monthKey" type="hidden" value={settlementDetail.run.monthKey} />
                                      <input name="itemId" type="hidden" value={item.id} />
                                      <input name="action" type="hidden" value="exclude" />
                                      <input name="note" type="hidden" value={reason.note} />
                                      <button className="mg-btn mg-btn--glass" type="submit">{reason.label}</button>
                                    </form>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <form action={updateOpinionMonthlySettlementItemDecisionAction} style={{ display: "grid", gap: 8 }}>
                              <input name="redirectTo" type="hidden" value={currentHref} />
                              <input name="monthKey" type="hidden" value={settlementDetail.run.monthKey} />
                              <input name="itemId" type="hidden" value={item.id} />
                              <input name="action" type="hidden" value={action} />
                              <textarea
                                className="mg-input app-textarea"
                                name="note"
                                placeholder={
                                  item.selectionStatus === "excluded"
                                    ? "可选：记录恢复原因，例如“误判、内容整改完成、已补充明确需求”。"
                                    : "可选：补充更详细的治理说明，例如具体重复来源、风险边界或执行障碍。"
                                }
                                rows={3}
                              />
                              <button className={item.selectionStatus === "excluded" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"} type="submit">
                                {actionLabel}
                              </button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="mg-copy">当前还没有可查看的候补池结算明细。</p>
                )}
              </div>
            </div>
          </section>
        ) : null}
        <div className="issue-ops-page__queue-detail">
          <section className="mg-terminal-section" style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: 12, minHeight: 0 }}>
            <div>
              <span className="mg-terminal-kicker">Queue</span>
              <h3 className="mg-card__title" style={{ marginTop: 8 }}>议题队列</h3>
            </div>
            <div className="mg-terminal-list" style={{ minHeight: 0, overflow: "auto", paddingRight: 6 }}>
              {collection.topics.length === 0 ? (
                <p className="mg-copy">当前筛选条件下没有议题。</p>
              ) : (
                collection.topics.map((topic) => (
                  <Link
                    className="mg-terminal-list__row"
                    href={buildOpsHref({
                      page: collection.page,
                      reviewStatus,
                      settlementMonth: activeSettlementMonth,
                      settlementSlice,
                      sort,
                      topicStatus,
                      topicId: topic.id,
                    })}
                    key={topic.id}
                    style={{ borderColor: topic.id === activeTopicId ? "rgba(217,255,56,0.36)" : undefined }}
                  >
                    <div className="mg-terminal-list__meta">
                      <strong className="mg-terminal-list__title">{topic.title}</strong>
                      <span className="mg-terminal-list__subtitle">{topic.summary}</span>
                    </div>
                    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                      {mapReviewBadge(topic.reviewStatus)}
                      <span className="mg-note">{`${formatPercent(topic.supportRate)} · ${topic.supportTicketTotal} 票`}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <Link className={collection.page > 1 ? "mg-btn mg-btn--glass" : "mg-btn mg-btn--glass opacity-50 pointer-events-none"} href={buildOpsHref({ page: Math.max(1, collection.page - 1), reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice, sort, topicStatus, topicId: activeTopicId })}>上一页</Link>
              <span className="mg-note">{`第 ${collection.page}/${collection.totalPages} 页`}</span>
              <Link className={collection.page < collection.totalPages ? "mg-btn mg-btn--glass" : "mg-btn mg-btn--glass opacity-50 pointer-events-none"} href={buildOpsHref({ page: Math.min(collection.totalPages, collection.page + 1), reviewStatus, settlementMonth: activeSettlementMonth, settlementSlice, sort, topicStatus, topicId: activeTopicId })}>下一页</Link>
            </div>
          </section>

          <section className="mg-terminal-section issue-ops-page__detail-panel">
            {detail ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {mapReviewBadge(detail.topic.reviewStatus)}
                  <span className={`ops-status-dot ${detail.topic.discussionStatus === "open" ? "ops-status-dot--active" : "ops-status-dot--scheduled"}`}>{detail.topic.discussionStatus === "open" ? "讨论中" : "已停讨论"}</span>
                  <span className="ops-status-dot">{detail.topic.status}</span>
                </div>
                <div>
                  <span className="mg-terminal-kicker">{detail.topic.creatorUsername}</span>
                  <h3 className="mg-card__title" style={{ marginTop: 8 }}>{detail.topic.title}</h3>
                  <p className="mg-copy" style={{ marginTop: 10 }}>{detail.topic.summary}</p>
                </div>
                <div className="issue-ops-page__detail-top">
                  <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 10 }}>
                    <strong className="mg-card__title">内容</strong>
                    <p className="mg-copy" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detail.topic.description}</p>
                    <p className="mg-copy" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detail.topic.requirements || "暂无额外需求。"}</p>
                    {detail.topic.moderationReasonDetail ? <p className="mg-copy" style={{ margin: 0 }}>{`命中原因：${detail.topic.moderationReasonDetail}`}</p> : null}
                    {detail.topic.moderationNote ? <p className="mg-copy" style={{ margin: 0 }}>{`运维备注：${detail.topic.moderationNote}`}</p> : null}
                  </div>

                  <div className="issue-ops-page__detail-side">
                    <div className="issue-ops-page__detail-summary">
                      <div className="mg-terminal-focus"><span className="mg-terminal-focus__label">支持率</span><strong className="mg-terminal-focus__value">{formatPercent(detail.topic.supportRate)}</strong></div>
                      <div className="mg-terminal-focus"><span className="mg-terminal-focus__label">支持 / 反对</span><strong className="mg-terminal-focus__value">{`${detail.topic.supportTicketTotal} / ${detail.topic.opposeTicketTotal}`}</strong></div>
                      <div className="mg-terminal-focus"><span className="mg-terminal-focus__label">评论数</span><strong className="mg-terminal-focus__value">{detail.topic.commentCount}</strong></div>
                      <div className="mg-terminal-focus"><span className="mg-terminal-focus__label">治理态</span><strong className="mg-terminal-focus__value" style={{ fontSize: 14 }}>{detail.topic.status}</strong></div>
                    </div>

                    <div className="mg-terminal-rail-card" style={{ display: "grid", gap: 10 }}>
                      <strong className="mg-card__title">运维动作</strong>
                      <div className="issue-ops-page__actions-grid">
                      {[
                        ["approve", "通过"],
                        ["reject", "驳回"],
                        ["ban", "封禁"],
                        ["stopDiscussion", "停止讨论"],
                        ["resumeDiscussion", "恢复讨论"],
                        ["delete", "删除"],
                      ].map(([action, label]) => (
                        <form action={moderateOpinionTopicAction} key={action} style={{ display: "grid", gap: 8 }}>
                          <input name="redirectTo" type="hidden" value={currentHref} />
                          <input name="topicId" type="hidden" value={detail.topic.id} />
                          <input name="action" type="hidden" value={action} />
                          <textarea className="mg-input app-textarea" name="note" placeholder="可选：补充处理说明" rows={3} />
                          <button className={action === "approve" || action === "resumeDiscussion" ? "mg-btn mg-btn--primary" : "mg-btn mg-btn--glass"} type="submit">{label}</button>
                        </form>
                      ))}
                    </div>
                  </div>
                  </div>
                </div>

                <div className="mg-terminal-rail-card issue-ops-page__comments">
                  <strong className="mg-card__title">讨论楼</strong>
                  <div className="mg-terminal-list">
                    {detail.comments.length === 0 ? (
                      <p className="mg-copy">当前没有评论。</p>
                    ) : (
                      detail.comments.map((comment) => (
                        <div className="mg-terminal-list__row" key={comment.id}>
                          <div className="mg-terminal-list__meta">
                            <strong className="mg-terminal-list__title">{comment.authorUsername}</strong>
                            <span className="mg-terminal-list__subtitle" style={{ whiteSpace: "pre-wrap" }}>{comment.content}</span>
                          </div>
                          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                            <span className="ops-status-dot ops-status-dot--scheduled">{`${comment.ticketCost} 票`}</span>
                            <span className="mg-note">{formatDateTime(comment.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="mg-copy">请选择左侧议题查看详情。</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
