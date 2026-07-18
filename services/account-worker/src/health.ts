import http from "node:http";

import type {
  AccountWorkerHealthResponse,
  AccountWorkerHealthView,
} from "@neuro/contracts";

type WorkerHealthState = AccountWorkerHealthView & {
  readinessFreshnessMs: number;
  dependencyFailures: Record<string, { lastErrorAt: string; message: string }>;
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
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  nowMs = Date.now(),
): WorkerHealthState {
  return {
    startedAt: toTimestamp(nowMs),
    readinessFreshnessMs: resolveReadinessFreshnessMs(pollIntervalMs),
    dependencyFailures: {},
    lastCycleAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastOutboxRecoveryAt: null,
    lastOutboxRecoveryStatus: null,
    lastOutboxRecoveryRequeuedCount: null,
    lastOutboxRecoveryDeadLetterCount: null,
    totalOutboxRecoveryRequeuedCount: 0,
    totalOutboxRecoveryDeadLetterCount: 0,
    lastOutboxRecoveryErrorAt: null,
    lastOutboxRecoveryErrorMessage: null,
    lastProductShadowSyncAt: null,
    lastProductShadowSyncStatus: null,
    lastProductShadowSyncError: null,
    lastGatewayAnomalySweepAt: null,
    lastGatewayAnomalySweepStatus: null,
    lastGatewayAnomalySweepError: null,
    lastGatewayAnomalySweepAttemptedCount: null,
    lastGatewayAnomalySweepOkCount: null,
    lastGatewayAnomalySweepErrorCount: null,
    lastGatewayAnomalySweepSkippedCount: null,
    lastGatewayAnomalySweepLockSkippedAt: null,
    lastGatewayAnomalySweepLockSkipReason: null,
    lastGatewayAnomalyAlertDispatchAt: null,
    lastGatewayAnomalyAlertDispatchStatus: null,
    lastGatewayAnomalyAlertDispatchError: null,
    lastGatewayAnomalyAlertDispatchAttemptedCount: null,
    lastGatewayAnomalyAlertDispatchDeliveredCount: null,
    lastGatewayAnomalyAlertDispatchErrorCount: null,
    lastGatewayAnomalyAlertDispatchSkippedCount: null,
    lastGatewayAnomalyAlertDispatchLockSkippedAt: null,
    lastGatewayAnomalyAlertDispatchLockSkipReason: null,
    lastGatewayAnomalyAutoRemediationAt: null,
    lastGatewayAnomalyAutoRemediationStatus: null,
    lastGatewayAnomalyAutoRemediationError: null,
    lastGatewayAnomalyAutoRemediationAttemptedCount: null,
    lastGatewayAnomalyAutoRemediationDryRunCount: null,
    lastGatewayAnomalyAutoRemediationAppliedCount: null,
    lastGatewayAnomalyAutoRemediationErrorCount: null,
    lastGatewayAnomalyAutoRemediationSkippedCount: null,
    lastGatewayAnomalyAutoRemediationLockSkippedAt: null,
    lastGatewayAnomalyAutoRemediationLockSkipReason: null,
    lastGatewayAnomalyRemediationImpactCaptureAt: null,
    lastGatewayAnomalyRemediationImpactCaptureStatus: null,
    lastGatewayAnomalyRemediationImpactCaptureError: null,
    lastGatewayAnomalyRemediationImpactCaptureAttemptedCount: null,
    lastGatewayAnomalyRemediationImpactCaptureCapturedCount: null,
    lastGatewayAnomalyRemediationImpactCaptureErrorCount: null,
    lastGatewayAnomalyRemediationImpactCaptureSkippedCount: null,
    lastGatewayAnomalyRemediationImpactCaptureLockSkippedAt: null,
    lastGatewayAnomalyRemediationImpactCaptureLockSkipReason: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotAt: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotStatus: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotError: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotSnapshotId: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotRunCount: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotImpactedRunCount: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotUnavailableRunCount: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkippedAt: null,
    lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkipReason: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotStatus: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotError: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSnapshotId: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAnomalyCount: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotCriticalCount: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotDeliveredCount: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotErrorCount: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSkippedCount: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkippedAt: null,
    lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipReason: null,
    lastGatewayRateLimitHotspotSnapshotAt: null,
    lastGatewayRateLimitHotspotSnapshotStatus: null,
    lastGatewayRateLimitHotspotSnapshotError: null,
    lastGatewayRateLimitHotspotSnapshotSnapshotId: null,
    lastGatewayRateLimitHotspotSnapshotRateLimitedRequestCount: null,
    lastGatewayRateLimitHotspotSnapshotLockSkippedAt: null,
    lastGatewayRateLimitHotspotSnapshotLockSkipReason: null,
    lastGatewayRateLimitHotspotAnomalySnapshotAt: null,
    lastGatewayRateLimitHotspotAnomalySnapshotStatus: null,
    lastGatewayRateLimitHotspotAnomalySnapshotError: null,
    lastGatewayRateLimitHotspotAnomalySnapshotSnapshotId: null,
    lastGatewayRateLimitHotspotAnomalySnapshotAnomalyCount: null,
    lastGatewayRateLimitHotspotAnomalySnapshotCriticalCount: null,
    lastGatewayRateLimitHotspotAnomalySnapshotDeliveredCount: null,
    lastGatewayRateLimitHotspotAnomalySnapshotErrorCount: null,
    lastGatewayRateLimitHotspotAnomalySnapshotSkippedCount: null,
    lastGatewayRateLimitHotspotAnomalySnapshotLockSkippedAt: null,
    lastGatewayRateLimitHotspotAnomalySnapshotLockSkipReason: null,
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
    message: error ?? "unknown account worker dependency error",
  };
}

