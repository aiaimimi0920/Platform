import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { EventName } from "@neuro/contracts";

import { assertUserContext, withInternalRequest } from "@/platform/internal-auth";
import {
  assertPlatformOperator,
  emitOutboxAlerts,
  getOutboxSummary,
  listOutboxEvents,
  listOutboxRetryAttempts,
  retryDeadLetterEventsBatch,
  retryDeadLetterEvent,
} from "@/platform/outbox/ops";

const outboxStatusSchema = z.enum(["pending", "processing", "processed", "dead_letter"]);

const listOutboxQuerySchema = z.object({
  status: outboxStatusSchema.optional(),
  eventName: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listRetryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const retryBatchBodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  eventName: z.string().min(1).max(120).optional(),
});

const emitAlertsBodySchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
  minimumAlertLevel: z.number().int().min(1).max(3).optional(),
});

export const outboxRouter: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: z.infer<typeof listOutboxQuerySchema> }>(
    "/v1/internal/outbox-events",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const query = listOutboxQuerySchema.parse(request.query);
      return {
        events: await listOutboxEvents(query),
      };
    },
  );

  app.get("/v1/internal/outbox-events/summary", { preHandler: withInternalRequest }, async (request) => {
    const { userId, providerUserId } = assertUserContext(request);
    assertPlatformOperator(userId, providerUserId);
    return {
      summary: await getOutboxSummary(),
    };
  });

  app.get<{ Querystring: z.infer<typeof listRetryQuerySchema> }>(
    "/v1/internal/outbox-events/retries",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const query = listRetryQuerySchema.parse(request.query);
      return {
        retries: await listOutboxRetryAttempts(query.limit ?? 25),
      };
    },
  );

  app.post<{ Params: { eventId: string } }>(
    "/v1/internal/outbox-events/:eventId/retry",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      return {
        event: await retryDeadLetterEvent(request.params.eventId, userId),
      };
    },
  );

  app.post<{ Body: z.infer<typeof retryBatchBodySchema> }>(
    "/v1/internal/outbox-events/retry-batch",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const body = retryBatchBodySchema.parse(request.body);
      return {
        result: await retryDeadLetterEventsBatch({
          actorUserId: userId,
          limit: body.limit,
          eventName: (body.eventName as EventName | undefined) ?? null,
        }),
      };
    },
  );

  app.post<{ Body: z.infer<typeof emitAlertsBodySchema> }>(
    "/v1/internal/outbox-events/emit-alerts",
    { preHandler: withInternalRequest },
    async (request) => {
      const { userId, providerUserId } = assertUserContext(request);
      assertPlatformOperator(userId, providerUserId);
      const body = emitAlertsBodySchema.parse(request.body ?? {});
      return {
        result: await emitOutboxAlerts(body),
      };
    },
  );
};
