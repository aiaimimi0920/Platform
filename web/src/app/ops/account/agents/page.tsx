import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type {
  AgentCallbackConfigHistoryView,
  AgentCallbackHealthSummaryView,
  AgentCapabilityView,
  AgentExecutionStatus,
  AgentExecutionRuntimeCatalogView,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeSchedulingDecisionClass,
  AgentExecutionRuntimeSessionSummaryView,
  AgentRecentCallbackView,
} from "@neuro/contracts";
import { auth } from "@/auth";
import {
  NtBadge as Badge,
  NtCard as Card,
  NtInput as Input,
  NtPanel as Panel,
  NtSelect as Select,
  NtTextarea as Textarea,
} from "@/components/nt-primitives";
import {
  buildAgentCallbackPolicyRecommendation,
  formatAgentCallbackPolicyLabel,
  formatAgentCallbackReplayCompatibilityPolicy,
  formatAgentCallbackReplayFallbackProfile,
  mergeAgentCallbackPolicyCatalog,
} from "@/lib/agent-callback-policies";
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
import {
  formatAgentExecutionLaunchPresetPressureLevelLabel,
  formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionKindLabel,
  formatAgentExecutionLaunchPresetRuntimeSessionStateLabel,
} from "@/lib/agent-execution-launch-presets";
import {
  formatAgentExecutionRuntimeSessionRecommendationActionKindLabel,
  isSweepAgentExecutionRuntimeSessionRecommendationActionKind,
} from "@/lib/agent-execution-runtime-session-playbook";
import {
  addAgentCapabilityAction,
  autoRemediateRejectedCallbackPayloadsAction,
  createAgentAction,
  recoverStalePlatformExecutionsAction,
  recoverThenRunPlatformExecutorAction,
  requestRejectedCallbackRetryBatchAction,
  rotateAgentCallbackSecretAction,
  runPlatformExecutorNowAction,
  sweepRuntimeSessionsAction,
  updateAgentCallbackProtocolVersionAction,
  updateAgentCallbackRemediationPolicyAction,
} from "@/lib/platform-actions";
import { consumeAgentCallbackSecretFlash } from "@/lib/server-flash";
import {
  isPlatformOperatorUserId,
  requirePlatformOperatorUserContext,
} from "@/lib/platform-session";
import {
  buildSelectedExecutionItem,
  buildSelectedRecentCallbackAuditItem,
  executionPriorityScore,
  recentCallbackPriorityScore,
  statusBadgeVariant,
  type TransitionConfig,
} from "./item-builders";
import {
  type AgentCapabilityListItem,
  type AgentRecommendationItem,
  AgentOpsDeckCard,
  type AgentRailSignal,
  AgentRailItem,
  type AgentRailBadge,
  type DetailListRow,
  type FocusMetricItem,
  SelectedAgentCallbackHealthCard,
  SelectedAgentCapabilitiesCard,
  SelectedAgentControlCard,
  SelectedAgentExecutionsCard,
  SelectedAgentExternalGovernanceCard,
  SelectedAgentHeroCard,
  SelectedAgentNoticeCard,
  SelectedAgentOverviewCard,
  SelectedAgentPolicyRecommendationCard,
  SelectedAgentRecentCallbacksCard,
  SelectedAgentRuntimeBridgeCard,
  SelectedAgentRuntimePressurePlaybookCard,
  SelectedAgentSummaryCard,
  SelectedAgentTimelineCard,
  type TimelineItem,
} from "./sections";

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

type CallbackHealthRecommendation = {
  title: string;
  detail: string;
  href: string;
  variant: "danger" | "warning" | "cyan";
};

type HealthPosture = {
  detail: string;
  label: string;
  variant: "danger" | "warning" | "cyan" | "violet";
};

type OperatorPlaybookAction = {
  href: string;
  label: string;
  variant: "primary" | "secondary" | "ghost";
};

type OperatorPlaybook = {
  detail: string;
  actions: OperatorPlaybookAction[];
  title: string;
};

type AgentCallbackFollowUpArgs = {
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
};

type AgentCallbackAutomationArgs = {
  agentId?: string | null;
  callbackType?: string | null;
  remediationPolicyKey?: string | null;
  callbackVersion?: string | number | null;
  secretVersion?: string | number | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  rejectionCategory?: string | null;
};

type RuntimeSessionActionArgs = {
  agentId?: string | null;
  ownerUserId?: string | null;
  runtimeState?: "running" | "completed" | "failed" | "requeued" | null;
  runtimeKind?: "platform_executor" | "stale_recovery" | "owner_requeue" | null;
  runtimeStaleOnly?: "true" | "false" | null;
};

type AgentOpsSliceCard = {
  count: string;
  detail: string;
  href: string;
  title: string;
  variant: "success" | "warning" | "danger" | "cyan" | "violet";
};

type RuntimePressurePlaybook = {
  detail: string;
  executorLimit: number;
  postureLabel: string;
  recoveryLimit: number;
  shouldRecoverStale: boolean;
  shouldRecoverThenRun: boolean;
  shouldRunExecutor: boolean;
  shouldSweepSessions: boolean;
  staleSeconds: number;
  sweepLimit: number;
  title: string;
  tone: "danger" | "warning" | "cyan" | "violet" | "success";
};

const AGENT_CALLBACK_SECRET_FLASH_COOKIE = "np_agent_callback_secret_flash";

const EXECUTION_STATUS_ORDER: AgentExecutionStatus[] = [
  "running",
  "queued",
  "submitted",
  "completed",
  "failed",
  "cancelled",
];

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

function formatAgentSourceType(sourceType: AgentView["sourceType"]) {
  return sourceType === "external" ? "接口定义" : "平台代运行";
}

function formatAgentLayerLabel(agent: Pick<AgentView, "hostingMode" | "sourceType">) {
  if (agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only") {
    return "平台重型";
  }
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime" || agent.sourceType === "external") {
    return "OpenAgent";
  }
  return "平台轻量";
}

function formatShanghaiDateTime(value?: string | null) {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatRate(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDurationSeconds(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "未记录";
  }
  const total = Math.max(0, Math.floor(value));
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0 && seconds > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${minutes}m`;
}

function sliceToneLabel(
  variant: AgentOpsSliceCard["variant"],
): string {
  switch (variant) {
    case "danger":
      return "attention";
    case "warning":
      return "watch";
    case "cyan":
      return "live";
    case "success":
      return "stable";
    case "violet":
    default:
      return "bridge";
  }
}

function callbackRecommendationToneLabel(
  variant: CallbackHealthRecommendation["variant"],
) {
  switch (variant) {
    case "danger":
      return "attention";
    case "warning":
      return "watch";
    case "cyan":
    default:
      return "normal";
  }
}

function runtimePressureBadgeVariant(
  level: AgentExecutionRuntimePressureLevel | null | undefined,
): "success" | "warning" | "danger" | "cyan" {
  switch (level) {
    case "critical":
      return "danger";
    case "watch":
      return "warning";
    case "healthy":
    default:
      return "cyan";
  }
}

function runtimePressureSortScore(args: {
  pressureLevel: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass;
}) {
  const pressureScore =
    args.pressureLevel === "critical"
      ? 3
      : args.pressureLevel === "watch"
        ? 2
        : 1;
  const schedulingScore =
    args.schedulingDecisionClass === "profile_and_owner_saturated"
      ? 4
      : args.schedulingDecisionClass === "owner_hotspot"
        ? 3
        : args.schedulingDecisionClass === "profile_saturated"
          ? 2
          : args.schedulingDecisionClass === "queue_backlog"
            ? 1
            : 0;
  return pressureScore * 10 + schedulingScore;
}

function recommendationSeverityVariant(
  severity: "info" | "warning" | "danger" | null | undefined,
): "cyan" | "warning" | "danger" {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  return "cyan";
}

function agentRailPriorityScore(args: {
  rejectedCount: number;
  duplicateCount: number;
  previousProtocolCount: number;
  previousSecretCount: number;
  queuedCount: number;
  runningCount: number;
  failedCount: number;
  pressureLevel?: AgentExecutionRuntimePressureLevel | null;
}) {
  const pressureScore =
    args.pressureLevel === "critical"
      ? 400
      : args.pressureLevel === "watch"
        ? 180
        : 0;
  return (
    pressureScore +
    args.rejectedCount * 40 +
    args.failedCount * 28 +
    args.queuedCount * 16 +
    args.runningCount * 10 +
    (args.previousProtocolCount + args.previousSecretCount) * 8 +
    args.duplicateCount * 5
  );
}

function callbackWindowStateLabel(
  state: AgentView["externalCallbackProtocolWindowState"],
) {
  switch (state) {
    case "active":
      return "兼容中";
    case "expired":
      return "已过期";
    case "none":
    default:
      return "无窗口";
  }
}

function callbackHistoryChangeLabel(
  changeType: AgentCallbackConfigHistoryView["changeType"],
) {
  switch (changeType) {
    case "secret_rotated":
      return "secret rotated";
    case "protocol_updated":
      return "protocol updated";
    case "compatibility_cleaned":
      return "compatibility cleaned";
    case "agent_created":
    default:
      return "agent created";
  }
}

function buildPathWithParams(
  pathname: string,
  params: Record<string, string | number | boolean | null | undefined>,
  fragment?: string | null,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  const base = query.size > 0 ? `${pathname}?${query.toString()}` : pathname;
  return fragment ? `${base}#${encodeURIComponent(fragment)}` : base;
}

function buildAgentCallbackOpsHref(
  agentId: string,
  params: Record<string, string | number | boolean | null | undefined>,
  fragment?: string | null,
) {
  return buildPathWithParams(
    "/ops/agent-callbacks",
    { agentId, ...params },
    fragment,
  );
}

function renderCallbackFollowUpFields(args: AgentCallbackFollowUpArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="followUpAgentId" value={args.agentId} />
      ) : null}
      {args.ownerUserId ? (
        <input
          type="hidden"
          name="followUpOwnerUserId"
          value={args.ownerUserId}
        />
      ) : null}
      {args.callbackType ? (
        <input
          type="hidden"
          name="followUpCallbackType"
          value={args.callbackType}
        />
      ) : null}
      {args.callbackVersion !== null && args.callbackVersion !== undefined ? (
        <input
          type="hidden"
          name="followUpCallbackVersion"
          value={String(args.callbackVersion)}
        />
      ) : null}
      {args.secretVersion !== null && args.secretVersion !== undefined ? (
        <input
          type="hidden"
          name="followUpSecretVersion"
          value={String(args.secretVersion)}
        />
      ) : null}
      {args.status ? (
        <input
          type="hidden"
          name="followUpCallbackStatus"
          value={args.status}
        />
      ) : null}
      {args.remediationPolicyKey ? (
        <input
          type="hidden"
          name="followUpRemediationPolicyKey"
          value={args.remediationPolicyKey}
        />
      ) : null}
      {args.protocolMatch ? (
        <input
          type="hidden"
          name="followUpProtocolMatch"
          value={args.protocolMatch}
        />
      ) : null}
      {args.secretMatch ? (
        <input
          type="hidden"
          name="followUpSecretMatch"
          value={args.secretMatch}
        />
      ) : null}
      {args.retryability ? (
        <input
          type="hidden"
          name="followUpRetryability"
          value={args.retryability}
        />
      ) : null}
      {args.rejectionCategory ? (
        <input
          type="hidden"
          name="followUpRejectionCategory"
          value={args.rejectionCategory}
        />
      ) : null}
      {args.executionStatus ? (
        <input
          type="hidden"
          name="followUpExecutionStatus"
          value={args.executionStatus}
        />
      ) : null}
      {args.recentWindow ? (
        <input
          type="hidden"
          name="followUpRecentWindow"
          value={args.recentWindow}
        />
      ) : null}
      {args.runtimeState ? (
        <input
          type="hidden"
          name="followUpRuntimeState"
          value={args.runtimeState}
        />
      ) : null}
      {args.runtimeKind ? (
        <input
          type="hidden"
          name="followUpRuntimeKind"
          value={args.runtimeKind}
        />
      ) : null}
      {args.runtimeStaleOnly ? (
        <input
          type="hidden"
          name="followUpRuntimeStaleOnly"
          value={args.runtimeStaleOnly}
        />
      ) : null}
      {args.runKind ? (
        <input type="hidden" name="followUpRunKind" value={args.runKind} />
      ) : null}
      {args.runStatus ? (
        <input
          type="hidden"
          name="followUpRunStatus"
          value={args.runStatus}
        />
      ) : null}
      {args.fragment ? (
        <input type="hidden" name="followUpFragment" value={args.fragment} />
      ) : null}
    </>
  );
}

