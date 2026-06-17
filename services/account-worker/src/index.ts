import {
  runCredentialPoolLifecycleSweep,
  syncBenefitPurchaseGrants,
  syncDedicatedProductShadowFromCore,
} from "@neuro/account-domain";
import {
  recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator,
  sweepGatewayAnalysisAnomalyPoliciesForOperator,
  syncGatewayRateLimitHotspotAnomalyIncidentsForOperator,
} from "@neuro/ai-gateway-domain";

import { env } from "@/env";
import { dispatchGatewayAnomalyIncidentAlerts } from "@/gateway-anomaly-alerts";
import { dispatchGatewayAnomalyAutoRemediation } from "@/gateway-anomaly-auto-remediation";
import { dispatchGatewayRemediationEffectivenessAnomalyAlerts } from "@/gateway-anomaly-remediation-effectiveness-alerts";
import { dispatchGatewayAnomalyRemediationEffectivenessAnomalySnapshot } from "@/gateway-anomaly-remediation-effectiveness-anomaly-snapshot";
import { dispatchGatewayAnomalyRemediationEffectivenessSnapshot } from "@/gateway-anomaly-remediation-effectiveness-snapshot";
import { dispatchGatewayAnomalyRemediationImpactCapture } from "@/gateway-anomaly-remediation-impact";
import { dispatchGatewayRateLimitHotspotAnomalyAlerts } from "@/gateway-rate-limit-hotspot-anomaly-alerts";
import { dispatchGatewayRateLimitHotspotAnomalySnapshot } from "@/gateway-rate-limit-hotspot-anomaly-snapshot";
import { dispatchGatewayRateLimitHotspotSnapshot } from "@/gateway-rate-limit-hotspot-snapshot";
import {
  acquireGatewayAnomalyAlertDispatchLock,
  acquireGatewayAnomalyAutoRemediationLock,
  acquireGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock,
  acquireGatewayAnomalyRemediationEffectivenessSnapshotLock,
  acquireGatewayAnomalyRemediationImpactCaptureLock,
  acquireGatewayAnomalySweepLock,
  acquireGatewayRateLimitHotspotAnomalySnapshotLock,
  acquireGatewayRateLimitHotspotSnapshotLock,
  releaseGatewayAnomalyAlertDispatchLock,
  releaseGatewayAnomalyAutoRemediationLock,
  releaseGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock,
  releaseGatewayAnomalyRemediationEffectivenessSnapshotLock,
  releaseGatewayAnomalyRemediationImpactCaptureLock,
  releaseGatewayAnomalySweepLock,
  releaseGatewayRateLimitHotspotAnomalySnapshotLock,
  releaseGatewayRateLimitHotspotSnapshotLock,
} from "@/gateway-anomaly-sweep-lock";
import {
  createWorkerHealthState,
  markGatewayAnomalyAlertDispatch,
  markGatewayAnomalyAlertDispatchLockSkipped,
  markGatewayAnomalyAutoRemediation,
  markGatewayAnomalyAutoRemediationLockSkipped,
  markGatewayAnomalyRemediationEffectivenessAnomalySnapshot,
  markGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipped,
  markGatewayAnomalyRemediationEffectivenessSnapshot,
  markGatewayAnomalyRemediationEffectivenessSnapshotLockSkipped,
  markGatewayAnomalyRemediationImpactCapture,
  markGatewayAnomalyRemediationImpactCaptureLockSkipped,
  markGatewayAnomalySweep,
  markGatewayAnomalySweepLockSkipped,
  markGatewayRateLimitHotspotAnomalySnapshot,
  markGatewayRateLimitHotspotAnomalySnapshotLockSkipped,
  markGatewayRateLimitHotspotSnapshot,
  markGatewayRateLimitHotspotSnapshotLockSkipped,
  markOutboxRecovery,
  markProductShadowSync,
  markWorkerCycle,
  startWorkerHealthServer,
} from "@/health";
import { dispatchMailboxOpsCampaigns, handleEvent } from "@/handlers";
import {
  markEventFailed,
  markEventProcessed,
  pollPendingEvents,
  requeueStaleProcessingEvents,
} from "@/outbox";

let nextProductShadowSyncAt = 0;
let nextBenefitGrantSyncAt = 0;
let nextCredentialPoolSweepAt = 0;
let nextGatewayAnomalySweepAt = 0;
let nextGatewayAnomalyAlertDispatchAt = 0;
let nextGatewayAnomalyAutoRemediationAt = 0;
let nextGatewayAnomalyRemediationImpactCaptureAt = 0;
let nextGatewayAnomalyRemediationEffectivenessSnapshotAt = 0;
let nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt = 0;
let nextGatewayRateLimitHotspotSnapshotAt = 0;
let nextGatewayRateLimitHotspotAnomalySnapshotAt = 0;

