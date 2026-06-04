import { publicSurfaceKeys } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";

import { withInternalRequest } from "@/platform/internal-auth";

import { getPublicSurfaceSnapshot, updatePublicSurfaceSnapshot } from "./service";

export const publicSurfaceRouter: FastifyPluginAsync = async (app) => {
  app.get("/internal/public-surfaces", { preHandler: withInternalRequest }, async () => {
    return {
      surfaces: await getPublicSurfaceSnapshot(),
    };
  });

  app.post<{
    Body: { surfaces?: Array<{ surfaceKey: string; enabled: boolean }> };
  }>("/internal/public-surfaces", { preHandler: withInternalRequest }, async (request) => {
    const input = Array.isArray(request.body?.surfaces) ? request.body.surfaces : [];
    for (const entry of input) {
      if (!publicSurfaceKeys.includes(entry.surfaceKey as (typeof publicSurfaceKeys)[number])) {
        throw new Error(`Unknown public surface key: ${entry.surfaceKey}`);
      }
    }

    return {
      surfaces: await updatePublicSurfaceSnapshot(
        input.map((entry) => ({
          surfaceKey: entry.surfaceKey as (typeof publicSurfaceKeys)[number],
          enabled: entry.enabled,
        })),
      ),
    };
  });
};
