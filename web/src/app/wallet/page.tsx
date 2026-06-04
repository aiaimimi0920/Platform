import Link from "next/link";
import { redirect } from "next/navigation";

import type { LedgerEntryType } from "@neuro/contracts";
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
import { getCurrentUser, getWalletPanel } from "@/lib/account-client";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/platform-client";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";
import { exchangeObsidianToMiraAction } from "@/lib/platform-actions";

type WalletPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function getEntryBadgeVariant(entryType: LedgerEntryType): "cyan" | "violet" | "warning" | "danger" | "success" {
  if (entryType === "grant" || entryType === "refund") {
    return "success";
  }
  if (entryType === "freeze" || entryType === "unfreeze") {
    return "warning";
  }
  if (entryType === "deduct") {
    return "danger";
  }
  if (entryType === "exchange") {
    return "violet";
  }
  return "cyan";
}

function getEntryLabel(entryType: LedgerEntryType): string {
  switch (entryType) {
    case "grant":
      return "发放";
    case "deduct":
      return "扣减";
    case "freeze":
      return "冻结";
    case "unfreeze":
      return "解冻";
    case "transfer":
      return "转移";
    case "refund":
      return "退款";
    case "exchange":
      return "兑换";
    default:
      return entryType;
  }
}

function getCurrencyDisplayName(currencyKey: string, assetLabels: Map<string, string>): string {
  return assetLabels.get(currencyKey) ?? currencyKey;
}

function formatExchangeDirection(direction: string): string {
  if (direction === "obsidian_to_mira") {
    return "耀晶兑米拉";
  }
  return direction;
}

