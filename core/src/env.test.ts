import assert from "node:assert/strict";
import test from "node:test";

test("heavy chat Gateway timeout parser rejects non-finite values", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
  process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
  const { parseHeavyChatGatewayTimeoutMs } = await import("./env");

  assert.throws(() => parseHeavyChatGatewayTimeoutMs("NaN"), /finite/i);
  assert.throws(() => parseHeavyChatGatewayTimeoutMs("Infinity"), /finite/i);
  assert.throws(() => parseHeavyChatGatewayTimeoutMs("-Infinity"), /finite/i);
  assert.equal(parseHeavyChatGatewayTimeoutMs(undefined), 30_000);
  assert.equal(parseHeavyChatGatewayTimeoutMs("500"), 1_000);
  assert.equal(parseHeavyChatGatewayTimeoutMs("4500"), 4_500);
});
