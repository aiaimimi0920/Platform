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
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
  formatAccountRate,
} from "@/lib/account-center";
import {
  getCurrentUser,
  getReputationBreakdown,
  getReputationSummary,
  listReputationHistory,
} from "@/lib/account-client";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/platform-client";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";

function formatSignedValue(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default async function ReputationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

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

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "reputation", session.user.id, session.user.providerUserId)) {
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

  if (!features.reputation.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">信誉模块已关闭</h1>
            <p className="mg-copy">当前无法读取信誉摘要、评分拆解或历史快照。</p>
          </Card>
        </div>
      </main>
    );
  }

  const [reputation, breakdown, history] = await Promise.all([
    getReputationSummary(userContext),
    getReputationBreakdown(userContext),
    listReputationHistory(userContext, 12),
  ]);

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

  const navItems = buildAccountCenterNavItems({
    active: "reputation",
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletSnapshot?.recentEntryCount ?? 0,
    reputation,
    visibility: accountCenterVisibility,
  });

  const hudItems = buildAccountHudItems({
    wallet: null,
    walletSnapshot,
    progression,
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
  });

  return (
    <main className="app-page">
      <div className="mg-shell app-stack">
        <AccountCenterFrame
          actions={
            <>
              <Link className="mg-btn mg-btn--primary" href="/dashboard">返回总览</Link>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "growth", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--glass" href="/growth">查看成长</Link>
              ) : null}
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "mailbox", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--secondary" href="/mailbox">进入邮箱</Link>
              ) : null}
            </>
          }
          description="信誉页把账户域里已经存在的 explain/history 全部接到前台，用于解释为什么是这个分数，以及最近是如何变化的。"
          focusItems={[
            { label: "信誉分", value: reputation ? formatAccountNumber(reputation.reputationScore) : "--" },
            { label: "等级", value: reputation?.tier ?? "--" },
            { label: "完成率", value: reputation ? formatAccountRate(reputation.completionRate) : "--" },
            { label: "违约率", value: reputation ? formatAccountRate(reputation.defaultRate) : "--" },
          ]}
          hudItems={hudItems}
          kicker="Reputation Terminal"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="History" title="历史摘要" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{history.length}</span>} title="历史点数量" />
                <AccountHomeListRow aside={<span className="app-note">{history[0] ? formatAccountDateTime(history[0].recordedAt) : "暂无"}</span>} title="最新记录" />
                <AccountHomeListRow aside={<span className="app-note">{reputation?.favorableArbitrationCount ?? 0}</span>} title="有利仲裁" />
                <AccountHomeListRow aside={<span className="app-note">{reputation?.unfavorableArbitrationCount ?? 0}</span>} title="不利仲裁" />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "已完成", value: formatAccountNumber(reputation?.completedTaskCount ?? 0) },
            { label: "违约", value: formatAccountNumber(reputation?.defaultedTaskCount ?? 0) },
            { label: "取消", value: formatAccountNumber(reputation?.cancelledTaskCount ?? 0) },
            { label: "活跃", value: formatAccountNumber(reputation?.activeTaskCount ?? 0) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="信誉详情"
          titleBadges={
            <>
              <Badge variant="cyan">Reputation</Badge>
              {reputation ? <Badge variant="warning">{reputation.tier}</Badge> : null}
              {progression ? <Badge variant="violet">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Snapshot" title="当前信誉摘要" />
                {reputation ? (
                  <AccountHomeStatGrid>
                    <AccountHomeStat label="信誉分" value={reputation.reputationScore} />
                    <AccountHomeStat label="等级" value={reputation.tier} />
                    <AccountHomeStat label="完成率" value={formatAccountRate(reputation.completionRate)} />
                    <AccountHomeStat label="违约率" value={formatAccountRate(reputation.defaultRate)} />
                    <AccountHomeStat label="有利仲裁" value={reputation.favorableArbitrationCount} />
                    <AccountHomeStat label="不利仲裁" value={reputation.unfavorableArbitrationCount} />
                    <AccountHomeStat label="完成任务" value={reputation.completedTaskCount} />
                    <AccountHomeStat label="活跃任务" value={reputation.activeTaskCount} />
                  </AccountHomeStatGrid>
                ) : (
                  <p className="mg-copy">当前未读取到信誉摘要。</p>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Explain" title="评分拆解" />
                {breakdown ? (
                  <div className="app-account-subgrid">
                    <Card className="app-stack">
                      <AccountHomeSectionHead kicker="Inputs" title="输入项" />
                      <AccountHomeList>
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.completedTaskCount}</span>} title="已完成任务" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.defaultedTaskCount}</span>} title="违约任务" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.cancelledTaskCount}</span>} title="取消任务" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.activeTaskCount}</span>} title="活跃任务" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.favorableArbitrationCount}</span>} title="有利仲裁" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.unfavorableArbitrationCount}</span>} title="不利仲裁" />
                        <AccountHomeListRow aside={<span className="app-note">{breakdown.inputs.trustLevel ?? "未提供"}</span>} title="Trust Level" />
                      </AccountHomeList>
                    </Card>

                    <Card className="app-stack">
                      <AccountHomeSectionHead kicker="Factors" title="计分因子" />
                      <AccountHomeList>
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--positive">{formatSignedValue(breakdown.factors.baseScore)}</strong>} title="基础分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--positive">{formatSignedValue(breakdown.factors.trustBonus)}</strong>} title="信任加成" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--positive">{formatSignedValue(breakdown.factors.completedContribution)}</strong>} title="完成任务加分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--negative">{formatSignedValue(-breakdown.factors.defaultedPenalty)}</strong>} title="违约扣分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--negative">{formatSignedValue(-breakdown.factors.cancelledPenalty)}</strong>} title="取消扣分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--positive">{formatSignedValue(breakdown.factors.activeContribution)}</strong>} title="活跃加分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--positive">{formatSignedValue(breakdown.factors.arbitrationWinBonus)}</strong>} title="仲裁胜诉加分" />
                        <AccountHomeListRow aside={<strong className="app-account-factor-value app-account-factor-value--negative">{formatSignedValue(-breakdown.factors.arbitrationLossPenalty)}</strong>} title="仲裁败诉扣分" />
                      </AccountHomeList>
                    </Card>
                  </div>
                ) : (
                  <p className="mg-copy">当前未读取到评分拆解数据。</p>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  actions={<span className="app-note">{history.length} 条历史记录</span>}
                  kicker="History"
                  title="信誉历史"
                />
                {history.length === 0 ? (
                  <p className="mg-copy">当前没有可展示的历史快照。</p>
                ) : (
                  <AccountHomeList>
                    {history.map((point) => (
                      <AccountHomeListRow
                        aside={
                          <div className="app-account-ledger-aside">
                            <Badge variant="violet">{point.tier}</Badge>
                            <strong>{point.reputationScore}</strong>
                          </div>
                        }
                        key={point.id}
                        subtitle={[
                          `完成率 ${formatAccountRate(point.completionRate)}`,
                          `违约率 ${formatAccountRate(point.defaultRate)}`,
                          `完成 ${point.completedTaskCount}`,
                          `违约 ${point.defaultedTaskCount}`,
                        ].join(" · ")}
                        title={formatAccountDateTime(point.recordedAt)}
                      />
                    ))}
                  </AccountHomeList>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Module" title="实现边界" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">/v1/me/reputation</span>} title="摘要接口" />
                  <AccountHomeListRow aside={<span className="app-note">/v1/me/reputation/breakdown</span>} title="Explain 接口" />
                  <AccountHomeListRow aside={<span className="app-note">/v1/me/reputation/history</span>} title="History 接口" />
                  <AccountHomeListRow aside={<span className="app-note">task-hub + arbitration</span>} title="统计来源" />
                </AccountHomeList>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Snapshot" title="当前口径" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="更新时间" value={breakdown ? formatAccountDateTime(breakdown.updatedAt) : "--"} />
                  <AccountHomeStat label="完成率" value={breakdown ? formatAccountRate(breakdown.completionRate) : "--"} />
                  <AccountHomeStat label="违约率" value={breakdown ? formatAccountRate(breakdown.defaultRate) : "--"} />
                  <AccountHomeStat label="Trust Level" value={breakdown?.inputs.trustLevel ?? "未提供"} />
                </AccountHomeStatGrid>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
