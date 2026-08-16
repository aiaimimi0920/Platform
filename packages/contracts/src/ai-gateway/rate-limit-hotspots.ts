import type {
  GatewayAnalysisExportAnomalyProfileKey,
  GatewayAnalysisExportAnomalySeverity,
} from "./analysis";

import type {
  GatewayProtocolFamily,
} from "./provider";

import type {
  GatewayRateLimitHotspotAnomalyCode,
} from "./routing";

import type {
  GatewaySummaryBucket,
} from "./shared";

export type GatewayRateLimitHotspotSummaryView = {
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  errorCode: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  windowSize: number;
  bucketSizeMinutes: number;
};

export type GatewayRateLimitHotspotTrendPointView = {
  bucketStartAt: string;
  bucketEndAt: string;
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotMetricSummaryView = {
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
};

export type GatewayRateLimitHotspotTrendSummaryView = {
  latestBucketStartAt: string | null;
  previousBucketStartAt: string | null;
  totalRateLimitedRequests: GatewayRateLimitHotspotMetricSummaryView;
  topCodeShare: GatewayRateLimitHotspotMetricSummaryView;
  topProjectShare: GatewayRateLimitHotspotMetricSummaryView;
  topApiKeyShare: GatewayRateLimitHotspotMetricSummaryView;
  topRequestedModelShare: GatewayRateLimitHotspotMetricSummaryView;
  topEndpointShare: GatewayRateLimitHotspotMetricSummaryView;
  latestTopCodeKey: string | null;
  latestTopProjectKey: string | null;
  latestTopApiKeyKey: string | null;
  latestTopRequestedModelKey: string | null;
  latestTopEndpointKey: string | null;
};

export type GatewayRateLimitHotspotTrendReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotFilterView;
  matchedRequestsCount: number;
  windowSize: number;
  bucketSizeMinutes: number;
  points: GatewayRateLimitHotspotTrendPointView[];
  summary: GatewayRateLimitHotspotTrendSummaryView | null;
};

export type GatewayRateLimitHotspotAnomalyThresholdConfig = {
  totalRateLimitedRequestsWarningThreshold: number;
  totalRateLimitedRequestsCriticalThreshold: number;
  totalRateLimitedRequestsDeltaRatioThreshold: number;
  topCodeShareWarningThreshold: number;
  topCodeShareCriticalThreshold: number;
  topProjectShareWarningThreshold: number;
  topProjectShareCriticalThreshold: number;
  topApiKeyShareWarningThreshold: number;
  topApiKeyShareCriticalThreshold: number;
  topRequestedModelShareWarningThreshold: number;
  topRequestedModelShareCriticalThreshold: number;
  topEndpointShareWarningThreshold: number;
  topEndpointShareCriticalThreshold: number;
};

export type GatewayRateLimitHotspotAnomalyView = {
  code: GatewayRateLimitHotspotAnomalyCode;
  severity: GatewayAnalysisExportAnomalySeverity;
  message: string;
  entityKey: string | null;
  latestBucketStartAt: string | null;
  previousBucketStartAt: string | null;
  latestValue: number | null;
  previousValue: number | null;
  deltaValue: number | null;
  deltaRatio: number | null;
  thresholdValue: number;
};

export type GatewayRateLimitHotspotAnomalyReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotFilterView;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
  thresholds: GatewayRateLimitHotspotAnomalyThresholdConfig;
  trendSummary: GatewayRateLimitHotspotTrendSummaryView | null;
  latestPoint: GatewayRateLimitHotspotTrendPointView | null;
  previousPoint: GatewayRateLimitHotspotTrendPointView | null;
  anomalies: GatewayRateLimitHotspotAnomalyView[];
  bySeverity: GatewaySummaryBucket[];
  byCode: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotSnapshotFilterView = {
  projectId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  responseId: string | null;
  protocolFamily: GatewayProtocolFamily | null;
  endpointKind: string | null;
  errorCode: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
};

export type GatewayRateLimitHotspotSnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayRateLimitHotspotSnapshotFilterView;
  summary: GatewayRateLimitHotspotSummaryView;
};

export type GatewayRateLimitHotspotSnapshotInventorySummaryView = {
  totalSnapshots: number;
  totalRateLimitedRequests: number;
  byCode: GatewaySummaryBucket[];
  byProject: GatewaySummaryBucket[];
  byRoutePolicyId: GatewaySummaryBucket[];
  byApiKeyId: GatewaySummaryBucket[];
  byRequestedModel: GatewaySummaryBucket[];
  byResolvedModel: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byLabel: GatewaySummaryBucket[];
};

export type GatewayRateLimitHotspotSnapshotReportFilterView = {
  label: string | null;
  projectId: string | null;
  routePolicyId: string | null;
  apiKeyId: string | null;
  endpointKind: string | null;
  createdFrom: string | null;
  createdTo: string | null;
};

export type GatewayRateLimitHotspotSnapshotTrendPointView = {
  snapshot: GatewayRateLimitHotspotSnapshotView;
  totalRateLimitedRequests: number;
  topCodeShare: number | null;
  topProjectShare: number | null;
  topApiKeyShare: number | null;
  topRequestedModelShare: number | null;
  topEndpointShare: number | null;
};

export type GatewayRateLimitHotspotSnapshotTrendSummaryView = {
  latestSnapshotId: string | null;
  previousSnapshotId: string | null;
  totalRateLimitedRequests: GatewayRateLimitHotspotMetricSummaryView;
  topCodeShare: GatewayRateLimitHotspotMetricSummaryView;
  topProjectShare: GatewayRateLimitHotspotMetricSummaryView;
  topApiKeyShare: GatewayRateLimitHotspotMetricSummaryView;
  topRequestedModelShare: GatewayRateLimitHotspotMetricSummaryView;
  topEndpointShare: GatewayRateLimitHotspotMetricSummaryView;
};

export type GatewayRateLimitHotspotSnapshotTrendReportView = {
  generatedAt: string;
  filters: GatewayRateLimitHotspotSnapshotReportFilterView;
  matchedSnapshotsCount: number;
  windowSize: number;
  inventorySummary: GatewayRateLimitHotspotSnapshotInventorySummaryView;
  points: GatewayRateLimitHotspotSnapshotTrendPointView[];
  summary: GatewayRateLimitHotspotSnapshotTrendSummaryView | null;
};

export type GatewayRateLimitHotspotAnomalySnapshotFilterView = {
  label: string | null;
  projectId: string | null;
  routePolicyId: string | null;
  apiKeyId: string | null;
  endpointKind: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  limit: number;
  lookbackHours: number | null;
  profileKey: GatewayAnalysisExportAnomalyProfileKey;
};

export type GatewayRateLimitHotspotAnomalySnapshotView = {
  snapshotId: string;
  label: string | null;
  createdAt: string;
  objectKey: string;
  filters: GatewayRateLimitHotspotAnomalySnapshotFilterView;
  report: GatewayRateLimitHotspotAnomalyReportView;
};
