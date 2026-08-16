// Dispatch scoring, assignment to applications/agent proposals, and dispatch
// decision reads. Moved verbatim from service.ts.

import type { DispatchDecisionView } from "@neuro/contracts";
import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  getDispatchReputationProfilesInTx,
} from "../../../../../packages/account-domain/dist/modules/reputation/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { createOwnedAgentExecutionInTx } from "@/modules/agent-execution/service";
import {
  getEnabledAgentIdSetInTx,
  getEnabledCapabilityCodeMapInTx,
} from "@/modules/agent-registry/service";
import { users } from "@/modules/identity/schema";
import {
  getDispatchDecision as getDispatchDecisionFromRepo,
  getOwnedAgentById,
} from "@/modules/task-hub/repository";
import {
  taskAgentProposals,
  taskApplications,
  taskDispatchDecisions,
  tasks,
} from "@/modules/task-hub/schema";
import { ConflictError } from "@/platform/errors";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  ensureTaskRewardEscrowHoldInTx,
  releaseRejectedBonds,
} from "./escrow";
import {
  now,
  normalizeCapabilityCodes,
} from "./shared";

async function getApplicantStatsInTx(tx: NodePgDatabase<typeof schema>, userId: string) {
  const [completed] = await tx
    .select({ count: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.assignedUserId, userId), eq(tasks.status, "accepted")));
  const [defaulted] = await tx
    .select({ count: count(tasks.id) })
    .from(tasks)
    .where(and(eq(tasks.assignedUserId, userId), eq(tasks.status, "defaulted")));

  const completedCount = completed?.count ? Number(completed.count) : 0;
  const defaultCount = defaulted?.count ? Number(defaulted.count) : 0;
  const totalHandled = completedCount + defaultCount;
  const completionRate = totalHandled === 0 ? 0 : completedCount / totalHandled;

  return {
    completedCount,
    defaultCount,
    completionRate,
  };
}

type DispatchScoredApplication = {
  application: typeof taskApplications.$inferSelect;
  matchedCapabilityCodes: string[];
  matchedCapabilityCount: number;
  trustLevel: number;
  completionRate: number;
  defaultCount: number;
  defaultRate: number;
  reputationScore: number;
};

type DispatchScoredProposal = {
  proposal: typeof taskAgentProposals.$inferSelect;
  matchedCapabilityCodes: string[];
  matchedCapabilityCount: number;
  trustLevel: number;
  completionRate: number;
  defaultCount: number;
  defaultRate: number;
  reputationScore: number;
};

type DispatchCandidate =
  | ({ kind: "application" } & DispatchScoredApplication)
  | ({ kind: "proposal" } & DispatchScoredProposal);

const DISPATCH_SCORING_CONCURRENCY = 12;

async function buildLegacyScoredApplications(
  tx: NodePgDatabase<typeof schema>,
  pendingApplications: typeof taskApplications.$inferSelect[],
  applicantIds: string[],
): Promise<DispatchScoredApplication[]> {
  const applicantRows = await tx.select().from(users).where(inArray(users.id, applicantIds));
  const userMap = new Map(applicantRows.map((user) => [user.id, user]));

  return mapWithConcurrency(
    pendingApplications,
    DISPATCH_SCORING_CONCURRENCY,
    async (application) => {
      const user = userMap.get(application.applicantUserId);
      const stats = await getApplicantStatsInTx(tx, application.applicantUserId);
      const totalHandled = stats.completedCount + stats.defaultCount;
      const defaultRate = totalHandled <= 0 ? 0 : stats.defaultCount / totalHandled;
      return {
        application,
        matchedCapabilityCodes: [],
        matchedCapabilityCount: 0,
        trustLevel: user?.trustLevel ?? 0,
        completionRate: stats.completionRate,
        defaultCount: stats.defaultCount,
        defaultRate,
        reputationScore: 0,
      };
    },
  );
}

async function buildReputationScoredApplications(
  tx: NodePgDatabase<typeof schema>,
  pendingApplications: typeof taskApplications.$inferSelect[],
  applicantIds: string[],
): Promise<DispatchScoredApplication[]> {
  const profiles = await getDispatchReputationProfilesInTx(tx, applicantIds);
  const legacyFallback = await buildLegacyScoredApplications(tx, pendingApplications, applicantIds);
  const legacyByUserId = new Map(legacyFallback.map((row) => [row.application.applicantUserId, row]));

  return pendingApplications.map((application) => {
    const profile = profiles.get(application.applicantUserId);
    const fallback = legacyByUserId.get(application.applicantUserId);
    return {
      application,
      matchedCapabilityCodes: [],
      matchedCapabilityCount: 0,
      trustLevel: profile?.trustLevel ?? fallback?.trustLevel ?? 0,
      completionRate: profile?.completionRate ?? fallback?.completionRate ?? 0,
      defaultCount: fallback?.defaultCount ?? 0,
      defaultRate: profile?.defaultRate ?? fallback?.defaultRate ?? 1,
      reputationScore: profile?.reputationScore ?? 0,
    };
  });
}

