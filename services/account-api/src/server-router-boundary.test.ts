import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

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
});
