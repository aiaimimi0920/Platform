import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  AccountCenterAvatarStage,
  AccountCenterFrame,
} from "@/components/account-home/account-center-frame";
import {
  AccountHomeActionGrid,
  AccountHomeActionTile,
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeRailCard,
  AccountHomeSection,
  AccountHomeSectionHead,
  AccountHomeStat,
  AccountHomeStatGrid,
} from "@/components/account-home/templates";
import { Badge } from "@/components/ui/badge";
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import { getCurrentUser } from "@/lib/account-client";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/core-client";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";
import { isDevAuthBypassProviderUserId, isPlatformOperatorUserId } from "@/lib/platform-session";

type DashboardPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;

  const isOperator = isPlatformOperatorUserId(session.user.id, session.user.providerUserId);
  const isDevBypassSession = isDevAuthBypassProviderUserId(session.user.providerUserId);
  const showOpsCenterFab = isOperator || isDevBypassSession;
  const opsCenterBadge = isDevBypassSession ? "DEV ACCESS" : "OPERATOR ACCESS";
  const opsCenterHint = isDevBypassSession ? "本地调试 / 开发者入口" : "平台管理员入口";

  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };

  const [features, publicSurfaces, user] = await Promise.all([
    getFeatureSnapshot(),
    getPublicSurfaceSnapshot(),
    getCurrentUser(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  const accountDisplayName = user.username || session.user.username || "NeuroLoom User";
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const progression = user.snapshot?.progression ?? null;
  const agentsSnapshot = user.snapshot?.agents ?? null;
  const assetsSnapshot = user.snapshot?.assets ?? null;
  const mailboxUnreadCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
  const featureSnapshotUnavailable = isFeatureSnapshotUnavailable(features);
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );
  const visibleSurfaceCount = Object.values(publicSurfaces).filter((surface) => surface.enabled).length;
  const navItems = buildAccountCenterNavItems({
    active: "dashboard",
    mailboxUnreadCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletSnapshot?.recentEntryCount ?? 0,
    reputation: null,
    visibility: accountCenterVisibility,
  });
  const hudItems = buildAccountHudItems({
    mailboxUnreadCount,
    pendingAttachmentCount,
    progression,
    wallet: null,
    walletSnapshot,
  });

  const quickActions = [
    {
      accent: "signal" as const,
      description: "查看三货币余额、冻结金额与最近账本流水。",
      href: "/wallet",
      title: "钱包与账本",
      visible: isPublicSurfaceVisibleForViewer(publicSurfaces, "wallet", session.user.id, session.user.providerUserId),
    },
    {
      accent: "cyan" as const,
      description: "检查持有资产、订单历史与可挂牌商品。",
      href: "/inventory",
      title: "资产库存",
      visible: isPublicSurfaceVisibleForViewer(publicSurfaces, "inventory", session.user.id, session.user.providerUserId),
    },
    {
      accent: "ink" as const,
      description: "进入个人任务、发布记录与承接进度。",
      href: "/my-tasks",
      title: "我的任务",
      visible: isPublicSurfaceVisibleForViewer(publicSurfaces, "tasks", session.user.id, session.user.providerUserId),
    },
    {
      accent: "ink" as const,
      description: "管理个人智能体、能力与回调健康状态。",
      href: "/my-agents",
      title: "我的 Agents",
      visible: isPublicSurfaceVisibleForViewer(publicSurfaces, "agents", session.user.id, session.user.providerUserId),
    },
    {
      accent: "cyan" as const,
      description: "配置真实邮箱身份与 Email-Native 入口。",
      href: "/email-access",
      title: "邮箱身份",
      visible: true,
    },
    {
      accent: "signal" as const,
      description: "查看 AI 工单、补充上下文并追踪执行状态。",
      href: "/tea",
      title: "AI 工单",
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <main className="app-page app-page--dashboard">
      <div className="mg-shell app-stack app-stack--dashboard" style={{ paddingBottom: "120px" }}>
        {status && message ? (
          <section style={{ maxWidth: 780 }}>
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </section>
        ) : null}

        <AccountCenterFrame
          actions={
            <>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "wallet", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--primary" href="/wallet">打开钱包</Link>
              ) : null}
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "inventory", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--secondary" href="/inventory">查看资产</Link>
              ) : null}
              <Link className="mg-btn mg-btn--glass" href="/tea">提交工单</Link>
            </>
          }
          description="控制台是账户域的 Layer 1 入口：汇总钱包、邮箱、任务、资产、智能体和工单，并把常用终端入口固定在同一块本地优先操作面板中。"
          focusItems={[
            { label: "成长等级", value: progression ? `Lv.${progression.level}` : "未读取" },
            { label: "未读消息", value: formatAccountNumber(mailboxUnreadCount) },
            { label: "活跃资产", value: formatAccountNumber(assetsSnapshot?.activeItems ?? 0) },
            { label: "启用 Agent", value: formatAccountNumber(agentsSnapshot?.enabledAgents ?? 0) },
          ]}
          hudItems={hudItems}
          kicker="Account Terminal"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="Session" title="当前身份" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{user.provider}</span>} title="登录来源" />
                <AccountHomeListRow aside={<span className="app-note">{user.trustLevel ?? "未同步"}</span>} title="Trust Level" />
                <AccountHomeListRow aside={<span className="app-note">{formatAccountDateTime(user.lastLoginAt)}</span>} title="最近登录" />
                <AccountHomeListRow
                  aside={<span className="app-note">{featureSnapshotUnavailable ? "降级" : "正常"}</span>}
                  title="模块快照"
                />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "开放入口", value: formatAccountNumber(visibleSurfaceCount) },
            { label: "账本流水", value: formatAccountNumber(walletSnapshot?.recentEntryCount ?? 0) },
            { label: "待领附件", value: formatAccountNumber(pendingAttachmentCount) },
            { label: "总 Agent", value: formatAccountNumber(agentsSnapshot?.totalAgents ?? 0) },
          ]}
          stage={
            <div className="app-dashboard-stage">
              <div className="app-dashboard-stage__grid" />
              <div className="app-dashboard-stage__signal" />
              <div className="app-dashboard-stage__identity">
                <span className="app-dashboard-stage__kicker">Local-first account</span>
                <strong className="app-dashboard-stage__name">{accountDisplayName}</strong>
                <span className="app-dashboard-stage__meta">{session.user.providerUserId}</span>
              </div>
              <AccountCenterAvatarStage
                alt={`${accountDisplayName} avatar`}
                avatarUrl={accountAvatarUrl}
                fallback={userInitial}
              />
              <div className="app-dashboard-stage__readout" aria-label="账户终端状态">
                <span>{featureSnapshotUnavailable ? "CORE DEGRADED" : "CORE ONLINE"}</span>
                <span>{showOpsCenterFab ? "OPS READY" : "USER MODE"}</span>
                <span>{pendingAttachmentCount > 0 ? "CLAIM WAITING" : "CLEAR"}</span>
              </div>
            </div>
          }
          title="账户终端"
          titleBadges={
            <>
              <Badge variant="warning">Layer 1</Badge>
              <Badge variant={featureSnapshotUnavailable ? "danger" : "success"}>
                {featureSnapshotUnavailable ? "Core degraded" : "Core online"}
              </Badge>
              {showOpsCenterFab ? <Badge variant="cyan">{opsCenterBadge}</Badge> : null}
            </>
          }
        >
          <AccountHomeSection>
            <AccountHomeSectionHead kicker="Launch Board" title="常用入口" />
            <AccountHomeActionGrid>
              {quickActions.map((action) => (
                <AccountHomeActionTile
                  accent={action.accent}
                  description={action.description}
                  href={action.href}
                  key={action.href}
                  title={action.title}
                />
              ))}
            </AccountHomeActionGrid>
          </AccountHomeSection>

          <AccountHomeSection>
            <AccountHomeSectionHead kicker="Account Snapshot" title="账户域摘要" />
            <AccountHomeStatGrid>
              <AccountHomeStat label="资产总数" value={formatAccountNumber(assetsSnapshot?.totalItems ?? 0)} />
              <AccountHomeStat label="挂牌资产" value={formatAccountNumber(assetsSnapshot?.listedItems ?? 0)} />
              <AccountHomeStat label="Agent 能力" value={formatAccountNumber(agentsSnapshot?.capabilityCount ?? 0)} />
              <AccountHomeStat label="活跃执行" value={formatAccountNumber(agentsSnapshot?.activeExecutions ?? 0)} />
              <AccountHomeStat label="总消息" value={formatAccountNumber(mailboxSnapshot?.totalMessages ?? 0)} />
              <AccountHomeStat label="成长 XP" value={formatAccountNumber(progression?.experience ?? 0)} />
            </AccountHomeStatGrid>
          </AccountHomeSection>
        </AccountCenterFrame>
      </div>
      {showOpsCenterFab ? (
        <div className="nt-dashboard-ops-fab-wrap">
          <Link
            aria-label="进入运维中心"
            className="nt-btn nt-btn--primary nt-dashboard-ops-fab"
            href="/ops/gateway/providers"
            title={opsCenterHint}
          >
            <span className="nt-dashboard-ops-fab__kicker">{opsCenterBadge}</span>
            <span className="nt-dashboard-ops-fab__title">运维中心</span>
            <span className="nt-dashboard-ops-fab__hint">{opsCenterHint}</span>
          </Link>
        </div>
      ) : null}
    </main>
  );
}
