import assert from "node:assert/strict";
import test from "node:test";

import type { InternalUserContext } from "@neuro/contracts";

import {
  handleAddTeaTicketCommentRequest,
  handleApproveTeaTicketRequest,
  handleCreateTeaTicketRequest,
  handleDownloadTeaTicketJsonRequest,
  handleDownloadTeaTicketMarkdownRequest,
  handleExportTeaTicketJsonRequest,
  handleExportTeaTicketMarkdownRequest,
  handleGetTeaTicketRequest,
  handleGetTeaTicketCommentsRequest,
  handleGetTeaTicketRunsRequest,
  handleRejectTeaTicketRequest,
  handleRetryTeaTicketRequest,
  handleRunTeaTicketRequest,
  handleStopTeaTicketRequest,
  handleListTeaTicketsRequest,
} from "./tea-api-handlers";
import {
  TeaWebClientError,
  type CreateTeaTicketInput,
  type TeaTicketListQuery,
  type TeaRunView,
  type TeaTicketCommentView,
  type TeaTicketView,
  type TeaTicketEventView,
} from "./tea-client";

const userContext: InternalUserContext = {
  providerUserId: "provider-user-1",
  userId: "user-1",
  username: "alice",
};

const noStoreHeader = "no-store, no-cache, must-revalidate";

test("handleListTeaTicketsRequest forwards browser filters to Platform Core client and disables caching", async () => {
  let receivedQuery: TeaTicketListQuery | undefined;
  let receivedUserContext: InternalUserContext | undefined;
  const ticket: TeaTicketView = {
    id: "ticket-1",
    source: "hook",
    status: "open",
    title: "Hook ticket",
  };

  const response = await handleListTeaTicketsRequest(
    new Request("https://platform.local/api/tea/tickets?status=open&source=hook"),
    {
      listTeaTickets: async (context, query) => {
        receivedUserContext = context;
        receivedQuery = query;
        return [ticket];
      },
      requireUserContext: async () => userContext,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), noStoreHeader);
  assert.deepEqual(receivedUserContext, userContext);
  assert.deepEqual(receivedQuery, { source: "hook", status: "open" });
  assert.deepEqual(await response.json(), { tickets: [ticket] });
});

test("handleCreateTeaTicketRequest validates and trims create payloads before calling Platform Core client", async () => {
  let receivedInput: CreateTeaTicketInput | undefined;
  const ticket: TeaTicketView = {
    id: "ticket-2",
    status: "open",
    title: "Fix Hook upload",
  };

  const response = await handleCreateTeaTicketRequest(
    new Request("https://platform.local/api/tea/tickets", {
      body: JSON.stringify({
        description: "  Investigate failed screenshot upload and provide evidence.  ",
        title: "  Fix Hook upload  ",
      }),
      method: "POST",
    }),
    {
      createTeaTicket: async (_context, input) => {
        receivedInput = input;
        return ticket;
      },
      requireUserContext: async () => userContext,
    },
  );

  assert.equal(response.status, 201);
  assert.deepEqual(receivedInput, {
    description: "Investigate failed screenshot upload and provide evidence.",
    title: "Fix Hook upload",
  });
  assert.deepEqual(await response.json(), { ticket });
});

test("handleCreateTeaTicketRequest rejects invalid browser payloads without calling Platform Core", async () => {
  let createCalls = 0;

  const response = await handleCreateTeaTicketRequest(
    new Request("https://platform.local/api/tea/tickets", {
      body: JSON.stringify({ description: "too short", title: "no" }),
      method: "POST",
    }),
    {
      createTeaTicket: async () => {
        createCalls += 1;
        return { id: "unexpected" };
      },
      requireUserContext: async () => userContext,
    },
  );

  assert.equal(response.status, 400);
  assert.equal(createCalls, 0);
  assert.match((await response.json()).error, /title/i);
});

