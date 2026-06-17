import type { FastifyInstance } from "fastify";

import { assertPlatformOperatorUser, assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import { getPlatformCorsObservabilitySnapshot } from "@/platform/http-server";

export async function platformHttpDebugRouter(app: FastifyInstance) {
  app.get(
    "/v1/internal/platform/http/cors",
    {
      preHandler: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);

      return {
        cors: getPlatformCorsObservabilitySnapshot(),
      };
    },
  );
}
