import { buildNotificationWebhookRoutePolicyState, evaluateNotificationWebhookRoutePolicy } from "@neuro/contracts";

import type { NotificationWebhookRouteConfig } from "./env";

export const gatewayRateLimitHotspotAnomalyMailboxRouteName = "gateway-rate-limit-hotspot-anomaly-mailbox";

export function buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig(args: {
  cooldownMinutes: number;
  maxDeliveriesPerIncident: number;
}): NotificationWebhookRouteConfig {
  return {
    name: gatewayRateLimitHotspotAnomalyMailboxRouteName,
    url: "internal://operator-mailbox",
    profileKey: null,
    format: "generic",
    eventNames: ["aiGateway.rateLimitHotspotAnomalyAlerted"],
    minAlertLevel: null,
    maxAlertLevel: null,
    minCount: null,
    maxCount: null,
    minCandidateCount: null,
    maxCandidateCount: null,
    policyKeys: [],
    reasonCategories: [],
    reasonDispositions: [],
    callbackTypes: [],
    stopAfterMatch: false,
    minActiveMinutes: null,
    cooldownMinutes: args.cooldownMinutes,
    maxDeliveriesPerIncident: args.maxDeliveriesPerIncident,
    authToken: null,
    signingSecret: null,
    timeoutMs: 1000,
  };
}

export function evaluateGatewayRateLimitHotspotAnomalyMailboxRoutePolicy(args: {
  cooldownMinutes: number;
  maxDeliveriesPerIncident: number;
  firstSeenAt: Date | null;
  lastSentAt: Date | null;
  sendCount: number;
  referenceTime: Date;
  silencedUntil?: Date | null;
}) {
  return evaluateNotificationWebhookRoutePolicy({
    route: buildGatewayRateLimitHotspotAnomalyMailboxRouteConfig({
      cooldownMinutes: args.cooldownMinutes,
      maxDeliveriesPerIncident: args.maxDeliveriesPerIncident,
    }),
    state: buildNotificationWebhookRoutePolicyState({
      firstSeenAt: args.firstSeenAt,
      lastSeenAt: args.referenceTime,
      lastSentAt: args.lastSentAt,
      sendCount: args.sendCount,
      silencedUntil: args.silencedUntil ?? null,
    }),
    referenceTime: args.referenceTime,
  });
}
