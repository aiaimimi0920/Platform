import http from "node:http";

export type LoopHealthSnapshot = {
  label: string;
  intervalMs: number;
  readinessFreshnessMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export type ExecutorHealthState = {
  startedAt: string;
  loops: Record<string, LoopHealthSnapshot>;
};

export type ExecutorLoopDefinition = {
  key: string;
  intervalMs: number;
};

export type ExecutorReadinessFailure = {
  key: string;
  reason: "never_succeeded" | "last_run_failed" | "stale_success";
};

export type ExecutorReadiness = {
  ready: boolean;
  failingLoops: ExecutorReadinessFailure[];
};

const MIN_READINESS_FRESHNESS_MS = 10_000;
const READINESS_INTERVAL_MULTIPLIER = 3;

function resolveReadinessFreshnessMs(intervalMs: number): number {
  return Math.max(MIN_READINESS_FRESHNESS_MS, intervalMs * READINESS_INTERVAL_MULTIPLIER);
}

function toTimestamp(nowMs: number): string {
  return new Date(nowMs).toISOString();
}

export function createExecutorHealthState(
  loopDefinitions: readonly ExecutorLoopDefinition[],
  nowMs = Date.now(),
): ExecutorHealthState {
  const loops = Object.fromEntries(
    loopDefinitions.map(({ key, intervalMs }) => [
      key,
      {
        label: key,
        intervalMs,
        readinessFreshnessMs: resolveReadinessFreshnessMs(intervalMs),
        lastRunAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      } satisfies LoopHealthSnapshot,
    ]),
  ) as Record<string, LoopHealthSnapshot>;

  return {
    startedAt: toTimestamp(nowMs),
    loops,
  };
}

export function markExecutorLoop(
  state: ExecutorHealthState,
  loopKey: string,
  status: "success" | "error",
  error?: string,
  nowMs = Date.now(),
) {
  const snapshot = state.loops[loopKey];
  if (!snapshot) return;

  const timestamp = toTimestamp(nowMs);
  snapshot.lastRunAt = timestamp;
  if (status === "success") {
    snapshot.lastSuccessAt = timestamp;
    snapshot.lastErrorMessage = null;
    return;
  }

  snapshot.lastErrorAt = timestamp;
  snapshot.lastErrorMessage = error ?? "unknown executor error";
}

export function evaluateExecutorReadiness(
  state: ExecutorHealthState,
  nowMs = Date.now(),
): ExecutorReadiness {
  const failingLoops: ExecutorReadinessFailure[] = [];

  for (const [key, snapshot] of Object.entries(state.loops)) {
    if (snapshot.lastErrorMessage !== null) {
      failingLoops.push({ key, reason: "last_run_failed" });
      continue;
    }
    if (!snapshot.lastSuccessAt) {
      failingLoops.push({ key, reason: "never_succeeded" });
      continue;
    }
    const lastSuccessMs = Date.parse(snapshot.lastSuccessAt);
    const successAgeMs = Number.isFinite(lastSuccessMs)
      ? Math.max(0, nowMs - lastSuccessMs)
      : Number.POSITIVE_INFINITY;
    if (successAgeMs > snapshot.readinessFreshnessMs) {
      failingLoops.push({ key, reason: "stale_success" });
    }
  }

  return {
    ready: failingLoops.length === 0,
    failingLoops,
  };
}

export function startExecutorHealthServer(port: number, state: ExecutorHealthState) {
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
          service: "executor",
          role: "platform-runtime",
          state,
        }),
      );
      return;
    }

    if (request.url === "/ready") {
      const readiness = evaluateExecutorReadiness(state);
      response.writeHead(readiness.ready ? 200 : 503, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: readiness.ready,
          ready: readiness.ready,
          service: "executor",
          role: "platform-runtime",
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
