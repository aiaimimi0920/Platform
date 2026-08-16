import type {
  GatewayProtocolFamily,
} from "./provider";

import type {
  GatewayRequestAnalysisProfile,
  GatewayRequestRouteTrace,
  GatewayRequestStatus,
} from "./routing";

import type {
  GatewaySummaryBucket,
} from "./shared";

export type GatewayAnalysisMetricDistributionView = {
  avg: number | null;
  p50: number | null;
  p95: number | null;
};

export type GatewayAnalysisSampleView = {
  requestAuditId: string;
  responseId: string;
  projectId: string;
  routePolicyId?: string | null;
  sessionId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayRequestStatus;
  stream: boolean;
  createdAt: string;
  completedAt: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey: string | null;
  responseArtifactObjectKey: string | null;
  routeTrace: GatewayRequestRouteTrace | null;
};

export type GatewayAnalysisSummaryView = {
  totalSamples: number;
  completedSamples: number;
  failedSamples: number;
  cancelledSamples: number;
  streamSamples: number;
  toolRequestSamples: number;
  toolResponseSamples: number;
  systemPromptSamples: number;
  reasoningSamples: number;
  metadataSamples: number;
  explicitSessionSamples: number;
  previousResponseSamples: number;
  requestArtifactSamples: number;
  responseArtifactSamples: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCacheCreationInputTokens: number;
  totalCacheReadInputTokens: number;
  requestTextChars: GatewayAnalysisMetricDistributionView;
  responseTextChars: GatewayAnalysisMetricDistributionView;
  firstTokenLatencyMs: GatewayAnalysisMetricDistributionView;
  streamChunkCount: GatewayAnalysisMetricDistributionView;
  byProtocolFamily: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byProviderAccount: GatewaySummaryBucket[];
  byStatus: GatewaySummaryBucket[];
};

export const gatewayAnalysisExportTextModes = ["none", "preview_redacted", "full"] as const;

export type GatewayAnalysisExportTextMode = (typeof gatewayAnalysisExportTextModes)[number];

export type GatewayAnalysisExportMessageView = {
  role: "system" | "user" | "assistant" | "tool";
  name: string | null;
  toolCallId: string | null;
  text: string;
  toolCallCount: number;
};

export type GatewayAnalysisExportRowView = {
  requestAuditId: string;
  responseId: string;
  projectId: string;
  sessionId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayRequestStatus;
  stream: boolean;
  createdAt: string;
  completedAt: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestArtifactAvailable: boolean;
  responseArtifactAvailable: boolean;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  routeTrace: GatewayRequestRouteTrace | null;
  requestText: string | null;
  responseText: string | null;
  requestTextTruncated: boolean;
  responseTextTruncated: boolean;
  requestMessages: GatewayAnalysisExportMessageView[];
  requestToolNames: string[];
  responseToolNames: string[];
};

export type GatewayAnalysisExportView = {
  textMode: GatewayAnalysisExportTextMode;
  maxTextChars: number;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  rows: GatewayAnalysisExportRowView[];
};

export type GatewayAnalysisExportFileView = {
  kind: "manifest" | "dataset_jsonl";
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  lineCount: number | null;
};

export const gatewayAnalysisExportStatuses = ["active", "deleted"] as const;

export type GatewayAnalysisExportStatus = (typeof gatewayAnalysisExportStatuses)[number];

export type GatewayAnalysisExportFilterView = {
  projectId: string | null;
  routePolicyId?: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  status: GatewayRequestStatus | null;
  endpointKind: string | null;
  stream: boolean | null;
  errorCode: string | null;
  fallbackEligible: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  artifactAvailable: boolean | null;
  limit: number;
  textMode: GatewayAnalysisExportTextMode;
  maxTextChars: number;
};

export type GatewayAnalysisExportManifest = {
  schemaVersion: 1;
  exportId: string;
  label: string | null;
  tags?: string[];
  createdAt: string;
  retentionExpiresAt?: string | null;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  files: GatewayAnalysisExportFileView[];
};

