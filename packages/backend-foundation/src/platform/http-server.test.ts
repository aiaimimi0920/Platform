import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "./errors";
import { isAllowedPlatformOrigin, resolvePlatformAllowedOrigins, serializePlatformError } from "./http-server";

describe("backend foundation HTTP server helpers", () => {
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
});
