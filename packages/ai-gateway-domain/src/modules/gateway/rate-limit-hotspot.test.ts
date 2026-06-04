import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayRequestAuditView, GatewayRequestRouteTrace } from "@neuro/contracts";

import { buildGatewayRateLimitHotspotSummary } from "./rate-limit-hotspot";

const baseRouteTrace: GatewayRequestRouteTrace = {
  requestedProtocolFamily: "openai",
  selectionStrategy: "weighted_random",
  stickyProviderAccountId: null,
  preStreamFallbackEnabled: true,
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
  upstreamStatus: 429,
  errorCode: "rate-limit-base",
  errorMessage: "rate limit",
};

const baseAudit: GatewayRequestAuditView = {
  id: "audit-1",
  projectId: "project-a",
  apiKeyId: "key-a",
  sessionId: null,
  routePolicyId: null,
  providerAccountId: null,
  protocolFamily: "openai",
  endpointKind: "chat.completions",
  requestedModel: "gpt-4",
  resolvedModel: "gpt-4",
  modelAlias: null,
  stream: false,
  status: "failed",
  upstreamStatus: 429,
  durationMs: 1000,
  promptTokens: 1,
  completionTokens: 1,
  totalTokens: 2,
  errorSummary: "rate limit",
  routeTrace: baseRouteTrace,
  analysisProfile: null,
  requestArtifactObjectKey: null,
  responseArtifactObjectKey: null,
  responseId: "resp-1",
  previousResponseId: null,
  clientDisconnectedAt: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  completedAt: "2026-04-01T00:01:00.000Z",
  updatedAt: "2026-04-01T00:01:00.000Z",
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

describe("gateway rate limit hotspot summary", () => {
  it("counts only rate-limit failures and groups by dimension", () => {
    const rows: GatewayRequestAuditView[] = [
      createAudit({
        id: "audit-rl-1",
        projectId: "project-a",
        routePolicyId: "policy-1",
        apiKeyId: "key-a",
        requestedModel: "gpt-4",
        resolvedModel: "gpt-4",
        endpointKind: "chat.completions",
        routeTrace: {
          ...baseRouteTrace,
          errorCode: "rate_limit_exceeded_project",
        },
      }),
      createAudit({
        id: "audit-rl-2",
        projectId: "project-b",
        routePolicyId: "policy-2",
        apiKeyId: "key-b",
        requestedModel: "gpt-4o",
        resolvedModel: "gpt-4o",
        endpointKind: "responses",
        routeTrace: {
          ...baseRouteTrace,
          errorCode: "rate_limit_exceeded_endpoint",
        },
      }),
      createAudit({
        id: "audit-legacy-rl",
        projectId: "project-b",
        routePolicyId: "policy-2",
        apiKeyId: "key-c",
        requestedModel: "gpt-4o-mini",
        resolvedModel: "gpt-4o-mini",
        endpointKind: "responses",
        routeTrace: {
          ...baseRouteTrace,
          errorCode: "rate-limit-legacy",
        },
      }),
      createAudit({
        id: "audit-nonrl",
        projectId: "project-a",
        routePolicyId: "policy-1",
        apiKeyId: "key-a",
        requestedModel: "gpt-4",
        resolvedModel: "gpt-4",
        endpointKind: "chat.completions",
        routeTrace: {
          ...baseRouteTrace,
          errorCode: "timeout",
        },
      }),
    ];

    const summary = buildGatewayRateLimitHotspotSummary(rows);
    assert.equal(summary.totalRateLimitedRequests, 3);
    assert.equal(summary.byCode.find((bucket) => bucket.key === "rate_limit_exceeded_project")?.count, 1);
    assert.equal(summary.byCode.find((bucket) => bucket.key === "rate_limit_exceeded_endpoint")?.count, 1);
    assert.equal(summary.byCode.find((bucket) => bucket.key === "rate-limit-legacy")?.count, 1);
    assert.equal(summary.byRoutePolicyId.find((bucket) => bucket.key === "policy-1")?.count, 1);
    assert.equal(summary.byRoutePolicyId.find((bucket) => bucket.key === "policy-2")?.count, 2);
    assert.equal(summary.byApiKeyId.find((bucket) => bucket.key === "key-a")?.count, 1);
    assert.equal(summary.byApiKeyId.find((bucket) => bucket.key === "key-b")?.count, 1);
    assert.equal(summary.byApiKeyId.find((bucket) => bucket.key === "key-c")?.count, 1);
    assert.equal(summary.byRequestedModel.find((bucket) => bucket.key === "gpt-4")?.count, 1);
    assert.equal(summary.byResolvedModel.find((bucket) => bucket.key === "gpt-4o")?.count, 1);
    assert.equal(summary.byEndpointKind.find((bucket) => bucket.key === "responses")?.count, 2);
    assert.equal(summary.byProject.find((bucket) => bucket.key === "project-a")?.count, 1);
    assert.equal(summary.byProject.find((bucket) => bucket.key === "project-b")?.count, 2);
  });
});
