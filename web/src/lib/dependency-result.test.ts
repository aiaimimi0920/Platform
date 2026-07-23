import assert from "node:assert/strict";
import test from "node:test";

import {
  combineDependencyResults,
  createDependencyFailureResult,
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

test("dependency failures classify unauthorized, timeout, and server errors without leaking diagnostics", () => {
  const unauthorized = createDependencyFailureResult<never>({
    error: Object.assign(new Error("Authorization: Bearer auth-secret"), { code: "UNAUTHORIZED" }),
    message: "依赖服务暂不可用。",
    source: "account",
    unauthorizedMessage: "当前账户无权访问依赖服务。",
  });
  const timeout = createDependencyFailureResult<never>({
    error: Object.assign(new Error("token=timeout-secret"), { code: "INTERNAL_REQUEST_TIMEOUT" }),
    message: "依赖服务暂不可用。",
    source: "core",
  });
  const serverError = createDependencyFailureResult<never>({
    error: Object.assign(new Error("password=server-secret"), { code: "INTERNAL_SERVER_ERROR" }),
    message: "依赖服务暂不可用。",
    source: "core",
  });

  assert.equal(unauthorized.state, "unauthorized");
  assert.equal(unauthorized.failures[0]?.message, "当前账户无权访问依赖服务。");
  assert.deepEqual(unauthorized.retry, { retryable: false, retryAfterMs: null });
  assert.equal(timeout.state, "unavailable");
  assert.deepEqual(timeout.retry, { retryable: true, retryAfterMs: null });
  assert.equal(serverError.state, "unavailable");
  assert.doesNotMatch(
    [unauthorized.failures[0]?.diagnostics, timeout.failures[0]?.diagnostics, serverError.failures[0]?.diagnostics].join(" "),
    /auth-secret|timeout-secret|server-secret/,
  );
});

test("dependency failures recognize auth errors that carry a 401 status or standard auth message", () => {
  const statusUnauthorized = createDependencyFailureResult<never>({
    error: Object.assign(new Error("request rejected"), { statusCode: 401 }),
    message: "依赖服务暂不可用。",
    source: "account",
    unauthorizedMessage: "当前账户无权访问依赖服务。",
  });
  const messageUnauthorized = createDependencyFailureResult<never>({
    error: new Error("Authentication required"),
    message: "依赖服务暂不可用。",
    source: "account",
    unauthorizedMessage: "当前账户无权访问依赖服务。",
  });

  assert.equal(statusUnauthorized.state, "unauthorized");
  assert.equal(messageUnauthorized.state, "unauthorized");
  assert.deepEqual(statusUnauthorized.retry, { retryable: false, retryAfterMs: null });
  assert.deepEqual(messageUnauthorized.retry, { retryable: false, retryAfterMs: null });
});

test("dependency failure factories never serialize arbitrary raw error messages as diagnostics", () => {
  const result = createDependencyFailureResult<never>({
    error: new Error(
      "Set-Cookie: session=abc123; client_secret=s3cr3t; email_code=654321; SELECT * FROM users",
    ),
    message: "依赖服务暂不可用。",
    source: "account",
  });

  assert.equal(result.failures[0]?.diagnostics, null);
  assert.doesNotMatch(JSON.stringify(result), /abc123|s3cr3t|654321|SELECT \* FROM users/);
});

test("dependency result aggregation distinguishes empty, partial, and all-source unauthorized states", () => {
  const readyEmpty = createDependencyResult({ state: "ready", data: [] as string[] });
  const unavailable = createDependencyResult<string[]>({
    state: "unavailable",
    failures: [{ source: "catalog", message: "目录暂不可用。" }],
    retry: { retryable: true, retryAfterMs: 2_000 },
  });
  const unauthorized = createDependencyResult<string[]>({
    state: "unauthorized",
    failures: [{ source: "account", message: "当前账户无权访问。" }],
    retry: { retryable: false, retryAfterMs: null },
  });

  const empty = combineDependencyResults({ data: { items: [] }, empty: true, results: [readyEmpty] });
  const partial = combineDependencyResults({
    data: { items: ["preserved"] },
    empty: false,
    results: [readyEmpty, unavailable],
  });
  const denied = combineDependencyResults({
    data: { items: [] },
    empty: true,
    results: [unauthorized, unauthorized],
  });

  assert.equal(empty.state, "empty");
  assert.equal(partial.state, "partial");
  assert.deepEqual(partial.data.items, ["preserved"]);
  assert.deepEqual(partial.retry, { retryable: true, retryAfterMs: 2_000 });
  assert.equal(denied.state, "unauthorized");
});

test("dependency aggregation keeps partial data when another source is unavailable", () => {
  const partial = createDependencyResult<string[]>({
    state: "partial",
    data: ["usable"],
    failures: [{ source: "secondary", message: "次要来源暂不可用。" }],
    retry: { retryable: true, retryAfterMs: null },
  });
  const unavailable = createDependencyResult<string[]>({
    state: "unavailable",
    failures: [{ source: "primary", message: "主来源暂不可用。" }],
    retry: { retryable: true, retryAfterMs: null },
  });

  const aggregate = combineDependencyResults({
    data: { items: ["usable"] },
    empty: false,
    results: [partial, unavailable],
  });

  assert.equal(aggregate.state, "partial");
  assert.deepEqual(aggregate.data?.items, ["usable"]);
  assert.equal(aggregate.failures.length, 2);
});

test("dependency aggregation never discards data when every source is partial", () => {
  const first = createDependencyResult<string[]>({
    state: "partial",
    data: ["first"],
    failures: [{ source: "first-source", message: "第一来源部分失败。" }],
    retry: { retryable: true, retryAfterMs: null },
  });
  const second = createDependencyResult<string[]>({
    state: "partial",
    data: ["second"],
    failures: [{ source: "second-source", message: "第二来源部分失败。" }],
    retry: { retryable: true, retryAfterMs: null },
  });

  const aggregate = combineDependencyResults({
    data: { items: ["first", "second"] },
    empty: false,
    results: [first, second],
  });

  assert.equal(aggregate.state, "partial");
  assert.deepEqual(aggregate.data?.items, ["first", "second"]);
});
