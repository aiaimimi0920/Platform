import { createHash } from "node:crypto";

import { redis } from "@/db/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GatewayResponseCacheConfig = {
  enabled: boolean;
  defaultTtlSeconds: number; // default: 300 (5 min)
  maxTtlSeconds: number; // cap: 3600 (1 hour)
  maxEntrySizeBytes: number; // max cached response size, default 512KB
};

export type GatewayResponseCacheEntry = {
  key: string;
  model: string;
  responseBody: string; // serialized response
  contentType: string;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  cachedAt: string; // ISO timestamp
  ttlSeconds: number;
  hits: number;
};

export type GatewayResponseCacheResult =
  | { hit: true; entry: GatewayResponseCacheEntry }
  | { hit: false };

export type GatewayResponseCacheScope = {
  projectId: string;
  routePolicyId?: string | null;
  routePolicyUpdatedAt?: string | null;
  endpointKind?: string | null;
  providerAccountId: string;
  protocolFamily?: string | null;
  modelAlias?: string | null;
  upstreamModel?: string | null;
  resolvedModel?: string | null;
  credentialRef?: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY_PREFIX = "gw:rcache:";

// Endpoint-specific TTL overrides (in seconds)
const ENDPOINT_TTL_OVERRIDES: Record<string, number> = {
  // Chat/completion endpoints: 5 minutes (default)
  responses: 300,
  chat_completions: 300,
  messages: 300,

  // Search/fetch endpoints: shorter TTL (1-2 minutes)
  search: 90,
  fetch: 90,
  research_create: 120,
  research_list: 120,
  research_get: 120,

  // Balance/credits endpoints: longer TTL (10-15 minutes)
  credits_balance: 900,

  // Media generation endpoints: moderate TTL (3-5 minutes)
  music_generations: 240,
  videos_generations: 240,
};

// ---------------------------------------------------------------------------
// TTL resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the appropriate TTL for a given endpoint kind.
 * Falls back to the default TTL if no override is configured.
 */
export function resolveEndpointTtl(
  endpointKind: string | null | undefined,
  defaultTtl: number,
): number {
  if (!endpointKind) {
    return defaultTtl;
  }
  return ENDPOINT_TTL_OVERRIDES[endpointKind] ?? defaultTtl;
}

// ---------------------------------------------------------------------------
// Cache key generation
// ---------------------------------------------------------------------------

export function buildResponseCacheKey(args: {
  model: string;
  messages: unknown;
  temperature?: number;
  maxTokens?: number;
  tools?: unknown;
  scope: GatewayResponseCacheScope;
}): string {
  const payload = JSON.stringify({
    scope: {
      projectId: args.scope.projectId,
      routePolicyId: args.scope.routePolicyId ?? null,
      routePolicyUpdatedAt: args.scope.routePolicyUpdatedAt ?? null,
      endpointKind: args.scope.endpointKind ?? null,
      providerAccountId: args.scope.providerAccountId,
      protocolFamily: args.scope.protocolFamily ?? null,
      modelAlias: args.scope.modelAlias ?? null,
      upstreamModel: args.scope.upstreamModel ?? null,
      resolvedModel: args.scope.resolvedModel ?? null,
      credentialRef: args.scope.credentialRef ?? null,
    },
    model: args.model,
    messages: args.messages,
    temperature: args.temperature ?? null,
    maxTokens: args.maxTokens ?? null,
    tools: args.tools ?? null,
  });

  const hash = createHash("sha256").update(payload).digest("hex");
  return `${CACHE_KEY_PREFIX}${hash}`;
}

// ---------------------------------------------------------------------------
// Read cached response
// ---------------------------------------------------------------------------

export async function getGatewayCachedResponse(
  cacheKey: string,
): Promise<GatewayResponseCacheResult> {
  const data = await redis.hgetall(cacheKey);

  if (!data || Object.keys(data).length === 0) {
    return { hit: false };
  }

  await redis.hincrby(cacheKey, "hits", 1);

  const entry: GatewayResponseCacheEntry = {
    key: cacheKey,
    model: data.model ?? "",
    responseBody: data.responseBody ?? "",
    contentType: data.contentType ?? "",
    tokenUsage: data.tokenUsage ? (JSON.parse(data.tokenUsage) as GatewayResponseCacheEntry["tokenUsage"]) : null,
    cachedAt: data.cachedAt ?? "",
    ttlSeconds: Number(data.ttlSeconds ?? 0),
    hits: Number(data.hits ?? 0) + 1, // reflect the increment we just did
  };

  return { hit: true, entry };
}

// ---------------------------------------------------------------------------
// Write cached response
// ---------------------------------------------------------------------------

export async function setGatewayCachedResponse(args: {
  cacheKey: string;
  model: string;
  responseBody: string;
  contentType: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  ttlSeconds?: number;
  endpointKind?: string | null;
  config: GatewayResponseCacheConfig;
}): Promise<boolean> {
  if (!args.config.enabled) {
    return false;
  }

  // Enforce max entry size
  const entrySize = Buffer.byteLength(args.responseBody, "utf8");
  if (entrySize > args.config.maxEntrySizeBytes) {
    return false;
  }

  // Resolve TTL: explicit > endpoint-specific > default
  const requestedTtl =
    args.ttlSeconds ?? resolveEndpointTtl(args.endpointKind, args.config.defaultTtlSeconds);
  const ttl = Math.min(requestedTtl, args.config.maxTtlSeconds);

  if (ttl <= 0) {
    return false;
  }

  const fields: Record<string, string> = {
    model: args.model,
    responseBody: args.responseBody,
    contentType: args.contentType,
    tokenUsage: args.tokenUsage ? JSON.stringify(args.tokenUsage) : "",
    cachedAt: new Date().toISOString(),
    ttlSeconds: String(ttl),
    hits: "0",
  };

  await redis.hset(args.cacheKey, fields);
  await redis.expire(args.cacheKey, ttl);

  return true;
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

export async function invalidateGatewayResponseCache(
  pattern?: string,
): Promise<number> {
  const scanPattern = pattern ?? `${CACHE_KEY_PREFIX}*`;
  let deleted = 0;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      Number(cursor),
      "MATCH",
      scanPattern,
      "COUNT",
      100,
    );
    cursor = String(nextCursor);

    if (keys.length > 0) {
      const result = await redis.del(...keys);
      deleted += result;
    }
  } while (cursor !== "0");

  return deleted;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getGatewayResponseCacheStats(): Promise<{
  totalKeys: number;
  totalHits: number;
  estimatedSizeBytes: number;
}> {
  const scanPattern = `${CACHE_KEY_PREFIX}*`;
  let totalKeys = 0;
  let totalHits = 0;
  let estimatedSizeBytes = 0;
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      Number(cursor),
      "MATCH",
      scanPattern,
      "COUNT",
      100,
    );
    cursor = String(nextCursor);

    for (const key of keys) {
      totalKeys += 1;

      const [hits, responseBody] = await Promise.all([
        redis.hget(key, "hits"),
        redis.hget(key, "responseBody"),
      ]);

      totalHits += Number(hits ?? 0);
      estimatedSizeBytes += Buffer.byteLength(responseBody ?? "", "utf8");
    }
  } while (cursor !== "0");

  return { totalKeys, totalHits, estimatedSizeBytes };
}
