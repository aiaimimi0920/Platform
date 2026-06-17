import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  fetchInternal,
  getInternalRequestTelemetrySnapshot,
  resetInternalRequestTelemetryForTests,
} from "./internal-request";

describe("fetchInternal", () => {
  afterEach(() => {
    resetInternalRequestTelemetryForTests();
  });

  it("retries GET network failures using the configured retry delays", async () => {
    let attempts = 0;
    const response = await fetchInternal("http://core.test/health", {
      targetService: "core",
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

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.core.retryCount, 1);
    assert.equal(snapshot.byTargetService.core.networkErrorCount, 0);
    assert.equal(snapshot.totals.retryCount, 1);
  });

  it("does not retry POST network failures by default", async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        fetchInternal("http://core.test/v1/mutate", {
          targetService: "core",
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

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.core.retryCount, 0);
    assert.equal(snapshot.byTargetService.core.networkErrorCount, 1);
    assert.equal(snapshot.totals.networkErrorCount, 1);
  });

  it("records exhausted network retries by target service", async () => {
    let attempts = 0;

    await assert.rejects(
      () =>
        fetchInternal("http://account.test/v1/status", {
          targetService: "account",
          retryDelaysMs: [0, 0],
          fetchImpl: async () => {
            attempts += 1;
            throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
          },
        }),
      /fetch failed/,
    );

    assert.equal(attempts, 3);

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.account.retryCount, 2);
    assert.equal(snapshot.byTargetService.account.networkErrorCount, 1);
    assert.equal(snapshot.byTargetService.account.timeoutCount, 0);
    assert.match(snapshot.byTargetService.account.lastEventAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
  });

  it("aborts a hung request and marks it as an internal request timeout", async () => {
    await assert.rejects(
      () =>
        fetchInternal("http://core.test/hung", {
          targetService: "gateway",
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

    const snapshot = getInternalRequestTelemetrySnapshot();
    assert.equal(snapshot.byTargetService.gateway.timeoutCount, 1);
    assert.equal(snapshot.byTargetService.gateway.networkErrorCount, 0);
    assert.equal(snapshot.totals.timeoutCount, 1);
  });
});
