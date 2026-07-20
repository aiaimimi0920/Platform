import { randomUUID } from "node:crypto";

import type {
  HeavyChatMessageAttemptResult,
  HeavyChatMessageAttemptView,
  HeavyChatMessageView,
  HeavyChatProjectView,
  HeavyChatSendMessageResult as HeavyChatSendMessageResultView,
  HeavyChatSlotAgentBindingView,
  HeavyChatSlotView,
  HeavyChatSnapshot,
  HeavyChatThreadView,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { GatewayClientError } from "./gateway-client";
import type { CreateHeavyChatThreadArgs } from "./repository";
import type {
  HeavyChatExecutionResult,
  HeavyChatRetryMessageInput,
  HeavyChatSendMessageInput,
  HeavyChatSendMessageResult,
  HeavyChatSnapshotRecord,
} from "./service";
import {
  HeavyChatAgentBindingConflictError,
  HeavyChatAttemptConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatManagedAgentValidationError,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessageRecord,
  type HeavyChatProjectRecord,
  type HeavyChatSlotAgentBindingRecord,
  type HeavyChatSlotRecord,
  type HeavyChatThreadRecord,
} from "./types";
import { BadRequestError, ConflictError, HttpError, NotFoundError } from "../../platform/errors";
import { assertUserContext, withInternalRequest } from "../../platform/internal-auth";

export type HeavyChatRouterService = {
  getSnapshot(ownerUserId: string): Promise<HeavyChatSnapshotRecord>;
  createThread(ownerUserId: string, input: CreateHeavyChatThreadArgs): Promise<HeavyChatThreadRecord>;
  sendMessage(ownerUserId: string, input: HeavyChatSendMessageInput): Promise<HeavyChatSendMessageResult>;
  retryMessage(ownerUserId: string, input: HeavyChatRetryMessageInput): Promise<HeavyChatExecutionResult>;
};

export type HeavyChatRouterOptions = {
  service?: HeavyChatRouterService;
  createService?: () => Promise<HeavyChatRouterService>;
};

const identifierSchema = z.string().trim().min(1).max(200);
const correlationIdSchema = z.string().trim().min(1).max(200);
const idempotencyKeySchema = z.string().trim().min(1).max(500);

const createThreadSchema = z.object({
  slotId: identifierSchema,
  projectId: identifierSchema.optional().nullable(),
  title: z.string().trim().min(1).max(200),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(100_000),
  idempotencyKey: idempotencyKeySchema,
  correlationId: correlationIdSchema.optional(),
});

const retryMessageSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  correlationId: correlationIdSchema.optional(),
});

let productionServicePromise: Promise<HeavyChatRouterService> | null = null;

function parseRequestBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".");
  const detail = issue?.message || "Invalid request body";
  throw new BadRequestError(field ? `${field}: ${detail}` : detail);
}

function toIsoDate(value: Date) {
  return value.toISOString();
}

function toSlotView(record: HeavyChatSlotRecord): HeavyChatSlotView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
  };
}

function toProjectView(record: HeavyChatProjectRecord): HeavyChatProjectView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
  };
}

function toBindingView(record: HeavyChatSlotAgentBindingRecord): HeavyChatSlotAgentBindingView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
  };
}

function toThreadView(record: HeavyChatThreadRecord): HeavyChatThreadView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
  };
}

function toMessageView(record: HeavyChatMessageRecord): HeavyChatMessageView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
    updatedAt: toIsoDate(record.updatedAt),
  };
}

function toAttemptView(record: HeavyChatMessageAttemptRecord): HeavyChatMessageAttemptView {
  return {
    ...record,
    createdAt: toIsoDate(record.createdAt),
  };
}

function toSnapshotView(snapshot: HeavyChatSnapshotRecord): HeavyChatSnapshot {
  return {
    slots: snapshot.slots.map(toSlotView),
    projects: snapshot.projects.map(toProjectView),
    slotProjects: snapshot.slotProjects.map((binding) => ({ ...binding })),
    bindings: snapshot.bindings.map(toBindingView),
    threads: snapshot.threads.map(toThreadView),
    messages: snapshot.messages.map(toMessageView),
  };
}

function toExecutionResultView(result: HeavyChatExecutionResult): HeavyChatMessageAttemptResult {
  return {
    assistantMessage: toMessageView(result.assistantMessage),
    attempt: toAttemptView(result.attempt),
    created: result.created,
  };
}

function toSendResultView(result: HeavyChatSendMessageResult): HeavyChatSendMessageResultView {
  return {
    ...toExecutionResultView(result),
    userMessage: toMessageView(result.userMessage),
  };
}

