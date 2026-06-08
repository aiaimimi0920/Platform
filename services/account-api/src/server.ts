import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { sql } from "drizzle-orm";
import Fastify from "fastify";

import {
  agentExecutionRouter,
  announcementsRouter,
  benefitsRouter,
  credentialPoolsRouter,
  db,
  ensureAnnouncementCatalogSeeded,
  ensureBenefitCatalogSeeded,
  emailNativeRouter,
  ensurePersonalMissionCatalogSeeded,
  ensureHonorProjectCatalogSeeded,
  env as accountEnv,
  honorProjectsRouter,
  identityRouter,
  mailboxRouter,
  personalMissionsRouter,
  productShadowRouter,
  reputationRouter,
  redis,
  walletLedgerRouter,
} from "@neuro/account-domain";
import {
  notificationWebhookIncidentSavedViewFocusSections,
  parseNotificationWebhookIncidentKey,
  type NotificationWebhookIncidentGovernanceState,
  type NotificationWebhookIncidentSavedViewFocusSection,
} from "@neuro/contracts";
import { env } from "@neuro/backend-foundation/env";
import {
  assertUserContext,
  withInternalRequest,
} from "@neuro/backend-foundation/platform/internal-auth";
import { HttpError } from "@neuro/backend-foundation/platform/errors";
import { ensureFeatureModules } from "@neuro/backend-foundation/platform/feature-modules/service";

import {
  buildNotificationWebhookCatalogFromEnv,
  isPlatformOperatorUserId,
} from "./notification-webhook-catalog";
import { emailProviderIngressRouter } from "./email-provider-ingress";
import { emailProviderIngressOpsRouter } from "./email-provider-ingress-ops";
import {
  acknowledgeNotificationWebhookIncidentBatchByOperator,
  acknowledgeNotificationWebhookIncidentByOperator,
  clearNotificationWebhookIncidentSilenceBatchByOperator,
  clearNotificationWebhookIncidentSilenceByOperator,
  listNotificationWebhookIncidents,
  silenceNotificationWebhookIncidentBatchByOperator,
  silenceNotificationWebhookIncidentByOperator,
} from "./notification-webhook-incidents";
import {
  createNotificationWebhookIncidentSavedViewAsOperator,
  deleteNotificationWebhookIncidentSavedViewAsOperator,
  getDefaultNotificationWebhookIncidentSavedViewForOperator,
  listNotificationWebhookIncidentSavedViewsForOperator,
  setDefaultNotificationWebhookIncidentSavedViewAsOperator,
  updateNotificationWebhookIncidentSavedViewAsOperator,
} from "./notification-webhook-views";

function parseNotificationWebhookIncidentGovernanceState(
  value: string | undefined,
): NotificationWebhookIncidentGovernanceState | undefined {
  return value === "active" || value === "acknowledged" || value === "silenced" ? value : undefined;
}

function parseNotificationWebhookIncidentSavedViewFocusSection(
  value: unknown,
): NotificationWebhookIncidentSavedViewFocusSection | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return notificationWebhookIncidentSavedViewFocusSections.includes(
    value as NotificationWebhookIncidentSavedViewFocusSection,
  )
    ? (value as NotificationWebhookIncidentSavedViewFocusSection)
    : undefined;
}

