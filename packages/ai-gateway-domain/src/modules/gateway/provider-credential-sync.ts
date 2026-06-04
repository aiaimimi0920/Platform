// ---------------------------------------------------------------------------
// Provider Credential Sync — caches provider account payloads in Redis for
// fast access, and provides sync functions for the main platform to push
// credential updates to the gateway's Redis.
// ---------------------------------------------------------------------------

import { redis } from "@/db/redis";
import type { GatewayProviderAccountPayload } from "@neuro/contracts";

// Redis key scheme
const PROVIDER_PAYLOAD_PREFIX = "gw:provider:payload:";

export function providerPayloadKey(providerAccountId: string) {
  return `${PROVIDER_PAYLOAD_PREFIX}${providerAccountId}`;
}

// Default TTL: 10 minutes. Provider credentials change rarely but we don't
// want stale data sitting forever.
const DEFAULT_TTL_SECONDS = 600;

// ---------------------------------------------------------------------------
// Cache Read
// ---------------------------------------------------------------------------

/**
 * Reads a provider account payload from Redis cache.
 * Returns null on cache miss.
 */
export async function getCachedProviderPayload(
  providerAccountId: string,
): Promise<GatewayProviderAccountPayload | null> {
  const raw = await redis.get(providerPayloadKey(providerAccountId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as GatewayProviderAccountPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache Write
// ---------------------------------------------------------------------------

/**
 * Caches a provider account payload in Redis.
 * Called after reading from DB (cache-aside pattern) or when the main
 * platform pushes a credential update.
 */
export async function setCachedProviderPayload(
  providerAccountId: string,
  payload: GatewayProviderAccountPayload,
  ttlSeconds?: number,
): Promise<void> {
  const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
  await redis.set(
    providerPayloadKey(providerAccountId),
    JSON.stringify(payload),
    "EX",
    ttl,
  );
}

/**
 * Removes a provider account payload from Redis cache.
 * Called when a provider account is deactivated or deleted.
 */
export async function deleteCachedProviderPayload(
  providerAccountId: string,
): Promise<void> {
  await redis.del(providerPayloadKey(providerAccountId));
}

// ---------------------------------------------------------------------------
// Batch Sync
// ---------------------------------------------------------------------------

/**
 * Syncs multiple provider account payloads to Redis in a single pipeline.
 * Called by the main platform to push all provider credentials to the
 * gateway's Redis during startup or after bulk updates.
 */
export async function syncProviderPayloadsBatch(
  entries: Array<{
    providerAccountId: string;
    payload: GatewayProviderAccountPayload;
    ttlSeconds?: number;
  }>,
): Promise<{ synced: number }> {
  if (entries.length === 0) {
    return { synced: 0 };
  }

  const pipeline = redis.pipeline();
  for (const entry of entries) {
    const key = providerPayloadKey(entry.providerAccountId);
    const ttl = entry.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    pipeline.set(key, JSON.stringify(entry.payload), "EX", ttl);
  }
  await pipeline.exec();

  return { synced: entries.length };
}

/**
 * Invalidates all cached provider payloads matching a pattern.
 * Useful for bulk invalidation after major credential rotations.
 */
export async function invalidateCachedProviderPayloads(): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${PROVIDER_PAYLOAD_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== "0");

  return deleted;
}
