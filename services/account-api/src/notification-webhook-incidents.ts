import { redis } from "@neuro/account-domain";
import { mapWithConcurrency } from "@neuro/backend-foundation/async/map-with-concurrency";
import {
  notificationWebhookIncidentBatchActionKinds,
  buildNotificationWebhookIncidentHistoryEntry,
  buildNotificationWebhookIncidentHistoryKey,
  buildNotificationWebhookIncidentControlState,
  buildNotificationWebhookIncidentStateKey,
  buildNotificationWebhookRouteLastSentField,
  buildNotificationWebhookRoutePolicyState,
  buildNotificationWebhookRouteSendCountField,
  evaluateNotificationWebhookRoutePolicy,
  notificationWebhookDefaultTargetRouteName,
  notificationWebhookIncidentHistoryMaxEntries,
  notificationWebhookIncidentAcknowledgedAtField,
  notificationWebhookIncidentAcknowledgedByUserIdField,
  notificationWebhookIncidentSilencedAtField,
  notificationWebhookIncidentSilencedByUserIdField,
  notificationWebhookIncidentSilenceReasonField,
  notificationWebhookIncidentSilencedUntilField,
  notificationWebhookIncidentStateKeyPrefix,
  parseNotificationWebhookIncidentHistoryEntry,
  parseNotificationWebhookIncidentKey,
  resolveNotificationWebhookIncidentGovernanceState,
  type NotificationWebhookIncidentBatchActionResult,
  type NotificationWebhookIncidentControlResult,
  type NotificationWebhookIncidentGovernanceState,
  type NotificationWebhookIncidentHistoryEntryView,
  type NotificationWebhookIncidentListView,
  type NotificationWebhookIncidentRouteStateView,
  type NotificationWebhookIncidentSummaryBucket,
  type NotificationWebhookIncidentView,
} from "@neuro/contracts";

import { buildNotificationWebhookCatalogFromEnv } from "./notification-webhook-catalog";

const notificationWebhookStateTtlSeconds =
  Math.max(1, Number(process.env.NOTIFICATION_WEBHOOK_STATE_TTL_HOURS || 24)) * 60 * 60;
const notificationWebhookIncidentReadConcurrency = 8;

type NotificationWebhookIncidentFilter = {
  limit: number;
  agentId?: string;
  callbackType?: string;
  policyKey?: string;
  reasonCategory?: string;
  reasonDisposition?: string;
  projectId?: string;
  incidentId?: string;
  routePolicyId?: string;
  snapshotId?: string;
  alertLevel?: number;
  governanceState?: NotificationWebhookIncidentGovernanceState;
  historyLimit?: number;
};

function toIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toSafeCount(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function incrementSummaryBucket(map: Map<string, number>, key: string | null | undefined) {
  const normalized = key && key.trim().length > 0 ? key.trim() : "unknown";
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function toSortedSummaryBuckets(map: Map<string, number>): NotificationWebhookIncidentSummaryBucket[] {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([key, count]) => ({ key, count }));
}

function buildGovernanceBuckets(args: {
  activeCount: number;
  acknowledgedCount: number;
  silencedCount: number;
}): NotificationWebhookIncidentSummaryBucket[] {
  return [
    { key: "active", count: args.activeCount },
    { key: "acknowledged", count: args.acknowledgedCount },
    { key: "silenced", count: args.silencedCount },
  ].filter((bucket) => bucket.count > 0);
}

function summarizeNotificationWebhookIncidents(
  incidents: NotificationWebhookIncidentView[],
): Pick<
  NotificationWebhookIncidentListView,
  "activeCount" | "acknowledgedCount" | "silencedCount" | "byAlertLevel" | "byReasonCategory"
> {
  let activeCount = 0;
  let acknowledgedCount = 0;
  let silencedCount = 0;
  const alertLevelBuckets = new Map<string, number>();
  const reasonCategoryBuckets = new Map<string, number>();

  for (const incident of incidents) {
    if (incident.governanceState === "silenced") {
      silencedCount += 1;
    } else if (incident.governanceState === "acknowledged") {
      acknowledgedCount += 1;
    } else {
      activeCount += 1;
    }

    incrementSummaryBucket(alertLevelBuckets, `L${incident.alertLevel}`);
    incrementSummaryBucket(reasonCategoryBuckets, incident.reasonCategory ?? "none");
  }

  return {
    activeCount,
    acknowledgedCount,
    silencedCount,
    byAlertLevel: toSortedSummaryBuckets(alertLevelBuckets),
    byReasonCategory: toSortedSummaryBuckets(reasonCategoryBuckets),
  };
}

function matchesIncidentFilter(
  incident: ReturnType<typeof parseNotificationWebhookIncidentKey>,
  filter: NotificationWebhookIncidentFilter,
) {
  if (!incident) return false;
  if (filter.agentId && incident.agentId !== filter.agentId) return false;
  if (filter.callbackType && incident.callbackType !== filter.callbackType) return false;
  if (filter.policyKey && incident.policyKey !== filter.policyKey) return false;
  if (filter.reasonCategory && incident.reasonCategory !== filter.reasonCategory) return false;
  if (filter.reasonDisposition && incident.reasonDisposition !== filter.reasonDisposition) return false;
  if (filter.projectId && incident.projectId !== filter.projectId) return false;
  if (filter.incidentId && incident.incidentId !== filter.incidentId) return false;
  if (filter.routePolicyId && incident.routePolicyId !== filter.routePolicyId) return false;
  if (filter.snapshotId && incident.snapshotId !== filter.snapshotId) return false;
  if (typeof filter.alertLevel === "number" && incident.alertLevel !== filter.alertLevel) return false;
  return true;
}

async function touchNotificationWebhookIncidentState(incidentKey: string, referenceTime: Date) {
  const key = buildNotificationWebhookIncidentStateKey(incidentKey);
  const state = await redis.hmget(key, "firstSeenAt", "lastSeenAt");
  const [firstSeenAt, lastSeenAt] = state;

  const firstSeen = firstSeenAt ?? referenceTime.toISOString();
  await redis
    .multi()
    .hset(key, {
      firstSeenAt: firstSeen,
      lastSeenAt: referenceTime.toISOString(),
    })
    .expire(key, notificationWebhookStateTtlSeconds)
    .exec();

  return {
    firstSeenAt: firstSeen,
    lastSeenAt: lastSeenAt ?? referenceTime.toISOString(),
  };
}

async function appendNotificationWebhookIncidentHistory(
  entry: ReturnType<typeof buildNotificationWebhookIncidentHistoryEntry>,
) {
  const key = buildNotificationWebhookIncidentHistoryKey(entry.incidentKey);
  await redis
    .multi()
    .lpush(key, JSON.stringify(entry))
    .ltrim(key, 0, notificationWebhookIncidentHistoryMaxEntries - 1)
    .expire(key, notificationWebhookStateTtlSeconds)
    .exec();
}

async function listNotificationWebhookIncidentHistoryEntries(args: {
  incidentKey: string;
  limit: number;
}): Promise<NotificationWebhookIncidentHistoryEntryView[]> {
  const key = buildNotificationWebhookIncidentHistoryKey(args.incidentKey);
  const rawEntries = await redis.lrange(key, 0, Math.max(0, args.limit - 1));
  return rawEntries
    .map((entry) => parseNotificationWebhookIncidentHistoryEntry(entry))
    .filter((entry): entry is NotificationWebhookIncidentHistoryEntryView => Boolean(entry));
}

function buildNotificationWebhookIncidentControlResult(args: {
  incidentKey: string;
  control: ReturnType<typeof buildNotificationWebhookIncidentControlState>;
  referenceTime: Date;
}): NotificationWebhookIncidentControlResult {
  return {
    incidentKey: args.incidentKey,
    governanceState: resolveNotificationWebhookIncidentGovernanceState({
      control: args.control,
      referenceTime: args.referenceTime,
    }),
    acknowledgedAt: args.control.acknowledgedAt ? args.control.acknowledgedAt.toISOString() : null,
    acknowledgedByUserId: args.control.acknowledgedByUserId,
    silencedAt: args.control.silencedAt ? args.control.silencedAt.toISOString() : null,
    silencedUntil: args.control.silencedUntil ? args.control.silencedUntil.toISOString() : null,
    silencedByUserId: args.control.silencedByUserId,
    silenceReason: args.control.silenceReason,
  };
}

function buildDefaultRouteState(args: {
  lastSentAt: string | null;
  sendCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  silencedUntil: string | null;
  format: "generic" | "slack" | "discord" | "feishu";
  referenceTime: Date;
}): NotificationWebhookIncidentRouteStateView {
  const policy = evaluateNotificationWebhookRoutePolicy({
    route: {
      minActiveMinutes: null,
      cooldownMinutes: null,
      maxDeliveriesPerIncident: null,
    },
    state: buildNotificationWebhookRoutePolicyState({
      firstSeenAt: args.firstSeenAt,
      lastSeenAt: args.lastSeenAt,
      lastSentAt: args.lastSentAt,
      sendCount: args.sendCount,
      silencedUntil: args.silencedUntil,
    }),
    referenceTime: args.referenceTime,
  });

  return {
    routeName: notificationWebhookDefaultTargetRouteName,
    profileKey: null,
    format: args.format,
    isDefaultTarget: true,
    lastSentAt: args.lastSentAt,
    sendCount: args.sendCount,
    activeMinutes: policy.activeMinutes,
    cooldownRemainingMinutes: policy.cooldownRemainingMinutes,
    deliveriesRemaining: policy.deliveriesRemaining,
    currentState: policy.reason ?? "eligible",
  };
}

export async function listNotificationWebhookIncidents(
  filter: NotificationWebhookIncidentFilter,
): Promise<NotificationWebhookIncidentListView> {
  const catalog = buildNotificationWebhookCatalogFromEnv();
  const referenceTime = new Date();
  const historyLimit = Math.max(1, Math.min(filter.historyLimit ?? 6, notificationWebhookIncidentHistoryMaxEntries));
  const candidateKeys: string[] = [];
  let cursor = "0";
  const scanCount = Math.max(filter.limit * 10, 100);

  do {
    const result = await redis.scan(cursor, "MATCH", `${notificationWebhookIncidentStateKeyPrefix}*`, "COUNT", scanCount);
    cursor = result[0];
    for (const key of result[1]) {
      const incidentKey = key.startsWith(notificationWebhookIncidentStateKeyPrefix)
        ? key.slice(notificationWebhookIncidentStateKeyPrefix.length)
        : key;
      const parsed = parseNotificationWebhookIncidentKey(incidentKey);
      if (!matchesIncidentFilter(parsed, filter)) {
        continue;
      }
      candidateKeys.push(key);
    }
  } while (cursor !== "0");

  const incidents = await mapWithConcurrency(
    candidateKeys,
    notificationWebhookIncidentReadConcurrency,
    async (key) => {
      const incidentKey = key.slice(notificationWebhookIncidentStateKeyPrefix.length);
      const parsed = parseNotificationWebhookIncidentKey(incidentKey);
      if (!parsed) {
        return null;
      }

      const state = await redis.hgetall(key);
      const firstSeenAt = toIsoDate(state.firstSeenAt);
      const lastSeenAt = toIsoDate(state.lastSeenAt);
      const history = await listNotificationWebhookIncidentHistoryEntries({
        incidentKey,
        limit: historyLimit,
      });
      const control = buildNotificationWebhookIncidentControlState({
        acknowledgedAt: state[notificationWebhookIncidentAcknowledgedAtField] ?? null,
        acknowledgedByUserId: state[notificationWebhookIncidentAcknowledgedByUserIdField] ?? null,
        silencedAt: state[notificationWebhookIncidentSilencedAtField] ?? null,
        silencedUntil: state[notificationWebhookIncidentSilencedUntilField] ?? null,
        silencedByUserId: state[notificationWebhookIncidentSilencedByUserIdField] ?? null,
        silenceReason: state[notificationWebhookIncidentSilenceReasonField] ?? null,
      });
      const governanceState = resolveNotificationWebhookIncidentGovernanceState({
        control,
        referenceTime,
      });
      if (filter.governanceState && governanceState !== filter.governanceState) {
        return null;
      }
      const routeStates: NotificationWebhookIncidentRouteStateView[] = [];

      if (catalog.defaultTarget && catalog.defaultTarget.eventNames.includes(parsed.eventName)) {
        routeStates.push(
          buildDefaultRouteState({
            firstSeenAt,
            lastSeenAt,
            lastSentAt: toIsoDate(state[buildNotificationWebhookRouteLastSentField(notificationWebhookDefaultTargetRouteName)]),
            sendCount: toSafeCount(state[buildNotificationWebhookRouteSendCountField(notificationWebhookDefaultTargetRouteName)]),
            format: catalog.defaultTarget.format,
            silencedUntil: control.silencedUntil ? control.silencedUntil.toISOString() : null,
            referenceTime,
          }),
        );
      }

      for (const route of catalog.routes) {
        if (!route.eventNames.includes(parsed.eventName)) {
          continue;
        }
        const routeState = buildNotificationWebhookRoutePolicyState({
          firstSeenAt,
          lastSeenAt,
          lastSentAt: state[buildNotificationWebhookRouteLastSentField(route.name)] ?? null,
          sendCount: toSafeCount(state[buildNotificationWebhookRouteSendCountField(route.name)]),
          silencedUntil: control.silencedUntil,
        });
        const policy = evaluateNotificationWebhookRoutePolicy({
          route,
          state: routeState,
          referenceTime,
        });

        routeStates.push({
          routeName: route.name,
          profileKey: route.profileKey,
          format: route.format,
          isDefaultTarget: false,
          lastSentAt: routeState.lastSentAt ? routeState.lastSentAt.toISOString() : null,
          sendCount: routeState.sendCount,
          activeMinutes: policy.activeMinutes,
          cooldownRemainingMinutes: policy.cooldownRemainingMinutes,
          deliveriesRemaining: policy.deliveriesRemaining,
          currentState: policy.reason ?? "eligible",
        });
      }

      return {
        ...parsed,
        governanceState,
        acknowledgedAt: control.acknowledgedAt ? control.acknowledgedAt.toISOString() : null,
        acknowledgedByUserId: control.acknowledgedByUserId,
        silencedAt: control.silencedAt ? control.silencedAt.toISOString() : null,
        silencedUntil: control.silencedUntil ? control.silencedUntil.toISOString() : null,
        silencedByUserId: control.silencedByUserId,
        silenceReason: control.silenceReason,
        firstSeenAt,
        lastSeenAt,
        history,
        routeStates,
      };
    },
  );

  const sorted = incidents
    .filter((incident): incident is NonNullable<typeof incident> => Boolean(incident))
    .sort((left, right) => {
      const leftTime = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
      const rightTime = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
      return rightTime - leftTime;
    });

  const limited = sorted.slice(0, filter.limit);
  const summary = summarizeNotificationWebhookIncidents(sorted);
  return {
    limit: filter.limit,
    incidentCount: sorted.length,
    newestSeenAt: limited[0]?.lastSeenAt ?? null,
    activeCount: summary.activeCount,
    acknowledgedCount: summary.acknowledgedCount,
    silencedCount: summary.silencedCount,
    byAlertLevel: summary.byAlertLevel,
    byReasonCategory: summary.byReasonCategory,
    incidents: limited,
  };
}

async function listNotificationWebhookIncidentBatchCandidates(
  filter: NotificationWebhookIncidentFilter,
) {
  return listNotificationWebhookIncidents({
    ...filter,
    historyLimit: 1,
  });
}

export async function acknowledgeNotificationWebhookIncidentByOperator(args: {
  incidentKey: string;
  userId: string;
  at: Date;
}) {
  await touchNotificationWebhookIncidentState(args.incidentKey, args.at);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  await redis
    .multi()
    .hset(key, {
      [notificationWebhookIncidentAcknowledgedAtField]: args.at.toISOString(),
      [notificationWebhookIncidentAcknowledgedByUserIdField]: args.userId,
    })
    .expire(key, notificationWebhookStateTtlSeconds)
    .exec();
  await appendNotificationWebhookIncidentHistory(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "acknowledged",
      occurredAt: args.at,
      actorUserId: args.userId,
    }),
  );

  const current = await redis.hmget(
    key,
    notificationWebhookIncidentSilencedAtField,
    notificationWebhookIncidentSilencedUntilField,
    notificationWebhookIncidentSilencedByUserIdField,
    notificationWebhookIncidentSilenceReasonField,
  );
  const [silencedAt, silencedUntil, silencedByUserId, silenceReason] = current;
  return buildNotificationWebhookIncidentControlResult({
    incidentKey: args.incidentKey,
    control: buildNotificationWebhookIncidentControlState({
      acknowledgedAt: args.at,
      acknowledgedByUserId: args.userId,
      silencedAt,
      silencedUntil,
      silencedByUserId,
      silenceReason,
    }),
    referenceTime: args.at,
  });
}

