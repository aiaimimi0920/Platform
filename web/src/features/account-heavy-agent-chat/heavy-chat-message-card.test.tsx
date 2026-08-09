import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HeavyChatMessageCard } from "./heavy-chat-message-card";
import type { HeavyChatMessage } from "./types";

function message(overrides: Partial<HeavyChatMessage> = {}): HeavyChatMessage {
  return {
    id: "message-1",
    sequence: 1,
    role: "assistant",
    status: "complete",
    createdAtLabel: "12:00",
    meta: null,
    blocks: [{ id: "text-1", type: "text", text: "Result" }],
    actions: [],
    ...overrides,
  };
}

test("P2-05 RED: message card renders persisted action links and retry states", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatMessageCard, {
    message: message({
      actions: [
        {
          id: "task-action",
          type: "task",
          status: "complete",
          attemptNumber: 1,
          targetId: "task-1",
          errorMessage: null,
          updatedAt: "2026-07-20T08:00:00.000Z",
          href: "/my-tasks#task-task-1",
        },
        {
          id: "mailbox-action",
          type: "mailbox",
          status: "failed",
          attemptNumber: 2,
          targetId: null,
          errorMessage: "Mailbox unavailable",
          updatedAt: "2026-07-20T08:00:00.000Z",
          href: null,
        },
      ],
    }),
    mailboxActionEnabled: true,
    onAction: () => {},
    taskActionEnabled: true,
  }));

  assert.match(html, /href="\/my-tasks#task-task-1"/);
  assert.match(html, /查看任务草稿/);
  assert.match(html, /重试投邮箱/);
  assert.match(html, /Mailbox unavailable/);
});

test("P2-05 RED: message actions remain readable on the light conversation surface", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatMessageCard, {
    message: message({
      actions: [
        {
          id: "task-action",
          type: "task",
          status: "complete",
          attemptNumber: 1,
          targetId: "task-1",
          errorMessage: null,
          updatedAt: "2026-07-20T08:00:00.000Z",
          href: "/my-tasks#task-task-1",
        },
      ],
    }),
    mailboxActionEnabled: true,
    onAction: () => {},
    taskActionEnabled: true,
  }));
  const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(html, /nt-chat-app-message__action-control/);
  assert.match(
    styles,
    /\.nt-chat-app-message__action-control\s*\{[^}]*color:\s*#(?:0f1720|111827);[^}]*\}/s,
  );
  assert.match(styles, /\.nt-chat-app-message__action-control:hover/);
  assert.match(styles, /\.nt-chat-app-message__action-control:focus-visible/);
  assert.match(styles, /\.nt-chat-app-message__actions\s*\{[^}]*flex-wrap:\s*wrap;[^}]*\}/s);
});

test("P2-05 RED: non-complete assistant messages do not expose workflow actions", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatMessageCard, {
    message: message({ status: "streaming" }),
    mailboxActionEnabled: true,
    onAction: () => {},
    taskActionEnabled: true,
  }));

  assert.doesNotMatch(html, /转任务/);
  assert.doesNotMatch(html, /投邮箱/);
});

test("P2-05 RED: pending workflow actions keep a manual recovery path", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatMessageCard, {
    message: message({
      actions: [
        {
          id: "task-action",
          type: "task",
          status: "pending",
          attemptNumber: 1,
          targetId: null,
          errorMessage: null,
          updatedAt: "2026-07-20T08:00:00.000Z",
          href: null,
        },
      ],
    }),
    mailboxActionEnabled: true,
    onAction: () => {},
    taskActionEnabled: true,
  }));

  assert.match(html, /检查任务进度/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("P2-05 RED: unavailable workflow surfaces do not render action controls", () => {
  const html = renderToStaticMarkup(createElement(HeavyChatMessageCard, {
    mailboxActionEnabled: false,
    message: message(),
    onAction: () => {},
    taskActionEnabled: false,
  }));

  assert.doesNotMatch(html, /转任务|查看任务草稿|检查任务进度/);
  assert.doesNotMatch(html, /投邮箱|查看邮箱草稿|检查邮箱进度/);
});