export type GatewayPersistedAnalysisExportView = {
  exportId: string;
  label: string | null;
  tags: string[];
  status: GatewayAnalysisExportStatus;
  createdAt: string;
  updatedAt: string;
  objectPrefix: string;
  filters: GatewayAnalysisExportFilterView;
  sampleCount: number;
  requestArtifactCount: number;
  responseArtifactCount: number;
  retentionExpiresAt: string | null;
  cleanedUpAt: string | null;
  lastCleanupError: string | null;
  files: GatewayAnalysisExportFileView[];
  manifest: GatewayAnalysisExportManifest;
};

export type GatewayAnalysisExportMetadataUpdateInput = {
  label?: string | null;
  tags?: string[] | null;
  retentionExpiresAt?: string | null;
};

export type GatewayAnalysisExportCleanupEntryView = {
  exportId: string;
  status: "deleted" | "failed";
  deletedObjectCount: number;
  errorMessage: string | null;
};

export type GatewayAnalysisExportCleanupResult = {
  scannedCount: number;
  deletedCount: number;
  failedCount: number;
  results: GatewayAnalysisExportCleanupEntryView[];
};

export type GatewayAnalysisExportInventorySummaryView = {
  totalExports: number;
  activeExports: number;
  deletedExports: number;
  pinnedExports: number;
  expiringWithin24Hours: number;
  expiredActiveExports: number;
  totalSampleCount: number;
  totalRequestArtifactCount: number;
  totalResponseArtifactCount: number;
  byStatus: GatewaySummaryBucket[];
  byTextMode: GatewaySummaryBucket[];
  byTag: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
};

export type GatewayAnalysisExportBucketDeltaView = {
  key: string;
  leftCount: number;
  rightCount: number;
  deltaCount: number;
};

export type GatewayAnalysisExportMetricDeltaView = {
  leftValue: number | null;
  rightValue: number | null;
  deltaValue: number | null;
};

export type GatewayAnalysisExportDiffView = {
  leftExport: GatewayPersistedAnalysisExportView;
  rightExport: GatewayPersistedAnalysisExportView;
  overlapRequestCount: number;
  leftOnlyRequestCount: number;
  rightOnlyRequestCount: number;
  sampleCount: GatewayAnalysisExportMetricDeltaView;
  requestArtifactCount: GatewayAnalysisExportMetricDeltaView;
  responseArtifactCount: GatewayAnalysisExportMetricDeltaView;
  promptTokens: GatewayAnalysisExportMetricDeltaView;
  completionTokens: GatewayAnalysisExportMetricDeltaView;
  totalTokens: GatewayAnalysisExportMetricDeltaView;
  byStatus: GatewayAnalysisExportBucketDeltaView[];
  byProtocolFamily: GatewayAnalysisExportBucketDeltaView[];
  byEndpointKind: GatewayAnalysisExportBucketDeltaView[];
  byResolvedModel: GatewayAnalysisExportBucketDeltaView[];
  byProviderAccount: GatewayAnalysisExportBucketDeltaView[];
};

export type GatewayAnalysisExportBaselineReportFilterView = {
  label: string | null;
  tag: string | null;
  projectId: string | null;
  status: GatewayAnalysisExportStatus | null;
  textMode: GatewayAnalysisExportTextMode | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayAnalysisExportBaselineReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  latestExport: GatewayPersistedAnalysisExportView | null;
  previousExport: GatewayPersistedAnalysisExportView | null;
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  diff: GatewayAnalysisExportDiffView | null;
};

export type GatewayAnalysisExportTimelinePairView = {
  newerExport: GatewayPersistedAnalysisExportView;
  olderExport: GatewayPersistedAnalysisExportView;
  diff: GatewayAnalysisExportDiffView | null;
  diffUnavailableReason: string | null;
};

export type GatewayAnalysisExportTimelineReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  windowSize: number;
  exports: GatewayPersistedAnalysisExportView[];
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  pairComparisons: GatewayAnalysisExportTimelinePairView[];
};

