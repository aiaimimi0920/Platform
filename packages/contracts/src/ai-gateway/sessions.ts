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

export type GatewaySessionView = {
  id: string;
  projectId: string;
  sessionKey: string;
  protocolFamily: GatewayProtocolFamily;
  providerAccountId: string;
  latestResponseId: string | null;
  upstreamSessionId: string | null;
  runtimeStateObjectKey: string | null;
  activeRequestAuditId: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export type GatewayRequestAuditView = {
  id: string;
  projectId: string;
  accessKeyId: string | null;
  sourceAccessKeyId: string | null;
  apiKeyId: string | null;
  userCredentialId: string | null;
  sessionId: string | null;
  routePolicyId: string | null;
  providerAccountId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  resolvedModel: string | null;
  modelAlias: string | null;
  stream: boolean;
  status: GatewayRequestStatus;
  upstreamStatus: number | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  clientHasCacheControl: boolean;
  autoCacheApplied: boolean;
  errorSummary: string | null;
  routeTrace: GatewayRequestRouteTrace | null;
  analysisProfile: GatewayRequestAnalysisProfile | null;
  requestArtifactObjectKey: string | null;
  responseArtifactObjectKey: string | null;
  responseId: string;
  previousResponseId: string | null;
  clientDisconnectedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type GatewayStoredRequestArtifact = {
  schemaVersion: 1;
  kind: "request";
  requestAuditId: string;
  projectId: string;
  sessionId: string | null;
  protocolFamily: GatewayProtocolFamily;
  endpointKind: string;
  requestedModel: string | null;
  previousResponseId: string | null;
  explicitSessionKey: string | null;
  analysisProfile: GatewayRequestAnalysisProfile;
  capturedAt: string;
  canonicalRequest: {
    protocolFamily: GatewayProtocolFamily | "openai" | "anthropic";
    endpointKind: string;
    requestedModel: string | null;
    stream: boolean;
    messages: unknown[];
    tools: unknown[];
    toolChoice: unknown;
    reasoning: unknown;
    metadata: Record<string, unknown> | null;
    attachments: unknown[];
    previousResponseId: string | null;
    explicitSessionKey: string | null;
  };
  rawBody: Record<string, unknown>;
};

export type GatewayStoredResponseArtifact = {
  schemaVersion: 1;
  kind: "response";
  requestAuditId: string;
  responseId: string;
  providerAccountId: string | null;
  resolvedModel: string | null;
  upstreamStatus: number | null;
  status: GatewayRequestStatus;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    cacheCreationInputTokens: number | null;
    cacheReadInputTokens: number | null;
  } | null;
  result: {
    text: string;
    toolCalls: unknown[];
    upstreamSessionId: string | null;
    runtimeStateObjectKey: string | null;
  };
  analysisProfile: GatewayRequestAnalysisProfile;
  routeTrace: GatewayRequestRouteTrace | null;
  capturedAt: string;
};

export type GatewayRequestArtifactsView = {
  requestAudit: GatewayRequestAuditView;
  requestArtifact: GatewayStoredRequestArtifact | null;
  responseArtifact: GatewayStoredResponseArtifact | null;
};

export type GatewayRequestAuditSummaryView = {
  totalRequests: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  runningCount: number;
  fallbackEligibleFailures: number;
  fallbackExhaustedFailures: number;
  byStatus: GatewaySummaryBucket[];
  byProviderAccount: GatewaySummaryBucket[];
  byEndpointKind: GatewaySummaryBucket[];
  byErrorCode: GatewaySummaryBucket[];
};

export type GatewaySessionDetailView = {
  session: GatewaySessionView;
  activeRequestAudit: GatewayRequestAuditView | null;
  latestRequestAudit: GatewayRequestAuditView | null;
  recentRequestAudits: GatewayRequestAuditView[];
};
