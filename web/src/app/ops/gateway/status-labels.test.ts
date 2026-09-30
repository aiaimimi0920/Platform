import assert from "node:assert/strict";
import test from "node:test";

import {
  gatewayConversationArchiveStatusLabel,
  gatewayCredentialModelStatusLabel,
} from "./status-labels";

test("Gateway conversation archive statuses have operator-facing labels", () => {
  assert.equal(gatewayConversationArchiveStatusLabel("completed"), "已完成");
  assert.equal(gatewayConversationArchiveStatusLabel("failed"), "失败");
  assert.equal(gatewayConversationArchiveStatusLabel("partial"), "部分完成");
  assert.equal(gatewayConversationArchiveStatusLabel("archive_failed"), "归档失败");
});

test("Gateway credential-model statuses have operator-facing labels", () => {
  assert.equal(gatewayCredentialModelStatusLabel("active"), "正常");
  assert.equal(gatewayCredentialModelStatusLabel("degraded"), "降级");
  assert.equal(gatewayCredentialModelStatusLabel("cooling"), "冷却中");
  assert.equal(gatewayCredentialModelStatusLabel("blocked"), "已阻断");
});

test("unknown Gateway statuses remain inspectable", () => {
  assert.equal(gatewayConversationArchiveStatusLabel("queued"), "queued");
  assert.equal(gatewayCredentialModelStatusLabel("probing"), "probing");
});
