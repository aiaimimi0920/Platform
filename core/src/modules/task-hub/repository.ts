import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import { arbitrationCases } from "@/modules/arbitration/schema";
import { agents } from "@/modules/agent-registry/schema";
import {
  tasks,
  taskApplications,
  taskDispatchDecisions,
  bondHolds,
  taskRewardHolds,
  taskAgentProposals,
} from "@/modules/task-hub/schema";

export async function listTasksWithCounts() {
  const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  const counts = await db
    .select({
      taskId: taskApplications.taskId,
      applicationCount: count(taskApplications.id),
    })
    .from(taskApplications)
    .groupBy(taskApplications.taskId);
  const arbitrationCounts = await db
    .select({
      taskId: arbitrationCases.entityId,
      arbitrationCaseCount: count(arbitrationCases.id),
    })
    .from(arbitrationCases)
    .where(eq(arbitrationCases.entityType, "task"))
    .groupBy(arbitrationCases.entityId);

  const countMap = new Map(counts.map((entry) => [entry.taskId, Number(entry.applicationCount)]));
  const arbitrationCountMap = new Map(
    arbitrationCounts.map((entry) => [entry.taskId, Number(entry.arbitrationCaseCount)]),
  );
  return rows.map((task) => ({
    task,
    applicationCount: countMap.get(task.id) ?? 0,
    arbitrationCaseCount: arbitrationCountMap.get(task.id) ?? 0,
  }));
}

export async function listTasksWithCountsByUser(userId: string) {
  const rows = await db
    .select()
    .from(tasks)
    .where(or(eq(tasks.creatorUserId, userId), eq(tasks.assignedUserId, userId)))
    .orderBy(desc(tasks.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const taskIds = rows.map((task) => task.id);
  const counts = await db
    .select({
      taskId: taskApplications.taskId,
      applicationCount: count(taskApplications.id),
    })
    .from(taskApplications)
    .where(inArray(taskApplications.taskId, taskIds))
    .groupBy(taskApplications.taskId);
  const arbitrationCounts = await db
    .select({
      taskId: arbitrationCases.entityId,
      arbitrationCaseCount: count(arbitrationCases.id),
    })
    .from(arbitrationCases)
    .where(and(eq(arbitrationCases.entityType, "task"), inArray(arbitrationCases.entityId, taskIds)))
    .groupBy(arbitrationCases.entityId);

  const countMap = new Map(counts.map((entry) => [entry.taskId, Number(entry.applicationCount)]));
  const arbitrationCountMap = new Map(
    arbitrationCounts.map((entry) => [entry.taskId, Number(entry.arbitrationCaseCount)]),
  );
  return rows.map((task) => ({
    task,
    applicationCount: countMap.get(task.id) ?? 0,
    arbitrationCaseCount: arbitrationCountMap.get(task.id) ?? 0,
  }));
}

export async function getTaskById(taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return task ?? null;
}

export async function listTaskApplicationsByTask(taskId: string) {
  return db
    .select()
    .from(taskApplications)
    .where(eq(taskApplications.taskId, taskId))
    .orderBy(asc(taskApplications.createdAt));
}

export async function getDispatchDecision(taskId: string) {
  const [decision] = await db.select().from(taskDispatchDecisions).where(eq(taskDispatchDecisions.taskId, taskId));
  return decision ?? null;
}

export async function getBondHold(taskId: string, applicationId: string) {
  const [hold] = await db
    .select()
    .from(bondHolds)
    .where(and(eq(bondHolds.taskId, taskId), eq(bondHolds.applicationId, applicationId)));
  return hold ?? null;
}

export async function getActiveBondHoldByApplication(taskId: string, applicationId: string) {
  const [hold] = await db
    .select()
    .from(bondHolds)
    .where(
      and(
        eq(bondHolds.taskId, taskId),
        eq(bondHolds.applicationId, applicationId),
        eq(bondHolds.status, "active"),
      ),
    );
  return hold ?? null;
}

export async function getTaskRewardHold(taskId: string) {
  const [hold] = await db.select().from(taskRewardHolds).where(eq(taskRewardHolds.taskId, taskId));
  return hold ?? null;
}

export async function listTaskAgentProposalsByTask(taskId: string) {
  return db
    .select()
    .from(taskAgentProposals)
    .where(eq(taskAgentProposals.taskId, taskId))
    .orderBy(asc(taskAgentProposals.createdAt));
}

export async function getTaskAgentProposalById(taskId: string, proposalId: string) {
  const [proposal] = await db
    .select()
    .from(taskAgentProposals)
    .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.id, proposalId)));
  return proposal ?? null;
}

export async function getOwnedAgentById(ownerUserId: string, agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.ownerUserId, ownerUserId)));
  return agent ?? null;
}
