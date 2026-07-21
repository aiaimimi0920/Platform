import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HeavyChatComposer } from "./heavy-chat-composer";

const baseProps = {
  actionNotice: null,
  draft: "",
  mode: "thread" as const,
  onAddReference: () => {},
  onQuickPrompt: () => {},
  onRemoveReference: () => {},
  onSend: () => {},
  onSetDraft: () => {},
  onToggleWebSearch: () => {},
  project: null,
  references: [],
  streaming: false,
  webSearchEnabled: false,
};

test("P2-05 RED: workflow notices are announced and readable without claiming message streaming", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatComposer, {
    ...baseProps,
    actionNotice: {
      id: "notice-1",
      tone: "warning",
      message: "正在创建 Task Hub 草稿。",
    },
  }));
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const workspaceSource = readFileSync(new URL("./chat-workspace.tsx", import.meta.url), "utf8");

  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /nt-chat-app-composer__notice-badge/);
  assert.match(html, /nt-chat-app-composer__notice-badge--warning/);
  assert.doesNotMatch(html, /Streaming|回复生成中/);
  assert.match(
    styles,
    /\.nt-chat-app-composer__notice-badge\s*\{[^}]*color:\s*#(?:0f1720|111827);[^}]*\}/s,
  );
  assert.match(workspaceSource, /threadState\.messageBusy/);
  assert.doesNotMatch(workspaceSource, /threadState\.busy\s*\|\|/);
});

test("P2-05 RED: the composer reports real assistant generation in Chinese", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatComposer, {
    ...baseProps,
    streaming: true,
  }));

  assert.match(html, /回复生成中/);
});
