import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView } from "@neuro/contracts";

import {
  buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint,
  buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport,
} from "./analysis-remediation-snapshot-trend";

function createSnapshot(
  snapshotId: string,
  overrides: Partial<GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView> = {},
): GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView {
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
      failureRate: { improvedRuns: 5, regressedRuns: 2, neutralRuns: 1, unavailableRuns: 2 },
      requestArtifactCoverage: { improvedRuns: 5, regressedRuns: 2, neutralRuns: 1, unavailableRuns: 2 },
      responseArtifactCoverage: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      firstTokenLatencyMsAvg: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      totalTokensPerSample: { improvedRuns: 5, regressedRuns: 2, neutralRuns: 1, unavailableRuns: 2 },
      actions: [],
    },
    ...overrides,
  };
}

describe("ai-gateway remediation effectiveness snapshot trend", () => {
  it("builds point ratios and latest-vs-previous summary", () => {
    const latest = buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint(createSnapshot("snapshot_latest"));
    const previous = buildGatewayAnalysisAnomalyRemediationEffectivenessTrendPoint(
      createSnapshot("snapshot_previous", {
        summary: {
          ...createSnapshot("tmp").summary,
          totalRuns: 8,
          impactedRuns: 7,
          unavailableRuns: 1,
          completionRate: { improvedRuns: 6, regressedRuns: 1, neutralRuns: 0, unavailableRuns: 1 },
          responseArtifactCoverage: { improvedRuns: 6, regressedRuns: 1, neutralRuns: 0, unavailableRuns: 1 },
        },
      }),
    );

    const report = buildGatewayAnalysisAnomalyRemediationEffectivenessTrendReport({
      generatedAt: "2026-04-06T12:30:00.000Z",
      filters: {
        label: null,
        routePolicyId: "route_1",
        actionKey: "reduce-provider-concurrency",
        createdFrom: null,
        createdTo: null,
      },
      windowSize: 10,
      inventorySummary: {
        totalSnapshots: 2,
        totalRuns: 18,
        totalImpactedRuns: 15,
        totalUnavailableRuns: 3,
        byRoutePolicyId: [{ key: "route_1", count: 2 }],
        byActionKey: [{ key: "reduce-provider-concurrency", count: 2 }],
        byExecutionMode: [{ key: "route_policy_patch", count: 2 }],
        byLabel: [],
      },
      points: [latest, previous],
    });

    assert.equal(report.points[0]?.impactedRunRate, 0.8);
    assert.equal(report.points[0]?.completionRate.regressedRate, 0.3);
    assert.equal(report.summary?.latestSnapshotId, "snapshot_latest");
    assert.equal(report.summary?.previousSnapshotId, "snapshot_previous");
    assert.equal(report.summary?.unavailableRunRate.latestValue, 0.2);
    assert.equal(report.summary?.completionRateRegressed.latestValue, 0.3);
    assert.equal(report.summary?.completionRateRegressed.previousValue, 0.125);
  });
});
