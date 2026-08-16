import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  emitRuntimePressureAlerts,
  getAgentExecutionRuntimeCatalog,
  getRuntimePressureAlertSummaryForOperator,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { assertPlatformOperator } from "@/platform/outbox/ops";
import {
  emitRuntimePressureAlertsSchema,
  runtimePressureAlertQuerySchema,
} from "./shared";

export function registerRuntimeCatalogRoutes(app: FastifyInstance) {
  app.get("/v1/agent-executions/runtime-catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    assertUserContext(request);
    return {
      catalog: await getAgentExecutionRuntimeCatalog(),
    };
  });

  app.get("/v1/internal/agent-executions/runtime-catalog", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("agentExecution");
    const { userId } = assertUserContext(request);
    assertPlatformOperator(userId);
    return {
      catalog: await getAgentExecutionRuntimeCatalog(),
    };
  });

  app.get<{ Querystring: z.infer<typeof runtimePressureAlertQuerySchema> }>(
    "/v1/internal/agent-executions/runtime-alerts/summary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      assertPlatformOperator(userId);
      return {
        summary: await getRuntimePressureAlertSummaryForOperator(runtimePressureAlertQuerySchema.parse(request.query)),
      };
    },
  );

  app.post<{ Body: z.infer<typeof emitRuntimePressureAlertsSchema> }>(
    "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const headerUserId = request.headers["x-neuro-user-id"];
      if (typeof headerUserId === "string" && headerUserId.length > 0) {
        assertPlatformOperator(headerUserId);
      }
      const body = emitRuntimePressureAlertsSchema.parse(request.body ?? {});
      return {
        result: await emitRuntimePressureAlerts(body),
      };
    },
  );
}
