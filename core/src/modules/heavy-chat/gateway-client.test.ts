import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  GatewayClientError,
  createHeavyChatGatewayClient,
} from "./gateway-client";

const MANAGEMENT_TOKEN = "heavy-chat-management-token";
const PROJECT_TOKEN = "heavy-chat-project-token";
const SERVICE_ID = "platform-heavy-chat";
const SERVICE_TITLE = "Platform Heavy Chat";

type GatewayDoubleModule = {
  createGatewayDoubleServer(options: {
    managementToken: string;
    projectToken: string;
    timeoutMs: number;
  }): Server;
};

type GatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type CapturedRequest = {
  body: unknown;
  headers: Headers;
  method: string;
  url: URL;
};

type ResponseTransform = (args: {
  request: Request;
  response: Response;
}) => Promise<Response> | Response;

type TestTransport = (request: Request) => Promise<Response>;

type TestResponseBody = string | ReadableStream<Uint8Array> | null;

type GatewayErrorCode = "provider_rejected" | "provider_timeout" | "unavailable" | "protocol_error" | "correlation_mismatch";

type GatewayErrorShape = {
  code: GatewayErrorCode;
  correlationId: string;
  providerCode: string | null;
  requestId: string;
  responseRequestId: string | null;
  statusCode: number | null;
};

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function replaceResponse(
  request: Request,
  response: Response,
  body: TestResponseBody,
  init: ResponseInit = {},
): Response {
  if (response.body) void response.body.cancel().catch(() => undefined);
  const headers = new Headers(response.headers);
  if (init.headers) {
    const overrides = new Headers(init.headers);
    overrides.forEach((value, key) => headers.set(key, value));
  }
  const requestId = request.headers.get("x-request-id");
  const correlationId = request.headers.get("x-correlation-id");
  if (requestId && !headers.has("x-request-id")) headers.set("x-request-id", requestId);
  if (correlationId && !headers.has("x-correlation-id")) {
    headers.set("x-correlation-id", correlationId);
  }
  return new Response(body, {
    headers,
    status: init.status ?? response.status,
    statusText: init.statusText ?? response.statusText,
  });
}

function echoResponseTracing(request: Request, response: Response): Response {
  const requestId = request.headers.get("x-request-id");
  const correlationId = request.headers.get("x-correlation-id");
  const headers = new Headers(response.headers);
  if (requestId && !headers.has("x-request-id")) headers.set("x-request-id", requestId);
  if (correlationId && !headers.has("x-correlation-id")) {
    headers.set("x-correlation-id", correlationId);
  }
  if (
    headers.get("x-request-id") === response.headers.get("x-request-id") &&
    headers.get("x-correlation-id") === response.headers.get("x-correlation-id")
  ) {
    return response;
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function createCapturingFetch(
  transform?: ResponseTransform,
  transport: TestTransport = fetch,
): {
  fetchFn: GatewayFetch;
  requests: CapturedRequest[];
} {
  const requests: CapturedRequest[] = [];
  const fetchFn: GatewayFetch = async (input, init) => {
    const request = new Request(input, init);
    const rawBody = await request.clone().text();
    requests.push({
      body: rawBody ? JSON.parse(rawBody) : null,
      headers: new Headers(request.headers),
      method: request.method,
      url: new URL(request.url),
    });

    const response = echoResponseTracing(request, await transport(request));
    return transform ? transform({ request, response }) : response;
  };

  return { fetchFn, requests };
}

function createClient(baseUrl: string, fetchFn: GatewayFetch, timeoutMs = 500) {
  return createHeavyChatGatewayClient({
    baseUrl,
    managementToken: MANAGEMENT_TOKEN,
    serviceId: SERVICE_ID,
    serviceTitle: SERVICE_TITLE,
    model: "fixture-success",
    timeoutMs,
    fetchFn,
  });
}

function assertRequestTracing(
  requests: CapturedRequest[],
  correlationId: string,
  expectedRequestId?: string,
): void {
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.headers.get("x-correlation-id"), correlationId);
    const requestId = request.headers.get("x-request-id") ?? "";
    assert.match(requestId, /\S+/);
    if (expectedRequestId) assert.equal(requestId, expectedRequestId);
  }
}

