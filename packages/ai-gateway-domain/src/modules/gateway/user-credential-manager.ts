// ---------------------------------------------------------------------------
// User Credential Manager — manages user credentials issued after purchase
// ---------------------------------------------------------------------------

import { db } from "@/db/client";
import { redis } from "@/db/redis";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NotFoundError } from "@neuro/backend-foundation/platform/errors";
import { gatewayUserCredentials, gatewayProjects } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueUserCredentialInput = {
  userId: string;
  credentialType: "unlimited_refill" | "pay_per_use";
  durationDays: number;
  scope: string[];
  metadata?: {
    orderId?: string;
    productName?: string;
    [key: string]: unknown;
  };
};

export type IssueUserCredentialResult = {
  success: true;
  credential: {
    id: string;
    credentialKey: string;
    expiresAt: string;
    scope: string[];
  };
  message: string;
};

export type VerifyUserCredentialInput = {
  credentialKey: string;
  scope?: string;
};

export type VerifyUserCredentialResult = {
  valid: boolean;
  credential?: {
    id: string;
    userId: string;
    projectId: string;
    scope: string[];
    expiresAt: string;
  };
  reason?: string;
};

export type RevokeUserCredentialInput = {
  credentialKey: string;
  reason?: string;
};

export type RevokeUserCredentialResult = {
  success: true;
  message: string;
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Generates a secure credential key in format: gw-user-{random}
 */
function generateCredentialKey(): string {
  const random = randomBytes(24).toString("base64url");
  return `gw-user-${random}`;
}

/**
 * Gets the Redis cache key for a credential
 */
function credentialCacheKey(credentialKey: string): string {
  return `gw:user-cred:${credentialKey}`;
}

/**
 * Ensures a default project exists for the platform
 */
async function ensurePlatformProject(): Promise<string> {
  const projectId = "platform-default-project";

  // Check if project exists
  const [existing] = await db
    .select({ id: gatewayProjects.id })
    .from(gatewayProjects)
    .where(eq(gatewayProjects.id, projectId))
    .limit(1);

  if (existing) {
    return projectId;
  }

  // Create default project if not exists
  // Note: This requires a tenant to exist first
  // For now, we'll throw an error if project doesn't exist
  throw new Error("Platform default project not found. Please create it first.");
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Issues a new user credential after purchase
 */
export async function issueUserCredential(
  input: IssueUserCredentialInput,
): Promise<IssueUserCredentialResult> {
  const { userId, credentialType, durationDays, scope, metadata } = input;

  // Ensure platform project exists
  const projectId = await ensurePlatformProject();

  // Generate credential key
  const credentialKey = generateCredentialKey();
  const credentialId = `cred-${randomBytes(12).toString("base64url")}`;

  // Calculate expiration time
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  // Insert into database
  await db.insert(gatewayUserCredentials).values({
    id: credentialId,
    userId,
    projectId,
    credentialKey,
    credentialType,
    status: "active",
    expiresAt,
    scope,
    metadata: metadata ?? null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    revokedAt: null,
    revokeReason: null,
  });

  // Cache the credential in Redis (TTL: 5 minutes)
  const cacheData = {
    id: credentialId,
    userId,
    projectId,
    scope,
    expiresAt: expiresAt.toISOString(),
    status: "active",
  };
  await redis.set(
    credentialCacheKey(credentialKey),
    JSON.stringify(cacheData),
    "EX",
    300,
  );

  return {
    success: true,
    credential: {
      id: credentialId,
      credentialKey,
      expiresAt: expiresAt.toISOString(),
      scope,
    },
    message: "凭证已颁发",
  };
}

/**
 * Verifies a user credential
 */
export async function verifyUserCredential(
  input: VerifyUserCredentialInput,
): Promise<VerifyUserCredentialResult> {
  const { credentialKey, scope: requiredScope } = input;

  // Try to get from cache first
  const cached = await redis.get(credentialCacheKey(credentialKey));
  if (cached) {
    const credential = JSON.parse(cached);

    // Check if expired
    if (new Date(credential.expiresAt) < new Date()) {
      return {
        valid: false,
        reason: "凭证已过期",
      };
    }

    // Check scope if required
    if (requiredScope && !credential.scope.includes(requiredScope)) {
      return {
        valid: false,
        reason: `凭证没有 ${requiredScope} 权限`,
      };
    }

    return {
      valid: true,
      credential,
    };
  }

  // Cache miss, query database
  const [row] = await db
    .select()
    .from(gatewayUserCredentials)
    .where(eq(gatewayUserCredentials.credentialKey, credentialKey))
    .limit(1);

  if (!row) {
    return {
      valid: false,
      reason: "凭证不存在",
    };
  }

  // Check status
  if (row.status !== "active") {
    return {
      valid: false,
      reason: `凭证状态为 ${row.status}`,
    };
  }

  // Check expiration
  if (new Date(row.expiresAt) < new Date()) {
    return {
      valid: false,
      reason: "凭证已过期",
    };
  }

  // Check scope if required
  if (requiredScope && !row.scope.includes(requiredScope)) {
    return {
      valid: false,
      reason: `凭证没有 ${requiredScope} 权限`,
    };
  }

  // Update last used time (fire and forget)
  db.update(gatewayUserCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(gatewayUserCredentials.id, row.id))
    .catch(() => undefined);

  // Cache the credential
  const cacheData = {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    scope: row.scope,
    expiresAt: row.expiresAt.toISOString(),
    status: row.status,
  };
  await redis.set(
    credentialCacheKey(credentialKey),
    JSON.stringify(cacheData),
    "EX",
    300,
  );

  return {
    valid: true,
    credential: cacheData,
  };
}

/**
 * Revokes a user credential
 */
export async function revokeUserCredential(
  input: RevokeUserCredentialInput,
): Promise<RevokeUserCredentialResult> {
  const { credentialKey, reason } = input;

  // Find the credential
  const [row] = await db
    .select({ id: gatewayUserCredentials.id })
    .from(gatewayUserCredentials)
    .where(eq(gatewayUserCredentials.credentialKey, credentialKey))
    .limit(1);

  if (!row) {
    throw new NotFoundError("凭证不存在");
  }

  // Update status to revoked
  await db
    .update(gatewayUserCredentials)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokeReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(gatewayUserCredentials.id, row.id));

  // Invalidate cache
  await redis.del(credentialCacheKey(credentialKey));

  return {
    success: true,
    message: "凭证已撤销",
  };
}

/**
 * Authenticates a user credential from Authorization header
 */
export async function authenticateUserCredential(
  authorizationHeader: string | undefined,
): Promise<VerifyUserCredentialResult["credential"] | null> {
  if (!authorizationHeader) {
    return null;
  }

  // Extract Bearer token
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const credentialKey = match[1].trim();

  // Verify the credential
  const result = await verifyUserCredential({ credentialKey });

  return result.valid ? result.credential! : null;
}
