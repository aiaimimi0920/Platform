import assert from "node:assert/strict";
import test from "node:test";

import { InternalResponseBodyTooLargeError } from "@neuro/backend-foundation/platform/internal-request";

import { requestInternalJson } from "./internal-json-request";
import { JsonResponseProtocolError, safeJsonStringify } from "./json";

test("requestInternalJson parses bounded JSON responses", async () => {
  const { response, payload } = await requestInternalJson(
    "https://internal.example.test/status",
    { method: "GET" },
    {
      timeoutMs: 100,
      fetchFn: async () => new Response('{"status":"ok"}', { status: 202 }),
    },
  );

  assert.equal(response.status, 202);
  assert.deepEqual(payload, { status: "ok" });
});

test("requestInternalJson preserves bounded non-JSON error responses for diagnostics", async () => {
  const { payload } = await requestInternalJson(
    "https://internal.example.test/status",
    { method: "GET" },
    {
      timeoutMs: 100,
      fetchFn: async () => new Response("  upstream unavailable  ", { status: 502 }),
    },
  );

  assert.deepEqual(payload, { rawText: "  upstream unavailable  " });
});

test("requestInternalJson rejects non-JSON success responses as protocol failures", async () => {
  await assert.rejects(
    () =>
      requestInternalJson(
        "https://internal.example.test/status",
        { method: "GET" },
        {
          timeoutMs: 100,
          fetchFn: async () => new Response("upstream proxy page", { status: 200 }),
        },
      ),
    (error: unknown) => error instanceof JsonResponseProtocolError && error.statusCode === 200,
  );
});

test("safeJsonStringify centralizes null and cyclic fallback semantics", () => {
  assert.equal(safeJsonStringify(null), "{}");
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(safeJsonStringify(cyclic), "{}");
  assert.equal(safeJsonStringify({ ok: true }), '{\n  "ok": true\n}');
});

test("requestInternalJson rejects oversized streamed responses", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("1234"));
      controller.enqueue(new TextEncoder().encode("5678"));
    },
    cancel() {
      cancelled = true;
    },
  });

  await assert.rejects(
    () =>
      requestInternalJson(
        "https://internal.example.test/status",
        { method: "GET" },
        {
          timeoutMs: 100,
          maxBodyBytes: 6,
          fetchFn: async () => new Response(body),
        },
      ),
    (error: unknown) => error instanceof InternalResponseBodyTooLargeError && error.maxBodyBytes === 6,
  );
  assert.equal(cancelled, true);
});