export async function silenceNotificationWebhookIncidentByOperator(args: {
  incidentKey: string;
  userId: string;
  at: Date;
  until: Date;
  reason?: string | null;
}) {
  await touchNotificationWebhookIncidentState(args.incidentKey, args.at);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  await redis
    .multi()
    .hset(key, {
      [notificationWebhookIncidentSilencedAtField]: args.at.toISOString(),
      [notificationWebhookIncidentSilencedUntilField]: args.until.toISOString(),
      [notificationWebhookIncidentSilencedByUserIdField]: args.userId,
      [notificationWebhookIncidentSilenceReasonField]: args.reason?.trim() || "",
    })
    .expire(key, notificationWebhookStateTtlSeconds)
    .exec();
  await appendNotificationWebhookIncidentHistory(
    buildNotificationWebhookIncidentHistoryEntry({
      incidentKey: args.incidentKey,
      kind: "silenced",
      occurredAt: args.at,
      actorUserId: args.userId,
      silencedUntil: args.until,
      reason: args.reason ?? null,
    }),
  );

  const current = await redis.hmget(
    key,
    notificationWebhookIncidentAcknowledgedAtField,
    notificationWebhookIncidentAcknowledgedByUserIdField,
  );
  const [acknowledgedAt, acknowledgedByUserId] = current;
  return buildNotificationWebhookIncidentControlResult({
    incidentKey: args.incidentKey,
    control: buildNotificationWebhookIncidentControlState({
      acknowledgedAt,
      acknowledgedByUserId,
      silencedAt: args.at,
      silencedUntil: args.until,
      silencedByUserId: args.userId,
      silenceReason: args.reason ?? null,
    }),
    referenceTime: args.at,
  });
}

