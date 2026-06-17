import type { FastifyInstance } from "fastify";

import {
  assertUserContext,
  withInternalRequest,
} from "@neuro/backend-foundation/platform/internal-auth";
import { HttpError } from "@neuro/backend-foundation/platform/errors";
import { getPlatformCorsObservabilitySnapshot } from "@neuro/backend-foundation/platform/http-server";

import { isPlatformOperatorUserId } from "./notification-webhook-catalog";

export async function platformHttpDebugRouter(app: FastifyInstance) {
  app.get(
    "/v1/internal/platform/http/cors",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId, providerUserId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect platform HTTP CORS state");
      }

      return {
        cors: getPlatformCorsObservabilitySnapshot(),
      };
    },
  );
}
