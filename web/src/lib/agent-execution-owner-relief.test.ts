import assert from "node:assert/strict";
import test from "node:test";

import type { AgentExecutionOperatorRunView } from "@neuro/contracts";

import {
  buildOwnerReliefCloseoutSuggestions,
  formatOwnerReliefHandoffFollowUpLifecycleDispositionLabel,
  formatOwnerReliefHandoffFollowUpProfileLabel,
  resolveOwnerReliefHandoffFollowUpLifecyclePlan,
  resolveOwnerReliefHandoffFollowUpProfilePlan,
  summarizeOwnerReliefMatchedRuns,
} from "./agent-execution-owner-relief";

function createRun(overrides: Partial<AgentExecutionOperatorRunView> = {}): AgentExecutionOperatorRunView {
  return {
    id: overrides.id ?? "run-1",
    executionId: overrides.executionId ?? "exec-1",
    agentId: overrides.agentId ?? "agent-1",
    ownerUserId: overrides.ownerUserId ?? "user-1",
    runKind: overrides.runKind ?? "platform_executor",
    status: overrides.status ?? "completed",
    failureCategory: overrides.failureCategory ?? null,
    summary: overrides.summary ?? null,
    errorMessage: overrides.errorMessage ?? null,
    artifactCount: overrides.artifactCount ?? 0,
    costUnits: overrides.costUnits ?? 0,
    resourceMinutes: overrides.resourceMinutes ?? 0,
    estimatedAmount: overrides.estimatedAmount ?? 0,
    createdAt: overrides.createdAt ?? "2026-03-27T08:00:00.000Z",
    finishedAt: overrides.finishedAt ?? "2026-03-27T08:01:00.000Z",
    executionTitle: overrides.executionTitle ?? "Execution",
    executionStatus: overrides.executionStatus ?? "running",
    executionUpdatedAt: overrides.executionUpdatedAt ?? "2026-03-27T08:01:00.000Z",
    executorPhase: overrides.executorPhase ?? "produce_artifact",
    progressPercent: overrides.progressPercent ?? 80,
    agentName: overrides.agentName ?? "Agent",
    agentSourceType: overrides.agentSourceType ?? "platform",
    callbackAuditId: overrides.callbackAuditId ?? null,
    runtimeDecision: overrides.runtimeDecision ?? null,
  };
}

test("recover closeout suggests relaunch when recovery requeues work without exhausted items", () => {
  const recoverySummary = summarizeOwnerReliefMatchedRuns({
    runs: [createRun({ runKind: "recovery", status: "completed" })],
    expectedCount: 1,
  });
  const suggestions = buildOwnerReliefCloseoutSuggestions({
    action: "recover",
    closedCount: 0,
    skippedCount: 0,
    recoveredCount: 2,
    exhaustedCount: 0,
    processedCount: 0,
    failedCount: 0,
    recoveryMatchedRunSummary: recoverySummary,
  });
  assert.equal(suggestions[0]?.state, "relaunch");
  assert.equal(suggestions[0]?.actionKind, "run_owner_slice");
});

test("executor closeout escalates when matched runs contain failed or critical signals", () => {
  const executorSummary = summarizeOwnerReliefMatchedRuns({
    runs: [
      createRun({
        id: "run-crit",
        status: "failed",
        runtimeDecision: {
          phase: "finalize",
          decisionClass: "finalize_near_limit_cap",
          severity: "critical",
          title: "Critical runtime decision",
          detail: "Budget is almost exhausted.",
          runtimeProfileKey: null,
          pricingPolicyKey: null,
          budgetStatus: "within_budget",
          nearLimit: false,
          pricingNearLimit: false,
          phaseTimeoutApproaching: false,
          adaptiveFinalize: true,
          partialArtifactCompletion: false,
          artifactCount: 0,
          targetArtifactCount: 1,
          requestedArtifactsToProduce: 1,
          plannedArtifactsToProduce: 0,
          nearLimitArtifactsPerAdvanceCap: 1,
          preparePassNumber: 1,
          preparePassesRequired: 3,
          finalizePassNumber: 0,
          finalizePassesRequired: 2,
        },
      }),
    ],
    expectedCount: 1,
  });
  const suggestions = buildOwnerReliefCloseoutSuggestions({
    action: "run",
    closedCount: 0,
    skippedCount: 0,
    recoveredCount: 0,
    exhaustedCount: 0,
    processedCount: 0,
    failedCount: 1,
    executorMatchedRunSummary: executorSummary,
  });
  assert.equal(suggestions[0]?.state, "escalate");
  assert.equal(suggestions[0]?.actionKind, "open_runtime_pressure");
});

test("executor closeout continues when exact matched runs are still incomplete or running", () => {
  const executorSummary = summarizeOwnerReliefMatchedRuns({
    runs: [createRun({ id: "run-open", status: "running", finishedAt: null })],
    expectedCount: 2,
  });
  const suggestions = buildOwnerReliefCloseoutSuggestions({
    action: "run",
    closedCount: 0,
    skippedCount: 0,
    recoveredCount: 0,
    exhaustedCount: 0,
    processedCount: 1,
    failedCount: 0,
    executorMatchedRunSummary: executorSummary,
  });
  assert.equal(suggestions[0]?.state, "continue");
  assert.equal(suggestions[0]?.actionKind, "open_executor_runs");
});