function assertGatewayError(
  error: unknown,
  expected: {
    code: GatewayErrorCode;
    correlationId: string;
    providerCode: string | null;
    requestId: string;
    responseRequestId: string | null;
    statusCode: number | null;
  },
): boolean {
  assert.ok(error instanceof GatewayClientError);
  const gatewayError = error as GatewayErrorShape;
  assert.equal(gatewayError.code, expected.code);
  assert.equal(gatewayError.statusCode, expected.statusCode);
  assert.equal(gatewayError.providerCode, expected.providerCode);
  assert.equal(gatewayError.requestId, expected.requestId);
  assert.equal(gatewayError.responseRequestId, expected.responseRequestId);
  assert.equal(gatewayError.correlationId, expected.correlationId);
  return true;
}

describe("heavy-chat Gateway client", { concurrency: false }, () => {
  let gatewayServer: Server;
  let gatewayBaseUrl: string;

  before(async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(__dirname, "../../../../deploy/acceptance/gateway-double/server.mjs"),
    ).href;
    const { createGatewayDoubleServer } = (await import(moduleUrl)) as GatewayDoubleModule;
    gatewayServer = createGatewayDoubleServer({
      managementToken: MANAGEMENT_TOKEN,
      projectToken: PROJECT_TOKEN,
      timeoutMs: 200,
    });
    gatewayBaseUrl = await listen(gatewayServer);
  });

  after(async () => {
    await close(gatewayServer);
  });

  it("ensures owner project access and returns a JSON completion without leaking credentials", async () => {
    const correlationId = "heavy-chat-json-correlation";
    const requestId = "attempt-json-1";
    const messages = [{ role: "user" as const, content: "Hello from Platform" }];
    const { fetchFn, requests } = createCapturingFetch();
    const client = createClient(gatewayBaseUrl, fetchFn);

    const result = await client.complete({
      ownerUserId: "owner-json",
      messages,
      requestId,
      correlationId,
    });

    assertRequestTracing(requests, correlationId, requestId);
    const [ensureRequest, accessRequest, completionRequest] = requests;
    assert.ok(ensureRequest && accessRequest && completionRequest);

    assert.equal(ensureRequest.method, "POST");
    assert.equal(ensureRequest.url.pathname, "/v1/internal/gateway/benefit-projects/ensure");
    assert.equal(ensureRequest.headers.get("x-internal-api-key"), MANAGEMENT_TOKEN);
    assert.equal(ensureRequest.headers.get("authorization"), null);
    assert.deepEqual(ensureRequest.body, {
      serviceId: SERVICE_ID,
      serviceTitle: SERVICE_TITLE,
      userId: "owner-json",
    });

    assert.equal(accessRequest.method, "GET");
    assert.equal(
      accessRequest.url.pathname,
      "/v1/internal/gateway/projects/benefit-platform-heavy-chat-owner-json/api-access",
    );
    assert.equal(accessRequest.headers.get("x-internal-api-key"), MANAGEMENT_TOKEN);
    assert.equal(accessRequest.headers.get("authorization"), null);

    assert.equal(completionRequest.method, "POST");
    assert.equal(completionRequest.url.pathname, "/v1/chat/completions");
    assert.equal(completionRequest.headers.get("authorization"), `Bearer ${PROJECT_TOKEN}`);
    assert.equal(completionRequest.headers.get("x-internal-api-key"), null);
    assert.deepEqual(completionRequest.body, {
      messages,
      model: "fixture-success",
    });

    assert.deepEqual(result, {
      content: "Gateway fixture response",
      finishReason: "stop",
      requestId,
      statusCode: 200,
    });
    assert.equal(JSON.stringify(result).includes(MANAGEMENT_TOKEN), false);
    assert.equal(JSON.stringify(result).includes(PROJECT_TOKEN), false);
  });

  it("parses SSE data events, emits text deltas, and returns the accumulated completion", async () => {
    const correlationId = "heavy-chat-sse-correlation";
    const chunks: string[] = [];
    const { fetchFn, requests } = createCapturingFetch();
    const client = createClient(gatewayBaseUrl, fetchFn);

    const result = await client.complete({
      ownerUserId: "owner-sse",
      messages: [{ role: "user", content: "Stream the answer" }],
      model: "fixture-sse",
      correlationId,
      stream: true,
      onChunk: (delta: string) => {
        chunks.push(delta);
      },
    });

    assertRequestTracing(requests, correlationId);
    const completionRequest = requests.at(-1);
    assert.ok(completionRequest);
    assert.deepEqual(completionRequest.body, {
      messages: [{ role: "user", content: "Stream the answer" }],
      model: "fixture-sse",
      stream: true,
    });
    assert.deepEqual(chunks, ["Gateway fixture response"]);
    assert.deepEqual(result, {
      content: "Gateway fixture response",
      finishReason: "stop",
      requestId: completionRequest.headers.get("x-request-id"),
      statusCode: 200,
    });
  });

  it("classifies provider rejection while preserving status, provider code, and tracing", async () => {
    const correlationId = "heavy-chat-reject-correlation";
    const { fetchFn, requests } = createCapturingFetch();
    const client = createClient(gatewayBaseUrl, fetchFn);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-reject",
          messages: [{ role: "user", content: "Reject this request" }],
          model: "fixture-reject",
          correlationId,
        }),
      (error: unknown) => {
        const completionRequest = requests.at(-1);
        assert.ok(completionRequest);
        const requestId = completionRequest.headers.get("x-request-id");
        assert.ok(requestId);
        return assertGatewayError(error, {
          code: "provider_rejected",
          correlationId,
          providerCode: "FIXTURE_RATE_LIMITED",
          requestId,
          responseRequestId: requestId,
          statusCode: 429,
        });
      },
    );
  });

  it("aborts a slow completion and classifies it as a provider timeout", async () => {
    const correlationId = "heavy-chat-timeout-correlation";
    const { fetchFn, requests } = createCapturingFetch();
    const client = createClient(gatewayBaseUrl, fetchFn, 30);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-timeout",
          messages: [{ role: "user", content: "Wait too long" }],
          model: "fixture-timeout",
          correlationId,
        }),
      (error: unknown) => {
        const completionRequest = requests.at(-1);
        assert.ok(completionRequest);
        const requestId = completionRequest.headers.get("x-request-id");
        assert.ok(requestId);
        return assertGatewayError(error, {
          code: "provider_timeout",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: null,
          statusCode: null,
        });
      },
    );
  });

  it("cancels a stalled management response body and reports a timeout", async () => {
    const correlationId = "heavy-chat-management-stalled-correlation";
    const requestId = "attempt-management-stalled";
    const encoder = new TextEncoder();
    let cancelled = false;
    const { fetchFn, requests } = createCapturingFetch(
      ({ request, response }) => {
        if (!new URL(request.url).pathname.endsWith("/benefit-projects/ensure")) return response;
        return replaceResponse(
          request,
          response,
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode('{"project":'));
            },
            cancel() {
              cancelled = true;
            },
          }),
          {
            headers: {
              "content-type": "application/json",
              "x-request-id": requestId,
              "x-correlation-id": correlationId,
            },
            status: 200,
          },
        );
      },
      async () => new Response(null, { status: 200 }),
    );
    const client = createClient(gatewayBaseUrl, fetchFn, 30);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-management-stalled",
          messages: [{ role: "user", content: "Do not hang" }],
          requestId,
          correlationId,
        }),
      (error: unknown) =>
        assertGatewayError(error, {
          code: "provider_timeout",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: requestId,
          statusCode: 200,
        }),
    );
    assert.equal(requests.length, 1);
    assert.equal(cancelled, true);
  });

  it("uses one deadline across project ensure, access provisioning, and completion", async () => {
    const correlationId = "heavy-chat-unified-deadline-correlation";
    const requestId = "attempt-unified-deadline";
    const requests: CapturedRequest[] = [];
    const fetchFn: GatewayFetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push({
        body: null,
        headers: new Headers(request.headers),
        method: request.method,
        url: new URL(request.url),
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      if (request.signal.aborted) throw request.signal.reason;
      const headers = {
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-correlation-id": correlationId,
      };
      if (request.url.endsWith("benefit-projects/ensure")) {
        return new Response(JSON.stringify({ project: { id: "deadline-project" } }), { headers });
      }
      if (request.url.endsWith("/api-access")) {
        return new Response(JSON.stringify({ token: PROJECT_TOKEN }), { headers });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "late" }, finish_reason: "stop" }] }),
        { headers },
      );
    };
    const client = createClient("http://gateway-unified-deadline.invalid", fetchFn, 60);
    const startedAt = Date.now();

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-unified-deadline",
          messages: [{ role: "user", content: "Use one deadline" }],
          requestId,
          correlationId,
        }),
      (error: unknown) =>
        assertGatewayError(error, {
          code: "provider_timeout",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: null,
          statusCode: null,
        }),
    );
    assert.ok(requests.length >= 2 && requests.length <= 3);
    assert.ok(Date.now() - startedAt < 180);
  });

  it("requires both response request and correlation tracing identifiers", async () => {
    const cases = [
      {
        name: "missing request id",
        headers: { "x-correlation-id": "corr-missing-request" } as Record<string, string>,
        expectedResponseRequestId: null,
      },
      {
        name: "missing correlation id",
        headers: { "x-request-id": "request-missing-correlation" } as Record<string, string>,
        expectedResponseRequestId: "request-missing-correlation",
      },
    ];

    for (const scenario of cases) {
      const correlationId = `heavy-chat-${scenario.name.replaceAll(" ", "-")}-correlation`;
      const requestId = `attempt-${scenario.name.replaceAll(" ", "-")}`;
      const { fetchFn } = createCapturingFetch(({ request, response }) => {
        if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
        if (response.body) void response.body.cancel().catch(() => undefined);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "trace test" }, finish_reason: "stop" }] }),
          {
            headers: { "content-type": "application/json", ...scenario.headers },
            status: 200,
          },
        );
      });
      const client = createClient(gatewayBaseUrl, fetchFn);

      await assert.rejects(
        () =>
          client.complete({
            ownerUserId: `owner-${scenario.name.replaceAll(" ", "-")}`,
            messages: [{ role: "user", content: "Trace me" }],
            requestId,
            correlationId,
          }),
        (error: unknown) =>
          assertGatewayError(error, {
            code: "protocol_error",
            correlationId,
            providerCode: null,
            requestId,
            responseRequestId: scenario.expectedResponseRequestId,
            statusCode: 200,
          }),
        scenario.name,
      );
    }
  });

  it("rejects malformed, empty, and error completion payloads", async () => {
    const cases = [
      {
        name: "invalid JSON",
        contentType: "application/json",
        body: "not-json",
        stream: false,
      },
      {
        name: "missing choices",
        contentType: "application/json",
        body: JSON.stringify({ object: "chat.completion" }),
        stream: false,
      },
      {
        name: "empty content",
        contentType: "application/json",
        body: JSON.stringify({ choices: [{ message: { content: "" }, finish_reason: "stop" }] }),
        stream: false,
      },
      {
        name: "empty response",
        contentType: "application/json",
        body: "",
        stream: false,
      },
      {
        name: "SSE error event",
        contentType: "text/event-stream; charset=utf-8",
        body: `data: ${JSON.stringify({ error: { code: "FIXTURE_ERROR", message: "provider failed" } })}\n\ndata: [DONE]\n\n`,
        stream: true,
      },
      {
        name: "SSE missing choices",
        contentType: "text/event-stream; charset=utf-8",
        body: `data: ${JSON.stringify({ object: "chat.completion.chunk" })}\n\ndata: [DONE]\n\n`,
        stream: true,
      },
    ];

    for (const [index, scenario] of cases.entries()) {
      const correlationId = `heavy-chat-malformed-${index}-correlation`;
      const requestId = `attempt-malformed-${index}`;
      const { fetchFn } = createCapturingFetch(({ request, response }) => {
        if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
        if (response.body) void response.body.cancel().catch(() => undefined);
        return new Response(scenario.body, {
          headers: {
            "content-type": scenario.contentType,
            "x-request-id": requestId,
            "x-correlation-id": correlationId,
          },
          status: 200,
        });
      });
      const client = createClient(gatewayBaseUrl, fetchFn);

      await assert.rejects(
        () =>
          client.complete({
            ownerUserId: `owner-malformed-${index}`,
            messages: [{ role: "user", content: scenario.name }],
            requestId,
            correlationId,
            stream: scenario.stream,
          }),
        (error: unknown) =>
          assertGatewayError(error, {
            code: "protocol_error",
            correlationId,
            providerCode: null,
            requestId,
            responseRequestId: requestId,
            statusCode: 200,
          }),
        scenario.name,
      );
    }
  });

  it("redacts management, project, and bearer credentials from external errors", async () => {
    const managementCorrelationId = "heavy-chat-management-redaction-correlation";
    const managementRequestId = "attempt-management-redaction";
    const { fetchFn: managementFetch } = createCapturingFetch(({ request, response }) => {
      if (!new URL(request.url).pathname.endsWith("/benefit-projects/ensure")) return response;
      if (response.body) void response.body.cancel().catch(() => undefined);
      return new Response(
        JSON.stringify({
          error: {
            code: "FIXTURE_UNAUTHORIZED",
            message: `management=${MANAGEMENT_TOKEN}; Authorization: Bearer ${MANAGEMENT_TOKEN}`,
          },
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-request-id": managementRequestId,
            "x-correlation-id": managementCorrelationId,
          },
          status: 401,
        },
      );
    });
    const managementClient = createClient(gatewayBaseUrl, managementFetch);
    await assert.rejects(
      () =>
        managementClient.complete({
          ownerUserId: "owner-management-redaction",
          messages: [{ role: "user", content: "redact management" }],
          requestId: managementRequestId,
          correlationId: managementCorrelationId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof GatewayClientError);
        assert.equal(error.code, "unavailable");
        assert.equal(error.statusCode, 401);
        assert.equal(error.message.includes(MANAGEMENT_TOKEN), false);
        assert.equal(error.message.includes("Bearer [REDACTED]"), true);
        return true;
      },
    );

    const completionCorrelationId = "heavy-chat-project-redaction-correlation";
    const completionRequestId = "attempt-project-redaction";
    const { fetchFn: completionFetch } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      if (response.body) void response.body.cancel().catch(() => undefined);
      return new Response(
        JSON.stringify({
          error: {
            code: "FIXTURE_RATE_LIMITED",
            message: `management=${MANAGEMENT_TOKEN}; project=${PROJECT_TOKEN}; Bearer ${PROJECT_TOKEN}`,
          },
        }),
        {
          headers: {
            "content-type": "application/json",
            "x-request-id": completionRequestId,
            "x-correlation-id": completionCorrelationId,
          },
          status: 429,
        },
      );
    });
    const completionClient = createClient(gatewayBaseUrl, completionFetch);
    await assert.rejects(
      () =>
        completionClient.complete({
          ownerUserId: "owner-project-redaction",
          messages: [{ role: "user", content: "redact project" }],
          requestId: completionRequestId,
          correlationId: completionCorrelationId,
        }),
      (error: unknown) => {
        assert.ok(error instanceof GatewayClientError);
        assert.equal(error.message.includes(MANAGEMENT_TOKEN), false);
        assert.equal(error.message.includes(PROJECT_TOKEN), false);
        assert.equal(error.message.includes("Bearer [REDACTED]"), true);
        return true;
      },
    );
  });

  it("classifies upstream 5xx as unavailable while preserving 4xx provider rejection", async () => {
    const managementCorrelationId = "heavy-chat-management-503-correlation";
    const managementRequestId = "attempt-management-503";
    const { fetchFn: managementFetch } = createCapturingFetch(({ request, response }) => {
      if (!new URL(request.url).pathname.endsWith("/benefit-projects/ensure")) return response;
      if (response.body) void response.body.cancel().catch(() => undefined);
      return new Response(
        JSON.stringify({ error: { code: "GATEWAY_UNAVAILABLE", message: "management plane unavailable" } }),
        {
          headers: {
            "content-type": "application/json",
            "x-request-id": managementRequestId,
            "x-correlation-id": managementCorrelationId,
          },
          status: 503,
        },
      );
    });
    const managementClient = createClient(gatewayBaseUrl, managementFetch);
    await assert.rejects(
      () =>
        managementClient.complete({
          ownerUserId: "owner-management-503",
          messages: [{ role: "user", content: "management outage" }],
          requestId: managementRequestId,
          correlationId: managementCorrelationId,
        }),
      (error: unknown) =>
        assertGatewayError(error, {
          code: "unavailable",
          correlationId: managementCorrelationId,
          providerCode: "GATEWAY_UNAVAILABLE",
          requestId: managementRequestId,
          responseRequestId: managementRequestId,
          statusCode: 503,
        }),
    );

    const completionCorrelationId = "heavy-chat-completion-503-correlation";
    const completionRequestId = "attempt-completion-503";
    const { fetchFn: completionFetch } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      if (response.body) void response.body.cancel().catch(() => undefined);
      return new Response(
        JSON.stringify({ error: { code: "UPSTREAM_UNAVAILABLE", message: "provider gateway unavailable" } }),
        {
          headers: {
            "content-type": "application/json",
            "x-request-id": completionRequestId,
            "x-correlation-id": completionCorrelationId,
          },
          status: 503,
        },
      );
    });
    const completionClient = createClient(gatewayBaseUrl, completionFetch);
    await assert.rejects(
      () =>
        completionClient.complete({
          ownerUserId: "owner-completion-503",
          messages: [{ role: "user", content: "provider outage" }],
          requestId: completionRequestId,
          correlationId: completionCorrelationId,
        }),
      (error: unknown) =>
        assertGatewayError(error, {
          code: "unavailable",
          correlationId: completionCorrelationId,
          providerCode: "UPSTREAM_UNAVAILABLE",
          requestId: completionRequestId,
          responseRequestId: completionRequestId,
          statusCode: 503,
        }),
    );
  });

  it("classifies management authentication failures as unavailable platform configuration", async () => {
    for (const statusCode of [401, 403]) {
      const correlationId = `heavy-chat-management-${statusCode}-correlation`;
      const requestId = `attempt-management-${statusCode}`;
      const { fetchFn } = createCapturingFetch(({ request, response }) => {
        if (!new URL(request.url).pathname.endsWith("/benefit-projects/ensure")) return response;
        if (response.body) void response.body.cancel().catch(() => undefined);
        return new Response(
          JSON.stringify({
            error: {
              code: "GATEWAY_MANAGEMENT_AUTH_FAILED",
              message: "Gateway management authentication failed",
            },
          }),
          {
            headers: {
              "content-type": "application/json",
              "x-request-id": requestId,
              "x-correlation-id": correlationId,
            },
            status: statusCode,
          },
        );
      });
      const client = createClient(gatewayBaseUrl, fetchFn);

      await assert.rejects(
        () =>
          client.complete({
            ownerUserId: `owner-management-${statusCode}`,
            messages: [{ role: "user", content: "management auth failure" }],
            requestId,
            correlationId,
          }),
        (error: unknown) =>
          assertGatewayError(error, {
            code: "unavailable",
            correlationId,
            providerCode: "GATEWAY_MANAGEMENT_AUTH_FAILED",
            requestId,
            responseRequestId: requestId,
            statusCode,
          }),
      );
    }
  });

  it("passes SSE callback errors through without reclassifying them", async () => {
    const callbackError = new Error("database persistence failed");
    const correlationId = "heavy-chat-callback-error-correlation";
    const requestId = "attempt-callback-error";
    const { fetchFn } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      if (response.body) void response.body.cancel().catch(() => undefined);
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "chunk" }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
        {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "x-request-id": requestId,
            "x-correlation-id": correlationId,
          },
          status: 200,
        },
      );
    });
    const client = createClient(gatewayBaseUrl, fetchFn);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-callback-error",
          messages: [{ role: "user", content: "Preserve this error" }],
          requestId,
          correlationId,
          stream: true,
          onChunk: () => {
            throw callbackError;
          },
        }),
      (error: unknown) => error === callbackError,
    );
  });

  it("times out when an SSE response stalls after returning headers", async () => {
    const correlationId = "heavy-chat-stalled-stream-correlation";
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    let cancelled = false;
    let lateTimer: ReturnType<typeof setTimeout> | undefined;
    const { fetchFn, requests } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      const requestId = request.headers.get("x-request-id");
      assert.ok(requestId);
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "partial" }, finish_reason: null }] })}\n\n`,
              ),
            );
            lateTimer = setTimeout(() => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: "late" }, finish_reason: null }] })}\n\n`,
                ),
              );
            }, 80);
          },
          cancel() {
            cancelled = true;
            if (lateTimer) clearTimeout(lateTimer);
          },
        }),
        {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "x-request-id": requestId,
            "x-correlation-id": correlationId,
          },
          status: 200,
        },
      );
    });
    const client = createClient(gatewayBaseUrl, fetchFn, 30);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-stalled-stream",
          messages: [{ role: "user", content: "Do not stall" }],
          model: "fixture-sse",
          correlationId,
          stream: true,
          onChunk: (delta) => {
            chunks.push(delta);
          },
        }),
      (error: unknown) => {
        const completionRequest = requests.at(-1);
        assert.ok(completionRequest);
        const requestId = completionRequest.headers.get("x-request-id");
        assert.ok(requestId);
        return assertGatewayError(error, {
          code: "provider_timeout",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: requestId,
          statusCode: 200,
        });
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(cancelled, true);
    assert.deepEqual(chunks, ["partial"]);
  });

  it("rejects a successful response whose x-request-id does not match the sent request", async () => {
    const correlationId = "heavy-chat-mismatch-correlation";
    const { fetchFn, requests } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      const requestId = request.headers.get("x-request-id");
      assert.ok(requestId);
      const headers = new Headers(response.headers);
      headers.set("x-request-id", `${requestId}:mismatch`);
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    });
    const client = createClient(gatewayBaseUrl, fetchFn);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-mismatch",
          messages: [{ role: "user", content: "Check tracing" }],
          correlationId,
        }),
      (error: unknown) => {
        const completionRequest = requests.at(-1);
        assert.ok(completionRequest);
        const requestId = completionRequest.headers.get("x-request-id");
        assert.ok(requestId);
        return assertGatewayError(error, {
          code: "correlation_mismatch",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: `${requestId}:mismatch`,
          statusCode: 200,
        });
      },
    );
  });

  it("rejects a successful response whose x-correlation-id does not match the sent correlation", async () => {
    const correlationId = "heavy-chat-correlation-mismatch";
    const requestId = "attempt-correlation-mismatch";
    const { fetchFn } = createCapturingFetch(({ request, response }) => {
      if (new URL(request.url).pathname !== "/v1/chat/completions") return response;
      const headers = new Headers(response.headers);
      headers.set("x-request-id", requestId);
      headers.set("x-correlation-id", `${correlationId}:mismatch`);
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    });
    const client = createClient(gatewayBaseUrl, fetchFn);

    await assert.rejects(
      () =>
        client.complete({
          ownerUserId: "owner-correlation-mismatch",
          messages: [{ role: "user", content: "Check correlation" }],
          requestId,
          correlationId,
        }),
      (error: unknown) =>
        assertGatewayError(error, {
          code: "correlation_mismatch",
          correlationId,
          providerCode: null,
          requestId,
          responseRequestId: requestId,
          statusCode: 200,
        }),
    );
  });
});
