// ---------------------------------------------------------------------------
// Provider Credential Manager — unified API for managing provider credentials
// with optimized storage, active cache invalidation, and health checking
// ---------------------------------------------------------------------------

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { eq } from "drizzle-orm";
import type { GatewayProviderAccountPayload } from "@neuro/contracts";
import { ConflictError, NotFoundError } from "@neuro/backend-foundation/platform/errors";
import { gatewayProviderAccounts } from "./schema";
import { readGatewayObject, putGatewayObject, deleteGatewayObject } from "./object-storage";
import {
  getCachedProviderPayload,
  setCachedProviderPayload,
  deleteCachedProviderPayload,
  providerPayloadKey,
} from "./provider-credential-sync";

// ---------------------------------------------------------------------------
// Storage Mode Selection (Optimized)
// ---------------------------------------------------------------------------

/**
 * Chooses storage mode based on payload size and structure.
 *
 * Optimization changes from original:
 * - Threshold increased from 600 bytes to 4KB (PostgreSQL JSONB performance inflection point)
 * - Allows small nested objects (like {keys: ["sk-1", "sk-2"]}) to use inline storage
 * - Only large arrays (50+ elements) trigger R2 storage
 */
export function chooseStorageMode(payload: GatewayProviderAccountPayload): "inline" | "r2" {
  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, "utf8");

  // Threshold: 4KB (PostgreSQL JSONB performance inflection point)
  if (sizeBytes > 4096) {
    return "r2";
  }

  // Check for large arrays (50+ elements)
  const hasLargeArray = Object.values(payload).some(
    (value) => Array.isArray(value) && value.length > 50,
  );
  if (hasLargeArray) {
    return "r2";
  }

  // Default: inline (includes small nested objects)
  return "inline";
}

// ---------------------------------------------------------------------------
// Cache TTL Configuration
// ---------------------------------------------------------------------------

const DEFAULT_TTL_SECONDS = 1800; // 30 minutes (increased from 10 minutes)
const HOT_CREDENTIAL_TTL_SECONDS = 3600; // 60 minutes for frequently accessed credentials
const COLD_CREDENTIAL_TTL_SECONDS = 600; // 10 minutes for rarely accessed credentials

// ---------------------------------------------------------------------------
// Core CRUD Operations
// ---------------------------------------------------------------------------

export type CreateProviderCredentialInput = {
  providerAccountId: string;
  credential: GatewayProviderAccountPayload;
  cacheTtlSeconds?: number;
  preWarm?: boolean;
};

export type CreateProviderCredentialResult = {
  success: true;
  providerAccountId: string;
  credentialId: string;
  cached: boolean;
  message: string;
};

/**
 * Creates a new provider credential with optimized storage and optional cache pre-warming.
 */
