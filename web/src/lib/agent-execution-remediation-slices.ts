import type {
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRetryability,
  AgentExecutionStoredReplayPayloadCompatibility,
} from "@neuro/contracts";

export type AgentExecutionRemediationSliceBucket<T extends string> = {
  key: T;
  count: number;
};

export type AgentExecutionRemediationSliceFilterOverride = {
  callbackStatus?: AgentExecutionCallbackAuditStatus | null;
  callbackRetryability?: AgentExecutionCallbackRetryability | null;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility | null;
  replayPayloadReplayable?: boolean | null;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass | null;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
};

export type AgentExecutionRemediationSliceSummaryLike = {
  totalCount: number;
  rejectedCount: number;
  replayableRejectedCount: number;
  retryableRejectedCount: number;
  inspectRejectedCount: number;
  invalidPayloadCount: number;
  byDecisionClass: AgentExecutionRemediationSliceBucket<AgentExecutionCallbackRemediationDecisionClass>[];
  byReplayFailureClass: AgentExecutionRemediationSliceBucket<AgentExecutionCallbackReplayFailureClass>[];
  dominantDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  dominantReplayFailureClass: AgentExecutionCallbackReplayFailureClass | null;
};

export type AgentExecutionRemediationSliceView = {
  key:
    | "inspect_callback_backlog"
    | "inspect_replayable_callbacks"
    | "inspect_incompatible_callbacks"
    | "inspect_decision_slice"
    | "inspect_replay_failure_slice";
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
  actionLabel: string;
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind;
  filterOverrides: AgentExecutionRemediationSliceFilterOverride;
};

export type AgentExecutionRemediationSlicePreferredActionKind =
  | "inspect"
  | "auto_remediate"
  | "request_retry_batch";

export function formatAgentExecutionRemediationSlicePreferredActionKindLabel(
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind,
) {
  switch (preferredActionKind) {
    case "auto_remediate":
      return "auto-remediate";
    case "request_retry_batch":
      return "retry-batch";
    case "inspect":
    default:
      return "inspect";
  }
}

export function formatAgentExecutionRemediationSliceInspectActionLabel(
  key: AgentExecutionRemediationSliceView["key"],
) {
  switch (key) {
    case "inspect_replayable_callbacks":
      return "打开 Replayable Backlog";
    case "inspect_incompatible_callbacks":
      return "打开 Incompatible Backlog";
    case "inspect_decision_slice":
      return "打开 Decision Slice";
    case "inspect_replay_failure_slice":
      return "打开 Replay Failure Slice";
    case "inspect_callback_backlog":
    default:
      return "打开 Callback Backlog";
  }
}

export function formatAgentExecutionRemediationSliceOperatorActionLabel(
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind,
) {
  switch (preferredActionKind) {
    case "auto_remediate":
      return "去 Ops 执行 Auto Remediation";
    case "request_retry_batch":
      return "去 Ops 批量记录 Retry Request";
    case "inspect":
    default:
      return null;
  }
}

