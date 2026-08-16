// Agent proposal create/accept/reject. Moved verbatim from service.ts.

import type {
  CreateTaskAgentProposalInput,
  TaskAgentProposalView,
  TaskView,
} from "@neuro/contracts";
import { and, count, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  getOwnedAgentById,
  getTaskAgentProposalById,
} from "@/modules/task-hub/repository";
import {
  taskAgentProposals,
  taskApplications,
  tasks,
} from "@/modules/task-hub/schema";
import { BadRequestError, ConflictError, NotFoundError } from "@/platform/errors";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";

import {
  assignTaskToAgentProposalInTx,
  dispatchTaskInTx,
} from "./dispatch";
import { releaseRejectedBonds } from "./escrow";
import {
  getProposalMatchedCapabilityMap,
  getTaskWithCountInTx,
  isUniqueViolation,
  now,
  toTaskAgentProposalView,
  toTaskView,
} from "./shared";

export async function createAgentProposal(
  userId: string,
  taskId: string,
  input: CreateTaskAgentProposalInput,
): Promise<TaskAgentProposalView> {
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);

  const ownedAgent = await getOwnedAgentById(userId, input.agentId);
  if (!ownedAgent) {
    throw new NotFoundError("Agent not found or not owned by current user");
  }
  if (!ownedAgent.enabled) {
    throw new ConflictError("Agent is disabled");
  }

  try {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select id from tasks where id = ${taskId} for update`);

      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (!task) {
        throw new NotFoundError("Task not found");
      }
      if (task.creatorUserId === userId) {
        throw new BadRequestError("Task creator cannot submit agent proposal");
      }
      if (!["open", "applying"].includes(task.status)) {
        throw new ConflictError("Task is not accepting proposals");
      }

      const [existing] = await tx
        .select()
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.agentId, input.agentId)));
      if (existing) {
        throw new ConflictError("This agent has already submitted a proposal for the task");
      }

      const [created] = await tx
        .insert(taskAgentProposals)
        .values({
          id: crypto.randomUUID(),
          taskId,
          proposerUserId: userId,
          agentId: input.agentId,
          statement: input.statement,
          proposedEtaHours: input.proposedEtaHours,
          proposedCostNote: input.proposedCostNote ?? null,
          executionId: null,
          status: "pending",
          createdAt: now(),
        })
        .returning();

      const pendingApplications = await tx
        .select({ count: count(taskApplications.id) })
        .from(taskApplications)
        .where(and(eq(taskApplications.taskId, taskId), eq(taskApplications.status, "pending")));
      const pendingProposals = await tx
        .select({ count: count(taskAgentProposals.id) })
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")));

      const totalPendingCandidates =
        Number(pendingApplications[0]?.count ?? 0) + Number(pendingProposals[0]?.count ?? 0);

      if (allowAgentProposals && totalPendingCandidates >= 2) {
        await dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals);
      }

      const [currentProposal] = await tx
        .select()
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.id, created.id)));
      if (!currentProposal) {
        throw new NotFoundError("Task agent proposal not found after creation");
      }

      const [currentTask] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (!currentTask) {
        throw new NotFoundError("Task not found after proposal creation");
      }

      const matchedCapabilityMap = await getProposalMatchedCapabilityMap(currentTask, [currentProposal]);
      return toTaskAgentProposalView(
        currentProposal,
        currentTask,
        userId,
        matchedCapabilityMap.get(currentProposal.id) ?? [],
      );
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("This agent has already submitted a proposal for the task");
    }
    throw error;
  }
}

export async function acceptAgentProposal(
  actorUserId: string,
  taskId: string,
  proposalId: string,
): Promise<{ task: TaskView; proposal: TaskAgentProposalView; executionId: string }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    await tx.execute(sql`select id from task_agent_proposals where id = ${proposalId} for update`);

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new NotFoundError("Task not found");
    if (task.creatorUserId !== actorUserId) {
      throw new ConflictError("Only task creator can accept agent proposals");
    }
    if (!["open", "applying"].includes(task.status)) {
      throw new ConflictError("Task is not accepting agent proposals");
    }
    if (task.assignedUserId) {
      throw new ConflictError("Task already has an assignee");
    }

    const proposal = await getTaskAgentProposalById(taskId, proposalId);
    if (!proposal) {
      throw new NotFoundError("Task agent proposal not found");
    }
    if (proposal.status !== "pending") {
      throw new ConflictError("Task agent proposal is no longer pending");
    }

    const ownedAgent = await getOwnedAgentById(proposal.proposerUserId, proposal.agentId);
    if (!ownedAgent || !ownedAgent.enabled) {
      throw new ConflictError("Agent proposal cannot be accepted because the agent is unavailable");
    }

    const pendingApplications = (
      await tx.select().from(taskApplications).where(eq(taskApplications.taskId, taskId))
    ).filter((application) => application.status === "pending");

    if (pendingApplications.length > 0) {
      await releaseRejectedBonds(
        tx,
        task.title,
        pendingApplications.map((application) => application.id),
        now(),
      );
    }

    await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(and(eq(taskAgentProposals.taskId, taskId), ne(taskAgentProposals.id, proposalId), eq(taskAgentProposals.status, "pending")));

    const assignment = await assignTaskToAgentProposalInTx({
      tx,
      task,
      proposal,
      decidedAt: now(),
    });

    const taskWithCount = await getTaskWithCountInTx(tx, taskId);
    if (!taskWithCount) {
      throw new NotFoundError("Task not found after accepting agent proposal");
    }
    const matchedCapabilityMap = await getProposalMatchedCapabilityMap(taskWithCount.task, [assignment.updatedProposal]);

    return {
      task: toTaskView(taskWithCount.task, taskWithCount.applicationCount, taskWithCount.arbitrationCaseCount),
      proposal: toTaskAgentProposalView(
        assignment.updatedProposal,
        taskWithCount.task,
        actorUserId,
        matchedCapabilityMap.get(assignment.updatedProposal.id) ?? [],
      ),
      executionId: assignment.execution.id,
    };
    });
  }

export async function rejectAgentProposal(
  actorUserId: string,
  taskId: string,
  proposalId: string,
): Promise<TaskAgentProposalView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    await tx.execute(sql`select id from task_agent_proposals where id = ${proposalId} for update`);

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new NotFoundError("Task not found");
    if (task.creatorUserId !== actorUserId) {
      throw new ConflictError("Only task creator can reject agent proposals");
    }
    if (!["open", "applying"].includes(task.status)) {
      throw new ConflictError("Task is not accepting agent proposals");
    }

    const proposal = await getTaskAgentProposalById(taskId, proposalId);
    if (!proposal) {
      throw new NotFoundError("Task agent proposal not found");
    }
    if (proposal.status !== "pending") {
      throw new ConflictError("Task agent proposal is no longer pending");
    }

    const [updated] = await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(eq(taskAgentProposals.id, proposal.id))
      .returning();

      const matchedCapabilityMap = await getProposalMatchedCapabilityMap(task, [updated]);
      return toTaskAgentProposalView(updated, task, actorUserId, matchedCapabilityMap.get(updated.id) ?? []);
    });
  }