async function cycle(healthState: ReturnType<typeof createWorkerHealthState>) {
  let recovered: Awaited<ReturnType<typeof requeueStaleProcessingEvents>>;
  try {
    recovered = await requeueStaleProcessingEvents(
      env.processingLeaseTimeoutMs,
      env.processingRecoveryLimit,
    );
    markOutboxRecovery(healthState, {
      status: "success",
      requeuedCount: recovered.requeuedCount,
      deadLetterCount: recovered.deadLetterCount,
    });
  } catch (error) {
    markOutboxRecovery(healthState, {
      status: "error",
      error: extractErrorMessage(error),
    });
    throw error;
  }
  if (recovered.requeuedCount > 0 || recovered.deadLetterCount > 0) {
    console.warn(
      `[account-worker] recovered stale processing events: requeued=${recovered.requeuedCount}, deadLetter=${recovered.deadLetterCount}`,
    );
  }

  const events = await pollPendingEvents();
  for (const event of events) {
    try {
      const result = await handleEvent(event.eventName, event.payload);
      if (result === "processed") {
        await markEventProcessed(event.id);
      } else {
        await markEventFailed(event.id, event.attempts, event.maxAttempts, "handler deferred processing");
      }
    } catch (error) {
      console.error(`Account worker failed to process ${event.eventName}`, error);
      await markEventFailed(event.id, event.attempts, event.maxAttempts, extractErrorMessage(error));
    }
  }
}

