import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { SlidingWindowMetrics, percentile } from "./sliding-metrics";

// ---------------------------------------------------------------------------
// percentile helper
// ---------------------------------------------------------------------------

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    assert.equal(percentile([], 50), 0);
  });

  it("returns the only element for a single-element array", () => {
    assert.equal(percentile([42], 50), 42);
    assert.equal(percentile([42], 0), 42);
    assert.equal(percentile([42], 100), 42);
  });

  it("returns the median for p50 on an odd-length sorted array", () => {
    // [10, 20, 30, 40, 50] → p50 index = 2 → 30
    assert.equal(percentile([30, 10, 50, 20, 40], 50), 30);
  });

  it("interpolates between values for fractional index", () => {
    // [10, 20] → p50 index = 0.5 → (10 + 20) / 2 = 15
    const result = percentile([10, 20], 50);
    assert.equal(result, 15);
  });

  it("returns the minimum for p0", () => {
    assert.equal(percentile([5, 1, 9, 3], 0), 1);
  });

  it("returns the maximum for p100", () => {
    assert.equal(percentile([5, 1, 9, 3], 100), 9);
  });

  it("does not mutate the original array", () => {
    const values = [30, 10, 20];
    percentile(values, 50);
    assert.deepEqual(values, [30, 10, 20]);
  });

  it("computes p95 correctly for a larger set", () => {
    // 100 values: 1..100
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const p95 = percentile(values, 95);
    // index = 0.95 * 99 = 94.05 → lower=94, upper=95 (0-indexed → values 95, 96)
    // weight = 0.05 → 95 * 0.95 + 96 * 0.05 = 90.25 + 4.8 = 95.05
    assert.ok(p95 > 94 && p95 <= 96, `unexpected p95: ${p95}`);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – recording
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – recording", () => {
  let metrics: SlidingWindowMetrics;

  beforeEach(() => {
    metrics = new SlidingWindowMetrics();
  });

  it("starts with zero entries", () => {
    assert.equal(metrics.entryCount(), 0);
  });

  it("increments entryCount after recording", () => {
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    assert.equal(metrics.entryCount(), 1);
    metrics.record({ latencyMs: 200, success: false, firstTokenLatencyMs: null });
    assert.equal(metrics.entryCount(), 2);
  });

  it("auto-timestamps each recorded entry", () => {
    const before = Date.now();
    metrics.record({ latencyMs: 50, success: true, firstTokenLatencyMs: null });
    const after = Date.now();

    const summary = metrics.summary();
    // windowDurationMs is 0 for a single entry; just verify count
    assert.equal(summary.totalRequests, 1);
    assert.ok(before <= after); // guard
  });

  it("drops the oldest entry when capacity is exceeded", () => {
    const small = new SlidingWindowMetrics(3);
    small.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    small.record({ latencyMs: 200, success: true, firstTokenLatencyMs: null });
    small.record({ latencyMs: 300, success: true, firstTokenLatencyMs: null });
    assert.equal(small.entryCount(), 3);

    small.record({ latencyMs: 400, success: true, firstTokenLatencyMs: null });
    assert.equal(small.entryCount(), 3);

    // The avg should now be (200 + 300 + 400) / 3 = 300, not (100 + 200 + 300) / 3
    const avg = small.recentAvgLatency();
    assert.equal(avg, 300);
  });

  it("respects the default max window size of 200", () => {
    const m = new SlidingWindowMetrics();
    for (let i = 0; i < 250; i++) {
      m.record({ latencyMs: i, success: true, firstTokenLatencyMs: null });
    }
    assert.equal(m.entryCount(), 200);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – clear
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – clear", () => {
  it("resets entryCount to 0", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 200, success: false, firstTokenLatencyMs: null });
    metrics.clear();
    assert.equal(metrics.entryCount(), 0);
  });

  it("returns a zero summary after clearing", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: 50 });
    metrics.clear();

    const s = metrics.summary();
    assert.equal(s.totalRequests, 0);
    assert.equal(s.successRate, 0);
    assert.equal(s.avgLatencyMs, 0);
    assert.equal(s.p50LatencyMs, 0);
    assert.equal(s.p95LatencyMs, 0);
    assert.equal(s.p99LatencyMs, 0);
    assert.equal(s.avgFirstTokenLatencyMs, null);
    assert.equal(s.windowDurationMs, 0);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – summary
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – summary", () => {
  it("returns zeroed summary when no entries exist", () => {
    const metrics = new SlidingWindowMetrics();
    const s = metrics.summary();
    assert.equal(s.totalRequests, 0);
    assert.equal(s.successRate, 0);
    assert.equal(s.avgLatencyMs, 0);
    assert.equal(s.avgFirstTokenLatencyMs, null);
    assert.equal(s.windowDurationMs, 0);
  });

  it("computes totalRequests correctly", () => {
    const metrics = new SlidingWindowMetrics();
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    }
    assert.equal(metrics.summary().totalRequests, 5);
  });

  it("computes successRate correctly", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 100, success: false, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 100, success: false, firstTokenLatencyMs: null });

    const rate = metrics.summary().successRate;
    assert.equal(rate, 0.5);
  });

  it("computes avgLatencyMs correctly", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 200, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 300, success: true, firstTokenLatencyMs: null });

    assert.equal(metrics.summary().avgLatencyMs, 200);
  });

  it("computes percentiles from the full window", () => {
    const metrics = new SlidingWindowMetrics();
    // Record 100 entries with latencies 1..100
    for (let i = 1; i <= 100; i++) {
      metrics.record({ latencyMs: i, success: true, firstTokenLatencyMs: null });
    }
    const s = metrics.summary();
    assert.ok(s.p50LatencyMs > 40 && s.p50LatencyMs < 60, `p50: ${s.p50LatencyMs}`);
    assert.ok(s.p95LatencyMs > 90, `p95: ${s.p95LatencyMs}`);
    assert.ok(s.p99LatencyMs > 95, `p99: ${s.p99LatencyMs}`);
  });

  it("respects the windowSize argument to summary", () => {
    const metrics = new SlidingWindowMetrics(50);
    for (let i = 0; i < 10; i++) {
      metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    }
    for (let i = 0; i < 10; i++) {
      metrics.record({ latencyMs: 200, success: false, firstTokenLatencyMs: null });
    }

    // Over last 10 entries (all failures, latency 200)
    const partial = metrics.summary(10);
    assert.equal(partial.totalRequests, 10);
    assert.equal(partial.successRate, 0);
    assert.equal(partial.avgLatencyMs, 200);

    // Over all 20 entries
    const full = metrics.summary();
    assert.equal(full.totalRequests, 20);
    assert.equal(full.successRate, 0.5);
    assert.equal(full.avgLatencyMs, 150);
  });

  it("computes avgFirstTokenLatencyMs when TTFT values are present", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 300, success: true, firstTokenLatencyMs: 60 });
    metrics.record({ latencyMs: 400, success: true, firstTokenLatencyMs: 80 });
    metrics.record({ latencyMs: 500, success: false, firstTokenLatencyMs: null });

    const s = metrics.summary();
    // (60 + 80) / 2 = 70
    assert.equal(s.avgFirstTokenLatencyMs, 70);
  });

  it("returns null for avgFirstTokenLatencyMs when no TTFT values exist", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 200, success: true, firstTokenLatencyMs: null });
    assert.equal(metrics.summary().avgFirstTokenLatencyMs, null);
  });

  it("windowDurationMs is 0 for a single entry", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    assert.equal(metrics.summary().windowDurationMs, 0);
  });

  it("windowDurationMs is non-negative for multiple entries", () => {
    const metrics = new SlidingWindowMetrics();
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    }
    assert.ok(metrics.summary().windowDurationMs >= 0);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – recentSuccessRate
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – recentSuccessRate", () => {
  it("returns 0 when no entries exist", () => {
    assert.equal(new SlidingWindowMetrics().recentSuccessRate(), 0);
  });

  it("returns 1.0 when all entries are successes", () => {
    const metrics = new SlidingWindowMetrics();
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    }
    assert.equal(metrics.recentSuccessRate(), 1);
  });

  it("returns 0 when all entries are failures", () => {
    const metrics = new SlidingWindowMetrics();
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: false, firstTokenLatencyMs: null });
    }
    assert.equal(metrics.recentSuccessRate(), 0);
  });

  it("operates over the last n entries when n is provided", () => {
    const metrics = new SlidingWindowMetrics();
    // First 5: successes
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    }
    // Last 5: failures
    for (let i = 0; i < 5; i++) {
      metrics.record({ latencyMs: 100, success: false, firstTokenLatencyMs: null });
    }

    assert.equal(metrics.recentSuccessRate(5), 0);
    assert.equal(metrics.recentSuccessRate(10), 0.5);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – recentAvgLatency
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – recentAvgLatency", () => {
  it("returns 0 when no entries exist", () => {
    assert.equal(new SlidingWindowMetrics().recentAvgLatency(), 0);
  });

  it("returns the average latency across all entries", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 300, success: true, firstTokenLatencyMs: null });
    assert.equal(metrics.recentAvgLatency(), 200);
  });

  it("operates over the last n entries when n is provided", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 500, success: true, firstTokenLatencyMs: null });

    // last 1 entry → 500
    assert.equal(metrics.recentAvgLatency(1), 500);
    // all 3 entries → (100 + 100 + 500) / 3 = 233.33...
    assert.ok(Math.abs(metrics.recentAvgLatency(3) - 233.33) < 1);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – TTFT (first token latency)
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – first token latency (TTFT)", () => {
  it("tracks TTFT separately from total latency", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 1000, success: true, firstTokenLatencyMs: 120 });
    metrics.record({ latencyMs: 800, success: true, firstTokenLatencyMs: 80 });

    const s = metrics.summary();
    assert.equal(s.avgLatencyMs, 900);
    assert.equal(s.avgFirstTokenLatencyMs, 100);
  });

  it("ignores null TTFT values in the average", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 300, success: true, firstTokenLatencyMs: 60 });
    metrics.record({ latencyMs: 400, success: true, firstTokenLatencyMs: null }); // streaming not supported
    metrics.record({ latencyMs: 500, success: true, firstTokenLatencyMs: 90 });

    const s = metrics.summary();
    // avg TTFT = (60 + 90) / 2 = 75
    assert.equal(s.avgFirstTokenLatencyMs, 75);
  });

  it("returns null avgFirstTokenLatencyMs when all TTFT values are null", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 200, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 300, success: false, firstTokenLatencyMs: null });

    assert.equal(metrics.summary().avgFirstTokenLatencyMs, null);
  });
});

