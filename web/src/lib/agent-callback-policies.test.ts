import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AgentCallbackHealthSummaryView, AgentCallbackRemediationPolicyKey } from "@neuro/contracts";

import {
  buildAgentCallbackPolicyRecommendation,
  buildExecutionCallbackPolicyRecommendation,
} from "./agent-callback-policies";

function buildSummary(overrides: Partial<AgentCallbackHealthSummaryView>): AgentCallbackHealthSummaryView {
  return {
    agentId: "agent-1",
    windowHours: 24,
    totalCallbacks: 10,
    acceptedCallbacks: 8,
    duplicateCallbacks: 0,
    rejectedCallbacks: 0,
    currentProtocolHits: 10,
    previousProtocolHits: 0,
    currentSecretHits: 10,
    previousSecretHits: 0,
    lastReceivedAt: "2026-03-26T00:00:00.000Z",
    byCallbackType: [],
    ...overrides,
  };
}

describe("agent callback policy recommendations", () => {
  it("recommends aggressive when compatibility hits remain high", () => {
    const recommendation = buildAgentCallbackPolicyRecommendation(
      {
        sourceType: "external",
        externalCallbackRemediationPolicyKey: "balanced",
      },
      buildSummary({
        previousProtocolHits: 2,
        previousSecretHits: 1,
      }),
    );

    assert.ok(recommendation);
    assert.equal(recommendation.recommendedPolicyKey, "aggressive");
  });

  it("turns an execution recommendation into clear-override when the agent default already matches", () => {
    const recommendation = buildExecutionCallbackPolicyRecommendation(
      {
        agentSourceType: "external",
        callbackRemediationPolicyKey: "safe_retry",
        callbackRemediationPolicySource: "execution",
        callbackRemediationPolicyOverrideKey: "safe_retry",
      },
      buildSummary({
        rejectedCallbacks: 4,
        acceptedCallbacks: 4,
        totalCallbacks: 8,
      }),
      "balanced",
    );

    assert.ok(recommendation);
    assert.equal(recommendation.recommendedPolicyKey, null);
    assert.match(recommendation.actionLabel, /恢复继承/);
  });

  it("detects redundant execution overrides that duplicate the agent default", () => {
    const recommendation = buildExecutionCallbackPolicyRecommendation(
      {
        agentSourceType: "external",
        callbackRemediationPolicyKey: "balanced",
        callbackRemediationPolicySource: "execution",
        callbackRemediationPolicyOverrideKey: "balanced",
      },
      buildSummary({}),
      "balanced",
    );

    assert.ok(recommendation);
    assert.equal(recommendation.recommendedPolicyKey, null);
    assert.match(recommendation.title, /重复/);
  });

  it("returns null for platform executions", () => {
    const recommendation = buildExecutionCallbackPolicyRecommendation(
      {
        agentSourceType: "platform",
        callbackRemediationPolicyKey: "balanced" as AgentCallbackRemediationPolicyKey,
        callbackRemediationPolicySource: "agent",
        callbackRemediationPolicyOverrideKey: null,
      },
      buildSummary({}),
      "balanced",
    );

    assert.equal(recommendation, null);
  });
});
