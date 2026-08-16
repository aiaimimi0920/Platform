import type { FastifyInstance } from "fastify";

import {
  getGatewayPromptCacheSummaryForOperator,
  getGatewayPromptCacheTrendReportForOperator,
} from "@/modules/gateway/service";
import { assertUserContext, withInternalRequest } from "@neuro/backend-foundation/platform/internal-auth";
import {
  readGatewayRequestAuditFilters,
  readQueryNumber,
  readQueryString,
} from "./shared";

export function registerPromptCacheRoutes(app: FastifyInstance) {
  app.get("/v1/internal/gateway/analysis/prompt-cache/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    const query = request.query as Record<string, unknown>;
    return {
      summary: await getGatewayPromptCacheSummaryForOperator(userId, providerUserId, {
        ...readGatewayRequestAuditFilters(query, 1000),
        inputPricePerMillion: readQueryNumber(query, "inputPricePerMillion"),
      }),
    };
  });

  app.get(
    "/v1/internal/gateway/analysis/prompt-cache/trend-report",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const query = request.query as Record<string, unknown>;
      return {
        report: await getGatewayPromptCacheTrendReportForOperator(userId, providerUserId, {
          ...readGatewayRequestAuditFilters(query, 1000),
          inputPricePerMillion: readQueryNumber(query, "inputPricePerMillion"),
          bucketSize: readQueryString(query, "bucketSize"),
        }),
      };
    },
  );
}
