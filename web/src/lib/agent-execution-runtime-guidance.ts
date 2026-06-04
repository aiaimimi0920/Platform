import type {
  AgentExecutionRuntimePressureLevel,
  AgentExecutionRuntimeProfileKey,
  AgentExecutionRuntimeProfileUtilizationView,
  AgentExecutionRuntimeSchedulingDecisionClass,
} from "@neuro/contracts";

export type AgentExecutionRuntimePressureGuidanceActionKind =
  | "launch_now"
  | "review_cost_overview"
  | "inspect_runtime_sessions"
  | "inspect_execution_backlog"
  | "inspect_owner_guardrail"
  | "adjust_launch_preset";

export type AgentExecutionRuntimePressureGuidanceView = {
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
  actionLabel: string;
  actionKind: AgentExecutionRuntimePressureGuidanceActionKind;
  suggestedRuntimeProfileKey: AgentExecutionRuntimeProfileKey | null;
  ownerGuardrailUserId: string | null;
  pressureLevel: AgentExecutionRuntimePressureLevel;
  schedulingDecisionClass: AgentExecutionRuntimeSchedulingDecisionClass;
};

export type AgentExecutionRuntimePlaybookStepKind =
  | "launch_execution"
  | "adjust_launch_preset"
  | "inspect_runtime_sessions"
  | "inspect_cost_overview"
  | "inspect_execution_backlog"
  | "inspect_callback_backlog"
  | "inspect_runtime_incidents"
  | "observe_runtime_incidents"
  | "inspect_runtime_incident_follow_up"
  | "handoff_runtime_incidents"
  | "acknowledge_runtime_incidents"
  | "silence_runtime_incidents"
  | "clear_runtime_incident_silence"
  | "emit_runtime_alerts";

export type AgentExecutionRuntimeIncidentFollowUpTarget =
  | "runtime_sessions"
  | "execution_backlog"
  | "callback_backlog"
  | "cost_overview";

export type AgentExecutionRuntimeIncidentLifecycleDisposition =
  | "observe"
  | "handoff"
  | "escalate";

export type AgentExecutionRuntimePlaybookStepView = {
  key: AgentExecutionRuntimePlaybookStepKind;
  priority: "primary" | "secondary";
  title: string;
  detail: string;
  followUpTarget?: AgentExecutionRuntimeIncidentFollowUpTarget;
  lifecycleDisposition?: AgentExecutionRuntimeIncidentLifecycleDisposition;
};

export type AgentExecutionRuntimeBridgeActionTarget = "ops_action" | "ops_slice" | "owner_bridge";

export type AgentExecutionRuntimeBridgeDestination =
  | "launch_execution"
  | "launch_preset"
  | "runtime_sessions"
  | "execution_backlog"
  | "callback_backlog"
  | "cost_overview"
  | "runtime_incidents"
  | "runtime_pressure";

export type AgentExecutionRuntimeBridgeActionView = {
  stepKey: AgentExecutionRuntimePlaybookStepKind;
  target: AgentExecutionRuntimeBridgeActionTarget;
  destination: AgentExecutionRuntimeBridgeDestination;
  label: string;
};

export type AgentExecutionRuntimeBridgePlanView = {
  primaryAction: AgentExecutionRuntimeBridgeActionView;
  secondaryAction: AgentExecutionRuntimeBridgeActionView | null;
};

function withRuntimePlaybookStepPriority(
  step: AgentExecutionRuntimePlaybookStepView | null,
  priority: "primary" | "secondary",
): AgentExecutionRuntimePlaybookStepView | null {
  if (!step) {
    return null;
  }
  if (step.priority === priority) {
    return step;
  }
  return {
    ...step,
    priority,
  };
}

export function resolveAgentExecutionRuntimeIncidentFocusState(args: {
  activeIncidentCount?: number | null;
  acknowledgedIncidentCount?: number | null;
  silencedIncidentCount?: number | null;
}): "active" | "acknowledged" | "silenced" | null {
  const activeCount =
    typeof args.activeIncidentCount === "number" && Number.isFinite(args.activeIncidentCount)
      ? Math.max(0, Math.floor(args.activeIncidentCount))
      : 0;
  if (activeCount > 0) {
    return "active";
  }
  const acknowledgedCount =
    typeof args.acknowledgedIncidentCount === "number" && Number.isFinite(args.acknowledgedIncidentCount)
      ? Math.max(0, Math.floor(args.acknowledgedIncidentCount))
      : 0;
  if (acknowledgedCount > 0) {
    return "acknowledged";
  }
  const silencedCount =
    typeof args.silencedIncidentCount === "number" && Number.isFinite(args.silencedIncidentCount)
      ? Math.max(0, Math.floor(args.silencedIncidentCount))
      : 0;
  if (silencedCount > 0) {
    return "silenced";
  }
  return null;
}

export function resolveAgentExecutionRuntimeIncidentFollowUpTarget(args: {
  guidance: AgentExecutionRuntimePressureGuidanceView;
  hasCallbackFollowUp?: boolean;
  utilization?: AgentExecutionRuntimeProfileUtilizationView | null;
}): AgentExecutionRuntimeIncidentFollowUpTarget {
  const blockedQueuedExecutionCount = args.utilization?.blockedQueuedExecutionCount ?? 0;
  const blockedByOwnerCount = args.utilization?.blockedByOwnerCount ?? 0;
  const blockedByProfileCount = args.utilization?.blockedByProfileCount ?? 0;

  if (
    args.guidance.schedulingDecisionClass === "owner_hotspot" ||
    (args.guidance.schedulingDecisionClass === "profile_and_owner_saturated" && blockedByOwnerCount > 0)
  ) {
    return "runtime_sessions";
  }
  if (
    blockedQueuedExecutionCount > 0 ||
    blockedByProfileCount > 0 ||
    args.guidance.schedulingDecisionClass === "queue_backlog" ||
    args.guidance.schedulingDecisionClass === "profile_saturated"
  ) {
    return "execution_backlog";
  }
  if (args.hasCallbackFollowUp) {
    return "callback_backlog";
  }
  return "cost_overview";
}

export function formatAgentExecutionRuntimePressureGuidanceActionKindLabel(
  actionKind: AgentExecutionRuntimePressureGuidanceActionKind,
) {
  switch (actionKind) {
    case "launch_now":
      return "launch";
    case "inspect_execution_backlog":
      return "backlog";
    case "inspect_owner_guardrail":
      return "quota";
    case "inspect_runtime_sessions":
      return "sessions";
    case "adjust_launch_preset":
      return "preset";
    case "review_cost_overview":
    default:
      return "cost";
  }
}

