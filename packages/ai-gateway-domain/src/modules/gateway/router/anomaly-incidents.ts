import type { FastifyInstance } from "fastify";

import {
  listGatewayAnalysisAnomalyIncidentsForOperator,
  getGatewayAnalysisAnomalyIncidentSummaryForOperator,
  listGatewayAnalysisAnomalyIncidentAlertQueueForOperator,
  listGatewayAnalysisAnomalyIncidentHistoryForOperator,
  syncGatewayAnalysisAnomalyIncidentsForOperator,
  acknowledgeGatewayAnalysisAnomalyIncidentForOperator,
  resolveGatewayAnalysisAnomalyIncidentForOperator,
  updateGatewayAnalysisAnomalyIncidentFollowUpForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  anomalyIncidentSyncBodySchema,
  anomalyIncidentFollowUpBodySchema,
  readQueryBoolean,
  readQueryLimit,
  readQueryString,
} from "./shared";

export function registerAnomalyIncidentRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/anomaly-incidents", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      incidents: await listGatewayAnalysisAnomalyIncidentsForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        limit: readQueryLimit(query, 100),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayAnalysisAnomalyIncidentSummaryForOperator(userId, providerUserId, {
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/alert-queue", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      queue: await listGatewayAnalysisAnomalyIncidentAlertQueueForOperator(userId, providerUserId, {
        incidentId: readQueryString(query, "incidentId"),
        policyId: readQueryString(query, "policyId"),
        projectId: readQueryString(query, "projectId"),
        ownerUserId: readQueryString(query, "ownerUserId"),
        tag: readQueryString(query, "tag"),
        textMode: readQueryString(query, "textMode") as any,
        status: readQueryString(query, "status"),
        followUpStatus: readQueryString(query, "followUpStatus"),
        escalationStatus: readQueryString(query, "escalationStatus"),
        code: readQueryString(query, "code"),
        severity: readQueryString(query, "severity"),
        dueOnly: readQueryBoolean(query, "dueOnly"),
        limit: readQueryLimit(query, 50),
      }),
    };
  });

  app.get("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/history", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const query = request.query as Record<string, unknown>;
    return {
      history: await listGatewayAnalysisAnomalyIncidentHistoryForOperator(userId, providerUserId, {
        incidentId,
        limit: readQueryLimit(query, 200),
      }),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/sync", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const body = anomalyIncidentSyncBodySchema.parse(request.body ?? {});
    return {
      sync: await syncGatewayAnalysisAnomalyIncidentsForOperator(userId, providerUserId, body),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/acknowledge", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      incident: await acknowledgeGatewayAnalysisAnomalyIncidentForOperator(userId, providerUserId, incidentId),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/resolve", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    return {
      incident: await resolveGatewayAnalysisAnomalyIncidentForOperator(userId, providerUserId, incidentId),
    };
  });

  app.post("/v1/internal/gateway/analysis/anomaly-incidents/:incidentId/follow-up", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const incidentId = readQueryString(request.params as Record<string, unknown>, "incidentId");
    const body = anomalyIncidentFollowUpBodySchema.parse(request.body ?? {});
    return {
      incident: await updateGatewayAnalysisAnomalyIncidentFollowUpForOperator(userId, providerUserId, incidentId, body),
    };
  });
}
