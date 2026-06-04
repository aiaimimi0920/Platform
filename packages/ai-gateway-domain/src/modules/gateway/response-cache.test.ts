import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import the real production function to test
import { resolveEndpointTtl } from "./response-cache";

// ---------------------------------------------------------------------------
// Tests for resolveEndpointTtl (pure function - can be tested directly)
// ---------------------------------------------------------------------------

describe("resolveEndpointTtl", () => {
  it("returns default TTL for unknown endpoint kinds", () => {
    const ttl = resolveEndpointTtl("unknown_endpoint", 300);
    assert.equal(ttl, 300);
  });

  it("returns default TTL when endpointKind is null", () => {
    const ttl = resolveEndpointTtl(null, 300);
    assert.equal(ttl, 300);
  });

  it("returns default TTL when endpointKind is undefined", () => {
    const ttl = resolveEndpointTtl(undefined, 300);
    assert.equal(ttl, 300);
  });

  it("returns 300s for responses endpoint", () => {
    const ttl = resolveEndpointTtl("responses", 600);
    assert.equal(ttl, 300);
  });

  it("returns 300s for chat_completions endpoint", () => {
    const ttl = resolveEndpointTtl("chat_completions", 600);
    assert.equal(ttl, 300);
  });

  it("returns 300s for messages endpoint", () => {
    const ttl = resolveEndpointTtl("messages", 600);
    assert.equal(ttl, 300);
  });

  it("returns 90s for search endpoint", () => {
    const ttl = resolveEndpointTtl("search", 600);
    assert.equal(ttl, 90);
  });

  it("returns 90s for fetch endpoint", () => {
    const ttl = resolveEndpointTtl("fetch", 600);
    assert.equal(ttl, 90);
  });

  it("returns 120s for research_create endpoint", () => {
    const ttl = resolveEndpointTtl("research_create", 300);
    assert.equal(ttl, 120);
  });

  it("returns 120s for research_list endpoint", () => {
    const ttl = resolveEndpointTtl("research_list", 300);
    assert.equal(ttl, 120);
  });

  it("returns 120s for research_get endpoint", () => {
    const ttl = resolveEndpointTtl("research_get", 300);
    assert.equal(ttl, 120);
  });

  it("returns 900s for credits_balance endpoint", () => {
    const ttl = resolveEndpointTtl("credits_balance", 300);
    assert.equal(ttl, 900);
  });

  it("returns 240s for music_generations endpoint", () => {
    const ttl = resolveEndpointTtl("music_generations", 300);
    assert.equal(ttl, 240);
  });

  it("returns 240s for videos_generations endpoint", () => {
    const ttl = resolveEndpointTtl("videos_generations", 300);
    assert.equal(ttl, 240);
  });
});

// ---------------------------------------------------------------------------
// Note on testing Redis-dependent functions
// ---------------------------------------------------------------------------
//
// The remaining functions (buildResponseCacheKey, getGatewayCachedResponse,
// setGatewayCachedResponse, invalidateGatewayResponseCache,
// getGatewayResponseCacheStats) depend on a live Redis connection.
//
// These functions are tested through:
// 1. Integration tests that run against a real Redis instance
// 2. End-to-end tests against the Rust gateway runtime
// 3. Manual testing in development/staging environments
//
// Unit testing these functions would require either:
// - Mocking the Redis client at the module level (fragile, couples tests to implementation)
// - Dependency injection (would require refactoring the production code)
// - Re-implementing the business logic in tests (violates DRY, creates maintenance burden)
//
// The current approach prioritizes:
// - Testing pure functions (like resolveEndpointTtl) directly
// - Relying on integration tests for Redis-dependent code
// - Keeping production code simple without DI overhead
//
// If unit test coverage for Redis-dependent functions becomes critical,
// consider refactoring to use dependency injection or a Redis client factory.
