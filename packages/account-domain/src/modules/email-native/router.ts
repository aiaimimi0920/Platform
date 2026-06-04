import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  confirmEmailIdentityVerification,
  getEmailNativePanel,
  ingestEmailNativeInboundMessage,
  removeEmailIdentity,
  setPrimaryEmailIdentity,
  startEmailIdentityVerification,
} from "@/modules/email-native/service";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const startVerificationSchema = z.object({
  email: z.email().max(320),
  makePrimary: z.boolean().optional().nullable(),
});

const confirmVerificationSchema = z.object({
  email: z.email().max(320),
  code: z.string().trim().regex(/^\d{6}$/),
});

const inboundSchema = z.object({
  fromEmail: z.email().max(320),
  toEmail: z.email().max(320),
  subject: z.string().max(500).optional().nullable(),
  textBody: z.string().min(1),
  htmlBody: z.string().optional().nullable(),
  providerMessageId: z.string().max(500).optional().nullable(),
  receivedAt: z.string().datetime().optional().nullable(),
});

export const emailNativeRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/me/email-native", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("identity");
    const { userId } = assertUserContext(request);
    return {
      panel: await getEmailNativePanel(userId),
    };
  });

  app.post<{ Body: z.infer<typeof startVerificationSchema> }>(
    "/v1/me/email-native/verify/start",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const { userId } = assertUserContext(request);
      return await startEmailIdentityVerification(userId, startVerificationSchema.parse(request.body));
    },
  );

  app.post<{ Body: z.infer<typeof confirmVerificationSchema> }>(
    "/v1/me/email-native/verify/confirm",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const { userId } = assertUserContext(request);
      return await confirmEmailIdentityVerification(userId, confirmVerificationSchema.parse(request.body));
    },
  );

  app.post<{ Params: { identityId: string } }>(
    "/v1/me/email-native/identities/:identityId/primary",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const { userId } = assertUserContext(request);
      return {
        identity: await setPrimaryEmailIdentity(userId, request.params.identityId),
      };
    },
  );

  app.post<{ Params: { identityId: string } }>(
    "/v1/me/email-native/identities/:identityId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const { userId } = assertUserContext(request);
      return await removeEmailIdentity(userId, request.params.identityId);
    },
  );

  app.post<{ Body: z.infer<typeof inboundSchema> }>(
    "/internal/email-native/inbound",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      return {
        message: await ingestEmailNativeInboundMessage(inboundSchema.parse(request.body)),
      };
    },
  );
};
