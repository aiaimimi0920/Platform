import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  recoverStalePlatformExecutions,
  runPendingDispatchableAgentExecutions,
  runPlatformExecutor,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import {
  dispatchPendingExecutionsSchema,
  recoverPlatformExecutorSchema,
  runPlatformExecutorSchema,
} from "./shared";

export function registerDispatchRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof dispatchPendingExecutionsSchema> }>(
    "/v1/internal/agent-executions/dispatch-pending",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      return {
        result: await runPendingDispatchableAgentExecutions(dispatchPendingExecutionsSchema.parse(request.body ?? {})),
      };
    },
  );

  app.post<{ Body: z.infer<typeof runPlatformExecutorSchema> }>(
    "/v1/internal/agent-executions/run-platform-executor",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const query = runPlatformExecutorSchema.parse(request.body ?? {});
      return runPlatformExecutor(query);
    },
  );

  app.post<{ Body: z.infer<typeof recoverPlatformExecutorSchema> }>(
    "/v1/internal/agent-executions/recover-stale",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const query = recoverPlatformExecutorSchema.parse(request.body ?? {});
      return recoverStalePlatformExecutions(query);
    },
  );
}
