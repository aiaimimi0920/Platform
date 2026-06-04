import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisAnomalyIncidentRemediationRunView,
  GatewayAnalysisAnomalyRemediationRunImpactView,
  GatewayAnalysisSummaryView,
} from "@neuro/contracts";

import { buildGatewayAnalysisAnomalyRemediationEffectivenessSummary } from "./analysis-remediation-effectiveness";

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
    responseTextChars: { avg: 800, p50: 780, p95: 950 },
    firstTokenLatencyMs: { avg: 500, p50: 460, p95: 700 },
    streamChunkCount: { avg: 15, p50: 14, p95: 22 },
    byProtocolFamily: [],
    byEndpointKind: [],
    byResolvedModel: [],
    byProviderAccount: [],
    byStatus: [],
    ...overrides,
  };
}

function createRun(id: string, overrides: Partial<GatewayAnalysisAnomalyIncidentRemediationRunView> = {}): GatewayAnalysisAnomalyIncidentRemediationRunView {
  return {
    id,
    incidentId: `incident_${id}`,
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
    beforeIncident: null,
    afterIncident: null,
    beforeRoutePolicy: null,
    afterRoutePolicy: null,
    errorSummary: null,
    createdAt: "2026-04-06T10:00:00.000Z",
    completedAt: "2026-04-06T10:10:00.000Z",
    ...overrides,
  };
}

function createImpact(run: GatewayAnalysisAnomalyIncidentRemediationRunView, beforeSummary: GatewayAnalysisSummaryView, afterSummary: GatewayAnalysisSummaryView): GatewayAnalysisAnomalyRemediationRunImpactView {
  return {
    generatedAt: "2026-04-06T12:00:00.000Z",
    run,
    incident: null,
    projectId: "project_1",
    routePolicyId: "route_1",
    anchorAt: "2026-04-06T10:10:00.000Z",
    windowMinutes: 180,
    beforeWindow: {
      startedAt: "2026-04-06T07:10:00.000Z",
      endedAt: "2026-04-06T10:10:00.000Z",
      summary: beforeSummary,
    },
    afterWindow: {
      startedAt: "2026-04-06T10:10:00.000Z",
      endedAt: "2026-04-06T13:10:00.000Z",
      summary: afterSummary,
    },
    metrics: {
      completionRate: { beforeValue: 0.6, afterValue: 0.8, deltaValue: 0.2, deltaRatio: 0.3333 },
      failureRate: { beforeValue: 0.4, afterValue: 0.2, deltaValue: -0.2, deltaRatio: -0.5 },
      cancellationRate: { beforeValue: 0, afterValue: 0, deltaValue: 0, deltaRatio: null },
      streamRate: { beforeValue: 0.6, afterValue: 0.7, deltaValue: 0.1, deltaRatio: 0.1667 },
      toolRequestRate: { beforeValue: 0.4, afterValue: 0.4, deltaValue: 0, deltaRatio: 0 },
      toolResponseRate: { beforeValue: 0.3, afterValue: 0.3, deltaValue: 0, deltaRatio: 0 },
      requestArtifactCoverage: { beforeValue: 0.7, afterValue: 0.9, deltaValue: 0.2, deltaRatio: 0.2857 },
      responseArtifactCoverage: { beforeValue: 0.6, afterValue: 0.8, deltaValue: 0.2, deltaRatio: 0.3333 },
      promptTokensPerSample: { beforeValue: 10, afterValue: 10, deltaValue: 0, deltaRatio: 0 },
      completionTokensPerSample: { beforeValue: 8, afterValue: 8, deltaValue: 0, deltaRatio: 0 },
      totalTokensPerSample: { beforeValue: 18, afterValue: 15, deltaValue: -3, deltaRatio: -0.1667 },
      requestTextCharsAvg: { beforeValue: 1000, afterValue: 980, deltaValue: -20, deltaRatio: -0.02 },
      responseTextCharsAvg: { beforeValue: 800, afterValue: 790, deltaValue: -10, deltaRatio: -0.0125 },
      firstTokenLatencyMsAvg: { beforeValue: 500, afterValue: 420, deltaValue: -80, deltaRatio: -0.16 },
      streamChunkCountAvg: { beforeValue: 15, afterValue: 15, deltaValue: 0, deltaRatio: 0 },
    },
  };
}