export async function createProviderCredential(
  input: CreateProviderCredentialInput,
): Promise<CreateProviderCredentialResult> {
  const { providerAccountId, credential, cacheTtlSeconds, preWarm = false } = input;

  try {
    // Check if provider account exists
    const [existing] = await db
      .select({ id: gatewayProviderAccounts.id })
      .from(gatewayProviderAccounts)
      .where(eq(gatewayProviderAccounts.id, providerAccountId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError(`Provider account ${providerAccountId} not found`);
    }

    // Choose storage mode
    const storageMode = chooseStorageMode(credential);

    let payloadInline: GatewayProviderAccountPayload | null = null;
    let payloadObjectKey: string | null = null;

    if (storageMode === "inline") {
      payloadInline = credential;
    } else {
      // Store in R2
      payloadObjectKey = `provider-credentials/${providerAccountId}/${Date.now()}.json`;
      await putGatewayObject(payloadObjectKey, Buffer.from(JSON.stringify(credential), "utf8"), "application/json");
    }

    // Update database
    await db
      .update(gatewayProviderAccounts)
      .set({
        payloadInline,
        payloadObjectKey,
        storageMode,
        updatedAt: new Date(),
      })
      .where(eq(gatewayProviderAccounts.id, providerAccountId));

    // Pre-warm cache if requested
    let cached = false;
    if (preWarm) {
      const ttl = cacheTtlSeconds ?? DEFAULT_TTL_SECONDS;
      await setCachedProviderPayload(providerAccountId, credential, ttl).catch(() => {
        // Cache warming failure is non-critical, log but don't fail the operation
        cached = false;
      });
      cached = true;
    }

    return {
      success: true,
      providerAccountId,
      credentialId: providerAccountId,
      cached,
      message: cached
        ? "Provider 凭证已创建并预热到缓存"
        : "Provider 凭证已创建",
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    throw new Error(
      `Failed to create provider credential: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export type UpdateProviderCredentialInput = {
  providerAccountId: string;
  credential: GatewayProviderAccountPayload;
  cacheTtlSeconds?: number;
  preWarm?: boolean;
};

export type UpdateProviderCredentialResult = {
  success: true;
  providerAccountId: string;
  cacheInvalidated: boolean;
  message: string;
};

/**
 * Updates a provider credential with automatic cache invalidation.
 * This solves the pain point: "Provider凭证更新后，网关没有及时生效"
 */
export async function updateProviderCredential(
  input: UpdateProviderCredentialInput,
): Promise<UpdateProviderCredentialResult> {
  const { providerAccountId, credential, cacheTtlSeconds, preWarm = false } = input;

  // Check if provider account exists
  const [existing] = await db
    .select({
      id: gatewayProviderAccounts.id,
      payloadObjectKey: gatewayProviderAccounts.payloadObjectKey,
    })
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Provider account ${providerAccountId} not found`);
  }

  // Choose storage mode
  const storageMode = chooseStorageMode(credential);

  let payloadInline: GatewayProviderAccountPayload | null = null;
  let payloadObjectKey: string | null = null;

  if (storageMode === "inline") {
    payloadInline = credential;
    // Delete old R2 object if exists
    if (existing.payloadObjectKey) {
      await deleteGatewayObject(existing.payloadObjectKey).catch(() => undefined);
    }
  } else {
    // Store in R2
    payloadObjectKey = `provider-credentials/${providerAccountId}/${Date.now()}.json`;
    await putGatewayObject(payloadObjectKey, Buffer.from(JSON.stringify(credential), "utf8"), "application/json");
    // Delete old R2 object if exists
    if (existing.payloadObjectKey && existing.payloadObjectKey !== payloadObjectKey) {
      await deleteGatewayObject(existing.payloadObjectKey).catch(() => undefined);
    }
  }

  // Update database
  await db
    .update(gatewayProviderAccounts)
    .set({
      payloadInline,
      payloadObjectKey,
      storageMode,
      updatedAt: new Date(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId));

  // CRITICAL: Invalidate cache immediately to ensure updates take effect
  await deleteCachedProviderPayload(providerAccountId);

  // Pre-warm cache with new credential if requested
  if (preWarm) {
    const ttl = cacheTtlSeconds ?? DEFAULT_TTL_SECONDS;
    await setCachedProviderPayload(providerAccountId, credential, ttl);
  }

  return {
    success: true,
    providerAccountId,
    cacheInvalidated: true,
    message: "Provider 凭证已更新，缓存已失效",
  };
}

export type DeleteProviderCredentialResult = {
  success: true;
  providerAccountId: string;
  cacheInvalidated: boolean;
  objectDeleted: boolean;
  message: string;
};

/**
 * Deletes a provider credential with automatic cache invalidation and R2 cleanup.
 */
export async function deleteProviderCredential(
  providerAccountId: string,
): Promise<DeleteProviderCredentialResult> {
  // Check if provider account exists
  const [existing] = await db
    .select({
      id: gatewayProviderAccounts.id,
      payloadObjectKey: gatewayProviderAccounts.payloadObjectKey,
    })
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`Provider account ${providerAccountId} not found`);
  }

  let objectDeleted = false;

  // Delete R2 object if exists
  if (existing.payloadObjectKey) {
    await deleteGatewayObject(existing.payloadObjectKey).catch(() => undefined);
    objectDeleted = true;
  }

  // Clear payload in database
  await db
    .update(gatewayProviderAccounts)
    .set({
      payloadInline: null,
      payloadObjectKey: null,
      updatedAt: new Date(),
    })
    .where(eq(gatewayProviderAccounts.id, providerAccountId));

  // Invalidate cache
  await deleteCachedProviderPayload(providerAccountId);

  return {
    success: true,
    providerAccountId,
    cacheInvalidated: true,
    objectDeleted,
    message: "Provider 凭证已删除",
  };
}

export type GetProviderCredentialOptions = {
  maskSecrets?: boolean;
};

export type GetProviderCredentialResult = {
  providerAccountId: string;
  credential: GatewayProviderAccountPayload;
  storageMode: "inline" | "r2";
  cached: boolean;
  cacheExpiresAt: string | null;
  updatedAt: string;
};

/**
 * Retrieves a provider credential with optional secret masking.
 */
export async function getProviderCredential(
  providerAccountId: string,
  options?: GetProviderCredentialOptions,
): Promise<GetProviderCredentialResult> {
  const { maskSecrets = true } = options ?? {};

  // Check cache first
  const cached = await getCachedProviderPayload(providerAccountId);
  const isCached = cached !== null;

  // Read from database
  const [row] = await db
    .select({
      payloadInline: gatewayProviderAccounts.payloadInline,
      payloadObjectKey: gatewayProviderAccounts.payloadObjectKey,
      storageMode: gatewayProviderAccounts.storageMode,
      updatedAt: gatewayProviderAccounts.updatedAt,
    })
    .from(gatewayProviderAccounts)
    .where(eq(gatewayProviderAccounts.id, providerAccountId))
    .limit(1);

  if (!row) {
    throw new NotFoundError(`Provider account ${providerAccountId} not found`);
  }

  let credential: GatewayProviderAccountPayload;

  if (cached) {
    credential = cached;
  } else if (row.payloadInline && typeof row.payloadInline === "object") {
    credential = row.payloadInline as GatewayProviderAccountPayload;
  } else if (row.payloadObjectKey) {
    const buffer = await readGatewayObject(row.payloadObjectKey);
    credential = JSON.parse(buffer.toString("utf8")) as GatewayProviderAccountPayload;
  } else {
    throw new ConflictError("Provider account payload 缺失");
  }

  // Mask secrets if requested
  if (maskSecrets) {
    credential = maskProviderCredentialSecrets(credential);
  }

  // Get cache TTL if cached
  let cacheExpiresAt: string | null = null;
  if (isCached) {
    try {
      const ttl = await redis.ttl(providerPayloadKey(providerAccountId));
      if (ttl > 0) {
        const expiresAt = new Date(Date.now() + ttl * 1000);
        cacheExpiresAt = expiresAt.toISOString();
      }
    } catch {
      // Ignore TTL fetch errors
    }
  }

  return {
    providerAccountId,
    credential,
    storageMode: row.storageMode as "inline" | "r2",
    cached: isCached,
    cacheExpiresAt,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

export type InvalidateCacheInput = {
  providerAccountIds?: string[];
  pattern?: string;
};

export type InvalidateCacheResult = {
  success: true;
  invalidated: number;
  message: string;
};

/**
 * Invalidates provider credential cache entries.
 */
export async function invalidateProviderCredentialCache(
  input: InvalidateCacheInput,
): Promise<InvalidateCacheResult> {
  const { providerAccountIds, pattern } = input;

  let invalidated = 0;

  if (providerAccountIds && providerAccountIds.length > 0) {
    // Invalidate specific providers
    for (const id of providerAccountIds) {
      await deleteCachedProviderPayload(id);
      invalidated++;
    }
  } else if (pattern) {
    // Invalidate by pattern (advanced usage)
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        invalidated += keys.length;
      }
    } while (cursor !== "0");
  } else {
    // Invalidate all provider credentials
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        "gw:provider:payload:*",
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        invalidated += keys.length;
      }
    } while (cursor !== "0");
  }

  return {
    success: true,
    invalidated,
    message: `已失效 ${invalidated} 个 Provider 凭证缓存`,
  };
}

