import type { FastifyPluginAsync } from "fastify";

import { parseRauthyUpsertInput } from "@/modules/identity/rauthy-model";
import { upsertRauthyUser } from "@/modules/identity/rauthy-service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { withInternalRequest } from "@/platform/internal-auth";

export const rauthyIdentityRouter: FastifyPluginAsync = async (app) => {
  app.post("/internal/identity/rauthy-upsert", {
    preHandler: withInternalRequest,
    bodyLimit: 8192,
  }, async (request) => {
    await requireModuleEnabled("identity");
    const profile = parseRauthyUpsertInput(request.body);
    return { user: await upsertRauthyUser(profile) };
  });
};