test("Tea API handlers map auth and Core Tea failures to browser-safe JSON responses", async () => {
  const unauthenticated = await handleListTeaTicketsRequest(new Request("https://platform.local/api/tea/tickets"), {
    listTeaTickets: async () => [],
    requireUserContext: async () => {
      throw new Error("Authentication required");
    },
  });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), { error: "Authentication required" });

  const upstreamFailure = await handleListTeaTicketsRequest(new Request("https://platform.local/api/tea/tickets"), {
    listTeaTickets: async () => {
      throw new TeaWebClientError(409, "Ticket is closed", "ticket_terminal", {
        error: { code: "ticket_terminal", message: "Ticket is closed" },
      });
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(upstreamFailure.status, 409);
  assert.deepEqual(await upstreamFailure.json(), {
    code: "ticket_terminal",
    error: "Ticket is closed",
  });
});

test("handleGetTeaTicketRequest returns ticket detail and events for a browser ticket page", async () => {
  let requestedTicketId: string | undefined;
  const ticket: TeaTicketView = {
    id: "ticket-detail-1",
    status: "approved",
    title: "Detail ticket",
  };
  const events: TeaTicketEventView[] = [
    { id: "event-1", kind: "ticket_created", ticket_id: "ticket-detail-1" },
    { id: "event-2", kind: "ticket_approved", ticket_id: "ticket-detail-1" },
  ];
  const comments: TeaTicketCommentView[] = [
    {
      body: "Reviewer asked for final smoke evidence.",
      id: "comment-1",
      ticket_id: "ticket-detail-1",
    },
  ];

  const response = await handleGetTeaTicketRequest("ticket-detail-1", {
    getTeaTicketComments: async (_context, ticketId) => {
      assert.equal(ticketId, "ticket-detail-1");
      return comments;
    },
    getTeaTicket: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      requestedTicketId = ticketId;
      return ticket;
    },
    getTeaTicketEvents: async (_context, ticketId) => {
      assert.equal(ticketId, "ticket-detail-1");
      return events;
    },
    requireUserContext: async () => userContext,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), noStoreHeader);
  assert.equal(requestedTicketId, "ticket-detail-1");
  assert.deepEqual(await response.json(), { comments, events, ticket });
});

test("handleGetTeaTicketCommentsRequest returns persisted review comments for the browser detail page", async () => {
  const comments: TeaTicketCommentView[] = [
    {
      body: "Persisted review comment.",
      id: "comment-1",
      ticket_id: "ticket-detail-2",
    },
  ];

  const response = await handleGetTeaTicketCommentsRequest("ticket-detail-2", {
    getTeaTicketComments: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-detail-2");
      return comments;
    },
    requireUserContext: async () => userContext,
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), noStoreHeader);
  assert.deepEqual(await response.json(), { comments });
});

