import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createOwnedAgentExecutionLaunchPreset,
  deleteOwnedAgentExecutionLaunchPreset,
  listOwnedAgentExecutionLaunchPresets,
  setOwnedAgentExecutionLaunchDefaultPreset,
  updateOwnedAgentExecutionLaunchPreset,
} from "@/modules/agent-execution/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import {
  listExecutionLaunchPresetsQuerySchema,
  saveExecutionLaunchPresetSchema,
} from "./shared";

export function registerLaunchPresetRoutes(app: FastifyInstance) {
  app.get<{ Querystring: z.infer<typeof listExecutionLaunchPresetsQuerySchema> }>(
    "/v1/agent-executions/presets",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        presets: await listOwnedAgentExecutionLaunchPresets(
          userId,
          listExecutionLaunchPresetsQuerySchema.parse(request.query),
        ),
      };
    },
  );

  app.post<{ Body: z.infer<typeof saveExecutionLaunchPresetSchema> }>(
    "/v1/agent-executions/presets",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        preset: await createOwnedAgentExecutionLaunchPreset(userId, saveExecutionLaunchPresetSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Params: { presetId: string }; Body: z.infer<typeof saveExecutionLaunchPresetSchema> }>(
    "/v1/agent-executions/presets/:presetId",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      await requireModuleEnabled("agentRegistry");
      const { userId } = assertUserContext(request);
      return {
        preset: await updateOwnedAgentExecutionLaunchPreset(
          userId,
          request.params.presetId,
          saveExecutionLaunchPresetSchema.parse(request.body),
        ),
      };
      },
    );

  app.post<{ Params: { presetId: string } }>(
    "/v1/agent-executions/presets/:presetId/default",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      return {
        preset: await setOwnedAgentExecutionLaunchDefaultPreset(userId, request.params.presetId),
      };
    },
  );

  app.post<{ Params: { presetId: string } }>(
    "/v1/agent-executions/presets/:presetId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("agentExecution");
      const { userId } = assertUserContext(request);
      await deleteOwnedAgentExecutionLaunchPreset(userId, request.params.presetId);
      return { ok: true as const };
    },
  );
}
