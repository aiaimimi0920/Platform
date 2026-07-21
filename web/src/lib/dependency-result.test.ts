import assert from "node:assert/strict";
import test from "node:test";

import {
  createDependencyResult,
  normalizeDependencyResult,
  type DependencyResultInput,
} from "./dependency-result";

test("creates ready, empty, partial, unavailable, and unauthorized dependency results", () => {
  const ready = createDependencyResult({
    state: "ready",
    data: { items: ["alpha"] },
  });
  const empty = createDependencyResult<{ items: readonly string[] }>({
    state: "empty",
    correlationId: null,
  });
  const partial = createDependencyResult({
    state: "partial",
    data: { items: ["alpha"] },
    correlationId: "corr-partial",
    failures: [
      {
        message: "部分目录暂不可用。",
        source: "gateway-catalog",
        code: "UPSTREAM_PARTIAL",
      },
    ],
    retry: { retryable: true, retryAfterMs: 2_500 },
  });
  const unavailable = createDependencyResult<{ items: readonly string[] }>({
    state: "unavailable",
    failures: [{ message: "目录服务暂不可用。" }],
    retry: { retryable: true, retryAfterMs: null },
  });
  const unauthorized = createDependencyResult<{ items: readonly string[] }>({
    state: "unauthorized",
    correlationId: "corr-auth",
    failures: [{ message: "当前账户无权访问目录。", code: "FORBIDDEN" }],
    retry: { retryable: false, retryAfterMs: null },
  });

  assert.deepEqual(ready, {
    state: "ready",
    data: { items: ["alpha"] },
    failures: [],
    correlationId: null,
    retry: null,
  });
  assert.deepEqual(empty, {
    state: "empty",
    data: null,
    failures: [],
    correlationId: null,
    retry: null,
  });
  assert.equal(partial.state, "partial");
  assert.equal(partial.failures.length, 1);
  assert.equal(partial.failures[0].diagnostics, null);
  assert.deepEqual(partial.retry, { retryable: true, retryAfterMs: 2_500 });
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.data, null);
  assert.equal(unauthorized.state, "unauthorized");
  assert.deepEqual(unauthorized.retry, { retryable: false, retryAfterMs: null });
});

test("partial results require at least one failure in the type and at runtime", () => {
  if (false) {
    createDependencyResult({
      state: "partial",
      data: { items: [] },
      // @ts-expect-error partial failures must be a non-empty tuple
      failures: [],
      retry: { retryable: true, retryAfterMs: null },
    });
  }

  const invalidPartial = {
    state: "partial",
    data: { items: [] },
    failures: [],
    retry: { retryable: true, retryAfterMs: null },
  } as unknown as DependencyResultInput<{ items: readonly string[] }>;

  assert.throws(
    () => normalizeDependencyResult(invalidPartial),
    /partial dependency results require at least one failure/i,
  );
});

test("normalization preserves correlation ids and leaves missing ids as null", () => {
  const withoutCorrelation = normalizeDependencyResult({ state: "ready", data: ["alpha"] });
  const withCorrelation = normalizeDependencyResult({
    state: "ready",
    data: ["alpha"],
    correlationId: "request-01HZX",
  });

  assert.equal(withoutCorrelation.correlationId, null);
  assert.equal(withCorrelation.correlationId, "request-01HZX");
});

test("normalization redacts credential-shaped correlation ids before diagnostics render", () => {
  const result = normalizeDependencyResult({
    state: "unavailable",
    correlationId: "request token=correlation-secret sk-correlation-secret",
    failures: [{ message: "目录服务暂不可用。" }],
    retry: { retryable: true, retryAfterMs: null },
  });

  assert.doesNotMatch(result.correlationId ?? "", /correlation-secret/);
  assert.match(result.correlationId ?? "", /\[REDACTED\]/);
});

test("normalization preserves explicit retry metadata and rejects contradictory delays", () => {
  const retryable = normalizeDependencyResult({
    state: "unavailable",
    failures: [{ message: "请稍后重试。" }],
    retry: { retryable: true, retryAfterMs: 1_500 },
  });
  const terminal = normalizeDependencyResult({
    state: "unauthorized",
    failures: [{ message: "需要重新授权。" }],
    retry: { retryable: false, retryAfterMs: null },
  });

  assert.deepEqual(retryable.retry, { retryable: true, retryAfterMs: 1_500 });
  assert.deepEqual(terminal.retry, { retryable: false, retryAfterMs: null });

  const contradictory = {
    state: "unavailable",
    failures: [{ message: "不会自动恢复。" }],
    retry: { retryable: false, retryAfterMs: 500 },
  } as unknown as DependencyResultInput<never>;
  assert.throws(
    () => normalizeDependencyResult(contradictory),
    /non-retryable dependency failures cannot include retryAfterMs/i,
  );
});

test("normalization redacts credentials from failure messages and diagnostics", () => {
  const result = normalizeDependencyResult({
    state: "partial",
    data: { items: ["alpha"] },
    failures: [
      {
        message:
          "Authorization: Bearer auth-secret token=token-secret api_key=api-secret password=pw-secret sk-live-123",
        source: "gateway?api key=source-secret",
        code: "token=code-secret",
        diagnostics:
          'Bearer diag-bearer; api key="diag-key"; password: diag-password; sk-diagnostic-secret',
      },
    ],
    retry: { retryable: true, retryAfterMs: null },
  });

  assert.equal(result.state, "partial");
  const failure = result.failures[0];
  const visibleFailureText = [failure.message, failure.source, failure.code, failure.diagnostics].join(" ");

  for (const secret of [
    "auth-secret",
    "token-secret",
    "api-secret",
    "pw-secret",
    "sk-live-123",
    "source-secret",
    "code-secret",
    "diag-bearer",
    "diag-key",
    "diag-password",
    "sk-diagnostic-secret",
  ]) {
    assert.doesNotMatch(visibleFailureText, new RegExp(secret));
  }
  assert.match(visibleFailureText, /\[REDACTED\]/);
});
