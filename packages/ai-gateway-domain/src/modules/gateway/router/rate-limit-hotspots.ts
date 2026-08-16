import type { FastifyInstance } from "fastify";

import {
  summarizeGatewayRateLimitHotspotsForOperator,
  getGatewayRateLimitHotspotTrendReportForOperator,
  getGatewayRateLimitHotspotAnomalyReportForOperator,
  persistGatewayRateLimitHotspotSnapshotForOperator,
  listGatewayRateLimitHotspotSnapshotsForOperator,
  getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator,
  getGatewayRateLimitHotspotSnapshotTrendReportForOperator,
  getGatewayRateLimitHotspotSnapshotForOperator,
  persistGatewayRateLimitHotspotAnomalySnapshotForOperator,
  listGatewayRateLimitHotspotAnomalySnapshotsForOperator,
  getGatewayRateLimitHotspotAnomalySnapshotForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  rateLimitHotspotSnapshotBodySchema,
  rateLimitHotspotAnomalySnapshotBodySchema,
  readGatewayRequestAuditFilters,
  readQueryInt,
  readQueryLimit,
  readQueryNumber,
  readQueryString,
} from "./shared";

export function registerRateLimitHotspotRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/rate-limit-hotspots", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      hotspots: await summarizeGatewayRateLimitHotspotsForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 1000),
      ),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotTrendReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          windowSize: readQueryInt(query, "windowSize"),
          bucketSizeMinutes: readQueryInt(query, "bucketSizeMinutes"),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotAnomalyReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          windowSize: readQueryInt(query, "windowSize"),
          bucketSizeMinutes: readQueryInt(query, "bucketSizeMinutes"),
          profileKey: readQueryString(query, "profileKey") as any,
          thresholds: {
            totalRateLimitedRequestsWarningThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsWarningThreshold") ?? undefined,
            totalRateLimitedRequestsCriticalThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsCriticalThreshold") ?? undefined,
            totalRateLimitedRequestsDeltaRatioThreshold:
              readQueryNumber(query, "totalRateLimitedRequestsDeltaRatioThreshold") ?? undefined,
            topCodeShareWarningThreshold: readQueryNumber(query, "topCodeShareWarningThreshold") ?? undefined,
            topCodeShareCriticalThreshold: readQueryNumber(query, "topCodeShareCriticalThreshold") ?? undefined,
            topProjectShareWarningThreshold: readQueryNumber(query, "topProjectShareWarningThreshold") ?? undefined,
            topProjectShareCriticalThreshold: readQueryNumber(query, "topProjectShareCriticalThreshold") ?? undefined,
            topApiKeyShareWarningThreshold: readQueryNumber(query, "topApiKeyShareWarningThreshold") ?? undefined,
            topApiKeyShareCriticalThreshold: readQueryNumber(query, "topApiKeyShareCriticalThreshold") ?? undefined,
            topRequestedModelShareWarningThreshold:
              readQueryNumber(query, "topRequestedModelShareWarningThreshold") ?? undefined,
            topRequestedModelShareCriticalThreshold:
              readQueryNumber(query, "topRequestedModelShareCriticalThreshold") ?? undefined,
            topEndpointShareWarningThreshold: readQueryNumber(query, "topEndpointShareWarningThreshold") ?? undefined,
            topEndpointShareCriticalThreshold: readQueryNumber(query, "topEndpointShareCriticalThreshold") ?? undefined,
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshot",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = rateLimitHotspotSnapshotBodySchema.parse(request.body ?? {});
      return {
        snapshot: await persistGatewayRateLimitHotspotSnapshotForOperator(userId, providerUserId, {
          ...body,
          limit: body.limit ?? undefined,
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        snapshots: await listGatewayRateLimitHotspotSnapshotsForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        summary: await getGatewayRateLimitHotspotSnapshotInventorySummaryForOperator(userId, providerUserId, {
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 500),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayRateLimitHotspotSnapshotTrendReportForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 10),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/snapshots/:snapshotId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const params = request.params as Record<string, unknown>;
      return {
        snapshot: await getGatewayRateLimitHotspotSnapshotForOperator(
          userId,
          providerUserId,
          typeof params.snapshotId === "string" ? params.snapshotId : null,
        ),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshot",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = rateLimitHotspotAnomalySnapshotBodySchema.parse(request.body ?? {});
      return {
        snapshot: await persistGatewayRateLimitHotspotAnomalySnapshotForOperator(userId, providerUserId, {
          ...body,
          limit: body.limit ?? undefined,
          thresholds: {
            totalRateLimitedRequestsWarningThreshold: body.totalRateLimitedRequestsWarningThreshold ?? undefined,
            totalRateLimitedRequestsCriticalThreshold: body.totalRateLimitedRequestsCriticalThreshold ?? undefined,
            totalRateLimitedRequestsDeltaRatioThreshold: body.totalRateLimitedRequestsDeltaRatioThreshold ?? undefined,
            topCodeShareWarningThreshold: body.topCodeShareWarningThreshold ?? undefined,
            topCodeShareCriticalThreshold: body.topCodeShareCriticalThreshold ?? undefined,
            topProjectShareWarningThreshold: body.topProjectShareWarningThreshold ?? undefined,
            topProjectShareCriticalThreshold: body.topProjectShareCriticalThreshold ?? undefined,
            topApiKeyShareWarningThreshold: body.topApiKeyShareWarningThreshold ?? undefined,
            topApiKeyShareCriticalThreshold: body.topApiKeyShareCriticalThreshold ?? undefined,
            topRequestedModelShareWarningThreshold: body.topRequestedModelShareWarningThreshold ?? undefined,
            topRequestedModelShareCriticalThreshold: body.topRequestedModelShareCriticalThreshold ?? undefined,
            topEndpointShareWarningThreshold: body.topEndpointShareWarningThreshold ?? undefined,
            topEndpointShareCriticalThreshold: body.topEndpointShareCriticalThreshold ?? undefined,
          },
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshots",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        snapshots: await listGatewayRateLimitHotspotAnomalySnapshotsForOperator(userId, providerUserId, {
          snapshotId: readQueryString(query, "snapshotId"),
          label: readQueryString(query, "label"),
          projectId: readQueryString(query, "projectId"),
          routePolicyId: readQueryString(query, "routePolicyId"),
          apiKeyId: readQueryString(query, "apiKeyId"),
          endpointKind: readQueryString(query, "endpointKind"),
          profileKey: readQueryString(query, "profileKey") as any,
          createdFrom: readQueryString(query, "createdFrom"),
          createdTo: readQueryString(query, "createdTo"),
          limit: readQueryLimit(query, 100),
        }),
      };
    },
  );

  app.get(
    "/v1/internal/gateway/analysis/rate-limit-hotspots/anomaly-snapshots/:snapshotId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const params = request.params as Record<string, unknown>;
      return {
        snapshot: await getGatewayRateLimitHotspotAnomalySnapshotForOperator(
          userId,
          providerUserId,
          typeof params.snapshotId === "string" ? params.snapshotId : null,
        ),
      };
    },
  );
}
