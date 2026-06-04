import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  agentExecutionArtifacts,
  agentExecutionCallbacks,
  agentExecutionLaunchDefaultPresets,
  agentExecutionLaunchPresets,
  agentExecutionRuntimeSessions,
  agentExecutionRuns,
  agentExecutionSteps,
  agentExecutionSubtasks,
  agentExecutions,
} from "@/modules/agent-execution/schema";
import { getOwnedAgent } from "@/modules/agent-registry/repository";
import { agents } from "@/modules/agent-registry/schema";

export async function listAgentExecutionsByOwner(ownerUserId: string) {
  return db
    .select()
    .from(agentExecutions)
    .where(eq(agentExecutions.ownerUserId, ownerUserId))
    .orderBy(asc(agentExecutions.createdAt));
}

export async function listSuppliedMarketplaceAgentExecutions(agentOwnerUserId: string, limit = 20) {
  return db
    .select({ execution: agentExecutions })
    .from(agentExecutions)
    .innerJoin(agents, eq(agentExecutions.agentId, agents.id))
    .where(and(eq(agents.ownerUserId, agentOwnerUserId), eq(agents.enabled, true)))
    .orderBy(desc(agentExecutions.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)))
    .then((rows) => rows.map((row) => row.execution).filter((row) => row.marketplaceInvocation !== null));
}

export async function listAgentExecutionLaunchPresetsByOwner(ownerUserId: string) {
  return db
    .select()
    .from(agentExecutionLaunchPresets)
    .where(eq(agentExecutionLaunchPresets.ownerUserId, ownerUserId))
    .orderBy(asc(agentExecutionLaunchPresets.name), desc(agentExecutionLaunchPresets.updatedAt));
}

export async function getOwnedAgentExecutionLaunchPreset(ownerUserId: string, presetId: string) {
  const [row] = await db
    .select()
    .from(agentExecutionLaunchPresets)
    .where(and(eq(agentExecutionLaunchPresets.id, presetId), eq(agentExecutionLaunchPresets.ownerUserId, ownerUserId)));
  return row ?? null;
}

export async function getAgentExecutionLaunchDefaultPreset(ownerUserId: string) {
  const [row] = await db
    .select()
    .from(agentExecutionLaunchDefaultPresets)
    .where(eq(agentExecutionLaunchDefaultPresets.ownerUserId, ownerUserId));
  return row ?? null;
}

export async function getOwnedAgentExecution(ownerUserId: string, executionId: string) {
  const [row] = await db
    .select()
    .from(agentExecutions)
    .where(and(eq(agentExecutions.id, executionId), eq(agentExecutions.ownerUserId, ownerUserId)));
  return row ?? null;
}

export async function getAgentExecutionById(executionId: string) {
  const [row] = await db.select().from(agentExecutions).where(eq(agentExecutions.id, executionId));
  return row ?? null;
}

export async function getOwnedRunnableAgent(ownerUserId: string, agentId: string) {
  return getOwnedAgent(ownerUserId, agentId);
}

export async function getExternalAgentExecution(executionId: string) {
  const [row] = await db
    .select({
      execution: agentExecutions,
      agent: agents,
    })
    .from(agentExecutions)
    .innerJoin(agents, eq(agentExecutions.agentId, agents.id))
    .where(eq(agentExecutions.id, executionId));

  return row ?? null;
}

export async function listArtifactsByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionArtifacts)
    .where(inArray(agentExecutionArtifacts.executionId, executionIds))
    .orderBy(asc(agentExecutionArtifacts.createdAt));
}

export async function listCallbacksByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionCallbacks)
    .where(inArray(agentExecutionCallbacks.executionId, executionIds))
    .orderBy(asc(agentExecutionCallbacks.receivedAt));
}

export async function listRunsByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionRuns)
    .where(inArray(agentExecutionRuns.executionId, executionIds))
    .orderBy(desc(agentExecutionRuns.createdAt));
}

export async function listRuntimeSessionsByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionRuntimeSessions)
    .where(inArray(agentExecutionRuntimeSessions.executionId, executionIds))
    .orderBy(desc(agentExecutionRuntimeSessions.startedAt), desc(agentExecutionRuntimeSessions.updatedAt));
}

export async function listStepsByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionSteps)
    .where(inArray(agentExecutionSteps.executionId, executionIds))
    .orderBy(asc(agentExecutionSteps.createdAt));
}

export async function listSubtasksByExecutionIds(executionIds: string[]) {
  if (executionIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(agentExecutionSubtasks)
    .where(inArray(agentExecutionSubtasks.executionId, executionIds))
    .orderBy(asc(agentExecutionSubtasks.sortOrder), asc(agentExecutionSubtasks.createdAt));
}
