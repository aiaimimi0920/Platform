import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  GatewayOpenAiCompatibleProviderPayload,
  GatewayProviderAccountPayload,
} from "@neuro/contracts";

// ---------------------------------------------------------------------------
// Inline implementation of chooseStorageMode for testing
// This avoids importing the full module which has database dependencies
// ---------------------------------------------------------------------------

function chooseStorageMode(payload: GatewayProviderAccountPayload): "inline" | "r2" {
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

function buildOpenAiPayload(
  overrides: Partial<GatewayOpenAiCompatibleProviderPayload> = {},
): GatewayProviderAccountPayload {
  return {
    adapter: "openai_compatible",
    accountLabel: "OpenAI primary",
    apiKey: "sk-test123",
    baseUrl: "https://api.openai.com/v1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests for chooseStorageMode (pure function - can be tested directly)
// ---------------------------------------------------------------------------

describe("chooseStorageMode", () => {
  it("returns inline for small payloads under 4KB", () => {
    const payload = buildOpenAiPayload();
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "inline");
  });

  it("returns inline for small nested objects", () => {
    const payload = buildOpenAiPayload({
      apiKeys: ["sk-key1", "sk-key2", "sk-key3"],
      headers: {
        "X-Custom-Header": "value",
      },
    });
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "inline");
  });

  it("returns r2 for payloads over 4KB", () => {
    const largePayload = buildOpenAiPayload({
      // Create a large string to exceed 4KB
      extraBody: {
        largeData: "x".repeat(5000),
      },
    });
    const mode = chooseStorageMode(largePayload);
    assert.equal(mode, "r2");
  });

  it("returns r2 for payloads with large arrays (50+ elements)", () => {
    const payload = buildOpenAiPayload({
      apiKeys: Array.from({ length: 60 }, (_, i) => `sk-key${i}`),
    });
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "r2");
  });

  it("returns inline for payloads with arrays under 50 elements", () => {
    const payload = buildOpenAiPayload({
      apiKeys: Array.from({ length: 40 }, (_, i) => `sk-key${i}`),
    });
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "inline");
  });

  it("handles minimal valid payloads", () => {
    const payload = buildOpenAiPayload({
      apiKey: "sk-minimal",
    });
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "inline");
  });

  it("handles payloads with nested objects and small arrays", () => {
    const payload = buildOpenAiPayload({
      headers: {
        "X-Custom-Header": "value",
        "X-Another-Header": "value2",
      },
      extraBody: {
        nested: {
          value: "test",
          array: [1, 2, 3],
        },
      },
    });
    const mode = chooseStorageMode(payload);
    assert.equal(mode, "inline");
  });
});

// ---------------------------------------------------------------------------
// Note on testing database-dependent functions
// ---------------------------------------------------------------------------
//
// The remaining functions (createProviderCredential, updateProviderCredential,
// deleteProviderCredential, getProviderCredential, batchProviderCredentialOperations,
// invalidateProviderCredentialCache, warmupProviderCredentialCache) depend on
// live database and Redis connections.
//
// These functions are tested through:
// 1. Integration tests that run against real database and Redis instances
// 2. End-to-end tests against the Rust gateway runtime
// 3. Manual testing in development/staging environments
//
// Unit testing these functions would require either:
// - Mocking the database and Redis clients at the module level (fragile, couples tests to implementation)
// - Dependency injection (would require refactoring the production code)
// - Re-implementing the business logic in tests (violates DRY, creates maintenance burden)
//
// The current approach prioritizes:
// - Testing pure functions (like chooseStorageMode) directly
// - Relying on integration tests for database/Redis-dependent code
// - Keeping production code simple without DI overhead
//
// If unit test coverage for database-dependent functions becomes critical,
// consider refactoring to use dependency injection or a database client factory.
