import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  AccountCenterAvatarStage,
  AccountCenterFrame,
} from "@/components/account-home/account-center-frame";
import {
  AccountHomeList,
  AccountHomeListRow,
  AccountHomeRailCard,
  AccountHomeSection,
  AccountHomeSectionHead,
  AccountHomeStat,
  AccountHomeStatGrid,
} from "@/components/account-home/templates";
import { PublicSurfaceDependencyState } from "@/components/public-surface-dependency-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import { getCurrentUser, getEmailNativePanel } from "@/lib/account-client";
import { getFeatureSnapshot, isFeatureSnapshotUnavailable } from "@/lib/platform-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";

import {
  confirmEmailIdentityVerificationAction,
  removeEmailIdentityAction,
  setPrimaryEmailIdentityAction,
  startEmailIdentityVerificationAction,
} from "./actions";

type EmailAccessPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function getRequestStatusBadge(status: string) {
  if (status === "accepted") return "success";
  if (status === "duplicate") return "warning";
  return "danger";
}

function formatEmailDeliveryMode(mode: string) {
  if (mode === "smtp") return "邮件投递";
  if (mode === "console") return "控制台记录";
  return "当前模式";
}

function formatEmailRouteKind(routeKind: string | null) {
  if (routeKind === "agent_execution") return "智能体调用";
  if (routeKind === "task_create") return "任务创建";
  return "未识别入口";
}

function formatEmailInboundStatus(status: string) {
  if (status === "accepted") return "已接收";
  if (status === "duplicate") return "重复忽略";
  if (status === "rejected") return "已拒绝";
  return "待确认";
}

function formatEmailPricingMode(mode: string) {
  if (mode === "flat_task") return "固定奖励";
  if (mode === "token_metered") return "按 Token 计量";
  if (mode === "property_metered") return "按属性计量";
  return "当前计价";
}

function formatEmailOperationMode(mode: string) {
  if (mode === "automatic") return "自动流转";
  if (mode === "manual") return "人工确认";
  return "当前流转";
}

