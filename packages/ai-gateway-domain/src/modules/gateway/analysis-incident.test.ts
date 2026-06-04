import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GatewayAnalysisAnomalyIncidentView } from "@neuro/contracts";

import {
  buildGatewayAnalysisAnomalyIncidentFingerprint,
  buildGatewayAnalysisAnomalyIncidentSummary,
} from "./analysis-incident";

describe("ai-gateway analysis incident helpers", () => {
  it("builds stable fingerprints for policy and adhoc scopes", () => {
    assert.equal(
      buildGatewayAnalysisAnomalyIncidentFingerprint({
        policyId: "policy_1",
        projectId: "project_1",
        tag: "rolling",
        textMode: "preview_redacted",
        code: "failure_rate_spike",
      }),
      "policy:policy_1:code:failure_rate_spike",
    );
    assert.equal(
      buildGatewayAnalysisAnomalyIncidentFingerprint({
        policyId: null,
        projectId: "project_1",
        routePolicyId: "route_1",
        tag: "rolling",
        textMode: "preview_redacted",
        code: "failure_rate_spike",
      }),
      "adhoc:project:project_1:routePolicy:route_1:tag:rolling:textMode:preview_redacted:code:failure_rate_spike",
    );
  });

  it("summarizes incidents by status severity and code", () => {
    const incidents: GatewayAnalysisAnomalyIncidentView[] = [
      {
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
        ownerUserId: "user_1",
        followUpStatus: "investigating",
        syncHitCount: 3,
        escalationStatus: "escalated",
        escalatedAt: "2026-04-06T12:00:30.000Z",
        escalationReason: "Auto escalated after 3 sync hit(s) at severity critical.",
        latestNote: "checking rollout",
        resolutionNote: null,
        lastActionAt: "2026-04-06T12:01:00.000Z",
        lastAlertAttemptAt: "2026-04-06T12:02:00.000Z",
        lastAlertedAt: "2026-04-06T12:02:00.000Z",
        lastAlertSeverity: "danger",
        alertDeliveryCount: 1,
        summary: "failure spike",
        latestExportId: "export_2",
        previousExportId: "export_1",
        latestValue: 0.3,
        previousValue: 0.1,
        deltaValue: 0.2,
        deltaRatio: 2,
        thresholdValue: 0.15,
        firstSeenAt: "2026-04-06T12:00:00.000Z",
        lastSeenAt: "2026-04-06T12:00:00.000Z",
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:00:00.000Z",
      },
      {
        id: "incident_2",
        policyId: null,
        fingerprint: "fp_2",
        projectId: "project_1",
        routePolicyId: null,
        tag: "rolling",
        textMode: "preview_redacted",
        code: "tokens_per_sample_spike",
        severity: "warning",
        status: "acknowledged",
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
        summary: "token spike",
        latestExportId: "export_2",
        previousExportId: "export_1",
        latestValue: 190,
        previousValue: 120,
        deltaValue: 70,
        deltaRatio: 70 / 120,
        thresholdValue: 0.35,
        firstSeenAt: "2026-04-06T12:00:00.000Z",
        lastSeenAt: "2026-04-06T12:00:00.000Z",
        acknowledgedAt: "2026-04-06T12:05:00.000Z",
        resolvedAt: null,
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:05:00.000Z",
      },
    ];

    const summary = buildGatewayAnalysisAnomalyIncidentSummary(incidents);
    assert.equal(summary.totalIncidents, 2);
    assert.equal(summary.openIncidents, 1);
    assert.equal(summary.acknowledgedIncidents, 1);
    assert.equal(summary.escalatedIncidents, 1);
    assert.equal(summary.bySeverity.find((item) => item.key === "critical")?.count, 1);
    assert.equal(summary.byCode.find((item) => item.key === "tokens_per_sample_spike")?.count, 1);
    assert.equal(summary.byFollowUpStatus.find((item) => item.key === "investigating")?.count, 1);
    assert.equal(summary.byEscalationStatus.find((item) => item.key === "escalated")?.count, 1);
  });
});
