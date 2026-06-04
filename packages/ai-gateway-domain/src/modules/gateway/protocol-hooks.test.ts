import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  runAfterPackHooks,
  runBeforeSendHooks,
  runAfterReceiveHooks,
  runBeforeUnpackHooks,
  createMistralToolIdHook,
  createHeaderInjectionHook,
  createRequestEnvelopeHook,
  createFieldInjectionHook,
  resolveHooksForProvider,
  type GatewayProtocolHook,
  type ProtocolHookContext,
} from "./protocol-hooks";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ProtocolHookContext> = {}): ProtocolHookContext {
  return {
    model: "mistral-large-latest",
    provider: "mistral",
    adapter: "openai_compatible",
    action: "generate",
    authExtra: {},
    ...overrides,
  };
}

// ---- Deterministic Mistral ID helper (mirrors the implementation) ----------

function expectedMistralId(originalId: string): string {
  return createHash("sha256").update(originalId).digest("hex").slice(0, 9);
}

// ---------------------------------------------------------------------------
// runAfterPackHooks
// ---------------------------------------------------------------------------

describe("runAfterPackHooks", () => {
  it("calls afterPack on every hook in order", () => {
    const order: number[] = [];

    const hook1: GatewayProtocolHook = {
      name: "h1",
      afterPack(_ctx, body) {
        order.push(1);
        body["from_h1"] = true;
      },
    };
    const hook2: GatewayProtocolHook = {
      name: "h2",
      afterPack(_ctx, body) {
        order.push(2);
        body["from_h2"] = true;
      },
    };

    const body: Record<string, unknown> = {};
    runAfterPackHooks([hook1, hook2], makeCtx(), body);

    assert.deepEqual(order, [1, 2]);
    assert.equal(body["from_h1"], true);
    assert.equal(body["from_h2"], true);
  });

  it("skips hooks that do not implement afterPack", () => {
    const noOp: GatewayProtocolHook = { name: "no-op" };
    const body: Record<string, unknown> = { x: 1 };
    // Should not throw
    runAfterPackHooks([noOp], makeCtx(), body);
    assert.equal(body["x"], 1);
  });

  it("does nothing when hook list is empty", () => {
    const body: Record<string, unknown> = { x: 42 };
    runAfterPackHooks([], makeCtx(), body);
    assert.equal(body["x"], 42);
  });
});

// ---------------------------------------------------------------------------
// runBeforeSendHooks
// ---------------------------------------------------------------------------

describe("runBeforeSendHooks", () => {
  it("calls beforeSend on every hook in order", () => {
    const order: number[] = [];

    const hook1: GatewayProtocolHook = {
      name: "h1",
      beforeSend(_ctx, headers) {
        order.push(1);
        headers["x-from-h1"] = "yes";
      },
    };
    const hook2: GatewayProtocolHook = {
      name: "h2",
      beforeSend(_ctx, headers) {
        order.push(2);
        headers["x-from-h2"] = "yes";
      },
    };

    const headers: Record<string, string> = {};
    runBeforeSendHooks([hook1, hook2], makeCtx(), headers);

    assert.deepEqual(order, [1, 2]);
    assert.equal(headers["x-from-h1"], "yes");
    assert.equal(headers["x-from-h2"], "yes");
  });

  it("skips hooks that do not implement beforeSend", () => {
    const noOp: GatewayProtocolHook = { name: "no-op" };
    const headers: Record<string, string> = { existing: "value" };
    runBeforeSendHooks([noOp], makeCtx(), headers);
    assert.equal(headers["existing"], "value");
  });
});

// ---------------------------------------------------------------------------
// runAfterReceiveHooks
// ---------------------------------------------------------------------------

describe("runAfterReceiveHooks", () => {
  it("calls afterReceive on every hook in order", () => {
    const order: number[] = [];

    const hook1: GatewayProtocolHook = {
      name: "h1",
      afterReceive(_ctx, responseHeaders) {
        order.push(1);
        responseHeaders["x-intercepted-by"] = "h1";
      },
    };
    const hook2: GatewayProtocolHook = {
      name: "h2",
      afterReceive(_ctx, responseHeaders) {
        order.push(2);
        responseHeaders["x-also-intercepted-by"] = "h2";
      },
    };

    const responseHeaders: Record<string, string> = {};
    runAfterReceiveHooks([hook1, hook2], makeCtx(), responseHeaders);

    assert.deepEqual(order, [1, 2]);
    assert.equal(responseHeaders["x-intercepted-by"], "h1");
    assert.equal(responseHeaders["x-also-intercepted-by"], "h2");
  });

  it("skips hooks that do not implement afterReceive", () => {
    const noOp: GatewayProtocolHook = { name: "no-op" };
    const headers: Record<string, string> = { keep: "this" };
    runAfterReceiveHooks([noOp], makeCtx(), headers);
    assert.equal(headers["keep"], "this");
  });
});

