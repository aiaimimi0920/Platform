import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisAnomalyIncidentRemediationRunView,
  GatewayAnalysisAnomalyIncidentView,
  GatewayAnalysisSummaryView,
} from "@neuro/contracts";

import {
  buildGatewayAnalysisAnomalyRemediationRunImpact,
  buildGatewayAnalysisAnomalyRemediationRunSummary,
} from "./analysis-remediation-impact";

function createSummary(overrides: Partial<GatewayAnalysisSummaryView> = {}): GatewayAnalysisSummaryView {
  return {
    totalSamples: 10,
    completedSamples: 8,
    failedSamples: 2,
    cancelledSamples: 0,
    streamSamples: 6,
    toolRequestSamples: 4,
    toolResponseSamples: 3,
    systemPromptSamples: 7,
    reasoningSamples: 2,
    metadataSamples: 5,
    explicitSessionSamples: 4,
    previousResponseSamples: 3,
    requestArtifactSamples: 9,
    responseArtifactSamples: 8,
    totalPromptTokens: 100,
    totalCompletionTokens: 80,
    totalTokens: 180,
    requestTextChars: { avg: 1000, p50: 1000, p95: 1200 },
    responseTextChars: { avg: 800, p50: 790, p95: 950 },
    firstTokenLatencyMs: { avg: 500, p50: 450, p95: 700 },
    streamChunkCount: { avg: 15, p50: 14, p95: 22 },
    byProtocolFamily: [],
    byEndpointKind: [],
    byResolvedModel: [],
    byProviderAccount: [],
    byStatus: [],
    ...overrides,
  };
}

function createIncident(overrides: Partial<GatewayAnalysisAnomalyIncidentView> = {}): GatewayAnalysisAnomalyIncidentView {
  return {
    id: "incident_1",
    policyId: "policy_1",
    fingerprint: "fingerprint_1",
    projectId: "project_1",
    routePolicyId: "route_1",
    tag: "rolling",
    textMode: "preview_redacted",
    code: "failure_rate_spike",
    severity: "critical",
    status: "open",
    ownerUserId: "ops_1",
    followUpStatus: "pending",
    syncHitCount: 2,
    escalationStatus: "escalated",
    escalatedAt: "2026-04-06T10:00:00.000Z",
    escalationReason: "auto",
    latestNote: null,
    resolutionNote: null,
    lastActionAt: null,
    lastAlertAttemptAt: null,
    lastAlertedAt: "2026-04-06T10:05:00.000Z",
    lastAlertSeverity: "danger",
    alertDeliveryCount: 1,
    summary: "failure spike",
    latestExportId: "export_2",
    previousExportId: "export_1",
    latestValue: 0.3,
    previousValue: 0.15,
    deltaValue: 0.15,
    deltaRatio: 1,
    thresholdValue: 0.1,
    firstSeenAt: "2026-04-06T09:00:00.000Z",
    lastSeenAt: "2026-04-06T10:00:00.000Z",
    acknowledgedAt: null,
    resolvedAt: null,
    createdAt: "2026-04-06T09:00:00.000Z",
    updatedAt: "2026-04-06T10:00:00.000Z",
    ...overrides,
  };
}

function createRun(overrides: Partial<GatewayAnalysisAnomalyIncidentRemediationRunView> = {}): GatewayAnalysisAnomalyIncidentRemediationRunView {
  const beforeIncident = createIncident();
  const afterIncident = createIncident({
    followUpStatus: "investigating",
    latestNote: "owner assigned",
  });
  return {
    id: "run_1",
    incidentId: beforeIncident.id,
    policyId: "policy_1",
    routePolicyId: "route_1",
    actionKey: "reduce-provider-concurrency",
    title: "Reduce provider concurrency",
    executionMode: "route_policy_patch",
    status: "applied",
    dryRun: false,
    actorUserId: "ops_1",
    note: null,
    input: null,
    result: null,
    beforeIncident,
    afterIncident,
    beforeRoutePolicy: {
      id: "route_1",
      projectId: "project_1",
      name: "default",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "priority",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 5,
        providerMaxConcurrentRequests: 3,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: ["provider_1"],
        allowedProtocolFamilies: ["openai"],
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: null,
        rateLimitHotspotAutoRemediation: null,
        fallbackHttpStatuses: [429, 500],
        fallbackErrorCodes: ["upstream"],
      },
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T09:00:00.000Z",
    },
    afterRoutePolicy: {
      id: "route_1",
      projectId: "project_1",
      name: "default",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "priority",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 5,
        providerMaxConcurrentRequests: 2,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: ["provider_1"],
        allowedProtocolFamilies: ["openai"],
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: null,
        rateLimitHotspotAutoRemediation: null,
        fallbackHttpStatuses: [429, 500],
        fallbackErrorCodes: ["upstream"],
      },
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:10:00.000Z",
    },
    errorSummary: null,
    createdAt: "2026-04-06T10:00:00.000Z",
    completedAt: "2026-04-06T10:10:00.000Z",
    ...overrides,
  };
}

