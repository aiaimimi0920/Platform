import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getRuntimeSessionSummaryForOperator,
  listRuntimeSessionsForOperator,
  sweepRuntimeSessions,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import { listRuntimeSessionsQuerySchema, runtimeSessionSweepSchema } from "./shared";

export function registerRuntimeSessionRoutes(app: FastifyInstance) {
  app.get<{ Querystring: z.infer<typeof listRuntimeSessionsQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-sessions/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listRuntimeSessionsQuerySchema.parse(request.query);
      return {
        summary: await getRuntimeSessionSummaryForOperator({
          agentId: query.agentId,
          ownerUserId: query.ownerUserId,
          state: query.state,
          kind: query.kind,
          staleOnly: query.staleOnly === "true",
        }),
      };
    },
  );

  app.get<{ Querystring: z.infer<typeof listRuntimeSessionsQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-sessions",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      const query = listRuntimeSessionsQuerySchema.parse(request.query);
      return {
        sessions: await listRuntimeSessionsForOperator({
          agentId: query.agentId,
          ownerUserId: query.ownerUserId,
          state: query.state,
          kind: query.kind,
          staleOnly: query.staleOnly === "true",
          limit: query.limit,
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof runtimeSessionSweepSchema> }>(
    "/v1/internal/agent-executions/runtime-sessions/sweep",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = runtimeSessionSweepSchema.parse(request.body ?? {});
      return sweepRuntimeSessions(body);
    },
  );
}
