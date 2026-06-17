import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { HttpError } from "./errors";
import {
  getPlatformCorsObservabilitySnapshot,
  isAllowedPlatformOrigin,
  platformCorsOrigin,
  resetPlatformCorsObservabilityForTests,
  resolvePlatformAllowedOrigins,
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
