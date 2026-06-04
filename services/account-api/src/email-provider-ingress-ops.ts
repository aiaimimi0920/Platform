import type { FastifyPluginAsync } from "fastify";

import {
  listRecentEmailProviderInboundMessageViews,
  retryEmailProviderInboundMessage,
} from "@neuro/account-domain";
import {
  assertUserContext,
  withInternalRequest,
} from "@neuro/backend-foundation/platform/internal-auth";
import { HttpError } from "@neuro/backend-foundation/platform/errors";
import { requireModuleEnabled } from "@neuro/backend-foundation/platform/feature-modules/service";

import { isPlatformOperatorUserId } from "./notification-webhook-catalog";

export const emailProviderIngressOpsRouter: FastifyPluginAsync = async (app) => {
  app.get(
    "/v1/internal/email-ingress/provider-messages",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      await requireModuleEnabled("identity");

      const { userId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can inspect real email ingress");
      }

      const query = request.query as { limit?: string };
      const rawLimit = Number(query.limit || 40);
      const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 40, 100));

      return {
        messages: await listRecentEmailProviderInboundMessageViews(limit),
      };
    },
  );

  app.post(
    "/v1/internal/email-ingress/provider-messages/:providerInboundMessageId/retry",
    {
      onRequest: withInternalRequest,
    },
    async (request) => {
      await requireModuleEnabled("identity");

      const { userId } = assertUserContext(request);
      if (!isPlatformOperatorUserId(userId)) {
        throw new HttpError(401, "UNAUTHORIZED", "Only platform operators can retry real email ingress");
      }

      const providerInboundMessageId = String(
        (request.params as { providerInboundMessageId?: string }).providerInboundMessageId || "",
      ).trim();
      if (!providerInboundMessageId) {
        throw new HttpError(400, "BAD_REQUEST", "Invalid provider inbound message id");
      }

      const message = await retryEmailProviderInboundMessage(providerInboundMessageId);
      if (!message) {
        throw new HttpError(404, "NOT_FOUND", "Provider inbound message not found");
      }

      return {
        message,
      };
    },
  );
};
