import type { ReactNode } from "react";

import Link from "next/link";

import type {
  AgentCallbackHealthSummaryView,
  AgentRecentCallbackView,
} from "@neuro/contracts";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { buildExecutionCallbackPolicyRecommendation } from "@/lib/agent-callback-policies";
import type { AgentExecutionView, AgentView } from "@/lib/core-client";
import {
  requeueAgentExecutionAction,
  replayRejectedCallbackPayloadAction,
  requestRejectedCallbackRetryAction,
  updateAgentExecutionCallbackRemediationPolicyAction,
  updateAgentExecutionStatusAction,
} from "@/lib/platform-actions";
import {
  AgentExecutionOpsCard,
  AgentExecutionPolicyAreaCard,
  AgentRecentCallbackAuditCard,
  type DetailListRow,
} from "./sections";

export type TransitionConfig = {
  nextStatus: AgentExecutionView["status"];
  buttonLabel: string;
  statusNote: string;
  resultSummary?: string;
};

type RecentCallbackActionKind = "audit" | "retry" | "replay";

type RecentCallbackPriority = {
  detail: string;
  label: string;
  variant: "danger" | "warning" | "cyan" | "violet";
};

type RecentCallbackActionTemplate = {
  auditLabel: string;
  detail: string;
  includeAuditInPrimary: boolean;
  label: string;
  primaryAction: RecentCallbackActionKind;
  secondaryActions: RecentCallbackActionKind[];
};

type ExecutionOperatorCue = {
  detail: string;
  label: string;
  variant: "danger" | "warning" | "cyan" | "violet";
};

type ExecutionActionTemplate = {
  nextStepDetail: string;
  nextStepLabel: string;
  primaryTransition: TransitionConfig | null;
  promoteRequeueAction: boolean;
  secondaryTransitions: TransitionConfig[];
};

type CallbackFollowUpFieldRenderer = (args: {
  agentId?: string | null;
  ownerUserId?: string | null;
  callbackType?: string | null;
  callbackVersion?: string | number | null;
  secretVersion?: string | number | null;
  status?: string | null;
  remediationPolicyKey?: string | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  rejectionCategory?: string | null;
  executionStatus?: string | null;
  recentWindow?: string | null;
  runtimeState?: string | null;
  runtimeKind?: string | null;
  runtimeStaleOnly?: string | null;
  runKind?: string | null;
  runStatus?: string | null;
  fragment?: string | null;
}) => ReactNode;

type CallbackPolicyOption = {
  value: string;
  label: string;
  note: string;
};

export function statusBadgeVariant(
  status: AgentExecutionView["status"],
): "cyan" | "success" | "warning" | "violet" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "warning";
  if (status === "running" || status === "submitted") return "cyan";
  return "violet";
}

export function recentCallbackPriorityScore(entry: AgentRecentCallbackView) {
  let score = 0;
  if (entry.auditStatus === "rejected") score += 100;
  if (entry.retryability && entry.retryability !== "not_retryable") score += 18;
  if (entry.auditStatus === "duplicate") score += 60;
  if (entry.usedPreviousProtocol) score += 14;
  if (entry.usedPreviousSecret) score += 14;
  if (entry.lastRemediationStatus === "failed") score += 8;
  if (entry.executionStatus === "failed") score += 6;
  return score;
}

function buildRecentCallbackPriority(
  entry: AgentRecentCallbackView,
): RecentCallbackPriority {
  if (entry.auditStatus === "rejected") {
    if (entry.retryability && entry.retryability !== "not_retryable") {
      return {
        label: "needs remediation",
        detail:
          "当前回调已 rejected 且仍可重试，应保持在 operator 队列顶部优先处理。",
        variant: "danger",
      };
    }
    return {
      label: "manual review",
      detail:
        "当前回调已 rejected，但不适合直接重试。应先核对 rejection category 与 callback envelope。",
      variant: "warning",
    };
  }
  if (entry.usedPreviousProtocol || entry.usedPreviousSecret) {
    return {
      label: "compat watch",
      detail:
        "当前回调仍命中 previous protocol 或 previous secret 窗口，需要继续复核 rollout drift。",
      variant: "warning",
    };
  }
  if (entry.auditStatus === "duplicate") {
    return {
      label: "replay watch",
      detail:
        "当前 duplicate callback 需要回看 replay 与幂等行为，避免持续重复命中。",
      variant: "warning",
    };
  }
  if (entry.lastRemediationStatus === "failed") {
    return {
      label: "remediation drift",
      detail:
        "最近一次 remediation attempt 失败，在恢复路径确认前不应从视野里移走。",
      variant: "violet",
    };
  }
  return {
    label: "accepted",
    detail:
      "当前回调已 accepted，主要作为时间线语境保留，除非再次出现 compat 或 replay 信号。",
    variant: "cyan",
  };
}

