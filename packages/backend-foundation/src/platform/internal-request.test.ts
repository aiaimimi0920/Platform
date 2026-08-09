import assert from "node:assert/strict";
import test from "node:test";

import {
  InternalResponseBodyTooLargeError,
  InternalRequestTimeoutError,
  requestInternalArrayBuffer,
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

test("requestInternalText cancels response bodies that exceed the configured byte limit", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(128));
      },
      cancel() {
        cancelled = true;
      },
    }),
  );

  await assert.rejects(
    () =>
      requestInternalText("http://internal.test/oversized", {}, {
        timeoutMs: 100,
        maxBodyBytes: 32,
        fetchFn: async () => response,
      }),
    (error: unknown) => {
      assert.ok(error instanceof InternalResponseBodyTooLargeError);
      assert.equal(error.code, "INTERNAL_RESPONSE_BODY_TOO_LARGE");
      assert.equal(error.maxBodyBytes, 32);
      return true;
    },
  );
  assert.equal(cancelled, true);
});

test("requestInternalText validates response body limits before dispatch", async () => {
  let called = false;
  await assert.rejects(
    () =>
      requestInternalText("http://internal.test", {}, {
        timeoutMs: 100,
        maxBodyBytes: 0,
        fetchFn: async () => {
          called = true;
          return new Response();
        },
      }),
    /positive integer/,
  );
  assert.equal(called, false);
});

test("requestInternalArrayBuffer returns a fully-read binary response", async () => {
  const bytes = new Uint8Array([0, 1, 127, 255]);
  const result = await requestInternalArrayBuffer(
    "http://internal.test/binary",
    {},
    {
      timeoutMs: 100,
      fetchFn: async () => new Response(bytes, { status: 206 }),
    },
  );

  assert.equal(result.response.status, 206);
  assert.deepEqual(new Uint8Array(result.arrayBuffer), bytes);
});

test("requestInternalArrayBuffer bounds a stalled binary response body", async () => {
  let aborted = false;
  const fetchFn = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
    }, { once: true });
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
    }));
  };

  await assert.rejects(
    () => requestInternalArrayBuffer("http://internal.test/stalled-binary", {}, { timeoutMs: 20, fetchFn }),
    InternalRequestTimeoutError,
  );
  assert.equal(aborted, true);
});
