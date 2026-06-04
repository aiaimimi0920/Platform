import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentExecutionRemediationSlices,
  formatAgentExecutionRemediationSliceInspectActionLabel,
  formatAgentExecutionRemediationSliceOperatorActionLabel,
  formatAgentExecutionRemediationSlicePreferredActionKindLabel,
} from "./agent-execution-remediation-slices";

test("shared remediation slices prioritize compat-window blocked backlog", () => {
  const slices = buildAgentExecutionRemediationSlices({
    scopeLabel: "Operator",
    summary: {
      totalCount: 4,
      rejectedCount: 3,
      replayableRejectedCount: 1,
      retryableRejectedCount: 1,
      inspectRejectedCount: 0,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "retry_compat_window", count: 2 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "retry_compat_window",
      dominantReplayFailureClass: null,
    },
  });

  assert.deepEqual(
    slices.map((slice) => slice.key),
    ["inspect_decision_slice", "inspect_callback_backlog"],
  );
  assert.equal(slices[0]?.filterOverrides.decisionClass, "retry_compat_window");
  assert.equal(slices[0]?.preferredActionKind, "inspect");
});

test("shared remediation slices can attach replay failure hotspot after replayable backlog", () => {
  const slices = buildAgentExecutionRemediationSlices({
    scopeLabel: "Owner",
    summary: {
      totalCount: 5,
      rejectedCount: 4,
      replayableRejectedCount: 2,
      retryableRejectedCount: 2,
      inspectRejectedCount: 1,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "replay_current_payload", count: 2 }],
      byReplayFailureClass: [{ key: "callback_secret_unavailable", count: 2 }],
      dominantDecisionClass: "replay_current_payload",
      dominantReplayFailureClass: "callback_secret_unavailable",
    },
  });

  assert.deepEqual(
    slices.map((slice) => slice.key),
    ["inspect_replayable_callbacks", "inspect_replay_failure_slice", "inspect_callback_backlog"],
  );
  assert.equal(slices[0]?.preferredActionKind, "auto_remediate");
  assert.equal(
    slices[1]?.filterOverrides.replayFailureClass,
    "callback_secret_unavailable",
  );
});

test("shared remediation slices can prioritize retryable backlog with retry-request batch action", () => {
  const slices = buildAgentExecutionRemediationSlices({
    scopeLabel: "Operator",
    summary: {
      totalCount: 6,
      rejectedCount: 5,
      replayableRejectedCount: 0,
      retryableRejectedCount: 3,
      inspectRejectedCount: 2,
      invalidPayloadCount: 0,
      byDecisionClass: [{ key: "retry_policy_preferred", count: 3 }],
      byReplayFailureClass: [],
      dominantDecisionClass: "retry_policy_preferred",
      dominantReplayFailureClass: null,
    },
  });

  assert.equal(slices[0]?.preferredActionKind, "request_retry_batch");
  assert.equal(slices[0]?.filterOverrides.callbackRetryability, "retryable");
  assert.equal(slices[1]?.preferredActionKind, "inspect");
  assert.equal(slices[1]?.filterOverrides.callbackRetryability, "inspect");
});

test("shared remediation slice label helpers stay stable across owner and operator surfaces", () => {
  assert.equal(
    formatAgentExecutionRemediationSliceInspectActionLabel("inspect_replay_failure_slice"),
    "打开 Replay Failure Slice",
  );
  assert.equal(
    formatAgentExecutionRemediationSlicePreferredActionKindLabel("request_retry_batch"),
    "retry-batch",
  );
  assert.equal(
    formatAgentExecutionRemediationSliceOperatorActionLabel("auto_remediate"),
    "去 Ops 执行 Auto Remediation",
  );
  assert.equal(formatAgentExecutionRemediationSliceOperatorActionLabel("inspect"), null);
});
