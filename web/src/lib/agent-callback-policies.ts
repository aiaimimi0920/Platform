import {
  agentCallbackRemediationPolicyKeys,
  type AgentCallbackHealthSummaryView,
  type AgentCallbackRemediationPolicyKey,
  type AgentCallbackRemediationPolicyView,
  type AgentExecutionCallbackReplayFailureClass,
} from "@neuro/contracts";

type AgentCallbackPolicyCarrier = {
  sourceType: "platform" | "external";
  externalCallbackRemediationPolicyKey?: AgentCallbackRemediationPolicyKey | null;
  externalCallbackRemediationPolicy?: AgentCallbackRemediationPolicyView | null;
};

type AgentExecutionCallbackPolicyCarrier = {
  agentSourceType: "platform" | "external";
  callbackRemediationPolicyKey: AgentCallbackRemediationPolicyKey;
  callbackRemediationPolicySource: "agent" | "execution";
  callbackRemediationPolicyOverrideKey?: AgentCallbackRemediationPolicyKey | null;
};

export type AgentCallbackPolicyRecommendationTone = "danger" | "warning" | "cyan";

export type AgentCallbackPolicyRecommendation = {
  recommendedPolicyKey: AgentCallbackRemediationPolicyKey;
  title: string;
  detail: string;
  tone: AgentCallbackPolicyRecommendationTone;
};

export type AgentExecutionCallbackPolicyRecommendation = {
  recommendedPolicyKey: AgentCallbackRemediationPolicyKey | null;
  title: string;
  detail: string;
  tone: AgentCallbackPolicyRecommendationTone;
  actionLabel: string;
};

export function mergeAgentCallbackPolicyCatalog(
  catalog: AgentCallbackRemediationPolicyView[],
  fallbackPolicies: Array<AgentCallbackRemediationPolicyView | null | undefined>,
): AgentCallbackRemediationPolicyView[] {
  const byKey = new Map<AgentCallbackRemediationPolicyKey, AgentCallbackRemediationPolicyView>();
  for (const policy of catalog) {
    byKey.set(policy.key, policy);
  }
  for (const policy of fallbackPolicies) {
    if (policy && !byKey.has(policy.key)) {
      byKey.set(policy.key, policy);
    }
  }
  return agentCallbackRemediationPolicyKeys
    .map((key) => byKey.get(key) ?? null)
    .filter((policy): policy is AgentCallbackRemediationPolicyView => policy !== null);
}

export function formatAgentCallbackPolicyLabel(policy: AgentCallbackRemediationPolicyView) {
  return `${policy.label} (${policy.key})`;
}

function formatReplayFallbackFailureClass(
  failureClass: AgentExecutionCallbackReplayFailureClass,
) {
  switch (failureClass) {
    case "stored_payload_unavailable":
      return "stored payload missing";
    case "callback_secret_unavailable":
      return "callback secret missing";
    case "duplicate_replay_cooldown":
      return "duplicate replay cooldown";
    default:
      return failureClass;
  }
}

export function formatAgentCallbackReplayFallbackProfile(policy: AgentCallbackRemediationPolicyView) {
  return `${policy.fallbackRetryRequestReplayFailureProfileKey} / ${
    policy.fallbackRetryRequestReplayFailureClasses.length > 0
      ? policy.fallbackRetryRequestReplayFailureClasses.map(formatReplayFallbackFailureClass).join(", ")
      : "none"
  }`;
}

export function formatAgentCallbackReplayCompatibilityPolicy(policy: AgentCallbackRemediationPolicyView) {
  const compatibilities = policy.allowedReplayPayloadCompatibilities.join(", ") || "none";
  const windowRules = [
    policy.allowReplayFromPreviousProtocolWindow ? "prev protocol on" : "prev protocol off",
    policy.allowReplayFromPreviousSecretWindow ? "prev secret on" : "prev secret off",
  ].join(" / ");
  return `${policy.replayCompatibilityPolicyKey} / ${compatibilities} / ${windowRules}`;
}

