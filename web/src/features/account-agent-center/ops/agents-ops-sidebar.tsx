import Link from "next/link";

import type {
  AgentCallbackHealthSummaryView,
  AgentExecutionRuntimeCatalogView,
} from "@neuro/contracts";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtSelect as Select,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import type { AgentCallbackRemediationPolicyView } from "@neuro/contracts";
import type { AgentView } from "@/lib/core-client";
import {
  EXECUTION_STATUS_ORDER,
  buildAgentsOpsHref,
  formatAgentLayerLabel,
  formatAgentSourceType,
  formatCount,
} from "@/lib/agent-ops-presentation";
import { createAgentAction } from "@/lib/platform-actions";
import {
  AgentRailItem,
  type AgentRailBadge,
  type AgentRailSignal,
} from "./sections";

type AgentExecutionCounts = {
  running: number;
  queued: number;
  submitted: number;
  failed: number;
};

type OwnerPressureEntry = AgentExecutionRuntimeCatalogView["utilization"][number];

export function AgentsOpsSidebar(props: {
  createRedirectTo: string;
  executionCountsByAgentId: Map<string, AgentExecutionCounts>;
  executionStatusFilter: string;
  filteredAgents: AgentView[];
  healthByAgentId: Map<string, AgentCallbackHealthSummaryView>;
  policyCatalog: AgentCallbackRemediationPolicyView[];
  policyKeyFilter: string;
  primaryOwnerPressureByOwnerUserId: Map<string, OwnerPressureEntry>;
  query: string;
  selectedAgentId: string | null;
  sourceTypeFilter: string;
}) {
  const {
    createRedirectTo,
    executionCountsByAgentId,
    executionStatusFilter,
    filteredAgents,
    healthByAgentId,
    policyCatalog,
    policyKeyFilter,
    primaryOwnerPressureByOwnerUserId,
    query,
    selectedAgentId,
    sourceTypeFilter,
  } = props;

  const buildRailSignal = (
    agent: AgentView,
    health: AgentCallbackHealthSummaryView | null | undefined,
  ): AgentRailSignal => {
    const counts = executionCountsByAgentId.get(agent.id) ?? {
      running: 0,
      queued: 0,
      submitted: 0,
      failed: 0,
    };
    const pressure =
      primaryOwnerPressureByOwnerUserId.get(agent.ownerUserId) ?? null;
    const compatibilityHits =
      (health?.previousProtocolHits ?? 0) + (health?.previousSecretHits ?? 0);

    if (pressure?.pressureLevel === "critical") {
      return {
        label: "critical hotspot",
        detail: pressure.pressureDetail,
        variant: "danger",
      };
    }
    if ((health?.rejectedCallbacks ?? 0) > 0) {
      return {
        label: "回调被拒绝",
        detail: `最近窗口内有 ${formatCount(health?.rejectedCallbacks ?? 0)} 次被拒绝回调，需要优先复核审计或补救动作。`,
        variant: (health?.rejectedCallbacks ?? 0) >= 3 ? "danger" : "warning",
      };
    }
    if (counts.failed > 0) {
      return {
        label: "failed executions",
        detail: `当前有 ${formatCount(counts.failed)} 条 failed execution，建议先做恢复或失败归因。`,
        variant: "danger",
      };
    }
    if (counts.queued > 0) {
      return {
        label: "queue backlog",
        detail: `当前有 ${formatCount(counts.queued)} 条 queued execution 正在等待推进。`,
        variant:
          pressure?.pressureLevel === "watch" || counts.queued >= 3
            ? "warning"
            : "violet",
      };
    }
    if (compatibilityHits > 0 || (health?.duplicateCallbacks ?? 0) > 0) {
      return {
        label: "兼容观测",
        detail:
          compatibilityHits > 0
            ? `最近窗口内仍有 ${formatCount(compatibilityHits)} 次兼容命中，需要继续关注协议或密钥窗口。`
            : `最近窗口内出现 ${formatCount(health?.duplicateCallbacks ?? 0)} 次重复回调，建议回看重放 / 幂等行为。`,
        variant: "warning",
      };
    }
    if (counts.running > 0) {
      return {
        label: "运行中",
        detail: `当前有 ${formatCount(counts.running)} 条运行中执行正在该智能体上运行。`,
        variant: "cyan",
      };
    }
    return {
      label: agent.enabled ? "稳定" : "停用",
      detail: agent.enabled
        ? "当前没有明显热点，适合保持常规巡检。"
        : "智能体当前处于停用状态，恢复前不应接收新工作。",
      variant: agent.enabled ? "glass" : "secondary",
    };
  };
  const buildRailBadges = (
    agent: AgentView,
    health: AgentCallbackHealthSummaryView | null | undefined,
  ): AgentRailBadge[] => {
    const counts = executionCountsByAgentId.get(agent.id) ?? {
      running: 0,
      queued: 0,
      submitted: 0,
      failed: 0,
    };
    const badges: AgentRailBadge[] = [];
    if (counts.running > 0) {
      badges.push({ label: `运行中 ${counts.running}`, variant: "cyan" });
    }
    if (counts.queued > 0) {
      badges.push({ label: `排队 ${counts.queued}`, variant: "violet" });
    }
    if (counts.failed > 0) {
      badges.push({ label: `failed ${counts.failed}`, variant: "danger" });
    }
    if ((health?.rejectedCallbacks ?? 0) > 0) {
      badges.push({
        label: `被拒绝 ${health?.rejectedCallbacks ?? 0}`,
        variant: "danger",
      });
    } else if (
      (health?.previousProtocolHits ?? 0) > 0 ||
      (health?.previousSecretHits ?? 0) > 0
    ) {
      badges.push({
        label: `兼容 ${formatCount(
          (health?.previousProtocolHits ?? 0) +
            (health?.previousSecretHits ?? 0),
        )}`,
        variant: "warning",
      });
    } else if ((health?.duplicateCallbacks ?? 0) > 0) {
      badges.push({
        label: `重复 ${health?.duplicateCallbacks ?? 0}`,
        variant: "warning",
      });
    }
    if (counts.submitted > 0) {
      badges.push({
        label: `submitted ${counts.submitted}`,
        variant: "warning",
      });
    }
    return badges.slice(0, 4);
  };

  return (
    <aside className="app-announcement-ops__sidebar">
      <Card className="app-announcement-ops__sidebar-card">
        <div className="app-announcement-ops__sidebar-head">
            <Badge variant="warning">筛选</Badge>
          <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>
            智能体列表
          </h2>
          <p style={{ margin: 0, color: "rgba(226,232,240,0.72)" }}>
            先收口当前运维可见的智能体，再在右侧做治理动作。
          </p>
        </div>

        <form
          action="/ops/account/agents"
          className="app-announcement-ops__form"
          method="get"
        >
          <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
            <label className="app-announcement-ops__field">
              <span>搜索</span>
              <Input
                defaultValue={query}
                name="q"
                placeholder="名称、owner、runtime"
              />
            </label>
            <label className="app-announcement-ops__field">
              <span>来源</span>
              <Select defaultValue={sourceTypeFilter} name="sourceType">
                <option value="all">全部</option>
                <option value="platform">平台代运行</option>
                <option value="external">接口定义</option>
              </Select>
            </label>
            <label className="app-announcement-ops__field">
              <span>回调策略</span>
              <Select defaultValue={policyKeyFilter} name="policyKey">
                <option value="all">全部</option>
                {policyCatalog.map((policy) => (
                  <option key={policy.key} value={policy.key}>
                    {policy.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="app-announcement-ops__field">
              <span>执行状态</span>
              <Select
                defaultValue={executionStatusFilter}
                name="executionStatus"
              >
                <option value="all">全部</option>
                {EXECUTION_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="app-announcement-ops__actions">
            <button className="nt-btn nt-btn--secondary" type="submit">
              应用筛选
            </button>
            <Link
              className="nt-btn nt-btn--outline"
              href="/ops/account/agents"
            >
              清空
            </Link>
          </div>
        </form>

        <div className="app-stack" style={{ marginTop: "12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <Badge variant="cyan">创建智能体</Badge>
            <Badge variant="violet">{`${formatCount(filteredAgents.length)} 条在列表中`}</Badge>
          </div>
          <form
            action={createAgentAction}
            className="app-announcement-ops__form"
          >
            <input
              name="redirectTo"
              type="hidden"
              value={createRedirectTo}
            />
            <div className="app-announcement-ops__field-grid app-mission-ops__field-grid">
              <label className="app-announcement-ops__field">
                <span>名称</span>
                <Input name="name" placeholder="智能体名称" required />
              </label>
              <label className="app-announcement-ops__field">
                <span>层级</span>
                <Select defaultValue="managed_light" name="agentLayer">
                  <option value="managed_light">平台轻量智能体</option>
                  <option disabled value="managed_heavy">平台重型智能体（请前往重度智能体入口）</option>
                  <option value="open_protocol">OpenAgent 接入</option>
                </Select>
              </label>
              <label className="app-announcement-ops__field">
                <span>鉴权</span>
                <Select defaultValue="none" name="authMode">
                  <option value="none">none</option>
                  <option value="apiKey">apiKey</option>
                  <option value="bearer">bearer</option>
                </Select>
              </label>
              <label className="app-announcement-ops__field">
                <span>运行地址</span>
                <Input
                  name="runtimeEndpoint"
                  placeholder="https://runtime.example"
                />
              </label>
              <label className="app-announcement-ops__field">
                <span>服务商</span>
                <Input name="managedProviderLabel" placeholder="OpenAI / Anthropic / ..." />
              </label>
              <label className="app-announcement-ops__field">
                <span>接口基础地址</span>
                <Input name="managedApiBaseUrl" placeholder="https://api.example/v1/responses" />
              </label>
              <label className="app-announcement-ops__field">
                <span>模型</span>
                <Input name="managedModel" placeholder="gpt-4.1-mini" />
              </label>
              <label className="app-announcement-ops__field">
                <span>访问密钥</span>
                <Input name="managedApiKey" placeholder="sk-..." />
              </label>
              <label
                className="app-announcement-ops__field"
                style={{ gridColumn: "1 / -1" }}
              >
                <span>描述</span>
                <Textarea
                  name="description"
                  placeholder="这个智能体解决什么问题、依赖什么环境。"
                  rows={4}
                />
              </label>
              <label
                className="app-announcement-ops__field"
                style={{ gridColumn: "1 / -1" }}
              >
                <span>系统提示词</span>
                <Textarea
                  name="managedSystemPrompt"
                  placeholder="你是什么样的智能体。"
                  rows={4}
                />
              </label>
              <label
                className="app-announcement-ops__field"
                style={{ gridColumn: "1 / -1" }}
              >
                <span>提示词模板</span>
                <Textarea
                  name="managedPromptTemplate"
                  placeholder="任务：{objective}"
                  rows={4}
                />
              </label>
            </div>
            <div className="app-announcement-ops__actions">
              <button className="nt-btn nt-btn--primary" type="submit">
                创建智能体
              </button>
            </div>
          </form>
        </div>

        <div
          className="app-announcement-ops__list"
          style={{ gap: "14px", marginTop: "16px" }}
        >
          {filteredAgents.length === 0 ? (
            <p className="app-note">当前筛选条件下没有匹配的智能体。</p>
          ) : (
            filteredAgents.map((agent) => {
              const active = agent.id === selectedAgentId;
              const health = healthByAgentId.get(agent.id);
              const counts = executionCountsByAgentId.get(agent.id) ?? {
                running: 0,
                queued: 0,
                submitted: 0,
                failed: 0,
              };
              return (
                <AgentRailItem
                  active={active}
                  badges={buildRailBadges(agent, health)}
                  href={buildAgentsOpsHref({
                    agentId: agent.id,
                    executionStatus: executionStatusFilter,
                    policyKey: policyKeyFilter,
                    q: query,
                    sourceType: sourceTypeFilter,
                  })}
                  key={agent.id}
                  signal={buildRailSignal(agent, health)}
                  statusLabel={agent.enabled ? "已启用" : "已停用"}
                  subtitle={`${formatAgentLayerLabel(agent)} · ${formatAgentSourceType(agent.sourceType)} · ${agent.externalCallbackRemediationPolicyKey}`}
                  summary={
                    health
                      ? `${health.totalCallbacks} 次回调 / ${health.rejectedCallbacks} 次被拒绝 / 运行 ${counts.running} / 排队 ${counts.queued}`
                      : `暂无回调统计 / 运行 ${counts.running} / 排队 ${counts.queued}`
                  }
                  title={agent.name}
                />
              );
            })
          )}
        </div>
      </Card>
    </aside>
  );
}
