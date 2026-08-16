import type {
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalySeverity,
  GatewayAnalysisMetricDistributionView,
} from "./analysis";

import type {
  GatewayApiKeyView,
  GatewayPlatformTier,
  GatewayProjectView,
  GatewayTenantView,
} from "./identity";

import type {
  GatewayProtocolFamily,
  GatewayProviderAccountStatus,
  GatewayProviderAccountView,
  GatewayProviderAdapter,
  GatewayProviderQuotaView,
  GatewayProviderSourceView,
} from "./provider";

import type {
  GatewayModelAliasScopeType,
  GatewayModelAliasView,
  GatewayRequestStatus,
  GatewayRoutePolicyView,
} from "./routing";

import type {
  GatewaySummaryBucket,
} from "./shared";

export type GatewayOperatorCatalogView = {
  tenants: GatewayTenantView[];
  projects: GatewayProjectView[];
  apiKeys: GatewayApiKeyView[];
  providerAccounts: GatewayProviderAccountView[];
  modelAliases: GatewayModelAliasView[];
  routePolicies: GatewayRoutePolicyView[];
};

export type GatewayProviderHealthView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  cooldownUntil: string | null;
  failureCount: number;
  lastError: string | null;
  lastHealthCheckAt: string | null;
  activeConcurrency: number;
  breakerOpen: boolean;
  routingScore: number;
  healthWeight: number;
  capacityWeight: number;
  degraded: boolean;
  saturated: boolean;
  degradationReasons: string[];
};

export type GatewayProviderHealthSummaryView = {
  totalProviders: number;
  activeProviders: number;
  coolingProviders: number;
  disabledProviders: number;
  breakerOpenProviders: number;
  degradedProviders: number;
  saturatedProviders: number;
  totalActiveConcurrency: number;
  avgRoutingScore: number | null;
};

export type GatewayPriceRateView = {
  promptMicrosPer1kTokens: number | null;
  completionMicrosPer1kTokens: number | null;
  currency: "USD";
  configured: boolean;
  source: "payload" | "model_pricing" | "default_registry" | "unconfigured";
};

export type GatewayProviderModelStaticPricingEntryView = {
  model: string;
  staticRate: GatewayPriceRateView;
};

export type GatewayProviderStaticPricingCoverageView = {
  totalModels: number;
  configuredModels: number;
  fullyConfigured: boolean;
  configuredEntries: GatewayProviderModelStaticPricingEntryView[];
  missingModels: string[];
};

export type GatewayProviderCostHintsView = {
  staticRate: GatewayPriceRateView;
  platformQuoteRate: GatewayPriceRateView;
  staticPricingCoverage: GatewayProviderStaticPricingCoverageView;
  observedRequestCount: number;
  observedFailureCount: number;
  recentRequestCount10m: number;
  recentFailureCount10m: number;
  observedPromptTokens: number;
  observedCompletionTokens: number;
  observedTotalTokens: number;
  observedCostMicros: number | null;
  observedCostSource: "configured_rate_estimate" | "unavailable";
  lastRequestAt: string | null;
};

export type GatewayProviderInventoryEntryView = {
  providerAccount: GatewayProviderAccountView;
  providerHealth: GatewayProviderHealthView | null;
  costHints: GatewayProviderCostHintsView;
  providerQuota: GatewayProviderQuotaView | null;
};

export type GatewayProviderModelTieringSource =
  | "upstream_models"
  | "configured_supported_models"
  | "capability_catalog"
  | "default_model"
  | "fixed_models";

export type GatewayProviderModelTieringCardView = {
  model: string;
  platformTier: GatewayPlatformTier;
  enabled: boolean;
  source: GatewayProviderModelTieringSource;
};

export type GatewayProviderModelTieringView = {
  providerAccountId: string;
  providerLabel: string;
  models: GatewayProviderModelTieringCardView[];
};

export type GatewayCatalogMetadataView = {
  providerAccountCount: number;
  modelAliasCount: number;
  routePolicyCount: number;
  fetchedProviderAccounts: number;
  fetchedModelAliases: number;
  fetchedRoutePolicies: number;
};

export type GatewayProviderInventorySummaryView = {
  totalProviders: number;
  totalProviderSurfaces: number;
  activeProviders: number;
  activeProviderSurfaces: number;
  degradedProviders: number;
  degradedProviderSurfaces: number;
  breakerOpenProviders: number;
  breakerOpenProviderSurfaces: number;
  totalActiveConcurrency: number;
  avgRoutingScore: number | null;
  configuredSourceProfiles: number;
  derivedSourceProfiles: number;
  providersWithObservedCost: number;
  providersWithPlatformQuote: number;
  providersWithQuota: number;
  warningQuotaProviders: number;
  exhaustedQuotaProviders: number;
  bySourceKind: GatewaySummaryBucket[];
  byProtocolFamily: GatewaySummaryBucket[];
  byAdapter: GatewaySummaryBucket[];
  catalogMetadata: GatewayCatalogMetadataView;
};

export type GatewayProviderInventoryView = {
  providers: GatewayProviderInventoryEntryView[];
  summary: GatewayProviderInventorySummaryView;
};

export type GatewayProviderRoutingAnalysisFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  status: GatewayRequestStatus | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
};

export type GatewayProviderRoutingAnalysisSummaryView = {
  totalSamples: number;
  selectedProviderSamples: number;
  degradedSelectedProviderSamples: number;
  saturatedSelectedProviderSamples: number;
  breakerOpenSelectedProviderSamples: number;
  routingScore: GatewayAnalysisMetricDistributionView;
  healthWeight: GatewayAnalysisMetricDistributionView;
  capacityWeight: GatewayAnalysisMetricDistributionView;
  bySelectedProvider: GatewaySummaryBucket[];
  byDegradationReason: GatewaySummaryBucket[];
};

