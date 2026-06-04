import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile,
  resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys,
} from "./route-policy-hotspot-remediation";

test("ai-gateway route policy hotspot auto remediation profile", async (t) => {
  await t.test("normalizes partial profile and preserves tightening defaults", () => {
    const profile = normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile(
      {
        intervalMinutes: 90,
        actionByCode: {
          rate_limit_model_hotspot: "tighten-project-rate-limit",
          rate_limit_endpoint_hotspot: null,
        },
      },
      null,
    );

    assert.equal(profile?.enabled, true);
    assert.equal(profile?.intervalMinutes, 90);
    assert.equal(profile?.dryRunFirst, true);
    assert.equal(profile?.requireAlertBeforeApply, true);
    assert.equal(profile?.freezeOnProviderHealthDegrade, true);
    assert.equal(profile?.maxApplyRunsPerIncident, 1);
    assert.equal(profile?.actionByCode?.rate_limit_api_key_hotspot, "tighten-api-key-rate-limit");
    assert.equal(profile?.actionByCode?.rate_limit_model_hotspot, "tighten-project-rate-limit");
    assert.equal(profile?.actionByCode?.rate_limit_endpoint_hotspot, null);
  });

  await t.test("rejects unsupported hotspot codes", () => {
    assert.throws(
      () =>
        normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile(
          {
            actionByCode: {
              bad_code: "tighten-project-rate-limit",
            },
          },
          null,
        ),
      /hotspot code/,
    );
  });

  await t.test("resolves code-specific action keys", () => {
    const profile = normalizeRoutePolicyRateLimitHotspotAutoRemediationProfile(
      {
        enabled: true,
        actionByCode: {
          rate_limit_model_hotspot: "tighten-model-rate-limit",
          rate_limit_endpoint_hotspot: null,
        },
      },
      null,
    );

    assert.deepEqual(
      resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys(profile, "rate_limit_model_hotspot"),
      ["tighten-model-rate-limit"],
    );
    assert.deepEqual(
      resolveRoutePolicyRateLimitHotspotAutoRemediationActionKeys(profile, "rate_limit_endpoint_hotspot"),
      [],
    );
  });
});
