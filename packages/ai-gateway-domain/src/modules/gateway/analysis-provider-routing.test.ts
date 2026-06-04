import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayAnalysisSampleView } from "@neuro/contracts";

import {
  buildGatewayProviderRoutingAnalysisAnomalyReport,
  buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig,
  buildGatewayProviderRoutingAnalysisSummary,
} from "./analysis-provider-routing";

function makeSample(
  id: string,
  overrides: Partial<GatewayAnalysisSampleView> = {},
): GatewayAnalysisSampleView {
  return {
    requestAuditId: id,
    responseId: `response_${id}`,
    projectId: "project_1",
    routePolicyId: "route_1",
    sessionId: null,
    providerAccountId: "provider_a",
    protocolFamily: "openai",
    endpointKind: "responses",
    requestedModel: "gpt-5.4",
    resolvedModel: "gpt-5.4",
    status: "completed",
    stream: true,
    createdAt: "2026-04-07T10:00:00.000Z",
    completedAt: "2026-04-07T10:01:00.000Z",
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    analysisProfile: null,
    requestArtifactObjectKey: null,
    responseArtifactObjectKey: null,
    routeTrace: {
      requestedProtocolFamily: "openai",
      selectionStrategy: "weighted_random",
      stickyProviderAccountId: null,
      preStreamFallbackEnabled: true,
      projectConcurrencyLimit: 4,
      providerConcurrencyLimit: 2,
      routeAttempt: 1,
      selectedPipelineMode: "same_protocol_fast_path",
      candidateQueue: [],
      selectedCandidate: {
        providerAccountId: "provider_a",
        providerLabel: "provider_a",
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
        modelAlias: "writer",
        resolvedModel: "gpt-5.4",
        priority: 100,
        weight: 1,
        stickyPreferred: false,
        activeConcurrency: 1,
        failureCount: 0,
        breakerOpen: false,
        routingScore: 0.82,
        healthWeight: 0.9,
        capacityWeight: 0.9,
        degraded: false,
        degradationReasons: [],
      },
      fallbackEligible: false,
      outcomeStatus: "completed",
      upstreamStatus: 200,
      errorCode: null,
      errorMessage: null,
    },
    ...overrides,
  };
}

test("provider routing analysis summary aggregates selected provider routing metrics", () => {
  const summary = buildGatewayProviderRoutingAnalysisSummary([
    makeSample("a"),
    makeSample("b", {
      providerAccountId: "provider_b",
      routeTrace: {
        ...makeSample("tmp").routeTrace!,
        selectedCandidate: {
          ...makeSample("tmp").routeTrace!.selectedCandidate,
          providerAccountId: "provider_b",
          providerLabel: "provider_b",
          routingScore: 0.24,
          healthWeight: 0.4,
          capacityWeight: 0.6,
          degraded: true,
          degradationReasons: ["failure_count_elevated", "concurrency_pressure"],
        },
      },
    }),
    makeSample("c", {
      providerAccountId: "provider_c",
      routeTrace: {
        ...makeSample("tmp2").routeTrace!,
        selectedCandidate: {
          ...makeSample("tmp2").routeTrace!.selectedCandidate,
          providerAccountId: "provider_c",
          providerLabel: "provider_c",
          breakerOpen: true,
          routingScore: 0,
          healthWeight: 0,
          capacityWeight: 0.2,
          degraded: true,
          degradationReasons: ["breaker_open"],
        },
      },
    }),
  ]);

  assert.equal(summary.totalSamples, 3);
  assert.equal(summary.selectedProviderSamples, 3);
  assert.equal(summary.degradedSelectedProviderSamples, 2);
  assert.equal(summary.breakerOpenSelectedProviderSamples, 1);
  assert.equal(summary.routingScore.avg, 0.353);
  assert.equal(summary.bySelectedProvider.length, 3);
  assert.equal(summary.byDegradationReason.find((item) => item.key === "breaker_open")?.count, 1);
});

test("provider routing analysis anomaly report flags degraded routing windows", () => {
  const summary = buildGatewayProviderRoutingAnalysisSummary([
    makeSample("a", {
      routeTrace: {
        ...makeSample("base").routeTrace!,
        selectedCandidate: {
          ...makeSample("base").routeTrace!.selectedCandidate,
          routingScore: 0.18,
          healthWeight: 0.3,
          capacityWeight: 0.6,
          degraded: true,
          degradationReasons: ["failure_count_elevated"],
        },
      },
    }),
    makeSample("b", {
      routeTrace: {
        ...makeSample("base2").routeTrace!,
        selectedCandidate: {
          ...makeSample("base2").routeTrace!.selectedCandidate,
          routingScore: 0.12,
          healthWeight: 0.2,
          capacityWeight: 0.6,
          degraded: true,
          degradationReasons: ["failure_count_elevated"],
        },
      },
    }),
    makeSample("c", {
      routeTrace: {
        ...makeSample("base3").routeTrace!,
        selectedCandidate: {
          ...makeSample("base3").routeTrace!.selectedCandidate,
          breakerOpen: true,
          routingScore: 0,
          healthWeight: 0,
          capacityWeight: 0.1,
          degraded: true,
          degradationReasons: ["breaker_open"],
        },
      },
    }),
  ]);

  const report = buildGatewayProviderRoutingAnalysisAnomalyReport({
    generatedAt: "2026-04-07T12:00:00.000Z",
    filters: {
      projectId: "project_1",
      routePolicyId: "route_1",
      providerAccountId: null,
      sessionId: null,
      apiKeyId: null,
      responseId: null,
      protocolFamily: "openai",
      endpointKind: "responses",
      status: null,
      createdFrom: null,
      createdTo: null,
      limit: 100,
    },
    profileKey: "balanced",
    thresholds: buildGatewayProviderRoutingAnalysisAnomalyThresholdConfig("balanced"),
    summary,
  });

  assert.equal(report.anomalies.some((item) => item.code === "provider_routing_score_drop"), true);
  assert.equal(report.anomalies.some((item) => item.code === "degraded_provider_route_spike"), true);
  assert.equal(report.anomalies.some((item) => item.code === "breaker_open_provider_route_detected"), true);
});
