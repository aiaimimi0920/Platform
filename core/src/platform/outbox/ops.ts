import type {
  EventName,
  OutboxAlertDispatchResult,
  OutboxEventStatus,
  OutboxRetryBatchResult,
  OutboxEventView,
  OutboxRetryAttemptView,
  OutboxSummaryView,
} from "@neuro/contracts";
import { and, asc, count, desc, eq, gte, inArray, min, max, sql, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { env } from "@/env";
import { ConflictError, UnauthorizedError, NotFoundError } from "@/platform/errors";
import { buildOutboxAlerts, buildOutboxRecommendations } from "@/platform/outbox/ops-analysis";
import { outboxEvents, outboxRetryAttempts } from "@/platform/outbox/schema";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

const outboxAlertEventName = "outbox.alerted" as const;
const OUTBOX_ALERT_COOLDOWN_MINUTES = 60;

function now() {
  return new Date();
}

function computeAgeMinutes(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Math.max(0, Math.floor((now().getTime() - date.getTime()) / (60 * 1000)));
}

export function assertPlatformOperator(userId: string, providerUserId?: string | null) {
  if (
    env.platformOperatorUserIds.includes(userId) ||
    (providerUserId && env.platformOperatorUserIds.includes(providerUserId))
  ) {
    return;
  }
  throw new UnauthorizedError("Only platform operators can access this endpoint");
}

function toOutboxEventView(row: typeof outboxEvents.$inferSelect): OutboxEventView {
  return {
    id: row.id,
    eventName: row.eventName as EventName,
    status: row.status as OutboxEventStatus,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    availableAt: row.availableAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOutboxRetryAttemptView(row: typeof outboxRetryAttempts.$inferSelect): OutboxRetryAttemptView {
  return {
    id: row.id,
    eventId: row.eventId,
    eventName: row.eventName as EventName,
    actorUserId: row.actorUserId,
    previousStatus: row.previousStatus as OutboxEventStatus,
    previousAttempts: row.previousAttempts,
    lastError: row.lastError,
    retriedAt: row.retriedAt.toISOString(),
  };
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).toISOString();
  }
  return null;
}

export async function listOutboxEvents(args?: {
  status?: OutboxEventStatus;
  eventName?: string;
  limit?: number;
}): Promise<OutboxEventView[]> {
  const boundedLimit = Math.max(1, Math.min(args?.limit ?? 50, 200));
  const conditions: SQL[] = [];
  if (args?.status) conditions.push(eq(outboxEvents.status, args.status));
  if (args?.eventName) conditions.push(eq(outboxEvents.eventName, args.eventName as EventName));

  let query = db.select().from(outboxEvents).$dynamic();
  if (conditions.length > 0) {
    query = query.where(conditions.length === 1 ? conditions[0]! : and(...conditions));
  }

  const rows = await query
    .orderBy(desc(outboxEvents.updatedAt), asc(outboxEvents.createdAt))
    .limit(boundedLimit);

  return rows.map(toOutboxEventView);
}

export async function getOutboxSummary(): Promise<OutboxSummaryView> {
  const processingLeaseTimeoutMinutes = Math.max(1, Math.floor(env.outboxProcessingLeaseTimeoutMs / (60 * 1000)));
  const staleProcessingThreshold = sql`now() - (${env.outboxProcessingLeaseTimeoutMs}::int * interval '1 millisecond')`;
  const [row] = await db
    .select({
      pendingCount: count(sql`case when ${outboxEvents.status} = 'pending' then 1 end`),
      processingCount: count(sql`case when ${outboxEvents.status} = 'processing' then 1 end`),
      processedCount: count(sql`case when ${outboxEvents.status} = 'processed' then 1 end`),
      deadLetterCount: count(sql`case when ${outboxEvents.status} = 'dead_letter' then 1 end`),
      oldestPendingAt: min(sql`case when ${outboxEvents.status} = 'pending' then ${outboxEvents.createdAt} end`),
      oldestProcessingAt: min(sql`case when ${outboxEvents.status} = 'processing' then ${outboxEvents.updatedAt} end`),
      staleProcessingCount: count(
        sql`case when ${outboxEvents.status} = 'processing' and ${outboxEvents.updatedAt} <= ${staleProcessingThreshold} then 1 end`,
      ),
      oldestStaleProcessingAt: min(
        sql`case when ${outboxEvents.status} = 'processing' and ${outboxEvents.updatedAt} <= ${staleProcessingThreshold} then ${outboxEvents.updatedAt} end`,
      ),
      lastDeadLetterAt: max(sql`case when ${outboxEvents.status} = 'dead_letter' then ${outboxEvents.updatedAt} end`),
    })
    .from(outboxEvents);

  const deadLetterBuckets = await db
    .select({
      key: outboxEvents.eventName,
      count: sql<number>`count(*)::int`,
    })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, "dead_letter"))
    .groupBy(outboxEvents.eventName)
    .orderBy(sql`count(*) desc`, outboxEvents.eventName)
    .limit(5);

  const pendingCount = Number(row?.pendingCount ?? 0);
  const processingCount = Number(row?.processingCount ?? 0);
  const processedCount = Number(row?.processedCount ?? 0);
  const deadLetterCount = Number(row?.deadLetterCount ?? 0);
  const oldestPendingAt = toIsoDate(row?.oldestPendingAt);
  const oldestPendingAgeHours = (() => {
    const ageMinutes = computeAgeMinutes(row?.oldestPendingAt);
    return ageMinutes === null ? null : Math.floor(ageMinutes / 60);
  })();
  const oldestProcessingAt = toIsoDate(row?.oldestProcessingAt);
  const oldestProcessingAgeMinutes = computeAgeMinutes(row?.oldestProcessingAt);
  const staleProcessingCount = Number(row?.staleProcessingCount ?? 0);
  const oldestStaleProcessingAt = toIsoDate(row?.oldestStaleProcessingAt);
  const oldestStaleProcessingAgeMinutes = computeAgeMinutes(row?.oldestStaleProcessingAt);
  const lastDeadLetterAt = toIsoDate(row?.lastDeadLetterAt);
  const topDeadLetterEvents = deadLetterBuckets.map((bucket) => ({
    key: bucket.key,
    count: Number(bucket.count ?? 0),
  }));
  const alerts = buildOutboxAlerts({
    pendingCount,
    deadLetterCount,
    processingLeaseTimeoutMinutes,
    oldestPendingAgeHours,
    staleProcessingCount,
    oldestStaleProcessingAgeMinutes,
  });

  return {
    pendingCount,
    processingCount,
    processedCount,
    deadLetterCount,
    processingLeaseTimeoutMinutes,
    oldestPendingAt,
    oldestPendingAgeHours,
    oldestProcessingAt,
    oldestProcessingAgeMinutes,
    staleProcessingCount,
    oldestStaleProcessingAt,
    oldestStaleProcessingAgeMinutes,
    lastDeadLetterAt,
    topDeadLetterEvents,
    maxAlertLevel: alerts.reduce((maxLevel, alert) => Math.max(maxLevel, alert.alertLevel), 0),
    alerts,
    recommendations: buildOutboxRecommendations({
      pendingCount,
      processingCount,
      deadLetterCount,
      oldestPendingAgeHours,
      processingLeaseTimeoutMinutes,
      staleProcessingCount,
      oldestStaleProcessingAgeMinutes,
      topDeadLetterEvents,
    }),
  };
}

