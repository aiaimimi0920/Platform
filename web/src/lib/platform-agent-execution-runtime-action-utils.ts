import {
  type AgentExecutionRuntimePressureLevel,
  type AgentExecutionRuntimeSchedulingDecisionClass,
} from "@neuro/contracts";

export function coerceRuntimePressureLevel(
  value: string | null | undefined,
): AgentExecutionRuntimePressureLevel | undefined {
  if (value === "healthy" || value === "watch" || value === "critical") {
    return value;
  }
  if (value === "near_limit" || value === "saturated") {
    return "critical";
  }
  return undefined;
}

export function coerceRuntimeSchedulingDecisionClass(
  value: string | null | undefined,
): AgentExecutionRuntimeSchedulingDecisionClass | undefined {
  if (
    value === "within_capacity" ||
    value === "queue_backlog" ||
    value === "profile_saturated" ||
    value === "owner_hotspot" ||
    value === "profile_and_owner_saturated"
  ) {
    return value;
  }
  if (value === "launchable") {
    return "within_capacity";
  }
  return undefined;
}
