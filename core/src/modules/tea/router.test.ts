import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import Fastify from "fastify";

import { HttpError } from "../../platform/errors";
import { createTeaClient } from "./client";

type CapturedRequest = {
  url: string;
  init?: RequestInit;
};

function setCoreEnv() {
  process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.INTERNAL_API_TOKEN = "internal-token";
  process.env.TEA_SERVER_URL = "http://tea.local";
  process.env.TEA_AUTH_TOKEN = "tea-token";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function buildTeaTestServer(fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>) {
  const { createTeaRouter } = await import("./router");
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }
    const message = error instanceof Error ? error.message : "Unexpected test server error";
    return reply.status(500).send({
      error: { code: "BAD_REQUEST", message },
    });
  });
  await app.register(
    createTeaRouter({
      client: createTeaClient({
        baseUrl: "http://tea.local",
        authToken: "tea-token",
        fetchFn,
      }),
    }),
  );
  return app;
}

describe("Platform Tea router", () => {
  before(setCoreEnv);

  it("rejects missing internal API token", async () => {
    const app = await buildTeaTestServer(async () => jsonResponse([]));
    try {
      const response = await app.inject({
        method: "GET",
        url: "/internal/tea/tickets",
      });

      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "UNAUTHORIZED");
    } finally {
      await app.close();
    }
  });

  it("proxies ticket lists through Tea with the configured bearer token", async () => {
    const requests: CapturedRequest[] = [];
    const app = await buildTeaTestServer(async (input, init) => {
      requests.push({ url: input.toString(), init });
      return jsonResponse([{ id: "ticket-1", status: "open" }]);
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/internal/tea/tickets?status=open&source=hook",
        headers: { "x-internal-api-token": "internal-token" },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { tickets: [{ id: "ticket-1", status: "open" }] });
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://tea.local/v1/tickets?status=open&source=hook");
      assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
    } finally {
      await app.close();
    }
  });

  it("validates and forwards ticket rejection reasons", async () => {
    const requests: CapturedRequest[] = [];
    const app = await buildTeaTestServer(async (input, init) => {
      requests.push({ url: input.toString(), init });
      return jsonResponse({ id: "ticket-1", status: "needs_review" });
    });

    try {
      const invalid = await app.inject({
        method: "POST",
        url: "/internal/tea/tickets/ticket-1/reject",
        headers: { "x-internal-api-token": "internal-token" },
        payload: { reason: "" },
      });
      assert.equal(invalid.statusCode, 400);
      assert.equal(requests.length, 0);

      const valid = await app.inject({
        method: "POST",
        url: "/internal/tea/tickets/ticket-1/reject",
        headers: { "x-internal-api-token": "internal-token" },
        payload: { reason: "Plan needs clearer validation evidence" },
      });
      assert.equal(valid.statusCode, 200);
      assert.deepEqual(valid.json(), { ticket: { id: "ticket-1", status: "needs_review" } });
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://tea.local/v1/tickets/ticket-1/reject");
      assert.equal(
        requests[0]?.init?.body,
        JSON.stringify({ reason: "Plan needs clearer validation evidence" }),
      );
    } finally {
      await app.close();
    }
  });

  it("validates and forwards ticket comments", async () => {
    const requests: CapturedRequest[] = [];
    const app = await buildTeaTestServer(async (input, init) => {
      requests.push({ url: input.toString(), init });
      return jsonResponse({
        body: "Looks good after the latest validation pass.",
        id: "comment-1",
        ticket_id: "ticket-1",
      });
    });

    try {
      const invalid = await app.inject({
        headers: { "x-internal-api-token": "internal-token" },
        method: "POST",
        payload: { body: "" },
        url: "/internal/tea/tickets/ticket-1/comments",
      });
      assert.equal(invalid.statusCode, 400);
      assert.equal(requests.length, 0);

      const valid = await app.inject({
        headers: { "x-internal-api-token": "internal-token" },
        method: "POST",
        payload: { body: "Looks good after the latest validation pass." },
        url: "/internal/tea/tickets/ticket-1/comments",
      });
      assert.equal(valid.statusCode, 200);
      assert.deepEqual(valid.json(), {
        comment: {
          body: "Looks good after the latest validation pass.",
          id: "comment-1",
          ticket_id: "ticket-1",
        },
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://tea.local/v1/tickets/ticket-1/comments");
      assert.equal(
        requests[0]?.init?.body,
        JSON.stringify({ body: "Looks good after the latest validation pass." }),
      );
      assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
    } finally {
      await app.close();
    }
  });

  it("proxies ticket comment lists through Tea", async () => {
    const requests: CapturedRequest[] = [];
    const app = await buildTeaTestServer(async (input, init) => {
      requests.push({ url: input.toString(), init });
      return jsonResponse([
        {
          body: "Persisted review comment.",
          id: "comment-1",
          ticket_id: "ticket-1",
        },
      ]);
    });

    try {
      const response = await app.inject({
        headers: { "x-internal-api-token": "internal-token" },
        method: "GET",
        url: "/internal/tea/tickets/ticket-1/comments",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        comments: [
          {
            body: "Persisted review comment.",
            id: "comment-1",
            ticket_id: "ticket-1",
          },
        ],
      });
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://tea.local/v1/tickets/ticket-1/comments");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
    } finally {
      await app.close();
    }
  });
});
