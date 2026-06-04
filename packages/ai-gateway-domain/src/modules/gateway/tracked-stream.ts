// ---------------------------------------------------------------------------
// TrackedStream — SSE chunk wrapper for TTFT measurement + AIMD permit lifecycle
//
// Wraps an AsyncIterable<string> (one item per SSE data: line) and:
//   • Records Time To First Token (TTFT) on the first yielded chunk
//   • Counts chunks and bytes as they flow through
//   • Releases an AIMD concurrency permit exactly once on completion or error
//   • Fires user-supplied callbacks so metrics can be recorded externally
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AimdPermitHandle = {
  /** Release the permit once, signalling the observed outcome. */
  release: (outcome: "success" | "failure" | "rate_limited") => void;
};

export type StreamCompletionMetrics = {
  /** Wall-clock milliseconds from construction to final chunk / error. */
  totalDurationMs: number;
  /** Milliseconds from construction to the first chunk, or null for empty streams. */
  firstTokenLatencyMs: number | null;
  /** Number of string chunks emitted by the source iterable. */
  chunkCount: number;
  /** Total UTF-8 byte length of all chunks. */
  totalBytes: number;
};

export type TrackedStreamCallbacks = {
  /**
   * Fired immediately when the first chunk is yielded.
   * @param ttftMs - milliseconds elapsed since the TrackedStream was constructed
   */
  onFirstToken?: (ttftMs: number) => void;
  /**
   * Fired after the source iterable completes normally.
   */
  onComplete?: (metrics: StreamCompletionMetrics) => void;
  /**
   * Fired if the source iterable throws.
   * `partialMetrics` contains whatever was collected before the error.
   */
  onError?: (error: unknown, partialMetrics: Partial<StreamCompletionMetrics>) => void;
};

// ---------------------------------------------------------------------------
// Rate-limit detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the error looks like an HTTP 429 / rate-limit response.
 *
 * Checks:
 *  - `.status`, `.statusCode`, `.httpStatus`, or `.http_status` equal to 429
 *  - `.message` or stringified value contains "rate limit" (case-insensitive)
 */
export function isRateLimitError(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    // HTTP status fields
    const statusCandidates: unknown[] = [
      obj["status"],
      obj["statusCode"],
      obj["httpStatus"],
      obj["http_status"],
    ];
    for (const candidate of statusCandidates) {
      if (candidate === 429) {
        return true;
      }
    }

    // Nested response object (e.g. axios)
    if (obj["response"] !== null && typeof obj["response"] === "object") {
      const response = obj["response"] as Record<string, unknown>;
      if (response["status"] === 429) {
        return true;
      }
    }

    // Message string inspection
    if (typeof obj["message"] === "string") {
      if (/rate.?limit/i.test(obj["message"])) {
        return true;
      }
    }
  }

  // Plain string
  if (typeof error === "string") {
    return /rate.?limit/i.test(error);
  }

  // Error instance message
  if (error instanceof Error) {
    return /rate.?limit/i.test(error.message);
  }

  return false;
}

// ---------------------------------------------------------------------------
// TrackedStream
// ---------------------------------------------------------------------------

export class TrackedStream implements AsyncIterable<string> {
  private readonly source: AsyncIterable<string>;
  private readonly permit: AimdPermitHandle | undefined;
  private readonly callbacks: TrackedStreamCallbacks;

  /** Unix epoch ms captured at construction time. */
  private readonly startedAt: number;

  /** Guards against releasing the permit more than once. */
  private released: boolean;

  constructor(
    source: AsyncIterable<string>,
    options?: {
      permit?: AimdPermitHandle;
      callbacks?: TrackedStreamCallbacks;
    },
  ) {
    this.source = source;
    this.permit = options?.permit;
    this.callbacks = options?.callbacks ?? {};
    this.startedAt = Date.now();
    this.released = false;
  }

  // -------------------------------------------------------------------------
  // AsyncIterable implementation
  // -------------------------------------------------------------------------

  [Symbol.asyncIterator](): AsyncIterator<string> {
    return this.iterate();
  }

  // -------------------------------------------------------------------------
  // Internal generator
  // -------------------------------------------------------------------------

  private async *iterate(): AsyncGenerator<string> {
    let firstTokenSeen = false;
    let firstTokenLatencyMs: number | null = null;
    let chunkCount = 0;
    let totalBytes = 0;

    const buildPartialMetrics = (): Partial<StreamCompletionMetrics> => ({
      totalDurationMs: Date.now() - this.startedAt,
      firstTokenLatencyMs,
      chunkCount,
      totalBytes,
    });

    try {
      for await (const chunk of this.source) {
        // First-token measurement
        if (!firstTokenSeen) {
          firstTokenSeen = true;
          firstTokenLatencyMs = Date.now() - this.startedAt;
          try {
            this.callbacks.onFirstToken?.(firstTokenLatencyMs);
          } catch {
            // Swallow callback errors — they must not interrupt the stream
          }
        }

        chunkCount += 1;
        // Use byte length rather than character length for accuracy
        totalBytes += Buffer.byteLength(chunk, "utf8");

        yield chunk;
      }

      // Normal completion
      const metrics: StreamCompletionMetrics = {
        totalDurationMs: Date.now() - this.startedAt,
        firstTokenLatencyMs,
        chunkCount,
        totalBytes,
      };

      try {
        this.callbacks.onComplete?.(metrics);
      } catch {
        // Swallow callback errors
      }

      this.releasePermit("success");
    } catch (error: unknown) {
      const partialMetrics = buildPartialMetrics();

      try {
        this.callbacks.onError?.(error, partialMetrics);
      } catch {
        // Swallow callback errors
      }

      const outcome = isRateLimitError(error) ? "rate_limited" : "failure";
      this.releasePermit(outcome);

      // Re-throw so the consumer's for-await catches it
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Permit release (exactly-once guard)
  // -------------------------------------------------------------------------

  private releasePermit(outcome: "success" | "failure" | "rate_limited"): void {
    if (this.released) {
      return;
    }
    this.released = true;
    try {
      this.permit?.release(outcome);
    } catch {
      // Permit release errors must not propagate
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Convenience factory — equivalent to `new TrackedStream(source, options)`.
 */
export function createTrackedStream(
  source: AsyncIterable<string>,
  options?: {
    permit?: AimdPermitHandle;
    callbacks?: TrackedStreamCallbacks;
  },
): TrackedStream {
  return new TrackedStream(source, options);
}

// ---------------------------------------------------------------------------
// Metrics recording helper
// ---------------------------------------------------------------------------

/**
 * Builds a `TrackedStreamCallbacks` object that records stream results into
 * any object that exposes a `record` method compatible with SlidingWindowMetrics.
 *
 * Usage:
 * ```ts
 * const callbacks = buildMetricsRecordingCallbacks(slidingWindowMetrics);
 * const stream = createTrackedStream(source, { callbacks });
 * ```
 */
export function buildMetricsRecordingCallbacks(metrics: {
  record: (entry: {
    latencyMs: number;
    success: boolean;
    firstTokenLatencyMs: number | null;
  }) => void;
}): TrackedStreamCallbacks {
  return {
    onComplete(completionMetrics) {
      metrics.record({
        latencyMs: completionMetrics.totalDurationMs,
        success: true,
        firstTokenLatencyMs: completionMetrics.firstTokenLatencyMs,
      });
    },
    onError(_error, partialMetrics) {
      metrics.record({
        latencyMs: partialMetrics.totalDurationMs ?? 0,
        success: false,
        firstTokenLatencyMs: partialMetrics.firstTokenLatencyMs ?? null,
      });
    },
  };
}
