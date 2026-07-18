import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function isAuthorized(request, authToken) {
  return (
    headerValue(request, "authorization") === `Bearer ${authToken}` ||
    headerValue(request, "x-loom-token") === authToken ||
    headerValue(request, "x-daemon-token") === authToken
  );
}

function errorPayload(requestId, code, message) {
  return { fixture: true, requestId, error: { code, message } };
}

export function createLoomDoubleServer({
  authToken = process.env.LOOM_AUTH_TOKEN || process.env.LOOM_DAEMON_TOKEN,
  timeoutMs = Number(process.env.FIXTURE_TIMEOUT_MS || 1_500),
} = {}) {
  if (!authToken) throw new Error("Loom double requires LOOM_AUTH_TOKEN");
  let requestSequence = 0;

  return http.createServer(async (request, response) => {
    const requestId =
      headerValue(request, "x-request-id").trim() ||
      headerValue(request, "x-correlation-id").trim() ||
      `loom-double-${++requestSequence}`;
    const url = new URL(request.url || "/", "http://loom-double");

    if (["/health", "/ready"].includes(url.pathname)) {
      sendJson(
        response,
        200,
        { fixture: true, ok: true, ready: url.pathname === "/ready", requestId, service: "loom-double" },
        requestId,
      );
      return;
    }

    if (!isAuthorized(request, authToken)) {
      sendJson(
        response,
        401,
        errorPayload(requestId, "FIXTURE_UNAUTHORIZED", "Invalid Loom fixture credential"),
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
        errorPayload(requestId, "FIXTURE_REJECTED", "Deterministic Loom fixture rejection"),
        requestId,
      );
      return;
    }

    if (
      url.pathname === "/__fixture__/success" ||
      ["/status", "/v1/status", "/settings", "/v1/settings"].includes(url.pathname)
    ) {
      sendJson(
        response,
        200,
        {
          fixture: true,
          ok: true,
          ready: true,
          requestId,
          service: "loom-double",
          capability: "loom.acceptance.boundary.v1",
        },
        requestId,
      );
      return;
    }

    sendJson(
      response,
      404,
      errorPayload(requestId, "FIXTURE_NOT_FOUND", `Unsupported Loom fixture: ${url.pathname}`),
      requestId,
    );
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8765);
  const server = createLoomDoubleServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`loom-double listening on 0.0.0.0:${port}`);
  });
}