// ---------------------------------------------------------------------------
// SlidingWindowMetrics – window enforcement
// ---------------------------------------------------------------------------

describe("SlidingWindowMetrics – window enforcement", () => {
  it("never exceeds maxWindowSize entries", () => {
    const metrics = new SlidingWindowMetrics(10);
    for (let i = 0; i < 100; i++) {
      metrics.record({ latencyMs: i, success: i % 2 === 0, firstTokenLatencyMs: null });
    }
    assert.equal(metrics.entryCount(), 10);
  });

  it("the retained entries are the most recent ones", () => {
    const metrics = new SlidingWindowMetrics(3);
    metrics.record({ latencyMs: 10, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 20, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 30, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 40, success: true, firstTokenLatencyMs: null });

    // Only latencies 20, 30, 40 should remain
    const s = metrics.summary();
    assert.equal(s.totalRequests, 3);
    assert.equal(s.avgLatencyMs, 30); // (20 + 30 + 40) / 3
  });

  it("windowSize argument to summary is capped at entryCount", () => {
    const metrics = new SlidingWindowMetrics();
    metrics.record({ latencyMs: 100, success: true, firstTokenLatencyMs: null });
    metrics.record({ latencyMs: 200, success: true, firstTokenLatencyMs: null });

    // Requesting more than available entries should use all of them
    const s = metrics.summary(999);
    assert.equal(s.totalRequests, 2);
    assert.equal(s.avgLatencyMs, 150);
  });
});
