import type {
  DevelopmentQueueItemView,
  DevelopmentQueueSourceType,
  DevelopmentQueueStatus,
  UpdateDevelopmentQueueStatusInput,
} from "@neuro/contracts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { getDevelopmentQueueStatusEventName } from "@/modules/development-queue/events";
import {
  listAdoptedOpinionTopicsMissingQueueInTx,
  getDevelopmentQueueItemByIdInTx,
  getDevelopmentQueueItemBySourceInTx,
  listDevelopmentQueueItemsInTx,
} from "@/modules/development-queue/repository";
import { developmentQueueItems } from "@/modules/development-queue/schema";
import {
  canTransitionDevelopmentQueueStatus,
  developmentQueueStatusOrder,
  toDevelopmentQueueItemView,
  type DevelopmentQueueSourceSnapshot,
} from "@/modules/development-queue/types";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

type DbTx = NodePgDatabase<typeof schema>;

function now() {
  return new Date();
}

function calculateSupportRate(supportTicketTotal: number, opposeTicketTotal: number) {
  const totalTickets = supportTicketTotal + opposeTicketTotal;
  if (totalTickets <= 0) return 0;
  return supportTicketTotal / totalTickets;
}

function calculateDevelopmentQueuePriority(args: {
  supportTicketTotal: number;
  opposeTicketTotal: number;
  uniqueSupporterCount: number;
  uniqueOpposerCount: number;
}) {
  const supportRate = calculateSupportRate(args.supportTicketTotal, args.opposeTicketTotal);
  return (
    1_000_000 +
    Math.round(supportRate * 10_000) +
    args.uniqueSupporterCount * 50 +
    args.uniqueOpposerCount * 20 +
    args.supportTicketTotal * 10
  );
}

function isDevelopmentQueueOperator(userId: string) {
  return env.platformOperatorUserIds.includes(userId);
}

async function backfillAdoptedOpinionTopicsInTx(tx: DbTx) {
  const missingTopics = await listAdoptedOpinionTopicsMissingQueueInTx(tx);
  for (const topic of missingTopics) {
    await queueSourceForDevelopmentInTx(
      tx,
      buildOpinionTopicQueueSnapshot({
        topicId: topic.id,
        ownerUserId: topic.creatorUserId,
        title: topic.title,
        description: topic.description,
        difficultyLevel: topic.difficultyLevel,
        supportTicketTotal: topic.supportTicketTotal,
        opposeTicketTotal: topic.opposeTicketTotal,
        supportRate: calculateSupportRate(topic.supportTicketTotal, topic.opposeTicketTotal),
        priorityScore: calculateDevelopmentQueuePriority({
          supportTicketTotal: topic.supportTicketTotal,
          opposeTicketTotal: topic.opposeTicketTotal,
          uniqueSupporterCount: topic.uniqueSupporterCount,
          uniqueOpposerCount: topic.uniqueOpposerCount,
        }),
        adoptedAt: topic.adoptedAt,
      }),
    );
  }
}

export async function queueSourceForDevelopmentInTx(
  tx: DbTx,
  source: DevelopmentQueueSourceSnapshot,
): Promise<DevelopmentQueueItemView> {
  const existing = await getDevelopmentQueueItemBySourceInTx(tx, source.sourceType, source.sourceId);
  if (existing) {
    return toDevelopmentQueueItemView(existing, false);
  }

  const queuedAt = source.queuedAt ?? now();
  const [created] = await tx
    .insert(developmentQueueItems)
    .values({
      id: crypto.randomUUID(),
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      ownerUserId: source.ownerUserId,
      title: source.title,
      description: source.description,
      difficultyLevel: source.difficultyLevel,
      supportTicketTotal: source.supportTicketTotal,
      opposeTicketTotal: source.opposeTicketTotal,
      supportRate: source.supportRate.toFixed(4),
      priorityScore: source.priorityScore,
      status: "queued",
      queuedAt,
      startedAt: null,
      deliveredAt: null,
      archivedAt: null,
      updatedAt: queuedAt,
    })
    .returning();

  await enqueueOutboxEvent(
    "developmentQueue.queued",
    {
      queueItemId: created.id,
      sourceType: created.sourceType,
      sourceId: created.sourceId,
      ownerUserId: created.ownerUserId,
    },
    tx,
  );

  return toDevelopmentQueueItemView(created, false);
}

