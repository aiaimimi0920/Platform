import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGatewayRateLimitHotspotAnomalyReport, buildGatewayRateLimitHotspotAnomalyThresholdConfig } from "./rate-limit-hotspot-anomaly";
import { buildGatewayRateLimitHotspotTrendReport } from "./rate-limit-hotspot-trend";
import type { GatewayRequestAuditView, GatewayRequestRouteTrace } from "@neuro/contracts";

const baseRouteTrace: GatewayRequestRouteTrace = {
  requestedProtocolFamily: "openai",
  selectionStrategy: "weighted_random",
  stickyProviderAccountId: null,
  preStreamFallbackEnabled: false,
  projectConcurrencyLimit: null,
  providerConcurrencyLimit: null,
  routeAttempt: 1,
  selectedPipelineMode: "canonical_transform",
  candidateQueue: [],
  selectedCandidate: {
    providerAccountId: "provider-1",
    providerLabel: "provider A",
    adapter: "openai_compatible",
    protocolFamily: "openai",
    sourceProfile: {
      sourceKind: "official_vendor_api",
      aggregatorApiMode: null,
      webReverseAccessMode: null,
      notes: null,
      derived: false,
    },
    protocolBridgeStrategy: "prefer_same_protocol_fast_path",
    sameProtocolFastPathEligible: true,
    resolvedExecutionMode: "direct_http",
    modelAlias: null,
    resolvedModel: null,
    priority: 0,
    weight: 1,
    stickyPreferred: false,
  },
  fallbackEligible: false,
  outcomeStatus: "failed",
  upstreamStatus: null,
  errorCode: "rate_limit_exceeded_api_key",
  errorMessage: "Rate limit exceeded for API key.",
};

const baseAudit: GatewayRequestAuditView = {
  id: "audit-1",
  projectId: "project-a",
  apiKeyId: "key-a",
  sessionId: null,
  routePolicyId: "policy-1",
  providerAccountId: null,
  protocolFamily: "openai",
  endpointKind: "responses",
  requestedModel: "gpt-4o",
  resolvedModel: "gpt-4o",
  modelAlias: null,
  stream: false,
  status: "failed",
  upstreamStatus: null,
  durationMs: 1000,
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  errorSummary: "rate limit",
  routeTrace: baseRouteTrace,
  analysisProfile: null,
  requestArtifactObjectKey: null,
  responseArtifactObjectKey: null,
  responseId: "resp-1",
  previousResponseId: null,
  clientDisconnectedAt: null,
  createdAt: "2026-04-07T11:10:00.000Z",
  completedAt: "2026-04-07T11:10:01.000Z",
  updatedAt: "2026-04-07T11:10:01.000Z",
};

function createAudit(overrides: Partial<GatewayRequestAuditView> = {}): GatewayRequestAuditView {
  const { routeTrace, ...rest } = overrides;
  return {
    ...baseAudit,
    ...rest,
    routeTrace: {
      ...baseRouteTrace,
      ...routeTrace,
    },
  };
}

describe("gateway rate limit hotspot anomaly report", () => {
  it("raises spike and hotspot anomalies from the latest bucket", () => {
    const rows: GatewayRequestAuditView[] = [
      createAudit({ id: "latest-1", createdAt: "2026-04-07T11:01:00.000Z" }),
      createAudit({ id: "latest-2", createdAt: "2026-04-07T11:02:00.000Z" }),
      createAudit({ id: "latest-3", createdAt: "2026-04-07T11:03:00.000Z" }),
      createAudit({ id: "latest-4", createdAt: "2026-04-07T11:04:00.000Z" }),
      createAudit({ id: "latest-5", createdAt: "2026-04-07T11:05:00.000Z" }),
      createAudit({ id: "previous-1", apiKeyId: "key-b", createdAt: "2026-04-07T10:10:00.000Z" }),
    ];

    const trendReport = buildGatewayRateLimitHotspotTrendReport({
      generatedAt: "2026-04-07T12:00:00.000Z",
      filters: {
        projectId: null,
        routePolicyId: null,
        providerAccountId: null,
        sessionId: null,
        apiKeyId: null,
        responseId: null,
        protocolFamily: null,
        endpointKind: null,
        errorCode: null,
        createdFrom: null,
        createdTo: null,
        limit: 1000,
        windowSize: 2,
        bucketSizeMinutes: 60,
      },
      rows,
    });

    const thresholds = buildGatewayRateLimitHotspotAnomalyThresholdConfig("aggressive", {
      totalRateLimitedRequestsWarningThreshold: 4,
      totalRateLimitedRequestsCriticalThreshold: 5,
      totalRateLimitedRequestsDeltaRatioThreshold: 0.1,
      topApiKeyShareWarningThreshold: 0.7,
      topApiKeyShareCriticalThreshold: 0.9,
    });

    const report = buildGatewayRateLimitHotspotAnomalyReport({
      generatedAt: "2026-04-07T12:00:00.000Z",
      trendReport,
      profileKey: "aggressive",
      thresholds,
    });

    assert.equal(report.profileKey, "aggressive");
    assert.ok(report.anomalies.some((item) => item.code === "rate_limit_request_spike"));
    const apiKeyHotspot = report.anomalies.find((item) => item.code === "rate_limit_api_key_hotspot");
    assert.ok(apiKeyHotspot);
    assert.equal(apiKeyHotspot?.entityKey, "key-a");
    assert.equal(apiKeyHotspot?.severity, "critical");
    assert.equal(report.byCode.find((bucket) => bucket.key === "rate_limit_api_key_hotspot")?.count, 1);
    assert.ok((report.bySeverity.find((bucket) => bucket.key === "critical")?.count ?? 0) >= 1);
  });
});
