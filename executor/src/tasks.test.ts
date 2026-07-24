import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

type ExecutorTaskKey = import("./tasks").ExecutorTaskKey;

const envOverrides = {
  INTERNAL_API_TOKEN: "executor-internal-token",
  EXECUTOR_PLATFORM_LIMIT: "11",
  EXECUTOR_RECOVERY_LIMIT: "12",
  EXECUTOR_RECOVERY_STALE_SECONDS: "601",
  EXECUTOR_RUNTIME_SWEEP_LIMIT: "13",
  EXECUTOR_RUNTIME_SWEEP_STALE_SECONDS: "602",
  EXECUTOR_SETTLEMENT_LIMIT: "14",
  EXECUTOR_OPINION_MONTHLY_LEADERS_LIMIT: "15",
  EXECUTOR_CALLBACK_AUTO_REMEDIATION_LIMIT: "16",
  EXECUTOR_CALLBACK_REMEDIATION_ALERTS_LIMIT: "17",
  EXECUTOR_CALLBACK_REMEDIATION_ALERTS_MIN_LEVEL: "7",
  EXECUTOR_RUNTIME_PRESSURE_ALERTS_LIMIT: "18",
  EXECUTOR_RUNTIME_PRESSURE_ALERTS_MIN_LEVEL: "8",
  EXECUTOR_OUTBOX_ALERTS_LIMIT: "19",
  EXECUTOR_OUTBOX_ALERTS_MIN_LEVEL: "9",
  EXECUTOR_CALLBACK_COMPATIBILITY_CLEANUP_LIMIT: "20",
  EXECUTOR_ARBITRATION_EXPIRE_PREPARED_LIMIT: "21",
  EXECUTOR_ARBITRATION_RELEASE_STALE_LIMIT: "22",
  EXECUTOR_ARBITRATION_AUTO_ADVANCE_STALE_ROUNDS_LIMIT: "23",
  EXECUTOR_ARBITRATION_ESCALATE_FINAL_ROUNDS_LIMIT: "24",
  EXECUTOR_ARBITRATION_REBALANCE_ROUNDS_LIMIT: "25",
  EXECUTOR_ARBITRATION_CLEANUP_REMOTE_LIMIT: "26",
};

const expectedTaskOrder = [
  "platform-executor",
  "recover-stale",
  "runtime-sweep",
  "arbitration-expire-prepared",
  "arbitration-release-stale",
  "arbitration-auto-advance-stale-rounds",
  "arbitration-escalate-final-rounds",
  "arbitration-rebalance-rounds",
  "arbitration-cleanup-remote",
  "settlements-run",
  "opinion-monthly-leaders",
  "callback-auto-remediate",
  "callback-remediation-alerts",
  "runtime-pressure-alerts",
  "outbox-alerts",
  "callback-compatibility-cleanup",
  "reconcile-due",
  "manual-review-release-stale",
  "manual-review-rebalance-auto",
  "manual-review-auto-assign-sla",
  "manual-review-sync-sla-anomalies",
  "fulfillment-anomalies-escalate",
] as const satisfies readonly ExecutorTaskKey[];