// ---------------------------------------------------------------------------
// runBeforeUnpackHooks
// ---------------------------------------------------------------------------

describe("runBeforeUnpackHooks", () => {
  it("calls beforeUnpack on every hook in order", () => {
    const order: number[] = [];

    const hook1: GatewayProtocolHook = {
      name: "h1",
      beforeUnpack(_ctx, data) {
        order.push(1);
        data["patched_by_h1"] = true;
      },
    };
    const hook2: GatewayProtocolHook = {
      name: "h2",
      beforeUnpack(_ctx, data) {
        order.push(2);
        data["patched_by_h2"] = true;
      },
    };

    const data: Record<string, unknown> = {};
    runBeforeUnpackHooks([hook1, hook2], makeCtx(), data);

    assert.deepEqual(order, [1, 2]);
    assert.equal(data["patched_by_h1"], true);
    assert.equal(data["patched_by_h2"], true);
  });

  it("skips hooks that do not implement beforeUnpack", () => {
    const noOp: GatewayProtocolHook = { name: "no-op" };
    const data: Record<string, unknown> = { result: "ok" };
    runBeforeUnpackHooks([noOp], makeCtx(), data);
    assert.equal(data["result"], "ok");
  });
});

// ---------------------------------------------------------------------------
// createMistralToolIdHook
// ---------------------------------------------------------------------------

describe("createMistralToolIdHook", () => {
  const hook = createMistralToolIdHook();
  const ctx = makeCtx();

  it("rewrites tool_call ids in assistant messages to 9-char alphanumeric strings", () => {
    const body: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            { id: "call_abc123longid", function: { name: "get_weather", arguments: "{}" } },
            { id: "call_xyz789longid", function: { name: "search", arguments: "{}" } },
          ],
        },
      ],
    };

    hook.afterPack?.(ctx, body);

    const messages = body["messages"] as Record<string, unknown>[];
    const toolCalls = messages[0]["tool_calls"] as Record<string, unknown>[];

    const id0 = toolCalls[0]["id"] as string;
    const id1 = toolCalls[1]["id"] as string;

    assert.equal(id0.length, 9);
    assert.equal(id1.length, 9);
    assert.match(id0, /^[0-9a-f]{9}$/);
    assert.match(id1, /^[0-9a-f]{9}$/);
  });

  it("produces deterministic ids from the same original id", () => {
    const body1: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "call_deterministic", function: { name: "fn", arguments: "{}" } }],
        },
      ],
    };
    const body2: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "call_deterministic", function: { name: "fn", arguments: "{}" } }],
        },
      ],
    };

    hook.afterPack?.(ctx, body1);
    hook.afterPack?.(ctx, body2);

    const id1 = ((body1["messages"] as Record<string, unknown>[])[0]["tool_calls"] as Record<string, unknown>[])[0]["id"];
    const id2 = ((body2["messages"] as Record<string, unknown>[])[0]["tool_calls"] as Record<string, unknown>[])[0]["id"];

    assert.equal(id1, id2);
    assert.equal(id1, expectedMistralId("call_deterministic"));
  });

  it("rewrites matching tool_call_id references in tool-role messages", () => {
    const originalId = "call_long_original_id";
    const expectedId = expectedMistralId(originalId);

    const body: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            { id: originalId, function: { name: "fn", arguments: "{}" } },
          ],
        },
        {
          role: "tool",
          tool_call_id: originalId,
          content: "result",
        },
      ],
    };

    hook.afterPack?.(ctx, body);

    const messages = body["messages"] as Record<string, unknown>[];
    const assistantMsg = messages[0] as Record<string, unknown>;
    const toolMsg = messages[1] as Record<string, unknown>;

    const rewrittenCallId = ((assistantMsg["tool_calls"] as Record<string, unknown>[])[0])["id"];
    const rewrittenRef = toolMsg["tool_call_id"];

    assert.equal(rewrittenCallId, expectedId);
    assert.equal(rewrittenRef, expectedId);
    // Both must be in sync
    assert.equal(rewrittenCallId, rewrittenRef);
  });

  it("leaves tool_call_id references unchanged when there is no corresponding tool_call", () => {
    const body: Record<string, unknown> = {
      messages: [
        {
          role: "tool",
          tool_call_id: "orphan_ref",
          content: "result",
        },
      ],
    };

    hook.afterPack?.(ctx, body);

    const messages = body["messages"] as Record<string, unknown>[];
    assert.equal((messages[0] as Record<string, unknown>)["tool_call_id"], "orphan_ref");
  });

  it("handles multiple tool calls each getting unique deterministic ids", () => {
    const body: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            { id: "id-alpha", function: { name: "a", arguments: "{}" } },
            { id: "id-beta", function: { name: "b", arguments: "{}" } },
          ],
        },
        { role: "tool", tool_call_id: "id-alpha", content: "a-result" },
        { role: "tool", tool_call_id: "id-beta", content: "b-result" },
      ],
    };

    hook.afterPack?.(ctx, body);

    const messages = body["messages"] as Record<string, unknown>[];
    const toolCalls = (messages[0] as Record<string, unknown>)["tool_calls"] as Record<string, unknown>[];

    const rewrittenAlpha = toolCalls[0]["id"] as string;
    const rewrittenBeta = toolCalls[1]["id"] as string;

    assert.notEqual(rewrittenAlpha, rewrittenBeta);
    assert.equal(rewrittenAlpha, expectedMistralId("id-alpha"));
    assert.equal(rewrittenBeta, expectedMistralId("id-beta"));

    assert.equal((messages[1] as Record<string, unknown>)["tool_call_id"], rewrittenAlpha);
    assert.equal((messages[2] as Record<string, unknown>)["tool_call_id"], rewrittenBeta);
  });

  it("does nothing when messages array is absent", () => {
    const body: Record<string, unknown> = { model: "mistral-large" };
    // Must not throw
    hook.afterPack?.(ctx, body);
    assert.equal(body["model"], "mistral-large");
  });

  it("does nothing when no messages have tool_calls", () => {
    const body: Record<string, unknown> = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ],
    };
    hook.afterPack?.(ctx, body);
    const messages = body["messages"] as Record<string, unknown>[];
    assert.equal((messages[0] as Record<string, unknown>)["content"], "Hello");
    assert.equal((messages[1] as Record<string, unknown>)["content"], "Hi!");
  });
});

