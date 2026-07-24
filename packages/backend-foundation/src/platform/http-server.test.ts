import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { HttpError } from "./errors";
import {
  redactPlatformText,
  getPlatformCorsObservabilitySnapshot,
  isAllowedPlatformOrigin,
  platformCorsOrigin,
  resolvePlatformRequestObservability,
  resetPlatformCorsObservabilityForTests,
  resolvePlatformAllowedOrigins,
  serializePlatformLogError,
  serializePlatformError,
} from "./http-server";

function resolveCors(origin: string | undefined): boolean {
  let allowed = false;
  platformCorsOrigin(origin, (error, allow) => {
    assert.equal(error, null);
    allowed = allow;
  });
  return allowed;
}

describe("backend foundation HTTP server helpers", () => {
  afterEach(() => {
    resetPlatformCorsObservabilityForTests();
  });

  it("uses the local web app origins as the development default", () => {
    assert.deepEqual(resolvePlatformAllowedOrigins(undefined), [
      "http://localhost:3028",
      "http://127.0.0.1:3028",
    ]);
  });

  it("parses a comma-separated allowlist and rejects unlisted origins", () => {
    const allowedOrigins = resolvePlatformAllowedOrigins(" https://ops.neuro.test, http://localhost:3028 ");

    assert.deepEqual(allowedOrigins, ["https://ops.neuro.test", "http://localhost:3028"]);
    assert.equal(isAllowedPlatformOrigin("https://ops.neuro.test", allowedOrigins), true);
    assert.equal(isAllowedPlatformOrigin("https://evil.test", allowedOrigins), false);
  });

  it("keeps HttpError payloads but hides unexpected error messages", () => {
    assert.deepEqual(serializePlatformError(new HttpError(401, "UNAUTHORIZED", "Invalid token")), {
      statusCode: 401,
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token",
          moduleKey: undefined,
        },
      },
    });

    assert.deepEqual(serializePlatformError(new Error("raw database failure")), {
      statusCode: 500,
      body: {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        },
      },
    });
  });

  it("serializes request observability and operator diagnostics without leaking credentials", () => {
    const serialized = serializePlatformError(
      new HttpError(503, "MODULE_DISABLED", "Module unavailable token=server-secret", "agentRegistry"),
      {
        service: "core",
        requestId: "request-p4-04",
        correlationId: "correlation-p4-04",
        occurredAt: "2026-07-25T01:02:03.000Z",
      },
    );

    assert.equal(serialized.statusCode, 503);
    assert.equal(serialized.body.error.requestId, "request-p4-04");
    assert.equal(serialized.body.error.correlationId, "correlation-p4-04");
    assert.equal(serialized.body.error.category, "dependency");
    assert.deepEqual(serialized.body.error.diagnostics, {
      service: "core",
      category: "dependency",
      occurredAt: "2026-07-25T01:02:03.000Z",
      requestId: "request-p4-04",
      correlationId: "correlation-p4-04",
      retryable: true,
      statusCode: 503,
      moduleKey: "agentRegistry",
    });
    assert.doesNotMatch(JSON.stringify(serialized), /server-secret/);

    const logEntry = serializePlatformLogError(
      new Error("database password=log-secret email_code=654321"),
      {
        service: "account-api",
        requestId: "request-log",
        correlationId: "correlation-log",
        occurredAt: "2026-07-25T01:02:04.000Z",
      },
    );
    assert.equal(logEntry.service, "account-api");
    assert.equal(logEntry.category, "internal");
    assert.equal(logEntry.requestId, "request-log");
    assert.doesNotMatch(JSON.stringify(logEntry), /log-secret|654321/);
  });

  it("normalizes request ids and redacts token/cookie/key/email-code shaped text", () => {
    assert.deepEqual(
      resolvePlatformRequestObservability(
        {
          "x-request-id": "request-safe-1",
          "x-correlation-id": "correlation-safe-1",
        },
        { generateId: () => "generated-safe" },
      ),
      { requestId: "request-safe-1", correlationId: "correlation-safe-1" },
    );

    const unsafe = resolvePlatformRequestObservability(
      {
        "x-request-id": "Bearer request-secret",
        "x-correlation-id": "correlation token=correlation-secret",
      },
      { generateId: () => "generated-safe" },
    );
    assert.deepEqual(unsafe, { requestId: "generated-safe", correlationId: "generated-safe" });
    assert.doesNotMatch(JSON.stringify(unsafe), /request-secret|correlation-secret/);

    const redacted = redactPlatformText(
      "Authorization: Bearer auth-secret; Cookie: sid=cookie-secret; api_key=key-secret email_code=123456 sk-live-secret",
    );
    for (const secret of ["auth-secret", "cookie-secret", "key-secret", "123456", "sk-live-secret"]) {
      assert.doesNotMatch(redacted, new RegExp(secret));
    }
    assert.match(redacted, /\[REDACTED\]/);
  });

  it("records CORS allow/reject decisions and exposes the active allowlist", () => {
    process.env.PLATFORM_ALLOWED_ORIGINS = "https://ops.neuro.test, http://localhost:3028";
    try {
      assert.equal(resolveCors("https://ops.neuro.test"), true);
      assert.equal(resolveCors("https://evil.test"), false);
      assert.equal(resolveCors(undefined), true);

      const snapshot = getPlatformCorsObservabilitySnapshot();
      assert.deepEqual(snapshot.allowedOrigins, ["https://ops.neuro.test", "http://localhost:3028"]);
      assert.equal(snapshot.checkedCount, 3);
      assert.equal(snapshot.allowedCount, 2);
      assert.equal(snapshot.rejectedCount, 1);
      assert.match(snapshot.lastCheckedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
      assert.match(snapshot.lastRejectedAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
    } finally {
      delete process.env.PLATFORM_ALLOWED_ORIGINS;
    }
  });
});
