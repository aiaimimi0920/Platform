import assert from "node:assert/strict";
import test from "node:test";

import {
  InternalRequestTimeoutError,
  requestInternalText,
} from "./internal-request";

test("requestInternalText returns the status and fully-read response body", async () => {
  const result = await requestInternalText(
    "http://internal.test/ready",
    { method: "POST" },
    {
      timeoutMs: 100,
      fetchFn: async () => new Response("ready", { status: 202 }),
    },
  );

  assert.equal(result.response.status, 202);
  assert.equal(result.text, "ready");
});

test("requestInternalText aborts a request that does not return headers", async () => {
  let aborted = false;
  const fetchFn = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(init.signal?.reason);
        },
        { once: true },
      );
    });

  await assert.rejects(
    () =>
      requestInternalText(
        "http://internal.test/stall",
        {},
        { timeoutMs: 20, timeoutMessage: "Core request timed out", fetchFn },
      ),
    (error: unknown) => {
      assert.ok(error instanceof InternalRequestTimeoutError);
      assert.equal(error.code, "INTERNAL_REQUEST_TIMEOUT");
      assert.equal(error.message, "Core request timed out");
      return true;
    },
  );
  assert.equal(aborted, true);
});

test("requestInternalText bounds the response body read", async () => {
  let aborted = false;
  const fetchFn = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
    }, { once: true });
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("partial"));
      },
    }));
  };

  await assert.rejects(
    () => requestInternalText("http://internal.test/stalled-body", {}, { timeoutMs: 20, fetchFn }),
    InternalRequestTimeoutError,
  );
  assert.equal(aborted, true);
});

test("requestInternalText validates timeout configuration before dispatch", async () => {
  let called = false;
  await assert.rejects(
    () =>
      requestInternalText("http://internal.test", {}, {
        timeoutMs: 0,
        fetchFn: async () => {
          called = true;
          return new Response();
        },
      }),
    /positive number/,
  );
  assert.equal(called, false);
});