function readNotificationWebhookIncidentFiltersInput(input: Record<string, unknown>) {
  const readText = (key: string) => {
    const value = input[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };
  const rawAlertLevel = Number(input.alertLevel);
  return {
    agentId: readText("agentId"),
    callbackType: readText("callbackType"),
    policyKey: readText("policyKey"),
    reasonCategory: readText("reasonCategory"),
    reasonDisposition: readText("reasonDisposition"),
    projectId: readText("projectId"),
    incidentId: readText("incidentId"),
    routePolicyId: readText("routePolicyId"),
    snapshotId: readText("snapshotId"),
    alertLevel: Number.isFinite(rawAlertLevel) && rawAlertLevel > 0 ? Math.floor(rawAlertLevel) : undefined,
    governanceState: parseNotificationWebhookIncidentGovernanceState(readText("governanceState")),
  };
}

function readNotificationWebhookIncidentFilters(input: Record<string, string | undefined>) {
  return readNotificationWebhookIncidentFiltersInput(input);
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart, {
    limits: {
      fields: 128,
      files: 16,
      fileSize: 25 * 1024 * 1024,
      fieldNameSize: 128,
      fieldSize: 1024 * 1024,
      parts: 160,
    },
  });

  await ensureFeatureModules();
  await ensureAnnouncementCatalogSeeded();
  await ensureBenefitCatalogSeeded();
  await ensurePersonalMissionCatalogSeeded();
  await ensureHonorProjectCatalogSeeded();

  app.get("/health", async () => {
    return {
      ok: true,
      service: "account-api",
      databaseMode: accountEnv.usesDedicatedDatabase ? "account" : "shared",
      redisMode: accountEnv.usesDedicatedRedis ? "account" : "shared",
    };
  });

  app.get("/ready", async () => {
    await db.execute(sql`select 1`);
    await redis.ping();
    return {
      ok: true,
      ready: true,
      service: "account-api",
      databaseMode: accountEnv.usesDedicatedDatabase ? "account" : "shared",
      redisMode: accountEnv.usesDedicatedRedis ? "account" : "shared",
    };
  });

  await app.register(identityRouter);
  await app.register(emailProviderIngressRouter);
  await app.register(emailProviderIngressOpsRouter);
  await app.register(emailNativeRouter);
  await app.register(walletLedgerRouter);
  await app.register(reputationRouter);
  await app.register(personalMissionsRouter);
  await app.register(honorProjectsRouter);
  await app.register(benefitsRouter);
  await app.register(credentialPoolsRouter);
  await app.register(mailboxRouter);
  await app.register(agentExecutionRouter);
  await app.register(announcementsRouter);
  await app.register(productShadowRouter);

  app.get(
    "/v1/internal/notification-webhooks/catalog",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect notification webhook routes");
      }

      return {
        catalog: buildNotificationWebhookCatalogFromEnv(),
      };
    },
  );

  app.get(
    "/v1/internal/notification-webhooks/incidents/views",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect notification webhook incident saved views");
      }
      const query = request.query as Record<string, string | undefined>;
      const rawLimit = Number(query.limit || 20);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 50));
      return {
        views: await listNotificationWebhookIncidentSavedViewsForOperator(userId, { limit }),
      };
    },
  );

  app.get(
    "/v1/internal/notification-webhooks/incidents/views/default",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect the default notification webhook incident saved view");
      }
      return {
        view: await getDefaultNotificationWebhookIncidentSavedViewForOperator(userId),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/views",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can create notification webhook incident saved views");
      }
      const body = (request.body ?? {}) as {
        name?: unknown;
        description?: unknown;
        isDefault?: unknown;
        filters?: Record<string, unknown>;
        playbookDefaults?: Record<string, unknown>;
      };
      const filters = readNotificationWebhookIncidentFiltersInput(body.filters ?? {});
      return {
        view: await createNotificationWebhookIncidentSavedViewAsOperator(userId, {
          name: typeof body.name === "string" ? body.name : "",
          description: typeof body.description === "string" ? body.description : null,
          isDefault: body.isDefault === true,
          filters: {
            agentId: filters.agentId ?? null,
            callbackType: filters.callbackType ?? null,
            policyKey: filters.policyKey ?? null,
            reasonCategory: filters.reasonCategory ?? null,
            reasonDisposition: filters.reasonDisposition ?? null,
            projectId: filters.projectId ?? null,
            incidentId: filters.incidentId ?? null,
            routePolicyId: filters.routePolicyId ?? null,
            snapshotId: filters.snapshotId ?? null,
            alertLevel: filters.alertLevel ?? null,
            governanceState: filters.governanceState ?? null,
          },
          playbookDefaults: {
            batchLimit:
              typeof body.playbookDefaults?.batchLimit === "number" || typeof body.playbookDefaults?.batchLimit === "string"
                ? Number(body.playbookDefaults?.batchLimit)
                : undefined,
            silenceDurationMinutes:
              typeof body.playbookDefaults?.silenceDurationMinutes === "number" ||
              typeof body.playbookDefaults?.silenceDurationMinutes === "string"
                ? Number(body.playbookDefaults?.silenceDurationMinutes)
                : undefined,
            preferredAction:
              body.playbookDefaults?.preferredAction === "acknowledge" ||
              body.playbookDefaults?.preferredAction === "silence" ||
              body.playbookDefaults?.preferredAction === "clear_silence"
                ? body.playbookDefaults.preferredAction
                : undefined,
            silenceReasonTemplate:
              typeof body.playbookDefaults?.silenceReasonTemplate === "string"
                ? body.playbookDefaults.silenceReasonTemplate
                : undefined,
            operatorGuidance:
              typeof body.playbookDefaults?.operatorGuidance === "string"
                ? body.playbookDefaults.operatorGuidance
                : undefined,
            followUpIncidentState:
              body.playbookDefaults?.followUpIncidentState === "active" ||
              body.playbookDefaults?.followUpIncidentState === "acknowledged" ||
              body.playbookDefaults?.followUpIncidentState === "silenced"
                ? body.playbookDefaults.followUpIncidentState
                : undefined,
            focusSection: parseNotificationWebhookIncidentSavedViewFocusSection(
              body.playbookDefaults?.focusSection,
            ),
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/views/:viewId/default",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can set the default notification webhook incident saved view");
      }
      const viewId = String((request.params as { viewId?: string }).viewId || "").trim();
      if (!viewId) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident saved view id");
      }
      return {
        view: await setDefaultNotificationWebhookIncidentSavedViewAsOperator(userId, viewId),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/views/:viewId",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can update notification webhook incident saved views");
      }
      const viewId = String((request.params as { viewId?: string }).viewId || "").trim();
      if (!viewId) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident saved view id");
      }
      const body = (request.body ?? {}) as {
        name?: unknown;
        description?: unknown;
        isDefault?: unknown;
        filters?: Record<string, unknown>;
        playbookDefaults?: Record<string, unknown>;
      };
      const filters = readNotificationWebhookIncidentFiltersInput(body.filters ?? {});
      return {
        view: await updateNotificationWebhookIncidentSavedViewAsOperator(userId, viewId, {
          name: typeof body.name === "string" ? body.name : "",
          description: typeof body.description === "string" ? body.description : null,
          isDefault: body.isDefault === true,
          filters: {
            agentId: filters.agentId ?? null,
            callbackType: filters.callbackType ?? null,
            policyKey: filters.policyKey ?? null,
            reasonCategory: filters.reasonCategory ?? null,
            reasonDisposition: filters.reasonDisposition ?? null,
            projectId: filters.projectId ?? null,
            incidentId: filters.incidentId ?? null,
            routePolicyId: filters.routePolicyId ?? null,
            snapshotId: filters.snapshotId ?? null,
            alertLevel: filters.alertLevel ?? null,
            governanceState: filters.governanceState ?? null,
          },
          playbookDefaults: {
            batchLimit:
              typeof body.playbookDefaults?.batchLimit === "number" || typeof body.playbookDefaults?.batchLimit === "string"
                ? Number(body.playbookDefaults?.batchLimit)
                : undefined,
            silenceDurationMinutes:
              typeof body.playbookDefaults?.silenceDurationMinutes === "number" ||
              typeof body.playbookDefaults?.silenceDurationMinutes === "string"
                ? Number(body.playbookDefaults?.silenceDurationMinutes)
                : undefined,
            preferredAction:
              body.playbookDefaults?.preferredAction === "acknowledge" ||
              body.playbookDefaults?.preferredAction === "silence" ||
              body.playbookDefaults?.preferredAction === "clear_silence"
                ? body.playbookDefaults.preferredAction
                : undefined,
            silenceReasonTemplate:
              typeof body.playbookDefaults?.silenceReasonTemplate === "string"
                ? body.playbookDefaults.silenceReasonTemplate
                : undefined,
            operatorGuidance:
              typeof body.playbookDefaults?.operatorGuidance === "string"
                ? body.playbookDefaults.operatorGuidance
                : undefined,
            followUpIncidentState:
              body.playbookDefaults?.followUpIncidentState === "active" ||
              body.playbookDefaults?.followUpIncidentState === "acknowledged" ||
              body.playbookDefaults?.followUpIncidentState === "silenced"
                ? body.playbookDefaults.followUpIncidentState
                : undefined,
            focusSection: parseNotificationWebhookIncidentSavedViewFocusSection(
              body.playbookDefaults?.focusSection,
            ),
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/views/:viewId/delete",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can delete notification webhook incident saved views");
      }
      const viewId = String((request.params as { viewId?: string }).viewId || "").trim();
      if (!viewId) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident saved view id");
      }
      await deleteNotificationWebhookIncidentSavedViewAsOperator(userId, viewId);
      return { ok: true as const };
    },
  );

  app.get(
    "/v1/internal/notification-webhooks/incidents",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect notification webhook incidents");
      }

      const query = request.query as Record<string, string | undefined>;
      const rawLimit = Number(query.limit || 20);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 100));
      const rawHistoryLimit = Number(query.historyLimit || 6);
      const historyLimit = Math.max(1, Math.min(Number.isFinite(rawHistoryLimit) ? Math.floor(rawHistoryLimit) : 6, 20));

      return {
        incidents: await listNotificationWebhookIncidents({
          limit,
          historyLimit,
          ...readNotificationWebhookIncidentFilters(query),
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/acknowledge-batch",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can acknowledge notification webhook incidents in batch");
      }

      const body = (request.body ?? {}) as Record<string, string | undefined>;
      const rawLimit = Number(body.limit ?? 10);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
      return {
        result: await acknowledgeNotificationWebhookIncidentBatchByOperator({
          limit,
          userId,
          at: new Date(),
          ...readNotificationWebhookIncidentFilters(body),
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/silence-batch",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can silence notification webhook incidents in batch");
      }

      const body = (request.body ?? {}) as Record<string, string | undefined>;
      const rawLimit = Number(body.limit ?? 10);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
      const rawDuration = Number(body.durationMinutes ?? 60);
      const durationMinutes = Math.max(1, Math.min(Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 60, 24 * 60));
      const now = new Date();
      return {
        result: await silenceNotificationWebhookIncidentBatchByOperator({
          limit,
          userId,
          at: now,
          until: new Date(now.getTime() + durationMinutes * 60 * 1000),
          reason: typeof body.reason === "string" ? body.reason : undefined,
          ...readNotificationWebhookIncidentFilters(body),
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/clear-silence-batch",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can clear notification webhook incidents in batch");
      }

      const body = (request.body ?? {}) as Record<string, string | undefined>;
      const rawLimit = Number(body.limit ?? 10);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 10, 50));
      return {
        result: await clearNotificationWebhookIncidentSilenceBatchByOperator({
          limit,
          userId,
          at: new Date(),
          ...readNotificationWebhookIncidentFilters(body),
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/:incidentKey/acknowledge",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can acknowledge notification webhook incidents");
      }

      const incidentKey = decodeURIComponent(String((request.params as { incidentKey?: string }).incidentKey || ""));
      if (!parseNotificationWebhookIncidentKey(incidentKey)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident key");
      }

      return {
        result: await acknowledgeNotificationWebhookIncidentByOperator({
          incidentKey,
          userId,
          at: new Date(),
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/:incidentKey/silence",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can silence notification webhook incidents");
      }

      const incidentKey = decodeURIComponent(String((request.params as { incidentKey?: string }).incidentKey || ""));
      if (!parseNotificationWebhookIncidentKey(incidentKey)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident key");
      }

      const body = (request.body ?? {}) as { durationMinutes?: number | string; reason?: string };
      const rawDuration = Number(body.durationMinutes ?? 60);
      const durationMinutes = Math.max(1, Math.min(Number.isFinite(rawDuration) ? Math.floor(rawDuration) : 60, 24 * 60));
      const now = new Date();

      return {
        result: await silenceNotificationWebhookIncidentByOperator({
          incidentKey,
          userId,
          at: now,
          until: new Date(now.getTime() + durationMinutes * 60 * 1000),
          reason: typeof body.reason === "string" ? body.reason : undefined,
        }),
      };
    },
  );

  app.post(
    "/v1/internal/notification-webhooks/incidents/:incidentKey/clear-silence",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can clear notification webhook incident silence");
      }

      const incidentKey = decodeURIComponent(String((request.params as { incidentKey?: string }).incidentKey || ""));
      if (!parseNotificationWebhookIncidentKey(incidentKey)) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid notification webhook incident key");
      }

      return {
        result: await clearNotificationWebhookIncidentSilenceByOperator({
          incidentKey,
          at: new Date(),
          userId,
        }),
      };
    },
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          moduleKey: error.moduleKey,
        },
      });
    }

    const unexpected = error as Error;
    app.log.error(unexpected);
    return reply.status(500).send({
      error: {
        code: "BAD_REQUEST",
        message: unexpected.message || "Unexpected error",
      },
    });
  });

  return app;
}

export { env };