export type WarmupCacheInput = {
  providerAccountIds?: string[];
  ttlSeconds?: number;
};

export type WarmupCacheResult = {
  success: true;
  warmed: number;
  failed: number;
  message: string;
};

/**
 * Pre-warms provider credential cache entries.
 */
export async function warmupProviderCredentialCache(
  input: WarmupCacheInput,
): Promise<WarmupCacheResult> {
  const { providerAccountIds, ttlSeconds = DEFAULT_TTL_SECONDS } = input;

  let warmed = 0;
  let failed = 0;

  let targetIds: string[];

  if (providerAccountIds && providerAccountIds.length > 0) {
    targetIds = providerAccountIds;
  } else {
    // Warm up all active providers
    const rows = await db
      .select({ id: gatewayProviderAccounts.id })
      .from(gatewayProviderAccounts)
      .where(eq(gatewayProviderAccounts.status, "active"));
    targetIds = rows.map((r) => r.id);
  }

  for (const id of targetIds) {
    try {
      const result = await getProviderCredential(id, { maskSecrets: false });
      await setCachedProviderPayload(id, result.credential, ttlSeconds);
      warmed++;
    } catch {
      failed++;
    }
  }

  return {
    success: true,
    warmed,
    failed,
    message: `已预热 ${warmed} 个 Provider 凭证到缓存`,
  };
}

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------

export type BatchOperation = {
  action: "create" | "update" | "delete";
  providerAccountId: string;
  credential?: GatewayProviderAccountPayload;
};

