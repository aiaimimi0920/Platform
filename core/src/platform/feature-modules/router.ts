import { featureModuleKeys } from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";

import { getFeatureSnapshot, setFeatureModuleEnabled } from "@/platform/feature-modules/service";
import { withInternalRequest } from "@/platform/internal-auth";

export const featureModuleRouter: FastifyPluginAsync = async (app) => {
  app.get("/internal/features", { preHandler: withInternalRequest }, async () => {
    return {
      modules: await getFeatureSnapshot(),
    };
  });

  app.post<{
    Body: { moduleKey: string; enabled: boolean; rolloutNote?: string | null };
  }>("/internal/features", { preHandler: withInternalRequest }, async (request) => {
    const moduleKey = request.body.moduleKey;
    if (!featureModuleKeys.includes(moduleKey as (typeof featureModuleKeys)[number])) {
      throw new Error(`Unknown module key: ${moduleKey}`);
    }

    return {
      modules: await setFeatureModuleEnabled(moduleKey as (typeof featureModuleKeys)[number], request.body.enabled, request.body.rolloutNote ?? null),
    };
  });
};
