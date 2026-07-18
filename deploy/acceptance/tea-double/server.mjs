import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function headerValue(request, name) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function sendJson(response, statusCode, body, requestId) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-platform-fixture": "true",
    "x-request-id": requestId,
  });
  response.end(JSON.stringify(body));
}

function sendText(response, statusCode, body, requestId, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": contentType,
    "x-platform-fixture": "true",
    "x-request-id": requestId,
  });
  response.end(body);
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_048_576) throw new Error("Fixture request body exceeds 1 MiB");
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

function errorPayload(requestId, code, message) {
  return { fixture: true, requestId, error: code, code, message };
}

function withFixture(value, requestId) {
  return { ...value, fixture: true, requestId };
}

function actionStatus(action) {
  return {
    approve: "approved",
    reject: "needs_review",
    accept: "accepted",
    close: "closed",
    cancel: "cancelled",
  }[action];
}

export function createTeaDoubleServer({
  authToken = process.env.TEA_AUTH_TOKEN,
  loomBaseUrl = process.env.TEA_LOOM_BASE_URL || "http://loom:8765",
  timeoutMs = Number(process.env.FIXTURE_TIMEOUT_MS || 1_500),
} = {}) {
  if (!authToken) throw new Error("Tea double requires TEA_AUTH_TOKEN");
  let requestSequence = 0;
  let ticketSequence = 0;
  let commentSequence = 0;
  let runSequence = 0;
  const tickets = new Map();
  const comments = new Map();
  const runs = new Map();
  let configuration = {
    notifications_enabled: true,
    human_ticket_default_approval_policy: "manual",
    hook_ticket_default_approval_policy: "manual",
  };

  return http.createServer(async (request, response) => {
    const requestId =
      headerValue(request, "x-request-id").trim() ||
      headerValue(request, "x-correlation-id").trim() ||
      `tea-double-${++requestSequence}`;
    try {
      const url = new URL(request.url || "/", "http://tea-double");
      if (["/health", "/ready"].includes(url.pathname)) {
        sendJson(
          response,
          200,
          { fixture: true, ok: true, ready: url.pathname === "/ready", requestId, service: "tea-double" },
          requestId,
        );
        return;
      }

      if (headerValue(request, "authorization") !== `Bearer ${authToken}`) {
        sendJson(
          response,
          401,
          errorPayload(requestId, "FIXTURE_UNAUTHORIZED", "Invalid Tea fixture credential"),
          requestId,
        );
        return;
      }

      const headerMode = headerValue(request, "x-platform-fixture").trim().toLowerCase();
      const pathMode = url.pathname.startsWith("/__fixture__/")
        ? url.pathname.slice("/__fixture__/".length).toLowerCase()
        : "";
      const mode = headerMode || pathMode || "success";
      if (mode === "timeout") await new Promise((resolve) => setTimeout(resolve, timeoutMs));
      if (mode === "error" || mode === "reject") {
        sendJson(
          response,
          503,
          errorPayload(requestId, "FIXTURE_REJECTED", "Deterministic Tea fixture rejection"),
          requestId,
        );
        return;
      }
      if (url.pathname.startsWith("/__fixture__/")) {
        sendJson(response, 200, { fixture: true, ok: true, requestId, service: "tea-double" }, requestId);
        return;
      }

      const configurationEnvelope = () => ({
        fixture: true,
        requestId,
        configuration_source: "loom-managed",
        configuration: {
          owner: "loom",
          loom_base_url: loomBaseUrl,
          loom_panel_url: null,
          reason: "Platform acceptance fixture",
        },
        config: configuration,
      });

      if (request.method === "GET" && url.pathname === "/v1/status") {
        sendJson(
          response,
          200,
          {
            ...configurationEnvelope(),
            service: "tea-double",
            status: "ready",
            brain_provider: { capability: "tea.ticket.decompose.v1", mode: "loom" },
          },
          requestId,
        );
        return;
      }

      if (url.pathname === "/v1/configuration" && ["GET", "PUT"].includes(request.method || "")) {
        if (request.method === "PUT") configuration = { ...configuration, ...(await readJsonBody(request)) };
        sendJson(response, 200, configurationEnvelope(), requestId);
        return;
      }

      if (url.pathname === "/v1/tickets" && request.method === "GET") {
        let listed = [...tickets.values()];
        const status = url.searchParams.get("status");
        const source = url.searchParams.get("source");
        if (status) listed = listed.filter((ticket) => ticket.status === status);
        if (source) listed = listed.filter((ticket) => ticket.source === source);
        sendJson(response, 200, listed, requestId);
        return;
      }

      if (url.pathname === "/v1/tickets" && request.method === "POST") {
        const body = await readJsonBody(request);
        const id = `ticket-${++ticketSequence}`;
        const ticket = {
          fixture: true,
          requestId,
          id,
          title: String(body.title || "Fixture ticket"),
          description: String(body.description || ""),
          source: "human",
          status: "open",
          priority: "normal",
          labels: [],
          created_at: FIXTURE_TIMESTAMP,
          updated_at: FIXTURE_TIMESTAMP,
        };
        tickets.set(id, ticket);
        comments.set(id, []);
        runs.set(id, []);
        sendJson(response, 201, ticket, requestId);
        return;
      }

      const ticketMatch = url.pathname.match(/^\/v1\/tickets\/([^/]+)(?:\/(.+))?$/);
      if (ticketMatch) {
        const ticketId = decodeURIComponent(ticketMatch[1]);
        const suffix = ticketMatch[2] || "";
        const ticket = tickets.get(ticketId);
        if (!ticket) {
          sendJson(response, 404, errorPayload(requestId, "FIXTURE_NOT_FOUND", "Tea fixture ticket not found"), requestId);
          return;
        }

        if (!suffix && request.method === "GET") {
          sendJson(response, 200, withFixture(ticket, requestId), requestId);
          return;
        }
        if (!suffix && request.method === "PATCH") {
          const body = await readJsonBody(request);
          const updated = { ...ticket, ...body, fixture: true, requestId, updated_at: FIXTURE_TIMESTAMP };
          tickets.set(ticketId, updated);
          sendJson(response, 200, updated, requestId);
          return;
        }

        if (suffix === "comments" && request.method === "GET") {
          sendJson(response, 200, comments.get(ticketId) ?? [], requestId);
          return;
        }
        if (suffix === "comments" && request.method === "POST") {
          const body = await readJsonBody(request);
          const comment = {
            fixture: true,
            requestId,
            id: `comment-${++commentSequence}`,
            ticket_id: ticketId,
            actor: { id: "fixture-user", kind: "human" },
            body: String(body.body || ""),
            created_at: FIXTURE_TIMESTAMP,
          };
          comments.get(ticketId).push(comment);
          sendJson(response, 201, comment, requestId);
          return;
        }
        if (suffix === "events" && request.method === "GET") {
          sendJson(
            response,
            200,
            [
              {
                fixture: true,
                requestId,
                id: `event-${ticketId}`,
                ticket_id: ticketId,
                kind: "fixture.created",
                actor: { id: "fixture-system", kind: "system" },
                created_at: FIXTURE_TIMESTAMP,
              },
            ],
            requestId,
          );
          return;
        }
        if (suffix === "runs" && request.method === "GET") {
          sendJson(response, 200, runs.get(ticketId) ?? [], requestId);
          return;
        }
        if (suffix === "run" && request.method === "POST") {
          const run = {
            fixture: true,
            requestId,
            id: `run-${++runSequence}`,
            ticket_id: ticketId,
            loom_session_id: `loom-session-${runSequence}`,
            status: "completed",
            evidence: { fixture: true },
          };
          runs.get(ticketId).push(run);
          tickets.set(ticketId, { ...ticket, status: "completed", updated_at: FIXTURE_TIMESTAMP });
          sendJson(response, 200, run, requestId);
          return;
        }
        if (["stop", "retry"].includes(suffix) && request.method === "POST") {
          const existing = runs.get(ticketId);
          const run = existing.at(-1) ?? {
            fixture: true,
            requestId,
            id: `run-${++runSequence}`,
            ticket_id: ticketId,
            loom_session_id: null,
            evidence: { fixture: true },
          };
          const updated = { ...run, fixture: true, requestId, status: suffix === "stop" ? "stopped" : "completed" };
          if (existing.length === 0) existing.push(updated);
          else existing[existing.length - 1] = updated;
          sendJson(response, 200, updated, requestId);
          return;
        }
        if (["approve", "reject", "accept", "close", "cancel"].includes(suffix) && request.method === "POST") {
          if (suffix === "reject") await readJsonBody(request);
          const updated = {
            ...ticket,
            fixture: true,
            requestId,
            status: actionStatus(suffix),
            updated_at: FIXTURE_TIMESTAMP,
          };
          tickets.set(ticketId, updated);
          sendJson(response, 200, updated, requestId);
          return;
        }
        if (["analyze", "plan", "decompose"].includes(suffix) && request.method === "POST") {
          const payload =
            suffix === "analyze"
              ? { analysis: { summary: "Tea fixture analysis" } }
              : suffix === "plan"
                ? { plan: { steps: [{ id: "fixture-step", title: "Verify acceptance boundary" }] } }
                : {
                    analysis: { recommended_workflow: "loom.tea_ticket_decompose.v1" },
                    plan: { steps: [{ id: "fixture-step" }] },
                    provider: { capability: "tea.ticket.decompose.v1", mode: "loom" },
                  };
          sendJson(response, 200, withFixture(payload, requestId), requestId);
          return;
        }
        if (suffix === "export/json" && request.method === "GET") {
          sendJson(response, 200, { fixture: true, requestId, ticket, comments: comments.get(ticketId), runs: runs.get(ticketId) }, requestId);
          return;
        }
        if (suffix === "export/markdown" && request.method === "GET") {
          sendText(response, 200, `# ${ticket.title}\n\n${ticket.description}\n`, requestId, "text/markdown; charset=utf-8");
          return;
        }
      }

      sendJson(
        response,
        404,
        errorPayload(requestId, "FIXTURE_NOT_FOUND", `Unsupported Tea fixture: ${url.pathname}`),
        requestId,
      );
    } catch (error) {
      sendJson(
        response,
        400,
        errorPayload(requestId, "FIXTURE_BAD_REQUEST", error instanceof Error ? error.message : String(error)),
        requestId,
      );
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 48910);
  const server = createTeaDoubleServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`tea-double listening on 0.0.0.0:${port}`);
  });
}
