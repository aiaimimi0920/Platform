import type { FastifyInstance } from "fastify";

import {
  listGatewayRequestAuditsForOperator,
  listGatewayRequestAuditSummaryForOperator,
  getGatewayRequestAuditForOperator,
  getGatewayRequestArtifactsForOperator,
  listGatewaySessionsForOperator,
  getGatewaySessionDetailForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  readGatewayRequestAuditFilters,
  readQueryString,
  readQueryBoolean,
} from "./shared";

export function registerOperatorAuditsRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/requests", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      requests: await listGatewayRequestAuditsForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 100),
      ),
    };
  });

  app.get("/v1/internal/gateway/requests/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await listGatewayRequestAuditSummaryForOperator(
        userId,
        providerUserId,
        readGatewayRequestAuditFilters(query, 200),
      ),
    };
  });

  app.get("/v1/internal/gateway/requests/:requestAuditId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const requestAuditId = readQueryString(request.params as Record<string, unknown>, "requestAuditId");
    return {
      requestAudit: await getGatewayRequestAuditForOperator(userId, providerUserId, {
        requestAuditId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/by-response/:responseId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const responseId = readQueryString(request.params as Record<string, unknown>, "responseId");
    return {
      requestAudit: await getGatewayRequestAuditForOperator(userId, providerUserId, {
        responseId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/:requestAuditId/artifacts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const requestAuditId = readQueryString(request.params as Record<string, unknown>, "requestAuditId");
    return {
      artifacts: await getGatewayRequestArtifactsForOperator(userId, providerUserId, {
        requestAuditId,
      }),
    };
  });

  app.get("/v1/internal/gateway/requests/by-response/:responseId/artifacts", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const responseId = readQueryString(request.params as Record<string, unknown>, "responseId");
    return {
      artifacts: await getGatewayRequestArtifactsForOperator(userId, providerUserId, {
        responseId,
      }),
    };
  });

  app.get("/v1/internal/gateway/sessions", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    const rawLimit = Number(query.limit ?? 100);
    return {
      sessions: await listGatewaySessionsForOperator(
        userId,
        providerUserId,
        {
          projectId: readQueryString(query, "projectId"),
          providerAccountId: readQueryString(query, "providerAccountId"),
          protocolFamily: readQueryString(query, "protocolFamily") as any,
          activeOnly: readQueryBoolean(query, "activeOnly"),
          limit: Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 100,
        },
      ),
    };
  });

  app.get("/v1/internal/gateway/sessions/:sessionId", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const sessionId = readQueryString(request.params as Record<string, unknown>, "sessionId");
    return {
      sessionDetail: await getGatewaySessionDetailForOperator(userId, providerUserId, sessionId),
    };
  });
}
