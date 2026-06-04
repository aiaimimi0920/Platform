import assert from "node:assert/strict";
import test from "node:test";

import type { AgentCallbackRemediationPolicyView } from "@neuro/contracts";

import {
  buildCallbackRemediationPlan,
  classifyReplayFailureForRetryFallback,
  shouldFallbackReplayFailureToRetryRequest,
  shouldFallbackReplayFailureToRetryRequestByPolicy,
} from "./callback-remediation-plan";

const balancedPolicy: AgentCallbackRemediationPolicyView = {
  key: "balanced",
  label: "Balanced",
  autoRemediationEnabled: true,
  autoReplayStoredPayload: true,
  fallbackRetryRequestEnabled: true,
  replayCompatibilityPolicyKey: "allow_legacy_payload",
  allowedReplayPayloadCompatibilities: ["current", "legacy_normalized"],
  allowReplayFromPreviousProtocolWindow: false,
  allowReplayFromPreviousSecretWindow: false,
  fallbackRetryRequestReplayFailureProfileKey: "safe_structural",
  fallbackRetryRequestReplayFailureClasses: [
    "stored_payload_unavailable",
    "callback_secret_unavailable",
  ],
  maxAttempts: 3,
  baseBackoffSeconds: 300,
  allowedRejectionCategories: ["invalid_timestamp", "processing_conflict"],
  fallbackRetryRequestCategories: ["invalid_timestamp", "processing_conflict"],
  note: "balanced",
};

