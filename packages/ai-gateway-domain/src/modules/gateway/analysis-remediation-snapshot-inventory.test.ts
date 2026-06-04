import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyRemediationEffectivenessSnapshotView } from "@neuro/contracts";

import { buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary } from "./analysis-remediation-snapshot-inventory";

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
      failureRate: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      requestArtifactCoverage: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      responseArtifactCoverage: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      firstTokenLatencyMsAvg: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      totalTokensPerSample: { improvedRuns: 4, regressedRuns: 3, neutralRuns: 1, unavailableRuns: 2 },
      actions: [],
    },
    ...overrides,
  };
}

describe("ai-gateway remediation effectiveness snapshot inventory", () => {
  it("aggregates snapshot counts and buckets", () => {
    const summary = buildGatewayAnalysisAnomalyRemediationEffectivenessSnapshotInventorySummary({
      snapshots: [
        createSnapshot("snapshot_1"),
        createSnapshot("snapshot_2", {
          label: "nightly",
          filters: {
            ...createSnapshot("tmp").filters,
            routePolicyId: "route_2",
            actionKey: "provider-isolation",
            executionMode: "incident_follow_up",
          },
          summary: {
            ...createSnapshot("tmp").summary,
            totalRuns: 6,
            impactedRuns: 4,
            unavailableRuns: 2,
          },
        }),
      ],
    });

    assert.equal(summary.totalSnapshots, 2);
    assert.equal(summary.totalRuns, 16);
    assert.equal(summary.totalImpactedRuns, 12);
    assert.equal(summary.totalUnavailableRuns, 4);
    assert.equal(summary.byRoutePolicyId.find((item) => item.key === "route_1")?.count, 1);
    assert.equal(summary.byRoutePolicyId.find((item) => item.key === "route_2")?.count, 1);
    assert.equal(summary.byActionKey.find((item) => item.key === "provider-isolation")?.count, 1);
    assert.equal(summary.byExecutionMode.find((item) => item.key === "incident_follow_up")?.count, 1);
  });
});
