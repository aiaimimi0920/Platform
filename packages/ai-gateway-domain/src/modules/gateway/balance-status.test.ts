import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBalanceDisplay,
  buildQuotaStatus,
  computeRemainingRatio,
  evaluateBalanceStatus,
  isProviderUnavailable,
  mergeBalanceIntoRoutingWeight,
  shouldDeprioritizeProvider,
} from "./balance-status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tokenUnit = { type: "tokens" } as const;
const requestUnit = { type: "requests" } as const;
const moneyUnit = { type: "money", currency: "USD" } as const;

const defaultConfig = {
  providerAccountId: "provider_abc",
  deprioritizeThreshold: 0.1,
  deprioritizeOnUnknown: false,
};

// ---------------------------------------------------------------------------
// computeRemainingRatio
// ---------------------------------------------------------------------------

describe("computeRemainingRatio", () => {
  it("uses remaining/total when remaining is provided", () => {
    const ratio = computeRemainingRatio({ used: 0, total: 10000, remaining: 1500 });
    assert.equal(ratio, 0.15);
  });

  it("uses (total - used)/total when only used+total are provided", () => {
    const ratio = computeRemainingRatio({ used: 8500, total: 10000, remaining: null });
    assert.equal(ratio, 0.15);
  });

  it("returns null when remaining is provided but total is null (unlimited)", () => {
    const ratio = computeRemainingRatio({ used: 500, total: null, remaining: 200 });
    assert.equal(ratio, null);
  });

  it("returns null when remaining is provided but total is zero", () => {
    const ratio = computeRemainingRatio({ used: 0, total: 0, remaining: 0 });
    assert.equal(ratio, null);
  });

  it("returns null when neither remaining nor total is available", () => {
    const ratio = computeRemainingRatio({ used: 1000, total: null, remaining: null });
    assert.equal(ratio, null);
  });

  it("returns 1.0 for a fully fresh quota (used=0, remaining=total)", () => {
    const ratio = computeRemainingRatio({ used: 0, total: 100, remaining: 100 });
    assert.equal(ratio, 1.0);
  });

  it("returns 0.0 for a fully consumed quota", () => {
    const ratio = computeRemainingRatio({ used: 100, total: 100, remaining: null });
    assert.equal(ratio, 0.0);
  });
});

// ---------------------------------------------------------------------------
// buildQuotaStatus
// ---------------------------------------------------------------------------

describe("buildQuotaStatus", () => {
  it("computes remainingRatio automatically from remaining+total", () => {
    const status = buildQuotaStatus({ unit: tokenUnit, used: 0, total: 10000, remaining: 1500 });
    assert.equal(status.remainingRatio, 0.15);
    assert.equal(status.total, 10000);
    assert.equal(status.remaining, 1500);
    assert.equal(status.resets, false);
    assert.equal(status.resetAt, null);
  });

  it("computes remainingRatio from used+total when remaining is omitted", () => {
    const status = buildQuotaStatus({ unit: requestUnit, used: 900, total: 1000 });
    assert.equal(status.remainingRatio, 0.1);
  });

  it("handles unlimited total (null) — remainingRatio is null", () => {
    const status = buildQuotaStatus({ unit: moneyUnit, used: 5 });
    assert.equal(status.total, null);
    assert.equal(status.remaining, null);
    assert.equal(status.remainingRatio, null);
  });

  it("carries through resets and resetAt fields", () => {
    const status = buildQuotaStatus({
      unit: tokenUnit,
      used: 100,
      total: 1000,
      resets: true,
      resetAt: "2026-04-08T00:00:00.000Z",
    });
    assert.equal(status.resets, true);
    assert.equal(status.resetAt, "2026-04-08T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// evaluateBalanceStatus — quotaType + hasFreeQuota
// ---------------------------------------------------------------------------

describe("evaluateBalanceStatus", () => {
  it("free_only: sets quotaType and hasFreeQuota correctly", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 500, total: 10000 });
    const result = evaluateBalanceStatus({ providerAccountId: "p1", free, config: { ...defaultConfig, providerAccountId: "p1" } });
    assert.equal(result.quotaType, "free_only");
    assert.equal(result.hasFreeQuota, true);
    assert.equal(result.paid, null);
  });

  it("paid_only: sets quotaType and hasFreeQuota correctly", () => {
    const paid = buildQuotaStatus({ unit: moneyUnit, used: 5, total: 100 });
    const result = evaluateBalanceStatus({ providerAccountId: "p2", paid, config: { ...defaultConfig, providerAccountId: "p2" } });
    assert.equal(result.quotaType, "paid_only");
    assert.equal(result.hasFreeQuota, false);
    assert.equal(result.free, null);
  });

  it("mixed: both quotas present", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 100, total: 500 });
    const paid = buildQuotaStatus({ unit: moneyUnit, used: 2, total: 50 });
    const result = evaluateBalanceStatus({ providerAccountId: "p3", free, paid, config: { ...defaultConfig, providerAccountId: "p3" } });
    assert.equal(result.quotaType, "mixed");
  });

  it("unknown: no quotas produce unknown quotaType and isUnavailable", () => {
    const result = evaluateBalanceStatus({ providerAccountId: "p4", config: { ...defaultConfig, providerAccountId: "p4" } });
    assert.equal(result.quotaType, "unknown");
    assert.equal(result.isUnavailable, true);
  });

  it("hasFreeQuota is false when free quota is exhausted", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 10000, total: 10000 });
    const result = evaluateBalanceStatus({ providerAccountId: "p5", free, config: { ...defaultConfig, providerAccountId: "p5" } });
    assert.equal(result.hasFreeQuota, false);
  });

  it("checkedAt is a valid ISO timestamp", () => {
    const result = evaluateBalanceStatus({ providerAccountId: "p6", config: { ...defaultConfig, providerAccountId: "p6" } });
    assert.ok(!isNaN(Date.parse(result.checkedAt)));
  });
});