async function maybeSyncProductShadow(healthState: ReturnType<typeof createWorkerHealthState>) {
  if (
    !env.usesDedicatedDatabase ||
    !process.env.INTERNAL_API_TOKEN?.trim() ||
    Date.now() < nextProductShadowSyncAt
  ) {
    return;
  }

  try {
    const result = await syncDedicatedProductShadowFromCore();
    markProductShadowSync(healthState, "success");
    console.log(
      `[account-worker] product shadow sync completed: mode=${result.mode}, fetched=${result.fetchedCount}, deactivated=${result.deactivatedCount}`,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown product shadow sync failure";
    console.error("Account worker product shadow sync failed", error);
    markProductShadowSync(healthState, "error", message);
  } finally {
    nextProductShadowSyncAt = Date.now() + env.productShadowSyncIntervalMs;
  }
}

async function maybeSyncBenefitGrants() {
  if (Date.now() < nextBenefitGrantSyncAt) {
    return;
  }

  try {
    const result = await syncBenefitPurchaseGrants();
    console.log(
      `[account-worker] benefit purchase grant sync completed: synced=${result.syncedCount}, revoked=${result.revokedCount}, assignments=${result.touchedAssignmentCount}`,
    );
  } catch (error) {
    console.error("Account worker benefit purchase grant sync failed", error);
  } finally {
    nextBenefitGrantSyncAt = Date.now() + env.productShadowSyncIntervalMs;
  }
}

async function maybeSweepCredentialPools() {
  if (Date.now() < nextCredentialPoolSweepAt) {
    return;
  }

  try {
    const result = await runCredentialPoolLifecycleSweep();
    if (result.releasedRepairClaims > 0 || result.reactivatedEntries > 0 || result.deletedEntries > 0) {
      console.log(
        `[account-worker] credential pool sweep completed: releasedClaims=${result.releasedRepairClaims}, reactivated=${result.reactivatedEntries}, deleted=${result.deletedEntries}`,
      );
    }
  } catch (error) {
    console.error("Account worker credential pool sweep failed", error);
  } finally {
    nextCredentialPoolSweepAt = Date.now() + env.productShadowSyncIntervalMs;
  }
}

async function maybeSweepGatewayAnomalyPolicies(healthState: ReturnType<typeof createWorkerHealthState>) {
  if (!env.gatewayAnomalySweepEnabled || Date.now() < nextGatewayAnomalySweepAt) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway anomaly sweep skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalySweep(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      okCount: 0,
      errorCount: 0,
      skippedCount: 0,
    });
    nextGatewayAnomalySweepAt = Date.now() + env.gatewayAnomalySweepIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalySweepLock(env.gatewayAnomalySweepLockKey, env.gatewayAnomalySweepLockTtlMs);
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway anomaly sweep lock";
    console.error("Account worker gateway anomaly sweep lock acquisition failed", error);
    markGatewayAnomalySweep(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      okCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
    nextGatewayAnomalySweepAt = Date.now() + env.gatewayAnomalySweepIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalySweepLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalySweepLockKey}`,
    );
    nextGatewayAnomalySweepAt = Date.now() + env.gatewayAnomalySweepIntervalMs;
    return;
  }

  try {
    const result = await sweepGatewayAnalysisAnomalyPoliciesForOperator(operatorUserId, null, {
      status: "enabled",
      autoSyncEnabled: true,
      dueOnly: true,
      limit: env.gatewayAnomalySweepLimit,
    });
    markGatewayAnomalySweep(healthState, {
      status: result.errorCount > 0 ? "error" : "success",
      error: result.errorCount > 0 ? "gateway anomaly policy sweep completed with errors" : undefined,
      attemptedCount: result.attemptedCount,
      okCount: result.okCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount,
    });
    if (result.attemptedCount > 0) {
      console.log(
        `[account-worker] gateway anomaly policy sweep completed: attempted=${result.attemptedCount}, ok=${result.okCount}, errors=${result.errorCount}, skipped=${result.skippedCount}`,
      );
    }
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway anomaly sweep failure";
    console.error("Account worker gateway anomaly sweep failed", error);
    markGatewayAnomalySweep(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      okCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayAnomalySweepLock(lock).catch((error) => {
      console.error("Account worker gateway anomaly sweep lock release failed", error);
    });
    nextGatewayAnomalySweepAt = Date.now() + env.gatewayAnomalySweepIntervalMs;
  }
}

async function maybeDispatchGatewayAnomalyIncidentAlerts(healthState: ReturnType<typeof createWorkerHealthState>) {
  if (!env.gatewayAnomalyAlertDispatchEnabled || Date.now() < nextGatewayAnomalyAlertDispatchAt) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway anomaly alert dispatch skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalyAlertDispatch(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      deliveredCount: 0,
      errorCount: 0,
      skippedCount: 0,
    });
    nextGatewayAnomalyAlertDispatchAt = Date.now() + env.gatewayAnomalyAlertDispatchIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalyAlertDispatchLock(
      env.gatewayAnomalyAlertDispatchLockKey,
      env.gatewayAnomalyAlertDispatchLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway anomaly alert dispatch lock";
    console.error("Account worker gateway anomaly alert dispatch lock acquisition failed", error);
    markGatewayAnomalyAlertDispatch(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      deliveredCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
    nextGatewayAnomalyAlertDispatchAt = Date.now() + env.gatewayAnomalyAlertDispatchIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalyAlertDispatchLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalyAlertDispatchLockKey}`,
    );
    nextGatewayAnomalyAlertDispatchAt = Date.now() + env.gatewayAnomalyAlertDispatchIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayAnomalyIncidentAlerts({
      actorUserId: operatorUserId,
      operatorUserIds: env.platformOperatorUserIds,
      limit: env.gatewayAnomalyAlertDispatchLimit,
    });
    markGatewayAnomalyAlertDispatch(healthState, {
      status: result.errorCount > 0 ? "error" : "success",
      error: result.errorCount > 0 ? "gateway anomaly alert dispatch completed with errors" : undefined,
      attemptedCount: result.attemptedCount,
      deliveredCount: result.deliveredCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount,
    });
    if (result.attemptedCount > 0) {
      console.log(
        `[account-worker] gateway anomaly alerts dispatched: attempted=${result.attemptedCount}, delivered=${result.deliveredCount}, errors=${result.errorCount}, skipped=${result.skippedCount}`,
      );
    }
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway anomaly alert dispatch failure";
    console.error("Account worker gateway anomaly alert dispatch failed", error);
    markGatewayAnomalyAlertDispatch(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      deliveredCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayAnomalyAlertDispatchLock(lock).catch((error) => {
      console.error("Account worker gateway anomaly alert dispatch lock release failed", error);
    });
    nextGatewayAnomalyAlertDispatchAt = Date.now() + env.gatewayAnomalyAlertDispatchIntervalMs;
  }
}