function renderCallbackAutomationFields(args: AgentCallbackAutomationArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="agentId" value={args.agentId} />
      ) : null}
      {args.callbackType ? (
        <input type="hidden" name="callbackType" value={args.callbackType} />
      ) : null}
      {args.remediationPolicyKey ? (
        <input
          type="hidden"
          name="remediationPolicyKey"
          value={args.remediationPolicyKey}
        />
      ) : null}
      {args.callbackVersion !== null && args.callbackVersion !== undefined ? (
        <input
          type="hidden"
          name="callbackVersion"
          value={String(args.callbackVersion)}
        />
      ) : null}
      {args.secretVersion !== null && args.secretVersion !== undefined ? (
        <input
          type="hidden"
          name="secretVersion"
          value={String(args.secretVersion)}
        />
      ) : null}
      {args.protocolMatch ? (
        <input
          type="hidden"
          name="protocolMatch"
          value={args.protocolMatch}
        />
      ) : null}
      {args.secretMatch ? (
        <input type="hidden" name="secretMatch" value={args.secretMatch} />
      ) : null}
      {args.retryability ? (
        <input type="hidden" name="retryability" value={args.retryability} />
      ) : null}
      {args.rejectionCategory ? (
        <input
          type="hidden"
          name="rejectionCategory"
          value={args.rejectionCategory}
        />
      ) : null}
    </>
  );
}

function renderRuntimeSessionActionFields(args: RuntimeSessionActionArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="agentId" value={args.agentId} />
      ) : null}
      {args.ownerUserId ? (
        <input type="hidden" name="ownerUserId" value={args.ownerUserId} />
      ) : null}
      {args.runtimeState ? (
        <input type="hidden" name="state" value={args.runtimeState} />
      ) : null}
      {args.runtimeKind ? (
        <input type="hidden" name="kind" value={args.runtimeKind} />
      ) : null}
      {args.runtimeStaleOnly ? (
        <input type="hidden" name="staleOnly" value={args.runtimeStaleOnly} />
      ) : null}
    </>
  );
}

function buildCallbackHealthRecommendations(
  agentId: string,
  summary: AgentCallbackHealthSummaryView | null,
): CallbackHealthRecommendation[] {
  if (!summary || summary.totalCallbacks === 0) {
    return [];
  }

  const recommendations: CallbackHealthRecommendation[] = [];
  const duplicateRate =
    summary.totalCallbacks > 0
      ? summary.duplicateCallbacks / summary.totalCallbacks
      : 0;

  if (summary.previousProtocolHits > 0) {
    recommendations.push({
      title: "旧协议仍在命中",
      detail: `最近窗口内有 ${summary.previousProtocolHits} 次 callback 仍使用旧协议，建议检查兼容窗口是否该收口。`,
      href: buildAgentCallbackOpsHref(agentId, {
        protocolMatch: "previous",
        recentWindow: "24h",
      }),
      variant: summary.previousProtocolHits >= 3 ? "danger" : "warning",
    });
  }

  if (summary.previousSecretHits > 0) {
    recommendations.push({
      title: "旧密钥仍在命中",
      detail: `最近窗口内有 ${summary.previousSecretHits} 次 callback 仍使用旧密钥，建议核对 third-party 执行端是否已经切换。`,
      href: buildAgentCallbackOpsHref(agentId, {
        secretMatch: "previous",
        recentWindow: "24h",
      }),
      variant: summary.previousSecretHits >= 3 ? "danger" : "warning",
    });
  }

  if (summary.duplicateCallbacks > 0) {
    recommendations.push({
      title: "duplicate callback 偏高",
      detail: `最近窗口内 duplicate 为 ${summary.duplicateCallbacks} 次，占比约 ${Math.round(duplicateRate * 100)}%。建议回看幂等与 replay 行为。`,
      href: buildAgentCallbackOpsHref(agentId, {
        status: "duplicate",
        recentWindow: "24h",
      }),
      variant:
        duplicateRate >= 0.3 || summary.duplicateCallbacks >= 5
          ? "danger"
          : "warning",
    });
  }

  if (summary.rejectedCallbacks > 0) {
    recommendations.push({
      title: "rejected callback 已出现",
      detail: `最近窗口内有 ${summary.rejectedCallbacks} 次 callback 被平台拒绝，建议检查签名、时间戳或协议版本。`,
      href: buildAgentCallbackOpsHref(agentId, {
        status: "rejected",
        recentWindow: "24h",
      }),
      variant: summary.rejectedCallbacks >= 3 ? "danger" : "warning",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "callback health 正常",
      detail:
        "最近窗口内没有旧协议、旧密钥或显著 duplicate 异常，可以继续观察 accepted 回调趋势。",
      href: buildAgentCallbackOpsHref(agentId, { recentWindow: "24h" }),
      variant: "cyan",
    });
  }

  return recommendations;
}

function buildHealthPosture(
  agent: AgentView,
  summary: AgentCallbackHealthSummaryView | null,
): HealthPosture {
  if (agent.sourceType !== "external") {
    return {
      label: "平台内控",
      detail: "平台 Agent 主要走内部执行链，不依赖 external callback 补救面。",
      variant: "violet",
    };
  }

  if (!summary || summary.totalCallbacks === 0) {
    return {
      label: "待观测",
      detail:
        "还没有进入 callback 观测窗口，先完成一次真实执行再判断治理姿态。",
      variant: "cyan",
    };
  }

  const compatibilityHits =
    summary.previousProtocolHits + summary.previousSecretHits;
  if (summary.rejectedCallbacks >= 3 || compatibilityHits >= 3) {
    return {
      label: "高风险",
      detail:
        "已经出现明显 rejected callback 或旧版本命中，建议优先处理 callback 兼容窗口。",
      variant: "danger",
    };
  }
  if (
    summary.rejectedCallbacks > 0 ||
    compatibilityHits > 0 ||
    summary.duplicateCallbacks > 0
  ) {
    return {
      label: "观察中",
      detail:
        "当前已有 duplicate / compatibility 命中，建议保留 callback 运维关注。",
      variant: "warning",
    };
  }
  return {
    label: "健康",
    detail: "最近窗口内没有明显 callback 风险，可以按日常频率巡检。",
    variant: "cyan",
  };
}

