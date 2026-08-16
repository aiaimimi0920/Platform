import type {
  AgentCallbackHealthSummaryView,
} from "@neuro/contracts";
import { NtBadge as Badge, NtCard as Card } from "@/components/nt-primitives";
import type { AgentExecutionView, AgentView } from "@/lib/core-client";
import {
  formatCount,
  formatDependencyCount,
} from "@/lib/agent-ops-presentation";

export function AgentsOpsOverviewSection(props: {
  agents: AgentView[];
  executions: AgentExecutionView[];
  healthByAgentId: Map<string, AgentCallbackHealthSummaryView>;
  agentExecutionsUnavailable: boolean;
  callbackHealthUnavailable: boolean;
}) {
  const {
    agents,
    executions,
    healthByAgentId,
    agentExecutionsUnavailable,
    callbackHealthUnavailable,
  } = props;

  const runningCount = agentExecutionsUnavailable
    ? null
    : executions.filter((execution) => execution.status === "running").length;
  const queuedCount = agentExecutionsUnavailable
    ? null
    : executions.filter((execution) => execution.status === "queued").length;
  const openProtocolCount = agents.filter(
    (agent) =>
      agent.hostingMode === "open_protocol" ||
      agent.hostingMode === "external_runtime" ||
      agent.sourceType === "external",
  ).length;
  const attentionAgentCount = callbackHealthUnavailable
    ? null
    : agents.filter((agent) => {
    const summary = healthByAgentId.get(agent.id);
    return summary
      ? summary.rejectedCallbacks > 0 ||
          summary.previousProtocolHits > 0 ||
          summary.previousSecretHits > 0
      : false;
    }).length;
  const healthyOpenProtocolCount =
    attentionAgentCount === null ? null : Math.max(0, openProtocolCount - attentionAgentCount);

  return (
    <Card className="app-stack">
      <div className="app-task-card__header">
        <div>
          <p className="mg-subtitle">运维总览</p>
          <h2 className="app-card-title">当前范围总览</h2>
        </div>
        <Badge variant="fuchsia">{formatCount(agents.length)} 个智能体</Badge>
      </div>
      <div className="app-wallet-grid">
        <Card className="app-currency-card">
          <div className="app-currency-card__header">
            <div>
              <p className="mg-subtitle">登记总数</p>
              <h2 className="app-card-title">注册表</h2>
            </div>
          </div>
          <div className="app-currency-card__value">
            {formatCount(agents.length)}
          </div>
          <div className="app-currency-meta">
            <div className="app-currency-meta__row">
              <span>启用中</span>
              <span>
                {formatCount(
                  agents.filter((agent) => agent.enabled).length,
                )}
              </span>
            </div>
            <div className="app-currency-meta__row">
              <span>OpenAgent</span>
              <span>{formatCount(openProtocolCount)}</span>
            </div>
          </div>
        </Card>
        <Card className="app-currency-card">
          <div className="app-currency-card__header">
            <div>
              <p className="mg-subtitle">执行活跃</p>
              <h2 className="app-card-title">运行状态</h2>
            </div>
          </div>
          <div className="app-currency-card__value">
            {formatDependencyCount(runningCount)}
          </div>
          <div className="app-currency-meta">
            <div className="app-currency-meta__row">
              <span>排队中</span>
              <span>{formatDependencyCount(queuedCount)}</span>
            </div>
            <div className="app-currency-meta__row">
              <span>待验收</span>
              <span>
                {formatDependencyCount(
                  agentExecutionsUnavailable
                    ? null
                    : executions.filter((execution) => execution.status === "submitted").length,
                )}
              </span>
            </div>
          </div>
        </Card>
        <Card className="app-currency-card">
          <div className="app-currency-card__header">
            <div>
              <p className="mg-subtitle">治理注意项</p>
              <h2 className="app-card-title">回调治理</h2>
            </div>
          </div>
          <div className="app-currency-card__value">
            {formatDependencyCount(attentionAgentCount)}
          </div>
          <div className="app-currency-meta">
            <div className="app-currency-meta__row">
              <span>有被拒绝 / 兼容命中</span>
              <span>{formatDependencyCount(attentionAgentCount)}</span>
            </div>
            <div className="app-currency-meta__row">
              <span>健康 OpenAgent</span>
              <span>
                {formatDependencyCount(healthyOpenProtocolCount)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
}
