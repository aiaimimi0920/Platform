import type {
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAuditView,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRetryability,
  AgentExecutionStoredReplayPayloadCompatibility,
} from "@neuro/contracts";
import {
  buildAgentExecutionRemediationSlices,
  type AgentExecutionRemediationSlicePreferredActionKind,
  type AgentExecutionRemediationSliceView,
  formatAgentExecutionRemediationSliceInspectActionLabel,
  formatAgentExecutionRemediationSliceOperatorActionLabel,
} from "./agent-execution-remediation-slices";

type CallbackSummaryBucket<T extends string> = {
  key: T;
  count: number;
};

export type AgentExecutionCallbackBacklogFilterOverride = {
  callbackStatus?: AgentExecutionCallbackAuditStatus | null;
  callbackRetryability?: AgentExecutionCallbackRetryability | null;
  replayPayloadCompatibility?: AgentExecutionStoredReplayPayloadCompatibility | null;
  replayPayloadReplayable?: boolean | null;
  decisionClass?: AgentExecutionCallbackRemediationDecisionClass | null;
  replayFailureClass?: AgentExecutionCallbackReplayFailureClass | null;
};

export type AgentExecutionCallbackBacklogSummaryView = {
  totalCount: number;
  executionCount: number;
  rejectedCount: number;
  replayableRejectedCount: number;
  retryableRejectedCount: number;
  inspectRejectedCount: number;
  invalidPayloadCount: number;
  byDecisionClass: CallbackSummaryBucket<AgentExecutionCallbackRemediationDecisionClass>[];
  byReplayFailureClass: CallbackSummaryBucket<AgentExecutionCallbackReplayFailureClass>[];
  dominantDecisionClass: AgentExecutionCallbackRemediationDecisionClass | null;
  dominantReplayFailureClass: AgentExecutionCallbackReplayFailureClass | null;
};

export type AgentExecutionCallbackBacklogGuidanceActionKind =
  | "inspect_callback_backlog"
  | "inspect_replayable_callbacks"
  | "inspect_incompatible_callbacks"
  | "inspect_decision_slice"
  | "inspect_replay_failure_slice";

export type AgentExecutionCallbackBacklogGuidanceView = {
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
  actionLabel: string;
  actionKind: AgentExecutionCallbackBacklogGuidanceActionKind;
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind;
  filterOverrides: AgentExecutionCallbackBacklogFilterOverride;
  summary: AgentExecutionCallbackBacklogSummaryView;
};

export type AgentExecutionCallbackBacklogPlaybookStepKind =
  | "inspect_callback_backlog"
  | "inspect_replayable_callbacks"
  | "inspect_incompatible_callbacks"
  | "inspect_decision_slice"
  | "inspect_replay_failure_slice";

export type AgentExecutionCallbackBacklogPlaybookStepView = {
  key: AgentExecutionCallbackBacklogPlaybookStepKind;
  priority: "primary" | "secondary";
  title: string;
  detail: string;
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind;
  filterOverrides?: AgentExecutionCallbackBacklogFilterOverride;
};

export type AgentExecutionCallbackHandoffProfile =
  | "inspect_only"
  | "operator_action_auto_remediate"
  | "operator_action_retry_batch";

export type AgentExecutionCallbackBridgeActionTarget = "owner_local" | "ops_action";

export type AgentExecutionCallbackBridgeActionView = {
  target: AgentExecutionCallbackBridgeActionTarget;
  label: string;
  preferredActionKind: AgentExecutionRemediationSlicePreferredActionKind | null;
};

export type AgentExecutionCallbackBridgePlanView = {
  profile: AgentExecutionCallbackHandoffProfile;
  primaryAction: AgentExecutionCallbackBridgeActionView;
  secondaryAction: AgentExecutionCallbackBridgeActionView | null;
};

export function resolveAgentExecutionCallbackHandoffProfile(args: {
  preferredActionKind?: AgentExecutionRemediationSlicePreferredActionKind | null;
  canUseOperatorActions?: boolean;
}): AgentExecutionCallbackHandoffProfile {
  if (!args.canUseOperatorActions || !args.preferredActionKind || args.preferredActionKind === "inspect") {
    return "inspect_only";
  }
  if (args.preferredActionKind === "auto_remediate") {
    return "operator_action_auto_remediate";
  }
  return "operator_action_retry_batch";
}

export function formatAgentExecutionCallbackHandoffProfileLabel(
  profile: AgentExecutionCallbackHandoffProfile,
) {
  switch (profile) {
    case "operator_action_auto_remediate":
      return "ops-auto-remediate";
    case "operator_action_retry_batch":
      return "ops-retry-batch";
    case "inspect_only":
    default:
      return "inspect-only";
  }
}

export function formatAgentExecutionCallbackBridgeActionTargetLabel(
  target: AgentExecutionCallbackBridgeActionTarget,
) {
  switch (target) {
    case "ops_action":
      return "ops-bridge";
    case "owner_local":
    default:
      return "owner-local";
  }
}

