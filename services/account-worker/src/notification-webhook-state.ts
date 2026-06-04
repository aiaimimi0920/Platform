import Redis from "ioredis";

import {
  buildNotificationWebhookIncidentHistoryEntry,
  buildNotificationWebhookIncidentHistoryKey,
  buildNotificationWebhookIncidentControlState,
  buildNotificationWebhookIncidentStateKey,
  buildNotificationWebhookRouteLastSentField,
  buildNotificationWebhookRoutePolicyState,
  buildNotificationWebhookRouteSendCountField,
  evaluateNotificationWebhookRoutePolicy,
  notificationWebhookIncidentHistoryMaxEntries,
  notificationWebhookIncidentAcknowledgedAtField,
  notificationWebhookIncidentAcknowledgedByUserIdField,
  notificationWebhookIncidentSilencedAtField,
  notificationWebhookIncidentSilencedByUserIdField,
  notificationWebhookIncidentSilenceReasonField,
  notificationWebhookIncidentSilencedUntilField,
} from "@neuro/contracts";

import { env, type NotificationWebhookRouteConfig } from "./env";

let redisClient: Redis | null = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
  return redisClient;
}

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

export { buildNotificationWebhookRoutePolicyState, evaluateNotificationWebhookRoutePolicy };

export async function getNotificationWebhookIncidentControlState(incidentKey: string) {
  const client = getRedisClient();
  const key = buildNotificationWebhookIncidentStateKey(incidentKey);
  const state = await client.hmget(
    key,
    notificationWebhookIncidentAcknowledgedAtField,
    notificationWebhookIncidentAcknowledgedByUserIdField,
    notificationWebhookIncidentSilencedAtField,
    notificationWebhookIncidentSilencedUntilField,
    notificationWebhookIncidentSilencedByUserIdField,
    notificationWebhookIncidentSilenceReasonField,
  );
  const [
    acknowledgedAt,
    acknowledgedByUserId,
    silencedAt,
    silencedUntil,
    silencedByUserId,
    silenceReason,
  ] = state;

  return buildNotificationWebhookIncidentControlState({
    acknowledgedAt,
    acknowledgedByUserId,
    silencedAt,
    silencedUntil,
    silencedByUserId,
    silenceReason,
  });
}

export async function touchNotificationWebhookIncident(incidentKey: string, referenceTime: Date) {
  const client = getRedisClient();
  const key = buildNotificationWebhookIncidentStateKey(incidentKey);
  const state = await client.hmget(key, "firstSeenAt", "lastSeenAt");
  const [firstSeenAt, lastSeenAt] = state;

  const firstSeen = firstSeenAt ?? referenceTime.toISOString();
  await client
    .multi()
    .hset(key, {
      firstSeenAt: firstSeen,
      lastSeenAt: referenceTime.toISOString(),
    })
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();

  return {
    firstSeenAt: firstSeen,
    lastSeenAt: lastSeenAt ?? referenceTime.toISOString(),
  };
}

async function appendNotificationWebhookIncidentHistoryEntry(entry: ReturnType<typeof buildNotificationWebhookIncidentHistoryEntry>) {
  const client = getRedisClient();
  const key = buildNotificationWebhookIncidentHistoryKey(entry.incidentKey);
  await client
    .multi()
    .lpush(key, JSON.stringify(entry))
    .ltrim(key, 0, notificationWebhookIncidentHistoryMaxEntries - 1)
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();
}

export async function acknowledgeNotificationWebhookIncident(args: {
  incidentKey: string;
  acknowledgedAt: Date;
  acknowledgedByUserId: string;
}) {
  const client = getRedisClient();
  await touchNotificationWebhookIncident(args.incidentKey, args.acknowledgedAt);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  await client
    .multi()
    .hset(key, {
      [notificationWebhookIncidentAcknowledgedAtField]: args.acknowledgedAt.toISOString(),
      [notificationWebhookIncidentAcknowledgedByUserIdField]: args.acknowledgedByUserId,
    })
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();
  await appendNotificationWebhookIncidentHistoryEntry(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "acknowledged",
      occurredAt: args.acknowledgedAt,
      actorUserId: args.acknowledgedByUserId,
    }),
  );
}

