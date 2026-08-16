import Link from "next/link";

import type {
  AgentCallbackHealthSummaryView,
  AgentCapabilityView,
  AgentExecutionStatus,
} from "@neuro/contracts";
import { DependencyState } from "@/components/dependency-state";
import {
  NtBadge as Badge,
  NtInput as Input,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import {
  type AgentOpsSliceCard,
  buildAgentCallbackOpsHref,
  buildAgentsOpsHref,
  buildPathWithParams,
  formatCount,
  formatDurationSeconds,
  formatShanghaiDateTime,
  sliceToneLabel,
} from "@/lib/agent-ops-presentation";
import { callbackRecommendationToneLabel } from "@/lib/agent-ops-playbooks";
import type { AgentExecutionView, AgentView } from "@/lib/core-client";
import type { DependencyResult } from "@/lib/dependency-result";
import {
  addAgentCapabilityAction,
  autoRemediateRejectedCallbackPayloadsAction,
  recoverStalePlatformExecutionsAction,
  requestRejectedCallbackRetryBatchAction,
  runPlatformExecutorNowAction,
} from "@/lib/platform-actions";
import {
  renderCallbackAutomationFields,
  renderCallbackFollowUpFields,
  renderRuntimeSessionActionFields,
} from "./agent-ops-form-fields";
import {
  buildSelectedExecutionItem,
  type TransitionConfig,
} from "./item-builders";
import {
  type AgentCapabilityListItem,
  AgentOpsDeckCard,
  SelectedAgentCapabilitiesCard,
  SelectedAgentExecutionsCard,
} from "./sections";

const transitionsByStatus: Record<AgentExecutionStatus, TransitionConfig[]> = {
  queued: [
    {
      nextStatus: "running",
      buttonLabel: "标记运行中",
      statusNote: "执行会话已开始运行。",
    },
    {
      nextStatus: "cancelled",
      buttonLabel: "取消执行",
      statusNote: "执行会话已取消。",
    },
  ],
  running: [
    {
      nextStatus: "submitted",
      buttonLabel: "提交结果",
      statusNote: "执行会话已提交待验收。",
      resultSummary: "已提交执行结果，待确认。",
    },
    {
      nextStatus: "failed",
      buttonLabel: "标记失败",
      statusNote: "执行会话执行失败。",
      resultSummary: "执行失败，请检查日志并重试。",
    },
    {
      nextStatus: "cancelled",
      buttonLabel: "取消执行",
      statusNote: "执行会话已取消。",
    },
  ],
  submitted: [
    {
      nextStatus: "completed",
      buttonLabel: "标记完成",
      statusNote: "执行会话已完成。",
      resultSummary: "执行结果已确认完成。",
    },
    {
      nextStatus: "failed",
      buttonLabel: "标记失败",
      statusNote: "执行会话未通过，判定失败。",
      resultSummary: "执行未通过，请重新提交。",
    },
  ],
  completed: [],
  failed: [],
  cancelled: [],
};

type ExecutionPolicyOption = {
  value: string;
  label: string;
  note: string;
};

export function SelectedAgentActivitySection(props: {
  actionDeckReturnHref: string;
  agentExecutionsDependency?: DependencyResult<unknown>;
  agentExecutionsUnavailable: boolean;
  currentOpsHref: string;
  executionPolicyOptions: ExecutionPolicyOption[];
  executionStatusCounts: Record<AgentExecutionStatus, number>;
  executionStatusFilter: AgentExecutionStatus | "all";
  operatorActionsUnavailable: boolean;
  policyKeyFilter: string;
  query: string;
  selectedAgent: AgentView;
  selectedCapabilities: AgentCapabilityView[];
  selectedCapabilityDependency?: DependencyResult<unknown>;
  selectedCapabilityUnavailable: boolean;
  selectedExecutions: AgentExecutionView[];
  selectedHealth: AgentCallbackHealthSummaryView | null;
  sourceTypeFilter: string;
}) {
  const {
    actionDeckReturnHref,
    agentExecutionsDependency,
    agentExecutionsUnavailable,
    currentOpsHref,
    executionPolicyOptions,
    executionStatusCounts,
    executionStatusFilter,
    operatorActionsUnavailable,
    policyKeyFilter,
    query,
    selectedAgent,
    selectedCapabilities,
    selectedCapabilityDependency,
    selectedCapabilityUnavailable,
    selectedExecutions,
    selectedHealth,
    sourceTypeFilter,
  } = props;

  const selectedRejectedCount = selectedHealth?.rejectedCallbacks ?? 0;
  const selectedDuplicateCount = selectedHealth?.duplicateCallbacks ?? 0;
  const selectedPreviousProtocolCount = selectedHealth?.previousProtocolHits ?? 0;
  const selectedPreviousSecretCount = selectedHealth?.previousSecretHits ?? 0;
  const selectedQueuedExecutionCount = executionStatusCounts.queued;
  const selectedRunningExecutionCount = executionStatusCounts.running;
  const selectedFailedExecutionCount = executionStatusCounts.failed;
  const selectedSubmittedExecutionCount = executionStatusCounts.submitted;
  const hasExternalCallbackBacklog = selectedRejectedCount > 0;
  const hasPlatformRuntimeBacklog =
    selectedQueuedExecutionCount > 0 ||
    selectedRunningExecutionCount > 0 ||
    selectedFailedExecutionCount > 0;

  const selectedCapabilityItems: AgentCapabilityListItem[] =
    selectedCapabilities.map((capability) => ({
      id: capability.id,
      code: capability.code,
      title: capability.title,
      description: capability.description || "当前未填写能力说明。",
      pricingNote: capability.pricingNote || "当前未填写定价说明。",
      enabled: capability.enabled,
    }));

  const selectedSliceCards: AgentOpsSliceCard[] = [
    {
      title: "被拒绝回调",
      count: formatCount(selectedRejectedCount),
      detail: "直接跳到当前智能体的被拒绝回调审计切片。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          status: "rejected",
          retryability: "retryable",
          recentWindow: "24h",
        },
        "callback-audits",
      ),
      variant: "danger",
    },
    {
      title: "重复回调",
      count: formatCount(selectedDuplicateCount),
      detail: "复核重复 / 重放命中，不再手工拼筛选条件。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          status: "duplicate",
          recentWindow: "24h",
        },
        "callback-audits",
      ),
      variant: "warning",
    },
    {
      title: "旧协议命中",
      count: formatCount(selectedPreviousProtocolCount),
      detail: "直接打开旧协议命中的回调审计切片。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          protocolMatch: "previous",
          recentWindow: "24h",
        },
        "callback-audits",
      ),
      variant: "warning",
    },
    {
      title: "旧密钥命中",
      count: formatCount(selectedPreviousSecretCount),
      detail: "检查仍使用旧密钥的执行 / 回调。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          secretMatch: "previous",
          recentWindow: "24h",
        },
        "callback-audits",
      ),
      variant: "warning",
    },
    {
      title: "排队执行",
      count: formatCount(selectedQueuedExecutionCount),
      detail: "直接跳到执行观测的排队切片。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          executionStatus: "queued",
          recentWindow: "24h",
        },
        "execution-run-watch",
      ),
      variant: "violet",
    },
    {
      title: "运行中执行",
      count: formatCount(selectedRunningExecutionCount),
      detail: "聚焦运行中的执行与关联回调语境。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          executionStatus: "running",
          recentWindow: "24h",
        },
        "execution-run-watch",
      ),
      variant: "cyan",
    },
    {
      title: "待验收 / 失败",
      count: formatCount(
        selectedSubmittedExecutionCount + selectedFailedExecutionCount,
      ),
      detail: "把待验收与失败流转直接收进执行观测。",
      href: buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          executionStatus:
            selectedFailedExecutionCount > 0 ? "failed" : "submitted",
          recentWindow: "24h",
        },
        "execution-run-watch",
      ),
      variant: selectedFailedExecutionCount > 0 ? "danger" : "warning",
    },
    {
      title: "运行会话",
      count: formatCount(selectedRunningExecutionCount),
      detail:
        selectedAgent.sourceType === "platform"
          ? "直接进入该智能体的运行会话观测。"
          : "把当前智能体的运行态执行直接桥接到运行会话观测。",
      href: buildPathWithParams(
        "/ops/agent-callbacks",
        {
          agentId: selectedAgent.id,
          ownerUserId: selectedAgent.ownerUserId,
          runtimeState: "running",
          runtimeKind:
            selectedAgent.sourceType === "platform"
              ? "platform_executor"
              : null,
        },
        "runtime-session-watch",
      ),
      variant: "cyan",
    },
  ];
  const selectedSliceDeckItems = selectedSliceCards.map((slice) => ({
    key: slice.title,
    subtitle: slice.title,
    title: slice.count,
    detail: slice.detail,
    badge: <Badge variant={slice.variant}>{sliceToneLabel(slice.variant)}</Badge>,
    action: (
      <Link className="nt-btn nt-btn--secondary" href={slice.href}>
        打开切片
      </Link>
    ),
  }));
  const selectedActionDeckItems =
    operatorActionsUnavailable
      ? []
      : selectedAgent.sourceType === "external"
      ? hasExternalCallbackBacklog
        ? [
            {
              key: "retry-request",
              subtitle: "重试请求",
              title: "批量记录重试",
              detail:
                "对当前智能体的被拒绝 / 可重试回调直接记录重试请求，并跳回审计切片。",
              badge: (
                <Badge variant="warning">
                  {formatCount(selectedRejectedCount)}
                </Badge>
              ),
              action: (
                <form
                  action={requestRejectedCallbackRetryBatchAction}
                  className="app-form-grid"
                >
                  <input type="hidden" name="limit" value="10" />
                  <input
                    type="hidden"
                    name="note"
                    value={`ops/account/agents:${selectedAgent.id}:retry-batch`}
                  />
                  {renderCallbackAutomationFields({
                    agentId: selectedAgent.id,
                    retryability: "retryable",
                  })}
                  {renderCallbackFollowUpFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    status: "rejected",
                    retryability: "retryable",
                    recentWindow: "24h",
                    fragment: "callback-audits",
                    runKind: "callback_retry_request",
                    runStatus: "completed",
                  })}
                  <button className="nt-btn nt-btn--secondary" type="submit">
                    批量记重试请求
                  </button>
                </form>
              ),
            },
            {
              key: "auto-remediation",
              subtitle: "自动补救",
              title: "执行一轮补救",
              detail:
                "按当前智能体的回调策略对被拒绝切片执行一次自动补救。",
              badge: (
                <Badge variant="cyan">
                  策略 {selectedAgent.externalCallbackRemediationPolicyKey}
                </Badge>
              ),
              action: (
                <form
                  action={autoRemediateRejectedCallbackPayloadsAction}
                  className="app-form-grid"
                >
                  <input type="hidden" name="limit" value="10" />
                  <input
                    type="hidden"
                    name="ignoreScheduleWindow"
                    value="true"
                  />
                  <input
                    type="hidden"
                    name="note"
                    value={`ops/account/agents:${selectedAgent.id}:auto-remediate`}
                  />
                  {renderCallbackAutomationFields({
                    agentId: selectedAgent.id,
                    remediationPolicyKey:
                      selectedAgent.externalCallbackRemediationPolicyKey,
                    retryability: "retryable",
                  })}
                  {renderCallbackFollowUpFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    status: "rejected",
                    remediationPolicyKey:
                      selectedAgent.externalCallbackRemediationPolicyKey,
                    retryability: "retryable",
                    recentWindow: "24h",
                    fragment: "callback-audits",
                    runKind: "callback_auto_remediation",
                  })}
                  <button className="nt-btn nt-btn--primary" type="submit">
                    运行自动补救
                  </button>
                </form>
              ),
            },
          ]
        : [
            {
              key: "callback-backlog",
              subtitle: "回调积压",
              title: "当前没有被拒绝积压",
              detail:
                "当前智能体没有被拒绝回调需要批量补救。更适合直接巡检已接收 / 重复趋势。",
              badge: <Badge variant="success">干净</Badge>,
              action: (
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={buildAgentCallbackOpsHref(
                    selectedAgent.id,
                    { recentWindow: "24h" },
                    "callback-audits",
                  )}
                >
                  打开 24h 回调审计
                </Link>
              ),
            },
            {
              key: "health-sweep",
              subtitle: "健康巡检",
              title: "先看重复 / 兼容",
              detail:
                "如果没有被拒绝积压，优先复核重复、旧协议与旧密钥的命中。",
              badge: (
                <Badge
                  variant={
                    selectedDuplicateCount > 0 ||
                    selectedPreviousProtocolCount > 0 ||
                    selectedPreviousSecretCount > 0
                      ? "warning"
                      : "cyan"
                  }
                >
                  watch
                </Badge>
              ),
              action: (
                <div className="app-inline-actions">
                  <Link
                    className="nt-btn nt-btn--ghost"
                    href={buildAgentCallbackOpsHref(
                      selectedAgent.id,
                      {
                        status: "duplicate",
                        recentWindow: "24h",
                      },
                      "callback-audits",
                    )}
                  >
                    Duplicate
                  </Link>
                  <Link
                    className="nt-btn nt-btn--ghost"
                    href={buildAgentCallbackOpsHref(
                      selectedAgent.id,
                      {
                        protocolMatch: "previous",
                        recentWindow: "24h",
                      },
                      "callback-audits",
                    )}
                  >
                    Previous Protocol
                  </Link>
                </div>
              ),
            },
          ]
      : hasPlatformRuntimeBacklog
        ? [
            {
              key: "executor-tick",
              subtitle: "执行器推进",
              title: "手动跑一轮 Executor",
              detail:
                "以当前智能体为边界触发一轮平台执行器，适合把排队切片往前推一格。",
              badge: (
                <Badge variant="cyan">
                  排队 {selectedQueuedExecutionCount}
                </Badge>
              ),
              action: (
                <form
                  action={runPlatformExecutorNowAction}
                  className="app-form-grid"
                >
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={actionDeckReturnHref}
                  />
                  <input type="hidden" name="limit" value="3" />
                  {renderRuntimeSessionActionFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    runtimeState: "running",
                    runtimeKind: "platform_executor",
                  })}
                  <button className="nt-btn nt-btn--primary" type="submit">
                    运行执行器
                  </button>
                </form>
              ),
            },
            {
              key: "recovery-watchdog",
              subtitle: "恢复守护",
              title: "恢复过期执行",
              detail:
                "以当前智能体为边界运行恢复守护，适合把过期卡住的执行重新拉回队列。",
              badge: <Badge variant="warning">900s</Badge>,
              action: (
                <form
                  action={recoverStalePlatformExecutionsAction}
                  className="app-form-grid"
                >
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={actionDeckReturnHref}
                  />
                  <input type="hidden" name="limit" value="10" />
                  <input type="hidden" name="staleSeconds" value="900" />
                  {renderRuntimeSessionActionFields({
                    agentId: selectedAgent.id,
                    ownerUserId: selectedAgent.ownerUserId,
                    runtimeState: "requeued",
                    runtimeKind: "stale_recovery",
                    runtimeStaleOnly: "true",
                  })}
                  <button className="nt-btn nt-btn--secondary" type="submit">
                    运行恢复守护
                  </button>
                </form>
              ),
            },
          ]
        : [
            {
              key: "runtime-slice",
              subtitle: "运行切片",
              title: "当前没有运行中 / 排队 backlog",
              detail:
                "当前平台智能体没有明显运行 backlog，更适合留在当前智能体切片排查，或回用户侧智能体中心补任务。",
              badge: <Badge variant="success">空闲</Badge>,
              action: (
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={buildAgentCallbackOpsHref(
                    selectedAgent.id,
                    { recentWindow: "24h" },
                    "execution-run-watch",
                  )}
                >
                  打开执行观测
                </Link>
              ),
            },
            {
              key: "runtime-bridge",
              subtitle: "运行桥接",
              title: "回智能体中心补任务",
              detail:
                "当前服务器不再开放独立执行台；当当前智能体没有待推进任务时，下一步通常是回用户侧智能体中心补任务，或留在当前切片继续筛选。",
              badge: <Badge variant="violet">桥接</Badge>,
              action: (
                <div className="app-inline-actions">
                  <Link className="nt-btn nt-btn--ghost" href="/agents?mode=tasks">
                    打开智能体中心
                  </Link>
                  <Link
                    className="nt-btn nt-btn--ghost"
                    href={buildAgentsOpsHref({
                      agentId: selectedAgent.id,
                      executionStatus: "all",
                      policyKey: policyKeyFilter,
                      q: query,
                      sourceType: sourceTypeFilter,
                    })}
                  >
                    留在当前智能体
                  </Link>
                </div>
              ),
            },
          ];

  const selectedExecutionItems =
    selectedExecutions.length > 0 ? (
      <div className="app-task-list">
        {selectedExecutions.map((execution) =>
          buildSelectedExecutionItem({
            buildAgentCallbackOpsHref,
            callbackRecommendationToneLabel,
            currentOpsHref,
            execution,
            executionPolicyOptions,
            formatCount,
            formatDurationSeconds,
            formatShanghaiDateTime,
            selectedAgent: {
              id: selectedAgent.id,
              sourceType: selectedAgent.sourceType,
              externalCallbackRemediationPolicyKey:
                selectedAgent.externalCallbackRemediationPolicyKey,
            },
            selectedHealth,
            transitionsByStatus,
          }),
        )}
      </div>
    ) : null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <AgentOpsDeckCard
          badge={
            <Badge variant="fuchsia">
              {formatCount(selectedSliceDeckItems.length)}
            </Badge>
          }
          detail="常用切片直接收口到执行观测、运行会话观测与回调审计，不必每次从总台重配筛选。"
          id="slice-deck"
          items={selectedSliceDeckItems}
          subtitle="切片面板"
          title="执行 / 回调快捷切片"
        />

        <AgentOpsDeckCard
          badge={<Badge variant="warning">运维动作</Badge>}
          detail={
            selectedAgent.sourceType === "external"
              ? "从当前智能体直接发起被拒绝回调的批量重试 / 自动补救，再回到带切片语境的回调运维。"
              : "把平台执行器与过期恢复的手动推进入口收回当前智能体详情，不必切回总运维台。"
          }
          id="action-deck"
          items={selectedActionDeckItems}
          subtitle="动作面板"
          title={
            selectedAgent.sourceType === "external"
              ? "回调批动作入口"
              : "运行手动推进入口"
          }
        />
      </div>

      {selectedCapabilityUnavailable && selectedCapabilityDependency ? (
        <DependencyState label="智能体能力目录" result={selectedCapabilityDependency} />
      ) : (
        <SelectedAgentCapabilitiesCard
          badge={
            <Badge variant="fuchsia">
              {formatCount(selectedCapabilities.length)}
            </Badge>
          }
          capabilities={selectedCapabilityItems}
          emptyState={
            <p className="app-note">当前还没有登记能力。</p>
          }
          form={
            <form
              action={addAgentCapabilityAction}
              className="app-form-grid"
            >
              <input
                name="agentId"
                type="hidden"
                value={selectedAgent.id}
              />
              <input
                name="redirectTo"
                type="hidden"
                value={currentOpsHref}
              />
              <Input
                name="code"
                placeholder="能力代码，例如 text-summarize"
                required
              />
              <Input name="title" placeholder="能力标题" required />
              <Textarea
                name="description"
                placeholder="说明输入输出和适用任务。"
                rows={3}
              />
              <Input
                name="pricingNote"
                placeholder="定价或成本说明（可选）"
              />
              <button className="nt-btn nt-btn--outline" type="submit">
                添加能力
              </button>
            </form>
          }
        />
      )}

      {agentExecutionsUnavailable && agentExecutionsDependency ? (
        <DependencyState label="智能体执行目录" result={agentExecutionsDependency} />
      ) : (
        <SelectedAgentExecutionsCard
          badge={
            <Badge variant="warning">
              {formatCount(selectedExecutions.length)}
            </Badge>
          }
          detail={`当前筛选：${
            executionStatusFilter === "all"
              ? "全部状态"
              : executionStatusFilter
          }。这里只保留当前智能体的最小流转入口，更复杂的执行编排不再开放独立执行台。`}
          emptyState={
            <p className="app-note">
              当前筛选条件下没有匹配的执行记录。
            </p>
          }
          items={selectedExecutionItems}
        />
      )}
    </>
  );
}
