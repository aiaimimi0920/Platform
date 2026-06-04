// Balance/Quota status with shouldDeprioritize signal for AI gateway routing.
// Each provider's balance-checker decides its own deprioritization threshold;
// the router reads the resulting boolean without knowing provider-specific rules.

export type QuotaUnit =
  | { type: "tokens" }
  | { type: "requests" }
  | { type: "money"; currency: string };

export type QuotaStatus = {
  unit: QuotaUnit;
  used: number;
  total: number | null;          // null if unlimited
  remaining: number | null;      // null if unknown
  remainingRatio: number | null; // 0.0 – 1.0, normalized; null if not computable
  resets: boolean;               // true if quota resets periodically
  resetAt: string | null;        // ISO timestamp of next reset, null if none
};

export type QuotaType = "free_only" | "paid_only" | "mixed" | "unknown";

export type BalanceStatus = {
  providerAccountId: string;
  display: string;             // human-readable summary for logs/UI
  quotaType: QuotaType;
  free: QuotaStatus | null;
  paid: QuotaStatus | null;
  hasFreeQuota: boolean;       // convenience: remaining free > 0
  shouldDeprioritize: boolean; // provider-decided deprioritization signal
  isUnavailable: boolean;      // balance fully exhausted or query failed
  checkedAt: string;           // ISO timestamp
};

export type BalanceCheckerConfig = {
  providerAccountId: string;
  // remainingRatio below which shouldDeprioritize becomes true; default 0.1 (10%)
  deprioritizeThreshold: number;
  // Whether to treat unknown balance (null remainingRatio) as deprioritized
  deprioritizeOnUnknown: boolean;
};

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

/**
 * Computes the remaining ratio (0.0 – 1.0) from raw quota figures.
 *
 * Priority:
 *  1. remaining / total  (when remaining is provided and total is known and > 0)
 *  2. (total - used) / total  (when only used + total are provided)
 *  3. null  (cannot be determined)
 */
export function computeRemainingRatio(quota: {
  used: number;
  total: number | null;
  remaining: number | null;
}): number | null {
  const { used, total, remaining } = quota;

  if (remaining !== null) {
    if (total === null || total <= 0) {
      return null;
    }
    return remaining / total;
  }

  if (total !== null && total > 0) {
    return (total - used) / total;
  }

  return null;
}

/**
 * Constructs a QuotaStatus with an automatically computed remainingRatio.
 */
