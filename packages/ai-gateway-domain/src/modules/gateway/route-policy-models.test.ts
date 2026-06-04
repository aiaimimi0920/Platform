import assert from "node:assert/strict";
import test from "node:test";

import type { GatewayRoutePolicyConfig } from "@neuro/contracts";

import { routePolicyAllowsModels, routePolicyHasModelRestrictions } from "./route-policy-models";

function makeRoutePolicyConfig(overrides: Partial<GatewayRoutePolicyConfig> = {}): GatewayRoutePolicyConfig {
  return {
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
    rateLimitHotspotAutoRemediation: null,
    fallbackHttpStatuses: [429, 500],
    fallbackErrorCodes: ["ETIMEDOUT"],
    ...overrides,
  };
}

test("routePolicyHasModelRestrictions detects allow/block lists", () => {
  assert.equal(routePolicyHasModelRestrictions(makeRoutePolicyConfig()), false);
  assert.equal(
    routePolicyHasModelRestrictions(makeRoutePolicyConfig({ allowedModelIds: ["gpt-5.1"] })),
    true,
  );
  assert.equal(
    routePolicyHasModelRestrictions(makeRoutePolicyConfig({ blockedModelIds: ["claude-opus-4"] })),
    true,
  );
});

test("routePolicyAllowsModels allows all models when no restrictions are declared", () => {
  assert.equal(routePolicyAllowsModels(makeRoutePolicyConfig(), ["gpt-5.1"]), true);
  assert.equal(routePolicyAllowsModels(makeRoutePolicyConfig(), ["claude-opus-4"]), true);
});

test("routePolicyAllowsModels enforces allowed model ids case-insensitively", () => {
  const config = makeRoutePolicyConfig({ allowedModelIds: ["GPT-5.1", "claude-opus-4"] });
  assert.equal(routePolicyAllowsModels(config, ["gpt-5.1"]), true);
  assert.equal(routePolicyAllowsModels(config, ["Claude-Opus-4"]), true);
  assert.equal(routePolicyAllowsModels(config, ["gemini-2.5-pro"]), false);
});

test("routePolicyAllowsModels rejects blocked model ids even if another identifier is allowed", () => {
  const config = makeRoutePolicyConfig({
    allowedModelIds: ["codex"],
    blockedModelIds: ["gpt-4.1"],
  });
  assert.equal(routePolicyAllowsModels(config, ["codex", "gpt-4.1"]), false);
});

test("routePolicyAllowsModels supports alias-to-upstream matching", () => {
  const config = makeRoutePolicyConfig({ allowedModelIds: ["gpt-5.1"] });
  assert.equal(routePolicyAllowsModels(config, ["project-writer", "gpt-5.1"]), true);
  assert.equal(routePolicyAllowsModels(config, ["project-writer", "gpt-4.1"]), false);
});
