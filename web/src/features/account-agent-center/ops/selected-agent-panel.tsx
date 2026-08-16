import Link from "next/link";

import type {
  AgentCallbackConfigHistoryView,
  AgentCallbackHealthSummaryView,
  AgentCapabilityView,
  AgentExecutionStatus,
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimeSessionSummaryView,
  AgentRecentCallbackView,
  AgentCallbackRemediationPolicyView,
} from "@neuro/contracts";
import { DependencyState } from "@/components/dependency-state";
import { NtBadge as Badge, NtCard as Card } from "@/components/nt-primitives";
import { formatAgentCallbackPolicyLabel } from "@/lib/agent-callback-policies";
import {
  EXECUTION_STATUS_ORDER,
  buildAgentsOpsHref,
  buildPathWithParams,
  formatAgentLayerLabel,
  formatAgentSourceType,
  formatCount,
  formatRate,
  runtimePressureSortScore,
} from "@/lib/agent-ops-presentation";
import {
  buildHealthPosture,
  buildOperatorPlaybook,
} from "@/lib/agent-ops-playbooks";
import type { AgentExecutionView, AgentView } from "@/lib/core-client";
import type { DependencyResult } from "@/lib/dependency-result";
import {
  executionPriorityScore,
  recentCallbackPriorityScore,
} from "./item-builders";
import {
  SelectedAgentHeroCard,
  SelectedAgentSummaryCard,
} from "./sections";
import { SelectedAgentActivitySection } from "./selected-agent-activity-section";
import { SelectedAgentGovernanceSection } from "./selected-agent-governance-section";
import { SelectedAgentRuntimeSection } from "./selected-agent-runtime-section";

type AgentCallbackSecretFlash = {
  agentId: string;
  callbackSecret: string;
};