const READINESS_STATUS_DEPENDENCIES = [
  ["outbox-recovery", "lastOutboxRecoveryStatus"],
  ["product-shadow-sync", "lastProductShadowSyncStatus"],
  ["gateway-anomaly-sweep", "lastGatewayAnomalySweepStatus"],
  ["gateway-anomaly-alert-dispatch", "lastGatewayAnomalyAlertDispatchStatus"],
  ["gateway-anomaly-auto-remediation", "lastGatewayAnomalyAutoRemediationStatus"],
  ["gateway-remediation-impact-capture", "lastGatewayAnomalyRemediationImpactCaptureStatus"],
  ["gateway-remediation-effectiveness-snapshot", "lastGatewayAnomalyRemediationEffectivenessSnapshotStatus"],
  ["gateway-remediation-effectiveness-anomaly-snapshot", "lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotStatus"],
  ["gateway-rate-limit-hotspot-snapshot", "lastGatewayRateLimitHotspotSnapshotStatus"],
  ["gateway-rate-limit-hotspot-anomaly-snapshot", "lastGatewayRateLimitHotspotAnomalySnapshotStatus"],
] as const;

export function evaluateWorkerReadiness(state: WorkerHealthState, nowMs = Date.now()): WorkerReadiness {
  const successAgeMs = lastSuccessAgeMs(state, nowMs);
  const statusFailures = READINESS_STATUS_DEPENDENCIES.filter(
    ([, field]) => state[field] === "error",
  ).map(([dependency]) => dependency);
  const failingDependencies = [...new Set([...Object.keys(state.dependencyFailures), ...statusFailures])].sort();
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

export function markOutboxRecovery(
  state: WorkerHealthState,
  args:
    | {
        status: "success";
        requeuedCount: number;
        deadLetterCount: number;
      }
    | {
        status: "error";
        error?: string;
      },
) {
  const timestamp = new Date().toISOString();
  state.lastOutboxRecoveryAt = timestamp;
  state.lastOutboxRecoveryStatus = args.status;

  if (args.status === "success") {
    state.lastOutboxRecoveryRequeuedCount = args.requeuedCount;
    state.lastOutboxRecoveryDeadLetterCount = args.deadLetterCount;
    state.totalOutboxRecoveryRequeuedCount += args.requeuedCount;
    state.totalOutboxRecoveryDeadLetterCount += args.deadLetterCount;
    state.lastOutboxRecoveryErrorAt = null;
    state.lastOutboxRecoveryErrorMessage = null;
    return;
  }

  state.lastOutboxRecoveryRequeuedCount = null;
  state.lastOutboxRecoveryDeadLetterCount = null;
  state.lastOutboxRecoveryErrorAt = timestamp;
  state.lastOutboxRecoveryErrorMessage = args.error ?? "unknown outbox recovery error";
}

export function markProductShadowSync(state: WorkerHealthState, status: "success" | "error", error?: string) {
  state.lastProductShadowSyncAt = new Date().toISOString();
  state.lastProductShadowSyncStatus = status;
  state.lastProductShadowSyncError = status === "error" ? error ?? "unknown product shadow sync error" : null;
}

export function markGatewayAnomalySweep(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    attemptedCount?: number;
    okCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayAnomalySweepAt = new Date().toISOString();
  state.lastGatewayAnomalySweepStatus = args.status;
  state.lastGatewayAnomalySweepError = args.status === "error" ? args.error ?? "unknown gateway anomaly sweep error" : null;
  state.lastGatewayAnomalySweepAttemptedCount = args.attemptedCount ?? null;
  state.lastGatewayAnomalySweepOkCount = args.okCount ?? null;
  state.lastGatewayAnomalySweepErrorCount = args.errorCount ?? null;
  state.lastGatewayAnomalySweepSkippedCount = args.skippedCount ?? null;
}

export function markGatewayAnomalySweepLockSkipped(state: WorkerHealthState, reason: string) {
  state.lastGatewayAnomalySweepLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalySweepLockSkipReason = reason;
}

export function markGatewayAnomalyAlertDispatch(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    attemptedCount?: number;
    deliveredCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayAnomalyAlertDispatchAt = new Date().toISOString();
  state.lastGatewayAnomalyAlertDispatchStatus = args.status;
  state.lastGatewayAnomalyAlertDispatchError =
    args.status === "error" ? args.error ?? "unknown gateway anomaly alert dispatch error" : null;
  state.lastGatewayAnomalyAlertDispatchAttemptedCount = args.attemptedCount ?? null;
  state.lastGatewayAnomalyAlertDispatchDeliveredCount = args.deliveredCount ?? null;
  state.lastGatewayAnomalyAlertDispatchErrorCount = args.errorCount ?? null;
  state.lastGatewayAnomalyAlertDispatchSkippedCount = args.skippedCount ?? null;
}

export function markGatewayAnomalyAlertDispatchLockSkipped(state: WorkerHealthState, reason: string) {
  state.lastGatewayAnomalyAlertDispatchLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalyAlertDispatchLockSkipReason = reason;
}

export function markGatewayAnomalyAutoRemediation(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    attemptedCount?: number;
    dryRunCount?: number;
    appliedCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayAnomalyAutoRemediationAt = new Date().toISOString();
  state.lastGatewayAnomalyAutoRemediationStatus = args.status;
  state.lastGatewayAnomalyAutoRemediationError =
    args.status === "error" ? args.error ?? "unknown gateway anomaly auto remediation error" : null;
  state.lastGatewayAnomalyAutoRemediationAttemptedCount = args.attemptedCount ?? null;
  state.lastGatewayAnomalyAutoRemediationDryRunCount = args.dryRunCount ?? null;
  state.lastGatewayAnomalyAutoRemediationAppliedCount = args.appliedCount ?? null;
  state.lastGatewayAnomalyAutoRemediationErrorCount = args.errorCount ?? null;
  state.lastGatewayAnomalyAutoRemediationSkippedCount = args.skippedCount ?? null;
}

export function markGatewayAnomalyAutoRemediationLockSkipped(state: WorkerHealthState, reason: string) {
  state.lastGatewayAnomalyAutoRemediationLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalyAutoRemediationLockSkipReason = reason;
}

export function markGatewayAnomalyRemediationImpactCapture(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    attemptedCount?: number;
    capturedCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayAnomalyRemediationImpactCaptureAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationImpactCaptureStatus = args.status;
  state.lastGatewayAnomalyRemediationImpactCaptureError =
    args.status === "error" ? args.error ?? "unknown gateway anomaly remediation impact capture error" : null;
  state.lastGatewayAnomalyRemediationImpactCaptureAttemptedCount = args.attemptedCount ?? null;
  state.lastGatewayAnomalyRemediationImpactCaptureCapturedCount = args.capturedCount ?? null;
  state.lastGatewayAnomalyRemediationImpactCaptureErrorCount = args.errorCount ?? null;
  state.lastGatewayAnomalyRemediationImpactCaptureSkippedCount = args.skippedCount ?? null;
}

export function markGatewayAnomalyRemediationImpactCaptureLockSkipped(state: WorkerHealthState, reason: string) {
  state.lastGatewayAnomalyRemediationImpactCaptureLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationImpactCaptureLockSkipReason = reason;
}

export function markGatewayAnomalyRemediationEffectivenessSnapshot(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    snapshotId?: string | null;
    runCount?: number;
    impactedRunCount?: number;
    unavailableRunCount?: number;
  },
) {
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotStatus = args.status;
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotError =
    args.status === "error" ? args.error ?? "unknown gateway remediation effectiveness snapshot error" : null;
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotSnapshotId = args.snapshotId ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotRunCount = args.runCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotImpactedRunCount = args.impactedRunCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotUnavailableRunCount = args.unavailableRunCount ?? null;
}