export function formatAgentExecutionRuntimePlaybookStepActionLabel(args: {
  stepKey: AgentExecutionRuntimePlaybookStepKind;
  suggestedRuntimeProfileLabel?: string | null;
  incidentFollowUpTarget?: AgentExecutionRuntimeIncidentFollowUpTarget | null;
  incidentLifecycleDisposition?: AgentExecutionRuntimeIncidentLifecycleDisposition | null;
}) {
  switch (args.stepKey) {
    case "launch_execution":
      return "继续创建 Execution";
    case "inspect_runtime_sessions":
      return "打开 Runtime Sessions";
    case "inspect_execution_backlog":
      return "打开 Execution Backlog";
    case "inspect_callback_backlog":
      return "打开 Callback Backlog";
    case "inspect_runtime_incidents":
      return "打开 Runtime Incidents";
    case "observe_runtime_incidents":
      return "继续观察 Runtime Incidents";
    case "inspect_runtime_incident_follow_up":
      switch (args.incidentFollowUpTarget) {
        case "runtime_sessions":
          return "转到 Runtime Sessions";
        case "execution_backlog":
          return "转到 Execution Backlog";
        case "callback_backlog":
          return "转到 Callback Backlog";
        case "cost_overview":
        default:
          return "转到 Cost Overview";
      }
    case "handoff_runtime_incidents":
      switch (args.incidentFollowUpTarget) {
        case "runtime_sessions":
          return args.incidentLifecycleDisposition === "escalate"
            ? "升级到 Runtime Sessions"
            : "移交到 Runtime Sessions";
        case "execution_backlog":
          return args.incidentLifecycleDisposition === "escalate"
            ? "升级到 Execution Backlog"
            : "移交到 Execution Backlog";
        case "callback_backlog":
          return args.incidentLifecycleDisposition === "escalate"
            ? "升级到 Callback Backlog"
            : "移交到 Callback Backlog";
        case "cost_overview":
        default:
          return args.incidentLifecycleDisposition === "escalate"
            ? "升级到 Cost Overview"
            : "移交到 Cost Overview";
      }
    case "acknowledge_runtime_incidents":
      return "确认 Runtime Incidents";
    case "silence_runtime_incidents":
      return "静默 Runtime Incidents";
    case "clear_runtime_incident_silence":
      return "解除 Incident 静默";
    case "emit_runtime_alerts":
      return "派发 Runtime Alerts";
    case "adjust_launch_preset":
      return args.suggestedRuntimeProfileLabel
        ? `切换到 ${args.suggestedRuntimeProfileLabel}`
        : "调整 Launch Preset";
    case "inspect_cost_overview":
    default:
      return "打开 Cost Overview";
  }
}

export function resolveAgentExecutionRuntimePressureGuidanceStepKey(
  actionKind: AgentExecutionRuntimePressureGuidanceActionKind,
): AgentExecutionRuntimePlaybookStepKind {
  switch (actionKind) {
    case "launch_now":
      return "launch_execution";
    case "inspect_runtime_sessions":
      return "inspect_runtime_sessions";
    case "inspect_execution_backlog":
    case "inspect_owner_guardrail":
      return "inspect_execution_backlog";
    case "adjust_launch_preset":
      return "adjust_launch_preset";
    case "review_cost_overview":
    default:
      return "inspect_cost_overview";
  }
}

export function resolveAgentExecutionRuntimeGuidanceBridgePlan(args: {
  actionKind: AgentExecutionRuntimePressureGuidanceActionKind;
  suggestedRuntimeProfileLabel?: string | null;
}): AgentExecutionRuntimeBridgePlanView {
  switch (args.actionKind) {
    case "launch_now":
      return {
        primaryAction: {
          stepKey: "launch_execution",
          target: "owner_bridge",
          destination: "launch_execution",
          label: formatAgentExecutionRuntimePlaybookStepActionLabel({
            stepKey: "launch_execution",
          }),
        },
        secondaryAction: null,
      };
    case "inspect_runtime_sessions":
      return {
        primaryAction: {
          stepKey: "inspect_runtime_sessions",
          target: "owner_bridge",
          destination: "runtime_sessions",
          label: formatAgentExecutionRuntimePlaybookStepActionLabel({
            stepKey: "inspect_runtime_sessions",
          }),
        },
        secondaryAction: null,
      };
    case "inspect_execution_backlog":
    case "inspect_owner_guardrail":
      return {
        primaryAction: {
          stepKey: "inspect_execution_backlog",
          target: "owner_bridge",
          destination: "execution_backlog",
          label: formatAgentExecutionRuntimePlaybookStepActionLabel({
            stepKey: "inspect_execution_backlog",
          }),
        },
        secondaryAction: null,
      };
    case "adjust_launch_preset":
      return {
        primaryAction: {
          stepKey: "adjust_launch_preset",
          target: "owner_bridge",
          destination: "launch_preset",
          label: formatAgentExecutionRuntimePlaybookStepActionLabel({
            stepKey: "adjust_launch_preset",
            suggestedRuntimeProfileLabel: args.suggestedRuntimeProfileLabel ?? null,
          }),
        },
        secondaryAction: null,
      };
    case "review_cost_overview":
    default:
      return {
        primaryAction: {
          stepKey: "inspect_cost_overview",
          target: "owner_bridge",
          destination: "cost_overview",
          label: formatAgentExecutionRuntimePlaybookStepActionLabel({
            stepKey: "inspect_cost_overview",
          }),
        },
        secondaryAction: null,
      };
  }
}

export function formatAgentExecutionRuntimeIncidentLifecycleDispositionLabel(
  disposition: AgentExecutionRuntimeIncidentLifecycleDisposition,
) {
  switch (disposition) {
    case "observe":
      return "observe";
    case "escalate":
      return "escalate";
    case "handoff":
    default:
      return "handoff";
  }
}

export function formatAgentExecutionRuntimeBridgeActionTargetLabel(
  target: AgentExecutionRuntimeBridgeActionTarget,
) {
  switch (target) {
    case "ops_action":
      return "ops-action";
    case "owner_bridge":
      return "owner-bridge";
    case "ops_slice":
    default:
      return "ops-slice";
  }
}

