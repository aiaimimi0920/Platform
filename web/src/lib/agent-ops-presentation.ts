import type {
  AgentCallbackConfigHistoryView,
  AgentExecutionStatus,
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeSchedulingDecisionClass,
} from "@neuro/contracts";
import type { AgentView } from "./core-client";

export const EXECUTION_STATUS_ORDER: AgentExecutionStatus[] = [
  "running",
  "queued",
  "submitted",
  "completed",
  "failed",
  "cancelled",
];

export type AgentOpsSliceCard = {
  count: string;
  detail: string;
  href: string;
  title: string;
  variant: "success" | "warning" | "danger" | "cyan" | "violet";
};

export function formatAgentSourceType(sourceType: AgentView["sourceType"]) {
  return sourceType === "external" ? "接口定义" : "平台代运行";
}

export function formatAgentLayerLabel(agent: Pick<AgentView, "hostingMode" | "sourceType">) {
  if (agent.hostingMode === "managed_heavy" || agent.hostingMode === "registry_only") {
    return "平台重型";
  }
  if (agent.hostingMode === "open_protocol" || agent.hostingMode === "external_runtime" || agent.sourceType === "external") {
    return "OpenAgent";
  }
  return "平台轻量";
}

export function formatShanghaiDateTime(value?: string | null) {
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

export function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function formatDependencyCount(value: number | null) {
  return value === null ? "—" : formatCount(value);
}

export function formatRate(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function formatDurationSeconds(value?: number | null) {
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

export function sliceToneLabel(
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

export function runtimePressureBadgeVariant(
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

export function runtimePressureSortScore(args: {
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

export function recommendationSeverityVariant(
  severity: "info" | "warning" | "danger" | null | undefined,
): "cyan" | "warning" | "danger" {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  return "cyan";
}

export function recommendationSeverityLabel(severity: "info" | "warning" | "danger" | null | undefined) {
  if (severity === "danger") return "高危";
  if (severity === "warning") return "告警";
  return "提示";
}

export function agentRailPriorityScore(args: {
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

export function callbackWindowStateLabel(
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

export function callbackHistoryChangeLabel(
  changeType: AgentCallbackConfigHistoryView["changeType"],
) {
  switch (changeType) {
    case "secret_rotated":
      return "密钥已轮换";
    case "protocol_updated":
      return "协议已更新";
    case "compatibility_cleaned":
      return "兼容窗口已清理";
    case "agent_created":
    default:
      return "智能体已创建";
  }
}

export function buildPathWithParams(
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

export function buildAgentCallbackOpsHref(
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

export function buildAgentsOpsHref(args: {
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
