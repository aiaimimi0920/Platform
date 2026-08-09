import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import Fastify from "fastify";

import { HeavyChatActionExecutionError } from "./action-bridge";
import { GatewayClientError } from "./gateway-client";
import { HeavyChatOwnershipError } from "./types";
import { HttpError } from "../../platform/errors";

process.env.DATABASE_URL ??= "postgres://neuro:test@127.0.0.1:1/neuro_test";
process.env.REDIS_URL ??= "redis://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";

const NOW = new Date("2026-07-19T08:00:00.000Z");

function slotRecord(ownerUserId = "user-a") {
  return {
    id: "slot-1",
    ownerUserId,
    slotKey: "mimi",
    kind: "default" as const,
    title: "Mimi",
    personaLabel: "Default heavy chat",
    summary: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function bindingRecord(ownerUserId = "user-a", slotId = "slot-1", agentId = "agent-heavy-1") {
  return {
    id: "binding-1",
    ownerUserId,
    slotId,
    agentId,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function threadRecord(ownerUserId = "user-a") {
  return {
    id: "thread-1",
    ownerUserId,
    slotId: "slot-1",
    projectId: null as string | null,
    title: "First thread",
    favorite: false,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function messageRecord(
  role: "user" | "assistant" = "assistant",
  status: "pending" | "streaming" | "complete" | "failed" = "complete",
) {
  return {
    id: role === "user" ? "message-user-1" : "message-assistant-1",
    ownerUserId: "user-a",
    threadId: "thread-1",
    role,
    status,
    sequence: role === "user" ? 1 : 2,
    attemptNumber: role === "user" ? 0 : 1,
    content: role === "user" ? "Hello" : "Hello from Gateway",
    references: [],
    actions: [],
    idempotencyKey: role === "user" ? "heavy-chat:user:send-1" : "heavy-chat:assistant:message-user-1",
    errorCode: status === "failed" ? "unavailable" : null,
    errorMessage: status === "failed" ? "Gateway unavailable" : null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function attemptRecord() {
  return {
    id: "attempt-1",
    ownerUserId: "user-a",
    messageId: "message-assistant-1",
    idempotencyKey: "heavy-chat:attempt:message-assistant-1:send-1",
    attemptNumber: 1,
    createdAt: NOW,
  };
}

type RouterService = {
  getSnapshot(ownerUserId: string): Promise<{
    slots: ReturnType<typeof slotRecord>[];
    projects: never[];
    slotProjects: never[];
    bindings: never[];
    threads: ReturnType<typeof threadRecord>[];
    messages: ReturnType<typeof messageRecord>[];
    messagePages: Array<{ threadId: string; hasMore: boolean; nextBeforeSequence: number | null }>;
  }>;
  getMessagePage(
    ownerUserId: string,
    threadId: string,
    options?: { beforeSequence?: number; pageSize?: number },
  ): Promise<{
    threadId: string;
    messages: ReturnType<typeof messageRecord>[];
    hasMore: boolean;
    nextBeforeSequence: number | null;
  }>;
  bindManagedAgent(
    ownerUserId: string,
    slotId: string,
    agentId: string,
  ): Promise<ReturnType<typeof bindingRecord>>;
  createThread(
    ownerUserId: string,
    input: { slotId: string; projectId?: string | null; title: string },
  ): Promise<ReturnType<typeof threadRecord>>;
  sendMessage(
    ownerUserId: string,
    input: { threadId: string; content: string; idempotencyKey: string; correlationId: string },
  ): Promise<{
    userMessage: ReturnType<typeof messageRecord>;
    assistantMessage: ReturnType<typeof messageRecord>;
    attempt: ReturnType<typeof attemptRecord>;
    created: boolean;
  }>;
  retryMessage(
    ownerUserId: string,
    input: { messageId: string; idempotencyKey: string; correlationId: string },
  ): Promise<{
    assistantMessage: ReturnType<typeof messageRecord>;
    attempt: ReturnType<typeof attemptRecord>;
    created: boolean;
  }>;
  runMessageAction(
    ownerUserId: string,
    input: { messageId: string; type: "task" | "mailbox" },
  ): Promise<{
    action: {
      id: string;
      type: "task" | "mailbox";
      status: "pending" | "complete" | "failed";
      attemptNumber: number;
      targetId: string | null;
      errorMessage: string | null;
      updatedAt: string;
    };
    target: { id: string; type: "task" | "mailbox"; href: string } | null;
    executed: boolean;
    created: boolean;
  }>;
};

function createRouterService(overrides: Partial<RouterService> = {}): RouterService {
  return {
    async getSnapshot(ownerUserId) {
      return {
        slots: [slotRecord(ownerUserId)],
        projects: [],
        slotProjects: [],
        bindings: [],
        threads: [threadRecord(ownerUserId)],
        messages: [messageRecord()],
        messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
      };
    },
    async getMessagePage(_ownerUserId, threadId) {
      return {
        threadId,
        messages: [messageRecord()],
        hasMore: false,
        nextBeforeSequence: null,
      };
    },
    async bindManagedAgent(ownerUserId, slotId, agentId) {
      return bindingRecord(ownerUserId, slotId, agentId);
    },
    async createThread(ownerUserId, input) {
      return { ...threadRecord(ownerUserId), slotId: input.slotId, projectId: input.projectId ?? null, title: input.title };
    },
    async sendMessage() {
      return {
        userMessage: messageRecord("user"),
        assistantMessage: messageRecord("assistant"),
        attempt: attemptRecord(),
        created: true,
      };
    },
    async retryMessage() {
      return {
        assistantMessage: messageRecord("assistant"),
        attempt: attemptRecord(),
        created: true,
      };
    },
    async runMessageAction(_ownerUserId, input) {
      return {
        action: {
          id: "action-1",
          type: input.type,
          status: "complete" as const,
          attemptNumber: 1,
          targetId: "target-1",
          errorMessage: null,
          updatedAt: NOW.toISOString(),
        },
        target: { id: "target-1", type: input.type, href: "/target/target-1" },
        executed: true,
        created: true,
      };
    },
    ...overrides,
  };
}

async function buildRouterTestServer(service: RouterService) {
  const { createHeavyChatRouter } = await import("./router");
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    return reply.status(500).send({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
    });
  });
  await app.register(createHeavyChatRouter({ service }));
  return app;
}

function authHeaders(userId = "user-a") {
  return {
    "x-internal-api-token": "test-internal-token",
    "x-neuro-user-id": userId,
  };
}

describe("heavy chat router", () => {
  before(() => {
    process.env.INTERNAL_API_TOKEN = "test-internal-token";
  });

  it("rejects requests without the internal API token", async () => {
    const app = await buildRouterTestServer(createRouterService());
    try {
      const response = await app.inject({ method: "GET", url: "/v1/me/heavy-chat/snapshot" });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "UNAUTHORIZED");
    } finally {
      await app.close();
    }
  });

  it("loads only the authenticated owner's snapshot and serializes dates", async () => {
    let capturedOwner = "";
    const service = createRouterService({
      async getSnapshot(ownerUserId) {
        capturedOwner = ownerUserId;
        return {
          slots: [slotRecord(ownerUserId)],
          projects: [],
          slotProjects: [],
          bindings: [],
          threads: [threadRecord(ownerUserId)],
          messages: [messageRecord()],
          messagePages: [{ threadId: "thread-1", hasMore: false, nextBeforeSequence: null }],
        };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/me/heavy-chat/snapshot?ownerUserId=user-b",
        headers: authHeaders("user-a"),
      });

      assert.equal(response.statusCode, 200);
      assert.equal(capturedOwner, "user-a");
      assert.equal(response.json().snapshot.slots[0].ownerUserId, "user-a");
      assert.equal(response.json().snapshot.slots[0].createdAt, NOW.toISOString());
      assert.equal(response.json().snapshot.messages[0].updatedAt, NOW.toISOString());
      assert.equal(response.json().snapshot.messagePages[0].threadId, "thread-1");
    } finally {
      await app.close();
    }
  });

  it("binds a managed-heavy agent to an owner-scoped slot and serializes the binding", async () => {
    let captured: { ownerUserId: string; slotId: string; agentId: string } | null = null;
    const service = createRouterService({
      async bindManagedAgent(ownerUserId, slotId, agentId) {
        captured = { ownerUserId, slotId, agentId };
        return bindingRecord(ownerUserId, slotId, agentId);
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "PUT",
        url: "/v1/me/heavy-chat/slots/slot-1/agent-binding",
        headers: authHeaders("user-a"),
        payload: { agentId: "agent-heavy-1", ownerUserId: "user-b" },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(captured, {
        ownerUserId: "user-a",
        slotId: "slot-1",
        agentId: "agent-heavy-1",
      });
      assert.equal(response.json().binding.ownerUserId, "user-a");
      assert.equal(response.json().binding.createdAt, NOW.toISOString());
    } finally {
      await app.close();
    }
  });

  it("loads an owner-scoped message page with validated keyset options", async () => {
    let captured: { ownerUserId: string; threadId: string; options?: { beforeSequence?: number; pageSize?: number } } | null = null;
    const service = createRouterService({
      async getMessagePage(ownerUserId, threadId, options) {
        captured = { ownerUserId, threadId, options };
        return {
          threadId,
          messages: [messageRecord("user")],
          hasMore: true,
          nextBeforeSequence: 7,
        };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/me/heavy-chat/threads/thread-1/messages?beforeSequence=42&limit=20",
        headers: authHeaders("user-a"),
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(captured, {
        ownerUserId: "user-a",
        threadId: "thread-1",
        options: { beforeSequence: 42, pageSize: 20 },
      });
      assert.equal(response.json().page.messages[0].createdAt, NOW.toISOString());
      assert.equal(response.json().page.hasMore, true);
      assert.equal(response.json().page.nextBeforeSequence, 7);
    } finally {
      await app.close();
    }
  });

  it("rejects invalid message page queries before calling the service", async () => {
    let called = false;
    const service = createRouterService({
      async getMessagePage() {
        called = true;
        return { threadId: "thread-1", messages: [], hasMore: false, nextBeforeSequence: null };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      for (const query of [
        "limit=0",
        "limit=101",
        "limit=1.5",
        "beforeSequence=0",
        "beforeSequence=-1",
        "beforeSequence=1.5",
        "beforeSequence=invalid",
      ]) {
        const response = await app.inject({
          method: "GET",
          url: `/v1/me/heavy-chat/threads/thread-1/messages?${query}`,
          headers: authHeaders(),
        });
        assert.equal(response.statusCode, 400, query);
      }
      assert.equal(called, false);
    } finally {
      await app.close();
    }
  });

  it("creates threads for the authenticated owner and ignores body owner fields", async () => {
    let capturedOwner = "";
    const service = createRouterService({
      async createThread(ownerUserId, input) {
        capturedOwner = ownerUserId;
        return { ...threadRecord(ownerUserId), slotId: input.slotId, title: input.title };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads",
        headers: authHeaders("user-a"),
        payload: {
          ownerUserId: "user-b",
          slotId: "slot-1",
          projectId: null,
          title: "Persisted thread",
        },
      });

      assert.equal(response.statusCode, 201);
      assert.equal(capturedOwner, "user-a");
      assert.equal(response.json().thread.ownerUserId, "user-a");
      assert.equal(response.json().thread.title, "Persisted thread");
    } finally {
      await app.close();
    }
  });

  it("rejects blank message content before calling the service", async () => {
    let sendCalls = 0;
    const service = createRouterService({
      async sendMessage() {
        sendCalls += 1;
        throw new Error("must not run");
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads/thread-1/messages",
        headers: authHeaders(),
        payload: { content: "   ", idempotencyKey: "send-1" },
      });

      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "BAD_REQUEST");
      assert.equal(sendCalls, 0);
    } finally {
      await app.close();
    }
  });

  it("forwards stable idempotency and correlation identifiers", async () => {
    const inputs: Array<{ idempotencyKey: string; correlationId: string }> = [];
    const service = createRouterService({
      async sendMessage(_ownerUserId, input) {
        inputs.push(input);
        return {
          userMessage: messageRecord("user"),
          assistantMessage: messageRecord("assistant"),
          attempt: attemptRecord(),
          created: inputs.length === 1,
        };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const payload = {
        content: "Hello",
        idempotencyKey: "send-stable",
        correlationId: "corr-stable",
      };
      const first = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads/thread-1/messages",
        headers: authHeaders(),
        payload,
      });
      const replay = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads/thread-1/messages",
        headers: authHeaders(),
        payload,
      });

      assert.equal(first.statusCode, 200);
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.json().result.created, false);
      assert.deepEqual(inputs, [
        { threadId: "thread-1", ...payload },
        { threadId: "thread-1", ...payload },
      ]);
    } finally {
      await app.close();
    }
  });

  it("generates a correlation id when the client omits one", async () => {
    let correlationId = "";
    const service = createRouterService({
      async sendMessage(_ownerUserId, input) {
        correlationId = input.correlationId;
        return {
          userMessage: messageRecord("user"),
          assistantMessage: messageRecord("assistant"),
          attempt: attemptRecord(),
          created: true,
        };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads/thread-1/messages",
        headers: authHeaders(),
        payload: { content: "Hello", idempotencyKey: "send-generated-correlation" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(correlationId, /^[0-9a-f-]{36}$/i);
    } finally {
      await app.close();
    }
  });

  it("does not let an owner retry another owner's message", async () => {
    const service = createRouterService({
      async retryMessage() {
        throw new HeavyChatOwnershipError("Heavy chat assistant message does not belong to the owner");
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/messages/message-user-b/retry",
        headers: authHeaders("user-a"),
        payload: { idempotencyKey: "retry-1" },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error.code, "NOT_FOUND");
    } finally {
      await app.close();
    }
  });

  it("preserves Gateway failure HTTP semantics without exposing a success response", async () => {
    const service = createRouterService({
      async sendMessage() {
        throw new GatewayClientError({
          code: "unavailable",
          message: "Gateway unavailable",
          correlationId: "corr-failed",
          requestId: "request-failed",
          statusCode: 503,
        });
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/threads/thread-1/messages",
        headers: authHeaders(),
        payload: { content: "Hello", idempotencyKey: "send-failed", correlationId: "corr-failed" },
      });

      assert.equal(response.statusCode, 503);
      assert.deepEqual(response.json(), {
        error: { code: "INTERNAL_SERVER_ERROR", message: "Gateway unavailable" },
      });
    } finally {
      await app.close();
    }
  });

  it("runs an owner-scoped task or mailbox action and returns its target", async () => {
    let capturedOwner = "";
    let capturedInput: { messageId: string; type: "task" | "mailbox" } | null = null;
    const service = createRouterService({
      async runMessageAction(ownerUserId, input) {
        capturedOwner = ownerUserId;
        capturedInput = input;
        return {
          action: {
            id: "action-1",
            type: input.type,
            status: "complete" as const,
            attemptNumber: 1,
            targetId: "task-1",
            errorMessage: null,
            updatedAt: NOW.toISOString(),
          },
          target: { id: "task-1", type: input.type, href: "/my-tasks#task-task-1" },
          executed: true,
          created: true,
        };
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/messages/message-assistant-1/actions",
        headers: authHeaders("user-a"),
        payload: { type: "task" },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(capturedOwner, "user-a");
      assert.deepEqual(capturedInput, { messageId: "message-assistant-1", type: "task" });
      assert.equal(response.json().result.target.href, "/my-tasks#task-task-1");
    } finally {
      await app.close();
    }
  });

  it("redacts action execution failures at the Core HTTP boundary", async () => {
    const service = createRouterService({
      async runMessageAction() {
        throw new HeavyChatActionExecutionError(
          "mailbox",
          new Error("ECONNREFUSED postgres://user:secret@10.0.0.9/platform"),
        );
      },
    });
    const app = await buildRouterTestServer(service);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/me/heavy-chat/messages/message-assistant-1/actions",
        headers: authHeaders(),
        payload: { type: "mailbox" },
      });

      assert.equal(response.statusCode, 503);
      assert.doesNotMatch(response.body, /secret|10\.0\.0\.9|postgres:\/\//i);
      assert.match(response.body, /mailbox draft action failed/i);
    } finally {
      await app.close();
    }
  });
});
