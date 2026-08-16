import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getAgentExecutionSettlementSummary,
  listAgentExecutionSettlementAttempts,
  retryAgentExecutionSettlement,
  runPendingAgentExecutionSettlements,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import { listSettlementAttemptsQuerySchema, settlementRunSchema } from "./shared";

export function registerSettlementRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof settlementRunSchema> }>(
    "/v1/internal/agent-executions/settlements/run",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.trim().length > 0) {
        const { userId } = assertUserContext(request);
        assertPlatformOperator(userId);
      }
      return {
        result: await runPendingAgentExecutionSettlements(settlementRunSchema.parse(request.body ?? {})),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listSettlementAttemptsQuerySchema> }>(
    "/v1/internal/agent-executions/settlements",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        settlements: await listAgentExecutionSettlementAttempts(listSettlementAttemptsQuerySchema.parse(request.query)),
      };
    },
  );

  app.get(
    "/v1/internal/agent-executions/settlements/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getAgentExecutionSettlementSummary(),
      };
    },
  );

  app.post<{ Params: { executionId: string } }>(
    "/v1/internal/agent-executions/settlements/:executionId/retry",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        execution: await retryAgentExecutionSettlement(request.params.executionId),
      };
    },
  );
}
