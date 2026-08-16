import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getExecutionRunSummaryForOperator,
  listExecutionRunsForOperator,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import { listExecutionRunQuerySchema, parseDelimitedIdList } from "./shared";

export function registerRunRoutes(app: FastifyInstance) {
  app.get<{ Querystring: z.infer<typeof listExecutionRunQuerySchema> }>(
    "/v1/internal/agent-executions/runs",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listExecutionRunQuerySchema.parse(request.query);
      const executionIds = parseDelimitedIdList(query.executionIds);
      const runIds = parseDelimitedIdList(query.runIds);
      return {
        runs: await listExecutionRunsForOperator({
          ...query,
          executionIds,
          runIds,
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listExecutionRunQuerySchema> }>(
    "/v1/internal/agent-executions/runs/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listExecutionRunQuerySchema.parse(request.query);
      const executionIds = parseDelimitedIdList(query.executionIds);
      const runIds = parseDelimitedIdList(query.runIds);
      return {
        summary: await getExecutionRunSummaryForOperator({
          ...query,
          executionIds,
          runIds,
        }),
      };
    },
  );
}
