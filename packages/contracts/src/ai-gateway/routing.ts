import type {
  GatewayBrowserExecutionStatus,
} from "./browser";

import type {
  GatewayExecutionMode,
  GatewayProtocolBridgeStrategy,
  GatewayProtocolFamily,
  GatewayProviderAccountStatus,
  GatewayProviderAdapter,
  GatewayProviderSourceView,
  GatewayRelayPipelineMode,
} from "./provider";

export const gatewayRequestStatuses = ["running", "completed", "failed", "cancelled"] as const;

export type GatewayRequestStatus = (typeof gatewayRequestStatuses)[number];

export const gatewayRouteSelectionStrategies = ["priority", "weighted_random"] as const;

export type GatewayRouteSelectionStrategy = (typeof gatewayRouteSelectionStrategies)[number];

export type GatewayRateLimitDefinition = {
  windowSeconds: number | null;
  maxRequests: number | null;
};

export const gatewayRateLimitHotspotAnomalyCodes = [
  "rate_limit_request_spike",
  "rate_limit_code_concentration",
  "rate_limit_project_hotspot",
  "rate_limit_api_key_hotspot",
  "rate_limit_model_hotspot",
  "rate_limit_endpoint_hotspot",
] as const;

export type GatewayRateLimitHotspotAnomalyCode = (typeof gatewayRateLimitHotspotAnomalyCodes)[number];

export const gatewayRateLimitHotspotAutoRemediationActionKeys = [
  "tighten-project-rate-limit",
  "tighten-api-key-rate-limit",
  "tighten-model-rate-limit",
  "tighten-endpoint-rate-limit",
] as const;

export type GatewayRateLimitHotspotAutoRemediationActionKey =
  (typeof gatewayRateLimitHotspotAutoRemediationActionKeys)[number];

export type GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile = {
  enabled: boolean;
  intervalMinutes: number | null;
  dryRunFirst: boolean;
  requireAlertBeforeApply: boolean;
  freezeOnProviderHealthDegrade: boolean;
  maxApplyRunsPerIncident: number | null;
  actionByCode: Partial<
    Record<GatewayRateLimitHotspotAnomalyCode, GatewayRateLimitHotspotAutoRemediationActionKey | null>
  > | null;
};

export const gatewayRoutingAnomalyAutoRemediationCodes = [
  "failure_rate_spike",
  "completion_rate_drop",
  "provider_routing_score_drop",
  "degraded_provider_route_spike",
  "saturated_provider_route_spike",
  "breaker_open_provider_route_detected",
] as const;

export type GatewayRoutingAnomalyAutoRemediationCode =
  (typeof gatewayRoutingAnomalyAutoRemediationCodes)[number];

export const gatewayRoutingAnomalyAutoRemediationActionKeys = [
  "disable-prestream-fallback",
  "reduce-provider-concurrency",
  "provider-isolation",
] as const;

export type GatewayRoutingAnomalyAutoRemediationActionKey =
  (typeof gatewayRoutingAnomalyAutoRemediationActionKeys)[number];

export type GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile = {
  enabled: boolean;
  intervalMinutes: number | null;
  dryRunFirst: boolean;
  requireAlertBeforeApply: boolean;
  freezeOnProviderHealthDegrade: boolean;
  maxApplyRunsPerIncident: number | null;
  actionKeysByCode: Partial<
    Record<GatewayRoutingAnomalyAutoRemediationCode, GatewayRoutingAnomalyAutoRemediationActionKey[] | null>
  > | null;
};

