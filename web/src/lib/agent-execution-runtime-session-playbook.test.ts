import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAgentExecutionRuntimeSessionRecommendationActionKindLabel,
  isSweepAgentExecutionRuntimeSessionRecommendationActionKind,
} from "./agent-execution-runtime-session-playbook";

test("runtime session playbook action labels stay stable across operator surfaces", () => {
  assert.equal(
    formatAgentExecutionRuntimeSessionRecommendationActionKindLabel("inspect_runtime_session_slice"),
    "inspect",
  );
  assert.equal(
    formatAgentExecutionRuntimeSessionRecommendationActionKindLabel("sweep_runtime_sessions"),
    "sweep",
  );
  assert.equal(isSweepAgentExecutionRuntimeSessionRecommendationActionKind("sweep_runtime_sessions"), true);
  assert.equal(
    isSweepAgentExecutionRuntimeSessionRecommendationActionKind("inspect_runtime_session_slice"),
    false,
  );
});