async function buildLegacyScoredProposals(
  tx: NodePgDatabase<typeof schema>,
  task: typeof tasks.$inferSelect,
  pendingProposals: typeof taskAgentProposals.$inferSelect[],
  proposerIds: string[],
): Promise<DispatchScoredProposal[]> {
  const proposerRows = await tx.select().from(users).where(inArray(users.id, proposerIds));
  const userMap = new Map(proposerRows.map((user) => [user.id, user]));
  const capabilityMap = await getEnabledCapabilityCodeMapInTx(tx, pendingProposals.map((proposal) => proposal.agentId));
  const preferredCodes = normalizeCapabilityCodes(task.preferredCapabilityCodes);

  return mapWithConcurrency(
    pendingProposals,
    DISPATCH_SCORING_CONCURRENCY,
    async (proposal) => {
      const user = userMap.get(proposal.proposerUserId);
      const stats = await getApplicantStatsInTx(tx, proposal.proposerUserId);
      const totalHandled = stats.completedCount + stats.defaultCount;
      const defaultRate = totalHandled <= 0 ? 0 : stats.defaultCount / totalHandled;
      const matchedCapabilityCodes = preferredCodes.filter((code) =>
        (capabilityMap.get(proposal.agentId) ?? []).includes(code),
      );
      return {
        proposal,
        matchedCapabilityCodes,
        matchedCapabilityCount: matchedCapabilityCodes.length,
        trustLevel: user?.trustLevel ?? 0,
        completionRate: stats.completionRate,
        defaultCount: stats.defaultCount,
        defaultRate,
        reputationScore: 0,
      };
    },
  );
}

async function buildReputationScoredProposals(
  tx: NodePgDatabase<typeof schema>,
  task: typeof tasks.$inferSelect,
  pendingProposals: typeof taskAgentProposals.$inferSelect[],
  proposerIds: string[],
): Promise<DispatchScoredProposal[]> {
  const profiles = await getDispatchReputationProfilesInTx(tx, proposerIds);
  const legacyFallback = await buildLegacyScoredProposals(tx, task, pendingProposals, proposerIds);
  const legacyByUserId = new Map(legacyFallback.map((row) => [row.proposal.proposerUserId, row]));

  return pendingProposals.map((proposal) => {
    const profile = profiles.get(proposal.proposerUserId);
    const fallback = legacyByUserId.get(proposal.proposerUserId);
    return {
      proposal,
      matchedCapabilityCodes: fallback?.matchedCapabilityCodes ?? [],
      matchedCapabilityCount: fallback?.matchedCapabilityCount ?? 0,
      trustLevel: profile?.trustLevel ?? fallback?.trustLevel ?? 0,
      completionRate: profile?.completionRate ?? fallback?.completionRate ?? 0,
      defaultCount: fallback?.defaultCount ?? 0,
      defaultRate: profile?.defaultRate ?? fallback?.defaultRate ?? 1,
      reputationScore: profile?.reputationScore ?? 0,
    };
  });
}

async function rejectPendingTaskAgentProposalsInTx(
  tx: NodePgDatabase<typeof schema>,
  taskId: string,
  exceptProposalId?: string,
) {
  await tx
    .update(taskAgentProposals)
    .set({ status: "rejected" })
    .where(
      exceptProposalId
        ? and(eq(taskAgentProposals.taskId, taskId), ne(taskAgentProposals.id, exceptProposalId), eq(taskAgentProposals.status, "pending"))
        : and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")),
    );
}

export async function assignTaskToAgentProposalInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  task: typeof tasks.$inferSelect;
  proposal: typeof taskAgentProposals.$inferSelect;
  decidedAt: Date;
}) {
  const ownedAgent = await getOwnedAgentById(args.proposal.proposerUserId, args.proposal.agentId);
  if (!ownedAgent || !ownedAgent.enabled) {
    throw new ConflictError("Agent proposal cannot be assigned because the agent is unavailable");
  }

  const execution = await createOwnedAgentExecutionInTx(args.tx, args.proposal.proposerUserId, {
    agentId: args.proposal.agentId,
    taskId: args.task.id,
    title: `任务执行：${args.task.title}`,
    objective: args.task.description,
  });

  const [updatedProposal] = await args.tx
    .update(taskAgentProposals)
    .set({
      status: "accepted",
      executionId: execution.id,
    })
    .where(eq(taskAgentProposals.id, args.proposal.id))
    .returning();

  await rejectPendingTaskAgentProposalsInTx(args.tx, args.task.id, args.proposal.id);

  await args.tx
    .update(tasks)
    .set({
      assignedUserId: args.proposal.proposerUserId,
      status: "assigned",
    })
    .where(eq(tasks.id, args.task.id));

  const [decision] = await args.tx
    .insert(taskDispatchDecisions)
    .values({
      id: crypto.randomUUID(),
      taskId: args.task.id,
      assignedApplicationId: null,
      assignedProposalId: args.proposal.id,
      assignedUserId: args.proposal.proposerUserId,
      decidedAt: args.decidedAt,
    })
    .returning();

  await ensureTaskRewardEscrowHoldInTx({
    tx: args.tx,
    task: args.task,
    assignedUserId: args.proposal.proposerUserId,
    allowChargeIfMissing: true,
    timestamp: args.decidedAt,
  });

  await enqueueOutboxEvent(
    "task.assigned",
    {
      taskId: args.task.id,
      assignedUserId: args.proposal.proposerUserId,
      assignedApplicationId: null,
      proposalId: args.proposal.id,
      executionId: execution.id,
      assignmentMode: "agentProposal",
    },
    args.tx,
  );

  return {
    decision,
    updatedProposal,
    execution,
  };
}

