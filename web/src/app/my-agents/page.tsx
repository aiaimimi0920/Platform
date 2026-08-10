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
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  buildAgentCallbackPolicyRecommendation,
  formatAgentCallbackPolicyLabel,
  mergeAgentCallbackPolicyCatalog,
} from "@/lib/agent-callback-policies";
import {
  buildAccountCenterNavItems,
  buildAccountHudItems,
  formatAccountDateTime,
  formatAccountNumber,
} from "@/lib/account-center";
import { getCurrentUser } from "@/lib/account-client";
import {
  getFeatureSnapshot,
  isFeatureSnapshotUnavailable,
  listAgentCallbackHealthSummaries,
  listAgentCallbackRemediationPolicies,
  listAgentCapabilities,
  listAgents,
} from "@/lib/platform-client";
import { hasPublicSurfaceSnapshot, loadPublicSurfaceDependency } from "@/lib/public-surface-dependency";
import {
  buildAccountCenterSurfaceVisibility,
  isPublicSurfaceVisibleForViewer,
} from "@/lib/public-surface-visibility";
import {
  addAgentCapabilityAction,
  createAgentAction,
  updateAgentCallbackProtocolVersionAction,
  updateAgentCallbackRemediationPolicyAction,
} from "@/lib/platform-actions";

type MyAgentsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function formatAgentLayerLabel(agent: { hostingMode: string; sourceType: "platform" | "external" }) {
  if (agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only") {
    return "平台重型";
  }
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime" || agent.sourceType === "external") {
    return "OpenAgent";
  }
  return "平台轻量";
}

function formatAgentOriginLabel(agent: { sourceType: "platform" | "external" }) {
  return agent.sourceType === "external" ? "接口定义" : "平台代运行";
}

function formatCallbackPolicyModeLabel(policy: { autoRemediationEnabled: boolean }) {
  return policy.autoRemediationEnabled ? "自动补救" : "人工确认";
}

function formatCallbackPolicySummary(policy: {
  baseBackoffSeconds: number;
  fallbackRetryRequestEnabled: boolean;
  fallbackRetryRequestReplayFailureProfileKey?: string | null;
  maxAttempts: number;
}) {
  return [
    `最多 ${policy.maxAttempts} 次`,
    `间隔 ${policy.baseBackoffSeconds} 秒`,
    policy.fallbackRetryRequestEnabled
      ? `失败画像：${policy.fallbackRetryRequestReplayFailureProfileKey || "默认画像"}`
      : "失败重放：关闭",
  ].join(" · ");
}

function formatCallbackReplayPayloadCompatibility(value: string) {
  switch (value) {
    case "current":
      return "当前版本";
    case "legacy_normalized":
      return "旧版规范化负载";
    default:
      return value;
  }
}

function formatCallbackReplayFailureClass(value: string) {
  switch (value) {
    case "stored_payload_unavailable":
      return "缺少留存负载";
    case "callback_secret_unavailable":
      return "缺少回调密钥";
    case "duplicate_replay_cooldown":
      return "重复重放冷却中";
    case "agent_disabled":
      return "智能体已停用";
    case "callback_not_retryable":
      return "回调不可重试";
    case "unsupported_target":
      return "目标不支持";
    case "callback_protocol_mismatch":
      return "协议版本不匹配";
    default:
      return value;
  }
}

function formatCallbackReplayCompatibilitySummary(policy: {
  allowedReplayPayloadCompatibilities: string[];
  allowReplayFromPreviousProtocolWindow: boolean;
  allowReplayFromPreviousSecretWindow: boolean;
}) {
  const compatibilities =
    policy.allowedReplayPayloadCompatibilities.length > 0
      ? policy.allowedReplayPayloadCompatibilities.map(formatCallbackReplayPayloadCompatibility).join("、")
      : "仅当前版本";
  return [
    `负载：${compatibilities}`,
    `旧协议窗口：${policy.allowReplayFromPreviousProtocolWindow ? "开启" : "关闭"}`,
    `旧密钥窗口：${policy.allowReplayFromPreviousSecretWindow ? "开启" : "关闭"}`,
  ].join(" · ");
}