export function buildQuotaStatus(args: {
  unit: QuotaUnit;
  used: number;
  total?: number;
  remaining?: number;
  resets?: boolean;
  resetAt?: string;
}): QuotaStatus {
  const total = args.total ?? null;
  const remaining = args.remaining ?? null;
  const remainingRatio = computeRemainingRatio({ used: args.used, total, remaining });

  return {
    unit: args.unit,
    used: args.used,
    total,
    remaining,
    remainingRatio,
    resets: args.resets ?? false,
    resetAt: args.resetAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function resolveQuotaType(free: QuotaStatus | null, paid: QuotaStatus | null): QuotaType {
  if (free !== null && paid !== null) {
    return "mixed";
  }
  if (free !== null) {
    return "free_only";
  }
  if (paid !== null) {
    return "paid_only";
  }
  return "unknown";
}

function isQuotaExhausted(quota: QuotaStatus | null): boolean {
  if (quota === null) {
    return true;
  }
  if (quota.remaining !== null) {
    return quota.remaining <= 0;
  }
  if (quota.total !== null) {
    return quota.used >= quota.total;
  }
  // Unknown remaining — not considered exhausted by default
  return false;
}

/**
 * Evaluates a BalanceStatus from raw quota inputs and checker configuration.
 *
 * Deprioritization logic: uses "primary" quota (paid if present, else free).
 * The provider-specific threshold in config governs the shouldDeprioritize flag.
 */
export function evaluateBalanceStatus(args: {
  providerAccountId: string;
  free?: QuotaStatus;
  paid?: QuotaStatus;
  config: BalanceCheckerConfig;
}): BalanceStatus {
  const free = args.free ?? null;
  const paid = args.paid ?? null;
  const { config } = args;

  const quotaType = resolveQuotaType(free, paid);

  // hasFreeQuota: free quota is present and not exhausted
  const hasFreeQuota =
    free !== null &&
    (free.remaining === null ? !isQuotaExhausted(free) : free.remaining > 0);

  // Primary quota for deprioritization: paid takes precedence over free
  const primary = paid ?? free;
  const primaryRatio = primary?.remainingRatio ?? null;

  let shouldDeprioritize: boolean;
  if (primaryRatio === null) {
    shouldDeprioritize = config.deprioritizeOnUnknown;
  } else {
    shouldDeprioritize = primaryRatio < config.deprioritizeThreshold;
  }

  // isUnavailable: all present quotas are exhausted (or no quotas at all)
  const quotasPresent: QuotaStatus[] = [free, paid].filter((q): q is QuotaStatus => q !== null);
  const isUnavailable =
    quotasPresent.length === 0 || quotasPresent.every((q) => isQuotaExhausted(q));

  const checkedAt = new Date().toISOString();

  const status: BalanceStatus = {
    providerAccountId: args.providerAccountId,
    display: "", // filled below
    quotaType,
    free,
    paid,
    hasFreeQuota,
    shouldDeprioritize,
    isUnavailable,
    checkedAt,
  };

  status.display = buildBalanceDisplay(status);
  return status;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Returns the shouldDeprioritize signal from a BalanceStatus. */
export function shouldDeprioritizeProvider(balance: BalanceStatus): boolean {
  return balance.shouldDeprioritize;
}

/** Returns true when the provider's balance is fully exhausted or unavailable. */
export function isProviderUnavailable(balance: BalanceStatus): boolean {
  return balance.isUnavailable;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function formatQuotaSegment(label: string, quota: QuotaStatus): string {
  const unitLabel =
    quota.unit.type === "money"
      ? quota.unit.currency
      : quota.unit.type;

  if (isQuotaExhausted(quota)) {
    return `${label} exhausted`;
  }

  const remaining = quota.remaining ?? (quota.total !== null ? quota.total - quota.used : null);
  const total = quota.total;

  if (remaining !== null && total !== null) {
    const pct = ((remaining / total) * 100).toFixed(1);
    return `${label} ${remaining}/${total} ${unitLabel} (${pct}%)`;
  }

  if (remaining !== null) {
    return `${label} ${remaining} ${unitLabel} remaining`;
  }

  return `${label} ${quota.used} ${unitLabel} used`;
}

/**
 * Builds a human-readable summary line for logs/UI.
 *
 * Example:
 *   "Provider abc123: paid 1500/10000 tokens (15.0%) | free exhausted | DEPRIORITIZED"
 */
export function buildBalanceDisplay(balance: BalanceStatus): string {
  const parts: string[] = [`Provider ${balance.providerAccountId}:`];

  const segments: string[] = [];
  if (balance.paid !== null) {
    segments.push(formatQuotaSegment("paid", balance.paid));
  }
  if (balance.free !== null) {
    segments.push(formatQuotaSegment("free", balance.free));
  }
  if (segments.length === 0) {
    segments.push("no quota info");
  }

  parts.push(segments.join(" | "));

  if (balance.isUnavailable) {
    parts.push("UNAVAILABLE");
  } else if (balance.shouldDeprioritize) {
    parts.push("DEPRIORITIZED");
  } else {
    parts.push("OK");
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Routing weight integration
// ---------------------------------------------------------------------------

/**
 * Adjusts a routing weight based on the provider's balance status.
 *
 * Rules (in priority order):
 *  - isUnavailable  → 0       (exclude from routing entirely)
 *  - shouldDeprioritize → weight * 0.1   (heavy penalty)
 *  - primary remainingRatio < 0.3 → weight * 0.5  (mild penalty)
 *  - otherwise → weight unchanged
 */
export function mergeBalanceIntoRoutingWeight(currentWeight: number, balance: BalanceStatus): number {
  if (balance.isUnavailable) {
    return 0;
  }
  if (balance.shouldDeprioritize) {
    return currentWeight * 0.1;
  }

  // Derive primary remainingRatio for mild-penalty check
  const primaryRatio = (balance.paid ?? balance.free)?.remainingRatio ?? null;
  if (primaryRatio !== null && primaryRatio < 0.3) {
    return currentWeight * 0.5;
  }

  return currentWeight;
}
