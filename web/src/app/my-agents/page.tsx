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
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  buildAgentCallbackPolicyRecommendation,
  formatAgentCallbackPolicyLabel,
  formatAgentCallbackReplayCompatibilityPolicy,
  formatAgentCallbackReplayFallbackProfile,
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
  getPublicSurfaceSnapshot,
  isFeatureSnapshotUnavailable,
  listAgentCallbackHealthSummaries,
  listAgentCallbackRemediationPolicies,
  listAgentCapabilities,
  listAgents,
} from "@/lib/platform-client";
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

  const [features, publicSurfaces, user] = await Promise.all([
    getFeatureSnapshot(),
    getPublicSurfaceSnapshot(),
    getCurrentUser(userContext),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!isPublicSurfaceVisibleForViewer(publicSurfaces, "agents", session.user.id, session.user.providerUserId)) {
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

  if (!features.agentRegistry.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">Agent 模块已关闭</h1>
            <p className="mg-copy">当前无法读取个人 Agent 视图。</p>
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
            { label: "我的 Agents", value: formatAccountNumber(agents.length) },
            { label: "已启用", value: formatAccountNumber(enabledAgents.length) },
            { label: "平台轻量", value: formatAccountNumber(managedLightAgentCount) },
            { label: "OpenAgent", value: formatAccountNumber(openProtocolAgentCount) },
            { label: "平台重型", value: formatAccountNumber(managedHeavyAgentCount) },
            { label: "能力总数", value: formatAccountNumber(totalCapabilityCount) },
          ]}
          hudItems={hudItems}
          kicker="Agent Terminal"
          navItems={navItems}
          railFooter={
            <AccountHomeRailCard>
              <AccountHomeSectionHead kicker="Runtime" title="运行状态" />
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
            { label: "总 Agents", value: formatAccountNumber(agents.length) },
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
          title="我的 Agents"
          titleBadges={
            <>
              <Badge variant="cyan">OpenAgent</Badge>
              <Badge variant="violet">My View</Badge>
              {progression ? <Badge variant="warning">{`Lv.${progression.level}`}</Badge> : null}
            </>
          }
        >
          <div className="app-account-content-grid">
            <div className="app-account-content-main">
              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Owned Agents" title="我的 Agent 列表" />
                {agents.length === 0 ? (
                  <p className="mg-copy">当前还没有你创建的 Agent。</p>
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
                                <Badge variant={agent.enabled ? "success" : "warning"}>{agent.enabled ? "enabled" : "disabled"}</Badge>
                                <strong>{formatAgentLayerLabel(agent)}</strong>
                              </div>
                            }
                            subtitle={[
                              formatAgentOriginLabel(agent),
                              `${capabilities.length} 项能力`,
                              health ? `${health.totalCallbacks} callbacks / ${health.rejectedCallbacks} rejected` : "暂无 callback 统计",
                              agent.runtimeEndpoint || "无 runtime endpoint",
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
                                  最大 {agent.externalCallbackRemediationPolicy.maxAttempts} 次 / 退避{" "}
                                  {agent.externalCallbackRemediationPolicy.baseBackoffSeconds}s
                                </span>
                              </div>
                            ) : null}
                            {agent.sourceType === "external" && agent.externalCallbackRemediationPolicy ? (
                              <div className="app-detail-list__row">
                                <span className="app-detail-list__label">Replay 兼容策略</span>
                                <span className="app-detail-list__value">
                                  {formatAgentCallbackReplayCompatibilityPolicy(agent.externalCallbackRemediationPolicy)}
                                </span>
                              </div>
                            ) : null}
                            {agent.sourceType === "external" && agent.externalCallbackRemediationPolicy ? (
                              <div className="app-detail-list__row">
                                <span className="app-detail-list__label">Fallback 失败画像</span>
                                <span className="app-detail-list__value">
                                  {formatAgentCallbackReplayFallbackProfile(agent.externalCallbackRemediationPolicy)}
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
                                  <p className="mg-subtitle">Policy Recommendation</p>
                                  <h3 className="app-card-title">{callbackPolicyRecommendation.title}</h3>
                                </div>
                                <Badge variant={callbackPolicyRecommendation.tone}>{callbackPolicyRecommendation.tone}</Badge>
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
                            <Input name="code" placeholder="capability code" required />
                            <Input name="title" placeholder="Capability 标题" required />
                            <Textarea name="description" placeholder="Capability 描述（可选）" rows={3} />
                            <Input name="pricingNote" placeholder="定价说明（可选）" />
                            <button className="mg-btn mg-btn--outline" type="submit">追加 Capability</button>
                          </form>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Capabilities" title="能力拆解" />
                {agents.length === 0 ? (
                  <p className="mg-copy">创建 Agent 后，这里会显示各 Agent 的 capability 清单。</p>
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
                                  aside={<Badge variant={capability.enabled ? "success" : "warning"}>{capability.enabled ? "enabled" : "disabled"}</Badge>}
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
                <AccountHomeSectionHead kicker="Quick Create" title="直接创建智能体" />
                <form action={createAgentAction} className="app-form-grid">
                  <input name="redirectTo" type="hidden" value="/my-agents" />
                  <Input name="name" placeholder="Agent 名称" required />
                  <Textarea name="description" placeholder="描述智能体适合做什么。" rows={4} />
                  <Select defaultValue="managed_light" name="agentLayer">
                    <option disabled={!canCreatePlatformAgent} value="managed_light">平台轻量 Agent</option>
                    <option disabled value="managed_heavy">平台重 Agent（暂未开放）</option>
                    <option disabled={!canCreateExternalAgent} value="open_protocol">OpenAgent 接入</option>
                  </Select>
                  <Select defaultValue="none" name="authMode">
                    <option value="none">无鉴权</option>
                    <option value="apiKey">API Key</option>
                    <option value="bearer">Bearer</option>
                  </Select>
                  <Input name="runtimeEndpoint" placeholder="运行地址（OpenAgent 必填）" />
                  <Input name="managedProviderLabel" placeholder="Provider" />
                  <Input name="managedApiBaseUrl" placeholder="托管 API Base URL" />
                  <Input name="managedModel" placeholder="模型 / 引擎" />
                  <Input name="managedApiKey" placeholder="托管 API Key" />
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
                        : "当前等级已满足平台轻量 Agent 与 OpenAgent 接入门槛。"}
                  </p>
                ) : null}
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Health" title="Callback 健康摘要" />
                <AccountHomeStatGrid>
                  <AccountHomeStat label="统计窗口" value={healthSummaries[0]?.windowHours ? `${healthSummaries[0].windowHours}h` : "--"} />
                  <AccountHomeStat label="有流量 Agent" value={healthSummaries.filter((summary) => summary.totalCallbacks > 0).length} />
                  <AccountHomeStat label="接受回调" value={formatAccountNumber(healthSummaries.reduce((sum, summary) => sum + summary.acceptedCallbacks, 0))} />
                  <AccountHomeStat label="拒绝回调" value={formatAccountNumber(healthSummaries.reduce((sum, summary) => sum + summary.rejectedCallbacks, 0))} />
                </AccountHomeStatGrid>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Policy Catalog" title="回调补救策略目录" />
                {policyCatalog.length === 0 ? (
                  <p className="mg-copy">当前未读取到 callback remediation policy catalog。</p>
                ) : (
                  <AccountHomeList>
                    {policyCatalog.map((policy) => (
                      <AccountHomeListRow
                        aside={
                          <Badge variant={policy.autoRemediationEnabled ? "cyan" : "warning"}>
                            {policy.autoRemediationEnabled ? "auto" : "manual"}
                          </Badge>
                        }
                        key={policy.key}
                        subtitle={[
                          `max ${policy.maxAttempts}`,
                          `${policy.baseBackoffSeconds}s backoff`,
                          policy.fallbackRetryRequestEnabled ? "fallback on" : "fallback off",
                          policy.fallbackRetryRequestReplayFailureProfileKey,
                        ].join(" · ")}
                        title={formatAgentCallbackPolicyLabel(policy)}
                      />
                    ))}
                  </AccountHomeList>
                )}
                <p className="app-note">
                  个人页和 `/agents` 现在都复用同一份 remediation policy catalog，不再依赖写死的本地下拉枚举。
                </p>
              </AccountHomeSection>

              <AccountHomeSection>
                <AccountHomeSectionHead kicker="Boundary" title="当前实现边界" />
                <AccountHomeList>
                  <AccountHomeListRow aside={<span className="app-note">/v1/agents</span>} title="列表接口" />
                  <AccountHomeListRow aside={<span className="app-note">owner 已按当前用户过滤</span>} title="个人视图基础" />
                  <AccountHomeListRow aside={<span className="app-note">创建 / 策略 / 协议 / capability</span>} title="账户页已接入动作" />
                  <AccountHomeListRow aside={<span className="app-note">/agents</span>} title="完整管理入口" />
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
