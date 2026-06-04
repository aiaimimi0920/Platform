import http from "node:http";

export type LoopHealthSnapshot = {
  label: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export type ExecutorHealthState = {
  startedAt: string;
  loops: Record<string, LoopHealthSnapshot>;
};

export function createExecutorHealthState(loopKeys: string[]): ExecutorHealthState {
  const loops = Object.fromEntries(
    loopKeys.map((key) => [
      key,
      {
        label: key,
        lastRunAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      } satisfies LoopHealthSnapshot,
    ]),
  ) as Record<string, LoopHealthSnapshot>;

  return {
    startedAt: new Date().toISOString(),
    loops,
  };
}

export function markExecutorLoop(
  state: ExecutorHealthState,
  loopKey: string,
  status: "success" | "error",
  error?: string,
) {
  const snapshot = state.loops[loopKey];
  if (!snapshot) return;

  const timestamp = new Date().toISOString();
  snapshot.lastRunAt = timestamp;
  if (status === "success") {
    snapshot.lastSuccessAt = timestamp;
    snapshot.lastErrorMessage = null;
    return;
  }

  snapshot.lastErrorAt = timestamp;
  snapshot.lastErrorMessage = error ?? "unknown executor error";
}

export function startExecutorHealthServer(port: number, state: ExecutorHealthState) {
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
          service: "executor",
          role: "platform-runtime",
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
