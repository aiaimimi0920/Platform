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
  formatAccountNumber,
  formatAccountRate,
} from "@/lib/account-center";
import { getCurrentUser } from "@/lib/account-client";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable } from "@/lib/platform-client";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";

export default async function GrowthPage() {
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

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "growth", session.user.id, session.user.providerUserId)) {
    redirect("/dashboard");
  }

  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">当前无法读取模块状态，请稍后再试。</p>
          </Card>
        </div>
      </main>
    );
  }

  if (!features.userProgression.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">成长模块已关闭</h1>
            <p className="mg-copy">当前无法读取等级、经验来源或权限解锁信息。</p>
          </Card>
        </div>
      </main>
    );
  }

  const progression = user.snapshot?.progression ?? null;

  if (!progression) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">未读取到成长快照</h1>
            <p className="mg-copy">当前账户还没有可展示的等级成长数据。</p>
          </Card>
        </div>
      </main>
    );
  }

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
    active: "growth",
    mailboxUnreadCount: unreadMailboxCount,
    pendingAttachmentCount,
    progression,
    recentWalletCount: walletSnapshot?.recentEntryCount ?? 0,
    reputation: null,
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
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "wallet", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--glass" href="/wallet">钱包流水</Link>
              ) : null}
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "reputation", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--secondary" href="/reputation">信誉详情</Link>
              ) : null}
            </>
          }
          description="成长页把 `snapshot.progression` 的完整结构展开为可读界面：当前等级、进度、已解锁资格、经验来源和下一等级预览都在同一页里。"
          focusItems={[
            { label: "当前等级", value: `Lv.${progression.level}` },
            { label: "经验值", value: formatAccountNumber(progression.experience) },
            { label: "自动优惠", value: formatAccountRate(progression.rewardDiscountRate) },
            { label: "解锁权限", value: formatAccountNumber(progression.access.filter((rule) => rule.satisfied).length) },
          ]}
          hudItems={hudItems}
          kicker="成长终端"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
          <AccountHomeSectionHead kicker="下一等级" title="下一等级" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{progression.nextLevelPreview ? `Lv.${progression.nextLevelPreview.level}` : "已满级"}</span>} title="目标等级" />
                <AccountHomeListRow aside={<span className="app-note">{progression.nextLevelPreview?.title ?? "无"}</span>} title="等级称号" />
                <AccountHomeListRow aside={<span className="app-note">{progression.experienceToNextLevel === null ? "0" : formatAccountNumber(progression.experienceToNextLevel)}</span>} title="剩余 XP" />
                <AccountHomeListRow aside={<span className="app-note">{progression.nextLevelPreview ? formatAccountRate(progression.nextLevelPreview.rewardDiscountRate) : "--"}</span>} title="下一等级折扣" />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "当前 XP", value: formatAccountNumber(progression.experience) },
            { label: "下一等级", value: progression.nextLevelPreview ? `Lv.${progression.nextLevelPreview.level}` : "已满级" },
            { label: "经验来源", value: formatAccountNumber(progression.sources.length) },
            { label: "已解锁权限", value: formatAccountNumber(progression.access.filter((rule) => rule.satisfied).length) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="成长详情"
          titleBadges={
            <>
              <Badge variant="warning">{`Lv.${progression.level} ${progression.title}`}</Badge>
              <Badge variant="cyan">{formatAccountRate(progression.rewardDiscountRate)}</Badge>
              <Badge variant="violet">{`${progression.sources.length} 来源`}</Badge>
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
              <AccountHomeSectionHead kicker="等级" title="等级状态" />
                <Card className="app-stack">
                  <div className="app-account-level-hero">
                    <div>
                      <p className="mg-subtitle">当前等级</p>
                      <h2 className="app-card-title">{`Lv.${progression.level} ${progression.title}`}</h2>
                    </div>
                    <div className="app-account-level-hero__value">{formatAccountNumber(progression.experience)} XP</div>
                  </div>
                  <div className="app-progress-track" aria-hidden="true">
                    <div
                      className="app-progress-track__fill"
                      style={{
                        width: `${progression.progressRate === 0 ? 0 : Math.max(6, progression.progressRate * 100)}%`,
                      }}
                    />
                  </div>
                  <AccountHomeStatGrid>
                    <AccountHomeStat label="当前等级下限" value={formatAccountNumber(progression.currentLevelMinExperience)} />
                    <AccountHomeStat label="下一等级阈值" value={progression.nextLevelExperience === null ? "已满级" : formatAccountNumber(progression.nextLevelExperience)} />
                    <AccountHomeStat label="剩余 XP" value={progression.experienceToNextLevel === null ? "0" : formatAccountNumber(progression.experienceToNextLevel)} />
                    <AccountHomeStat label="自动折扣" value={formatAccountRate(progression.rewardDiscountRate)} />
                  </AccountHomeStatGrid>
                </Card>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="权益" title="当前权益与下一等级预览" />
                <div className="app-account-subgrid">
                  <Card className="app-stack">
              <AccountHomeSectionHead kicker="当前" title="当前权益" />
                    {progression.benefits.length === 0 ? (
                      <p className="mg-copy">当前等级还没有额外权益说明。</p>
                    ) : (
                      <AccountHomeList>
                        {progression.benefits.map((benefit) => (
                          <AccountHomeListRow
                            aside={<Badge variant="cyan">{benefit.kind}</Badge>}
                            key={benefit.key}
                            subtitle={benefit.description}
                            title={benefit.title}
                          />
                        ))}
                      </AccountHomeList>
                    )}
                  </Card>

                  <Card className="app-stack">
              <AccountHomeSectionHead kicker="后续" title="下一等级" />
                    {progression.nextLevelPreview ? (
                      <>
                        <AccountHomeStatGrid>
                          <AccountHomeStat label="目标等级" value={`Lv.${progression.nextLevelPreview.level}`} />
                          <AccountHomeStat label="称号" value={progression.nextLevelPreview.title} />
                          <AccountHomeStat label="起始 XP" value={formatAccountNumber(progression.nextLevelPreview.minExperience)} />
                          <AccountHomeStat label="折扣" value={formatAccountRate(progression.nextLevelPreview.rewardDiscountRate)} />
                        </AccountHomeStatGrid>
                        <AccountHomeList>
                          {progression.nextLevelPreview.benefits.map((benefit) => (
                            <AccountHomeListRow
                              aside={<Badge variant="violet">{benefit.kind}</Badge>}
                              key={benefit.key}
                              subtitle={benefit.description}
                              title={benefit.title}
                            />
                          ))}
                        </AccountHomeList>
                      </>
                    ) : (
                      <p className="mg-copy">当前已经达到最高等级，没有下一等级预览。</p>
                    )}
                  </Card>
                </div>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="准入" title="资格与门槛" />
                <AccountHomeList>
                  {progression.access.map((rule) => (
                    <AccountHomeListRow
                      aside={<Badge variant={rule.satisfied ? "success" : "warning"}>{rule.satisfied ? "已解锁" : "未满足"}</Badge>}
                      key={rule.key}
                      subtitle={`${rule.note} · 需要 ${rule.minLevelTitle}`}
                      title={rule.title}
                    />
                  ))}
                </AccountHomeList>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="来源" title="经验来源拆解" />
                <AccountHomeList>
                  {progression.sources.map((source) => (
                    <AccountHomeListRow
                      aside={<strong>{formatAccountNumber(source.experience)} XP</strong>}
                      key={source.key}
                      subtitle={`计数 ${formatAccountNumber(source.metricValue)} · 已计入成长经验`}
                      title={source.label}
                    />
                  ))}
                </AccountHomeList>
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
          <AccountHomeSectionHead kicker="规则" title="当前落地范围" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">账户成长快照</span>} title="展示位置" />
                  <AccountHomeListRow aside={<span className="app-note">曜石商品折扣</span>} title="已生效权益" />
                  <AccountHomeListRow aside={<span className="app-note">发起议题 / 创建智能体</span>} title="已接入门槛" />
                  <AccountHomeListRow aside={<span className="app-note">任务履约、议题参与与账户资产共同计算</span>} title="口径说明" />
                </AccountHomeList>
              </AccountHomeSection>

              <AccountHomeSection>
          <AccountHomeSectionHead kicker="摘要" title="成长摘要" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="当前等级" value={`Lv.${progression.level}`} />
                  <AccountHomeStat label="当前称号" value={progression.title} />
                  <AccountHomeStat label="经验来源数" value={progression.sources.length} />
                  <AccountHomeStat label="权益数" value={progression.benefits.length} />
                </AccountHomeStatGrid>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