async function hasRecentOutboxAlertEvent(args: {
  kind: string;
  queueStatus: OutboxEventStatus;
  alertLevel: number;
  cooldownThreshold: Date;
}) {
  const [row] = await db
    .select({ id: outboxEvents.id })
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.eventName, outboxAlertEventName),
        gte(outboxEvents.createdAt, args.cooldownThreshold),
        sql`coalesce(${outboxEvents.payload}->>'kind', '') = ${args.kind}`,
        sql`coalesce(${outboxEvents.payload}->>'queueStatus', '') = ${args.queueStatus}`,
        sql`coalesce(${outboxEvents.payload}->>'alertLevel', '') = ${String(args.alertLevel)}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function emitOutboxAlerts(args?: {
  limit?: number;
  minimumAlertLevel?: number;
}): Promise<OutboxAlertDispatchResult> {
  const limit = Math.max(1, Math.min(args?.limit ?? 10, 20));
  const minimumAlertLevel = Math.max(1, Math.min(3, Math.floor(args?.minimumAlertLevel ?? 2)));
  const summary = await getOutboxSummary();
  const alerts = summary.alerts.filter((alert) => alert.alertLevel >= minimumAlertLevel).slice(0, limit);
  const cooldownThreshold = new Date(now().getTime() - OUTBOX_ALERT_COOLDOWN_MINUTES * 60 * 1000);

  const dispatchedAlerts: OutboxAlertDispatchResult["alerts"] = [];
  let dispatchedCount = 0;
  let skippedCount = 0;

  for (const alert of alerts) {
    const isDuplicate = await hasRecentOutboxAlertEvent({
      kind: alert.kind,
      queueStatus: alert.status,
      alertLevel: alert.alertLevel,
      cooldownThreshold,
    });

    if (isDuplicate) {
      skippedCount += 1;
      dispatchedAlerts.push({
        ...alert,
        dispatched: false,
        skippedReason: "recent_duplicate",
      });
      continue;
    }

    await enqueueOutboxEvent(
      outboxAlertEventName,
      {
        kind: alert.kind,
        alertLevel: alert.alertLevel,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        actionLabel: alert.actionLabel,
        queueStatus: alert.status,
        eventName: alert.eventName,
        count: alert.count,
        suggestedLimit: alert.suggestedLimit,
        pendingCount: summary.pendingCount,
        processingCount: summary.processingCount,
        deadLetterCount: summary.deadLetterCount,
        staleProcessingCount: summary.staleProcessingCount,
        maxAlertLevel: summary.maxAlertLevel,
      },
      db,
      "platform",
    );
    dispatchedCount += 1;
    dispatchedAlerts.push({
      ...alert,
      dispatched: true,
      skippedReason: null,
    });
  }

  return {
    dispatchedCount,
    skippedCount,
    minimumAlertLevel,
    alerts: dispatchedAlerts,
  };
}

export async function listOutboxRetryAttempts(limit = 25): Promise<OutboxRetryAttemptView[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const rows = await db
    .select()
    .from(outboxRetryAttempts)
    .orderBy(desc(outboxRetryAttempts.retriedAt))
    .limit(boundedLimit);
  return rows.map(toOutboxRetryAttemptView);
}

export async function retryDeadLetterEvent(id: string, actorUserId: string): Promise<OutboxEventView> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from outbox_events where id = ${id} for update`);
    const [event] = await tx.select().from(outboxEvents).where(eq(outboxEvents.id, id));
    if (!event) {
      throw new NotFoundError("Outbox event not found");
    }
    if (event.status !== "dead_letter") {
      throw new ConflictError("Only dead-letter events can be retried");
    }

    const retriedAt = now();
    await tx.insert(outboxRetryAttempts).values({
      id: crypto.randomUUID(),
      eventId: event.id,
      eventName: event.eventName,
      actorUserId,
      previousStatus: event.status,
      previousAttempts: event.attempts,
      lastError: event.lastError,
      retriedAt,
    });

    const [updated] = await tx
      .update(outboxEvents)
      .set({
        status: "pending",
        availableAt: retriedAt,
        lastError: null,
        updatedAt: retriedAt,
      })
      .where(eq(outboxEvents.id, id))
      .returning();

    return toOutboxEventView(updated);
  });
}

