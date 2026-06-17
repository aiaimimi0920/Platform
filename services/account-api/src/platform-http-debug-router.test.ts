import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import Fastify from "fastify";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalRedisUrl = process.env.REDIS_URL;
const originalInternalApiToken = process.env.INTERNAL_API_TOKEN;
const originalOperatorUserIds = process.env.PLATFORM_OPERATOR_USER_IDS;
const originalAllowedOrigins = process.env.PLATFORM_ALLOWED_ORIGINS;

function restoreEnv() {
  process.env.DATABASE_URL = originalDatabaseUrl ?? "postgres://account-api-test";
  process.env.REDIS_URL = originalRedisUrl ?? "redis://account-api-test";
  process.env.INTERNAL_API_TOKEN = originalInternalApiToken ?? "test-internal-token";
  if (originalOperatorUserIds === undefined) {
    delete process.env.PLATFORM_OPERATOR_USER_IDS;
  } else {
    process.env.PLATFORM_OPERATOR_USER_IDS = originalOperatorUserIds;
  }
  if (originalAllowedOrigins === undefined) {
    delete process.env.PLATFORM_ALLOWED_ORIGINS;
  } else {
    process.env.PLATFORM_ALLOWED_ORIGINS = originalAllowedOrigins;
  }
}

describe("account api platform HTTP debug router", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("exposes CORS observability only to internal platform operators", async () => {
    process.env.DATABASE_URL = "postgres://account-api-test";
    process.env.REDIS_URL = "redis://account-api-test";
    process.env.INTERNAL_API_TOKEN = "test-internal-token";
    process.env.PLATFORM_OPERATOR_USER_IDS = "operator-1";
    process.env.PLATFORM_ALLOWED_ORIGINS = "https://ops.neuro.test";

    const [
      { platformHttpDebugRouter },
      { platformCorsOrigin, resetPlatformCorsObservabilityForTests },
      { serializePlatformError },
      { HttpError },
    ] = await Promise.all([
      import("./platform-http-debug-router"),
      import("@neuro/backend-foundation/platform/http-server"),
      import("@neuro/backend-foundation/platform/http-server"),
      import("@neuro/backend-foundation/platform/errors"),
    ]);

    resetPlatformCorsObservabilityForTests();
    platformCorsOrigin("https://evil.test", () => {});

    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const serialized = error instanceof HttpError ? serializePlatformError(error) : serializePlatformError(error);
      return reply.status(serialized.statusCode).send(serialized.body);
    });
    await app.register(platformHttpDebugRouter);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/internal/platform/http/cors",
        headers: {
          "x-internal-api-token": "test-internal-token",
          "x-neuro-user-id": "operator-1",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {
        cors: {
          allowedOrigins: ["https://ops.neuro.test"],
          checkedCount: 1,
          allowedCount: 0,
          rejectedCount: 1,
          lastCheckedAt: response.json().cors.lastCheckedAt,
          lastRejectedAt: response.json().cors.lastRejectedAt,
        },
      });
    } finally {
      await app.close();
    }
  });
});
