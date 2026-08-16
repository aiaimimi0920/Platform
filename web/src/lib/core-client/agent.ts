import {
  type AddAgentCapabilityInput,
  type AgentCapabilityView,
  type AgentMarketplaceAutoProposalSweepResult,
  type InvokeAgentMarketplaceListingInput,
  type InvokeAgentMarketplaceListingResult,
  type AgentMarketplaceListingView,
  type CreateAgentInput,
  type UpdateAgentInput,
  type InternalUserContext,
  type UpdateAgentCapabilityInput,
  type UpdateAgentMarketplaceListingStatusInput,
  type UpsertAgentMarketplaceListingInput,
} from "@neuro/contracts";

import type {
  AgentView,
  AgentExecutionView,
} from "./types";

import { coreRequest } from "./request";

export async function listAgents(userContext: InternalUserContext) {
  const response = await coreRequest<{ agents: AgentView[] }>("/v1/agents", {
    userContext,
  });
  return response.agents;
}

export async function listAgentMarketplaceListings(
  userContext: InternalUserContext,
  scope: "owner" | "public" = "owner",
  limit?: number,
) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  const response = await coreRequest<{ listings: AgentMarketplaceListingView[] }>(
    `/v1/agents/marketplace/listings?${params.toString()}`,
    {
      userContext,
    },
  );
  return response.listings;
}

export async function listPublicAgentMarketplaceListingsByAgentIds(
  agentIds: string[],
  perAgentLimit = 2,
) {
  const normalizedAgentIds = [...new Set(agentIds.map((value) => value.trim()).filter(Boolean))].slice(0, 24);
  if (normalizedAgentIds.length === 0) {
    return [] as AgentMarketplaceListingView[];
  }
  const params = new URLSearchParams();
  params.set("agentIds", normalizedAgentIds.join(","));
  params.set("perAgentLimit", String(Math.max(1, Math.min(perAgentLimit, 6))));
  const response = await coreRequest<{ listings: AgentMarketplaceListingView[] }>(
    `/v1/public/agents/marketplace/listings?${params.toString()}`,
  );
  return response.listings;
}

export async function listSuppliedAgentMarketplaceExecutions(
  userContext: InternalUserContext,
  limit = 20,
) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const response = await coreRequest<{ executions: AgentExecutionView[] }>(
    `/v1/agents/marketplace/supplier-executions?limit=${encodeURIComponent(String(boundedLimit))}`,
    {
      userContext,
    },
  );
  return response.executions;
}

export async function invokeAgentMarketplaceListing(
  userContext: InternalUserContext,
  listingId: string,
  input: InvokeAgentMarketplaceListingInput,
) {
  const response = await coreRequest<{ result: InvokeAgentMarketplaceListingResult }>(
    `/v1/agents/marketplace/listings/${encodeURIComponent(listingId)}/invoke`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.result;
}

export async function createAgent(userContext: InternalUserContext, input: CreateAgentInput) {
  const response = await coreRequest<{ agent: AgentView }>("/v1/agents", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.agent;
}

export async function updateAgent(
  userContext: InternalUserContext,
  agentId: string,
  input: UpdateAgentInput,
) {
  const response = await coreRequest<{ agent: AgentView }>(`/v1/agents/${encodeURIComponent(agentId)}`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.agent;
}

export async function deleteAgent(userContext: InternalUserContext, agentId: string) {
  const response = await coreRequest<{ deletedAgentId: string; deletedAgentName: string }>(
    `/v1/agents/${encodeURIComponent(agentId)}/delete`,
    {
      method: "POST",
      userContext,
    },
  );
  return response;
}

export async function upsertAgentMarketplaceListing(
  userContext: InternalUserContext,
  input: UpsertAgentMarketplaceListingInput,
) {
  const response = await coreRequest<{ listing: AgentMarketplaceListingView }>("/v1/agents/marketplace/listings", {
    method: "POST",
    body: input,
    userContext,
  });
  return response.listing;
}

export async function updateAgentMarketplaceListingStatus(
  userContext: InternalUserContext,
  listingId: string,
  input: UpdateAgentMarketplaceListingStatusInput,
) {
  const response = await coreRequest<{ listing: AgentMarketplaceListingView }>(
    `/v1/agents/marketplace/listings/${encodeURIComponent(listingId)}/status`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.listing;
}

export async function runAgentMarketplaceAutoProposalSweep(
  userContext: InternalUserContext,
  limit?: number,
) {
  const response = await coreRequest<{ result: AgentMarketplaceAutoProposalSweepResult }>(
    "/v1/agents/marketplace/auto-proposals/sweep",
    {
      method: "POST",
      body: typeof limit === "number" ? { limit } : {},
      userContext,
    },
  );
  return response.result;
}

export async function listAgentCapabilities(userContext: InternalUserContext, agentId: string) {
  const response = await coreRequest<{ capabilities: AgentCapabilityView[] }>(`/v1/agents/${agentId}/capabilities`, {
    userContext,
  });
  return response.capabilities;
}

export async function addAgentCapability(
  userContext: InternalUserContext,
  agentId: string,
  input: AddAgentCapabilityInput,
) {
  const response = await coreRequest<{ capability: AgentCapabilityView }>(`/v1/agents/${agentId}/capabilities`, {
    method: "POST",
    body: input,
    userContext,
  });
  return response.capability;
}

export async function updateAgentCapability(
  userContext: InternalUserContext,
  agentId: string,
  capabilityId: string,
  input: UpdateAgentCapabilityInput,
) {
  const response = await coreRequest<{ capability: AgentCapabilityView }>(
    `/v1/agents/${encodeURIComponent(agentId)}/capabilities/${encodeURIComponent(capabilityId)}`,
    {
      method: "POST",
      body: input,
      userContext,
    },
  );
  return response.capability;
}