export async function silenceNotificationWebhookIncident(args: {
  incidentKey: string;
  silencedAt: Date;
  silencedUntil: Date;
  silencedByUserId: string;
  silenceReason?: string | null;
}) {
  const client = getRedisClient();
  await touchNotificationWebhookIncident(args.incidentKey, args.silencedAt);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  await client
    .multi()
    .hset(key, {
      [notificationWebhookIncidentSilencedAtField]: args.silencedAt.toISOString(),
      [notificationWebhookIncidentSilencedUntilField]: args.silencedUntil.toISOString(),
      [notificationWebhookIncidentSilencedByUserIdField]: args.silencedByUserId,
      [notificationWebhookIncidentSilenceReasonField]: args.silenceReason?.trim() || "",
    })
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();
  await appendNotificationWebhookIncidentHistoryEntry(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "silenced",
      occurredAt: args.silencedAt,
      actorUserId: args.silencedByUserId,
      silencedUntil: args.silencedUntil,
      reason: args.silenceReason ?? null,
    }),
  );
}

export async function clearNotificationWebhookIncidentSilence(args: {
  incidentKey: string;
  clearedAt: Date;
}) {
  const client = getRedisClient();
  await touchNotificationWebhookIncident(args.incidentKey, args.clearedAt);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  await client
    .multi()
    .hdel(
      key,
      notificationWebhookIncidentSilencedAtField,
      notificationWebhookIncidentSilencedUntilField,
      notificationWebhookIncidentSilencedByUserIdField,
      notificationWebhookIncidentSilenceReasonField,
    )
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();
  await appendNotificationWebhookIncidentHistoryEntry(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "silence_cleared",
      occurredAt: args.clearedAt,
    }),
  );
}

async function ensureIncidentSeen(incidentKey: string, referenceTime: Date, routeName: string) {
  const client = getRedisClient();
  const key = buildNotificationWebhookIncidentStateKey(incidentKey);
  const lastSentField = buildNotificationWebhookRouteLastSentField(routeName);
  const sendCountField = buildNotificationWebhookRouteSendCountField(routeName);
  const baseState = await touchNotificationWebhookIncident(incidentKey, referenceTime);
  const state = await client.hmget(key, lastSentField, sendCountField, notificationWebhookIncidentSilencedUntilField);
  const [lastSentAt, sendCountRaw, silencedUntil] = state;

  return buildNotificationWebhookRoutePolicyState({
    firstSeenAt: baseState.firstSeenAt,
    lastSeenAt: baseState.lastSeenAt,
    lastSentAt,
    sendCount: sendCountRaw ? Number(sendCountRaw) : 0,
    silencedUntil,
  });
}

export async function shouldSendNotificationWebhookRoute(args: {
  incidentKey: string;
  route: NotificationWebhookRouteConfig;
  referenceTime: Date;
}) {
  const state = await ensureIncidentSeen(args.incidentKey, args.referenceTime, args.route.name);
  return evaluateNotificationWebhookRoutePolicy({
    route: args.route,
    state,
    referenceTime: args.referenceTime,
  });
}

export async function markNotificationWebhookRouteDelivered(args: {
  incidentKey: string;
  routeName: string;
  deliveredAt: Date;
  profileKey?: string | null;
  format?: NotificationWebhookRouteConfig["format"] | null;
}) {
  const client = getRedisClient();
  await touchNotificationWebhookIncident(args.incidentKey, args.deliveredAt);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  const lastSentField = buildNotificationWebhookRouteLastSentField(args.routeName);
  const sendCountField = buildNotificationWebhookRouteSendCountField(args.routeName);
  await client
    .multi()
    .hset(key, {
      lastSeenAt: args.deliveredAt.toISOString(),
      [lastSentField]: args.deliveredAt.toISOString(),
    })
    .hincrby(key, sendCountField, 1)
    .expire(key, env.notificationWebhookStateTtlHours * 60 * 60)
    .exec();
  await appendNotificationWebhookIncidentHistoryEntry(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "delivered",
      occurredAt: args.deliveredAt,
      routeName: args.routeName,
      profileKey: args.profileKey ?? null,
      format: args.format ?? null,
    }),
  );
}

export function buildNotificationWebhookRouteStateSnapshot(args: {
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  lastSentAt: Date | null;
  sendCount: number;
}) {
  return {
    firstSeenAt: toIsoOrNull(args.firstSeenAt),
    lastSeenAt: toIsoOrNull(args.lastSeenAt),
    lastSentAt: toIsoOrNull(args.lastSentAt),
    sendCount: args.sendCount,
  };
}
