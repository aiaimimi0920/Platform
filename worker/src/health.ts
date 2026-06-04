import http from "node:http";

type WorkerHealthState = {
  startedAt: string;
  processingLeaseTimeoutMs: number;
  lastCycleAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastRecoveredProcessingAt: string | null;
  lastRecoveredPendingCount: number;
  lastRecoveredDeadLetterCount: number;
  totalRecoveredPendingCount: number;
  totalRecoveredDeadLetterCount: number;
};

export function createWorkerHealthState(processingLeaseTimeoutMs: number): WorkerHealthState {
  return {
    startedAt: new Date().toISOString(),
    processingLeaseTimeoutMs,
    lastCycleAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastRecoveredProcessingAt: null,
    lastRecoveredPendingCount: 0,
    lastRecoveredDeadLetterCount: 0,
    totalRecoveredPendingCount: 0,
    totalRecoveredDeadLetterCount: 0,
  };
}

export function markWorkerCycle(state: WorkerHealthState, status: "success" | "error", error?: string) {
  const timestamp = new Date().toISOString();
  state.lastCycleAt = timestamp;
  if (status === "success") {
    state.lastSuccessAt = timestamp;
    state.lastErrorMessage = null;
    return;
  }

  state.lastErrorAt = timestamp;
  state.lastErrorMessage = error ?? "unknown worker error";
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

    if (request.url === "/health" || request.url === "/ready") {
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

    response.writeHead(404).end();
  });

  server.listen(port, "0.0.0.0");
  return server;
}