export async function clearNotificationWebhookIncidentSilenceByOperator(args: {
  incidentKey: string;
  at: Date;
  userId?: string;
}) {
  await touchNotificationWebhookIncidentState(args.incidentKey, args.at);
  const key = buildNotificationWebhookIncidentStateKey(args.incidentKey);
  const previous = await redis.hmget(
    key,
    notificationWebhookIncidentSilencedAtField,
    notificationWebhookIncidentSilencedUntilField,
    notificationWebhookIncidentSilencedByUserIdField,
    notificationWebhookIncidentSilenceReasonField,
  );
  const [previousSilencedAt, previousSilencedUntil, previousSilencedByUserId, previousSilenceReason] = previous;
  await redis
    .multi()
    .hdel(
      key,
      notificationWebhookIncidentSilencedAtField,
      notificationWebhookIncidentSilencedUntilField,
      notificationWebhookIncidentSilencedByUserIdField,
      notificationWebhookIncidentSilenceReasonField,
    )
    .expire(key, notificationWebhookStateTtlSeconds)
    .exec();
  if (previousSilencedAt || previousSilencedUntil || previousSilencedByUserId || previousSilenceReason) {
    await appendNotificationWebhookIncidentHistory(
      buildNotificationWebhookIncidentHistoryEntry({
        incidentKey: args.incidentKey,
        kind: "silence_cleared",
        occurredAt: args.at,
        actorUserId: args.userId ?? null,
      }),
    );
  }

  const current = await redis.hmget(
    key,
    notificationWebhookIncidentAcknowledgedAtField,
    notificationWebhookIncidentAcknowledgedByUserIdField,
  );
  const [acknowledgedAt, acknowledgedByUserId] = current;
  return buildNotificationWebhookIncidentControlResult({
    incidentKey: args.incidentKey,
    control: buildNotificationWebhookIncidentControlState({
      acknowledgedAt,
      acknowledgedByUserId,
      silencedAt: null,
      silencedUntil: null,
      silencedByUserId: null,
      silenceReason: null,
    }),
    referenceTime: args.at,
  });
}

