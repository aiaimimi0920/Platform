// Task lifecycle transitions (start/submit/accept/default/cancel) and
// operator settlement override. Moved verbatim from service.ts.

import type {
  ProductCurrency,
  TaskLifecycleAction,
  TaskView,
} from "@neuro/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  transferBalance,
  unfreezeBalance,
} from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";
import {
  refreshReputationUsersInTx,
} from "../../../../../packages/account-domain/dist/modules/reputation/service.js";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { buildTaskLifecycleReputationUpdatedPayload } from "@/modules/reputation/events";
import {
  bondHolds,
  taskApplications,
  taskDispatchDecisions,
  taskRewardHolds,
  tasks,
} from "@/modules/task-hub/schema";
import { ConflictError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  ensureTaskRewardEscrowHoldInTx,
  releaseAllActiveTaskBonds,
} from "./escrow";
import {
  TASK_REWARD_ESCROW_USER_ID,
  getTaskWithCountInTx,
  now,
  toTaskView,
} from "./shared";

async function advanceTaskLifecycleInTx(
  tx: NodePgDatabase<typeof schema>,
  actorUserId: string,
  taskId: string,
  action: TaskLifecycleAction,
  options?: {
    allowSettlementOverride?: boolean;
  },
): Promise<TaskView> {
  await tx.execute(sql`select id from tasks where id = ${taskId} for update`);
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error("Task not found");

  const allowSettlementOverride = options?.allowSettlementOverride === true;

  if (action === "start") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (actorUserId !== task.assignedUserId) throw new Error("Only assigned user can start task");
    if (task.status !== "assigned") throw new Error("Task is not in assigned status");
    await tx.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.started", { taskId, actorUserId }, tx);
  }

  if (action === "submit") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (actorUserId !== task.assignedUserId) throw new Error("Only assigned user can submit task");
    if (task.status !== "in_progress") throw new Error("Task is not in progress");
    await tx.update(tasks).set({ status: "submitted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.submitted", { taskId, actorUserId }, tx);
  }

  if (action === "accept") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can accept submission");
    }
    if (allowSettlementOverride && task.status === "accepted") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (task.status !== "submitted") throw new Error("Task is not submitted");

    const [decision] = await tx
      .select()
      .from(taskDispatchDecisions)
      .where(eq(taskDispatchDecisions.taskId, taskId));

    const winningBondHold = decision?.assignedApplicationId
      ? await tx
          .select()
          .from(bondHolds)
          .where(
            and(
              eq(bondHolds.taskId, taskId),
              eq(bondHolds.applicationId, decision.assignedApplicationId),
              eq(bondHolds.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null)
      : null;
    if (winningBondHold && winningBondHold.amount > 0) {
      await unfreezeBalance(
        winningBondHold.userId,
        winningBondHold.currency as "obsidian",
        winningBondHold.amount,
        `任务验收通过，退回保证金：${task.title}`,
        "bondHold",
        winningBondHold.id,
        tx,
      );
      await tx
        .update(bondHolds)
        .set({ status: "released", releasedAt: now() })
        .where(eq(bondHolds.id, winningBondHold.id));
    }

    const [rewardHold] = await tx
      .select()
      .from(taskRewardHolds)
      .where(eq(taskRewardHolds.taskId, taskId));
    if (!rewardHold) {
      const reconciledHold = await ensureTaskRewardEscrowHoldInTx({
        tx,
        task,
        assignedUserId: task.assignedUserId,
        allowChargeIfMissing: true,
      });
      if (!reconciledHold) {
        throw new ConflictError("Task reward escrow is missing");
      }
    }

    const activeRewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: true,
    });
    if (!activeRewardHold) {
      throw new ConflictError("Task reward escrow is missing");
    }
    if (activeRewardHold.status !== "escrowed") {
      throw new ConflictError(`Task reward escrow is not payable in status ${activeRewardHold.status}`);
    }
    if (!activeRewardHold.assigneeUserId) {
      throw new ConflictError("Task reward escrow is missing assigned user");
    }

    if (activeRewardHold.rewardAmount > 0) {
      await transferBalance({
        fromUserId: TASK_REWARD_ESCROW_USER_ID,
        toUserId: activeRewardHold.assigneeUserId,
        currency: activeRewardHold.rewardCurrency as ProductCurrency,
        amount: activeRewardHold.rewardAmount,
        note: `任务托管奖励结算：${task.title}`,
        referenceType: "task",
        referenceId: task.id,
        tx,
      });
    }

    await tx
      .update(taskRewardHolds)
      .set({ status: "paid", settledAt: now() })
      .where(eq(taskRewardHolds.id, activeRewardHold.id));

    await tx.update(tasks).set({ status: "accepted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.accepted", { taskId, actorUserId }, tx);
  }

  if (action === "default") {
    if (!task.assignedUserId) throw new Error("Task has no assignee");
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can default task");
    }
    if (allowSettlementOverride && task.status === "defaulted") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (!["assigned", "in_progress", "submitted"].includes(task.status)) {
      throw new Error("Task status does not support default");
    }

    const [decision] = await tx
      .select()
      .from(taskDispatchDecisions)
      .where(eq(taskDispatchDecisions.taskId, taskId));

    const winningBondHold = decision?.assignedApplicationId
      ? await tx
          .select()
          .from(bondHolds)
          .where(
            and(
              eq(bondHolds.taskId, taskId),
              eq(bondHolds.applicationId, decision.assignedApplicationId),
              eq(bondHolds.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null)
      : null;
    if (winningBondHold && winningBondHold.amount > 0) {
      await unfreezeBalance(
        winningBondHold.userId,
        winningBondHold.currency as "obsidian",
        winningBondHold.amount,
        `任务违约，执行保证金扣罚：${task.title}`,
        "bondHold",
        winningBondHold.id,
        tx,
      );
      await transferBalance({
        fromUserId: winningBondHold.userId,
        toUserId: task.creatorUserId,
        currency: winningBondHold.currency as ProductCurrency,
        amount: winningBondHold.amount,
        note: `任务违约赔付：${task.title}`,
        referenceType: "task",
        referenceId: task.id,
        tx,
      });
      await tx
        .update(bondHolds)
        .set({ status: "forfeited", releasedAt: now() })
        .where(eq(bondHolds.id, winningBondHold.id));
    }

    const rewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: false,
    });
    if (task.rewardAmount > 0 && !rewardHold) {
      throw new ConflictError("Task reward escrow is missing for refund");
    }
    if (rewardHold) {
      if (rewardHold.status !== "escrowed") {
        throw new ConflictError(`Task reward escrow is not refundable in status ${rewardHold.status}`);
      }

      if (rewardHold.rewardAmount > 0) {
        await transferBalance({
          fromUserId: TASK_REWARD_ESCROW_USER_ID,
          toUserId: rewardHold.creatorUserId,
          currency: rewardHold.rewardCurrency as ProductCurrency,
          amount: rewardHold.rewardAmount,
          note: `任务托管奖励退回：${task.title}`,
          referenceType: "task",
          referenceId: task.id,
          tx,
        });
      }
      await tx
        .update(taskRewardHolds)
        .set({ status: "refunded", settledAt: now() })
        .where(eq(taskRewardHolds.id, rewardHold.id));
    }

    await tx.update(tasks).set({ status: "defaulted" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.defaulted", { taskId, actorUserId }, tx);
  }

  if (action === "cancel") {
    if (!allowSettlementOverride && actorUserId !== task.creatorUserId) {
      throw new Error("Only task creator can cancel task");
    }
    if (allowSettlementOverride && task.status === "cancelled") {
      const current = await getTaskWithCountInTx(tx, taskId);
      if (!current) throw new Error("Task not found after lifecycle update");
      return toTaskView(current.task, current.applicationCount, current.arbitrationCaseCount);
    }
    if (!["open", "applying", "assigned"].includes(task.status)) {
      throw new Error("Task status does not support cancel");
    }

    const cancelledAt = now();

    await releaseAllActiveTaskBonds({
      tx,
      taskId,
      taskTitle: task.title,
      releasedAt: cancelledAt,
      releaseReason: `任务取消，退回保证金：${task.title}`,
    });

    await tx
      .update(taskApplications)
      .set({ status: "rejected" })
      .where(and(eq(taskApplications.taskId, taskId), sql`${taskApplications.status} <> 'rejected'`));

    const rewardHold = await ensureTaskRewardEscrowHoldInTx({
      tx,
      task,
      assignedUserId: task.assignedUserId,
      allowChargeIfMissing: false,
    });

    if (task.rewardAmount > 0 && !rewardHold) {
      throw new ConflictError("Task reward escrow is missing for cancel");
    }

    if (rewardHold) {
      if (rewardHold.status !== "escrowed") {
        throw new ConflictError(`Task reward escrow is not cancellable in status ${rewardHold.status}`);
      }

      if (rewardHold.rewardAmount > 0) {
        await transferBalance({
          fromUserId: TASK_REWARD_ESCROW_USER_ID,
          toUserId: rewardHold.creatorUserId,
          currency: rewardHold.rewardCurrency as ProductCurrency,
          amount: rewardHold.rewardAmount,
          note: `任务取消，退回托管奖励：${task.title}`,
          referenceType: "task",
          referenceId: task.id,
          tx,
        });
      }

      await tx
        .update(taskRewardHolds)
        .set({ status: "refunded", settledAt: cancelledAt })
        .where(eq(taskRewardHolds.id, rewardHold.id));
    }

    await tx.update(tasks).set({ status: "cancelled" }).where(eq(tasks.id, taskId));
    await enqueueOutboxEvent("task.cancelled", { taskId, actorUserId }, tx);
  }

  if ((action === "accept" || action === "default" || action === "cancel") && task.assignedUserId) {
    await refreshReputationUsersInTx(tx, [task.creatorUserId, task.assignedUserId]);
    await enqueueOutboxEvent(
      "reputation.updated",
      buildTaskLifecycleReputationUpdatedPayload({
        action,
        taskId,
        actorUserId,
        creatorUserId: task.creatorUserId,
        assignedUserId: task.assignedUserId,
      }),
      tx,
    );
  }

  const taskWithCount = await getTaskWithCountInTx(tx, taskId);
  if (!taskWithCount) throw new Error("Task not found after lifecycle update");
  return toTaskView(taskWithCount.task, taskWithCount.applicationCount, taskWithCount.arbitrationCaseCount);
}

export async function settleTaskLifecycleByOperatorInTx(
  tx: NodePgDatabase<typeof schema>,
  operatorUserId: string,
  taskId: string,
  action: Extract<TaskLifecycleAction, "accept" | "default" | "cancel">,
) {
  return advanceTaskLifecycleInTx(tx, operatorUserId, taskId, action, {
    allowSettlementOverride: true,
  });
}

export async function advanceTaskLifecycle(
  actorUserId: string,
  taskId: string,
  action: TaskLifecycleAction,
): Promise<TaskView> {
  return db.transaction((tx) => advanceTaskLifecycleInTx(tx, actorUserId, taskId, action));
}