export async function listDevelopmentQueue(viewerUserId: string): Promise<DevelopmentQueueItemView[]> {
  return db.transaction(async (tx) => {
    await backfillAdoptedOpinionTopicsInTx(tx);
    const items = await listDevelopmentQueueItemsInTx(tx);
    const canManageStatus = isDevelopmentQueueOperator(viewerUserId);
    return items
      .map((item) => toDevelopmentQueueItemView(item, canManageStatus))
      .sort((left, right) => {
        if (developmentQueueStatusOrder[left.status] !== developmentQueueStatusOrder[right.status]) {
          return developmentQueueStatusOrder[left.status] - developmentQueueStatusOrder[right.status];
        }
        if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  });
}

export async function updateDevelopmentQueueStatus(
  actorUserId: string,
  itemId: string,
  input: UpdateDevelopmentQueueStatusInput,
): Promise<DevelopmentQueueItemView> {
  return db.transaction(async (tx) => {
    const item = await getDevelopmentQueueItemByIdInTx(tx, itemId);
    if (!item) {
      throw new NotFoundError("Development queue item not found");
    }
    if (!isDevelopmentQueueOperator(actorUserId)) {
      throw new UnauthorizedError("Only platform operators can update development queue status");
    }

    const currentStatus = item.status as DevelopmentQueueStatus;
    if (currentStatus === input.status) {
      return toDevelopmentQueueItemView(item, true);
    }
    if (!canTransitionDevelopmentQueueStatus(currentStatus, input.status)) {
      throw new ConflictError(`Cannot move development queue item from ${currentStatus} to ${input.status}`);
    }

    const updatedAt = now();
    const [updated] = await tx
      .update(developmentQueueItems)
      .set({
        status: input.status,
        startedAt: input.status === "in_progress" ? item.startedAt ?? updatedAt : item.startedAt,
        deliveredAt: input.status === "completed" ? item.deliveredAt ?? updatedAt : item.deliveredAt,
        archivedAt: input.status === "archived" ? item.archivedAt ?? updatedAt : item.archivedAt,
        updatedAt,
      })
      .where(eq(developmentQueueItems.id, item.id))
      .returning();

    await enqueueOutboxEvent(
      getDevelopmentQueueStatusEventName(input.status),
      {
        queueItemId: updated.id,
        sourceType: updated.sourceType,
        sourceId: updated.sourceId,
        ownerUserId: updated.ownerUserId,
        status: updated.status,
      },
      tx,
    );

    return toDevelopmentQueueItemView(updated, true);
  });
}

export function buildOpinionTopicQueueSnapshot(input: {
  topicId: string;
  ownerUserId: string;
  title: string;
  description: string;
  difficultyLevel: number | null;
  supportTicketTotal: number;
  opposeTicketTotal: number;
  supportRate: number;
  priorityScore: number;
  adoptedAt: Date | null;
}): DevelopmentQueueSourceSnapshot {
  return {
    sourceType: "opinionTopic" satisfies DevelopmentQueueSourceType,
    sourceId: input.topicId,
    ownerUserId: input.ownerUserId,
    title: input.title,
    description: input.description,
    difficultyLevel: input.difficultyLevel as DevelopmentQueueSourceSnapshot["difficultyLevel"],
    supportTicketTotal: input.supportTicketTotal,
    opposeTicketTotal: input.opposeTicketTotal,
    supportRate: input.supportRate,
    priorityScore: input.priorityScore,
    queuedAt: input.adoptedAt ?? now(),
  };
}
