// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricEntry = {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  firstTokenLatencyMs: number | null;
};

export type MetricsSummary = {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgFirstTokenLatencyMs: number | null;
  windowDurationMs: number;
};

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// ---------------------------------------------------------------------------
// SlidingWindowMetrics
// ---------------------------------------------------------------------------

const DEFAULT_MAX_WINDOW_SIZE = 200;

export class SlidingWindowMetrics {
  private readonly maxWindowSize: number;
  private readonly entries: MetricEntry[];

  constructor(maxWindowSize?: number) {
    this.maxWindowSize = maxWindowSize ?? DEFAULT_MAX_WINDOW_SIZE;
    this.entries = [];
  }

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------

  record(entry: Omit<MetricEntry, "timestamp">): void {
    const full: MetricEntry = {
      timestamp: Date.now(),
      latencyMs: entry.latencyMs,
      success: entry.success,
      firstTokenLatencyMs: entry.firstTokenLatencyMs,
    };

    this.entries.push(full);

    // Drop oldest entries when at capacity.
    while (this.entries.length > this.maxWindowSize) {
      this.entries.shift();
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  summary(windowSize?: number): MetricsSummary {
    const window = this.resolveWindow(windowSize);

    if (window.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        avgFirstTokenLatencyMs: null,
        windowDurationMs: 0,
      };
    }

    const latencies = window.map((e) => e.latencyMs);
    const successCount = window.filter((e) => e.success).length;

    const ttftValues = window
      .map((e) => e.firstTokenLatencyMs)
      .filter((v): v is number => v !== null);

    const avgFirstTokenLatencyMs =
      ttftValues.length > 0
        ? ttftValues.reduce((sum, v) => sum + v, 0) / ttftValues.length
        : null;

    const timestamps = window.map((e) => e.timestamp);
    const windowDurationMs =
      timestamps.length >= 2
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0;

    return {
      totalRequests: window.length,
      successRate: successCount / window.length,
      avgLatencyMs: latencies.reduce((sum, v) => sum + v, 0) / latencies.length,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      avgFirstTokenLatencyMs,
      windowDurationMs,
    };
  }

  // -------------------------------------------------------------------------
  // Convenience queries
  // -------------------------------------------------------------------------

  recentSuccessRate(n?: number): number {
    const window = this.resolveWindow(n);
    if (window.length === 0) {
      return 0;
    }
    return window.filter((e) => e.success).length / window.length;
  }

  recentAvgLatency(n?: number): number {
    const window = this.resolveWindow(n);
    if (window.length === 0) {
      return 0;
    }
    return window.reduce((sum, e) => sum + e.latencyMs, 0) / window.length;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  clear(): void {
    this.entries.length = 0;
  }

  entryCount(): number {
    return this.entries.length;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private resolveWindow(n: number | undefined): MetricEntry[] {
    if (n === undefined || n >= this.entries.length) {
      return this.entries;
    }
    return this.entries.slice(-n);
  }
}
