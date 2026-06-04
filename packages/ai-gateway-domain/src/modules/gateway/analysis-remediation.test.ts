import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyIncidentView, GatewayAnalysisAnomalyPolicyView, GatewayRoutePolicyView } from "@neuro/contracts";

import { buildGatewayAnalysisAnomalyIncidentRemediationPlan } from "./analysis-remediation";

const routePolicy: GatewayRoutePolicyView = {
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
      maxConcurrentRequests: 10,
      providerMaxConcurrentRequests: 3,
      rateLimitWindowSeconds: null,
      rateLimitMaxRequests: null,
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
    fallbackErrorCodes: ["upstream_error"],
  },
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
};

const policy: GatewayAnalysisAnomalyPolicyView = {
  id: "policy_1",
  name: "routing-alerts",
  status: "enabled",
  projectId: "project_1",
  routePolicyId: "route_1",
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
  autoRemediationEnabled: true,
  autoRemediationIntervalMinutes: 180,
  autoRemediationDryRunFirst: true,
  autoRemediationActionKeys: ["owner-followup", "disable-prestream-fallback"],
  autoRemediationMaxApplyRunsPerIncident: 1,
  autoRemediationRequireAlertBeforeApply: false,
  autoRemediationFreezeOnProviderHealthDegrade: true,
  alertingEnabled: true,
  alertIntervalMinutes: 180,
  notifyOperatorsOnEscalation: true,
  notifyOwnerOnEscalation: true,
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
};

describe("ai-gateway remediation plan", () => {
  it("produces routing remediation for failure anomalies", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_1",
      policyId: "policy_1",
      fingerprint: "fp_1",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rolling",
      textMode: "preview_redacted",
      code: "failure_rate_spike",
      severity: "critical",
      status: "open",
      ownerUserId: "ops_1",
      followUpStatus: "investigating",
      syncHitCount: 2,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T01:00:00.000Z",
      escalationReason: "Auto escalated after 2 sync hit(s) at severity critical.",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: null,
      lastAlertSeverity: null,
      alertDeliveryCount: 0,
      summary: "failure spike",
      latestExportId: "export_2",
      previousExportId: "export_1",
      latestValue: 0.3,
      previousValue: 0.1,
      deltaValue: 0.2,
      deltaRatio: 2,
      thresholdValue: 0.15,
      firstSeenAt: "2026-04-06T00:00:00.000Z",
      lastSeenAt: "2026-04-06T01:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T01:00:00.000Z",
    };

    const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: "2026-04-06T01:05:00.000Z",
      incident,
      policy,
      routePolicy,
    });

    assert.equal(plan.incident.id, "incident_1");
    assert.equal(plan.actions.some((item) => item.actionKey === "routing-review"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "disable-prestream-fallback"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "reduce-provider-concurrency"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "provider-isolation"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "owner-followup"), true);
    assert.equal(plan.actions.find((item) => item.actionKey === "owner-followup")?.executable, true);
    assert.equal(plan.actions.find((item) => item.actionKey === "routing-review")?.executable, false);
  });

  it("produces hotspot remediation for rate-limit anomalies without an anomaly policy", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_hotspot",
      policyId: null,
      fingerprint: "fp_hotspot",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rate-limit-hotspot:balanced",
      textMode: null,
      code: "rate_limit_model_hotspot",
      severity: "warning",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 1,
      escalationStatus: "none",
      escalatedAt: null,
      escalationReason: null,
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: null,
      lastAlertSeverity: null,
      alertDeliveryCount: 0,
      summary: "model hotspot",
      latestExportId: null,
      previousExportId: null,
      latestValue: 0.78,
      previousValue: 0.42,
      deltaValue: 0.36,
      deltaRatio: 0.36 / 0.42,
      thresholdValue: 0.6,
      firstSeenAt: "2026-04-06T00:00:00.000Z",
      lastSeenAt: "2026-04-06T01:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T01:00:00.000Z",
    };

    const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: "2026-04-06T01:05:00.000Z",
      incident,
      policy: null,
      routePolicy,
      incidentContext: {
        entityKey: "gpt-5.4",
        snapshotId: "snapshot_hotspot_1",
      },
    });

    assert.equal(plan.actions.some((item) => item.actionKey === "rate-limit-policy-review"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "rate-limit-offender-triage"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "tighten-model-rate-limit"), true);
    assert.equal(plan.actions.find((item) => item.actionKey === "tighten-model-rate-limit")?.executable, true);
    assert.equal(plan.actions.some((item) => item.actionKey === "bind-route-policy"), false);
  });

  it("produces routing remediation for completion anomalies", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_completion",
      policyId: null,
      fingerprint: "fp_completion",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rolling",
      textMode: "preview_redacted",
      code: "completion_rate_drop",
      severity: "critical",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 2,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T01:00:00.000Z",
      escalationReason: "Auto escalated after repeated completion drops.",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: "2026-04-06T01:05:00.000Z",
      lastAlertSeverity: "danger",
      alertDeliveryCount: 1,
      summary: "completion drop",
      latestExportId: "export_4",
      previousExportId: "export_3",
      latestValue: 0.61,
      previousValue: 0.84,
      deltaValue: -0.23,
      deltaRatio: -0.2738,
      thresholdValue: 0.75,
      firstSeenAt: "2026-04-06T00:00:00.000Z",
      lastSeenAt: "2026-04-06T01:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T01:00:00.000Z",
    };

    const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: "2026-04-06T01:05:00.000Z",
      incident,
      policy: null,
      routePolicy,
    });

    assert.equal(plan.actions.some((item) => item.actionKey === "disable-prestream-fallback"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "reduce-provider-concurrency"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "provider-isolation"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "owner-followup"), true);
  });

  it("produces provider routing remediation for degraded routing anomalies", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_provider_routing",
      policyId: null,
      fingerprint: "fp_provider_routing",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "provider-routing:balanced",
      textMode: null,
      code: "degraded_provider_route_spike",
      severity: "critical",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 2,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T01:00:00.000Z",
      escalationReason: "Provider routing auto escalated.",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: "2026-04-06T01:05:00.000Z",
      lastAlertSeverity: "danger",
      alertDeliveryCount: 1,
      summary: "degraded provider route spike",
      latestExportId: null,
      previousExportId: null,
      latestValue: 0.67,
      previousValue: null,
      deltaValue: null,
      deltaRatio: null,
      thresholdValue: 0.3,
      firstSeenAt: "2026-04-06T00:00:00.000Z",
      lastSeenAt: "2026-04-06T01:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T01:00:00.000Z",
    };

    const plan = buildGatewayAnalysisAnomalyIncidentRemediationPlan({
      generatedAt: "2026-04-06T01:05:00.000Z",
      incident,
      policy: null,
      routePolicy,
    });

    assert.equal(plan.actions.some((item) => item.actionKey === "provider-routing-review"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "disable-prestream-fallback"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "reduce-provider-concurrency"), true);
    assert.equal(plan.actions.some((item) => item.actionKey === "provider-isolation"), true);
  });
});
