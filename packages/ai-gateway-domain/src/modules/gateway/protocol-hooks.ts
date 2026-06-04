// ---------------------------------------------------------------------------
// Protocol Hooks – per-provider mutation layer for the AI gateway relay.
//
// Inspired by the Rust gateway's ProtocolHook trait, this module defines
// four interception points in the request/response lifecycle:
//
//   afterPack      → mutate the serialised JSON body before sending
//   beforeSend     → mutate outgoing HTTP headers before sending
//   afterReceive   → inspect / modify response headers after receiving
//   beforeUnpack   → mutate raw response data before deserialisation
//
// Provider-specific quirks (Mistral tool_call_id length, header injections,
// envelope wrapping, …) live here rather than in the core protocol serialiser.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

// ---- Types -----------------------------------------------------------------

export type ProtocolHookContext = {
  model: string;
  provider: string;   // e.g. "openai", "anthropic", "mistral"
  adapter: string;    // e.g. "openai_compatible", "anthropic_compatible"
  action: "generate" | "stream" | "embed";
  authExtra: Record<string, unknown>; // extra data from auth (e.g. project_id for Vertex)
};

/** The hook interface — all lifecycle methods are optional. */
export interface GatewayProtocolHook {
  name: string;

  /** Mutate the packed JSON body after format serialisation, before sending. */
  afterPack?(ctx: ProtocolHookContext, body: Record<string, unknown>): void;

  /** Mutate outgoing HTTP headers before sending the request. */
  beforeSend?(ctx: ProtocolHookContext, headers: Record<string, string>): void;

  /** Inspect / modify response headers after receiving the upstream response. */
  afterReceive?(ctx: ProtocolHookContext, responseHeaders: Record<string, string>): void;

  /** Mutate raw response data before format deserialisation. */
  beforeUnpack?(ctx: ProtocolHookContext, data: Record<string, unknown>): void;
}

// ---- Hook runners ----------------------------------------------------------

/**
 * Run all hooks' `afterPack` in order.
 * Each hook receives (and may mutate) the body in place.
 */
export function runAfterPackHooks(
  hooks: GatewayProtocolHook[],
  ctx: ProtocolHookContext,
  body: Record<string, unknown>,
): void {
  for (const hook of hooks) {
    hook.afterPack?.(ctx, body);
  }
}

/**
 * Run all hooks' `beforeSend` in order.
 * Each hook receives (and may mutate) the outgoing headers in place.
 */
export function runBeforeSendHooks(
  hooks: GatewayProtocolHook[],
  ctx: ProtocolHookContext,
  headers: Record<string, string>,
): void {
  for (const hook of hooks) {
    hook.beforeSend?.(ctx, headers);
  }
}

/**
 * Run all hooks' `afterReceive` in order.
 * Each hook receives (and may mutate) the response headers in place.
 */
export function runAfterReceiveHooks(
  hooks: GatewayProtocolHook[],
  ctx: ProtocolHookContext,
  responseHeaders: Record<string, string>,
): void {
  for (const hook of hooks) {
    hook.afterReceive?.(ctx, responseHeaders);
  }
}

/**
 * Run all hooks' `beforeUnpack` in order.
 * Each hook receives (and may mutate) the raw response data in place.
 */
export function runBeforeUnpackHooks(
  hooks: GatewayProtocolHook[],
  ctx: ProtocolHookContext,
  data: Record<string, unknown>,
): void {
  for (const hook of hooks) {
    hook.beforeUnpack?.(ctx, data);
  }
}

// ---- Built-in: Mistral tool_call_id normaliser ----------------------------

/**
 * Deterministically maps an arbitrary tool_call_id to a 9-character
 * alphanumeric string by hashing it with SHA-256 and taking the first
 * 9 characters of the hex digest (all hex chars are [0-9a-f], which is
 * already alphanumeric).
 */
function toMistralToolCallId(originalId: string): string {
  return createHash("sha256").update(originalId).digest("hex").slice(0, 9);
}

/**
 * `createMistralToolIdHook`
 *
 * Mistral's API rejects tool_call_ids that are not exactly 9 alphanumeric
 * characters long.  This hook rewrites every tool_call.id found in assistant
 * messages and ensures the corresponding tool_call_id references in tool-role
 * messages are updated to match, keeping the conversation consistent.
 *
 * The rewrite is deterministic (SHA-256 of the original id), so the same
 * original id always maps to the same 9-char id within a request.
 */
