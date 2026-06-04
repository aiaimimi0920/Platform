import { eventNames, type EventName } from "@neuro/contracts";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/db/schema";
import { db } from "@/db/client";
import { outboxEvents } from "@/platform/outbox/schema";

function now() {
  return new Date();
}

export type OutboxConsumerService = "account" | "platform";

const accountConsumerEvents = new Set<EventName>(eventNames);

function resolveConsumerService(
  eventName: EventName,
  consumerService?: OutboxConsumerService,
): OutboxConsumerService {
  if (consumerService) return consumerService;
  return accountConsumerEvents.has(eventName) ? "account" : "platform";
}

export async function enqueueOutboxEvent(
  eventName: EventName,
  payload: Record<string, unknown>,
  tx: NodePgDatabase<typeof schema> = db,
  consumerService?: OutboxConsumerService,
): Promise<void> {
  const createdAt = now();
  await tx.insert(outboxEvents).values({
    id: crypto.randomUUID(),
    eventName,
    payload,
    consumerService: resolveConsumerService(eventName, consumerService),
    status: "pending",
    attempts: 0,
    availableAt: createdAt,
    processedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}