function buildRecentCallbackActionTemplate(
  entry: AgentRecentCallbackView,
): RecentCallbackActionTemplate {
  if (
    entry.auditStatus === "rejected" &&
    entry.retryability &&
    entry.retryability !== "not_retryable"
  ) {
    return {
      label: "replay first",
      detail:
        "当前回调仍可重放，优先尝试 payload replay，同时保留 rejected 审计语境，必要时再回退到 retry request。",
      auditLabel: "打开 rejected 审计",
      primaryAction: "replay",
      includeAuditInPrimary: true,
      secondaryActions: ["retry"],
    };
  }
  if (entry.auditStatus === "rejected") {
    return {
      label: "retry-review",
      detail:
        "当前回调已 rejected，但不适合直接 replay。优先记录 retry request，并保留聚焦审计做手工复核。",
      auditLabel: "打开手工复核",
      primaryAction: "retry",
      includeAuditInPrimary: true,
      secondaryActions: [],
    };
  }
  if (entry.usedPreviousProtocol || entry.usedPreviousSecret) {
    return {
      label: "compat review",
      detail:
        "当前回调仍命中 compat window，优先打开 compat 审计核对 protocol / secret rollout drift。",
      auditLabel: "打开 compat 审计",
      primaryAction: "audit",
      includeAuditInPrimary: false,
      secondaryActions: [],
    };
  }
  if (entry.auditStatus === "duplicate") {
    return {
      label: "replay review",
      detail:
        "当前 duplicate 回调更适合作为 replay / 幂等复核入口，先看聚焦审计，再决定是否需要回到 remediation 面。",
      auditLabel: "打开 replay 审计",
      primaryAction: "audit",
      includeAuditInPrimary: false,
      secondaryActions: [],
    };
  }
  if (entry.lastRemediationStatus === "failed") {
    return {
      label: "remediation review",
      detail:
        "最近 remediation attempt 已失败，先回看本条 callback 的聚焦审计，再决定是否升级到批量或 owner slice 处置。",
      auditLabel: "打开 remediation 审计",
      primaryAction: "audit",
      includeAuditInPrimary: false,
      secondaryActions: [],
    };
  }
  return {
    label: "timeline review",
    detail:
      "当前回调主要作为 accepted timeline 保留，默认只需保留聚焦审计入口，不必给出额外动作噪声。",
    auditLabel: "打开时间线审计",
    primaryAction: "audit",
    includeAuditInPrimary: false,
    secondaryActions: [],
  };
}

export function executionPriorityScore(execution: AgentExecutionView) {
  let score = 0;
  if (execution.status === "failed") score += 120;
  if (execution.phaseOverdue) score += 35;
  if (execution.recoveryExhaustedAt) score += 28;
  if (execution.status === "submitted") score += 70;
  if (execution.status === "running") score += 50;
  if (execution.status === "queued") score += 35;
  if (execution.canRequeue) score += 14;
  if (execution.callbackRemediationPolicySource === "execution") score += 6;
  return score;
}

function buildExecutionOperatorCue(
  execution: AgentExecutionView,
): ExecutionOperatorCue {
  if (execution.status === "failed") {
    return {
      label: "recover now",
      detail:
        "这条 execution 已经 failed，优先看恢复路径、回调审计与是否需要重新入队。",
      variant: "danger",
    };
  }
  if (execution.phaseOverdue || execution.recoveryExhaustedAt) {
    return {
      label: "runtime risk",
      detail:
        "当前 execution 已出现 phase overdue 或 recovery exhausted 信号，应优先检查 runtime 推进与补救路径。",
      variant: "warning",
    };
  }
  if (execution.status === "submitted") {
    return {
      label: "settlement watch",
      detail:
        "这条 execution 已提交待验收，应优先确认结果摘要、回调状态与最终落账路径。",
      variant: "violet",
    };
  }
  if (execution.status === "running") {
    return {
      label: "running watch",
      detail:
        "这条 execution 仍在运行中，重点关注 phase age、heartbeat 与外部 callback 追踪。",
      variant: "cyan",
    };
  }
  if (execution.status === "queued") {
    return {
      label: "queue ready",
      detail:
        "这条 execution 正在等待推进，适合从当前页判断是否需要 run executor 或手工流转。",
      variant: "warning",
    };
  }
  return {
    label: "timeline",
    detail:
      "这条 execution 当前更多作为历史时间线补充，除非出现新的恢复或回调信号。",
    variant: "cyan",
  };
}

