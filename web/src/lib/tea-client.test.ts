import assert from "node:assert/strict";
import test from "node:test";

import type { InternalUserContext } from "@neuro/contracts";

import {
  addTeaTicketComment,
  createTeaTicket,
  exportTeaTicketJson,
  exportTeaTicketMarkdown,
  getTeaConfiguration,
  getTeaTicketComments,
  getTeaTicketRuns,
  getTeaStatus,
  listTeaTickets,
  rejectTeaTicket,
  retryTeaTicket,
  stopTeaTicket,
  TeaWebClientError,
  updateTeaConfiguration,
} from "./tea-client";

type CapturedRequest = {
  url: string;
  init?: RequestInit;
};

const userContext: InternalUserContext = {
  userId: "user-1",
  providerUserId: "linuxdo-1",
  username: "vmjcv",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getHeader(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] ?? null;
  }
  const value = (headers as Record<string, string>)[name] ?? (headers as Record<string, string>)[name.toLowerCase()];
  return value ?? null;
}

async function withCapturedFetch<T>(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
  operation: (requests: CapturedRequest[]) => Promise<T>,
): Promise<T> {
  const previousFetch = globalThis.fetch;
  const previousCoreUrl = process.env.CORE_INTERNAL_URL;
  const previousInternalToken = process.env.INTERNAL_API_TOKEN;
  const previousTeaToken = process.env.TEA_AUTH_TOKEN;
  const requests: CapturedRequest[] = [];

  process.env.CORE_INTERNAL_URL = "http://core-test.local";
  process.env.INTERNAL_API_TOKEN = "internal-token";
  process.env.TEA_AUTH_TOKEN = "tea-daemon-token-that-must-not-reach-web-fetch";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return handler(input, init);
  }) as typeof fetch;

  try {
    return await operation(requests);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("CORE_INTERNAL_URL", previousCoreUrl);
    restoreEnv("INTERNAL_API_TOKEN", previousInternalToken);
    restoreEnv("TEA_AUTH_TOKEN", previousTeaToken);
  }
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("listTeaTickets calls Platform Core internal Tea routes with user context but without Tea bearer auth", async () => {
  await withCapturedFetch(
    () => jsonResponse({ tickets: [{ id: "ticket-1", status: "open", source: "hook" }] }),
    async (requests) => {
      const tickets = await listTeaTickets(userContext, { status: "open", source: "hook" });

      assert.deepEqual(tickets, [{ id: "ticket-1", status: "open", source: "hook" }]);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets?status=open&source=hook");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal(getHeader(requests[0]?.init, "x-internal-api-token"), "internal-token");
      assert.equal(getHeader(requests[0]?.init, "x-neuro-user-id"), "user-1");
      assert.equal(getHeader(requests[0]?.init, "x-neuro-provider-user-id"), "linuxdo-1");
      assert.equal(getHeader(requests[0]?.init, "x-neuro-username"), "vmjcv");
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
    },
  );
});

test("Tea status and configuration helpers read ownership through Platform Core only", async () => {
  await withCapturedFetch(
    (input) => {
      const url = String(input);
      if (url.endsWith("/internal/tea/status")) {
        return jsonResponse({
          status: {
            service: "tea",
            status: "ok",
            configuration_source: "loom-managed",
            configuration: { owner: "loom", loom_panel_url: "loom://settings/tea" },
          },
        });
      }
      return jsonResponse({
        configuration: {
          configuration_source: "loom-managed",
          configuration: { owner: "loom", loom_panel_url: "loom://settings/tea" },
          config: { notifications_enabled: true },
        },
      });
    },
    async (requests) => {
      const status = await getTeaStatus(userContext);
      const configuration = await getTeaConfiguration(userContext);

      assert.equal(status.configuration_source, "loom-managed");
      assert.equal(configuration.configuration_source, "loom-managed");
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/status");
      assert.equal(requests[1]?.url, "http://core-test.local/internal/tea/configuration");
      assert.ok(requests.every((request) => getHeader(request.init, "authorization") === null));
    },
  );
});