export type GatewayAnalysisExportTrendPointView = {
  export: GatewayPersistedAnalysisExportView;
  datasetAvailable: boolean;
  datasetUnavailableReason: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  streamSamples: number | null;
  completedSamples: number | null;
  failedSamples: number | null;
  cancelledSamples: number | null;
  toolRequestSamples: number | null;
  toolResponseSamples: number | null;
  systemPromptSamples: number | null;
  reasoningSamples: number | null;
  metadataSamples: number | null;
  explicitSessionSamples: number | null;
  previousResponseSamples: number | null;
};

export type GatewayAnalysisExportTrendMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayAnalysisExportTrendSummaryView = {
  latestExportId: string | null;
  previousExportId: string | null;
  promptTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  completionTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  totalTokensPerSample: GatewayAnalysisExportTrendMetricSummaryView;
  requestArtifactCoverage: GatewayAnalysisExportTrendMetricSummaryView;
  responseArtifactCoverage: GatewayAnalysisExportTrendMetricSummaryView;
  streamRate: GatewayAnalysisExportTrendMetricSummaryView;
  completionRate: GatewayAnalysisExportTrendMetricSummaryView;
  failureRate: GatewayAnalysisExportTrendMetricSummaryView;
  cancellationRate: GatewayAnalysisExportTrendMetricSummaryView;
  toolRequestRate: GatewayAnalysisExportTrendMetricSummaryView;
  toolResponseRate: GatewayAnalysisExportTrendMetricSummaryView;
  reasoningRate: GatewayAnalysisExportTrendMetricSummaryView;
  metadataRate: GatewayAnalysisExportTrendMetricSummaryView;
  explicitSessionRate: GatewayAnalysisExportTrendMetricSummaryView;
  previousResponseRate: GatewayAnalysisExportTrendMetricSummaryView;
};

export type GatewayAnalysisExportTrendReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  matchedExportsCount: number;
  windowSize: number;
  inventorySummary: GatewayAnalysisExportInventorySummaryView;
  points: GatewayAnalysisExportTrendPointView[];
  summary: GatewayAnalysisExportTrendSummaryView | null;
};

export type GatewayAnalysisExportAnomalySeverity = "warning" | "critical";
export const gatewayAnalysisAnomalyProfileKeys = ["conservative", "balanced", "aggressive"] as const;
export type GatewayAnalysisExportAnomalyProfileKey = (typeof gatewayAnalysisAnomalyProfileKeys)[number];

export type GatewayAnalysisExportAnomalyCode =
  | "latest_dataset_missing"
  | "failure_rate_spike"
  | "completion_rate_drop"
  | "response_artifact_coverage_drop"
  | "request_artifact_coverage_drop"
  | "tokens_per_sample_spike";

export type GatewayAnalysisExportAnomalyView = {
  code: GatewayAnalysisExportAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  latestExportId: string | null;
  previousExportId: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number | null;
};

export type GatewayAnalysisExportAnomalyThresholdConfig = {
  failureRateWarningThreshold: number;
  failureRateCriticalThreshold: number;
  failureRateDeltaRatioThreshold: number;
  completionRateWarningThreshold: number;
  completionRateCriticalThreshold: number;
  completionRateDeltaValueThreshold: number;
  responseArtifactCoverageWarningThreshold: number;
  responseArtifactCoverageCriticalThreshold: number;
  responseArtifactCoverageDeltaValueThreshold: number;
  requestArtifactCoverageWarningThreshold: number;
  requestArtifactCoverageCriticalThreshold: number;
  requestArtifactCoverageDeltaValueThreshold: number;
  tokensPerSampleWarningDeltaRatioThreshold: number;
  tokensPerSampleCriticalDeltaRatioThreshold: number;
  tokensPerSampleCriticalAbsoluteThreshold: number;
};

export type GatewayAnalysisExportAnomalyReportView = {
  generatedAt: string;
  filters: GatewayAnalysisExportBaselineReportFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayAnalysisExportAnomalyThresholdConfig;
  latestExport: GatewayPersistedAnalysisExportView | null;
  previousExport: GatewayPersistedAnalysisExportView | null;
  trendSummary: GatewayAnalysisExportTrendSummaryView | null;
  anomalies: GatewayAnalysisExportAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};
