import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { getPublicUserProfile, getUserSummary, updateUserProfile, upsertLinuxDoUser } from "@/modules/identity/service";
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

const updateUserProfileSchema = z.object({
  profileTagline: z.string().trim().max(80).nullable().optional(),
  honorShowcasedAgentIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedProjectIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedInvestmentProjectIds: z.array(z.string().trim().min(1)).max(3).nullable().optional(),
  honorShowcasedIssueIds: z.array(z.string().trim().min(1)).max(4).nullable().optional(),
  honorShowcasedInvestmentIssueIds: z.array(z.string().trim().min(1)).max(3).nullable().optional(),
});

export const identityRouter: FastifyPluginAsync = async (app) => {
  // Public — no user context required
  app.get<{ Params: { username: string } }>(
    "/v1/public/users/:username",
    { preHandler: withInternalRequest },
    async (request, reply) => {
      await requireModuleEnabled("identity");
      const { username } = request.params;
      const profile = await getPublicUserProfile(username);
      if (!profile) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
      }
      return { profile };
    },
  );

  // Internal — machine-to-machine
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

  app.post<{ Body: z.infer<typeof updateUserProfileSchema> }>(
    "/v1/me/profile",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("identity");
      const { userId } = assertUserContext(request);
      const payload = updateUserProfileSchema.parse(request.body);
      return {
        user: await updateUserProfile(userId, payload),
      };
    },
  );
};
