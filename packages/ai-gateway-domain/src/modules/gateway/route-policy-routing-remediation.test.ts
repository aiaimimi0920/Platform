import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile,
  resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys,
} from "./route-policy-routing-remediation";

test("ai-gateway route policy routing anomaly auto remediation profile", async (t) => {
  await t.test("normalizes partial profile and preserves routing defaults", () => {
    const profile = normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile(
      {
        intervalMinutes: 45,
        actionKeysByCode: {
          completion_rate_drop: ["disable-prestream-fallback", "reduce-provider-concurrency"],
        },
      },
      null,
    );

    assert.equal(profile?.enabled, true);
    assert.equal(profile?.intervalMinutes, 45);
    assert.equal(profile?.dryRunFirst, true);
    assert.equal(profile?.requireAlertBeforeApply, true);
    assert.equal(profile?.freezeOnProviderHealthDegrade, true);
    assert.equal(profile?.maxApplyRunsPerIncident, 1);
    assert.deepEqual(profile?.actionKeysByCode?.failure_rate_spike, [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ]);
    assert.deepEqual(profile?.actionKeysByCode?.completion_rate_drop, [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
    ]);
    assert.deepEqual(profile?.actionKeysByCode?.provider_routing_score_drop, [
      "disable-prestream-fallback",
      "reduce-provider-concurrency",
      "provider-isolation",
    ]);
  });

  await t.test("rejects unsupported routing anomaly codes", () => {
    assert.throws(
      () =>
        normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile(
          {
            actionKeysByCode: {
              bad_code: ["disable-prestream-fallback"],
            },
          },
          null,
        ),
      /routing anomaly code/,
    );
  });

  await t.test("resolves code-specific action key lists", () => {
    const profile = normalizeRoutePolicyRoutingAnomalyAutoRemediationProfile(
      {
        actionKeysByCode: {
          failure_rate_spike: ["reduce-provider-concurrency"],
          completion_rate_drop: null,
        },
      },
      null,
    );

    assert.deepEqual(
      resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys(profile, "failure_rate_spike"),
      ["reduce-provider-concurrency"],
    );
    assert.deepEqual(
      resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys(profile, "completion_rate_drop"),
      [],
    );
    assert.deepEqual(
      resolveRoutePolicyRoutingAnomalyAutoRemediationActionKeys(profile, "degraded_provider_route_spike"),
      ["reduce-provider-concurrency", "provider-isolation", "disable-prestream-fallback"],
    );
  });
});
