import type { FastifyInstance } from "fastify";

import {
  listGatewayAnalysisSamplesForOperator,
  getGatewayAnalysisSummaryForOperator,
  getGatewayProviderRoutingAnalysisSummaryForOperator,
  getGatewayProviderRoutingAnalysisAnomalyReportForOperator,
  syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  providerRoutingAnomalySyncBodySchema,
  readGatewayRequestAuditFilters,
  readQueryBoolean,
  readQueryNumber,
  readQueryString,
} from "./shared";

export function registerAnalysisSummaryRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/samples", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      samples: await listGatewayAnalysisSamplesForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 200),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
        artifactAvailable: readQueryBoolean(query, "artifactAvailable"),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/provider-routing/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayProviderRoutingAnalysisSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
      }),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/provider-routing/anomaly-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayProviderRoutingAnalysisAnomalyReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          profileKey: readQueryString(query, "profileKey") as any,
          thresholds: {
            routingScoreWarningThreshold: readQueryNumber(query, "routingScoreWarningThreshold") ?? undefined,
            routingScoreCriticalThreshold: readQueryNumber(query, "routingScoreCriticalThreshold") ?? undefined,
            degradedRouteWarningThreshold: readQueryNumber(query, "degradedRouteWarningThreshold") ?? undefined,
            degradedRouteCriticalThreshold: readQueryNumber(query, "degradedRouteCriticalThreshold") ?? undefined,
            saturatedRouteWarningThreshold: readQueryNumber(query, "saturatedRouteWarningThreshold") ?? undefined,
            saturatedRouteCriticalThreshold: readQueryNumber(query, "saturatedRouteCriticalThreshold") ?? undefined,
            breakerOpenRouteWarningThreshold: readQueryNumber(query, "breakerOpenRouteWarningThreshold") ?? undefined,
            breakerOpenRouteCriticalThreshold: readQueryNumber(query, "breakerOpenRouteCriticalThreshold") ?? undefined,
          },
        }),
      };
    },
  );

  app.post(
    "/v1/internal/gateway/analysis/provider-routing/anomaly-incidents/sync",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const body = providerRoutingAnomalySyncBodySchema.parse(request.body ?? {});
      return {
        sync: await syncGatewayProviderRoutingAnalysisAnomalyIncidentsForOperator(userId, providerUserId, {
          projectId: body.projectId ?? undefined,
          routePolicyId: body.routePolicyId ?? undefined,
          providerAccountId: body.providerAccountId ?? undefined,
          sessionId: body.sessionId ?? undefined,
          apiKeyId: body.apiKeyId ?? undefined,
          responseId: body.responseId ?? undefined,
          protocolFamily: body.protocolFamily ?? undefined,
          endpointKind: body.endpointKind ?? undefined,
          status: body.status ?? undefined,
          createdFrom: body.createdFrom ?? undefined,
          createdTo: body.createdTo ?? undefined,
          limit: body.limit ?? undefined,
          profileKey: body.profileKey ?? undefined,
          thresholds: {
            routingScoreWarningThreshold: body.routingScoreWarningThreshold ?? undefined,
            routingScoreCriticalThreshold: body.routingScoreCriticalThreshold ?? undefined,
            degradedRouteWarningThreshold: body.degradedRouteWarningThreshold ?? undefined,
            degradedRouteCriticalThreshold: body.degradedRouteCriticalThreshold ?? undefined,
            saturatedRouteWarningThreshold: body.saturatedRouteWarningThreshold ?? undefined,
            saturatedRouteCriticalThreshold: body.saturatedRouteCriticalThreshold ?? undefined,
            breakerOpenRouteWarningThreshold: body.breakerOpenRouteWarningThreshold ?? undefined,
            breakerOpenRouteCriticalThreshold: body.breakerOpenRouteCriticalThreshold ?? undefined,
          },
        }),
      };
    },
  );
}
