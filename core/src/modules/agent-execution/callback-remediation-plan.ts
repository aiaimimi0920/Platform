import type {
  AgentCallbackRemediationPolicyView,
  AgentExecutionCallbackAuditStatus,
  AgentExecutionCallbackAutoRemediationReasonCategory,
  AgentExecutionCallbackRemediationDecisionClass,
  AgentExecutionCallbackReplayFailureClass,
  AgentExecutionCallbackRemediationPlanView,
  AgentExecutionCallbackRejectionCategory,
  AgentExecutionCallbackRetryability,
  AgentSourceType,
} from "@neuro/contracts";

import type { StoredExternalCallbackReplayEnvelopeResolution } from "./callback-governance";

type BuildCallbackRemediationPlanArgs = {
  status: AgentExecutionCallbackAuditStatus;
  agentSourceType: AgentSourceType;
  agentEnabled: boolean;
  usedPreviousProtocol: boolean;
  usedPreviousSecret: boolean;
  retryability: AgentExecutionCallbackRetryability | null;
  rejectionCategory: AgentExecutionCallbackRejectionCategory | null;
  policy: AgentCallbackRemediationPolicyView;
  replayPayload: StoredExternalCallbackReplayEnvelopeResolution;
  autoRemediationAttempts: number;
};

const replayFallbackFailureClassPatterns: Record<AgentExecutionCallbackReplayFailureClass, string[]> = {
  stored_payload_unavailable: ["stored payload replay is unavailable"],
  callback_secret_unavailable: ["callback secret is unavailable for payload replay"],
  duplicate_replay_cooldown: ["callback payload replay was already recorded recently"],
  agent_disabled: ["external agent is disabled"],
  callback_not_retryable: ["only retryable rejected callbacks support stored payload replay"],
  unsupported_target: [
    "callback audit not found",
    "only rejected callback audits can replay stored payloads",
    "only external callback audits support stored payload replay",
  ],
  callback_protocol_mismatch: ["external callback protocol version does not match agent configuration"],
};

const broadlyFallbackEligibleReplayFailureClasses = new Set<AgentExecutionCallbackReplayFailureClass>([
  "stored_payload_unavailable",
  "callback_secret_unavailable",
  "duplicate_replay_cooldown",
]);

function buildSkipPlan(args: {
  trace: string[];
  decisionClass: AgentExecutionCallbackRemediationDecisionClass;
  reasonCategory: AgentExecutionCallbackAutoRemediationReasonCategory | null;
  reason: string;
}): AgentExecutionCallbackRemediationPlanView {
  return {
    primaryAction: "skip",
    fallbackAction: null,
    decisionClass: args.decisionClass,
    reasonCategory: args.reasonCategory,
    reason: args.reason,
    trace: [...args.trace, `decision: skip (${args.reason})`],
  };
}