export async function acknowledgeNotificationWebhookIncidentBatchByOperator(args: {
  limit: number;
  agentId?: string;
  callbackType?: string;
  policyKey?: string;
  reasonCategory?: string;
  reasonDisposition?: string;
  alertLevel?: number;
  governanceState?: NotificationWebhookIncidentGovernanceState;
  userId: string;
  at: Date;
}): Promise<NotificationWebhookIncidentBatchActionResult> {
  const candidates = await listNotificationWebhookIncidentBatchCandidates({
    limit: args.limit,
    agentId: args.agentId,
    callbackType: args.callbackType,
    policyKey: args.policyKey,
    reasonCategory: args.reasonCategory,
    reasonDisposition: args.reasonDisposition,
    alertLevel: args.alertLevel,
    governanceState: args.governanceState,
  });
  const results: NotificationWebhookIncidentControlResult[] = [];
  for (const incident of candidates.incidents) {
    results.push(
      await acknowledgeNotificationWebhookIncidentByOperator({
        incidentKey: incident.incidentKey,
        userId: args.userId,
        at: args.at,
      }),
    );
  }

  return {
    action: notificationWebhookIncidentBatchActionKinds[0],
    limit: args.limit,
    matchedCount: candidates.incidentCount,
    actedCount: results.length,
    incidentKeys: results.map((result) => result.incidentKey),
    silencedUntil: null,
    byGovernanceState: buildGovernanceBuckets({
      activeCount: results.filter((result) => result.governanceState === "active").length,
      acknowledgedCount: results.filter((result) => result.governanceState === "acknowledged").length,
      silencedCount: results.filter((result) => result.governanceState === "silenced").length,
    }),
  };
}

