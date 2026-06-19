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
  listAgentCapabilities,
  listAgentMarketplaceListings,
  listAgents,
  listArbitrationCases,
  listTaskAgentProposals,
  listTasks,
} from "@/lib/core-client";

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

export async function loadTaskMarketServerState(
  userContext: TaskMarketServerContext,
): Promise<TaskMarketServerState> {
  const features = await getFeatureSnapshot();
  const tasks = (await listTasks(userContext)) as TaskView[];

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
      ownedAgents = (await listAgents(userContext)).filter((agent) => agent.enabled);
      const [ownedListingRows, publicListingRows, capabilityPairs, proposalPairs] = await Promise.all([
        listAgentMarketplaceListings(userContext, "owner"),
        listAgentMarketplaceListings(userContext, "public", 24),
        Promise.all(
          ownedAgents.map(async (agent) => {
            const capabilities = await listAgentCapabilities(userContext, agent.id);
            return [agent.id, capabilities] as const;
          }),
        ),
        Promise.all(
          tasks.map(async (task) => {
            const proposals = await listTaskAgentProposals(userContext, task.id);
            return [task.id, proposals] as const;
          }),
        ),
      ]);
      ownedListings = ownedListingRows;
      publicListings = publicListingRows;
      capabilitiesByAgentId = new Map(capabilityPairs);
      taskProposalsMap = new Map(proposalPairs);
    } catch {
      proposalReadWarning = "智能体提案数据暂不可用，请稍后重试。";
    }
  }

  if (features.arbitration.enabled) {
    try {
      const arbitrationCases = await listArbitrationCases(userContext);
      arbitrationCasesByTaskId = new Map(
        tasks.map((task) => [
          task.id,
          arbitrationCases.filter((arbitrationCase) => arbitrationCase.entityType === "task" && arbitrationCase.entityId === task.id),
        ]),
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
