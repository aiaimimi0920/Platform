"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { formatAccountNumber, formatAccountRate } from "@/lib/account-center";
import { cn } from "@/lib/cn";

import type {
  AccountHonorAbilityMetric,
  AccountHonorArchiveSectionProps,
  AccountHonorPanelData,
  AccountHonorSignalSectionProps,
} from "./types";
import {
  AccountHomeFocus,
  AccountHomeFocusGrid,
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeRailCard,
  AccountHomeSection,
  AccountHomeSectionHead,
} from "@/components/account-home/templates";

const HONOR_ABILITY_AXIS_COUNT = 6;
const HONOR_ABILITY_CHART_SIZE = 288;
const HONOR_ABILITY_CENTER = HONOR_ABILITY_CHART_SIZE / 2;
const HONOR_ABILITY_RADIUS = 110;
const HONOR_ACTIVITY_DAY_LABELS = [
  { label: "Mon", row: 0 },
  { label: "Wed", row: 2 },
  { label: "Fri", row: 4 },
] as const;
const HONOR_ABILITY_COPY_OFFSETS = [
  { dx: 0, dy: -14 },
  { dx: 12, dy: -6 },
  { dx: 12, dy: 10 },
  { dx: 0, dy: 16 },
  { dx: -12, dy: 10 },
  { dx: -12, dy: -6 },
] as const;

function buildHonorSourceRows(progression: AccountHonorArchiveSectionProps["progression"]) {
  const rows = [...(progression?.sources ?? [])].sort((left, right) => {
    const experienceDiff = right.experience - left.experience;
    if (experienceDiff !== 0) {
      return experienceDiff;
    }
    return right.metricValue - left.metricValue;
  });

  const maxExperience = Math.max(...rows.map((row) => row.experience), 1);
  return rows.map((row) => ({
    ...row,
    width: Math.max(6, Math.round((row.experience / maxExperience) * 100)),
  }));
}

function buildProgressSignal(progression: AccountHonorArchiveSectionProps["progression"]) {
  if (!progression) {
    return "成长信号未同步";
  }

  if (progression.experienceToNextLevel === null) {
    return "已达当前最高等级";
  }

  return `距下一阶 ${formatAccountNumber(progression.experienceToNextLevel)} XP`;
}

