import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/redis";

const releaseLockScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export type GatewayWorkerLockHandle = {
  key: string;
  token: string;
};

export async function acquireGatewayWorkerLock(lockKey: string, ttlMs: number) {
  const redis = getRedisClient();
  const token = randomUUID();
  const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
  if (result !== "OK") {
    return null;
  }
  return {
    key: lockKey,
    token,
  } satisfies GatewayWorkerLockHandle;
}

export async function releaseGatewayWorkerLock(lock: GatewayWorkerLockHandle) {
  const redis = getRedisClient();
  await redis.eval(releaseLockScript, 1, lock.key, lock.token);
}

export async function acquireGatewayAnomalySweepLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalySweepLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayAnomalyAlertDispatchLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalyAlertDispatchLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayAnomalyAutoRemediationLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalyAutoRemediationLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayAnomalyRemediationImpactCaptureLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalyRemediationImpactCaptureLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayAnomalyRemediationEffectivenessSnapshotLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalyRemediationEffectivenessSnapshotLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayAnomalyRemediationEffectivenessAnomalySnapshotLock(
  lock: GatewayWorkerLockHandle,
) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayRateLimitHotspotSnapshotLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayRateLimitHotspotSnapshotLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}

export async function acquireGatewayRateLimitHotspotAnomalySnapshotLock(lockKey: string, ttlMs: number) {
  return acquireGatewayWorkerLock(lockKey, ttlMs);
}

export async function releaseGatewayRateLimitHotspotAnomalySnapshotLock(lock: GatewayWorkerLockHandle) {
  return releaseGatewayWorkerLock(lock);
}
