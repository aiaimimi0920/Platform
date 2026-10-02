import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, test } from "node:test";
import { classifyInternalDependencyError, fetchInternal, getInternalRequestTelemetrySnapshot, resetInternalRequestTelemetryForTests } from "./internal-request";

afterEach(resetInternalRequestTelemetryForTests);

async function withServer(handler: (response: ServerResponse) => void, run: (url: string, attempts: () => number) => Promise<void>) {
  let requests = 0;
  const server = createServer((_request, response) => { requests++; handler(response); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`, () => requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function isTimeout(error: unknown) {
  assert.ok(error instanceof Error);
  const details = error as Error & { code: string; service: string; requestId: string; diagnostics: string };
  assert.equal(details.code, "INTERNAL_REQUEST_TIMEOUT");
  assert.equal(details.service, "core");
  assert.match(details.requestId, /^web-core-/);
  assert.match(details.diagnostics, /category=dependency/);
  return true;
}

for (const status of [200, 503]) {
  test(`deadline covers stalled ${status} response bodies without retry`, { timeout: 2000 }, async () => {
    await withServer((response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.write('{"partial":');
    }, async (url, attempts) => {
      const response = await fetchInternal(url, { targetService: "core", timeoutMs: 100, retryDelaysMs: [0, 0] });
      assert.equal(response.url, url + "/");
      await assert.rejects(status === 200 ? response.json() : classifyInternalDependencyError(response, {
        targetService: "core", fallbackMessage: "Unavailable",
      }), isTimeout);
      assert.equal(attempts(), 1);
      assert.equal(getInternalRequestTelemetrySnapshot().byTargetService.core.timeoutCount, 1);
      assert.equal(getInternalRequestTelemetrySnapshot().totals.retryCount, 0);
    });
  });
}

test("header timeout remains classified and is not retried", { timeout: 2000 }, async () => {
  await withServer(() => {}, async (url, attempts) => {
    await assert.rejects(fetchInternal(url, { targetService: "core", timeoutMs: 50 }), isTimeout);
    assert.equal(attempts(), 1);
  });
});

test("healthy JSON reaches EOF and clears the deadline", async () => {
  await withServer((response) => response.end('{"ok":true}'), async (url) => {
    const response = await fetchInternal(url, { targetService: "core", timeoutMs: 100 });
    assert.deepEqual(await response.json(), { ok: true });
    await delay(130);
    assert.equal(getInternalRequestTelemetrySnapshot().totals.timeoutCount, 0);
  });
});

test("complete malformed JSON remains a parse error, not a timeout", async () => {
  await withServer((response) => response.end('{"partial":'), async (url) => {
    const response = await fetchInternal(url, { targetService: "core", timeoutMs: 100 });
    await assert.rejects(response.json(), SyntaxError);
    await delay(130);
    assert.equal(getInternalRequestTelemetrySnapshot().totals.timeoutCount, 0);
  });
});

test("consumer cancellation cancels the upstream reader and clears its timer", async () => {
  let cancellation: unknown;
  const response = await fetchInternal("http://core.test/cancel", {
    timeoutMs: 30,
    fetchImpl: async () => new Response(new ReadableStream({
      cancel(reason) { cancellation = reason; },
    })),
  });
  await response.body!.cancel("navigation ended");
  assert.equal(cancellation, "navigation ended");
  await delay(60);
  assert.equal(getInternalRequestTelemetrySnapshot().totals.timeoutCount, 0);
});

test("body timeout cancels even a custom stream that ignores fetch abort", async () => {
  let cancelled = false;
  const response = await fetchInternal("http://core.test/hung", {
    targetService: "core", timeoutMs: 20,
    fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })),
  });
  await assert.rejects(response.text(), isTimeout);
  assert.equal(cancelled, true);
});

test("bodyless responses clear their deadline", async () => {
  const original = new Response(null, { status: 204 });
  const response = await fetchInternal("http://core.test/empty", { timeoutMs: 20, fetchImpl: async () => original });
  assert.equal(response, original);
  await delay(40);
  assert.equal(getInternalRequestTelemetrySnapshot().totals.timeoutCount, 0);
});

test("response reconstruction and cloning preserve fetch metadata and headers", async () => {
  const original = new Response('{"ok":true}', { status: 201, statusText: "Created", headers: { "x-proof": "retained" } });
  Object.defineProperties(original, { url: { value: "http://core.test/final" }, redirected: { value: true }, type: { value: "basic" } });
  const response = await fetchInternal("http://core.test/start", { fetchImpl: async () => original });
  const clone = response.clone();
  for (const item of [response, clone]) {
    assert.equal(item.status, 201);
    assert.equal(item.statusText, "Created");
    assert.equal(item.headers.get("x-proof"), "retained");
    assert.equal(item.url, original.url);
    assert.equal(item.redirected, true);
    assert.equal(item.type, "basic");
  }
  assert.deepEqual(await Promise.all([response.json(), clone.json()]), [{ ok: true }, { ok: true }]);
  assert.equal(original.body!.locked, false);
});

test("error responses with status zero remain bodyless and unchanged", async () => {
  const original = Response.error();
  const response = await fetchInternal("http://core.test/error", { timeoutMs: 20, fetchImpl: async () => original });
  assert.equal(response, original);
  await delay(40);
  assert.equal(getInternalRequestTelemetrySnapshot().totals.timeoutCount, 0);
});