export async function retryDeadLetterEventsBatch(args: {
  actorUserId: string;
  limit?: number;
  eventName?: EventName | null;
}): Promise<OutboxRetryBatchResult> {
  const boundedLimit = Math.max(1, Math.min(args.limit ?? 10, 100));

  return db.transaction(async (tx) => {
    const conditions: SQL[] = [eq(outboxEvents.status, "dead_letter")];
    if (args.eventName) {
      conditions.push(eq(outboxEvents.eventName, args.eventName));
    }

    const rows = await tx
      .select()
      .from(outboxEvents)
      .where(and(...conditions))
      .orderBy(asc(outboxEvents.updatedAt), asc(outboxEvents.createdAt))
      .limit(boundedLimit);

    if (rows.length === 0) {
      return {
        retriedCount: 0,
        eventName: args.eventName ?? null,
        events: [],
      };
    }

    const retriedAt = now();
    await tx.insert(outboxRetryAttempts).values(
      rows.map((event) => ({
        id: crypto.randomUUID(),
        eventId: event.id,
        eventName: event.eventName,
        actorUserId: args.actorUserId,
        previousStatus: event.status,
        previousAttempts: event.attempts,
        lastError: event.lastError,
        retriedAt,
      })),
    );

    const ids = rows.map((row) => row.id);
    const updatedRows = await tx
      .update(outboxEvents)
      .set({
        status: "pending",
        availableAt: retriedAt,
        lastError: null,
        updatedAt: retriedAt,
      })
      .where(inArray(outboxEvents.id, ids))
      .returning();

    const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
    const events = ids
      .map((id) => updatedMap.get(id))
      .filter((row): row is typeof outboxEvents.$inferSelect => Boolean(row))
      .map(toOutboxEventView);

    return {
      retriedCount: events.length,
      eventName: args.eventName ?? null,
      events,
    };
  });
}