function buildOperatorPlaybook(args: {
  agent: AgentView;
  currentOpsHref: string;
  executionCount: number;
  health: AgentCallbackHealthSummaryView | null;
}) {
  const { agent, currentOpsHref, executionCount, health } = args;

  if (agent.sourceType !== "external") {
    return {
      title: "平台 Agent 维护建议",
      detail:
        "优先补全 capability 描述，再通过执行流转观察运行状态与产出，不需要把精力放在 external callback 治理。",
      actions: [
        {
          href: buildAgentsOpsHref({
            agentId: agent.id,
            executionStatus: "all",
          }),
          label: "查看当前执行切片",
          variant: "secondary",
        },
        {
          href: buildAgentsOpsHref({
            agentId: agent.id,
            executionStatus: "running",
          }),
          label: "只看运行中",
          variant: "ghost",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  if (!health || health.totalCallbacks === 0) {
    return {
      title: "先打出首条 callback",
      detail:
        "当前还没有 callback 观测数据。建议先触发一次真实 external execution，再根据 accepted / rejected 情况调整策略。",
      actions: [
        { href: "/agents?mode=tasks", label: "打开 Agent Center", variant: "primary" },
        {
          href: currentOpsHref,
          label: "留在当前页补 capability",
          variant: "ghost",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  const compatibilityHits =
    health.previousProtocolHits + health.previousSecretHits;
  if (health.rejectedCallbacks >= 3 || compatibilityHits >= 3) {
    return {
      title: "优先处理兼容窗口",
      detail:
        "当前 rejected callback 或旧版本命中已经偏高，应该先去 callback 审计和兼容窗口排查，再继续放量执行。",
      actions: [
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            status: "rejected",
            recentWindow: "24h",
          }),
          label: "打开 rejected 审计",
          variant: "primary",
        },
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            protocolMatch: "previous",
            recentWindow: "24h",
          }),
          label: "查看旧协议命中",
          variant: "secondary",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  if (health.duplicateCallbacks > 0) {
    return {
      title: "复核 duplicate 与重放策略",
      detail:
        "当前 duplicate callback 已经出现，但兼容窗口压力不高。优先检查 replay / 幂等行为，再决定是否收紧策略。",
      actions: [
        {
          href: buildAgentCallbackOpsHref(agent.id, {
            status: "duplicate",
            recentWindow: "24h",
          }),
          label: "查看 duplicate 审计",
          variant: "primary",
        },
        {
          href: currentOpsHref,
          label: "留在当前页调整策略",
          variant: "secondary",
        },
      ],
    } satisfies OperatorPlaybook;
  }

  return {
    title: executionCount > 0 ? "维持日常巡检" : "补第一条执行记录",
    detail:
      executionCount > 0
        ? "当前 callback 健康度正常，可以维持例行巡检，重点观察运行中的 execution 是否稳定推进。"
        : "callback 健康度正常，但当前还没有 execution 记录，建议补一条真实执行链路形成观测闭环。",
    actions: [
      {
        href:
          executionCount > 0
            ? buildAgentsOpsHref({
                agentId: agent.id,
                executionStatus: "running",
              })
            : "/agents?mode=tasks",
        label: executionCount > 0 ? "只看运行中执行" : "回 Agent Center",
        variant: "primary",
      },
      {
        href: buildAgentCallbackOpsHref(agent.id, { recentWindow: "24h" }),
        label: "打开 callback 审计",
        variant: "ghost",
      },
    ],
  } satisfies OperatorPlaybook;
}

function buildRuntimePressurePlaybook(args: {
  agent: AgentView;
  pressure: AgentExecutionRuntimeCatalogView["utilization"][number] | null;
  runtimeSummary: AgentExecutionRuntimeSessionSummaryView | null;
  queuedCount: number;
  runningCount: number;
  failedCount: number;
}): RuntimePressurePlaybook | null {
  const {
    agent,
    pressure,
    runtimeSummary,
    queuedCount,
    runningCount,
    failedCount,
  } = args;
  if (!runtimeSummary) {
    return null;
  }

  const staleCount = runtimeSummary.staleOpenCount;
  const terminalCount = runtimeSummary.terminalExecutionOpenCount;
  const openCount = runtimeSummary.openCount;
  const pressureLevel = pressure?.pressureLevel ?? "healthy";
  const tone = runtimePressureBadgeVariant(pressureLevel);
  const recoveryLimit = Math.max(3, Math.min(Math.max(staleCount, failedCount, 3), 25));
  const executorLimit = Math.max(
    3,
    Math.min(Math.max(queuedCount, pressureLevel === "critical" ? 5 : 3), 12),
  );
  const staleSeconds = pressureLevel === "critical" ? 600 : 900;
  const sweepLimit = Math.max(5, Math.min(Math.max(staleCount + terminalCount, 5), 50));

  if (agent.sourceType === "platform") {
    if (pressureLevel === "critical" && (staleCount > 0 || queuedCount > 0 || failedCount > 0)) {
      return {
        title: "Stabilize this owner slice first",
        detail:
          `${pressure?.pressureDetail ?? "Owner runtime pressure is already critical."} ` +
          "Recover stale executions first, then run one executor tick so queued or blocked work can move forward from the same agent view.",
        postureLabel: "recover + run",
        tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: true,
        shouldRecoverStale: staleCount > 0,
        shouldRunExecutor: queuedCount > 0,
        shouldSweepSessions: terminalCount > 0 || staleCount > 1,
      };
    }

    if (staleCount > 0) {
      return {
        title: "Recover stale executions first",
        detail:
          `There are still ${staleCount} stale open runtime sessions on this agent. Pull blocked executions back first, then decide whether another executor tick is needed.`,
        postureLabel: "recover stale",
        tone: tone === "cyan" ? "warning" : tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: true,
        shouldRunExecutor: queuedCount > 0,
        shouldSweepSessions: terminalCount > 0 || staleCount > 1,
      };
    }

    if (queuedCount > 0) {
      return {
        title: "Push the queued backlog forward",
        detail:
          `There are ${queuedCount} queued executions waiting here. A local executor tick from this page is faster than bouncing back to the global ops console.`,
        postureLabel: "run queue",
        tone: tone === "cyan" ? "warning" : tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: false,
        shouldRunExecutor: true,
        shouldSweepSessions: terminalCount > 0,
      };
    }

    if (pressureLevel !== "healthy" || runningCount > 0 || openCount > 0) {
      return {
        title: "Keep runtime pressure under watch",
        detail:
          pressure?.pressureDetail ??
          "This agent still has open runtime sessions, but there is no direct recover-or-run backlog right now. Stay on runtime pressure and execution watch.",
        postureLabel: "watch",
        tone,
        recoveryLimit,
        executorLimit,
        staleSeconds,
        sweepLimit,
        shouldRecoverThenRun: false,
        shouldRecoverStale: false,
        shouldRunExecutor: false,
        shouldSweepSessions: terminalCount > 0,
      };
    }

    return {
      title: "Runtime is in a steady state",
      detail: "This owner slice currently shows no obvious pressure or stale session signal. Keep it on normal patrol.",
      postureLabel: "steady",
      tone: "cyan",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  if (staleCount > 0 || terminalCount > 0) {
    return {
      title: "Clear external runtime residue",
      detail:
        `This external agent still has ${staleCount} stale and ${terminalCount} terminal-open runtime sessions. Sweep residue first, then go back to callback and execution audit.`,
      postureLabel: "sweep",
      tone: staleCount >= 3 ? "danger" : "warning",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: true,
    };
  }

  if (pressureLevel !== "healthy") {
    return {
      title: "Inspect the owner hotspot",
      detail:
        pressure?.pressureDetail ??
        "The owner has entered a runtime pressure state, but there is no stale-recovery step to run immediately. Open runtime pressure and execution watch first.",
      postureLabel: "inspect",
      tone,
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  if (runningCount > 0 || openCount > 0) {
    return {
      title: "Keep the running executions visible",
      detail: "Runtime still has open sessions, but there is no visible pressure or stale signal yet. Continue regular execution and callback patrol.",
      postureLabel: "watch",
      tone: "cyan",
      recoveryLimit,
      executorLimit,
      staleSeconds,
      sweepLimit,
      shouldRecoverThenRun: false,
      shouldRecoverStale: false,
      shouldRunExecutor: false,
      shouldSweepSessions: false,
    };
  }

  return {
    title: "Runtime signals are calm",
    detail: "This external runtime currently has no visible hotspot. Continue normal callback and execution review.",
    postureLabel: "steady",
    tone: "cyan",
    recoveryLimit,
    executorLimit,
    staleSeconds,
    sweepLimit,
    shouldRecoverThenRun: false,
    shouldRecoverStale: false,
    shouldRunExecutor: false,
    shouldSweepSessions: false,
  };
}

function buildAgentsOpsHref(args: {
  agentId?: string | null;
  executionStatus?: string | null;
  policyKey?: string | null;
  q?: string | null;
  sourceType?: string | null;
}) {
  const params = new URLSearchParams();
  if (args.agentId) params.set("agentId", args.agentId);
  if (args.q) params.set("q", args.q);
  if (args.sourceType && args.sourceType !== "all")
    params.set("sourceType", args.sourceType);
  if (args.policyKey && args.policyKey !== "all")
    params.set("policyKey", args.policyKey);
  if (args.executionStatus && args.executionStatus !== "all")
    params.set("executionStatus", args.executionStatus);
  const query = params.toString();
  return query ? `/ops/account/agents?${query}` : "/ops/account/agents";
}

export default async function AgentsOpsPage({
  searchParams,
}: AgentsOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  if (!isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(
      `/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问 Agent 模块运维台。")}`,
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
        <div className="mg-shell">
          <Card className="app-stack">
            <h1 className="mg-title">模块状态暂不可用</h1>
            <p className="mg-copy">
              当前无法从 core 读取 Agent 模块快照，请稍后再试。
            </p>
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
            <h1 className="mg-title">Agent Registry 已关闭</h1>
            <p className="mg-copy">当前环境未开启 Agent 注册与回调治理能力。</p>
          </Card>
        </div>
      </main>
    );
  }

  const [
    agents,
    executions,
    callbackHealthSummaries,
    remediationPolicies,
    runtimeCatalog,
  ] =
    await Promise.all([
      listAgents(userContext).catch(() => [] as AgentView[]),
      listAgentExecutions(userContext).catch(() => [] as AgentExecutionView[]),
      listAgentCallbackHealthSummaries(userContext).catch(
        () => [] as AgentCallbackHealthSummaryView[],
      ),
      listAgentCallbackRemediationPolicies(userContext).catch(() => []),
      getAgentExecutionRuntimeCatalog(userContext).catch(() => null),
    ]);

  const healthByAgentId = new Map(
    callbackHealthSummaries.map((summary) => [summary.agentId, summary]),
  );
  const policyCatalog = mergeAgentCallbackPolicyCatalog(
    remediationPolicies,
    agents.map((agent) => agent.externalCallbackRemediationPolicy),
  );
  const executionPolicyOptions = [
    {
      value: "inherit_agent",
      label: "继承 Agent 默认",
      note: "清空 execution override，回退到 linked agent 当前回调补救策略。",
    },
    ...policyCatalog.map((policy) => ({
      value: policy.key,
      label: formatAgentCallbackPolicyLabel(policy),
      note: policy.note,
    })),
  ];
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
        listAgentCapabilities(userContext, selectedAgent.id).catch(
          () => [] as AgentCapabilityView[],
        ),
        selectedAgent.sourceType === "external"
          ? listOperatorAgentCallbackHistory(
              userContext,
              selectedAgent.id,
              6,
            ).catch(() => [] as AgentCallbackConfigHistoryView[])
          : Promise.resolve([] as AgentCallbackConfigHistoryView[]),
        selectedAgent.sourceType === "external"
          ? listAgentRecentCallbacks(userContext, selectedAgent.id, 6).catch(
              () => [] as AgentRecentCallbackView[],
            )
          : Promise.resolve([] as AgentRecentCallbackView[]),
      ])
    : [[], [], []];
  const selectedRuntimeSessionSummary = selectedAgent
    ? await getAgentExecutionRuntimeSessionSummary(userContext, {
        agentId: selectedAgent.id,
        ownerUserId: selectedAgent.ownerUserId,
      }).catch(() => null)
    : null;

  const selectedHealth = selectedAgent
    ? (healthByAgentId.get(selectedAgent.id) ?? null)
    : null;
  const selectedAgentExecutionPool = selectedAgent
    ? executions.filter((execution) => execution.agentId === selectedAgent.id)
    : [];
  const selectedExecutions = selectedAgent
    ? selectedAgentExecutionPool
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
        .slice(0, 6)
    : [];
  const selectedRecentCallbackAudits = [...selectedRecentCallbacks].sort(
    (left, right) =>
      recentCallbackPriorityScore(right) - recentCallbackPriorityScore(left) ||
      new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime(),
  );

  const currentOpsHref = buildAgentsOpsHref({
    agentId: selectedAgent?.id ?? null,
    executionStatus: executionStatusFilter,
    policyKey: policyKeyFilter,
    q: query,
    sourceType: sourceTypeFilter,
  });
  const createRedirectTo = buildAgentsOpsHref({
    executionStatus: executionStatusFilter,
    policyKey: policyKeyFilter,
    q: query,
    sourceType: sourceTypeFilter,
  });
  const buildCurrentSectionHref = (fragment?: string | null) =>
    buildPathWithParams(
      "/ops/account/agents",
      {
        agentId: selectedAgent?.id ?? null,
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

  const callbackPolicyRecommendation = selectedAgent
    ? buildAgentCallbackPolicyRecommendation(selectedAgent, selectedHealth)
    : null;
  const callbackRecommendations = selectedAgent
    ? buildCallbackHealthRecommendations(selectedAgent.id, selectedHealth)
    : [];
  const selectedHealthPosture = selectedAgent
    ? buildHealthPosture(selectedAgent, selectedHealth)
    : null;
  const selectedOperatorPlaybook = selectedAgent
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
  const selectedRejectedCount = selectedHealth?.rejectedCallbacks ?? 0;
  const selectedDuplicateCount = selectedHealth?.duplicateCallbacks ?? 0;
  const selectedPreviousProtocolCount = selectedHealth?.previousProtocolHits ?? 0;
  const selectedPreviousSecretCount = selectedHealth?.previousSecretHits ?? 0;
  const selectedQueuedExecutionCount = selectedExecutionStatusCounts.queued;
  const selectedRunningExecutionCount = selectedExecutionStatusCounts.running;
  const selectedFailedExecutionCount = selectedExecutionStatusCounts.failed;
  const selectedSubmittedExecutionCount = selectedExecutionStatusCounts.submitted;
  const selectedOverviewFocusMetrics: FocusMetricItem[] = [
    {
      label: "Capabilities",
      value: formatCount(selectedCapabilities.length),
    },
    {
      label: "Executions",
      value: formatCount(selectedAgentExecutionPool.length),
    },
    {
      label: "Rejected",
      value: formatCount(selectedHealth?.rejectedCallbacks ?? 0),
    },
    {
      label: "Policy",
      value: selectedAgent?.externalCallbackRemediationPolicyKey ?? "default",
    },
  ];
  const selectedOverviewDetailRows: DetailListRow[] = selectedAgent
    ? [
        {
          label: "Owner",
          value: selectedAgent.ownerUserId,
        },
        {
          label: "Source / Auth",
          value: `${formatAgentSourceType(selectedAgent.sourceType)} / ${selectedAgent.authMode}`,
        },
        {
          label: "Runtime",
          value: selectedAgent.runtimeEndpoint || "未配置",
        },
        {
          label: "创建 / 更新",
          value: (
            <>
              {formatShanghaiDateTime(selectedAgent.createdAt)} /{" "}
              {formatShanghaiDateTime(selectedAgent.updatedAt)}
            </>
          ),
        },
        {
          label: "描述",
          value: selectedAgent.description || "暂无描述",
        },
      ]
    : [];
  const selectedOverviewStatusActions = selectedAgent ? (
    <>
      {EXECUTION_STATUS_ORDER.map((status) => (
        <Link
          href={buildAgentsOpsHref({
            agentId: selectedAgent.id,
            executionStatus: status,
            policyKey: policyKeyFilter,
            q: query,
            sourceType: sourceTypeFilter,
          })}
          key={status}
        >
          <Badge variant={statusBadgeVariant(status)}>
            {status} × {selectedExecutionStatusCounts[status]}
          </Badge>
        </Link>
      ))}
      <Link
        href={buildAgentsOpsHref({
          agentId: selectedAgent.id,
          executionStatus: "all",
          policyKey: policyKeyFilter,
          q: query,
          sourceType: sourceTypeFilter,
        })}
      >
        <Badge variant="glass">show all</Badge>
      </Link>
    </>
  ) : null;
  const selectedExternalGovernanceRows: DetailListRow[] =
    selectedAgent?.sourceType === "external"
      ? [
          {
            label: "Protocol / Secret",
            value: `v${selectedAgent.externalCallbackProtocolVersion} / secret v${selectedAgent.externalCallbackSecretVersion}`,
          },
          {
            label: "协议窗口",
            value: `${callbackWindowStateLabel(
              selectedAgent.externalCallbackProtocolWindowState,
            )}${selectedAgent.externalCallbackPreviousProtocolVersion ? ` · prev v${selectedAgent.externalCallbackPreviousProtocolVersion}` : ""}${selectedAgent.externalCallbackProtocolGraceUntil ? ` · 截止 ${formatShanghaiDateTime(selectedAgent.externalCallbackProtocolGraceUntil)}` : ""}`,
          },
          {
            label: "Secret 窗口",
            value: `${callbackWindowStateLabel(
              selectedAgent.externalCallbackSecretWindowState,
            )}${selectedAgent.externalCallbackPreviousSecretVersion ? ` · prev v${selectedAgent.externalCallbackPreviousSecretVersion}` : ""}${selectedAgent.externalCallbackSecretGraceUntil ? ` · 截止 ${formatShanghaiDateTime(selectedAgent.externalCallbackSecretGraceUntil)}` : ""}`,
          },
          {
            label: "Policy",
            value: (
              <>
                {selectedAgent.externalCallbackRemediationPolicy
                  ? formatAgentCallbackPolicyLabel(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )
                  : selectedAgent.externalCallbackRemediationPolicyKey}
                {selectedAgent.externalCallbackRemediationPolicy ? (
                  <>
                    <br />
                    Replay 兼容：
                    {formatAgentCallbackReplayCompatibilityPolicy(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )}
                    <br />
                    Fallback 画像：
                    {formatAgentCallbackReplayFallbackProfile(
                      selectedAgent.externalCallbackRemediationPolicy,
                    )}
                  </>
                ) : null}
              </>
            ),
          },
        ]
      : [];
  const selectedCallbackHistoryItems: TimelineItem[] =
    selectedCallbackHistory.map((entry) => ({
      key: entry.id,
      label: (
        <>
          {callbackHistoryChangeLabel(entry.changeType)}
          <br />
          <span className="app-note">
            {formatShanghaiDateTime(entry.createdAt)}
          </span>
        </>
      ),
      value: (
        <>
          协议 {entry.previousProtocolVersion ?? "—"} →{" "}
          {entry.nextProtocolVersion ?? "—"}
          <br />
          密钥 {entry.previousSecretVersion ?? "—"} →{" "}
          {entry.nextSecretVersion ?? "—"}
          {entry.graceUntil ? (
            <>
              <br />
              <span className="app-note">
                兼容至 {formatShanghaiDateTime(entry.graceUntil)}
              </span>
            </>
          ) : null}
          {entry.note ? (
            <>
              <br />
              <span className="app-note">{entry.note}</span>
            </>
          ) : null}
        </>
      ),
    }));
  const selectedCallbackHealthRows: DetailListRow[] = selectedHealth
    ? [
        {
          label: "总回调量",
          value: formatCount(selectedHealth.totalCallbacks),
        },
        {
          label: "accepted / duplicate",
          value: `${formatCount(selectedHealth.acceptedCallbacks)} / ${formatCount(selectedHealth.duplicateCallbacks)}`,
        },
        {
          label: "rejected",
          value: formatCount(selectedHealth.rejectedCallbacks),
        },
        {
          label: "duplicate rate",
          value: formatRate(
            selectedHealth.duplicateCallbacks,
            selectedHealth.totalCallbacks,
          ),
        },
        {
          label: "rejected rate",
          value: formatRate(
            selectedHealth.rejectedCallbacks,
            selectedHealth.totalCallbacks,
          ),
        },
        {
          label: "协议命中",
          value: `当前 ${formatCount(selectedHealth.currentProtocolHits)} / 旧版 ${formatCount(selectedHealth.previousProtocolHits)}`,
        },
        {
          label: "密钥命中",
          value: `当前 ${formatCount(selectedHealth.currentSecretHits)} / 旧版 ${formatCount(selectedHealth.previousSecretHits)}`,
        },
        {
          label: "最近回调",
          value: formatShanghaiDateTime(selectedHealth.lastReceivedAt),
        },
        {
          label: "类型分布",
          value:
            selectedHealth.byCallbackType.length > 0
              ? selectedHealth.byCallbackType
                  .map((item) => `${item.key} (${item.count})`)
                  .join(" / ")
              : "暂无",
        },
      ]
    : [];
  const selectedCallbackRecommendationItems: AgentRecommendationItem[] =
    callbackRecommendations.map((recommendation) => ({
      key: `${selectedAgent?.id ?? "agent"}-${recommendation.title}`,
      title: recommendation.title,
      detail: recommendation.detail,
      badge: (
        <Badge variant={recommendation.variant}>
          {callbackRecommendationToneLabel(recommendation.variant)}
        </Badge>
      ),
      action: (
        <Link className="nt-btn nt-btn--secondary" href={recommendation.href}>
          前往排查
        </Link>
      ),
    }));
  const selectedCapabilityItems: AgentCapabilityListItem[] =
    selectedCapabilities.map((capability) => ({
      id: capability.id,
      code: capability.code,
      title: capability.title,
      description: capability.description || "当前未填写能力说明。",
      pricingNote: capability.pricingNote || "当前未填写定价说明。",
      enabled: capability.enabled,
    }));
  const selectedOwnerPressureEntries =
    selectedAgent && runtimeCatalog
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
  const hasExternalCallbackBacklog = selectedRejectedCount > 0;
  const hasPlatformRuntimeBacklog =
    selectedQueuedExecutionCount > 0 ||
    selectedRunningExecutionCount > 0 ||
    selectedFailedExecutionCount > 0;
  const selectedSliceCards: AgentOpsSliceCard[] = selectedAgent
    ? [
        {
          title: "Rejected Callback",
          count: formatCount(selectedRejectedCount),
          detail: "直接跳到当前 agent 的 rejected callback 审计切片。",
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
          title: "Duplicate Callback",
          count: formatCount(selectedDuplicateCount),
          detail: "复核 duplicate / replay 命中，不再手工拼筛选条件。",
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
          title: "Previous Protocol",
          count: formatCount(selectedPreviousProtocolCount),
          detail: "直接打开旧协议命中的 callback 审计切片。",
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
          title: "Previous Secret",
          count: formatCount(selectedPreviousSecretCount),
          detail: "检查仍使用旧 secret 的 execution / callback。",
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
          title: "Queued Executions",
          count: formatCount(selectedQueuedExecutionCount),
          detail: "直接跳到 execution run watch 的 queued 切片。",
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
          title: "Running Executions",
          count: formatCount(selectedRunningExecutionCount),
          detail: "聚焦运行中的 execution 与关联 callback 语境。",
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
          title: "Submitted / Failed",
          count: formatCount(
            selectedSubmittedExecutionCount + selectedFailedExecutionCount,
          ),
          detail: "把待验收与失败流转直接收进 execution run watch。",
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
          title: "Runtime Sessions",
          count: formatCount(selectedRunningExecutionCount),
          detail:
            selectedAgent.sourceType === "platform"
              ? "直接进入该 agent 的 runtime session watch。"
              : "把当前 agent 的运行态 execution 直接桥接到 runtime session watch。",
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
      ]
    : [];
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
        label: "callback rejection",
        detail: `最近窗口内有 ${formatCount(health?.rejectedCallbacks ?? 0)} 次 rejected callback，需要优先复核审计或补救动作。`,
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
        label: "compat watch",
        detail:
          compatibilityHits > 0
            ? `最近窗口内仍有 ${formatCount(compatibilityHits)} 次 compatibility 命中，需要继续关注协议或 secret 窗口。`
            : `最近窗口内出现 ${formatCount(health?.duplicateCallbacks ?? 0)} 次 duplicate callback，建议回看 replay / 幂等行为。`,
        variant: "warning",
      };
    }
    if (counts.running > 0) {
      return {
        label: "running live",
        detail: `当前有 ${formatCount(counts.running)} 条 running execution 正在该 agent 上运行。`,
        variant: "cyan",
      };
    }
    return {
      label: agent.enabled ? "steady" : "disabled",
      detail: agent.enabled
        ? "当前没有明显热点，适合保持常规巡检。"
        : "Agent 当前处于 disabled 状态，恢复前不应接收新工作。",
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
      badges.push({ label: `running ${counts.running}`, variant: "cyan" });
    }
    if (counts.queued > 0) {
      badges.push({ label: `queued ${counts.queued}`, variant: "violet" });
    }
    if (counts.failed > 0) {
      badges.push({ label: `failed ${counts.failed}`, variant: "danger" });
    }
    if ((health?.rejectedCallbacks ?? 0) > 0) {
      badges.push({
        label: `rejected ${health?.rejectedCallbacks ?? 0}`,
        variant: "danger",
      });
    } else if (
      (health?.previousProtocolHits ?? 0) > 0 ||
      (health?.previousSecretHits ?? 0) > 0
    ) {
      badges.push({
        label: `compat ${formatCount(
          (health?.previousProtocolHits ?? 0) +
            (health?.previousSecretHits ?? 0),
        )}`,
        variant: "warning",
      });
    } else if ((health?.duplicateCallbacks ?? 0) > 0) {
      badges.push({
        label: `duplicate ${health?.duplicateCallbacks ?? 0}`,
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
  const selectedRuntimeSessionsHref = selectedAgent
    ? buildPathWithParams(
        "/ops/agent-callbacks",
        {
          agentId: selectedAgent.id,
          ownerUserId: selectedAgent.ownerUserId,
        },
        "runtime-session-watch",
      )
    : "/ops/agent-callbacks#runtime-session-watch";
  const selectedRuntimePressureHref = selectedAgent
    ? buildPathWithParams(
        "/ops/agent-callbacks",
        {
          agentId: selectedAgent.id,
          ownerUserId: selectedAgent.ownerUserId,
          runtimePressureLevel: selectedPrimaryOwnerPressure?.pressureLevel,
          runtimeSchedulingDecisionClass:
            selectedPrimaryOwnerPressure?.schedulingDecisionClass,
        },
        "runtime-pressure",
      )
    : "/ops/agent-callbacks#runtime-pressure";
  const selectedRuntimeRecommendation =
    selectedRuntimeSessionSummary?.recommendations[0] ?? null;
  const selectedRuntimeRecommendationHref =
    selectedAgent && selectedRuntimeRecommendation
      ? buildPathWithParams(
          "/ops/agent-callbacks",
          {
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: selectedRuntimeRecommendation.runtimeState,
            runtimeKind: selectedRuntimeRecommendation.runtimeKind,
            runtimeStaleOnly:
              selectedRuntimeRecommendation.staleOnly === null
                ? null
                : selectedRuntimeRecommendation.staleOnly
                  ? "true"
                  : "false",
          },
          "runtime-session-watch",
        )
      : selectedRuntimeSessionsHref;
  const selectedRuntimePlaybook = selectedAgent
    ? buildRuntimePressurePlaybook({
        agent: selectedAgent,
        pressure: selectedPrimaryOwnerPressure,
        runtimeSummary: selectedRuntimeSessionSummary,
        queuedCount: selectedQueuedExecutionCount,
        runningCount: selectedRunningExecutionCount,
        failedCount: selectedFailedExecutionCount,
      })
    : null;
  const selectedRuntimePlaybookSignalRows: DetailListRow[] =
    selectedRuntimePlaybook && selectedRuntimeSessionSummary
      ? [
          {
            label: "Pressure Profile",
            value: selectedPrimaryOwnerPressure
              ? `${selectedPrimaryOwnerPressure.key} / ${selectedPrimaryOwnerPressure.pressureDetail}`
              : "No primary owner hotspot in catalog",
          },
          {
            label: "Owner Hotspot",
            value: selectedPrimaryOwnerPressure?.busiestOwnerUserId
              ? `${selectedPrimaryOwnerPressure.busiestOwnerUserId} / running ${selectedPrimaryOwnerPressure.busiestOwnerRunningCount ?? 0} / blocked ${selectedPrimaryOwnerPressure.busiestBlockedOwnerQueuedCount ?? 0}`
              : "No owner hotspot at the moment",
          },
          {
            label: "Scheduling Surface",
            value: `${formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
              selectedPrimaryOwnerPressure?.schedulingDecisionClass ??
                "within_capacity",
            )} / saturated owners ${formatCount(selectedPrimaryOwnerPressure?.saturatedOwnerCount ?? 0)}`,
          },
          {
            label: "Execution Surface",
            value: `running ${formatCount(selectedRunningExecutionCount)} / queued ${formatCount(selectedQueuedExecutionCount)} / failed ${formatCount(selectedFailedExecutionCount)}`,
          },
          {
            label: "Runtime Sessions",
            value: `open ${formatCount(selectedRuntimeSessionSummary.openCount)} / stale ${formatCount(selectedRuntimeSessionSummary.staleOpenCount)} / terminal ${formatCount(selectedRuntimeSessionSummary.terminalExecutionOpenCount)}`,
          },
        ]
      : [];
  const selectedExecutionWatchHref = selectedAgent
    ? buildAgentCallbackOpsHref(
        selectedAgent.id,
        {
          executionStatus:
            selectedQueuedExecutionCount > 0
              ? "queued"
              : selectedRunningExecutionCount > 0
                ? "running"
                : selectedFailedExecutionCount > 0
                  ? "failed"
                  : null,
          recentWindow: "24h",
        },
        "execution-run-watch",
      )
    : "/ops/agent-callbacks#execution-run-watch";
  const selectedRuntimePlaybookBadges =
    selectedRuntimePlaybook && selectedRuntimeSessionSummary ? (
      <div className="app-inline-actions">
        <Badge
          variant={selectedRuntimePlaybook.tone}
        >
          {selectedPrimaryOwnerPressure
            ? formatAgentExecutionLaunchPresetPressureLevelLabel(
                selectedPrimaryOwnerPressure.pressureLevel,
              )
            : "Healthy"}
        </Badge>
        <Badge
          variant={
            selectedPrimaryOwnerPressure ? "warning" : "cyan"
          }
        >
          {formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
            selectedPrimaryOwnerPressure?.schedulingDecisionClass ??
              "within_capacity",
          )}
        </Badge>
        {selectedPrimaryOwnerPressure?.key ? (
          <Badge variant="violet">
            profile {selectedPrimaryOwnerPressure.key}
          </Badge>
        ) : null}
        {selectedRuntimeSessionSummary.staleOpenCount > 0 ? (
          <Badge variant="warning">
            stale {formatCount(selectedRuntimeSessionSummary.staleOpenCount)}
          </Badge>
        ) : null}
        {selectedRuntimeSessionSummary.terminalExecutionOpenCount > 0 ? (
          <Badge variant="danger">
            terminal{" "}
            {formatCount(
              selectedRuntimeSessionSummary.terminalExecutionOpenCount,
            )}
          </Badge>
        ) : null}
      </div>
    ) : null;
  const selectedRuntimePlaybookPrimaryActions =
    selectedRuntimePlaybook && selectedAgent ? (
      selectedRuntimePlaybook.shouldRecoverThenRun ? (
        <form
          action={recoverThenRunPlatformExecutorAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="recoveryLimit"
            value={String(selectedRuntimePlaybook.recoveryLimit)}
          />
          <input
            type="hidden"
            name="executorLimit"
            value={String(selectedRuntimePlaybook.executorLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: null,
            runtimeKind: null,
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Recover + Run owner slice
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldRecoverStale ? (
        <form
          action={recoverStalePlatformExecutionsAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.recoveryLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: "requeued",
            runtimeKind: "stale_recovery",
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Recover stale executions
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldRunExecutor ? (
        <form
          action={runPlatformExecutorNowAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.executorLimit)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: "running",
            runtimeKind: "platform_executor",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Run platform executor
          </button>
        </form>
      ) : selectedRuntimePlaybook.shouldSweepSessions ? (
        <form
          action={sweepRuntimeSessionsAction}
          className="app-inline-actions"
        >
          <input
            type="hidden"
            name="redirectTo"
            value={runtimePressurePlaybookReturnHref}
          />
          <input
            type="hidden"
            name="limit"
            value={String(selectedRuntimePlaybook.sweepLimit)}
          />
          <input
            type="hidden"
            name="staleSeconds"
            value={String(selectedRuntimePlaybook.staleSeconds)}
          />
          {renderRuntimeSessionActionFields({
            agentId: selectedAgent.id,
            ownerUserId: selectedAgent.ownerUserId,
            runtimeState: null,
            runtimeKind: null,
            runtimeStaleOnly: "true",
          })}
          <button className="nt-btn nt-btn--primary" type="submit">
            Sweep stale / terminal
          </button>
        </form>
      ) : (
        <Link className="nt-btn nt-btn--primary" href={selectedRuntimePressureHref}>
          Open Runtime Pressure
        </Link>
      )
    ) : null;
  const selectedRuntimePlaybookSecondaryActions =
    selectedRuntimePlaybook && selectedAgent ? (
      <div className="app-inline-actions" style={{ flexWrap: "wrap" }}>
        <Link className="nt-btn nt-btn--secondary" href={selectedRuntimePressureHref}>
          Runtime Pressure
        </Link>
        <Link className="nt-btn nt-btn--ghost" href={selectedRuntimeSessionsHref}>
          Runtime Sessions
        </Link>
        <Link className="nt-btn nt-btn--ghost" href={selectedExecutionWatchHref}>
          Execution Watch
        </Link>
        {selectedRuntimePlaybook.shouldSweepSessions &&
        (selectedRuntimePlaybook.shouldRecoverThenRun ||
          selectedRuntimePlaybook.shouldRecoverStale ||
          selectedRuntimePlaybook.shouldRunExecutor) ? (
          <form
            action={sweepRuntimeSessionsAction}
            className="app-inline-actions"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={runtimePressurePlaybookReturnHref}
            />
            <input
              type="hidden"
              name="limit"
              value={String(selectedRuntimePlaybook.sweepLimit)}
            />
            <input
              type="hidden"
              name="staleSeconds"
              value={String(selectedRuntimePlaybook.staleSeconds)}
            />
            {renderRuntimeSessionActionFields({
              agentId: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
              runtimeState: null,
              runtimeKind: null,
              runtimeStaleOnly: "true",
            })}
            <button className="nt-btn nt-btn--ghost" type="submit">
              Sweep residue
            </button>
          </form>
        ) : null}
        {selectedRuntimePlaybook.shouldRunExecutor &&
        (selectedRuntimePlaybook.shouldRecoverThenRun ||
          selectedRuntimePlaybook.shouldRecoverStale) ? (
          <form
            action={runPlatformExecutorNowAction}
            className="app-inline-actions"
          >
            <input
              type="hidden"
              name="redirectTo"
              value={runtimePressurePlaybookReturnHref}
            />
            <input
              type="hidden"
              name="limit"
              value={String(selectedRuntimePlaybook.executorLimit)}
            />
            {renderRuntimeSessionActionFields({
              agentId: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
              runtimeState: "running",
              runtimeKind: "platform_executor",
            })}
            <button className="nt-btn nt-btn--ghost" type="submit">
              Run executor tick
            </button>
          </form>
        ) : null}
      </div>
    ) : null;
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
    !selectedAgent
      ? []
      : selectedAgent.sourceType === "external"
      ? hasExternalCallbackBacklog
        ? [
            {
              key: "retry-request",
              subtitle: "Retry Request",
              title: "批量记录 Retry",
              detail:
                "对当前 agent 的 rejected / retryable callback 直接记录 retry request，并跳回审计切片。",
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
                    批量记 Retry Request
                  </button>
                </form>
              ),
            },
            {
              key: "auto-remediation",
              subtitle: "Auto Remediation",
              title: "执行一轮补救",
              detail:
                "按当前 agent 的 callback policy 对 rejected slice 执行一次自动补救。",
              badge: (
                <Badge variant="cyan">
                  policy {selectedAgent.externalCallbackRemediationPolicyKey}
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
                    运行 Auto Remediation
                  </button>
                </form>
              ),
            },
          ]
        : [
            {
              key: "callback-backlog",
              subtitle: "Callback Backlog",
              title: "当前没有 rejected backlog",
              detail:
                "当前 agent 没有 rejected callback 需要批量补救。更适合直接巡检 accepted / duplicate 趋势。",
              badge: <Badge variant="success">clean</Badge>,
              action: (
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={buildAgentCallbackOpsHref(
                    selectedAgent.id,
                    { recentWindow: "24h" },
                    "callback-audits",
                  )}
                >
                  打开 24h Callback 审计
                </Link>
              ),
            },
            {
              key: "health-sweep",
              subtitle: "Health Sweep",
              title: "先看 duplicate / compat",
              detail:
                "如果没有 rejected backlog，优先复核 duplicate、previous protocol 与 previous secret 的命中。",
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
              subtitle: "Executor Tick",
              title: "手动跑一轮 Executor",
              detail:
                "以当前 agent 为边界触发一轮 platform executor，适合把 queued slice 往前推一格。",
              badge: (
                <Badge variant="cyan">
                  queued {selectedQueuedExecutionCount}
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
                    运行 Executor
                  </button>
                </form>
              ),
            },
            {
              key: "recovery-watchdog",
              subtitle: "Recovery Watchdog",
              title: "恢复 Stale Executions",
              detail:
                "以当前 agent 为边界运行 recovery watchdog，适合把 stale 卡住的 execution 重新拉回队列。",
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
                    运行 Recovery Watchdog
                  </button>
                </form>
              ),
            },
          ]
        : [
            {
              key: "runtime-slice",
              subtitle: "Runtime Slice",
              title: "当前没有运行中 / 排队 backlog",
              detail:
                "当前 platform agent 没有明显 runtime backlog，更适合留在当前 agent 切片排查，或回用户侧 Agent Center 补任务。",
              badge: <Badge variant="success">idle</Badge>,
              action: (
                <Link
                  className="nt-btn nt-btn--secondary"
                  href={buildAgentCallbackOpsHref(
                    selectedAgent.id,
                    { recentWindow: "24h" },
                    "execution-run-watch",
                  )}
                >
                  打开 Execution Watch
                </Link>
              ),
            },
            {
              key: "runtime-bridge",
              subtitle: "Runtime Bridge",
              title: "回 Agent Center 补任务",
              detail:
                "当前服务器不再开放独立执行台；当当前 agent 没有待推进任务时，下一步通常是回用户侧 Agent Center 补任务，或留在当前切片继续筛选。",
              badge: <Badge variant="violet">bridge</Badge>,
              action: (
                <div className="app-inline-actions">
                  <Link className="nt-btn nt-btn--ghost" href="/agents?mode=tasks">
                    打开 Agent Center
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
                    留在当前 agent
                  </Link>
                </div>
              ),
            },
          ];

  const selectedRecentCallbackAuditItems =
    selectedAgent && selectedRecentCallbackAudits.length > 0 ? (
      <div className="app-task-list">
        {selectedRecentCallbackAudits.map((entry) =>
          buildSelectedRecentCallbackAuditItem({
            buildAgentCallbackOpsHref,
            entry,
            formatShanghaiDateTime,
            recentCallbacksReturnHref,
            renderCallbackFollowUpFields,
            selectedAgent: {
              id: selectedAgent.id,
              ownerUserId: selectedAgent.ownerUserId,
            },
          }),
        )}
      </div>
    ) : null;

  const selectedExecutionItems =
    selectedAgent && selectedExecutions.length > 0 ? (
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

  const runningCount = executions.filter(
    (execution) => execution.status === "running",
  ).length;
  const queuedCount = executions.filter(
    (execution) => execution.status === "queued",
  ).length;
  const openProtocolCount = agents.filter(
    (agent) =>
      agent.hostingMode === "open_protocol" ||
      agent.hostingMode === "external_runtime" ||
      agent.sourceType === "external",
  ).length;
  const attentionAgentCount = agents.filter((agent) => {
    const summary = healthByAgentId.get(agent.id);
    return summary
      ? summary.rejectedCallbacks > 0 ||
          summary.previousProtocolHits > 0 ||
          summary.previousSecretHits > 0
      : false;
  }).length;

  return (
    <main className="app-page">
      <div
        className="mg-shell app-stack"
        style={{ display: "grid", gap: "28px", paddingBlock: "32px 48px" }}
      >
        <Panel className="app-stack">
        <Badge variant="cyan">Agent Ops Terminal</Badge>
          <h1 className="mg-title">Agent 模块运维台</h1>
          <p className="mg-copy">
            当前页面继续复用{" "}
            <code>core / agent-registry + agent-execution</code>
            ，不新造账户域后端。 这里直接处理当前 operator 可见的 agent
            catalog、capability、callback 治理与 execution 流转。
          </p>
          <div className="app-inline-actions">
            <Link className="nt-btn nt-btn--secondary" href="/agents">
              Agents
            </Link>
            <Link className="nt-btn nt-btn--secondary" href="/my-agents">
              My Agents
            </Link>
            <Link
              className="nt-btn nt-btn--secondary"
              href="/ops/agent-callbacks"
            >
              Callback Ops
            </Link>
          </div>
        </Panel>

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

        <Card className="app-stack">
          <div className="app-task-card__header">
            <div>
              <p className="mg-subtitle">Operator Snapshot</p>
              <h2 className="app-card-title">当前范围总览</h2>
            </div>
            <Badge variant="fuchsia">{formatCount(agents.length)} Agents</Badge>
          </div>
          <div className="app-wallet-grid">
            <Card className="app-currency-card">
              <div className="app-currency-card__header">
                <div>
                  <p className="mg-subtitle">登记总数</p>
                  <h2 className="app-card-title">Registry</h2>
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
                  <h2 className="app-card-title">Runtime</h2>
                </div>
              </div>
              <div className="app-currency-card__value">
                {formatCount(runningCount)}
              </div>
              <div className="app-currency-meta">
                <div className="app-currency-meta__row">
                  <span>排队中</span>
                  <span>{formatCount(queuedCount)}</span>
                </div>
                <div className="app-currency-meta__row">
                  <span>待验收</span>
                  <span>
                    {formatCount(
                      executions.filter(
                        (execution) => execution.status === "submitted",
                      ).length,
                    )}
                  </span>
                </div>
              </div>
            </Card>
            <Card className="app-currency-card">
              <div className="app-currency-card__header">
                <div>
                  <p className="mg-subtitle">治理注意项</p>
                  <h2 className="app-card-title">Callback</h2>
                </div>
              </div>
              <div className="app-currency-card__value">
                {formatCount(attentionAgentCount)}
              </div>
              <div className="app-currency-meta">
                <div className="app-currency-meta__row">
                  <span>有 rejected / 兼容命中</span>
                  <span>{formatCount(attentionAgentCount)}</span>
                </div>
                <div className="app-currency-meta__row">
                  <span>健康 OpenAgent</span>
                  <span>
                    {formatCount(
                      Math.max(0, openProtocolCount - attentionAgentCount),
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </Card>

        <div className="app-announcement-ops">
          <aside className="app-announcement-ops__sidebar">
            <Card className="app-announcement-ops__sidebar-card">
              <div className="app-announcement-ops__sidebar-head">
                  <Badge variant="warning">Filters</Badge>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>
                  Agent Rail
                </h2>
                <p style={{ margin: 0, color: "rgba(226,232,240,0.72)" }}>
                  先收口当前 operator 可见的 agent，再在右侧做治理动作。
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
                  <Badge variant="cyan">Create Agent</Badge>
                  <Badge variant="violet">{`${formatCount(filteredAgents.length)} in rail`}</Badge>
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
                      <Input name="name" placeholder="Agent 名称" required />
                    </label>
                    <label className="app-announcement-ops__field">
                      <span>层级</span>
                      <Select defaultValue="managed_light" name="agentLayer">
                        <option value="managed_light">平台轻量 Agent</option>
                        <option disabled value="managed_heavy">平台重 Agent（暂未开放）</option>
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
                      <span>Runtime</span>
                      <Input
                        name="runtimeEndpoint"
                        placeholder="https://runtime.example"
                      />
                    </label>
                    <label className="app-announcement-ops__field">
                      <span>Provider</span>
                      <Input name="managedProviderLabel" placeholder="OpenAI / Anthropic / ..." />
                    </label>
                    <label className="app-announcement-ops__field">
                      <span>API Base URL</span>
                      <Input name="managedApiBaseUrl" placeholder="https://api.example/v1/responses" />
                    </label>
                    <label className="app-announcement-ops__field">
                      <span>模型</span>
                      <Input name="managedModel" placeholder="gpt-4.1-mini" />
                    </label>
                    <label className="app-announcement-ops__field">
                      <span>API Key</span>
                      <Input name="managedApiKey" placeholder="sk-..." />
                    </label>
                    <label
                      className="app-announcement-ops__field"
                      style={{ gridColumn: "1 / -1" }}
                    >
                      <span>描述</span>
                      <Textarea
                        name="description"
                        placeholder="这个 agent 解决什么问题、依赖什么环境。"
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
                  <p className="app-note">当前筛选条件下没有匹配的 Agent。</p>
                ) : (
                  filteredAgents.map((agent) => {
                    const active = agent.id === selectedAgent?.id;
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
                        statusLabel={agent.enabled ? "enabled" : "disabled"}
                        subtitle={`${formatAgentLayerLabel(agent)} · ${formatAgentSourceType(agent.sourceType)} · ${agent.externalCallbackRemediationPolicyKey}`}
                        summary={
                          health
                            ? `${health.totalCallbacks} callbacks / ${health.rejectedCallbacks} rejected / run ${counts.running} / queue ${counts.queued}`
                            : `暂无 callback 统计 / run ${counts.running} / queue ${counts.queued}`
                        }
                        title={agent.name}
                      />
                    );
                  })
                )}
              </div>
            </Card>
          </aside>

          <section className="app-announcement-ops__panel">
            {!selectedAgent ? (
              <Card className="app-announcement-ops__panel-card app-stack">
                  <Badge variant="warning">No Selection</Badge>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05 }}>
                  当前没有可管理的 Agent
                </h2>
                <p className="mg-copy" style={{ margin: 0 }}>
                  你可以先在左侧创建一个 platform / external
                  agent，或调整筛选条件把已有 agent 拉回 rail。
                </p>
              </Card>
            ) : (
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
                        <Badge variant="cyan">Callback 已配置</Badge>
                      ) : null}
                    </>
                  }
                  detail={
                    <p style={{ margin: 0 }}>
                      这里不再只读展示 catalog，而是直接提供 capability、callback
                      治理和 execution 流转入口。
                    </p>
                  }
                  quickActions={
                    <>
                      <Link
                        className="nt-btn nt-btn--secondary"
                        href="/agents?mode=tasks"
                      >
                        Agent Center
                      </Link>
                      <Link
                        className="nt-btn nt-btn--secondary"
                        href={`/ops/agent-callbacks?agentId=${encodeURIComponent(selectedAgent.id)}`}
                      >
                        Callback 审计
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
                          <span>{`Duplicate ${formatRate(selectedHealth.duplicateCallbacks, selectedHealth.totalCallbacks)}`}</span>
                          <span>{`Rejected ${formatRate(selectedHealth.rejectedCallbacks, selectedHealth.totalCallbacks)}`}</span>
                          <span>{`Compat Hits ${formatCount(selectedHealth.previousProtocolHits + selectedHealth.previousSecretHits)}`}</span>
                        </div>
                      ) : null
                    }
                    subtitle="Governance Posture"
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

                {selectedRuntimeSessionSummary ? (
                  <SelectedAgentRuntimeBridgeCard
                    id="runtime-bridge"
                    oldestOpenLabel={formatShanghaiDateTime(
                      selectedRuntimeSessionSummary.oldestOpenStartedAt,
                    )}
                    oldestStaleLabel={formatShanghaiDateTime(
                      selectedRuntimeSessionSummary.oldestStaleStartedAt,
                    )}
                    openCount={formatCount(
                      selectedRuntimeSessionSummary.openCount,
                    )}
                    pressureDetail={
                      selectedPrimaryOwnerPressure
                        ? `${selectedPrimaryOwnerPressure.pressureDetail} / profile ${selectedPrimaryOwnerPressure.key} / running ${selectedPrimaryOwnerPressure.runningExecutionCount} / queued ${selectedPrimaryOwnerPressure.queuedExecutionCount}`
                        : selectedRuntimeSessionSummary.openCount > 0
                          ? "当前 agent 已经有 runtime sessions，但 runtime catalog 里还没有 owner hotspot 信号。先看 open / stale session。"
                          : "当前没有明显 runtime hotspot；保持常规巡检即可。"
                    }
                    pressureHref={selectedRuntimePressureHref}
                    pressureLabel={
                      selectedPrimaryOwnerPressure
                        ? formatAgentExecutionLaunchPresetPressureLevelLabel(
                            selectedPrimaryOwnerPressure.pressureLevel,
                          )
                        : "Pressure Healthy"
                    }
                    profileCount={formatCount(selectedOwnerPressureEntries.length)}
                    recommendationDetail={
                      selectedRuntimeRecommendation?.detail ?? null
                    }
                    recommendationMeta={
                      selectedRuntimeRecommendation ? (
                        <div className="app-inline-actions">
                          <Badge
                            variant={recommendationSeverityVariant(
                              selectedRuntimeRecommendation.severity,
                            )}
                          >
                            {selectedRuntimeRecommendation.severity}
                          </Badge>
                          <Badge
                            variant={
                              isSweepAgentExecutionRuntimeSessionRecommendationActionKind(
                                selectedRuntimeRecommendation.actionKind,
                              )
                                ? "warning"
                                : "cyan"
                            }
                          >
                            {formatAgentExecutionRuntimeSessionRecommendationActionKindLabel(
                              selectedRuntimeRecommendation.actionKind,
                            )}
                          </Badge>
                          {selectedRuntimeRecommendation.runtimeKind ? (
                            <Badge variant="violet">
                              {formatAgentExecutionLaunchPresetRuntimeSessionKindLabel(
                                selectedRuntimeRecommendation.runtimeKind,
                              )}
                            </Badge>
                          ) : null}
                          {selectedRuntimeRecommendation.runtimeState ? (
                            <Badge variant="cyan">
                              {formatAgentExecutionLaunchPresetRuntimeSessionStateLabel(
                                selectedRuntimeRecommendation.runtimeState,
                              )}
                            </Badge>
                          ) : null}
                          {selectedRuntimeRecommendation.staleOnly ? (
                            <Badge variant="warning">stale</Badge>
                          ) : null}
                        </div>
                      ) : null
                    }
                    recommendationActions={
                      selectedRuntimeRecommendation ? (
                        isSweepAgentExecutionRuntimeSessionRecommendationActionKind(
                          selectedRuntimeRecommendation.actionKind,
                        ) ? (
                          <form
                            action={sweepRuntimeSessionsAction}
                            className="app-inline-actions"
                          >
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={selectedRuntimeRecommendationHref}
                            />
                            <input
                              type="hidden"
                              name="limit"
                              value={String(
                                selectedRuntimeRecommendation.suggestedLimit ??
                                  25,
                              )}
                            />
                            <input
                              type="hidden"
                              name="staleSeconds"
                              value={String(
                                selectedRuntimeRecommendation.suggestedStaleSeconds ??
                                  60,
                              )}
                            />
                            {renderRuntimeSessionActionFields({
                              agentId: selectedAgent.id,
                              ownerUserId: selectedAgent.ownerUserId,
                              runtimeState:
                                selectedRuntimeRecommendation.runtimeState,
                              runtimeKind:
                                selectedRuntimeRecommendation.runtimeKind,
                              runtimeStaleOnly:
                                selectedRuntimeRecommendation.staleOnly === null
                                  ? null
                                  : selectedRuntimeRecommendation.staleOnly
                                    ? "true"
                                    : "false",
                            })}
                            {renderCallbackFollowUpFields({
                              agentId: selectedAgent.id,
                              ownerUserId: selectedAgent.ownerUserId,
                              runtimeState:
                                selectedRuntimeRecommendation.runtimeState,
                              runtimeKind:
                                selectedRuntimeRecommendation.runtimeKind,
                              runtimeStaleOnly:
                                selectedRuntimeRecommendation.staleOnly === null
                                  ? null
                                  : selectedRuntimeRecommendation.staleOnly
                                    ? "true"
                                    : "false",
                              recentWindow: "15m",
                              fragment: "runtime-session-watch",
                            })}
                            <button
                              className="nt-btn nt-btn--secondary"
                              type="submit"
                            >
                              {selectedRuntimeRecommendation.actionLabel}
                            </button>
                          </form>
                        ) : (
                          <Link
                            className="nt-btn nt-btn--secondary"
                            href={selectedRuntimeRecommendationHref}
                          >
                            {selectedRuntimeRecommendation.actionLabel}
                          </Link>
                        )
                      ) : null
                    }
                    recommendationTitle={
                      selectedRuntimeRecommendation?.title ?? null
                    }
                    schedulingLabel={
                      selectedPrimaryOwnerPressure
                        ? formatAgentExecutionLaunchPresetSchedulingDecisionClassLabel(
                            selectedPrimaryOwnerPressure.schedulingDecisionClass,
                          )
                        : "Scheduling Within Capacity"
                    }
                    sessionsHref={selectedRuntimeSessionsHref}
                    staleOpenCount={formatCount(
                      selectedRuntimeSessionSummary.staleOpenCount,
                    )}
                    terminalOpenCount={formatCount(
                      selectedRuntimeSessionSummary.terminalExecutionOpenCount,
                    )}
                    tone={runtimePressureBadgeVariant(
                      selectedPrimaryOwnerPressure?.pressureLevel,
                    )}
                  />
                ) : null}

                {selectedRuntimePlaybook ? (
                  <SelectedAgentRuntimePressurePlaybookCard
                    badges={selectedRuntimePlaybookBadges}
                    detail={selectedRuntimePlaybook.detail}
                    id="runtime-pressure-playbook"
                    postureLabel={selectedRuntimePlaybook.postureLabel}
                    primaryActions={selectedRuntimePlaybookPrimaryActions}
                    secondaryActions={selectedRuntimePlaybookSecondaryActions}
                    signalRows={selectedRuntimePlaybookSignalRows}
                    title={selectedRuntimePlaybook.title}
                    tone={selectedRuntimePlaybook.tone}
                  />
                ) : null}

                <SelectedAgentOverviewCard
                  detailRows={selectedOverviewDetailRows}
                  focusMetrics={selectedOverviewFocusMetrics}
                  statusActions={selectedOverviewStatusActions}
                />

                {selectedAgent.sourceType === "external" ? (
                  <>
                    <SelectedAgentExternalGovernanceCard
                      detailRows={selectedExternalGovernanceRows}
                    />

                    {callbackPolicyRecommendation ? (
                      <SelectedAgentPolicyRecommendationCard
                        action={
                          <form
                            action={updateAgentCallbackRemediationPolicyAction}
                          >
                            <input
                              name="agentId"
                              type="hidden"
                              value={selectedAgent.id}
                            />
                            <input
                              name="policyKey"
                              type="hidden"
                              value={
                                callbackPolicyRecommendation.recommendedPolicyKey
                              }
                            />
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={currentOpsHref}
                            />
                            <button
                              className="nt-btn nt-btn--secondary"
                              type="submit"
                            >
                              切到{" "}
                              {remediationPolicies.find(
                                (policy) =>
                                  policy.key ===
                                  callbackPolicyRecommendation.recommendedPolicyKey,
                              )?.label ||
                                callbackPolicyRecommendation.recommendedPolicyKey}
                            </button>
                          </form>
                        }
                        detail={callbackPolicyRecommendation.detail}
                        subtitle="Policy Recommendation"
                        title={callbackPolicyRecommendation.title}
                        toneBadge={
                          <Badge variant={callbackPolicyRecommendation.tone}>
                            {callbackRecommendationToneLabel(
                              callbackPolicyRecommendation.tone,
                            )}
                          </Badge>
                        }
                      />
                    ) : null}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <SelectedAgentControlCard
                        detail={
                          <p className="app-note">
                            直接从当前 agent 切换默认 remediation policy，
                            作为 rejected callback 自动补救的基础口径。
                          </p>
                        }
                        form={
                          <form
                            action={updateAgentCallbackRemediationPolicyAction}
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
                            <Select
                              defaultValue={
                                selectedAgent.externalCallbackRemediationPolicyKey
                              }
                              name="policyKey"
                            >
                              {policyCatalog.map((policy) => (
                                <option key={policy.key} value={policy.key}>
                                  {formatAgentCallbackPolicyLabel(policy)}
                                </option>
                              ))}
                            </Select>
                            <button
                              className="nt-btn nt-btn--secondary"
                              type="submit"
                            >
                              应用策略
                            </button>
                          </form>
                        }
                        subtitle="Remediation Policy"
                        title="切换回调策略"
                      />
                      <SelectedAgentControlCard
                        detail={
                          <p className="app-note">
                            更新 callback protocol 版本，并把协议窗口治理继续留在当前页。
                          </p>
                        }
                        form={
                          <form
                            action={updateAgentCallbackProtocolVersionAction}
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
                              className="mg-input"
                              defaultValue={String(
                                selectedAgent.externalCallbackProtocolVersion,
                              )}
                              inputMode="numeric"
                              min="1"
                              name="protocolVersion"
                              required
                              type="number"
                            />
                            <button
                              className="nt-btn nt-btn--secondary"
                              type="submit"
                            >
                              更新协议
                            </button>
                          </form>
                        }
                        subtitle="Protocol Window"
                        title="更新协议版本"
                      />
                      <SelectedAgentControlCard
                        detail={
                          callbackSecretFlash?.agentId === selectedAgent.id ? (
                            <div className="app-banner app-banner--success">
                              新回调密钥：
                              <code>{callbackSecretFlash.callbackSecret}</code>
                            </div>
                          ) : (
                            <p className="app-note">
                              页面只会在轮换后短时展示一次完整新密钥。
                            </p>
                          )
                        }
                        form={
                          <form
                            action={rotateAgentCallbackSecretAction}
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
                            <button
                              className="nt-btn nt-btn--secondary"
                              type="submit"
                            >
                              轮换密钥
                            </button>
                          </form>
                        }
                        subtitle="Secret Rotation"
                        title="轮换回调密钥"
                      />
                    </div>

                    <SelectedAgentCallbackHealthCard
                      detailRows={selectedCallbackHealthRows}
                      emptyState={
                        <p className="app-note">
                          该 agent 当前还没有 callback 观测数据。
                        </p>
                      }
                      recommendations={selectedCallbackRecommendationItems}
                      windowBadge={
                        <Badge variant="cyan">
                          {selectedHealth
                            ? `${selectedHealth.windowHours}h`
                            : "no data"}
                        </Badge>
                      }
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "14px",
                      }}
                    >
                      <SelectedAgentTimelineCard
                        badge={
                          <Badge variant="violet">
                            {formatCount(selectedCallbackHistory.length)}
                          </Badge>
                        }
                        emptyState={
                          <p className="app-note">暂无 callback 配置历史。</p>
                        }
                        items={selectedCallbackHistoryItems}
                        subtitle="Callback History"
                        title="配置时间线"
                      />
                      <SelectedAgentRecentCallbacksCard
                        badge={
                          <Badge variant="warning">
                            {formatCount(selectedRecentCallbackAudits.length)}
                          </Badge>
                        }
                        emptyState={
                          <p className="app-note">当前没有最近回调审计。</p>
                        }
                        items={selectedRecentCallbackAuditItems}
                      />
                    </div>
                  </>
                ) : (
                  <SelectedAgentNoticeCard
                    badge={<Badge variant="violet">internal</Badge>}
                    detail={
                      <p className="app-note">
                        当前选中的 Agent
                        属于平台内控链路，主要通过内部执行状态与成果物推进，不依赖
                        external callback secret / protocol
                        治理面。你仍然可以在下方继续维护 capability，并通过执行流转观察运行状态。
                      </p>
                    }
                    subtitle="Platform Runtime"
                    title="平台 Agent 说明"
                  />
                )}

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
                    detail="常用切片直接收口到 execution run watch、runtime session watch 与 callback audits，不必每次从总台重配筛选。"
                    id="slice-deck"
                    items={selectedSliceDeckItems}
                    subtitle="Slice Deck"
                    title="Execution / Callback 快捷切片"
                  />

                  <AgentOpsDeckCard
                    badge={<Badge variant="warning">ops actions</Badge>}
                    detail={
                      selectedAgent.sourceType === "external"
                        ? "从当前 agent 直接发起 rejected callback 的 batch retry / auto-remediation，再回到带切片语境的 callback ops。"
                        : "把 platform executor 与 stale recovery 的手动推进入口收回当前 agent 详情，不必切回总运维台。"
                    }
                    id="action-deck"
                    items={selectedActionDeckItems}
                    subtitle="Action Deck"
                    title={
                      selectedAgent.sourceType === "external"
                        ? "Callback 批动作入口"
                        : "Runtime 手动推进入口"
                    }
                  />
                </div>

                <SelectedAgentCapabilitiesCard
                  badge={
                    <Badge variant="fuchsia">
                      {formatCount(selectedCapabilities.length)}
                    </Badge>
                  }
                  capabilities={selectedCapabilityItems}
                  emptyState={
                    <p className="app-note">当前还没有登记 capability。</p>
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
                        添加 Capability
                      </button>
                    </form>
                  }
                />

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
                  }。这里只保留当前 agent 的最小流转入口，更复杂的执行编排不再开放独立执行台。`}
                  emptyState={
                    <p className="app-note">
                      当前筛选条件下没有匹配的执行记录。
                    </p>
                  }
                  items={selectedExecutionItems}
                />
              </Card>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