export type GatewayRoutePolicyConfig = {
  stickySessions: boolean;
  preStreamFallbackEnabled: boolean;
  selectionStrategy: GatewayRouteSelectionStrategy;
  providerLoadAwareRoutingEnabled: boolean;
  maxConcurrentRequests: number | null;
  providerMaxConcurrentRequests: number | null;
  rateLimitWindowSeconds: number | null;
  rateLimitMaxRequests: number | null;
  apiKeyRateLimit: GatewayRateLimitDefinition | null;
  modelRateLimits: Record<string, GatewayRateLimitDefinition> | null;
  endpointRateLimits: Record<string, GatewayRateLimitDefinition> | null;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownSeconds: number;
  allowedProviderAccountIds: string[] | null;
  allowedProtocolFamilies: GatewayProtocolFamily[] | null;
  allowedModelIds: string[] | null;
  blockedModelIds: string[] | null;
  maxRequestBodyBytes: number | null;
  streamIdleTimeoutSeconds: number | null;
  totalRequestTimeoutSeconds: number | null;
  maxStreamHeartbeatGapSeconds: number | null;
  routingAnomalyAutoRemediation: GatewayRoutePolicyRoutingAnomalyAutoRemediationProfile | null;
  rateLimitHotspotAutoRemediation: GatewayRoutePolicyRateLimitHotspotAutoRemediationProfile | null;
  fallbackHttpStatuses: number[] | null;
  fallbackErrorCodes: string[] | null;
};

export type GatewayRouteTraceCandidate = {
  providerAccountId: string;
  platformAccessId?: string | null;
  sourceAccessKeyId?: string | null;
  realCredentialRef?: string | null;
  providerLabel: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  sourceProfile: GatewayProviderSourceView;
  protocolBridgeStrategy?: GatewayProtocolBridgeStrategy | null;
  sameProtocolFastPathEligible?: boolean | null;
  resolvedExecutionMode: GatewayExecutionMode;
  modelAlias: string | null;
  resolvedModel: string | null;
  priority: number | null;
  weight: number | null;
  stickyPreferred: boolean;
  activeConcurrency?: number | null;
  failureCount?: number | null;
  breakerOpen?: boolean | null;
  routingScore?: number | null;
  healthWeight?: number | null;
  capacityWeight?: number | null;
  degraded?: boolean | null;
  degradationReasons?: string[] | null;
};

