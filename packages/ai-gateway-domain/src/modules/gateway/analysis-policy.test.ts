import test from "node:test";
import assert from "node:assert/strict";

import { buildGatewayAnalysisAnomalyPolicySummary, resolveGatewayAnalysisAnomalyPolicySchedule } from "./analysis-policy";

test("ai-gateway analysis policy schedule", async (t) => {
  await t.test("computes due state from last synced timestamp", () => {
    const schedule = resolveGatewayAnalysisAnomalyPolicySchedule({
      status: "enabled",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 30,
      lastSyncedAt: "2026-04-06T00:00:00.000Z",
      now: new Date("2026-04-06T00:45:00.000Z"),
    });

    assert.equal(schedule.nextSyncDueAt, "2026-04-06T00:30:00.000Z");
    assert.equal(schedule.syncDue, true);
  });

  await t.test("treats never-synced enabled auto policy as due immediately", () => {
    const schedule = resolveGatewayAnalysisAnomalyPolicySchedule({
      status: "enabled",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: null,
      lastSyncedAt: null,
      now: new Date("2026-04-06T00:00:00.000Z"),
    });

    assert.equal(schedule.nextSyncDueAt, null);
    assert.equal(schedule.syncDue, true);
  });

  await t.test("summarizes policy statuses and sync readiness", () => {
    const summary = buildGatewayAnalysisAnomalyPolicySummary([
      {
        id: "p1",
        name: "A",
        status: "enabled",
        projectId: null,
        routePolicyId: null,
        tag: null,
        textMode: null,
        profileKey: "balanced",
        thresholds: {
          failureRateWarningThreshold: 0.05,
          failureRateCriticalThreshold: 0.1,
          failureRateDeltaRatioThreshold: 0.5,
          completionRateWarningThreshold: 0.9,
          completionRateCriticalThreshold: 0.75,
          completionRateDeltaValueThreshold: 0.1,
          responseArtifactCoverageWarningThreshold: 0.9,
          responseArtifactCoverageCriticalThreshold: 0.75,
          responseArtifactCoverageDeltaValueThreshold: 0.1,
          requestArtifactCoverageWarningThreshold: 0.9,
          requestArtifactCoverageCriticalThreshold: 0.75,
          requestArtifactCoverageDeltaValueThreshold: 0.1,
          tokensPerSampleWarningDeltaRatioThreshold: 0.3,
          tokensPerSampleCriticalDeltaRatioThreshold: 0.6,
          tokensPerSampleCriticalAbsoluteThreshold: 10000,
        },
        autoSyncEnabled: true,
        autoSyncIntervalMinutes: 60,
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        nextSyncDueAt: null,
        syncDue: true,
        autoEscalateEnabled: true,
        escalateSeverityThreshold: "critical",
        escalateAfterSyncCount: 2,
        autoEscalateOwnerUserId: "ops_1",
        autoEscalateFollowUpStatus: "investigating",
        autoRemediationEnabled: true,
        autoRemediationIntervalMinutes: 180,
        autoRemediationDryRunFirst: true,
        autoRemediationActionKeys: ["disable-prestream-fallback"],
        autoRemediationMaxApplyRunsPerIncident: 1,
        autoRemediationRequireAlertBeforeApply: false,
        autoRemediationFreezeOnProviderHealthDegrade: true,
        alertingEnabled: true,
        alertIntervalMinutes: 180,
        notifyOperatorsOnEscalation: true,
        notifyOwnerOnEscalation: true,
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
      {
        id: "p2",
        name: "B",
        status: "disabled",
        projectId: null,
        routePolicyId: null,
        tag: null,
        textMode: null,
        profileKey: "balanced",
        thresholds: {
          failureRateWarningThreshold: 0.05,
          failureRateCriticalThreshold: 0.1,
          failureRateDeltaRatioThreshold: 0.5,
          completionRateWarningThreshold: 0.9,
          completionRateCriticalThreshold: 0.75,
          completionRateDeltaValueThreshold: 0.1,
          responseArtifactCoverageWarningThreshold: 0.9,
          responseArtifactCoverageCriticalThreshold: 0.75,
          responseArtifactCoverageDeltaValueThreshold: 0.1,
          requestArtifactCoverageWarningThreshold: 0.9,
          requestArtifactCoverageCriticalThreshold: 0.75,
          requestArtifactCoverageDeltaValueThreshold: 0.1,
          tokensPerSampleWarningDeltaRatioThreshold: 0.3,
          tokensPerSampleCriticalDeltaRatioThreshold: 0.6,
          tokensPerSampleCriticalAbsoluteThreshold: 10000,
        },
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: null,
        lastSyncedAt: "2026-04-06T00:00:00.000Z",
        lastSyncStatus: "error",
        lastSyncError: "boom",
        nextSyncDueAt: null,
        syncDue: false,
        autoEscalateEnabled: false,
        escalateSeverityThreshold: null,
        escalateAfterSyncCount: null,
        autoEscalateOwnerUserId: null,
        autoEscalateFollowUpStatus: null,
        autoRemediationEnabled: false,
        autoRemediationIntervalMinutes: null,
        autoRemediationDryRunFirst: true,
        autoRemediationActionKeys: null,
        autoRemediationMaxApplyRunsPerIncident: null,
        autoRemediationRequireAlertBeforeApply: false,
        autoRemediationFreezeOnProviderHealthDegrade: true,
        alertingEnabled: false,
        alertIntervalMinutes: null,
        notifyOperatorsOnEscalation: false,
        notifyOwnerOnEscalation: false,
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
      },
    ]);

    assert.equal(summary.totalPolicies, 2);
    assert.equal(summary.enabledPolicies, 1);
    assert.equal(summary.disabledPolicies, 1);
    assert.equal(summary.autoSyncEnabledPolicies, 1);
    assert.equal(summary.autoEscalateEnabledPolicies, 1);
    assert.equal(summary.autoRemediationEnabledPolicies, 1);
    assert.equal(summary.alertingEnabledPolicies, 1);
    assert.equal(summary.duePolicies, 1);
    assert.deepEqual(summary.byStatus, [
      { key: "disabled", count: 1 },
      { key: "enabled", count: 1 },
    ]);
    assert.deepEqual(summary.bySyncStatus, [{ key: "error", count: 1 }]);
  });
});
