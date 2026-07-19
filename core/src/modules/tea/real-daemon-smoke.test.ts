import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { writeFile } from "node:fs/promises";

import Fastify from "fastify";

import { HttpError } from "../../platform/errors";

type JsonRecord = Record<string, unknown>;

describe("Platform Tea real daemon smoke", () => {
  it(
    "proxies a full ticket lifecycle through Platform Core to a real tea-daemon",
    async () => {
      const teaServerUrl = requireEnv("TEA_SERVER_URL");
      const teaAuthToken = requireEnv("TEA_AUTH_TOKEN");
      const internalApiToken = requireEnv("INTERNAL_API_TOKEN");
      process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
      process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

      const { createTeaRouter } = await import("./router");
      const app = Fastify({ logger: false });
      app.setErrorHandler((error, _request, reply) => {
        if (error instanceof HttpError) {
          return reply.status(error.statusCode).send({
            error: {
              code: error.code,
              message: error.message,
              moduleKey: error.moduleKey,
            },
          });
        }

        const message = error instanceof Error ? error.message : "Unexpected Platform Tea smoke error";
        return reply.status(500).send({
          error: {
            code: "BAD_REQUEST",
            message,
          },
        });
      });
      await app.register(createTeaRouter());

      try {
        const headers = { "x-internal-api-token": internalApiToken };
        const createResponse = await app.inject({
          method: "POST",
          url: "/internal/tea/tickets",
          headers,
          payload: {
            title: "Platform Tea real smoke",
            description: "Create a real Tea ticket through the Platform Core internal Tea proxy.",
          },
        });
        assert.equal(createResponse.statusCode, 200, createResponse.body);
        const created = createResponse.json() as { ticket: JsonRecord };
        const ticket = created.ticket;
        const ticketId = String(ticket.id || "");
        assert.match(ticketId, /^[0-9a-f-]{36}$/);
        assert.equal(ticket.status, "open");
        assert.equal(ticket.source, "human");

        const listResponse = await app.inject({
          method: "GET",
          url: "/internal/tea/tickets",
          headers,
        });
        assert.equal(listResponse.statusCode, 200, listResponse.body);
        const listed = listResponse.json() as { tickets: JsonRecord[] };
        assert.ok(listed.tickets.some((entry) => entry.id === ticketId));

        const getResponse = await app.inject({
          method: "GET",
          url: `/internal/tea/tickets/${ticketId}`,
          headers,
        });
        assert.equal(getResponse.statusCode, 200, getResponse.body);
        assert.equal((getResponse.json() as { ticket: JsonRecord }).ticket.id, ticketId);

        const cancelCreateResponse = await app.inject({
          method: "POST",
          url: "/internal/tea/tickets",
          headers,
          payload: {
            title: "Platform Tea cancel smoke",
            description: "Create a separate real Tea ticket to verify cancellation through Platform Core.",
          },
        });
        assert.equal(cancelCreateResponse.statusCode, 200, cancelCreateResponse.body);
        const cancelCreated = cancelCreateResponse.json() as { ticket: JsonRecord };
        const cancelledTicketId = String(cancelCreated.ticket.id || "");
        assert.match(cancelledTicketId, /^[0-9a-f-]{36}$/);

        const cancelResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${cancelledTicketId}/cancel`,
          headers,
        });
        assert.equal(cancelResponse.statusCode, 200, cancelResponse.body);
        assert.equal((cancelResponse.json() as { ticket: JsonRecord }).ticket.status, "cancelled");

        const cancelEventsResponse = await app.inject({
          method: "GET",
          url: `/internal/tea/tickets/${cancelledTicketId}/events`,
          headers,
        });
        assert.equal(cancelEventsResponse.statusCode, 200, cancelEventsResponse.body);
        const cancelEvents = (cancelEventsResponse.json() as { events: JsonRecord[] }).events;
        assert.ok(cancelEvents.some((event) => event.kind === "ticket_cancelled"));

        const rejectAfterCancelResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${cancelledTicketId}/reject`,
          headers,
          payload: { reason: "cancelled tickets must be immutable" },
        });
        assert.equal(rejectAfterCancelResponse.statusCode, 409, rejectAfterCancelResponse.body);

        const approveResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${ticketId}/approve`,
          headers,
        });
        assert.equal(approveResponse.statusCode, 200, approveResponse.body);
        assert.equal((approveResponse.json() as { ticket: JsonRecord }).ticket.status, "approved");

        const runResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${ticketId}/run`,
          headers,
        });
        assert.equal(runResponse.statusCode, 200, runResponse.body);
        const run = (runResponse.json() as { run: JsonRecord }).run;
        const runId = String(run.id || "");
        assert.match(runId, /^[0-9a-f-]{36}$/);
        assert.equal(run.status, "succeeded");

        const runsResponse = await app.inject({
          method: "GET",
          url: `/internal/tea/tickets/${ticketId}/runs`,
          headers,
        });
        assert.equal(runsResponse.statusCode, 200, runsResponse.body);
        const runs = (runsResponse.json() as { runs: JsonRecord[] }).runs;
        assert.ok(runs.some((entry) => entry.id === runId));

        const eventsResponse = await app.inject({
          method: "GET",
          url: `/internal/tea/tickets/${ticketId}/events`,
          headers,
        });
        assert.equal(eventsResponse.statusCode, 200, eventsResponse.body);
        const events = (eventsResponse.json() as { events: JsonRecord[] }).events;
        assert.ok(events.some((event) => event.kind === "ticket_created"));
        assert.ok(events.some((event) => event.kind === "run_succeeded"));

        const markdownResponse = await app.inject({
          method: "GET",
          url: `/internal/tea/tickets/${ticketId}/export/markdown`,
          headers,
        });
        assert.equal(markdownResponse.statusCode, 200, markdownResponse.body);
        const markdown = (markdownResponse.json() as { markdown: string }).markdown;
        assert.match(markdown, /TicketCreated/);
        assert.match(markdown, /mock loom run completed/);

        const closeResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${ticketId}/close`,
          headers,
        });
        assert.equal(closeResponse.statusCode, 200, closeResponse.body);
        assert.equal((closeResponse.json() as { ticket: JsonRecord }).ticket.status, "closed");

        const rejectAfterCloseResponse = await app.inject({
          method: "POST",
          url: `/internal/tea/tickets/${ticketId}/reject`,
          headers,
          payload: { reason: "closed tickets must be immutable" },
        });
        assert.equal(rejectAfterCloseResponse.statusCode, 409, rejectAfterCloseResponse.body);

        const result = {
          status: "passed",
          teaServerUrl,
          teaAuthTokenLength: teaAuthToken.length,
          ticketId,
          cancelledTicketId,
          runId,
          cancelledTicketStatus: "cancelled",
          cancelEventsIncludeCancelled: cancelEvents.some((event) => event.kind === "ticket_cancelled"),
          cancelMutationConflictStatus: rejectAfterCancelResponse.statusCode,
          eventCount: events.length,
          markdownContainsRunEvidence: markdown.includes("mock loom run completed"),
        };

        if (process.env.TEA_PLATFORM_REAL_SMOKE_RESULT_PATH) {
          await writeFile(process.env.TEA_PLATFORM_REAL_SMOKE_RESULT_PATH, JSON.stringify(result, null, 2), "utf8");
        }
      } finally {
        await app.close();
      }
    },
  );
});

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Platform Tea real smoke`);
  }
  return value;
}
