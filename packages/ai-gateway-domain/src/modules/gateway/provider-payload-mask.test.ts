import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GatewayProviderAccountPayload } from "@neuro/contracts";
import { maskGatewayProviderPayload } from "./provider-payload-mask";

describe("maskGatewayProviderPayload", () => {
  it("masks browser-backed secrets while preserving runtime routing fields", () => {
    const payload: GatewayProviderAccountPayload = {
      adapter: "openai_compatible",
      accountLabel: "ChatGPT Web Account",
      baseUrl: "https://chatgpt.com/backend-api",
      apiKey: "browser-session-api-key",
      headers: {
        Cookie: "__Secure-next-auth.session-token=secret-cookie",
        "User-Agent": "Mozilla/5.0",
      },
      extraBody: {
        credentialMaterialKey: "chatgpt-session-main",
        appUrl: "https://chatgpt.com",
      },
      credentialId: "cred-chatgpt-main",
      sessionAuth: {
        transport: "bearer",
        headerName: "authorization",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
      keepalive: {
        serviceUrl: "http://keepalive.local",
        ensurePath: "/ensure",
        authToken: "keepalive-secret-token",
        timeoutSecs: 30,
        refreshBeforeSecs: 120,
      },
      expiresAt: "2030-01-01T00:00:00.000Z",
      runtimeStateObjectKey: "ai-gateway/runtime/chatgpt-main.json",
      accountName: "chatgpt-main",
    };

    const masked = maskGatewayProviderPayload(payload);

    assert.equal(masked.adapter, "openai_compatible");
    assert.equal(masked.credentialId, "cred-chatgpt-main");
    assert.deepEqual(masked.sessionAuth, payload.sessionAuth);
    assert.equal(masked.expiresAt, "2030-01-01T00:00:00.000Z");
    assert.equal(masked.runtimeStateObjectKey, "ai-gateway/runtime/chatgpt-main.json");
    assert.equal(masked.accountName, "chatgpt-main");
    assert.deepEqual(masked.extraBody, payload.extraBody);

    assert.notEqual(masked.apiKey, payload.apiKey);
    assert.match(masked.apiKey, /\*\*\*/);
    assert.notEqual(masked.headers?.Cookie, payload.headers?.Cookie);
    assert.equal(masked.headers?.["User-Agent"], "Mozilla/5.0");
    assert.notEqual(masked.keepalive?.authToken, payload.keepalive?.authToken);
    assert.equal(masked.keepalive?.serviceUrl, "http://keepalive.local");
  });

  it("masks generic authToken headers without dropping unknown adapter fields", () => {
    const payload = {
      adapter: "future_adapter",
      baseUrl: "https://future.example.test",
      accountLabel: "Future",
      authToken: "future-auth-token",
      headers: {
        Authorization: "Bearer future-secret",
        "X-Trace": "trace-id",
      },
      runtimeStateObjectKey: "runtime/future.json",
      extraBody: {
        credentialMaterialKey: "future-material",
      },
    } as unknown as GatewayProviderAccountPayload;

    const masked = maskGatewayProviderPayload(payload) as typeof payload & {
      authToken?: string | null;
      headers?: Record<string, string> | null;
      runtimeStateObjectKey?: string | null;
      extraBody?: Record<string, unknown> | null;
    };

    assert.equal(masked.adapter, "future_adapter");
    assert.equal(masked.runtimeStateObjectKey, "runtime/future.json");
    assert.deepEqual(masked.extraBody, { credentialMaterialKey: "future-material" });
    assert.notEqual(masked.authToken, "future-auth-token");
    assert.notEqual(masked.headers?.Authorization, "Bearer future-secret");
    assert.equal(masked.headers?.["X-Trace"], "trace-id");
  });

  it("masks legacy snake_case secret fields without dropping runtime fields", () => {
    const payload = {
      adapter: "openai_compatible",
      account_label: "Legacy OpenAI",
      base_url: "https://api.openai.com/v1",
      api_key: "sk-legacy-secret",
      auth_token: "legacy-auth-token",
      headers: {
        Cookie: "legacy-cookie-secret",
        "X-Trace": "trace-id",
      },
      extra_body: {
        credentialMaterialKey: "legacy-material",
      },
      runtime_state_object_key: "runtime/legacy.json",
      session_auth: {
        transport: "bearer",
        header_name: "authorization",
      },
    } as unknown as GatewayProviderAccountPayload;

    const masked = maskGatewayProviderPayload(payload) as typeof payload & {
      api_key?: string | null;
      auth_token?: string | null;
      headers?: Record<string, string> | null;
      extra_body?: Record<string, unknown> | null;
      runtime_state_object_key?: string | null;
      session_auth?: Record<string, unknown> | null;
    };

    assert.equal(masked.adapter, "openai_compatible");
    assert.equal(masked.runtime_state_object_key, "runtime/legacy.json");
    assert.deepEqual(masked.extra_body, { credentialMaterialKey: "legacy-material" });
    assert.deepEqual(masked.session_auth, {
      transport: "bearer",
      header_name: "authorization",
    });
    assert.notEqual(masked.api_key, "sk-legacy-secret");
    assert.match(masked.api_key ?? "", /\*\*\*/);
    assert.notEqual(masked.auth_token, "legacy-auth-token");
    assert.notEqual(masked.headers?.Cookie, "legacy-cookie-secret");
    assert.equal(masked.headers?.["X-Trace"], "trace-id");
  });
});
