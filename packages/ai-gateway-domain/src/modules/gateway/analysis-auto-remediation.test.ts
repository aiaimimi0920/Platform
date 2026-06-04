import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayAnalysisAnomalyIncidentView } from "@neuro/contracts";

import {
  resolveGatewayAnalysisAnomalyRemediationSchedule,
  resolveGatewayRoutingAnomalyAutoRemediationConfig,
  resolveGatewayRateLimitHotspotAutoRemediationConfig,
} from "./analysis-auto-remediation";

test("ai-gateway auto remediation schedule", async (t) => {
  await t.test("new escalated incident is due immediately and starts with dry run when enabled", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 180,
      autoRemediationDryRunFirst: true,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 0,
      lastAlertedAt: null,
      providerHealthDegraded: false,
      latestRunStatus: null,
      latestRunDryRun: null,
      latestRunCompletedAt: null,
      latestRunCreatedAt: null,
      now: new Date("2026-04-06T10:00:00.000Z"),
    });

    assert.equal(schedule.remediationDue, true);
    assert.equal(schedule.nextExecutionStatus, "dry_run");
    assert.equal(schedule.nextRunDueAt, null);
    assert.equal(schedule.blockedReason, null);
  });

  await t.test("successful dry run schedules a later apply", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "acknowledged",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: true,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 0,
      lastAlertedAt: "2026-04-06T09:30:00.000Z",
      providerHealthDegraded: false,
      latestRunStatus: "dry_run",
      latestRunDryRun: true,
      latestRunCompletedAt: "2026-04-06T09:00:00.000Z",
      latestRunCreatedAt: "2026-04-06T09:00:00.000Z",
      now: new Date("2026-04-06T10:05:00.000Z"),
    });

    assert.equal(schedule.remediationDue, true);
    assert.equal(schedule.nextExecutionStatus, "applied");
    assert.equal(schedule.nextRunDueAt, "2026-04-06T10:00:00.000Z");
    assert.equal(schedule.blockedReason, null);
  });

  await t.test("applied remediation does not auto-repeat", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: true,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 1,
      lastAlertedAt: "2026-04-06T09:30:00.000Z",
      providerHealthDegraded: false,
      latestRunStatus: "applied",
      latestRunDryRun: false,
      latestRunCompletedAt: "2026-04-06T09:00:00.000Z",
      latestRunCreatedAt: "2026-04-06T09:00:00.000Z",
      now: new Date("2026-04-06T11:05:00.000Z"),
    });

    assert.equal(schedule.remediationDue, false);
    assert.equal(schedule.nextExecutionStatus, null);
    assert.equal(schedule.nextRunDueAt, null);
    assert.equal(schedule.blockedReason, "already_applied");
  });

  await t.test("failed remediation does not auto-repeat without operator intervention", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: false,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 0,
      lastAlertedAt: "2026-04-06T09:30:00.000Z",
      providerHealthDegraded: false,
      latestRunStatus: "failed",
      latestRunDryRun: false,
      latestRunCompletedAt: "2026-04-06T09:00:00.000Z",
      latestRunCreatedAt: "2026-04-06T09:00:00.000Z",
      now: new Date("2026-04-06T11:05:00.000Z"),
    });

    assert.equal(schedule.remediationDue, false);
    assert.equal(schedule.nextExecutionStatus, null);
    assert.equal(schedule.blockedReason, "previous_failure");
  });

  await t.test("blocks apply when alert is required but not yet delivered", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: false,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: true,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 0,
      lastAlertedAt: null,
      providerHealthDegraded: false,
      latestRunStatus: null,
      latestRunDryRun: null,
      latestRunCompletedAt: null,
      latestRunCreatedAt: null,
      now: new Date("2026-04-06T10:00:00.000Z"),
    });

    assert.equal(schedule.remediationDue, false);
    assert.equal(schedule.nextExecutionStatus, "applied");
    assert.equal(schedule.blockedReason, "alert_pending");
  });

  await t.test("blocks apply when provider health is degraded", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: false,
      autoRemediationMaxApplyRunsPerIncident: null,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: true,
      appliedRunCount: 0,
      lastAlertedAt: "2026-04-06T09:30:00.000Z",
      providerHealthDegraded: true,
      latestRunStatus: null,
      latestRunDryRun: null,
      latestRunCompletedAt: null,
      latestRunCreatedAt: null,
      now: new Date("2026-04-06T10:00:00.000Z"),
    });

    assert.equal(schedule.remediationDue, false);
    assert.equal(schedule.nextExecutionStatus, "applied");
    assert.equal(schedule.blockedReason, "provider_health_degraded");
  });

  await t.test("blocks apply when per-incident apply cap is already reached", () => {
    const schedule = resolveGatewayAnalysisAnomalyRemediationSchedule({
      incidentStatus: "open",
      escalationStatus: "escalated",
      autoRemediationEnabled: true,
      actionEnabled: true,
      autoRemediationIntervalMinutes: 60,
      autoRemediationDryRunFirst: true,
      autoRemediationMaxApplyRunsPerIncident: 1,
      autoRemediationRequireAlertBeforeApply: false,
      autoRemediationFreezeOnProviderHealthDegrade: false,
      appliedRunCount: 1,
      lastAlertedAt: "2026-04-06T09:30:00.000Z",
      providerHealthDegraded: false,
      latestRunStatus: "dry_run",
      latestRunDryRun: true,
      latestRunCompletedAt: "2026-04-06T09:00:00.000Z",
      latestRunCreatedAt: "2026-04-06T09:00:00.000Z",
      now: new Date("2026-04-06T10:05:00.000Z"),
    });

    assert.equal(schedule.remediationDue, false);
    assert.equal(schedule.nextExecutionStatus, "applied");
    assert.equal(schedule.blockedReason, "apply_cap_reached");
  });

  await t.test("builds safe default auto remediation config for policy-less hotspot incidents", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_hotspot",
      policyId: null,
      fingerprint: "fp_hotspot",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rate-limit-hotspot:balanced",
      textMode: null,
      code: "rate_limit_api_key_hotspot",
      severity: "critical",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 1,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T10:00:00.000Z",
      escalationReason: "hotspot",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: null,
      lastAlertSeverity: null,
      alertDeliveryCount: 0,
      summary: "hotspot",
      latestExportId: null,
      previousExportId: null,
      latestValue: 0.7,
      previousValue: 0.4,
      deltaValue: 0.3,
      deltaRatio: 0.75,
      thresholdValue: 0.45,
      firstSeenAt: "2026-04-06T09:00:00.000Z",
      lastSeenAt: "2026-04-06T10:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    };

    const config = resolveGatewayRateLimitHotspotAutoRemediationConfig(incident);
    assert.equal(config.autoRemediationEnabled, true);
    assert.deepEqual(config.autoRemediationActionKeys, ["tighten-api-key-rate-limit"]);
    assert.equal(config.autoRemediationDryRunFirst, true);
    assert.equal(config.autoRemediationRequireAlertBeforeApply, true);
    assert.equal(config.autoRemediationMaxApplyRunsPerIncident, 1);
  });

  await t.test("prefers route policy hotspot profile when configured", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_hotspot_route_policy",
      policyId: null,
      fingerprint: "fp_hotspot_route_policy",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rate-limit-hotspot:balanced",
      textMode: null,
      code: "rate_limit_model_hotspot",
      severity: "critical",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 1,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T10:00:00.000Z",
      escalationReason: "hotspot",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: null,
      lastAlertSeverity: null,
      alertDeliveryCount: 0,
      summary: "hotspot",
      latestExportId: null,
      previousExportId: null,
      latestValue: 0.7,
      previousValue: 0.4,
      deltaValue: 0.3,
      deltaRatio: 0.75,
      thresholdValue: 0.45,
      firstSeenAt: "2026-04-06T09:00:00.000Z",
      lastSeenAt: "2026-04-06T10:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    };
    const config = resolveGatewayRateLimitHotspotAutoRemediationConfig(incident, {
      id: "route_1",
      projectId: "project_1",
      name: "Adaptive route policy",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "weighted_random",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 4,
        providerMaxConcurrentRequests: null,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: null,
        allowedProtocolFamilies: null,
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: null,
        rateLimitHotspotAutoRemediation: {
          enabled: true,
          intervalMinutes: 45,
          dryRunFirst: true,
          requireAlertBeforeApply: true,
          freezeOnProviderHealthDegrade: true,
          maxApplyRunsPerIncident: 2,
          actionByCode: {
            rate_limit_model_hotspot: "tighten-project-rate-limit",
          },
        },
        fallbackHttpStatuses: [408, 429, 500],
        fallbackErrorCodes: ["ETIMEDOUT"],
      },
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    assert.equal(config.autoRemediationEnabled, true);
    assert.equal(config.autoRemediationIntervalMinutes, 45);
    assert.equal(config.autoRemediationMaxApplyRunsPerIncident, 2);
    assert.deepEqual(config.autoRemediationActionKeys, ["tighten-project-rate-limit"]);
  });

  await t.test("builds safe default auto remediation config for policy-less routing anomalies", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_routing_default",
      policyId: null,
      fingerprint: "fp_routing_default",
      projectId: "project_1",
      routePolicyId: "route_1",
      tag: "rolling",
      textMode: "preview_redacted",
      code: "failure_rate_spike",
      severity: "critical",
      status: "open",
      ownerUserId: null,
      followUpStatus: "pending",
      syncHitCount: 2,
      escalationStatus: "escalated",
      escalatedAt: "2026-04-06T10:00:00.000Z",
      escalationReason: "routing anomaly",
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
      latestValue: 0.31,
      previousValue: 0.1,
      deltaValue: 0.21,
      deltaRatio: 2.1,
      thresholdValue: 0.15,
      firstSeenAt: "2026-04-06T09:00:00.000Z",
      lastSeenAt: "2026-04-06T10:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    };

    const config = resolveGatewayRoutingAnomalyAutoRemediationConfig(incident, {
      id: "route_1",
      projectId: "project_1",
      name: "Routing guard",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "weighted_random",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 4,
        providerMaxConcurrentRequests: 2,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: ["provider_a", "provider_b"],
        allowedProtocolFamilies: null,
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: null,
        rateLimitHotspotAutoRemediation: null,
        fallbackHttpStatuses: [408, 429, 500],
        fallbackErrorCodes: ["ETIMEDOUT"],
      },
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    assert.equal(config.autoRemediationEnabled, true);
    assert.equal(config.autoRemediationDryRunFirst, true);
    assert.equal(config.autoRemediationRequireAlertBeforeApply, true);
    assert.equal(config.autoRemediationMaxApplyRunsPerIncident, 1);
    assert.deepEqual(config.autoRemediationActionKeys, [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ]);
  });

  await t.test("prefers route policy routing profile when configured", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_routing_profile",
      policyId: null,
      fingerprint: "fp_routing_profile",
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
      escalatedAt: "2026-04-06T10:00:00.000Z",
      escalationReason: "routing anomaly",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: "2026-04-06T10:05:00.000Z",
      lastAlertSeverity: "danger",
      alertDeliveryCount: 1,
      summary: "completion rate drop",
      latestExportId: "export_2",
      previousExportId: "export_1",
      latestValue: 0.62,
      previousValue: 0.82,
      deltaValue: -0.2,
      deltaRatio: -0.2439,
      thresholdValue: 0.75,
      firstSeenAt: "2026-04-06T09:00:00.000Z",
      lastSeenAt: "2026-04-06T10:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    };

    const config = resolveGatewayRoutingAnomalyAutoRemediationConfig(incident, {
      id: "route_1",
      projectId: "project_1",
      name: "Adaptive routing profile",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "weighted_random",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 4,
        providerMaxConcurrentRequests: 2,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: ["provider_a", "provider_b"],
        allowedProtocolFamilies: null,
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: {
          enabled: true,
          intervalMinutes: 30,
          dryRunFirst: true,
          requireAlertBeforeApply: true,
          freezeOnProviderHealthDegrade: true,
          maxApplyRunsPerIncident: 2,
          actionKeysByCode: {
            completion_rate_drop: ["reduce-provider-concurrency"],
          },
        },
        rateLimitHotspotAutoRemediation: null,
        fallbackHttpStatuses: [408, 429, 500],
        fallbackErrorCodes: ["ETIMEDOUT"],
      },
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    assert.equal(config.autoRemediationEnabled, true);
    assert.equal(config.autoRemediationIntervalMinutes, 30);
    assert.equal(config.autoRemediationMaxApplyRunsPerIncident, 2);
    assert.deepEqual(config.autoRemediationActionKeys, ["reduce-provider-concurrency"]);
  });

  await t.test("builds safe default auto remediation config for provider routing anomalies", () => {
    const incident: GatewayAnalysisAnomalyIncidentView = {
      id: "incident_provider_routing_default",
      policyId: null,
      fingerprint: "fp_provider_routing_default",
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
      escalatedAt: "2026-04-06T10:00:00.000Z",
      escalationReason: "provider routing anomaly",
      latestNote: null,
      resolutionNote: null,
      lastActionAt: null,
      lastAlertAttemptAt: null,
      lastAlertedAt: "2026-04-06T10:05:00.000Z",
      lastAlertSeverity: "danger",
      alertDeliveryCount: 1,
      summary: "degraded provider route spike",
      latestExportId: null,
      previousExportId: null,
      latestValue: 0.72,
      previousValue: null,
      deltaValue: null,
      deltaRatio: null,
      thresholdValue: 0.3,
      firstSeenAt: "2026-04-06T09:00:00.000Z",
      lastSeenAt: "2026-04-06T10:00:00.000Z",
      acknowledgedAt: null,
      resolvedAt: null,
      createdAt: "2026-04-06T09:00:00.000Z",
      updatedAt: "2026-04-06T10:00:00.000Z",
    };

    const config = resolveGatewayRoutingAnomalyAutoRemediationConfig(incident, {
      id: "route_1",
      projectId: "project_1",
      name: "Adaptive routing profile",
      isDefault: true,
      enabled: true,
      config: {
        stickySessions: true,
        preStreamFallbackEnabled: true,
        selectionStrategy: "weighted_random",
        providerLoadAwareRoutingEnabled: true,
        maxConcurrentRequests: 4,
        providerMaxConcurrentRequests: 2,
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 30,
        apiKeyRateLimit: null,
        modelRateLimits: null,
        endpointRateLimits: null,
        circuitBreakerThreshold: 3,
        circuitBreakerCooldownSeconds: 60,
        allowedProviderAccountIds: ["provider_a", "provider_b"],
        allowedProtocolFamilies: null,
        allowedModelIds: null,
        blockedModelIds: null,
        maxRequestBodyBytes: null,
        streamIdleTimeoutSeconds: null,
        totalRequestTimeoutSeconds: null,
        maxStreamHeartbeatGapSeconds: null,
        routingAnomalyAutoRemediation: null,
        rateLimitHotspotAutoRemediation: null,
        fallbackHttpStatuses: [408, 429, 500],
        fallbackErrorCodes: ["ETIMEDOUT"],
      },
      createdAt: "2026-04-06T08:00:00.000Z",
      updatedAt: "2026-04-06T08:00:00.000Z",
    });

    assert.equal(config.autoRemediationEnabled, true);
    assert.deepEqual(config.autoRemediationActionKeys, [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ]);
  });
});