function buildExecutionActionTemplate(
  execution: AgentExecutionView,
  transitions: TransitionConfig[],
): ExecutionActionTemplate {
  const promoteRequeueAction =
    Boolean(execution.canRequeue) &&
    (execution.status === "failed" ||
      execution.phaseOverdue ||
      Boolean(execution.recoveryExhaustedAt));
  const primaryTransition =
    !promoteRequeueAction &&
    execution.canUpdateStatus &&
    transitions.length > 0
      ? transitions[0]
      : null;
  const secondaryTransitions =
    execution.canUpdateStatus && transitions.length > 0
      ? transitions.filter((transition) =>
          primaryTransition
            ? transition.nextStatus !== primaryTransition.nextStatus
            : true,
        )
      : [];

  if (promoteRequeueAction) {
    return {
      nextStepLabel: "Recover / Requeue",
      nextStepDetail:
        "当前 execution 已进入 failed / overdue / recovery exhausted 路径，优先做恢复或重新入队，再决定是否补额外状态流转。",
      promoteRequeueAction: true,
      primaryTransition: null,
      secondaryTransitions,
    };
  }

  if (primaryTransition) {
    return {
      nextStepLabel: primaryTransition.buttonLabel,
      nextStepDetail:
        primaryTransition.resultSummary ?? primaryTransition.statusNote,
      promoteRequeueAction: false,
      primaryTransition,
      secondaryTransitions,
    };
  }

  return {
    nextStepLabel: "Inspection only",
    nextStepDetail:
      execution.canUpdateStatus || execution.canRequeue
        ? "当前没有更明确的主流转，优先保留 watch / callback audit 路径。"
        : "当前 execution 没有直接可写动作，保持观察并根据 callback / runtime 信号决定下一步。",
    promoteRequeueAction: false,
    primaryTransition: null,
    secondaryTransitions: [],
  };
}

function executionWatchLabel(status: AgentExecutionView["status"]) {
  switch (status) {
    case "failed":
      return "Failure Watch";
    case "submitted":
      return "Settlement Watch";
    case "running":
      return "Running Watch";
    case "queued":
      return "Queue Watch";
    default:
      return "Execution Watch";
  }
}

function executionCallbackAuditLabel(status: AgentExecutionView["status"]) {
  switch (status) {
    case "failed":
      return "失败 callback 审计";
    case "submitted":
      return "验收前 callback 审计";
    case "running":
      return "运行态 callback 审计";
    case "queued":
      return "排队态 callback 审计";
    default:
      return "查看 callback 审计";
  }
}

function renderRecentCallbackRetryAction(args: {
  agentId: string;
  buttonClassName: string;
  entry: AgentRecentCallbackView;
  label: string;
  ownerUserId: string;
  redirectTo: string;
  renderCallbackFollowUpFields: CallbackFollowUpFieldRenderer;
}) {
  const {
    agentId,
    buttonClassName,
    entry,
    label,
    ownerUserId,
    redirectTo,
    renderCallbackFollowUpFields,
  } = args;
  if (entry.auditStatus !== "rejected") {
    return null;
  }
  return (
    <form action={requestRejectedCallbackRetryAction}>
      <input type="hidden" name="auditId" value={entry.id} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input
        type="hidden"
        name="note"
        value={`ops/account/agents:${agentId}:single-retry`}
      />
      {renderCallbackFollowUpFields({
        agentId,
        ownerUserId,
        callbackType: entry.callbackType,
        callbackVersion: entry.callbackVersion,
        secretVersion: entry.secretVersion,
        status: "rejected",
        protocolMatch: entry.usedPreviousProtocol ? "previous" : "current",
        secretMatch: entry.usedPreviousSecret ? "previous" : "current",
        retryability: entry.retryability,
        rejectionCategory: entry.rejectionCategory,
        executionStatus: entry.executionStatus,
        recentWindow: "24h",
        fragment: "callback-audits",
        runKind: "callback_retry_request",
        runStatus: "completed",
      })}
      <button className={buttonClassName} type="submit">
        {label}
      </button>
    </form>
  );
}

