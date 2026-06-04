import {
  defaultNotificationWebhookEventNames,
  parseNotificationWebhookEventNames,
  parseNotificationWebhookFormat,
  parseNotificationWebhookRouteProfiles,
  parseNotificationWebhookRoutes,
  type EventName,
  type NotificationWebhookFormat,
  type NotificationWebhookRouteConfig,
  type NotificationWebhookRouteProfileConfig,
} from "@neuro/contracts";

export type {
  EventName,
  NotificationWebhookFormat,
  NotificationWebhookRouteConfig,
  NotificationWebhookRouteProfileConfig,
} from "@neuro/contracts";

export {
  parseNotificationWebhookEventNames,
  parseNotificationWebhookFormat,
  parseNotificationWebhookRouteProfiles,
  parseNotificationWebhookRoutes,
  resolveNotificationWebhookRouteCriteria,
} from "@neuro/contracts";

type WorkerEnv = {
  databaseUrl: string;
  redisUrl: string;
  sharedDatabaseUrl: string;
  sharedRedisUrl: string;
  emailDeliveryMode: "console" | "smtp";
  emailFromAddress: string;
  emailFromName: string | null;
  emailReplyTo: string | null;
  emailSmtpHost: string | null;
  emailSmtpPort: number;
  emailSmtpSecure: boolean;
  emailSmtpUser: string | null;
  emailSmtpPass: string | null;
  pollIntervalMs: number;
  productShadowSyncIntervalMs: number;
  gatewayAnomalySweepEnabled: boolean;
  gatewayAnomalySweepIntervalMs: number;
  gatewayAnomalySweepLimit: number;
  gatewayAnomalySweepLockKey: string;
  gatewayAnomalySweepLockTtlMs: number;
  gatewayAnomalyAlertDispatchEnabled: boolean;
  gatewayAnomalyAlertDispatchIntervalMs: number;
  gatewayAnomalyAlertDispatchLimit: number;
  gatewayAnomalyAlertDispatchLockKey: string;
  gatewayAnomalyAlertDispatchLockTtlMs: number;
  gatewayAnomalyAutoRemediationEnabled: boolean;
  gatewayAnomalyAutoRemediationIntervalMs: number;
  gatewayAnomalyAutoRemediationLimit: number;
  gatewayAnomalyAutoRemediationLockKey: string;
  gatewayAnomalyAutoRemediationLockTtlMs: number;
  gatewayAnomalyRemediationImpactCaptureEnabled: boolean;
  gatewayAnomalyRemediationImpactCaptureIntervalMs: number;
  gatewayAnomalyRemediationImpactCaptureLimit: number;
  gatewayAnomalyRemediationImpactCaptureWindowMinutes: number;
  gatewayAnomalyRemediationImpactCaptureLookbackHours: number;
  gatewayAnomalyRemediationImpactCaptureLockKey: string;
  gatewayAnomalyRemediationImpactCaptureLockTtlMs: number;
  gatewayAnomalyRemediationEffectivenessSnapshotEnabled: boolean;
  gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs: number;
  gatewayAnomalyRemediationEffectivenessSnapshotLimit: number;
  gatewayAnomalyRemediationEffectivenessSnapshotWindowMinutes: number;
  gatewayAnomalyRemediationEffectivenessSnapshotLookbackHours: number;
  gatewayAnomalyRemediationEffectivenessSnapshotLockKey: string;
  gatewayAnomalyRemediationEffectivenessSnapshotLockTtlMs: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotEnabled: boolean;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLimit: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLookbackHours: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotProfileKey: "conservative" | "balanced" | "aggressive";
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxCooldownMinutes: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxMaxDeliveriesPerIncident: number;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockKey: string;
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockTtlMs: number;
  gatewayRateLimitHotspotSnapshotEnabled: boolean;
  gatewayRateLimitHotspotSnapshotIntervalMs: number;
  gatewayRateLimitHotspotSnapshotLimit: number;
  gatewayRateLimitHotspotSnapshotLookbackHours: number;
  gatewayRateLimitHotspotSnapshotLockKey: string;
  gatewayRateLimitHotspotSnapshotLockTtlMs: number;
  gatewayRateLimitHotspotAnomalySnapshotEnabled: boolean;
  gatewayRateLimitHotspotAnomalySnapshotIntervalMs: number;
  gatewayRateLimitHotspotAnomalySnapshotLimit: number;
  gatewayRateLimitHotspotAnomalySnapshotLookbackHours: number;
  gatewayRateLimitHotspotAnomalySnapshotProfileKey: "conservative" | "balanced" | "aggressive";
  gatewayRateLimitHotspotAnomalySnapshotMailboxCooldownMinutes: number;
  gatewayRateLimitHotspotAnomalySnapshotMailboxMaxDeliveriesPerIncident: number;
  gatewayRateLimitHotspotAnomalySnapshotLockKey: string;
  gatewayRateLimitHotspotAnomalySnapshotLockTtlMs: number;
  healthPort: number;
  platformOperatorUserIds: string[];
  notificationWebhookUrl: string | null;
  notificationWebhookFormat: NotificationWebhookFormat;
  notificationWebhookAuthToken: string | null;
  notificationWebhookSigningSecret: string | null;
  notificationWebhookTimeoutMs: number;
  notificationWebhookStateTtlHours: number;
  notificationWebhookEvents: EventName[];
  notificationWebhookRouteProfiles: NotificationWebhookRouteProfileConfig[];
  notificationWebhookRoutes: NotificationWebhookRouteConfig[];
  webPublicBaseUrl: string | null;
  usesDedicatedDatabase: boolean;
  usesDedicatedRedis: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number, minimum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

function parseCsvList(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false;
  return fallback;
}

function parseAnomalyProfileKey(value: string | undefined, fallback: "conservative" | "balanced" | "aggressive") {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "conservative" || normalized === "balanced" || normalized === "aggressive") {
    return normalized;
  }
  return fallback;
}