// ---------------------------------------------------------------------------
// createHeaderInjectionHook
// ---------------------------------------------------------------------------

describe("createHeaderInjectionHook", () => {
  it("injects all provided headers into the outgoing headers", () => {
    const hook = createHeaderInjectionHook({
      "anthropic-beta": "prompt-caching-2024-07-31",
      "x-custom-flag": "enabled",
    });

    const headers: Record<string, string> = {};
    hook.beforeSend?.(makeCtx(), headers);

    assert.equal(headers["anthropic-beta"], "prompt-caching-2024-07-31");
    assert.equal(headers["x-custom-flag"], "enabled");
  });

  it("overwrites existing headers with the same key", () => {
    const hook = createHeaderInjectionHook({ "content-type": "application/json" });
    const headers: Record<string, string> = { "content-type": "text/plain" };
    hook.beforeSend?.(makeCtx(), headers);
    assert.equal(headers["content-type"], "application/json");
  });

  it("preserves unrelated existing headers", () => {
    const hook = createHeaderInjectionHook({ "x-injected": "yes" });
    const headers: Record<string, string> = { authorization: "Bearer tok" };
    hook.beforeSend?.(makeCtx(), headers);
    assert.equal(headers["authorization"], "Bearer tok");
    assert.equal(headers["x-injected"], "yes");
  });

  it("does nothing when given an empty headers map", () => {
    const hook = createHeaderInjectionHook({});
    const headers: Record<string, string> = { keep: "me" };
    hook.beforeSend?.(makeCtx(), headers);
    assert.equal(headers["keep"], "me");
    assert.equal(Object.keys(headers).length, 1);
  });

  it("does not implement afterPack, afterReceive, or beforeUnpack", () => {
    const hook = createHeaderInjectionHook({ "x": "y" });
    assert.equal(hook.afterPack, undefined);
    assert.equal(hook.afterReceive, undefined);
    assert.equal(hook.beforeUnpack, undefined);
  });
});

// ---------------------------------------------------------------------------
// createRequestEnvelopeHook
// ---------------------------------------------------------------------------