export type BatchOperationResult = {
  providerAccountId: string;
  action: "create" | "update" | "delete";
  success: boolean;
  error?: string;
};

export type BatchOperationsInput = {
  operations: BatchOperation[];
  invalidateAllCache?: boolean;
  preWarmAll?: boolean;
};

export type BatchOperationsResult = {
  success: true;
  results: BatchOperationResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    cacheInvalidated: number;
    preWarmed: number;
  };
};

/**
 * Executes batch operations on provider credentials.
 * This solves the pain point: "我们需要一个批量增加/删除Provider凭证的接口"
 */
export async function batchProviderCredentialOperations(
  input: BatchOperationsInput,
): Promise<BatchOperationsResult> {
  const { operations, invalidateAllCache = false, preWarmAll = false } = input;

  const results: BatchOperationResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Execute operations sequentially to maintain consistency
  for (const op of operations) {
    try {
      switch (op.action) {
        case "create":
          if (!op.credential) {
            throw new Error("Credential is required for create action");
          }
          await createProviderCredential({
            providerAccountId: op.providerAccountId,
            credential: op.credential,
            preWarm: false, // Will pre-warm in batch later if requested
          });
          results.push({
            providerAccountId: op.providerAccountId,
            action: "create",
            success: true,
          });
          succeeded++;
          break;

        case "update":
          if (!op.credential) {
            throw new Error("Credential is required for update action");
          }
          await updateProviderCredential({
            providerAccountId: op.providerAccountId,
            credential: op.credential,
            preWarm: false, // Will pre-warm in batch later if requested
          });
          results.push({
            providerAccountId: op.providerAccountId,
            action: "update",
            success: true,
          });
          succeeded++;
          break;

        case "delete":
          await deleteProviderCredential(op.providerAccountId);
          results.push({
            providerAccountId: op.providerAccountId,
            action: "delete",
            success: true,
          });
          succeeded++;
          break;

        default:
          throw new Error(`Unknown action: ${op.action}`);
      }
    } catch (error) {
      results.push({
        providerAccountId: op.providerAccountId,
        action: op.action,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }

  // Invalidate all cache if requested
  let cacheInvalidated = 0;
  if (invalidateAllCache) {
    const invalidateResult = await invalidateProviderCredentialCache({});
    cacheInvalidated = invalidateResult.invalidated;
  }

  // Pre-warm all successful operations if requested
  let preWarmed = 0;
  if (preWarmAll) {
    const successfulIds = results
      .filter((r) => r.success && r.action !== "delete")
      .map((r) => r.providerAccountId);
    if (successfulIds.length > 0) {
      const warmupResult = await warmupProviderCredentialCache({
        providerAccountIds: successfulIds,
      });
      preWarmed = warmupResult.warmed;
    }
  }

  return {
    success: true,
    results,
    summary: {
      total: operations.length,
      succeeded,
      failed,
      cacheInvalidated,
      preWarmed,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Masks sensitive fields in provider credentials for safe display.
 */
function maskProviderCredentialSecrets(
  credential: GatewayProviderAccountPayload,
): GatewayProviderAccountPayload {
  const masked = { ...credential };

  // Mask common secret fields
  if ("apiKey" in masked && typeof masked.apiKey === "string") {
    masked.apiKey = maskSecretValue(masked.apiKey);
  }
  if ("authToken" in masked && typeof masked.authToken === "string") {
    masked.authToken = maskSecretValue(masked.authToken);
  }
  if ("accessToken" in masked && typeof masked.accessToken === "string") {
    masked.accessToken = maskSecretValue(masked.accessToken);
  }
  if ("refreshToken" in masked && typeof masked.refreshToken === "string") {
    masked.refreshToken = maskSecretValue(masked.refreshToken);
  }
  if ("sessionToken" in masked && typeof masked.sessionToken === "string") {
    masked.sessionToken = maskSecretValue(masked.sessionToken);
  }

  // Mask keys array
  if ("keys" in masked && Array.isArray(masked.keys)) {
    masked.keys = masked.keys.map((key) =>
      typeof key === "string" ? maskSecretValue(key) : key,
    );
  }

  // Mask headers
  if ("headers" in masked && typeof masked.headers === "object" && masked.headers !== null) {
    const headers = masked.headers as Record<string, string>;
    const maskedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("auth") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("secret")
      ) {
        maskedHeaders[key] = maskSecretValue(value);
      } else {
        maskedHeaders[key] = value;
      }
    }
    masked.headers = maskedHeaders;
  }

  return masked;
}

/**
 * Masks a secret value, showing only first 3 and last 3 characters.
 */
function maskSecretValue(value: string): string {
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
