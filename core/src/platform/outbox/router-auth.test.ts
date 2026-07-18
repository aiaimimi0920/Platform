import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FastifyRequest } from "fastify";

process.env.DATABASE_URL ??= "postgres://neuro:test@127.0.0.1:1/neuro_test";
process.env.REDIS_URL ??= "redis://127.0.0.1:1";
process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
process.env.PLATFORM_OPERATOR_USER_IDS ??= "test-operator";

function requestWithHeaders(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("outbox alert executor authentication", () => {
  it("allows an internal machine call without user context", async () => {
    const { assertOptionalOutboxAlertOperator } = await import("./router");

    assert.doesNotThrow(() => assertOptionalOutboxAlertOperator(requestWithHeaders({})));
  });

  it("still enforces operator authorization when a user context is supplied", async () => {
    const { assertOptionalOutboxAlertOperator } = await import("./router");

    assert.doesNotThrow(() =>
      assertOptionalOutboxAlertOperator(
        requestWithHeaders({
          "x-neuro-user-id": "test-operator",
        }),
      ),
    );
    assert.throws(
      () =>
        assertOptionalOutboxAlertOperator(
          requestWithHeaders({
            "x-neuro-user-id": "not-an-operator",
          }),
        ),
      /operator/i,
    );
  });
});