export function SelectedAgentPanel(props: {
  agentExecutionsDependency?: DependencyResult<unknown>;
  agentExecutionsUnavailable: boolean;
  callbackHealthDependency?: DependencyResult<unknown>;
  callbackHealthUnavailable: boolean;
  callbackSecretFlash: AgentCallbackSecretFlash | null;
  executions: AgentExecutionView[];
  executionStatusFilter: AgentExecutionStatus | "all";
  operatorActionsUnavailable: boolean;
  policyCatalog: AgentCallbackRemediationPolicyView[];
  policyKeyFilter: string;
  query: string;
  remediationPolicies: AgentCallbackRemediationPolicyView[];
  remediationPoliciesDependency?: DependencyResult<unknown>;
  remediationPoliciesUnavailable: boolean;
  runtimeCatalog: AgentExecutionRuntimeCatalogView | null;
  runtimeCatalogDependency?: DependencyResult<unknown>;
  runtimeCatalogUnavailable: boolean;
  selectedAgent: AgentView;
  selectedCallbackHistory: AgentCallbackConfigHistoryView[];
  selectedCallbackHistoryDependency?: DependencyResult<unknown>;
  selectedCallbackHistoryUnavailable: boolean;
  selectedCapabilities: AgentCapabilityView[];
  selectedCapabilityDependency?: DependencyResult<unknown>;
  selectedCapabilityUnavailable: boolean;
  selectedHealth: AgentCallbackHealthSummaryView | null;
  selectedRecentCallbacks: AgentRecentCallbackView[];
  selectedRecentCallbacksDependency?: DependencyResult<unknown>;
  selectedRecentCallbacksUnavailable: boolean;
  selectedRuntimeSessionSummary: AgentExecutionRuntimeSessionSummaryView | null;
  selectedRuntimeSessionDependency?: DependencyResult<unknown>;
  selectedRuntimeSessionUnavailable: boolean;
  sourceTypeFilter: string;
}) {
  const {
    agentExecutionsDependency,
    agentExecutionsUnavailable,
    callbackHealthDependency,
    callbackHealthUnavailable,
    callbackSecretFlash,
    executions,
    executionStatusFilter,
    operatorActionsUnavailable,
    policyCatalog,
    policyKeyFilter,
    query,
    remediationPolicies,
    remediationPoliciesDependency,
    remediationPoliciesUnavailable,
    runtimeCatalog,
    runtimeCatalogDependency,
    runtimeCatalogUnavailable,
    selectedAgent,
    selectedCallbackHistory,
    selectedCallbackHistoryDependency,
    selectedCallbackHistoryUnavailable,
    selectedCapabilities,
    selectedCapabilityDependency,
    selectedCapabilityUnavailable,
    selectedHealth,
    selectedRecentCallbacks,
    selectedRecentCallbacksDependency,
    selectedRecentCallbacksUnavailable,
    selectedRuntimeSessionSummary,
    selectedRuntimeSessionDependency,
    selectedRuntimeSessionUnavailable,
    sourceTypeFilter,
  } = props;

  const executionPolicyOptions = [
    {
      value: "inherit_agent",
      label: "继承智能体默认",
      note: "清空执行级覆盖，回退到关联智能体当前回调补救策略。",
    },
    ...policyCatalog.map((policy) => ({
      value: policy.key,
      label: formatAgentCallbackPolicyLabel(policy),
      note: policy.note,
    })),
  ];

  const selectedAgentExecutionPool = executions.filter(
    (execution) => execution.agentId === selectedAgent.id,
  );
  const selectedExecutions = selectedAgentExecutionPool
    .filter((execution) =>
      executionStatusFilter === "all"
        ? true
        : execution.status === executionStatusFilter,
    )
    .sort((left, right) => {
      const priorityDelta =
        executionPriorityScore(right) - executionPriorityScore(left);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const leftTime = new Date(left.updatedAt ?? left.createdAt).getTime();
      const rightTime = new Date(
        right.updatedAt ?? right.createdAt,
      ).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 6);
  const selectedRecentCallbackAudits = [...selectedRecentCallbacks].sort(
    (left, right) =>
      recentCallbackPriorityScore(right) - recentCallbackPriorityScore(left) ||
      new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime(),
  );

  const currentOpsHref = buildAgentsOpsHref({
    agentId: selectedAgent.id,
    executionStatus: executionStatusFilter,
    policyKey: policyKeyFilter,
    q: query,
    sourceType: sourceTypeFilter,
  });
  const buildCurrentSectionHref = (fragment?: string | null) =>
    buildPathWithParams(
      "/ops/account/agents",
      {
        agentId: selectedAgent.id,
        executionStatus:
          executionStatusFilter === "all" ? null : executionStatusFilter,
        policyKey: policyKeyFilter === "all" ? null : policyKeyFilter,
        q: query || null,
        sourceType: sourceTypeFilter === "all" ? null : sourceTypeFilter,
      },
      fragment,
    );
  const runtimePressurePlaybookReturnHref = buildCurrentSectionHref(
    "runtime-pressure-playbook",
  );
  const actionDeckReturnHref = buildCurrentSectionHref("action-deck");
  const recentCallbacksReturnHref = buildCurrentSectionHref(
    "recent-callback-audits",
  );

  const selectedHealthPosture = !callbackHealthUnavailable
    ? buildHealthPosture(selectedAgent, selectedHealth)
    : null;
  const selectedOperatorPlaybook =
    !callbackHealthUnavailable && !agentExecutionsUnavailable
      ? buildOperatorPlaybook({
          agent: selectedAgent,
          currentOpsHref,
          executionCount: selectedAgentExecutionPool.length,
          health: selectedHealth,
        })
      : null;
  const selectedExecutionStatusCounts = EXECUTION_STATUS_ORDER.reduce<
    Record<AgentExecutionStatus, number>
  >(
    (accumulator, status) => {
      accumulator[status] = selectedAgentExecutionPool.filter(
        (execution) => execution.status === status,
      ).length;
      return accumulator;
    },
    {
      running: 0,
      queued: 0,
      submitted: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    },
  );
  const selectedOwnerPressureEntries = runtimeCatalog
    ? runtimeCatalog.utilization
        .filter(
          (entry) =>
            entry.busiestOwnerUserId === selectedAgent.ownerUserId ||
            entry.busiestBlockedOwnerUserId === selectedAgent.ownerUserId,
        )
        .sort(
          (left, right) =>
            runtimePressureSortScore({
              pressureLevel: right.pressureLevel,
              schedulingDecisionClass: right.schedulingDecisionClass,
            }) -
            runtimePressureSortScore({
              pressureLevel: left.pressureLevel,
              schedulingDecisionClass: left.schedulingDecisionClass,
            }),
        )
    : [];
  const selectedPrimaryOwnerPressure = selectedOwnerPressureEntries[0] ?? null;

  return (
    <Card className="app-announcement-ops__panel-card app-stack">
      <SelectedAgentHeroCard
        badges={
          <>
            <Badge
              variant={selectedAgent.enabled ? "success" : "warning"}
            >
              {selectedAgent.enabled ? "已启用" : "已禁用"}
            </Badge>
            <Badge variant="violet">{formatAgentLayerLabel(selectedAgent)}</Badge>
            <Badge variant="cyan">{formatAgentSourceType(selectedAgent.sourceType)}</Badge>
            {selectedAgent.externalCallbackConfigured ? (
              <Badge variant="cyan">回调已配置</Badge>
            ) : null}
          </>
        }
        detail={
          <p style={{ margin: 0 }}>
            这里不再只读展示目录，而是直接提供能力、回调
            治理和执行流转入口。
          </p>
        }
        quickActions={
          <>
            <Link
              className="nt-btn nt-btn--secondary"
              href="/agents?mode=tasks"
            >
              智能体中心
            </Link>
            <Link
              className="nt-btn nt-btn--secondary"
              href={`/ops/agent-callbacks?agentId=${encodeURIComponent(selectedAgent.id)}`}
            >
              回调审计
            </Link>
          </>
        }
        title={selectedAgent.name}
      />

      {selectedHealthPosture ? (
        <SelectedAgentSummaryCard
          badge={
            <Badge variant={selectedHealthPosture.variant}>
              {selectedHealthPosture.label}
            </Badge>
          }
          detail={<p className="app-note">{selectedHealthPosture.detail}</p>}
          footer={
            selectedAgent.sourceType === "external" && selectedHealth ? (
              <div className="app-inline-actions">
                <span>{`重复 ${formatRate(selectedHealth.duplicateCallbacks, selectedHealth.totalCallbacks)}`}</span>
                <span>{`拒绝 ${formatRate(selectedHealth.rejectedCallbacks, selectedHealth.totalCallbacks)}`}</span>
                <span>{`兼容命中 ${formatCount(selectedHealth.previousProtocolHits + selectedHealth.previousSecretHits)}`}</span>
              </div>
            ) : null
          }
          subtitle="治理状态"
          title={selectedHealthPosture.label}
        />
      ) : null}

      {selectedOperatorPlaybook ? (
        <SelectedAgentSummaryCard
          badge={<Badge variant="warning">next actions</Badge>}
          detail={
            <p className="app-note">
              {selectedOperatorPlaybook.detail}
            </p>
          }
          footer={
            <div className="app-inline-actions">
              {selectedOperatorPlaybook.actions.map((action) => (
                <Link
                  className={
                    action.variant === "primary"
                      ? "nt-btn nt-btn--primary"
                      : action.variant === "secondary"
                        ? "nt-btn nt-btn--secondary"
                        : "nt-btn nt-btn--ghost"
                  }
                  href={action.href}
                  key={`${selectedAgent.id}-${action.label}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          }
          subtitle="Operator Playbook"
          title={selectedOperatorPlaybook.title}
        />
      ) : null}

      {runtimeCatalogUnavailable && runtimeCatalogDependency ? (
        <DependencyState label="执行运行时目录" result={runtimeCatalogDependency} />
      ) : selectedRuntimeSessionUnavailable && selectedRuntimeSessionDependency ? (
        <DependencyState label="运行时会话摘要" result={selectedRuntimeSessionDependency} />
      ) : null}

      <SelectedAgentRuntimeSection
        operatorActionsUnavailable={operatorActionsUnavailable}
        ownerPressureEntryCount={selectedOwnerPressureEntries.length}
        runtimeCatalogUnavailable={runtimeCatalogUnavailable}
        runtimePressurePlaybookReturnHref={runtimePressurePlaybookReturnHref}
        selectedAgent={selectedAgent}
        selectedFailedExecutionCount={selectedExecutionStatusCounts.failed}
        selectedPrimaryOwnerPressure={selectedPrimaryOwnerPressure}
        selectedQueuedExecutionCount={selectedExecutionStatusCounts.queued}
        selectedRunningExecutionCount={selectedExecutionStatusCounts.running}
        selectedRuntimeSessionSummary={selectedRuntimeSessionSummary}
        selectedRuntimeSessionUnavailable={selectedRuntimeSessionUnavailable}
      />

      <SelectedAgentGovernanceSection
        agentExecutionsDependency={agentExecutionsDependency}
        agentExecutionsUnavailable={agentExecutionsUnavailable}
        callbackHealthDependency={callbackHealthDependency}
        callbackHealthUnavailable={callbackHealthUnavailable}
        callbackSecretFlash={callbackSecretFlash}
        currentOpsHref={currentOpsHref}
        executionPoolCount={selectedAgentExecutionPool.length}
        executionStatusCounts={selectedExecutionStatusCounts}
        policyCatalog={policyCatalog}
        policyKeyFilter={policyKeyFilter}
        query={query}
        recentCallbacksReturnHref={recentCallbacksReturnHref}
        remediationPolicies={remediationPolicies}
        remediationPoliciesDependency={remediationPoliciesDependency}
        remediationPoliciesUnavailable={remediationPoliciesUnavailable}
        selectedAgent={selectedAgent}
        selectedCallbackHistory={selectedCallbackHistory}
        selectedCallbackHistoryDependency={selectedCallbackHistoryDependency}
        selectedCallbackHistoryUnavailable={selectedCallbackHistoryUnavailable}
        selectedCapabilities={selectedCapabilities}
        selectedCapabilityUnavailable={selectedCapabilityUnavailable}
        selectedHealth={selectedHealth}
        selectedRecentCallbackAudits={selectedRecentCallbackAudits}
        selectedRecentCallbacksDependency={selectedRecentCallbacksDependency}
        selectedRecentCallbacksUnavailable={selectedRecentCallbacksUnavailable}
        sourceTypeFilter={sourceTypeFilter}
      />

      <SelectedAgentActivitySection
        actionDeckReturnHref={actionDeckReturnHref}
        agentExecutionsDependency={agentExecutionsDependency}
        agentExecutionsUnavailable={agentExecutionsUnavailable}
        currentOpsHref={currentOpsHref}
        executionPolicyOptions={executionPolicyOptions}
        executionStatusCounts={selectedExecutionStatusCounts}
        executionStatusFilter={executionStatusFilter}
        operatorActionsUnavailable={operatorActionsUnavailable}
        policyKeyFilter={policyKeyFilter}
        query={query}
        selectedAgent={selectedAgent}
        selectedCapabilities={selectedCapabilities}
        selectedCapabilityDependency={selectedCapabilityDependency}
        selectedCapabilityUnavailable={selectedCapabilityUnavailable}
        selectedExecutions={selectedExecutions}
        selectedHealth={selectedHealth}
        sourceTypeFilter={sourceTypeFilter}
      />
    </Card>
  );
}