export default async function WalletPage({ searchParams }: WalletPageProps) {
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

  const [features, publicSurfaces, user, walletPanel] = await Promise.all([
    getFeatureSnapshot(),
    getPublicSurfaceSnapshot(),
    getCurrentUser(userContext),
    getWalletPanel(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "wallet", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法从 core 读取模块快照，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }

  const walletEnabled = features.wallet.enabled && features.ledger.enabled;

  if (!walletEnabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">钱包模块已关闭</h1>
            <p className="mg-copy">当前钱包与账本未开放，无法查看余额或最近流水。</p>
          </Card>
        </div>
      </main>
    );
  }

  const progression = user.snapshot?.progression ?? null;
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const accountDisplayName = user.username || session.user.username;
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const unreadMailboxCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );
  const totalAvailable = walletPanel.assets.reduce(
    (sum, asset) => sum + asset.available,
    0,
  );
  const totalFrozen = walletPanel.assets.reduce(
    (sum, asset) => sum + asset.frozen,
    0,
  );
  const latestEntry = walletPanel.recentEntries[0] ?? null;
  const assetLabels = new Map(walletPanel.assets.map((asset) => [asset.key, asset.displayName]));

  const navItems = buildAccountCenterNavItems({
    active: "wallet",
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletPanel.recentEntries.length,
    reputation: null,
    visibility: accountCenterVisibility,
  });

  const hudItems = buildAccountHudItems({
    wallet: {
      balances: {
        obsidian: {
          available: walletPanel.assets.find((asset) => asset.key === "obsidian")?.available ?? 0,
          frozen: walletPanel.assets.find((asset) => asset.key === "obsidian")?.frozen ?? 0,
        },
        mira: {
          available: walletPanel.assets.find((asset) => asset.key === "mira")?.available ?? 0,
          frozen: walletPanel.assets.find((asset) => asset.key === "mira")?.frozen ?? 0,
        },
        opinionTickets: {
          available: walletPanel.assets.find((asset) => asset.key === "opinionTickets")?.available ?? 0,
          frozen: walletPanel.assets.find((asset) => asset.key === "opinionTickets")?.frozen ?? 0,
        },
      },
      recentEntries: walletPanel.recentEntries,
    },
    walletSnapshot,
    progression,
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
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
              <a className="mg-btn mg-btn--glass" href="#wallet-exchange">资源兑换</a>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "mailbox", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--secondary" href="/mailbox">进入邮箱</Link>
              ) : null}
            </>
          }
          description="钱包页负责把账户域账本真正露出来：当前余额、冻结金额、最近流水和单向兑换都在这里，不再只留在 dashboard 的摘要卡片里。"
          focusItems={[
            { label: "可用总量", value: formatAccountNumber(totalAvailable) },
            { label: "冻结总量", value: formatAccountNumber(totalFrozen) },
            { label: "最近流水", value: formatAccountNumber(walletPanel.recentEntries.length) },
            { label: "未读消息", value: formatAccountNumber(unreadMailboxCount) },
          ]}
          hudItems={hudItems}
          kicker="Wallet Terminal"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="Ledger" title="账本摘要" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{walletPanel.recentEntries.length}</span>} title="最近流水条数" />
                <AccountHomeListRow aside={<span className="app-note">{latestEntry ? formatAccountDateTime(latestEntry.createdAt) : "暂无"}</span>} title="最近记账" />
                <AccountHomeListRow aside={<span className="app-note">{pendingAttachmentCount}</span>} title="待领附件" />
                <AccountHomeListRow
                  aside={<span className="app-note">{walletPanel.exchangeDirections.map(formatExchangeDirection).join(" / ")}</span>}
                  title="兑换方向"
                />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "可用总量", value: formatAccountNumber(totalAvailable) },
            { label: "冻结总量", value: formatAccountNumber(totalFrozen) },
            { label: "最近流水", value: formatAccountNumber(walletPanel.recentEntries.length) },
            { label: "待领附件", value: formatAccountNumber(pendingAttachmentCount) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="正式钱包与账本"
          titleBadges={
            <>
              <Badge variant="cyan">Official Wallet</Badge>
              <Badge variant="violet">Ledger</Badge>
              {progression ? <Badge variant="warning">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Balances" title="三货币余额" />
                <div className="app-account-balance-grid">
                  {walletPanel.assets.map((asset) => (
                    <Card className="app-account-balance-card" key={asset.key}>
                      <div className="app-account-balance-card__head">
                        <Badge variant={asset.accent}>{asset.shortLabel}</Badge>
                        <span className="mg-subtitle">{asset.displayName}</span>
                      </div>
                      <div className="app-account-balance-card__value">
                        {formatAccountNumber(asset.available)}
                      </div>
                      <p className="app-note">{asset.summary}</p>
                      <div className="app-account-balance-card__meta">
                        <span>冻结</span>
                        <strong>{formatAccountNumber(asset.frozen)}</strong>
                      </div>
                    </Card>
                  ))}
                </div>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Asset Roles" title="三货币角色与规则" />
                <div className="app-account-subgrid">
                  {walletPanel.assets.map((asset) => (
                    <Card className="app-account-support-card" key={`${asset.key}-role`}>
                      <AccountHomeSectionHead
                        kicker={asset.category.toUpperCase()}
                        title={`${asset.displayName} · ${asset.shortLabel}`}
                      />
                      <AccountHomeList>
                        <AccountHomeListRow title="来源" subtitle={asset.acquisition} />
                        <AccountHomeListRow title="用途" subtitle={asset.usage} />
                        <AccountHomeListRow title="规则" subtitle={asset.rule} />
                      </AccountHomeList>
                    </Card>
                  ))}
                </div>
              </AccountHomeSection>

              <AccountHomeSection id="wallet-exchange">
                <AccountHomeSectionHead kicker="Exchange" title="耀晶兑换米拉" />
                <Card className="app-account-support-card">
                  <p className="mg-copy">当前正式开放的只有单向耀晶兑米拉。内部 route code 继续保持 <code>obsidian_to_mira</code> 兼容，兑换结果会直接写入账户域账本，并回到本页显示状态。</p>
                  <form action={exchangeObsidianToMiraAction} className="app-account-inline-form">
                    <input name="redirectTo" type="hidden" value="/wallet" />
                    <Input
                      className="app-account-inline-form__input"
                      min="1"
                      name="amount"
                      placeholder="输入耀晶数量"
                      required
                      type="number"
                    />
                    <button className="mg-btn mg-btn--primary" type="submit">兑换为米拉</button>
                  </form>
                </Card>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={<span className="app-note">最近 {walletPanel.recentEntries.length} 条</span>}
                  kicker="Recent Ledger"
                  title="最近流水"
                />
                {walletPanel.recentEntries.length === 0 ? (
                  <p className="mg-copy">当前没有可展示的账本流水。</p>
                ) : (
                  <AccountHomeList>
                    {walletPanel.recentEntries.map((entry) => (
                      <AccountHomeListRow
                        aside={
                          <div className="app-account-ledger-aside">
                            <Badge variant={getEntryBadgeVariant(entry.entryType)}>{getEntryLabel(entry.entryType)}</Badge>
                            <strong>{formatAccountNumber(entry.amount)}</strong>
                          </div>
                        }
                        key={entry.id}
                        subtitle={[
                          `${getCurrencyDisplayName(entry.currency, assetLabels)} · 可用 ${formatAccountNumber(entry.balanceAfterAvailable)} / 冻结 ${formatAccountNumber(entry.balanceAfterFrozen)}`,
                          entry.referenceType ? `${entry.referenceType}${entry.referenceId ? `#${entry.referenceId}` : ""}` : null,
                          entry.note || null,
                        ].filter(Boolean).join(" · ")}
                        title={formatAccountDateTime(entry.createdAt)}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Value Ingress" title="价值入口" />
                <AccountHomeList>
                  <AccountHomeListRow
                    aside={
                      isPublicSurfaceVisibleForViewer(publicSurfaces, "mailbox", session.user.id, session.user.providerUserId) ? (
                        <Link className="mg-btn mg-btn--outline" href="/mailbox">查看</Link>
                      ) : undefined
                    }
                    title="站内邮箱待领"
                    subtitle={`当前还有 ${formatAccountNumber(pendingAttachmentCount)} 份待领取资产或回执。`}
                  />
                  <AccountHomeListRow
                    aside={<Link className="mg-btn mg-btn--outline" href="/email-access">查看</Link>}
                    title="Email-Native 回执"
                    subtitle="真实邮箱触发的任务与 Agent 执行会同时回执到真实邮箱和站内邮箱。"
                  />
                  <AccountHomeListRow
                    aside={
                      isPublicSurfaceVisibleForViewer(publicSurfaces, "benefits", session.user.id, session.user.providerUserId) ? (
                        <Link className="mg-btn mg-btn--outline" href="/benefits">查看</Link>
                      ) : undefined
                    }
                    title="福利与资格"
                    subtitle="购买型权益、人工 grant 与 credential assignment 都会在这里形成价值入口。"
                  />
                  <AccountHomeListRow
                    aside={
                      isPublicSurfaceVisibleForViewer(publicSurfaces, "opinions", session.user.id, session.user.providerUserId) ? (
                        <Link className="mg-btn mg-btn--outline" href="/opinions">查看</Link>
                      ) : undefined
                    }
                    title="治理投票"
                    subtitle="投票券的主要去向是议题发起、支持和开发优先级排序。"
                  />
                </AccountHomeList>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Rules" title="当前规则" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="钱包 owner" value="account-api" />
                  <AccountHomeStat label="写入路径" value="account-domain" />
                  <AccountHomeStat label="兑换方向" value="耀晶兑米拉" />
                  <AccountHomeStat label="资产定义" value="wallet panel" />
                </AccountHomeStatGrid>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Snapshot" title="聚合摘要" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">{walletSnapshot?.recentEntryCount ?? walletPanel.recentEntries.length}</span>} title="快照流水数" />
                  <AccountHomeListRow aside={<span className="app-note">{progression ? `Lv.${progression.level}` : "未读取"}</span>} title="成长等级" />
                  <AccountHomeListRow aside={<span className="app-note">{pendingAttachmentCount}</span>} title="待领附件" />
                  <AccountHomeListRow aside={<span className="app-note">{unreadMailboxCount}</span>} title="未读消息" />
                </AccountHomeList>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