async function maybeDispatchGatewayAnomalyAutoRemediation(healthState: ReturnType<typeof createWorkerHealthState>) {
  if (!env.gatewayAnomalyAutoRemediationEnabled || Date.now() < nextGatewayAnomalyAutoRemediationAt) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway anomaly auto remediation skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalyAutoRemediation(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      dryRunCount: 0,
      appliedCount: 0,
      errorCount: 0,
      skippedCount: 0,
    });
    nextGatewayAnomalyAutoRemediationAt = Date.now() + env.gatewayAnomalyAutoRemediationIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalyAutoRemediationLock(
      env.gatewayAnomalyAutoRemediationLockKey,
      env.gatewayAnomalyAutoRemediationLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway anomaly auto remediation lock";
    console.error("Account worker gateway anomaly auto remediation lock acquisition failed", error);
    markGatewayAnomalyAutoRemediation(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      dryRunCount: 0,
      appliedCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
    nextGatewayAnomalyAutoRemediationAt = Date.now() + env.gatewayAnomalyAutoRemediationIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalyAutoRemediationLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalyAutoRemediationLockKey}`,
    );
    nextGatewayAnomalyAutoRemediationAt = Date.now() + env.gatewayAnomalyAutoRemediationIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayAnomalyAutoRemediation({
      actorUserId: operatorUserId,
      limit: env.gatewayAnomalyAutoRemediationLimit,
    });
    markGatewayAnomalyAutoRemediation(healthState, {
      status: result.errorCount > 0 ? "error" : "success",
      error: result.errorCount > 0 ? "gateway anomaly auto remediation completed with errors" : undefined,
      attemptedCount: result.attemptedCount,
      dryRunCount: result.dryRunCount,
      appliedCount: result.appliedCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount,
    });
    if (result.attemptedCount > 0) {
      console.log(
        `[account-worker] gateway anomaly auto remediation completed: attempted=${result.attemptedCount}, dryRun=${result.dryRunCount}, applied=${result.appliedCount}, errors=${result.errorCount}, skipped=${result.skippedCount}`,
      );
    }
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway anomaly auto remediation failure";
    console.error("Account worker gateway anomaly auto remediation failed", error);
    markGatewayAnomalyAutoRemediation(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      dryRunCount: 0,
      appliedCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayAnomalyAutoRemediationLock(lock).catch((error) => {
      console.error("Account worker gateway anomaly auto remediation lock release failed", error);
    });
    nextGatewayAnomalyAutoRemediationAt = Date.now() + env.gatewayAnomalyAutoRemediationIntervalMs;
  }
}

async function maybeCaptureGatewayAnomalyRemediationImpact(healthState: ReturnType<typeof createWorkerHealthState>) {
  if (
    !env.gatewayAnomalyRemediationImpactCaptureEnabled ||
    Date.now() < nextGatewayAnomalyRemediationImpactCaptureAt
  ) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway anomaly remediation impact capture skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalyRemediationImpactCapture(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      capturedCount: 0,
      errorCount: 0,
      skippedCount: 0,
    });
    nextGatewayAnomalyRemediationImpactCaptureAt = Date.now() + env.gatewayAnomalyRemediationImpactCaptureIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalyRemediationImpactCaptureLock(
      env.gatewayAnomalyRemediationImpactCaptureLockKey,
      env.gatewayAnomalyRemediationImpactCaptureLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway anomaly remediation impact capture lock";
    console.error("Account worker gateway anomaly remediation impact capture lock acquisition failed", error);
    markGatewayAnomalyRemediationImpactCapture(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      capturedCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
    nextGatewayAnomalyRemediationImpactCaptureAt = Date.now() + env.gatewayAnomalyRemediationImpactCaptureIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalyRemediationImpactCaptureLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalyRemediationImpactCaptureLockKey}`,
    );
    nextGatewayAnomalyRemediationImpactCaptureAt = Date.now() + env.gatewayAnomalyRemediationImpactCaptureIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayAnomalyRemediationImpactCapture({
      actorUserId: operatorUserId,
      limit: env.gatewayAnomalyRemediationImpactCaptureLimit,
      windowMinutes: env.gatewayAnomalyRemediationImpactCaptureWindowMinutes,
      lookbackHours: env.gatewayAnomalyRemediationImpactCaptureLookbackHours,
    });
    markGatewayAnomalyRemediationImpactCapture(healthState, {
      status: result.errorCount > 0 ? "error" : "success",
      error:
        result.errorCount > 0 ? "gateway anomaly remediation impact capture completed with errors" : undefined,
      attemptedCount: result.attemptedCount,
      capturedCount: result.capturedCount,
      errorCount: result.errorCount,
      skippedCount: result.skippedCount,
    });
    if (result.attemptedCount > 0) {
      console.log(
        `[account-worker] gateway anomaly remediation impact captured: attempted=${result.attemptedCount}, captured=${result.capturedCount}, errors=${result.errorCount}, skipped=${result.skippedCount}`,
      );
    }
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway anomaly remediation impact capture failure";
    console.error("Account worker gateway anomaly remediation impact capture failed", error);
    markGatewayAnomalyRemediationImpactCapture(healthState, {
      status: "error",
      error: message,
      attemptedCount: 0,
      capturedCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayAnomalyRemediationImpactCaptureLock(lock).catch((error) => {
      console.error("Account worker gateway anomaly remediation impact capture lock release failed", error);
    });
    nextGatewayAnomalyRemediationImpactCaptureAt = Date.now() + env.gatewayAnomalyRemediationImpactCaptureIntervalMs;
  }
}

