import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  createOperatorAccountAnnouncement,
  deleteOperatorAccountAnnouncement,
  listOperatorAccountAnnouncements,
  listPublishedAccountAnnouncements,
  updateOperatorAccountAnnouncement,
} from "@/modules/announcements/service";
import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const announcementSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  bullets: z.array(z.string().trim().min(1).max(2_000)).max(100).optional(),
  paragraphs: z.array(z.string().trim().min(1).max(5_000)).max(100).optional(),
});

const announcementUpsertSchema = z.object({
  title: z.string().trim().min(1).max(200),
  railTitle: z.string().trim().min(1).max(40),
  summary: z.string().trim().min(1).max(2_000),
  eyebrow: z.string().trim().min(1).max(40),
  publishedAt: z.string().trim().min(1).nullable().optional(),
  tone: z.enum(["priority", "update", "guide"]),
  status: z.enum(["draft", "published", "archived"]),
  sections: z.array(announcementSectionSchema).min(1).max(50),
});

const announcementParamsSchema = z.object({
  announcementId: z.string().trim().min(1),
});

export const announcementsRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/announcements", async () => {
    return {
      announcements: await listPublishedAccountAnnouncements(),
    };
  });

  app.get("/v1/internal/announcements", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    return {
      announcements: await listOperatorAccountAnnouncements(userId, providerUserId),
    };
  });

  app.post<{ Body: z.infer<typeof announcementUpsertSchema> }>(
    "/v1/internal/announcements",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const payload = announcementUpsertSchema.parse(request.body ?? {});
      return {
        announcement: await createOperatorAccountAnnouncement(userId, providerUserId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof announcementParamsSchema>; Body: z.infer<typeof announcementUpsertSchema> }>(
    "/v1/internal/announcements/:announcementId",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { announcementId } = announcementParamsSchema.parse(request.params);
      const payload = announcementUpsertSchema.parse(request.body ?? {});
      return {
        announcement: await updateOperatorAccountAnnouncement(userId, providerUserId, announcementId, payload),
      };
    },
  );

  app.post<{ Params: z.infer<typeof announcementParamsSchema> }>(
    "/v1/internal/announcements/:announcementId/delete",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      const { announcementId } = announcementParamsSchema.parse(request.params);
      await deleteOperatorAccountAnnouncement(userId, providerUserId, announcementId);
      return { ok: true as const };
    },
  );
};
