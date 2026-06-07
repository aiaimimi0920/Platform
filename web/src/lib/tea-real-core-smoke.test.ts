import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import type { InternalUserContext } from "@neuro/contracts";

import {
  addTeaTicketComment,
  closeTeaTicket,
  createTeaTicket,
  exportTeaTicketJson,
  exportTeaTicketMarkdown,
  getTeaTicket,
  getTeaTicketEvents,
  getTeaTicketRuns,
  approveTeaTicket,
  rejectTeaTicket,
  retryTeaTicket,
  runTeaTicket,
  stopTeaTicket,
} from "./tea-client";
import {
  handleAddTeaTicketCommentRequest,
  handleApproveTeaTicketRequest,
  handleCloseTeaTicketRequest,
  handleCreateTeaTicketRequest,
  handleDownloadTeaTicketJsonRequest,
  handleDownloadTeaTicketMarkdownRequest,
  handleExportTeaTicketJsonRequest,
  handleExportTeaTicketMarkdownRequest,
  handleGetTeaTicketRequest,
  handleGetTeaTicketRunsRequest,
  handleRejectTeaTicketRequest,
  handleRetryTeaTicketRequest,
  handleRunTeaTicketRequest,
  handleStopTeaTicketRequest,
} from "./tea-api-handlers";

type JsonRecord = Record<string, unknown>;

type CapturedFetch = {
  authorization: string | null;
  method: string;
  url: string;
};

const enabled = process.env.TEA_WEB_REAL_SMOKE === "1";