export function buildCallbackRemediationPlan(
  args: BuildCallbackRemediationPlanArgs,
): AgentExecutionCallbackRemediationPlanView {
  const trace: string[] = [
    `status: ${args.status}`,
    `agent: ${args.agentSourceType}/${args.agentEnabled ? "enabled" : "disabled"}`,
    `policy: ${args.policy.key}`,
    `compatibility policy: ${args.policy.replayCompatibilityPolicyKey}`,
    `attempts: ${args.autoRemediationAttempts}/${Math.max(0, args.policy.maxAttempts)}`,
    `retryability: ${args.retryability ?? "none"}`,
    `rejection: ${args.rejectionCategory ?? "none"}`,
    `window match: protocol=${args.usedPreviousProtocol ? "previous" : "current"} secret=${
      args.usedPreviousSecret ? "previous" : "current"
    }`,
    `payload: ${
      args.replayPayload.stored
        ? `${args.replayPayload.compatibility ?? "stored"}${args.replayPayload.replayable ? "/replayable" : "/blocked"}`
        : "missing"
    }`,
  ];

  if (args.status !== "rejected") {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_target_unavailable",
      reasonCategory: "target_unavailable",
      reason: "Only rejected callback audits are eligible for remediation choreography.",
    });
  }

  if (args.agentSourceType !== "external") {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_target_unavailable",
      reasonCategory: "target_unavailable",
      reason: "Only external callback audits participate in remediation choreography.",
    });
  }

  if (!args.agentEnabled) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_target_unavailable",
      reasonCategory: "target_unavailable",
      reason: "External agent is disabled, so replay and retry request are both blocked.",
    });
  }

  if (args.retryability !== "retryable") {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_target_unavailable",
      reasonCategory: "target_unavailable",
      reason: "Only retryable rejected callbacks are eligible for replay choreography.",
    });
  }

  if (!args.policy.autoRemediationEnabled) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_policy_disabled",
      reasonCategory: "policy_disabled",
      reason: `The effective callback remediation policy '${args.policy.key}' disables automatic remediation.`,
    });
  }

  if (!args.rejectionCategory) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_missing_rejection_category",
      reasonCategory: "missing_rejection_category",
      reason: "Callback rejection category is unavailable, so no replay path can be planned.",
    });
  }

  const maxAttempts = Math.max(0, args.policy.maxAttempts);
  if (maxAttempts <= 0 || args.autoRemediationAttempts >= maxAttempts) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_policy_budget_exhausted",
      reasonCategory: "policy_budget_exhausted",
      reason: `The effective callback remediation policy '${args.policy.key}' exhausted its retry budget.`,
    });
  }

  const replayAllowedByPolicy =
    args.policy.autoReplayStoredPayload && args.policy.allowedRejectionCategories.includes(args.rejectionCategory);
  const fallbackAllowedByPolicy =
    args.policy.fallbackRetryRequestEnabled &&
    args.policy.fallbackRetryRequestCategories.includes(args.rejectionCategory);
  const payloadCompatibilityAllowed =
    args.replayPayload.compatibility === "current" || args.replayPayload.compatibility === "legacy_normalized"
      ? args.policy.allowedReplayPayloadCompatibilities.includes(args.replayPayload.compatibility)
      : false;
  const previousProtocolAllowed =
    !args.usedPreviousProtocol || args.policy.allowReplayFromPreviousProtocolWindow;
  const previousSecretAllowed = !args.usedPreviousSecret || args.policy.allowReplayFromPreviousSecretWindow;
  trace.push(
    `policy gates: replay=${replayAllowedByPolicy ? "allowed" : "blocked"} fallback=${
      fallbackAllowedByPolicy ? "allowed" : "blocked"
    }`,
  );
  trace.push(
    `compatibility gates: payload=${payloadCompatibilityAllowed ? "allowed" : "blocked"} previousProtocol=${
      previousProtocolAllowed ? "allowed" : "blocked"
    } previousSecret=${previousSecretAllowed ? "allowed" : "blocked"}`,
  );
  if (fallbackAllowedByPolicy) {
    trace.push(
      `fallback failure profile: ${args.policy.fallbackRetryRequestReplayFailureProfileKey} (${
        args.policy.fallbackRetryRequestReplayFailureClasses.join(", ") || "none"
      })`,
    );
  }

  if (
    replayAllowedByPolicy &&
    args.replayPayload.replayable &&
    payloadCompatibilityAllowed &&
    previousProtocolAllowed &&
    previousSecretAllowed
  ) {
    return {
      primaryAction: "replay_payload",
      fallbackAction: fallbackAllowedByPolicy ? "request_retry" : null,
      decisionClass:
        args.replayPayload.compatibility === "legacy_normalized"
          ? "replay_legacy_payload"
          : "replay_current_payload",
      reasonCategory: null,
      reason:
        args.replayPayload.compatibility === "legacy_normalized"
          ? "Stored payload will be normalized from legacy format and replayed."
          : "Stored payload is replayable and will be used as the primary remediation path.",
      trace: [
        ...trace,
        `decision: replay_payload`,
        fallbackAllowedByPolicy ? "fallback: request_retry" : "fallback: none",
      ],
    };
  }

  if (fallbackAllowedByPolicy) {
    const compatibilityReason =
      !payloadCompatibilityAllowed && args.replayPayload.compatibility
        ? `Stored payload compatibility '${args.replayPayload.compatibility}' is not enabled by the current replay compatibility policy.`
        : !previousProtocolAllowed || !previousSecretAllowed
          ? `Callback matched the previous ${
              !previousProtocolAllowed && !previousSecretAllowed
                ? "protocol and secret"
                : !previousProtocolAllowed
                  ? "protocol"
                  : "secret"
            } grace window, so the current policy prefers retry request over direct replay.`
          : null;
    return {
      primaryAction: "request_retry",
      fallbackAction: null,
      decisionClass:
        !args.replayPayload.stored
          ? "retry_missing_payload"
          : !args.replayPayload.replayable
            ? "retry_incompatible_payload"
            : compatibilityReason
              ? !payloadCompatibilityAllowed
                ? "retry_compatibility_policy"
                : "retry_compat_window"
              : "retry_policy_preferred",
      reasonCategory: null,
      reason:
        !args.replayPayload.stored
          ? "Stored payload is unavailable, so the plan falls back to a retry request."
          : !args.replayPayload.replayable
            ? "Stored payload is incompatible, so the plan falls back to a retry request."
            : compatibilityReason
              ? compatibilityReason
            : "The policy prefers a retry request for this rejection category.",
      trace: [...trace, "decision: request_retry", "fallback: none"],
    };
  }

  if (!args.replayPayload.stored) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_missing_payload",
      reasonCategory: "missing_payload",
      reason: "Stored payload replay is unavailable and retry request fallback is disabled.",
    });
  }

  if (!args.replayPayload.replayable) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_incompatible_payload",
      reasonCategory: "incompatible_payload",
      reason: "Stored payload replay is incompatible with the current replay envelope and retry request fallback is disabled.",
    });
  }

  if (!payloadCompatibilityAllowed) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_compatibility_policy",
      reasonCategory: "compatibility_policy_blocked",
      reason: `Stored payload compatibility '${args.replayPayload.compatibility ?? "unknown"}' is not enabled by the current replay compatibility policy.`,
    });
  }

  if (!previousProtocolAllowed || !previousSecretAllowed) {
    return buildSkipPlan({
      trace,
      decisionClass: "skip_compat_window",
      reasonCategory: "compat_window_blocked",
      reason: `Callback matched the previous ${
        !previousProtocolAllowed && !previousSecretAllowed
          ? "protocol and secret"
          : !previousProtocolAllowed
            ? "protocol"
            : "secret"
      } grace window, and the current replay compatibility policy blocks direct replay for that path.`,
    });
  }

  return buildSkipPlan({
    trace,
    decisionClass: "skip_policy_not_covered",
    reasonCategory: "policy_not_covered",
    reason: `The effective callback remediation policy '${args.policy.key}' does not cover rejection category '${args.rejectionCategory}'.`,
  });
}

export function shouldFallbackReplayFailureToRetryRequest(errorMessage: string | null | undefined) {
  const failureClass = classifyReplayFailureForRetryFallback(errorMessage);
  return failureClass ? broadlyFallbackEligibleReplayFailureClasses.has(failureClass) : false;
}

export function classifyReplayFailureForRetryFallback(
  errorMessage: string | null | undefined,
): AgentExecutionCallbackReplayFailureClass | null {
  const normalized = errorMessage?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  for (const [failureClass, patterns] of Object.entries(replayFallbackFailureClassPatterns) as Array<
    [AgentExecutionCallbackReplayFailureClass, string[]]
  >) {
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return failureClass;
    }
  }

  return null;
}

export function shouldFallbackReplayFailureToRetryRequestByPolicy(args: {
  policy: AgentCallbackRemediationPolicyView;
  errorMessage: string | null | undefined;
}) {
  const failureClass = classifyReplayFailureForRetryFallback(args.errorMessage);
  if (!failureClass) {
    return false;
  }
  return args.policy.fallbackRetryRequestReplayFailureClasses.includes(failureClass);
}
