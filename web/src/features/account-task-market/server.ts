import type {
  AgentCapabilityView,
  AgentMarketplaceListingView,
  AgentView,
  ArbitrationCaseView,
  TaskAgentProposalView,
  TaskView,
} from "@neuro/contracts";

import {
  getFeatureSnapshot,
  listAgentCapabilityCatalog,
  listAgentMarketplaceListings,
  listAgents,
  listArbitrationCases,
  listTaskAgentProposals,
  listTasks,
} from "@/lib/core-client";
import { groupAgentCapabilitiesByAgentId } from "@/lib/agent-capability-catalog";
import { mapWithConcurrency } from "@/lib/map-with-concurrency";

const TASK_PROPOSAL_FETCH_CONCURRENCY = 6;

export type TaskMarketServerContext = {
  userId: string;
  username?: string;
};

export type TaskMarketServerState = {
  features: Awaited<ReturnType<typeof getFeatureSnapshot>>;
  tasks: TaskView[];
  ownedAgents: AgentView[];
  ownedListings: AgentMarketplaceListingView[];
  publicListings: AgentMarketplaceListingView[];
  capabilitiesByAgentId: Map<string, AgentCapabilityView[]>;
  taskProposalsMap: Map<string, TaskAgentProposalView[]>;
  arbitrationCasesByTaskId: Map<string, ArbitrationCaseView[]>;
  proposalReadWarning: string | null;
};

export function groupArbitrationCasesByTaskId<
  T extends { entityType: string; entityId: string },
>(
  taskIds: readonly string[],
  arbitrationCases: readonly T[],
) {
  const grouped = new Map<string, T[]>(
    taskIds.map((taskId) => [taskId, []]),
  );
  for (const arbitrationCase of arbitrationCases) {
    if (arbitrationCase.entityType !== "task") continue;
    grouped.get(arbitrationCase.entityId)?.push(arbitrationCase);
  }
  return grouped;
}

export async function loadTaskMarketServerState(
  userContext: TaskMarketServerContext,
): Promise<TaskMarketServerState> {
  const [features, tasks] = await Promise.all([
    getFeatureSnapshot(),
    listTasks(userContext) as Promise<TaskView[]>,
  ]);

  const canUseAgentRegistry = features.agentRegistry.enabled;

  let ownedAgents: AgentView[] = [];
  let ownedListings: AgentMarketplaceListingView[] = [];
  let publicListings: AgentMarketplaceListingView[] = [];
  let capabilitiesByAgentId = new Map<string, AgentCapabilityView[]>();
  let taskProposalsMap = new Map<string, TaskAgentProposalView[]>();
  let arbitrationCasesByTaskId = new Map<string, ArbitrationCaseView[]>();
  let proposalReadWarning: string | null = null;

  if (canUseAgentRegistry) {
    try {
      const [ownedAgentRows, ownedListingRows, publicListingRows, capabilityCatalog] = await Promise.all([
        listAgents(userContext),
        listAgentMarketplaceListings(userContext, "owner"),
        listAgentMarketplaceListings(userContext, "public", 24),
        listAgentCapabilityCatalog(userContext),
      ]);
      ownedAgents = ownedAgentRows.filter((agent) => agent.enabled);
      const proposalPairs = await mapWithConcurrency(
        tasks,
        TASK_PROPOSAL_FETCH_CONCURRENCY,
        async (task) => [task.id, await listTaskAgentProposals(userContext, task.id)] as const,
      );
      ownedListings = ownedListingRows;
      publicListings = publicListingRows;
      capabilitiesByAgentId = groupAgentCapabilitiesByAgentId(
        ownedAgents.map((agent) => agent.id),
        capabilityCatalog,
      );
      taskProposalsMap = new Map(proposalPairs);
    } catch {
      proposalReadWarning = "智能体提案数据暂不可用，请稍后重试。";
    }
  }

  if (features.arbitration.enabled) {
    try {
      const arbitrationCases = await listArbitrationCases(userContext);
      arbitrationCasesByTaskId = groupArbitrationCasesByTaskId(
        tasks.map((task) => task.id),
        arbitrationCases,
      );
    } catch {
      // Keep the task market available even if arbitration API is temporarily unavailable.
    }
  }

  return {
    features,
    tasks,
    ownedAgents,
    ownedListings,
    publicListings,
    capabilitiesByAgentId,
    taskProposalsMap,
    arbitrationCasesByTaskId,
    proposalReadWarning,
  };
}