test("executor closeout observes clean exact matches after processing completes", () => {
  const executorSummary = summarizeOwnerReliefMatchedRuns({
    runs: [
      createRun({ id: "run-a", status: "completed" }),
      createRun({ id: "run-b", executionId: "exec-2", status: "completed" }),
    ],
    expectedCount: 2,
  });
  const suggestions = buildOwnerReliefCloseoutSuggestions({
    action: "recover_then_run",
    closedCount: 0,
    skippedCount: 0,
    recoveredCount: 1,
    exhaustedCount: 0,
    processedCount: 2,
    failedCount: 0,
    executorMatchedRunSummary: executorSummary,
  });
  assert.equal(suggestions[0]?.state, "observe");
  assert.equal(suggestions[0]?.actionKind, "open_executor_runs");
});

test("owner relief handoff follow-up profile plan keeps inspect-only as a pure inspection flow", () => {
  const plan = resolveOwnerReliefHandoffFollowUpProfilePlan("inspect_only");
  assert.equal(plan.primaryAction, "inspect_follow_up");
  assert.equal(plan.primaryLabel, "打开 handoff 下一跳");
  assert.equal(plan.secondaryAction, null);
  assert.equal(formatOwnerReliefHandoffFollowUpProfileLabel(plan.profile), "inspect only");
});

test("owner relief handoff follow-up profile plan can promote resolve-after-review", () => {
  const plan = resolveOwnerReliefHandoffFollowUpProfilePlan("resolve_after_review");
  assert.equal(plan.primaryLabel, "打开并准备结案");
  assert.equal(plan.secondaryAction, "resolve_handoff");
  assert.equal(plan.secondaryLabel, "检查后结案 handoff");
});

test("owner relief handoff follow-up profile plan can promote reopen-after-review", () => {
  const plan = resolveOwnerReliefHandoffFollowUpProfilePlan("reopen_after_review");
  assert.equal(plan.primaryLabel, "打开并准备复开");
  assert.equal(plan.secondaryAction, "reopen_relief");
  assert.equal(plan.secondaryLabel, "检查后复开 owner relief");
});

test("owner relief handoff lifecycle plan promotes resolve after the handoff has been opened", () => {
  const plan = resolveOwnerReliefHandoffFollowUpLifecyclePlan("resolve_after_review", "opened", {
    focusSection: "callback-audits",
  });
  assert.equal(plan.primaryAction, "resolve_handoff");
  assert.equal(plan.primaryDisposition, "resolve");
  assert.equal(plan.primaryLabel, "检查 callback audit slice 后结案 handoff");
  assert.equal(plan.secondaryAction, "inspect_follow_up");
  assert.equal(plan.secondaryDisposition, "inspect");
  assert.equal(plan.secondaryLabel, "重新打开 callback audit slice");
  assert.equal(
    formatOwnerReliefHandoffFollowUpLifecycleDispositionLabel(plan.primaryDisposition),
    "next resolve",
  );
});

test("owner relief handoff lifecycle plan promotes reopen after the handoff has been opened", () => {
  const plan = resolveOwnerReliefHandoffFollowUpLifecyclePlan("reopen_after_review", "opened", {
    focusSection: "runtime-session-watch",
  });
  assert.equal(plan.primaryAction, "reopen_relief");
  assert.equal(plan.primaryDisposition, "reopen");
  assert.equal(plan.primaryLabel, "检查 runtime session watch 后复开 owner relief");
  assert.equal(plan.secondaryAction, "inspect_follow_up");
  assert.equal(plan.secondaryDisposition, "inspect");
  assert.equal(plan.secondaryLabel, "重新打开 runtime session watch");
  assert.equal(
    formatOwnerReliefHandoffFollowUpLifecycleDispositionLabel(plan.primaryDisposition),
    "next reopen",
  );
});

test("owner relief handoff lifecycle plan keeps resolved handoff as inspect-only audit", () => {
  const plan = resolveOwnerReliefHandoffFollowUpLifecyclePlan("resolve_after_review", "resolved", {
    focusSection: "execution-run-watch",
  });
  assert.equal(plan.primaryAction, "inspect_follow_up");
  assert.equal(plan.secondaryAction, null);
  assert.equal(plan.primaryLabel, "回看已结案的 execution run watch");
});

test("owner relief handoff lifecycle plan uses target-specific inspect wording for pending inspect-only handoff", () => {
  const plan = resolveOwnerReliefHandoffFollowUpLifecyclePlan("inspect_only", "pending", {
    focusSection: "runtime-pressure",
  });
  assert.equal(plan.primaryAction, "inspect_follow_up");
  assert.equal(plan.primaryLabel, "打开 runtime pressure");
  assert.equal(plan.detail, "这类 handoff 默认先检查 runtime pressure，不强制立即结案或复开。");
});