async function maybePersistGatewayAnomalyRemediationEffectivenessSnapshot(
  healthState: ReturnType<typeof createWorkerHealthState>,
) {
  if (
    !env.gatewayAnomalyRemediationEffectivenessSnapshotEnabled ||
    Date.now() < nextGatewayAnomalyRemediationEffectivenessSnapshotAt
  ) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway remediation effectiveness snapshot skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalyRemediationEffectivenessSnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayAnomalyRemediationEffectivenessSnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalyRemediationEffectivenessSnapshotLock(
      env.gatewayAnomalyRemediationEffectivenessSnapshotLockKey,
      env.gatewayAnomalyRemediationEffectivenessSnapshotLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway remediation effectiveness snapshot lock";
    console.error("Account worker gateway remediation effectiveness snapshot lock acquisition failed", error);
    markGatewayAnomalyRemediationEffectivenessSnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayAnomalyRemediationEffectivenessSnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalyRemediationEffectivenessSnapshotLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalyRemediationEffectivenessSnapshotLockKey}`,
    );
    nextGatewayAnomalyRemediationEffectivenessSnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayAnomalyRemediationEffectivenessSnapshot({
      actorUserId: operatorUserId,
      limit: env.gatewayAnomalyRemediationEffectivenessSnapshotLimit,
      windowMinutes: env.gatewayAnomalyRemediationEffectivenessSnapshotWindowMinutes,
      lookbackHours: env.gatewayAnomalyRemediationEffectivenessSnapshotLookbackHours,
    });
    markGatewayAnomalyRemediationEffectivenessSnapshot(healthState, {
      status: "success",
      snapshotId: result.snapshotId,
      runCount: result.runCount,
      impactedRunCount: result.impactedRunCount,
      unavailableRunCount: result.unavailableRunCount,
    });
    console.log(
      `[account-worker] gateway remediation effectiveness snapshot persisted: snapshotId=${result.snapshotId}, runs=${result.runCount}, impacted=${result.impactedRunCount}, unavailable=${result.unavailableRunCount}`,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway remediation effectiveness snapshot failure";
    console.error("Account worker gateway remediation effectiveness snapshot failed", error);
    markGatewayAnomalyRemediationEffectivenessSnapshot(healthState, {
      status: "error",
      error: message,
    });
  } finally {
    await releaseGatewayAnomalyRemediationEffectivenessSnapshotLock(lock).catch((error) => {
      console.error("Account worker gateway remediation effectiveness snapshot lock release failed", error);
    });
    nextGatewayAnomalyRemediationEffectivenessSnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs;
  }
}

async function maybePersistGatewayAnomalyRemediationEffectivenessAnomalySnapshot(
  healthState: ReturnType<typeof createWorkerHealthState>,
) {
  if (
    !env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotEnabled ||
    Date.now() < nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt
  ) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway remediation effectiveness anomaly snapshot skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayAnomalyRemediationEffectivenessAnomalySnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock(
      env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockKey,
      env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockTtlMs,
    );
  } catch (error) {
    const message =
      extractErrorMessage(error) ?? "failed to acquire gateway remediation effectiveness anomaly snapshot lock";
    console.error("Account worker gateway remediation effectiveness anomaly snapshot lock acquisition failed", error);
    markGatewayAnomalyRemediationEffectivenessAnomalySnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayAnomalyRemediationEffectivenessAnomalySnapshotLockSkipped(
      healthState,
      `lock busy: ${env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockKey}`,
    );
    nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayAnomalyRemediationEffectivenessAnomalySnapshot({
      actorUserId: operatorUserId,
      limit: env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLimit,
      lookbackHours: env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLookbackHours,
      profileKey: env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotProfileKey,
    });
    let deliveredCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    if (result.anomalyCount > 0) {
      const alertResult = await dispatchGatewayRemediationEffectivenessAnomalyAlerts({
        snapshot: result.snapshot,
        operatorUserIds: env.platformOperatorUserIds,
      });
      deliveredCount = alertResult.deliveredCount;
      errorCount = alertResult.errorCount;
      skippedCount = alertResult.skippedCount;
    }
    markGatewayAnomalyRemediationEffectivenessAnomalySnapshot(healthState, {
      status: errorCount > 0 ? "error" : "success",
      error:
        errorCount > 0
          ? "gateway remediation effectiveness anomaly snapshot alert dispatch completed with errors"
          : undefined,
      snapshotId: result.snapshotId,
      anomalyCount: result.anomalyCount,
      criticalCount: result.criticalCount,
      deliveredCount,
      errorCount,
      skippedCount,
    });
    console.log(
      `[account-worker] gateway remediation effectiveness anomaly snapshot persisted: snapshotId=${result.snapshotId}, anomalies=${result.anomalyCount}, critical=${result.criticalCount}, delivered=${deliveredCount}, errors=${errorCount}, skipped=${skippedCount}`,
    );
  } catch (error) {
    const message =
      extractErrorMessage(error) ?? "unknown gateway remediation effectiveness anomaly snapshot failure";
    console.error("Account worker gateway remediation effectiveness anomaly snapshot failed", error);
    markGatewayAnomalyRemediationEffectivenessAnomalySnapshot(healthState, {
      status: "error",
      error: message,
      deliveredCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock(lock).catch((error) => {
      console.error("Account worker gateway remediation effectiveness anomaly snapshot lock release failed", error);
    });
    nextGatewayAnomalyRemediationEffectivenessAnomalySnapshotAt =
      Date.now() + env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs;
  }
}

async function maybePersistGatewayRateLimitHotspotSnapshot(
  healthState: ReturnType<typeof createWorkerHealthState>,
) {
  if (!env.gatewayRateLimitHotspotSnapshotEnabled || Date.now() < nextGatewayRateLimitHotspotSnapshotAt) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway rate-limit hotspot snapshot skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayRateLimitHotspotSnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayRateLimitHotspotSnapshotAt = Date.now() + env.gatewayRateLimitHotspotSnapshotIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayRateLimitHotspotSnapshotLock(
      env.gatewayRateLimitHotspotSnapshotLockKey,
      env.gatewayRateLimitHotspotSnapshotLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway rate-limit hotspot snapshot lock";
    console.error("Account worker gateway rate-limit hotspot snapshot lock acquisition failed", error);
    markGatewayRateLimitHotspotSnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayRateLimitHotspotSnapshotAt = Date.now() + env.gatewayRateLimitHotspotSnapshotIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayRateLimitHotspotSnapshotLockSkipped(
      healthState,
      `lock busy: ${env.gatewayRateLimitHotspotSnapshotLockKey}`,
    );
    nextGatewayRateLimitHotspotSnapshotAt = Date.now() + env.gatewayRateLimitHotspotSnapshotIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayRateLimitHotspotSnapshot({
      actorUserId: operatorUserId,
      limit: env.gatewayRateLimitHotspotSnapshotLimit,
      lookbackHours: env.gatewayRateLimitHotspotSnapshotLookbackHours,
    });
    markGatewayRateLimitHotspotSnapshot(healthState, {
      status: "success",
      snapshotId: result.snapshotId,
      rateLimitedRequestCount: result.rateLimitedRequestCount,
    });
    console.log(
      `[account-worker] gateway rate-limit hotspot snapshot persisted: snapshotId=${result.snapshotId}, rateLimitedRequests=${result.rateLimitedRequestCount}`,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway rate-limit hotspot snapshot failure";
    console.error("Account worker gateway rate-limit hotspot snapshot failed", error);
    markGatewayRateLimitHotspotSnapshot(healthState, {
      status: "error",
      error: message,
    });
  } finally {
    await releaseGatewayRateLimitHotspotSnapshotLock(lock).catch((error) => {
      console.error("Account worker gateway rate-limit hotspot snapshot lock release failed", error);
    });
    nextGatewayRateLimitHotspotSnapshotAt = Date.now() + env.gatewayRateLimitHotspotSnapshotIntervalMs;
  }
}

async function maybePersistGatewayRateLimitHotspotAnomalySnapshot(
  healthState: ReturnType<typeof createWorkerHealthState>,
) {
  if (!env.gatewayRateLimitHotspotAnomalySnapshotEnabled || Date.now() < nextGatewayRateLimitHotspotAnomalySnapshotAt) {
    return;
  }

  const operatorUserId = env.platformOperatorUserIds[0] ?? null;
  if (!operatorUserId) {
    const message = "gateway rate-limit hotspot anomaly snapshot skipped: missing PLATFORM_OPERATOR_USER_IDS";
    console.warn(`[account-worker] ${message}`);
    markGatewayRateLimitHotspotAnomalySnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayRateLimitHotspotAnomalySnapshotAt = Date.now() + env.gatewayRateLimitHotspotAnomalySnapshotIntervalMs;
    return;
  }

  let lock = null;
  try {
    lock = await acquireGatewayRateLimitHotspotAnomalySnapshotLock(
      env.gatewayRateLimitHotspotAnomalySnapshotLockKey,
      env.gatewayRateLimitHotspotAnomalySnapshotLockTtlMs,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "failed to acquire gateway rate-limit hotspot anomaly snapshot lock";
    console.error("Account worker gateway rate-limit hotspot anomaly snapshot lock acquisition failed", error);
    markGatewayRateLimitHotspotAnomalySnapshot(healthState, {
      status: "error",
      error: message,
    });
    nextGatewayRateLimitHotspotAnomalySnapshotAt = Date.now() + env.gatewayRateLimitHotspotAnomalySnapshotIntervalMs;
    return;
  }

  if (!lock) {
    markGatewayRateLimitHotspotAnomalySnapshotLockSkipped(
      healthState,
      `lock busy: ${env.gatewayRateLimitHotspotAnomalySnapshotLockKey}`,
    );
    nextGatewayRateLimitHotspotAnomalySnapshotAt = Date.now() + env.gatewayRateLimitHotspotAnomalySnapshotIntervalMs;
    return;
  }

  try {
    const result = await dispatchGatewayRateLimitHotspotAnomalySnapshot({
      actorUserId: operatorUserId,
      limit: env.gatewayRateLimitHotspotAnomalySnapshotLimit,
      lookbackHours: env.gatewayRateLimitHotspotAnomalySnapshotLookbackHours,
      profileKey: env.gatewayRateLimitHotspotAnomalySnapshotProfileKey,
    });
    let syncResult: Awaited<ReturnType<typeof syncGatewayRateLimitHotspotAnomalyIncidentsForOperator>> | null = null;
    let syncError: string | null = null;
    let openedIncidentCount = 0;
    let updatedIncidentCount = 0;
    let resolvedIncidentCount = 0;
    let deliveredCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    if (result.anomalyCount > 0) {
      try {
        syncResult = await syncGatewayRateLimitHotspotAnomalyIncidentsForOperator(
          operatorUserId,
          null,
          result.snapshotId,
        );
        openedIncidentCount = syncResult.openedIncidentIds.length;
        updatedIncidentCount = syncResult.updatedIncidentIds.length;
        resolvedIncidentCount = syncResult.resolvedIncidentIds.length;
      } catch (error) {
        syncError = extractErrorMessage(error) ?? "gateway rate-limit hotspot anomaly incident sync failed";
        console.error("Account worker gateway rate-limit hotspot anomaly incident sync failed", error);
      }
      const alertResult = await dispatchGatewayRateLimitHotspotAnomalyAlerts({
        snapshot: result.snapshot,
        operatorUserIds: env.platformOperatorUserIds,
      });
      deliveredCount = alertResult.deliveredCount;
      errorCount = alertResult.errorCount;
      skippedCount = alertResult.skippedCount;
      if (syncResult && alertResult.results.length > 0) {
        const incidentsByCode = new Map(
          syncResult.incidents
            .filter((incident) => incident.escalationStatus === "escalated")
            .map((incident) => [incident.code, incident] as const),
        );
        for (const delivery of alertResult.results) {
          if (!delivery.delivered) {
            continue;
          }
          const incident = incidentsByCode.get(delivery.code);
          if (!incident) {
            continue;
          }
          await recordGatewayAnalysisAnomalyIncidentAlertDispatchForOperator(operatorUserId, null, incident.id, {
            alertedAt: new Date(),
            alertLevel: delivery.alertLevel,
            alertSeverity: delivery.alertSeverity,
            mailboxRecipientCount: 1,
            webhookDispatched: true,
            note: `Rate-limit hotspot anomaly snapshot alert dispatched for snapshot ${result.snapshotId}.`,
          }).catch((error) => {
            console.error(
              `Account worker failed to backfill hotspot incident alert state for incident ${incident.id}`,
              error,
            );
          });
        }
      }
    }
    markGatewayRateLimitHotspotAnomalySnapshot(healthState, {
      status: syncError || errorCount > 0 ? "error" : "success",
      error:
        syncError ??
        (errorCount > 0 ? "gateway rate-limit hotspot anomaly snapshot alert dispatch completed with errors" : undefined),
      snapshotId: result.snapshotId,
      anomalyCount: result.anomalyCount,
      criticalCount: result.criticalCount,
      deliveredCount,
      errorCount,
      skippedCount,
    });
    console.log(
      `[account-worker] gateway rate-limit hotspot anomaly snapshot persisted: snapshotId=${result.snapshotId}, anomalies=${result.anomalyCount}, critical=${result.criticalCount}, incidents(opened=${openedIncidentCount}, updated=${updatedIncidentCount}, resolved=${resolvedIncidentCount}), delivered=${deliveredCount}, errors=${errorCount}, skipped=${skippedCount}`,
    );
  } catch (error) {
    const message = extractErrorMessage(error) ?? "unknown gateway rate-limit hotspot anomaly snapshot failure";
    console.error("Account worker gateway rate-limit hotspot anomaly snapshot failed", error);
    markGatewayRateLimitHotspotAnomalySnapshot(healthState, {
      status: "error",
      error: message,
      deliveredCount: 0,
      errorCount: 1,
      skippedCount: 0,
    });
  } finally {
    await releaseGatewayRateLimitHotspotAnomalySnapshotLock(lock).catch((error) => {
      console.error("Account worker gateway rate-limit hotspot anomaly snapshot lock release failed", error);
    });
    nextGatewayRateLimitHotspotAnomalySnapshotAt = Date.now() + env.gatewayRateLimitHotspotAnomalySnapshotIntervalMs;
  }
}

async function main() {
  const healthState = createWorkerHealthState();
  startWorkerHealthServer(env.healthPort, healthState);
  console.log(
    `Account worker started in outbox + product-shadow mode. Poll interval: ${env.pollIntervalMs}ms, shadow sync interval: ${env.productShadowSyncIntervalMs}ms, gateway anomaly sweep: ${
      env.gatewayAnomalySweepEnabled
        ? `${env.gatewayAnomalySweepIntervalMs}ms (lock ttl=${env.gatewayAnomalySweepLockTtlMs}ms)`
        : "disabled"
    }, gateway anomaly alerts: ${
      env.gatewayAnomalyAlertDispatchEnabled
        ? `${env.gatewayAnomalyAlertDispatchIntervalMs}ms (lock ttl=${env.gatewayAnomalyAlertDispatchLockTtlMs}ms)`
        : "disabled"
    }, gateway anomaly auto remediation: ${
      env.gatewayAnomalyAutoRemediationEnabled
        ? `${env.gatewayAnomalyAutoRemediationIntervalMs}ms (lock ttl=${env.gatewayAnomalyAutoRemediationLockTtlMs}ms)`
        : "disabled"
    }, gateway remediation impact capture: ${
      env.gatewayAnomalyRemediationImpactCaptureEnabled
        ? `${env.gatewayAnomalyRemediationImpactCaptureIntervalMs}ms (window=${env.gatewayAnomalyRemediationImpactCaptureWindowMinutes}m, lock ttl=${env.gatewayAnomalyRemediationImpactCaptureLockTtlMs}ms)`
        : "disabled"
    }, gateway remediation effectiveness snapshot: ${
      env.gatewayAnomalyRemediationEffectivenessSnapshotEnabled
        ? `${env.gatewayAnomalyRemediationEffectivenessSnapshotIntervalMs}ms (window=${env.gatewayAnomalyRemediationEffectivenessSnapshotWindowMinutes}m, lock ttl=${env.gatewayAnomalyRemediationEffectivenessSnapshotLockTtlMs}ms)`
        : "disabled"
    }, gateway remediation effectiveness anomaly snapshot: ${
      env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotEnabled
        ? `${env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotIntervalMs}ms (profile=${env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotProfileKey}, lock ttl=${env.gatewayAnomalyRemediationEffectivenessAnomalySnapshotLockTtlMs}ms)`
        : "disabled"
    }, gateway rate-limit hotspot snapshot: ${
      env.gatewayRateLimitHotspotSnapshotEnabled
        ? `${env.gatewayRateLimitHotspotSnapshotIntervalMs}ms (lookback=${env.gatewayRateLimitHotspotSnapshotLookbackHours}h, lock ttl=${env.gatewayRateLimitHotspotSnapshotLockTtlMs}ms)`
        : "disabled"
    }, gateway rate-limit hotspot anomaly snapshot: ${
      env.gatewayRateLimitHotspotAnomalySnapshotEnabled
        ? `${env.gatewayRateLimitHotspotAnomalySnapshotIntervalMs}ms (profile=${env.gatewayRateLimitHotspotAnomalySnapshotProfileKey}, lock ttl=${env.gatewayRateLimitHotspotAnomalySnapshotLockTtlMs}ms)`
        : "disabled"
    }. DB: ${
      env.usesDedicatedDatabase ? "account" : "shared"
    }, Redis: ${env.usesDedicatedRedis ? "account" : "shared"}.`,
  );

  while (true) {
    try {
      await cycle(healthState);
      const mailboxOpsDispatchResult = await dispatchMailboxOpsCampaigns();
      if (mailboxOpsDispatchResult.dueCount > 0) {
        console.log(
          `[account-worker] mailbox ops campaigns dispatched: due=${mailboxOpsDispatchResult.dueCount}, sent=${mailboxOpsDispatchResult.deliveredMessageCount}, failed=${mailboxOpsDispatchResult.failedCampaignCount}`,
        );
      }
      await maybeSyncProductShadow(healthState);
      await maybeSyncBenefitGrants();
      await maybeSweepCredentialPools();
      await maybeSweepGatewayAnomalyPolicies(healthState);
      await maybeDispatchGatewayAnomalyIncidentAlerts(healthState);
      await maybeDispatchGatewayAnomalyAutoRemediation(healthState);
      await maybeCaptureGatewayAnomalyRemediationImpact(healthState);
      await maybePersistGatewayAnomalyRemediationEffectivenessSnapshot(healthState);
      await maybePersistGatewayAnomalyRemediationEffectivenessAnomalySnapshot(healthState);
      await maybePersistGatewayRateLimitHotspotSnapshot(healthState);
      await maybePersistGatewayRateLimitHotspotAnomalySnapshot(healthState);
      markWorkerCycle(healthState, "success");
    } catch (error) {
      const message = extractErrorMessage(error) ?? "unknown account worker loop failure";
      console.error("Account worker cycle failed", error);
      markWorkerCycle(healthState, "error", message);
    }
    await new Promise((resolve) => setTimeout(resolve, env.pollIntervalMs));
  }
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
