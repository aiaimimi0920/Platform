import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  AgentCallbackConfigHistoryView,
  AgentCallbackHealthSummaryView,
  AgentCapabilityView,
  AgentExecutionStatus,
  AgentExecutionRuntimeCatalogView,
  AgentRecentCallbackView,
} from "@neuro/contracts";
import { auth } from "@/auth";
import { DependencyState } from "@/components/dependency-state";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtPanel as Panel,
} from "@/components/nt-primitives";
import { mergeAgentCallbackPolicyCatalog } from "@/lib/agent-callback-policies";
import {
  EXECUTION_STATUS_ORDER,
  agentRailPriorityScore,
  buildAgentsOpsHref,
  runtimePressureSortScore,
} from "@/lib/agent-ops-presentation";
import {
  combineDependencyResults,
  createDependencyFailureResult,
  createDependencyResult,
  type DependencyResult,
} from "@/lib/dependency-result";
import {
  getFeatureSnapshot,
  getAgentExecutionRuntimeCatalog,
  getAgentExecutionRuntimeSessionSummary,
  isFeatureSnapshotUnavailable,
  listAgentCallbackHealthSummaries,
  listAgentCallbackRemediationPolicies,
  listAgentCapabilities,
  listAgentExecutions,
  listAgentRecentCallbacks,
  listAgents,
  listOperatorAgentCallbackHistory,
  type AgentExecutionView,
  type AgentView,
} from "@/lib/core-client";
import { consumeAgentCallbackSecretFlash } from "@/lib/server-flash";
import {
  isPlatformOperatorUserId,
  requirePlatformOperatorUserContext,
} from "@/lib/platform-session";
import { AgentsOpsOverviewSection } from "@/features/account-agent-center/ops/agents-ops-overview-section";
import { AgentsOpsSidebar } from "@/features/account-agent-center/ops/agents-ops-sidebar";
import { SelectedAgentPanel } from "@/features/account-agent-center/ops/selected-agent-panel";

type AgentsOpsPageProps = {
  searchParams?: Promise<{
    agentId?: string;
    executionStatus?: string;
    message?: string;
    policyKey?: string;
    q?: string;
    sourceType?: string;
    status?: string;
  }>;
};

type AgentCallbackSecretFlash = {
  agentId: string;
  callbackSecret: string;
};

const AGENT_CALLBACK_SECRET_FLASH_COOKIE = "np_agent_callback_secret_flash";