export type GatewayProviderRoutingAnalysisAnomalyCode =
  | "provider_routing_score_drop"
  | "degraded_provider_route_spike"
  | "saturated_provider_route_spike"
  | "breaker_open_provider_route_detected";

export type GatewayProviderRoutingAnalysisAnomalyView = {
  code: GatewayProviderRoutingAnalysisAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayProviderRoutingAnalysisAnomalyThresholdConfig = {
  routingScoreWarningThreshold: number;
  routingScoreCriticalThreshold: number;
  degradedRouteWarningThreshold: number;
  degradedRouteCriticalThreshold: number;
  saturatedRouteWarningThreshold: number;
  saturatedRouteCriticalThreshold: number;
  breakerOpenRouteWarningThreshold: number;
  breakerOpenRouteCriticalThreshold: number;
};

export type GatewayProviderRoutingAnalysisAnomalyReportView = {
  generatedAt: string;
  filters: GatewayProviderRoutingAnalysisFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayProviderRoutingAnalysisAnomalyThresholdConfig;
  summary: GatewayProviderRoutingAnalysisSummaryView;
  anomalies: GatewayProviderRoutingAnalysisAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewayModelAssociationProviderLinkView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  sourceProfile: GatewayProviderSourceView;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
  defaultModel: string | null;
};

export type GatewayModelAssociationAliasRowView = {
  alias: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  upstreamModel: string | null;
  providerCount: number;
  enabledProviderCount: number;
  fallbackPriority: string;
  sourceKindDistribution: GatewaySummaryBucket[];
  providers: GatewayModelAssociationProviderLinkView[];
};

export type GatewayModelAssociationProviderAliasLinkView = {
  alias: string;
  projectId: string | null;
  scopeType: GatewayModelAliasScopeType;
  upstreamModel: string | null;
  priority: number;
  weight: number;
  enabled: boolean;
};

export type GatewayModelAssociationProviderRowView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter;
  protocolFamily: GatewayProtocolFamily;
  status: GatewayProviderAccountStatus;
  sourceProfile: GatewayProviderSourceView;
  defaultModel: string | null;
  supportedAliasCount: number;
  aliases: GatewayModelAssociationProviderAliasLinkView[];
};

export type GatewayModelAssociationMatrixView = {
  aliasRows: GatewayModelAssociationAliasRowView[];
  providerRows: GatewayModelAssociationProviderRowView[];
  summary: {
    totalAliases: number;
    totalProviders: number;
    totalLinks: number;
    bySourceKind: GatewaySummaryBucket[];
    byProtocolFamily: GatewaySummaryBucket[];
  };
};

export type GatewayCostProviderModelRowView = {
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  marketRate: GatewayPriceRateView;
  estimatedMarketCostMicros: number | null;
  lastRequestAt: string | null;
};

export type GatewayCostProviderBucketView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter | string;
  protocolFamily: GatewayProtocolFamily | string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
  pricedModelCount: number;
  unpricedModelCount: number;
  lastRequestAt: string | null;
  models: GatewayCostProviderModelRowView[];
};

export type GatewayCostModelProviderRowView = {
  providerAccountId: string;
  label: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  marketRate: GatewayPriceRateView;
  estimatedMarketCostMicros: number | null;
  lastRequestAt: string | null;
};

export type GatewayCostModelBucketView = {
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
  providerCount: number;
  pricedProviderCount: number;
  lastRequestAt: string | null;
  providers: GatewayCostModelProviderRowView[];
};

export type GatewayProviderPricingEditorModelRowView = {
  model: string;
  marketRate: GatewayPriceRateView;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cachedTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedMarketCostMicros: number | null;
};

export type GatewayProviderPricingEditorView = {
  providerAccountId: string;
  label: string;
  adapter: GatewayProviderAdapter | string;
  protocolFamily: GatewayProtocolFamily | string;
  modelCount: number;
  configuredModelCount: number;
  rows: GatewayProviderPricingEditorModelRowView[];
};

export type GatewayCostOverviewView = {
  summary: {
    providerCount: number;
    pricedProviderCount: number;
    unpricedProviderCount: number;
    modelCount: number;
    pricedModelCount: number;
    unpricedModelCount: number;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalThinkingTokens: number;
    totalCachedTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    estimatedMarketCostMicros: number | null;
  };
  providerBuckets: GatewayCostProviderBucketView[];
  modelBuckets: GatewayCostModelBucketView[];
  pricingEditors: GatewayProviderPricingEditorView[];
};

export type GatewayProjectPressureView = {
  projectId: string;
  displayName: string;
  activeConcurrency: number;
  runningRequestCount: number;
};

export type GatewayProviderPressureView = {
  providerAccountId: string;
  label: string;
  status: GatewayProviderAccountStatus;
  protocolFamily: GatewayProtocolFamily;
  activeConcurrency: number;
  runningRequestCount: number;
  breakerOpen: boolean;
};

export type GatewayRuntimePressureView = {
  totalRunningRequests: number;
  totalProjectConcurrency: number;
  totalProviderConcurrency: number;
  projects: GatewayProjectPressureView[];
  providers: GatewayProviderPressureView[];
};

export type PatchGatewayProviderModelPricingInput = {
  entries: Array<{
    model: string;
    promptMicrosPer1kTokens?: number | null;
    completionMicrosPer1kTokens?: number | null;
  }>;
};