test("ticket lifecycle handlers return the expected browser envelopes", async () => {
  const approvedTicket: TeaTicketView = {
    id: "ticket-action-1",
    status: "approved",
  };
  const run: TeaRunView = {
    id: "run-1",
    status: "succeeded",
    ticket_id: "ticket-action-1",
  };

  const approveResponse = await handleApproveTeaTicketRequest("ticket-action-1", {
    approveTeaTicket: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-action-1");
      return approvedTicket;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(approveResponse.status, 200);
  assert.deepEqual(await approveResponse.json(), { ticket: approvedTicket });

  const runResponse = await handleRunTeaTicketRequest("ticket-action-1", {
    requireUserContext: async () => userContext,
    runTeaTicket: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-action-1");
      return run;
    },
  });
  assert.equal(runResponse.status, 200);
  assert.deepEqual(await runResponse.json(), { run });
});

test("ticket review handlers return runs and export evidence envelopes", async () => {
  const runs: TeaRunView[] = [
    {
      evidence: {
        summary: "Loom completed the implementation and attached validation evidence.",
      },
      id: "run-review-1",
      status: "succeeded",
      ticket_id: "ticket-review-1",
    },
  ];
  const jsonExport = {
    events: [{ id: "event-review-1", kind: "run_succeeded" }],
    runs,
    ticket: { id: "ticket-review-1", status: "needs_review" },
  };
  const markdownExport = "# Tea ticket-review-1\n\n- run_succeeded";

  const runsResponse = await handleGetTeaTicketRunsRequest("ticket-review-1", {
    getTeaTicketRuns: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-review-1");
      return runs;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(runsResponse.status, 200);
  assert.equal(runsResponse.headers.get("cache-control"), noStoreHeader);
  assert.deepEqual(await runsResponse.json(), { runs });

  const jsonResponse = await handleExportTeaTicketJsonRequest("ticket-review-1", {
    exportTeaTicketJson: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-review-1");
      return jsonExport;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(jsonResponse.status, 200);
  assert.equal(jsonResponse.headers.get("cache-control"), noStoreHeader);
  assert.deepEqual(await jsonResponse.json(), { export: jsonExport });

  const markdownResponse = await handleExportTeaTicketMarkdownRequest("ticket-review-1", {
    exportTeaTicketMarkdown: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-review-1");
      return markdownExport;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(markdownResponse.status, 200);
  assert.equal(markdownResponse.headers.get("cache-control"), noStoreHeader);
  assert.match(markdownResponse.headers.get("content-type") || "", /application\/json/);
  assert.deepEqual(await markdownResponse.json(), { markdown: markdownExport });
});

test("review mutation handlers validate payloads and return browser envelopes", async () => {
  const comment: TeaTicketCommentView = {
    body: "Please attach the final smoke evidence.",
    id: "comment-1",
    ticket_id: "ticket-review-2",
  };
  const rejectedTicket: TeaTicketView = {
    id: "ticket-review-2",
    status: "needs_info",
  };
  const stoppedRun: TeaRunView = {
    id: "run-stop-1",
    status: "stopped",
    ticket_id: "ticket-review-2",
  };
  const retriedRun: TeaRunView = {
    id: "run-retry-1",
    status: "retrying",
    ticket_id: "ticket-review-2",
  };

  const commentResponse = await handleAddTeaTicketCommentRequest(
    "ticket-review-2",
    new Request("https://platform.local/api/tea/tickets/ticket-review-2/comments", {
      body: JSON.stringify({ body: "  Please attach the final smoke evidence.  " }),
      method: "POST",
    }),
    {
      addTeaTicketComment: async (context, ticketId, input) => {
        assert.deepEqual(context, userContext);
        assert.equal(ticketId, "ticket-review-2");
        assert.deepEqual(input, { body: "Please attach the final smoke evidence." });
        return comment;
      },
      requireUserContext: async () => userContext,
    },
  );
  assert.equal(commentResponse.status, 201);
  assert.equal(commentResponse.headers.get("cache-control"), noStoreHeader);
  assert.deepEqual(await commentResponse.json(), { comment });

  let rejectCalls = 0;
  const invalidReject = await handleRejectTeaTicketRequest(
    "ticket-review-2",
    new Request("https://platform.local/api/tea/tickets/ticket-review-2/reject", {
      body: JSON.stringify({ reason: "" }),
      method: "POST",
    }),
    {
      rejectTeaTicket: async () => {
        rejectCalls += 1;
        return rejectedTicket;
      },
      requireUserContext: async () => userContext,
    },
  );
  assert.equal(invalidReject.status, 400);
  assert.equal(rejectCalls, 0);

  const rejectResponse = await handleRejectTeaTicketRequest(
    "ticket-review-2",
    new Request("https://platform.local/api/tea/tickets/ticket-review-2/reject", {
      body: JSON.stringify({ reason: "Plan needs a safer rollback step." }),
      method: "POST",
    }),
    {
      rejectTeaTicket: async (context, ticketId, input) => {
        assert.deepEqual(context, userContext);
        assert.equal(ticketId, "ticket-review-2");
        assert.deepEqual(input, { reason: "Plan needs a safer rollback step." });
        return rejectedTicket;
      },
      requireUserContext: async () => userContext,
    },
  );
  assert.equal(rejectResponse.status, 200);
  assert.deepEqual(await rejectResponse.json(), { ticket: rejectedTicket });

  const stopResponse = await handleStopTeaTicketRequest("ticket-review-2", {
    requireUserContext: async () => userContext,
    stopTeaTicket: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-review-2");
      return stoppedRun;
    },
  });
  assert.equal(stopResponse.status, 200);
  assert.deepEqual(await stopResponse.json(), { run: stoppedRun });

  const retryResponse = await handleRetryTeaTicketRequest("ticket-review-2", {
    requireUserContext: async () => userContext,
    retryTeaTicket: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-review-2");
      return retriedRun;
    },
  });
  assert.equal(retryResponse.status, 200);
  assert.deepEqual(await retryResponse.json(), { run: retriedRun });
});

test("download handlers return raw export bodies with attachment headers", async () => {
  const jsonExport = {
    runs: [{ id: "run-download-1", status: "succeeded" }],
    ticket: { id: "ticket-download-1", status: "closed" },
  };
  const markdownExport = "# Ticket Download\n\n## Runs";

  const jsonResponse = await handleDownloadTeaTicketJsonRequest("ticket-download-1", {
    exportTeaTicketJson: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-download-1");
      return jsonExport;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(jsonResponse.status, 200);
  assert.equal(jsonResponse.headers.get("cache-control"), noStoreHeader);
  assert.match(jsonResponse.headers.get("content-type") || "", /application\/json/);
  assert.match(jsonResponse.headers.get("content-disposition") || "", /attachment/);
  assert.match(jsonResponse.headers.get("content-disposition") || "", /tea-ticket-ticket-download-1\.json/);
  assert.deepEqual(await jsonResponse.json(), jsonExport);

  const markdownResponse = await handleDownloadTeaTicketMarkdownRequest("ticket-download-1", {
    exportTeaTicketMarkdown: async (context, ticketId) => {
      assert.deepEqual(context, userContext);
      assert.equal(ticketId, "ticket-download-1");
      return markdownExport;
    },
    requireUserContext: async () => userContext,
  });
  assert.equal(markdownResponse.status, 200);
  assert.equal(markdownResponse.headers.get("cache-control"), noStoreHeader);
  assert.match(markdownResponse.headers.get("content-type") || "", /text\/markdown/);
  assert.match(markdownResponse.headers.get("content-disposition") || "", /attachment/);
  assert.match(markdownResponse.headers.get("content-disposition") || "", /tea-ticket-ticket-download-1\.md/);
  assert.equal(await markdownResponse.text(), markdownExport);
});
