type ExecutorEnv = {
  coreInternalUrl: string;
  internalApiToken: string;
  healthPort: number;
  platformExecutorIntervalMs: number;
  platformExecutorLimit: number;
  recoveryIntervalMs: number;
  recoveryLimit: number;
  recoveryStaleSeconds: number;
  runtimeSweepIntervalMs: number;
  runtimeSweepLimit: number;
  runtimeSweepStaleSeconds: number;
  settlementLoopIntervalMs: number;
  settlementLoopLimit: number;
  opinionMonthlyLeadersLimit: number;
  callbackAutoRemediationIntervalMs: number;
  callbackAutoRemediationLimit: number;
  callbackRemediationAlertsIntervalMs: number;
  callbackRemediationAlertsLimit: number;
  callbackRemediationAlertsMinLevel: number;
  runtimePressureAlertsIntervalMs: number;
  runtimePressureAlertsLimit: number;
  runtimePressureAlertsMinLevel: number;
  outboxAlertsIntervalMs: number;
  outboxAlertsLimit: number;
  outboxAlertsMinLevel: number;
  callbackCompatibilityCleanupIntervalMs: number;
  callbackCompatibilityCleanupLimit: number;
  arbitrationExpirePreparedIntervalMs: number;
  arbitrationExpirePreparedLimit: number;
  arbitrationReleaseStaleIntervalMs: number;
  arbitrationReleaseStaleLimit: number;
  arbitrationAutoAdvanceStaleRoundsIntervalMs: number;
  arbitrationAutoAdvanceStaleRoundsLimit: number;
  arbitrationEscalateFinalRoundsIntervalMs: number;
  arbitrationEscalateFinalRoundsLimit: number;
  arbitrationRebalanceRoundsIntervalMs: number;
  arbitrationRebalanceRoundsLimit: number;
  arbitrationCleanupRemoteIntervalMs: number;
  arbitrationCleanupRemoteLimit: number;
  manualReviewReleaseStaleIntervalMs: number;
  manualReviewRebalanceIntervalMs: number;
  manualReviewAutoAssignIntervalMs: number;
  manualReviewSyncSlaIntervalMs: number;
  fulfillmentAnomalyEscalationIntervalMs: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(value: string | undefined, fallback: number, minimum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.floor(parsed);
}

export const env: ExecutorEnv = {
  coreInternalUrl: requireEnv("CORE_INTERNAL_URL"),
  internalApiToken: requireEnv("INTERNAL_API_TOKEN"),
  healthPort: parseNumber(process.env.EXECUTOR_HEALTH_PORT, 7302, 1),
  platformExecutorIntervalMs: parseNumber(process.env.EXECUTOR_PLATFORM_INTERVAL_MS, 5000, 1000),
  platformExecutorLimit: parseNumber(process.env.EXECUTOR_PLATFORM_LIMIT, 3, 1),
  recoveryIntervalMs: parseNumber(process.env.EXECUTOR_RECOVERY_INTERVAL_MS, 15000, 1000),
  recoveryLimit: parseNumber(process.env.EXECUTOR_RECOVERY_LIMIT, 10, 1),
  recoveryStaleSeconds: parseNumber(process.env.EXECUTOR_RECOVERY_STALE_SECONDS, 900, 60),
  runtimeSweepIntervalMs: parseNumber(process.env.EXECUTOR_RUNTIME_SWEEP_INTERVAL_MS, 60000, 1000),
  runtimeSweepLimit: parseNumber(process.env.EXECUTOR_RUNTIME_SWEEP_LIMIT, 25, 1),
  runtimeSweepStaleSeconds: parseNumber(process.env.EXECUTOR_RUNTIME_SWEEP_STALE_SECONDS, 1800, 60),
  settlementLoopIntervalMs: parseNumber(process.env.EXECUTOR_SETTLEMENT_INTERVAL_MS, 45000, 1000),
  settlementLoopLimit: parseNumber(process.env.EXECUTOR_SETTLEMENT_LIMIT, 10, 1),
  opinionMonthlyLeadersLimit: parseNumber(process.env.EXECUTOR_OPINION_MONTHLY_LEADERS_LIMIT, 10, 1),
  callbackAutoRemediationIntervalMs: parseNumber(
    process.env.EXECUTOR_CALLBACK_AUTO_REMEDIATION_INTERVAL_MS,
    45000,
    1000,
  ),
  callbackAutoRemediationLimit: parseNumber(process.env.EXECUTOR_CALLBACK_AUTO_REMEDIATION_LIMIT, 10, 1),
  callbackRemediationAlertsIntervalMs: parseNumber(
    process.env.EXECUTOR_CALLBACK_REMEDIATION_ALERTS_INTERVAL_MS,
    60000,
    1000,
  ),
  callbackRemediationAlertsLimit: parseNumber(
    process.env.EXECUTOR_CALLBACK_REMEDIATION_ALERTS_LIMIT,
    10,
    1,
  ),
  callbackRemediationAlertsMinLevel: parseNumber(
    process.env.EXECUTOR_CALLBACK_REMEDIATION_ALERTS_MIN_LEVEL,
    2,
    1,
  ),
  runtimePressureAlertsIntervalMs: parseNumber(
    process.env.EXECUTOR_RUNTIME_PRESSURE_ALERTS_INTERVAL_MS,
    60000,
    1000,
  ),
  runtimePressureAlertsLimit: parseNumber(process.env.EXECUTOR_RUNTIME_PRESSURE_ALERTS_LIMIT, 10, 1),
  runtimePressureAlertsMinLevel: parseNumber(process.env.EXECUTOR_RUNTIME_PRESSURE_ALERTS_MIN_LEVEL, 2, 1),
  outboxAlertsIntervalMs: parseNumber(process.env.EXECUTOR_OUTBOX_ALERTS_INTERVAL_MS, 60000, 1000),
  outboxAlertsLimit: parseNumber(process.env.EXECUTOR_OUTBOX_ALERTS_LIMIT, 10, 1),
  outboxAlertsMinLevel: parseNumber(process.env.EXECUTOR_OUTBOX_ALERTS_MIN_LEVEL, 2, 1),
  callbackCompatibilityCleanupIntervalMs: parseNumber(
    process.env.EXECUTOR_CALLBACK_COMPATIBILITY_CLEANUP_INTERVAL_MS,
    120000,
    1000,
  ),
  callbackCompatibilityCleanupLimit: parseNumber(process.env.EXECUTOR_CALLBACK_COMPATIBILITY_CLEANUP_LIMIT, 25, 1),
  arbitrationExpirePreparedIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_EXPIRE_PREPARED_INTERVAL_MS,
    60000,
    1000,
  ),
  arbitrationExpirePreparedLimit: parseNumber(process.env.EXECUTOR_ARBITRATION_EXPIRE_PREPARED_LIMIT, 20, 1),
  arbitrationReleaseStaleIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_RELEASE_STALE_INTERVAL_MS,
    60000,
    1000,
  ),
  arbitrationReleaseStaleLimit: parseNumber(process.env.EXECUTOR_ARBITRATION_RELEASE_STALE_LIMIT, 20, 1),
  arbitrationAutoAdvanceStaleRoundsIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_AUTO_ADVANCE_STALE_ROUNDS_INTERVAL_MS,
    120000,
    1000,
  ),
  arbitrationAutoAdvanceStaleRoundsLimit: parseNumber(
    process.env.EXECUTOR_ARBITRATION_AUTO_ADVANCE_STALE_ROUNDS_LIMIT,
    20,
    1,
  ),
  arbitrationEscalateFinalRoundsIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_ESCALATE_FINAL_ROUNDS_INTERVAL_MS,
    180000,
    1000,
  ),
  arbitrationEscalateFinalRoundsLimit: parseNumber(
    process.env.EXECUTOR_ARBITRATION_ESCALATE_FINAL_ROUNDS_LIMIT,
    20,
    1,
  ),
  arbitrationRebalanceRoundsIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_REBALANCE_ROUNDS_INTERVAL_MS,
    60000,
    1000,
  ),
  arbitrationRebalanceRoundsLimit: parseNumber(process.env.EXECUTOR_ARBITRATION_REBALANCE_ROUNDS_LIMIT, 20, 1),
  arbitrationCleanupRemoteIntervalMs: parseNumber(
    process.env.EXECUTOR_ARBITRATION_CLEANUP_REMOTE_INTERVAL_MS,
    120000,
    1000,
  ),
  arbitrationCleanupRemoteLimit: parseNumber(process.env.EXECUTOR_ARBITRATION_CLEANUP_REMOTE_LIMIT, 20, 1),
  manualReviewReleaseStaleIntervalMs: parseNumber(
    process.env.EXECUTOR_MANUAL_REVIEW_RELEASE_STALE_INTERVAL_MS,
    60000,
    1000,
  ),
  manualReviewRebalanceIntervalMs: parseNumber(
    process.env.EXECUTOR_MANUAL_REVIEW_REBALANCE_INTERVAL_MS,
    90000,
    1000,
  ),
  manualReviewAutoAssignIntervalMs: parseNumber(
    process.env.EXECUTOR_MANUAL_REVIEW_AUTO_ASSIGN_INTERVAL_MS,
    60000,
    1000,
  ),
  manualReviewSyncSlaIntervalMs: parseNumber(
    process.env.EXECUTOR_MANUAL_REVIEW_SYNC_SLA_INTERVAL_MS,
    60000,
    1000,
  ),
  fulfillmentAnomalyEscalationIntervalMs: parseNumber(
    process.env.EXECUTOR_FULFILLMENT_ANOMALY_ESCALATION_INTERVAL_MS,
    90000,
    1000,
  ),
};
