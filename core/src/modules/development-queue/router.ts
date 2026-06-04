import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { listDevelopmentQueue, updateDevelopmentQueueStatus } from "@/modules/development-queue/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const updateStatusSchema = z.object({
  status: z.enum(["planned", "in_progress", "completed", "archived"]),
});

export const developmentQueueRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/development-queue/items", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("developmentQueue");
    const { userId } = assertUserContext(request);
    return {
      items: await listDevelopmentQueue(userId),
    };
  });

  app.post<{ Params: { itemId: string }; Body: z.infer<typeof updateStatusSchema> }>(
    "/v1/development-queue/items/:itemId/status",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("developmentQueue");
      const { userId } = assertUserContext(request);
      return {
        item: await updateDevelopmentQueueStatus(userId, request.params.itemId, updateStatusSchema.parse(request.body)),
      };
    },
  );
};