export async function AccountEmailAccessPage({ searchParams }: EmailAccessPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const status = params?.status === "success" ? "success" : params?.status === "error" ? "error" : null;
  const message = params?.message ?? null;

  const userContext = {
    userId: session.user.id,
    username: session.user.username,
  };

  const [features, publicSurfaceDependency, user, panel] = await Promise.all([
    getFeatureSnapshot(),
    loadPublicSurfaceDependency(),
    getCurrentUser(userContext),
    getEmailNativePanel(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;

  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法读取模块快照，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }

  if (!features.identity.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">身份模块已关闭</h1>
            <p className="mg-copy">当前无法管理邮件调用入口，因为账户身份模块尚未启用。</p>
          </Card>
        </div>
      </main>
    );
  }

  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const progression = user.snapshot?.progression ?? null;
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const accountDisplayName = user.username || session.user.username;
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const unreadMailboxCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
  const deliveryModeLabel = formatEmailDeliveryMode(panel.deliveryMode);
  const taskDefaults = panel.routeCatalog.taskDefaults;

  const hudItems = buildAccountHudItems({
    wallet: null,
    walletSnapshot,
    progression,
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
  });
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );

  const navItems = buildAccountCenterNavItems({
    active: "emailAccess",
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletSnapshot?.recentEntryCount ?? 0,
    reputation: null,
    visibility: accountCenterVisibility,
  });

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        {status && message ? (
          <Card className="app-stack">
            <p className={status === "success" ? "app-banner app-banner--success" : "app-banner app-banner--error"}>
              {message}
            </p>
          </Card>
        ) : null}

        <AccountCenterFrame
          actions={
            <>
              <Link className="mg-btn mg-btn--primary" href="/dashboard">返回总览</Link>
              <a className="mg-btn mg-btn--glass" href="#email-bind">绑定邮箱</a>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "mailbox", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--secondary" href="/mailbox">进入站内邮箱</Link>
              ) : null}
            </>
          }
          description="邮件调用入口把真实世界邮箱变成平台外部调用面。这里负责绑定、验证、默认地址管理，以及查看最近的邮件触发记录。"
          focusItems={[
            { label: "已验证地址", value: formatAccountNumber(panel.identities.length) },
            { label: "待验证", value: formatAccountNumber(panel.pendingVerifications.length) },
            { label: "最近请求", value: formatAccountNumber(panel.recentInboundMessages.length) },
            { label: "投递模式", value: deliveryModeLabel },
          ]}
          hudItems={hudItems}
          kicker="邮件入口"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
          <AccountHomeSectionHead kicker="入口模式" title="入口模式" />
              <AccountHomeList>
                {panel.routeCatalog.instructions.map((instruction) => (
                  <AccountHomeListRow
                    key={instruction.addressPattern}
                    aside={<span className="app-note">{formatEmailRouteKind(instruction.routeKind)}</span>}
                    title={instruction.addressPattern}
                    subtitle={instruction.title}
                  />
                ))}
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "已验证", value: formatAccountNumber(panel.identities.length) },
            { label: "待验证", value: formatAccountNumber(panel.pendingVerifications.length) },
            { label: "邮件请求", value: formatAccountNumber(panel.recentInboundMessages.length) },
            { label: "模式", value: deliveryModeLabel },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="邮箱身份与邮件调用入口"
          titleBadges={
            <>
              <Badge variant="cyan">邮件调用入口</Badge>
              <Badge variant="violet">{deliveryModeLabel}</Badge>
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection id="email-bind">
          <AccountHomeSectionHead kicker="邮箱绑定" title="绑定真实邮箱" />
                <div className="app-account-subgrid">
                  <Card className="app-account-support-card">
          <AccountHomeSectionHead kicker="步骤一" title="发送验证码" />
                    <form action={startEmailIdentityVerificationAction} className="app-account-inline-form">
                      <Input
                        className="app-account-inline-form__input"
                        name="email"
                        placeholder="输入真实邮箱地址"
                        required
                        type="email"
                      />
                      <label className="app-note" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input name="makePrimary" type="checkbox" />
                        设为默认邮箱
                      </label>
                      <button className="mg-btn mg-btn--primary" type="submit">发送验证码</button>
                    </form>
                  </Card>

                  <Card className="app-account-support-card">
          <AccountHomeSectionHead kicker="步骤二" title="确认验证码" />
                    <form action={confirmEmailIdentityVerificationAction} className="app-account-inline-form">
                      <Input
                        className="app-account-inline-form__input"
                        name="email"
                        placeholder="再次输入邮箱地址"
                        required
                        type="email"
                      />
                      <Input
                        className="app-account-inline-form__input"
                        name="code"
                        placeholder="输入 6 位验证码"
                        required
                        type="text"
                      />
                      <button className="mg-btn mg-btn--secondary" type="submit">确认绑定</button>
                    </form>
                  </Card>
                </div>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="邮箱身份" title="已验证邮箱身份" />
                {panel.identities.length === 0 ? (
                  <p className="mg-copy">当前还没有已验证的真实邮箱地址。</p>
                ) : (
                  <AccountHomeList>
                    {panel.identities.map((identity) => (
                      <AccountHomeListRow
                        key={identity.id}
                        aside={
                          <div className="app-account-ledger-aside">
                            {identity.isPrimary ? <Badge variant="warning">默认</Badge> : null}
                            <Badge variant={identity.invocationEnabled ? "cyan" : "danger"}>
                              {identity.invocationEnabled ? "可调用" : "已锁定"}
                            </Badge>
                            {!identity.isPrimary ? (
                              <form action={setPrimaryEmailIdentityAction}>
                                <input name="identityId" type="hidden" value={identity.id} />
                                <button className="mg-btn mg-btn--outline" type="submit">设为默认</button>
                              </form>
                            ) : null}
                            <form action={removeEmailIdentityAction}>
                              <input name="identityId" type="hidden" value={identity.id} />
                              <button className="mg-btn mg-btn--glass" type="submit">移除</button>
                            </form>
                          </div>
                        }
                        title={identity.email}
                        subtitle={`验证于 ${formatAccountDateTime(identity.verifiedAt)} · 最后使用 ${formatAccountDateTime(identity.lastUsedAt)}`}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="最近入口" title="最近邮件入口记录" />
                {panel.recentInboundMessages.length === 0 ? (
                  <p className="mg-copy">当前还没有邮件调用记录。</p>
                ) : (
                  <AccountHomeList>
                    {panel.recentInboundMessages.map((message) => (
                      <AccountHomeListRow
                        key={message.id}
                        aside={<Badge variant={getRequestStatusBadge(message.status)}>{formatEmailInboundStatus(message.status)}</Badge>}
                        title={message.subject || message.toEmail}
                        subtitle={[
                          `${message.fromEmail} -> ${message.toEmail}`,
                          message.routeKind ? `入口 ${formatEmailRouteKind(message.routeKind)}` : null,
                          message.createdExecutionId ? `执行 ${message.createdExecutionId}` : null,
                          message.createdTaskId ? `任务 ${message.createdTaskId}` : null,
                          message.rejectionReason || null,
                        ].filter(Boolean).join(" · ")}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
          <AccountHomeSectionHead kicker="待验证" title="待验证邮箱" />
                {panel.pendingVerifications.length === 0 ? (
                  <p className="mg-copy">当前没有待确认的验证码。</p>
                ) : (
                  <AccountHomeList>
                    {panel.pendingVerifications.map((verification) => (
                      <AccountHomeListRow
                        key={verification.id}
                        aside={<span className="app-note">{verification.markAsPrimary ? "默认候选" : "验证中"}</span>}
                        title={verification.email}
                        subtitle={`发起于 ${formatAccountDateTime(verification.requestedAt)} · 到期 ${formatAccountDateTime(verification.expiresAt)}`}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="入口规则" title="邮件入口规则" />
                <AccountHomeList>
                  {panel.routeCatalog.instructions.map((instruction) => (
                    <AccountHomeListRow
                      key={instruction.addressPattern}
                      aside={<Badge variant="violet">{formatEmailRouteKind(instruction.routeKind)}</Badge>}
                      title={instruction.addressPattern}
                      subtitle={instruction.description}
                    />
                  ))}
                </AccountHomeList>
                <p className="app-note">
                  任务默认值：{taskDefaults.rewardAmount} {taskDefaults.rewardCurrency}
                  {" · "}
                  {formatEmailPricingMode(taskDefaults["pricingMode"])}
                  {" · "}
                  {formatEmailOperationMode(taskDefaults["operationMode"])}
                </p>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="头字段" title="支持的头字段" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="智能体字段" value="标题 / 能力 / 运行档案" />
                  <AccountHomeStat label="任务字段" value="奖励 / 计价 / 能力" />
                  <AccountHomeStat label="入口域名" value={`@${panel.routeCatalog.ingressDomain}`} />
                  <AccountHomeStat label="投递模式" value={deliveryModeLabel} />
                </AccountHomeStatGrid>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
