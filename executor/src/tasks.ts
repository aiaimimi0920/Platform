import { env } from "@/env";
import { postInternalJson } from "@/http";

export type ExecutorTaskKey =
  | "platform-executor"
  | "recover-stale"
  | "runtime-sweep"
  | "arbitration-expire-prepared"
  | "arbitration-release-stale"
  | "arbitration-auto-advance-stale-rounds"
  | "arbitration-escalate-final-rounds"
  | "arbitration-rebalance-rounds"
  | "arbitration-cleanup-remote"
  | "settlements-run"
  | "opinion-monthly-leaders"
  | "callback-auto-remediate"
  | "callback-remediation-alerts"
  | "runtime-pressure-alerts"
  | "outbox-alerts"
  | "callback-compatibility-cleanup"
  | "reconcile-due"
  | "manual-review-release-stale"
  | "manual-review-rebalance-auto"
  | "manual-review-auto-assign-sla"
  | "manual-review-sync-sla-anomalies"
  | "fulfillment-anomalies-escalate"
  | "discount-code-history-archive"
  | "discount-code-history-archive-cleanup"
  ;

type ExecutorTaskDefinition = {
  path: string;
  body: () => Record<string, unknown>;
};

const taskDefinitions: Record<ExecutorTaskKey, ExecutorTaskDefinition> = {
  "platform-executor": {
    path: "/v1/internal/agent-executions/run-platform-executor",
    body: () => ({ limit: env.platformExecutorLimit }),
  },
  "recover-stale": {
    path: "/v1/internal/agent-executions/recover-stale",
    body: () => ({ limit: env.recoveryLimit, staleSeconds: env.recoveryStaleSeconds }),
  },
  "runtime-sweep": {
    path: "/v1/internal/agent-executions/runtime-sessions/sweep",
    body: () => ({ limit: env.runtimeSweepLimit, staleSeconds: env.runtimeSweepStaleSeconds }),
  },
  "arbitration-expire-prepared": {
    path: "/v1/internal/arbitrations/attachments/expire-prepared",
    body: () => ({ limit: env.arbitrationExpirePreparedLimit }),
  },
  "arbitration-release-stale": {
    path: "/v1/internal/arbitrations/cases/release-stale",
    body: () => ({ limit: env.arbitrationReleaseStaleLimit }),
  },
  "arbitration-auto-advance-stale-rounds": {
    path: "/v1/internal/arbitrations/cases/advance-stale-rounds",
    body: () => ({ limit: env.arbitrationAutoAdvanceStaleRoundsLimit }),
  },
  "arbitration-escalate-final-rounds": {
    path: "/v1/internal/arbitrations/cases/escalate-final-rounds",
    body: () => ({ limit: env.arbitrationEscalateFinalRoundsLimit }),
  },
  "arbitration-rebalance-rounds": {
    path: "/v1/internal/arbitrations/cases/rebalance-rounds",
    body: () => ({ limit: env.arbitrationRebalanceRoundsLimit }),
  },
  "arbitration-cleanup-remote": {
    path: "/v1/internal/arbitrations/attachments/cleanup-remote",
    body: () => ({ limit: env.arbitrationCleanupRemoteLimit }),
  },
  "settlements-run": {
    path: "/v1/internal/agent-executions/settlements/run",
    body: () => ({ limit: env.settlementLoopLimit }),
  },
  "opinion-monthly-leaders": {
    path: "/v1/internal/opinions/monthly-leaders/run",
    body: () => ({ limit: env.opinionMonthlyLeadersLimit }),
  },
  "callback-auto-remediate": {
    path: "/v1/internal/agent-executions/callback-audits/auto-remediate",
    body: () => ({ limit: env.callbackAutoRemediationLimit }),
  },
  "callback-remediation-alerts": {
    path: "/v1/internal/agent-executions/callback-audits/emit-alerts",
    body: () => ({
      limit: env.callbackRemediationAlertsLimit,
      minimumAlertLevel: env.callbackRemediationAlertsMinLevel,
    }),
  },
  "runtime-pressure-alerts": {
    path: "/v1/internal/agent-executions/runtime-alerts/emit-alerts",
    body: () => ({
      limit: env.runtimePressureAlertsLimit,
      minimumAlertLevel: env.runtimePressureAlertsMinLevel,
    }),
  },
  "outbox-alerts": {
    path: "/v1/internal/outbox-events/emit-alerts",
    body: () => ({
      limit: env.outboxAlertsLimit,
      minimumAlertLevel: env.outboxAlertsMinLevel,
    }),
  },
  "callback-compatibility-cleanup": {
    path: "/v1/internal/agents/callback-compatibility/cleanup-expired",
    body: () => ({ limit: env.callbackCompatibilityCleanupLimit }),
  },
  "reconcile-due": {
    path: "/v1/internal/items/reconcile-due",
    body: () => ({ limit: 20 }),
  },
  "manual-review-release-stale": {
    path: "/v1/internal/items/manual-reviews/release-stale",
    body: () => ({ limit: 20 }),
  },
  "manual-review-rebalance-auto": {
    path: "/v1/internal/items/manual-reviews/rebalance-auto",
    body: () => ({}),
  },
  "manual-review-auto-assign-sla": {
    path: "/v1/internal/items/manual-reviews/auto-assign-sla",
    body: () => ({}),
  },
  "manual-review-sync-sla-anomalies": {
    path: "/v1/internal/items/manual-reviews/sync-sla-anomalies",
    body: () => ({ limit: 200 }),
  },
  "fulfillment-anomalies-escalate": {
    path: "/v1/internal/items/anomalies/escalate",
    body: () => ({ limit: 200 }),
  },
  "discount-code-history-archive": {
    path: "/v1/internal/discount-code-history/export-archives/run-due",
    body: () => ({ limit: env.discountCodeHistoryArchiveLimit }),
  },
  "discount-code-history-archive-cleanup": {
    path: "/v1/internal/discount-code-history/export-archives/cleanup",
    body: () => ({ limit: env.discountCodeHistoryArchiveCleanupLimit }),
  },
};

function buildCoreEndpoint(path: string) {
  return `${env.coreInternalUrl.replace(/\/+$/, "")}${path}`;
}

export async function runExecutorTask(taskKey: ExecutorTaskKey) {
  const task = taskDefinitions[taskKey];
  if (!task) {
    throw new Error(`Unsupported executor task: ${taskKey}`);
  }

  await postInternalJson(buildCoreEndpoint(task.path), env.internalApiToken, task.body());
}

export function listExecutorTasks(): ExecutorTaskKey[] {
  return Object.keys(taskDefinitions) as ExecutorTaskKey[];
}
