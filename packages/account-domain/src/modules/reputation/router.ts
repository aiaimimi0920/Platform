import type { FastifyPluginAsync } from "fastify";

import { getReputationBreakdown, getReputationHistory, getReputationSummary } from "@/modules/reputation/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

export const reputationRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/me/reputation", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("reputation");
    const { userId } = assertUserContext(request);
    return {
      reputation: await getReputationSummary(userId),
    };
  });

  app.get("/v1/me/reputation/breakdown", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("reputation");
    const { userId } = assertUserContext(request);
    return {
      breakdown: await getReputationBreakdown(userId),
    };
  });

  app.get("/v1/me/reputation/history", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("reputation");
    const { userId } = assertUserContext(request);
    const rawLimit = (request.query as { limit?: string | number } | undefined)?.limit;
    const parsedLimit =
      typeof rawLimit === "number"
        ? rawLimit
        : typeof rawLimit === "string"
          ? Number.parseInt(rawLimit, 10)
          : 20;

    return {
      history: await getReputationHistory(userId, parsedLimit),
    };
  });
};