export type GatewayRequestRouteTrace = {
  requestedProtocolFamily: GatewayProtocolFamily | null;
  selectedUpstreamTargetProtocolFamily?: GatewayProtocolFamily | string | null;
  selectionStrategy: GatewayRouteSelectionStrategy;
  accessKeyId?: string | null;
  sourceAccessKeyId?: string | null;
  platformAccessId?: string | null;
  realCredentialRef?: string | null;
  stickyProviderAccountId: string | null;
  preStreamFallbackEnabled: boolean;
  projectConcurrencyLimit: number | null;
  providerConcurrencyLimit: number | null;
  routeAttempt: number;
  selectedPipelineMode: GatewayRelayPipelineMode | null;
  candidateQueue: GatewayRouteTraceCandidate[];
  selectedCandidate: GatewayRouteTraceCandidate;
  browserExecutionStatus?: GatewayBrowserExecutionStatus | null;
  executorNodeId?: string | null;
  executorSlotId?: string | null;
  executorLeaseId?: string | null;
  executorLeaseIssuedAt?: string | null;
  executorLeaseExpiresAt?: string | null;
  executorLeaseReleasedAt?: string | null;
  executorLeaseReleaseReason?: string | null;
  fallbackEligible: boolean | null;
  outcomeStatus: GatewayRequestStatus | null;
  upstreamStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type GatewayProviderRoutingScoreInput = {
  status: GatewayProviderAccountStatus;
  failureCount?: number | null;
  breakerOpen?: boolean | null;
  activeConcurrency?: number | null;
  providerConcurrencyLimit?: number | null;
};

export type GatewayProviderRoutingScoreView = {
  score: number;
  healthWeight: number;
  capacityWeight: number;
  degraded: boolean;
  saturated: boolean;
  degradationReasons: string[];
};

function roundGatewayProviderRoutingScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function resolveGatewayProviderStatusWeight(status: GatewayProviderAccountStatus) {
  switch (status) {
    case "active":
      return 1;
    case "cooling":
      return 0.45;
    case "disabled":
      return 0.15;
    case "archived":
      return 0.05;
    default:
      return 0.1;
  }
}

function resolveGatewayProviderFailureWeight(failureCount: number) {
  return Math.max(0.2, 1 - Math.min(8, Math.max(0, failureCount)) * 0.1);
}

function resolveGatewayProviderCapacityWeight(activeConcurrency: number, providerConcurrencyLimit: number | null | undefined) {
  if (!providerConcurrencyLimit || providerConcurrencyLimit <= 0) {
    return 1;
  }
  const safeLimit = Math.max(1, providerConcurrencyLimit);
  const safeActive = Math.max(0, activeConcurrency);
  if (safeActive >= safeLimit) {
    return 0;
  }
  return roundGatewayProviderRoutingScore((safeLimit - safeActive) / safeLimit);
}

export function buildGatewayProviderRoutingScore(
  input: GatewayProviderRoutingScoreInput,
): GatewayProviderRoutingScoreView {
  const failureCount = Math.max(0, input.failureCount ?? 0);
  const activeConcurrency = Math.max(0, input.activeConcurrency ?? 0);
  const breakerOpen = Boolean(input.breakerOpen);
  const statusWeight = resolveGatewayProviderStatusWeight(input.status);
  const failureWeight = resolveGatewayProviderFailureWeight(failureCount);
  const healthWeight = roundGatewayProviderRoutingScore(statusWeight * failureWeight);
  const capacityWeight = resolveGatewayProviderCapacityWeight(activeConcurrency, input.providerConcurrencyLimit ?? null);
  const saturated = capacityWeight <= 0;

  if (breakerOpen) {
    return {
      score: 0,
      healthWeight: 0,
      capacityWeight,
      degraded: true,
      saturated,
      degradationReasons: ["breaker_open"],
    };
  }

  const degradationReasons: string[] = [];
  if (input.status !== "active") {
    degradationReasons.push(`status_${input.status}`);
  }
  if (failureCount >= 3) {
    degradationReasons.push("failure_count_elevated");
  }
  if (saturated) {
    degradationReasons.push("concurrency_saturated");
  } else if (capacityWeight < 0.5) {
    degradationReasons.push("concurrency_pressure");
  }

  return {
    score: roundGatewayProviderRoutingScore(healthWeight * capacityWeight),
    healthWeight,
    capacityWeight,
    degraded: degradationReasons.length > 0,
    saturated,
    degradationReasons,
  };
}

export type GatewayRequestAnalysisProfile = {
  requestMessageCount: number;
  requestTextChars: number;
  requestImageCount: number;
  requestAttachmentCount: number;
  requestToolCount: number;
  requestHistoricalToolCallCount: number;
  hasSystemPrompt: boolean;
  hasReasoning: boolean;
  hasMetadata: boolean;
  hasExplicitSessionKey: boolean;
  hasPreviousResponse: boolean;
  stream: boolean;
  responseTextChars: number | null;
  responseToolCallCount: number | null;
  firstTokenLatencyMs: number | null;
  streamChunkCount: number | null;
  requestTextSha256: string | null;
  responseTextSha256: string | null;
};

export type GatewayModelAliasView = {
  id: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  alias: string;
  providerAccountId: string;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GatewayModelAliasScopeType = "global" | "provider_special";

export type GatewayRoutePolicyView = {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  enabled: boolean;
  config: GatewayRoutePolicyConfig;
  createdAt: string;
  updatedAt: string;
};

export type UpsertGatewayModelAliasInput = {
  projectId?: string | null;
  scopeType?: GatewayModelAliasScopeType;
  alias: string;
  providerAccountId: string;
  upstreamModel?: string | null;
  priority?: number;
  weight?: number;
  enabled?: boolean;
};

export type UpsertGatewayRoutePolicyInput = {
  projectId: string;
  name: string;
  isDefault?: boolean;
  enabled?: boolean;
  config: GatewayRoutePolicyConfig;
};
