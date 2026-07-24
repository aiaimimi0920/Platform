import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "@/platform/errors";

process.env.DATABASE_URL ??= "postgres://neuro:test@127.0.0.1:1/neuro_test";
process.env.REDIS_URL ??= "redis://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";

describe("core server bootstrap", () => {
  it("builds health, ready, and error handling without platform initialization or domain routers", async () => {
    const { buildServer } = await import("./server");
    let readyChecks = 0;
    const app = await buildServer({
      initializePlatform: false,
      registerDomainRouters: false,
      readyCheck: async () => {
        readyChecks += 1;
      },
    });

    try {
      app.get("/__boom", async () => {
        throw new Error("unexpected failure detail");
      });
      app.get("/__http-error", async () => {
        throw new HttpError(409, "CONFLICT", "Short and stout");
      });
      app.get("/__dependency-error", async () => {
        throw new HttpError(503, "MODULE_DISABLED", "Module unavailable token=module-secret", "agentRegistry");
      });

      const health = await app.inject({ method: "GET", url: "/health" });
      assert.equal(health.statusCode, 200);
      assert.deepEqual(health.json(), {
        ok: true,
        service: "core",
      });

      const ready = await app.inject({ method: "GET", url: "/ready" });
      assert.equal(ready.statusCode, 200);
      assert.deepEqual(ready.json(), {
        ok: true,
        ready: true,
        service: "core",
      });
      assert.equal(readyChecks, 1);

      const unexpectedError = await app.inject({
        method: "GET",
        url: "/__boom",
        headers: {
          "x-request-id": "core-boom-request",
          "x-correlation-id": "core-boom-correlation",
        },
      });
      assert.equal(unexpectedError.statusCode, 500);
      assert.equal(unexpectedError.headers["x-request-id"], "core-boom-request");
      assert.equal(unexpectedError.headers["x-correlation-id"], "core-boom-correlation");
      const unexpectedBody = unexpectedError.json();
      assert.deepEqual(unexpectedBody, {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          requestId: "core-boom-request",
          correlationId: "core-boom-correlation",
          category: "internal",
          diagnostics: {
            service: "core",
            category: "internal",
            occurredAt: unexpectedBody.error.diagnostics.occurredAt,
            requestId: "core-boom-request",
            correlationId: "core-boom-correlation",
            retryable: true,
            statusCode: 500,
          },
        },
      });
      assert.match(unexpectedBody.error.diagnostics.occurredAt, /^\d{4}-\d{2}-\d{2}T/);

      const httpError = await app.inject({
        method: "GET",
        url: "/__http-error",
        headers: { "x-request-id": "core-conflict-request" },
      });
      assert.equal(httpError.statusCode, 409);
      assert.equal(httpError.headers["x-request-id"], "core-conflict-request");
      assert.equal(httpError.json().error.category, "conflict");

      const dependencyError = await app.inject({
        method: "GET",
        url: "/__dependency-error",
        headers: {
          "x-request-id": "core-dependency-request",
          "x-correlation-id": "core-dependency-correlation",
        },
      });
      const dependencyBody = dependencyError.json();
      assert.equal(dependencyError.statusCode, 503);
      assert.equal(dependencyError.headers["x-request-id"], "core-dependency-request");
      assert.equal(dependencyError.headers["x-correlation-id"], "core-dependency-correlation");
      assert.equal(dependencyBody.error.category, "dependency");
      assert.equal(dependencyBody.error.diagnostics.service, "core");
      assert.equal(dependencyBody.error.diagnostics.requestId, "core-dependency-request");
      assert.equal(dependencyBody.error.diagnostics.correlationId, "core-dependency-correlation");
      assert.equal(dependencyBody.error.diagnostics.retryable, true);
      assert.doesNotMatch(JSON.stringify(dependencyBody), /module-secret/);
    } finally {
      await app.close();
    }
  });

  it("runs an injected platform initializer exactly once", async () => {
    const { buildServer } = await import("./server");
    let platformInitializations = 0;
    const app = await buildServer({
      initializePlatform: async () => {
        platformInitializations += 1;
      },
      registerDomainRouters: false,
      readyCheck: async () => {},
    });

    try {
      assert.equal(platformInitializations, 1);
    } finally {
      await app.close();
    }
  });
});
