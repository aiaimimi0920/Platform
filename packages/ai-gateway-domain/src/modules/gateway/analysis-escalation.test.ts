import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyPolicyView } from "@neuro/contracts";

import {
  resolveGatewayAnalysisAnomalyAutoEscalation,
  resolveGatewayRateLimitHotspotAutoEscalation,
} from "./analysis-escalation";

const basePolicy: GatewayAnalysisAnomalyPolicyView = {
  id: "policy_1",
  name: "Critical guard",
  status: "enabled",
  projectId: "project_1",
  routePolicyId: null,
  tag: "rolling",
  textMode: "preview_redacted",
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
  autoRemediationEnabled: false,
  autoRemediationIntervalMinutes: null,
  autoRemediationDryRunFirst: true,
  autoRemediationActionKeys: null,
  autoRemediationMaxApplyRunsPerIncident: null,
  autoRemediationRequireAlertBeforeApply: false,
  autoRemediationFreezeOnProviderHealthDegrade: true,
  alertingEnabled: true,
  alertIntervalMinutes: 180,
  notifyOperatorsOnEscalation: true,
  notifyOwnerOnEscalation: true,
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
};

describe("ai-gateway analysis escalation", () => {
  it("does not escalate below configured severity", () => {
    const result = resolveGatewayAnalysisAnomalyAutoEscalation({
      policy: basePolicy,
      anomalySeverity: "warning",
      syncHitCount: 5,
    });
    assert.equal(result.shouldEscalate, false);
  });

  it("does not escalate before enough sync hits", () => {
    const result = resolveGatewayAnalysisAnomalyAutoEscalation({
      policy: basePolicy,
      anomalySeverity: "critical",
      syncHitCount: 1,
    });
    assert.equal(result.shouldEscalate, false);
  });

  it("escalates once thresholds are met", () => {
    const result = resolveGatewayAnalysisAnomalyAutoEscalation({
      policy: basePolicy,
      anomalySeverity: "critical",
      syncHitCount: 2,
    });
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.ownerUserId, "ops_1");
    assert.equal(result.followUpStatus, "investigating");
    assert.match(result.reason ?? "", /Auto escalated/);
  });

  it("escalates critical hotspot anomalies immediately without a policy", () => {
    const result = resolveGatewayRateLimitHotspotAutoEscalation({
      anomalySeverity: "critical",
      syncHitCount: 1,
    });
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.followUpStatus, "investigating");
  });

  it("waits for repeated hits before escalating warning hotspot anomalies", () => {
    const early = resolveGatewayRateLimitHotspotAutoEscalation({
      anomalySeverity: "warning",
      syncHitCount: 2,
    });
    assert.equal(early.shouldEscalate, false);

    const ready = resolveGatewayRateLimitHotspotAutoEscalation({
      anomalySeverity: "warning",
      syncHitCount: 3,
    });
    assert.equal(ready.shouldEscalate, true);
    assert.equal(ready.followUpStatus, "monitoring");
  });
});