export function resolveAgentExecutionCallbackBridgePlan(args: {
  preferredActionKind?: AgentExecutionRemediationSlicePreferredActionKind | null;
  canUseOperatorActions?: boolean;
  inspectActionKey?: AgentExecutionRemediationSliceView["key"];
  preferOperatorPrimary?: boolean;
}): AgentExecutionCallbackBridgePlanView {
  const inspectActionKey = args.inspectActionKey ?? "inspect_callback_backlog";
  const ownerInspectAction: AgentExecutionCallbackBridgeActionView = {
    target: "owner_local",
    label: formatAgentExecutionRemediationSliceInspectActionLabel(inspectActionKey),
    preferredActionKind: null,
  };
  const profile = resolveAgentExecutionCallbackHandoffProfile({
    preferredActionKind: args.preferredActionKind,
    canUseOperatorActions: args.canUseOperatorActions,
  });
  if (profile === "inspect_only") {
    return {
      profile,
      primaryAction: ownerInspectAction,
      secondaryAction: null,
    };
  }

  const operatorPreferredActionKind: AgentExecutionRemediationSlicePreferredActionKind =
    profile === "operator_action_auto_remediate" ? "auto_remediate" : "request_retry_batch";
  const operatorAction: AgentExecutionCallbackBridgeActionView = {
    target: "ops_action",
    label:
      formatAgentExecutionRemediationSliceOperatorActionLabel(operatorPreferredActionKind) ??
      ownerInspectAction.label,
    preferredActionKind: operatorPreferredActionKind,
  };

  if (args.preferOperatorPrimary) {
    return {
      profile,
      primaryAction: operatorAction,
      secondaryAction: ownerInspectAction,
    };
  }

  return {
    profile,
    primaryAction: ownerInspectAction,
    secondaryAction: operatorAction,
  };
}

function isIncompatibleCallback(callback: AgentExecutionCallbackAuditView) {
  return (
    callback.replayPayloadCompatibility === "invalid" ||
    callback.rejectionCategory === "invalid_payload" ||
    callback.remediationPlan.decisionClass === "retry_incompatible_payload" ||
    callback.remediationPlan.decisionClass === "skip_incompatible_payload"
  );
}

export function buildAgentExecutionCallbackBacklogSummary(args: {
  callbacks: AgentExecutionCallbackAuditView[];
}): AgentExecutionCallbackBacklogSummaryView {
  const executionIds = new Set<string>();
  const decisionCounts = new Map<AgentExecutionCallbackRemediationDecisionClass, number>();
  const replayFailureCounts = new Map<AgentExecutionCallbackReplayFailureClass, number>();
  let rejectedCount = 0;
  let replayableRejectedCount = 0;
  let retryableRejectedCount = 0;
  let inspectRejectedCount = 0;
  let invalidPayloadCount = 0;

  for (const callback of args.callbacks) {
    executionIds.add(callback.executionId);
    if (callback.status === "rejected") {
      rejectedCount += 1;
      if (callback.replayPayloadReplayable) {
        replayableRejectedCount += 1;
      }
      if (callback.retryability === "retryable") {
        retryableRejectedCount += 1;
      }
      if (callback.retryability === "inspect") {
        inspectRejectedCount += 1;
      }
    }
    if (isIncompatibleCallback(callback)) {
      invalidPayloadCount += 1;
    }
    decisionCounts.set(
      callback.remediationPlan.decisionClass,
      (decisionCounts.get(callback.remediationPlan.decisionClass) ?? 0) + 1,
    );
    for (const failureClass of new Set(
      callback.remediationAttempts
        .map((attempt) => attempt.fallbackFailureClass)
        .filter((value): value is AgentExecutionCallbackReplayFailureClass => Boolean(value)),
    )) {
      replayFailureCounts.set(failureClass, (replayFailureCounts.get(failureClass) ?? 0) + 1);
    }
  }

  const byDecisionClass = [...decisionCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  const byReplayFailureClass = [...replayFailureCounts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

  return {
    totalCount: args.callbacks.length,
    executionCount: executionIds.size,
    rejectedCount,
    replayableRejectedCount,
    retryableRejectedCount,
    inspectRejectedCount,
    invalidPayloadCount,
    byDecisionClass,
    byReplayFailureClass,
    dominantDecisionClass: byDecisionClass[0]?.key ?? null,
    dominantReplayFailureClass: byReplayFailureClass[0]?.key ?? null,
  };
}

export function buildAgentExecutionCallbackBacklogGuidance(args: {
  runtimeProfileLabel: string;
  summary: AgentExecutionCallbackBacklogSummaryView;
}): AgentExecutionCallbackBacklogGuidanceView | null {
  const slice = buildAgentExecutionRemediationSlices({
    scopeLabel: args.runtimeProfileLabel,
    summary: args.summary,
  })[0];
  if (!slice) {
    return null;
  }
  return {
    severity: slice.severity,
    title: slice.title,
    detail: slice.detail,
    actionLabel: slice.actionLabel,
    actionKind: slice.key,
    preferredActionKind: slice.preferredActionKind,
    filterOverrides: slice.filterOverrides,
    summary: args.summary,
  };
}

export function buildAgentExecutionCallbackBacklogPlaybook(args: {
  summary: AgentExecutionCallbackBacklogSummaryView;
}): AgentExecutionCallbackBacklogPlaybookStepView[] {
  return buildAgentExecutionRemediationSlices({
    scopeLabel: "当前 callback slice",
    summary: args.summary,
  }).map((slice, index) => ({
    key: slice.key,
    priority: index === 0 ? "primary" : "secondary",
    title: slice.title,
    detail: slice.detail,
    preferredActionKind: slice.preferredActionKind,
    filterOverrides: slice.filterOverrides,
  }));
}
