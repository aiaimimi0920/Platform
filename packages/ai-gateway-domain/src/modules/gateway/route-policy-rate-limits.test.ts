import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeRoutePolicyRateLimitDefinition,
  normalizeRoutePolicyRateLimitMap,
} from "./route-policy-rate-limits";

test("normalizeRoutePolicyRateLimitDefinition accepts a complete positive pair", () => {
  const result = normalizeRoutePolicyRateLimitDefinition("apiKeyRateLimit", { windowSeconds: 60, maxRequests: 120 }, null);
  assert.deepEqual(result, {
    windowSeconds: 60,
    maxRequests: 120,
  });
});

test("normalizeRoutePolicyRateLimitDefinition rejects incomplete values", () => {
  assert.throws(
    () => normalizeRoutePolicyRateLimitDefinition("apiKeyRateLimit", { windowSeconds: 60 }, null),
    /windowSeconds 和 maxRequests/,
  );
});

test("normalizeRoutePolicyRateLimitMap normalizes keys and values", () => {
  const result = normalizeRoutePolicyRateLimitMap(
    "modelRateLimits",
    {
      " GPT-5 ": { windowSeconds: 30, maxRequests: 10 },
    },
    null,
    { normalizeKey: (value) => value.trim().toLowerCase() },
  );

  assert.deepEqual(result, {
    "gpt-5": {
      windowSeconds: 30,
      maxRequests: 10,
    },
  });
});

test("normalizeRoutePolicyRateLimitMap rejects empty keys", () => {
  assert.throws(
    () => normalizeRoutePolicyRateLimitMap("endpointRateLimits", { "   ": { windowSeconds: 30, maxRequests: 1 } }, null),
    /key 不能为空/,
  );
});
