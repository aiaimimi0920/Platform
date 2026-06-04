import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGatewayStaticKeyAuthAdapter,
  resolveGatewayAuth,
  extractGatewayAuthRequest,
  type GatewayAuthAdapter,
  type GatewayAuthRequest,
} from "./auth-adapter";

// ---- Static Key Adapter ---------------------------------------------------

describe("createGatewayStaticKeyAuthAdapter", () => {
  const keys = new Map([
    ["sk-test-001", { projectId: "proj-1", tenantId: "tenant-1", scopes: ["relay"] }],
    ["sk-test-002", { projectId: "proj-2", tenantId: "tenant-2", scopes: ["relay", "admin"] }],
  ]);
  const adapter = createGatewayStaticKeyAuthAdapter({ keys });

  it("authenticates a valid static key from apiKey field", async () => {
    const result = await adapter.authenticate({
      apiKey: "sk-test-001",
      path: "/v1/chat/completions",
      method: "POST",
    });
    assert.equal(result.authenticated, true);
    if (!result.authenticated) return;
    assert.equal(result.projectId, "proj-1");
    assert.equal(result.tenantId, "tenant-1");
    assert.deepEqual(result.scopes, ["relay"]);
    assert.equal(result.userId, null);
    assert.equal(result.credentialRef, null);
  });

  it("authenticates a valid static key from Authorization bearer header", async () => {
    const result = await adapter.authenticate({
      authorization: "Bearer sk-test-002",
      path: "/v1/chat/completions",
      method: "POST",
    });
    assert.equal(result.authenticated, true);
    if (!result.authenticated) return;
    assert.equal(result.projectId, "proj-2");
    assert.deepEqual(result.scopes, ["relay", "admin"]);
  });

  it("prefers bearer token over apiKey when both are present", async () => {
    const result = await adapter.authenticate({
      authorization: "Bearer sk-test-002",
      apiKey: "sk-test-001",
      path: "/v1/chat/completions",
      method: "POST",
    });
    assert.equal(result.authenticated, true);
    if (!result.authenticated) return;
    assert.equal(result.projectId, "proj-2");
  });

  it("rejects an unknown key", async () => {
    const result = await adapter.authenticate({
      apiKey: "sk-unknown",
      path: "/v1/chat/completions",
      method: "POST",
    });
    assert.equal(result.authenticated, false);
    if (result.authenticated) return;
    assert.equal(result.statusCode, 401);
    assert.ok(result.error.includes("Unknown"));
  });

  it("rejects when no credentials are provided", async () => {
    const result = await adapter.authenticate({
      path: "/v1/chat/completions",
      method: "POST",
    });
    assert.equal(result.authenticated, false);
    if (result.authenticated) return;
    assert.equal(result.statusCode, 401);
    assert.ok(result.error.includes("Missing"));
  });

  it("healthCheck always returns true", async () => {
    const healthy = await adapter.healthCheck?.();
    assert.equal(healthy, true);
  });
});

// ---- Adapter Chaining (resolveGatewayAuth) --------------------------------

describe("resolveGatewayAuth", () => {
  const staticAdapter = createGatewayStaticKeyAuthAdapter({
    keys: new Map([["sk-static", { projectId: "proj-s", tenantId: "tenant-s", scopes: ["relay"] }]]),
  });

  function createRejectingAdapter(name: string): GatewayAuthAdapter {
    return {
      name,
      async authenticate(): Promise<import("./auth-adapter").GatewayAuthResult> {
        return { authenticated: false, error: `Rejected by ${name}`, statusCode: 401 };
      },
    };
  }

  it("returns success from the first adapter that authenticates", async () => {
    const rejecting = createRejectingAdapter("always-reject");
    const result = await resolveGatewayAuth(
      { apiKey: "sk-static", path: "/v1/chat/completions", method: "POST" },
      [rejecting, staticAdapter],
    );
    assert.equal(result.authenticated, true);
    if (!result.authenticated) return;
    assert.equal(result.projectId, "proj-s");
  });

  it("short-circuits on the first successful adapter", async () => {
    const secondStatic = createGatewayStaticKeyAuthAdapter({
      keys: new Map([["sk-static", { projectId: "proj-other", tenantId: "tenant-other", scopes: ["admin"] }]]),
    });
    const result = await resolveGatewayAuth(
      { apiKey: "sk-static", path: "/", method: "GET" },
      [staticAdapter, secondStatic],
    );
    assert.equal(result.authenticated, true);
    if (!result.authenticated) return;
    assert.equal(result.projectId, "proj-s");
  });

  it("returns the last failure when all adapters reject", async () => {
    const first = createRejectingAdapter("first");
    const second = createRejectingAdapter("second");
    const result = await resolveGatewayAuth(
      { apiKey: "bad-key", path: "/", method: "GET" },
      [first, second],
    );
    assert.equal(result.authenticated, false);
    if (result.authenticated) return;
    assert.ok(result.error.includes("second"));
  });

  it("returns error when no adapters are provided", async () => {
    const result = await resolveGatewayAuth(
      { apiKey: "any", path: "/", method: "GET" },
      [],
    );
    assert.equal(result.authenticated, false);
    if (result.authenticated) return;
    assert.equal(result.statusCode, 500);
    assert.ok(result.error.includes("No auth adapters"));
  });
});

// ---- extractGatewayAuthRequest --------------------------------------------

describe("extractGatewayAuthRequest", () => {
  it("extracts Authorization header", () => {
    const req = extractGatewayAuthRequest(
      { authorization: "Bearer my-token" },
      "/v1/chat/completions",
      "post",
    );
    assert.equal(req.authorization, "Bearer my-token");
    assert.equal(req.apiKey, undefined);
    assert.equal(req.path, "/v1/chat/completions");
    assert.equal(req.method, "POST");
  });

  it("extracts X-Api-Key header", () => {
    const req = extractGatewayAuthRequest(
      { "x-api-key": "sk-12345" },
      "/v1/models",
      "GET",
    );
    assert.equal(req.apiKey, "sk-12345");
    assert.equal(req.authorization, undefined);
  });

  it("handles capitalized header names", () => {
    const req = extractGatewayAuthRequest(
      { Authorization: "Bearer cap-token", "X-Api-Key": "cap-key" },
      "/",
      "get",
    );
    assert.equal(req.authorization, "Bearer cap-token");
    assert.equal(req.apiKey, "cap-key");
  });

  it("handles array header values by taking the first element", () => {
    const req = extractGatewayAuthRequest(
      { authorization: ["Bearer first", "Bearer second"] },
      "/",
      "get",
    );
    assert.equal(req.authorization, "Bearer first");
  });

  it("handles missing headers gracefully", () => {
    const req = extractGatewayAuthRequest({}, "/health", "get");
    assert.equal(req.authorization, undefined);
    assert.equal(req.apiKey, undefined);
    assert.equal(req.path, "/health");
    assert.equal(req.method, "GET");
  });
});