export function buildAgentExecutionRemediationSlices(args: {
  scopeLabel: string;
  summary: AgentExecutionRemediationSliceSummaryLike;
}): AgentExecutionRemediationSliceView[] {
  const { scopeLabel, summary } = args;

  if (summary.totalCount === 0) {
    return [
      {
        key: "inspect_callback_backlog",
        severity: "info",
        title: `${scopeLabel} 当前没有匹配的 callback backlog`,
        detail: "当前 callback slice 没有命中 backlog，可继续沿现有模板推进。",
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {},
      },
    ];
  }

  if (summary.invalidPayloadCount > 0) {
    return [
      {
        key: "inspect_incompatible_callbacks",
        severity: "danger",
        title: `${scopeLabel} 当前存在 incompatible payload backlog`,
        detail: `当前命中了 ${summary.invalidPayloadCount} 条 invalid / incompatible payload，优先确认 payload 规范和 compatibility，而不是先做宽 replay。`,
        actionLabel: "查看 Incompatible Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          replayPayloadCompatibility: "invalid",
        },
      },
      {
        key: "inspect_callback_backlog",
        severity: "warning",
        title: "回看完整 callback backlog",
        detail: "在 incompatible payload 之外，再确认是否还伴随 replayable 或 inspect-only backlog。",
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {},
      },
    ];
  }

  if (
    summary.dominantDecisionClass === "retry_compat_window" ||
    summary.dominantDecisionClass === "skip_compat_window"
  ) {
    return [
      {
        key: "inspect_decision_slice",
        severity: "warning",
        title: `${scopeLabel} 当前主要是 compat-window blocked backlog`,
        detail: `当前最重的 remediation decision 是 ${summary.dominantDecisionClass}，优先确认 compat window 是否仍在阻止 replay。`,
        actionLabel: "查看 Compat Window Slice",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          decisionClass: summary.dominantDecisionClass,
        },
      },
      {
        key: "inspect_callback_backlog",
        severity: "warning",
        title: "回看完整 callback backlog",
        detail: "确认 compat-window blocked 之外，是否还伴随 replayable 或 inspect-only callback。",
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {},
      },
    ];
  }

  if (
    summary.dominantDecisionClass === "retry_compatibility_policy" ||
    summary.dominantDecisionClass === "skip_compatibility_policy"
  ) {
    return [
      {
        key: "inspect_decision_slice",
        severity: "warning",
        title: `${scopeLabel} 当前主要是 compatibility-policy blocked backlog`,
        detail: `当前最重的 remediation decision 是 ${summary.dominantDecisionClass}，优先确认 remediation policy 是否仍在阻止 replay。`,
        actionLabel: "查看 Compatibility Policy Slice",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          decisionClass: summary.dominantDecisionClass,
        },
      },
      {
        key: "inspect_callback_backlog",
        severity: "warning",
        title: "回看完整 callback backlog",
        detail: "确认 policy-blocked 之外，是否还伴随 replayable 或 inspect-only callback。",
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {},
      },
    ];
  }

  if (summary.replayableRejectedCount > 0) {
    const slices: AgentExecutionRemediationSliceView[] = [
      {
        key: "inspect_replayable_callbacks",
        severity: "warning",
        title: `${scopeLabel} 当前存在可重放 callback backlog`,
        detail: `当前命中了 ${summary.replayableRejectedCount} 条可直接 replay 的 rejected callback，适合先从 replay-friendly backlog 开始处理。`,
        actionLabel: "执行 Auto Remediation",
        preferredActionKind: "auto_remediate",
        filterOverrides: {
          callbackStatus: "rejected",
          replayPayloadReplayable: true,
        },
      },
    ];
    if (summary.dominantReplayFailureClass) {
      slices.push({
        key: "inspect_replay_failure_slice",
        severity: "warning",
        title: `${scopeLabel} 当前存在 replay failure 热点`,
        detail: `在 replayable backlog 之外，最常见的 replay failure 是 ${summary.dominantReplayFailureClass}，建议顺手检查这组失败画像。`,
        actionLabel: "查看 Replay Failure Slice",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          replayFailureClass: summary.dominantReplayFailureClass,
        },
      });
    }
    slices.push({
      key: "inspect_callback_backlog",
      severity: "info",
      title: "回看完整 callback backlog",
      detail: "在 replayable backlog 之外，再确认是否还存在 inspect-only 或非 replayable backlog。",
      actionLabel: "查看 Callback Backlog",
      preferredActionKind: "inspect",
      filterOverrides: {},
    });
    return slices;
  }

  if (summary.dominantReplayFailureClass) {
    return [
      {
        key: "inspect_replay_failure_slice",
        severity: "warning",
        title: `${scopeLabel} 当前存在 replay failure 热点`,
        detail: `当前最常见的 replay failure 是 ${summary.dominantReplayFailureClass}，优先从这组失败画像开始排查。`,
        actionLabel: "查看 Replay Failure Slice",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          replayFailureClass: summary.dominantReplayFailureClass,
        },
      },
      {
        key: "inspect_callback_backlog",
        severity: "info",
        title: "回看完整 callback backlog",
        detail: "确认 replay failure hotspot 之外，是否还存在更宽的 rejected / inspect backlog。",
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {},
      },
    ];
  }

  if (summary.retryableRejectedCount > 0) {
    const slices: AgentExecutionRemediationSliceView[] = [
      {
        key: "inspect_callback_backlog",
        severity: "warning",
        title: `${scopeLabel} 当前存在可请求 external retry 的 backlog`,
        detail: `当前共有 ${summary.retryableRejectedCount} 条 rejected callback 更适合直接 request retry，可先把这组 retryable backlog 交给 external runtime。`,
        actionLabel: "批量记录 Retry Request",
        preferredActionKind: "request_retry_batch",
        filterOverrides: {
          callbackStatus: "rejected",
          callbackRetryability: "retryable",
        },
      },
    ];
    if (summary.inspectRejectedCount > 0) {
      slices.push({
        key: "inspect_callback_backlog",
        severity: "warning",
        title: "回看 inspect backlog",
        detail: `在 retryable backlog 之外，当前还存在 ${summary.inspectRejectedCount} 条更适合人工检查的 inspect callback。`,
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
          callbackRetryability: "inspect",
        },
      });
    }
    return slices;
  }

  if (summary.inspectRejectedCount > 0 || summary.rejectedCount > 0) {
    return [
      {
        key: "inspect_callback_backlog",
        severity: "warning",
        title: `${scopeLabel} 当前存在待检查的 callback backlog`,
        detail: `当前共有 ${summary.rejectedCount} 条 rejected callback，其中 ${summary.inspectRejectedCount} 条更适合先人工检查。`,
        actionLabel: "查看 Callback Backlog",
        preferredActionKind: "inspect",
        filterOverrides: {
          callbackStatus: "rejected",
        },
      },
    ];
  }

  return [
    {
      key: "inspect_callback_backlog",
      severity: "info",
      title: `${scopeLabel} 当前 callback slice 基本健康`,
      detail: `当前 callback slice 共命中 ${summary.totalCount} 条记录，没有明显的 rejected / replay 热点。`,
      actionLabel: "查看 Callback Backlog",
      preferredActionKind: "inspect",
      filterOverrides: {},
    },
  ];
}
