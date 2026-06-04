import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  agentCallbackConfigHistory,
  agentCapabilities,
  agentMarketplaceListings,
  agents,
} from "@/modules/agent-registry/schema";

export async function listAgentsByOwner(ownerUserId: string) {
  return db
    .select()
    .from(agents)
    .where(eq(agents.ownerUserId, ownerUserId))
    .orderBy(asc(agents.createdAt));
}

export async function getOwnedAgent(ownerUserId: string, agentId: string) {
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.ownerUserId, ownerUserId)));
  return row ?? null;
}

export async function getAgentById(agentId: string) {
  const [row] = await db.select().from(agents).where(eq(agents.id, agentId));
  return row ?? null;
}

export async function listCapabilitiesByAgent(agentId: string) {
  return db
    .select()
    .from(agentCapabilities)
    .where(eq(agentCapabilities.agentId, agentId))
    .orderBy(asc(agentCapabilities.createdAt));
}

export async function listCallbackHistoryByAgent(agentId: string, limit = 20) {
  return db
    .select()
    .from(agentCallbackConfigHistory)
    .where(eq(agentCallbackConfigHistory.agentId, agentId))
    .orderBy(desc(agentCallbackConfigHistory.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}

export async function getMarketplaceListingByCapability(capabilityId: string) {
  const [row] = await db
    .select()
    .from(agentMarketplaceListings)
    .where(eq(agentMarketplaceListings.capabilityId, capabilityId));
  return row ?? null;
}

export async function getMarketplaceListingById(listingId: string) {
  const [row] = await db
    .select()
    .from(agentMarketplaceListings)
    .where(eq(agentMarketplaceListings.id, listingId));
  return row ?? null;
}

export async function getMarketplaceListingDetailById(listingId: string) {
  const [row] = await db
    .select({
      listing: agentMarketplaceListings,
      agent: agents,
      capability: agentCapabilities,
    })
    .from(agentMarketplaceListings)
    .innerJoin(agents, eq(agentMarketplaceListings.agentId, agents.id))
    .innerJoin(agentCapabilities, eq(agentMarketplaceListings.capabilityId, agentCapabilities.id))
    .where(eq(agentMarketplaceListings.id, listingId));
  return row ?? null;
}

export async function listMarketplaceListingsByAgentIds(agentIds: string[]) {
  if (agentIds.length === 0) {
    return [];
  }
  return db
    .select()
    .from(agentMarketplaceListings)
    .where(inArray(agentMarketplaceListings.agentId, agentIds))
    .orderBy(desc(agentMarketplaceListings.updatedAt));
}
