import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig,
  evaluateGatewayRateLimitHotspotAnomalyMailboxRoutePolicy,
  gatewayRateLimitHotspotAnomalyMailboxRouteName,
} from "./gateway-rate-limit-hotspot-anomaly-alert-routing";

describe("gateway rate-limit hotspot anomaly mailbox routing", () => {
  it("builds a stable mailbox cadence route config", () => {
    const route = buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig({
      cooldownMinutes: 180,
      maxDeliveriesPerIncident: 6,
    });

    assert.equal(route.name, gatewayRateLimitHotspotAnomalyMailboxRouteName);
    assert.deepEqual(route.eventNames, ["aiGateway.rateLimitHotspotAnomalyAlerted"]);
    assert.equal(route.cooldownMinutes, 180);
    assert.equal(route.maxDeliveriesPerIncident, 6);
    assert.equal(route.url, "internal://operator-mailbox");
  });

  it("blocks mailbox delivery during cooldown and after delivery cap", () => {
    const referenceTime = new Date("2026-04-06T10:00:00.000Z");

    const cooldownDecision = evaluateGatewayRateLimitHotspotAnomalyMailboxRoutePolicy({
      cooldownMinutes: 180,
      maxDeliveriesPerIncident: 6,
      firstSeenAt: new Date("2026-04-06T08:00:00.000Z"),
      lastSentAt: new Date("2026-04-06T09:30:00.000Z"),
      sendCount: 1,
      referenceTime,
    });

    assert.equal(cooldownDecision.allowed, false);
    assert.equal(cooldownDecision.reason, "cooldown_active");

    const capDecision = evaluateGatewayRateLimitHotspotAnomalyMailboxRoutePolicy({
      cooldownMinutes: 180,
      maxDeliveriesPerIncident: 2,
      firstSeenAt: new Date("2026-04-06T05:00:00.000Z"),
      lastSentAt: new Date("2026-04-06T06:00:00.000Z"),
      sendCount: 2,
      referenceTime,
    });

    assert.equal(capDecision.allowed, false);
    assert.equal(capDecision.reason, "max_deliveries_reached");
  });
});