function renderRecentCallbackReplayAction(args: {
  agentId: string;
  buttonClassName: string;
  entry: AgentRecentCallbackView;
  label: string;
  ownerUserId: string;
  redirectTo: string;
  renderCallbackFollowUpFields: CallbackFollowUpFieldRenderer;
}) {
  const {
    agentId,
    buttonClassName,
    entry,
    label,
    ownerUserId,
    redirectTo,
    renderCallbackFollowUpFields,
  } = args;
  if (
    entry.auditStatus !== "rejected" ||
    entry.retryability === "not_retryable"
  ) {
    return null;
  }
  return (
    <form action={replayRejectedCallbackPayloadAction}>
      <input type="hidden" name="auditId" value={entry.id} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input
        type="hidden"
        name="note"
        value={`ops/account/agents:${agentId}:replay`}
      />
      {renderCallbackFollowUpFields({
        agentId,
        ownerUserId,
        callbackType: entry.callbackType,
        callbackVersion: entry.callbackVersion,
        secretVersion: entry.secretVersion,
        status: "rejected",
        protocolMatch: entry.usedPreviousProtocol ? "previous" : "current",
        secretMatch: entry.usedPreviousSecret ? "previous" : "current",
        retryability: entry.retryability,
        rejectionCategory: entry.rejectionCategory,
        executionStatus: entry.executionStatus,
        recentWindow: "24h",
        fragment: "callback-audits",
        runKind: "callback_payload_replay",
        runStatus: "completed",
      })}
      <button className={buttonClassName} type="submit">
        {label}
      </button>
    </form>
  );
}

function renderExecutionTransitionAction(args: {
  buttonClassName: string;
  executionId: string;
  redirectTo: string;
  transition: TransitionConfig;
}) {
  const { buttonClassName, executionId, redirectTo, transition } = args;
  return (
    <form action={updateAgentExecutionStatusAction}>
      <input name="executionId" type="hidden" value={executionId} />
      <input name="status" type="hidden" value={transition.nextStatus} />
      <input name="statusNote" type="hidden" value={transition.statusNote} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {transition.resultSummary ? (
        <input
          name="resultSummary"
          type="hidden"
          value={transition.resultSummary}
        />
      ) : null}
      <button className={buttonClassName} type="submit">
        {transition.buttonLabel}
      </button>
    </form>
  );
}

