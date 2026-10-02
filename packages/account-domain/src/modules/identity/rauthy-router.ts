import type { FastifyPluginAsync } from "fastify";

import { redis } from "@/db/redis";
import { createRauthyIdentityRouter } from "@/modules/identity/rauthy-http";
import { createRauthyRateLimitConnection } from "@/modules/identity/rauthy-rate-limit";
import { upsertRauthyUser } from "@/modules/identity/rauthy-service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { withInternalRequest } from "@/platform/internal-auth";

export const rauthyIdentityRouter: FastifyPluginAsync = async (app) => {
  const connection = createRauthyRateLimitConnection(redis);
  app.addHook("onClose", async () => connection.close());
  await app.register(createRauthyIdentityRouter({
    authenticate: withInternalRequest,
    redis: connection.redis,
    ready: () => connection.ready(),
    requireIdentityEnabled: () => requireModuleEnabled("identity"),
    upsert: upsertRauthyUser,
  }));
};
