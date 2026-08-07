import assert from "node:assert/strict";
import test from "node:test";

import { createUpstreamDeadlineSignal, parseUpstreamTimeoutMs } from "./upstream-deadline";

test("parseUpstreamTimeoutMs rejects invalid and undersized values", () => {
  assert.equal(parseUpstreamTimeoutMs(undefined, 30_000), 30_000);
  assert.equal(parseUpstreamTimeoutMs("NaN", 30_000), 30_000);
  assert.equal(parseUpstreamTimeoutMs("249", 30_000), 30_000);
  assert.equal(parseUpstreamTimeoutMs("4500.9", 30_000), 4_500);
});

test("createUpstreamDeadlineSignal propagates parent cancellation", () => {
  const parent = new AbortController();
  const signal = createUpstreamDeadlineSignal(parent.signal, 10_000);

  parent.abort("client disconnected");

  assert.equal(signal.aborted, true);
  assert.equal(signal.reason, "client disconnected");
});

test("createUpstreamDeadlineSignal aborts at its deadline", async () => {
  const signal = createUpstreamDeadlineSignal(new AbortController().signal, 20);
  await new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error("deadline signal did not abort")), 1_000);
    signal.addEventListener("abort", () => {
      clearTimeout(guard);
      resolve();
    }, { once: true });
  });
  assert.equal(signal.aborted, true);
});
