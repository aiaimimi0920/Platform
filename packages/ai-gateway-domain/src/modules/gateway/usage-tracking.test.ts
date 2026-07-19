import assert from "node:assert/strict";
import { describe, it, before, beforeEach, mock } from "node:test";

import type {
  GatewayUsageReport,
  GatewayQuotaCheckResult,
} from "./usage-tracking";

// ---------------------------------------------------------------------------
// In-memory Redis mock
// ---------------------------------------------------------------------------

function createRedisMock() {
  const store = new Map<string, string>();
  const lists = new Map<string, string[]>();

  const redisMock = {
    get: mock.fn(async (key: string) => store.get(key) ?? null),

    set: mock.fn(async (key: string, value: string | number, ..._rest: unknown[]) => {
      store.set(key, String(value));
      return "OK";
    }),

    decrby: mock.fn(async (key: string, decrement: number) => {
      const current = parseInt(store.get(key) ?? "0", 10);
      const next = current - decrement;
      store.set(key, String(next));
      return next;
    }),

    rpush: mock.fn(async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.push(value);
      lists.set(key, list);
      return list.length;
    }),

    lpop: mock.fn(async (key: string) => {
      const list = lists.get(key);
      if (!list || list.length === 0) {
        return null;
      }
      return list.shift()!;
    }),

    // Expose internals for test assertions
    _store: store,
    _lists: lists,
  };

  return redisMock;
}

function resetRedisMock(redisMock: ReturnType<typeof createRedisMock>): void {
  redisMock._store.clear();
  redisMock._lists.clear();
  redisMock.get.mock.resetCalls();
  redisMock.set.mock.resetCalls();
  redisMock.decrby.mock.resetCalls();
  redisMock.rpush.mock.resetCalls();
  redisMock.lpop.mock.resetCalls();
}

// ---------------------------------------------------------------------------
// Module loader with mocked Redis
// ---------------------------------------------------------------------------

const redisMock = createRedisMock();