const expectedRequests: Record<ExecutorTaskKey, { path: string; body: Record<string, unknown> }> = {
  "platform-executor": {
    path: "/v1/internal/agent-executions/run-platform-executor",
    body: { limit: 11 },
  },
  "recover-stale": {
    path: "/v1/internal/agent-executions/recover-stale",
    body: { limit: 12, staleSeconds: 601 },
  },
  "runtime-sweep": {
    path: "/v1/internal/agent-executions/runtime-sessions/sweep",
    body: { limit: 13, staleSeconds: 602 },
  },
  "arbitration-expire-prepared": {
    path: "/v1/internal/arbitrations/attachments/expire-prepared",
    body: { limit: 21 },
  },
  "arbitration-release-stale": {
    path: "/v1/internal/arbitrations/cases/release-stale",
    body: { limit: 22 },
  },
  "arbitration-auto-advance-stale-rounds": {
    path: "/v1/internal/arbitrations/cases/advance-stale-rounds",
    body: { limit: 23 },
  },
  "arbitration-escalate-final-rounds": {
    path: "/v1/internal/arbitrations/cases/escalate-final-rounds",
    body: { limit: 24 },
  },
  "arbitration-rebalance-rounds": {
    path: "/v1/internal/arbitrations/cases/rebalance-rounds",
    body: { limit: 25 },
  },
  "arbitration-cleanup-remote": {
    path: "/v1/internal/arbitrations/attachments/cleanup-remote",
    body: { limit: 26 },
  },
  "settlements-run": {
    path: "/v1/internal/agent-executions/settlements/run",
    body: { limit: 14 },
  },
  "opinion-monthly-leaders": {
    path: "/v1/internal/opinions/monthly-leaders/run",
    body: { limit: 15 },
  },
  "callback-auto-remediate": {
    path: "/v1/internal/agent-executions/callback-audits/auto-remediate",
    body: { limit: 16 },
  },
  "callback-remediation-alerts": {
    path: "/v1/internal/agent-executions/callback-audits/emit-alerts",
    body: { limit: 17, minimumAlertLevel: 7 },
  },
  "runtime-pressure-alerts": {
    path: "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    body: { limit: 18, minimumAlertLevel: 8 },
  },
  "outbox-alerts": {
    path: "/v1/internal/outbox-events/emit-alerts",
    body: { limit: 19, minimumAlertLevel: 9 },
  },
  "callback-compatibility-cleanup": {
    path: "/v1/internal/agents/callback-compatibility/cleanup-expired",
    body: { limit: 20 },
  },
  "reconcile-due": {
    path: "/v1/internal/items/reconcile-due",
    body: { limit: 20 },
  },
  "manual-review-release-stale": {
    path: "/v1/internal/items/manual-reviews/release-stale",
    body: { limit: 20 },
  },
  "manual-review-rebalance-auto": {
    path: "/v1/internal/items/manual-reviews/rebalance-auto",
    body: {},
  },
  "manual-review-auto-assign-sla": {
    path: "/v1/internal/items/manual-reviews/auto-assign-sla",
    body: {},
  },
  "manual-review-sync-sla-anomalies": {
    path: "/v1/internal/items/manual-reviews/sync-sla-anomalies",
    body: { limit: 200 },
  },
  "fulfillment-anomalies-escalate": {
    path: "/v1/internal/items/anomalies/escalate",
    body: { limit: 200 },
  },
};

const previousEnvEntries = Object.keys(envOverrides).map((key) => [key, process.env[key]] as const);
const requestLog: Array<{
  method?: string;
  url?: string;
  tokenHeader: string | undefined;
  body: unknown;
}> = [];

let listExecutorTasks: () => ExecutorTaskKey[];
let runExecutorTask: (taskKey: ExecutorTaskKey) => Promise<void>;
let server: http.Server;

before(async () => {
  server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    requestLog.push({
      method: request.method,
      url: request.url,
      tokenHeader: typeof request.headers["x-internal-api-token"] === "string"
        ? request.headers["x-internal-api-token"]
        : undefined,
      body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    });

    response.writeHead(204).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  process.env.CORE_INTERNAL_URL = `http://127.0.0.1:${port}///`;
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }

  const mod = await import("./tasks");
  listExecutorTasks = mod.listExecutorTasks;
  runExecutorTask = mod.runExecutorTask;
});

after(() => {
  server.close();
  for (const [key, value] of previousEnvEntries) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
  delete process.env.CORE_INTERNAL_URL;
});

beforeEach(() => {
  requestLog.length = 0;
});

describe("executor tasks", () => {
  it("exposes the supported executor task-key surface in stable order", () => {
    assert.deepEqual(listExecutorTasks(), [...expectedTaskOrder]);
  });

  it("maps every executor task key to the expected Core endpoint and request body", async () => {
    for (const taskKey of expectedTaskOrder) {
      await runExecutorTask(taskKey);
    }

    assert.deepEqual(
      requestLog,
      expectedTaskOrder.map((taskKey) => ({
        method: "POST",
        url: expectedRequests[taskKey].path,
        tokenHeader: envOverrides.INTERNAL_API_TOKEN,
        body: expectedRequests[taskKey].body,
      })),
    );
  });

  it("rejects unsupported executor task keys at runtime", async () => {
    await assert.rejects(
      runExecutorTask("discount-code-history-archive" as unknown as ExecutorTaskKey),
      /Unsupported executor task: discount-code-history-archive/,
    );
    assert.equal(requestLog.length, 0);
  });
});
