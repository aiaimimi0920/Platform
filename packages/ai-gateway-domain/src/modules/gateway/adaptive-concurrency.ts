// ---------------------------------------------------------------------------
// AIMD Adaptive Concurrency Controller
//
// Inspired by TCP congestion control (Additive Increase / Multiplicative
// Decrease). The controller maintains a dynamic limit on the number of
// concurrently held permits.  On success streaks the limit grows linearly;
// on failures or upstream rate-limit responses it shrinks multiplicatively.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AimdConcurrencyConfig = {
  /** Starting concurrency limit. Default: 10 */
  initialLimit: number;
  /** Floor – limit never drops below this value. Default: 1 */
  minLimit: number;
  /** Ceiling – limit never rises above this value. Default: 100 */
  maxLimit: number;
  /** Number of consecutive successes required before +1 additive increase. Default: 5 */
  increaseThreshold: number;
  /** Multiplicative factor applied on a general failure. Default: 0.7 */
  decreaseFactor: number;
  /** Multiplicative factor applied on a 429 / rate-limit response. Default: 0.5 */
  severeDecreaseFactor: number;
  /** Not used internally for auto-recovery in this implementation (reserved for
   *  callers that want to schedule periodic resets). Stored on config for
   *  observability / future use. Default: 30000 ms */
  recoveryIntervalMs: number;
};

export type ConcurrencySnapshot = {
  currentLimit: number;
  activeCount: number;
  availablePermits: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastAdjustedAt: string; // ISO-8601 timestamp
};

export type ConcurrencyPermit = {
  /** Call once when the operation completes to release the permit. */
  release: (outcome: "success" | "failure" | "rate_limited") => void;
  /** Unix epoch milliseconds when the permit was granted. */
  startedAt: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AimdConcurrencyConfig = {
  initialLimit: 10,
  minLimit: 1,
  maxLimit: 100,
  increaseThreshold: 5,
  decreaseFactor: 0.7,
  severeDecreaseFactor: 0.5,
  recoveryIntervalMs: 30_000,
};

// ---------------------------------------------------------------------------
// Internal waiter bookkeeping
// ---------------------------------------------------------------------------

type Waiter = {
  resolve: () => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

// ---------------------------------------------------------------------------
// AimdConcurrencyController
// ---------------------------------------------------------------------------

export class AimdConcurrencyController {
  private readonly config: AimdConcurrencyConfig;

  // State
  private currentLimit: number;
  private activeCount: number;
  private consecutiveSuccesses: number;
  private consecutiveFailures: number;
  private lastAdjustedAt: Date;

  // Promise-based wait queue
  private readonly waiters: Waiter[];

  constructor(config?: Partial<AimdConcurrencyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentLimit = this.config.initialLimit;
    this.activeCount = 0;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.lastAdjustedAt = new Date();
    this.waiters = [];
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Acquire a concurrency permit.
   *
   * If a slot is available immediately the returned promise resolves at once.
   * Otherwise the caller waits in a FIFO queue.  If `timeoutMs` elapses before
   * a slot becomes available the promise rejects with a `TimeoutError`.
   */
  async acquire(timeoutMs?: number): Promise<ConcurrencyPermit> {
    if (this.activeCount < this.currentLimit) {
      // Fast path – slot available right now
      this.activeCount += 1;
      return this.buildPermit();
    }

    // Slow path – enqueue and wait
    return new Promise<ConcurrencyPermit>((resolve, reject) => {
      const waiter: Waiter = { resolve: () => undefined, reject, timer: null };

      // We need to resolve with a permit rather than void, so we wrap resolve.
      waiter.resolve = () => {
        if (waiter.timer !== null) {
          clearTimeout(waiter.timer);
          waiter.timer = null;
        }
        this.activeCount += 1;
        resolve(this.buildPermit());
      };

      if (typeof timeoutMs === "number" && timeoutMs >= 0) {
        waiter.timer = setTimeout(() => {
          // Remove from queue and reject
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
          }
          reject(
            new Error(
              `AimdConcurrencyController: acquire timed out after ${timeoutMs} ms`,
            ),
          );
        }, timeoutMs);
      }

      this.waiters.push(waiter);
    });
  }

  /**
   * Return a point-in-time snapshot of the controller state.
   */
  snapshot(): ConcurrencySnapshot {
    return {
      currentLimit: this.currentLimit,
      activeCount: this.activeCount,
      availablePermits: Math.max(0, this.currentLimit - this.activeCount),
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      lastAdjustedAt: this.lastAdjustedAt.toISOString(),
    };
  }

  /**
   * Reset the controller to its initial state.
   *
   * All pending waiters are rejected so that callers do not leak handles.
   */
  reset(): void {
    // Drain the queue – reject all pending waiters
    for (const waiter of this.waiters.splice(0)) {
      if (waiter.timer !== null) {
        clearTimeout(waiter.timer);
      }
      waiter.reject(new Error("AimdConcurrencyController: reset() called"));
    }

    this.currentLimit = this.config.initialLimit;
    this.activeCount = 0;
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.lastAdjustedAt = new Date();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildPermit(): ConcurrencyPermit {
    const startedAt = Date.now();
    let released = false;

    const release = (outcome: "success" | "failure" | "rate_limited"): void => {
      if (released) {
        return; // Guard against double-release
      }
      released = true;
      this.handleOutcome(outcome);
    };

    return { release, startedAt };
  }

  private handleOutcome(outcome: "success" | "failure" | "rate_limited"): void {
    // Decrement first – free the slot before adjusting limit so that the slot
    // can potentially be handed to a waiter at the adjusted limit.
    this.activeCount = Math.max(0, this.activeCount - 1);

    switch (outcome) {
      case "success": {
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses += 1;

        if (this.consecutiveSuccesses >= this.config.increaseThreshold) {
          this.consecutiveSuccesses = 0; // reset streak counter after each increase
          this.currentLimit = Math.min(
            this.config.maxLimit,
            this.currentLimit + 1,
          );
          this.lastAdjustedAt = new Date();
        }
        break;
      }

      case "failure": {
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures += 1;
        const newLimit = Math.floor(
          this.currentLimit * this.config.decreaseFactor,
        );
        this.currentLimit = Math.max(this.config.minLimit, newLimit);
        this.lastAdjustedAt = new Date();
        break;
      }

      case "rate_limited": {
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures += 1;
        const newLimit = Math.floor(
          this.currentLimit * this.config.severeDecreaseFactor,
        );
        this.currentLimit = Math.max(this.config.minLimit, newLimit);
        this.lastAdjustedAt = new Date();
        break;
      }
    }

    // After a decrease the new limit may be lower than activeCount.  We must
    // not over-grant, so only dispatch a waiter if there is genuine headroom.
    this.dispatchNextWaiter();
  }

  /** Give the next queued waiter a slot if one is available. */
  private dispatchNextWaiter(): void {
    while (this.waiters.length > 0 && this.activeCount < this.currentLimit) {
      const waiter = this.waiters.shift()!;
      waiter.resolve();
    }
  }
}
