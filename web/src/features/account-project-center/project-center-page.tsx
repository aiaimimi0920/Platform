import type { CSSProperties } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DependencyState } from "@/components/dependency-state";
import { getPublicSurfaceSnapshotStrict } from "@/lib/core-client";
import { createDependencyFailureResult } from "@/lib/dependency-result";
import { isPublicSurfaceVisibleForViewer } from "@/lib/public-surface-visibility";

import { ProjectJoinPanel } from "./components/ProjectJoinPanel";
import { ProjectSponsorPanel } from "./components/ProjectSponsorPanel";
import type { ProjectCardView, ProjectCenterQueryParams, ProjectCenterScope } from "./model";
import { PROJECT_SCOPE_OPTIONS } from "./model";
import { buildProjectHref, getProjectCenterPanel, resolveProjectCollection, resolveProjectScope } from "./server";

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 12px",
  borderRadius: 999,
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const projectBadgeStyles: Record<string, CSSProperties> = {
  success: {
    ...badgeBase,
    background: "rgba(34,197,94,0.16)",
    color: "#86efac",
    border: "1px solid rgba(34,197,94,0.24)",
  },
  warning: {
    ...badgeBase,
    background: "rgba(245,158,11,0.16)",
    color: "#fcd34d",
    border: "1px solid rgba(245,158,11,0.24)",
  },
  cyan: {
    ...badgeBase,
    background: "rgba(6,182,212,0.16)",
    color: "#67e8f9",
    border: "1px solid rgba(6,182,212,0.24)",
  },
  violet: {
    ...badgeBase,
    background: "rgba(139,92,246,0.16)",
    color: "#a78bfa",
    border: "1px solid rgba(139,92,246,0.24)",
  },
  secondary: {
    ...badgeBase,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(220,228,236,0.7)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
};

export type ProjectsPageProps = {
  searchParams?: Promise<ProjectCenterQueryParams>;
};

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

function ProjectPanelIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.5 7.5h13v10h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 5.5h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 11h7M8.5 14.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function resolveFundingState(progressPercent: number) {
  if (progressPercent >= 100) {
    return {
      label: "目标达成",
      note: "当前项目资金目标已经完成，后续重点转向推进与交付。",
      variant: "success" as const,
    };
  }
  if (progressPercent >= 75) {
    return {
      label: "即将达成",
      note: "项目资金已经接近目标，进入收口阶段。",
      variant: "cyan" as const,
    };
  }
  if (progressPercent >= 40) {
    return {
      label: "持续推进",
      note: "项目仍在稳定吸收支持，资金与进度都处于推进态。",
      variant: "warning" as const,
    };
  }
  return {
    label: "早期筹集",
    note: "项目仍处在早期投入阶段，资金增长空间较大。",
    variant: "secondary" as const,
  };
}

function resolveProjectRelationship(project: ProjectCardView) {
  if (project.isOwnedByCurrentUser) {
    return {
      label: "我发起的",
      note: "你是当前项目的发起人。",
      variant: "success" as const,
    };
  }

  if (project.membershipStatus === "active") {
    return {
      label: project.membershipRoleLabel ? `协作中 · ${project.membershipRoleLabel}` : "已加入协作",
      note: project.membershipRoleLabel
        ? `你当前以 ${project.membershipRoleLabel} 身份参与项目。`
        : "你已经加入该项目协作。",
      variant: "violet" as const,
    };
  }

  if (project.membershipStatus === "pending") {
    return {
      label: "加入待审",
      note: "你的加入申请已经提交，等待项目方处理。",
      variant: "warning" as const,
    };
  }

  if (project.membershipStatus === "rejected") {
    return {
      label: "申请未通过",
      note: "你可以调整角色或备注后再次提交申请。",
      variant: "secondary" as const,
    };
  }

  if (project.personalSponsoredAmount > 0) {
    return {
      label: "已赞助",
      note: `你当前已赞助 ${formatNumber(project.personalSponsoredAmount)} ${project.sponsoredCurrencyLabel}。`,
      variant: "cyan" as const,
    };
  }

  return {
    label: "围观中",
    note: "你当前尚未赞助，也未加入该项目。",
    variant: "secondary" as const,
  };
}

function buildCollectionSummary(args: {
  projects: ProjectCardView[];
  scope: ProjectCenterScope;
  currentUserLabel: string;
}) {
  const sponsorOpenCount = args.projects.filter((project) => project.sponsorOpen).length;
  const joinableCount = args.projects.filter((project) => project.joinOpen).length;
  const ownedCount = args.projects.filter((project) => project.isOwnedByCurrentUser).length;
  const memberCount = args.projects.filter((project) => project.membershipStatus === "active").length;
  const pendingCount = args.projects.filter((project) => project.membershipStatus === "pending").length;
  const backedCount = args.projects.filter((project) => project.personalSponsoredAmount > 0).length;
  const aggregateAmount = args.projects.reduce((sum, project) => sum + project.sponsoredAmount, 0);
  const currencyLabel = args.projects[0]?.sponsoredCurrencyLabel ?? "MIRA";

  if (args.scope === "mine") {
    return [
      { label: "发起项目", value: String(ownedCount) },
      { label: "协作中", value: String(memberCount) },
      { label: "待审批", value: String(pendingCount) },
      { label: "当前身份", value: args.currentUserLabel },
    ];
  }

  if (args.scope === "person") {
    return [
      { label: "项目数量", value: String(args.projects.length) },
      { label: "开放赞助", value: String(sponsorOpenCount) },
      { label: "开放加入", value: String(joinableCount) },
      { label: "聚合金额", value: `${formatNumber(aggregateAmount)} ${currencyLabel}` },
    ];
  }

  return [
    { label: "项目数量", value: String(args.projects.length) },
    { label: "开放赞助", value: String(sponsorOpenCount) },
    { label: "开放加入", value: String(joinableCount) },
    { label: "已被我关注", value: String(ownedCount + memberCount + backedCount) },
  ];
}

function ProjectListCard({
  active,
  href,
  project,
}: {
  active: boolean;
  href: string;
  project: ProjectCardView;
}) {
  const relationship = resolveProjectRelationship(project);

  return (
    <Link className={`app-project-rail-card${active ? " app-project-rail-card--active" : ""}`} href={href}>
      <div className="app-project-rail-card__head">
        <div className="app-project-rail-card__stack">
          <span className="app-project-rail-card__kicker">{project.categoryLabel}</span>
          <strong className="app-project-rail-card__title">{project.name}</strong>
          <p className="app-project-rail-card__owner">{project.ownerLabel}</p>
        </div>
        <div className="app-project-rail-card__status">
          <span className="app-project-rail-card__progress">{formatPercent(project.progressPercent)}</span>
        </div>
      </div>

      <p className="app-project-rail-card__summary">{project.summary}</p>

      <div className="app-project-rail-card__tags">
        <span style={projectBadgeStyles.warning}>{project.stageLabel}</span>
        <span style={projectBadgeStyles[relationship.variant]}>{relationship.label}</span>
        {project.sponsorOpen ? <span style={projectBadgeStyles.success}>可赞助</span> : null}
      </div>

      <div className="app-project-rail-card__meta">
        <span>{formatNumber(project.sponsorCount)} 人支持</span>
        <span>
          {formatNumber(project.sponsoredAmount)} / {formatNumber(project.fundingTargetAmount)}{" "}
          {project.sponsoredCurrencyLabel}
        </span>
      </div>

      <div className="app-project-progress">
        <span className="app-project-progress__track">
          <span className="app-project-progress__fill" style={{ width: `${project.progressPercent}%` }} />
        </span>
        <span className="app-project-progress__label">{project.stageLabel}</span>
      </div>
    </Link>
  );
}

export default async function ProjectCenterPage({ searchParams }: ProjectsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const [publicSurfaceResponse] = await Promise.allSettled([getPublicSurfaceSnapshotStrict()]);
  if (publicSurfaceResponse.status === "rejected") {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState
            label="公开入口配置"
            result={createDependencyFailureResult({
              error: publicSurfaceResponse.reason,
              message: "公开入口配置暂不可用。",
              source: "public-surfaces",
              unauthorizedMessage: "当前账户无权读取公开入口配置。",
            })}
          />
        </div>
      </main>
    );
  }
  if (
    !isPublicSurfaceVisibleForViewer(
      publicSurfaceResponse.value,
      "projects",
      session.user.id,
      session.user.providerUserId,
    )
  ) {
    redirect("/dashboard");
  }

  const query = (await searchParams) ?? {};
  const scope = resolveProjectScope(query.scope);
  const panel = await getProjectCenterPanel();
  if (panel.dependency.state === "unavailable" || panel.dependency.state === "unauthorized") {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState label="项目目录" result={panel.dependency} />
        </div>
      </main>
    );
  }
  const collection = resolveProjectCollection({
    ownerParam: query.owner,
    panel,
    scope,
  });

  const selectedProject =
    collection.projects.find((project) => project.id === query.project) ?? collection.projects[0] ?? null;
  const currentUserLabel =
    panel.currentUser?.username ?? session.user.username ?? session.user.name ?? "当前用户";
  const status = typeof query.status === "string" ? query.status : null;
  const message = typeof query.message === "string" ? query.message : null;
  const summaryItems = buildCollectionSummary({
    projects: collection.projects,
    scope,
    currentUserLabel,
  });
  const selectedRelationship = selectedProject ? resolveProjectRelationship(selectedProject) : null;
  const selectedFundingRatio = selectedProject
    ? Math.max(
        0,
        Math.min(100, Math.round((selectedProject.sponsoredAmount / Math.max(selectedProject.fundingTargetAmount, 1)) * 100)),
      )
    : 0;
  const selectedFundingState = resolveFundingState(selectedFundingRatio);
  const remainingFundingAmount = selectedProject
    ? Math.max(0, selectedProject.fundingTargetAmount - selectedProject.sponsoredAmount)
    : 0;
  const personalContributionShare =
    selectedProject && selectedProject.personalSponsoredAmount > 0 && selectedProject.sponsoredAmount > 0
      ? Math.max(1, Math.round((selectedProject.personalSponsoredAmount / selectedProject.sponsoredAmount) * 100))
      : 0;
  const ownerProjectsHref = selectedProject
    ? buildProjectHref({
        owner: selectedProject.ownerHandle,
        project: selectedProject.id,
        scope: "person",
      })
    : null;
  const relatedOwnerProjects = selectedProject
    ? panel.hotProjects
        .filter((project) => project.ownerHandle === selectedProject.ownerHandle && project.id !== selectedProject.id)
        .slice(0, 3)
    : [];
  const collaborationRules = selectedProject
    ? [
        `当前赞助状态：${selectedProject.sponsorStatusLabel}`,
        `当前加入状态：${selectedProject.joinStatusLabel}`,
        `协作方式：${selectedProject.collaborationLabel}`,
        `工作目录：${selectedProject.workspaceLabel}`,
      ]
    : [];

  return (
    <main className="app-page">
      <div aria-label="项目中心" aria-modal="true" className="app-honor-overlay" role="dialog">
        <Link aria-label="返回控制台" className="app-honor-backdrop" href="/dashboard" />

        {status && message ? (
          <div aria-atomic="true" aria-live="polite" className="app-toast-stack">
            <section className={`app-toast app-toast--${status === "success" ? "success" : "error"}`} role="status">
              <div className="app-toast__signal" aria-hidden="true" />
              <div className="app-toast__body">
                <strong className="app-toast__title">{status === "success" ? "操作完成" : "操作失败"}</strong>
                <p className="app-toast__message">{message}</p>
              </div>
              <Link
                aria-label="关闭提示"
                className="app-toast__close"
                href={buildProjectHref({
                  owner: scope === "person" ? collection.activeOwner?.handle ?? query.owner ?? null : null,
                  project: selectedProject?.id ?? null,
                  scope,
                })}
              >
                ×
              </Link>
            </section>
          </div>
        ) : null}

        <section className="app-project-shell">
          {panel.dependency.state === "partial" ? (
            <div style={{ gridColumn: "1 / -1", padding: "16px 20px 0" }}>
              <DependencyState label="项目目录" result={panel.dependency} />
            </div>
          ) : null}
          <aside className="app-project-rail">
            <div className="app-project-rail__head">
              <div className="app-honor__rail-mark" aria-hidden="true">
                <ProjectPanelIcon />
              </div>
              <div className="app-project-rail__copy">
                <h2>项目</h2>
                <p>项目看板 / 众筹详情 / 协作入口</p>
              </div>
            </div>

            <div className="app-project-rail__scope-tabs" role="tablist" aria-label="项目视角切换">
              {PROJECT_SCOPE_OPTIONS.map((option) => (
                <Link
                  aria-selected={scope === option.key}
                  className={`app-project-rail__scope-tab${scope === option.key ? " app-project-rail__scope-tab--active" : ""}`}
                  href={buildProjectHref({
                    owner: option.key === "person" ? collection.activeOwner?.handle ?? query.owner ?? null : null,
                    project: null,
                    scope: option.key,
                  })}
                  key={option.key}
                  role="tab"
                >
                  {option.label}
                </Link>
              ))}
            </div>

            {scope === "person" ? (
              <section className="mg-terminal-rail-card app-project-rail__owner-card">
                <div className="app-project-rail__owner-head">
                  <div>
                    <h3 className="mg-card__title">查看某人</h3>
                    <p className="app-project-rail__summary-copy">
                      当前用于查看指定负责人名下的公开项目。
                    </p>
                  </div>
                  <span>{collection.activeOwner?.label ?? "未指定"}</span>
                </div>

                <form action="/projects" className="app-project-owner-form" method="get">
                  <input name="scope" type="hidden" value="person" />
                  <input
                    className="app-project-owner-form__input"
                    defaultValue={collection.activeOwner?.handle ?? query.owner ?? ""}
                    name="owner"
                    placeholder="输入用户名"
                    type="text"
                  />
                  <button className="mg-btn mg-btn--glass" type="submit">
                    查看
                  </button>
                </form>

                <div className="app-project-owner-chips">
                  {panel.ownerDirectory.map((owner) => (
                    <Link
                      className={`app-project-owner-chips__item${collection.activeOwner?.handle === owner.handle ? " app-project-owner-chips__item--active" : ""}`}
                      href={buildProjectHref({ owner: owner.handle, project: null, scope: "person" })}
                      key={owner.handle}
                    >
                      {owner.label}
                    </Link>
                  ))}
                </div>

                <div className="app-project-rail__summary-grid">
                  {summaryItems.map((item) => (
                    <div className="app-project-rail__summary-cell" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="mg-terminal-rail-card app-project-rail__summary-card">
                <div className="app-project-rail__owner-head">
                  <div>
                    <h3 className="mg-card__title">{collection.scopeLabel}</h3>
                    <p className="app-project-rail__summary-copy">
                      {scope === "mine"
                        ? "汇总你发起、已参与或已经赞助过的项目。"
                        : "按公开热度与当前资金关注度展示平台项目。"}
                    </p>
                  </div>
                  <span>{collection.projects.length} 项</span>
                </div>
                <div className="app-project-rail__summary-grid">
                  {summaryItems.map((item) => (
                    <div className="app-project-rail__summary-cell" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mg-terminal-rail-card app-project-rail__list-shell">
              <div className="app-project-rail__list-head">
                <h3 className="mg-card__title">{collection.scopeLabel}</h3>
                <span>{collection.projects.length} 项</span>
              </div>

              {collection.projects.length > 0 ? (
                <div className="app-project-rail__list">
                  {collection.projects.map((project) => (
                    <ProjectListCard
                      active={selectedProject?.id === project.id}
                      href={buildProjectHref({
                        owner: scope === "person" ? collection.activeOwner?.handle ?? null : null,
                        project: project.id,
                        scope,
                      })}
                      key={project.id}
                      project={project}
                    />
                  ))}
                </div>
              ) : (
                <div className="app-project-empty-state">
                  <strong>暂无项目</strong>
                  <p>{collection.emptyLabel}</p>
                </div>
              )}
            </section>
          </aside>

          <section className="app-project-content">
            <div className="app-project-content__close-row">
              <Link aria-label="关闭项目面板" className="app-honor-close" href="/dashboard">
                <CloseIcon />
              </Link>
            </div>

            {selectedProject ? (
              <div className="app-project-detail">
                <header className="mg-terminal-section app-project-detail__hero">
                  <div className="app-project-detail__hero-main">
                    <div className="app-project-detail__hero-copy">
                      <p className="mg-terminal-kicker">{collection.scopeLabel}</p>
                      <h1 className="app-project-detail__title">{selectedProject.name}</h1>
                      <p className="app-project-detail__summary">{selectedProject.summary}</p>

                      <div className="app-project-detail__badges">
                        <span style={projectBadgeStyles.warning}>{selectedProject.categoryLabel}</span>
                        <span style={projectBadgeStyles.cyan}>{selectedProject.stageLabel}</span>
                        <span style={projectBadgeStyles[selectedProject.sponsorOpen ? "success" : "warning"]}>
                          {selectedProject.sponsorStatusLabel}
                        </span>
                        <span style={projectBadgeStyles[selectedProject.joinOpen ? "violet" : "secondary"]}>
                          {selectedProject.joinStatusLabel}
                        </span>
                        {selectedRelationship ? (
                          <span style={projectBadgeStyles[selectedRelationship.variant]}>{selectedRelationship.label}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="app-project-detail__fact-grid">
                      <article className="app-project-detail__fact-card">
                        <span>发起人</span>
                        <strong>{selectedProject.ownerLabel}</strong>
                        <p>{selectedProject.categoryLabel}</p>
                      </article>
                      <article className="app-project-detail__fact-card">
                        <span>协作方式</span>
                        <strong>{selectedProject.collaborationLabel}</strong>
                        <p>{selectedProject.joinStatusLabel}</p>
                      </article>
                      <article className="app-project-detail__fact-card">
                        <span>我的位置</span>
                        <strong>{selectedRelationship?.label ?? "围观中"}</strong>
                        <p>{selectedRelationship?.note ?? "当前尚未与该项目建立关系。"}</p>
                      </article>
                      <article className="app-project-detail__fact-card">
                        <span>工作目录</span>
                        <strong>{selectedProject.workspaceLabel}</strong>
                        <p>当前以外部仓库方式协作。</p>
                      </article>
                    </div>
                  </div>

                  <aside className="app-project-detail__hero-command">
                    <div className="app-project-detail__hero-metrics">
                      <div className="app-project-metric-card">
                        <span>开发进度</span>
                        <strong>{formatPercent(selectedProject.progressPercent)}</strong>
                        <p>{selectedProject.progressLabel}</p>
                      </div>
                      <div className="app-project-metric-card">
                        <span>资金完成度</span>
                        <strong>{formatPercent(selectedFundingRatio)}</strong>
                        <p>
                          {formatNumber(selectedProject.sponsoredAmount)} /{" "}
                          {formatNumber(selectedProject.fundingTargetAmount)} {selectedProject.sponsoredCurrencyLabel}
                        </p>
                      </div>
                      <div className="app-project-metric-card">
                        <span>当前赞助</span>
                        <strong>
                          {formatNumber(selectedProject.sponsoredAmount)} {selectedProject.sponsoredCurrencyLabel}
                        </strong>
                        <p>{selectedProject.sponsorCount} 人支持</p>
                      </div>
                      <div className="app-project-metric-card">
                        <span>回报承诺</span>
                        <strong>{selectedProject.rewardShareLabel}</strong>
                        <p>项目成功后按承诺方案结算。</p>
                      </div>
                    </div>

                    <div className="app-project-hero-actions">
                      <Link
                        className="mg-btn mg-btn--glass"
                        href={selectedProject.workspaceHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开工作目录
                      </Link>
                      {ownerProjectsHref ? (
                        <Link className="mg-btn mg-btn--glass" href={ownerProjectsHref}>
                          查看同发起人项目
                        </Link>
                      ) : null}
                      <a className="mg-btn mg-btn--secondary" href="#project-actions">
                        前往操作区
                      </a>
                    </div>
                  </aside>
                </header>

                <section className="app-project-detail__insight-board">
                  <article className="mg-terminal-section app-project-detail__insight-card">
                    <div className="app-project-detail__section-head">
                      <h2>资金结构</h2>
                      <span style={projectBadgeStyles[selectedFundingState.variant]}>{selectedFundingState.label}</span>
                    </div>
                    <p className="app-project-detail__body">{selectedFundingState.note}</p>
                    <div className="app-project-detail__insight-metrics">
                      <div className="app-project-detail__snapshot-item">
                        <span>目标差额</span>
                        <strong>
                          {formatNumber(remainingFundingAmount)} {selectedProject.fundingTargetCurrencyLabel}
                        </strong>
                      </div>
                      <div className="app-project-detail__snapshot-item">
                        <span>当前完成</span>
                        <strong>{formatPercent(selectedFundingRatio)}</strong>
                      </div>
                      <div className="app-project-detail__snapshot-item">
                        <span>我的占比</span>
                        <strong>
                          {personalContributionShare > 0 ? `${personalContributionShare}%` : "未参与资金"}
                        </strong>
                      </div>
                    </div>
                  </article>

                  <article className="mg-terminal-section app-project-detail__insight-card">
                    <div className="app-project-detail__section-head">
                      <h2>协作规则</h2>
                      <span style={projectBadgeStyles[selectedProject.joinOpen ? "violet" : "secondary"]}>
                        {selectedProject.joinOpen ? "可加入" : "暂不开放"}
                      </span>
                    </div>
                    <ul className="app-project-detail__rule-list">
                      {collaborationRules.map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                    <p className="app-project-detail__body">
                      {selectedRelationship?.note ?? "你当前尚未与该项目建立明确关系。"}
                    </p>
                  </article>

                  <article className="mg-terminal-section app-project-detail__insight-card">
                    <div className="app-project-detail__section-head">
                      <h2>同发起人项目</h2>
                      <span>{selectedProject.ownerLabel}</span>
                    </div>
                    {relatedOwnerProjects.length > 0 ? (
                      <div className="app-project-related-list">
                        {relatedOwnerProjects.map((project) => (
                          <Link
                            className="app-project-related-card"
                            href={buildProjectHref({
                              owner: scope === "person" ? collection.activeOwner?.handle ?? project.ownerHandle : project.ownerHandle,
                              project: project.id,
                              scope: scope === "person" ? "person" : "hot",
                            })}
                            key={project.id}
                          >
                            <strong>{project.name}</strong>
                            <span>{project.stageLabel}</span>
                            <p>{project.summary}</p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="app-project-detail__body">当前没有同发起人的其他公开项目。</p>
                    )}
                  </article>
                </section>

                <div className="app-project-detail__columns">
                  <section className="mg-terminal-section app-project-detail__section">
                    <div className="app-project-detail__section-head">
                      <h2>项目说明</h2>
                      <span>{selectedProject.ownerLabel}</span>
                    </div>
                    <p className="app-project-detail__body">{selectedProject.detailBody}</p>
                    <div className="app-project-progress app-project-progress--detail">
                      <span className="app-project-progress__track">
                        <span className="app-project-progress__fill" style={{ width: `${selectedProject.progressPercent}%` }} />
                      </span>
                      <span className="app-project-progress__label">{selectedProject.progressLabel}</span>
                    </div>

                    <div className="app-project-detail__info-grid">
                      <article className="app-project-detail__info-card">
                        <span>当前阶段</span>
                        <strong>{selectedProject.stageLabel}</strong>
                        <p>项目推进以当前阶段为主导。</p>
                      </article>
                      <article className="app-project-detail__info-card">
                        <span>资金规模</span>
                        <strong>
                          {formatNumber(selectedProject.fundingTargetAmount)} {selectedProject.fundingTargetCurrencyLabel}
                        </strong>
                        <p>当前展示的是项目目标资金规模。</p>
                      </article>
                      <article className="app-project-detail__info-card">
                        <span>协作入口</span>
                        <strong>{selectedProject.joinStatusLabel}</strong>
                        <p>{selectedProject.collaborationLabel}</p>
                      </article>
                      <article className="app-project-detail__info-card">
                        <span>收益方案</span>
                        <strong>{selectedProject.rewardShareLabel}</strong>
                        <p>当前以项目成功后的阶段性回报为准。</p>
                      </article>
                    </div>
                  </section>

                  <aside className="mg-terminal-section app-project-detail__sidecard">
                    <div className="app-project-detail__section-head">
                      <h2>我的参与位</h2>
                      <span>{selectedRelationship?.label ?? "围观中"}</span>
                    </div>
                    <div className="app-project-detail__snapshot">
                      <div className="app-project-detail__snapshot-item">
                        <span>发起人</span>
                        <strong>{selectedProject.ownerLabel}</strong>
                      </div>
                      <div className="app-project-detail__snapshot-item">
                        <span>我已赞助</span>
                        <strong>
                          {formatNumber(selectedProject.personalSponsoredAmount)} {selectedProject.sponsoredCurrencyLabel}
                        </strong>
                      </div>
                      <div className="app-project-detail__snapshot-item">
                        <span>加入状态</span>
                        <strong>{selectedProject.joinStatusLabel}</strong>
                      </div>
                      <div className="app-project-detail__snapshot-item">
                        <span>当前角色</span>
                        <strong>{selectedProject.membershipRoleLabel ?? "未加入"}</strong>
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="app-project-detail__action-grid" id="project-actions">
                  <ProjectSponsorPanel
                    currentSponsoredAmount={selectedProject.sponsoredAmount}
                    currencyLabel={selectedProject.sponsoredCurrencyLabel}
                    ownerHandle={scope === "person" ? collection.activeOwner?.handle ?? null : null}
                    personalSponsoredAmount={selectedProject.personalSponsoredAmount}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    scope={scope}
                    sponsorOpen={selectedProject.sponsorOpen}
                  />
                  <ProjectJoinPanel
                    joinOpen={selectedProject.joinOpen}
                    membershipRoleLabel={selectedProject.membershipRoleLabel}
                    membershipStatus={selectedProject.membershipStatus}
                    ownerHandle={scope === "person" ? collection.activeOwner?.handle ?? null : null}
                    projectId={selectedProject.id}
                    projectName={selectedProject.name}
                    scope={scope}
                  />
                </div>

                <section className="mg-terminal-section app-project-detail__section">
                  <div className="app-project-detail__section-head">
                    <h2>阶段推进</h2>
                    <span>{selectedProject.stageLabel}</span>
                  </div>
                  <div className="app-project-milestones">
                    {selectedProject.milestoneItems.map((milestone) => (
                      <article
                        className={`app-project-milestones__item app-project-milestones__item--${milestone.status}`}
                        key={milestone.key}
                      >
                        <div className="app-project-milestones__pill">
                          {milestone.status === "done"
                            ? "已完成"
                            : milestone.status === "active"
                              ? "进行中"
                              : "待开始"}
                        </div>
                        <div>
                          <strong>{milestone.label}</strong>
                          <p>{milestone.note}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <section className="mg-terminal-section app-project-empty-state app-project-empty-state--board">
                <strong>暂无项目</strong>
                <p>{collection.emptyLabel}</p>
              </section>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
