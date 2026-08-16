// Task draft and published-task creation (including reward escrow).
// Moved verbatim from service.ts.

import type {
  CreateTaskDraftInput,
  CreateTaskDraftResult,
  CreateTaskInput,
  TaskView,
} from "@neuro/contracts";
import { and, eq } from "drizzle-orm";
import {
  transferBalance,
} from "../../../../../packages/account-domain/dist/modules/wallet-ledger/service.js";

import { db } from "@/db/client";
import {
  buildTaskDraftRecord,
  normalizeTaskDraftInput,
  taskDraftPayloadMatches,
} from "@/modules/task-hub/draft";
import {
  taskRewardHolds,
  tasks,
} from "@/modules/task-hub/schema";
import { BadRequestError, ConflictError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import { runAutomaticMarketplaceMatching } from "./marketplace-matching";
import {
  TASK_REWARD_ESCROW_USER_ID,
  normalizeCapabilityCodes,
  normalizeTaskBillingUnit,
  normalizeTaskMeterKey,
  normalizeTaskMeterQuantity,
  normalizeTaskOperationMode,
  normalizeTaskPricingMode,
  now,
  toTaskView,
} from "./shared";
import { getTaskSummary } from "./views";

export async function createTaskDraft(
  userId: string,
  input: CreateTaskDraftInput,
): Promise<CreateTaskDraftResult> {
  const ownerUserId = userId.trim();
  if (!ownerUserId) throw new BadRequestError("Task draft owner is required");
  let normalized;
  try {
    normalized = normalizeTaskDraftInput(input);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid task draft");
  }

  return db.transaction(async (tx) => {
    const findExisting = async () => {
      const [existing] = await tx
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.creatorUserId, ownerUserId),
            eq(tasks.idempotencyKey, normalized.idempotencyKey),
          ),
        )
        .limit(1);
      return existing ?? null;
    };
    const existing = await findExisting();
    if (existing) {
      if (!taskDraftPayloadMatches(existing, normalized)) {
        throw new ConflictError("Task draft idempotency key is already used for another payload");
      }
      return { task: toTaskView(existing, 0), created: false };
    }

    const record = buildTaskDraftRecord({
      id: crypto.randomUUID(),
      ownerUserId,
      input: normalized,
      createdAt: now(),
    });
    const [inserted] = await tx
      .insert(tasks)
      .values(record)
      .onConflictDoNothing({ target: [tasks.creatorUserId, tasks.idempotencyKey] })
      .returning();
    if (inserted) {
      return { task: toTaskView(inserted, 0), created: true };
    }

    const raced = await findExisting();
    if (!raced) throw new ConflictError("Task draft could not be recovered after an idempotency conflict");
    if (!taskDraftPayloadMatches(raced, normalized)) {
      throw new ConflictError("Task draft idempotency key is already used for another payload");
    }
    return { task: toTaskView(raced, 0), created: false };
  });
}

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskView> {
  const pricingMode = normalizeTaskPricingMode(input.pricingMode);
  const operationMode = normalizeTaskOperationMode(input.operationMode);
  const billingUnit = normalizeTaskBillingUnit(pricingMode, input.billingUnit);
  const meterKey = normalizeTaskMeterKey(pricingMode, input.meterKey);
  const meterQuantity = normalizeTaskMeterQuantity(pricingMode, input.meterQuantity);

  const createdTask = await db.transaction(async (tx) => {
    const createdAt = now();
    const taskId = crypto.randomUUID();

    await transferBalance({
      fromUserId: userId,
      toUserId: TASK_REWARD_ESCROW_USER_ID,
      currency: input.rewardCurrency,
      amount: input.rewardAmount,
      note: `任务奖励托管：${input.title}`,
      referenceType: "taskRewardEscrow",
      referenceId: taskId,
      tx,
    });

      const [task] = await tx
        .insert(tasks)
        .values({
          id: taskId,
          creatorUserId: userId,
          assignedUserId: null,
          title: input.title,
          description: input.description,
          preferredCapabilityCodes: normalizeCapabilityCodes(input.preferredCapabilityCodes),
          pricingMode,
          billingUnit,
          meterKey,
          meterQuantity,
          operationMode,
          rewardCurrency: input.rewardCurrency,
          rewardAmount: input.rewardAmount,
          requiredBondAmount: input.requiredBondAmount,
          status: "open",
        createdAt,
      })
      .returning();

    await tx.insert(taskRewardHolds).values({
      id: crypto.randomUUID(),
      taskId,
      creatorUserId: userId,
      assigneeUserId: null,
      rewardCurrency: input.rewardCurrency,
      rewardAmount: input.rewardAmount,
      status: "escrowed",
      createdAt,
      settledAt: null,
    });

    await enqueueOutboxEvent("task.created", { taskId: task.id, creatorUserId: userId }, tx);
    return toTaskView(task, 0);
  });

  if (operationMode === "automatic") {
    await runAutomaticMarketplaceMatching(createdTask.id);
  }

  return (await getTaskSummary(createdTask.id)) ?? createdTask;
}