function parseEmailDeliveryMode(value: string | undefined): "console" | "smtp" {
  return value?.trim().toLowerCase() === "smtp" ? "smtp" : "console";
}

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_PRODUCT_SHADOW_SYNC_INTERVAL_MS = 300000;
const DEFAULT_GATEWAY_ANOMALY_SWEEP_INTERVAL_MS = 300000;
const DEFAULT_GATEWAY_ANOMALY_SWEEP_LIMIT = 20;
const DEFAULT_GATEWAY_ANOMALY_SWEEP_LOCK_KEY = "account-worker:gateway-anomaly-policy-sweep:lock";
const DEFAULT_GATEWAY_ANOMALY_SWEEP_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_INTERVAL_MS = 300000;
const DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LIMIT = 20;
const DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_KEY = "account-worker:gateway-anomaly-alert-dispatch:lock";
const DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_INTERVAL_MS = 300000;
const DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LIMIT = 10;
const DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_KEY = "account-worker:gateway-anomaly-auto-remediation:lock";
const DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_INTERVAL_MS = 300000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LIMIT = 10;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_WINDOW_MINUTES = 180;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOOKBACK_HOURS = 72;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_KEY =
  "account-worker:gateway-anomaly-remediation-impact-capture:lock";
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_INTERVAL_MS = 900000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LIMIT = 100;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_WINDOW_MINUTES = 180;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOOKBACK_HOURS = 168;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_KEY =
  "account-worker:gateway-anomaly-remediation-effectiveness-snapshot:lock";
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_INTERVAL_MS = 1800000;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LIMIT = 10;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOOKBACK_HOURS = 168;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_PROFILE_KEY = "balanced";
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES = 180;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT = 6;
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_KEY =
  "account-worker:gateway-anomaly-remediation-effectiveness-anomaly-snapshot:lock";
const DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_INTERVAL_MS = 900000;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LIMIT = 1000;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOOKBACK_HOURS = 168;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_KEY =
  "account-worker:gateway-rate-limit-hotspot-snapshot:lock";
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_TTL_MS = 600000;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_INTERVAL_MS = 1800000;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LIMIT = 10;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOOKBACK_HOURS = 168;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_PROFILE_KEY = "balanced";
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES = 180;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT = 6;
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_KEY =
  "account-worker:gateway-rate-limit-hotspot-anomaly-snapshot:lock";
const DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_TTL_MS = 600000;
const DEFAULT_HEALTH_PORT = 7303;
const DEFAULT_NOTIFICATION_WEBHOOK_TIMEOUT_MS = 5000;
const DEFAULT_NOTIFICATION_WEBHOOK_STATE_TTL_HOURS = 24;

const sharedDatabaseUrl = requireEnv("DATABASE_URL");
const sharedRedisUrl = requireEnv("REDIS_URL");
const accountDatabaseUrl = process.env.ACCOUNT_DATABASE_URL?.trim() || null;
const accountRedisUrl = process.env.ACCOUNT_REDIS_URL?.trim() || null;
const defaultNotificationWebhookFormat = parseNotificationWebhookFormat(process.env.NOTIFICATION_WEBHOOK_FORMAT);
const defaultNotificationWebhookTimeoutMs = parseNumber(
  process.env.NOTIFICATION_WEBHOOK_TIMEOUT_MS,
  DEFAULT_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
  250,
);
const defaultNotificationWebhookEvents = parseNotificationWebhookEventNames(
  process.env.NOTIFICATION_WEBHOOK_EVENTS,
  defaultNotificationWebhookEventNames,
);
const notificationWebhookRouteProfiles = parseNotificationWebhookRouteProfiles(
  process.env.NOTIFICATION_WEBHOOK_ROUTE_PROFILES,
  defaultNotificationWebhookEvents,
  defaultNotificationWebhookFormat,
  defaultNotificationWebhookTimeoutMs,
);

