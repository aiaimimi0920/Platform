import type { ReactNode } from "react";

import Link from "next/link";

import { NtBadge as Badge, NtCard as Card } from "@/components/nt-primitives";

type BadgeVariant =
  | "violet"
  | "fuchsia"
  | "cyan"
  | "success"
  | "warning"
  | "danger"
  | "secondary"
  | "glass";

export type AgentRailBadge = {
  label: string;
  variant: BadgeVariant;
};

export type AgentRailSignal = {
  detail: string;
  label: string;
  variant: BadgeVariant;
};

export function AgentRailItem(props: {
  active: boolean;
  href: string;
  title: string;
  statusLabel: string;
  subtitle: string;
  summary: string;
  badges?: AgentRailBadge[];
  signal?: AgentRailSignal | null;
}) {
  const {
    active,
    href,
    title,
    statusLabel,
    subtitle,
    summary,
    badges = [],
    signal,
  } = props;
  return (
    <Link
      className={`app-announcement-ops__list-item${active ? " app-announcement-ops__list-item--active" : ""}`}
      href={href}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <strong className="app-announcement-ops__list-item-title">{title}</strong>
        <Badge variant="glass">{statusLabel}</Badge>
      </div>
      <span className="app-announcement-ops__list-item-subtitle">{subtitle}</span>
      <span className="app-announcement-ops__list-item-subtitle">{summary}</span>
      {signal ? (
        <div
          style={{
            marginTop: "8px",
            display: "grid",
            gap: "6px",
          }}
        >
          <div className="app-inline-actions">
            <Badge variant={signal.variant}>{signal.label}</Badge>
          </div>
          <span className="app-announcement-ops__list-item-subtitle">
            {signal.detail}
          </span>
        </div>
      ) : null}
      {badges.length > 0 ? (
        <div className="app-inline-actions" style={{ marginTop: "8px", flexWrap: "wrap" }}>
          {badges.map((badge) => (
            <Badge key={`${title}-${badge.label}`} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export type DetailListRow = {
  label: string;
  value: ReactNode;
};

export type FocusMetricItem = {
  label: string;
  value: ReactNode;
};

export function SelectedAgentOverviewCard(props: {
  detailRows: DetailListRow[];
  focusMetrics: FocusMetricItem[];
  statusActions?: ReactNode;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        {props.focusMetrics.map((item) => (
          <div className="mg-terminal-focus" key={item.label}>
            <span className="mg-terminal-focus__label">{item.label}</span>
            <strong className="mg-terminal-focus__value">{item.value}</strong>
          </div>
        ))}
      </div>

      {props.statusActions ? (
        <div className="app-inline-actions">{props.statusActions}</div>
      ) : null}

      <div className="app-detail-list">
        {props.detailRows.map((row) => (
          <div className="app-detail-list__row" key={row.label}>
            <span className="app-detail-list__label">{row.label}</span>
            <span className="app-detail-list__value">{row.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function SelectedAgentHeroCard(props: {
  badges?: ReactNode;
  detail: ReactNode;
  quickActions?: ReactNode;
  title: string;
}) {
  return (
    <>
      <div className="app-announcement-ops__panel-head">
        <div>
          <Badge variant="warning">智能体详情</Badge>
          <h2
            style={{
              margin: "8px 0 0",
              fontSize: "2rem",
              lineHeight: 1.05,
            }}
          >
            {props.title}
          </h2>
          <div
            style={{
              marginTop: "8px",
              color: "rgba(226,232,240,0.72)",
            }}
          >
            {props.detail}
          </div>
        </div>
        <div className="app-inline-actions">{props.badges}</div>
      </div>
      {props.quickActions ? (
        <div className="app-inline-actions">{props.quickActions}</div>
      ) : null}
    </>
  );
}

export function SelectedAgentSummaryCard(props: {
  badge?: ReactNode;
  detail: ReactNode;
  footer?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.badge}
      </div>
      {props.detail}
      {props.footer}
    </Card>
  );
}

export function SelectedAgentExternalGovernanceCard(props: {
  detailRows: DetailListRow[];
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">外部回调治理</p>
          <h3 className="app-card-title">协议 / 密钥 / 策略</h3>
        </div>
        <Badge variant="warning">外部</Badge>
      </div>
      <div className="app-detail-list">
        {props.detailRows.map((row) => (
          <div className="app-detail-list__row" key={row.label}>
            <span className="app-detail-list__label">{row.label}</span>
            <span className="app-detail-list__value">{row.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SelectedAgentRuntimeBridgeCard(props: {
  id?: string;
  tone: BadgeVariant;
  pressureLabel: string;
  schedulingLabel: string;
  pressureDetail: string;
  openCount: string;
  staleOpenCount: string;
  terminalOpenCount: string;
  profileCount: string;
  oldestOpenLabel: string;
  oldestStaleLabel: string;
  sessionsHref: string;
  pressureHref: string;
  recommendationTitle?: string | null;
  recommendationDetail?: string | null;
  recommendationMeta?: ReactNode;
  recommendationActions?: ReactNode;
}) {
  return (
    <Card className="app-stack" id={props.id}>
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">运行桥接</p>
          <h3 className="app-card-title">{props.pressureLabel}</h3>
        </div>
        <Badge variant={props.tone}>{props.schedulingLabel}</Badge>
      </div>
      <p className="app-note">{props.pressureDetail}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        <div className="mg-terminal-focus">
          <span className="mg-terminal-focus__label">Open Sessions</span>
          <strong className="mg-terminal-focus__value">{props.openCount}</strong>
        </div>
        <div className="mg-terminal-focus">
          <span className="mg-terminal-focus__label">Stale Open</span>
          <strong className="mg-terminal-focus__value">
            {props.staleOpenCount}
          </strong>
        </div>
        <div className="mg-terminal-focus">
          <span className="mg-terminal-focus__label">Terminal Open</span>
          <strong className="mg-terminal-focus__value">
            {props.terminalOpenCount}
          </strong>
        </div>
        <div className="mg-terminal-focus">
          <span className="mg-terminal-focus__label">Hot Profiles</span>
          <strong className="mg-terminal-focus__value">{props.profileCount}</strong>
        </div>
      </div>
      <div className="app-detail-list">
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">最早打开</span>
          <span className="app-detail-list__value">{props.oldestOpenLabel}</span>
        </div>
        <div className="app-detail-list__row">
          <span className="app-detail-list__label">最早过期</span>
          <span className="app-detail-list__value">{props.oldestStaleLabel}</span>
        </div>
      </div>
      {props.recommendationTitle ? (
        <div className="app-task-card">
          <div className="app-task-card__header">
            <div>
              <p className="mg-subtitle">处置建议</p>
              <h4 className="app-card-title">{props.recommendationTitle}</h4>
            </div>
            <Badge variant="warning">下一步动作</Badge>
          </div>
          <p className="app-note">{props.recommendationDetail}</p>
          {props.recommendationMeta ? props.recommendationMeta : null}
          {props.recommendationActions ? (
            <div className="app-inline-actions">{props.recommendationActions}</div>
          ) : null}
        </div>
      ) : null}
      <div className="app-inline-actions">
        <Link className="nt-btn nt-btn--secondary" href={props.sessionsHref}>
          运行会话观测
        </Link>
        <Link className="nt-btn nt-btn--ghost" href={props.pressureHref}>
          运行压力
        </Link>
      </div>
    </Card>
  );
}

export function SelectedAgentPolicyRecommendationCard(props: {
  action: ReactNode;
  detail: string;
  subtitle: string;
  title: string;
  toneBadge: ReactNode;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.toneBadge}
      </div>
      <p className="app-note">{props.detail}</p>
      {props.action}
    </Card>
  );
}

export function SelectedAgentControlCard(props: {
  badge?: ReactNode;
  detail?: ReactNode;
  form?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.badge}
      </div>
      {props.detail}
      {props.form}
    </Card>
  );
}

export function SelectedAgentRuntimePressurePlaybookCard(props: {
  id?: string;
  tone: BadgeVariant;
  postureLabel: string;
  title: string;
  detail: string;
  signalRows: DetailListRow[];
  badges?: ReactNode;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <Card className="app-stack" id={props.id}>
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">运行压力处置手册</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        <Badge variant={props.tone}>{props.postureLabel}</Badge>
      </div>
      <p className="app-note">{props.detail}</p>
      {props.badges ? <div className="app-inline-actions">{props.badges}</div> : null}
      <div className="app-detail-list">
        {props.signalRows.map((row) => (
          <div className="app-detail-list__row" key={`${props.title}-${row.label}`}>
            <span className="app-detail-list__label">{row.label}</span>
            <span className="app-detail-list__value">{row.value}</span>
          </div>
        ))}
      </div>
      {props.primaryActions ? <div className="app-inline-actions">{props.primaryActions}</div> : null}
      {props.secondaryActions ? props.secondaryActions : null}
    </Card>
  );
}

export type TimelineItem = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

export function SelectedAgentTimelineCard(props: {
  badge?: ReactNode;
  emptyState: ReactNode;
  items: TimelineItem[];
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.badge}
      </div>
      {props.items.length === 0 ? (
        props.emptyState
      ) : (
        <div className="app-detail-list">
          {props.items.map((item) => (
            <div className="app-detail-list__row" key={item.key}>
              <span className="app-detail-list__label">{item.label}</span>
              <span className="app-detail-list__value">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function SelectedAgentNoticeCard(props: {
  badge?: ReactNode;
  detail: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.badge}
      </div>
      {props.detail}
    </Card>
  );
}

export type AgentOpsDeckItem = {
  action: ReactNode;
  badge?: ReactNode;
  detail: string;
  key: string;
  subtitle: string;
  title: string;
};

export function AgentOpsDeckCard(props: {
  id?: string;
  badge?: ReactNode;
  detail: string;
  items: AgentOpsDeckItem[];
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack" id={props.id}>
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h3 className="app-card-title">{props.title}</h3>
        </div>
        {props.badge}
      </div>
      <p className="app-note">{props.detail}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
        }}
      >
        {props.items.map((item) => (
          <div className="app-task-card" key={item.key}>
            <div className="app-task-card__header">
              <div>
                <p className="mg-subtitle">{item.subtitle}</p>
                <h4 className="app-card-title">{item.title}</h4>
              </div>
              {item.badge}
            </div>
            <p className="app-note">{item.detail}</p>
            {item.action}
          </div>
        ))}
      </div>
    </Card>
  );
}

export type AgentRecommendationItem = {
  action: ReactNode;
  badge: ReactNode;
  detail: string;
  key: string;
  title: string;
};

export function SelectedAgentCallbackHealthCard(props: {
  detailRows: DetailListRow[];
  emptyState?: ReactNode;
  recommendations: AgentRecommendationItem[];
  windowBadge?: ReactNode;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">回调健康</p>
          <h3 className="app-card-title">健康摘要与排查建议</h3>
        </div>
        {props.windowBadge}
      </div>
      {props.detailRows.length > 0 ? (
        <>
          <div className="app-detail-list">
            {props.detailRows.map((row) => (
              <div className="app-detail-list__row" key={row.label}>
                <span className="app-detail-list__label">{row.label}</span>
                <span className="app-detail-list__value">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="app-task-list">
            {props.recommendations.map((recommendation) => (
              <div className="app-task-card" key={recommendation.key}>
                <div className="app-task-card__header">
                  <div>
                    <p className="mg-subtitle">处置建议</p>
                    <h4 className="app-card-title">{recommendation.title}</h4>
                  </div>
                  {recommendation.badge}
                </div>
                <p className="app-note">{recommendation.detail}</p>
                {recommendation.action}
              </div>
            ))}
          </div>
        </>
      ) : (
        props.emptyState
      )}
    </Card>
  );
}

export type AgentCapabilityListItem = {
  code: string;
  description: string;
  enabled: boolean;
  id: string;
  pricingNote: string;
  title: string;
};

export function SelectedAgentCapabilitiesCard(props: {
  badge?: ReactNode;
  capabilities: AgentCapabilityListItem[];
  emptyState: ReactNode;
  form: ReactNode;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">能力</p>
          <h3 className="app-card-title">能力清单</h3>
        </div>
        {props.badge}
      </div>
      {props.capabilities.length === 0 ? (
        props.emptyState
      ) : (
        <div className="app-task-list">
          {props.capabilities.map((capability) => (
            <div className="app-task-card" key={capability.id}>
              <div className="app-task-card__header">
                <div>
                  <p className="mg-subtitle">{capability.code}</p>
                  <h4 className="app-card-title">{capability.title}</h4>
                </div>
                <Badge variant={capability.enabled ? "success" : "warning"}>
                  {capability.enabled ? "已启用" : "已停用"}
                </Badge>
              </div>
              <p className="mg-copy">{capability.description}</p>
              <p className="app-note">{capability.pricingNote}</p>
            </div>
          ))}
        </div>
      )}
      {props.form}
    </Card>
  );
}

export function AgentRecentCallbackAuditCard(props: {
  title: string;
  callbackType: string;
  statusLabel: string;
  statusVariant: BadgeVariant;
  metaBadges?: ReactNode;
  summary: string;
  payloadSummary: string;
  hint?: string | null;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <div className="app-task-card">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.callbackType}</p>
          <h4 className="app-card-title">{props.title}</h4>
        </div>
        <Badge variant={props.statusVariant}>{props.statusLabel}</Badge>
      </div>
      {props.metaBadges ? <div className="app-inline-actions">{props.metaBadges}</div> : null}
      <p className="app-note">{props.summary}</p>
      <p className="app-note">{props.payloadSummary}</p>
      {props.hint ? <p className="app-note">提示：{props.hint}</p> : null}
      {props.primaryActions ? (
        <div className="app-inline-actions">{props.primaryActions}</div>
      ) : null}
      {props.secondaryActions ? props.secondaryActions : null}
    </div>
  );
}

export function SelectedAgentRecentCallbacksCard(props: {
  badge?: ReactNode;
  emptyState: ReactNode;
  items: ReactNode;
}) {
  return (
    <Card className="app-stack" id="recent-callback-audits">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">最近回调审计</p>
          <h3 className="app-card-title">最近回调</h3>
        </div>
        {props.badge}
      </div>
      {props.items ? props.items : props.emptyState}
    </Card>
  );
}

export function SelectedAgentExecutionsCard(props: {
  badge?: ReactNode;
  detail: string;
  emptyState: ReactNode;
  items: ReactNode;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">执行</p>
          <h3 className="app-card-title">最近执行流转</h3>
        </div>
        {props.badge}
      </div>
      <p className="app-note">{props.detail}</p>
      {props.items ? props.items : props.emptyState}
    </Card>
  );
}

export function AgentExecutionOpsCard(props: {
  title: string;
  updatedLabel: string;
  statusLabel: string;
  statusVariant: BadgeVariant;
  topBadges?: ReactNode;
  objective: string;
  detailRows: DetailListRow[];
  notes?: ReactNode;
  policyArea?: ReactNode;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
}) {
  return (
    <div className="app-task-card">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.updatedLabel}</p>
          <h4 className="app-card-title">{props.title}</h4>
        </div>
        <Badge variant={props.statusVariant}>{props.statusLabel}</Badge>
      </div>
      {props.topBadges ? <div className="app-inline-actions">{props.topBadges}</div> : null}
      <p className="app-note">{props.objective}</p>
      <div className="app-detail-list">
        {props.detailRows.map((row) => (
          <div className="app-detail-list__row" key={`${props.title}-${row.label}`}>
            <span className="app-detail-list__label">{row.label}</span>
            <span className="app-detail-list__value">{row.value}</span>
          </div>
        ))}
      </div>
      {props.notes}
      {props.policyArea}
      {props.primaryActions ? <div className="app-inline-actions">{props.primaryActions}</div> : null}
      {props.secondaryActions}
    </div>
  );
}

export function AgentExecutionPolicyAreaCard(props: {
  badge?: ReactNode;
  detail: ReactNode;
  effectiveSummary?: ReactNode;
  form: ReactNode;
  recommendation?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">{props.subtitle}</p>
          <h5 className="app-card-title">{props.title}</h5>
        </div>
        {props.badge}
      </div>
      {props.detail}
      {props.recommendation}
      {props.form}
      {props.effectiveSummary}
    </Card>
  );
}