export function createMistralToolIdHook(): GatewayProtocolHook {
  return {
    name: "mistral-tool-id",

    afterPack(_ctx: ProtocolHookContext, body: Record<string, unknown>): void {
      const messages = body["messages"];
      if (!Array.isArray(messages)) {
        return;
      }

      // First pass: build the rewrite map from assistant tool_call ids.
      const idMap = new Map<string, string>();

      for (const message of messages) {
        if (
          typeof message !== "object" ||
          message === null ||
          !("tool_calls" in message)
        ) {
          continue;
        }

        const toolCalls = (message as Record<string, unknown>)["tool_calls"];
        if (!Array.isArray(toolCalls)) {
          continue;
        }

        for (const toolCall of toolCalls) {
          if (typeof toolCall !== "object" || toolCall === null) {
            continue;
          }
          const tc = toolCall as Record<string, unknown>;
          const originalId = tc["id"];
          if (typeof originalId !== "string") {
            continue;
          }
          if (!idMap.has(originalId)) {
            idMap.set(originalId, toMistralToolCallId(originalId));
          }
          tc["id"] = idMap.get(originalId);
        }
      }

      if (idMap.size === 0) {
        return;
      }

      // Second pass: rewrite tool_call_id references in tool-role messages.
      for (const message of messages) {
        if (typeof message !== "object" || message === null) {
          continue;
        }
        const msg = message as Record<string, unknown>;
        if (msg["role"] !== "tool") {
          continue;
        }
        const ref = msg["tool_call_id"];
        if (typeof ref === "string" && idMap.has(ref)) {
          msg["tool_call_id"] = idMap.get(ref);
        }
      }
    },
  };
}

// ---- Built-in: static header injection ------------------------------------

/**
 * `createHeaderInjectionHook`
 *
 * Injects a fixed set of HTTP headers into every outgoing request.
 * Useful for providers that require extra headers such as
 * `anthropic-beta: prompt-caching-2024-07-31`.
 *
 * Existing headers with the same key are overwritten.
 */
export function createHeaderInjectionHook(
  headers: Record<string, string>,
): GatewayProtocolHook {
  return {
    name: "header-injection",

    beforeSend(
      _ctx: ProtocolHookContext,
      outgoing: Record<string, string>,
    ): void {
      for (const [key, value] of Object.entries(headers)) {
        outgoing[key] = value;
      }
    },
  };
}

// ---- Built-in: request envelope wrapper ------------------------------------

/**
 * `createRequestEnvelopeHook`
 *
 * Wraps the entire request body inside an envelope object before sending.
 * For example, a provider that expects:
 *   `{ "prompt": { ...original body... }, "project": "abc" }`
 * can be handled with:
 *   `createRequestEnvelopeHook({ wrapKey: "prompt", extraFields: { project: "abc" } })`.
 *
 * The original body keys are moved under `wrapKey`; `extraFields` are merged
 * at the top level.
 */
export function createRequestEnvelopeHook(envelope: {
  wrapKey: string;
  extraFields?: Record<string, unknown>;
}): GatewayProtocolHook {
  const { wrapKey, extraFields = {} } = envelope;

  return {
    name: "request-envelope",

    afterPack(_ctx: ProtocolHookContext, body: Record<string, unknown>): void {
      // Snapshot a shallow copy of the current body to nest under wrapKey.
      const inner: Record<string, unknown> = { ...body };

      // Clear all existing keys from body in place.
      for (const key of Object.keys(body)) {
        delete body[key];
      }

      // Rebuild: envelope key first, then extra fields.
      body[wrapKey] = inner;
      for (const [key, value] of Object.entries(extraFields)) {
        body[key] = value;
      }
    },
  };
}

// ---- Built-in: field injection (defaults only) -----------------------------

/**
 * `createFieldInjectionHook`
 *
 * Merges additional fields into the request body (shallow merge).
 * A field is only injected if the key does **not** already exist in the body,
 * preserving any caller-supplied values.
 *
 * Useful for providers that require default fields like
 * `enable_enhancement: true`.
 */
export function createFieldInjectionHook(
  fields: Record<string, unknown>,
): GatewayProtocolHook {
  return {
    name: "field-injection",

    afterPack(_ctx: ProtocolHookContext, body: Record<string, unknown>): void {
      for (const [key, value] of Object.entries(fields)) {
        if (!(key in body)) {
          body[key] = value;
        }
      }
    },
  };
}

// ---- Provider hook resolution ----------------------------------------------

// Singleton instances of built-in hooks that carry no per-call state.
const mistralToolIdHook = createMistralToolIdHook();

/**
 * `resolveHooksForProvider`
 *
 * Returns the canonical hook chain for a known provider/adapter combination.
 * Unknown providers get an empty chain (no-op pass-through).
 *
 * Extend this function to register hooks for additional providers.
 */
export function resolveHooksForProvider(
  provider: string,
  _adapter: string,
): GatewayProtocolHook[] {
  switch (provider) {
    case "mistral":
      return [mistralToolIdHook];

    default:
      return [];
  }
}