export function resolveAgentExecutionRuntimeBridgePlan(args: {
  stepKey: AgentExecutionRuntimePlaybookStepKind;
  suggestedRuntimeProfileLabel?: string | null;
  incidentFollowUpTarget?: AgentExecutionRuntimeIncidentFollowUpTarget | null;
  incidentLifecycleDisposition?: AgentExecutionRuntimeIncidentLifecycleDisposition | null;
}): AgentExecutionRuntimeBridgePlanView {
  const primaryLabel = formatAgentExecutionRuntimePlaybookStepActionLabel({
    stepKey: args.stepKey,
    suggestedRuntimeProfileLabel: args.suggestedRuntimeProfileLabel,
    incidentFollowUpTarget: args.incidentFollowUpTarget,
    incidentLifecycleDisposition: args.incidentLifecycleDisposition,
  });
  switch (args.stepKey) {
    case "launch_execution":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "owner_bridge",
          destination: "launch_execution",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "adjust_launch_preset":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "owner_bridge",
          destination: "launch_preset",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "inspect_runtime_sessions":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "runtime_sessions",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "inspect_execution_backlog":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "execution_backlog",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "inspect_callback_backlog":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "callback_backlog",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "inspect_cost_overview":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "cost_overview",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "inspect_runtime_incidents":
    case "observe_runtime_incidents":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "runtime_incidents",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
    case "acknowledge_runtime_incidents":
    case "silence_runtime_incidents":
    case "clear_runtime_incident_silence":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_action",
          destination: "runtime_incidents",
          label: primaryLabel,
        },
        secondaryAction: {
          stepKey: "inspect_runtime_incidents",
          target: "ops_slice",
          destination: "runtime_incidents",
          label: "回看 Runtime Incidents",
        },
      };
    case "emit_runtime_alerts":
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_action",
          destination: "runtime_pressure",
          label: primaryLabel,
        },
        secondaryAction: {
          stepKey: "inspect_cost_overview",
          target: "ops_slice",
          destination: "runtime_pressure",
          label: "回到 Runtime Pressure",
        },
      };
    case "handoff_runtime_incidents":
    case "inspect_runtime_incident_follow_up": {
      const destination =
        args.incidentFollowUpTarget === "runtime_sessions"
          ? "runtime_sessions"
          : args.incidentFollowUpTarget === "execution_backlog"
            ? "execution_backlog"
            : args.incidentFollowUpTarget === "callback_backlog"
              ? "callback_backlog"
              : "cost_overview";
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination,
          label: primaryLabel,
        },
        secondaryAction: {
          stepKey: "inspect_runtime_incidents",
          target: "ops_slice",
          destination: "runtime_incidents",
          label: "回看 Runtime Incidents",
        },
      };
    }
    default:
      return {
        primaryAction: {
          stepKey: args.stepKey,
          target: "ops_slice",
          destination: "runtime_pressure",
          label: primaryLabel,
        },
        secondaryAction: null,
      };
  }
}

function suggestFallbackRuntimeProfileKey(
  runtimeProfileKey: AgentExecutionRuntimeProfileKey,
): AgentExecutionRuntimeProfileKey | null {
  if (runtimeProfileKey === "deep_runtime") return "iterative";
  if (runtimeProfileKey === "iterative") return "baseline";
  return null;
}

function formatRuntimeQueueGuardrailDetail(
  utilization: AgentExecutionRuntimeProfileUtilizationView,
) {
  if (utilization.blockedQueuedExecutionCount > 0) {
    return ` 当前队列里可 claim ${utilization.claimableQueuedExecutionCount} 条，另有 ${utilization.blockedQueuedExecutionCount} 条已经被 guardrail 挡住（profile ${utilization.blockedByProfileCount} / owner ${utilization.blockedByOwnerCount}）。`;
  }
  if (utilization.claimableQueuedExecutionCount > 0) {
    return ` 当前队列里还有 ${utilization.claimableQueuedExecutionCount} 条可被后续 claim。`;
  }
  return "";
}

function formatBlockedOwnerDetail(utilization: AgentExecutionRuntimeProfileUtilizationView) {
  if (!utilization.busiestBlockedOwnerUserId || utilization.busiestBlockedOwnerQueuedCount === null) {
    return utilization.blockedOwnerCount > 0
      ? ` 当前已有 ${utilization.blockedOwnerCount} 个 owner 被 quota 挡住。`
      : "";
  }
  return ` 当前最重的 blocked owner 是 ${utilization.busiestBlockedOwnerUserId}（${utilization.busiestBlockedOwnerQueuedCount} queued）。`;
}

export function resolveAgentExecutionRuntimeIncidentLifecycleDisposition(args: {
  focusIncidentState: "active" | "acknowledged" | "silenced" | null;
  acknowledgedIncidentCount?: number | null;
  silencedIncidentCount?: number | null;
  matchedAlertLevel?: number | null;
  followUpTarget?: AgentExecutionRuntimeIncidentFollowUpTarget | null;
  guidance: AgentExecutionRuntimePressureGuidanceView;
  utilization?: AgentExecutionRuntimeProfileUtilizationView | null;
}): AgentExecutionRuntimeIncidentLifecycleDisposition | null {
  if (args.focusIncidentState !== "acknowledged" && args.focusIncidentState !== "silenced") {
    return null;
  }
  const acknowledgedIncidentCount =
    typeof args.acknowledgedIncidentCount === "number" && Number.isFinite(args.acknowledgedIncidentCount)
      ? Math.max(0, Math.floor(args.acknowledgedIncidentCount))
      : 0;
  const silencedIncidentCount =
    typeof args.silencedIncidentCount === "number" && Number.isFinite(args.silencedIncidentCount)
      ? Math.max(0, Math.floor(args.silencedIncidentCount))
      : 0;
  const matchedAlertLevel =
    typeof args.matchedAlertLevel === "number" && Number.isFinite(args.matchedAlertLevel)
      ? Math.max(0, Math.floor(args.matchedAlertLevel))
      : 0;
  const blockedQueuedExecutionCount = args.utilization?.blockedQueuedExecutionCount ?? 0;

  if (args.focusIncidentState === "acknowledged") {
    if (
      acknowledgedIncidentCount >= 3 ||
      (args.followUpTarget === "execution_backlog" &&
        (blockedQueuedExecutionCount > 0 ||
          args.guidance.schedulingDecisionClass === "queue_backlog" ||
          args.guidance.schedulingDecisionClass === "profile_saturated" ||
          args.guidance.schedulingDecisionClass === "profile_and_owner_saturated")) ||
      (args.followUpTarget === "callback_backlog" && matchedAlertLevel >= 3)
    ) {
      return "escalate";
    }
    return "handoff";
  }

  if (silencedIncidentCount >= 2 || matchedAlertLevel >= 3) {
    return "escalate";
  }
  return "handoff";
}