function InlineDialogCloseIcon() {
  return (
    <svg aria-hidden="true" className="app-account-honor-inline-action__icon" viewBox="0 0 24 24">
      <path
        d="M7 7 17 17M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function renderHonorAvatar(avatarUrl: string | null, fallback: ReactNode) {
  if (avatarUrl) {
    return (
      <div className="app-account-honor-avatar">
        <img alt="account avatar" className="app-account-honor-avatar__image" src={avatarUrl} />
      </div>
    );
  }

  return <div className="app-account-honor-avatar app-account-honor-avatar--fallback">{fallback}</div>;
}

function clampMetricScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildHexPoint(index: number, radius: number) {
  const angle = ((-90 + (360 / HONOR_ABILITY_AXIS_COUNT) * index) * Math.PI) / 180;
  return {
    x: HONOR_ABILITY_CENTER + Math.cos(angle) * radius,
    y: HONOR_ABILITY_CENTER + Math.sin(angle) * radius,
  };
}

function buildPolygonPoints(values: number[], radius: number) {
  return values
    .map((value, index) => {
      const point = buildHexPoint(index, radius * value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function buildRingPoints(radiusRatio: number) {
  return buildPolygonPoints(new Array(HONOR_ABILITY_AXIS_COUNT).fill(radiusRatio), HONOR_ABILITY_RADIUS);
}

function getAbilityLabelAnchor(x: number) {
  if (Math.abs(x - HONOR_ABILITY_CENTER) < 8) {
    return "middle";
  }

  return x < HONOR_ABILITY_CENTER ? "end" : "start";
}

function AccountHonorAbilityBoard({ abilityMetrics }: { abilityMetrics: AccountHonorAbilityMetric[] }) {
  const normalizedScores = abilityMetrics.map((metric) => clampMetricScore(metric.score) / 100);
  const abilityShape = buildPolygonPoints(normalizedScores, HONOR_ABILITY_RADIUS);

  return (
    <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--ability">
      <div className="app-account-honor-ability">
        <div className="app-account-honor-ability__chart-wrap">
          <svg
            aria-label="账户六维能力板"
            className="app-account-honor-ability__chart"
            viewBox={`0 0 ${HONOR_ABILITY_CHART_SIZE} ${HONOR_ABILITY_CHART_SIZE}`}
          >
            {[1, 0.75, 0.5, 0.25].map((ratio) => (
              <polygon
                className="app-account-honor-ability__ring"
                key={ratio}
                points={buildRingPoints(ratio)}
              />
            ))}

            {abilityMetrics.map((metric, index) => {
              const axisPoint = buildHexPoint(index, HONOR_ABILITY_RADIUS);
              const copyBasePoint = buildHexPoint(index, HONOR_ABILITY_RADIUS + 18);
              const copyOffset = HONOR_ABILITY_COPY_OFFSETS[index];
              const copyPoint = {
                x: copyBasePoint.x + copyOffset.dx,
                y: copyBasePoint.y + copyOffset.dy,
              };
              const textAnchor = getAbilityLabelAnchor(copyPoint.x);

              return (
                <g key={metric.key}>
                  <line
                    className="app-account-honor-ability__axis"
                    x1={HONOR_ABILITY_CENTER}
                    x2={axisPoint.x}
                    y1={HONOR_ABILITY_CENTER}
                    y2={axisPoint.y}
                  />
                  <text
                    className="app-account-honor-ability__axis-value"
                    textAnchor={textAnchor}
                    x={copyPoint.x}
                    y={copyPoint.y + 6}
                  >
                    {clampMetricScore(metric.score)}
                  </text>
                </g>
              );
            })}

            <polygon className="app-account-honor-ability__shape" points={abilityShape} />

            {abilityMetrics.map((metric, index) => {
              const markerPoint = buildHexPoint(index, HONOR_ABILITY_RADIUS * normalizedScores[index]);

              return (
                <circle
                  className="app-account-honor-ability__point"
                  cx={markerPoint.x}
                  cy={markerPoint.y}
                  key={`${metric.key}-point`}
                  r="4"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </AccountHomeRailCard>
  );
}

function AccountHonorActivityCard({
  activityHeatmap,
}: {
  activityHeatmap: AccountHonorArchiveSectionProps["activityHeatmap"];
}) {
  const monthTrackStyle = {
    gridTemplateColumns: `repeat(${activityHeatmap.weeks.length}, var(--app-honor-heatmap-cell-size, 10px))`,
  };

  return (
    <AccountHomeRailCard className="app-account-honor-card">
      <div className="app-account-honor-activity">
        <div className="app-account-honor-activity__heatmap">
          <div className="app-account-honor-activity__months">
            <span className="app-account-honor-activity__months-corner" />
            <div className="app-account-honor-activity__months-track" style={monthTrackStyle}>
              {activityHeatmap.months.map((marker) => (
                <span
                  className="app-account-honor-activity__month-label"
                  key={marker.key}
                  style={{ gridColumnStart: marker.weekIndex + 1 }}
                >
                  {marker.label}
                </span>
              ))}
            </div>
          </div>

          <div className="app-account-honor-activity__grid-frame">
            <div className="app-account-honor-activity__weekday-axis">
              {HONOR_ACTIVITY_DAY_LABELS.map((entry) => (
                <span
                  className="app-account-honor-activity__weekday-label"
                  key={entry.label}
                  style={{ gridRowStart: entry.row + 1 }}
                >
                  {entry.label}
                </span>
              ))}
            </div>

            <div className="app-account-honor-activity__weeks">
              {activityHeatmap.weeks.map((week) => (
                <div className="app-account-honor-activity__week" key={week.key}>
                  {week.days.map((cell) => (
                    <span
                      className={cn(
                        "app-account-honor-activity__cell",
                        `app-account-honor-activity__cell--level-${cell.level}`,
                        cell.future && "app-account-honor-activity__cell--future",
                      )}
                      key={cell.date}
                      title={cell.title}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AccountHomeRailCard>
  );
}

function formatHonorCurrencyValue(value: number, currencyLabel = "MIRA") {
  return `${formatAccountNumber(value)} ${currencyLabel}`;
}

function selectShowcasedAgents(
  agentCatalog: AccountHonorPanelData["agentCatalog"],
  showcasedAgentIds: string[],
) {
  if (showcasedAgentIds.length === 0) {
    return agentCatalog.slice(0, 4);
  }

  const catalogById = new Map(agentCatalog.map((agent) => [agent.id, agent] as const));
  return showcasedAgentIds
    .map((agentId) => catalogById.get(agentId) ?? null)
    .filter((agent): agent is (typeof agentCatalog)[number] => Boolean(agent))
    .slice(0, 4);
}

function selectShowcasedProjects(
  projectCatalog: AccountHonorArchiveSectionProps["projectCatalog"] | AccountHonorArchiveSectionProps["investmentProjectCatalog"],
  showcasedProjectIds: string[],
  limit = 4,
) {
  if (showcasedProjectIds.length === 0) {
    return projectCatalog.slice(0, limit);
  }

  const catalogById = new Map(projectCatalog.map((project) => [project.id, project] as const));
  return showcasedProjectIds
    .map((projectId) => catalogById.get(projectId) ?? null)
    .filter((project): project is (typeof projectCatalog)[number] => Boolean(project))
    .slice(0, limit);
}

function buildLocalSponsorshipSummary(
  investmentProjectCatalog: AccountHonorArchiveSectionProps["investmentProjectCatalog"],
  showcasedProjectIds: string[],
) {
  const sponsoredProjects = selectShowcasedProjects(investmentProjectCatalog, showcasedProjectIds, 3);
  return {
    sponsoredCount: sponsoredProjects.length,
    totalAmount: sponsoredProjects.reduce((sum, project) => sum + project.sponsoredAmount, 0),
    currencyLabel:
      sponsoredProjects[0]?.sponsoredCurrencyLabel ?? investmentProjectCatalog[0]?.sponsoredCurrencyLabel ?? "MIRA",
    sponsoredProjects,
  };
}

function selectShowcasedIssues(
  issueCatalog: AccountHonorArchiveSectionProps["issueCatalog"] | AccountHonorArchiveSectionProps["investmentIssueCatalog"],
  showcasedIssueIds: string[],
  limit = 4,
) {
  if (showcasedIssueIds.length === 0) {
    return issueCatalog.slice(0, limit);
  }

  const catalogById = new Map(issueCatalog.map((issue) => [issue.id, issue] as const));
  return showcasedIssueIds
    .map((issueId) => catalogById.get(issueId) ?? null)
    .filter((issue): issue is (typeof issueCatalog)[number] => Boolean(issue))
    .slice(0, limit);
}

function buildLocalIssueSupportSummary(
  investmentIssueCatalog: AccountHonorArchiveSectionProps["investmentIssueCatalog"],
  showcasedIssueIds: string[],
) {
  const supportedIssues = selectShowcasedIssues(investmentIssueCatalog, showcasedIssueIds, 3);
  return {
    supportedCount: supportedIssues.length,
    totalAmount: supportedIssues.reduce((sum, issue) => sum + issue.supportedAmount, 0),
    currencyLabel: supportedIssues[0]?.supportedCurrencyLabel ?? investmentIssueCatalog[0]?.supportedCurrencyLabel ?? "投票券",
    supportedIssues,
  };
}

export function AccountHonorExecutionPanel({
  agentCatalog,
  agentShowcase,
  taskPerformance,
  className,
}: Pick<AccountHonorPanelData, "agentCatalog" | "agentShowcase" | "taskPerformance"> & {
  className?: string;
}) {
  const [agentConfigOpen, setAgentConfigOpen] = useState(false);
  const [visibleAgentShowcase, setVisibleAgentShowcase] = useState(agentShowcase);
  const [agentDraftIds, setAgentDraftIds] = useState(agentShowcase.map((agent) => agent.id));
  const [savingAgentShowcase, setSavingAgentShowcase] = useState(false);
  const [agentShowcaseError, setAgentShowcaseError] = useState<string | null>(null);

  useEffect(() => {
    setVisibleAgentShowcase(agentShowcase);
    setAgentDraftIds(agentShowcase.map((agent) => agent.id));
  }, [agentShowcase]);

  useEffect(() => {
    if (!agentConfigOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAgentConfigOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [agentConfigOpen]);

  function handleOpenAgentConfig() {
    setAgentDraftIds(visibleAgentShowcase.map((agent) => agent.id));
    setAgentShowcaseError(null);
    setAgentConfigOpen(true);
  }

  function toggleAgentDraft(agentId: string) {
    setAgentShowcaseError(null);
    setAgentDraftIds((current) => {
      if (current.includes(agentId)) {
        return current.filter((entry) => entry !== agentId);
      }

      if (current.length >= 4) {
        setAgentShowcaseError("最多展示 4 个 Agent");
        return current;
      }

      return [...current, agentId];
    });
  }

  async function handleSaveAgentShowcase() {
    if (savingAgentShowcase) {
      return;
    }

    setSavingAgentShowcase(true);
    setAgentShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedAgentIds: agentDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "展示 Agent 保存失败");
      }

      setVisibleAgentShowcase(selectShowcasedAgents(agentCatalog, agentDraftIds));
      setAgentConfigOpen(false);
    } catch (error) {
      setAgentShowcaseError(error instanceof Error ? error.message : "展示 Agent 保存失败");
    } finally {
      setSavingAgentShowcase(false);
    }
  }

  const agentConfigDialog =
    agentConfigOpen && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              aria-label="关闭 Agent 展示配置"
              className="app-account-honor-inline-dialog__backdrop"
              onClick={() => setAgentConfigOpen(false)}
              type="button"
            />
            <div
              aria-label="Agent 展示配置"
              aria-modal="true"
              className="app-account-honor-inline-dialog app-account-honor-inline-dialog--agent-config"
              role="dialog"
            >
              <div className="app-account-honor-inline-dialog__head">
                <span className="mg-terminal-kicker">展示 Agent</span>
                <button
                  aria-label="关闭 Agent 展示配置"
                  className="app-account-honor-inline-dialog__close"
                  onClick={() => setAgentConfigOpen(false)}
                  type="button"
                >
                  <InlineDialogCloseIcon />
                </button>
              </div>

              <div className="app-account-honor-agent-config__summary">
                <span>最多展示 4 个 Agent</span>
                <strong>{`${agentDraftIds.length}/4`}</strong>
              </div>

              {agentShowcaseError ? <p className="app-account-honor-agent-config__error">{agentShowcaseError}</p> : null}

              <div className="app-account-honor-agent-config__list">
                {agentCatalog.map((agent) => {
                  const selected = agentDraftIds.includes(agent.id);

                  return (
                    <button
                      className={cn(
                        "app-account-honor-agent-config__option",
                        selected && "app-account-honor-agent-config__option--selected",
                      )}
                      key={agent.id}
                      onClick={() => toggleAgentDraft(agent.id)}
                      type="button"
                    >
                      <div className="app-account-honor-agent-config__option-copy">
                        <strong>{agent.name}</strong>
                        <span>{agent.direction}</span>
                      </div>
                      <span className="app-account-honor-agent-config__option-state">
                        {selected ? "已展示" : agent.enabled ? "可展示" : "未启用"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="app-account-honor-agent-config__actions">
                <button
                  className="app-account-honor-agent-config__secondary"
                  onClick={() => setAgentConfigOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="app-account-honor-agent-config__primary"
                  disabled={savingAgentShowcase}
                  onClick={() => void handleSaveAgentShowcase()}
                  type="button"
                >
                  {savingAgentShowcase ? "保存中" : "保存展示"}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <AccountHomeRailCard
        className={cn(
          "app-account-honor-card app-account-honor-card--performance app-account-honor-card--execution-panel",
          className,
        )}
      >
        <div className="app-account-honor-inline-head app-account-honor-inline-head--spread">
          <span className="mg-terminal-kicker">执行力</span>
          <button
            aria-haspopup="dialog"
            className="app-account-honor-action-button"
            disabled={agentCatalog.length === 0}
            onClick={handleOpenAgentConfig}
            type="button"
          >
            展示配置
          </button>
        </div>
        <div className="app-account-honor-agent-card__metrics app-account-honor-agent-card__metrics--summary app-account-honor-execution-summary-grid">
          <div className="app-account-honor-agent-card__metric">
            <span>信誉分</span>
            <strong>
              {taskPerformance.reputationScore === null
                ? "--"
                : `${formatAccountNumber(taskPerformance.reputationScore)}/${taskPerformance.reputationScoreOutOf}`}
            </strong>
          </div>
          <div className="app-account-honor-agent-card__metric">
            <span>好评率</span>
            <strong>{taskPerformance.positiveRate === null ? "--" : formatAccountRate(taskPerformance.positiveRate)}</strong>
          </div>
          <div className="app-account-honor-agent-card__metric">
            <span>履约数</span>
            <strong>
              {`${formatAccountNumber(taskPerformance.fulfilledCount)}/${formatAccountNumber(
                taskPerformance.acceptedCount,
              )}`}
            </strong>
          </div>
          <div className="app-account-honor-agent-card__metric">
            <span>履约率</span>
            <strong>
              {taskPerformance.fulfillmentRate === null ? "--" : formatAccountRate(taskPerformance.fulfillmentRate)}
            </strong>
          </div>
          <div className="app-account-honor-agent-card__metric">
            <span>任务总支出</span>
            <strong>{formatHonorCurrencyValue(taskPerformance.spentValue)}</strong>
          </div>
          <div className="app-account-honor-agent-card__metric">
            <span>总收益</span>
            <strong>{formatHonorCurrencyValue(taskPerformance.netValue)}</strong>
          </div>
        </div>

        {visibleAgentShowcase.length > 0 ? (
          <>
            <div className="app-account-honor-subsection-head">
              <span>Agent 分项</span>
              <strong>{`${visibleAgentShowcase.length}/4`}</strong>
            </div>
            <div className="app-account-honor-agent-grid">
              {visibleAgentShowcase.map((agent) => (
                <div className="app-account-honor-agent-card" key={agent.id}>
                  <div className="app-account-honor-agent-card__head">
                    <strong>{agent.name}</strong>
                    <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{agent.direction}</span>
                  </div>
                  <div className="app-account-honor-agent-card__metrics">
                    <div className="app-account-honor-agent-card__metric">
                      <span>信誉分</span>
                      <strong>{agent.reputationScore === null ? "--" : formatAccountNumber(agent.reputationScore)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>好评率</span>
                      <strong>{agent.positiveRate === null ? "--" : formatAccountRate(agent.positiveRate)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>履约数</span>
                      <strong>{formatAccountNumber(agent.fulfillmentCount)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>履约率</span>
                      <strong>{agent.fulfillmentRate === null ? "--" : formatAccountRate(agent.fulfillmentRate)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>任务产值</span>
                      <strong>{formatHonorCurrencyValue(agent.producedValue)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>任务支出</span>
                      <strong>{formatHonorCurrencyValue(agent.spentValue)}</strong>
                    </div>
                    <div className="app-account-honor-agent-card__metric">
                      <span>总收益</span>
                      <strong>{formatHonorCurrencyValue(agent.netValue)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : agentCatalog.length > 0 ? (
          <p className="mg-copy">尚未选择展示 Agent。</p>
        ) : (
          <p className="mg-copy">暂无可展示的 Agent。</p>
        )}
      </AccountHomeRailCard>

      {agentConfigDialog}
    </>
  );
}

export function AccountHonorArchiveSection({
  abilityMetrics,
  activityHeatmap,
  issueCatalog,
  issueShowcase,
  issueSupportSummary,
  investmentIssueCatalog,
  projectCatalog,
  progression,
  projectShowcase,
  investmentProjectCatalog,
  sponsorshipSummary,
  showHeader = true,
}: AccountHonorArchiveSectionProps) {
  const [issueConfigOpen, setIssueConfigOpen] = useState(false);
  const [investmentIssueConfigOpen, setInvestmentIssueConfigOpen] = useState(false);
  const [projectConfigOpen, setProjectConfigOpen] = useState(false);
  const [investmentConfigOpen, setInvestmentConfigOpen] = useState(false);
  const [visibleIssueShowcase, setVisibleIssueShowcase] = useState(issueShowcase);
  const [visibleIssueSupportSummary, setVisibleIssueSupportSummary] = useState(issueSupportSummary);
  const [visibleProjectShowcase, setVisibleProjectShowcase] = useState(projectShowcase);
  const [visibleSponsorshipSummary, setVisibleSponsorshipSummary] = useState(sponsorshipSummary);
  const [issueDraftIds, setIssueDraftIds] = useState(issueShowcase.map((issue) => issue.id));
  const [investmentIssueDraftIds, setInvestmentIssueDraftIds] = useState(
    issueSupportSummary.supportedIssues.map((issue) => issue.id),
  );
  const [projectDraftIds, setProjectDraftIds] = useState(projectShowcase.map((project) => project.id));
  const [investmentDraftIds, setInvestmentDraftIds] = useState(
    sponsorshipSummary.sponsoredProjects.map((project) => project.id),
  );
  const [savingIssueShowcase, setSavingIssueShowcase] = useState(false);
  const [savingInvestmentIssueShowcase, setSavingInvestmentIssueShowcase] = useState(false);
  const [savingProjectShowcase, setSavingProjectShowcase] = useState(false);
  const [savingInvestmentShowcase, setSavingInvestmentShowcase] = useState(false);
  const [issueShowcaseError, setIssueShowcaseError] = useState<string | null>(null);
  const [investmentIssueShowcaseError, setInvestmentIssueShowcaseError] = useState<string | null>(null);
  const [projectShowcaseError, setProjectShowcaseError] = useState<string | null>(null);
  const [investmentShowcaseError, setInvestmentShowcaseError] = useState<string | null>(null);

  useEffect(() => {
    setVisibleIssueShowcase(issueShowcase);
    setIssueDraftIds(issueShowcase.map((issue) => issue.id));
  }, [issueShowcase]);

  useEffect(() => {
    setVisibleIssueSupportSummary(issueSupportSummary);
    setInvestmentIssueDraftIds(issueSupportSummary.supportedIssues.map((issue) => issue.id));
  }, [issueSupportSummary]);

  useEffect(() => {
    setVisibleProjectShowcase(projectShowcase);
    setProjectDraftIds(projectShowcase.map((project) => project.id));
  }, [projectShowcase]);

  useEffect(() => {
    setVisibleSponsorshipSummary(sponsorshipSummary);
    setInvestmentDraftIds(sponsorshipSummary.sponsoredProjects.map((project) => project.id));
  }, [sponsorshipSummary]);

  useEffect(() => {
    if (!projectConfigOpen && !investmentConfigOpen && !issueConfigOpen && !investmentIssueConfigOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIssueConfigOpen(false);
        setInvestmentIssueConfigOpen(false);
        setProjectConfigOpen(false);
        setInvestmentConfigOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [investmentConfigOpen, investmentIssueConfigOpen, issueConfigOpen, projectConfigOpen]);

  function handleOpenIssueConfig() {
    setProjectConfigOpen(false);
    setInvestmentConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setIssueDraftIds(visibleIssueShowcase.map((issue) => issue.id));
    setIssueShowcaseError(null);
    setIssueConfigOpen(true);
  }

  function handleOpenInvestmentIssueConfig() {
    setIssueConfigOpen(false);
    setProjectConfigOpen(false);
    setInvestmentConfigOpen(false);
    setInvestmentIssueDraftIds(visibleIssueSupportSummary.supportedIssues.map((issue) => issue.id));
    setInvestmentIssueShowcaseError(null);
    setInvestmentIssueConfigOpen(true);
  }

  function handleOpenProjectConfig() {
    setIssueConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setInvestmentConfigOpen(false);
    setProjectDraftIds(visibleProjectShowcase.map((project) => project.id));
    setProjectShowcaseError(null);
    setProjectConfigOpen(true);
  }

  function handleOpenInvestmentConfig() {
    setIssueConfigOpen(false);
    setInvestmentIssueConfigOpen(false);
    setProjectConfigOpen(false);
    setInvestmentDraftIds(visibleSponsorshipSummary.sponsoredProjects.map((project) => project.id));
    setInvestmentShowcaseError(null);
    setInvestmentConfigOpen(true);
  }

  function toggleIssueDraft(issueId: string) {
    setIssueShowcaseError(null);
    setIssueDraftIds((current) => {
      if (current.includes(issueId)) {
        return current.filter((entry) => entry !== issueId);
      }

      if (current.length >= 4) {
        setIssueShowcaseError("最多展示 4 个议题");
        return current;
      }

      return [...current, issueId];
    });
  }

  function toggleInvestmentIssueDraft(issueId: string) {
    setInvestmentIssueShowcaseError(null);
    setInvestmentIssueDraftIds((current) => {
      if (current.includes(issueId)) {
        return current.filter((entry) => entry !== issueId);
      }

      if (current.length >= 3) {
        setInvestmentIssueShowcaseError("最多展示 3 个投资议题");
        return current;
      }

      return [...current, issueId];
    });
  }

  function toggleProjectDraft(projectId: string) {
    setProjectShowcaseError(null);
    setProjectDraftIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((entry) => entry !== projectId);
      }

      if (current.length >= 4) {
        setProjectShowcaseError("最多展示 4 个项目");
        return current;
      }

      return [...current, projectId];
    });
  }

  function toggleInvestmentDraft(projectId: string) {
    setInvestmentShowcaseError(null);
    setInvestmentDraftIds((current) => {
      if (current.includes(projectId)) {
        return current.filter((entry) => entry !== projectId);
      }

      if (current.length >= 3) {
        setInvestmentShowcaseError("最多展示 3 个投资项目");
        return current;
      }

      return [...current, projectId];
    });
  }

  async function handleSaveProjectShowcase() {
    if (savingProjectShowcase) {
      return;
    }

    setSavingProjectShowcase(true);
    setProjectShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedProjectIds: projectDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "展示项目保存失败");
      }

      setVisibleProjectShowcase(selectShowcasedProjects(projectCatalog, projectDraftIds));
      setProjectConfigOpen(false);
    } catch (error) {
      setProjectShowcaseError(error instanceof Error ? error.message : "展示项目保存失败");
    } finally {
      setSavingProjectShowcase(false);
    }
  }

  async function handleSaveIssueShowcase() {
    if (savingIssueShowcase) {
      return;
    }

    setSavingIssueShowcase(true);
    setIssueShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedIssueIds: issueDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "议题展示保存失败");
      }

      setVisibleIssueShowcase(selectShowcasedIssues(issueCatalog, issueDraftIds));
      setIssueConfigOpen(false);
    } catch (error) {
      setIssueShowcaseError(error instanceof Error ? error.message : "议题展示保存失败");
    } finally {
      setSavingIssueShowcase(false);
    }
  }

  async function handleSaveInvestmentShowcase() {
    if (savingInvestmentShowcase) {
      return;
    }

    setSavingInvestmentShowcase(true);
    setInvestmentShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedInvestmentProjectIds: investmentDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "投资项目展示保存失败");
      }

      setVisibleSponsorshipSummary(buildLocalSponsorshipSummary(investmentProjectCatalog, investmentDraftIds));
      setInvestmentConfigOpen(false);
    } catch (error) {
      setInvestmentShowcaseError(error instanceof Error ? error.message : "投资项目展示保存失败");
    } finally {
      setSavingInvestmentShowcase(false);
    }
  }

  async function handleSaveInvestmentIssueShowcase() {
    if (savingInvestmentIssueShowcase) {
      return;
    }

    setSavingInvestmentIssueShowcase(true);
    setInvestmentIssueShowcaseError(null);

    try {
      const response = await fetch("/api/account-honor/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          honorShowcasedInvestmentIssueIds: investmentIssueDraftIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "投资议题展示保存失败");
      }

      setVisibleIssueSupportSummary(buildLocalIssueSupportSummary(investmentIssueCatalog, investmentIssueDraftIds));
      setInvestmentIssueConfigOpen(false);
    } catch (error) {
      setInvestmentIssueShowcaseError(error instanceof Error ? error.message : "投资议题展示保存失败");
    } finally {
      setSavingInvestmentIssueShowcase(false);
    }
  }

  return (
    <AccountHomeSection>
      {showHeader ? (
        <AccountHomeSectionHead
          actions={
            <div className="app-account-honor-head-actions">
              {progression ? <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{`Lv.${progression.level}`}</span> : null}
            </div>
          }
          kicker="Honor Archive"
          title="荣誉档案"
        />
      ) : null}

      <div className="app-account-honor-top-grid">
        <AccountHonorAbilityBoard abilityMetrics={abilityMetrics} />
        <AccountHonorActivityCard activityHeatmap={activityHeatmap} />
      </div>

      <div className="app-account-honor-grid app-account-honor-grid--secondary">
        <AccountHomeRailCard className="app-account-honor-card">
          <div className="app-account-honor-inline-head app-account-honor-inline-head--spread">
            <span className="mg-terminal-kicker">项目</span>
            <button
              aria-expanded={projectConfigOpen}
              aria-haspopup="dialog"
              className="app-account-honor-action-button"
              disabled={projectCatalog.length === 0}
              onClick={() => {
                if (projectConfigOpen) {
                  setProjectConfigOpen(false);
                  return;
                }
                handleOpenProjectConfig();
              }}
              type="button"
            >
              展示配置
            </button>
          </div>
          {projectConfigOpen ? (
            <div className="app-account-honor-inline-config" role="group" aria-label="项目展示配置">
              <div className="app-account-honor-inline-config__summary">
                <span>选择展示的被投资项目</span>
                <strong>{`${projectDraftIds.length}/4`}</strong>
              </div>
              {projectShowcaseError ? <p className="app-account-honor-agent-config__error">{projectShowcaseError}</p> : null}
              <div className="app-account-honor-inline-config__list">
                {projectCatalog.map((project) => {
                  const selected = projectDraftIds.includes(project.id);
                  return (
                    <button
                      className={cn(
                        "app-account-honor-inline-config__option",
                        selected && "app-account-honor-inline-config__option--selected",
                      )}
                      key={project.id}
                      onClick={() => toggleProjectDraft(project.id)}
                      type="button"
                    >
                      <div className="app-account-honor-inline-config__copy">
                        <strong>{project.name}</strong>
                        <span>{`${formatAccountNumber(project.sponsorCount)} 人 / ${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</span>
                      </div>
                      <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="app-account-honor-inline-config__actions">
                <button
                  className="app-account-honor-agent-config__secondary"
                  onClick={() => setProjectConfigOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="app-account-honor-agent-config__primary"
                  disabled={savingProjectShowcase}
                  onClick={() => void handleSaveProjectShowcase()}
                  type="button"
                >
                  {savingProjectShowcase ? "保存中" : "保存展示"}
                </button>
              </div>
            </div>
          ) : null}
          {visibleProjectShowcase.length > 0 ? (
            <AccountHomeList>
              {visibleProjectShowcase.slice(0, 4).map((project) => (
                <div className="mg-terminal-list__row app-account-honor-project-row" key={project.id}>
                  <div className="app-account-honor-project-row__body">
                    <div className="mg-terminal-list__meta">
                      <strong className="mg-terminal-list__title">{project.name}</strong>
                      <span className="mg-terminal-list__subtitle">{project.summary}</span>
                    </div>
                    <div className="app-account-honor-project-metrics">
                      <div className="app-account-honor-project-metrics__item">
                        <span>资助人数</span>
                        <strong>{formatAccountNumber(project.sponsorCount)}</strong>
                      </div>
                      <div className="app-account-honor-project-metrics__item">
                        <span>资助总额</span>
                        <strong>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </AccountHomeList>
          ) : (
            <p className="mg-copy">暂无可展示的项目</p>
          )}
        </AccountHomeRailCard>

        <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--investment">
            <div className="app-account-honor-inline-head app-account-honor-inline-head--spread">
              <span className="mg-terminal-kicker">投资项目</span>
              <button
                aria-expanded={investmentConfigOpen}
                aria-haspopup="dialog"
                className="app-account-honor-action-button"
                disabled={investmentProjectCatalog.length === 0}
                onClick={() => {
                  if (investmentConfigOpen) {
                    setInvestmentConfigOpen(false);
                    return;
                  }
                  handleOpenInvestmentConfig();
                }}
                type="button"
              >
                展示配置
              </button>
            </div>
            {investmentConfigOpen ? (
              <div className="app-account-honor-inline-config" role="group" aria-label="投资项目展示配置">
                <div className="app-account-honor-inline-config__summary">
                  <span>选择展示的投资项目</span>
                  <strong>{`${investmentDraftIds.length}/3`}</strong>
                </div>
                {investmentShowcaseError ? (
                  <p className="app-account-honor-agent-config__error">{investmentShowcaseError}</p>
                ) : null}
                <div className="app-account-honor-inline-config__list">
                  {investmentProjectCatalog.map((project) => {
                    const selected = investmentDraftIds.includes(project.id);
                    return (
                      <button
                        className={cn(
                          "app-account-honor-inline-config__option",
                          selected && "app-account-honor-inline-config__option--selected",
                        )}
                        key={project.id}
                        onClick={() => toggleInvestmentDraft(project.id)}
                        type="button"
                      >
                        <div className="app-account-honor-inline-config__copy">
                          <strong>{project.name}</strong>
                          <span>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</span>
                        </div>
                        <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="app-account-honor-inline-config__actions">
                  <button
                    className="app-account-honor-agent-config__secondary"
                    onClick={() => setInvestmentConfigOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="app-account-honor-agent-config__primary"
                    disabled={savingInvestmentShowcase}
                    onClick={() => void handleSaveInvestmentShowcase()}
                    type="button"
                  >
                    {savingInvestmentShowcase ? "保存中" : "保存展示"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="app-account-honor-sponsor-summary">
              <div>
                <span>总投资额</span>
                <strong>{`${formatAccountNumber(visibleSponsorshipSummary.totalAmount)} ${visibleSponsorshipSummary.currencyLabel}`}</strong>
              </div>
              <div>
                <span>投资项目数</span>
                <strong>{formatAccountNumber(visibleSponsorshipSummary.sponsoredCount)}</strong>
              </div>
            </div>
            {visibleSponsorshipSummary.sponsoredProjects.length > 0 ? (
              <AccountHomeList className="app-account-honor-inline-details">
                {visibleSponsorshipSummary.sponsoredProjects.slice(0, 3).map((project) => (
                  <div
                    className="mg-terminal-list__row app-account-honor-inline-dialog__project-row"
                    key={project.id}
                  >
                    <div className="mg-terminal-list__meta">
                      {project.publicHref ? (
                        <Link className="app-account-honor-inline-dialog__project-link" href={project.publicHref}>
                          {project.name}
                        </Link>
                      ) : (
                        <strong className="mg-terminal-list__title">{project.name}</strong>
                      )}
                    </div>
                    <div className="app-account-honor-inline-dialog__project-amount">
                      <span>个人投资额</span>
                      <strong>{`${formatAccountNumber(project.sponsoredAmount)} ${project.sponsoredCurrencyLabel}`}</strong>
                    </div>
                  </div>
                ))}
              </AccountHomeList>
            ) : (
              <p className="mg-copy">暂无投资项目</p>
            )}
        </AccountHomeRailCard>

        <AccountHomeRailCard className="app-account-honor-card">
          <div className="app-account-honor-inline-head app-account-honor-inline-head--spread">
            <span className="mg-terminal-kicker">议题</span>
            <button
              aria-expanded={issueConfigOpen}
              aria-haspopup="dialog"
              className="app-account-honor-action-button"
              disabled={issueCatalog.length === 0}
              onClick={() => {
                if (issueConfigOpen) {
                  setIssueConfigOpen(false);
                  return;
                }
                handleOpenIssueConfig();
              }}
              type="button"
            >
              展示配置
            </button>
          </div>
          {issueConfigOpen ? (
            <div className="app-account-honor-inline-config" role="group" aria-label="议题展示配置">
              <div className="app-account-honor-inline-config__summary">
                <span>选择展示的被投资议题</span>
                <strong>{`${issueDraftIds.length}/4`}</strong>
              </div>
              {issueShowcaseError ? <p className="app-account-honor-agent-config__error">{issueShowcaseError}</p> : null}
              <div className="app-account-honor-inline-config__list">
                {issueCatalog.map((issue) => {
                  const selected = issueDraftIds.includes(issue.id);
                  return (
                    <button
                      className={cn(
                        "app-account-honor-inline-config__option",
                        selected && "app-account-honor-inline-config__option--selected",
                      )}
                      key={issue.id}
                      onClick={() => toggleIssueDraft(issue.id)}
                      type="button"
                    >
                      <div className="app-account-honor-inline-config__copy">
                        <strong>{issue.name}</strong>
                        <span>{`${formatAccountNumber(issue.supporterCount)} 人 / ${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</span>
                      </div>
                      <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="app-account-honor-inline-config__actions">
                <button
                  className="app-account-honor-agent-config__secondary"
                  onClick={() => setIssueConfigOpen(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="app-account-honor-agent-config__primary"
                  disabled={savingIssueShowcase}
                  onClick={() => void handleSaveIssueShowcase()}
                  type="button"
                >
                  {savingIssueShowcase ? "保存中" : "保存展示"}
                </button>
              </div>
            </div>
          ) : null}
          {visibleIssueShowcase.length > 0 ? (
            <AccountHomeList>
              {visibleIssueShowcase.slice(0, 4).map((issue) => (
                <div className="mg-terminal-list__row app-account-honor-project-row" key={issue.id}>
                  <div className="app-account-honor-project-row__body">
                    <div className="mg-terminal-list__meta">
                      {issue.publicHref ? (
                        <Link className="app-account-honor-inline-dialog__project-link" href={issue.publicHref}>
                          {issue.name}
                        </Link>
                      ) : (
                        <strong className="mg-terminal-list__title">{issue.name}</strong>
                      )}
                      <span className="mg-terminal-list__subtitle">{issue.summary}</span>
                    </div>
                    <div className="app-account-honor-project-metrics">
                      <div className="app-account-honor-project-metrics__item">
                        <span>支持人数</span>
                        <strong>{formatAccountNumber(issue.supporterCount)}</strong>
                      </div>
                      <div className="app-account-honor-project-metrics__item">
                        <span>支持票数</span>
                        <strong>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </AccountHomeList>
          ) : (
            <p className="mg-copy">暂无可展示的议题</p>
          )}
        </AccountHomeRailCard>

        <AccountHomeRailCard className="app-account-honor-card app-account-honor-card--investment">
            <div className="app-account-honor-inline-head app-account-honor-inline-head--spread">
              <span className="mg-terminal-kicker">投资议题</span>
              <button
                aria-expanded={investmentIssueConfigOpen}
                aria-haspopup="dialog"
                className="app-account-honor-action-button"
                disabled={investmentIssueCatalog.length === 0}
                onClick={() => {
                  if (investmentIssueConfigOpen) {
                    setInvestmentIssueConfigOpen(false);
                    return;
                  }
                  handleOpenInvestmentIssueConfig();
                }}
                type="button"
              >
                展示配置
              </button>
            </div>
            {investmentIssueConfigOpen ? (
              <div className="app-account-honor-inline-config" role="group" aria-label="投资议题展示配置">
                <div className="app-account-honor-inline-config__summary">
                  <span>选择展示的投资议题</span>
                  <strong>{`${investmentIssueDraftIds.length}/3`}</strong>
                </div>
                {investmentIssueShowcaseError ? (
                  <p className="app-account-honor-agent-config__error">{investmentIssueShowcaseError}</p>
                ) : null}
                <div className="app-account-honor-inline-config__list">
                  {investmentIssueCatalog.map((issue) => {
                    const selected = investmentIssueDraftIds.includes(issue.id);
                    return (
                      <button
                        className={cn(
                          "app-account-honor-inline-config__option",
                          selected && "app-account-honor-inline-config__option--selected",
                        )}
                        key={issue.id}
                        onClick={() => toggleInvestmentIssueDraft(issue.id)}
                        type="button"
                      >
                        <div className="app-account-honor-inline-config__copy">
                          <strong>{issue.name}</strong>
                          <span>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</span>
                        </div>
                        <span className="app-account-honor-inline-config__state">{selected ? "已展示" : "可展示"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="app-account-honor-inline-config__actions">
                  <button
                    className="app-account-honor-agent-config__secondary"
                    onClick={() => setInvestmentIssueConfigOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className="app-account-honor-agent-config__primary"
                    disabled={savingInvestmentIssueShowcase}
                    onClick={() => void handleSaveInvestmentIssueShowcase()}
                    type="button"
                  >
                    {savingInvestmentIssueShowcase ? "保存中" : "保存展示"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="app-account-honor-sponsor-summary app-account-honor-sponsor-summary--tickets">
              <div>
                <span>总投出票数</span>
                <strong>{`${formatAccountNumber(visibleIssueSupportSummary.totalAmount)} ${visibleIssueSupportSummary.currencyLabel}`}</strong>
              </div>
              <div>
                <span>投资议题数</span>
                <strong>{formatAccountNumber(visibleIssueSupportSummary.supportedCount)}</strong>
              </div>
            </div>
            {visibleIssueSupportSummary.supportedIssues.length > 0 ? (
              <AccountHomeList className="app-account-honor-inline-details">
                {visibleIssueSupportSummary.supportedIssues.slice(0, 3).map((issue) => (
                  <div
                    className="mg-terminal-list__row app-account-honor-inline-dialog__project-row"
                    key={issue.id}
                  >
                    <div className="mg-terminal-list__meta">
                      {issue.publicHref ? (
                        <Link className="app-account-honor-inline-dialog__project-link" href={issue.publicHref}>
                          {issue.name}
                        </Link>
                      ) : (
                        <strong className="mg-terminal-list__title">{issue.name}</strong>
                      )}
                    </div>
                    <div className="app-account-honor-inline-dialog__project-amount">
                      <span>个人支持票数</span>
                      <strong>{`${formatAccountNumber(issue.supportedAmount)} ${issue.supportedCurrencyLabel}`}</strong>
                    </div>
                  </div>
                ))}
              </AccountHomeList>
            ) : (
              <p className="mg-copy">暂无投资议题</p>
            )}
        </AccountHomeRailCard>
      </div>
    </AccountHomeSection>
  );
}

export function AccountHonorSignalSection({
  accountAvatarUrl,
  accountDisplayName,
  joinedAtLabel,
  nextLevelLabel,
  progression,
  providerUserId,
  reputation,
  trustLevel,
  unlockedAccessCount,
}: AccountHonorSignalSectionProps) {
  const progressSignal = buildProgressSignal(progression);
  const nextAccessRule = progression?.access.find((rule) => !rule.satisfied) ?? null;

  return (
    <AccountHomeSection>
      <AccountHomeSectionHead kicker="Profile Signal" title="身份荣誉信标" />

      <div className="app-account-honor-signal">
        {renderHonorAvatar(accountAvatarUrl, accountDisplayName.slice(0, 1).toUpperCase())}
        <div className="app-account-honor-signal__copy">
          <strong>{accountDisplayName}</strong>
          <span>{providerUserId}</span>
          <div className="app-account-honor-signal__badges">
            {trustLevel !== null ? <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{`Trust ${trustLevel}`}</span> : null}
            {reputation ? <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(245,158,11,0.16)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{reputation.tier}</span> : null}
            {progression ? <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(139,92,246,0.16)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{`Lv.${progression.level}`}</span> : null}
          </div>
        </div>
      </div>

      <div className="app-account-honor-signal-bar">
        <div className="app-account-honor-signal-pill">
          <span>当前信誉阶</span>
          <strong>{reputation?.tier ?? "--"}</strong>
        </div>
        <div className="app-account-honor-signal-pill">
          <span>成长信号</span>
          <strong>{progressSignal}</strong>
        </div>
      </div>

      <AccountHomeFocusGrid className="app-account-honor-focus-grid app-account-honor-focus-grid--compact">
        <AccountHomeFocus label="信誉分" value={reputation ? formatAccountNumber(reputation.reputationScore) : "--"} />
        <AccountHomeFocus label="权限" value={formatAccountNumber(unlockedAccessCount)} />
        <AccountHomeFocus label="自动优惠" value={progression ? formatAccountRate(progression.rewardDiscountRate) : "--"} />
        <AccountHomeFocus label="下一等级" value={progression ? `Lv.${progression.nextLevelPreview?.level ?? progression.level}` : "--"} />
      </AccountHomeFocusGrid>

      <AccountHomeList>
        <AccountHomeListRow aside={<span className="app-note">{joinedAtLabel}</span>} title="加入时间" />
        <AccountHomeListRow
          aside={<span className="app-note">{nextLevelLabel}</span>}
          title="成长目标"
        />
        <AccountHomeListRow
          aside={
            nextAccessRule ? (
              <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(139,92,246,0.16)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{`Lv.${nextAccessRule.minLevel}`}</span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>全部解锁</span>
            )
          }
          title={nextAccessRule?.title ?? "权限门槛"}
        />
      </AccountHomeList>
    </AccountHomeSection>
  );
}