test(
  "proxies Platform Web Tea intake through Platform Core HTTP to a real tea-daemon",
  { skip: enabled ? false : "set TEA_WEB_REAL_SMOKE=1 and use scripts/smoke-platform-web-tea-real.ps1" },
  async () => {
    requireEnv("TEA_SERVER_URL");
    const teaAuthToken = requireEnv("TEA_AUTH_TOKEN");
    const internalApiToken = requireEnv("INTERNAL_API_TOKEN");
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

    const { HttpError } = await import("../../../core/src/platform/errors");
    const { createTeaRouter } = await import("../../../core/src/modules/tea/router");
    const { default: Fastify } = await import("fastify");

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

      const message = error instanceof Error ? error.message : "Unexpected Platform Web Tea smoke error";
      return reply.status(500).send({
        error: {
          code: "BAD_REQUEST",
          message,
        },
      });
    });
    await app.register(createTeaRouter());
    await app.listen({ host: "127.0.0.1", port: 0 });

    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Platform Core Tea smoke server did not expose a TCP address");
    }

    const previousCoreUrl = process.env.CORE_INTERNAL_URL;
    const previousFetch = globalThis.fetch;
    const coreBaseUrl = `http://127.0.0.1:${address.port}`;
    const capturedFetches: CapturedFetch[] = [];
    process.env.CORE_INTERNAL_URL = coreBaseUrl;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedFetches.push({
        authorization: getHeader(init, "authorization"),
        method: init?.method ?? "GET",
        url: String(input),
      });
      return previousFetch(input, init);
    }) as typeof fetch;

    try {
      const userContext: InternalUserContext = {
        providerUserId: "web-real-smoke-provider",
        userId: "web-real-smoke-user",
        username: "web-real-smoke",
      };

      const createResponse = await handleCreateTeaTicketRequest(
        new Request("https://platform.local/api/tea/tickets", {
          body: JSON.stringify({
            description:
              "Create a real Tea ticket through Platform Web, Platform Core, and the Tea daemon.",
            title: "Platform Web Tea real smoke",
          }),
          method: "POST",
        }),
        {
          createTeaTicket,
          requireUserContext: async () => userContext,
        },
      );
      const createBody = await createResponse.text();
      assert.equal(createResponse.status, 201, createBody);
      const created = JSON.parse(createBody) as { ticket: JsonRecord };
      const ticketId = String(created.ticket.id || "");
      assert.match(ticketId, /^[0-9a-f-]{36}$/);
      assert.equal(created.ticket.status, "open");
      assert.equal(created.ticket.source, "human");

      const commentResponse = await handleAddTeaTicketCommentRequest(
        ticketId,
        new Request(`https://platform.local/api/tea/tickets/${ticketId}/comments`, {
          body: JSON.stringify({
            body: "Human reviewer comment from Platform Web real smoke.",
          }),
          method: "POST",
        }),
        {
          addTeaTicketComment,
          requireUserContext: async () => userContext,
        },
      );
      const commentBody = await commentResponse.text();
      assert.equal(commentResponse.status, 201, commentBody);
      const comment = JSON.parse(commentBody) as { comment: JsonRecord };
      const commentId = String(comment.comment.id || "");
      assert.match(commentId, /^[0-9a-f-]{36}$/);
      assert.equal(comment.comment.body, "Human reviewer comment from Platform Web real smoke.");

      const rejectCreateResponse = await handleCreateTeaTicketRequest(
        new Request("https://platform.local/api/tea/tickets", {
          body: JSON.stringify({
            description:
              "Create a separate real Tea ticket to verify rejection without blocking the main run lifecycle.",
            title: "Platform Web Tea rejection smoke",
          }),
          method: "POST",
        }),
        {
          createTeaTicket,
          requireUserContext: async () => userContext,
        },
      );
      const rejectCreateBody = await rejectCreateResponse.text();
      assert.equal(rejectCreateResponse.status, 201, rejectCreateBody);
      const rejectCreated = JSON.parse(rejectCreateBody) as { ticket: JsonRecord };
      const rejectedTicketId = String(rejectCreated.ticket.id || "");
      assert.match(rejectedTicketId, /^[0-9a-f-]{36}$/);

      const rejectResponse = await handleRejectTeaTicketRequest(
        rejectedTicketId,
        new Request(`https://platform.local/api/tea/tickets/${rejectedTicketId}/reject`, {
          body: JSON.stringify({
            reason: "Need clearer acceptance criteria before Tea dispatch.",
          }),
          method: "POST",
        }),
        {
          rejectTeaTicket,
          requireUserContext: async () => userContext,
        },
      );
      const rejectBody = await rejectResponse.text();
      assert.equal(rejectResponse.status, 200, rejectBody);
      const rejected = JSON.parse(rejectBody) as { ticket: JsonRecord };
      assert.equal(rejected.ticket.id, rejectedTicketId);
      assert.equal(rejected.ticket.status, "blocked");

      const approveResponse = await handleApproveTeaTicketRequest(ticketId, {
        approveTeaTicket,
        requireUserContext: async () => userContext,
      });
      const approveBody = await approveResponse.text();
      assert.equal(approveResponse.status, 200, approveBody);
      const approved = JSON.parse(approveBody) as { ticket: JsonRecord };
      assert.equal(approved.ticket.status, "approved");

      const runResponse = await handleRunTeaTicketRequest(ticketId, {
        requireUserContext: async () => userContext,
        runTeaTicket,
      });
      const runBody = await runResponse.text();
      assert.equal(runResponse.status, 200, runBody);
      const run = JSON.parse(runBody) as { run: JsonRecord };
      const runId = String(run.run.id || "");
      assert.match(runId, /^[0-9a-f-]{36}$/);
      assert.equal(run.run.status, "succeeded");

      const detailResponse = await handleGetTeaTicketRequest(ticketId, {
        getTeaTicket,
        getTeaTicketEvents,
        requireUserContext: async () => userContext,
      });
      const detailBody = await detailResponse.text();
      assert.equal(detailResponse.status, 200, detailBody);
      const detail = JSON.parse(detailBody) as { ticket: JsonRecord; events: JsonRecord[] };
      assert.equal(detail.ticket.id, ticketId);
      const events = detail.events;
      assert.ok(events.some((event) => event.kind === "ticket_created"));
      assert.ok(events.some((event) => event.kind === "run_succeeded"));

      const runsResponse = await handleGetTeaTicketRunsRequest(ticketId, {
        getTeaTicketRuns,
        requireUserContext: async () => userContext,
      });
      const runsBody = await runsResponse.text();
      assert.equal(runsResponse.status, 200, runsBody);
      const listedRuns = JSON.parse(runsBody) as { runs: JsonRecord[] };
      assert.ok(
        listedRuns.runs.some((entry) => entry.id === runId && entry.status === "succeeded"),
        `expected Web runs response to include succeeded run ${runId}`,
      );

      const jsonExportResponse = await handleExportTeaTicketJsonRequest(ticketId, {
        exportTeaTicketJson,
        requireUserContext: async () => userContext,
      });
      const jsonExportBody = await jsonExportResponse.text();
      assert.equal(jsonExportResponse.status, 200, jsonExportBody);
      const jsonExport = JSON.parse(jsonExportBody) as {
        export: {
          events?: JsonRecord[];
          runs?: JsonRecord[];
          ticket?: JsonRecord;
        };
      };
      assert.equal(jsonExport.export.ticket?.id, ticketId);
      assert.ok(
        jsonExport.export.runs?.some((entry) => entry.id === runId && entry.status === "succeeded"),
        `expected Web JSON export to include succeeded run ${runId}`,
      );

      const markdownExportResponse = await handleExportTeaTicketMarkdownRequest(ticketId, {
        exportTeaTicketMarkdown,
        requireUserContext: async () => userContext,
      });
      const markdownExportBody = await markdownExportResponse.text();
      assert.equal(markdownExportResponse.status, 200, markdownExportBody);
      const markdownExport = JSON.parse(markdownExportBody) as { markdown: string };
      assert.match(markdownExport.markdown, /## Runs/);
      assert.ok(markdownExport.markdown.includes(runId), `expected Markdown export to include run ${runId}`);
      assert.match(markdownExport.markdown, /mock loom run completed/);

      const jsonDownloadResponse = await handleDownloadTeaTicketJsonRequest(ticketId, {
        exportTeaTicketJson,
        requireUserContext: async () => userContext,
      });
      const jsonDownloadBody = await jsonDownloadResponse.text();
      assert.equal(jsonDownloadResponse.status, 200, jsonDownloadBody);
      assert.match(jsonDownloadResponse.headers.get("content-disposition") || "", /attachment/);
      assert.match(jsonDownloadResponse.headers.get("content-disposition") || "", /\.json"/);
      const jsonDownload = JSON.parse(jsonDownloadBody) as {
        events?: JsonRecord[];
        runs?: JsonRecord[];
        ticket?: JsonRecord;
      };
      assert.equal(jsonDownload.ticket?.id, ticketId);
      assert.ok(
        jsonDownload.runs?.some((entry) => entry.id === runId && entry.status === "succeeded"),
        `expected raw Web JSON download to include succeeded run ${runId}`,
      );

      const markdownDownloadResponse = await handleDownloadTeaTicketMarkdownRequest(ticketId, {
        exportTeaTicketMarkdown,
        requireUserContext: async () => userContext,
      });
      const markdownDownload = await markdownDownloadResponse.text();
      assert.equal(markdownDownloadResponse.status, 200, markdownDownload);
      assert.match(markdownDownloadResponse.headers.get("content-disposition") || "", /attachment/);
      assert.match(markdownDownloadResponse.headers.get("content-disposition") || "", /\.md"/);
      assert.match(markdownDownloadResponse.headers.get("content-type") || "", /text\/markdown/);
      assert.ok(markdownDownload.includes(runId), `expected raw Web Markdown download to include run ${runId}`);

      const stopResponse = await handleStopTeaTicketRequest(ticketId, {
        requireUserContext: async () => userContext,
        stopTeaTicket,
      });
      const stopBody = await stopResponse.text();
      assert.equal(stopResponse.status, 200, stopBody);
      const stopped = JSON.parse(stopBody) as { run: JsonRecord };
      assert.equal(stopped.run.id, runId);
      assert.equal(stopped.run.status, "stopped");

      const retryResponse = await handleRetryTeaTicketRequest(ticketId, {
        requireUserContext: async () => userContext,
        retryTeaTicket,
      });
      const retryBody = await retryResponse.text();
      assert.equal(retryResponse.status, 200, retryBody);
      const retried = JSON.parse(retryBody) as { run: JsonRecord };
      assert.equal(retried.run.id, runId);
      assert.equal(retried.run.status, "retrying");

      const closeResponse = await handleCloseTeaTicketRequest(ticketId, {
        closeTeaTicket,
        requireUserContext: async () => userContext,
      });
      const closeBody = await closeResponse.text();
      assert.equal(closeResponse.status, 200, closeBody);
      const closed = JSON.parse(closeBody) as { ticket: JsonRecord };
      assert.equal(closed.ticket.status, "closed");

      const approveAfterCloseResponse = await handleApproveTeaTicketRequest(ticketId, {
        approveTeaTicket,
        requireUserContext: async () => userContext,
      });
      assert.equal(approveAfterCloseResponse.status, 409, await approveAfterCloseResponse.text());

      const coreFetches = capturedFetches.filter((entry) => entry.url.startsWith(coreBaseUrl));
      assert.ok(coreFetches.length >= 6, `expected multiple Web -> Core fetches, got ${coreFetches.length}`);
      assert.ok(
        coreFetches.every((entry) => entry.authorization === null),
        "Platform Web must not send Tea bearer authorization to Platform Core",
      );

      const teaFetches = capturedFetches.filter((entry) => entry.url.startsWith(process.env.TEA_SERVER_URL || ""));
      assert.ok(teaFetches.length >= 6, `expected multiple Core -> Tea fetches, got ${teaFetches.length}`);
      assert.ok(
        teaFetches.every((entry) => entry.authorization === `Bearer ${teaAuthToken}`),
        "Platform Core must keep using the Tea daemon bearer token server-side",
      );

      const result = {
        status: "passed",
        coreBaseUrl,
        ticketId,
        rejectedTicketId,
        runId,
        commentId,
        rejectedTicketStatus: rejected.ticket.status,
        stoppedRunStatus: stopped.run.status,
        retriedRunStatus: retried.run.status,
        eventCount: events.length,
        jsonDownloadAttachment:
          jsonDownloadResponse.headers.get("content-disposition") === `attachment; filename="tea-ticket-${ticketId}.json"`,
        markdownDownloadAttachment:
          markdownDownloadResponse.headers.get("content-disposition") === `attachment; filename="tea-ticket-${ticketId}.md"`,
        jsonDownloadContainsRun: jsonDownload.runs?.some((entry) => entry.id === runId && entry.status === "succeeded"),
        markdownDownloadContainsRun: markdownDownload.includes(runId),
        markdownExportContainsRunEvidence: markdownExport.markdown.includes("mock loom run completed"),
        runExportCount: listedRuns.runs.length,
        webToCoreFetchCount: coreFetches.length,
        coreToTeaFetchCount: teaFetches.length,
        webToCoreAuthorizationAbsent: coreFetches.every((entry) => entry.authorization === null),
        coreToTeaBearerPresent: teaFetches.every((entry) => entry.authorization === `Bearer ${teaAuthToken}`),
        internalApiTokenLength: internalApiToken.length,
      };

      if (process.env.TEA_WEB_REAL_SMOKE_RESULT_PATH) {
        await writeFile(process.env.TEA_WEB_REAL_SMOKE_RESULT_PATH, JSON.stringify(result, null, 2), "utf8");
      }
    } finally {
      globalThis.fetch = previousFetch;
      restoreEnv("CORE_INTERNAL_URL", previousCoreUrl);
      await app.close();
    }
  },
);

function getHeader(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[name.toLowerCase()] ?? null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Platform Web Tea real smoke`);
  }
  return value;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
