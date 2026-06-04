import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCallbackRemediationRuntimeCorrelationSummary,
  buildCallbackRemediationAlertBuckets,
  buildCallbackRemediationAlerts,
  buildCallbackRemediationRecommendations,
} from "./operator-remediation-analysis";

describe("buildCallbackRemediationRuntimeCorrelationSummary", () => {
  it("builds stable runtime-aware buckets from callback execution context", () => {
    const summary = buildCallbackRemediationRuntimeCorrelationSummary([
      {
        runtimeDecisionClass: "artifact_finalize_early_timeout",
        runtimeDecisionSeverity: "warning",
        runtimePressureLevel: "critical",
        runtimeSchedulingDecisionClass: "profile_saturated",
      },
      {
        runtimeDecisionClass: "artifact_finalize_early_timeout",
        runtimeDecisionSeverity: "warning",
        runtimePressureLevel: "critical",
        runtimeSchedulingDecisionClass: "profile_and_owner_saturated",
      },
      {
        runtimeDecisionClass: "artifact_partial_finalize_blocked",
        runtimeDecisionSeverity: "critical",
        runtimePressureLevel: "watch",
        runtimeSchedulingDecisionClass: "owner_hotspot",
      },
      {
        runtimeDecisionClass: null,
        runtimeDecisionSeverity: null,
        runtimePressureLevel: "healthy",
        runtimeSchedulingDecisionClass: "within_capacity",
      },
      null,
    ]);

    assert.equal(summary.runtimeDecisionPresentCount, 3);
    assert.equal(summary.runtimePressureContextCount, 4);
    assert.deepEqual(summary.byRuntimeDecisionClass, [
      { key: "artifact_finalize_early_timeout", count: 2 },
      { key: "artifact_partial_finalize_blocked", count: 1 },
    ]);
    assert.deepEqual(summary.byRuntimeDecisionSeverity, [
      { key: "warning", count: 2 },
      { key: "critical", count: 1 },
    ]);
    assert.deepEqual(summary.byRuntimePressureLevel, [
      { key: "critical", count: 2 },
      { key: "healthy", count: 1 },
      { key: "watch", count: 1 },
    ]);
    assert.deepEqual(summary.byRuntimeSchedulingDecisionClass, [
      { key: "owner_hotspot", count: 1 },
      { key: "profile_and_owner_saturated", count: 1 },
      { key: "profile_saturated", count: 1 },
      { key: "within_capacity", count: 1 },
    ]);
  });
});

describe("buildCallbackRemediationRecommendations", () => {
  it("returns no recommendations when there is no remediation backlog", () => {
    const recommendations = buildCallbackRemediationRecommendations({
      candidateCount: 0,
      bySkipReason: [],
      byFailureReason: [],
      byPolicyKey: [],
    });

    assert.deepEqual(recommendations, []);
  });

  it("builds stable remediation playbooks from skip and failure buckets", () => {
    const summary: Parameters<typeof buildCallbackRemediationRecommendations>[0] = {
      candidateCount: 12,
      bySkipReason: [
        { key: "missing_payload", count: 4 },
        { key: "policy_disabled", count: 2 },
        { key: "policy_budget_exhausted", count: 3 },
        { key: "target_unavailable", count: 1 },
        { key: "missing_agent", count: 2 },
        { key: "duplicate_cooldown", count: 9 },
      ],
      byFailureReason: [{ key: "attempt_failed", count: 3 }],
      byPolicyKey: [
        { key: "manual_only", count: 2 },
        { key: "balanced", count: 7 },
        { key: "aggressive", count: 3 },
      ],
      reasonPolicyRows: [
        { policyKey: "balanced" as const, reason: "Socket timeout while replaying callback payload", count: 3 },
        {
          policyKey: "balanced" as const,
          reason: "Automatic remediation skipped because stored payload replay is unavailable and fallback retry requests are disabled for this callback.",
          count: 4,
        },
        {
          policyKey: "manual_only" as const,
          reason: "Automatic remediation is disabled by agent policy 'manual_only'.",
          count: 2,
        },
        { policyKey: "aggressive" as const, reason: "Automatic remediation exhausted its retry budget.", count: 3 },
        {
          policyKey: "balanced" as const,
          reason: "A callback payload replay was already recorded recently for this audit",
          count: 9,
        },
        {
          policyKey: "safe_retry" as const,
          reason: "External agent callback secret is unavailable for payload replay",
          count: 1,
        },
        {
          policyKey: "safe_retry" as const,
          reason: "Automatic remediation skipped because the linked agent is missing or no longer external.",
          count: 2,
        },
      ],
    };
    const recommendations = buildCallbackRemediationRecommendations(summary);
    const alerts = buildCallbackRemediationAlerts(summary);
    const alertBuckets = buildCallbackRemediationAlertBuckets(summary);

    assert.equal(recommendations.length, 6);
    assert.equal(recommendations[0]?.reasonCategory, "attempt_failed");
    assert.equal(recommendations[0]?.reasonDisposition, "failed");
    assert.equal(recommendations[0]?.severity, "danger");
    assert.equal(recommendations[0]?.policyKey, "balanced");
    assert.equal(recommendations[1]?.reasonCategory, "missing_payload");
    assert.equal(recommendations[1]?.policyKey, "balanced");
    assert.equal(recommendations[2]?.reasonCategory, "policy_disabled");
    assert.equal(recommendations[2]?.policyKey, "manual_only");
    assert.equal(recommendations[3]?.reasonCategory, "policy_budget_exhausted");
    assert.equal(recommendations[3]?.policyKey, "aggressive");
    assert.equal(recommendations[4]?.reasonCategory, "missing_agent");
    assert.equal(recommendations[4]?.reasonDisposition, "skipped");
    assert.equal(recommendations[4]?.policyKey, "safe_retry");
    assert.equal(recommendations[5]?.reasonCategory, "duplicate_cooldown");
    assert.equal(recommendations[5]?.severity, "danger");
    assert.equal(recommendations[5]?.policyKey, "balanced");

    assert.deepEqual(alertBuckets, [
      { key: "3", count: 6 },
      { key: "2", count: 14 },
      { key: "1", count: 4 },
    ]);
    assert.equal(alerts.length, 6);
    assert.equal(alerts[0]?.reasonCategory, "attempt_failed");
    assert.equal(alerts[0]?.alertLevel, 3);
    assert.equal(alerts[0]?.policyKey, "balanced");
    assert.equal(alerts[1]?.reasonCategory, "policy_budget_exhausted");
    assert.equal(alerts[1]?.alertLevel, 3);
    assert.equal(alerts[1]?.policyKey, "aggressive");
    assert.equal(alerts[2]?.reasonCategory, "policy_disabled");
    assert.equal(alerts[2]?.alertLevel, 2);
    assert.equal(alerts[2]?.policyKey, "manual_only");
    assert.equal(alerts[3]?.reasonCategory, "missing_agent");
    assert.equal(alerts[3]?.alertLevel, 2);
    assert.equal(alerts[3]?.policyKey, "safe_retry");
    assert.equal(alerts[4]?.reasonCategory, "missing_payload");
    assert.equal(alerts[4]?.alertLevel, 1);
    assert.equal(alerts[4]?.policyKey, "balanced");
    assert.equal(alerts[5]?.reasonCategory, "duplicate_cooldown");
    assert.equal(alerts[5]?.alertLevel, 2);
    assert.equal(alerts[5]?.policyKey, "balanced");
  });
});
