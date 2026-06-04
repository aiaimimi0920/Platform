import { redis } from "@/db/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GatewayCredentialKind =
  | "user-owned"
  | "platform-unlimited"
  | "platform-limited"
  | "account-credential";

export type GatewayCredentialEntry = {
  id: string;
  kind: GatewayCredentialKind;
  projectId: string;
  userId: string;
  provider: string;

  // Credential payload
  apiKey?: string;
  apiBaseUrl?: string;
  headers?: Record<string, string>;
  accountPayload?: Record<string, unknown>;

  // Quota (platform-limited only)
  quotaTotalTokens?: number;
  quotaRemainingTokens?: number;

  // Metadata
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = "gw:cred:";
const PROJECT_INDEX_PREFIX = "gw:cred:proj:";
const USER_INDEX_PREFIX = "gw:cred:user:";

function credentialKey(credentialId: string): string {
  return `${KEY_PREFIX}${credentialId}`;
}

function projectIndexKey(projectId: string): string {
  return `${PROJECT_INDEX_PREFIX}${projectId}`;
}

function userIndexKey(userId: string): string {
  return `${USER_INDEX_PREFIX}${userId}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeTtlSeconds(expiresAt: string | undefined): number | null {
  if (!expiresAt) {
    return null;
  }
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = Date.now();
  const ttlSeconds = Math.floor((expiresMs - nowMs) / 1000);
  return ttlSeconds > 0 ? ttlSeconds : null;
}

function serialize(entry: GatewayCredentialEntry): string {
  return JSON.stringify(entry);
}

function deserialize(raw: string): GatewayCredentialEntry {
  return JSON.parse(raw) as GatewayCredentialEntry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read a single credential by its reference ID. */
export async function getGatewayCredential(
  credentialId: string,
): Promise<GatewayCredentialEntry | null> {
  const raw = await redis.get(credentialKey(credentialId));
  if (!raw) {
    return null;
  }
  return deserialize(raw);
}

/**
 * Write a credential to Redis (called when the main platform pushes).
 * Also maintains secondary indexes by project and user.
 */
export async function setGatewayCredential(
  entry: GatewayCredentialEntry,
): Promise<void> {
  const key = credentialKey(entry.id);
  const ttl = computeTtlSeconds(entry.expiresAt);

  const pipeline = redis.pipeline();

  if (ttl !== null) {
    pipeline.set(key, serialize(entry), "EX", ttl);
  } else {
    pipeline.set(key, serialize(entry));
  }

  // Add credential ID to project and user set indexes
  pipeline.sadd(projectIndexKey(entry.projectId), entry.id);
  pipeline.sadd(userIndexKey(entry.userId), entry.id);

  await pipeline.exec();
}

/** Remove a credential from Redis and clean up index references. */
export async function deleteGatewayCredential(
  credentialId: string,
): Promise<void> {
  // Fetch the entry first so we can remove index references
  const existing = await getGatewayCredential(credentialId);

  const pipeline = redis.pipeline();
  pipeline.del(credentialKey(credentialId));

  if (existing) {
    pipeline.srem(projectIndexKey(existing.projectId), credentialId);
    pipeline.srem(userIndexKey(existing.userId), credentialId);
  }

  await pipeline.exec();
}

/** List all credentials belonging to a gateway project. */
export async function listGatewayCredentialsByProject(
  projectId: string,
): Promise<GatewayCredentialEntry[]> {
  const ids = await redis.smembers(projectIndexKey(projectId));
  if (ids.length === 0) {
    return [];
  }

  const keys = ids.map(credentialKey);
  const rawValues = await redis.mget(...keys);

  const entries: GatewayCredentialEntry[] = [];
  const staleIds: string[] = [];

  for (let i = 0; i < rawValues.length; i++) {
    const raw = rawValues[i];
    if (raw) {
      entries.push(deserialize(raw));
    } else {
      // The credential key has expired or been deleted; mark for index cleanup
      staleIds.push(ids[i]);
    }
  }

  // Lazily clean up stale index references
  if (staleIds.length > 0) {
    await redis.srem(projectIndexKey(projectId), ...staleIds);
  }

  return entries;
}

/** List all credentials belonging to a user. */
export async function listGatewayCredentialsByUser(
  userId: string,
): Promise<GatewayCredentialEntry[]> {
  const ids = await redis.smembers(userIndexKey(userId));
  if (ids.length === 0) {
    return [];
  }

  const keys = ids.map(credentialKey);
  const rawValues = await redis.mget(...keys);

  const entries: GatewayCredentialEntry[] = [];
  const staleIds: string[] = [];

  for (let i = 0; i < rawValues.length; i++) {
    const raw = rawValues[i];
    if (raw) {
      entries.push(deserialize(raw));
    } else {
      staleIds.push(ids[i]);
    }
  }

  if (staleIds.length > 0) {
    await redis.srem(userIndexKey(userId), ...staleIds);
  }

  return entries;
}

/**
 * Smart credential resolution for an incoming gateway request.
 *
 * Resolution strategy:
 * 1. If `preferredCredentialId` is given, fetch it directly and verify it
 *    belongs to the requested project/user. Return it if valid.
 * 2. Otherwise, enumerate the project's credentials and find the best match
 *    for the user + provider combination.
 *
 * Priority order (when multiple credentials match):
 *   user-owned > account-credential > platform-unlimited > platform-limited
 *
 * For `platform-limited` credentials, those with remaining quota are preferred
 * over those without.
 */
export async function resolveGatewayCredentialForRequest(args: {
  projectId: string;
  userId: string;
  provider?: string;
  preferredCredentialId?: string;
}): Promise<GatewayCredentialEntry | null> {
  // Fast path: preferred credential
  if (args.preferredCredentialId) {
    const entry = await getGatewayCredential(args.preferredCredentialId);
    if (
      entry &&
      entry.projectId === args.projectId &&
      entry.userId === args.userId
    ) {
      // If provider filter is given, verify it matches
      if (args.provider && entry.provider !== args.provider) {
        return null;
      }
      return entry;
    }
    // preferred credential not found or does not match -- fall through
  }

  // Enumerate credentials for the project
  const all = await listGatewayCredentialsByProject(args.projectId);

  // Filter to user + optional provider
  const candidates = all.filter((entry) => {
    if (entry.userId !== args.userId) {
      return false;
    }
    if (args.provider && entry.provider !== args.provider) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Rank by kind priority
  const kindPriority: Record<GatewayCredentialKind, number> = {
    "user-owned": 0,
    "account-credential": 1,
    "platform-unlimited": 2,
    "platform-limited": 3,
  };

  candidates.sort((a, b) => {
    const pa = kindPriority[a.kind];
    const pb = kindPriority[b.kind];
    if (pa !== pb) {
      return pa - pb;
    }

    // For platform-limited, prefer credentials with remaining quota
    if (a.kind === "platform-limited" && b.kind === "platform-limited") {
      const ra = a.quotaRemainingTokens ?? 0;
      const rb = b.quotaRemainingTokens ?? 0;
      return rb - ra; // higher remaining quota first
    }

    return 0;
  });

  return candidates[0];
}