export function buildAgentExecutionRuntimePressureGuidance(args: {
  runtimeProfileKey: AgentExecutionRuntimeProfileKey;
  runtimeProfileLabel: string;
  utilization: AgentExecutionRuntimeProfileUtilizationView | null;
}): AgentExecutionRuntimePressureGuidanceView | null {
  const utilization = args.utilization;
  if (!utilization) {
    return null;
  }

  const suggestedRuntimeProfileKey = suggestFallbackRuntimeProfileKey(args.runtimeProfileKey);
  const queued = utilization.queuedExecutionCount;
  const running = utilization.runningExecutionCount;
  const slots = utilization.availableExecutionSlots ?? null;
  const guardrailDetail = formatRuntimeQueueGuardrailDetail(utilization);
  const blockedOwnerDetail = formatBlockedOwnerDetail(utilization);
  const busiestOwner =
    utilization.busiestOwnerUserId && utilization.busiestOwnerRunningCount !== null
      ? `${utilization.busiestOwnerUserId} (${utilization.busiestOwnerRunningCount})`
      : null;

  if (utilization.schedulingDecisionClass === "profile_and_owner_saturated") {
    return {
      severity: "danger",
      title: `${args.runtimeProfileLabel} 已同时触发 profile saturation 和 owner hotspot`,
      detail: `${utilization.pressureDetail} 当前有 ${running} 个运行中 execution、${queued} 个排队 execution，且 ${utilization.saturatedOwnerCount} 个 owner 已打满并发。${guardrailDetail}${blockedOwnerDetail}${
        suggestedRuntimeProfileKey
          ? ` 建议先把模板切到 ${suggestedRuntimeProfileKey}，再观察 backlog 是否回落。`
          : utilization.blockedQueuedExecutionCount > 0
            ? " 建议先查看 queued backlog，确认哪些 execution 已经被 quota 硬挡住。"
            : " 建议先等待槽位释放。"
      }`,
      actionLabel: suggestedRuntimeProfileKey
        ? "调整 Launch Preset"
        : utilization.blockedQueuedExecutionCount > 0
          ? "查看 Execution Backlog"
          : "查看 Runtime Sessions",
      actionKind: suggestedRuntimeProfileKey
        ? "adjust_launch_preset"
        : utilization.blockedQueuedExecutionCount > 0
          ? "inspect_execution_backlog"
          : "inspect_runtime_sessions",
      suggestedRuntimeProfileKey,
      ownerGuardrailUserId:
        utilization.blockedByOwnerCount > 0 ? utilization.busiestBlockedOwnerUserId : null,
      pressureLevel: utilization.pressureLevel,
      schedulingDecisionClass: utilization.schedulingDecisionClass,
    };
  }

  if (utilization.schedulingDecisionClass === "profile_saturated") {
    return {
      severity: "danger",
      title: `${args.runtimeProfileLabel} 已达到 profile 并发上限`,
      detail: `${utilization.pressureDetail} 当前有 ${running} 个运行中 execution，剩余槽位 ${slots ?? "unbounded"}。${guardrailDetail}${
        suggestedRuntimeProfileKey
          ? ` 如果这条模板并不要求当前 profile，建议回退到 ${suggestedRuntimeProfileKey}。`
          : utilization.blockedByProfileCount > 0
            ? " 建议先查看 queued backlog，确认哪些 execution 已经被 profile cap 卡住。"
            : " 建议等待当前 execution 释放槽位后再继续直启。"
      }`,
      actionLabel: suggestedRuntimeProfileKey
        ? "调整 Launch Preset"
        : utilization.blockedByProfileCount > 0
          ? "查看 Execution Backlog"
          : "查看 Runtime Sessions",
      actionKind: suggestedRuntimeProfileKey
        ? "adjust_launch_preset"
        : utilization.blockedByProfileCount > 0
          ? "inspect_execution_backlog"
          : "inspect_runtime_sessions",
      suggestedRuntimeProfileKey,
      ownerGuardrailUserId:
        utilization.blockedByOwnerCount > 0 ? utilization.busiestBlockedOwnerUserId : null,
      pressureLevel: utilization.pressureLevel,
      schedulingDecisionClass: utilization.schedulingDecisionClass,
    };
  }

  if (utilization.schedulingDecisionClass === "owner_hotspot") {
    if (utilization.blockedByOwnerCount > 0) {
      return {
        severity: "danger",
        title: `${args.runtimeProfileLabel} 当前 owner quota 已开始阻塞队列`,
        detail: `${utilization.pressureDetail}${guardrailDetail}${blockedOwnerDetail} 优先看 Execution Backlog，确认哪些 queued execution 被 owner quota 挡住，再回看 Runtime Sessions 释放占用。`,
        actionLabel: "查看 Owner Quota Guardrail",
        actionKind: "inspect_owner_guardrail",
        suggestedRuntimeProfileKey: null,
        ownerGuardrailUserId: utilization.busiestBlockedOwnerUserId,
        pressureLevel: utilization.pressureLevel,
        schedulingDecisionClass: utilization.schedulingDecisionClass,
      };
    }
    return {
      severity: "warning",
      title: `${args.runtimeProfileLabel} 当前更像 owner-level hotspot`,
      detail: `${utilization.pressureDetail}${guardrailDetail}${busiestOwner ? ` 当前最热 owner 为 ${busiestOwner}。` : ""} 建议先看 Runtime Sessions，确认是否已有长时间 running / failed / requeued 会话占着并发。`,
      actionLabel: "检查 Runtime Sessions",
      actionKind: "inspect_runtime_sessions",
      suggestedRuntimeProfileKey: null,
      ownerGuardrailUserId: null,
      pressureLevel: utilization.pressureLevel,
      schedulingDecisionClass: utilization.schedulingDecisionClass,
    };
  }

  if (utilization.schedulingDecisionClass === "queue_backlog") {
    if (utilization.blockedByProfileCount > 0 && suggestedRuntimeProfileKey) {
      return {
        severity: "warning",
        title: `${args.runtimeProfileLabel} 的 queue backlog 已开始撞上 profile cap`,
        detail: `${utilization.pressureDetail}${guardrailDetail} 如果只是做常规执行，建议先把模板切到 ${suggestedRuntimeProfileKey}，避免继续把 queued execution 堵在当前 profile。`,
        actionLabel: "调整 Launch Preset",
        actionKind: "adjust_launch_preset",
        suggestedRuntimeProfileKey,
        ownerGuardrailUserId:
          utilization.blockedByOwnerCount > 0 ? utilization.busiestBlockedOwnerUserId : null,
        pressureLevel: utilization.pressureLevel,
        schedulingDecisionClass: utilization.schedulingDecisionClass,
      };
    }
    return {
      severity: "warning",
      title: `${args.runtimeProfileLabel} 当前存在 queue backlog`,
      detail: `${utilization.pressureDetail} 当前仍有 ${slots ?? "若干"} 个剩余槽位，但已经堆积 ${queued} 个排队 execution。${guardrailDetail}${
        suggestedRuntimeProfileKey
          ? ` 如果只是做一次常规执行，优先考虑 ${suggestedRuntimeProfileKey}。`
          : " 建议先观察 cost/runtime 面板，确认是否继续加压。"
      }`,
      actionLabel: utilization.blockedQueuedExecutionCount > 0 ? "查看 Execution Backlog" : "查看 Cost Overview",
      actionKind: utilization.blockedQueuedExecutionCount > 0 ? "inspect_execution_backlog" : "review_cost_overview",
      suggestedRuntimeProfileKey,
      ownerGuardrailUserId:
        utilization.blockedByOwnerCount > 0 ? utilization.busiestBlockedOwnerUserId : null,
      pressureLevel: utilization.pressureLevel,
      schedulingDecisionClass: utilization.schedulingDecisionClass,
    };
  }

  if (utilization.pressureLevel === "watch") {
    return {
      severity: "warning",
      title: `${args.runtimeProfileLabel} 接近运行上限`,
      detail: `${utilization.pressureDetail}${guardrailDetail} 当前有 ${running} 个运行中 execution，建议先确认这一轮是否真的需要继续使用当前 profile。`,
      actionLabel: "查看 Cost Overview",
      actionKind: "review_cost_overview",
      suggestedRuntimeProfileKey,
      ownerGuardrailUserId:
        utilization.blockedByOwnerCount > 0 ? utilization.busiestBlockedOwnerUserId : null,
      pressureLevel: utilization.pressureLevel,
      schedulingDecisionClass: utilization.schedulingDecisionClass,
    };
  }

  return {
    severity: "info",
    title: `${args.runtimeProfileLabel} 当前容量健康`,
    detail: `${utilization.pressureDetail}${guardrailDetail} 当前运行中 ${running} 个 execution，排队 ${queued} 个，可直接按当前模板继续创建 execution。`,
    actionLabel: "继续创建 Execution",
    actionKind: "launch_now",
    suggestedRuntimeProfileKey: null,
    ownerGuardrailUserId: null,
    pressureLevel: utilization.pressureLevel,
    schedulingDecisionClass: utilization.schedulingDecisionClass,
  };
}

