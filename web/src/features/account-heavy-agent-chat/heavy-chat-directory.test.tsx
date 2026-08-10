import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HeavyChatDirectory } from "./heavy-chat-directory";

test("collapsed chat directory keeps icon-only controls named for assistive technology", () => {
  const html = renderToStaticMarkup(
    createElement(HeavyChatDirectory, {
      activeProjectId: null,
      activeSlotId: null,
      activeThreadId: null,
      collapsed: true,
      displayName: "Local Dev",
      historyFilter: "all",
      historyGroups: [],
      onCreateThread: () => {},
      onSelectProject: () => {},
      onSelectSlot: () => {},
      onSelectThread: () => {},
      onSetHistoryFilter: () => {},
      onSetSearchQuery: () => {},
      onToggleCollapsed: () => {},
      projects: [],
      searchQuery: "",
      slots: [],
    }),
  );

  assert.match(html, /<input[^>]*aria-label="搜索聊天记录"/);
  assert.match(html, /<button[^>]*aria-label="新聊天"[^>]*title="新聊天"/);
});