export async function silenceNotificationWebhookIncidentBatchByOperator(args: {
  limit: number;
  agentId?: string;
  callbackType?: string;
  policyKey?: string;
  reasonCategory?: string;
  reasonDisposition?: string;
  alertLevel?: number;
  governanceState?: NotificationWebhookIncidentGovernanceState;
  userId: string;
  at: Date;
  until: Date;
  reason?: string | null;
}): Promise<NotificationWebhookIncidentBatchActionResult> {
  const candidates = await listNotificationWebhookIncidentBatchCandidates({
    limit: args.limit,
    agentId: args.agentId,
    callbackType: args.callbackType,
    policyKey: args.policyKey,
    reasonCategory: args.reasonCategory,
    reasonDisposition: args.reasonDisposition,
    alertLevel: args.alertLevel,
    governanceState: args.governanceState,
  });
  const results: NotificationWebhookIncidentControlResult[] = [];
  for (const incident of candidates.incidents) {
    results.push(
      await silenceNotificationWebhookIncidentByOperator({
        incidentKey: incident.incidentKey,
        userId: args.userId,
        at: args.at,
        until: args.until,
        reason: args.reason ?? null,
      }),
    );
  }

  return {
    action: notificationWebhookIncidentBatchActionKinds[1],
    limit: args.limit,
    matchedCount: candidates.incidentCount,
    actedCount: results.length,
    incidentKeys: results.map((result) => result.incidentKey),
    silencedUntil: args.until.toISOString(),
    byGovernanceState: buildGovernanceBuckets({
      activeCount: results.filter((result) => result.governanceState === "active").length,
      acknowledgedCount: results.filter((result) => result.governanceState === "acknowledged").length,
      silencedCount: results.filter((result) => result.governanceState === "silenced").length,
    }),
  };
}

export async function clearNotificationWebhookIncidentSilenceBatchByOperator(args: {
  limit: number;
  agentId?: string;
  callbackType?: string;
  policyKey?: string;
  reasonCategory?: string;
  reasonDisposition?: string;
  alertLevel?: number;
  governanceState?: NotificationWebhookIncidentGovernanceState;
  userId: string;
  at: Date;
}): Promise<NotificationWebhookIncidentBatchActionResult> {
  const candidates = await listNotificationWebhookIncidentBatchCandidates({
    limit: args.limit,
    agentId: args.agentId,
    callbackType: args.callbackType,
    policyKey: args.policyKey,
    reasonCategory: args.reasonCategory,
    reasonDisposition: args.reasonDisposition,
    alertLevel: args.alertLevel,
    governanceState: args.governanceState,
  });
  const results: NotificationWebhookIncidentControlResult[] = [];
  for (const incident of candidates.incidents) {
    results.push(
      await clearNotificationWebhookIncidentSilenceByOperator({
        incidentKey: incident.incidentKey,
        userId: args.userId,
        at: args.at,
      }),
    );
  }

  return {
    action: notificationWebhookIncidentBatchActionKinds[2],
    limit: args.limit,
    matchedCount: candidates.incidentCount,
    actedCount: results.length,
    incidentKeys: results.map((result) => result.incidentKey),
    silencedUntil: null,
    byGovernanceState: buildGovernanceBuckets({
      activeCount: results.filter((result) => result.governanceState === "active").length,
      acknowledgedCount: results.filter((result) => result.governanceState === "acknowledged").length,
      silencedCount: results.filter((result) => result.governanceState === "silenced").length,
    }),
  };
}
