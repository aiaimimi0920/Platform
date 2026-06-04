import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultGatewayAnalysisAnomalyAlertIntervalMinutes,
  resolveGatewayAnalysisAnomalyAlertDeliveryProfile,
  resolveGatewayAnalysisAnomalyIncidentAlertSchedule,
} from "./analysis-alert";

describe("ai-gateway analysis alert helpers", () => {
  it("treats escalated incidents without prior alert attempt as due immediately", () => {
    const schedule = resolveGatewayAnalysisAnomalyIncidentAlertSchedule({
      status: "open",
      escalationStatus: "escalated",
      alertingEnabled: true,
      alertIntervalMinutes: null,
      lastAlertAttemptAt: null,
      now: new Date("2026-04-06T00:00:00.000Z"),
    });

    assert.equal(schedule.nextAlertDueAt, null);
    assert.equal(schedule.alertDue, true);
  });

  it("computes the next alert due timestamp from the last attempt", () => {
    const schedule = resolveGatewayAnalysisAnomalyIncidentAlertSchedule({
      status: "acknowledged",
      escalationStatus: "escalated",
      alertingEnabled: true,
      alertIntervalMinutes: 30,
      lastAlertAttemptAt: "2026-04-06T00:00:00.000Z",
      now: new Date("2026-04-06T00:20:00.000Z"),
    });

    assert.equal(schedule.nextAlertDueAt, "2026-04-06T00:30:00.000Z");
    assert.equal(schedule.alertDue, false);
  });

  it("suppresses alerting for non-escalated or disabled incidents", () => {
    const schedule = resolveGatewayAnalysisAnomalyIncidentAlertSchedule({
      status: "resolved",
      escalationStatus: "resolved",
      alertingEnabled: false,
      alertIntervalMinutes: defaultGatewayAnalysisAnomalyAlertIntervalMinutes,
      lastAlertAttemptAt: "2026-04-06T00:00:00.000Z",
      now: new Date("2026-04-06T04:00:00.000Z"),
    });

    assert.equal(schedule.nextAlertDueAt, null);
    assert.equal(schedule.alertDue, false);
  });

  it("maps critical incidents to danger webhook severity", () => {
    const profile = resolveGatewayAnalysisAnomalyAlertDeliveryProfile("critical");
    assert.equal(profile.alertLevel, 3);
    assert.equal(profile.webhookSeverity, "danger");
  });
});
