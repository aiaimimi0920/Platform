import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { developmentQueueItems } from "@/modules/development-queue/schema";
import { opinionTopics } from "@/modules/opinion-hub/schema";

type DbTx = NodePgDatabase<typeof schema>;

export async function getDevelopmentQueueItemByIdInTx(tx: DbTx, itemId: string) {
  const [item] = await tx.select().from(developmentQueueItems).where(eq(developmentQueueItems.id, itemId));
  return item ?? null;
}

export async function getDevelopmentQueueItemBySourceInTx(
  tx: DbTx,
  sourceType: typeof developmentQueueItems.$inferSelect.sourceType,
  sourceId: string,
) {
  const [item] = await tx
    .select()
    .from(developmentQueueItems)
    .where(and(eq(developmentQueueItems.sourceType, sourceType), eq(developmentQueueItems.sourceId, sourceId)));
  return item ?? null;
}

export async function listDevelopmentQueueItemsInTx(tx: DbTx) {
  return tx.select().from(developmentQueueItems).orderBy(asc(developmentQueueItems.queuedAt));
}

export async function listAdoptedOpinionTopicsMissingQueueInTx(tx: DbTx) {
  return tx
    .select({
      id: opinionTopics.id,
      creatorUserId: opinionTopics.creatorUserId,
      title: opinionTopics.title,
      description: opinionTopics.description,
      difficultyLevel: opinionTopics.difficultyLevel,
      supportTicketTotal: opinionTopics.supportTicketTotal,
      opposeTicketTotal: opinionTopics.opposeTicketTotal,
      uniqueSupporterCount: opinionTopics.uniqueSupporterCount,
      uniqueOpposerCount: opinionTopics.uniqueOpposerCount,
      adoptedAt: opinionTopics.adoptedAt,
    })
    .from(opinionTopics)
    .leftJoin(
      developmentQueueItems,
      and(eq(developmentQueueItems.sourceType, "opinionTopic"), eq(developmentQueueItems.sourceId, opinionTopics.id)),
    )
    .where(and(isNotNull(opinionTopics.adoptedAt), isNull(developmentQueueItems.id)));
}