test("updateTeaConfiguration writes through Platform Core without Tea bearer auth", async () => {
  await withCapturedFetch(
    () =>
      jsonResponse({
        configuration: {
          configuration_source: "local",
          config: {
            notifications_enabled: false,
            human_ticket_default_approval_policy: "human_before_execute",
            hook_ticket_default_approval_policy: "plan_only",
          },
        },
      }),
    async (requests) => {
      const configuration = await updateTeaConfiguration(userContext, {
        notifications_enabled: false,
        human_ticket_default_approval_policy: "human_before_execute",
        hook_ticket_default_approval_policy: "plan_only",
      });

      assert.equal(configuration.configuration_source, "local");
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/configuration");
      assert.equal(requests[0]?.init?.method, "PUT");
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
    },
  );
});

test("createTeaTicket sends one JSON object body through Platform Core", async () => {
  await withCapturedFetch(
    () => jsonResponse({ ticket: { id: "ticket-2", status: "open", title: "Implement Tea" } }),
    async (requests) => {
      const ticket = await createTeaTicket(userContext, {
        title: "Implement Tea",
        description: "Create the web entry for Tea tickets.",
      });

      assert.deepEqual(ticket, { id: "ticket-2", status: "open", title: "Implement Tea" });
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets");
      assert.equal(requests[0]?.init?.method, "POST");
      assert.equal(getHeader(requests[0]?.init, "content-type"), "application/json");
      assert.equal(
        requests[0]?.init?.body,
        JSON.stringify({
          title: "Implement Tea",
          description: "Create the web entry for Tea tickets.",
        }),
      );
      assert.notEqual(
        requests[0]?.init?.body,
        JSON.stringify(
          JSON.stringify({
            title: "Implement Tea",
            description: "Create the web entry for Tea tickets.",
          }),
        ),
      );
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
    },
  );
});

test("Tea Web client preserves Platform Core error status and code", async () => {
  await withCapturedFetch(
    () =>
      jsonResponse(
        {
          error: {
            code: "TEA_UPSTREAM_ERROR",
            message: "invalid ticket transition: cannot mutate closed ticket",
          },
        },
        409,
      ),
    async () => {
      await assert.rejects(
        () =>
          createTeaTicket(userContext, {
            title: "Closed",
            description: "This request will fail in the mocked Core route.",
          }),
        (error: unknown) => {
          assert.ok(error instanceof TeaWebClientError);
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "TEA_UPSTREAM_ERROR");
          assert.match(error.message, /cannot mutate closed ticket/);
          return true;
        },
      );
    },
  );
});

test("getTeaTicketRuns reads run evidence through Platform Core without Tea bearer auth", async () => {
  await withCapturedFetch(
    () =>
      jsonResponse({
        runs: [
          {
            evidence: { summary: "Loom finished the requested work." },
            id: "run-1",
            status: "succeeded",
            ticket_id: "ticket-1",
          },
        ],
      }),
    async (requests) => {
      const runs = await getTeaTicketRuns(userContext, "ticket-1");

      assert.deepEqual(runs, [
        {
          evidence: { summary: "Loom finished the requested work." },
          id: "run-1",
          status: "succeeded",
          ticket_id: "ticket-1",
        },
      ]);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/runs");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal(getHeader(requests[0]?.init, "x-internal-api-token"), "internal-token");
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
    },
  );
});

