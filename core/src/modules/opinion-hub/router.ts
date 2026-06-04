import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  adoptOpinionTopic,
  archiveOpinionTopic,
  createOpinionTopic,
  createOpinionTopicComment,
  getOpinionHubSettings,
  getOpinionMonthlySettlementRunDetail,
  getOpinionTopicDetail,
  getOperatorOpinionTopicDetail,
  listOpinionTopicOpposeSummariesForUser,
  listOpinionMonthlySettlementRuns,
  listOperatorOpinionTopicCollection,
  listOpinionTopicCollection,
  listOpinionTopicSupportSummariesForUser,
  runOpinionMonthlyLeaderSettlement,
  moderateOpinionTopic,
  opposeOpinionTopic,
  supportOpinionTopic,
  updateOpinionHubSettings,
  updateOpinionMonthlySettlementItemDecision,
} from "@/modules/opinion-hub/service";
import { opinionTopicTagKeys } from "@/modules/opinion-hub/types";
import { requireModuleEnabled } from "@/platform/feature-modules/service";
import { assertPlatformOperatorUser, assertUserContext, withInternalRequest } from "@/platform/internal-auth";

const createTopicSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(16).max(4000),
  tag: z.enum(opinionTopicTagKeys),
});

const topicListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sort: z.enum(["governance", "supportRate", "createdAt"]).optional(),
  topicTag: z.enum(opinionTopicTagKeys).optional(),
  topicStatus: z.enum(["collecting", "qualified", "archived", "all"]).optional(),
});

const operatorTopicListQuerySchema = topicListQuerySchema.extend({
  reviewStatus: z.enum(["published", "pending_review", "rejected", "banned", "deleted", "all"]).optional(),
});

const supportTopicSchema = z.object({
  ticketAmount: z.literal(1),
});

const opposeTopicSchema = z.object({
  ticketAmount: z.literal(1),
});

const commentSchema = z.object({
  content: z.string().trim().min(1).max(1200),
  replyToCommentId: z.string().trim().min(1).nullable().optional(),
});

const settingsSchema = z.object({
  preModerationEnabled: z.boolean(),
});

const moderationSchema = z.object({
  action: z.enum(["approve", "reject", "ban", "stopDiscussion", "resumeDiscussion", "delete"]),
  note: z.string().trim().max(600).nullable().optional(),
});

const monthlySettlementSchema = z.object({
  limit: z.number().int().positive().max(10).optional(),
});

const monthlySettlementListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(24).optional(),
});

const monthlySettlementDecisionSchema = z.object({
  action: z.enum(["exclude", "restore"]),
  note: z.string().trim().max(600).nullable().optional(),
});