export function markGatewayAnomalyRemediationEffectivenessSnapshotLockSkipped(
  state: WorkerHealthState,
  reason: string,
) {
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationEffectivenessSnapshotLockSkipReason = reason;
}

export function markGatewayAnomalyRemediationEffectivenessAnomalySnapshot(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    snapshotId?: string | null;
    anomalyCount?: number;
    criticalCount?: number;
    deliveredCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotStatus = args.status;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotError =
    args.status === "error" ? args.error ?? "unknown gateway remediation effectiveness anomaly snapshot error" : null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSnapshotId = args.snapshotId ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotAnomalyCount = args.anomalyCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotCriticalCount = args.criticalCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotDeliveredCount = args.deliveredCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotErrorCount = args.errorCount ?? null;
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotSkippedCount = args.skippedCount ?? null;
}

export function markGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipped(
  state: WorkerHealthState,
  reason: string,
) {
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkippedAt = new Date().toISOString();
  state.lastGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipReason = reason;
}

export function markGatewayRateLimitHotspotSnapshot(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    snapshotId?: string | null;
    rateLimitedRequestCount?: number;
  },
) {
  state.lastGatewayRateLimitHotspotSnapshotAt = new Date().toISOString();
  state.lastGatewayRateLimitHotspotSnapshotStatus = args.status;
  state.lastGatewayRateLimitHotspotSnapshotError =
    args.status === "error" ? args.error ?? "unknown gateway rate-limit hotspot snapshot error" : null;
  state.lastGatewayRateLimitHotspotSnapshotSnapshotId = args.snapshotId ?? null;
  state.lastGatewayRateLimitHotspotSnapshotRateLimitedRequestCount = args.rateLimitedRequestCount ?? null;
}