describe("ai-gateway remediation effectiveness", () => {
  it("aggregates improved and unavailable runs", () => {
    const run1 = createRun("run_1");
    const run2 = createRun("run_2", {
      actionKey: "provider-isolation",
    });
    const run3 = createRun("run_3", {
      status: "dry_run",
      dryRun: true,
      executionMode: "incident_follow_up",
      actionKey: "owner-followup",
    });

    const impact1 = createImpact(
      run1,
      createSummary({ completedSamples: 6, failedSamples: 4, requestArtifactSamples: 7, responseArtifactSamples: 6, totalTokens: 180 }),
      createSummary({ completedSamples: 8, failedSamples: 2, requestArtifactSamples: 9, responseArtifactSamples: 8, totalTokens: 150, firstTokenLatencyMs: { avg: 420, p50: 400, p95: 600 } }),
    );
    const impact2 = {
      ...createImpact(
        run2,
        createSummary({ completedSamples: 9, failedSamples: 1, totalTokens: 120 }),
        createSummary({ completedSamples: 7, failedSamples: 3, totalTokens: 160, firstTokenLatencyMs: { avg: 620, p50: 600, p95: 820 } }),
      ),
      metrics: {
        ...createImpact(
          run2,
          createSummary(),
          createSummary(),
        ).metrics,
        completionRate: { beforeValue: 0.9, afterValue: 0.7, deltaValue: -0.2, deltaRatio: -0.2222 },
        failureRate: { beforeValue: 0.1, afterValue: 0.3, deltaValue: 0.2, deltaRatio: 2 },
        requestArtifactCoverage: { beforeValue: 0.9, afterValue: 0.8, deltaValue: -0.1, deltaRatio: -0.1111 },
        responseArtifactCoverage: { beforeValue: 0.9, afterValue: 0.7, deltaValue: -0.2, deltaRatio: -0.2222 },
        totalTokensPerSample: { beforeValue: 12, afterValue: 16, deltaValue: 4, deltaRatio: 0.3333 },
        firstTokenLatencyMsAvg: { beforeValue: 500, afterValue: 620, deltaValue: 120, deltaRatio: 0.24 },
      },
    } satisfies GatewayAnalysisAnomalyRemediationRunImpactView;

    const summary = buildGatewayAnalysisAnomalyRemediationEffectivenessSummary({
      generatedAt: "2026-04-06T12:30:00.000Z",
      windowMinutes: 180,
      runs: [run1, run2, run3],
      impacts: [impact1, impact2, null],
    });

    assert.equal(summary.totalRuns, 3);
    assert.equal(summary.impactedRuns, 2);
    assert.equal(summary.unavailableRuns, 1);
    assert.equal(summary.completionRate.improvedRuns, 1);
    assert.equal(summary.completionRate.regressedRuns, 1);
    assert.equal(summary.completionRate.unavailableRuns, 1);
    assert.equal(summary.failureRate.improvedRuns, 1);
    assert.equal(summary.failureRate.regressedRuns, 1);
    assert.equal(summary.byActionKey.find((item) => item.key === "reduce-provider-concurrency")?.count, 1);
    assert.equal(summary.actions.find((item) => item.actionKey === "owner-followup")?.unavailableRunCount, 1);
    assert.equal(summary.actions.find((item) => item.actionKey === "provider-isolation")?.completionRate.regressedRuns, 1);
  });

  it("surfaces hotspot tightening actions as first-class effectiveness buckets", () => {
    const run = createRun("run_hotspot", {
      actionKey: "tighten-api-key-rate-limit",
      title: "Tighten API key rate limit",
      executionMode: "route_policy_patch",
    });
    const impact = createImpact(
      run,
      createSummary({ completedSamples: 5, failedSamples: 5, totalTokens: 220 }),
      createSummary({ completedSamples: 8, failedSamples: 2, totalTokens: 160, firstTokenLatencyMs: { avg: 430, p50: 410, p95: 610 } }),
    );

    const summary = buildGatewayAnalysisAnomalyRemediationEffectivenessSummary({
      generatedAt: "2026-04-06T12:45:00.000Z",
      windowMinutes: 180,
      runs: [run],
      impacts: [impact],
    });

    assert.equal(summary.byActionKey.find((item) => item.key === "tighten-api-key-rate-limit")?.count, 1);
    assert.equal(summary.actions.find((item) => item.actionKey === "tighten-api-key-rate-limit")?.runCount, 1);
    assert.equal(
      summary.actions.find((item) => item.actionKey === "tighten-api-key-rate-limit")?.completionRate.improvedRuns,
      1,
    );
  });
});