// ---------------------------------------------------------------------------
// shouldDeprioritize
// ---------------------------------------------------------------------------

describe("shouldDeprioritize signal", () => {
  it("is false when primary ratio is above threshold", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 0, total: 10000, remaining: 5000 });
    const result = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    assert.equal(result.shouldDeprioritize, false);
    assert.equal(shouldDeprioritizeProvider(result), false);
  });

  it("is true when primary ratio is below threshold", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 9950, total: 10000 });
    const result = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    assert.equal(result.shouldDeprioritize, true);
    assert.equal(shouldDeprioritizeProvider(result), true);
  });

  it("prefers paid over free as the primary quota for the signal", () => {
    // Free is critically low; paid is healthy — should NOT deprioritize
    const free = buildQuotaStatus({ unit: tokenUnit, used: 9990, total: 10000 });
    const paid = buildQuotaStatus({ unit: moneyUnit, used: 1, total: 100 });
    const result = evaluateBalanceStatus({
      providerAccountId: "p",
      free,
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    // paid ratio = 0.99 → above threshold → no deprioritization
    assert.equal(result.shouldDeprioritize, false);
  });

  it("returns false on unknown ratio when deprioritizeOnUnknown is false", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 100 }); // no total → null ratio
    const result = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeOnUnknown: false },
    });
    assert.equal(result.shouldDeprioritize, false);
  });

  it("returns true on unknown ratio when deprioritizeOnUnknown is true", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 100 }); // no total → null ratio
    const result = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeOnUnknown: true },
    });
    assert.equal(result.shouldDeprioritize, true);
  });
});

// ---------------------------------------------------------------------------
// isUnavailable
// ---------------------------------------------------------------------------

describe("isProviderUnavailable", () => {
  it("is true when only quota is fully exhausted", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 10000, total: 10000 });
    const result = evaluateBalanceStatus({ providerAccountId: "p", paid, config: defaultConfig });
    assert.equal(result.isUnavailable, true);
    assert.equal(isProviderUnavailable(result), true);
  });

  it("is false when at least one quota has remaining", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 100, total: 10000 });
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 9000, total: 10000 });
    const result = evaluateBalanceStatus({ providerAccountId: "p", free, paid, config: defaultConfig });
    assert.equal(result.isUnavailable, false);
    assert.equal(isProviderUnavailable(result), false);
  });

  it("is true when both quotas are exhausted", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 5000, total: 5000 });
    const paid = buildQuotaStatus({ unit: moneyUnit, used: 100, total: 100 });
    const result = evaluateBalanceStatus({ providerAccountId: "p", free, paid, config: defaultConfig });
    assert.equal(result.isUnavailable, true);
  });

  it("is false when remaining > 0 via the remaining field", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 9000, total: 10000, remaining: 1000 });
    const result = evaluateBalanceStatus({ providerAccountId: "p", paid, config: defaultConfig });
    assert.equal(result.isUnavailable, false);
  });
});