function normalizeHeavyChatError(error: unknown): Error {
  if (error instanceof HttpError) return error;
  if (error instanceof HeavyChatOwnershipError) {
    return new NotFoundError(error.message);
  }
  if (
    error instanceof HeavyChatAgentBindingConflictError ||
    error instanceof HeavyChatAttemptConflictError ||
    error instanceof HeavyChatSlotLimitError
  ) {
    return new ConflictError(error.message);
  }
  if (
    error instanceof HeavyChatInvalidTransitionError ||
    error instanceof HeavyChatManagedAgentValidationError
  ) {
    return new BadRequestError(error.message);
  }
  if (error instanceof GatewayClientError) {
    if (error.code === "provider_rejected") {
      const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 502;
      return new HttpError(
        statusCode,
        statusCode === 429 ? "QUOTA_EXCEEDED" : "BAD_REQUEST",
        error.message,
      );
    }
    if (error.code === "provider_timeout") {
      return new HttpError(504, "INTERNAL_SERVER_ERROR", error.message);
    }
    if (error.code === "unavailable") {
      return new HttpError(503, "INTERNAL_SERVER_ERROR", error.message);
    }
    return new HttpError(502, "INTERNAL_SERVER_ERROR", error.message);
  }
  if (
    error instanceof Error &&
    /^Heavy chat Gateway (?:client|model) is not configured$/.test(error.message)
  ) {
    return new HttpError(503, "INTERNAL_SERVER_ERROR", error.message);
  }
  return error instanceof Error ? error : new Error("Unknown heavy chat error");
}

async function createProductionHeavyChatService(): Promise<HeavyChatRouterService> {
  const [
    { env },
    { createHeavyChatGatewayClient },
    { createHeavyChatRepository },
    { createHeavyChatService },
    { resolveOwnedAgentForHeavyChat },
  ] = await Promise.all([
    import("../../env"),
    import("./gateway-client"),
    import("./repository"),
    import("./service"),
    import("../agent-registry/service"),
  ]);

  const gatewayClient = env.aiGatewayInternalUrl && env.aiGatewayManagementToken
    ? createHeavyChatGatewayClient({
        baseUrl: env.aiGatewayInternalUrl,
        managementToken: env.aiGatewayManagementToken,
        model: env.heavyChatGatewayModel ?? undefined,
        serviceId: "platform-heavy-chat",
        serviceTitle: "Platform Heavy Chat",
        timeoutMs: env.heavyChatGatewayTimeoutMs,
      })
    : undefined;

  return createHeavyChatService({
    repository: createHeavyChatRepository(),
    resolveManagedHeavyAgent: resolveOwnedAgentForHeavyChat,
    gatewayClient,
    gatewayModel: env.heavyChatGatewayModel ?? undefined,
  });
}

function getProductionHeavyChatService() {
  productionServicePromise ??= createProductionHeavyChatService();
  return productionServicePromise;
}

export function createHeavyChatRouter(options: HeavyChatRouterOptions = {}): FastifyPluginAsync {
  const getService = async () => {
    if (options.service) return options.service;
    if (options.createService) return options.createService();
    return getProductionHeavyChatService();
  };

  return async (app) => {
    app.get("/v1/me/heavy-chat/snapshot", { preHandler: withInternalRequest }, async (request) => {
      const { userId } = assertUserContext(request);
      try {
        const snapshot = await (await getService()).getSnapshot(userId);
        return { snapshot: toSnapshotView(snapshot) };
      } catch (error) {
        throw normalizeHeavyChatError(error);
      }
    });

    app.post<{ Body: unknown }>(
      "/v1/me/heavy-chat/threads",
      { preHandler: withInternalRequest },
      async (request, reply) => {
        const { userId } = assertUserContext(request);
        const payload = parseRequestBody(createThreadSchema, request.body);
        try {
          const thread = await (await getService()).createThread(userId, payload);
          return reply.status(201).send({ thread: toThreadView(thread) });
        } catch (error) {
          throw normalizeHeavyChatError(error);
        }
      },
    );

    app.post<{ Params: { threadId: string }; Body: unknown }>(
      "/v1/me/heavy-chat/threads/:threadId/messages",
      { preHandler: withInternalRequest },
      async (request) => {
        const { userId } = assertUserContext(request);
        const payload = parseRequestBody(sendMessageSchema, request.body);
        try {
          const result = await (await getService()).sendMessage(userId, {
            threadId: request.params.threadId,
            content: payload.content,
            idempotencyKey: payload.idempotencyKey,
            correlationId: payload.correlationId ?? randomUUID(),
          });
          return { result: toSendResultView(result) };
        } catch (error) {
          throw normalizeHeavyChatError(error);
        }
      },
    );

    app.post<{ Params: { messageId: string }; Body: unknown }>(
      "/v1/me/heavy-chat/messages/:messageId/retry",
      { preHandler: withInternalRequest },
      async (request) => {
        const { userId } = assertUserContext(request);
        const payload = parseRequestBody(retryMessageSchema, request.body);
        try {
          const result = await (await getService()).retryMessage(userId, {
            messageId: request.params.messageId,
            idempotencyKey: payload.idempotencyKey,
            correlationId: payload.correlationId ?? randomUUID(),
          });
          return { result: toExecutionResultView(result) };
        } catch (error) {
          throw normalizeHeavyChatError(error);
        }
      },
    );
  };
}

export const heavyChatRouter = createHeavyChatRouter();