export function buildAgentExecutionRuntimePressurePlaybook(args: {
  runtimeProfileLabel: string;
  guidance: AgentExecutionRuntimePressureGuidanceView | null;
  hasCallbackFollowUp?: boolean;
  utilization?: AgentExecutionRuntimeProfileUtilizationView | null;
  includeAlertDispatch?: boolean;
  matchedAlertLevel?: number | null;
  hasIncidentCoverage?: boolean;
  incidentCoverageCount?: number | null;
  activeIncidentCount?: number | null;
  acknowledgedIncidentCount?: number | null;
  silencedIncidentCount?: number | null;
}): AgentExecutionRuntimePlaybookStepView[] {
  const guidance = args.guidance;
  if (!guidance) {
    return [];
  }
  const blockedByProfileCount = args.utilization?.blockedByProfileCount ?? 0;
  const blockedByOwnerCount = args.utilization?.blockedByOwnerCount ?? 0;

  const callbackBacklogStep: AgentExecutionRuntimePlaybookStepView = {
    key: "inspect_callback_backlog",
    priority: "secondary",
    title: "看当前 profile 的 callback backlog",
    detail: "如果这条模板同时定义了 callback follow-up，直接检查同一 runtime profile 下的 callback backlog。",
  };

  const runtimeAlertDispatchStep: AgentExecutionRuntimePlaybookStepView | null =
    args.includeAlertDispatch &&
    !args.hasIncidentCoverage &&
    typeof args.matchedAlertLevel === "number" &&
    Number.isFinite(args.matchedAlertLevel) &&
    args.matchedAlertLevel >= 2
      ? {
          key: "emit_runtime_alerts",
          priority: "secondary",
          title: `补发 L${Math.max(2, Math.min(3, Math.floor(args.matchedAlertLevel)))} runtime alert`,
          detail: "当前 pressure slice 仍命中 runtime alert，但还没有 active paging incident 覆盖；建议先补发 operator mailbox / webhook 告警，再继续处理 backlog。",
        }
      : null;

  const acknowledgedIncidentCount =
    typeof args.acknowledgedIncidentCount === "number" && Number.isFinite(args.acknowledgedIncidentCount)
      ? Math.max(0, Math.floor(args.acknowledgedIncidentCount))
      : 0;
  const activeIncidentCount =
    typeof args.activeIncidentCount === "number" && Number.isFinite(args.activeIncidentCount)
      ? Math.max(0, Math.floor(args.activeIncidentCount))
      : 0;
  const silencedIncidentCount =
    typeof args.silencedIncidentCount === "number" && Number.isFinite(args.silencedIncidentCount)
      ? Math.max(0, Math.floor(args.silencedIncidentCount))
      : 0;

  const focusIncidentState = resolveAgentExecutionRuntimeIncidentFocusState({
    activeIncidentCount: args.activeIncidentCount,
    acknowledgedIncidentCount: args.acknowledgedIncidentCount,
    silencedIncidentCount: args.silencedIncidentCount,
  });
  const focusIncidentCount =
    focusIncidentState === "active"
      ? activeIncidentCount
      : focusIncidentState === "acknowledged"
        ? acknowledgedIncidentCount
        : focusIncidentState === "silenced"
          ? silencedIncidentCount
          : Math.max(
              1,
              Number.isFinite(args.incidentCoverageCount ?? 0) ? Math.floor(args.incidentCoverageCount ?? 0) : 0,
            );

  const runtimeIncidentInspectionStep: AgentExecutionRuntimePlaybookStepView | null =
    args.hasIncidentCoverage &&
    typeof args.matchedAlertLevel === "number" &&
    Number.isFinite(args.matchedAlertLevel) &&
    args.matchedAlertLevel >= 2
      ? {
          key: "inspect_runtime_incidents",
          priority: "secondary",
          title:
            focusIncidentState === "active"
              ? `查看 ${focusIncidentCount} 条 active runtime incident`
              : focusIncidentState === "acknowledged"
                ? `继续观察 ${focusIncidentCount} 条 acknowledged runtime incident`
                : focusIncidentState === "silenced"
                  ? `查看 ${focusIncidentCount} 条 silenced runtime incident`
                  : `查看当前 pressure slice 的 runtime incidents`,
          detail:
            focusIncidentState === "acknowledged"
              ? `当前 pressure slice 已进入 acknowledged incident 覆盖；建议先回看这 ${focusIncidentCount} 条已确认 incident 是否仍在持续命中，再决定是否继续静默或回到 backlog。`
              : focusIncidentState === "silenced"
                ? `当前 pressure slice 已有 ${focusIncidentCount} 条 silenced runtime incident；建议先确认静默是否仍然合理，再决定是否解除静默或继续观察。`
                : `当前 pressure slice 已有 ${Math.max(
                    1,
                    Number.isFinite(args.incidentCoverageCount ?? 0) ? Math.floor(args.incidentCoverageCount ?? 0) : 0,
                  )} 条 paging incident 覆盖；建议先确认现有 incident 的治理状态，再决定是否继续补发 alert 或追加手动动作。`,
        }
      : null;

  const acknowledgeRuntimeIncidentsStep: AgentExecutionRuntimePlaybookStepView | null =
    args.hasIncidentCoverage &&
    typeof args.activeIncidentCount === "number" &&
    Number.isFinite(args.activeIncidentCount) &&
    args.activeIncidentCount > 0
      ? {
          key: "acknowledge_runtime_incidents",
          priority: "secondary",
          title: `确认 ${Math.floor(args.activeIncidentCount)} 条 active runtime incident`,
          detail: "当前 pressure slice 里已有 active runtime paging incident；如果这些告警已经被人工接管，可直接批量确认，避免同一热点继续保持未确认状态。",
        }
      : null;

  const silenceRuntimeIncidentsStep: AgentExecutionRuntimePlaybookStepView | null =
    args.hasIncidentCoverage &&
    (activeIncidentCount >= 2 || (activeIncidentCount === 0 && acknowledgedIncidentCount >= 2))
      ? {
          key: "silence_runtime_incidents",
          priority: "secondary",
          title:
            activeIncidentCount > 0
              ? `临时静默 ${activeIncidentCount} 条 active runtime incident`
              : `临时静默 ${acknowledgedIncidentCount} 条 acknowledged runtime incident`,
          detail:
            activeIncidentCount > 0
              ? "当前 pressure slice 已经堆积了多条 active runtime paging incident；如果 operator 已经接管处理，可先短时静默这一束重复外发，再继续回看 execution / session backlog。"
              : "当前 pressure slice 里的 runtime incidents 已被确认，但外部 paging 仍可能继续重复触发；可先短时静默这组 acknowledged incident，再继续观察 backlog 是否回落。",
        }
      : null;

  const clearRuntimeIncidentSilenceStep: AgentExecutionRuntimePlaybookStepView | null =
    args.hasIncidentCoverage &&
    typeof args.silencedIncidentCount === "number" &&
    Number.isFinite(args.silencedIncidentCount) &&
    args.silencedIncidentCount > 0
      ? {
          key: "clear_runtime_incident_silence",
          priority: "secondary",
          title: `检查并解除 ${Math.floor(args.silencedIncidentCount)} 条 silenced incident`,
          detail: "当前 pressure slice 里的 runtime paging incident 已被静默；如果热点仍在持续，建议先解除静默，再决定是否重新派发或继续 handoff。",
        }
      : null;

  const observeRuntimeIncidentsStep: AgentExecutionRuntimePlaybookStepView | null =
    focusIncidentState === "acknowledged"
      ? {
          key: "observe_runtime_incidents",
          priority: "secondary",
          title:
            acknowledgedIncidentCount >= 2
              ? `继续观察 ${acknowledgedIncidentCount} 条 acknowledged runtime incident`
              : "先保持当前 acknowledged incident 在观察态",
          detail:
            acknowledgedIncidentCount >= 2
              ? "这组 incident 已经被确认，但热点仍在持续；在决定静默或 handoff 之前，先回看 acknowledged slice 是否还在继续增长。"
              : "这组 incident 还没有堆积到需要静默的程度；优先保持观察态，确认 pressure/backlog 是否会自然回落。",
        }
      : null;

  const runtimeIncidentFollowUpTarget =
    focusIncidentState === "acknowledged" || focusIncidentState === "silenced"
      ? resolveAgentExecutionRuntimeIncidentFollowUpTarget({
          guidance,
          hasCallbackFollowUp: args.hasCallbackFollowUp,
          utilization: args.utilization,
        })
      : null;

  const runtimeIncidentFollowUpStep: AgentExecutionRuntimePlaybookStepView | null =
    runtimeIncidentFollowUpTarget
      ? {
          key: "inspect_runtime_incident_follow_up",
          priority: "secondary",
          followUpTarget: runtimeIncidentFollowUpTarget,
          title:
            runtimeIncidentFollowUpTarget === "runtime_sessions"
              ? "继续回看当前 hotspot 的 Runtime Sessions"
              : runtimeIncidentFollowUpTarget === "execution_backlog"
                ? "继续回看当前 hotspot 的 Execution Backlog"
                : runtimeIncidentFollowUpTarget === "callback_backlog"
                  ? "继续回看当前 profile 的 Callback Backlog"
                  : "继续回看当前 hotspot 的 Cost Overview",
          detail:
            runtimeIncidentFollowUpTarget === "runtime_sessions"
              ? "incident 已经进入治理态后，优先回看同一 runtime profile / owner slice 下的 running、stale、requeue 会话，确认并发热点是否仍未回落。"
              : runtimeIncidentFollowUpTarget === "execution_backlog"
                ? "incident 已经进入治理态后，优先回看同一 pressure slice 的 queued / blocked execution，确认 backlog 是否仍在持续增加。"
                : runtimeIncidentFollowUpTarget === "callback_backlog"
                  ? "当前 slice 没有明显的 execution/session 队列阻塞，但模板本身定义了 callback follow-up；可继续检查 callback backlog 是否也在同步恶化。"
                  : "当前 slice 更适合回到 cost/runtime 概览，确认热点是否已经自然回落，而不是继续追加人工动作。",
        }
      : null;

  const handoffRuntimeIncidentsStep: AgentExecutionRuntimePlaybookStepView | null =
    runtimeIncidentFollowUpTarget
      ? (() => {
          const handoffDisposition =
            resolveAgentExecutionRuntimeIncidentLifecycleDisposition({
              focusIncidentState,
              acknowledgedIncidentCount,
              silencedIncidentCount,
              matchedAlertLevel: args.matchedAlertLevel,
              followUpTarget: runtimeIncidentFollowUpTarget,
              guidance,
              utilization: args.utilization,
            }) ?? "handoff";
          return {
            key: "handoff_runtime_incidents",
            priority: "secondary",
            followUpTarget: runtimeIncidentFollowUpTarget,
            lifecycleDisposition: handoffDisposition,
          title:
            handoffDisposition === "escalate"
              ? runtimeIncidentFollowUpTarget === "runtime_sessions"
                ? "把当前 runtime hotspot 升级到 Runtime Sessions"
                : runtimeIncidentFollowUpTarget === "execution_backlog"
                  ? "把当前 runtime hotspot 升级到 Execution Backlog"
                  : runtimeIncidentFollowUpTarget === "callback_backlog"
                    ? "把当前 runtime hotspot 升级到 Callback Backlog"
                    : "把当前 runtime hotspot 升级到 Cost Overview"
              : runtimeIncidentFollowUpTarget === "runtime_sessions"
                ? "把当前 runtime hotspot 移交到 Runtime Sessions"
                : runtimeIncidentFollowUpTarget === "execution_backlog"
                  ? "把当前 runtime hotspot 移交到 Execution Backlog"
                : runtimeIncidentFollowUpTarget === "callback_backlog"
                    ? "把当前 runtime hotspot 移交到 Callback Backlog"
                    : "把当前 runtime hotspot 移交到 Cost Overview",
          detail:
            handoffDisposition === "escalate"
              ? runtimeIncidentFollowUpTarget === "runtime_sessions"
                ? "当前 incident 虽已进入 acknowledged / silenced 治理态，但 runtime hotspot 仍未回落；建议直接升级到同一 runtime profile / owner slice 的会话视角继续处理。"
                : runtimeIncidentFollowUpTarget === "execution_backlog"
                  ? "当前 incident 虽已进入治理态，但 queued / blocked execution 仍在持续累积；建议直接升级到同一 pressure slice 的 backlog 视角。"
                  : runtimeIncidentFollowUpTarget === "callback_backlog"
                    ? "当前 runtime hotspot 已经外溢到 callback backlog；建议直接升级到同一 preset/profile 的 callback remediation slice。"
                    : "当前热点在 incident 治理后仍未稳定；建议直接升级到 cost/runtime 概览，继续判断是否需要额外人工动作。"
              : runtimeIncidentFollowUpTarget === "runtime_sessions"
                ? "当 incident 已经进入 acknowledged / silenced 治理态，优先把 operator 语境移交到同一 runtime profile / owner slice 的运行会话。"
                : runtimeIncidentFollowUpTarget === "execution_backlog"
                  ? "当 incident 已经进入 acknowledged / silenced 治理态，优先把 operator 语境移交到同一 pressure slice 的 queued / blocked execution。"
                : runtimeIncidentFollowUpTarget === "callback_backlog"
                    ? "当 runtime hotspot 还伴随 callback follow-up 时，直接把 operator 语境移交到同一 preset/profile 的 callback remediation backlog。"
                    : "当没有明显的 session/backlog 阻塞时，把 operator 语境移交到 cost/runtime 概览，继续观察热点是否自行回落。",
          } satisfies AgentExecutionRuntimePlaybookStepView;
        })()
      : null;

  const withOperationalFollowUpSteps = (
    steps: AgentExecutionRuntimePlaybookStepView[],
  ): AgentExecutionRuntimePlaybookStepView[] =>
    {
      const leadingLifecycleSteps =
        focusIncidentState === "acknowledged"
          ? [
              withRuntimePlaybookStepPriority(runtimeIncidentInspectionStep, "primary"),
              ...(acknowledgedIncidentCount < 2 ? [observeRuntimeIncidentsStep] : []),
              handoffRuntimeIncidentsStep,
            ]
          : focusIncidentState === "silenced"
            ? [
                withRuntimePlaybookStepPriority(clearRuntimeIncidentSilenceStep, "primary"),
                runtimeIncidentInspectionStep,
                handoffRuntimeIncidentsStep,
              ]
            : [];

      const trailingLifecycleSteps =
        focusIncidentState === "acknowledged"
          ? [runtimeIncidentFollowUpStep, silenceRuntimeIncidentsStep, acknowledgeRuntimeIncidentsStep, clearRuntimeIncidentSilenceStep]
          : focusIncidentState === "silenced"
            ? [runtimeIncidentFollowUpStep, acknowledgeRuntimeIncidentsStep, silenceRuntimeIncidentsStep]
            : [runtimeIncidentInspectionStep, acknowledgeRuntimeIncidentsStep, silenceRuntimeIncidentsStep, clearRuntimeIncidentSilenceStep];

      const ordered = [
        ...leadingLifecycleSteps,
        ...steps,
        ...trailingLifecycleSteps,
        runtimeAlertDispatchStep,
        ...(args.hasCallbackFollowUp ? [callbackBacklogStep] : []),
      ].filter((step): step is AgentExecutionRuntimePlaybookStepView => Boolean(step));

      return ordered.filter((step, index, collection) => collection.findIndex((item) => item.key === step.key) === index);
    };

  if (guidance.schedulingDecisionClass === "profile_and_owner_saturated") {
    return withOperationalFollowUpSteps([
      guidance.suggestedRuntimeProfileKey
        ? {
            key: "adjust_launch_preset",
            priority: "primary",
            title: `先把模板切到 ${guidance.suggestedRuntimeProfileKey}`,
            detail: `${args.runtimeProfileLabel} 当前同时命中 profile saturation 和 owner hotspot，先降低 profile 强度，再观察 backlog 是否回落。`,
          }
        : {
            key: "inspect_execution_backlog",
            priority: "primary",
            title: "先检查 queued backlog",
            detail: "当前没有更轻量的 fallback profile，优先确认哪些 queued execution 已经被 quota 挡住。",
          },
      {
        key: "inspect_execution_backlog",
        priority: "secondary",
        title: "看当前 profile 的 execution backlog",
        detail:
          blockedByOwnerCount > 0
            ? "优先确认 blocked-by-owner 的 queued execution 是否正在持续增加。"
            : "检查同一 runtime profile 下的 queued execution 是否已经完全打满 profile cap。",
      },
      {
        key: "inspect_runtime_sessions",
        priority: "secondary",
        title: "再看当前 profile 的运行会话",
        detail: "按当前 runtime profile 查看 stale recovery、owner requeue 和 platform executor 会话是否堆积。",
      },
    ]);
  }

  if (guidance.schedulingDecisionClass === "profile_saturated") {
    return withOperationalFollowUpSteps([
      guidance.suggestedRuntimeProfileKey
        ? {
            key: "adjust_launch_preset",
            priority: "primary",
            title: `先回退到 ${guidance.suggestedRuntimeProfileKey}`,
            detail: `${args.runtimeProfileLabel} 已到 profile 并发上限，若不是必须使用当前 profile，优先回退模板。`,
          }
        : {
            key: "inspect_runtime_sessions",
            priority: "primary",
            title: "先看 Runtime Sessions",
            detail: "当前 profile 已打满，先确认是不是已有运行会话长期占着槽位。",
          },
      {
        key: "inspect_execution_backlog",
        priority: "secondary",
        title: blockedByProfileCount > 0 ? "看被 profile cap 卡住的 backlog" : "看当前 profile 的 running backlog",
        detail:
          blockedByProfileCount > 0
            ? "直接看同一 runtime profile 下的 queued execution，确认哪些已经被 profile cap 挡住。"
            : "直接看同一 runtime profile 下的 execution backlog，而不是在全量 execution 列表里手动筛。",
      },
      {
        key: "inspect_cost_overview",
        priority: "secondary",
        title: "看当前 profile 的压力卡片",
        detail: "结合 pressureLevel / schedulingDecisionClass 和 busiest owner，判断是否只是瞬时饱和。",
      },
    ]);
  }

  if (guidance.schedulingDecisionClass === "owner_hotspot") {
    if (blockedByOwnerCount > 0) {
      return withOperationalFollowUpSteps([
        {
          key: "inspect_execution_backlog",
          priority: "primary",
          title: "先看被 owner quota 挡住的 backlog",
          detail: "按当前 runtime profile 只看 queued execution，优先确认 blocked-by-owner 的队列是否正在扩大。",
        },
        {
          key: "inspect_runtime_sessions",
          priority: "secondary",
          title: "再看 Runtime Sessions",
          detail: "确认是否有长时间 running / failed / requeued 的会话占着当前 owner 的并发。",
        },
        {
          key: "inspect_cost_overview",
          priority: "secondary",
          title: "最后回看 owner quota guardrail",
          detail: "结合 pressure card 里的 blocked owner / claimable vs blocked，判断是延后继续直启还是先释放占用。",
        },
      ]);
    }
    return withOperationalFollowUpSteps([
      {
        key: "inspect_runtime_sessions",
        priority: "primary",
        title: "先看 Runtime Sessions",
        detail: "当前更像 owner-level hotspot，先确认是否有长时间 running / failed / requeued 的运行会话占着并发。",
      },
      {
        key: "inspect_execution_backlog",
        priority: "secondary",
        title: "再看 execution backlog",
        detail: "按当前 runtime profile 只看 running / queued execution，确认 hotspot 是否已经传导成 backlog。",
      },
      {
        key: "inspect_cost_overview",
        priority: "secondary",
        title: "最后回看压力与 owner 热点",
        detail: "结合 pressure card 中的 busiest owner 和 saturated owners，判断是否需要延后继续直启。",
      },
    ]);
  }

  if (guidance.schedulingDecisionClass === "queue_backlog") {
    if (blockedByProfileCount > 0 && guidance.suggestedRuntimeProfileKey) {
      return withOperationalFollowUpSteps([
        {
          key: "adjust_launch_preset",
          priority: "primary",
          title: `先切到 ${guidance.suggestedRuntimeProfileKey}`,
          detail: `${args.runtimeProfileLabel} 当前 backlog 已开始撞上 profile cap，先降一档再观察 queued queue 是否回落。`,
        },
        {
          key: "inspect_execution_backlog",
          priority: "secondary",
          title: "再看当前 profile 的 queued backlog",
          detail: "确认哪些 queued execution 已经被 profile cap 挡住，而不是仍可 claim 的短时排队。",
        },
        {
          key: "inspect_cost_overview",
          priority: "secondary",
          title: "回看 pressure slice",
          detail: "结合 claimable / blocked 与 available slots，判断当前 profile 是否还适合继续直启。",
        },
      ]);
    }
    return withOperationalFollowUpSteps([
      {
        key: "inspect_execution_backlog",
        priority: "primary",
        title: "先看 queued backlog",
        detail: "当前 profile 仍有可用槽位，但 queued execution 已开始堆积，先确认 backlog 是否集中在这一条模板。",
      },
      {
        key: "inspect_cost_overview",
        priority: "secondary",
        title: "回看压力卡片",
        detail: "结合当前 pressure slice 和 available slots，判断 backlog 是短时排队还是持续积累。",
      },
      guidance.suggestedRuntimeProfileKey
        ? {
            key: "adjust_launch_preset",
            priority: "secondary",
            title: `考虑回退到 ${guidance.suggestedRuntimeProfileKey}`,
            detail: "如果这只是常规执行，可优先切到更轻量 profile，降低后续排队压力。",
          }
        : {
            key: "launch_execution",
            priority: "secondary",
            title: "确认后继续创建",
            detail: "如果 backlog 仍在可接受范围内，可继续按当前模板创建 execution。",
          },
    ]);
  }

  if (guidance.pressureLevel === "watch") {
    return withOperationalFollowUpSteps([
      {
        key: "inspect_cost_overview",
        priority: "primary",
        title: "先看 pressure slice",
        detail: `${args.runtimeProfileLabel} 已接近运行上限，先确认这一轮是否真的需要继续使用当前 profile。`,
      },
      {
        key: "inspect_execution_backlog",
        priority: "secondary",
        title: "再看 execution backlog",
        detail: "检查当前 runtime profile 下是否已经出现 queued / running 积压。",
      },
      guidance.suggestedRuntimeProfileKey
        ? {
            key: "adjust_launch_preset",
            priority: "secondary",
            title: `必要时回退到 ${guidance.suggestedRuntimeProfileKey}`,
            detail: "如果当前执行不要求更重的 profile，可先切回轻量模板降低风险。",
          }
        : {
            key: "launch_execution",
            priority: "secondary",
            title: "确认后继续创建",
            detail: "若 pressure 仍可接受，可继续沿当前模板创建 execution。",
          },
    ]);
  }

  return withOperationalFollowUpSteps([
    {
      key: "launch_execution",
      priority: "primary",
      title: "继续创建 execution",
      detail: `${args.runtimeProfileLabel} 当前容量健康，可直接按当前模板继续发起 execution。`,
    },
    {
      key: "inspect_execution_backlog",
      priority: "secondary",
      title: "查看当前 profile 的 execution backlog",
      detail: "如果你想在直启前再确认一次，先看同一 runtime profile 下的 execution 列表即可。",
    },
  ]);
}
