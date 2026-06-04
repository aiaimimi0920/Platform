import { redis } from "@/db/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GatewayUsageReport = {
  requestId: string;
  credentialId: string;
  projectId: string;
  userId: string;
  model: string;
  provider: string;

  // Actual usage from upstream response
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;

  // Timing
  requestStartedAt: string;
  requestCompletedAt: string;
  latencyMs: number;

  // For cost estimation
  estimatedCostMicros?: number; // cost in microdollars

  // Status
  success: boolean;
  errorCode?: string;
};

export type GatewayQuotaCheckResult = {
  allowed: boolean;
  remainingTokens: number;
  reason?: string; // e.g. "quota_exceeded"
};

type UpstreamUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

function quotaKey(credentialId: string): string {
  return `gw:quota:${credentialId}`;
}

const USAGE_REPORTS_KEY = "gw:usage:reports";

// ---------------------------------------------------------------------------
// Parse upstream usage
// ---------------------------------------------------------------------------

/**
 * Extract token usage from an upstream AI provider response body.
 *
 * Supports:
 * - OpenAI format: `response.usage.prompt_tokens`, `completion_tokens`, `total_tokens`
 * - Anthropic format: `response.usage.input_tokens`, `output_tokens`
 *
 * Returns `null` when the response does not contain recognisable usage data.
 */
export function parseUpstreamUsage(
  responseBody: unknown,
  provider: string,
): UpstreamUsage | null {
  if (responseBody == null || typeof responseBody !== "object") {
    return null;
  }

  const body = responseBody as Record<string, unknown>;
  const usage = body.usage;
  if (usage == null || typeof usage !== "object") {
    return null;
  }

  const u = usage as Record<string, unknown>;
  const normalizedProvider = provider.trim().toLowerCase();

  if (normalizedProvider === "anthropic") {
    const inputTokens = typeof u.input_tokens === "number" ? u.input_tokens : null;
    const outputTokens = typeof u.output_tokens === "number" ? u.output_tokens : null;
    if (inputTokens == null || outputTokens == null) {
      return null;
    }
    return {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
    };
  }

  // Default: OpenAI-compatible format
  const promptTokens = typeof u.prompt_tokens === "number" ? u.prompt_tokens : null;
  const completionTokens = typeof u.completion_tokens === "number" ? u.completion_tokens : null;
  const totalTokens = typeof u.total_tokens === "number" ? u.total_tokens : null;
  if (promptTokens == null || completionTokens == null) {
    return null;
  }
  return {
    promptTokens,
    completionTokens,
    totalTokens: totalTokens ?? promptTokens + completionTokens,
  };
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Rough token count estimation based on character length.
 * Uses the common approximation of ~4 characters per token.
 */
export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Gateway quota management
// ---------------------------------------------------------------------------

/**
 * Check whether the credential has enough remaining quota for the estimated
 * number of tokens. Does NOT deduct — this is a read-only check.
 */
export async function checkGatewayQuota(args: {
  credentialId: string;
  estimatedTokens: number;
}): Promise<GatewayQuotaCheckResult> {
  const key = quotaKey(args.credentialId);
  const raw = await redis.get(key);

  if (raw == null) {
    // No quota key means quota has not been initialised for this credential.
    return { allowed: false, remainingTokens: 0, reason: "quota_not_initialized" };
  }

  const remaining = parseInt(raw, 10);
  if (Number.isNaN(remaining)) {
    return { allowed: false, remainingTokens: 0, reason: "quota_corrupt" };
  }

  if (remaining < args.estimatedTokens) {
    return { allowed: false, remainingTokens: remaining, reason: "quota_exceeded" };
  }

  return { allowed: true, remainingTokens: remaining };
}

/**
 * Atomically deduct tokens from a credential's quota counter (DECRBY).
 * Returns the new remaining value after deduction.
 */
export async function deductGatewayQuota(args: {
  credentialId: string;
  tokens: number;
}): Promise<number> {
  const key = quotaKey(args.credentialId);
  return redis.decrby(key, args.tokens);
}

/**
 * Set the initial quota counter for a credential. Called when the main
 * platform pushes a new credential to the gateway.
 *
 * If `ttlSeconds` is provided, the key will expire automatically.
 */
export async function initGatewayQuota(args: {
  credentialId: string;
  totalTokens: number;
  ttlSeconds?: number;
}): Promise<void> {
  const key = quotaKey(args.credentialId);
  if (args.ttlSeconds != null && args.ttlSeconds > 0) {
    await redis.set(key, args.totalTokens, "EX", args.ttlSeconds);
  } else {
    await redis.set(key, args.totalTokens);
  }
}

// ---------------------------------------------------------------------------
// Usage report queue
// ---------------------------------------------------------------------------

/**
 * Push a usage report onto the Redis list for async consumption by the main
 * platform settlement worker.
 */
export async function enqueueGatewayUsageReport(
  report: GatewayUsageReport,
): Promise<void> {
  await redis.rpush(USAGE_REPORTS_KEY, JSON.stringify(report));
}

/**
 * Pop up to `batchSize` usage reports from the queue (LPOP).
 * Used by the main platform or a sync worker for final settlement.
 */
export async function dequeueGatewayUsageReports(
  batchSize: number,
): Promise<GatewayUsageReport[]> {
  const results: GatewayUsageReport[] = [];

  for (let i = 0; i < batchSize; i++) {
    const raw = await redis.lpop(USAGE_REPORTS_KEY);
    if (raw == null) {
      break;
    }
    results.push(JSON.parse(raw) as GatewayUsageReport);
  }

  return results;
}
