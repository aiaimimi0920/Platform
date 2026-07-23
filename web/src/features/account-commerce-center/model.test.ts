import assert from "node:assert/strict";
import test from "node:test";

import type {
  ItemView,
  MarketplaceListingView,
  UserSummary,
} from "@neuro/contracts";

import { createDependencyResult } from "@/lib/dependency-result";

import { combineCommercePanelDependencies } from "./model";

const user = { id: "user-1", username: "owner-1" } as UserSummary;

function readyEmptyCollections() {
  return {
    items: createDependencyResult({ state: "ready" as const, data: [] }),
    listings: createDependencyResult({ state: "ready" as const, data: [] }),
    orders: createDependencyResult({ state: "ready" as const, data: [] }),
    products: createDependencyResult({ state: "ready" as const, data: [] }),
  };
}

test("commerce panel distinguishes a successful empty shelf from dependency failure", () => {
  const result = combineCommercePanelDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    ...readyEmptyCollections(),
  });

  assert.equal(result.dependency.state, "empty");
  assert.equal(result.panel.currentUser?.id, "user-1");
  assert.deepEqual(result.panel.products, []);
});

test("commerce panel preserves successful sections and identifies a failed source as partial", () => {
  const result = combineCommercePanelDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    ...readyEmptyCollections(),
    products: createDependencyResult({
      state: "unavailable",
      failures: [{ source: "core-products", message: "商品目录暂不可用。" }],
      retry: { retryable: true, retryAfterMs: null },
    }),
    listings: createDependencyResult({
      state: "ready",
      data: [
        {
          id: "listing-1",
          itemId: "item-1",
          sellerUserId: "seller-1",
          productTitle: "Verified listing",
          currency: "obsidian",
          price: 10,
          status: "active",
          createdAt: "2026-07-22T00:00:00.000Z",
        } satisfies MarketplaceListingView,
      ],
    }),
  });

  assert.equal(result.dependency.state, "partial");
  assert.equal(result.dependency.failures[0]?.source, "core-products");
  assert.equal(result.panel.listings.length, 1);
  assert.deepEqual(result.panel.products, []);
});

test("commerce panel keeps all-source authorization failures unauthorized", () => {
  const denied = (source: string) => createDependencyResult<never[]>({
    state: "unauthorized",
    failures: [{ source, message: "当前账户无权访问。" }],
    retry: { retryable: false, retryAfterMs: null },
  });
  const result = combineCommercePanelDependencies({
    currentUser: createDependencyResult<UserSummary | null>({
      state: "unauthorized",
      failures: [{ source: "account-user", message: "当前账户无权访问。" }],
      retry: { retryable: false, retryAfterMs: null },
    }),
    items: denied("core-items"),
    listings: denied("core-marketplace"),
    orders: denied("core-orders"),
    products: denied("core-products"),
  });

  assert.equal(result.dependency.state, "unauthorized");
  assert.equal(result.dependency.failures.length, 5);
  assert.equal(result.panel.currentUser, null);
});

test("commerce panel preserves child partial data while aggregating its failure", () => {
  const result = combineCommercePanelDependencies({
    currentUser: createDependencyResult({ state: "ready", data: user }),
    items: createDependencyResult({
      state: "partial",
      data: [
        {
          id: "item-1",
          productId: "product-1",
          productTitle: "Verified item",
          fulfillmentMode: "one_time_delivery",
          transferable: true,
          status: "active",
          remainingUses: null,
          totalUnits: null,
          activeUnits: null,
          replacementCount: 0,
          warrantyExpiresAt: null,
          issueReportingEnabled: false,
          units: [],
          issueReports: [],
          manualReviews: [],
          replacementLogs: [],
          fulfillmentRuns: [],
          lastReconciledAt: null,
          expiresAt: null,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
          createdAt: "2026-07-22T00:00:00.000Z",
        } satisfies ItemView,
      ],
      failures: [{ source: "core-items", message: "资产清单部分不可用。" }],
      retry: { retryable: true, retryAfterMs: null },
    }),
    listings: createDependencyResult({ state: "ready", data: [] }),
    orders: createDependencyResult({ state: "ready", data: [] }),
    products: createDependencyResult({ state: "ready", data: [] }),
  });

  assert.equal(result.dependency.state, "partial");
  assert.equal(result.panel.items.length, 1);
  assert.equal(result.dependency.failures[0]?.source, "core-items");
});
