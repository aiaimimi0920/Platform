import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { createDependencyResult } from "@/lib/dependency-result";

import { DependencyState } from "./dependency-state";

test("renders all dependency states with NtCard and the expected NtBadge tone", () => {
  const states = [
    {
      result: createDependencyResult<readonly string[]>({ state: "ready", data: ["alpha"] }),
      badge: "已就绪",
      heading: "服务目录可用",
      toneClass: "nt-chip--success",
    },
    {
      result: createDependencyResult<readonly string[]>({ state: "empty" }),
      badge: "暂无内容",
      heading: "服务目录暂无数据",
      toneClass: "nt-chip--muted",
    },
    {
      result: createDependencyResult<readonly string[]>({
        state: "partial",
        data: ["alpha"],
        failures: [{ message: "部分来源暂不可用。" }],
        retry: { retryable: true, retryAfterMs: null },
      }),
      badge: "部分可用",
      heading: "服务目录仅部分可用",
      toneClass: "nt-chip--warning",
    },
    {
      result: createDependencyResult<readonly string[]>({
        state: "unavailable",
        failures: [{ message: "目录暂不可用。" }],
        retry: { retryable: true, retryAfterMs: 1_000 },
      }),
      badge: "暂不可用",
      heading: "服务目录暂不可用",
      toneClass: "nt-chip--danger",
    },
    {
      result: createDependencyResult<readonly string[]>({
        state: "unauthorized",
        failures: [{ message: "请先完成授权。" }],
        retry: { retryable: false, retryAfterMs: null },
      }),
      badge: "需要授权",
      heading: "服务目录需要授权",
      toneClass: "nt-chip--warning",
    },
  ];

  for (const state of states) {
    const markup = renderToStaticMarkup(<DependencyState label="服务目录" result={state.result} />);

    assert.match(markup, /class="nt-card nt-card--outlined"/);
    assert.match(markup, /class="nt-chip /);
    assert.match(markup, new RegExp(state.toneClass));
    assert.match(markup, new RegExp(state.badge));
    assert.match(markup, new RegExp(state.heading));
  }
});

test("marks the root dependency state as a polite atomic status region", () => {
  const markup = renderToStaticMarkup(
    <DependencyState
      label="模型目录"
      result={createDependencyResult({ state: "ready", data: ["model-a"] })}
    />,
  );

  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /aria-atomic="true"/);
});

test("keeps technical diagnostics hidden unless diagnostics mode is explicit", () => {
  const result = createDependencyResult<readonly string[]>({
    state: "unavailable",
    correlationId: "corr-catalog-503",
    failures: [
      {
        message: "服务目录暂不可用。token=message-secret",
        source: "gateway-catalog",
        code: "UPSTREAM_503",
        diagnostics:
          "Authorization: Bearer diagnostic-secret api_key=diagnostic-key password=diagnostic-password sk-diagnostic",
      },
    ],
    retry: { retryable: true, retryAfterMs: 3_000 },
  });

  const defaultMarkup = renderToStaticMarkup(<DependencyState label="服务目录" result={result} />);
  assert.match(defaultMarkup, /服务目录暂不可用/);
  assert.match(defaultMarkup, /\[REDACTED\]/);
  assert.doesNotMatch(defaultMarkup, /gateway-catalog/);
  assert.doesNotMatch(defaultMarkup, /UPSTREAM_503/);
  assert.doesNotMatch(defaultMarkup, /corr-catalog-503/);
  assert.doesNotMatch(defaultMarkup, /3000 ms/);
  assert.doesNotMatch(defaultMarkup, /Authorization/);

  const diagnosticsMarkup = renderToStaticMarkup(
    <DependencyState diagnostics label="服务目录" result={result} />,
  );
  assert.match(diagnosticsMarkup, /gateway-catalog/);
  assert.match(diagnosticsMarkup, /UPSTREAM_503/);
  assert.match(diagnosticsMarkup, /corr-catalog-503/);
  assert.match(diagnosticsMarkup, /3000 ms/);
  assert.match(diagnosticsMarkup, /Authorization/);
  assert.match(diagnosticsMarkup, /\[REDACTED\]/);

  for (const secret of [
    "message-secret",
    "diagnostic-secret",
    "diagnostic-key",
    "diagnostic-password",
    "sk-diagnostic",
  ]) {
    assert.doesNotMatch(diagnosticsMarkup, new RegExp(secret));
  }
});
