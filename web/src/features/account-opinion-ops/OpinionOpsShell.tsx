import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buildOpsHref } from "./routes";
import type { IssueOpsShellProps } from "./types";

import "./styles.css";

export function OpinionOpsShell({ data, query }: IssueOpsShellProps) {
  const { topicCollection, settlementRuns, features } = data;
  const firstTopic = topicCollection.topics?.[0];
  const focusHref = buildOpsHref({
    page: query?.page,
    reviewStatus: query?.reviewStatus,
    topicId: firstTopic?.id ?? null,
    settlementMonth: query?.settlementMonth ?? settlementRuns[0]?.monthKey ?? null,
    settlementSlice: query?.settlementSlice,
    sort: query?.sort,
    topicStatus: query?.topicStatus,
  });

  return (
    <section className="mg-terminal-section issue-ops-shell">
      <header className="issue-ops-shell__header">
        <div>
          <span className="mg-terminal-kicker">Issue Ops</span>
          <h1 className="mg-card__title" style={{ marginTop: 8 }}>议题运维骨架</h1>
          <p className="mg-copy" style={{ margin: "6px 0 0" }}>
            当前模块状态：{features.opinionHub?.enabled ? "已开启" : "未启用"}（来自 feature snapshot）。
          </p>
        </div>
        <Badge variant="violet">{`${topicCollection.totalCount ?? 0} 条待审议题`}</Badge>
      </header>

      <div className="issue-ops-shell__highlight">
        <p className="mg-copy">
          {firstTopic
            ? `聚焦议题：${firstTopic.title}`
            : "当前筛选条件下没有议题，待运维后续填充。"}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Link className="mg-btn mg-btn--glass" href={focusHref}>
            打开当前议题
          </Link>
        </div>
      </div>

      <div className="mg-terminal-list" style={{ display: "grid", gap: 10 }}>
        {settlementRuns.length === 0 ? (
          <p className="mg-copy">暂无候补池历史。</p>
        ) : (
          settlementRuns.slice(0, 3).map((run) => (
            <Link
              className="mg-terminal-list__row"
              href={buildOpsHref({ settlementMonth: run.monthKey })}
              key={run.monthKey}
            >
              <div className="mg-terminal-list__meta">
                <strong className="mg-terminal-list__title">{run.monthKey}</strong>
                <span className="mg-terminal-list__subtitle">
                  候补 {run.candidateCount} · 入选 {run.selectedCount}/{run.selectionLimit}
                </span>
              </div>
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                <Badge variant="cyan">{run.selectionLimit ? `${run.selectionLimit} 入选` : "候补"}</Badge>
                <span className="mg-note">{`更新 ${run.updatedAt ? new Date(run.updatedAt).toLocaleDateString("zh-CN") : "未知"}`}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