export function markGatewayRateLimitHotspotSnapshotLockSkipped(state: WorkerHealthState, reason: string) {
  state.lastGatewayRateLimitHotspotSnapshotLockSkippedAt = new Date().toISOString();
  state.lastGatewayRateLimitHotspotSnapshotLockSkipReason = reason;
}

export function markGatewayRateLimitHotspotAnomalySnapshot(
  state: WorkerHealthState,
  args: {
    status: "success" | "error";
    error?: string;
    snapshotId?: string | null;
    anomalyCount?: number;
    criticalCount?: number;
    deliveredCount?: number;
    errorCount?: number;
    skippedCount?: number;
  },
) {
  state.lastGatewayRateLimitHotspotAnomalySnapshotAt = new Date().toISOString();
  state.lastGatewayRateLimitHotspotAnomalySnapshotStatus = args.status;
  state.lastGatewayRateLimitHotspotAnomalySnapshotError =
    args.status === "error" ? args.error ?? "unknown gateway rate-limit hotspot anomaly snapshot error" : null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotSnapshotId = args.snapshotId ?? null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotAnomalyCount = args.anomalyCount ?? null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotCriticalCount = args.criticalCount ?? null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotDeliveredCount = args.deliveredCount ?? null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotErrorCount = args.errorCount ?? null;
  state.lastGatewayRateLimitHotspotAnomalySnapshotSkippedCount = args.skippedCount ?? null;
}

export function markGatewayRateLimitHotspotAnomalySnapshotLockSkipped(
  state: WorkerHealthState,
  reason: string,
) {
  state.lastGatewayRateLimitHotspotAnomalySnapshotLockSkippedAt = new Date().toISOString();
  state.lastGatewayRateLimitHotspotAnomalySnapshotLockSkipReason = reason;
}

export function startWorkerHealthServer(port: number, state: WorkerHealthState) {
  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(404).end();
      return;
    }

    if (request.url === "/health") {
      const payload: AccountWorkerHealthResponse = {
        ok: true,
        service: "account-worker",
        role: "account-outbox-consumer-product-shadow-and-gateway-anomaly-governance",
        state,
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    if (request.url === "/ready") {
      const readiness = evaluateWorkerReadiness(state);
      response.writeHead(readiness.ready ? 200 : 503, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: readiness.ready,
          ready: readiness.ready,
          service: "account-worker",
          role: "account-outbox-consumer-product-shadow-and-gateway-anomaly-governance",
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