export function buildAgentCallbackPolicyRecommendation(
  agent: AgentCallbackPolicyCarrier,
  summary: AgentCallbackHealthSummaryView | null | undefined,
): AgentCallbackPolicyRecommendation | null {
  if (agent.sourceType !== "external" || !summary || summary.totalCallbacks === 0) {
    return null;
  }

  const currentPolicyKey = agent.externalCallbackRemediationPolicyKey ?? "balanced";
  const duplicateRate = summary.totalCallbacks > 0 ? summary.duplicateCallbacks / summary.totalCallbacks : 0;
  const compatibilityHits = summary.previousProtocolHits + summary.previousSecretHits;

  if (compatibilityHits >= 2 && currentPolicyKey !== "aggressive") {
    return {
      recommendedPolicyKey: "aggressive",
      title: "建议临时提升为 aggressive",
      detail: `最近窗口内仍有 ${compatibilityHits} 次旧协议/旧密钥命中。若 external callback 正在经历协议或 secret 切换，建议短期切到 aggressive，让版本失配型 rejected callback 也进入自动补救。`,
      tone: compatibilityHits >= 4 ? "danger" : "warning",
    };
  }

  if (summary.rejectedCallbacks >= 2 && currentPolicyKey === "manual_only") {
    return {
      recommendedPolicyKey: "balanced",
      title: "建议从 manual_only 升到 balanced",
      detail: `最近窗口内已有 ${summary.rejectedCallbacks} 次 rejected callback。继续只做人工处理会放大 operator backlog，先切到 balanced 更适合当前基线。`,
      tone: summary.rejectedCallbacks >= 4 ? "danger" : "warning",
    };
  }

  if (summary.rejectedCallbacks >= 3 && compatibilityHits === 0 && currentPolicyKey === "safe_retry") {
    return {
      recommendedPolicyKey: "balanced",
      title: "建议从 safe_retry 提升到 balanced",
      detail: `最近窗口内 rejected callback 已达到 ${summary.rejectedCallbacks} 次，但当前没有明显的旧版本命中；切到 balanced 可以把时钟偏移型拒绝一并纳入自动补救。`,
      tone: "warning",
    };
  }

  if (duplicateRate >= 0.35 && compatibilityHits === 0 && currentPolicyKey === "aggressive") {
    return {
      recommendedPolicyKey: "safe_retry",
      title: "建议从 aggressive 收回到 safe_retry",
      detail: `duplicate callback 占比约 ${Math.round(duplicateRate * 100)}%，但当前没有旧版本命中。先切回 safe_retry，更适合把自动补救限制在幂等冲突型场景。`,
      tone: "warning",
    };
  }

  if (
    summary.rejectedCallbacks === 0 &&
    compatibilityHits === 0 &&
    duplicateRate < 0.1 &&
    currentPolicyKey === "aggressive"
  ) {
    return {
      recommendedPolicyKey: "balanced",
      title: "建议从 aggressive 收回到 balanced",
      detail: "最近窗口内没有明显 rejected callback，也没有旧协议/旧密钥命中。继续保留 aggressive 的收益不高，回到 balanced 更稳妥。",
      tone: "cyan",
    };
  }

  return null;
}

export function buildExecutionCallbackPolicyRecommendation(
  execution: AgentExecutionCallbackPolicyCarrier,
  summary: AgentCallbackHealthSummaryView | null | undefined,
  agentDefaultPolicyKey?: AgentCallbackRemediationPolicyKey | null,
): AgentExecutionCallbackPolicyRecommendation | null {
  if (execution.agentSourceType !== "external") {
    return null;
  }

  const baseRecommendation = buildAgentCallbackPolicyRecommendation(
    {
      sourceType: execution.agentSourceType,
      externalCallbackRemediationPolicyKey: execution.callbackRemediationPolicyKey,
    },
    summary,
  );

  if (baseRecommendation) {
    const shouldClearOverride =
      execution.callbackRemediationPolicySource === "execution" &&
      Boolean(agentDefaultPolicyKey) &&
      agentDefaultPolicyKey === baseRecommendation.recommendedPolicyKey;
    return {
      recommendedPolicyKey: shouldClearOverride ? null : baseRecommendation.recommendedPolicyKey,
      title: shouldClearOverride
        ? `${baseRecommendation.title}，可直接恢复继承`
        : `${baseRecommendation.title}（execution override）`,
      detail: shouldClearOverride
        ? `${baseRecommendation.detail} 由于 Agent 默认策略已经是 ${agentDefaultPolicyKey}，当前 execution 不必继续保留显式 override。`
        : `${baseRecommendation.detail} 这条 recommendation 只针对当前 execution，不会影响同一个 Agent 的其他执行会话。`,
      tone: baseRecommendation.tone,
      actionLabel: shouldClearOverride ? "恢复继承 Agent 默认" : `仅本次 execution 切到 ${baseRecommendation.recommendedPolicyKey}`,
    };
  }

  if (
    execution.callbackRemediationPolicySource === "execution" &&
    execution.callbackRemediationPolicyOverrideKey &&
    agentDefaultPolicyKey &&
    execution.callbackRemediationPolicyOverrideKey === agentDefaultPolicyKey
  ) {
    return {
      recommendedPolicyKey: null,
      title: "当前 override 与 Agent 默认重复",
      detail: `这条 execution 当前显式覆盖到了 ${execution.callbackRemediationPolicyOverrideKey}，但 linked Agent 默认已经是同一策略。清空 override 可以减少后续策略漂移。`,
      tone: "cyan",
      actionLabel: "清空重复 override",
    };
  }

  return null;
}
