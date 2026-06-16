import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchInternal } from "./internal-request";

describe("fetchInternal", () => {
  it("retries GET network failures using the configured retry delays", async () => {
    let attempts = 0;
    const response = await fetchInternal("http://core.test/health", {
      retryDelaysMs: [0, 0],
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
        }
        return Response.json({ ok: true });
      },
    });

    assert.equal(attempts, 2);
    assert.equal(response.ok, true);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("does not retry POST network failures by default", async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        fetchInternal("http://core.test/v1/mutate", {
          method: "POST",
          retryDelaysMs: [0, 0],
          fetchImpl: async () => {
            attempts += 1;
            throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
          },
        }),
      /fetch failed/,
    );

    assert.equal(attempts, 1);
  });

  it("aborts a hung request and marks it as an internal request timeout", async () => {
    await assert.rejects(
      () =>
        fetchInternal("http://core.test/hung", {
          timeoutMs: 1,
          retryDelaysMs: [],
          fetchImpl: async (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              });
            }),
        }),
      (error) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "INTERNAL_REQUEST_TIMEOUT",
    );
  });
});