function renderExecutionRequeueAction(args: {
  buttonClassName: string;
  executionId: string;
  label: string;
  redirectTo: string;
}) {
  const { buttonClassName, executionId, label, redirectTo } = args;
  return (
    <form action={requeueAgentExecutionAction}>
      <input name="executionId" type="hidden" value={executionId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button className={buttonClassName} type="submit">
        {label}
      </button>
    </form>
  );
}

export function buildSelectedRecentCallbackAuditItem(args: {
  buildAgentCallbackOpsHref: (
    agentId: string,
    params: Record<string, string | number | boolean | null | undefined>,
    fragment?: string | null,
  ) => string;
  entry: AgentRecentCallbackView;
  formatShanghaiDateTime: (value?: string | null) => string;
  recentCallbacksReturnHref: string;
  renderCallbackFollowUpFields: CallbackFollowUpFieldRenderer;
  selectedAgent: Pick<AgentView, "id" | "ownerUserId">;
}) {
  const {
    buildAgentCallbackOpsHref,
    entry,
    formatShanghaiDateTime,
    recentCallbacksReturnHref,
    renderCallbackFollowUpFields,
    selectedAgent,
  } = args;
  const priority = buildRecentCallbackPriority(entry);
  const actionTemplate = buildRecentCallbackActionTemplate(entry);
  const focusedAuditHref = buildAgentCallbackOpsHref(
    selectedAgent.id,
    {
      callbackType: entry.callbackType,
      callbackVersion: entry.callbackVersion,
      secretVersion: entry.secretVersion,
      status: entry.auditStatus,
      executionStatus: entry.executionStatus,
      protocolMatch: entry.usedPreviousProtocol ? "previous" : "current",
      secretMatch: entry.usedPreviousSecret ? "previous" : "current",
      recentWindow: "24h",
    },
    "callback-audits",
  );
  const retryRequestAction = renderRecentCallbackRetryAction({
    agentId: selectedAgent.id,
    buttonClassName: "mg-btn mg-btn--outline",
    entry,
    label: "记 Retry Request",
    ownerUserId: selectedAgent.ownerUserId,
    redirectTo: recentCallbacksReturnHref,
    renderCallbackFollowUpFields,
  });
  const replayPayloadAction = renderRecentCallbackReplayAction({
    agentId: selectedAgent.id,
    buttonClassName: "mg-btn mg-btn--secondary",
    entry,
    label: "尝试 Replay Payload",
    ownerUserId: selectedAgent.ownerUserId,
    redirectTo: recentCallbacksReturnHref,
    renderCallbackFollowUpFields,
  });
  const focusedAuditAction = (
    <Link
      className={`mg-btn ${
        actionTemplate.primaryAction === "audit"
          ? "mg-btn--secondary"
          : "mg-btn--ghost"
      }`}
      href={focusedAuditHref}
    >
      {actionTemplate.auditLabel}
    </Link>
  );

  return (
    <AgentRecentCallbackAuditCard
      callbackType={entry.callbackType}
      hint={entry.retryHint}
      key={entry.id}
      metaBadges={
        <>
          <Badge variant={priority.variant}>{priority.label}</Badge>
          <Badge variant="glass">
            v{entry.callbackVersion} / s{entry.secretVersion}
          </Badge>
          <Badge variant="glass">
            recv {formatShanghaiDateTime(entry.receivedAt)}
          </Badge>
          {entry.usedPreviousProtocol ? (
            <Badge variant="warning">previous protocol</Badge>
          ) : null}
          {entry.usedPreviousSecret ? (
            <Badge variant="warning">previous secret</Badge>
          ) : null}
          {entry.lastRemediationMode ? (
            <Badge variant="violet">
              {entry.lastRemediationMode}
              {entry.lastRemediationStatus
                ? ` / ${entry.lastRemediationStatus}`
                : ""}
            </Badge>
          ) : null}
          {entry.lastRemediationAt ? (
            <Badge variant="glass">
              remediation {formatShanghaiDateTime(entry.lastRemediationAt)}
            </Badge>
          ) : null}
        </>
      }
      payloadSummary={`Action Plan：${actionTemplate.detail} · ${
        entry.payloadSummary || entry.rejectionCategory || "暂无摘要"
      }`}
      primaryActions={
        actionTemplate.primaryAction === "replay" && replayPayloadAction ? (
          <>
            {replayPayloadAction}
            {actionTemplate.includeAuditInPrimary ? focusedAuditAction : null}
          </>
        ) : actionTemplate.primaryAction === "retry" && retryRequestAction ? (
          <>
            {retryRequestAction}
            {actionTemplate.includeAuditInPrimary ? focusedAuditAction : null}
          </>
        ) : (
          focusedAuditAction
        )
      }
      secondaryActions={
        actionTemplate.secondaryActions.includes("retry") && retryRequestAction ? (
          <div className="app-inline-actions">{retryRequestAction}</div>
        ) : null
      }
      statusLabel={entry.auditStatus}
      statusVariant={entry.auditStatus === "accepted" ? "success" : "warning"}
      summary={`${entry.executionTitle || entry.executionId} / ${entry.executionStatus} / ${priority.detail} / ${actionTemplate.label}`}
      title={entry.callbackId}
    />
  );
}

export function buildSelectedExecutionItem(args: {
  buildAgentCallbackOpsHref: (
    agentId: string,
    params: Record<string, string | number | boolean | null | undefined>,
    fragment?: string | null,
  ) => string;
  callbackRecommendationToneLabel: (
    variant: "danger" | "warning" | "cyan",
  ) => string;
  currentOpsHref: string;
  execution: AgentExecutionView;
  executionPolicyOptions: CallbackPolicyOption[];
  formatCount: (value: number) => string;
  formatDurationSeconds: (value?: number | null) => string;
  formatShanghaiDateTime: (value?: string | null) => string;
  selectedAgent: Pick<
    AgentView,
    "id" | "sourceType" | "externalCallbackRemediationPolicyKey"
  >;
  selectedHealth: AgentCallbackHealthSummaryView | null;
  transitionsByStatus: Record<AgentExecutionView["status"], TransitionConfig[]>;
}) {
  const {
    buildAgentCallbackOpsHref,
    callbackRecommendationToneLabel,
    currentOpsHref,
    execution,
    executionPolicyOptions,
    formatCount,
    formatDurationSeconds,
    formatShanghaiDateTime,
    selectedAgent,
    selectedHealth,
    transitionsByStatus,
  } = args;
  const transitions = transitionsByStatus[execution.status] ?? [];
  const executionCue = buildExecutionOperatorCue(execution);
  const executionActionTemplate = buildExecutionActionTemplate(
    execution,
    transitions,
  );
  const executionPolicyRecommendation =
    selectedAgent.sourceType === "external"
      ? buildExecutionCallbackPolicyRecommendation(
          execution,
          selectedHealth,
          selectedAgent.externalCallbackRemediationPolicyKey,
        )
      : null;
  const executionDetailRows: DetailListRow[] = [
    {
      label: "进度 / 阶段",
      value: `${execution.progressPercent ?? 0}% / ${execution.executorPhase || "未进入 runtime"}`,
    },
    {
      label: "回调策略来源",
      value: `${execution.callbackRemediationPolicy.label} / ${execution.callbackRemediationPolicySource}`,
    },
    {
      label: "最近 heartbeat",
      value: formatShanghaiDateTime(execution.lastHeartbeatAt),
    },
    {
      label: "最近 external callback",
      value: formatShanghaiDateTime(execution.lastExternalCallbackAt),
    },
    {
      label: "Phase Age / Timeout",
      value: `${formatDurationSeconds(execution.phaseAgeSeconds)} / ${formatDurationSeconds(execution.phaseTimeoutSeconds)}`,
    },
    {
      label: "Auto Recovery",
      value: `${execution.autoRecoveryCount} / ${execution.maxAutoRecoveryCount}`,
    },
    {
      label: "成本 / 余量",
      value: `${formatCount(execution.totalCostUnits)} / ${formatCount(execution.estimatedRemainingCostUnits)} cu`,
    },
  ];

  return (
    <AgentExecutionOpsCard
      detailRows={executionDetailRows}
      key={execution.id}
      notes={
        <>
          <p className="app-note">Operator Cue：{executionCue.detail}</p>
          <p className="app-note">
            Next Step：{executionActionTemplate.nextStepLabel} ·{" "}
            {executionActionTemplate.nextStepDetail}
          </p>
          {execution.statusNote ? (
            <p className="app-note">{execution.statusNote}</p>
          ) : null}
          {execution.resultSummary ? (
            <p className="app-note">{execution.resultSummary}</p>
          ) : null}
        </>
      }
      objective={execution.objective}
      policyArea={
        execution.agentSourceType === "external" && execution.canUpdateStatus ? (
          <AgentExecutionPolicyAreaCard
            badge={
              <Badge
                variant={
                  execution.callbackRemediationPolicySource === "execution"
                    ? "warning"
                    : "cyan"
                }
              >
                {execution.callbackRemediationPolicySource === "execution"
                  ? "override"
                  : "inherit"}
              </Badge>
            }
            detail={
              <p className="app-note">
                仅 external execution 支持 execution 级 callback remediation
                override。选择“继承 Agent 默认”会清空 override。
              </p>
            }
            effectiveSummary={
              <p className="app-note">
                当前 effective policy：
                {execution.callbackRemediationPolicy.label}
                {execution.callbackRemediationPolicyOverrideKey
                  ? ` / override ${execution.callbackRemediationPolicyOverrideKey}`
                  : " / inherit_agent"}
              </p>
            }
            form={
              <form
                action={updateAgentExecutionCallbackRemediationPolicyAction}
                className="app-form-grid"
              >
                <input type="hidden" name="executionId" value={execution.id} />
                <input type="hidden" name="redirectTo" value={currentOpsHref} />
                <Select
                  name="policyKey"
                  defaultValue={
                    execution.callbackRemediationPolicyOverrideKey ??
                    "inherit_agent"
                  }
                >
                  {executionPolicyOptions.map((option) => (
                    <option
                      key={`${execution.id}-${option.value}`}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </Select>
                <button className="mg-btn mg-btn--secondary" type="submit">
                  更新 Execution Policy
                </button>
              </form>
            }
            recommendation={
              executionPolicyRecommendation ? (
                <div className="app-task-card">
                  <div className="app-task-card__header">
                    <div>
                      <p className="mg-subtitle">
                        Execution Policy Recommendation
                      </p>
                      <h5 className="app-card-title">
                        {executionPolicyRecommendation.title}
                      </h5>
                    </div>
                    <Badge variant={executionPolicyRecommendation.tone}>
                      {callbackRecommendationToneLabel(
                        executionPolicyRecommendation.tone,
                      )}
                    </Badge>
                  </div>
                  <p className="app-note">
                    {executionPolicyRecommendation.detail}
                  </p>
                  <form
                    action={updateAgentExecutionCallbackRemediationPolicyAction}
                    className="app-inline-actions"
                  >
                    <input
                      type="hidden"
                      name="executionId"
                      value={execution.id}
                    />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={currentOpsHref}
                    />
                    <input
                      type="hidden"
                      name="policyKey"
                      value={
                        executionPolicyRecommendation.recommendedPolicyKey ??
                        "inherit_agent"
                      }
                    />
                    <button className="mg-btn mg-btn--ghost" type="submit">
                      {executionPolicyRecommendation.actionLabel}
                    </button>
                  </form>
                </div>
              ) : null
            }
            subtitle="Execution Callback Policy"
            title="Override 当前 execution"
          />
        ) : null
      }
      primaryActions={
        <>
          {executionActionTemplate.promoteRequeueAction
            ? renderExecutionRequeueAction({
                buttonClassName: "mg-btn mg-btn--primary",
                executionId: execution.id,
                label: "Recover / Requeue",
                redirectTo: currentOpsHref,
              })
            : null}
          {executionActionTemplate.primaryTransition
            ? renderExecutionTransitionAction({
                buttonClassName: "mg-btn mg-btn--primary",
                executionId: execution.id,
                redirectTo: currentOpsHref,
                transition: executionActionTemplate.primaryTransition,
              })
            : null}
          <Link className="mg-btn mg-btn--ghost" href="/agents?mode=tasks">
            打开 Agent Center
          </Link>
          <Link
            className="mg-btn mg-btn--ghost"
            href={buildAgentCallbackOpsHref(
              selectedAgent.id,
              {
                executionStatus: execution.status,
                recentWindow: "24h",
              },
              "execution-run-watch",
            )}
          >
            {executionWatchLabel(execution.status)}
          </Link>
          <Link
            className="mg-btn mg-btn--ghost"
            href={buildAgentCallbackOpsHref(
              selectedAgent.id,
              {
                executionStatus: execution.status,
                recentWindow: "24h",
              },
              "callback-audits",
            )}
          >
            {executionCallbackAuditLabel(execution.status)}
          </Link>
        </>
      }
      secondaryActions={
        <>
          {executionActionTemplate.secondaryTransitions.length > 0 ? (
            <div className="app-inline-actions">
              {executionActionTemplate.secondaryTransitions.map((transition) => (
                <div key={`${execution.id}-${transition.nextStatus}`}>
                  {renderExecutionTransitionAction({
                    buttonClassName: "mg-btn mg-btn--outline",
                    executionId: execution.id,
                    redirectTo: currentOpsHref,
                    transition,
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="app-note">
              当前状态没有可用流转，或你没有状态更新权限。
            </p>
          )}
          {execution.canRequeue && !executionActionTemplate.promoteRequeueAction
            ? renderExecutionRequeueAction({
                buttonClassName: "mg-btn mg-btn--outline mg-btn--secondary",
                executionId: execution.id,
                label: "重新入队执行",
                redirectTo: currentOpsHref,
              })
            : null}
        </>
      }
      statusLabel={execution.status}
      statusVariant={statusBadgeVariant(execution.status)}
      title={execution.title || execution.objective}
      topBadges={
        <>
          <Badge variant={executionCue.variant}>{executionCue.label}</Badge>
          <Badge variant="violet">{execution.runtimeProfile.label}</Badge>
          <Badge variant="glass">
            next {executionActionTemplate.nextStepLabel}
          </Badge>
          {execution.callbackRemediationPolicySource === "execution" ? (
            <Badge variant="warning">execution override</Badge>
          ) : null}
          {execution.phaseOverdue ? (
            <Badge variant="danger">phase overdue</Badge>
          ) : null}
          {execution.recoveryExhaustedAt ? (
            <Badge variant="warning">recovery exhausted</Badge>
          ) : null}
        </>
      }
      updatedLabel={formatShanghaiDateTime(
        execution.updatedAt ?? execution.createdAt,
      )}
    />
  );
}
