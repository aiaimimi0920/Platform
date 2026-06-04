import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getUserSummary, upsertLinuxDoUser } from "@/modules/identity/service";
import { getFeatureSnapshot, requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const linuxDoSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  trust_level: z.number().nullable().optional(),
});

export const identityRouter: FastifyPluginAsync = async (app) => {
  app.post<{ Body: z.infer<typeof linuxDoSchema> }>(
    "/internal/identity/linuxdo-upsert",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const payload = linuxDoSchema.parse(request.body);
      return {
        user: await upsertLinuxDoUser(payload),
      };
    },
  );

  app.get("/v1/me", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("identity");
    const { userId } = assertUserContext(request);
    const features = await getFeatureSnapshot();
    return {
      user: await getUserSummary(userId, features),
    };
  });
};
