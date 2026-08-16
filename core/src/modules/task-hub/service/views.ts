// Owner/public task, application, and proposal list/summary reads.
// Moved verbatim from service.ts.

import type {
  TaskAgentProposalView,
  TaskApplicationView,
  TaskView,
} from "@neuro/contracts";
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  getTaskById,
  getTaskByOwnerAndId,
  listTaskAgentProposalsByTask,
  listTaskApplicationsByTask,
  listTasksWithCountsByUser,
  listTasksWithCounts,
} from "@/modules/task-hub/repository";
import {
  taskApplications,
} from "@/modules/task-hub/schema";
import { NotFoundError } from "@/platform/errors";

import {
  getProposalMatchedCapabilityMap,
  toTaskAgentProposalView,
  toTaskApplicationView,
  toTaskView,
} from "./shared";

export async function listTasks(): Promise<TaskView[]> {
  const rows = await listTasksWithCounts();
  return rows.map(({ task, applicationCount, arbitrationCaseCount }) =>
    toTaskView(task, applicationCount, arbitrationCaseCount),
  );
}

export async function listMyTasks(userId: string): Promise<TaskView[]> {
  const rows = await listTasksWithCountsByUser(userId);
  return rows.map(({ task, applicationCount, arbitrationCaseCount }) =>
    toTaskView(task, applicationCount, arbitrationCaseCount),
  );
}

export async function getOwnedTaskSummary(ownerUserId: string, taskId: string) {
  const task = await getTaskByOwnerAndId(ownerUserId, taskId);
  if (!task) return null;
  const [applicationCountRow] = await db
    .select({ count: count(taskApplications.id) })
    .from(taskApplications)
    .where(eq(taskApplications.taskId, task.id));
  const [arbitrationCountRow] = await db
    .select({ count: count() })
    .from(schema.arbitrationCases)
    .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, task.id)));
  return toTaskView(
    task,
    Number(applicationCountRow?.count ?? 0),
    Number(arbitrationCountRow?.count ?? 0),
  );
}

export async function listApplications(taskId: string): Promise<TaskApplicationView[]> {
  const rows = await listTaskApplicationsByTask(taskId);
  return rows.map(toTaskApplicationView);
}

export async function listAgentProposals(taskId: string): Promise<TaskAgentProposalView[]> {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }
  const rows = await listTaskAgentProposalsByTask(taskId);
  const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, rows);
  return rows.map((proposal) =>
    toTaskAgentProposalView(proposal, task, task.creatorUserId, matchedCapabilityMap.get(proposal.id) ?? []),
  );
}

export async function listVisibleAgentProposals(
  userId: string,
  taskId: string,
): Promise<TaskAgentProposalView[]> {
  const task = await getTaskById(taskId);
  if (!task) {
    throw new NotFoundError("Task not found");
  }

  const rows = await listTaskAgentProposalsByTask(taskId);
  const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, rows);
  if (task.creatorUserId === userId || task.assignedUserId === userId) {
    return rows.map((proposal) =>
      toTaskAgentProposalView(proposal, task, userId, matchedCapabilityMap.get(proposal.id) ?? []),
    );
  }

  return rows
    .filter((proposal) => proposal.proposerUserId === userId)
    .map((proposal) => toTaskAgentProposalView(proposal, task, userId, matchedCapabilityMap.get(proposal.id) ?? []));
}

export async function getTaskSummary(taskId: string) {
  const task = await getTaskById(taskId);
  if (!task) return null;
  const [applicationCountRow] = await db
    .select({ count: count(taskApplications.id) })
    .from(taskApplications)
    .where(eq(taskApplications.taskId, taskId));
  const [arbitrationCountRow] = await db
    .select({ count: count() })
    .from(schema.arbitrationCases)
    .where(and(eq(schema.arbitrationCases.entityType, "task"), eq(schema.arbitrationCases.entityId, taskId)));

  return toTaskView(task, Number(applicationCountRow?.count ?? 0), Number(arbitrationCountRow?.count ?? 0));
}
