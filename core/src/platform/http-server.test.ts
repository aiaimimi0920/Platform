import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "./errors";
import { isAllowedPlatformOrigin, serializePlatformError } from "./http-server";

describe("platform HTTP server helpers", () => {
  it("allows only configured browser origins while preserving non-browser requests", () => {
    const allowedOrigins = ["http://localhost:3028", "https://ops.neuro.test"];

    assert.equal(isAllowedPlatformOrigin(undefined, allowedOrigins), true);
    assert.equal(isAllowedPlatformOrigin("http://localhost:3028", allowedOrigins), true);
    assert.equal(isAllowedPlatformOrigin("https://ops.neuro.test", allowedOrigins), true);
    assert.equal(isAllowedPlatformOrigin("https://evil.test", allowedOrigins), false);
  });

  it("serializes HttpError without changing the public payload", () => {
    const response = serializePlatformError(new HttpError(404, "NOT_FOUND", "Agent not found"));

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
      error: {
        code: "NOT_FOUND",
        message: "Agent not found",
        moduleKey: undefined,
      },
    });
  });

  it("sanitizes unexpected errors as internal server errors", () => {
    const response = serializePlatformError(new Error("database password leaked in stack"));

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  });
});
