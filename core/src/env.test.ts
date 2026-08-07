import assert from "node:assert/strict";
import test from "node:test";

test("heavy chat Gateway timeout parser rejects non-finite values", async () => {
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
  process.env.INTERNAL_API_TOKEN ??= "test-internal-token";
  const { parseHeavyChatGatewayTimeoutMs, parseInfrastructureTimeoutMs } = await import("./env");

  assert.throws(() => parseHeavyChatGatewayTimeoutMs("NaN"), /finite/i);
  assert.throws(() => parseHeavyChatGatewayTimeoutMs("Infinity"), /finite/i);
  assert.throws(() => parseHeavyChatGatewayTimeoutMs("-Infinity"), /finite/i);
  assert.equal(parseHeavyChatGatewayTimeoutMs(undefined), 30_000);
  assert.equal(parseHeavyChatGatewayTimeoutMs("500"), 1_000);
  assert.equal(parseHeavyChatGatewayTimeoutMs("4500"), 4_500);

  assert.equal(parseInfrastructureTimeoutMs(undefined, 10_000), 10_000);
  assert.equal(parseInfrastructureTimeoutMs("NaN", 10_000), 10_000);
  assert.equal(parseInfrastructureTimeoutMs("249", 10_000), 10_000);
  assert.equal(parseInfrastructureTimeoutMs("4500", 10_000), 4_500);
});
