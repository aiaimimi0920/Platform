import assert from "node:assert/strict";
import test from "node:test";

import { buildProviderPayload } from "./provider-create-payload";

test("provider create payload treats Gemini API modular like the Rust Gemini API adapter", () => {
  const payload = buildProviderPayload({
    adapter: "gemini_api_modular_compatible",
    accountLabel: "Gemini API Modular",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-pro",
    authMode: "x-goog-api-key",
  });

  assert.equal(payload.adapter, "gemini_api_modular_compatible");
  assert.equal(payload.authHeaderName, "X-Goog-Api-Key");
  assert.equal(payload.authToken, "");
  assert.equal("authMode" in payload, false);
});

test("provider create payload omits authMode for no-auth web reverse adapters", () => {
  for (const adapter of [
    "aistudio_web_reverse_compatible",
    "gemini_web_reverse_modular_compatible",
  ]) {
    const payload = buildProviderPayload({
      adapter,
      accountLabel: adapter,
      baseUrl: "https://example.test",
      defaultModel: null,
      authMode: "none",
      defaultPayloadPatch: {
        extraBody: {
          marker: adapter,
        },
      },
    });

    assert.equal(payload.adapter, adapter);
    assert.equal("authMode" in payload, false);
    assert.deepEqual(payload.extraBody, { marker: adapter });
  }
});
