import {
  buildNotificationWebhookCatalogView,
  defaultNotificationWebhookEventNames,
  parseNotificationWebhookEventNames,
  parseNotificationWebhookFormat,
  parseNotificationWebhookRouteProfiles,
  parseNotificationWebhookRoutes,
  type NotificationWebhookCatalogView,
} from "@neuro/contracts";

const DEFAULT_NOTIFICATION_WEBHOOK_TIMEOUT_MS = 5000;

function parseNumber(value: string | undefined, fallback: number, minimum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

function getPlatformOperatorUserIdSet() {
  return new Set(
    (process.env.PLATFORM_OPERATOR_USER_IDS || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

export function isPlatformOperatorUserId(userId: string) {
  return getPlatformOperatorUserIdSet().has(userId);
}

export function buildNotificationWebhookCatalogFromEnv(): NotificationWebhookCatalogView {
  const enabledEventNames = parseNotificationWebhookEventNames(
    process.env.NOTIFICATION_WEBHOOK_EVENTS,
    defaultNotificationWebhookEventNames,
  );
  const defaultFormat = parseNotificationWebhookFormat(process.env.NOTIFICATION_WEBHOOK_FORMAT);
  const defaultTimeoutMs = parseNumber(
    process.env.NOTIFICATION_WEBHOOK_TIMEOUT_MS,
    DEFAULT_NOTIFICATION_WEBHOOK_TIMEOUT_MS,
    250,
  );
  const profiles = parseNotificationWebhookRouteProfiles(
    process.env.NOTIFICATION_WEBHOOK_ROUTE_PROFILES,
    enabledEventNames,
    defaultFormat,
    defaultTimeoutMs,
  );
  const routes = parseNotificationWebhookRoutes(
    process.env.NOTIFICATION_WEBHOOK_ROUTES,
    profiles,
    enabledEventNames,
    defaultFormat,
    defaultTimeoutMs,
  );

  const defaultUrl = process.env.NOTIFICATION_WEBHOOK_URL?.trim() || null;

  return buildNotificationWebhookCatalogView({
    enabledEventNames,
    defaultTarget: defaultUrl
      ? {
          url: defaultUrl,
          format: defaultFormat,
          authToken: process.env.NOTIFICATION_WEBHOOK_AUTH_TOKEN?.trim() || null,
          signingSecret: process.env.NOTIFICATION_WEBHOOK_SIGNING_SECRET?.trim() || null,
          timeoutMs: defaultTimeoutMs,
        }
      : null,
    profiles,
    routes,
  });
}
