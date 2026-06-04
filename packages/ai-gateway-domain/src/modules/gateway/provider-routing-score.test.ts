import assert from "node:assert/strict";
import test from "node:test";

import { buildGatewayProviderRoutingScore } from "./provider-routing-score";

test("provider routing score degrades on failure count and concurrency pressure", () => {
  const healthy = buildGatewayProviderRoutingScore({
    status: "active",
    failureCount: 0,
    breakerOpen: false,
    activeConcurrency: 0,
    providerConcurrencyLimit: 4,
  });
  const degraded = buildGatewayProviderRoutingScore({
    status: "active",
    failureCount: 4,
    breakerOpen: false,
    activeConcurrency: 3,
    providerConcurrencyLimit: 4,
  });

  assert.equal(healthy.degraded, false);
  assert.equal(healthy.score > degraded.score, true);
  assert.deepEqual(degraded.degradationReasons.includes("failure_count_elevated"), true);
  assert.deepEqual(degraded.degradationReasons.includes("concurrency_pressure"), true);
});

test("provider routing score drops to zero when breaker is open", () => {
  const score = buildGatewayProviderRoutingScore({
    status: "active",
    failureCount: 1,
    breakerOpen: true,
    activeConcurrency: 0,
    providerConcurrencyLimit: 4,
  });

  assert.equal(score.score, 0);
  assert.equal(score.degraded, true);
  assert.deepEqual(score.degradationReasons, ["breaker_open"]);
});

test("provider routing score marks saturated providers", () => {
  const score = buildGatewayProviderRoutingScore({
    status: "cooling",
    failureCount: 2,
    breakerOpen: false,
    activeConcurrency: 5,
    providerConcurrencyLimit: 5,
  });

  assert.equal(score.capacityWeight, 0);
  assert.equal(score.saturated, true);
  assert.equal(score.degraded, true);
  assert.deepEqual(score.degradationReasons.includes("status_cooling"), true);
  assert.deepEqual(score.degradationReasons.includes("concurrency_saturated"), true);
});
