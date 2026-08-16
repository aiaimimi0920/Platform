import type {
  GatewayProtocolFamily,
} from "./provider";

export type GatewayConversationArchiveStatus =
  | "completed"
  | "failed"
  | "partial"
  | "archive_failed";

export type GatewayProviderFailureClass =
  | "credential_invalid"
  | "credential_expired"
  | "quota_exhausted"
  | "rate_limited"
  | "model_unsupported"
  | "content_rejected"
  | "gateway_protocol_error"
  | "client_request_invalid"
  | "provider_transient"
  | "unknown";

export type GatewayProviderFailureScope =
  | "credential"
  | "credential_model"
  | "provider"
  | "implementation_line"
  | "client_request"
  | "unknown";

export type GatewayConversationArchiveView = {
  id: string;
  requestAuditId: string | null;
  requestId: string;
  projectId: string | null;
  userId: string | null;
  sessionId: string | null;
  providerAccountId: string | null;
  providerCredentialRef: string | null;
  protocolFamily: GatewayProtocolFamily | string;
  protocolProfile: string | null;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  status: GatewayConversationArchiveStatus | string;
  upstreamStatus: number | null;
  failureClass: GatewayProviderFailureClass | string | null;
  failureScope: GatewayProviderFailureScope | string | null;
  requestObjectKey: string | null;
  responseObjectKey: string | null;
  redactionVersion: string;
  truncatedRequest: boolean;
  truncatedResponse: boolean;
  archiveError: string | null;
  retentionExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayConversationArchiveArtifactsView = {
  archive: GatewayConversationArchiveView;
  artifacts: {
    requestArtifact: unknown | null;
    responseArtifact: unknown | null;
  };
};

export type GatewayConversationArchiveExportView = {
  exportId: string;
  datasetObjectKey: string;
  rowCount: number;
  createdAt: string;
};

export type GatewayProviderCredentialModelHealthStatus =
  | "active"
  | "degraded"
  | "cooling"
  | "blocked";

export type GatewayProviderCredentialModelStateView = {
  id: string;
  providerAccountId: string;
  providerCredentialId: string | null;
  providerCredentialRef: string | null;
  protocolProfile: string | null;
  model: string;
  status: GatewayProviderCredentialModelHealthStatus | string;
  failureClass: GatewayProviderFailureClass | string | null;
  failureScope: GatewayProviderFailureScope | string | null;
  failureCount: number;
  lastError: string | null;
  lastUpstreamStatus: number | null;
  cooldownUntil: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GatewayUsageAggregateBucketView = {
  bucketStart: string;
  bucketGranularity: string;
  projectId: string;
  userId: string;
  provider: string;
  providerCredentialRef: string;
  model: string;
  requestCount: number;
  failureCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  latencyMsSum: number;
  createdAt: string;
  updatedAt: string;
};

export type GatewayUsageAggregateAlertView = {
  severity: "info" | "warning" | "critical" | string;
  code: string;
  message: string;
};

export type GatewayUsageAggregateSummaryView = {
  queueDepth: number;
  recentRequestCount: number;
  recentFailureCount: number;
  recentTotalTokens: number;
  archiveFailureCount: number;
  alerts: GatewayUsageAggregateAlertView[];
};

export type GatewayConversationDatasetExportStatus =
  | "review_pending"
  | "approved"
  | "rejected"
  | "published";

export type GatewayConversationDatasetExportView = {
  id: string;
  status: GatewayConversationDatasetExportStatus | string;
  filter: unknown;
  sampleSize: number | null;
  rowCount: number;
  datasetObjectKey: string;
  manifestObjectKey: string;
  createdBy: string | null;
  reviewerId: string | null;
  approvalNote: string | null;
  rejectedReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