test("Tea export helpers read JSON and Markdown exports through Platform Core only", async () => {
  await withCapturedFetch(
    (input) => {
      const url = String(input);
      if (url.endsWith("/export/json")) {
        return jsonResponse({
          export: {
            events: [{ id: "event-1", kind: "ticket_created" }],
            ticket: { id: "ticket-1", status: "closed" },
          },
        });
      }
      return jsonResponse({ markdown: "# Tea Ticket\n\n- run: succeeded" });
    },
    async (requests) => {
      const jsonExport = await exportTeaTicketJson(userContext, "ticket-1");
      const markdownExport = await exportTeaTicketMarkdown(userContext, "ticket-1");

      assert.deepEqual(jsonExport, {
        events: [{ id: "event-1", kind: "ticket_created" }],
        ticket: { id: "ticket-1", status: "closed" },
      });
      assert.equal(markdownExport, "# Tea Ticket\n\n- run: succeeded");
      assert.equal(requests.length, 2);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/export/json");
      assert.equal(requests[1]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/export/markdown");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal(requests[1]?.init?.method, "GET");
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
      assert.equal(getHeader(requests[1]?.init, "authorization"), null);
    },
  );
});

test("Tea review action helpers call Platform Core without Tea bearer auth", async () => {
  await withCapturedFetch(
    (input) => {
      const url = String(input);
      if (url.endsWith("/comments")) {
        return jsonResponse({
          comment: {
            body: "Please attach validation evidence.",
            id: "comment-1",
            ticket_id: "ticket-1",
          },
        });
      }
      if (url.endsWith("/reject")) {
        return jsonResponse({ ticket: { id: "ticket-1", status: "needs_info" } });
      }
      if (url.endsWith("/stop")) {
        return jsonResponse({ run: { id: "run-1", status: "stopped", ticket_id: "ticket-1" } });
      }
      return jsonResponse({ run: { id: "run-2", status: "retrying", ticket_id: "ticket-1" } });
    },
    async (requests) => {
      const comment = await addTeaTicketComment(userContext, "ticket-1", {
        body: "Please attach validation evidence.",
      });
      const rejectedTicket = await rejectTeaTicket(userContext, "ticket-1", {
        reason: "Plan needs a safer rollback step.",
      });
      const stoppedRun = await stopTeaTicket(userContext, "ticket-1");
      const retriedRun = await retryTeaTicket(userContext, "ticket-1");

      assert.deepEqual(comment, {
        body: "Please attach validation evidence.",
        id: "comment-1",
        ticket_id: "ticket-1",
      });
      assert.deepEqual(rejectedTicket, { id: "ticket-1", status: "needs_info" });
      assert.deepEqual(stoppedRun, { id: "run-1", status: "stopped", ticket_id: "ticket-1" });
      assert.deepEqual(retriedRun, { id: "run-2", status: "retrying", ticket_id: "ticket-1" });
      assert.equal(requests.length, 4);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/comments");
      assert.equal(requests[1]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/reject");
      assert.equal(requests[2]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/stop");
      assert.equal(requests[3]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/retry");
      assert.equal(requests[0]?.init?.method, "POST");
      assert.equal(requests[1]?.init?.method, "POST");
      assert.equal(requests[2]?.init?.method, "POST");
      assert.equal(requests[3]?.init?.method, "POST");
      assert.equal(requests[0]?.init?.body, JSON.stringify({ body: "Please attach validation evidence." }));
      assert.equal(requests[1]?.init?.body, JSON.stringify({ reason: "Plan needs a safer rollback step." }));
      assert.ok(requests.every((request) => getHeader(request.init, "authorization") === null));
    },
  );
});

test("getTeaTicketComments reads persisted review comments through Platform Core only", async () => {
  await withCapturedFetch(
    () =>
      jsonResponse({
        comments: [
          {
            body: "Persisted review comment.",
            id: "comment-1",
            ticket_id: "ticket-1",
          },
        ],
      }),
    async (requests) => {
      const comments = await getTeaTicketComments(userContext, "ticket-1");

      assert.deepEqual(comments, [
        {
          body: "Persisted review comment.",
          id: "comment-1",
          ticket_id: "ticket-1",
        },
      ]);
      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.url, "http://core-test.local/internal/tea/tickets/ticket-1/comments");
      assert.equal(requests[0]?.init?.method, "GET");
      assert.equal(getHeader(requests[0]?.init, "authorization"), null);
    },
  );
});