let parseUpstreamUsage: (responseBody: unknown, provider: string) => {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null;
let estimateTokenCount: (text: string) => number;
let checkGatewayQuota: (args: {
  credentialId: string;
  estimatedTokens: number;
}) => Promise<GatewayQuotaCheckResult>;
let deductGatewayQuota: (args: {
  credentialId: string;
  tokens: number;
}) => Promise<number>;
let initGatewayQuota: (args: {
  credentialId: string;
  totalTokens: number;
  ttlSeconds?: number;
}) => Promise<void>;
let enqueueGatewayUsageReport: (report: GatewayUsageReport) => Promise<void>;
let dequeueGatewayUsageReports: (batchSize: number) => Promise<GatewayUsageReport[]>;

// Register the ESM mock once; node:test rejects repeated registrations for the
// same specifier. Reset only the in-memory state between individual tests.
before(async () => {
  mock.module("@/db/redis", {
    namedExports: { redis: redisMock },
  });

  const mod = await import("./usage-tracking");
  parseUpstreamUsage = mod.parseUpstreamUsage;
  estimateTokenCount = mod.estimateTokenCount;
  checkGatewayQuota = mod.checkGatewayQuota;
  deductGatewayQuota = mod.deductGatewayQuota;
  initGatewayQuota = mod.initGatewayQuota;
  enqueueGatewayUsageReport = mod.enqueueGatewayUsageReport;
  dequeueGatewayUsageReports = mod.dequeueGatewayUsageReports;
});

beforeEach(() => {
  resetRedisMock(redisMock);
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSampleReport(overrides: Partial<GatewayUsageReport> = {}): GatewayUsageReport {
  return {
    requestId: "req-1",
    credentialId: "cred-1",
    projectId: "proj-1",
    userId: "user-1",
    model: "gpt-4",
    provider: "openai",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    requestStartedAt: "2026-04-07T00:00:00.000Z",
    requestCompletedAt: "2026-04-07T00:00:01.500Z",
    latencyMs: 1500,
    success: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseUpstreamUsage
// ---------------------------------------------------------------------------

describe("parseUpstreamUsage", () => {
  it("parses standard OpenAI response", () => {
    const body = {
      id: "chatcmpl-abc",
      choices: [],
      usage: {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
      },
    };
    const result = parseUpstreamUsage(body, "openai");
    assert.deepEqual(result, {
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
    });
  });

  it("computes totalTokens when missing in OpenAI format", () => {
    const body = {
      usage: {
        prompt_tokens: 50,
        completion_tokens: 30,
      },
    };
    const result = parseUpstreamUsage(body, "openai");
    assert.deepEqual(result, {
      promptTokens: 50,
      completionTokens: 30,
      totalTokens: 80,
    });
  });

  it("parses Anthropic response", () => {
    const body = {
      id: "msg_abc",
      type: "message",
      content: [],
      usage: {
        input_tokens: 200,
        output_tokens: 150,
      },
    };
    const result = parseUpstreamUsage(body, "anthropic");
    assert.deepEqual(result, {
      promptTokens: 200,
      completionTokens: 150,
      totalTokens: 350,
    });
  });

  it("parses Anthropic provider with mixed casing and whitespace", () => {
    const body = {
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    const result = parseUpstreamUsage(body, "  Anthropic  ");
    assert.deepEqual(result, {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it("returns null for null body", () => {
    assert.equal(parseUpstreamUsage(null, "openai"), null);
  });

  it("returns null for non-object body", () => {
    assert.equal(parseUpstreamUsage("not an object", "openai"), null);
  });

  it("returns null when usage field is missing", () => {
    assert.equal(parseUpstreamUsage({ id: "x" }, "openai"), null);
  });

  it("returns null when usage is not an object", () => {
    assert.equal(parseUpstreamUsage({ usage: "bad" }, "openai"), null);
  });

  it("returns null when OpenAI usage has non-numeric tokens", () => {
    const body = {
      usage: { prompt_tokens: "abc", completion_tokens: 10, total_tokens: 10 },
    };
    assert.equal(parseUpstreamUsage(body, "openai"), null);
  });

  it("returns null when Anthropic usage has missing fields", () => {
    const body = {
      usage: { input_tokens: 10 },
    };
    assert.equal(parseUpstreamUsage(body, "anthropic"), null);
  });

  it("falls back to OpenAI format for unknown providers", () => {
    const body = {
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    };
    const result = parseUpstreamUsage(body, "azure_openai");
    assert.deepEqual(result, {
      promptTokens: 5,
      completionTokens: 3,
      totalTokens: 8,
    });
  });
});

// ---------------------------------------------------------------------------
// estimateTokenCount
// ---------------------------------------------------------------------------

describe("estimateTokenCount", () => {
  it("returns 0 for empty string", () => {
    assert.equal(estimateTokenCount(""), 0);
  });

  it("estimates tokens for a short string", () => {
    // "hello" = 5 chars => ceil(5/4) = 2
    assert.equal(estimateTokenCount("hello"), 2);
  });

  it("estimates tokens for a longer string", () => {
    const text = "a".repeat(100);
    assert.equal(estimateTokenCount(text), 25);
  });

  it("rounds up fractional tokens", () => {
    // 7 chars => ceil(7/4) = 2
    assert.equal(estimateTokenCount("abcdefg"), 2);
  });

  it("handles single character", () => {
    assert.equal(estimateTokenCount("x"), 1);
  });
});

// ---------------------------------------------------------------------------
// checkGatewayQuota
// ---------------------------------------------------------------------------

describe("checkGatewayQuota", () => {
  it("returns allowed when remaining exceeds estimated", async () => {
    await initGatewayQuota({ credentialId: "cred-1", totalTokens: 5000 });

    const result = await checkGatewayQuota({ credentialId: "cred-1", estimatedTokens: 1000 });
    assert.equal(result.allowed, true);
    assert.equal(result.remainingTokens, 5000);
    assert.equal(result.reason, undefined);
  });

  it("returns allowed when remaining equals estimated exactly", async () => {
    await initGatewayQuota({ credentialId: "cred-exact", totalTokens: 500 });

    const result = await checkGatewayQuota({ credentialId: "cred-exact", estimatedTokens: 500 });
    assert.equal(result.allowed, true);
    assert.equal(result.remainingTokens, 500);
  });

  it("returns not allowed when remaining is below estimated", async () => {
    await initGatewayQuota({ credentialId: "cred-low", totalTokens: 500 });

    const result = await checkGatewayQuota({ credentialId: "cred-low", estimatedTokens: 1000 });
    assert.equal(result.allowed, false);
    assert.equal(result.remainingTokens, 500);
    assert.equal(result.reason, "quota_exceeded");
  });

  it("returns not allowed when quota key does not exist", async () => {
    const result = await checkGatewayQuota({ credentialId: "nonexistent", estimatedTokens: 1 });
    assert.equal(result.allowed, false);
    assert.equal(result.remainingTokens, 0);
    assert.equal(result.reason, "quota_not_initialized");
  });
});

// ---------------------------------------------------------------------------
// deductGatewayQuota
// ---------------------------------------------------------------------------

describe("deductGatewayQuota", () => {
  it("decrements the counter and returns the new value", async () => {
    await initGatewayQuota({ credentialId: "cred-d1", totalTokens: 5000 });

    const remaining = await deductGatewayQuota({ credentialId: "cred-d1", tokens: 1200 });
    assert.equal(remaining, 3800);
  });

  it("can go negative (over-deduction)", async () => {
    await initGatewayQuota({ credentialId: "cred-d2", totalTokens: 100 });

    const remaining = await deductGatewayQuota({ credentialId: "cred-d2", tokens: 500 });
    assert.equal(remaining, -400);
  });

  it("successive deductions accumulate", async () => {
    await initGatewayQuota({ credentialId: "cred-d3", totalTokens: 10000 });

    await deductGatewayQuota({ credentialId: "cred-d3", tokens: 3000 });
    const remaining = await deductGatewayQuota({ credentialId: "cred-d3", tokens: 2000 });
    assert.equal(remaining, 5000);
  });
});

// ---------------------------------------------------------------------------
// initGatewayQuota
// ---------------------------------------------------------------------------

describe("initGatewayQuota", () => {
  it("sets the quota counter", async () => {
    await initGatewayQuota({ credentialId: "cred-init", totalTokens: 10000 });
    assert.equal(redisMock._store.get("gw:quota:cred-init"), "10000");
  });

  it("calls SET with EX when ttlSeconds is provided", async () => {
    await initGatewayQuota({ credentialId: "cred-ttl", totalTokens: 8000, ttlSeconds: 3600 });
    assert.equal(redisMock._store.get("gw:quota:cred-ttl"), "8000");

    // Verify the SET call included EX and TTL args
    const calls = redisMock.set.mock.calls;
    const lastCall = calls[calls.length - 1];
    assert.deepEqual(lastCall.arguments, ["gw:quota:cred-ttl", 8000, "EX", 3600]);
  });

  it("calls SET without EX when ttlSeconds is omitted", async () => {
    await initGatewayQuota({ credentialId: "cred-no-ttl", totalTokens: 5000 });

    const calls = redisMock.set.mock.calls;
    const lastCall = calls[calls.length - 1];
    assert.deepEqual(lastCall.arguments, ["gw:quota:cred-no-ttl", 5000]);
  });
});

// ---------------------------------------------------------------------------
// enqueueGatewayUsageReport / dequeueGatewayUsageReports
// ---------------------------------------------------------------------------

describe("usage report queue", () => {
  it("enqueues and dequeues a single report", async () => {
    const report = makeSampleReport();
    await enqueueGatewayUsageReport(report);

    const batch = await dequeueGatewayUsageReports(10);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].requestId, "req-1");
    assert.equal(batch[0].totalTokens, 150);
    assert.equal(batch[0].success, true);
  });

  it("dequeues in FIFO order", async () => {
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-a" }));
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-b" }));
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-c" }));

    const batch = await dequeueGatewayUsageReports(10);
    assert.equal(batch.length, 3);
    assert.equal(batch[0].requestId, "req-a");
    assert.equal(batch[1].requestId, "req-b");
    assert.equal(batch[2].requestId, "req-c");
  });

  it("respects batchSize limit", async () => {
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-1" }));
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-2" }));
    await enqueueGatewayUsageReport(makeSampleReport({ requestId: "req-3" }));

    const batch = await dequeueGatewayUsageReports(2);
    assert.equal(batch.length, 2);
    assert.equal(batch[0].requestId, "req-1");
    assert.equal(batch[1].requestId, "req-2");

    // Third report should still be in the queue
    const remaining = await dequeueGatewayUsageReports(10);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].requestId, "req-3");
  });

  it("returns empty array when queue is empty", async () => {
    const batch = await dequeueGatewayUsageReports(10);
    assert.deepEqual(batch, []);
  });

  it("handles report with optional fields", async () => {
    const report = makeSampleReport({
      requestId: "req-err",
      success: false,
      errorCode: "upstream_timeout",
      estimatedCostMicros: 1250,
    });
    await enqueueGatewayUsageReport(report);

    const batch = await dequeueGatewayUsageReports(1);
    assert.equal(batch[0].success, false);
    assert.equal(batch[0].errorCode, "upstream_timeout");
    assert.equal(batch[0].estimatedCostMicros, 1250);
  });
});
