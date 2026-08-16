// Task reward escrow hold reconciliation and bond freeze/release helpers.
// Moved verbatim from service.ts.

import type { ProductCurrency } from "@neuro/contracts";
import { and, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  transferBalance,
  unfreezeBalance,
} from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import * as schema from "@/db/schema";
import {
  bondHolds,
  taskApplications,
  taskRewardHolds,
  tasks,
} from "@/modules/task-hub/schema";
import { ledgerEntries } from "@/modules/wallet-ledger/schema";

import {
  TASK_REWARD_ESCROW_USER_ID,
  now,
} from "./shared";

async function findEscrowTransferInTx(tx: NodePgDatabase<typeof schema>, task: typeof tasks.$inferSelect) {
  const [entry] = await tx
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, TASK_REWARD_ESCROW_USER_ID),
        eq(ledgerEntries.referenceType, "taskRewardEscrow"),
        eq(ledgerEntries.referenceId, task.id),
        eq(ledgerEntries.entryType, "grant"),
        eq(ledgerEntries.currency, task.rewardCurrency),
        eq(ledgerEntries.amount, task.rewardAmount),
      ),
    );

  return entry ?? null;
}

export async function ensureTaskRewardEscrowHoldInTx(args: {
  tx: NodePgDatabase<typeof schema>;
  task: typeof tasks.$inferSelect;
  assignedUserId: string | null;
  allowChargeIfMissing: boolean;
  timestamp?: Date;
}) {
  const [existingHold] = await args.tx
    .select()
    .from(taskRewardHolds)
    .where(eq(taskRewardHolds.taskId, args.task.id));

  if (existingHold) {
    if (args.assignedUserId && existingHold.assigneeUserId !== args.assignedUserId) {
      const [updatedHold] = await args.tx
        .update(taskRewardHolds)
        .set({ assigneeUserId: args.assignedUserId })
        .where(eq(taskRewardHolds.id, existingHold.id))
        .returning();
      return updatedHold;
    }

    return existingHold;
  }

  let escrowTransfer = await findEscrowTransferInTx(args.tx, args.task);
  if (!escrowTransfer && args.allowChargeIfMissing && args.task.rewardAmount > 0) {
    await transferBalance({
      fromUserId: args.task.creatorUserId,
      toUserId: TASK_REWARD_ESCROW_USER_ID,
      currency: args.task.rewardCurrency as ProductCurrency,
      amount: args.task.rewardAmount,
      note: `任务奖励托管补建：${args.task.title}`,
      referenceType: "taskRewardEscrow",
      referenceId: args.task.id,
      tx: args.tx,
    });
    escrowTransfer = await findEscrowTransferInTx(args.tx, args.task);
  }

  if (!escrowTransfer) {
    return null;
  }

  const [createdHold] = await args.tx
    .insert(taskRewardHolds)
    .values({
      id: crypto.randomUUID(),
      taskId: args.task.id,
      creatorUserId: args.task.creatorUserId,
      assigneeUserId: args.assignedUserId,
      rewardCurrency: args.task.rewardCurrency,
      rewardAmount: args.task.rewardAmount,
      status: "escrowed",
      createdAt: args.timestamp ?? now(),
      settledAt: null,
    })
    .returning();

  return createdHold;
}

export async function releaseRejectedBonds(
  tx: NodePgDatabase<typeof schema>,
  taskTitle: string,
  rejectedApplicationIds: string[],
  releasedAt: Date,
) {
  if (rejectedApplicationIds.length === 0) return;

  await tx
    .update(taskApplications)
    .set({ status: "rejected" })
    .where(inArray(taskApplications.id, rejectedApplicationIds));

  const rejectedBondRows = await tx
    .select()
    .from(bondHolds)
    .where(inArray(bondHolds.applicationId, rejectedApplicationIds));

  for (const hold of rejectedBondRows) {
    if (hold.status === "active" && hold.amount > 0) {
      await unfreezeBalance(
        hold.userId,
        hold.currency as "obsidian",
        hold.amount,
        `任务未中标退回保证金：${taskTitle}`,
        "bondHold",
        hold.id,
        tx,
      );
      await tx
        .update(bondHolds)
        .set({ status: "released", releasedAt })
        .where(eq(bondHolds.id, hold.id));
    }
  }
}

export async function releaseAllActiveTaskBonds(args: {
  tx: NodePgDatabase<typeof schema>;
  taskId: string;
  taskTitle: string;
  releasedAt: Date;
  releaseReason: string;
}) {
  const activeHolds = await args.tx
    .select()
    .from(bondHolds)
    .where(and(eq(bondHolds.taskId, args.taskId), eq(bondHolds.status, "active")));

  for (const hold of activeHolds) {
    if (hold.amount > 0) {
      await unfreezeBalance(
        hold.userId,
        hold.currency as "obsidian",
        hold.amount,
        args.releaseReason,
        "bondHold",
        hold.id,
        args.tx,
      );
    }

    await args.tx
      .update(bondHolds)
      .set({ status: "released", releasedAt: args.releasedAt })
      .where(eq(bondHolds.id, hold.id));
  }
}
