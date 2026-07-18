import { env } from "@/env";
import {
  createExecutorHealthState,
  markExecutorLoop,
  startExecutorHealthServer,
} from "@/health";
import { runExecutorTask } from "@/tasks";

const loopDefinitions = [
  { key: "platform-executor", intervalMs: env.platformExecutorIntervalMs, taskKey: "platform-executor" },
  { key: "recover-stale", intervalMs: env.recoveryIntervalMs, taskKey: "recover-stale" },
  { key: "runtime-sweep", intervalMs: env.runtimeSweepIntervalMs, taskKey: "runtime-sweep" },
  { key: "settlements-run", intervalMs: env.settlementLoopIntervalMs, taskKey: "settlements-run" },
  {
    key: "callback-auto-remediate",
    intervalMs: env.callbackAutoRemediationIntervalMs,
    taskKey: "callback-auto-remediate",
  },
  {
    key: "callback-remediation-alerts",
    intervalMs: env.callbackRemediationAlertsIntervalMs,
    taskKey: "callback-remediation-alerts",
  },
  {
    key: "runtime-pressure-alerts",
    intervalMs: env.runtimePressureAlertsIntervalMs,
    taskKey: "runtime-pressure-alerts",
  },
  {
    key: "outbox-alerts",
    intervalMs: env.outboxAlertsIntervalMs,
    taskKey: "outbox-alerts",
  },
  {
    key: "callback-compatibility-cleanup",
    intervalMs: env.callbackCompatibilityCleanupIntervalMs,
    taskKey: "callback-compatibility-cleanup",
  },
  {
    key: "manual-review-release-stale",
    intervalMs: env.manualReviewReleaseStaleIntervalMs,
    taskKey: "manual-review-release-stale",
  },
  {
    key: "manual-review-rebalance-auto",
    intervalMs: env.manualReviewRebalanceIntervalMs,
    taskKey: "manual-review-rebalance-auto",
  },
  {
    key: "manual-review-auto-assign-sla",
    intervalMs: env.manualReviewAutoAssignIntervalMs,
    taskKey: "manual-review-auto-assign-sla",
  },
  {
    key: "manual-review-sync-sla-anomalies",
    intervalMs: env.manualReviewSyncSlaIntervalMs,
    taskKey: "manual-review-sync-sla-anomalies",
  },
  {
    key: "fulfillment-anomalies-escalate",
    intervalMs: env.fulfillmentAnomalyEscalationIntervalMs,
    taskKey: "fulfillment-anomalies-escalate",
  },
  {
    key: "arbitration-expire-prepared",
    intervalMs: env.arbitrationExpirePreparedIntervalMs,
    taskKey: "arbitration-expire-prepared",
  },
    {
      key: "arbitration-release-stale",
      intervalMs: env.arbitrationReleaseStaleIntervalMs,
      taskKey: "arbitration-release-stale",
    },
  {
    key: "arbitration-auto-advance-stale-rounds",
    intervalMs: env.arbitrationAutoAdvanceStaleRoundsIntervalMs,
    taskKey: "arbitration-auto-advance-stale-rounds",
  },
  {
    key: "arbitration-escalate-final-rounds",
    intervalMs: env.arbitrationEscalateFinalRoundsIntervalMs,
    taskKey: "arbitration-escalate-final-rounds",
  },
    {
      key: "arbitration-rebalance-rounds",
      intervalMs: env.arbitrationRebalanceRoundsIntervalMs,
    taskKey: "arbitration-rebalance-rounds",
  },
  {
    key: "arbitration-cleanup-remote",
    intervalMs: env.arbitrationCleanupRemoteIntervalMs,
    taskKey: "arbitration-cleanup-remote",
  },
] as const;

async function runLoop(
  loopKey: (typeof loopDefinitions)[number]["key"],
  intervalMs: number,
  taskKey: (typeof loopDefinitions)[number]["taskKey"],
  healthState: ReturnType<typeof createExecutorHealthState>,
) {
  while (true) {
    try {
      await runExecutorTask(taskKey);
      markExecutorLoop(healthState, loopKey, "success");
    } catch (error) {
      const message = extractErrorMessage(error) ?? `executor loop failed: ${loopKey}`;
      console.error(`Executor loop ${loopKey} failed`, error);
      markExecutorLoop(healthState, loopKey, "error", message);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  const healthState = createExecutorHealthState(
    loopDefinitions.map(({ key, intervalMs }) => ({ key, intervalMs })),
  );
  startExecutorHealthServer(env.healthPort, healthState);
  console.log("Executor started.");

  await Promise.all(loopDefinitions.map((item) => runLoop(item.key, item.intervalMs, item.taskKey, healthState)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function extractErrorMessage(reason: unknown): string | undefined {
  if (!reason) return undefined;
  if (typeof reason === "string") return reason;
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return undefined;
  }
}