export const opinionHubRouter: FastifyPluginAsync = async (app) => {
  app.get("/v1/opinions/topics", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId } = assertUserContext(request);
    const query = topicListQuerySchema.parse(request.query ?? {});
    return await listOpinionTopicCollection(userId, query);
  });

  app.get<{ Params: { topicId: string } }>("/v1/opinions/topics/:topicId", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId } = assertUserContext(request);
    return {
      detail: await getOpinionTopicDetail(userId, request.params.topicId),
    };
  });

  app.get("/v1/opinions/topics/support-summary", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId } = assertUserContext(request);
    return {
      supportSummaries: await listOpinionTopicSupportSummariesForUser(userId),
    };
  });

  app.get("/v1/opinions/topics/oppose-summary", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId } = assertUserContext(request);
    return {
      opposeSummaries: await listOpinionTopicOpposeSummariesForUser(userId),
    };
  });

  app.post<{ Body: z.infer<typeof createTopicSchema> }>(
    "/v1/opinions/topics",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      return {
        topic: await createOpinionTopic(userId, createTopicSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Params: { topicId: string }; Body: z.infer<typeof commentSchema> }>(
    "/v1/opinions/topics/:topicId/comments",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      const payload = commentSchema.parse(request.body);
      return {
        detail: await createOpinionTopicComment(userId, {
          topicId: request.params.topicId,
          content: payload.content,
          replyToCommentId: payload.replyToCommentId ?? null,
        }),
      };
    },
  );

  app.post<{ Params: { topicId: string }; Body: z.infer<typeof supportTopicSchema> }>(
    "/v1/opinions/topics/:topicId/support",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      return {
        topic: await supportOpinionTopic(userId, request.params.topicId, supportTopicSchema.parse(request.body).ticketAmount),
      };
    },
  );

  app.post<{ Params: { topicId: string }; Body: z.infer<typeof opposeTopicSchema> }>(
    "/v1/opinions/topics/:topicId/oppose",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("wallet");
      await requireModuleEnabled("ledger");
      const { userId } = assertUserContext(request);
      return {
        topic: await opposeOpinionTopic(userId, request.params.topicId, opposeTopicSchema.parse(request.body).ticketAmount),
      };
    },
  );

  app.post<{ Params: { topicId: string } }>(
    "/v1/opinions/topics/:topicId/archive",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      const { userId } = assertUserContext(request);
      return {
        topic: await archiveOpinionTopic(userId, request.params.topicId),
      };
    },
  );

  app.post<{ Params: { topicId: string } }>(
    "/v1/opinions/topics/:topicId/adopt",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      const { userId } = assertUserContext(request);
      return {
        topic: await adoptOpinionTopic(userId, request.params.topicId),
      };
    },
  );

  app.get("/v1/internal/opinions/settings", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperatorUser(userId, providerUserId);
    return {
      settings: await getOpinionHubSettings(),
    };
  });

  app.post<{ Body: z.infer<typeof settingsSchema> }>(
    "/v1/internal/opinions/settings",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      return {
        settings: await updateOpinionHubSettings(userId, settingsSchema.parse(request.body)),
      };
    },
  );

  app.get("/v1/internal/opinions/topics", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperatorUser(userId, providerUserId);
    const query = operatorTopicListQuerySchema.parse(request.query ?? {});
    return await listOperatorOpinionTopicCollection(userId, query);
  });

  app.get<{ Params: { topicId: string } }>("/v1/internal/opinions/topics/:topicId", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperatorUser(userId, providerUserId);
    return {
      detail: await getOperatorOpinionTopicDetail(userId, request.params.topicId),
    };
  });

  app.post<{ Params: { topicId: string }; Body: z.infer<typeof moderationSchema> }>(
    "/v1/internal/opinions/topics/:topicId/moderate",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      return {
        topic: await moderateOpinionTopic(userId, request.params.topicId, moderationSchema.parse(request.body)),
      };
    },
  );

  app.post<{ Body: z.infer<typeof monthlySettlementSchema> }>(
    "/v1/internal/opinions/monthly-leaders/run",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("developmentQueue");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      const payload = monthlySettlementSchema.parse(request.body ?? {});
      return {
        result: await runOpinionMonthlyLeaderSettlement(payload.limit ?? 10),
      };
    },
  );

  app.get("/v1/internal/opinions/monthly-leaders/runs", { preHandler: withInternalRequest }, async (request) => {
    await requireModuleEnabled("opinionHub");
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperatorUser(userId, providerUserId);
    const query = monthlySettlementListQuerySchema.parse(request.query ?? {});
    return {
      runs: await listOpinionMonthlySettlementRuns(query.limit ?? 12),
    };
  });

  app.get<{ Params: { monthKey: string } }>(
    "/v1/internal/opinions/monthly-leaders/:monthKey",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      return {
        detail: await getOpinionMonthlySettlementRunDetail(request.params.monthKey),
      };
    },
  );

  app.post<{ Params: { monthKey: string; itemId: string }; Body: z.infer<typeof monthlySettlementDecisionSchema> }>(
    "/v1/internal/opinions/monthly-leaders/:monthKey/items/:itemId/decision",
    { preHandler: withInternalRequest },
    async (request) => {
      await requireModuleEnabled("opinionHub");
      await requireModuleEnabled("developmentQueue");
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperatorUser(userId, providerUserId);
      return {
        detail: await updateOpinionMonthlySettlementItemDecision(
          userId,
          request.params.monthKey,
          request.params.itemId,
          monthlySettlementDecisionSchema.parse(request.body),
        ),
      };
    },
  );
};