describe("createRequestEnvelopeHook", () => {
  it("wraps the body under the specified wrapKey", () => {
    const hook = createRequestEnvelopeHook({ wrapKey: "prompt" });
    const body: Record<string, unknown> = { model: "gpt-4", messages: [] };
    hook.afterPack?.(makeCtx(), body);

    assert.ok("prompt" in body);
    const inner = body["prompt"] as Record<string, unknown>;
    assert.equal(inner["model"], "gpt-4");
    assert.deepEqual(inner["messages"], []);
    // The top-level keys from the original body must be gone
    assert.equal("model" in body, false);
    assert.equal("messages" in body, false);
  });

  it("merges extraFields at the top level alongside wrapKey", () => {
    const hook = createRequestEnvelopeHook({
      wrapKey: "request",
      extraFields: { project: "abc", version: 2 },
    });
    const body: Record<string, unknown> = { stream: true };
    hook.afterPack?.(makeCtx(), body);

    assert.ok("request" in body);
    assert.equal(body["project"], "abc");
    assert.equal(body["version"], 2);
    assert.equal((body["request"] as Record<string, unknown>)["stream"], true);
  });

  it("works with an empty body", () => {
    const hook = createRequestEnvelopeHook({ wrapKey: "data" });
    const body: Record<string, unknown> = {};
    hook.afterPack?.(makeCtx(), body);
    assert.ok("data" in body);
    assert.deepEqual(body["data"], {});
  });

  it("does not implement beforeSend, afterReceive, or beforeUnpack", () => {
    const hook = createRequestEnvelopeHook({ wrapKey: "x" });
    assert.equal(hook.beforeSend, undefined);
    assert.equal(hook.afterReceive, undefined);
    assert.equal(hook.beforeUnpack, undefined);
  });
});

// ---------------------------------------------------------------------------
// createFieldInjectionHook
// ---------------------------------------------------------------------------

describe("createFieldInjectionHook", () => {
  it("injects fields that do not already exist in the body", () => {
    const hook = createFieldInjectionHook({ enable_enhancement: true, temperature: 0.7 });
    const body: Record<string, unknown> = { model: "llama3" };
    hook.afterPack?.(makeCtx(), body);

    assert.equal(body["enable_enhancement"], true);
    assert.equal(body["temperature"], 0.7);
    assert.equal(body["model"], "llama3");
  });

  it("does NOT overwrite fields that already exist in the body", () => {
    const hook = createFieldInjectionHook({ temperature: 0.7, stream: false });
    const body: Record<string, unknown> = { temperature: 1.0, stream: true };
    hook.afterPack?.(makeCtx(), body);

    assert.equal(body["temperature"], 1.0);
    assert.equal(body["stream"], true);
  });

  it("handles a mix of new and existing keys correctly", () => {
    const hook = createFieldInjectionHook({ a: "injected", b: "injected" });
    const body: Record<string, unknown> = { a: "original" };
    hook.afterPack?.(makeCtx(), body);

    assert.equal(body["a"], "original");   // must not be overwritten
    assert.equal(body["b"], "injected");   // new field must be injected
  });

  it("does nothing when the fields map is empty", () => {
    const hook = createFieldInjectionHook({});
    const body: Record<string, unknown> = { x: 1 };
    hook.afterPack?.(makeCtx(), body);
    assert.deepEqual(body, { x: 1 });
  });

  it("does not implement beforeSend, afterReceive, or beforeUnpack", () => {
    const hook = createFieldInjectionHook({});
    assert.equal(hook.beforeSend, undefined);
    assert.equal(hook.afterReceive, undefined);
    assert.equal(hook.beforeUnpack, undefined);
  });
});

// ---------------------------------------------------------------------------
// resolveHooksForProvider
// ---------------------------------------------------------------------------

describe("resolveHooksForProvider", () => {
  it("returns a chain containing the Mistral tool-id hook for the mistral provider", () => {
    const hooks = resolveHooksForProvider("mistral", "openai_compatible");
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0].name, "mistral-tool-id");
  });

  it("returns an empty chain for openai", () => {
    const hooks = resolveHooksForProvider("openai", "openai_compatible");
    assert.equal(hooks.length, 0);
  });

  it("returns an empty chain for anthropic", () => {
    const hooks = resolveHooksForProvider("anthropic", "anthropic_compatible");
    assert.equal(hooks.length, 0);
  });

  it("returns an empty chain for an unknown provider", () => {
    const hooks = resolveHooksForProvider("unknown-provider-xyz", "openai_compatible");
    assert.equal(hooks.length, 0);
  });

  it("the resolved Mistral hook is functional (rewrites tool_call ids end-to-end)", () => {
    const hooks = resolveHooksForProvider("mistral", "openai_compatible");
    const body: Record<string, unknown> = {
      messages: [
        {
          role: "assistant",
          tool_calls: [{ id: "very-long-original-id", function: { name: "fn", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "very-long-original-id", content: "res" },
      ],
    };

    runAfterPackHooks(hooks, makeCtx(), body);

    const messages = body["messages"] as Record<string, unknown>[];
    const rewrittenCall = ((messages[0] as Record<string, unknown>)["tool_calls"] as Record<string, unknown>[])[0]["id"] as string;
    const rewrittenRef = (messages[1] as Record<string, unknown>)["tool_call_id"] as string;

    assert.equal(rewrittenCall.length, 9);
    assert.equal(rewrittenCall, expectedMistralId("very-long-original-id"));
    assert.equal(rewrittenCall, rewrittenRef);
  });
});
