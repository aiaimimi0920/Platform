import type { AgentCapabilityView } from "@neuro/contracts";

export function groupAgentCapabilitiesByAgentId(
  agentIds: readonly string[],
  capabilities: readonly AgentCapabilityView[],
) {
  const grouped = new Map<string, AgentCapabilityView[]>(
    agentIds.map((agentId) => [agentId, []]),
  );

  for (const capability of capabilities) {
    grouped.get(capability.agentId)?.push(capability);
  }

  return grouped;
}
