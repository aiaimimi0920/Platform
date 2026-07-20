import assert from "node:assert/strict";
import test from "node:test";

import type {
  HeavyChatMessageAttemptResult,
  HeavyChatSendMessageResult,
  HeavyChatSnapshot,
  InternalUserContext,
} from "@neuro/contracts";

import {
  createHeavyChatThread,
  getHeavyChatSnapshot,
  HeavyChatWebClientError,
  retryHeavyChatMessage,
  sendHeavyChatMessage,
} from "./heavy-chat-client";

type CapturedRequest = {
  url: string;
  init?: RequestInit;
};

const userContext: InternalUserContext = {
  userId: "user-1",
  providerUserId: "provider-1",
  username: "alice",
};

const snapshot: HeavyChatSnapshot = {
  slots: [],
  projects: [],
  slotProjects: [],
  bindings: [],
  threads: [],
  messages: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readHeader(init: RequestInit | undefined, name: string) {
  const headers = new Headers(init?.headers);
  return headers.get(name);
}

async function withCapturedFetch<T>(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
  operation: (requests: CapturedRequest[]) => Promise<T>,
) {
  const previousFetch = globalThis.fetch;
  const previousCoreUrl = process.env.CORE_INTERNAL_URL;
  const previousInternalToken = process.env.INTERNAL_API_TOKEN;
  const requests: CapturedRequest[] = [];

  process.env.CORE_INTERNAL_URL = "http://core-heavy-chat.local";
  process.env.INTERNAL_API_TOKEN = "internal-token";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return handler(input, init);
  }) as typeof fetch;

  try {
    return await operation(requests);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCoreUrl === undefined) delete process.env.CORE_INTERNAL_URL;
    else process.env.CORE_INTERNAL_URL = previousCoreUrl;
    if (previousInternalToken === undefined) delete process.env.INTERNAL_API_TOKEN;
    else process.env.INTERNAL_API_TOKEN = previousInternalToken;
  }
}

test("heavy chat snapshot request sends only internal and authenticated user context", async () => {
  await withCapturedFetch(
    () => jsonResponse({ snapshot }),
    async (requests) => {
      assert.deepEqual(await getHeavyChatSnapshot(userContext), snapshot);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-heavy-chat.local/v1/me/heavy-chat/snapshot");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal(readHeader(requests[0]?.init, "x-internal-api-token"), "internal-token");
      assert.equal(readHeader(requests[0]?.init, "x-neuro-user-id"), "user-1");
      assert.equal(readHeader(requests[0]?.init, "x-neuro-provider-user-id"), "provider-1");
      assert.equal(readHeader(requests[0]?.init, "x-neuro-username"), "alice");
      assert.equal(readHeader(requests[0]?.init, "authorization"), null);
    },
  );
});

test("heavy chat mutations use the canonical Core paths and JSON envelopes", async () => {
  const thread = {
    id: "thread-1",
    ownerUserId: "user-1",
    slotId: "slot-1",
    projectId: null,
    title: "Thread",
    favorite: false,
    sortOrder: 0,
    createdAt: "2026-07-19T08:00:00.000Z",
    updatedAt: "2026-07-19T08:00:00.000Z",
  };
  const message = {
    id: "message-1",
    ownerUserId: "user-1",
    threadId: "thread-1",
    role: "assistant" as const,
    status: "complete" as const,
    sequence: 2,
    attemptNumber: 1,
    content: "Done",
    references: [],
    actions: [],
    idempotencyKey: "message-key",
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-07-19T08:00:00.000Z",
    updatedAt: "2026-07-19T08:00:00.000Z",
  };
  const attempt = {
    id: "attempt-1",
    ownerUserId: "user-1",
    messageId: "message-1",
    idempotencyKey: "attempt-key",
    attemptNumber: 1,
    createdAt: "2026-07-19T08:00:00.000Z",
  };
  const sendResult: HeavyChatSendMessageResult = {
    userMessage: { ...message, id: "message-user-1", role: "user", sequence: 1 },
    assistantMessage: message,
    attempt,
    created: true,
  };
  const retryResult: HeavyChatMessageAttemptResult = {
    assistantMessage: message,
    attempt,
    created: true,
  };

  await withCapturedFetch(
    (input) => {
      const url = String(input);
      if (url.endsWith("/threads")) return jsonResponse({ thread }, 201);
      if (url.endsWith("/retry")) return jsonResponse({ result: retryResult });
      return jsonResponse({ result: sendResult });
    },
    async (requests) => {
      assert.deepEqual(
        await createHeavyChatThread(userContext, {
          slotId: "slot-1",
          projectId: null,
          title: "Thread",
        }),
        thread,
      );
      assert.deepEqual(
        await sendHeavyChatMessage(userContext, "thread-1", {
          content: "Hello",
          idempotencyKey: "send-1",
          correlationId: "corr-send-1",
        }),
        sendResult,
      );
      assert.deepEqual(
        await retryHeavyChatMessage(userContext, "message-1", {
          idempotencyKey: "retry-1",
          correlationId: "corr-retry-1",
        }),
        retryResult,
      );

      assert.equal(requests[0]?.url, "http://core-heavy-chat.local/v1/me/heavy-chat/threads");
      assert.equal(requests[1]?.url, "http://core-heavy-chat.local/v1/me/heavy-chat/threads/thread-1/messages");
      assert.equal(requests[2]?.url, "http://core-heavy-chat.local/v1/me/heavy-chat/messages/message-1/retry");
      assert.ok(requests.every((request) => request.init?.method === "POST"));
      assert.equal(
        requests[0]?.init?.body,
        JSON.stringify({ slotId: "slot-1", projectId: null, title: "Thread" }),
      );
      assert.equal(
        requests[1]?.init?.body,
        JSON.stringify({ content: "Hello", idempotencyKey: "send-1", correlationId: "corr-send-1" }),
      );
      assert.equal(
        requests[2]?.init?.body,
        JSON.stringify({ idempotencyKey: "retry-1", correlationId: "corr-retry-1" }),
      );
    },
  );
});

test("heavy chat client preserves Core status, code, and safe message", async () => {
  await withCapturedFetch(
    () => jsonResponse({ error: { code: "QUOTA_EXCEEDED", message: "Provider quota exceeded" } }, 429),
    async () => {
      await assert.rejects(
        () =>
          sendHeavyChatMessage(userContext, "thread-1", {
            content: "Hello",
            idempotencyKey: "send-quota",
          }),
        (error: unknown) => {
          assert.ok(error instanceof HeavyChatWebClientError);
          assert.equal(error.statusCode, 429);
          assert.equal(error.code, "QUOTA_EXCEEDED");
          assert.equal(error.message, "Provider quota exceeded");
          return true;
        },
      );
    },
  );
});
