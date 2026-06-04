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
import { Input, Textarea } from "@/components/ui/input";
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import { getCurrentUser } from "@/lib/account-client";
import { createTaskAction, dispatchTaskAction, taskLifecycleAction } from "@/lib/platform-actions";
import { getFeatureSnapshot, getPublicSurfaceSnapshot, isFeatureSnapshotUnavailable, listMyTasks } from "@/lib/platform-client";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";

type MyTasksPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function MyTasksPage({ searchParams }: MyTasksPageProps) {
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

  const [features, publicSurfaces, user] = await Promise.all([
    getFeatureSnapshot(),
    getPublicSurfaceSnapshot(),
    getCurrentUser(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "tasks", session.user.id, session.user.providerUserId)) {
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

  if (!features.taskHub.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">任务模块已关闭</h1>
            <p className="mg-copy">当前无法读取个人任务视图。</p>
          </Card>
        </div>
      </main>
    );
  }

  const tasks = await listMyTasks(userContext);

  const canUseWalletFlows = features.wallet.enabled && features.ledger.enabled;
  const myCreatedTasks = tasks.filter((task) => task.creatorUserId === session.user.id);
  const myAssignedTasks = tasks.filter((task) => task.assignedUserId === session.user.id);
  const progression = user.snapshot?.progression ?? null;
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const accountDisplayName = user.username || session.user.username;
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const unreadMailboxCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
  const activeAssignedCount = myAssignedTasks.filter((task) => ["assigned", "in_progress", "submitted"].includes(task.status)).length;
  const openCreatedCount = myCreatedTasks.filter((task) => ["open", "applying"].includes(task.status)).length;
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );
  const navItems = buildAccountCenterNavItems({
    active: null,
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
              <Link className="mg-btn mg-btn--primary" href="/tasks">进入集会</Link>
              <Link className="mg-btn mg-btn--secondary" href="/dashboard">返回总览</Link>
            </>
          }
          description="任务个人视图把平台任务市场压缩成“我发布的”和“我承接的”两个视角，避免每次都从全量任务列表里自己找。"
          focusItems={[
            { label: "我发布的", value: formatAccountNumber(myCreatedTasks.length) },
            { label: "我承接的", value: formatAccountNumber(myAssignedTasks.length) },
            { label: "活跃承接", value: formatAccountNumber(activeAssignedCount) },
          ]}
          hudItems={hudItems}
          kicker="Task Terminal"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="Status" title="任务摘要" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{openCreatedCount}</span>} title="待分配发布任务" />
                <AccountHomeListRow aside={<span className="app-note">{activeAssignedCount}</span>} title="活跃承接任务" />
                <AccountHomeListRow aside={<span className="app-note">{myCreatedTasks[0] ? formatAccountDateTime(myCreatedTasks[0].createdAt) : "暂无"}</span>} title="最近发布" />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "发布任务", value: formatAccountNumber(myCreatedTasks.length) },
            { label: "承接任务", value: formatAccountNumber(myAssignedTasks.length) },
            { label: "待处理", value: formatAccountNumber(openCreatedCount + activeAssignedCount) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="我的任务"
          titleBadges={
            <>
              <Badge variant="cyan">Task Hub</Badge>
              <Badge variant="violet">My View</Badge>
              {progression ? <Badge variant="warning">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead
                  kicker="Created"
                  title="我发布的任务"
                  actions={<span className="app-note">{myCreatedTasks.length} 条</span>}
                />
                {myCreatedTasks.length === 0 ? (
                  <p className="mg-copy">当前还没有你发布的任务。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {myCreatedTasks.map((task) => (
                      <Card className="app-stack" key={task.id}>
                        <AccountHomeListRow
                          aside={
                            <div className="app-account-ledger-aside">
                              <Badge variant={task.status === "accepted" ? "success" : task.status === "defaulted" ? "danger" : "warning"}>
                                {task.status}
                              </Badge>
                              <strong>{`${task.rewardAmount} ${task.rewardCurrency}`}</strong>
                            </div>
                          }
                          subtitle={[
                            `申请 ${task.applicationCount}`,
                            `仲裁 ${task.arbitrationCaseCount}`,
                            task.assignedUserId ? `已分配 ${task.assignedUserId}` : "未分配",
                            formatAccountDateTime(task.createdAt),
                          ].join(" · ")}
                          title={task.title}
                        />
                        <div className="app-action-row">
                          {canUseWalletFlows && task.status === "applying" && task.applicationCount > 0 ? (
                            <form action={dispatchTaskAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--primary" type="submit">立即调度</button>
                            </form>
                          ) : null}
                          {canUseWalletFlows && ["open", "applying", "assigned"].includes(task.status) ? (
                            <form action={taskLifecycleAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="action" type="hidden" value="cancel" />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--outline" type="submit">取消任务</button>
                            </form>
                          ) : null}
                          {canUseWalletFlows && task.status === "submitted" ? (
                            <form action={taskLifecycleAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="action" type="hidden" value="accept" />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--secondary" type="submit">验收通过</button>
                            </form>
                          ) : null}
                          {canUseWalletFlows && task.status === "submitted" ? (
                            <form action={taskLifecycleAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="action" type="hidden" value="default" />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--glass" type="submit">标记违约</button>
                            </form>
                          ) : null}
                          <Link className="mg-btn mg-btn--glass" href="/tasks">完整任务台</Link>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead
                  kicker="Assigned"
                  title="我承接的任务"
                  actions={<span className="app-note">{myAssignedTasks.length} 条</span>}
                />
                {myAssignedTasks.length === 0 ? (
                  <p className="mg-copy">当前还没有分配到你的任务。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {myAssignedTasks.map((task) => (
                      <Card className="app-stack" key={task.id}>
                        <AccountHomeListRow
                          aside={
                            <div className="app-account-ledger-aside">
                              <Badge variant={task.status === "accepted" ? "success" : task.status === "defaulted" ? "danger" : "cyan"}>
                                {task.status}
                              </Badge>
                              <strong>{`${task.requiredBondAmount} bond`}</strong>
                            </div>
                          }
                          subtitle={[
                            `奖励 ${task.rewardAmount} ${task.rewardCurrency}`,
                            `发布者 ${task.creatorUserId}`,
                            `仲裁 ${task.arbitrationCaseCount}`,
                          ].join(" · ")}
                          title={task.title}
                        />
                        <div className="app-action-row">
                          {canUseWalletFlows && task.status === "assigned" ? (
                            <form action={taskLifecycleAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="action" type="hidden" value="start" />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--primary" type="submit">开始任务</button>
                            </form>
                          ) : null}
                          {canUseWalletFlows && task.status === "in_progress" ? (
                            <form action={taskLifecycleAction}>
                              <input name="taskId" type="hidden" value={task.id} />
                              <input name="action" type="hidden" value="submit" />
                              <input name="redirectTo" type="hidden" value="/my-tasks" />
                              <button className="mg-btn mg-btn--secondary" type="submit">提交验收</button>
                            </form>
                          ) : null}
                          <Link className="mg-btn mg-btn--glass" href="/tasks">查看全量上下文</Link>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Quick Publish" title="直接发布任务" />
                <form action={createTaskAction} className="app-form-grid">
                  <input name="redirectTo" type="hidden" value="/my-tasks" />
                  <Input name="title" placeholder="任务标题" required />
                  <Textarea name="description" placeholder="任务说明" required rows={4} />
                  <Input min="1" name="rewardAmount" placeholder="奖励数量" required type="number" />
                  <Input min="0" name="requiredBondAmount" placeholder="保证金数量（曜石）" required type="number" />
                  <Input
                    name="preferredCapabilityCodes"
                    placeholder="偏好能力代码（逗号分隔，例如 write.copy,code.react.review）"
                  />
                  <select className="mg-select" defaultValue="obsidian" name="rewardCurrency">
                    <option value="obsidian">曜石</option>
                    <option value="mira">米拉</option>
                  </select>
                  <button className="mg-btn mg-btn--primary" disabled={!canUseWalletFlows} type="submit">
                    {canUseWalletFlows ? "发布到任务集会" : "钱包与账本模块未启用"}
                  </button>
                </form>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Summary" title="任务视图摘要" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="我发布的" value={myCreatedTasks.length} />
                  <AccountHomeStat label="我承接的" value={myAssignedTasks.length} />
                  <AccountHomeStat label="待分配" value={openCreatedCount} />
                  <AccountHomeStat label="活跃承接" value={activeAssignedCount} />
                </AccountHomeStatGrid>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Boundary" title="当前实现边界" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">/v1/tasks/mine</span>} title="读取方式" />
                  <AccountHomeListRow aside={<span className="app-note">个人视角 + 快速发布/流转</span>} title="当前定位" />
                  <AccountHomeListRow aside={<span className="app-note">/tasks</span>} title="完整操作入口" />
                  <AccountHomeListRow aside={<span className="app-note">platform owner</span>} title="业务 owner" />
                </AccountHomeList>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
