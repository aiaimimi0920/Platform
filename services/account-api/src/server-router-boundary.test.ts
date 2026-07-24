import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import Fastify from "fastify";

import { HttpError } from "@neuro/backend-foundation/platform/errors";
import {
  registerPlatformRequestObservability,
  serializePlatformError,
} from "@neuro/backend-foundation/platform/http-server";

const srcDir = join(process.cwd(), "src");

const notificationWebhookRoutePaths = [
  "/v1/internal/notification-webhooks/catalog",
  "/v1/internal/notification-webhooks/incidents/views",
  "/v1/internal/notification-webhooks/incidents/views/default",
  "/v1/internal/notification-webhooks/incidents/views/:viewId/default",
  "/v1/internal/notification-webhooks/incidents/views/:viewId",
  "/v1/internal/notification-webhooks/incidents/views/:viewId/delete",
  "/v1/internal/notification-webhooks/incidents",
  "/v1/internal/notification-webhooks/incidents/acknowledge-batch",
  "/v1/internal/notification-webhooks/incidents/silence-batch",
  "/v1/internal/notification-webhooks/incidents/clear-silence-batch",
  "/v1/internal/notification-webhooks/incidents/:incidentKey/acknowledge",
  "/v1/internal/notification-webhooks/incidents/:incidentKey/silence",
  "/v1/internal/notification-webhooks/incidents/:incidentKey/clear-silence",
] as const;

describe("account api server route boundaries", () => {
  it("keeps notification webhook ops routes in their router module", () => {
    const server = readFileSync(join(srcDir, "server.ts"), "utf8");
    const router = readFileSync(join(srcDir, "notification-webhook-ops-router.ts"), "utf8");

    assert.match(router, /export async function notificationWebhookOpsRouter\(/);
    assert.match(server, /notificationWebhookOpsRouter/);
    assert.match(server, /app\.register\(notificationWebhookOpsRouter\)/);

    for (const routePath of notificationWebhookRoutePaths) {
      assert.match(router, new RegExp(routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(server, new RegExp(routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("returns safe account-api diagnostics with request correlation headers", async () => {
    const app = Fastify({ logger: false });
    registerPlatformRequestObservability(app, { service: "account-api" });
    app.get("/__dependency-error", async () => {
      throw new HttpError(503, "MODULE_DISABLED", "Account module unavailable token=account-secret", "benefits");
    });
    app.setErrorHandler((error, request, reply) => {
      const serialized = serializePlatformError(error, {
        service: "account-api",
        requestId: request.platformRequest.requestId,
        correlationId: request.platformRequest.correlationId,
      });
      return reply.status(serialized.statusCode).send(serialized.body);
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/__dependency-error",
        headers: {
          "x-request-id": "account-dependency-request",
          "x-correlation-id": "account-dependency-correlation",
        },
      });

      const body = response.json();
      assert.equal(response.statusCode, 503);
      assert.equal(response.headers["x-request-id"], "account-dependency-request");
      assert.equal(response.headers["x-correlation-id"], "account-dependency-correlation");
      assert.equal(body.error.category, "dependency");
      assert.equal(body.error.diagnostics.service, "account-api");
      assert.equal(body.error.diagnostics.requestId, "account-dependency-request");
      assert.equal(body.error.diagnostics.correlationId, "account-dependency-correlation");
      assert.equal(body.error.diagnostics.retryable, true);
      assert.doesNotMatch(JSON.stringify(body), /account-secret/);
    } finally {
      await app.close();
    }
  });
});
