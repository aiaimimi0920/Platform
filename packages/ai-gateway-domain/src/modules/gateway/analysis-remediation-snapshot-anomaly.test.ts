import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView,
  GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView,
} from "@neuro/contracts";

import {
  buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport,
  buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig,
} from "./analysis-remediation-snapshot-anomaly";

function createSnapshot(snapshotId: string): GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView {
  return {
    snapshotId,
    label: snapshotId,
    createdAt: "2026-04-06T12:00:00.000Z",
    objectKey: `ai-gateway/remediation-effectiveness-snapshots/${snapshotId}/snapshot.json`,
    filters: {
      incidentId: null,
      policyId: null,
      routePolicyId: "route_1",
      actionKey: "reduce-provider-concurrency",
      status: "applied",
      executionMode: "route_policy_patch",
      dryRun: false,
      createdFrom: null,
      createdTo: null,
      limit: 100,
      lookbackHours: 24,
      windowMinutes: 180,
    },
    summary: {
      generatedAt: "2026-04-06T12:00:00.000Z",
      windowMinutes: 180,
      totalRuns: 10,
      impactedRuns: 8,
      unavailableRuns: 2,
      byStatus: [{ key: "applied", count: 10 }],
      byExecutionMode: [{ key: "route_policy_patch", count: 10 }],
      byActionKey: [{ key: "reduce-provider-concurrency", count: 10 }],
      completionRate: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      failureRate: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      requestArtifactCoverage: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      responseArtifactCoverage: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      firstTokenLatencyMsAvg: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      totalTokensPerSample: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      actions: [],
    },
  };
}

describe("ai-gateway remediation effectiveness snapshot anomaly", () => {
  it("flags regressions in latest snapshot trend summary", () => {
    const trendReport: GatewayAnalysisAnomalyRemediationEffectivenessTrendReportView = {
      generatedAt: "2026-04-06T12:30:00.000Z",
      filters: {
        label: null,
        routePolicyId: "route_1",
        actionKey: "reduce-provider-concurrency",
        createdFrom: null,
        createdTo: null,
      },
      matchedSnapshotsCount: 2,
      windowSize: 10,
      inventorySummary: {
        totalSnapshots: 2,
        totalRuns: 18,
        totalImpactedRuns: 9,
        totalUnavailableRuns: 9,
        byRoutePolicyId: [{ key: "route_1", count: 2 }],
        byActionKey: [{ key: "reduce-provider-concurrency", count: 2 }],
        byExecutionMode: [{ key: "route_policy_patch", count: 2 }],
        byLabel: [],
      },
      points: [
        {
          snapshot: createSnapshot("snapshot_latest"),
          totalRuns: 4,
          impactedRunRate: 0.4,
          unavailableRunRate: 0.6,
          completionRate: { improvedRate: 0.1, regressedRate: 0.7, neutralRate: 0, unavailableRate: 0.2 },
          failureRate: { improvedRate: 0.1, regressedRate: 0.6, neutralRate: 0.1, unavailableRate: 0.2 },
          requestArtifactCoverage: { improvedRate: 0.2, regressedRate: 0.5, neutralRate: 0.1, unavailableRate: 0.2 },
          responseArtifactCoverage: { improvedRate: 0.2, regressedRate: 0.6, neutralRate: 0, unavailableRate: 0.2 },
          firstTokenLatencyMsAvg: { improvedRate: 0.1, regressedRate: 0.55, neutralRate: 0.15, unavailableRate: 0.2 },
          totalTokensPerSample: { improvedRate: 0.1, regressedRate: 0.65, neutralRate: 0.05, unavailableRate: 0.2 },
        },
        {
          snapshot: createSnapshot("snapshot_previous"),
          totalRuns: 8,
          impactedRunRate: 0.875,
          unavailableRunRate: 0.125,
          completionRate: { improvedRate: 0.6, regressedRate: 0.1, neutralRate: 0.2, unavailableRate: 0.1 },
          failureRate: { improvedRate: 0.5, regressedRate: 0.1, neutralRate: 0.3, unavailableRate: 0.1 },
          requestArtifactCoverage: { improvedRate: 0.55, regressedRate: 0.1, neutralRate: 0.25, unavailableRate: 0.1 },
          responseArtifactCoverage: { improvedRate: 0.6, regressedRate: 0.1, neutralRate: 0.2, unavailableRate: 0.1 },
          firstTokenLatencyMsAvg: { improvedRate: 0.5, regressedRate: 0.15, neutralRate: 0.25, unavailableRate: 0.1 },
          totalTokensPerSample: { improvedRate: 0.55, regressedRate: 0.1, neutralRate: 0.25, unavailableRate: 0.1 },
        },
      ],
      summary: {
        latestSnapshotId: "snapshot_latest",
        previousSnapshotId: "snapshot_previous",
        totalRuns: { latestValue: 4, previousValue: 8, deltaValue: -4, deltaRatio: -0.5 },
        impactedRunRate: { latestValue: 0.4, previousValue: 0.875, deltaValue: -0.475, deltaRatio: -0.5429 },
        unavailableRunRate: { latestValue: 0.6, previousValue: 0.125, deltaValue: 0.475, deltaRatio: 3.8 },
        completionRateRegressed: { latestValue: 0.7, previousValue: 0.1, deltaValue: 0.6, deltaRatio: 6 },
        failureRateRegressed: { latestValue: 0.6, previousValue: 0.1, deltaValue: 0.5, deltaRatio: 5 },
        requestArtifactCoverageRegressed: { latestValue: 0.5, previousValue: 0.1, deltaValue: 0.4, deltaRatio: 4 },
        responseArtifactCoverageRegressed: { latestValue: 0.6, previousValue: 0.1, deltaValue: 0.5, deltaRatio: 5 },
        firstTokenLatencyMsAvgRegressed: { latestValue: 0.55, previousValue: 0.15, deltaValue: 0.4, deltaRatio: 2.6667 },
        totalTokensPerSampleRegressed: { latestValue: 0.65, previousValue: 0.1, deltaValue: 0.55, deltaRatio: 5.5 },
      },
    };

    const report = buildGatewayAnalysisAnomalyRemediationEffectivenessAnomalyReport({
      trendReport,
      profileKey: "balanced",
      thresholds: buildGatewayAnalysisAnomalyRemediationEffectivenessThresholdConfig("balanced"),
    });

    assert.equal(report.latestSnapshot?.snapshotId, "snapshot_latest");
    assert.equal(report.previousSnapshot?.snapshotId, "snapshot_previous");
    assert.ok(report.anomalies.some((item) => item.code === "impacted_run_rate_drop"));
    assert.ok(report.anomalies.some((item) => item.code === "unavailable_run_rate_spike"));
    assert.ok(report.anomalies.some((item) => item.code === "completion_effectiveness_regressed"));
    assert.ok(report.anomalies.some((item) => item.code === "token_effectiveness_regressed"));
    assert.ok(report.bySeverity.some((item) => item.key === "critical"));
  });
});
