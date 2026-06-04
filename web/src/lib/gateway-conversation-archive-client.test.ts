import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { InternalUserContext } from "@neuro/contracts";

type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown,
) => string;

test("conversation archive export sends a JSON object body exactly once", async () => {
  const previousCwd = process.cwd();
  const webRoot = fileURLToPath(new URL("../..", import.meta.url));
  process.chdir(webRoot);
  process.env.AI_GATEWAY_INTERNAL_URL = "http://gateway-test.local";
  process.env.AI_GATEWAY_MANAGEMENT_TOKEN = "management-token";

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const previousFetch = globalThis.fetch;
  const moduleResolver = Module as unknown as { _resolveFilename: ResolveFilename };
  const previousResolveFilename = moduleResolver._resolveFilename;
  moduleResolver._resolveFilename = function resolveWebAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const aliasTarget = path.join(webRoot, "src", request.slice(2));
      return previousResolveFilename.call(this, aliasTarget, parent, isMain, options);
    }
    return previousResolveFilename.call(this, request, parent, isMain, options);
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        export: {
          exportId: "export-1",
          datasetObjectKey: "gateway/conversation-archives/exports/export-1.ndjson",
          rowCount: 2,
          createdAt: "2026-05-30T00:00:00Z",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const { exportOperatorGatewayConversationArchives } = await import("./account-client");
    const userContext: InternalUserContext = {
      userId: "operator-1",
      username: "operator",
    };

    const result = await exportOperatorGatewayConversationArchives(userContext, {
      status: "completed",
      limit: 2,
    });

    assert.equal(result.exportId, "export-1");
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.url,
      "http://gateway-test.local/v1/internal/gateway/conversation-archives/export",
    );
    assert.equal(requests[0]?.init?.method, "POST");
    assert.equal(requests[0]?.init?.body, JSON.stringify({ status: "completed", limit: 2 }));
    assert.notEqual(
      requests[0]?.init?.body,
      JSON.stringify(JSON.stringify({ status: "completed", limit: 2 })),
    );
    assert.equal(
      (requests[0]?.init?.headers as Record<string, string>)["content-type"],
      "application/json",
    );
  } finally {
    globalThis.fetch = previousFetch;
    moduleResolver._resolveFilename = previousResolveFilename;
    process.chdir(previousCwd);
  }
});

test("provider account upsert flattens sourceProfile for the Rust gateway API", async () => {
  const previousCwd = process.cwd();
  const webRoot = fileURLToPath(new URL("../..", import.meta.url));
  process.chdir(webRoot);
  process.env.AI_GATEWAY_INTERNAL_URL = "http://gateway-test.local";
  process.env.AI_GATEWAY_MANAGEMENT_TOKEN = "management-token";

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const previousFetch = globalThis.fetch;
  const moduleResolver = Module as unknown as { _resolveFilename: ResolveFilename };
  const previousResolveFilename = moduleResolver._resolveFilename;
  moduleResolver._resolveFilename = function resolveWebAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const aliasTarget = path.join(webRoot, "src", request.slice(2));
      return previousResolveFilename.call(this, aliasTarget, parent, isMain, options);
    }
    return previousResolveFilename.call(this, request, parent, isMain, options);
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        providerAccount: {
          id: "provider-1",
          label: "Provider",
          serviceProviderKey: "provider",
          serviceProviderLabel: "Provider",
          adapter: "openai_compatible",
          protocolFamily: "openai",
          protocolProfile: "openai_compatible_generic",
          status: "active",
          sourceProfile: {
            sourceKind: "aggregator_api",
            aggregatorApiMode: "hosted_compute",
            webReverseAccessMode: null,
            notes: "operator note",
            derived: false,
          },
          payload: {},
          storageMode: "database",
          cooldownUntil: null,
          lastError: null,
          failureCount: 0,
          lastHealthCheckAt: null,
          createdAt: "2026-06-02T00:00:00Z",
          updatedAt: "2026-06-02T00:00:00Z",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const { createOperatorGatewayProviderAccount } = await import("./account-client");
    const userContext: InternalUserContext = {
      userId: "operator-1",
      username: "operator",
    };

    await createOperatorGatewayProviderAccount(userContext, {
      label: "Provider",
      serviceProviderKey: "provider",
      serviceProviderLabel: "Provider",
      adapter: "openai_compatible",
      protocolFamily: "openai",
      protocolProfile: "openai_compatible_generic",
      status: "active",
      sourceProfile: {
        sourceKind: "aggregator_api",
        aggregatorApiMode: "hosted_compute",
        webReverseAccessMode: null,
        notes: "operator note",
      },
      executionMode: "direct_http",
      payload: {
        adapter: "openai_compatible",
        baseUrl: "https://example.invalid",
        accountLabel: "Provider",
        apiKey: "",
      },
    });

    assert.equal(requests.length, 1);
    const body = JSON.parse(String(requests[0]?.init?.body ?? "{}")) as Record<string, unknown>;
    assert.equal(body.sourceKind, "aggregator_api");
    assert.equal(body.aggregatorApiMode, "hosted_compute");
    assert.equal(body.webReverseAccessMode, null);
    assert.equal(body.sourceNotes, "operator note");
    assert.equal("sourceProfile" in body, false);
  } finally {
    globalThis.fetch = previousFetch;
    moduleResolver._resolveFilename = previousResolveFilename;
    process.chdir(previousCwd);
  }
});
