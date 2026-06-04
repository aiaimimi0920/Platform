import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRoutePolicyGuardrails } from "./route-policy-guardrails";

test("normalizeRoutePolicyGuardrails returns null guardrails by default", () => {
  const normalized = normalizeRoutePolicyGuardrails({});
  assert.equal(normalized.maxRequestBodyBytes, null);
  assert.equal(normalized.streamIdleTimeoutSeconds, null);
  assert.equal(normalized.totalRequestTimeoutSeconds, null);
  assert.equal(normalized.maxStreamHeartbeatGapSeconds, null);
});

test("normalizeRoutePolicyGuardrails accepts positive values and preserves them", () => {
  const normalized = normalizeRoutePolicyGuardrails({
    maxRequestBodyBytes: 5_000_000,
    streamIdleTimeoutSeconds: 120,
    totalRequestTimeoutSeconds: 240,
    maxStreamHeartbeatGapSeconds: 30,
  });
  assert.equal(normalized.maxRequestBodyBytes, 5_000_000);
  assert.equal(normalized.streamIdleTimeoutSeconds, 120);
  assert.equal(normalized.totalRequestTimeoutSeconds, 240);
  assert.equal(normalized.maxStreamHeartbeatGapSeconds, 30);
});

test("normalizeRoutePolicyGuardrails rejects non-positive or fractional values", () => {
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ maxRequestBodyBytes: 0 }),
    /maxRequestBodyBytes 必须是正整数/,
  );
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ streamIdleTimeoutSeconds: -1 }),
    /streamIdleTimeoutSeconds 必须是正整数/,
  );
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ totalRequestTimeoutSeconds: 0.5 }),
    /totalRequestTimeoutSeconds 必须是正整数/,
  );
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ maxStreamHeartbeatGapSeconds: 1.1 }),
    /maxStreamHeartbeatGapSeconds 必须是正整数/,
  );
});

test("normalizeRoutePolicyGuardrails enforces maximum thresholds", () => {
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ maxRequestBodyBytes: 1_000_000_001 }),
    /maxRequestBodyBytes 不能超过 1000000000/,
  );
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ streamIdleTimeoutSeconds: 1000 }),
    /streamIdleTimeoutSeconds 不能超过 300/,
  );
  assert.throws(
    () => normalizeRoutePolicyGuardrails({ maxStreamHeartbeatGapSeconds: 1200 }),
    /maxStreamHeartbeatGapSeconds 不能超过 60/,
  );
});
