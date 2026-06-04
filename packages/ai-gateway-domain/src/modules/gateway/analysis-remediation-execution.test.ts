import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ExecuteGatewayAnalysisAnomalyIncidentRemediationInput, GatewayAnalysisAnomalyIncidentRemediationActionView, GatewayRoutePolicyView } from "@neuro/contracts";

import { resolveGatewayAnalysisAnomalyRoutePolicyPatch } from "./analysis-remediation-execution";

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
    allowedProviderAccountIds: ["provider_1", "provider_2"],
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

function makeAction(actionKey: string): GatewayAnalysisAnomalyIncidentRemediationActionView {
  return {
    actionKey,
    title: actionKey,
    description: actionKey,
    category: "routing",
    priority: "high",
    routePolicyId: routePolicy.id,
    executable: true,
    executionMode: "route_policy_patch",
    defaultExecutionInput: null,
    recommendedChanges: null,
  };
}

describe("gateway anomaly remediation execution", () => {
  it("disables pre-stream fallback", () => {
    const result = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("disable-prestream-fallback"),
      routePolicy,
      input: {
        actionKey: "disable-prestream-fallback",
      },
    });

    assert.equal(result.nextConfig.preStreamFallbackEnabled, false);
    assert.deepEqual(result.changedFields, ["preStreamFallbackEnabled"]);
  });

  it("reduces provider concurrency with a safe floor", () => {
    const result = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("reduce-provider-concurrency"),
      routePolicy,
      input: {
        actionKey: "reduce-provider-concurrency",
      },
    });

    assert.equal(result.nextConfig.providerMaxConcurrentRequests, 2);
    assert.deepEqual(result.changedFields, ["providerMaxConcurrentRequests"]);
  });

  it("rejects widening provider concurrency", () => {
    const input: ExecuteGatewayAnalysisAnomalyIncidentRemediationInput = {
      actionKey: "reduce-provider-concurrency",
      routePolicyPatch: {
        providerMaxConcurrentRequests: 4,
      },
    };

    assert.throws(
      () =>
        resolveGatewayAnalysisAnomalyRoutePolicyPatch({
          action: makeAction("reduce-provider-concurrency"),
          routePolicy,
          input,
        }),
      /只允许下调/,
    );
  });

  it("requires explicit providers for provider isolation and keeps it as a narrowing patch", () => {
    const result = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("provider-isolation"),
      routePolicy,
      input: {
        actionKey: "provider-isolation",
        routePolicyPatch: {
          allowedProviderAccountIds: ["provider_2"],
        },
      },
    });

    assert.deepEqual(result.nextConfig.allowedProviderAccountIds, ["provider_2"]);
    assert.deepEqual(result.changedFields, ["allowedProviderAccountIds"]);
  });

  it("rejects provider isolation when it would add a new provider", () => {
    assert.throws(
      () =>
        resolveGatewayAnalysisAnomalyRoutePolicyPatch({
          action: makeAction("provider-isolation"),
          routePolicy,
          input: {
            actionKey: "provider-isolation",
            routePolicyPatch: {
              allowedProviderAccountIds: ["provider_3"],
            },
          },
        }),
      /不允许引入新的 providerAccountId/,
    );
  });

  it("tightens project rate limit without allowing a wider cap", () => {
    const result = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("tighten-project-rate-limit"),
      routePolicy: {
        ...routePolicy,
        config: {
          ...routePolicy.config,
          rateLimitWindowSeconds: 60,
          rateLimitMaxRequests: 100,
        },
      },
      input: {
        actionKey: "tighten-project-rate-limit",
        routePolicyPatch: {
          projectRateLimit: {
            windowSeconds: 60,
            maxRequests: 80,
          },
        },
      },
    });

    assert.equal(result.nextConfig.rateLimitWindowSeconds, 60);
    assert.equal(result.nextConfig.rateLimitMaxRequests, 80);
  });

  it("tightens api key, model, and endpoint rate limits", () => {
    const routePolicyWithScopedLimits: GatewayRoutePolicyView = {
      ...routePolicy,
      config: {
        ...routePolicy.config,
        apiKeyRateLimit: { windowSeconds: 60, maxRequests: 50 },
        modelRateLimits: {
          "gpt-5.4": { windowSeconds: 60, maxRequests: 40 },
        },
        endpointRateLimits: {
          messages: { windowSeconds: 60, maxRequests: 30 },
        },
      },
    };

    const apiKeyResult = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("tighten-api-key-rate-limit"),
      routePolicy: routePolicyWithScopedLimits,
      input: {
        actionKey: "tighten-api-key-rate-limit",
        routePolicyPatch: {
          apiKeyRateLimit: { windowSeconds: 60, maxRequests: 45 },
        },
      },
    });
    assert.equal(apiKeyResult.nextConfig.apiKeyRateLimit?.maxRequests, 45);

    const modelResult = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("tighten-model-rate-limit"),
      routePolicy: routePolicyWithScopedLimits,
      input: {
        actionKey: "tighten-model-rate-limit",
        routePolicyPatch: {
          modelRateLimitKey: "gpt-5.4",
          modelRateLimit: { windowSeconds: 60, maxRequests: 32 },
        },
      },
    });
    assert.equal(modelResult.nextConfig.modelRateLimits?.["gpt-5.4"]?.maxRequests, 32);

    const endpointResult = resolveGatewayAnalysisAnomalyRoutePolicyPatch({
      action: makeAction("tighten-endpoint-rate-limit"),
      routePolicy: routePolicyWithScopedLimits,
      input: {
        actionKey: "tighten-endpoint-rate-limit",
        routePolicyPatch: {
          endpointRateLimitKey: "messages",
          endpointRateLimit: { windowSeconds: 60, maxRequests: 24 },
        },
      },
    });
    assert.equal(endpointResult.nextConfig.endpointRateLimits?.messages?.maxRequests, 24);
  });

  it("rejects widening scoped rate limits", () => {
    assert.throws(
      () =>
        resolveGatewayAnalysisAnomalyRoutePolicyPatch({
          action: makeAction("tighten-api-key-rate-limit"),
          routePolicy: {
            ...routePolicy,
            config: {
              ...routePolicy.config,
              apiKeyRateLimit: { windowSeconds: 60, maxRequests: 50 },
            },
          },
          input: {
            actionKey: "tighten-api-key-rate-limit",
            routePolicyPatch: {
              apiKeyRateLimit: { windowSeconds: 60, maxRequests: 55 },
            },
          },
        }),
      /只允许下调 maxRequests/,
    );
  });
});