// ---------------------------------------------------------------------------
// mergeBalanceIntoRoutingWeight
// ---------------------------------------------------------------------------

describe("mergeBalanceIntoRoutingWeight", () => {
  it("returns 0 for an unavailable provider", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 10000, total: 10000 });
    const balance = evaluateBalanceStatus({ providerAccountId: "p", paid, config: defaultConfig });
    assert.equal(mergeBalanceIntoRoutingWeight(100, balance), 0);
  });

  it("returns weight * 0.1 when shouldDeprioritize is true", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 9950, total: 10000 });
    const balance = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    assert.equal(balance.shouldDeprioritize, true);
    assert.equal(mergeBalanceIntoRoutingWeight(100, balance), 10);
  });

  it("returns weight * 0.5 when ratio is below 0.3 but above deprioritize threshold", () => {
    // ratio = 0.2 (below 0.3, above 0.1 threshold)
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 8000, total: 10000 });
    const balance = evaluateBalanceStatus({
      providerAccountId: "p",
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    assert.equal(balance.shouldDeprioritize, false);
    assert.equal(mergeBalanceIntoRoutingWeight(100, balance), 50);
  });

  it("returns weight unchanged when ratio is healthy (>= 0.3)", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 500, total: 10000 });
    const balance = evaluateBalanceStatus({ providerAccountId: "p", paid, config: defaultConfig });
    assert.equal(mergeBalanceIntoRoutingWeight(100, balance), 100);
  });
});

// ---------------------------------------------------------------------------
// buildBalanceDisplay
// ---------------------------------------------------------------------------

describe("buildBalanceDisplay", () => {
  it("includes provider id and OK status for a healthy provider", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 1000, total: 10000 });
    const balance = evaluateBalanceStatus({ providerAccountId: "abc123", paid, config: defaultConfig });
    const display = buildBalanceDisplay(balance);
    assert.ok(display.includes("abc123"));
    assert.ok(display.includes("OK"));
    assert.ok(!display.includes("DEPRIORITIZED"));
    assert.ok(!display.includes("UNAVAILABLE"));
  });

  it("marks DEPRIORITIZED when shouldDeprioritize is true", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 9950, total: 10000 });
    const balance = evaluateBalanceStatus({
      providerAccountId: "abc123",
      paid,
      config: { ...defaultConfig, deprioritizeThreshold: 0.1 },
    });
    const display = buildBalanceDisplay(balance);
    assert.ok(display.includes("DEPRIORITIZED"));
  });

  it("marks UNAVAILABLE when exhausted", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 10000, total: 10000 });
    const balance = evaluateBalanceStatus({ providerAccountId: "abc123", paid, config: defaultConfig });
    const display = buildBalanceDisplay(balance);
    assert.ok(display.includes("UNAVAILABLE"));
  });

  it("formats paid quota as 'remaining/total unit (pct%)'", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 0, total: 10000, remaining: 1500 });
    const balance = evaluateBalanceStatus({ providerAccountId: "abc123", paid, config: defaultConfig });
    const display = buildBalanceDisplay(balance);
    // e.g. "paid 1500/10000 tokens (15.0%)"
    assert.ok(display.includes("1500/10000"));
    assert.ok(display.includes("tokens"));
    assert.ok(display.includes("15.0%"));
  });

  it("shows 'free exhausted' when free quota is spent", () => {
    const free = buildQuotaStatus({ unit: tokenUnit, used: 10000, total: 10000 });
    const paid = buildQuotaStatus({ unit: moneyUnit, used: 5, total: 100 });
    const balance = evaluateBalanceStatus({ providerAccountId: "abc123", free, paid, config: defaultConfig });
    const display = buildBalanceDisplay(balance);
    assert.ok(display.includes("free exhausted"));
  });

  it("display field on BalanceStatus matches standalone buildBalanceDisplay", () => {
    const paid = buildQuotaStatus({ unit: tokenUnit, used: 1000, total: 5000 });
    const balance = evaluateBalanceStatus({ providerAccountId: "p", paid, config: defaultConfig });
    assert.equal(balance.display, buildBalanceDisplay(balance));
  });
});
