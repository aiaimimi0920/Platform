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
  return policy.label || formatAgentCallbackPolicyKeyLabel(policy.key);
}

export function formatAgentCallbackPolicyKeyLabel(policyKey: AgentCallbackRemediationPolicyKey) {
  switch (policyKey) {
    case "manual_only":
      return "人工确认";
    case "safe_retry":
      return "安全重试";
    case "balanced":
      return "均衡补救";
    case "aggressive":
      return "强化补救";
    default:
      return policyKey;
  }
}

function formatReplayFallbackProfileKey(value: AgentCallbackRemediationPolicyView["fallbackRetryRequestReplayFailureProfileKey"]) {
  switch (value) {
    case "none":
      return "不启用";
    case "safe_structural":
      return "安全结构型";
    case "extended_structural":
      return "扩展结构型";
    case "custom":
      return "自定义";
    default:
      return value;
  }
}

function formatReplayCompatibilityPolicyKey(value: AgentCallbackRemediationPolicyView["replayCompatibilityPolicyKey"]) {
  switch (value) {
    case "current_only":
      return "仅当前版本";
    case "allow_legacy_payload":
      return "允许旧版负载";
    case "allow_compat_window":
      return "允许兼容窗口";
    default:
      return value;
  }
}

function formatReplayPayloadCompatibility(value: AgentCallbackRemediationPolicyView["allowedReplayPayloadCompatibilities"][number]) {
  switch (value) {
    case "current":
      return "当前版本";
    case "legacy_normalized":
      return "旧版规范化负载";
    default:
      return value;
  }
}

function formatReplayFailureClass(
  failureClass: AgentExecutionCallbackReplayFailureClass,
) {
  switch (failureClass) {
    case "stored_payload_unavailable":
      return "缺少留存负载";
    case "callback_secret_unavailable":
      return "缺少回调密钥";
    case "duplicate_replay_cooldown":
      return "重复重放冷却中";
    case "agent_disabled":
      return "Agent 已停用";
    case "callback_not_retryable":
      return "回调不可重试";
    case "unsupported_target":
      return "目标不支持";
    case "callback_protocol_mismatch":
      return "协议版本不匹配";
    default:
      return failureClass;
  }
}

export function formatAgentCallbackReplayFallbackProfile(policy: AgentCallbackRemediationPolicyView) {
  return `画像：${formatReplayFallbackProfileKey(policy.fallbackRetryRequestReplayFailureProfileKey)} / ${
    policy.fallbackRetryRequestReplayFailureClasses.length > 0
      ? policy.fallbackRetryRequestReplayFailureClasses.map(formatReplayFailureClass).join("、")
      : "无自动聚焦"
  }`;
}

export function formatAgentCallbackReplayCompatibilityPolicy(policy: AgentCallbackRemediationPolicyView) {
  const compatibilities = policy.allowedReplayPayloadCompatibilities.map(formatReplayPayloadCompatibility).join("、") || "仅当前版本";
  const windowRules = [
    `旧协议窗口：${policy.allowReplayFromPreviousProtocolWindow ? "开启" : "关闭"}`,
    `旧密钥窗口：${policy.allowReplayFromPreviousSecretWindow ? "开启" : "关闭"}`,
  ].join(" / ");
  return `兼容策略：${formatReplayCompatibilityPolicyKey(policy.replayCompatibilityPolicyKey)} / 负载：${compatibilities} / ${windowRules}`;
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
      title: `建议临时切到${formatAgentCallbackPolicyKeyLabel("aggressive")}`,
      detail: `最近窗口内仍有 ${compatibilityHits} 次旧协议/旧密钥命中。若外部回调正在经历协议或密钥切换，建议短期切到${formatAgentCallbackPolicyKeyLabel("aggressive")}，让版本失配导致的回调被拒绝也进入自动补救。`,
      tone: compatibilityHits >= 4 ? "danger" : "warning",
    };
  }

  if (summary.rejectedCallbacks >= 2 && currentPolicyKey === "manual_only") {
    return {
      recommendedPolicyKey: "balanced",
      title: `建议从${formatAgentCallbackPolicyKeyLabel("manual_only")}切到${formatAgentCallbackPolicyKeyLabel("balanced")}`,
      detail: `最近窗口内已有 ${summary.rejectedCallbacks} 次回调被拒绝。继续只做人工处理会放大待处理队列，先切到${formatAgentCallbackPolicyKeyLabel("balanced")}更适合当前基线。`,
      tone: summary.rejectedCallbacks >= 4 ? "danger" : "warning",
    };
  }

  if (summary.rejectedCallbacks >= 3 && compatibilityHits === 0 && currentPolicyKey === "safe_retry") {
    return {
      recommendedPolicyKey: "balanced",
      title: `建议从${formatAgentCallbackPolicyKeyLabel("safe_retry")}提升到${formatAgentCallbackPolicyKeyLabel("balanced")}`,
      detail: `最近窗口内回调被拒绝已达到 ${summary.rejectedCallbacks} 次，但当前没有明显的旧版本命中；切到${formatAgentCallbackPolicyKeyLabel("balanced")}可以把时钟偏移型拒绝一并纳入自动补救。`,
      tone: "warning",
    };
  }

  if (duplicateRate >= 0.35 && compatibilityHits === 0 && currentPolicyKey === "aggressive") {
    return {
      recommendedPolicyKey: "safe_retry",
      title: `建议从${formatAgentCallbackPolicyKeyLabel("aggressive")}收回到${formatAgentCallbackPolicyKeyLabel("safe_retry")}`,
      detail: `重复回调占比约 ${Math.round(duplicateRate * 100)}%，但当前没有旧版本命中。先切回${formatAgentCallbackPolicyKeyLabel("safe_retry")}，更适合把自动补救限制在幂等冲突型场景。`,
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
      title: `建议从${formatAgentCallbackPolicyKeyLabel("aggressive")}收回到${formatAgentCallbackPolicyKeyLabel("balanced")}`,
      detail: `最近窗口内没有明显回调被拒绝，也没有旧协议/旧密钥命中。继续保留${formatAgentCallbackPolicyKeyLabel("aggressive")}的收益不高，回到${formatAgentCallbackPolicyKeyLabel("balanced")}更稳妥。`,
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
        : `${baseRecommendation.title}（本次执行覆盖）`,
      detail: shouldClearOverride
        ? `${baseRecommendation.detail} 由于 Agent 默认策略已经是${formatAgentCallbackPolicyKeyLabel(agentDefaultPolicyKey)}，当前执行不必继续保留显式覆盖。`
        : `${baseRecommendation.detail} 这条建议只针对当前执行，不会影响同一个 Agent 的其他执行会话。`,
      tone: baseRecommendation.tone,
      actionLabel: shouldClearOverride
        ? "恢复继承 Agent 默认"
        : `仅本次执行切到${formatAgentCallbackPolicyKeyLabel(baseRecommendation.recommendedPolicyKey)}`,
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
      title: "当前覆盖与 Agent 默认重复",
      detail: `这条执行当前显式覆盖到了${formatAgentCallbackPolicyKeyLabel(execution.callbackRemediationPolicyOverrideKey)}，但关联 Agent 默认已经是同一策略。清空覆盖可以减少后续策略漂移。`,
      tone: "cyan",
      actionLabel: "清空重复覆盖",
    };
  }

  return null;
}
