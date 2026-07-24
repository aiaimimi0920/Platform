import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  classifyInternalDependencyError,
  fetchInternal,
  getInternalRequestTelemetrySnapshot,
  resetInternalRequestTelemetryForTests,
} from "./internal-request";

describe("fetchInternal", () => {
  afterEach(() => {
    resetInternalRequestTelemetryForTests();
  });

  it("retries GET network failures using the configured retry delays", async () => {
    let attempts = 0;
    const response = await fetchInternal("http://core.test/health", {
      targetService: "core",
      retryDelaysMs: [0, 0],
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
        }
        return Response.json({ ok: true });
      },
    });

    assert.equal(attempts, 2);
    assert.equal(response.ok, true);
    assert.deepEqual(await response.json(), { ok: true });

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.core.retryCount, 1);
    assert.equal(snapshot.byTargetService.core.networkErrorCount, 0);
    assert.equal(snapshot.totals.retryCount, 1);
  });

  it("does not retry POST network failures by default", async () => {
    let attempts = 0;
    let capturedError: unknown;

    try {
      await fetchInternal("http://core.test/v1/mutate", {
        targetService: "core",
        method: "POST",
        retryDelaysMs: [0, 0],
        fetchImpl: async () => {
          attempts += 1;
          throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
        },
      });
    } catch (error) {
      capturedError = error;
    }

    assert.equal(attempts, 1);
    assert.ok(capturedError instanceof Error);
    const networkError = capturedError as Error & Record<string, unknown>;
    assert.match(networkError.message, /fetch failed/);
    assert.equal(networkError.code, "INTERNAL_REQUEST_NETWORK_ERROR");
    assert.equal(networkError.category, "dependency");
    assert.equal(networkError.service, "core");
    assert.equal(networkError.retryable, true);
    assert.match(String(networkError.requestId), /^web-core-/);
    assert.match(String(networkError.correlationId), /^web-core-/);
    assert.match(String(networkError.diagnostics), /service=core/);
    assert.match(String(networkError.diagnostics), /category=dependency/);
    assert.match(String(networkError.diagnostics), /status=network/);

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.core.retryCount, 0);
    assert.equal(snapshot.byTargetService.core.networkErrorCount, 1);
    assert.equal(snapshot.totals.networkErrorCount, 1);
  });

  it("records exhausted network retries by target service", async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        fetchInternal("http://account.test/v1/status", {
          targetService: "account",
          retryDelaysMs: [0, 0],
          fetchImpl: async () => {
            attempts += 1;
            throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
          },
        }),
      /fetch failed/,
    );

    assert.equal(attempts, 3);

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.account.retryCount, 2);
    assert.equal(snapshot.byTargetService.account.networkErrorCount, 1);
    assert.equal(snapshot.byTargetService.account.timeoutCount, 0);
    assert.match(snapshot.byTargetService.account.lastEventAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  });

  it("replaces unsafe outbound correlation identifiers before dispatch", async () => {
    await fetchInternal("http://account.test/v1/status", {
      targetService: "account",
      headers: {
        "x-request-id": "Bearer request-secret",
        "x-correlation-id": "correlation token=correlation-secret",
      },
      retryDelaysMs: [],
      fetchImpl: async (_url, init) => {
        const headers = new Headers(init?.headers);
        assert.match(headers.get("x-request-id") ?? "", /^web-account-/);
        assert.equal(headers.get("x-correlation-id"), headers.get("x-request-id"));
        assert.doesNotMatch(JSON.stringify(Object.fromEntries(headers.entries())), /request-secret|correlation-secret/);
        return Response.json({ ok: true });
      },
    });
  });

  it("aborts a hung request and marks it as an internal request timeout", async () => {
    let capturedError: unknown;
    try {
      await fetchInternal("http://core.test/hung", {
        targetService: "gateway",
        timeoutMs: 1,
        retryDelaysMs: [],
        fetchImpl: async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      });
    } catch (error) {
      capturedError = error;
    }

    assert.ok(capturedError instanceof Error);
    const timeoutError = capturedError as Error & Record<string, unknown>;
    assert.equal(timeoutError.code, "INTERNAL_REQUEST_TIMEOUT");
    assert.equal(timeoutError.category, "dependency");
    assert.equal(timeoutError.service, "gateway");
    assert.equal(timeoutError.retryable, true);
    assert.match(String(timeoutError.requestId), /^web-gateway-/);
    assert.match(String(timeoutError.correlationId), /^web-gateway-/);
    assert.match(String(timeoutError.diagnostics), /service=gateway/);
    assert.match(String(timeoutError.diagnostics), /category=dependency/);
    assert.match(String(timeoutError.diagnostics), /status=network/);

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.gateway.timeoutCount, 1);
    assert.equal(snapshot.byTargetService.gateway.networkErrorCount, 0);
    assert.equal(snapshot.totals.timeoutCount, 1);
  });

  it("adds stable request/correlation headers and classifies non-2xx responses without leaking secrets", async () => {
    const response = await fetchInternal("http://core.test/v1/dependency", {
      targetService: "core",
      fetchImpl: async (_url, init) => {
        const headers = new Headers(init?.headers);
        assert.match(headers.get("x-request-id") ?? "", /^web-core-/);
        assert.equal(headers.get("x-correlation-id"), headers.get("x-request-id"));
        assert.equal(headers.get("x-internal-api-token"), "internal-token-that-must-stay-server-side");
        return Response.json(
          {
            error: {
              code: "INTERNAL_SERVER_ERROR",
              message: "upstream failed token=upstream-secret",
              requestId: "core-response-request",
              correlationId: headers.get("x-correlation-id"),
              category: "dependency",
              diagnostics: {
                service: "core",
                category: "dependency",
                occurredAt: "2026-07-25T01:02:03.000Z",
                requestId: "core-response-request",
                correlationId: headers.get("x-correlation-id"),
                retryable: true,
                statusCode: 500,
              },
            },
          },
          {
            status: 500,
            headers: {
              "x-request-id": "core-response-request",
              "x-correlation-id": headers.get("x-correlation-id") ?? "missing-correlation",
            },
          },
        );
      },
      headers: { "x-internal-api-token": "internal-token-that-must-stay-server-side" },
    });

    const classified = await classifyInternalDependencyError(response, {
      targetService: "core",
      fallbackMessage: "核心服务暂不可用。",
    });

    assert.equal(classified.status, 500);
    assert.equal(classified.code, "INTERNAL_SERVER_ERROR");
    assert.equal(classified.category, "dependency");
    assert.equal(classified.service, "core");
    assert.equal(classified.requestId, "core-response-request");
    assert.match(classified.correlationId ?? "", /^web-core-/);
    assert.equal(classified.occurredAt, "2026-07-25T01:02:03.000Z");
    assert.match(classified.diagnostics, /occurredAt=2026-07-25T01:02:03\.000Z/);
    assert.equal(classified.retryable, true);
    assert.equal(classified.publicMessage, "核心服务暂不可用。");
    assert.doesNotMatch(JSON.stringify(classified), /upstream-secret|internal-token-that-must-stay-server-side/);
  });

  it("redacts secret-shaped dependency response identifiers and codes", async () => {
    const classified = await classifyInternalDependencyError(
      Response.json(
        {
          error: {
            code: "token=code-secret",
            requestId: "request token=request-secret",
            correlationId: "Bearer correlation-secret",
            category: "dependency",
          },
        },
        { status: 503 },
      ),
      { targetService: "gateway", fallbackMessage: "网关暂不可用。" },
    );

    assert.equal(classified.category, "dependency");
    assert.match(JSON.stringify(classified), /\[REDACTED\]/);
    assert.doesNotMatch(JSON.stringify(classified), /code-secret|request-secret|correlation-secret/);
  });
});
