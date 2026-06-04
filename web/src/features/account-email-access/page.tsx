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
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/platform-client";
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

  const [features, publicSurfaces, user, panel] = await Promise.all([
    getFeatureSnapshot(),
    getPublicSurfaceSnapshot(),
    getCurrentUser(userContext),
    getEmailNativePanel(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

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
            <h1 className="mg-title">Identity 模块已关闭</h1>
            <p className="mg-copy">当前无法管理 Email-Native 入口，因为账户身份模块尚未启用。</p>
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
          description="Email-Native 入口把真实世界邮箱变成平台外部调用面。这里负责绑定、验证、默认地址管理，以及查看最近的邮件触发记录。"
          focusItems={[
            { label: "已验证地址", value: formatAccountNumber(panel.identities.length) },
            { label: "待验证", value: formatAccountNumber(panel.pendingVerifications.length) },
            { label: "最近请求", value: formatAccountNumber(panel.recentInboundMessages.length) },
            { label: "投递模式", value: panel.deliveryMode.toUpperCase() },
          ]}
          hudItems={hudItems}
          kicker="Email-Native"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="Routes" title="入口模式" />
              <AccountHomeList>
                {panel.routeCatalog.instructions.map((instruction) => (
                  <AccountHomeListRow
                    key={instruction.routeKind}
                    aside={<span className="app-note">{instruction.routeKind}</span>}
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
            { label: "模式", value: panel.deliveryMode.toUpperCase() },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="邮箱身份与 Email-Native 接入"
          titleBadges={
            <>
              <Badge variant="cyan">Email-Native</Badge>
              <Badge variant="violet">{panel.deliveryMode.toUpperCase()}</Badge>
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection id="email-bind">
                <AccountHomeSectionHead kicker="Bind" title="绑定真实邮箱" />
                <div className="app-account-subgrid">
                  <Card className="app-account-support-card">
                    <AccountHomeSectionHead kicker="Step 1" title="发送验证码" />
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
                    <AccountHomeSectionHead kicker="Step 2" title="确认验证码" />
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
                <AccountHomeSectionHead kicker="Identities" title="已验证邮箱身份" />
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
                              {identity.invocationEnabled ? "CALL" : "LOCK"}
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
                <AccountHomeSectionHead kicker="Recent Ingress" title="最近邮件入口记录" />
                {panel.recentInboundMessages.length === 0 ? (
                  <p className="mg-copy">当前还没有 Email-Native 调用记录。</p>
                ) : (
                  <AccountHomeList>
                    {panel.recentInboundMessages.map((message) => (
                      <AccountHomeListRow
                        key={message.id}
                        aside={<Badge variant={getRequestStatusBadge(message.status)}>{message.status}</Badge>}
                        title={message.subject || message.toEmail}
                        subtitle={[
                          `${message.fromEmail} -> ${message.toEmail}`,
                          message.routeKind ? `路由 ${message.routeKind}` : null,
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
                <AccountHomeSectionHead kicker="Pending" title="待验证邮箱" />
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
                <AccountHomeSectionHead kicker="Route Catalog" title="邮件入口规则" />
                <AccountHomeList>
                  {panel.routeCatalog.instructions.map((instruction) => (
                    <AccountHomeListRow
                      key={instruction.routeKind}
                      aside={<Badge variant="violet">{instruction.routeKind}</Badge>}
                      title={instruction.addressPattern}
                      subtitle={instruction.description}
                    />
                  ))}
                </AccountHomeList>
                <p className="app-note">
                  任务默认值：{panel.routeCatalog.taskDefaults.rewardAmount} {panel.routeCatalog.taskDefaults.rewardCurrency}
                  {" · "}
                  {panel.routeCatalog.taskDefaults.pricingMode}
                  {" · "}
                  {panel.routeCatalog.taskDefaults.operationMode}
                </p>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Metadata" title="支持的头字段" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="Agent" value="title / capabilityId / runtimeProfileKey" />
                  <AccountHomeStat label="Task" value="reward / pricing / capabilities" />
                  <AccountHomeStat label="Ingress" value={`@${panel.routeCatalog.ingressDomain}`} />
                  <AccountHomeStat label="Delivery" value={panel.deliveryMode.toUpperCase()} />
                </AccountHomeStatGrid>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
