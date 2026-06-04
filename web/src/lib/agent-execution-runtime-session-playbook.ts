import type { AgentExecutionRuntimeSessionRecommendationActionKind } from "@neuro/contracts";

export function formatAgentExecutionRuntimeSessionRecommendationActionKindLabel(
  actionKind: AgentExecutionRuntimeSessionRecommendationActionKind,
) {
  switch (actionKind) {
    case "sweep_runtime_sessions":
      return "sweep";
    case "inspect_runtime_session_slice":
    default:
      return "inspect";
  }
}

export function isSweepAgentExecutionRuntimeSessionRecommendationActionKind(
  actionKind: AgentExecutionRuntimeSessionRecommendationActionKind,
) {
  return actionKind === "sweep_runtime_sessions";
}
