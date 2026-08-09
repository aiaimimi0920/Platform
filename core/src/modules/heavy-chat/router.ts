import { randomUUID } from "node:crypto";

import type {
  HeavyChatMessageAttemptResult,
  HeavyChatMessageAttemptView,
  HeavyChatMessagePage,
  HeavyChatMessageView,
  HeavyChatProjectView,
  HeavyChatSendMessageResult as HeavyChatSendMessageResultView,
  HeavyChatSlotAgentBindingView,
  HeavyChatSlotView,
  HeavyChatSnapshot,
  HeavyChatThreadView,
  HeavyChatActionType,
} from "@neuro/contracts";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { GatewayClientError } from "./gateway-client";
import {
  HeavyChatActionExecutionError,
  type HeavyChatActionResult,
} from "./action-bridge";
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
  HeavyChatActionConflictError,
  HeavyChatAttemptConflictError,
  HeavyChatInvalidTransitionError,
  HeavyChatManagedAgentValidationError,
  HeavyChatOwnershipError,
  HeavyChatSlotLimitError,
  type HeavyChatMessageAttemptRecord,
  type HeavyChatMessagePageRecord,
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
  getMessagePage(
    ownerUserId: string,
    threadId: string,
    options?: { beforeSequence?: number; pageSize?: number },
  ): Promise<HeavyChatMessagePageRecord>;
  createThread(ownerUserId: string, input: CreateHeavyChatThreadArgs): Promise<HeavyChatThreadRecord>;
  sendMessage(ownerUserId: string, input: HeavyChatSendMessageInput): Promise<HeavyChatSendMessageResult>;
  retryMessage(ownerUserId: string, input: HeavyChatRetryMessageInput): Promise<HeavyChatExecutionResult>;
  runMessageAction(
    ownerUserId: string,
    input: { messageId: string; type: HeavyChatActionType },
  ): Promise<HeavyChatActionResult>;
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
const messageActionSchema = z.object({
  type: z.enum(["task", "mailbox"]),
});
const messagePageQuerySchema = z.object({
  beforeSequence: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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

function parseRequestQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join(".");
  const detail = issue?.message || "Invalid request query";
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
    messagePages: snapshot.messagePages.map((page) => ({ ...page })),
  };
}

function toMessagePageView(page: HeavyChatMessagePageRecord): HeavyChatMessagePage {
  return {
    threadId: page.threadId,
    messages: page.messages.map(toMessageView),
    hasMore: page.hasMore,
    nextBeforeSequence: page.nextBeforeSequence,
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

function toActionResultView(result: HeavyChatActionResult) {
  return {
    action: result.action,
    target: result.target,
    executed: result.executed,
    created: result.created,
  };
}

function normalizeHeavyChatError(error: unknown): Error {
  if (error instanceof HttpError) return error;
  if (error instanceof HeavyChatActionExecutionError) {
    return new HttpError(503, "INTERNAL_SERVER_ERROR", error.message);
  }
  if (error instanceof HeavyChatOwnershipError) {
    return new NotFoundError(error.message);
  }
  if (
    error instanceof HeavyChatAgentBindingConflictError ||
    error instanceof HeavyChatActionConflictError ||
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
    { createHeavyChatActionBridge },
    { resolveOwnedAgentForHeavyChat },
    taskHub,
    accountDomain,
    { requireModuleEnabled },
  ] = await Promise.all([
    import("../../env"),
    import("./gateway-client"),
    import("./repository"),
    import("./service"),
    import("./action-bridge"),
    import("../agent-registry/service"),
    import("../task-hub/service"),
    import("@neuro/account-domain"),
    import("../../platform/feature-modules/service"),
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

  const repository = createHeavyChatRepository();
  const actionBridge = createHeavyChatActionBridge({
    repository,
    assertEnabled: (type) => requireModuleEnabled(type === "task" ? "taskHub" : "mailbox"),
    taskHub: {
      createTaskDraft: taskHub.createTaskDraft,
      getOwnedTaskSummary: taskHub.getOwnedTaskSummary,
    },
    mailbox: {
      createMailboxMessage: accountDomain.createMailboxMessage,
      getMailboxMessageById: accountDomain.getMailboxMessageById,
    },
    now: () => new Date(),
  });

  return createHeavyChatService({
    repository,
    resolveManagedHeavyAgent: resolveOwnedAgentForHeavyChat,
    gatewayClient,
    gatewayModel: env.heavyChatGatewayModel ?? undefined,
    actionBridge,
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

    app.get<{ Params: { threadId: string }; Querystring: unknown }>(
      "/v1/me/heavy-chat/threads/:threadId/messages",
      { preHandler: withInternalRequest },
      async (request) => {
        const { userId } = assertUserContext(request);
        const query = parseRequestQuery(messagePageQuerySchema, request.query);
        try {
          const page = await (await getService()).getMessagePage(userId, request.params.threadId, {
            beforeSequence: query.beforeSequence,
            pageSize: query.limit,
          });
          return { page: toMessagePageView(page) };
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

    app.post<{ Params: { messageId: string }; Body: unknown }>(
      "/v1/me/heavy-chat/messages/:messageId/actions",
      { preHandler: withInternalRequest },
      async (request, reply) => {
        const { userId } = assertUserContext(request);
        const payload = parseRequestBody(messageActionSchema, request.body);
        try {
          const result = await (await getService()).runMessageAction(userId, {
            messageId: request.params.messageId,
            type: payload.type,
          });
          const response = { result: toActionResultView(result) };
          return reply.status(result.action.status === "pending" ? 202 : 200).send(response);
        } catch (error) {
          throw normalizeHeavyChatError(error);
        }
      },
    );
  };
}

export const heavyChatRouter = createHeavyChatRouter();