export const env: WorkerEnv = {
  databaseUrl: accountDatabaseUrl || sharedDatabaseUrl,
  redisUrl: accountRedisUrl || sharedRedisUrl,
  sharedDatabaseUrl,
  sharedRedisUrl,
  emailDeliveryMode: parseEmailDeliveryMode(process.env.ACCOUNT_EMAIL_DELIVERY_MODE),
  emailFromAddress: process.env.ACCOUNT_EMAIL_FROM_ADDRESS?.trim() || "noreply@neuro.local",
  emailFromName: process.env.ACCOUNT_EMAIL_FROM_NAME?.trim() || "NeuroPlatform",
  emailReplyTo: process.env.ACCOUNT_EMAIL_REPLY_TO?.trim() || null,
  emailSmtpHost: process.env.ACCOUNT_EMAIL_SMTP_HOST?.trim() || null,
  emailSmtpPort: parseNumber(process.env.ACCOUNT_EMAIL_SMTP_PORT, 587, 1),
  emailSmtpSecure: parseBoolean(process.env.ACCOUNT_EMAIL_SMTP_SECURE, false),
  emailSmtpUser: process.env.ACCOUNT_EMAIL_SMTP_USER?.trim() || null,
  emailSmtpPass: process.env.ACCOUNT_EMAIL_SMTP_PASS?.trim() || null,
  pollIntervalMs: parseNumber(process.env.WORKER_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS, 250),
  productShadowSyncIntervalMs: parseNumber(
    process.env.PRODUCT_SHADOW_SYNC_INTERVAL_MS,
    DEFAULT_PRODUCT_SHADOW_SYNC_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalySweepEnabled: parseBoolean(process.env.AI_GATEWAY_ANOMALY_SWEEP_ENABLED, true),
  gatewayAnomalySweepIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_SWEEP_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_SWEEP_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalySweepLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_SWEEP_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_SWEEP_LIMIT,
    1,
  ),
  gatewayAnomalySweepLockKey:
    process.env.AI_GATEWAY_ANOMALY_SWEEP_LOCK_KEY?.trim() || DEFAULT_GATEWAY_ANOMALY_SWEEP_LOCK_KEY,
  gatewayAnomalySweepLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_SWEEP_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_SWEEP_LOCK_TTL_MS,
    1000,
  ),
  gatewayAnomalyAlertDispatchEnabled: parseBoolean(process.env.AI_GATEWAY_ANOMALY_ALERT_DISPATCH_ENABLED, true),
  gatewayAnomalyAlertDispatchIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_ALERT_DISPATCH_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalyAlertDispatchLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_ALERT_DISPATCH_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LIMIT,
    1,
  ),
  gatewayAnomalyAlertDispatchLockKey:
    process.env.AI_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_KEY?.trim() || DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_KEY,
  gatewayAnomalyAlertDispatchLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_ALERT_DISPATCH_LOCK_TTL_MS,
    1000,
  ),
  gatewayAnomalyAutoRemediationEnabled: parseBoolean(process.env.AI_GATEWAY_ANOMALY_AUTO_REMEDIATION_ENABLED, true),
  gatewayAnomalyAutoRemediationIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_AUTO_REMEDIATION_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalyAutoRemediationLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_AUTO_REMEDIATION_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LIMIT,
    1,
  ),
  gatewayAnomalyAutoRemediationLockKey:
    process.env.AI_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_KEY,
  gatewayAnomalyAutoRemediationLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_AUTO_REMEDIATION_LOCK_TTL_MS,
    1000,
  ),
  gatewayAnomalyRemediationImpactCaptureEnabled: parseBoolean(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_ENABLED,
    true,
  ),
  gatewayAnomalyRemediationImpactCaptureIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalyRemediationImpactCaptureLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LIMIT,
    1,
  ),
  gatewayAnomalyRemediationImpactCaptureWindowMinutes: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_WINDOW_MINUTES,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_WINDOW_MINUTES,
    5,
  ),
  gatewayAnomalyRemediationImpactCaptureLookbackHours: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOOKBACK_HOURS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOOKBACK_HOURS,
    1,
  ),
  gatewayAnomalyRemediationImpactCaptureLockKey:
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_KEY,
  gatewayAnomalyRemediationImpactCaptureLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_IMPACT_CAPTURE_LOCK_TTL_MS,
    1000,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotEnabled: parseBoolean(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_ENABLED,
    true,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LIMIT,
    1,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotWindowMinutes: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_WINDOW_MINUTES,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_WINDOW_MINUTES,
    5,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotLookbackHours: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOOKBACK_HOURS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOOKBACK_HOURS,
    1,
  ),
  gatewayAnomalyRemediationEffectivenessSnapshotLockKey:
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_KEY,
  gatewayAnomalyRemediationEffectivenessSnapshotLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_SNAPSHOT_LOCK_TTL_MS,
    1000,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotEnabled: parseBoolean(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_ENABLED,
    true,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_INTERVAL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_INTERVAL_MS,
    5000,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLimit: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LIMIT,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LIMIT,
    1,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLookbackHours: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOOKBACK_HOURS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOOKBACK_HOURS,
    1,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotProfileKey: parseAnomalyProfileKey(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_PROFILE_KEY,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_PROFILE_KEY,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxCooldownMinutes: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES,
    0,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotMailboxMaxDeliveriesPerIncident: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT,
    1,
  ),
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockKey:
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_KEY,
  gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_TTL_MS,
    DEFAULT_GATEWAY_ANOMALY_REMEDIATION_EFFECTIVENESS_ANOMALY_SNAPSHOT_LOCK_TTL_MS,
    1000,
  ),
  gatewayRateLimitHotspotSnapshotEnabled: parseBoolean(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_ENABLED,
    true,
  ),
  gatewayRateLimitHotspotSnapshotIntervalMs: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_INTERVAL_MS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_INTERVAL_MS,
    5000,
  ),
  gatewayRateLimitHotspotSnapshotLimit: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LIMIT,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LIMIT,
    1,
  ),
  gatewayRateLimitHotspotSnapshotLookbackHours: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOOKBACK_HOURS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOOKBACK_HOURS,
    1,
  ),
  gatewayRateLimitHotspotSnapshotLockKey:
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_KEY,
  gatewayRateLimitHotspotSnapshotLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_TTL_MS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_SNAPSHOT_LOCK_TTL_MS,
    1000,
  ),
  gatewayRateLimitHotspotAnomalySnapshotEnabled: parseBoolean(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_ENABLED,
    true,
  ),
  gatewayRateLimitHotspotAnomalySnapshotIntervalMs: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_INTERVAL_MS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_INTERVAL_MS,
    5000,
  ),
  gatewayRateLimitHotspotAnomalySnapshotLimit: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LIMIT,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LIMIT,
    1,
  ),
  gatewayRateLimitHotspotAnomalySnapshotLookbackHours: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOOKBACK_HOURS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOOKBACK_HOURS,
    1,
  ),
  gatewayRateLimitHotspotAnomalySnapshotProfileKey: parseAnomalyProfileKey(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_PROFILE_KEY,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_PROFILE_KEY,
  ),
  gatewayRateLimitHotspotAnomalySnapshotMailboxCooldownMinutes: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_COOLDOWN_MINUTES,
    0,
  ),
  gatewayRateLimitHotspotAnomalySnapshotMailboxMaxDeliveriesPerIncident: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_MAILBOX_MAX_DELIVERIES_PER_INCIDENT,
    1,
  ),
  gatewayRateLimitHotspotAnomalySnapshotLockKey:
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_KEY?.trim() ||
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_KEY,
  gatewayRateLimitHotspotAnomalySnapshotLockTtlMs: parseNumber(
    process.env.AI_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_TTL_MS,
    DEFAULT_GATEWAY_RATE_LIMIT_HOTSPOT_ANOMALY_SNAPSHOT_LOCK_TTL_MS,
    1000,
  ),
  healthPort: parseNumber(process.env.WORKER_HEALTH_PORT, DEFAULT_HEALTH_PORT, 1),
  platformOperatorUserIds: parseCsvList(process.env.PLATFORM_OPERATOR_USER_IDS),
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL?.trim() || null,
  notificationWebhookFormat: defaultNotificationWebhookFormat,
  notificationWebhookAuthToken: process.env.NOTIFICATION_WEBHOOK_AUTH_TOKEN?.trim() || null,
  notificationWebhookSigningSecret: process.env.NOTIFICATION_WEBHOOK_SIGNING_SECRET?.trim() || null,
  notificationWebhookTimeoutMs: defaultNotificationWebhookTimeoutMs,
  notificationWebhookStateTtlHours: parseNumber(
    process.env.NOTIFICATION_WEBHOOK_STATE_TTL_HOURS,
    DEFAULT_NOTIFICATION_WEBHOOK_STATE_TTL_HOURS,
    1,
  ),
  notificationWebhookEvents: defaultNotificationWebhookEvents,
  notificationWebhookRouteProfiles,
  notificationWebhookRoutes: parseNotificationWebhookRoutes(
    process.env.NOTIFICATION_WEBHOOK_ROUTES,
    notificationWebhookRouteProfiles,
    defaultNotificationWebhookEvents,
    defaultNotificationWebhookFormat,
    defaultNotificationWebhookTimeoutMs,
  ),
  webPublicBaseUrl: process.env.WEB_PUBLIC_BASE_URL?.trim() || null,
  usesDedicatedDatabase: Boolean(accountDatabaseUrl),
  usesDedicatedRedis: Boolean(accountRedisUrl),
};
