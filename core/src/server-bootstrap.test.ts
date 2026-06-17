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

      const unexpectedError = await app.inject({ method: "GET", url: "/__boom" });
      assert.equal(unexpectedError.statusCode, 500);
      assert.deepEqual(unexpectedError.json(), {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        },
      });

      const httpError = await app.inject({ method: "GET", url: "/__http-error" });
      assert.equal(httpError.statusCode, 409);
      assert.deepEqual(httpError.json(), {
        error: {
          code: "CONFLICT",
          message: "Short and stout",
        },
      });
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
