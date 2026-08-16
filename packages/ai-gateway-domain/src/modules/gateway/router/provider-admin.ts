import type { FastifyInstance } from "fastify";

import {
  listGatewayProviderHealthForOperator,
  getGatewayProviderHealthSummaryForOperator,
  getGatewayReadinessReport,
  listGatewayRuntimePressureForOperator,
  probeGatewayProviderAccountForOperator,
  runGatewayCoolingSweepForOperator,
  createGatewayProviderAccountForOperator,
  updateGatewayProviderAccountForOperator,
  patchGatewayProviderSourceProfileForOperator,
  backfillGatewayProviderSourceProfilesForOperator,
  saveGatewayModelAliasForOperator,
  saveGatewayRoutePolicyForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  providerAccountBodySchema,
  providerSourceProfilePatchBodySchema,
  providerSourceProfileBackfillBodySchema,
  modelAliasBodySchema,
  routePolicyBodySchema,
  readQueryString,
} from "./shared";

export function registerProviderAdminRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/provider-health", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      providerHealth: await listGatewayProviderHealthForOperator(userId, providerUserId, {
        providerAccountId: readQueryString(query, "providerAccountId"),
        protocolFamily: readQueryString(query, "protocolFamily") as any,
        status: readQueryString(query, "status"),
      }),
      summary: await getGatewayProviderHealthSummaryForOperator(userId, providerUserId, {
        providerAccountId: readQueryString(query, "providerAccountId"),
        protocolFamily: readQueryString(query, "protocolFamily") as any,
        status: readQueryString(query, "status"),
      }),
    };
  });

  app.get("/v1/internal/gateway/readiness", { preHandler: withInternalRequest }, async (_request) => ({
    readiness: await getGatewayReadinessReport(),
  }));

  app.get("/v1/internal/gateway/pressure", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    const rawLimit = Number(query.limit ?? 100);
    return {
      pressure: await listGatewayRuntimePressureForOperator(userId, providerUserId, {
        projectId: readQueryString(query, "projectId"),
        providerAccountId: readQueryString(query, "providerAccountId"),
        limit: Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100,
      }),
    };
  });

  app.post(
    "/v1/internal/gateway/provider-accounts/:providerAccountId/probe",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const providerAccountId =
        typeof (request.params as Record<string, unknown>).providerAccountId === "string"
          ? String((request.params as Record<string, unknown>).providerAccountId).trim()
          : "";
      return {
        result: await probeGatewayProviderAccountForOperator(userId, providerUserId, providerAccountId),
      };
    },
  );

  app.post("/v1/internal/gateway/provider-accounts/sweep-cooling", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return await runGatewayCoolingSweepForOperator(userId, providerUserId);
  });

  app.post("/v1/internal/gateway/provider-accounts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = providerAccountBodySchema.parse(request.body ?? {});
    return {
      providerAccount: await createGatewayProviderAccountForOperator(userId, providerUserId, {
        ...body,
        payload: body.payload as any,
      }),
    };
  });

  app.post("/v1/internal/gateway/provider-accounts/:providerAccountId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const providerAccountId =
      typeof (request.params as Record<string, unknown>).providerAccountId === "string"
        ? String((request.params as Record<string, unknown>).providerAccountId).trim()
        : "";
    const body = providerAccountBodySchema.parse(request.body ?? {});
    return {
      providerAccount: await updateGatewayProviderAccountForOperator(userId, providerUserId, providerAccountId, {
        ...body,
        payload: body.payload as any,
      }),
    };
  });

  app.post(
    "/v1/internal/gateway/provider-accounts/:providerAccountId/source-profile",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const providerAccountId =
        typeof (request.params as Record<string, unknown>).providerAccountId === "string"
          ? String((request.params as Record<string, unknown>).providerAccountId).trim()
          : "";
      const body = providerSourceProfilePatchBodySchema.parse(request.body ?? {});
      return {
        providerAccount: await patchGatewayProviderSourceProfileForOperator(
          userId,
          providerUserId,
          providerAccountId,
          body,
        ),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/provider-accounts/source-profile/backfill",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = providerSourceProfileBackfillBodySchema.parse(request.body ?? {});
      return {
        result: await backfillGatewayProviderSourceProfilesForOperator(userId, providerUserId, body),
      };
    },
  );

  app.post("/v1/internal/gateway/model-aliases", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = modelAliasBodySchema.parse(request.body ?? {});
    return {
      modelAlias: await saveGatewayModelAliasForOperator(userId, providerUserId, null, body),
    };
  });

  app.post("/v1/internal/gateway/model-aliases/:aliasId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const aliasId =
      typeof (request.params as Record<string, unknown>).aliasId === "string"
        ? String((request.params as Record<string, unknown>).aliasId).trim()
        : "";
    const body = modelAliasBodySchema.parse(request.body ?? {});
    return {
      modelAlias: await saveGatewayModelAliasForOperator(userId, providerUserId, aliasId, body),
    };
  });

  app.post("/v1/internal/gateway/route-policies", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = routePolicyBodySchema.parse(request.body ?? {});
    return {
      routePolicy: await saveGatewayRoutePolicyForOperator(userId, providerUserId, null, {
        ...body,
        config: {
          stickySessions: body.config.stickySessions ?? true,
          preStreamFallbackEnabled: body.config.preStreamFallbackEnabled ?? true,
          selectionStrategy: body.config.selectionStrategy ?? "weighted_random",
          providerLoadAwareRoutingEnabled: body.config.providerLoadAwareRoutingEnabled ?? true,
          maxConcurrentRequests: body.config.maxConcurrentRequests ?? null,
          providerMaxConcurrentRequests: body.config.providerMaxConcurrentRequests ?? null,
          rateLimitWindowSeconds: body.config.rateLimitWindowSeconds ?? null,
          rateLimitMaxRequests: body.config.rateLimitMaxRequests ?? null,
          apiKeyRateLimit: body.config.apiKeyRateLimit ?? null,
          modelRateLimits: body.config.modelRateLimits ?? null,
          endpointRateLimits: body.config.endpointRateLimits ?? null,
          circuitBreakerThreshold: body.config.circuitBreakerThreshold ?? 3,
          circuitBreakerCooldownSeconds: body.config.circuitBreakerCooldownSeconds ?? 60,
          allowedProviderAccountIds: body.config.allowedProviderAccountIds ?? null,
          allowedProtocolFamilies: body.config.allowedProtocolFamilies ?? null,
          allowedModelIds: body.config.allowedModelIds ?? null,
          blockedModelIds: body.config.blockedModelIds ?? null,
          maxRequestBodyBytes: body.config.maxRequestBodyBytes ?? null,
          streamIdleTimeoutSeconds: body.config.streamIdleTimeoutSeconds ?? null,
          totalRequestTimeoutSeconds: body.config.totalRequestTimeoutSeconds ?? null,
          maxStreamHeartbeatGapSeconds: body.config.maxStreamHeartbeatGapSeconds ?? null,
          routingAnomalyAutoRemediation: body.config.routingAnomalyAutoRemediation
            ? {
                enabled: body.config.routingAnomalyAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.routingAnomalyAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.routingAnomalyAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.routingAnomalyAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.routingAnomalyAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.routingAnomalyAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionKeysByCode: body.config.routingAnomalyAutoRemediation.actionKeysByCode ?? null,
              }
            : null,
          rateLimitHotspotAutoRemediation: body.config.rateLimitHotspotAutoRemediation
            ? {
                enabled: body.config.rateLimitHotspotAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.rateLimitHotspotAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.rateLimitHotspotAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.rateLimitHotspotAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.rateLimitHotspotAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.rateLimitHotspotAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionByCode: body.config.rateLimitHotspotAutoRemediation.actionByCode ?? null,
              }
            : null,
          fallbackHttpStatuses: body.config.fallbackHttpStatuses ?? null,
          fallbackErrorCodes: body.config.fallbackErrorCodes ?? null,
        },
      }),
    };
  });

  app.post("/v1/internal/gateway/route-policies/:policyId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const policyId =
      typeof (request.params as Record<string, unknown>).policyId === "string"
        ? String((request.params as Record<string, unknown>).policyId).trim()
        : "";
    const body = routePolicyBodySchema.parse(request.body ?? {});
    return {
      routePolicy: await saveGatewayRoutePolicyForOperator(userId, providerUserId, policyId, {
        ...body,
        config: {
          stickySessions: body.config.stickySessions ?? true,
          preStreamFallbackEnabled: body.config.preStreamFallbackEnabled ?? true,
          selectionStrategy: body.config.selectionStrategy ?? "weighted_random",
          providerLoadAwareRoutingEnabled: body.config.providerLoadAwareRoutingEnabled ?? true,
          maxConcurrentRequests: body.config.maxConcurrentRequests ?? null,
          providerMaxConcurrentRequests: body.config.providerMaxConcurrentRequests ?? null,
          rateLimitWindowSeconds: body.config.rateLimitWindowSeconds ?? null,
          rateLimitMaxRequests: body.config.rateLimitMaxRequests ?? null,
          apiKeyRateLimit: body.config.apiKeyRateLimit ?? null,
          modelRateLimits: body.config.modelRateLimits ?? null,
          endpointRateLimits: body.config.endpointRateLimits ?? null,
          circuitBreakerThreshold: body.config.circuitBreakerThreshold ?? 3,
          circuitBreakerCooldownSeconds: body.config.circuitBreakerCooldownSeconds ?? 60,
          allowedProviderAccountIds: body.config.allowedProviderAccountIds ?? null,
          allowedProtocolFamilies: body.config.allowedProtocolFamilies ?? null,
          allowedModelIds: body.config.allowedModelIds ?? null,
          blockedModelIds: body.config.blockedModelIds ?? null,
          maxRequestBodyBytes: body.config.maxRequestBodyBytes ?? null,
          streamIdleTimeoutSeconds: body.config.streamIdleTimeoutSeconds ?? null,
          totalRequestTimeoutSeconds: body.config.totalRequestTimeoutSeconds ?? null,
          maxStreamHeartbeatGapSeconds: body.config.maxStreamHeartbeatGapSeconds ?? null,
          routingAnomalyAutoRemediation: body.config.routingAnomalyAutoRemediation
            ? {
                enabled: body.config.routingAnomalyAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.routingAnomalyAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.routingAnomalyAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.routingAnomalyAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.routingAnomalyAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.routingAnomalyAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionKeysByCode: body.config.routingAnomalyAutoRemediation.actionKeysByCode ?? null,
              }
            : null,
          rateLimitHotspotAutoRemediation: body.config.rateLimitHotspotAutoRemediation
            ? {
                enabled: body.config.rateLimitHotspotAutoRemediation.enabled ?? true,
                intervalMinutes: body.config.rateLimitHotspotAutoRemediation.intervalMinutes ?? null,
                dryRunFirst: body.config.rateLimitHotspotAutoRemediation.dryRunFirst ?? true,
                requireAlertBeforeApply:
                  body.config.rateLimitHotspotAutoRemediation.requireAlertBeforeApply ?? true,
                freezeOnProviderHealthDegrade:
                  body.config.rateLimitHotspotAutoRemediation.freezeOnProviderHealthDegrade ?? true,
                maxApplyRunsPerIncident:
                  body.config.rateLimitHotspotAutoRemediation.maxApplyRunsPerIncident ?? null,
                actionByCode: body.config.rateLimitHotspotAutoRemediation.actionByCode ?? null,
              }
            : null,
          fallbackHttpStatuses: body.config.fallbackHttpStatuses ?? null,
          fallbackErrorCodes: body.config.fallbackErrorCodes ?? null,
        },
      }),
    };
  });
}
