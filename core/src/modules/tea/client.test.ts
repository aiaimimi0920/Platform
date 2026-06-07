import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TeaUpstreamError, createTeaClient } from "./client";

type CapturedRequest = {
  url: string;
  init?: RequestInit;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Tea HTTP client", () => {
  it("sends bearer auth to ticket creation and returns JSON unchanged", async () => {
    const requests: CapturedRequest[] = [];
    const fetchFn = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: input.toString(), init });
      return jsonResponse({
        id: "ticket-1",
        title: "Platform ticket",
        status: "open",
      });
    };

    const client = createTeaClient({
      baseUrl: "http://tea.local/",
      authToken: "tea-token",
      fetchFn,
    });

    const result = await client.createTicket({
      title: "Platform ticket",
      description: "Created through Platform Core",
    });

    assert.deepEqual(result, {
      id: "ticket-1",
      title: "Platform ticket",
      status: "open",
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "http://tea.local/v1/tickets");
    assert.equal(requests[0]?.init?.method, "POST");
    assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
    assert.equal((requests[0]?.init?.headers as Record<string, string>)["content-type"], "application/json");
    assert.equal(
      requests[0]?.init?.body,
      JSON.stringify({
        title: "Platform ticket",
        description: "Created through Platform Core",
      }),
    );
  });

  it("preserves list ticket query parameters", async () => {
    const requests: CapturedRequest[] = [];
    const fetchFn = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: input.toString(), init });
      return jsonResponse([{ id: "ticket-1", status: "open" }]);
    };

    const client = createTeaClient({
      baseUrl: "http://tea.local/api",
      authToken: null,
      fetchFn,
    });

    const tickets = await client.listTickets({ status: "open", source: "hook" });

    assert.deepEqual(tickets, [{ id: "ticket-1", status: "open" }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "http://tea.local/api/v1/tickets?status=open&source=hook");
    assert.equal(requests[0]?.init?.method, "GET");
  });

  it("preserves upstream status and message for Tea JSON errors", async () => {
    const fetchFn = async (): Promise<Response> => jsonResponse({ error: "ticket is closed" }, 409);
    const client = createTeaClient({
      baseUrl: "http://tea.local",
      authToken: "tea-token",
      fetchFn,
    });

    await assert.rejects(
      () => client.approveTicket("ticket-1"),
      (error: unknown) => {
        assert.equal(error instanceof TeaUpstreamError, true);
        if (!(error instanceof TeaUpstreamError)) {
          return false;
        }
        assert.equal(error.statusCode, 409);
        assert.equal(error.message, "ticket is closed");
        return true;
      },
    );
  });

  it("posts ticket comments with bearer auth and one JSON body", async () => {
    const requests: CapturedRequest[] = [];
    const fetchFn = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: input.toString(), init });
      return jsonResponse({
        actor: { id: "local-user", kind: "human" },
        body: "Please attach validation evidence before approval.",
        id: "comment-1",
        ticket_id: "ticket-1",
      });
    };
    const client = createTeaClient({
      authToken: "tea-token",
      baseUrl: "http://tea.local/",
      fetchFn,
    });

    const result = await client.addComment("ticket-1", {
      body: "Please attach validation evidence before approval.",
    });

    assert.deepEqual(result, {
      actor: { id: "local-user", kind: "human" },
      body: "Please attach validation evidence before approval.",
      id: "comment-1",
      ticket_id: "ticket-1",
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "http://tea.local/v1/tickets/ticket-1/comments");
    assert.equal(requests[0]?.init?.method, "POST");
    assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
    assert.equal((requests[0]?.init?.headers as Record<string, string>)["content-type"], "application/json");
    assert.equal(
      requests[0]?.init?.body,
      JSON.stringify({ body: "Please attach validation evidence before approval." }),
    );
  });

  it("lists ticket comments with bearer auth", async () => {
    const requests: CapturedRequest[] = [];
    const fetchFn = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: input.toString(), init });
      return jsonResponse([
        {
          body: "Persisted review comment.",
          id: "comment-1",
          ticket_id: "ticket-1",
        },
      ]);
    };
    const client = createTeaClient({
      authToken: "tea-token",
      baseUrl: "http://tea.local/",
      fetchFn,
    });

    const result = await client.listComments("ticket-1");

    assert.deepEqual(result, [
      {
        body: "Persisted review comment.",
        id: "comment-1",
        ticket_id: "ticket-1",
      },
    ]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "http://tea.local/v1/tickets/ticket-1/comments");
    assert.equal(requests[0]?.init?.method, "GET");
    assert.equal((requests[0]?.init?.headers as Record<string, string>).authorization, "Bearer tea-token");
  });
});
