import http from "node:http";

type WorkerHealthState = {
  startedAt: string;
  processingLeaseTimeoutMs: number;
  readinessFreshnessMs: number;
  lastCycleAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  dependencyFailures: Record<string, { lastErrorAt: string; message: string }>;
  lastRecoveredProcessingAt: string | null;
  lastRecoveredPendingCount: number;
  lastRecoveredDeadLetterCount: number;
  totalRecoveredPendingCount: number;
  totalRecoveredDeadLetterCount: number;
};

export type WorkerReadiness = {
  ready: boolean;
  reason: "ready" | "never_succeeded" | "last_cycle_failed" | "dependency_failed" | "stale_success";
  freshnessThresholdMs: number;
  lastSuccessAgeMs: number | null;
  failingDependencies: string[];
};

const DEFAULT_POLL_INTERVAL_MS = 4_000;
const MIN_READINESS_FRESHNESS_MS = 10_000;
const READINESS_INTERVAL_MULTIPLIER = 3;

function resolveReadinessFreshnessMs(pollIntervalMs: number): number {
  return Math.max(MIN_READINESS_FRESHNESS_MS, pollIntervalMs * READINESS_INTERVAL_MULTIPLIER);
}

function toTimestamp(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

function lastSuccessAgeMs(state: WorkerHealthState, nowMs: number): number | null {
  if (!state.lastSuccessAt) return null;
  const lastSuccessMs = Date.parse(state.lastSuccessAt);
  if (!Number.isFinite(lastSuccessMs)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - lastSuccessMs);
}

export function createWorkerHealthState(
  processingLeaseTimeoutMs: number,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  nowMs = Date.now(),
): WorkerHealthState {
  return {
    startedAt: toTimestamp(nowMs),
    processingLeaseTimeoutMs,
    readinessFreshnessMs: resolveReadinessFreshnessMs(pollIntervalMs),
    lastCycleAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    dependencyFailures: {},
    lastRecoveredProcessingAt: null,
    lastRecoveredPendingCount: 0,
    lastRecoveredDeadLetterCount: 0,
    totalRecoveredPendingCount: 0,
    totalRecoveredDeadLetterCount: 0,
  };
}

export function markWorkerDependency(
  state: WorkerHealthState,
  dependency: string,
  status: "success" | "error",
  error?: string,
  nowMs = Date.now(),
) {
  if (status === "success") {
    delete state.dependencyFailures[dependency];
    return;
  }

  state.dependencyFailures[dependency] = {
    lastErrorAt: toTimestamp(nowMs),
    message: error ?? "unknown worker dependency error",
  };
}

export function markWorkerCycle(
  state: WorkerHealthState,
  status: "success" | "error",
  error?: string,
  nowMs = Date.now(),
) {
  const timestamp = toTimestamp(nowMs);
  state.lastCycleAt = timestamp;
  if (status === "success") {
    state.lastSuccessAt = timestamp;
    state.lastErrorMessage = null;
    return;
  }

  state.lastErrorAt = timestamp;
  state.lastErrorMessage = error ?? "unknown worker error";
}

export function evaluateWorkerReadiness(state: WorkerHealthState, nowMs = Date.now()): WorkerReadiness {
  const successAgeMs = lastSuccessAgeMs(state, nowMs);
  const failingDependencies = Object.keys(state.dependencyFailures).sort();
  if (state.lastErrorMessage !== null) {
    return {
      ready: false,
      reason: "last_cycle_failed",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: successAgeMs,
      failingDependencies,
    };
  }
  if (failingDependencies.length > 0) {
    return {
      ready: false,
      reason: "dependency_failed",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: successAgeMs,
      failingDependencies,
    };
  }
  if (successAgeMs === null) {
    return {
      ready: false,
      reason: "never_succeeded",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: null,
      failingDependencies,
    };
  }
  if (successAgeMs > state.readinessFreshnessMs) {
    return {
      ready: false,
      reason: "stale_success",
      freshnessThresholdMs: state.readinessFreshnessMs,
      lastSuccessAgeMs: successAgeMs,
      failingDependencies,
    };
  }
  return {
    ready: true,
    reason: "ready",
    freshnessThresholdMs: state.readinessFreshnessMs,
    lastSuccessAgeMs: successAgeMs,
    failingDependencies,
  };
}

export function markRecoveredProcessingEvents(
  state: WorkerHealthState,
  result: { requeuedCount: number; deadLetterCount: number },
) {
  state.lastRecoveredPendingCount = result.requeuedCount;
  state.lastRecoveredDeadLetterCount = result.deadLetterCount;
  if (result.requeuedCount <= 0 && result.deadLetterCount <= 0) {
    return;
  }

  state.lastRecoveredProcessingAt = new Date().toISOString();
  state.totalRecoveredPendingCount += result.requeuedCount;
  state.totalRecoveredDeadLetterCount += result.deadLetterCount;
}

export function startWorkerHealthServer(port: number, state: WorkerHealthState) {
  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(404).end();
      return;
    }

    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "worker",
          role: "outbox-consumer",
          state,
        }),
      );
      return;
    }

    if (request.url === "/ready") {
      const readiness = evaluateWorkerReadiness(state);
      response.writeHead(readiness.ready ? 200 : 503, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: readiness.ready,
          ready: readiness.ready,
          service: "worker",
          role: "outbox-consumer",
          readiness,
          state,
        }),
      );
      return;
    }

    response.writeHead(404).end();
  });

  server.listen(port, "0.0.0.0");
  return server;
}