function formatCallbackReplayFailureSummary(policy: {
  fallbackRetryRequestReplayFailureProfileKey: string;
  fallbackRetryRequestReplayFailureClasses: string[];
}) {
  const classes =
    policy.fallbackRetryRequestReplayFailureClasses.length > 0
      ? policy.fallbackRetryRequestReplayFailureClasses.map(formatCallbackReplayFailureClass).join("、")
      : "未配置自动聚焦";
  return `画像：${policy.fallbackRetryRequestReplayFailureProfileKey} · ${classes}`;
}

function formatRecommendationToneLabel(tone: "danger" | "warning" | "cyan") {
  switch (tone) {
    case "danger":
      return "高优先级";
    case "warning":
      return "需关注";
    case "cyan":
      return "建议";
    default:
      return tone;
  }
}

export default async function MyAgentsPage({ searchParams }: MyAgentsPageProps) {
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

  const [features, publicSurfaceDependency, user] = await Promise.all([
    getFeatureSnapshot(),
    loadPublicSurfaceDependency(),
    getCurrentUser(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!hasPublicSurfaceSnapshot(publicSurfaceDependency)) {
    return <PublicSurfaceDependencyState result={publicSurfaceDependency} />;
  }
  const publicSurfaces = publicSurfaceDependency.data;

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "agents", session.user.id, session.user.providerUserId)) {
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

  if (!features.agentRegistry.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">智能体模块已关闭</h1>
            <p className="mg-copy">当前无法读取个人智能体视图。</p>
          </Card>
        </div>
      </main>
    );
  }

  const agents = await listAgents(userContext);
  const enabledAgents = agents.filter((agent) => agent.enabled);
  const [healthSummaries, remediationPolicies, capabilityPairs] = await Promise.all([
    listAgentCallbackHealthSummaries(userContext).catch(() => []),
    listAgentCallbackRemediationPolicies(userContext).catch(() => []),
    Promise.all(
      agents.map(async (agent) => {
        const capabilities = await listAgentCapabilities(userContext, agent.id).catch(() => []);
        return [agent.id, capabilities] as const;
      }),
    ),
  ]);
  const healthByAgentId = new Map(healthSummaries.map((summary) => [summary.agentId, summary]));
  const capabilitiesByAgentId = new Map(capabilityPairs);
  const policyCatalog = mergeAgentCallbackPolicyCatalog(
    remediationPolicies,
    agents.map((agent) => agent.externalCallbackRemediationPolicy),
  );
  const policyByKey = new Map(policyCatalog.map((policy) => [policy.key, policy]));
  const totalCapabilityCount = capabilityPairs.reduce((sum, [, capabilities]) => sum + capabilities.length, 0);
  const openProtocolAgentCount = agents.filter(
    (agent) =>
      agent.hostingMode === "open_protocol" ||
      agent.hostingMode === "external_runtime" ||
      agent.sourceType === "external",
  ).length;
  const managedLightAgentCount = agents.filter(
    (agent) => agent.hostingMode === "managed_light" || agent.hostingMode === "managed_api",
  ).length;
  const managedHeavyAgentCount = agents.filter(
    (agent) =>
      agent.hostingMode === "managed_heavy" ||
      (agent.hostingMode === "registry_only" && agent.sourceType === "platform"),
  ).length;
  const progression = user.snapshot?.progression ?? null;
  const createPlatformAgentAccess = progression?.access.find((rule) => rule.key === "createPlatformAgent") ?? null;
  const createExternalAgentAccess = progression?.access.find((rule) => rule.key === "createExternalAgent") ?? null;
  const canCreatePlatformAgent = createPlatformAgentAccess?.satisfied !== false;
  const canCreateExternalAgent = createExternalAgentAccess?.satisfied !== false;
  const canCreateAnyAgent = canCreatePlatformAgent || canCreateExternalAgent;
  const walletSnapshot = user.snapshot?.wallet ?? null;
  const mailboxSnapshot = user.snapshot?.mailbox ?? null;
  const accountDisplayName = user.username || session.user.username;
  const accountAvatarUrl = user.avatarUrl || session.user.avatarUrl || null;
  const userInitial = accountDisplayName.slice(0, 1).toUpperCase();
  const accountCenterVisibility = buildAccountCenterSurfaceVisibility(
    publicSurfaces,
    session.user.id,
    session.user.providerUserId,
  );
  const unreadMailboxCount = mailboxSnapshot?.unreadMessages ?? 0;
  const pendingAttachmentCount = mailboxSnapshot?.pendingAttachments ?? 0;
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
              <Link className="mg-btn mg-btn--primary" href="/agents">进入智能体中心</Link>
              {isPublicSurfaceVisibleForViewer(publicSurfaces, "tasks", session.user.id, session.user.providerUserId) ? (
                <Link className="mg-btn mg-btn--glass" href="/my-tasks">关联任务</Link>
              ) : null}
              <Link className="mg-btn mg-btn--secondary" href="/dashboard">返回总览</Link>
            </>
          }
          description="我拥有的智能体、能力与回调健康状态。"
          focusItems={[
            { label: "我的智能体", value: formatAccountNumber(agents.length) },
            { label: "已启用", value: formatAccountNumber(enabledAgents.length) },
            { label: "平台轻量", value: formatAccountNumber(managedLightAgentCount) },
            { label: "OpenAgent", value: formatAccountNumber(openProtocolAgentCount) },
            { label: "平台重型", value: formatAccountNumber(managedHeavyAgentCount) },
            { label: "能力总数", value: formatAccountNumber(totalCapabilityCount) },
          ]}
          hudItems={hudItems}
          kicker="智能体终端"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
          <AccountHomeSectionHead kicker="运行" title="运行状态" />
              <AccountHomeList>
                <AccountHomeListRow aside={<span className="app-note">{enabledAgents.length}</span>} title="启用中" />
                <AccountHomeListRow aside={<span className="app-note">{healthSummaries.filter((summary) => summary.totalCallbacks > 0).length}</span>} title="有回调记录" />
                <AccountHomeListRow aside={<span className="app-note">{managedLightAgentCount}</span>} title="平台轻量" />
                <AccountHomeListRow aside={<span className="app-note">{openProtocolAgentCount}</span>} title="OpenAgent" />
                <AccountHomeListRow aside={<span className="app-note">{managedHeavyAgentCount}</span>} title="平台重型" />
                <AccountHomeListRow aside={<span className="app-note">{agents[0] ? formatAccountDateTime(agents[0].createdAt) : "暂无"}</span>} title="最近创建" />
              </AccountHomeList>
            </AccountHomeRailCard>
          }
          railStats={[
            { label: "总智能体", value: formatAccountNumber(agents.length) },
            { label: "启用中", value: formatAccountNumber(enabledAgents.length) },
            { label: "能力数", value: formatAccountNumber(totalCapabilityCount) },
            { label: "OpenAgent", value: formatAccountNumber(openProtocolAgentCount) },
          ]}
          stage={
            <AccountCenterAvatarStage
              alt={`${accountDisplayName} avatar`}
              avatarUrl={accountAvatarUrl}
              fallback={userInitial}
            />
          }
          title="我的智能体"
          titleBadges={
            <>
              <Badge variant="cyan">OpenAgent</Badge>
              <Badge variant="violet">个人视图</Badge>
              {progression ? <Badge variant="warning">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="已拥有智能体" title="我的智能体列表" />
                {agents.length === 0 ? (
                  <p className="mg-copy">当前还没有你创建的智能体。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {agents.map((agent) => {
                      const health = healthByAgentId.get(agent.id);
                      const capabilities = capabilitiesByAgentId.get(agent.id) ?? [];
                      const callbackPolicyRecommendation =
                        agent.sourceType === "external"
                          ? buildAgentCallbackPolicyRecommendation(agent, health)
                          : null;
                      return (
                        <Card className="app-stack" key={agent.id}>
                          <AccountHomeListRow
                            aside={
                              <div className="app-account-ledger-aside">
                                <Badge variant={agent.enabled ? "success" : "warning"}>{agent.enabled ? "已启用" : "已停用"}</Badge>
                                <strong>{formatAgentLayerLabel(agent)}</strong>
                              </div>
                            }
                            subtitle={[
                              formatAgentOriginLabel(agent),
                              `${capabilities.length} 项能力`,
                              health ? `回调统计：${health.totalCallbacks} 次 / 已拒绝 ${health.rejectedCallbacks} 次` : "暂无回调统计",
                              agent.runtimeEndpoint ? `运行地址：${agent.runtimeEndpoint}` : "未配置运行地址",
                            ].join(" · ")}
                            title={agent.name}
                          />

                          <div className="app-detail-list">
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">回调策略</span>
                              <span className="app-detail-list__value">
                                {agent.externalCallbackRemediationPolicy
                                  ? formatAgentCallbackPolicyLabel(agent.externalCallbackRemediationPolicy)
                                  : agent.externalCallbackRemediationPolicyKey || "balanced"}
                              </span>
                            </div>
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">协议版本</span>
                              <span className="app-detail-list__value">{agent.externalCallbackProtocolVersion ?? "默认"}</span>
                            </div>
                            {agent.sourceType === "external" && agent.externalCallbackRemediationPolicy ? (
                              <div className="app-detail-list__row">
                                <span className="app-detail-list__label">自动补救配置</span>
                                <span className="app-detail-list__value">
                                  最大 {agent.externalCallbackRemediationPolicy.maxAttempts} 次 / 间隔{" "}
                                  {agent.externalCallbackRemediationPolicy.baseBackoffSeconds} 秒
                                </span>
                              </div>
                            ) : null}
                            {agent.sourceType === "external" && agent.externalCallbackRemediationPolicy ? (
                              <div className="app-detail-list__row">
                                <span className="app-detail-list__label">重放兼容策略</span>
                                <span className="app-detail-list__value">
                                  {formatCallbackReplayCompatibilitySummary(agent.externalCallbackRemediationPolicy)}
                                </span>
                              </div>
                            ) : null}
                            {agent.sourceType === "external" && agent.externalCallbackRemediationPolicy ? (
                              <div className="app-detail-list__row">
                                <span className="app-detail-list__label">失败画像</span>
                                <span className="app-detail-list__value">
                                  {formatCallbackReplayFailureSummary(agent.externalCallbackRemediationPolicy)}
                                </span>
                              </div>
                            ) : null}
                            <div className="app-detail-list__row">
                              <span className="app-detail-list__label">最近创建</span>
                              <span className="app-detail-list__value">{formatAccountDateTime(agent.createdAt)}</span>
                            </div>
                          </div>

                          {callbackPolicyRecommendation ? (
                            <div className="app-stack">
                              <div className="app-task-card__header">
                                <div>
                                  <p className="mg-subtitle">策略建议</p>
                                  <h3 className="app-card-title">{callbackPolicyRecommendation.title}</h3>
                                </div>
                                <Badge variant={callbackPolicyRecommendation.tone}>
                                  {formatRecommendationToneLabel(callbackPolicyRecommendation.tone)}
                                </Badge>
                              </div>
                              <p className="app-note">{callbackPolicyRecommendation.detail}</p>
                              <form action={updateAgentCallbackRemediationPolicyAction} className="app-account-inline-form">
                                <input name="agentId" type="hidden" value={agent.id} />
                                <input name="policyKey" type="hidden" value={callbackPolicyRecommendation.recommendedPolicyKey} />
                                <input name="redirectTo" type="hidden" value="/my-agents" />
                                <button className="mg-btn mg-btn--secondary" type="submit">
                                  切到{" "}
                                  {policyByKey.get(callbackPolicyRecommendation.recommendedPolicyKey)?.label ||
                                    callbackPolicyRecommendation.recommendedPolicyKey}
                                </button>
                              </form>
                            </div>
                          ) : null}

                          <form action={updateAgentCallbackRemediationPolicyAction} className="app-account-inline-form">
                            <input name="agentId" type="hidden" value={agent.id} />
                            <input name="redirectTo" type="hidden" value="/my-agents" />
                            <Select className="app-account-inline-form__input" name="policyKey" defaultValue={agent.externalCallbackRemediationPolicyKey || "balanced"}>
                              {policyCatalog.map((policy) => (
                                <option key={policy.key} value={policy.key}>
                                  {formatAgentCallbackPolicyLabel(policy)}
                                </option>
                              ))}
                            </Select>
                            <button className="mg-btn mg-btn--secondary" type="submit">更新策略</button>
                          </form>

                          <form action={updateAgentCallbackProtocolVersionAction} className="app-account-inline-form">
                            <input name="agentId" type="hidden" value={agent.id} />
                            <input name="redirectTo" type="hidden" value="/my-agents" />
                            <Input
                              className="app-account-inline-form__input"
                              min="1"
                              name="protocolVersion"
                              placeholder="协议版本"
                              required
                              type="number"
                              defaultValue={agent.externalCallbackProtocolVersion ?? 1}
                            />
                            <button className="mg-btn mg-btn--glass" type="submit">更新协议</button>
                            <Link className="mg-btn mg-btn--outline" href="/agents">高级管理</Link>
                          </form>

                          <form action={addAgentCapabilityAction} className="app-form-grid">
                            <input name="agentId" type="hidden" value={agent.id} />
                            <input name="redirectTo" type="hidden" value="/my-agents" />
                            <Input name="code" placeholder="能力编码" required />
                            <Input name="title" placeholder="能力标题" required />
                            <Textarea name="description" placeholder="能力描述（可选）" rows={3} />
                            <Input name="pricingNote" placeholder="定价说明（可选）" />
                            <button className="mg-btn mg-btn--outline" type="submit">追加能力</button>
                          </form>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="能力清单" title="能力拆解" />
                {agents.length === 0 ? (
                  <p className="mg-copy">创建智能体后，这里会显示各智能体的能力清单。</p>
                ) : (
                  <div className="app-account-subgrid">
                    {agents.map((agent) => {
                      const capabilities = capabilitiesByAgentId.get(agent.id) ?? [];
                      return (
                        <Card className="app-stack" key={agent.id}>
                          <AccountHomeSectionHead kicker={formatAgentLayerLabel(agent)} title={agent.name} />
                          {capabilities.length === 0 ? (
                            <p className="app-note">当前没有能力项。</p>
                          ) : (
                            <AccountHomeList>
                              {capabilities.map((capability) => (
                                <AccountHomeListRow
                                  aside={<Badge variant={capability.enabled ? "success" : "warning"}>{capability.enabled ? "已启用" : "已停用"}</Badge>}
                                  key={capability.id}
                                  subtitle={capability.pricingNote || capability.description || "未填写说明"}
                                  title={capability.title}
                                />
                              ))}
                            </AccountHomeList>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </AccountHomeSection>
            </div>

            <div className="app-account-content-side">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="快速创建" title="直接创建智能体" />
                <form action={createAgentAction} className="app-form-grid">
                  <input name="redirectTo" type="hidden" value="/my-agents" />
                  <Input name="name" placeholder="智能体名称" required />
                  <Textarea name="description" placeholder="描述智能体适合做什么。" rows={4} />
                  <Select defaultValue="managed_light" name="agentLayer">
                    <option disabled={!canCreatePlatformAgent} value="managed_light">平台轻量智能体</option>
                    <option disabled value="managed_heavy">平台重型智能体（请前往重度智能体入口）</option>
                    <option disabled={!canCreateExternalAgent} value="open_protocol">OpenAgent 接入</option>
                  </Select>
                  <Select defaultValue="none" name="authMode">
                    <option value="none">无鉴权</option>
                    <option value="apiKey">访问密钥</option>
                    <option value="bearer">Bearer</option>
                  </Select>
                  <Input name="runtimeEndpoint" placeholder="运行地址（OpenAgent 必填）" />
                  <Input name="managedProviderLabel" placeholder="服务商名称" />
                  <Input name="managedApiBaseUrl" placeholder="托管访问地址" />
                  <Input name="managedModel" placeholder="模型 / 引擎" />
                  <Input name="managedApiKey" placeholder="托管访问密钥" />
                  <Textarea name="managedSystemPrompt" placeholder="系统提示词" rows={3} />
                  <Textarea name="managedPromptTemplate" placeholder="提示词模板" rows={3} />
                  <button className="mg-btn mg-btn--primary" disabled={!canCreateAnyAgent} type="submit">
                    {canCreateAnyAgent ? "创建智能体" : "当前等级不满足创建门槛"}
                  </button>
                </form>
                {progression ? (
                  <p className="app-note">
                    {!canCreateAnyAgent
                      ? createPlatformAgentAccess?.note || "当前等级权限快照暂不可用。"
                      : canCreatePlatformAgent && !canCreateExternalAgent
                        ? createExternalAgentAccess?.note || "当前仅开放平台代运行能力。"
                        : "当前等级已满足平台轻量智能体与 OpenAgent 接入门槛。"}
                  </p>
                ) : null}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="健康状态" title="回调健康摘要" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="统计窗口" value={healthSummaries[0]?.windowHours ? `${healthSummaries[0].windowHours}h` : "--"} />
                  <AccountHomeStat label="有流量智能体" value={healthSummaries.filter((summary) => summary.totalCallbacks > 0).length} />
                  <AccountHomeStat label="接受回调" value={formatAccountNumber(healthSummaries.reduce((sum, summary) => sum + summary.acceptedCallbacks, 0))} />
                  <AccountHomeStat label="拒绝回调" value={formatAccountNumber(healthSummaries.reduce((sum, summary) => sum + summary.rejectedCallbacks, 0))} />
                </AccountHomeStatGrid>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="回调补救" title="回调补救策略" />
                {policyCatalog.length === 0 ? (
                  <p className="mg-copy">当前未读取到可用的回调补救策略。</p>
                ) : (
                  <AccountHomeList>
                    {policyCatalog.map((policy) => (
                      <AccountHomeListRow
                        aside={
                          <Badge variant={policy.autoRemediationEnabled ? "cyan" : "warning"}>
                            {formatCallbackPolicyModeLabel(policy)}
                          </Badge>
                        }
                        key={policy.key}
                        subtitle={formatCallbackPolicySummary(policy)}
                        title={formatAgentCallbackPolicyLabel(policy)}
                      />
                    ))}
                  </AccountHomeList>
                )}
                <p className="app-note">
                  此处展示账户页可使用的补救策略；完整智能体管理台会采用同一套策略口径。
                </p>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="范围" title="账户页能力" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">仅展示当前账户拥有的智能体</span>} title="个人视图" />
                  <AccountHomeListRow aside={<span className="app-note">创建 / 策略 / 协议 / 能力</span>} title="可用操作" />
                  <AccountHomeListRow aside={<span className="app-note">完整智能体管理台</span>} title="进阶入口" />
                  <AccountHomeListRow aside={<span className="app-note">平台业务链路</span>} title="归属口径" />
                </AccountHomeList>
              </AccountHomeSection>
            </div>
          </div>
        </AccountCenterFrame>
      </div>
    </main>
  );
}