test("callback remediation plan prefers replay and keeps retry fallback when both are allowed", async (t) => {
  await t.test("replayable payload becomes primary action", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: balancedPolicy,
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "legacy_normalized",
        schemaVersion: 0,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "replay_payload");
    assert.equal(plan.fallbackAction, "request_retry");
    assert.equal(plan.decisionClass, "replay_legacy_payload");
    assert.equal(plan.reasonCategory, null);
  });

  await t.test("incompatible payload falls back to retry request when policy allows it", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: balancedPolicy,
      replayPayload: {
        envelope: null,
        stored: true,
        replayable: false,
        compatibility: "invalid",
        schemaVersion: null,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "request_retry");
    assert.equal(plan.decisionClass, "retry_incompatible_payload");
    assert.equal(plan.fallbackAction, null);
    assert.equal(plan.reasonCategory, null);
  });

  await t.test("incompatible payload becomes a planned skip when retry fallback is disabled", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: {
        ...balancedPolicy,
        fallbackRetryRequestEnabled: false,
        fallbackRetryRequestCategories: [],
      },
      replayPayload: {
        envelope: null,
        stored: true,
        replayable: false,
        compatibility: "invalid",
        schemaVersion: null,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "skip");
    assert.equal(plan.reasonCategory, "incompatible_payload");
  });

  await t.test("only safe structural replay failures trigger retry fallback", () => {
    assert.equal(
      classifyReplayFailureForRetryFallback("External agent callback secret is unavailable for payload replay"),
      "callback_secret_unavailable",
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequest("External agent callback secret is unavailable for payload replay"),
      true,
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("Stored payload replay is unavailable for this callback audit"),
      "stored_payload_unavailable",
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequest("Stored payload replay is unavailable for this callback audit"),
      true,
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("A callback payload replay was already recorded recently for this audit"),
      "duplicate_replay_cooldown",
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequest("A callback payload replay was already recorded recently for this audit"),
      true,
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequestByPolicy({
        policy: balancedPolicy,
        errorMessage: "A callback payload replay was already recorded recently for this audit",
      }),
      false,
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequestByPolicy({
        policy: {
          ...balancedPolicy,
          fallbackRetryRequestReplayFailureProfileKey: "extended_structural",
          fallbackRetryRequestReplayFailureClasses: [
            "stored_payload_unavailable",
            "callback_secret_unavailable",
            "duplicate_replay_cooldown",
          ],
        },
        errorMessage: "A callback payload replay was already recorded recently for this audit",
      }),
      true,
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("External agent is disabled"),
      "agent_disabled",
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequest("External agent is disabled"),
      false,
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequestByPolicy({
        policy: {
          ...balancedPolicy,
          fallbackRetryRequestReplayFailureProfileKey: "custom",
          fallbackRetryRequestReplayFailureClasses: [
            "stored_payload_unavailable",
            "callback_secret_unavailable",
            "duplicate_replay_cooldown",
            "agent_disabled",
          ],
        },
        errorMessage: "External agent is disabled",
      }),
      true,
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("Only retryable rejected callbacks support stored payload replay"),
      "callback_not_retryable",
    );
    assert.equal(
      shouldFallbackReplayFailureToRetryRequestByPolicy({
        policy: balancedPolicy,
        errorMessage: "Only retryable rejected callbacks support stored payload replay",
      }),
      false,
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("Only external callback audits support stored payload replay"),
      "unsupported_target",
    );
    assert.equal(
      classifyReplayFailureForRetryFallback("External callback protocol version does not match agent configuration"),
      "callback_protocol_mismatch",
    );
  });

  await t.test("compatibility policy can force retry request instead of replay", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: {
        ...balancedPolicy,
        replayCompatibilityPolicyKey: "current_only",
        allowedReplayPayloadCompatibilities: ["current"],
      },
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "legacy_normalized",
        schemaVersion: 0,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "request_retry");
    assert.equal(plan.decisionClass, "retry_compatibility_policy");
    assert.equal(plan.reasonCategory, null);
    assert.match(plan.reason, /compatibility policy/i);
  });

  await t.test("compatibility window policy can block previous protocol replay", () => {
    const conservativePlan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: true,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: balancedPolicy,
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "current",
        schemaVersion: 1,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(conservativePlan.primaryAction, "request_retry");
    assert.equal(conservativePlan.decisionClass, "retry_compat_window");
    assert.equal(conservativePlan.reasonCategory, null);
    assert.match(conservativePlan.reason, /previous protocol/i);

    const aggressivePlan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: true,
      usedPreviousSecret: true,
      retryability: "retryable",
      rejectionCategory: "invalid_version",
      policy: {
        ...balancedPolicy,
        key: "aggressive",
        replayCompatibilityPolicyKey: "allow_compat_window",
        allowReplayFromPreviousProtocolWindow: true,
        allowReplayFromPreviousSecretWindow: true,
        allowedRejectionCategories: ["invalid_timestamp", "processing_conflict", "invalid_version"],
        fallbackRetryRequestCategories: ["invalid_timestamp", "processing_conflict", "invalid_version"],
      },
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "current",
        schemaVersion: 1,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(aggressivePlan.primaryAction, "replay_payload");
  });

  await t.test("compatibility policy blocked becomes a dedicated skip category when fallback is disabled", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: false,
      usedPreviousSecret: false,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: {
        ...balancedPolicy,
        replayCompatibilityPolicyKey: "current_only",
        allowedReplayPayloadCompatibilities: ["current"],
        fallbackRetryRequestEnabled: false,
        fallbackRetryRequestCategories: [],
      },
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "legacy_normalized",
        schemaVersion: 0,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "skip");
    assert.equal(plan.decisionClass, "skip_compatibility_policy");
    assert.equal(plan.reasonCategory, "compatibility_policy_blocked");
  });

  await t.test("compat window blocked becomes a dedicated skip category when fallback is disabled", () => {
    const plan = buildCallbackRemediationPlan({
      status: "rejected",
      agentSourceType: "external",
      agentEnabled: true,
      usedPreviousProtocol: true,
      usedPreviousSecret: true,
      retryability: "retryable",
      rejectionCategory: "invalid_timestamp",
      policy: {
        ...balancedPolicy,
        fallbackRetryRequestEnabled: false,
        fallbackRetryRequestCategories: [],
      },
      replayPayload: {
        envelope: {
          type: "status",
          status: "completed",
          statusNote: null,
          resultSummary: null,
        },
        stored: true,
        replayable: true,
        compatibility: "current",
        schemaVersion: 1,
      },
      autoRemediationAttempts: 0,
    });

    assert.equal(plan.primaryAction, "skip");
    assert.equal(plan.decisionClass, "skip_compat_window");
    assert.equal(plan.reasonCategory, "compat_window_blocked");
  });
});
