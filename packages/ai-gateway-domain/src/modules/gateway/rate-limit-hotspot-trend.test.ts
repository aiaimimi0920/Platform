import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayRequestAuditView, GatewayRequestRouteTrace } from "@neuro/contracts";

import { buildGatewayRateLimitHotspotTrendReport } from "./rate-limit-hotspot-trend";

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
  errorCode: "rate_limit_exceeded_project",
  errorMessage: "Rate limit exceeded for project.",
};

const baseAudit: GatewayRequestAuditView = {
  id: "audit-1",
  projectId: "project-a",
  apiKeyId: "key-a",
  sessionId: null,
  routePolicyId: "policy-1",
  providerAccountId: null,
  protocolFamily: "openai",
  endpointKind: "chat.completions",
  requestedModel: "gpt-4",
  resolvedModel: "gpt-4",
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

describe("gateway rate limit hotspot trend report", () => {
  it("buckets rate-limit rows and produces a latest-vs-previous summary", () => {
    const rows: GatewayRequestAuditView[] = [
      createAudit({
        id: "audit-latest-1",
        apiKeyId: "key-a",
        endpointKind: "chat.completions",
        createdAt: "2026-04-07T11:05:00.000Z",
      }),
      createAudit({
        id: "audit-latest-2",
        apiKeyId: "key-a",
        endpointKind: "responses",
        routeTrace: {
          ...baseRouteTrace,
          errorCode: "rate_limit_exceeded_endpoint",
        },
        createdAt: "2026-04-07T11:30:00.000Z",
      }),
      createAudit({
        id: "audit-previous",
        apiKeyId: "key-b",
        projectId: "project-b",
        requestedModel: "gpt-4o",
        resolvedModel: "gpt-4o",
        endpointKind: "responses",
        createdAt: "2026-04-07T10:15:00.000Z",
      }),
    ];

    const report = buildGatewayRateLimitHotspotTrendReport({
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
        windowSize: 3,
        bucketSizeMinutes: 60,
      },
      rows,
    });

    assert.equal(report.matchedRequestsCount, 3);
    assert.equal(report.points.length, 3);
    assert.equal(report.points[0].bucketStartAt, "2026-04-07T11:00:00.000Z");
    assert.equal(report.points[0].totalRateLimitedRequests, 2);
    assert.equal(report.points[1].bucketStartAt, "2026-04-07T10:00:00.000Z");
    assert.equal(report.points[1].totalRateLimitedRequests, 1);
    assert.equal(report.summary?.totalRateLimitedRequests.latestValue, 2);
    assert.equal(report.summary?.totalRateLimitedRequests.previousValue, 1);
    assert.equal(report.summary?.totalRateLimitedRequests.deltaValue, 1);
    assert.equal(report.summary?.latestTopApiKeyKey, "key-a");
    assert.equal(report.summary?.latestTopEndpointKey, "chat.completions");
    assert.equal(report.summary?.topApiKeyShare.latestValue, 1);
  });
});
