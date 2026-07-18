import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function headerValue(request, name) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function sendJson(response, statusCode, body, requestId, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
    ...headers,
    "x-platform-fixture": "true",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_048_576) {
      throw new Error("Fixture request body exceeds 1 MiB");
    }
  }
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function safeId(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function createTenant(userId) {
  return {
    id: `tenant-${safeId(userId, "fixture-user")}`,
    slug: `fixture-${safeId(userId, "user")}`,
    displayName: "Gateway Fixture Tenant",
    status: "active",
    ownerUserId: userId || null,
    sourceKind: "benefit_service",
    sourceKey: `fixture:${userId || "user"}`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createProject(projectId, tenantId, displayName = "Gateway Fixture Project") {
  return {
    id: projectId,
    tenantId,
    slug: safeId(projectId, "fixture-project"),
    displayName,
    status: "active",
    sourceKind: "benefit_service",
    sourceKey: `fixture:${projectId}`,
    defaultRoutePolicyId: `route-${projectId}`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createRoutePolicy(projectId) {
  return {
    id: `route-${projectId}`,
    projectId,
    name: "acceptance-fixture",
    status: "active",
    strategy: "ordered",
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createApiAccess(projectId, projectToken) {
  const tenant = createTenant("fixture-user");
  return {
    fixture: true,
    tenant,
    project: createProject(projectId, tenant.id),
    apiKey: {
      id: `api-key-${projectId}`,
      projectId,
      name: "acceptance-fixture",
      status: "active",
      issuedAt: FIXTURE_TIMESTAMP,
      revokedAt: null,
      rotatedFromApiKeyId: null,
    },
    token: projectToken,
  };
}

function fixtureMode(request, url, body = {}) {
  const headerMode = headerValue(request, "x-platform-fixture").trim().toLowerCase();
  const queryMode = url.searchParams.get("fixture")?.trim().toLowerCase() ?? "";
  const bodyMode = typeof body.fixture === "string" ? body.fixture.trim().toLowerCase() : "";
  const modelMode = typeof body.model === "string" && body.model.startsWith("fixture-")
    ? body.model.slice("fixture-".length).toLowerCase()
    : "";
  return headerMode || queryMode || bodyMode || modelMode || "success";
}

function isBearer(request, token) {
  return headerValue(request, "authorization") === `Bearer ${token}`;
}

function unauthorized(response, requestId, boundary) {
  sendJson(
    response,
    401,
    {
      fixture: true,
      requestId,
      error: { code: "FIXTURE_UNAUTHORIZED", message: `Invalid ${boundary} fixture credential` },
    },
    requestId,
  );
}

function fixtureError(response, requestId, statusCode = 503, code = "FIXTURE_REJECTED") {
  sendJson(
    response,
    statusCode,
    {
      fixture: true,
      requestId,
      error: { code, message: "Deterministic Gateway fixture rejection" },
    },
    requestId,
  );
}

function sendCompletion(response, requestId, body) {
  const model = typeof body.model === "string" && body.model ? body.model : "fixture-chat";
  const payload = {
    id: `chatcmpl-${requestId}`,
    object: "chat.completion",
    created: 1767225600,
    model,
    fixture: true,
    requestId,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Gateway fixture response" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 },
  };
  sendJson(response, 200, payload, requestId);
}

function sendCompletionStream(response, requestId, body) {
  const model = typeof body.model === "string" && body.model ? body.model : "fixture-chat";
  response.writeHead(200, {
    "cache-control": "no-store",
    connection: "keep-alive",
    "content-type": "text/event-stream; charset=utf-8",
    "x-platform-fixture": "true",
    "x-request-id": requestId,
  });
  response.write(
    `data: ${JSON.stringify({
      id: `chatcmpl-${requestId}`,
      object: "chat.completion.chunk",
      created: 1767225600,
      model,
      fixture: true,
      requestId,
      choices: [{ index: 0, delta: { role: "assistant", content: "Gateway fixture response" }, finish_reason: null }],
    })}\n\n`,
  );
  response.write(
    `data: ${JSON.stringify({
      id: `chatcmpl-${requestId}`,
      object: "chat.completion.chunk",
      created: 1767225600,
      model,
      fixture: true,
      requestId,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n`,
  );
  response.end("data: [DONE]\n\n");
}

export function createGatewayDoubleServer({
  managementToken = process.env.GATEWAY_MANAGEMENT_TOKEN,
  projectToken = process.env.GATEWAY_PROJECT_TOKEN,
  timeoutMs = Number(process.env.FIXTURE_TIMEOUT_MS || 1_500),
} = {}) {
  if (!managementToken || !projectToken) {
    throw new Error("Gateway double requires GATEWAY_MANAGEMENT_TOKEN and GATEWAY_PROJECT_TOKEN");
  }
  let requestSequence = 0;

  return http.createServer(async (request, response) => {
    const requestId =
      headerValue(request, "x-request-id").trim() ||
      headerValue(request, "x-correlation-id").trim() ||
      `gateway-double-${++requestSequence}`;

    try {
      const url = new URL(request.url || "/", "http://gateway-double");
      if (["/health", "/healthz", "/ready"].includes(url.pathname)) {
        sendJson(
          response,
          200,
          { fixture: true, ok: true, ready: url.pathname !== "/health", requestId, service: "gateway-double" },
          requestId,
        );
        return;
      }

      if (url.pathname.startsWith("/__fixture__/")) {
        if (headerValue(request, "x-internal-api-key") !== managementToken && !isBearer(request, projectToken)) {
          unauthorized(response, requestId, "Gateway");
          return;
        }
        const mode = url.pathname.slice("/__fixture__/".length);
        if (mode === "timeout") await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        if (mode === "error" || mode === "reject") {
          fixtureError(response, requestId);
          return;
        }
        sendJson(response, 200, { fixture: true, ok: true, requestId, service: "gateway-double" }, requestId);
        return;
      }

      if (url.pathname.startsWith("/v1/internal/")) {
        if (headerValue(request, "x-internal-api-key") !== managementToken) {
          unauthorized(response, requestId, "Gateway management");
          return;
        }
        const body = request.method === "GET" ? {} : await readJsonBody(request);
        const mode = fixtureMode(request, url, body);
        if (mode === "timeout") await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        if (mode === "error" || mode === "reject") {
          fixtureError(response, requestId);
          return;
        }

        if (request.method === "POST" && url.pathname === "/v1/internal/gateway/benefit-projects/ensure") {
          const serviceId = safeId(body.serviceId, "service");
          const userId = safeId(body.userId, "user");
          const tenant = createTenant(userId);
          const projectId = `benefit-${serviceId}-${userId}`;
          sendJson(
            response,
            200,
            {
              fixture: true,
              requestId,
              tenant,
              project: createProject(projectId, tenant.id, body.serviceTitle || "Gateway Fixture Project"),
              routePolicy: createRoutePolicy(projectId),
            },
            requestId,
          );
          return;
        }

        const accessMatch = url.pathname.match(
          /^\/v1\/internal\/gateway\/projects\/([^/]+)\/api-access(?:\/rotate)?$/,
        );
        if (accessMatch && (request.method === "GET" || request.method === "POST")) {
          sendJson(response, 200, { ...createApiAccess(decodeURIComponent(accessMatch[1]), projectToken), requestId }, requestId);
          return;
        }

        sendJson(
          response,
          404,
          {
            fixture: true,
            requestId,
            error: { code: "FIXTURE_NOT_FOUND", message: `Unsupported Gateway management fixture: ${url.pathname}` },
          },
          requestId,
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
        if (!isBearer(request, projectToken)) {
          unauthorized(response, requestId, "Gateway project");
          return;
        }
        const body = await readJsonBody(request);
        const mode = fixtureMode(request, url, body);
        if (mode === "timeout") await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        if (mode === "reject" || mode === "error") {
          fixtureError(response, requestId, 429, "FIXTURE_RATE_LIMITED");
          return;
        }
        if (body.stream === true || mode === "sse" || mode === "stream") {
          sendCompletionStream(response, requestId, body);
          return;
        }
        sendCompletion(response, requestId, body);
        return;
      }

      sendJson(
        response,
        404,
        {
          fixture: true,
          requestId,
          error: { code: "FIXTURE_NOT_FOUND", message: `Unsupported Gateway fixture: ${url.pathname}` },
        },
        requestId,
      );
    } catch (error) {
      sendJson(
        response,
        400,
        {
          fixture: true,
          requestId,
          error: { code: "FIXTURE_BAD_REQUEST", message: error instanceof Error ? error.message : String(error) },
        },
        requestId,
      );
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4200);
  const server = createGatewayDoubleServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`gateway-double listening on 0.0.0.0:${port}`);
  });
}
