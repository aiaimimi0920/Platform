// Human task applications (bond freeze + candidate-threshold dispatch).
// Moved verbatim from service.ts.

import type {
  DispatchDecisionView,
  TaskApplicationView,
} from "@neuro/contracts";
import { and, count, eq, sql } from "drizzle-orm";
import {
  freezeBalance,
} from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import {
  bondHolds,
  taskAgentProposals,
  taskApplications,
  tasks,
} from "@/modules/task-hub/schema";
import { getSingleFeatureModule } from "@/platform/feature-modules/service";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { dispatchTaskInTx } from "./dispatch";
import {
  now,
  toTaskApplicationView,
} from "./shared";

export async function applyToTask(
  userId: string,
  taskId: string,
  statement: string,
  proposedEtaHours: number,
): Promise<{ application: TaskApplicationView; dispatch: DispatchDecisionView | null }> {
  const applicationId = crypto.randomUUID();
  const reputationFeature = await getSingleFeatureModule("reputation");
  const agentRegistryFeature = await getSingleFeatureModule("agentRegistry");
  const agentExecutionFeature = await getSingleFeatureModule("agentExecution");
  const preferReputationRanking = Boolean(reputationFeature?.enabled);
  const allowAgentProposals = Boolean(agentRegistryFeature?.enabled && agentExecutionFeature?.enabled);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) throw new Error("Task not found");
    if (task.creatorUserId === userId) throw new Error("Task creator cannot apply to their own task");
    if (!["open", "applying"].includes(task.status)) throw new Error("Task is not accepting applications");

    if (task.requiredBondAmount > 0) {
      await freezeBalance(
        userId,
        "obsidian",
        task.requiredBondAmount,
        `任务保证金：${task.title}`,
        "taskApplication",
        applicationId,
        tx,
      );
    }

    const [created] = await tx
      .insert(taskApplications)
      .values({
        id: applicationId,
        taskId,
        applicantUserId: userId,
        statement,
        proposedEtaHours,
        status: "pending",
        createdAt: now(),
      })
      .returning();

    if (task.requiredBondAmount > 0) {
      await tx.insert(bondHolds).values({
        id: crypto.randomUUID(),
        taskId,
        applicationId,
        userId,
        currency: "obsidian",
        amount: task.requiredBondAmount,
        status: "active",
        createdAt: now(),
        releasedAt: null,
      });
    }

    if (task.status === "open") {
      await tx.update(tasks).set({ status: "applying" }).where(eq(tasks.id, taskId));
    }

    await enqueueOutboxEvent(
      "task.applied",
      {
        taskId,
        applicationId,
        applicantUserId: userId,
      },
      tx,
    );

    const pendingApplications = await tx
      .select({ count: count(taskApplications.id) })
      .from(taskApplications)
      .where(and(eq(taskApplications.taskId, taskId), eq(taskApplications.status, "pending")));
    const pendingProposals = allowAgentProposals
      ? await tx
          .select({ count: count(taskAgentProposals.id) })
          .from(taskAgentProposals)
          .where(and(eq(taskAgentProposals.taskId, taskId), eq(taskAgentProposals.status, "pending")))
      : [{ count: 0 }];

    const totalPendingCandidates =
      Number(pendingApplications[0]?.count ?? 0) + Number(pendingProposals[0]?.count ?? 0);

    const dispatch = totalPendingCandidates >= 2
      ? await dispatchTaskInTx(tx, taskId, preferReputationRanking, allowAgentProposals)
      : null;

    return {
      application: toTaskApplicationView(created),
      dispatch,
    };
  });
}
