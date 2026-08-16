export type GatewayPromptCacheMetricsView = {
  hitRequests: number;
  creationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type GatewayPromptCacheSummaryView = {
  totalRequests: number;
  cacheHitRequests: number;
  cacheCreationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheControlCoverageRequests: number;
  totalTokensSaved: number;
  totalCacheCreationInputTokens: number;
  estimatedCostSavedUsd: number;
  cacheHitRate: number;
  cacheControlCoverageRate: number;
  inputPricePerMillion: number;
  cachedInputPricePerMillion: number;
};

export type GatewayPromptCacheTrendPointView = {
  bucketStart: string;
  totalRequests: number;
  cacheHitRequests: number;
  cacheCreationRequests: number;
  clientMarkedRequests: number;
  autoAppliedRequests: number;
  cacheControlCoverageRequests: number;
  totalTokensSaved: number;
  totalCacheCreationInputTokens: number;
  estimatedCostSavedUsd: number;
  cacheHitRate: number;
  cacheControlCoverageRate: number;
};

export type GatewayPromptCacheTrendReportView = {
  bucketSize: string;
  summary: GatewayPromptCacheSummaryView;
  points: GatewayPromptCacheTrendPointView[];
};