export default async function AgentsOpsPage({
  searchParams,
}: AgentsOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(
      `/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问智能体模块运维台。")}`,
    );
  }

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() || "";
  const sourceTypeFilter =
    params.sourceType === "platform" || params.sourceType === "external"
      ? params.sourceType
      : "all";
  const policyKeyFilter = params.policyKey?.trim() || "all";
  const executionStatusFilter =
    params.executionStatus &&
    EXECUTION_STATUS_ORDER.includes(
      params.executionStatus as AgentExecutionStatus,
    )
      ? (params.executionStatus as AgentExecutionStatus)
      : "all";
  const alertStatus =
    params.status === "success"
      ? "success"
      : params.status === "error"
        ? "error"
        : null;

  const cookieStore = await cookies();
  const callbackSecretFlashToken = cookieStore.get(
    AGENT_CALLBACK_SECRET_FLASH_COOKIE,
  )?.value;
  const callbackSecretFlash: AgentCallbackSecretFlash | null =
    callbackSecretFlashToken
      ? await consumeAgentCallbackSecretFlash(callbackSecretFlashToken)
      : null;

  const userContext = await requirePlatformOperatorUserContext();
  const features = await getFeatureSnapshot();
  if (isFeatureSnapshotUnavailable(features)) {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState
            diagnostics
            label="智能体运营模块"
            result={createDependencyFailureResult({
              error: new Error("Feature snapshot unavailable"),
              message: "当前无法读取智能体模块状态，请稍后再试。",
              source: "core-features",
            })}
          />
        </div>
      </main>
    );
  }
  if (!features.agentRegistry.enabled) {
    return (
      <main className="app-page">
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">智能体注册已关闭</h1>
            <p className="mg-copy">当前环境未开启智能体注册与回调治理能力。</p>
          </Card>
        </div>
      </main>
    );
  }

  const dependencyResults: Array<DependencyResult<unknown>> = [];
  const dependencyResultsBySource = new Map<string, DependencyResult<unknown>>();
  function loadDependency<T>(
    promise: Promise<T>,
    args: { fallback: T; message: string; source: string; unauthorizedMessage: string },
  ) {
    return promise.then(
      (value) => {
        const result = createDependencyResult({ state: "ready", data: value });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return value;
      },
      (error: unknown) => {
        const result = createDependencyFailureResult<T>({
          error,
          message: args.message,
          source: args.source,
          unauthorizedMessage: args.unauthorizedMessage,
        });
        dependencyResults.push(result);
        dependencyResultsBySource.set(args.source, result);
        return args.fallback;
      },
    );
  }

  const sourceFailed = (source: string) => {
    const result = dependencyResultsBySource.get(source);
    return result?.state === "unavailable" || result?.state === "unauthorized";
  };

  const [
    agents,
    executions,
    callbackHealthSummaries,
    remediationPolicies,
    runtimeCatalog,
  ] =
    await Promise.all([
      loadDependency(listAgents(userContext), {
        fallback: [] as AgentView[],
        message: "智能体目录暂不可用。",
        unauthorizedMessage: "当前运营账户无权读取智能体目录。",
        source: "agent-registry",
      }),
      loadDependency(listAgentExecutions(userContext), {
        fallback: [] as AgentExecutionView[],
        message: "智能体执行目录暂不可用。",
        unauthorizedMessage: "当前运营账户无权读取智能体执行目录。",
        source: "agent-executions",
      }),
      loadDependency(listAgentCallbackHealthSummaries(userContext), {
        fallback: [] as AgentCallbackHealthSummaryView[],
        message: "回调健康摘要暂不可用。",
        unauthorizedMessage: "当前运营账户无权读取回调健康摘要。",
        source: "agent-callback-health",
      }),
      loadDependency(listAgentCallbackRemediationPolicies(userContext), {
        fallback: [],
        message: "回调补救策略暂不可用。",
        unauthorizedMessage: "当前运营账户无权读取回调补救策略。",
        source: "agent-remediation-policies",
      }),
      loadDependency(getAgentExecutionRuntimeCatalog(userContext), {
        fallback: null,
        message: "执行运行时目录暂不可用。",
        unauthorizedMessage: "当前运营账户无权读取执行运行时目录。",
        source: "agent-runtime-catalog",
      }),
    ]);

  const agentRegistryUnavailable = sourceFailed("agent-registry");
  const agentRegistryDependency = dependencyResultsBySource.get("agent-registry");
  if (agentRegistryUnavailable && agentRegistryDependency) {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState label="智能体目录" result={agentRegistryDependency} />
        </div>
      </main>
    );
  }

  const agentExecutionsUnavailable = sourceFailed("agent-executions");
  const callbackHealthUnavailable = sourceFailed("agent-callback-health");
  const remediationPoliciesUnavailable = sourceFailed("agent-remediation-policies");
  const runtimeCatalogUnavailable = sourceFailed("agent-runtime-catalog");

  const healthByAgentId = new Map(
    callbackHealthSummaries.map((summary) => [summary.agentId, summary]),
  );
  const policyCatalog = mergeAgentCallbackPolicyCatalog(
    remediationPolicies,
    agents.map((agent) => agent.externalCallbackRemediationPolicy),
  );
  const executionCountsByAgentId = executions.reduce<
    Map<
      string,
      {
        running: number;
        queued: number;
        submitted: number;
        failed: number;
      }
    >
  >((accumulator, execution) => {
    const current = accumulator.get(execution.agentId) ?? {
      running: 0,
      queued: 0,
      submitted: 0,
      failed: 0,
    };
    if (execution.status === "running") current.running += 1;
    if (execution.status === "queued") current.queued += 1;
    if (execution.status === "submitted") current.submitted += 1;
    if (execution.status === "failed") current.failed += 1;
    accumulator.set(execution.agentId, current);
    return accumulator;
  }, new Map());

  const primaryOwnerPressureByOwnerUserId = (runtimeCatalog?.utilization ?? []).reduce<
    Map<string, AgentExecutionRuntimeCatalogView["utilization"][number]>
  >((accumulator, entry) => {
    const candidateOwnerIds = [
      entry.busiestOwnerUserId,
      entry.busiestBlockedOwnerUserId,
    ].filter((value): value is string => Boolean(value));
    for (const ownerUserId of candidateOwnerIds) {
      const current = accumulator.get(ownerUserId);
      if (
        !current ||
        runtimePressureSortScore({
          pressureLevel: entry.pressureLevel,
          schedulingDecisionClass: entry.schedulingDecisionClass,
        }) >
          runtimePressureSortScore({
            pressureLevel: current.pressureLevel,
            schedulingDecisionClass: current.schedulingDecisionClass,
          })
      ) {
        accumulator.set(ownerUserId, entry);
      }
    }
    return accumulator;
  }, new Map());

  const filteredAgents = agents
    .filter((agent) =>
      sourceTypeFilter === "all" ? true : agent.sourceType === sourceTypeFilter,
    )
    .filter((agent) =>
      policyKeyFilter === "all"
        ? true
        : agent.externalCallbackRemediationPolicyKey === policyKeyFilter,
    )
    .filter((agent) => {
      if (!query) return true;
      const haystack = [
        agent.name,
        agent.description,
        agent.runtimeEndpoint,
        agent.ownerUserId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.toLowerCase());
    })
    .sort((left, right) => {
      const leftHealth = healthByAgentId.get(left.id);
      const rightHealth = healthByAgentId.get(right.id);
      const leftCounts = executionCountsByAgentId.get(left.id) ?? {
        running: 0,
        queued: 0,
        submitted: 0,
        failed: 0,
      };
      const rightCounts = executionCountsByAgentId.get(right.id) ?? {
        running: 0,
        queued: 0,
        submitted: 0,
        failed: 0,
      };
      const leftScore = agentRailPriorityScore({
        rejectedCount: leftHealth?.rejectedCallbacks ?? 0,
        duplicateCount: leftHealth?.duplicateCallbacks ?? 0,
        previousProtocolCount: leftHealth?.previousProtocolHits ?? 0,
        previousSecretCount: leftHealth?.previousSecretHits ?? 0,
        queuedCount: leftCounts.queued,
        runningCount: leftCounts.running,
        failedCount: leftCounts.failed,
        pressureLevel:
          primaryOwnerPressureByOwnerUserId.get(left.ownerUserId)?.pressureLevel,
      });
      const rightScore = agentRailPriorityScore({
        rejectedCount: rightHealth?.rejectedCallbacks ?? 0,
        duplicateCount: rightHealth?.duplicateCallbacks ?? 0,
        previousProtocolCount: rightHealth?.previousProtocolHits ?? 0,
        previousSecretCount: rightHealth?.previousSecretHits ?? 0,
        queuedCount: rightCounts.queued,
        runningCount: rightCounts.running,
        failedCount: rightCounts.failed,
        pressureLevel:
          primaryOwnerPressureByOwnerUserId.get(right.ownerUserId)
            ?.pressureLevel,
      });
      return rightScore - leftScore || left.name.localeCompare(right.name);
    });

  const selectedAgent =
    filteredAgents.find((agent) => agent.id === params.agentId?.trim()) ??
    filteredAgents[0] ??
    null;

  const [
    selectedCapabilities,
    selectedCallbackHistory,
    selectedRecentCallbacks,
  ]: [
    AgentCapabilityView[],
    AgentCallbackConfigHistoryView[],
    AgentRecentCallbackView[],
  ] = selectedAgent
    ? await Promise.all([
        loadDependency(listAgentCapabilities(userContext, selectedAgent.id), {
          fallback: [] as AgentCapabilityView[],
          message: "智能体能力目录暂不可用。",
          unauthorizedMessage: "当前运营账户无权读取智能体能力目录。",
          source: `agent-capabilities:${selectedAgent.id}`,
        }),
        selectedAgent.sourceType === "external"
          ? loadDependency(listOperatorAgentCallbackHistory(userContext, selectedAgent.id, 6), {
              fallback: [] as AgentCallbackConfigHistoryView[],
              message: "回调配置历史暂不可用。",
              unauthorizedMessage: "当前运营账户无权读取回调配置历史。",
              source: `agent-callback-history:${selectedAgent.id}`,
            })
          : Promise.resolve([] as AgentCallbackConfigHistoryView[]),
        selectedAgent.sourceType === "external"
          ? loadDependency(listAgentRecentCallbacks(userContext, selectedAgent.id, 6), {
              fallback: [] as AgentRecentCallbackView[],
              message: "近期回调审计暂不可用。",
              unauthorizedMessage: "当前运营账户无权读取近期回调审计。",
              source: `agent-recent-callbacks:${selectedAgent.id}`,
            })
          : Promise.resolve([] as AgentRecentCallbackView[]),
      ])
    : [[], [], []];
  const selectedRuntimeSessionSummary = selectedAgent
    ? await loadDependency(
        getAgentExecutionRuntimeSessionSummary(userContext, {
          agentId: selectedAgent.id,
          ownerUserId: selectedAgent.ownerUserId,
        }),
        {
          fallback: null,
          message: "运行时会话摘要暂不可用。",
          unauthorizedMessage: "当前运营账户无权读取运行时会话摘要。",
          source: `agent-runtime-session:${selectedAgent.id}`,
        },
      )
    : null;
  const selectedCapabilityUnavailable = selectedAgent
    ? sourceFailed(`agent-capabilities:${selectedAgent.id}`)
    : false;
  const selectedCallbackHistoryUnavailable = selectedAgent
    ? sourceFailed(`agent-callback-history:${selectedAgent.id}`)
    : false;
  const selectedRecentCallbacksUnavailable = selectedAgent
    ? sourceFailed(`agent-recent-callbacks:${selectedAgent.id}`)
    : false;
  const selectedRuntimeSessionUnavailable = selectedAgent
    ? sourceFailed(`agent-runtime-session:${selectedAgent.id}`)
    : false;
  const selectedCapabilityDependency = selectedAgent
    ? dependencyResultsBySource.get(`agent-capabilities:${selectedAgent.id}`)
    : undefined;
  const selectedCallbackHistoryDependency = selectedAgent
    ? dependencyResultsBySource.get(`agent-callback-history:${selectedAgent.id}`)
    : undefined;
  const selectedRecentCallbacksDependency = selectedAgent
    ? dependencyResultsBySource.get(`agent-recent-callbacks:${selectedAgent.id}`)
    : undefined;
  const selectedRuntimeSessionDependency = selectedAgent
    ? dependencyResultsBySource.get(`agent-runtime-session:${selectedAgent.id}`)
    : undefined;
  const agentExecutionsDependency = dependencyResultsBySource.get("agent-executions");
  const callbackHealthDependency = dependencyResultsBySource.get("agent-callback-health");
  const remediationPoliciesDependency = dependencyResultsBySource.get("agent-remediation-policies");
  const runtimeCatalogDependency = dependencyResultsBySource.get("agent-runtime-catalog");
  const operatorActionsUnavailable =
    agentExecutionsUnavailable ||
    runtimeCatalogUnavailable ||
    selectedRuntimeSessionUnavailable ||
    (selectedAgent?.sourceType === "external" &&
      (callbackHealthUnavailable || remediationPoliciesUnavailable || selectedRecentCallbacksUnavailable));

  const selectedHealth = selectedAgent
    ? (healthByAgentId.get(selectedAgent.id) ?? null)
    : null;

  const createRedirectTo = buildAgentsOpsHref({
    executionStatus: executionStatusFilter,
    policyKey: policyKeyFilter,
    q: query,
    sourceType: sourceTypeFilter,
  });

  const opsDependency = combineDependencyResults({
    data: null,
    empty:
      dependencyResults.every((result) => result.failures.length === 0) &&
      agents.length === 0 &&
      executions.length === 0 &&
      callbackHealthSummaries.length === 0 &&
      remediationPolicies.length === 0 &&
      runtimeCatalog === null,
    results: dependencyResults,
  });

  if (
    opsDependency.state === "unavailable" ||
    opsDependency.state === "unauthorized"
  ) {
    return (
      <main className="app-page">
        <div className="nt-shell" style={{ paddingBlock: 32 }}>
          <DependencyState
            diagnostics
            label="智能体运营数据"
            result={opsDependency}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div
        className="mg-shell app-stack"
        style={{ display: "grid", gap: "28px", paddingBlock: "32px 48px" }}
      >
        <Panel className="app-stack">
        <Badge variant="cyan">智能体运维终端</Badge>
          <h1 className="mg-title">智能体模块运维台</h1>
          <p className="mg-copy">
            当前页面继续复用{" "}
            <code>core / agent-registry + agent-execution</code>
            ，不新造账户域后端。 这里直接处理当前运维可见的智能体
            目录、能力、回调治理与执行流转。
          </p>
          <div className="app-inline-actions">
            <Link className="nt-btn nt-btn--secondary" href="/agents">
              智能体中心
            </Link>
            <Link className="nt-btn nt-btn--secondary" href="/my-agents">
              我的智能体
            </Link>
            <Link
              className="nt-btn nt-btn--secondary"
              href="/ops/agent-callbacks"
            >
              回调运维
            </Link>
          </div>
        </Panel>

        {opsDependency.state === "partial" ? (
          <div style={{ paddingInline: 20 }}>
            <DependencyState
              diagnostics
              label="智能体运营数据"
              result={opsDependency}
            />
          </div>
        ) : null}

        {alertStatus && params.message ? (
          <Card className="app-stack">
            <p
              className={
                alertStatus === "success"
                  ? "app-banner app-banner--success"
                  : "app-banner app-banner--error"
              }
            >
              {params.message}
            </p>
          </Card>
        ) : null}

        <AgentsOpsOverviewSection
          agentExecutionsUnavailable={agentExecutionsUnavailable}
          agents={agents}
          callbackHealthUnavailable={callbackHealthUnavailable}
          executions={executions}
          healthByAgentId={healthByAgentId}
        />

        <div className="app-announcement-ops">
          <AgentsOpsSidebar
            createRedirectTo={createRedirectTo}
            executionCountsByAgentId={executionCountsByAgentId}
            executionStatusFilter={executionStatusFilter}
            filteredAgents={filteredAgents}
            healthByAgentId={healthByAgentId}
            policyCatalog={policyCatalog}
            policyKeyFilter={policyKeyFilter}
            primaryOwnerPressureByOwnerUserId={primaryOwnerPressureByOwnerUserId}
            query={query}
            selectedAgentId={selectedAgent?.id ?? null}
            sourceTypeFilter={sourceTypeFilter}
          />

          <section className="app-announcement-ops__panel">
            {!selectedAgent ? (
              <Card className="app-announcement-ops__panel-card app-stack">
                <Badge variant="warning">未选择智能体</Badge>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>
                  当前没有可管理的智能体
                </h2>
                <p className="mg-copy" style={{ margin: 0 }}>
                  你可以先在左侧创建一个平台代运行 / 接口定义
                  智能体，或调整筛选条件把已有智能体拉回列表。
                </p>
              </Card>
            ) : (
              <SelectedAgentPanel
                agentExecutionsDependency={agentExecutionsDependency}
                agentExecutionsUnavailable={agentExecutionsUnavailable}
                callbackHealthDependency={callbackHealthDependency}
                callbackHealthUnavailable={callbackHealthUnavailable}
                callbackSecretFlash={callbackSecretFlash}
                executions={executions}
                executionStatusFilter={executionStatusFilter}
                operatorActionsUnavailable={operatorActionsUnavailable}
                policyCatalog={policyCatalog}
                policyKeyFilter={policyKeyFilter}
                query={query}
                remediationPolicies={remediationPolicies}
                remediationPoliciesDependency={remediationPoliciesDependency}
                remediationPoliciesUnavailable={remediationPoliciesUnavailable}
                runtimeCatalog={runtimeCatalog}
                runtimeCatalogDependency={runtimeCatalogDependency}
                runtimeCatalogUnavailable={runtimeCatalogUnavailable}
                selectedAgent={selectedAgent}
                selectedCallbackHistory={selectedCallbackHistory}
                selectedCallbackHistoryDependency={selectedCallbackHistoryDependency}
                selectedCallbackHistoryUnavailable={selectedCallbackHistoryUnavailable}
                selectedCapabilities={selectedCapabilities}
                selectedCapabilityDependency={selectedCapabilityDependency}
                selectedCapabilityUnavailable={selectedCapabilityUnavailable}
                selectedHealth={selectedHealth}
                selectedRecentCallbacks={selectedRecentCallbacks}
                selectedRecentCallbacksDependency={selectedRecentCallbacksDependency}
                selectedRecentCallbacksUnavailable={selectedRecentCallbacksUnavailable}
                selectedRuntimeSessionSummary={selectedRuntimeSessionSummary}
                selectedRuntimeSessionDependency={selectedRuntimeSessionDependency}
                selectedRuntimeSessionUnavailable={selectedRuntimeSessionUnavailable}
                sourceTypeFilter={sourceTypeFilter}
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
