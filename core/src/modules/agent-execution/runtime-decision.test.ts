import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArtifactRuntimeDecision,
  buildFinalizeCompletedRuntimeDecision,
  buildPrepareRuntimeDecision,
  resolveRuntimeDecisionFromPayload,
} from "./runtime-decision";

test("prepare runtime decision recognizes timeout acceleration", () => {
  const decision = buildPrepareRuntimeDecision({
    phase: "prepare",
    runtimeProfileKey: "baseline",
    pricingPolicyKey: "baseline",
    budgetStatus: "near_limit",
    nearLimit: true,
    pricingNearLimit: false,
    phaseTimeoutApproaching: true,
    preparePassNumber: 2,
    preparePassesRequired: 2,
    nearLimitCapApplied: true,
    timeoutAccelerationApplied: true,
  });

  assert.equal(decision.decisionClass, "prepare_timeout_accelerated");
  assert.equal(decision.severity, "warning");
  assert.equal(decision.preparePassesRequired, 2);
});

test("artifact runtime decision recognizes near-limit downshift", () => {
  const decision = buildArtifactRuntimeDecision({
    phase: "produce_artifact",
    runtimeProfileKey: "deep_runtime",
    pricingPolicyKey: "balanced",
    budgetStatus: "near_limit",
    nearLimit: true,
    pricingNearLimit: true,
    phaseTimeoutApproaching: false,
    adaptiveFinalize: false,
    partialArtifactCompletion: false,
    artifactCount: 2,
    targetArtifactCount: 5,
    requestedArtifactsToProduce: 2,
    plannedArtifactsToProduce: 1,
    nearLimitArtifactsPerAdvanceCap: 1,
    batchDownshiftApplied: true,
    finalizeEarlyReason: null,
    partialFinalizeBlocked: false,
  });

  assert.equal(decision.decisionClass, "artifact_batch_downshift_near_limit");
  assert.equal(decision.requestedArtifactsToProduce, 2);
  assert.equal(decision.plannedArtifactsToProduce, 1);
});

test("artifact runtime decision recognizes blocked partial finalize", () => {
  const decision = buildArtifactRuntimeDecision({
    phase: "produce_artifact",
    runtimeProfileKey: "baseline",
    pricingPolicyKey: "strict",
    budgetStatus: "exceeded",
    nearLimit: true,
    pricingNearLimit: true,
    phaseTimeoutApproaching: false,
    adaptiveFinalize: false,
    partialArtifactCompletion: true,
    artifactCount: 1,
    targetArtifactCount: 3,
    requestedArtifactsToProduce: 1,
    plannedArtifactsToProduce: 0,
    nearLimitArtifactsPerAdvanceCap: 1,
    batchDownshiftApplied: false,
    finalizeEarlyReason: null,
    partialFinalizeBlocked: true,
  });

  assert.equal(decision.decisionClass, "artifact_partial_finalize_blocked");
  assert.equal(decision.severity, "critical");
});

test("finalize completion decision round-trips through payload parsing", () => {
  const decision = buildFinalizeCompletedRuntimeDecision({
    phase: "finalize",
    runtimeProfileKey: "iterative",
    pricingPolicyKey: "balanced",
    budgetStatus: "within_budget",
    nearLimit: false,
    pricingNearLimit: false,
    phaseTimeoutApproaching: false,
    artifactCount: 3,
    targetArtifactCount: 3,
    partialArtifactCompletion: false,
  });

  const parsed = resolveRuntimeDecisionFromPayload({
    runtimeDecision: decision,
  });

  assert.deepEqual(parsed, decision);
});