export async function dispatchTaskInTx(
  tx: NodePgDatabase<typeof schema>,
  taskId: string,
  preferReputationRanking: boolean,
  allowAgentProposals: boolean,
): Promise<DispatchDecisionView | null> {
  await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return null;

  const [existingDecision] = await tx
    .select()
    .from(taskDispatchDecisions)
    .where(eq(taskDispatchDecisions.taskId, taskId));
  if (existingDecision) {
    await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: existingDecision.assignedUserId,
      allowChargeIfMissing: true,
      timestamp: existingDecision.decidedAt,
    });
    return {
      taskId: existingDecision.taskId,
      assignedApplicationId: existingDecision.assignedApplicationId,
      assignedProposalId: existingDecision.assignedProposalId,
      assignedUserId: existingDecision.assignedUserId,
      assignmentMode: existingDecision.assignedProposalId ? "agentProposal" : "application",
      decidedAt: existingDecision.decidedAt.toISOString(),
    };
  }

  if (!["open", "applying"].includes(task.status)) return null;

  const pendingApplications = await tx
    .select()
    .from(taskApplications)
    .where(and(eq(taskApplications.taskId, taskId), eq(taskApplications.status, "pending")));
  const rawPendingProposals = allowAgentProposals
    ? await tx
        .select()
        .from(taskAgentProposals)
        .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")))
    : [];
  const enabledAgentIds = allowAgentProposals
    ? await getEnabledAgentIdSetInTx(tx, rawPendingProposals.map((proposal) => proposal.agentId))
    : new Set<string>();
  const disabledProposalIds = rawPendingProposals
    .filter((proposal) => !enabledAgentIds.has(proposal.agentId))
    .map((proposal) => proposal.id);
  if (disabledProposalIds.length > 0) {
    await tx
      .update(taskAgentProposals)
      .set({ status: "rejected" })
      .where(inArray(taskAgentProposals.id, disabledProposalIds));
  }
  const pendingProposals = rawPendingProposals.filter((proposal) => enabledAgentIds.has(proposal.agentId));
  if (pendingApplications.length === 0 && pendingProposals.length === 0) return null;

  const applicantIds = pendingApplications.map((application) => application.applicantUserId);
  const proposerIds = pendingProposals.map((proposal) => proposal.proposerUserId);
  const scoredApplications = preferReputationRanking
    ? await buildReputationScoredApplications(tx, pendingApplications, applicantIds)
    : await buildLegacyScoredApplications(tx, pendingApplications, applicantIds);
  const scoredProposals = allowAgentProposals
    ? preferReputationRanking
      ? await buildReputationScoredProposals(tx, task, pendingProposals, proposerIds)
      : await buildLegacyScoredProposals(tx, task, pendingProposals, proposerIds)
    : [];
  const scored: DispatchCandidate[] = [
    ...scoredApplications.map((entry) => ({ kind: "application" as const, ...entry })),
    ...scoredProposals.map((entry) => ({ kind: "proposal" as const, ...entry })),
  ];

  scored.sort((left, right) => {
    const leftEta = left.kind === "application" ? left.application.proposedEtaHours : left.proposal.proposedEtaHours;
    const rightEta = right.kind === "application" ? right.application.proposedEtaHours : right.proposal.proposedEtaHours;
    const leftCreatedAt = left.kind === "application" ? left.application.createdAt : left.proposal.createdAt;
    const rightCreatedAt = right.kind === "application" ? right.application.createdAt : right.proposal.createdAt;
    if (preferReputationRanking) {
      if (right.reputationScore !== left.reputationScore) return right.reputationScore - left.reputationScore;
      if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
      if (left.defaultRate !== right.defaultRate) return left.defaultRate - right.defaultRate;
      if (right.trustLevel !== left.trustLevel) return right.trustLevel - left.trustLevel;
      if (right.matchedCapabilityCount !== left.matchedCapabilityCount) {
        return right.matchedCapabilityCount - left.matchedCapabilityCount;
      }
      if (leftEta !== rightEta) {
        return leftEta - rightEta;
      }
      return leftCreatedAt.getTime() - rightCreatedAt.getTime();
    }

    if (right.trustLevel !== left.trustLevel) return right.trustLevel - left.trustLevel;
    if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
    if (left.defaultCount !== right.defaultCount) return left.defaultCount - right.defaultCount;
    if (right.matchedCapabilityCount !== left.matchedCapabilityCount) {
      return right.matchedCapabilityCount - left.matchedCapabilityCount;
    }
    if (leftEta !== rightEta) {
      return leftEta - rightEta;
    }
    return leftCreatedAt.getTime() - rightCreatedAt.getTime();
  });
  const winner = scored[0];
  const decidedAt = now();

  if (winner.kind === "application") {
    await tx
      .update(taskApplications)
      .set({ status: "accepted" })
      .where(eq(taskApplications.id, winner.application.id));

    const rejectedIds = pendingApplications
      .filter((entry) => entry.id !== winner.application.id)
      .map((entry) => entry.id);
    await releaseRejectedBonds(tx, task.title, rejectedIds, decidedAt);
    await rejectPendingTaskAgentProposalsInTx(tx, task.id);

    await tx
      .update(tasks)
      .set({
        assignedUserId: winner.application.applicantUserId,
        status: "assigned",
      })
      .where(eq(tasks.id, taskId));

    const [decision] = await tx
      .insert(taskDispatchDecisions)
      .values({
        id: crypto.randomUUID(),
        taskId,
        assignedApplicationId: winner.application.id,
        assignedProposalId: null,
        assignedUserId: winner.application.applicantUserId,
        decidedAt,
      })
      .returning();

    await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: winner.application.applicantUserId,
      allowChargeIfMissing: true,
      timestamp: decidedAt,
    });

    await enqueueOutboxEvent(
      "task.assigned",
      {
        taskId,
        assignedUserId: winner.application.applicantUserId,
        assignedApplicationId: winner.application.id,
        assignmentMode: "application",
      },
      tx,
    );

    return {
      taskId,
      assignedApplicationId: decision.assignedApplicationId,
      assignedProposalId: null,
      assignedUserId: decision.assignedUserId,
      assignmentMode: "application",
      decidedAt: decision.decidedAt.toISOString(),
    };
  }

  const rejectedIds = pendingApplications.map((entry) => entry.id);
  await releaseRejectedBonds(tx, task.title, rejectedIds, decidedAt);
  const assignment = await assignTaskToAgentProposalInTx({
    tx,
    task,
    proposal: winner.proposal,
    decidedAt,
  });

  return {
    taskId,
    assignedApplicationId: null,
    assignedProposalId: assignment.decision.assignedProposalId,
    assignedUserId: assignment.decision.assignedUserId,
    assignmentMode: "agentProposal",
    decidedAt: assignment.decision.decidedAt.toISOString(),
  };
}

export async function dispatchTask(taskId: string): Promise<DispatchDecisionView | null> {
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);
  return db.transaction(async (tx) => dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals));
}

export async function getDispatchDecision(taskId: string): Promise<DispatchDecisionView | null> {
  const decision = await getDispatchDecisionFromRepo(taskId);
  if (!decision) return null;
  return {
    taskId: decision.taskId,
    assignedApplicationId: decision.assignedApplicationId,
    assignedProposalId: decision.assignedProposalId,
    assignedUserId: decision.assignedUserId,
    assignmentMode: decision.assignedProposalId ? "agentProposal" : "application",
    decidedAt: decision.decidedAt.toISOString(),
  };
}