describe("ai-gateway remediation impact", () => {
  it("builds remediation run summary buckets", () => {
    const runs = [
      createRun(),
      createRun({
        id: "run_2",
        actionKey: "owner-followup",
        executionMode: "incident_follow_up",
        status: "dry_run",
        dryRun: true,
        beforeRoutePolicy: null,
        afterRoutePolicy: null,
      }),
      createRun({
        id: "run_3",
        incidentId: "incident_2",
        status: "failed",
        errorSummary: "failed",
        beforeIncident: createIncident({ id: "incident_2" }),
        afterIncident: createIncident({ id: "incident_2" }),
      }),
    ];

    const summary = buildGatewayAnalysisAnomalyRemediationRunSummary({ runs });

    assert.equal(summary.totalRuns, 3);
    assert.equal(summary.dryRunRuns, 1);
    assert.equal(summary.appliedRuns, 1);
    assert.equal(summary.failedRuns, 1);
    assert.equal(summary.distinctIncidentCount, 2);
    assert.equal(summary.routePolicyChangedRuns, 2);
    assert.equal(summary.incidentChangedRuns, 2);
    assert.equal(summary.byStatus.find((item) => item.key === "failed")?.count, 1);
    assert.equal(summary.byActionKey.find((item) => item.key === "owner-followup")?.count, 1);
  });

  it("builds before/after remediation impact deltas", () => {
    const run = createRun();
    const impact = buildGatewayAnalysisAnomalyRemediationRunImpact({
      generatedAt: "2026-04-06T10:15:00.000Z",
      run,
      incident: run.afterIncident,
      projectId: "project_1",
      routePolicyId: "route_1",
      anchorAt: "2026-04-06T10:10:00.000Z",
      windowMinutes: 180,
      beforeWindow: {
        startedAt: "2026-04-06T07:10:00.000Z",
        endedAt: "2026-04-06T10:10:00.000Z",
        summary: createSummary({
          totalSamples: 10,
          completedSamples: 6,
          failedSamples: 4,
          requestArtifactSamples: 7,
          responseArtifactSamples: 6,
          totalTokens: 300,
        }),
      },
      afterWindow: {
        startedAt: "2026-04-06T10:10:00.000Z",
        endedAt: "2026-04-06T13:10:00.000Z",
        summary: createSummary({
          totalSamples: 12,
          completedSamples: 10,
          failedSamples: 2,
          requestArtifactSamples: 11,
          responseArtifactSamples: 10,
          totalTokens: 240,
          firstTokenLatencyMs: { avg: 420, p50: 400, p95: 600 },
        }),
      },
    });

    assert.equal(impact.projectId, "project_1");
    assert.equal(impact.routePolicyId, "route_1");
    assert.equal(impact.metrics.completionRate.beforeValue, 0.6);
    assert.equal(impact.metrics.completionRate.afterValue, 0.8333);
    assert.equal(impact.metrics.failureRate.beforeValue, 0.4);
    assert.equal(impact.metrics.failureRate.afterValue, 0.1667);
    assert.equal(impact.metrics.requestArtifactCoverage.afterValue, 0.9167);
    assert.equal(impact.metrics.totalTokensPerSample.beforeValue, 30);
    assert.equal(impact.metrics.totalTokensPerSample.afterValue, 20);
    assert.equal(impact.metrics.firstTokenLatencyMsAvg.deltaValue, -80);
  });
});
